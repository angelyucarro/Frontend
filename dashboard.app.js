
        // --- 0. CONSTANTS & UTILS ---
        const monthNamesFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        // ACTUALIZADO: Añadido 'Recolección Pend.' a la paleta de colores
        const PROVIDER_COLORS = { 'Mil Neumaticos': '#f97316', 'Mil Neumáticos': '#f97316', 'Llantamaya': '#22c55e', 'Prometeon': '#eab308', 'Patio PRS': '#ec4899', 'Venta Ext': '#0ea5e9', 'Sin Asignar': '#94a3b8', 'Recolección Pend.': '#94a3b8' };
        const FALLBACK_COLORS = ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24', '#60a5fa'];
        
        // --- COLORES CORPORATIVOS (ACTUALIZADOS) ---
        const COMPANY_COLORS = {
            // Variantes para asegurar coincidencia
            'Yucarro': '#00B0F0',   'YUCARRO': '#00B0F0', 'YUC': '#00B0F0',
            'T2020': '#4472C4',
            'LMR': '#00B050',
            'Corpored': '#ED7D31',  'CORPORED': '#ED7D31', 'CR': '#ED7D31',
            'CAMECAM': '#FFC000',   'CMC': '#FFC000',
            'CCM': '#A568D2',
            'Externo': '#FF6161',   'Venta Ext': '#FF6161',
            
            // Otros
            'LORM': '#0e7490',    
            'La Paz': '#DAA0FA', 'LA PAZ': '#DAA0FA', 'CR LPZ': '#DAA0FA',
            'Pipitas': '#be185d', 
            'Sin Asignar': '#64748b' 
        };

        const PALETTE_FALLBACK = [
            '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', 
            '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#84cc16', 
            '#14b8a6', '#d946ef', '#f43f5e', '#eab308'
        ];
        const COLORBLIND_PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442', '#56B4E9', '#D55E00', '#999999'];
        const LOSS_PREFIX_COLORS = {
            DESC_PEMEX: '#00B050',
            ABS_TRANSP: '#FFD966',
            DESC_OPERADOR: '#FC6464'
        };

        // --- GLOBAL STATE ---
        let isColorblind = false;
        
        // --- FUNCIONES DE UTILIDAD MOVIDAS AL INICIO PARA HOISTING SEGURO ---
        function toggleColorblindMode() {
            if (!currentUser || !userCanUseColorblind(currentUser)) {
                logStatus('No tienes permiso para usar Modo Contraste.', 'error');
                return;
            }
            isColorblind = !isColorblind;
            const btn = document.getElementById('btnColorblind');
            if (btn) {
                if (isColorblind) {
                    btn.classList.add('bg-slate-300', 'text-slate-900', 'font-bold');
                    btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                } else {
                    btn.classList.remove('bg-slate-300', 'text-slate-900', 'font-bold');
                    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
                }
            }
            // Refrescar el tab actual para aplicar colores
            window.switchTab(moduleState.currentTab);
        }

        // --- UI HELPERS FOR DROPDOWNS ---
        window.toggleFilterDropdown = function(id, event) {
            event.stopPropagation();
            const el = document.getElementById(id);
            if(el) el.classList.toggle('show');
        };

        window.handleMultiSelectChange = function(containerId, checkbox) {
            const container = document.getElementById(containerId);
            const allCheckbox = container.querySelector('input[value="ALL"]');
            const otherCheckboxes = container.querySelectorAll('input[type="checkbox"]:not([value="ALL"])');

            if (checkbox.value === 'ALL') {
                if(checkbox.checked) {
                     otherCheckboxes.forEach(cb => cb.checked = true);
                } else {
                     otherCheckboxes.forEach(cb => cb.checked = false);
                }
            } else {
                if (!checkbox.checked) {
                    allCheckbox.checked = false;
                } else {
                    const allChecked = Array.from(otherCheckboxes).every(cb => cb.checked);
                    if(allChecked) allCheckbox.checked = true;
                }
            }
            
            // Update Button Label
            const count = Array.from(otherCheckboxes).filter(c => c.checked).length;
            const total = otherCheckboxes.length;
            const btnId = containerId.replace('dropdown', 'btn');
            const btn = document.getElementById(btnId);
            
            let labelBase = "";
            if(btnId.includes('Engine')) labelBase = "Motores";
            else if(btnId.includes('Company')) labelBase = "Sociedades";
            else if(btnId.includes('Segment')) labelBase = "Segmentos";

            if (allCheckbox.checked || count === total) {
                btn.innerHTML = `${labelBase}: Todos <i class="fa-solid fa-chevron-down text-[10px]"></i>`;
            } else {
                btn.innerHTML = `${labelBase} (${count}) <i class="fa-solid fa-chevron-down text-[10px]"></i>`;
            }

            // Trigger Update
            window.updateManufacturerChart();
        };

        function populateMultiSelect(containerId, options, category) {
            const container = document.getElementById(containerId);
            if(!container) return; 
            if(container.children.length > 0) return; // Already populated

            const buildOption = (value, labelText, classes) => {
                const label = document.createElement('label');
                label.className = classes;
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = value;
                input.checked = true;
                input.addEventListener('change', () => window.handleMultiSelectChange(containerId, input));
                const span = document.createElement('span');
                span.className = value === 'ALL' ? 'ml-2 font-bold text-slate-700' : 'ml-2';
                span.innerText = labelText;
                label.appendChild(input);
                label.appendChild(span);
                return label;
            };

            container.innerHTML = '';
            container.appendChild(buildOption('ALL', 'Todos', 'block px-4 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100'));
            options.forEach(opt => {
                container.appendChild(buildOption(normalizeStr(opt), normalizeStr(opt), 'block px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs text-slate-600'));
            });
        }

        // --- DRILL DOWN FUNCTIONS (MOVED TO TOP FOR SAFETY) ---
        function getWashSortIndicator(state, key) {
            if (!state || state.key !== key) return '<span class="text-slate-300 ml-1">-</span>';
            return state.dir === 'asc'
                ? '<span class="text-cyan-600 ml-1">^</span>'
                : '<span class="text-cyan-600 ml-1">v</span>';
        }

        function getWashStatusBadgeAndClass(daysWithoutWash) {
            if (daysWithoutWash <= 45) {
                return {
                    badge: '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Limpia</span>',
                    daysClass: 'text-green-600'
                };
            }
            if (daysWithoutWash < 100) {
                return {
                    badge: '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Alerta</span>',
                    daysClass: 'text-yellow-600'
                };
            }
            return {
                badge: '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Crítica</span>',
                daysClass: 'text-red-600'
            };
        }

        function updateWashDrillDownHead() {
            const thead = document.getElementById('washDrillDownHead');
            if (!thead) return;
            thead.innerHTML = `
                <tr>
                    <th class="p-3 cursor-pointer select-none" onclick="window.setWashDrillSort('unit')">Unidad ${getWashSortIndicator(currentWashDrillSort, 'unit')}</th>
                    <th class="p-3 cursor-pointer select-none" onclick="window.setWashDrillSort('company')">Empresa ${getWashSortIndicator(currentWashDrillSort, 'company')}</th>
                    <th class="p-3 cursor-pointer select-none" onclick="window.setWashDrillSort('lastWashDate')">Fecha ${getWashSortIndicator(currentWashDrillSort, 'lastWashDate')}</th>
                    <th class="p-3 cursor-pointer select-none text-center" onclick="window.setWashDrillSort('daysWithoutWash')">Días Trans. ${getWashSortIndicator(currentWashDrillSort, 'daysWithoutWash')}</th>
                    <th class="p-3 text-center">Estado</th>
                </tr>
            `;
        }

        function setWashDrillSort(key) {
            const defaultDirs = {
                unit: 'asc',
                company: 'asc',
                lastWashDate: 'desc',
                daysWithoutWash: 'desc'
            };
            if (currentWashDrillSort.key === key) {
                currentWashDrillSort.dir = currentWashDrillSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentWashDrillSort.key = key;
                currentWashDrillSort.dir = defaultDirs[key] || 'asc';
            }
            renderWashDrillDownRows();
        }

        function renderWashDrillDownRows() {
            const container = document.getElementById('washDrillDownContainer');
            const tbody = document.getElementById('washDrillDownBody');
            const titleEl = document.getElementById('washDrillDownTitle');
            if (!container || !tbody || !titleEl) return;

            updateWashDrillDownHead();
            const sortedRows = (Array.isArray(currentWashDrillRows) ? [...currentWashDrillRows] : []).sort((a, b) => {
                const key = currentWashDrillSort.key;
                let cmp = 0;
                if (key === 'daysWithoutWash') {
                    cmp = (Number(a.daysWithoutWash) || 0) - (Number(b.daysWithoutWash) || 0);
                } else if (key === 'lastWashDate') {
                    const ta = a.rawDate ? a.rawDate.getTime() : 0;
                    const tb = b.rawDate ? b.rawDate.getTime() : 0;
                    cmp = ta - tb;
                } else if (key === 'company') {
                    cmp = normalizeStr(a.company).localeCompare(normalizeStr(b.company), 'es', { sensitivity: 'base' });
                } else {
                    cmp = normalizeStr(a.unit).localeCompare(normalizeStr(b.unit), 'es', { sensitivity: 'base' });
                }
                if (cmp === 0) cmp = (Number(b.daysWithoutWash) || 0) - (Number(a.daysWithoutWash) || 0);
                return currentWashDrillSort.dir === 'asc' ? cmp : -cmp;
            });

            titleEl.innerHTML = `${currentWashDrillBaseTitle || 'Detalle de Lavados'} <span class="text-cyan-700 font-normal">| ${sortedRows.length} unidades</span>`;
            tbody.innerHTML = '';

            if (!sortedRows.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Sin registros para esta selección.</td></tr>';
            } else {
                sortedRows.forEach(r => {
                    const daysVal = Number(r.daysWithoutWash) || 0;
                    const status = getWashStatusBadgeAndClass(daysVal);
                    tbody.innerHTML += `
                        <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition">
                            <td class="p-3 font-bold text-slate-700 text-xs">${escapeHtml(normalizeStr(r.unit))}</td>
                            <td class="p-3 text-xs">${escapeHtml(normalizeStr(r.company))}</td>
                            <td class="p-3 text-xs text-slate-500">${escapeHtml(normalizeStr(r.lastWashDate))}</td>
                            <td class="p-3 text-center font-mono font-bold text-xs ${status.daysClass}">${daysVal}</td>
                            <td class="p-3 text-center">${status.badge}</td>
                        </tr>
                    `;
                });
            }
        }

        function showWashDrillDown(data, title) {
            const container = document.getElementById('washDrillDownContainer');
            const monthlyContainer = document.getElementById('washMonthlyDetailContainer');
            if (!container) return;
            if (monthlyContainer) monthlyContainer.classList.add('hidden');

            currentWashDrillRows = Array.isArray(data) ? data.slice() : [];
            currentWashDrillBaseTitle = title || 'Detalle de Lavados';
            currentWashDrillSort = { key: 'daysWithoutWash', dir: 'desc' };
            renderWashDrillDownRows();

            container.classList.remove('hidden');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function updateWashMonthlyDetailHead() {
            const thead = document.getElementById('washMonthlyDetailHead');
            if (!thead) return;
            thead.innerHTML = `
                <tr>
                    <th class="p-3 cursor-pointer select-none" onclick="window.setWashMonthlyDetailSort('unit')">Unidad ${getWashSortIndicator(currentWashMonthlyDetailSort, 'unit')}</th>
                    <th class="p-3 cursor-pointer select-none" onclick="window.setWashMonthlyDetailSort('company')">Empresa ${getWashSortIndicator(currentWashMonthlyDetailSort, 'company')}</th>
                    <th class="p-3 cursor-pointer select-none" onclick="window.setWashMonthlyDetailSort('rawDate')">Fecha de Lavado ${getWashSortIndicator(currentWashMonthlyDetailSort, 'rawDate')}</th>
                    <th class="p-3 text-center cursor-pointer select-none" onclick="window.setWashMonthlyDetailSort('monthIdx')">Mes ${getWashSortIndicator(currentWashMonthlyDetailSort, 'monthIdx')}</th>
                </tr>
            `;
        }

        function setWashMonthlyDetailSort(key) {
            const defaultDirs = {
                unit: 'asc',
                company: 'asc',
                rawDate: 'desc',
                monthIdx: 'asc'
            };
            if (currentWashMonthlyDetailSort.key === key) {
                currentWashMonthlyDetailSort.dir = currentWashMonthlyDetailSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentWashMonthlyDetailSort.key = key;
                currentWashMonthlyDetailSort.dir = defaultDirs[key] || 'asc';
            }
            renderWashMonthlyDetailRows();
        }

        function renderWashMonthlyDetailRows() {
            const container = document.getElementById('washMonthlyDetailContainer');
            const tbody = document.getElementById('washMonthlyDetailBody');
            const titleEl = document.getElementById('washMonthlyDetailTitle');
            if (!container || !tbody || !titleEl) return;

            updateWashMonthlyDetailHead();
            const sortedRows = (Array.isArray(currentWashMonthlyDetailRows) ? [...currentWashMonthlyDetailRows] : []).sort((a, b) => {
                const key = currentWashMonthlyDetailSort.key;
                let cmp = 0;
                if (key === 'rawDate') {
                    const ta = a.rawDate ? a.rawDate.getTime() : 0;
                    const tb = b.rawDate ? b.rawDate.getTime() : 0;
                    cmp = ta - tb;
                } else if (key === 'company') {
                    cmp = normalizeStr(a.company).localeCompare(normalizeStr(b.company), 'es', { sensitivity: 'base' });
                } else if (key === 'monthIdx') {
                    cmp = (Number(a.monthIdx) || 0) - (Number(b.monthIdx) || 0);
                } else {
                    cmp = normalizeStr(a.unit).localeCompare(normalizeStr(b.unit), 'es', { sensitivity: 'base' });
                }
                if (cmp === 0 && key !== 'rawDate') {
                    const ta = a.rawDate ? a.rawDate.getTime() : 0;
                    const tb = b.rawDate ? b.rawDate.getTime() : 0;
                    cmp = tb - ta;
                }
                return currentWashMonthlyDetailSort.dir === 'asc' ? cmp : -cmp;
            });

            titleEl.innerHTML = `${currentWashMonthlyDetailBaseTitle || 'Detalle Histórico Mensual'} <span class="text-cyan-700 font-normal">| ${sortedRows.length} lavados</span>`;
            tbody.innerHTML = '';

            if (!sortedRows.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Sin registros para esta selección.</td></tr>';
            } else {
                sortedRows.forEach(r => {
                    const compColor = COMPANY_COLORS[r.company] || COMPANY_COLORS[normalizeStr(r.company).toUpperCase()] || '#64748b';
                    tbody.innerHTML += `
                        <tr class="hover:bg-cyan-50 border-b border-slate-100 last:border-0 transition">
                            <td class="p-3 font-bold text-slate-700 text-xs">${escapeHtml(normalizeStr(r.unit))}</td>
                            <td class="p-3 text-xs font-bold" style="color:${compColor}">${escapeHtml(normalizeStr(r.company))}</td>
                            <td class="p-3 text-xs text-slate-600 font-mono">${escapeHtml(normalizeStr(r.dateStr))}</td>
                            <td class="p-3 text-center text-xs text-slate-400 uppercase">${escapeHtml(monthNamesFull[r.monthIdx] || '-')}</td>
                        </tr>
                    `;
                });
            }
        }

        function showWashMonthlyDetail(data, title) {
            const container = document.getElementById('washMonthlyDetailContainer');
            const statusContainer = document.getElementById('washDrillDownContainer');
            if (!container) return;
            if (statusContainer) statusContainer.classList.add('hidden');

            currentWashMonthlyDetailRows = Array.isArray(data) ? data.slice() : [];
            currentWashMonthlyDetailBaseTitle = title || 'Detalle Histórico Mensual';
            currentWashMonthlyDetailSort = { key: 'rawDate', dir: 'desc' };
            renderWashMonthlyDetailRows();

            container.classList.remove('hidden');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Compatibilidad con referencias anteriores
        function showWashHistoryDetail(data, title) {
            showWashMonthlyDetail(data, title);
        }

        function showFuelDrillDown(company) {
            const container = document.getElementById('fuelDrillDownContainer');
            const title = document.getElementById('fuelDrillDownTitle');
            const canvasId = 'fuelDrillDownChart';
            
            if(!container) return;

            // CORRECCIÓN CRÍTICA: Mostrar el contenedor ANTES de renderizar el gráfico.
            // Si el contenedor está oculto (hidden), Chart.js detecta dimensiones 0x0 y no dibuja nada al primer clic.
            container.classList.remove('hidden');

            const data = dbExtra.filter(r => r.company === company && r.company !== 'Pipitas');
            const segments = [...new Set(data.map(r => r.segment))];
            
            // --- LÓGICA DE VENTANA DE TIEMPO (Últimos 12 Meses Concluidos) ---
            const today = new Date();
            const timeWindowKeys = [];
            const chartLabels = [];

            // Generar los últimos 12 meses, excluyendo el mes actual
            for (let i = 12; i >= 1; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const y = d.getFullYear();
                const m = d.getMonth(); // 0-11
                
                timeWindowKeys.push(`${y}-${m}`);
                // Etiquetas dinámicas (ej: "Feb 25", "Mar 25"...)
                chartLabels.push(`${monthNamesFull[m].substring(0, 3)} ${y.toString().substr(2)}`);
            }

            const segmentData = {};
            segments.forEach(seg => {
                // Array de 12 posiciones, alineado con timeWindowKeys
                segmentData[seg] = new Array(12).fill(null).map(() => ({ km:0, lit:0 }));
            });

            data.forEach(r => {
                const key = `${r.year}-${r.mIdx}`;
                // Buscar si el registro pertenece a la ventana de tiempo
                const windowIdx = timeWindowKeys.indexOf(key);

                if(windowIdx !== -1) {
                    segmentData[r.segment][windowIdx].km += r.km;
                    segmentData[r.segment][windowIdx].lit += r.liters;
                }
            });

            const datasets = segments.map((seg, idx) => {
                const yieldData = segmentData[seg].map(m => m.lit > 0 ? m.km / m.lit : null);
                const color = isColorblind
                    ? COLORBLIND_PALETTE[idx % COLORBLIND_PALETTE.length]
                    : PALETTE_FALLBACK[idx % PALETTE_FALLBACK.length];
                
                return {
                    label: seg,
                    data: yieldData,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                };
            });

            title.innerText = `${company} - Tendencia Mensual por Segmento`;
            
            initChart(canvasId, 'line', {
                labels: chartLabels, // Usar etiquetas dinámicas
                datasets: datasets
            }, {
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw ? ctx.raw.toFixed(2) : '-'} km/L`
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        offset: 4,
                        color: function(context) { return context.dataset.borderColor; },
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: 3,
                        font: { size: 9, weight: 'bold' },
                        formatter: (value) => value ? value.toFixed(2) : ''
                    }
                },
                scales: {
                    y: { title: { display: true, text: 'Rendimiento (km/L)' }, beginAtZero: false }
                },
                layout: { padding: { top: 20 } }
            });

            // container.classList.remove('hidden'); // MOVIDO AL INICIO DE LA FUNCIÓN
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        function showScrapDrillDown(data, total) {
             const container = document.getElementById('scrapDrillDownContainer'); 
             const tbody = document.getElementById('scrapDrillDownBody'); 
             const title = document.getElementById('scrapDrillDownTitle');
             const thead = document.getElementById('scrapDrillDownHead');
             
             if(!container || !tbody) return;
             
             // Restore title and headers for General Reasons
             if(title) title.innerHTML = '<i class="fa-solid fa-list-ul"></i> Detalle: Otras Causas';
             if(thead) {
                 thead.innerHTML = '<tr><th class="p-3">Causa</th><th class="p-3 text-center">Cantidad</th><th class="p-3 text-right">% del Total</th></tr>';
             }

             tbody.innerHTML = '';
             data.forEach(([reason, count]) => { const pct = ((count / total) * 100).toFixed(1); tbody.innerHTML += `<tr class="hover:bg-slate-50"><td class="p-3 font-bold text-slate-700">${escapeHtml(normalizeStr(reason))}</td><td class="p-3 text-center text-slate-600">${count.toLocaleString('es-MX')}</td><td class="p-3 text-right font-mono text-blue-600 font-bold">${pct}%</td></tr>`; });
             container.classList.remove('hidden'); container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function showScrapBrandDetail(brand) {
            const container = document.getElementById('scrapDrillDownContainer');
            const tbody = document.getElementById('scrapDrillDownBody');
            const title = document.getElementById('scrapDrillDownTitle');
            const thead = document.getElementById('scrapDrillDownHead');
            
            if(!container || !tbody) return;

            // Update Headers for Brand Detail
            if(title) title.innerHTML = `<i class="fa-solid fa-tags text-orange-600"></i> Desglose por Marca: <span class="text-slate-800">${escapeHtml(normalizeStr(brand))}</span>`;
            if(thead) {
                thead.innerHTML = `
                    <tr>
                        <th class="p-3">Diseño (Modelo)</th>
                        <th class="p-3 text-center">Cant. Llantas</th>
                        <th class="p-3 text-center">Prom. mm/llanta</th>
                        <th class="p-3 text-right">MM Desperdiciados Total</th>
                    </tr>
                `;
            }
            
            // Logic to filter and aggregate data
            const data = dbScrap.filter(r => r.brand === brand);
            const modelMap = {};
            
            data.forEach(r => {
                const mm = Math.max(0, (r.mm || 0) - 3);
                if(!modelMap[r.model]) modelMap[r.model] = { count: 0, mm: 0 };
                modelMap[r.model].count++;
                modelMap[r.model].mm += mm;
            });
            
            const sortedModels = Object.entries(modelMap)
                .map(([name, stats]) => ({ name, ...stats }))
                .sort((a,b) => b.mm - a.mm); // Sort by wasted MM descending

            tbody.innerHTML = '';
            
            if (sortedModels.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Sin datos de desperdicio.</td></tr>';
            } else {
                sortedModels.forEach(m => {
                    const avg = m.count > 0 ? m.mm / m.count : 0;
                    tbody.innerHTML += `
                        <tr class="hover:bg-orange-50 border-b border-slate-100 last:border-0 transition">
                            <td class="p-3 font-bold text-slate-700 text-xs">${escapeHtml(normalizeStr(m.name))}</td>
                            <td class="p-3 text-center text-slate-600 text-xs font-semibold">${m.count}</td>
                            <td class="p-3 text-center font-mono text-orange-600 font-bold text-xs">${avg.toFixed(2)} mm</td>
                            <td class="p-3 text-right font-mono text-red-600 font-bold text-xs">${m.mm.toFixed(1)} mm</td>
                        </tr>
                    `;
                });
            }
            
            container.classList.remove('hidden');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function showCreditLegalDrillDown(legalName, rows, providerName = '') {
            const container = document.getElementById('creditLegalDrillDownContainer');
            const tbody = document.getElementById('creditLegalDrillDownBody');
            const title = document.getElementById('creditLegalDrillDownTitle');
            if (!container || !tbody || !title) return;

            const target = normalizeStr(legalName);
            const providerTarget = normalizeStr(providerName);
            const list = Array.isArray(rows) ? rows : [];
            const filtered = list.filter(r => {
                if (normalizeStr(r.legalName) !== target) return false;
                if (!providerTarget) return true;
                return normalizeStr(r.provider) === providerTarget;
            });
            filtered.sort((a, b) => {
                const da = parseFlexibleDate(a.date);
                const db = parseFlexibleDate(b.date);
                if (da && db) return db - da;
                if (da) return -1;
                if (db) return 1;
                return 0;
            });

            const subtotal = filtered.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
            const totalQty = filtered.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);
            const scope = providerTarget ? `${target} / ${providerTarget}` : target;
            title.innerHTML = `<i class="fa-solid fa-table-list"></i> ${escapeHtml(scope)} <span class="text-[11px] font-normal text-slate-500 ml-2">(${filtered.length} reg. | Qty: ${totalQty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} | Total: $${subtotal.toLocaleString('es-MX', { maximumFractionDigits: 2 })})</span>`;

            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Sin detalle disponible para esta razón social.</td></tr>';
            } else {
                tbody.innerHTML = filtered.map(r => `
                    <tr class="hover:bg-slate-50">
                        <td class="p-3 text-xs text-slate-600">${escapeHtml(normalizeStr(r.date) || '-')}</td>
                        <td class="p-3 text-xs text-slate-700">${escapeHtml(normalizeStr(r.provider) || '-')}</td>
                        <td class="p-3 text-xs font-semibold text-slate-700">${escapeHtml(normalizeStr(r.legalName) || '-')}</td>
                        <td class="p-3 text-center text-xs text-slate-600 font-mono">${(Number(r.qty) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                        <td class="p-3 text-xs text-slate-700">${escapeHtml(normalizeStr(r.description) || '-')}</td>
                        <td class="p-3 text-right text-xs font-mono font-bold text-emerald-700">$${(Number(r.amount) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                    </tr>
                `).join('');
            }

            container.classList.remove('hidden');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // --- URLS CONFIGURADAS (MODULOS) ---
        // 1. CPK: 585285912
        const DEFAULT_CPK_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThc6F_SNxa5JhL897dxyyl7u-g-g2q4QbTHIo8yEkDBJpHXAH9NZzx3FJFPwxvbg/pub?gid=585285912&single=true&output=csv";
        // 2. SCRAP: 1264772684
        const DEFAULT_SCRAP_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkZVja7KbANtJeC2ED5QZp9QPt9RGV2wp-p8_jhTJfie0OJw17RFHgjvXPr90teg/pub?gid=1264772684&single=true&output=csv"; 
        // 2.1 SCRAP CREDIT NOTES: 362347697
        const DEFAULT_SCRAP_CREDIT_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkZVja7KbANtJeC2ED5QZp9QPt9RGV2wp-p8_jhTJfie0OJw17RFHgjvXPr90teg/pub?gid=362347697&single=true&output=csv";
        // 3. WASH STATUS: 1103372447
        const DEFAULT_WASH_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTCaFeNwOTwRuMkQnliCirL04_SiAHFXAzqn_TPe_Evuy6f_xuB9_insuXl3mgvRg/pub?gid=1103372447&single=true&output=csv";
        // 4. WASH HIST: 1734395370
        const DEFAULT_WASH_HISTORY_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlZOIwJFJGVOZq2IIY2gMo1DRIwDXQXnJIom29GuKUw1MOIjCKSmMvhSaoCJgQYg/pub?gid=1734395370&single=true&output=csv";
        // 5. FUEL (EXTRA): 612375241 (ACTUALIZADO)
        const DEFAULT_EXTRA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsdiL36ZevOm1AY8E-PfkIhWFzimoVoeQlbWw-wq7mfHU-bE28UENuWqjLl1yb_A/pub?gid=612375241&single=true&output=csv";
        // 5.1 CPK GOALS SUMMARY (SOLO MIGRACIÓN INICIAL): 584200482
        const DEFAULT_CPK_GOALS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThc6F_SNxa5JhL897dxyyl7u-g-g2q4QbTHIo8yEkDBJpHXAH9NZzx3FJFPwxvbg/pub?gid=584200482&single=true&output=csv";
        const CPK_GOALS_STORAGE_KEY = 'yucarro_cpk_goals_local_v1';
        const DEFAULT_CPK_GOALS_LOCAL = [];
        // 6. PRODUCT LOSS (3 EMPRESAS)
        const DEFAULT_LOSS_Y_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQrVX7KEz9XHq0m50eT6wsF-kSigOp4pNiycGS9mlbFy3tl_jA-cS7jaeqkt1TtCg/pub?gid=869681452&single=true&output=csv";
        const DEFAULT_LOSS_T_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQrVX7KEz9XHq0m50eT6wsF-kSigOp4pNiycGS9mlbFy3tl_jA-cS7jaeqkt1TtCg/pub?gid=236163936&single=true&output=csv";
        const DEFAULT_LOSS_C_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQrVX7KEz9XHq0m50eT6wsF-kSigOp4pNiycGS9mlbFy3tl_jA-cS7jaeqkt1TtCg/pub?gid=266470563&single=true&output=csv";

        const COMPANY_MAP = { '2000': 'T2020', '2001': 'Corpored', '2003': 'Yucarro', '2005': 'CMC', '2006': 'LMR', '2007': 'LORM' };
        const LA_PAZ_UNITS = ['CR-75', 'CR-76', 'CR-77', 'CR-85', 'CR-86'];

        // --- DEFINICIÓN DE REGLAS DE FILTRADO (GLOBAL) ---
        const RANKING_RULES = {
            'Delanteras': { minKm: 80000, minEff: 25000, maxEff: 50000, label: 'Km > 80k | 25k < Eff < 50k' },
            'Tracción': { minKm: 150000, minEff: 20000, maxEff: 55000, label: 'Km > 150k | 20k < Eff < 55k' },
            'Toda Posición': { minKm: 150000, minEff: 28000, maxEff: 60000, label: 'Km > 150k | 28k < Eff < 60k' }
        };
        const CPK_GOAL_SUMMARY_RULES = {
            TRACCION: { segment: 'Tracción', minKm: 280000, topN: 30 },
            TODA_ARRASTRE: { segment: 'Toda Posición', minKm: 300000, topN: 30 }
        };

        // --- 1. MOCK DATA & CONFIG (GLOBAL SCOPE) ---
        const MOCK_CPK_DATA = [{ "FOLIO": "101", "MARCA": "MOCK", "DISEÑO": "DATA", "SEGMENTO": "Delanteras", "MM ACTUAL": "10", "MM ORIG": "18", "KM REC. TOT.": "10000", "COSTO": "5000", "CPK": "0.5", "ECO Nuevo": "M-01" }];
        const MOCK_SCRAP_DATA = [];
        const MOCK_SCRAP_CREDIT_DATA = [];
        const MOCK_WASH_DATA = [];

        // --- 1. CONFIGURACIÓN BLINDADA (Diccionarios Separados) ---
        const MODULE_CONFIGS = {
            cpk: {
                mapping: {
                    unit: ['Unidad', 'ECO Nuevo', 'ECO', 'Economico', 'Vehicle', 'Unit', 'Vehiculo'],
                    folio: ['FOLIO', 'Serial', 'ID', 'Placa', 'Tire ID', 'No.', 'Serie'],
                    brand: ['MARCA', 'Marca', 'Brand', 'Fabricante'],
                    model: ['DISEÑO', 'Modelo', 'Diseño', 'Patron', 'Design'],
                    segment: ['SEGMENTO', 'Segmento', 'Tipo', 'Familia', 'Position', 'Posicion', 'Eje', 'Rodado', 'Posición'],
                    mmOrig: ['MM ORIG', 'Original', 'Profundidad Original', 'Profundidad Inicial', 'MM_Orig'],
                    mmNow: ['MM ACTUAL', 'MM Prom', 'Remanente', 'Profundidad Actual', 'MM', 'MM_Actual'],
                    km: ['KM REC. TOT.', 'KM Totales', 'Rendimiento', 'Kilometraje', 'Recorrido', 'Odo', 'Odometro', 'Km Recorridos', 'Km', 'Kms', 'Distancia'], 
                    cost: ['$', 'Costo', 'Importe', 'Precio', 'Valor', 'COSTO'],
                    date: ['Fecha', 'Date', 'Fecha Montaje', 'F. Montaje'],
                    cpk_value: ['CPK', 'Costo por Km'],
                    pos: ['POS', 'Posicion'],
                    // NUEVO: Mapeo para columna Articulación
                    articulation: ['Articulacion', 'Articulación', 'Remolque', 'Caja', 'Trailer', 'Dolly'],
                    status: ['Status', 'STATUS', 'Estado', 'Estatus']
                }
            },
            scrap: {
                mapping: {
                    id: ['FOLIO', 'ID', 'ECO Nuevo', 'ECO', 'Unidad', 'Economico', 'Serial', 'Placa', 'No.'],
                    brand: ['MARCA', 'Marca', 'Brand', 'Fabricante'],
                    model: ['DISEÑO', 'Modelo', 'Diseño', 'Patron', 'Design'],
                    mmOrig: ['MM ORIG', 'Original', 'Profundidad Original', 'Profundidad Inicial', 'MM_Orig'],
                    mmNow: ['MM ACTUAL', 'MM Prom', 'Remanente', 'Profundidad Actual', 'MM', 'MM_Actual'],
                    cost: ['$', 'Costo', 'Importe', 'Precio', 'Valor', 'COSTO'],
                    scrapStatus: ['STATUS', 'Estado', 'Estatus'],
                    scrapReason: ['CAUSA', 'Motivo', 'Reason', 'Falla', 'Descripcion'],
                    scrapProvider: ['Prov. Retiro', 'Proveedor', 'Vendor', 'Patio', 'Destino'],
                    // ACTUALIZADO: Prioridad absoluta a "F. Salida" (Columna B) para el gráfico mensual
                    date: ['F. Salida', 'F Salida', 'Fecha Baja', 'Fecha Retiro', 'Fecha', 'Date', 'scrapDate'] 
                }
            },
            scrapCredit: {
                mapping: {
                    date: ['Fecha', 'FECHA', 'F. Nota', 'F Nota', 'Date'],
                    provider: ['Proveedor', 'PROVEEDOR', 'Vendor'],
                    legalName: ['razon social', 'Razon social', 'RAZON SOCIAL', 'Razón social'],
                    qty: ['cantidad', 'Cantidad', 'CANTIDAD', 'Cant.'],
                    description: ['descripcion', 'Descripcion', 'DESCRIPCION', 'Descripción', 'Concepto'],
                    amount: ['importe', 'Importe', 'IMPORTE', 'Monto', '$']
                }
            },
            wash: {
                mapping: {
                    unit: ['Unidad', 'ECO Nuevo', 'ECO', 'Economico', 'Vehicle', 'Unit', 'Vehiculo'],
                    washDate: ['FECHA', 'Fecha', 'Ultimo Lavado', 'Fecha de Lavado', 'Date', 'Time', 'Marca temporal', 'Timestamp', 'Fecha Lavado'],
                    washDays: ['Dias', 'Dias Sin Lavar', 'Días'],
                    washCompany: ['EMPRESA', 'Empresa', 'Company', 'Proveedor', 'Base', 'Sociedad']
                }
            },
            fuel: {
                mapping: {
                    // ACTUALIZADO: Prioridad a "Nº vehículo" para identificar unidades correctamente
                    unit: ['Nº vehículo', 'Nº vehiculo', 'N° vehículo', 'No. vehículo', 'Unidad', 'ECO Nuevo', 'ECO', 'Economico', 'Vehicle', 'Unit', 'Vehiculo', 'Eco', 'Económico'],
                    fuelMonth: ['Fecha programada', 'Mes', 'Month'],
                    fuelCompany: ['Sociedad', 'Empresa', 'Company', 'Soc.'],
                    fuelEngine: ['Motor', 'Tipo Motor', 'Engine'],
                    fuelManufacturer: ['Fabricante', 'Manufacturer', 'Marca'], // Mapeo nuevo para Fabricante
                    fuelSegment: ['Char 15', 'Segmento', 'Tipo', 'Subgrupo', 'B', 'Char. 15', 'Grupo'], 
                    fuelOperator: ['Nombre', 'nombre de pila', 'Operador', 'Chofer', 'Conductor', 'Driver', 'Operador.'], 
                    fuelKm: ['Km reales', 'Kms', 'Kilometros', 'Km', 'Distancia', 'Odometer', 'Odómetro', 'Recorrido', 'KM RECORRIDOS', 'Km.'],
                    fuelLiters: ['Consumo', 'Litros', 'Lts', 'Galones', 'Volumen', 'Combustible', 'LITROS CONSUMIDOS', 'Litros Reales', 'Lts.'],
                    fuelYield: ['Rend. Fisico', 'Rendimiento', 'Rend', 'Km/L', 'Eficiencia', 'Rendimiento Real']
                }
            },
            loss: {
                mapping: {
                    date: ['FECHA DE VIAJE', 'FECHA', 'Fecha de viaje', 'Fecha'],
                    tractor: ['TRACTOR', 'Tractor', 'Numero PR', 'Número PR'],
                    unit: ['UNIDAD', 'Unidad', 'Numero Eco', 'Número Eco', 'ECO'],
                    operator: ['OPERADOR', 'Operador', 'Chofer', 'Conductor'],
                    origin: ['ORIGEN', 'Origen'],
                    destination: ['DESTINO', 'Destino'],
                    ingresos: ['INGRESOS', 'INGRESOS FLETES', 'Ingresos'],
                    ingresosPeajes: ['INGRESOS PEAJES', 'Ingresos peajes'],
                    litersTransported: ['LTS TRANSPORTADOS', 'Litros Transportados'],
                    litersFaltSabana: ['LTS FALT SABANA', 'LTS FALTANTE SABANA', ' LTS FALTANTE SABANA'],
                    diffSiic: [' DIF LTS  FALTANTE SIIC', 'Dif Lts falt Siic', 'DIF LTS FALTANTE SIIC'],
                    importeSiic: [' IMPORTE FALTANTE SIIC', 'IMPORTE FALTANTE SIIC'],
                    litersFaltSiic: ['LTS FALTANTE SIIC', ' LTS FALTANTE SIIC', 'Litros Faltante SIC'],
                    litersCondonaPemex: ['LTS FALTANTE CONDONA PEMEX'],
                    litersDescPemex: ['LTS FALTANTE DESC PEMEX', 'LTS Faltante Desc Pemex'],
                    importeDescPemex: ['IMPORTE FALTANTE DESC PEMEX'],
                    litersAbsTyuc: ['LTS FALTANTE ABS TYUC', 'LTS FALTANTE ABS TVV', 'LTS FALTANTE ABS TCORP', 'LITROS FALTANTE ABS TYUC', 'LTS FALTANTE ABS TRANSP', 'LTS FALTANTE ABS TRANPS', 'LTS FALTANTE ABS TRANSP.'],
                    importeAbsTyuc: ['IMPORTE FALTANTE ABS TYUC', 'IMPORTE FALTANTE ABS TVV', 'IMPORTE FALTANTE ABS TCORP', 'IMPORTE FALTANTE ABS TRANSP', 'IMPORTE FALTANTE ABS TRANPS', 'IMP. FALT ABS TRANSP.', 'IMP. FALT ABS TRANSP'],
                    litersDescOperador: ['LTS FALTANTE DESC OPERADOR', 'LTS FALTANTE DESC OPERADOR'],
                    importeDescOperador: ['IMPORTE FALTANTE DESC OPERADOR'],
                    viajes: ['Viajes', 'Viajes ']
                }
            }
        };

        // --- GLOBAL STATE & HELPERS ---
        let dbPerformance = [], dbScrap = [], dbScrapCredits = [], dbWashing = [], dbWashHistory = [], dbExtra = [], dbLoss = [], dbCpkGoals = [];
        let currentFilter = 'ALL';
        let currentPerformanceStatusFilter = 'ALL';
        let currentWashSearchUnit = '';
        let currentWashSelectedUnit = [];
        let currentWashDrillRows = [];
        let currentWashDrillBaseTitle = '';
        let currentWashMonthlyDetailRows = [];
        let currentWashMonthlyDetailBaseTitle = '';
        let currentWashDrillSort = { key: 'daysWithoutWash', dir: 'desc' };
        let currentWashMonthlyDetailSort = { key: 'rawDate', dir: 'desc' };
        let currentFuelSearchUnit = '';
        let currentFuelSearchOperator = '';
        let currentFuelSelectedUnit = [];
        let currentFuelSelectedOperator = [];
        let currentLossCompanyFilter = 'ALL';
        let currentLossLitersMode = 'PCT';
        let currentLossLowRankBy = 'OPERADOR';
        let currentLossTopOrder = 'MENOR';
        let currentLossSearchTU = '';
        let currentLossSearchOperator = '';
        let currentLossSelectedTU = [];
        let currentLossSelectedOperator = [];
        let charts = {};
        let moduleState = { performance: { periods: [] }, scrap: { periods: [] }, washing: { periods: [] }, strategy: { periods: [] }, extra: { periods: [] }, loss: { periods: [] }, currentTab: 'performance' };
        const MERGE_STRATEGY_IN_SCRAP = true;
        
        // --- UTILS ---
        function escapeHtml(text) {
          if (!text) return text;
          return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }

        function normalizeStr(value) {
            return (value || '').toString().trim();
        }

        function normalizeCpkStatus(rawStatus) {
            const s = normalizeStr(rawStatus).toUpperCase();
            if (!s) return 'SIN ESTATUS';
            if (s.includes('ACTIV')) return 'ACTIVA';
            if (s.includes('CONCLU') || s.includes('FIN') || s.includes('BAJA') || s.includes('RETIR')) return 'CONCLUIDA';
            return 'SIN ESTATUS';
        }

        function updatePerformanceStatusButtons() {
            ['ALL', 'ACTIVA', 'CONCLUIDA'].forEach(key => {
                const btn = document.getElementById(`perf-status-${key}`);
                if (!btn) return;
                btn.classList.toggle('active', currentPerformanceStatusFilter === key);
            });
        }

        function getFilteredPerformanceData(includePeriods = true) {
            let data = dbPerformance.slice();

            if (currentPerformanceStatusFilter !== 'ALL') {
                data = data.filter(d => d.status === currentPerformanceStatusFilter);
            }

            if (includePeriods) {
                const periods = moduleState.performance.periods;
                if (periods.length > 0) {
                    data = data.filter(d => {
                        const date = parseFlexibleDate(d.date);
                        if(!date) return false;
                        const key = `${date.getFullYear()}-${date.getMonth()}`;
                        return periods.includes(key);
                    });
                }
            }

            return data;
        }

        function setPerformanceStatusFilter(status) {
            const allowed = ['ALL', 'ACTIVA', 'CONCLUIDA'];
            currentPerformanceStatusFilter = allowed.includes(status) ? status : 'ALL';
            updatePerformanceStatusButtons();
            if (moduleState.currentTab === 'performance') runCPKAnalysis();
        }

        function getAuthConfig() {
            const cfg = window.YUCARRO_AUTH || {};
            return {
                mainUser: normalizeStr(cfg.mainUser),
                mainPass: normalizeStr(cfg.mainPass),
                adminPass: normalizeStr(cfg.adminPass)
            };
        }

        const USER_STORAGE_KEY = 'yucarro_users_v1';
        const CURRENT_USER_KEY = 'yucarro_current_user_v1';
        const MODULE_DEFS = [
            { key: 'performance', label: 'CPK Llantas', inputId: 'inputUrlCpk', rowId: 'cloudRowCpk', storageKey: 'yucarro_cpk_url' },
            { key: 'scrap', label: 'Desecho', inputId: 'inputUrlScrap', rowId: 'cloudRowScrap', storageKey: 'yucarro_scrap_url' },
            { key: 'strategy', label: 'Estrategia', inputId: 'inputUrlScrap', rowId: 'cloudRowScrap', storageKey: 'yucarro_scrap_url' },
            { key: 'scrapCredit', label: 'Desecho Notas Crédito', inputId: 'inputUrlScrapCredit', rowId: 'cloudRowScrapCredit', storageKey: 'yucarro_scrap_credit_url' },
            { key: 'washing', label: 'Lavadero', inputId: 'inputUrlWash', rowId: 'cloudRowWash', storageKey: 'yucarro_wash_url' },
            { key: 'washingHist', label: 'Lavadero Hist.', inputId: 'inputUrlWashHistory', rowId: 'cloudRowWashHist', storageKey: 'yucarro_wash_hist_url' },
            { key: 'extra', label: 'Combustible', inputId: 'inputUrlExtra', rowId: 'cloudRowExtra', storageKey: 'yucarro_extra_url' },
            { key: 'lossY', label: 'Faltante Yucarro', inputId: 'inputUrlLossY', rowId: 'cloudRowLossY', storageKey: 'yucarro_loss_y_url' },
            { key: 'lossT', label: 'Faltante T2020', inputId: 'inputUrlLossT', rowId: 'cloudRowLossT', storageKey: 'yucarro_loss_t_url' },
            { key: 'lossC', label: 'Faltante Corpored', inputId: 'inputUrlLossC', rowId: 'cloudRowLossC', storageKey: 'yucarro_loss_c_url' }
        ];
        const LINK_ACCESS_DEFS = [
            { key: 'performance', label: 'CPK Llantas' },
            { key: 'scrap', label: 'Desecho' },
            { key: 'strategy', label: 'Estrategia' },
            { key: 'scrapCredit', label: 'Desecho Notas Crédito' },
            { key: 'washing', label: 'Lavadero' },
            { key: 'washingHist', label: 'Lavadero Hist.' },
            { key: 'extra', label: 'Combustible' },
            { key: 'lossY', label: 'Faltante Yucarro' },
            { key: 'lossT', label: 'Faltante T2020' },
            { key: 'lossC', label: 'Faltante Corpored' }
        ];
        const CSV_LINK_KEYS = MODULE_DEFS.map(def => def.key);
        const TAB_TO_MODULE = {
            performance: 'performance',
            scrap: 'scrap',
            strategy: 'strategy',
            washing: 'washing',
            extra: 'extra',
            loss: 'loss'
        };
        let currentUser = null;
        let linkSessionUser = null;

        function saveUsers(users) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
        }

        function getUsers() {
            try {
                const raw = localStorage.getItem(USER_STORAGE_KEY);
                const users = raw ? JSON.parse(raw) : [];
                return Array.isArray(users) ? users : [];
            } catch (e) {
                return [];
            }
        }

        function normalizeImportedUser(raw) {
            if (!raw || typeof raw !== 'object') return null;
            const username = normalizeStr(raw.username);
            const password = normalizeStr(raw.password);
            const roleRaw = normalizeStr(raw.role).toLowerCase();
            const role = roleRaw === 'admin' ? 'admin' : (roleRaw === 'viewer' ? 'viewer' : 'editor');
            if (!username || !password) return null;

            const allowedModules = ['performance', 'scrap', 'strategy', 'washing', 'extra', 'loss', 'colorblind'];
            const allowedLinks = LINK_ACCESS_DEFS.map(def => def.key);
            const modules = Array.isArray(raw.modules)
                ? raw.modules.map(x => normalizeStr(x)).filter(x => allowedModules.includes(x))
                : [];
            const linkAccess = Array.isArray(raw.linkAccess)
                ? raw.linkAccess.map(x => normalizeStr(x)).filter(x => allowedLinks.includes(x))
                : [];

            return {
                username,
                password,
                role,
                modules: role === 'admin' ? allowedModules.slice() : Array.from(new Set(modules)),
                linkAccess: role === 'admin' ? allowedLinks.slice() : (role === 'viewer' ? [] : Array.from(new Set(linkAccess)))
            };
        }

        function sanitizeImportedUsers(usersRaw) {
            if (!Array.isArray(usersRaw)) return [];
            const dedup = new Map();
            usersRaw.forEach(raw => {
                const u = normalizeImportedUser(raw);
                if (!u) return;
                dedup.set(u.username, u);
            });
            return Array.from(dedup.values());
        }

        function getCurrentUser() {
            const username = normalizeStr(localStorage.getItem(CURRENT_USER_KEY));
            if (!username) return null;
            return getUsers().find(u => u.username === username) || null;
        }

        function setCurrentUser(username) {
            if (!username) {
                localStorage.removeItem(CURRENT_USER_KEY);
                currentUser = null;
                return;
            }
            localStorage.setItem(CURRENT_USER_KEY, username);
            currentUser = getUsers().find(u => u.username === username) || null;
        }

        function hideLockScreen() {
            const screen = document.getElementById('mainLockScreen');
            if (!screen) return;
            screen.classList.add('opacity-0', 'pointer-events-none');
            screen.style.display = 'none';
        }

        function showLockScreen() {
            const screen = document.getElementById('mainLockScreen');
            if (!screen) return;
            screen.style.display = 'flex';
            screen.classList.remove('opacity-0', 'pointer-events-none');
        }

        function updateSessionUi() {
            const badge = document.getElementById('sessionUserBadge');
            const btnLogout = document.getElementById('btnLogout');
            const btnChangePassword = document.getElementById('btnChangePassword');
            if (badge) {
                if (currentUser && currentUser.username) {
                    badge.innerText = `${currentUser.username} (${currentUser.role || 'usuario'})`;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                    badge.innerText = '';
                }
            }
            if (btnLogout) {
                if (currentUser) btnLogout.classList.remove('hidden');
                else btnLogout.classList.add('hidden');
            }
            if (btnChangePassword) {
                const canChange = !!(currentUser && (currentUser.role === 'editor' || currentUser.role === 'viewer'));
                btnChangePassword.classList.toggle('hidden', !canChange);
            }
        }

        function setChangePassError(msg) {
            const el = document.getElementById('changePassError');
            if (!el) return;
            if (!msg) {
                el.classList.add('hidden');
                el.innerText = '';
                return;
            }
            el.innerText = msg;
            el.classList.remove('hidden');
        }

        function resetChangePasswordForm() {
            const currentEl = document.getElementById('changePassCurrent');
            const newEl = document.getElementById('changePassNew');
            const confirmEl = document.getElementById('changePassConfirm');
            if (currentEl) currentEl.value = '';
            if (newEl) newEl.value = '';
            if (confirmEl) confirmEl.value = '';
            setChangePassError('');
        }

        function openChangePasswordModal() {
            if (!currentUser || (currentUser.role !== 'editor' && currentUser.role !== 'viewer')) {
                logStatus('Solo usuarios Editor o Solo lectura pueden cambiar su contraseña aquí.', 'error');
                return;
            }
            resetChangePasswordForm();
            toggleModal('changePasswordModal');
        }

        function submitPasswordChange() {
            if (!currentUser || (currentUser.role !== 'editor' && currentUser.role !== 'viewer')) {
                setChangePassError('No tienes permisos para cambiar contraseña.');
                return;
            }
            const currentPass = normalizeStr(document.getElementById('changePassCurrent')?.value);
            const newPass = normalizeStr(document.getElementById('changePassNew')?.value);
            const confirmPass = normalizeStr(document.getElementById('changePassConfirm')?.value);

            if (!currentPass || !newPass || !confirmPass) {
                setChangePassError('Completa los 3 campos.');
                return;
            }
            if (newPass.length < 6) {
                setChangePassError('La nueva contraseña debe tener al menos 6 caracteres.');
                return;
            }
            if (newPass !== confirmPass) {
                setChangePassError('La confirmación no coincide con la nueva contraseña.');
                return;
            }

            const users = getUsers();
            const idx = users.findIndex(u => u.username === currentUser.username);
            if (idx < 0) {
                setChangePassError('No se encontró el usuario activo.');
                return;
            }
            if (users[idx].password !== currentPass) {
                setChangePassError('La contraseña actual es incorrecta.');
                return;
            }
            if (currentPass === newPass) {
                setChangePassError('La nueva contraseña debe ser distinta a la actual.');
                return;
            }

            users[idx].password = newPass;
            saveUsers(users);
            setCurrentUser(users[idx].username);
            setChangePassError('');
            toggleModal('changePasswordModal');
            logStatus('Contraseña actualizada correctamente.', 'info');
        }

        function logoutSession() {
            setCurrentUser('');
            linkSessionUser = null;
            const changePassModal = document.getElementById('changePasswordModal');
            if (changePassModal && !changePassModal.classList.contains('opacity-0')) {
                toggleModal('changePasswordModal');
            }
            applyUserAccessControl();
            showLockScreen();
            const userInput = document.getElementById('mainUser');
            const passInput = document.getElementById('mainPass');
            const err = document.getElementById('mainLoginError');
            if (userInput) userInput.value = '';
            if (passInput) passInput.value = '';
            if (err) err.classList.add('hidden');
            logStatus('Sesión cerrada.', 'info');
        }

        function userHasModule(user, tabId) {
            if (!user) return false;
            if (user.role === 'admin') return true;
            if (MERGE_STRATEGY_IN_SCRAP && tabId === 'scrap') {
                const mods = Array.isArray(user.modules) ? user.modules : [];
                return mods.includes('scrap') || mods.includes('strategy');
            }
            if (MERGE_STRATEGY_IN_SCRAP && tabId === 'strategy') return false;
            const mod = TAB_TO_MODULE[tabId];
            if (!mod) return false;
            return Array.isArray(user.modules) && user.modules.includes(mod);
        }

        function userCanEditLink(user, moduleKey) {
            if (!user) return false;
            if (user.role === 'admin') return true;
            return Array.isArray(user.linkAccess) && user.linkAccess.includes(moduleKey);
        }

        function userCanEditAnyLink(user) {
            if (!user) return false;
            if (user.role === 'admin') return true;
            return Array.isArray(user.linkAccess) && user.linkAccess.length > 0;
        }

        function userCanOpenLinksPanel(user) {
            if (!user) return false;
            if (user.role === 'admin') return true;
            return Array.isArray(user.linkAccess) && user.linkAccess.some(key => CSV_LINK_KEYS.includes(key));
        }

        function userCanUseColorblind(user) {
            if (!user) return false;
            if (user.role === 'admin') return true;
            return Array.isArray(user.modules) && user.modules.includes('colorblind');
        }

        function initUserStore() {
            const auth = getAuthConfig();
            if (!auth.mainUser || !auth.mainPass) return;
            const users = getUsers();
            const found = users.find(u => u.username === auth.mainUser);
            const adminModules = ['performance', 'scrap', 'strategy', 'washing', 'extra', 'loss', 'colorblind'];
            const adminLinks = LINK_ACCESS_DEFS.map(def => def.key);
            if (!found) {
                users.push({
                    username: auth.mainUser,
                    password: auth.mainPass,
                    role: 'admin',
                    modules: adminModules.slice(),
                    linkAccess: adminLinks.slice()
                });
                saveUsers(users);
                return;
            }
            if (found.role !== 'admin') found.role = 'admin';
            found.modules = adminModules.slice();
            found.linkAccess = adminLinks.slice();
            if (found.password !== auth.mainPass) found.password = auth.mainPass;
            saveUsers(users);
        }

        function authenticateUser(username, password) {
            const u = normalizeStr(username);
            const p = normalizeStr(password);
            if (!u || !p) return null;
            return getUsers().find(user => user.username === u && user.password === p) || null;
        }

        function applyUserAccessControl() {
            const btnLinksAccess = document.getElementById('btnLinksAccess');
            const btnColorblind = document.getElementById('btnColorblind');
            const btnUsers = document.getElementById('btnUsersAdmin');
            const btnCpkGoals = document.getElementById('btnCpkGoalsAdmin');
            const unmatchedPanel = document.getElementById('strategyUnmatchedPanel');
            const unmatchedPanelIntegrated = document.getElementById('scrapStrategyUnmatchedPanel');
            const washHighFreqContainer = document.getElementById('washHighFreqContainer');
            const strategyTab = document.getElementById('tab-strategy');
            const strategyView = document.getElementById('view-strategy');
            if (btnLinksAccess) {
                const canOpenLinks = !!(currentUser && userCanOpenLinksPanel(currentUser));
                btnLinksAccess.classList.toggle('hidden', !canOpenLinks);
            }
            if (btnColorblind) {
                const canUseContrast = !!(currentUser && userCanUseColorblind(currentUser));
                btnColorblind.classList.toggle('hidden', !canUseContrast);
                if (!canUseContrast && isColorblind) isColorblind = false;
            }
            if (btnUsers) {
                if (currentUser && currentUser.role === 'admin') btnUsers.classList.remove('hidden');
                else btnUsers.classList.add('hidden');
            }
            if (btnCpkGoals) {
                if (currentUser && currentUser.role === 'admin') btnCpkGoals.classList.remove('hidden');
                else btnCpkGoals.classList.add('hidden');
            }
            if (unmatchedPanel) {
                const isAdmin = !!(currentUser && currentUser.role === 'admin');
                unmatchedPanel.classList.toggle('hidden', !isAdmin);
            }
            if (unmatchedPanelIntegrated) {
                const isAdmin = !!(currentUser && currentUser.role === 'admin');
                unmatchedPanelIntegrated.classList.toggle('hidden', !isAdmin);
            }
            if (washHighFreqContainer) {
                const canSeeHighFreq = !!(currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor'));
                washHighFreqContainer.classList.toggle('hidden', !canSeeHighFreq);
            }
            updateSessionUi();

            Object.keys(TAB_TO_MODULE).forEach(tabId => {
                const tabBtn = document.getElementById(`tab-${tabId}`);
                const view = document.getElementById(`view-${tabId}`);
                const hasAccess = currentUser ? userHasModule(currentUser, tabId) : true;
                if (tabBtn) tabBtn.classList.toggle('hidden', !hasAccess);
                if (view && !hasAccess) view.classList.add('hidden');
            });

            if (currentUser && !userHasModule(currentUser, moduleState.currentTab)) {
                const firstAllowed = Object.keys(TAB_TO_MODULE).find(t => (!MERGE_STRATEGY_IN_SCRAP || t !== 'strategy') && userHasModule(currentUser, t));
                if (firstAllowed) switchTab(firstAllowed);
            }
            if (currentUser) {
                updateCloudInputPermissions(currentUser);
            }
            if (MERGE_STRATEGY_IN_SCRAP) {
                if (strategyTab) strategyTab.classList.add('hidden');
                if (strategyView) strategyView.classList.add('hidden');
                if (moduleState.currentTab === 'strategy') switchTab('scrap');
            }
        }

        function getCloudUrls() {
            return {
                cpk: localStorage.getItem('yucarro_cpk_url') || DEFAULT_CPK_URL,
                scrap: localStorage.getItem('yucarro_scrap_url') || DEFAULT_SCRAP_URL,
                scrapCredit: localStorage.getItem('yucarro_scrap_credit_url') || DEFAULT_SCRAP_CREDIT_URL,
                wash: localStorage.getItem('yucarro_wash_url') || DEFAULT_WASH_URL,
                washHist: localStorage.getItem('yucarro_wash_hist_url') || DEFAULT_WASH_HISTORY_URL,
                extra: localStorage.getItem('yucarro_extra_url') || DEFAULT_EXTRA_URL,
                lossY: localStorage.getItem('yucarro_loss_y_url') || DEFAULT_LOSS_Y_URL,
                lossT: localStorage.getItem('yucarro_loss_t_url') || DEFAULT_LOSS_T_URL,
                lossC: localStorage.getItem('yucarro_loss_c_url') || DEFAULT_LOSS_C_URL
            };
        }

        function setCloudInputs(urls) {
            const iCpk = document.getElementById('inputUrlCpk'); if(iCpk) iCpk.value = urls.cpk;
            const iScrap = document.getElementById('inputUrlScrap'); if(iScrap) iScrap.value = urls.scrap;
            const iScrapCredit = document.getElementById('inputUrlScrapCredit'); if(iScrapCredit) iScrapCredit.value = urls.scrapCredit;
            const iWash = document.getElementById('inputUrlWash'); if(iWash) iWash.value = urls.wash;
            const iWashH = document.getElementById('inputUrlWashHistory'); if(iWashH) iWashH.value = urls.washHist;
            const iExtra = document.getElementById('inputUrlExtra'); if(iExtra) iExtra.value = urls.extra;
            const iLossY = document.getElementById('inputUrlLossY'); if(iLossY) iLossY.value = urls.lossY;
            const iLossT = document.getElementById('inputUrlLossT'); if(iLossT) iLossT.value = urls.lossT;
            const iLossC = document.getElementById('inputUrlLossC'); if(iLossC) iLossC.value = urls.lossC;
        }

        function updateCloudInputPermissions(user) {
            const byInput = {};
            const byRow = {};
            MODULE_DEFS.forEach(def => {
                if (!byInput[def.inputId]) byInput[def.inputId] = false;
                if (!byRow[def.rowId]) byRow[def.rowId] = false;
                if (userCanEditLink(user, def.key)) byInput[def.inputId] = true;
                if (userCanEditLink(user, def.key)) byRow[def.rowId] = true;
            });
            Object.entries(byRow).forEach(([rowId, canView]) => {
                const row = document.getElementById(rowId);
                if (!row) return;
                row.classList.toggle('hidden', !canView);
            });
            Object.entries(byInput).forEach(([inputId, canEdit]) => {
                const input = document.getElementById(inputId);
                if (!input) return;
                input.disabled = !canEdit;
                input.classList.toggle('bg-slate-100', !canEdit);
                input.title = canEdit ? '' : 'Sin permiso para editar este enlace';
            });
        }

        let linksClickCount = 0;
        
        function handleLinksClick() {
            linksClickCount++;
            if (linksClickCount >= 3) {
                const targetUser = currentUser || getCurrentUser();
                if (targetUser && userCanOpenLinksPanel(targetUser)) {
                    linkSessionUser = targetUser;
                    updateCloudInputPermissions(targetUser);
                    window.toggleModal('cloudModal');
                } else {
                    window.toggleModal('loginModal');
                }
                linksClickCount = 0;
            }
        }

        // --- LOGIN PRINCIPAL (CONFIGURADO POR ARCHIVO LOCAL auth.config.js) ---
        async function attemptMainLogin() {
            const u = document.getElementById('mainUser').value.trim();
            const p = document.getElementById('mainPass').value.trim();
            const err = document.getElementById('mainLoginError');
            const users = getUsers();
            if (users.length === 0) {
                err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Configura auth.config.js para inicializar el admin.';
                err.classList.remove('hidden');
                return;
            }
            const user = authenticateUser(u, p);
            if (user) {
                 setCurrentUser(user.username);
                 linkSessionUser = null;
                 applyUserAccessControl();
                 hideLockScreen();
            } else {
                err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Acceso denegado.';
                err.classList.remove('hidden');
                // Efecto visual de error
                const box = err.parentElement;
                box.classList.add('animate-pulse');
                setTimeout(() => box.classList.remove('animate-pulse'), 500);
            }
        }
        
        // Exponer explicitamente a window para evitar errores de referencia
        window.attemptMainLogin = attemptMainLogin;

        // --- VALIDACIÓN DE ENLACES (CONFIGURADA EN auth.config.js) ---
        function attemptLogin() {
            const u = document.getElementById('loginUser').value.trim();
            const p = document.getElementById('loginPass').value.trim();
            const err = document.getElementById('loginError');
            const user = authenticateUser(u, p);

            if (user && userCanOpenLinksPanel(user)) {
                linkSessionUser = user;
                updateCloudInputPermissions(user);
                window.toggleModal('loginModal'); 
                setTimeout(() => window.toggleModal('cloudModal'), 300); 
            } else {
                err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Sin permisos o credenciales incorrectas.';
                err.classList.remove('hidden');
                const container = document.querySelector('#loginModal .modal-container');
                container.classList.add('animate-pulse');
                setTimeout(() => container.classList.remove('animate-pulse'), 500);
            }
        }

        // Permitir Enter en el input de contraseña del modal
        document.getElementById('loginUser').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                attemptLogin();
            }
        });
        document.getElementById('loginPass').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                attemptLogin();
            }
        });

        function safeSetText(id, text) { 
            const el = document.getElementById(id); 
            if (el) {
                if (typeof text === 'number') {
                    el.innerText = text.toLocaleString('es-MX');
                } else {
                    el.innerText = text; 
                }
            } 
        }

        function toggleModal(id) { 
            const m = document.getElementById(id); 
            if(m) {
                if(m.classList.contains('opacity-0')) {
                    if (id === 'usersModal' && (!currentUser || currentUser.role !== 'admin')) {
                        logStatus('Solo administradores pueden gestionar usuarios.', 'error');
                        return;
                    }
                    if (id === 'changePasswordModal' && (!currentUser || (currentUser.role !== 'editor' && currentUser.role !== 'viewer'))) {
                        logStatus('Solo usuarios Editor o Solo lectura pueden cambiar su contraseña.', 'error');
                        return;
                    }
                    if (id === 'cpkGoalsModal' && (!currentUser || currentUser.role !== 'admin')) {
                        logStatus('Solo administradores pueden editar metas CPK.', 'error');
                        return;
                    }
                    if (id === 'usersModal') {
                        renderUsersTable();
                        resetUserForm();
                    }
                    if (id === 'changePasswordModal') {
                        setChangePassError('');
                    }
                    m.classList.remove('opacity-0', 'pointer-events-none');
                    document.body.classList.add('modal-active');
                    if(m.querySelector('.modal-container')) {
                        m.querySelector('.modal-container').classList.remove('scale-95', 'opacity-0');
                        m.querySelector('.modal-container').classList.add('scale-100', 'opacity-100');
                    }
                } else {
                    m.classList.add('opacity-0', 'pointer-events-none');
                    document.body.classList.remove('modal-active');
                    if(m.querySelector('.modal-container')) {
                        m.querySelector('.modal-container').classList.add('scale-95', 'opacity-0');
                        m.querySelector('.modal-container').classList.remove('scale-100', 'opacity-100');
                    }
                    if(id === 'loginModal') {
                        // Al cerrar, limpiar campo contraseña
                        document.getElementById('loginUser').value = '';
                        document.getElementById('loginPass').value = '';
                        document.getElementById('loginError').classList.add('hidden');
                        linksClickCount = 0; 
                    }
                    if(id === 'cloudModal') linkSessionUser = null;
                    if(id === 'usersModal') resetUserForm();
                    if(id === 'changePasswordModal') resetChangePasswordForm();
                    if(id === 'cpkGoalsModal') setCpkGoalsEditorError('');
                }
            } 
        }

        function safeFloat(val) { if(!val) return 0; if(typeof val === 'number') return val; const clean = val.toString().replace(/[^0-9.-]/g, ''); const num = parseFloat(clean); return isNaN(num) ? 0 : num; }
        function logStatus(msg, type='info') { const el = document.getElementById('statusLog'); if(el) { const color = type==='error'?'text-red-400 font-bold':'text-green-400'; const prefix = type==='error' ? '❌' : '✅'; el.innerHTML = `<div class="mb-1 border-b border-slate-700 pb-1"><span class="mr-2">${prefix}</span><span class="${color}">${msg}</span></div>` + el.innerHTML; } }

        function getUserByIndex(idx) {
            const users = getUsers();
            if (idx < 0 || idx >= users.length) return null;
            return users[idx];
        }

        function showUsersError(msg) {
            const el = document.getElementById('usersAdminError');
            if (!el) return;
            if (!msg) {
                el.classList.add('hidden');
                el.innerText = '';
                return;
            }
            el.innerText = msg;
            el.classList.remove('hidden');
        }

        function downloadTextFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

        function nowStamp() {
            const d = new Date();
            const p = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
        }

        async function downloadSecureUsersBackup() {
            if (!currentUser || currentUser.role !== 'admin') {
                showUsersError('Solo administrador puede descargar respaldos.');
                return;
            }
            if (!window.UsersVault || !window.UsersVault.exportEncrypted) {
                showUsersError('Módulo de cifrado no disponible.');
                return;
            }
            const pass1 = prompt('Clave para cifrar respaldo (mínimo 8 caracteres):', '');
            if (pass1 === null) return;
            const pass2 = prompt('Confirma la clave de cifrado:', '');
            if (pass2 === null) return;
            if (pass1 !== pass2) {
                showUsersError('Las claves no coinciden.');
                return;
            }

            try {
                const encrypted = await window.UsersVault.exportEncrypted(getUsers(), pass1);
                const filename = `usuarios_yucarro_${nowStamp()}.yuvault`;
                downloadTextFile(JSON.stringify(encrypted, null, 2), filename, 'application/json');
                showUsersError('');
                logStatus('Respaldo de usuarios descargado (cifrado).', 'info');
            } catch (e) {
                showUsersError(e && e.message ? e.message : 'No se pudo generar respaldo.');
            }
        }

        function openUsersBackupImport() {
            if (!currentUser || currentUser.role !== 'admin') {
                showUsersError('Solo administrador puede importar respaldos.');
                return;
            }
            const input = document.getElementById('usersBackupInput');
            if (!input) return;
            input.value = '';
            input.click();
        }

        async function handleUsersBackupImport(event) {
            if (!currentUser || currentUser.role !== 'admin') {
                showUsersError('Solo administrador puede importar respaldos.');
                return;
            }
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) return;
            if (!window.UsersVault || !window.UsersVault.importEncrypted) {
                showUsersError('Módulo de cifrado no disponible.');
                return;
            }

            const pass = prompt('Clave del respaldo para descifrar:', '');
            if (pass === null) return;

            try {
                const raw = await file.text();
                const usersImported = await window.UsersVault.importEncrypted(raw, pass);
                const sanitized = sanitizeImportedUsers(usersImported);
                if (!sanitized.length) {
                    showUsersError('Respaldo válido pero sin usuarios utilizables.');
                    return;
                }
                saveUsers(sanitized);
                initUserStore();
                currentUser = getCurrentUser();
                renderUsersTable();
                resetUserForm();
                applyUserAccessControl();
                showUsersError('');
                logStatus(`Respaldo importado: ${sanitized.length} usuario(s).`, 'info');
            } catch (e) {
                showUsersError(e && e.message ? e.message : 'No se pudo importar respaldo.');
            }
        }

        function getCheckedValues(containerId) {
            const c = document.getElementById(containerId);
            if (!c) return [];
            return Array.from(c.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
        }

        function setCheckedValues(containerId, values) {
            const c = document.getElementById(containerId);
            if (!c) return;
            c.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = values.includes(cb.value);
            });
        }

        function buildAccessCheckboxes() {
            const mod = document.getElementById('userFormModuleAccess');
            const link = document.getElementById('userFormLinkAccess');
            if (!mod || !link) return;

            mod.innerHTML = '';
            link.innerHTML = '';
            const moduleList = [
                { key: 'performance', label: 'CPK Llantas' },
                { key: 'scrap', label: 'Desecho' },
                { key: 'washing', label: 'Lavadero' },
                { key: 'extra', label: 'Combustible' },
                { key: 'loss', label: 'Faltante Producto' },
                { key: 'colorblind', label: 'Modo Contraste' }
            ];
            moduleList.forEach(def => {
                const mLabel = document.createElement('label');
                mLabel.className = 'flex items-center gap-2';
                mLabel.innerHTML = `<input type="checkbox" value="${def.key}" class="rounded border-slate-300"> <span>${def.label}</span>`;
                mod.appendChild(mLabel);
            });

            LINK_ACCESS_DEFS.forEach(def => {
                const lLabel = document.createElement('label');
                lLabel.className = 'flex items-center gap-2';
                lLabel.innerHTML = `<input type="checkbox" value="${def.key}" class="rounded border-slate-300"> <span>${def.label}</span>`;
                link.appendChild(lLabel);
            });
            handleUserRoleChange();
        }

        function handleUserRoleChange() {
            const role = normalizeStr(document.getElementById('userFormRole')?.value) || 'editor';
            const linkBlock = document.getElementById('userFormLinkAccessBlock');
            const linkContainer = document.getElementById('userFormLinkAccess');
            if (!linkContainer) return;
            const linkChecks = linkContainer.querySelectorAll('input[type="checkbox"]');
            if (role === 'viewer') {
                if (linkBlock) linkBlock.classList.add('opacity-60');
                linkChecks.forEach(cb => { cb.checked = false; cb.disabled = true; });
            } else {
                if (linkBlock) linkBlock.classList.remove('opacity-60');
                linkChecks.forEach(cb => { cb.disabled = false; });
            }
        }

        function resetUserForm() {
            const edit = document.getElementById('userEditIndex');
            const title = document.getElementById('usersFormTitle');
            const u = document.getElementById('userFormUsername');
            const p = document.getElementById('userFormPassword');
            const r = document.getElementById('userFormRole');
            if (edit) edit.value = '';
            if (title) title.innerText = 'Nuevo usuario';
            if (u) u.value = '';
            if (p) p.value = '';
            if (r) r.value = 'editor';
            setCheckedValues('userFormModuleAccess', []);
            setCheckedValues('userFormLinkAccess', []);
            handleUserRoleChange();
            showUsersError('');
        }

        function editUserFromTable(idx) {
            const user = getUserByIndex(idx);
            if (!user) return;
            const edit = document.getElementById('userEditIndex');
            const title = document.getElementById('usersFormTitle');
            const u = document.getElementById('userFormUsername');
            const p = document.getElementById('userFormPassword');
            const r = document.getElementById('userFormRole');
            if (edit) edit.value = String(idx);
            if (title) title.innerText = `Editar usuario: ${user.username}`;
            if (u) u.value = user.username;
            if (p) p.value = user.password;
            if (r) r.value = user.role || 'editor';
            setCheckedValues('userFormModuleAccess', user.modules || []);
            setCheckedValues('userFormLinkAccess', user.linkAccess || []);
            handleUserRoleChange();
            showUsersError('');
        }

        function deleteUserFromTable(idx) {
            const users = getUsers();
            const target = users[idx];
            if (!target) return;
            if (target.role === 'admin') {
                showUsersError('No puedes eliminar al usuario administrador.');
                return;
            }
            if (!confirm(`¿Eliminar usuario ${target.username}?`)) return;
            users.splice(idx, 1);
            saveUsers(users);
            renderUsersTable();
            resetUserForm();
        }

        function saveUserFromForm() {
            const idxRaw = normalizeStr(document.getElementById('userEditIndex').value);
            const username = normalizeStr(document.getElementById('userFormUsername').value);
            const password = normalizeStr(document.getElementById('userFormPassword').value);
            const role = normalizeStr(document.getElementById('userFormRole').value) || 'editor';
            const modules = getCheckedValues('userFormModuleAccess');
            const links = getCheckedValues('userFormLinkAccess');
            const users = getUsers();
            showUsersError('');

            if (!username || !password) {
                showUsersError('Usuario y contraseña son obligatorios.');
                return;
            }

            if (role !== 'admin' && modules.length === 0) {
                showUsersError('Selecciona al menos un módulo visible para el usuario.');
                return;
            }

            const idx = idxRaw === '' ? -1 : parseInt(idxRaw, 10);
            const existing = users.findIndex((u, i) => u.username === username && i !== idx);
            if (existing >= 0) {
                showUsersError('Ya existe un usuario con ese nombre.');
                return;
            }

            const payload = {
                username,
                password,
                role: role === 'admin' ? 'admin' : (role === 'viewer' ? 'viewer' : 'editor'),
                modules: role === 'admin' ? ['performance', 'scrap', 'strategy', 'washing', 'extra', 'loss', 'colorblind'] : modules,
                linkAccess: role === 'admin' ? LINK_ACCESS_DEFS.map(def => def.key) : (role === 'viewer' ? [] : links)
            };

            if (idx >= 0 && idx < users.length) users[idx] = payload;
            else users.push(payload);
            saveUsers(users);
            renderUsersTable();
            resetUserForm();
        }

        function renderUsersTable() {
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return;
            const users = getUsers();
            tbody.innerHTML = '';
            users.forEach((u, idx) => {
                const isAdmin = u.role === 'admin';
                const actions = isAdmin
                    ? `<button onclick="window.editUserFromTable(${idx})" class="text-slate-600 hover:text-slate-900">Editar</button>`
                    : `<button onclick="window.editUserFromTable(${idx})" class="text-slate-600 hover:text-slate-900 mr-2">Editar</button><button onclick="window.deleteUserFromTable(${idx})" class="text-red-500 hover:text-red-700">Eliminar</button>`;
                tbody.innerHTML += `<tr class="border-t border-slate-100"><td class="p-2 font-semibold text-slate-700">${escapeHtml(u.username)}</td><td class="p-2 text-slate-500 uppercase">${escapeHtml(u.role)}</td><td class="p-2 text-right">${actions}</td></tr>`;
            });
        }
        
        // --- 7. INIT (ZERO-CLICK AUTO-LOAD) ---
        function startSystem() {
            console.log("Iniciando secuencia de arranque prioritaria...");
            if (typeof Chart !== 'undefined') {
                if(window['chartjs-plugin-annotation']) Chart.register(window['chartjs-plugin-annotation']);
                if(window['ChartDataLabels']) Chart.register(window['ChartDataLabels']);
            } else {
                console.error("Chart.js failed to load.");
            }

            initUserStore();
            currentUser = getCurrentUser();
            applyUserAccessControl();
            if (currentUser) hideLockScreen();
            else showLockScreen();

            const masterUrls = getCloudUrls();
            setCloudInputs(masterUrls);
            if (!localStorage.getItem('yucarro_cpk_url')) localStorage.setItem('yucarro_cpk_url', masterUrls.cpk);
            if (!localStorage.getItem('yucarro_scrap_url')) localStorage.setItem('yucarro_scrap_url', masterUrls.scrap);
            if (!localStorage.getItem('yucarro_scrap_credit_url')) localStorage.setItem('yucarro_scrap_credit_url', masterUrls.scrapCredit);
            if (!localStorage.getItem('yucarro_wash_url')) localStorage.setItem('yucarro_wash_url', masterUrls.wash);
            if (!localStorage.getItem('yucarro_wash_hist_url')) localStorage.setItem('yucarro_wash_hist_url', masterUrls.washHist);
            if (!localStorage.getItem('yucarro_extra_url')) localStorage.setItem('yucarro_extra_url', masterUrls.extra);
            if (!localStorage.getItem('yucarro_loss_y_url')) localStorage.setItem('yucarro_loss_y_url', masterUrls.lossY);
            if (!localStorage.getItem('yucarro_loss_t_url')) localStorage.setItem('yucarro_loss_t_url', masterUrls.lossT);
            if (!localStorage.getItem('yucarro_loss_c_url')) localStorage.setItem('yucarro_loss_c_url', masterUrls.lossC);
            loadLocalCpkGoals();

            // 3. EJECUTAR CARGA INMEDIATA
            console.log("🚀 Disparando descarga de datos...");
            fetchAllFromCloud(
                masterUrls.cpk, 
                masterUrls.scrap, 
                masterUrls.scrapCredit,
                masterUrls.wash, 
                masterUrls.washHist, 
                masterUrls.extra,
                masterUrls.lossY,
                masterUrls.lossT,
                masterUrls.lossC
            );

            // Listeners
            const opFilter = document.getElementById('operatorGroupFilter');
            if(opFilter) {
                opFilter.addEventListener('change', () => {
                    console.log("Filter changed to:", opFilter.value);
                });
            }
            const washUnit = document.getElementById('washFilterUnit');
            if (washUnit && !washUnit.dataset.boundEnter) {
                washUnit.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') applyWashSearchFilters();
                });
                washUnit.dataset.boundEnter = '1';
            }
            const fuelUnit = document.getElementById('fuelFilterUnit');
            if (fuelUnit && !fuelUnit.dataset.boundEnter) {
                fuelUnit.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') applyFuelSearchFilters();
                });
                fuelUnit.dataset.boundEnter = '1';
            }
            const fuelOp = document.getElementById('fuelFilterOperator');
            if (fuelOp && !fuelOp.dataset.boundEnter) {
                fuelOp.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') applyFuelSearchFilters();
                });
                fuelOp.dataset.boundEnter = '1';
            }
            const lossTu = document.getElementById('lossFilterTU');
            if (lossTu && !lossTu.dataset.boundEnter) {
                lossTu.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') applyLossSearchFilters();
                });
                lossTu.dataset.boundEnter = '1';
            }
            const lossOp = document.getElementById('lossFilterOperator');
            if (lossOp && !lossOp.dataset.boundEnter) {
                lossOp.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') applyLossSearchFilters();
                });
                lossOp.dataset.boundEnter = '1';
            }
            const backupInput = document.getElementById('usersBackupInput');
            if (backupInput && !backupInput.dataset.boundChange) {
                backupInput.addEventListener('change', handleUsersBackupImport);
                backupInput.dataset.boundChange = '1';
            }
            ['changePassCurrent', 'changePassNew', 'changePassConfirm'].forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.dataset.boundEnter) {
                    el.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') submitPasswordChange();
                    });
                    el.dataset.boundEnter = '1';
                }
            });
            buildAccessCheckboxes();
            const roleEl = document.getElementById('userFormRole');
            if (roleEl && !roleEl.dataset.boundRoleChange) {
                roleEl.addEventListener('change', handleUserRoleChange);
                roleEl.dataset.boundRoleChange = '1';
            }
            updatePerformanceStatusButtons();
            updateLossCompanyButtons();
            updateLossLitersModeButtons();
            syncWashSelectedInfo();
            syncFuelExclusiveFilterState();
            syncLossExclusiveFilterState();
            renderUsersTable();
            resetUserForm();
        };

        // EJECUCIÓN INMEDIATA (NO ESPERAR WINDOW.ONLOAD)
        if (document.readyState === 'loading') {  
            document.addEventListener('DOMContentLoaded', startSystem);
        } else {  
            startSystem();
        }

        // --- 2. DATA LOADERS ---
        function fetchCsv(url) { return new Promise((resolve, reject) => { Papa.parse(url, { download: true, header: true, skipEmptyLines: true, complete: (results) => resolve(results.data), error: (err) => reject(err) }); }); }
        
        function loadWithFallback(url, name, mockData) { 
            if(!url) return Promise.resolve(mockData); 
            const cleanUrl = url.trim();
            
            // Función auxiliar para intentar la descarga y validar que no venga vacía
            const tryFetch = (u) => fetchCsv(u).then(res => {
                if(res && res.length > 0) return res;
                throw new Error("El archivo CSV está vacío o ilegible.");
            });

            return new Promise((resolve) => {
                // INTENTO 1: Conexión Directa
                tryFetch(cleanUrl)
                .then(data => { 
                    logStatus(`${name}: Conexión Directa OK (${data.length} reg.)`); 
                    resolve(data); 
                })
                .catch(e1 => {
                    console.warn(`${name}: Falló conexión directa. Intentando Proxy 1...`);
                    
                    // INTENTO 2: Proxy corsproxy.io
                    const p1 = 'https://corsproxy.io/?' + encodeURIComponent(cleanUrl) + '&_t=' + Date.now();
                    tryFetch(p1)
                    .then(data => { 
                        logStatus(`${name}: Proxy 1 OK (${data.length} reg.)`); 
                        resolve(data); 
                    })
                    .catch(e2 => {
                        console.warn(`${name}: Falló Proxy 1. Intentando Proxy 2...`);
                        
                        // INTENTO 3: Proxy allorigins.win (Respaldo robusto)
                        const p2 = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(cleanUrl);
                        tryFetch(p2)
                        .then(data => { 
                            logStatus(`${name}: Proxy 2 OK (${data.length} reg.)`); 
                            resolve(data); 
                        })
                        .catch(e3 => {
                            logStatus(`${name} ERROR FATAL: No se pudo cargar.`, 'error');
                            // No mostramos alert, solo log
                            resolve(mockData);
                        });
                    });
                });
            });
        }

        function manualRefresh() {
            const cpk = document.getElementById('inputUrlCpk').value;
            const scrap = document.getElementById('inputUrlScrap').value;
            const scrapCredit = document.getElementById('inputUrlScrapCredit').value;
            const wash = document.getElementById('inputUrlWash').value;
            const washHist = document.getElementById('inputUrlWashHistory').value;
            const extra = document.getElementById('inputUrlExtra').value;
            const lossY = document.getElementById('inputUrlLossY').value;
            const lossT = document.getElementById('inputUrlLossT').value;
            const lossC = document.getElementById('inputUrlLossC').value;
            logStatus('Refrescando datos manualmente...', 'info');
            fetchAllFromCloud(cpk, scrap, scrapCredit, wash, washHist, extra, lossY, lossT, lossC);
        }

        function resetToDefaults() {
            const actor = linkSessionUser || currentUser;
            if (!actor || !userCanOpenLinksPanel(actor)) {
                logStatus('No tienes permisos para restaurar enlaces.', 'error');
                return;
            }
            if(confirm("¿Seguro que deseas borrar las URLs personalizadas y usar las por defecto?")) {
                MODULE_DEFS.forEach(def => {
                    if (userCanEditLink(actor, def.key)) localStorage.removeItem(def.storageKey);
                });
                const urls = getCloudUrls();
                setCloudInputs(urls);
                fetchAllFromCloud(urls.cpk, urls.scrap, urls.scrapCredit, urls.wash, urls.washHist, urls.extra, urls.lossY, urls.lossT, urls.lossC);
            }
        }

        function saveCloudConfig() {
            const actor = linkSessionUser || currentUser;
            if (!actor || !userCanOpenLinksPanel(actor)) {
                logStatus('No tienes permisos para guardar enlaces.', 'error');
                return;
            }

            MODULE_DEFS.forEach(def => {
                const input = document.getElementById(def.inputId);
                if (!input) return;
                if (userCanEditLink(actor, def.key)) {
                    localStorage.setItem(def.storageKey, input.value.trim());
                }
            });

            const urls = getCloudUrls();
            setCloudInputs(urls);
            window.toggleModal('cloudModal');
            logStatus('Configuración guardada. Recargando...', 'info');
            fetchAllFromCloud(urls.cpk, urls.scrap, urls.scrapCredit, urls.wash, urls.washHist, urls.extra, urls.lossY, urls.lossT, urls.lossC);
        }
        
        function fetchAllFromCloud(cpkUrl, scrapUrl, scrapCreditUrl, washUrl, washHistUrl, extraUrl, lossYUrl, lossTUrl, lossCUrl) { 
            const btn = document.getElementById('btnRefreshCloud'); if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
            
            // Actualizar status en Login Screen
            const bootText = document.getElementById('bootStatusText');
            if(bootText) bootText.innerText = "Sincronizando módulos...";

            const hasLocalGoals = loadLocalCpkGoals();
            const needsGoalBootstrap = !hasLocalGoals;
            const needsGoalBrandBootstrap = hasLocalGoals && dbCpkGoals.length > 0 && dbCpkGoals.every(g => !normalizeStr(g.brand));
            const requests = [ 
                loadWithFallback(cpkUrl, 'CPK', MOCK_CPK_DATA), 
                loadWithFallback(scrapUrl, 'Desecho', MOCK_SCRAP_DATA), 
                loadWithFallback(scrapCreditUrl, 'Desecho Notas Crédito', MOCK_SCRAP_CREDIT_DATA),
                loadWithFallback(washUrl, 'Lavado (Status)', MOCK_WASH_DATA), 
                loadWithFallback(washHistUrl, 'Lavado (Hist)', []),
                loadWithFallback(extraUrl, 'Combustible', []),
                loadWithFallback(lossYUrl, 'Faltante Yucarro', []),
                loadWithFallback(lossTUrl, 'Faltante T2020', []),
                loadWithFallback(lossCUrl, 'Faltante Corpored', [])
            ];
            if (needsGoalBootstrap || needsGoalBrandBootstrap) {
                requests.push(loadWithFallback(DEFAULT_CPK_GOALS_URL, 'Resumen CPK Objetivo (Migración Inicial)', []));
            }

            Promise.all(requests).then((results) => { 
                const [cpkData, scrapData, scrapCreditData, washData, washHistData, extraData, lossYData, lossTData, lossCData] = results;
                const cpkGoalData = results[9];
                try { processCPKData(cpkData); } catch(e) { logStatus('Error CPK: '+e.message, 'error'); } 
                try { processScrapData(scrapData); } catch(e) { logStatus('Error Scrap: '+e.message, 'error'); } 
                try { processScrapCreditData(scrapCreditData); } catch(e) { logStatus('Error Notas Crédito: '+e.message, 'error'); } 
                try { processWashData(washData); } catch(e) { logStatus('Error Wash: '+e.message, 'error'); } 
                try { processWashHistoryData(washHistData); } catch(e) { logStatus('Error Wash Hist: '+e.message, 'error'); } 
                try { processFuelData(extraData); } catch(e) { logStatus('Error Combustible: '+e.message, 'error'); } 
                try { processLossData(lossYData, lossTData, lossCData); } catch(e) { logStatus('Error Faltante: '+e.message, 'error'); } 
                try {
                    if (needsGoalBootstrap || needsGoalBrandBootstrap) {
                        processCpkGoalsData(cpkGoalData);
                        if (dbCpkGoals.length > 0) saveLocalCpkGoals(dbCpkGoals);
                    } else {
                        loadLocalCpkGoals();
                    }
                } catch(e) { logStatus('Error Resumen CPK: '+e.message, 'error'); } 
                
                if(btn) btn.innerHTML = '<i class="fa-solid fa-sync"></i>'; 
                
                // Actualizar status final
                if(bootText) {
                    bootText.innerText = "Sistema Sincronizado";
                    bootText.classList.remove('text-indigo-700');
                    bootText.classList.add('text-green-600');
                    document.getElementById('bootSpinner').classList.remove('fa-spin', 'fa-circle-notch');
                    document.getElementById('bootSpinner').classList.add('fa-check-circle', 'text-green-500');
                }

                window.switchTab('performance'); 
            }); 
        }

        // --- 3. UI FUNCTIONS ---
        function setCategoryFilter(type) {
            currentFilter = type;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            const btn = document.getElementById(`filter-${type}`); if(btn) btn.classList.add('active');
            if(document.getElementById('strategySegmentLabel')) document.getElementById('strategySegmentLabel').innerText = type.toUpperCase();
            if(dbPerformance.length > 0) runCPKAnalysis();
        }

        function toggleYearDropdown(e) { e.stopPropagation(); document.getElementById('yearDropdown').classList.toggle('show'); }
        function hideAllCheckboxDropdowns() {
            const dropdowns = document.getElementsByClassName('checkbox-dropdown');
            for (let i = 0; i < dropdowns.length; i++) {
                dropdowns[i].classList.remove('show');
            }
        }
        function closeDropdowns(e) {
            const target = e && e.target ? e.target : null;
            if (!target) {
                hideAllCheckboxDropdowns();
                return;
            }
            const keepOpen = target.closest('.checkbox-dropdown')
                || target.closest('#washFilterUnit')
                || target.closest('#lossFilterTU')
                || target.closest('#lossFilterOperator')
                || target.closest('#fuelFilterUnit')
                || target.closest('#fuelFilterOperator')
                || target.closest('button[onclick*="toggleYearDropdown"]')
                || target.closest('button[onclick*="toggleFilterDropdown"]');
            if (keepOpen) return;
            hideAllCheckboxDropdowns();
        }

        // CORRECCIÓN: Función auxiliar para parseo de fechas (usada en varios lugares)
        // MEJORA CRÍTICA: Soporte Universal (Texto Español, Timestamps, Seriales Excel, ISO)
        function parseFlexibleDate(dateStr) {
            if (!dateStr) return null;
            if (dateStr instanceof Date) return dateStr;
            
            let cleanStr = dateStr.toString().trim();
            
            // 1. Detección de Excel Serial Date (ej: 45321)
            if (/^\d{5}$/.test(cleanStr)) {
                const serial = parseInt(cleanStr, 10);
                // Fecha base Excel (aprox para web)
                return new Date(Math.round((serial - 25569) * 86400 * 1000));
            }

            // 2. Limpieza de Timestamp (Hora)
            // Solo cortamos si detectamos el separador de hora "T" o un espacio seguido de dígitos y dos puntos (ej: " 14:")
            if (cleanStr.includes('T')) cleanStr = cleanStr.split('T')[0];
            
            // Regex para separar fecha de hora (ej: "2024-01-01 14:00") pero NO romper "01 Ene 2024"
            // Buscamos espacio seguido de dígito y dos puntos
            if (/\s\d{1,2}:/.test(cleanStr)) {
                cleanStr = cleanStr.split(/\s\d{1,2}:/)[0]; 
            }

            // 3. Diccionario de Meses en Español e Inglés
            const monthMap = {
                'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
                'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
                'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
                'jan': 0, 'feb': 1, 'apr': 3, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };

            // 4. Normalizar separadores a slashes y dividir
            // Aceptamos: / - . y espacios
            const parts = cleanStr.replace(/[-.]/g, '/').split(/[\/\s]+/);

            if (parts.length >= 3) {
                let p1 = parts[0];
                let p2 = parts[1];
                let p3 = parts[2];
                
                // Función para obtener valor numérico o de mes
                const getVal = (p) => {
                    const low = p.toLowerCase();
                    if (monthMap[low] !== undefined) return { type: 'month', val: monthMap[low] };
                    const n = parseInt(p, 10);
                    if (!isNaN(n)) return { type: 'num', val: n };
                    return { type: 'nan' };
                };

                const v1 = getVal(p1);
                const v2 = getVal(p2);
                const v3 = getVal(p3);

                let day, month, year;

                // Caso A: Día MesTexto Año (15 Ene 2024) o Año MesTexto Día
                if (v2.type === 'month') {
                    month = v2.val;
                    if (v1.val > 31) { year = v1.val; day = v3.val; } // 2024 Ene 15
                    else { day = v1.val; year = v3.val; }             // 15 Ene 2024
                }
                // Caso B: Todo Numérico
                else if (v1.type === 'num' && v2.type === 'num' && v3.type === 'num') {
                    // Detectar Año al inicio (YYYY-MM-DD)
                    if (v1.val > 31) { 
                        year = v1.val;
                        month = v2.val - 1; // Mes 0-indexado
                        day = v3.val;
                    } else { 
                        // Asumir DD-MM-YYYY (Formato Latino)
                        day = v1.val;
                        month = v2.val - 1;
                        year = v3.val;
                    }
                } else {
                    // Fallback nativo si la estructura no cuadra
                    let d = new Date(dateStr); 
                    if (!isNaN(d.getTime())) return d;
                    return null;
                }

                // Corrección de año corto (ej: 24 -> 2024)
                if (year < 100) year += 2000;

                // Validación final de rangos
                if (year > 1900 && year < 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                    return new Date(year, month, day);
                }
            }

            // 5. Último intento: Parseo nativo JS
            let d = new Date(dateStr); 
            if (!isNaN(d.getTime())) return d;

            return null;
        }

        function updatePeriodSelection(periodKey) {
            const currentPeriods = moduleState[moduleState.currentTab].periods;
            if (periodKey === 'ALL') { if (currentPeriods.length > 0) { moduleState[moduleState.currentTab].periods = []; } else { moduleState[moduleState.currentTab].periods = []; } } 
            else { const index = currentPeriods.indexOf(periodKey); if (index > -1) { currentPeriods.splice(index, 1); } else { currentPeriods.push(periodKey); } }
            updateTopBarUI(moduleState.currentTab);
            
            try {
                if(moduleState.currentTab === 'performance') runCPKAnalysis();
                else if(moduleState.currentTab === 'scrap') runScrapAnalysis();
                else if(moduleState.currentTab === 'washing') window.runWashAnalysis();
                else if(moduleState.currentTab === 'strategy') runStrategyAnalysis();
                else if(moduleState.currentTab === 'loss') runLossAnalysis();
            } catch(e) { console.warn("Analysis not ready yet", e); }
        }

        function updateTopBarUI(tabId) {
            const container = document.getElementById('categoryFilterContainer');
            const dropdown = document.getElementById('yearDropdown');
            const label = document.getElementById('yearFilterLabel');
            
            if (!container || !dropdown || !label) return;
            if (tabId === 'performance' || tabId === 'washing' || tabId === 'extra' || tabId === 'loss') {
                container.classList.add('hidden');
                return; 
            } else {
                container.classList.remove('hidden');
            }
            
            let availableYears = new Set();
            let dataSrc = [];
            
            if (tabId === 'scrap') dataSrc = dbScrap.map(x => x.date).concat(dbScrapCredits.map(x => x.date));
            else if (tabId === 'strategy') dataSrc = dbScrap.map(x => x.date);

            dataSrc.forEach(ds => { const d = parseFlexibleDate(ds); if(d) availableYears.add(`${d.getFullYear()}-${d.getMonth()}`); });
            
            if(availableYears.size === 0) { dropdown.innerHTML = '<div class="px-2 py-1 text-xs text-slate-400 italic">Datos Actuales (Sin fecha)</div>'; label.innerText = "Periodo: Actual"; return; }
            const sortedPeriods = Array.from(availableYears).sort((a,b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); if(y1 !== y2) return y2 - y1; return m2 - m1; });
            const grouped = {};
            sortedPeriods.forEach(p => { const [y, m] = p.split('-'); if(!grouped[y]) grouped[y] = []; grouped[y].push({ key: p, monthName: monthNamesFull[parseInt(m)] }); });
            let html = `<div class="cursor-pointer px-2 py-2 hover:bg-slate-100 flex items-center border-b border-slate-100" onclick="updatePeriodSelection('ALL')"><input type="checkbox" class="mr-2" ${moduleState[tabId].periods.length === 0 ? 'checked' : ''}> <span class="font-bold text-slate-700">Todos los Periodos</span></div>`;
            Object.keys(grouped).sort((a,b) => b - a).forEach(year => { html += `<div class="year-group-title">${year}</div>`; grouped[year].forEach(item => { const isChecked = moduleState[tabId].periods.includes(item.key); html += `<div class="cursor-pointer px-2 py-1 pl-4 hover:bg-slate-50 flex items-center text-sm text-slate-600" onclick="updatePeriodSelection('${item.key}')"><input type="checkbox" class="mr-2" ${isChecked ? 'checked' : ''}> ${item.monthName}</div>`; }); });
            dropdown.innerHTML = html;
            if(moduleState[tabId].periods.length === 0) label.innerText = "Periodo: Todos"; else if(moduleState[tabId].periods.length === 1) { const [y, m] = moduleState[tabId].periods[0].split('-'); label.innerText = `${monthNamesFull[parseInt(m)].substring(0,3)} ${y}`; } else label.innerText = `${moduleState[tabId].periods.length} Seleccionados`;
        }

        function switchTab(tabId) {
            if (MERGE_STRATEGY_IN_SCRAP && tabId === 'strategy') tabId = 'scrap';
            if (currentUser && !userHasModule(currentUser, tabId)) {
                logStatus('No tienes acceso a ese módulo.', 'error');
                return;
            }
            moduleState.currentTab = tabId;
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active-blue', 'active-slate', 'active-purple', 'active-cyan', 'active-teal', 'active-amber'));
            ['performance', 'scrap', 'strategy', 'washing', 'extra', 'loss'].forEach(id => { const el = document.getElementById(`view-${id}`); if(el) el.classList.add('hidden'); });
            const btn = document.getElementById(`tab-${tabId}`);
            const view = document.getElementById(`view-${tabId}`);
            if(view) view.classList.remove('hidden');
            
            if(tabId === 'performance') btn.classList.add('active-blue'); 
            else if(tabId === 'scrap') btn.classList.add('active-slate'); 
            else if(tabId === 'strategy') btn.classList.add('active-purple'); 
            else if(tabId === 'washing') btn.classList.add('active-cyan');
            else if(tabId === 'extra') btn.classList.add('active-teal');
            else if(tabId === 'loss') btn.classList.add('active-amber');
            
            updateTopBarUI(tabId);
            
            try {
                if(tabId === 'performance' && dbPerformance.length) runCPKAnalysis(); 
                else if(tabId === 'scrap' && (dbScrap.length || dbScrapCredits.length)) runScrapAnalysis(); 
                else if(tabId === 'washing' && (dbWashing.length || dbWashHistory.length)) window.runWashAnalysis(); 
                else if(tabId === 'strategy' && dbPerformance.length) runStrategyAnalysis();
                else if(tabId === 'extra' && dbExtra.length) window.runFuelAnalysis();
                else if(tabId === 'loss' && dbLoss.length) runLossAnalysis();
            } catch(e) { console.log("Tab switch pending data load."); }
        }

        // --- 4. PROCESSING ---
        function getValue(row, field, moduleName, ...fallbacks) {
            const config = MODULE_CONFIGS[moduleName];
            if (!config || !config.mapping) return null;

            let candidates = [];
            if (config.mapping[field]) {
                candidates = config.mapping[field];
            }
            if (fallbacks && fallbacks.length > 0) {
                 candidates = [...candidates, ...fallbacks];
            }

            const rowKeys = Object.keys(row);
            
            for (let candidate of candidates) {
                let match = rowKeys.find(rk => rk.toUpperCase().trim() === candidate.toUpperCase().trim());
                if (match && row[match] !== undefined) return row[match];

                if (candidate.length > 2) {
                     match = rowKeys.find(rk => rk.toUpperCase().includes(candidate.toUpperCase()));
                     if (field === 'id' && match && match.toUpperCase().includes('ANTERIOR')) continue;
                     if (match && row[match] !== undefined) return row[match];
                }
            }
            return null;
        }

        function processCPKData(data) {
            if(!data || !data.length) return;
            let totalKmDetected = 0;

            dbPerformance = data.map((row, idx) => {
                const unitVal = getValue(row, 'unit', 'cpk') || '-'; 
                const folioVal = getValue(row, 'folio', 'cpk') || '-'; 
                const idVal = unitVal !== '-' ? unitVal : (folioVal !== '-' ? folioVal : `F${idx}`); 
                const mmO = safeFloat(getValue(row, 'mmOrig', 'cpk')) || 24; 
                const cost = safeFloat(getValue(row, 'cost', 'cpk')); 
                const km = safeFloat(getValue(row, 'km', 'cpk')); 
                const mmN = safeFloat(getValue(row, 'mmNow', 'cpk')); 
                const dateStr = getValue(row, 'date', 'cpk') || ''; 
                
                // NUEVO: Extraer articulación para el KPI
                const artVal = getValue(row, 'articulation', 'cpk') || '';
                const statusRaw = getValue(row, 'status', 'cpk') || '';
                const statusNorm = normalizeCpkStatus(statusRaw);

                let cpk = safeFloat(getValue(row, 'cpk_value', 'cpk')); 
                if ((cpk === 0) && km > 0 && cost > 0) {
                    cpk = cost / km;
                }
                
                totalKmDetected += km;

                let typeRaw = getValue(row, 'segment', 'cpk'); 
                let t = 'Sin Clasificar';
                
                if (typeRaw) { 
                    const tr = String(typeRaw).toUpperCase(); 
                    if (tr.includes('TODA') || tr.includes('TP')) t = 'Toda Posición'; 
                    else if (tr.includes('DELANTERA') || tr.includes('FRONT')) t = 'Delanteras'; 
                    else if (tr.includes('TRACCION') || tr.includes('DRIVE')) t = 'Tracción'; 
                    else if (tr.includes('ARRASTRE')) t = 'Toda Posición'; 
                } 
                
                const isTrailer = (typeRaw && (String(typeRaw).toUpperCase().includes('ARRASTRE') || String(typeRaw).toUpperCase().includes('REMOLQUE'))) ? true : false;
                let eff = 0;
                if ((mmO - mmN) > 0) eff = km / (mmO - mmN);
                
                const brand = (getValue(row, 'brand', 'cpk') || 'GEN').toString().trim().toUpperCase();
                const model = (getValue(row, 'model', 'cpk') || 'STD').toString().trim().toUpperCase();
                
                return { id: idVal, unit: unitVal, folio: folioVal, brand: brand, model: model, mm: mmN, originalMm: mmO, type: t, km: km, efficiency: eff, cost: cost, cpk: cpk, isTrailer: isTrailer, date: dateStr, articulation: artVal, status: statusNorm, statusRaw: statusRaw };
            }); 
            safeSetText('perfCount', dbPerformance.length);
        }

        function normalizeDesignToken(value) {
            return normalizeStr(value)
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^A-Z0-9]/g, '');
        }

        function getRowValueByIndex(row, index) {
            const values = Object.values(row || {});
            if (index < 0 || index >= values.length) return '';
            return values[index];
        }

        function getGoalCell(row, candidates, indexFallback) {
            const keys = Object.keys(row || {});
            const normalizeHeader = (h) => normalizeDesignToken(h).replace(/\s+/g, '');
            const normalizedCandidates = (Array.isArray(candidates) ? candidates : []).map(c => normalizeHeader(c));

            for (const key of keys) {
                const normalizedKey = normalizeHeader(key);
                if (normalizedCandidates.includes(normalizedKey)) return row[key];
            }

            for (const key of keys) {
                const normalizedKey = normalizeHeader(key);
                if (normalizedCandidates.some(c => c && (normalizedKey.includes(c) || c.includes(normalizedKey)))) return row[key];
            }

            return getRowValueByIndex(row, indexFallback);
        }

        function normalizeGoalTireType(rawType) {
            const t = normalizeDesignToken(rawType);
            if (t.includes('DELANT') || t.includes('DIRECC') || t.includes('FRONT') || t.includes('STEER')) return 'DELANTERA';
            if (t.includes('TRAC')) return 'TRACCION';
            if (t.includes('TODA') || t.includes('POSICION') || t.includes('ARRASTRE') || t.includes('REMOLQUE') || t === 'TP' || t.includes('TRAILER')) return 'TODA_ARRASTRE';
            return 'TODA_ARRASTRE';
        }

        function goalTireTypeLabel(goalType) {
            if (goalType === 'DELANTERA') return 'Delantera';
            if (goalType === 'TRACCION') return 'Tracción';
            return 'Toda Posición / Arrastre';
        }

        function mapPerformanceSegmentToGoalType(segment) {
            if (segment === 'Delanteras') return 'DELANTERA';
            if (segment === 'Tracción') return 'TRACCION';
            return 'TODA_ARRASTRE';
        }

        function normalizeGoalBrandKey(rawBrand) {
            const base = normalizeDesignToken(rawBrand);
            if (!base) return '';
            const aliases = {
                BFG: 'BFGOODRICH',
                BFGOODRICH: 'BFGOODRICH'
            };
            return aliases[base] || base;
        }

        function buildGoalBrandCandidates(rawBrand) {
            const base = normalizeGoalBrandKey(rawBrand);
            if (!base) return [];
            const keys = new Set([base]);
            if (base === 'BFGOODRICH') keys.add('BFG');
            if (base === 'BFG') keys.add('BFGOODRICH');
            return Array.from(keys);
        }

        function goalTireTypeAllowedByFilter(goalType) {
            if (currentFilter === 'ALL') return true;
            if (currentFilter === 'Delanteras') return goalType === 'DELANTERA';
            if (currentFilter === 'Tracción') return goalType === 'TRACCION';
            if (currentFilter === 'Toda Posición') return goalType === 'TODA_ARRASTRE';
            return false;
        }

        function normalizeCpkGoalRecord(raw) {
            const tireTypeText = normalizeStr((raw && raw.tireTypeText) != null ? raw.tireTypeText : (raw && raw.tireType));
            const brandText = normalizeStr((raw && raw.brandText) != null ? raw.brandText : (raw && raw.brand));
            const design = normalizeStr(raw && raw.design).toUpperCase();
            const kmExpected = safeFloat(raw && raw.kmExpected);
            const kpkExpected = safeFloat(raw && raw.kpkExpected);
            const tireType = normalizeGoalTireType(tireTypeText);
            const brandKey = normalizeGoalBrandKey(brandText);

            if (!design) return null;
            if (kmExpected <= 0 && kpkExpected <= 0) return null;

            return {
                tireType,
                tireTypeLabel: goalTireTypeLabel(tireType),
                tireTypeText: tireTypeText || goalTireTypeLabel(tireType),
                brand: brandText.toUpperCase(),
                brandKey,
                design,
                matchKey: normalizeDesignToken(design),
                kmExpected,
                kpkExpected
            };
        }

        function processCpkGoalsData(data) {
            if (!Array.isArray(data) || !data.length) {
                dbCpkGoals = [];
                return;
            }

            const typeHeaders = ['TIPO DE LLANTA', 'TIPO', 'GRUPO', 'B'];
            const brandHeaders = ['MARCA', 'BRAND', 'FABRICANTE', 'C'];
            const designHeaders = ['DISEÑO', 'DISENO', 'DISEÑO LLANTA', 'DISENO LLANTA', 'MODELO', 'LLANTA', 'D'];
            const kmExpectedHeaders = ['KM X MM ESPERADO', 'KM X MM ESP', "KM'S ESPERADOS", 'KMS ESPERADOS', 'KM ESPERADOS', 'F'];
            const kpkExpectedHeaders = ['$ X KM ESPERADO', '$ X KM ESP', 'CPK ESPERADO', 'K P K ESP', 'KPK ESP', 'G'];

            dbCpkGoals = data.map(row => {
                const typeRaw = getGoalCell(row, typeHeaders, 1);
                const brandRaw = getGoalCell(row, brandHeaders, 2);
                const designRaw = getGoalCell(row, designHeaders, 3);
                const kmExpectedRaw = getGoalCell(row, kmExpectedHeaders, 5);
                const kpkExpectedRaw = getGoalCell(row, kpkExpectedHeaders, 6);
                return normalizeCpkGoalRecord({
                    tireTypeText: typeRaw,
                    brandText: brandRaw,
                    design: designRaw,
                    kmExpected: kmExpectedRaw,
                    kpkExpected: kpkExpectedRaw
                });
            }).filter(x => x !== null);
        }

        function exportGoalRows(goals) {
            return (Array.isArray(goals) ? goals : []).map(g => ({
                tireTypeText: g.tireTypeText,
                brand: g.brand,
                design: g.design,
                kmExpected: g.kmExpected,
                kpkExpected: g.kpkExpected
            }));
        }

        function saveLocalCpkGoals(goals) {
            const normalized = (Array.isArray(goals) ? goals : []).map(normalizeCpkGoalRecord).filter(Boolean);
            dbCpkGoals = normalized;
            localStorage.setItem(CPK_GOALS_STORAGE_KEY, JSON.stringify(exportGoalRows(normalized)));
        }

        function loadLocalCpkGoals() {
            let parsed = null;
            try {
                parsed = JSON.parse(localStorage.getItem(CPK_GOALS_STORAGE_KEY) || 'null');
            } catch (_) {
                parsed = null;
            }

            if (Array.isArray(parsed) && parsed.length > 0) {
                const normalizedStored = parsed.map(normalizeCpkGoalRecord).filter(Boolean);
                if (normalizedStored.length > 0) {
                    dbCpkGoals = normalizedStored;
                    return true;
                }
            }

            const defaults = (Array.isArray(DEFAULT_CPK_GOALS_LOCAL) ? DEFAULT_CPK_GOALS_LOCAL : []).map(normalizeCpkGoalRecord).filter(Boolean);
            dbCpkGoals = defaults;
            if (defaults.length > 0) {
                localStorage.setItem(CPK_GOALS_STORAGE_KEY, JSON.stringify(exportGoalRows(defaults)));
                return true;
            }
            return false;
        }

        function setCpkGoalsEditorError(msg) {
            const el = document.getElementById('cpkGoalsEditorError');
            if (!el) return;
            if (!msg) {
                el.classList.add('hidden');
                el.innerText = '';
                return;
            }
            el.classList.remove('hidden');
            el.innerText = msg;
        }

        function goalsToEditorText(goals) {
            const rows = Array.isArray(goals) ? goals : [];
            const header = 'Tipo|Marca|Diseño|Km x Mm Esp.|$ x Km Esp.';
            if (!rows.length) return header;
            const lines = rows.map(r => `${normalizeStr(r.tireTypeText || goalTireTypeLabel(r.tireType))}|${normalizeStr(r.brand)}|${normalizeStr(r.design)}|${r.kmExpected}|${r.kpkExpected}`);
            return [header, ...lines].join('\n');
        }

        function parseCpkGoalsEditorText(text) {
            const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) return [];

            const rows = [];
            lines.forEach((line, idx) => {
                const normalizedLine = normalizeDesignToken(line);
                if (idx === 0 && normalizedLine.includes('TIPO') && normalizedLine.includes('DISENO')) return;

                let parts = line.split('|').map(p => p.trim());
                if (parts.length < 4) parts = line.split('\t').map(p => p.trim());
                if (parts.length < 4) parts = line.split(',').map(p => p.trim());
                if (parts.length < 4) throw new Error(`Línea ${idx + 1}: formato inválido.`);

                let typeRaw = '';
                let brandRaw = '';
                let designRaw = '';
                let kmRaw = '';
                let kpkRaw = '';
                if (parts.length >= 5) {
                    [typeRaw, brandRaw, designRaw, kmRaw, kpkRaw] = parts;
                } else {
                    [typeRaw, designRaw, kmRaw, kpkRaw] = parts;
                }
                const row = normalizeCpkGoalRecord({
                    tireTypeText: typeRaw,
                    brandText: brandRaw,
                    design: designRaw,
                    kmExpected: kmRaw,
                    kpkExpected: kpkRaw
                });
                if (!row) throw new Error(`Línea ${idx + 1}: diseño vacío o metas inválidas.`);
                rows.push(row);
            });
            return rows;
        }

        function openCpkGoalsModal() {
            if (!currentUser || currentUser.role !== 'admin') {
                logStatus('Solo administradores pueden editar metas CPK.', 'error');
                return;
            }
            loadLocalCpkGoals();
            const textarea = document.getElementById('cpkGoalsEditorText');
            if (textarea) textarea.value = goalsToEditorText(dbCpkGoals);
            setCpkGoalsEditorError('');

            const modal = document.getElementById('cpkGoalsModal');
            if (modal && modal.classList.contains('opacity-0')) {
                window.toggleModal('cpkGoalsModal');
            }
        }

        function saveCpkGoalsFromEditor() {
            if (!currentUser || currentUser.role !== 'admin') {
                logStatus('Solo administradores pueden editar metas CPK.', 'error');
                return;
            }
            const textarea = document.getElementById('cpkGoalsEditorText');
            if (!textarea) return;

            try {
                const rows = parseCpkGoalsEditorText(textarea.value);
                if (!rows.length) {
                    setCpkGoalsEditorError('Debes capturar al menos una meta válida.');
                    return;
                }
                saveLocalCpkGoals(rows);
                setCpkGoalsEditorError('');
                logStatus(`Metas CPK guardadas localmente (${rows.length} filas).`, 'info');
                if (moduleState.currentTab === 'performance') runCPKAnalysis();
                window.toggleModal('cpkGoalsModal');
            } catch (e) {
                setCpkGoalsEditorError(e.message || 'No se pudo guardar las metas.');
            }
        }

        function restoreDefaultCpkGoals() {
            if (!currentUser || currentUser.role !== 'admin') {
                logStatus('Solo administradores pueden editar metas CPK.', 'error');
                return;
            }
            localStorage.removeItem(CPK_GOALS_STORAGE_KEY);
            const hasDefaults = loadLocalCpkGoals();
            const textarea = document.getElementById('cpkGoalsEditorText');
            if (textarea) textarea.value = goalsToEditorText(dbCpkGoals);
            setCpkGoalsEditorError('');
            if (moduleState.currentTab === 'performance') runCPKAnalysis();
            if (!hasDefaults) {
                logStatus('Plantilla limpia. Puedes pegar tus metas manualmente.', 'info');
            }
        }

        function processScrapData(data) {
            if(!data || !data.length) {
                dbScrap = [];
                safeSetText('scrapCountDisplay', 0);
                return;
            }
            
            let validDateCount = 0; // Contador interno para depuración

            dbScrap = data.map(row => {
                 const brand = (getValue(row, 'brand', 'scrap') || 'GEN').toString().trim().toUpperCase();
                 const model = (getValue(row, 'model', 'scrap') || 'STD').toString().trim().toUpperCase();
                 
                 // Validamos fecha aquí para loguear, aunque el análisis la procesa después
                 const rawDate = getValue(row, 'date', 'scrap');
                 if (parseFlexibleDate(rawDate)) validDateCount++;

                 // ACTUALIZADO: Lógica para sustituir "Sin Asignar" por "Recolección Pend."
                 let providerRaw = getValue(row, 'scrapProvider', 'scrap');
                 if (!providerRaw || providerRaw.trim() === '' || providerRaw === 'Sin Asignar') {
                     providerRaw = 'Recolección Pend.';
                 }

                 return { 
                     id: getValue(row, 'id', 'scrap')||'S/N', 
                     brand: brand, 
                     model: model, 
                     mm: safeFloat(getValue(row, 'mmNow', 'scrap')), 
                     originalMm: safeFloat(getValue(row, 'mmOrig', 'scrap'))||24, 
                     cost: safeFloat(getValue(row, 'cost', 'scrap')), 
                     status: 'Scrapped', 
                     reason: getValue(row, 'scrapReason', 'scrap')||'Desc', 
                     provider: providerRaw, 
                     date: rawDate
                };
            }).filter(x => x !== null);
            
            safeSetText('scrapCountDisplay', dbScrap.length);
            logStatus(`Desecho: ${dbScrap.length} items. Fechas legibles: ${validDateCount}`, 'info');
        }

        function processScrapCreditData(data) {
            if (!data || !data.length) {
                dbScrapCredits = [];
                return;
            }

            let validDateCount = 0;
            dbScrapCredits = data.map((row, idx) => {
                const rawDate = getValue(row, 'date', 'scrapCredit');
                if (parseFlexibleDate(rawDate)) validDateCount++;

                const providerRaw = normalizeStr(getValue(row, 'provider', 'scrapCredit')) || 'Sin proveedor';
                const legalName = normalizeStr(getValue(row, 'legalName', 'scrapCredit')) || '-';
                const description = normalizeStr(getValue(row, 'description', 'scrapCredit')) || 'Sin descripción';
                const qty = Math.abs(safeFloat(getValue(row, 'qty', 'scrapCredit')));
                const amount = Math.abs(safeFloat(getValue(row, 'amount', 'scrapCredit')));

                return {
                    id: `NC-${idx + 1}`,
                    date: rawDate,
                    provider: providerRaw,
                    legalName,
                    description,
                    qty,
                    amount
                };
            }).filter(r => (r.amount > 0) || (r.qty > 0) || normalizeStr(r.description) !== 'Sin descripción');

            logStatus(`Notas Crédito: ${dbScrapCredits.length} registros. Fechas legibles: ${validDateCount}`, 'info');
        }

        function processWashData(data) {
            if(!data || !data.length) {
                dbWashing = [];
                safeSetText('washCount', 0);
                sanitizeWashSelectedOptions();
                return;
            }
            const today = new Date();
            // Ajustamos 'today' al final del día para evitar falsos positivos por horas
            today.setHours(23, 59, 59, 999);

            let mapped = data.map(row => {
                 const unit = getValue(row, 'unit', 'wash') || 'S/N'; 
                 const company = getValue(row, 'washCompany', 'wash') || 'Sin Asignar'; 
                 const dateStr = getValue(row, 'washDate', 'wash'); 
                 const daysVal = getValue(row, 'washDays', 'wash'); 
                 let days = 0; 
                 let isoDate = '-'; 
                 let monthIdx = -1; 
                 let year = 0;
                 
                 let d = parseFlexibleDate(dateStr); 
                 
                 // --- AUTOCORRECCIÓN DE FECHAS FUTURAS (Fix para formato MM/DD vs DD/MM) ---
                 if (d && d > today) {
                     // Si la fecha está en el futuro, es probable que el formato esté invertido (USA style)
                     // Ejemplo: Leímos 02/05/2026 como 2 de Mayo (Futuro), pero era 5 de Febrero (Pasado).
                     // Lógica de inversión: El mes leído (4 = Mayo) debería ser el día (5). El día leído (2) debería ser el mes (1 = Feb).
                     
                     // Verificamos si es matemáticamente posible invertirlo (Día leído <= 12)
                     if (d.getDate() <= 12) {
                         const potentialMonth = d.getDate() - 1; // JS meses son 0-11
                         const potentialDay = d.getMonth() + 1;  // JS meses son 0-11, recuperamos el número visual
                         
                         const fixedDate = new Date(d.getFullYear(), potentialMonth, potentialDay);
                         
                         // Si al invertirla cae en el pasado (o hoy), asumimos que esa era la correcta
                         if (fixedDate <= today) {
                             d = fixedDate;
                             // console.log(`Autocorrección aplicada para ${unit}: ${dateStr} -> ${d.toLocaleDateString()}`);
                         }
                     }
                 }
                 // --------------------------------------------------------------------------

                 if (d) { 
                      // Recalcular diferencia de días con la fecha (corregida o no)
                      // Usamos Math.abs para evitar negativos si hay desfases horarios menores
                      const diffTime = today.getTime() - d.getTime();
                      days = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
                      
                      // Seguridad visual: Si por alguna razón sigue siendo negativo (muy futuro), lo ponemos en 0
                      if (days < 0) days = 0;

                      const dd = String(d.getDate()).padStart(2, '0');
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const yyyy = d.getFullYear();
                      isoDate = `${dd}-${mm}-${yyyy}`;
                      monthIdx = d.getMonth(); 
                      year = d.getFullYear(); 
                 } else if (daysVal) { days = parseInt(daysVal); }
                 // ACTUALIZADO: Se añade 'rawDate: d' al objeto retornado para permitir ordenamiento por fecha
                 return { unit, company, days, monthIdx, year, lastWashDate: isoDate, daysWithoutWash: days, rawDate: d };
            });
            dbWashing = mapped.filter(row => row.daysWithoutWash <= 500);
            safeSetText('washCount', dbWashing.length);
            sanitizeWashSelectedOptions();
        }
        
        function processWashHistoryData(data) {
             if(!data || !data.length) {
                dbWashHistory = [];
                if(document.getElementById('washHistoryCount')) safeSetText('washHistoryCount', 0);
                sanitizeWashSelectedOptions();
                return;
             }
             
             let validCount = 0;
             let invalidCount = 0;

             dbWashHistory = data.map(row => {
                 const unit = getValue(row, 'unit', 'wash') || 'S/N'; 
                 // Normalización de la compañía: Intentar mapear si es un código
                 let rawCompany = getValue(row, 'washCompany', 'wash') || 'Sin Asignar';
                 let company = rawCompany;
                 if (COMPANY_MAP[rawCompany]) {
                     company = COMPANY_MAP[rawCompany];
                 }

                 const dateStr = getValue(row, 'washDate', 'wash');
                 let isoDate = '-'; let monthIdx = -1; let year = 0;
                 
                 // Usamos el nuevo parser robusto
                 const d = parseFlexibleDate(dateStr); 
                 
                 if (d) {
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    isoDate = `${dd}-${mm}-${yyyy}`;
                    monthIdx = d.getMonth();
                    year = d.getFullYear();
                    validCount++;
                 } else { 
                    invalidCount++;
                    // Opcional: Descomentar para ver en consola del navegador qué falla
                    // console.warn("Fecha inválida en Histórico Lavado:", dateStr, row);
                    return null; 
                 }
                 // ACTUALIZADO: Guardamos 'rawDate' (objeto Date real) para poder ordenar cronológicamente después
                 return { unit, company, dateStr: isoDate, monthIdx, year, rawDate: d };
             }).filter(x => x !== null);
             
             if(document.getElementById('washHistoryCount')) safeSetText('washHistoryCount', dbWashHistory.length);
             
             // Feedback visual en el log
             if (invalidCount > 0) {
                 logStatus(`Lavado Histórico: ${validCount} cargados. ⚠️ ${invalidCount} fechas ilegibles.`, 'info');
             } else {
                 logStatus(`Lavado Histórico: ${validCount} registros cargados correctamente.`);
             }
             sanitizeWashSelectedOptions();
        }

        function processFuelData(data) {
            if(!data || !data.length) { dbExtra = []; safeSetText('fuelCount', 0); return; }
            
            dbExtra = data.map(row => {
                const monthRaw = getValue(row, 'fuelMonth', 'fuel') || '-';
                let companyRaw = getValue(row, 'fuelCompany', 'fuel') || 'Sin Asignar';
                let unit = getValue(row, 'unit', 'fuel') || 'S/N';
                let company = companyRaw.toString().trim();
                
                if (COMPANY_MAP[company]) company = COMPANY_MAP[company];
                if (LA_PAZ_UNITS.includes(unit.toUpperCase())) company = 'La Paz';

                const engine = getValue(row, 'fuelEngine', 'fuel') || 'Desconocido';
                const manufacturer = getValue(row, 'fuelManufacturer', 'fuel') || 'Desconocido';
                const segment = getValue(row, 'fuelSegment', 'fuel') || 'General';
                
                if (engine.toUpperCase().includes('EURO 5')) company = 'Pipitas';
                
                const operator = getValue(row, 'fuelOperator', 'fuel') || 'Desconocido';
                const km = safeFloat(getValue(row, 'fuelKm', 'fuel'));
                const liters = safeFloat(getValue(row, 'fuelLiters', 'fuel'));
                let yieldVal = safeFloat(getValue(row, 'fuelYield', 'fuel'));
                
                if (yieldVal === 0 && liters > 0) yieldVal = km / liters;
                
                let mIdx = 0; 
                let year = new Date().getFullYear(); // Default
                
                // Intentar obtener fecha completa para sacar el año
                const d = parseFlexibleDate(monthRaw);
                if (d) {
                    mIdx = d.getMonth();
                    year = d.getFullYear();
                } else {
                    // Si solo es nombre del mes, buscar indice
                    let found = monthNamesFull.findIndex(m => m.toUpperCase().includes(monthRaw.toString().toUpperCase().substring(0,3)));
                    if (found !== -1) mIdx = found;
                    
                    // Buscar si hay un año en el string (ej: "Enero 2024")
                    const yMatch = monthRaw.toString().match(/20\d{2}/);
                    if(yMatch) year = parseInt(yMatch[0]);
                }

                return { month: monthRaw, mIdx, year, company, engine, manufacturer, operator, km, liters, yield: yieldVal, unit: unit, segment: segment };
            }).filter(x => x.km > 0 && x.liters > 0); 
            
            safeSetText('fuelCount', dbExtra.length);
            sanitizeFuelSelectedOptions();
        }

        function getFuelSuggestionOptions(kind) {
            const values = new Set();
            (Array.isArray(dbExtra) ? dbExtra : []).forEach(r => {
                if (kind === 'UNIT') {
                    const unit = normalizeStr(r.unit).toUpperCase();
                    if (unit) values.add(unit);
                } else {
                    const op = normalizeStr(r.operator).toUpperCase();
                    if (op) values.add(op);
                }
            });
            return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        }

        function syncFuelSelectedInfo() {
            const unitInfo = document.getElementById('fuelSelectedUnitInfo');
            const opInfo = document.getElementById('fuelSelectedOperatorInfo');
            if (unitInfo) unitInfo.innerText = currentFuelSelectedUnit.length ? `${currentFuelSelectedUnit.length} seleccionados` : '';
            if (opInfo) opInfo.innerText = currentFuelSelectedOperator.length ? `${currentFuelSelectedOperator.length} seleccionados` : '';
        }

        function syncFuelExclusiveFilterState() {
            const unitInput = document.getElementById('fuelFilterUnit');
            const opInput = document.getElementById('fuelFilterOperator');
            const unitBox = document.getElementById('fuelSuggestUnit');
            const opBox = document.getElementById('fuelSuggestOperator');

            if (currentFuelSelectedUnit.length > 0 && currentFuelSelectedOperator.length > 0) {
                currentFuelSelectedOperator = [];
            }

            const lockUnit = currentFuelSelectedOperator.length > 0;
            const lockOp = currentFuelSelectedUnit.length > 0;

            if (lockUnit) {
                currentFuelSelectedUnit = [];
                currentFuelSearchUnit = '';
                if (unitInput) unitInput.value = '';
                if (unitBox) unitBox.classList.remove('show');
            }
            if (lockOp) {
                currentFuelSelectedOperator = [];
                currentFuelSearchOperator = '';
                if (opInput) opInput.value = '';
                if (opBox) opBox.classList.remove('show');
            }

            if (unitInput) {
                unitInput.disabled = lockUnit;
                unitInput.classList.toggle('bg-slate-100', lockUnit);
                unitInput.classList.toggle('text-slate-400', lockUnit);
                unitInput.classList.toggle('cursor-not-allowed', lockUnit);
                unitInput.placeholder = lockUnit ? 'Unidad (deshabilitado)' : 'Unidad';
            }
            if (opInput) {
                opInput.disabled = lockOp;
                opInput.classList.toggle('bg-slate-100', lockOp);
                opInput.classList.toggle('text-slate-400', lockOp);
                opInput.classList.toggle('cursor-not-allowed', lockOp);
                opInput.placeholder = lockOp ? 'Operador (deshabilitado)' : 'Operador';
            }
            syncFuelSelectedInfo();
        }

        function sanitizeFuelSelectedOptions() {
            const unitSet = new Set(getFuelSuggestionOptions('UNIT'));
            const opSet = new Set(getFuelSuggestionOptions('OP'));
            currentFuelSelectedUnit = currentFuelSelectedUnit.filter(v => unitSet.has(v));
            currentFuelSelectedOperator = currentFuelSelectedOperator.filter(v => opSet.has(v));
            syncFuelExclusiveFilterState();
        }

        function renderFuelSuggestions(kind) {
            const inputId = kind === 'UNIT' ? 'fuelFilterUnit' : 'fuelFilterOperator';
            const boxId = kind === 'UNIT' ? 'fuelSuggestUnit' : 'fuelSuggestOperator';
            const selected = kind === 'UNIT' ? currentFuelSelectedUnit : currentFuelSelectedOperator;
            const input = document.getElementById(inputId);
            const box = document.getElementById(boxId);
            if (!input || !box) return;
            if (input.disabled) {
                box.classList.remove('show');
                return;
            }

            const query = normalizeStr(input.value).toUpperCase();
            const options = getFuelSuggestionOptions(kind)
                .filter(v => !query || v.includes(query))
                .slice(0, 80);

            if (!options.length) {
                box.innerHTML = '<div class="px-2 py-2 text-xs text-slate-400">Sin coincidencias</div>';
                box.classList.add('show');
                return;
            }

            box.innerHTML = `
                <div class="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span>${kind === 'UNIT' ? 'Unidad' : 'Operador'}</span>
                    <button class="text-indigo-600 hover:text-indigo-800 font-bold" onclick="window.clearFuelSuggestionSelection('${kind}')">Limpiar</button>
                </div>
                ${options.map(v => {
                    const enc = encodeURIComponent(v);
                    const checked = selected.includes(v) ? 'checked' : '';
                    return `<label class="cursor-pointer px-2 py-1 hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" ${checked} onchange="window.toggleFuelSuggestionSelection('${kind}','${enc}',this.checked)"> <span>${escapeHtml(v)}</span></label>`;
                }).join('')}
            `;
            box.classList.add('show');
        }

        function toggleFuelSuggestionSelection(kind, encodedValue, checked) {
            const value = decodeURIComponent(encodedValue || '');
            if (!value) return;
            if (checked && kind === 'UNIT') {
                currentFuelSelectedOperator = [];
                currentFuelSearchOperator = '';
                const opEl = document.getElementById('fuelFilterOperator');
                if (opEl) opEl.value = '';
            } else if (checked && kind === 'OP') {
                currentFuelSelectedUnit = [];
                currentFuelSearchUnit = '';
                const unitEl = document.getElementById('fuelFilterUnit');
                if (unitEl) unitEl.value = '';
            }
            const target = kind === 'UNIT' ? currentFuelSelectedUnit : currentFuelSelectedOperator;
            const idx = target.indexOf(value);
            if (checked && idx === -1) target.push(value);
            if (!checked && idx >= 0) target.splice(idx, 1);
            syncFuelExclusiveFilterState();
        }

        function clearFuelSuggestionSelection(kind) {
            if (kind === 'UNIT') currentFuelSelectedUnit = [];
            else currentFuelSelectedOperator = [];
            syncFuelExclusiveFilterState();
            renderFuelSuggestions(kind);
        }

        function applyFuelSearchFilters() {
            const unitEl = document.getElementById('fuelFilterUnit');
            const opEl = document.getElementById('fuelFilterOperator');
            currentFuelSearchUnit = normalizeStr(unitEl ? unitEl.value : '').toUpperCase();
            currentFuelSearchOperator = normalizeStr(opEl ? opEl.value : '').toUpperCase();
            hideAllCheckboxDropdowns();
            if (moduleState.currentTab === 'extra') runFuelAnalysis();
        }

        function clearFuelSearchFilters() {
            currentFuelSearchUnit = '';
            currentFuelSearchOperator = '';
            currentFuelSelectedUnit = [];
            currentFuelSelectedOperator = [];
            const unitEl = document.getElementById('fuelFilterUnit');
            const opEl = document.getElementById('fuelFilterOperator');
            if (unitEl) unitEl.value = '';
            if (opEl) opEl.value = '';
            syncFuelExclusiveFilterState();
            hideAllCheckboxDropdowns();
            if (moduleState.currentTab === 'extra') runFuelAnalysis();
        }

        function getFuelSearchScopedRows() {
            if (!Array.isArray(dbExtra) || !dbExtra.length) return [];
            const selectedUnitSet = new Set(currentFuelSelectedUnit);
            const selectedOpSet = new Set(currentFuelSelectedOperator);
            return dbExtra.filter(r => {
                const unit = normalizeStr(r.unit).toUpperCase();
                const op = normalizeStr(r.operator).toUpperCase();
                const unitOk = selectedUnitSet.size > 0
                    ? selectedUnitSet.has(unit)
                    : (!currentFuelSearchUnit || unit.includes(currentFuelSearchUnit));
                const opOk = selectedOpSet.size > 0
                    ? selectedOpSet.has(op)
                    : (!currentFuelSearchOperator || op.includes(currentFuelSearchOperator));
                return unitOk && opOk;
            });
        }

        function isExcludedWashFilterUnit(row) {
            const unit = normalizeStr(row && row.unit).toUpperCase();
            const company = normalizeStr(row && row.company).toUpperCase();
            return unit.includes('EXTERN') || unit.includes('CCM') || company.includes('EXTERN') || company.includes('CCM');
        }

        function getWashSuggestionOptions() {
            const values = new Set();
            (Array.isArray(dbWashing) ? dbWashing : []).forEach(r => {
                if (isExcludedWashFilterUnit(r)) return;
                const unit = normalizeStr(r.unit).toUpperCase();
                if (unit) values.add(unit);
            });
            (Array.isArray(dbWashHistory) ? dbWashHistory : []).forEach(r => {
                if (isExcludedWashFilterUnit(r)) return;
                const unit = normalizeStr(r.unit).toUpperCase();
                if (unit) values.add(unit);
            });
            return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        }

        function syncWashSelectedInfo() {
            const info = document.getElementById('washSelectedUnitInfo');
            if (!info) return;
            info.innerText = currentWashSelectedUnit.length ? `${currentWashSelectedUnit.length} seleccionados` : '';
        }

        function sanitizeWashSelectedOptions() {
            const valid = new Set(getWashSuggestionOptions());
            currentWashSelectedUnit = currentWashSelectedUnit.filter(v => valid.has(v));
            syncWashSelectedInfo();
        }

        function renderWashSuggestions() {
            const input = document.getElementById('washFilterUnit');
            const box = document.getElementById('washSuggestUnit');
            if (!input || !box) return;
            const query = normalizeStr(input.value).toUpperCase();
            const options = getWashSuggestionOptions()
                .filter(v => !query || v.includes(query))
                .slice(0, 80);

            if (!options.length) {
                box.innerHTML = '<div class="px-2 py-2 text-xs text-slate-400">Sin coincidencias</div>';
                box.classList.add('show');
                return;
            }

            box.innerHTML = `
                <div class="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Unidad</span>
                    <button class="text-indigo-600 hover:text-indigo-800 font-bold" onclick="window.clearWashSuggestionSelection()">Limpiar</button>
                </div>
                ${options.map(v => {
                    const enc = encodeURIComponent(v);
                    const checked = currentWashSelectedUnit.includes(v) ? 'checked' : '';
                    return `<label class="cursor-pointer px-2 py-1 hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" ${checked} onchange="window.toggleWashSuggestionSelection('${enc}',this.checked)"> <span>${escapeHtml(v)}</span></label>`;
                }).join('')}
            `;
            box.classList.add('show');
        }

        function toggleWashSuggestionSelection(encodedValue, checked) {
            const value = decodeURIComponent(encodedValue || '');
            if (!value) return;
            const idx = currentWashSelectedUnit.indexOf(value);
            if (checked && idx === -1) currentWashSelectedUnit.push(value);
            if (!checked && idx >= 0) currentWashSelectedUnit.splice(idx, 1);
            syncWashSelectedInfo();
        }

        function clearWashSuggestionSelection() {
            currentWashSelectedUnit = [];
            syncWashSelectedInfo();
            renderWashSuggestions();
        }

        function applyWashSearchFilters() {
            const unitEl = document.getElementById('washFilterUnit');
            currentWashSearchUnit = normalizeStr(unitEl ? unitEl.value : '').toUpperCase();
            hideAllCheckboxDropdowns();
            if (moduleState.currentTab === 'washing') runWashAnalysis();
        }

        function clearWashSearchFilters() {
            currentWashSearchUnit = '';
            currentWashSelectedUnit = [];
            const unitEl = document.getElementById('washFilterUnit');
            if (unitEl) unitEl.value = '';
            syncWashSelectedInfo();
            hideAllCheckboxDropdowns();
            if (moduleState.currentTab === 'washing') runWashAnalysis();
        }

        function getWashScopedCurrentRows() {
            if (!Array.isArray(dbWashing) || !dbWashing.length) return [];
            const selectedSet = new Set(currentWashSelectedUnit);
            const hasFilter = selectedSet.size > 0 || !!currentWashSearchUnit;
            return dbWashing.filter(r => {
                if (hasFilter && isExcludedWashFilterUnit(r)) return false;
                const unit = normalizeStr(r.unit).toUpperCase();
                return selectedSet.size > 0
                    ? selectedSet.has(unit)
                    : (!currentWashSearchUnit || unit.includes(currentWashSearchUnit));
            });
        }

        function getWashScopedHistoryRows() {
            if (!Array.isArray(dbWashHistory) || !dbWashHistory.length) return [];
            const selectedSet = new Set(currentWashSelectedUnit);
            const hasFilter = selectedSet.size > 0 || !!currentWashSearchUnit;
            return dbWashHistory.filter(r => {
                if (hasFilter && isExcludedWashFilterUnit(r)) return false;
                const unit = normalizeStr(r.unit).toUpperCase();
                return selectedSet.size > 0
                    ? selectedSet.has(unit)
                    : (!currentWashSearchUnit || unit.includes(currentWashSearchUnit));
            });
        }

        function hasWashSpecificSelection() {
            return currentWashSelectedUnit.length > 0 || !!currentWashSearchUnit;
        }

        function toggleWashSummaryMode(showSummary) {
            const topWrap = document.getElementById('washTopDirtyContainer');
            const summaryWrap = document.getElementById('washHistorySummaryContainer');
            if (topWrap) topWrap.classList.toggle('hidden', showSummary);
            if (summaryWrap) summaryWrap.classList.toggle('hidden', !showSummary);
        }

        function renderWashHistorySummaryRows(historyRows) {
            const titleEl = document.getElementById('washHistorySummaryTitle');
            const bodyEl = document.getElementById('washHistorySummaryBody');
            if (!titleEl || !bodyEl) return;

            const selectedText = currentWashSelectedUnit.length
                ? currentWashSelectedUnit.join(', ')
                : (currentWashSearchUnit || 'Unidad filtrada');
            titleEl.innerText = `Selección: ${selectedText}`;

            const rows = Array.isArray(historyRows) ? [...historyRows] : [];
            rows.sort((a, b) => {
                if (a.rawDate && b.rawDate) return b.rawDate - a.rawDate;
                return normalizeStr(b.dateStr).localeCompare(normalizeStr(a.dateStr), 'es');
            });

            if (!rows.length) {
                bodyEl.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Sin histórico para la selección actual.</td></tr>';
                return;
            }

            bodyEl.innerHTML = rows.slice(0, 200).map(r => `
                <tr class="hover:bg-cyan-50 transition">
                    <td class="p-3 font-bold text-slate-700">${escapeHtml(normalizeStr(r.unit))}</td>
                    <td class="p-3 text-slate-600">${escapeHtml(normalizeStr(r.company))}</td>
                    <td class="p-3 text-slate-600 font-mono">${escapeHtml(normalizeStr(r.dateStr))}</td>
                    <td class="p-3 text-center text-slate-500">${escapeHtml(monthNamesFull[r.monthIdx] || '-')}</td>
                </tr>
            `).join('');
        }

        function renderWashHighFrequencyTable(historyRows) {
            const tbody = document.getElementById('washHighFreqBody');
            const countEl = document.getElementById('washHighFreqCount');
            if (!tbody || !countEl) return;

            const rows = (Array.isArray(historyRows) ? historyRows : []).filter(r => !isExcludedWashFilterUnit(r));
            const grouped = {};
            rows.forEach(r => {
                const unitKey = normalizeStr(r.unit).toUpperCase();
                if (!unitKey) return;
                if (!grouped[unitKey]) grouped[unitKey] = { unit: normalizeStr(r.unit), rows: [] };
                grouped[unitKey].rows.push(r);
            });

            const stats = Object.values(grouped).map(group => {
                const sorted = group.rows
                    .filter(r => r.rawDate instanceof Date)
                    .sort((a, b) => a.rawDate - b.rawDate);

                let shortCycleCount = 0;
                let shortCycleSum = 0;
                let lastGap = null;

                for (let i = 1; i < sorted.length; i++) {
                    const prev = sorted[i - 1].rawDate;
                    const curr = sorted[i].rawDate;
                    const diffDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) continue;
                    lastGap = diffDays;
                    if (diffDays < 30) {
                        shortCycleCount++;
                        shortCycleSum += diffDays;
                    }
                }

                if (shortCycleCount <= 0) return null;
                const latestRow = sorted.length ? sorted[sorted.length - 1] : (group.rows[group.rows.length - 1] || null);
                return {
                    unit: normalizeStr(group.unit),
                    company: normalizeStr(latestRow && latestRow.company) || '-',
                    shortCycleCount,
                    avgShortCycle: shortCycleCount > 0 ? (shortCycleSum / shortCycleCount) : 0,
                    lastGap: lastGap == null ? '-' : `${lastGap} d`,
                    totalWashes: sorted.length
                };
            }).filter(Boolean);

            stats.sort((a, b) => {
                if (b.shortCycleCount !== a.shortCycleCount) return b.shortCycleCount - a.shortCycleCount;
                if (a.avgShortCycle !== b.avgShortCycle) return a.avgShortCycle - b.avgShortCycle;
                return b.totalWashes - a.totalWashes;
            });

            countEl.innerText = stats.length.toLocaleString('es-MX');
            if (!stats.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="p-3 text-center text-slate-400">Sin unidades con frecuencia &lt; 30 días en el periodo.</td></tr>';
                return;
            }

            const getFreqLevel = (row) => {
                if (row.shortCycleCount >= 8 || row.avgShortCycle <= 14) {
                    return { label: 'ALTO', css: 'bg-red-100 text-red-700' };
                }
                if (row.shortCycleCount >= 4 || row.avgShortCycle <= 21) {
                    return { label: 'MEDIO', css: 'bg-amber-100 text-amber-700' };
                }
                return { label: 'BAJO', css: 'bg-green-100 text-green-700' };
            };

            tbody.innerHTML = stats.slice(0, 20).map(r => `
                <tr class="hover:bg-amber-50 transition">
                    <td class="p-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${getFreqLevel(r).css}">${getFreqLevel(r).label}</span></td>
                    <td class="p-2 font-bold text-slate-700">${escapeHtml(r.unit)}</td>
                    <td class="p-2 text-slate-600">${escapeHtml(r.company)}</td>
                    <td class="p-2 text-center font-mono font-bold text-rose-600">${r.shortCycleCount.toLocaleString('es-MX')}</td>
                    <td class="p-2 text-center font-mono text-slate-600">${r.avgShortCycle.toFixed(1)} d</td>
                    <td class="p-2 text-center font-mono text-slate-500">${r.lastGap}</td>
                    <td class="p-2 text-center font-mono text-slate-500">${r.totalWashes.toLocaleString('es-MX')}</td>
                </tr>
            `).join('');
        }

        function hasFuelSpecificSelection() {
            return currentFuelSelectedUnit.length > 0
                || currentFuelSelectedOperator.length > 0
                || !!currentFuelSearchUnit
                || !!currentFuelSearchOperator;
        }

        function toggleFuelRankingMode(showSummary) {
            const topWrap = document.getElementById('fuelTopRankingsContainer');
            const summaryWrap = document.getElementById('fuelSpecificSummaryContainer');
            if (topWrap) topWrap.classList.toggle('hidden', showSummary);
            if (summaryWrap) summaryWrap.classList.toggle('hidden', !showSummary);
        }

        function renderFuelSpecificSummaryRows(rows, mode) {
            const titleEl = document.getElementById('fuelSpecificSummaryTitle');
            const subtitleEl = document.getElementById('fuelSpecificSummarySubtitle');
            const headerEl = document.getElementById('fuelSpecificHeaderEntity');
            const bodyEl = document.getElementById('fuelSpecificSummaryBody');
            if (!titleEl || !subtitleEl || !headerEl || !bodyEl) return;

            const isUnitMode = mode === 'UNIT';
            const selectedItems = isUnitMode
                ? (currentFuelSelectedUnit.length ? currentFuelSelectedUnit : [currentFuelSearchUnit])
                : (currentFuelSelectedOperator.length ? currentFuelSelectedOperator : [currentFuelSearchOperator]);
            const selectedText = selectedItems.filter(Boolean).join(', ');

            titleEl.innerText = isUnitMode
                ? 'Operadores por Unidad Seleccionada'
                : 'Unidades por Operador Seleccionado';
            subtitleEl.innerText = selectedText ? `Selección: ${selectedText}` : '';
            headerEl.innerText = isUnitMode ? 'Operador' : 'Unidad';

            const entityMap = {};
            rows.forEach(r => {
                const key = isUnitMode
                    ? normalizeStr(r.operator || 'SIN OPERADOR').toUpperCase()
                    : normalizeStr(r.unit || 'SIN UNIDAD').toUpperCase();
                if (!entityMap[key]) entityMap[key] = { km: 0, liters: 0, count: 0 };
                entityMap[key].km += r.km || 0;
                entityMap[key].liters += r.liters || 0;
                entityMap[key].count += 1;
            });

            const summary = Object.entries(entityMap)
                .map(([name, v]) => ({
                    name,
                    km: v.km,
                    liters: v.liters,
                    yield: v.liters > 0 ? (v.km / v.liters) : 0,
                    count: v.count
                }))
                .sort((a, b) => b.yield - a.yield);

            if (!summary.length) {
                bodyEl.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">Sin datos para la selección</td></tr>';
                return;
            }

            bodyEl.innerHTML = summary.map((x, idx) => `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="p-3 font-semibold text-slate-700">${idx + 1}. ${escapeHtml(x.name)}</td>
                    <td class="p-3 text-right text-slate-500 font-mono">${x.km.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                    <td class="p-3 text-right text-slate-500 font-mono">${x.liters.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                    <td class="p-3 text-center font-bold text-teal-700">${x.yield.toFixed(2)}</td>
                    <td class="p-3 text-center text-slate-500">${x.count.toLocaleString('es-MX')}</td>
                </tr>
            `).join('');
        }

        function getLossCompanyScopedRows() {
            if (!Array.isArray(dbLoss) || !dbLoss.length) return [];
            if (currentLossCompanyFilter === 'ALL') return dbLoss;
            return dbLoss.filter(r => r.company === currentLossCompanyFilter);
        }

        function getLossSuggestionOptions(kind) {
            const rows = getLossCompanyScopedRows();
            const values = new Set();
            rows.forEach(r => {
                if (kind === 'TU') {
                    if (r.tractor) values.add(r.tractor);
                    if (r.unit) values.add(r.unit);
                } else {
                    if (r.operator) values.add(r.operator);
                }
            });
            return Array.from(values).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        }

        function syncLossSelectedInfo() {
            const tuInfo = document.getElementById('lossSelectedTUInfo');
            const opInfo = document.getElementById('lossSelectedOperatorInfo');
            if (tuInfo) {
                if (currentLossSelectedTU.length) tuInfo.innerText = `${currentLossSelectedTU.length} seleccionados`;
                else tuInfo.innerText = '';
            }
            if (opInfo) {
                if (currentLossSelectedOperator.length) opInfo.innerText = `${currentLossSelectedOperator.length} seleccionados`;
                else opInfo.innerText = '';
            }
        }

        function syncLossExclusiveFilterState() {
            const tuInput = document.getElementById('lossFilterTU');
            const opInput = document.getElementById('lossFilterOperator');
            const tuBox = document.getElementById('lossSuggestTU');
            const opBox = document.getElementById('lossSuggestOperator');

            if (currentLossSelectedTU.length > 0 && currentLossSelectedOperator.length > 0) {
                currentLossSelectedOperator = [];
            }

            const lockTU = currentLossSelectedOperator.length > 0;
            const lockOP = currentLossSelectedTU.length > 0;

            if (lockTU) {
                currentLossSelectedTU = [];
                currentLossSearchTU = '';
                if (tuInput) tuInput.value = '';
                if (tuBox) tuBox.classList.remove('show');
            }
            if (lockOP) {
                currentLossSelectedOperator = [];
                currentLossSearchOperator = '';
                if (opInput) opInput.value = '';
                if (opBox) opBox.classList.remove('show');
            }

            if (tuInput) {
                tuInput.disabled = lockTU;
                tuInput.classList.toggle('bg-slate-100', lockTU);
                tuInput.classList.toggle('text-slate-400', lockTU);
                tuInput.classList.toggle('cursor-not-allowed', lockTU);
                tuInput.placeholder = lockTU ? 'Tractor o Unidad (deshabilitado)' : 'Tractor o Unidad';
            }
            if (opInput) {
                opInput.disabled = lockOP;
                opInput.classList.toggle('bg-slate-100', lockOP);
                opInput.classList.toggle('text-slate-400', lockOP);
                opInput.classList.toggle('cursor-not-allowed', lockOP);
                opInput.placeholder = lockOP ? 'Operador (deshabilitado)' : 'Operador';
            }

            syncLossSelectedInfo();
        }

        function sanitizeLossSelectedOptions() {
            const tuSet = new Set(getLossSuggestionOptions('TU'));
            const opSet = new Set(getLossSuggestionOptions('OP'));
            currentLossSelectedTU = currentLossSelectedTU.filter(v => tuSet.has(v));
            currentLossSelectedOperator = currentLossSelectedOperator.filter(v => opSet.has(v));
            syncLossExclusiveFilterState();
        }

        function renderLossSuggestions(kind) {
            const inputId = kind === 'TU' ? 'lossFilterTU' : 'lossFilterOperator';
            const boxId = kind === 'TU' ? 'lossSuggestTU' : 'lossSuggestOperator';
            const selected = kind === 'TU' ? currentLossSelectedTU : currentLossSelectedOperator;
            const input = document.getElementById(inputId);
            const box = document.getElementById(boxId);
            if (!input || !box) return;
            if (input.disabled) {
                box.classList.remove('show');
                return;
            }

            const query = normalizeStr(input.value).toUpperCase();
            const options = getLossSuggestionOptions(kind)
                .filter(v => !query || v.includes(query))
                .slice(0, 80);

            if (!options.length) {
                box.innerHTML = '<div class="px-2 py-2 text-xs text-slate-400">Sin coincidencias</div>';
                box.classList.add('show');
                return;
            }

            box.innerHTML = `
                <div class="px-2 py-1 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span>${kind === 'TU' ? 'Tractor / Unidad' : 'Operador'}</span>
                    <button class="text-indigo-600 hover:text-indigo-800 font-bold" onclick="window.clearLossSuggestionSelection('${kind}')">Limpiar</button>
                </div>
                ${options.map(v => {
                    const enc = encodeURIComponent(v);
                    const checked = selected.includes(v) ? 'checked' : '';
                    return `<label class="cursor-pointer px-2 py-1 hover:bg-slate-50 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" ${checked} onchange="window.toggleLossSuggestionSelection('${kind}','${enc}',this.checked)"> <span>${escapeHtml(v)}</span></label>`;
                }).join('')}
            `;
            box.classList.add('show');
        }

        function toggleLossSuggestionSelection(kind, encodedValue, checked) {
            const value = decodeURIComponent(encodedValue || '');
            if (!value) return;
            if (checked && kind === 'TU') {
                currentLossSelectedOperator = [];
                currentLossSearchOperator = '';
                const opEl = document.getElementById('lossFilterOperator');
                if (opEl) opEl.value = '';
            } else if (checked && kind === 'OP') {
                currentLossSelectedTU = [];
                currentLossSearchTU = '';
                const tuEl = document.getElementById('lossFilterTU');
                if (tuEl) tuEl.value = '';
            }
            const target = kind === 'TU' ? currentLossSelectedTU : currentLossSelectedOperator;
            const idx = target.indexOf(value);
            if (checked && idx === -1) target.push(value);
            if (!checked && idx >= 0) target.splice(idx, 1);
            syncLossExclusiveFilterState();
        }

        function clearLossSuggestionSelection(kind) {
            if (kind === 'TU') currentLossSelectedTU = [];
            else currentLossSelectedOperator = [];
            syncLossExclusiveFilterState();
            renderLossSuggestions(kind);
        }

        function updateLossCompanyButtons() {
            const map = {
                ALL: 'loss-company-ALL',
                Yucarro: 'loss-company-YUCARRO',
                T2020: 'loss-company-T2020',
                'CR MID': 'loss-company-CRMID',
                'CR LPZ': 'loss-company-CRLPZ'
            };
            Object.entries(map).forEach(([key, id]) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.classList.toggle('active', currentLossCompanyFilter === key);
            });
        }

        function updateLossLitersModeButtons() {
            const map = { ABS: 'loss-liters-mode-ABS', PCT: 'loss-liters-mode-PCT' };
            Object.entries(map).forEach(([key, id]) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.classList.toggle('active', currentLossLitersMode === key);
            });
        }

        function setLossLitersMode(mode) {
            const allowed = ['ABS', 'PCT'];
            currentLossLitersMode = allowed.includes(mode) ? mode : 'PCT';
            updateLossLitersModeButtons();
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function setLossLowRankBy(value) {
            const allowed = ['OPERADOR', 'UNIDAD'];
            currentLossLowRankBy = allowed.includes(value) ? value : 'OPERADOR';
            const rankEl = document.getElementById('lossLowRankBy');
            if (rankEl && rankEl.value !== currentLossLowRankBy) rankEl.value = currentLossLowRankBy;
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function setLossTopOrder(value) {
            const allowed = ['MENOR', 'MAYOR'];
            currentLossTopOrder = allowed.includes(value) ? value : 'MENOR';
            const orderEl = document.getElementById('lossTopOrder');
            if (orderEl && orderEl.value !== currentLossTopOrder) orderEl.value = currentLossTopOrder;
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function setLossCompanyFilter(company) {
            const allowed = ['ALL', 'Yucarro', 'T2020', 'CR MID', 'CR LPZ'];
            currentLossCompanyFilter = allowed.includes(company) ? company : 'ALL';
            updateLossCompanyButtons();
            sanitizeLossSelectedOptions();
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function applyLossSearchFilters() {
            const tuEl = document.getElementById('lossFilterTU');
            const opEl = document.getElementById('lossFilterOperator');
            currentLossSearchTU = normalizeStr(tuEl ? tuEl.value : '').toUpperCase();
            currentLossSearchOperator = normalizeStr(opEl ? opEl.value : '').toUpperCase();
            hideAllCheckboxDropdowns();
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function clearLossSearchFilters() {
            currentLossSearchTU = '';
            currentLossSearchOperator = '';
            currentLossSelectedTU = [];
            currentLossSelectedOperator = [];
            const tuEl = document.getElementById('lossFilterTU');
            const opEl = document.getElementById('lossFilterOperator');
            if (tuEl) tuEl.value = '';
            if (opEl) opEl.value = '';
            syncLossExclusiveFilterState();
            hideAllCheckboxDropdowns();
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function processLossData(yucarroRows, t2020Rows, corporedRows) {
            const requiredFields = ['date', 'tractor', 'unit', 'operator', 'origin', 'destination'];
            const parseRows = (rows, company) => {
                if (!Array.isArray(rows) || !rows.length) return [];
                return rows.map(row => {
                    const dateRaw = getValue(row, 'date', 'loss');
                    const tractorRaw = getValue(row, 'tractor', 'loss');
                    const unitRaw = getValue(row, 'unit', 'loss');
                    const operatorRaw = getValue(row, 'operator', 'loss');
                    const originRaw = getValue(row, 'origin', 'loss');
                    const destinationRaw = getValue(row, 'destination', 'loss');

                    const basic = {
                        date: normalizeStr(dateRaw),
                        tractor: normalizeStr(tractorRaw).toUpperCase(),
                        unit: normalizeStr(unitRaw).toUpperCase(),
                        operator: normalizeStr(operatorRaw).toUpperCase(),
                        origin: normalizeStr(originRaw).toUpperCase(),
                        destination: normalizeStr(destinationRaw).toUpperCase()
                    };
                    const missing = requiredFields.some(k => !basic[k]);
                    const dateObj = parseFlexibleDate(basic.date);
                    if (missing || !dateObj) return null;

                    const year = dateObj.getFullYear();
                    const month = dateObj.getMonth();
                    let effectiveCompany = company;
                    if (company === 'Corpored') {
                        const originNorm = basic.origin
                            .replace(/[^A-Z0-9 ]+/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        effectiveCompany = originNorm.includes('TAD LA PAZ') ? 'CR LPZ' : 'CR MID';
                    }
                    return {
                        company: effectiveCompany,
                        date: basic.date,
                        dateObj,
                        year,
                        month,
                        monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
                        tractor: basic.tractor,
                        unit: basic.unit,
                        operator: basic.operator,
                        origin: basic.origin,
                        destination: basic.destination,
                        ingresos: safeFloat(getValue(row, 'ingresos', 'loss')),
                        ingresosPeajes: safeFloat(getValue(row, 'ingresosPeajes', 'loss')),
                        litersTransported: safeFloat(getValue(row, 'litersTransported', 'loss')),
                        litersFaltSabana: safeFloat(getValue(row, 'litersFaltSabana', 'loss')),
                        diffSiic: safeFloat(getValue(row, 'diffSiic', 'loss')),
                        importeSiic: safeFloat(getValue(row, 'importeSiic', 'loss')),
                        litersFaltSiic: safeFloat(getValue(row, 'litersFaltSiic', 'loss')),
                        litersCondonaPemex: safeFloat(getValue(row, 'litersCondonaPemex', 'loss')),
                        litersDescPemex: safeFloat(getValue(row, 'litersDescPemex', 'loss')),
                        importeDescPemex: safeFloat(getValue(row, 'importeDescPemex', 'loss')),
                        litersAbsTyuc: safeFloat(getValue(row, 'litersAbsTyuc', 'loss')),
                        importeAbsTyuc: safeFloat(getValue(row, 'importeAbsTyuc', 'loss')),
                        litersDescOperador: safeFloat(getValue(row, 'litersDescOperador', 'loss')),
                        importeDescOperador: safeFloat(getValue(row, 'importeDescOperador', 'loss')),
                        viajes: safeFloat(getValue(row, 'viajes', 'loss')) || 0
                    };
                }).filter(x => x !== null);
            };

            const yRows = parseRows(yucarroRows, 'Yucarro');
            const tRows = parseRows(t2020Rows, 'T2020');
            const cRows = parseRows(corporedRows, 'Corpored');
            dbLoss = [...yRows, ...tRows, ...cRows];
            sanitizeLossSelectedOptions();
            const cMidRows = cRows.filter(r => r.company === 'CR MID').length;
            const cLpzRows = cRows.filter(r => r.company === 'CR LPZ').length;
            safeSetText('lossCount', dbLoss.length);
            logStatus(`Faltante: ${dbLoss.length} registros consolidados (${yRows.length} YUC, ${tRows.length} T2020, ${cMidRows} CR MID, ${cLpzRows} CR LPZ).`, 'info');
            if (moduleState.currentTab === 'loss') runLossAnalysis();
        }

        function runLossAnalysis() {
            if (!Array.isArray(dbLoss) || dbLoss.length === 0) {
                safeSetText('lossCount', 0);
                safeSetText('lossKpiTransported', '0');
                safeSetText('lossKpiSiic', '0');
                safeSetText('lossKpiPct', '0.000%');
                safeSetText('lossKpiDescPemex', '0');
                safeSetText('lossKpiDescOper', '0');
                safeSetText('lossKpiImporte', '$0');
                const routesBody = document.getElementById('lossRoutesBody');
                if (routesBody) routesBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-400">Sin datos</td></tr>';
                updateLossCompanyButtons();
                updateLossLitersModeButtons();
                return;
            }

            const data = currentLossCompanyFilter === 'ALL'
                ? dbLoss.slice()
                : dbLoss.filter(r => r.company === currentLossCompanyFilter);
            const selectedTUSet = new Set(currentLossSelectedTU);
            const selectedOpSet = new Set(currentLossSelectedOperator);
            const filteredData = data.filter(r => {
                const tuOk = selectedTUSet.size > 0
                    ? selectedTUSet.has(r.tractor) || selectedTUSet.has(r.unit)
                    : (!currentLossSearchTU || r.tractor.includes(currentLossSearchTU) || r.unit.includes(currentLossSearchTU));
                const opOk = selectedOpSet.size > 0
                    ? selectedOpSet.has(r.operator)
                    : (!currentLossSearchOperator || r.operator.includes(currentLossSearchOperator));
                return tuOk && opOk;
            });
            const litersAsPct = currentLossLitersMode === 'PCT';

            const totalTransported = filteredData.reduce((s, r) => s + r.litersTransported, 0);
            const totalSiic = filteredData.reduce((s, r) => s + r.litersFaltSiic, 0);
            const totalDescPemex = filteredData.reduce((s, r) => s + r.litersDescPemex, 0);
            const totalDescOper = filteredData.reduce((s, r) => s + r.litersDescOperador, 0);
            const totalImporte = filteredData.reduce((s, r) => s + r.importeDescPemex + r.importeDescOperador, 0);
            const pctSiic = totalTransported > 0 ? (totalSiic / totalTransported) * 100 : 0;

            safeSetText('lossCount', filteredData.length);
            safeSetText('lossKpiTransported', totalTransported.toLocaleString('es-MX', { maximumFractionDigits: 0 }));
            safeSetText('lossKpiSiic', totalSiic.toLocaleString('es-MX', { maximumFractionDigits: 0 }));
            safeSetText('lossKpiPct', `${pctSiic.toFixed(3)}%`);
            safeSetText('lossKpiDescPemex', totalDescPemex.toLocaleString('es-MX', { maximumFractionDigits: 0 }));
            safeSetText('lossKpiDescOper', totalDescOper.toLocaleString('es-MX', { maximumFractionDigits: 0 }));
            safeSetText('lossKpiImporte', `$${totalImporte.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`);
            safeSetText('lossCompanyChartTitle', litersAsPct ? 'Comparativo por Empresa (% + Importe)' : 'Comparativo por Empresa (LTS + Importe)');
            safeSetText('lossMonthlyChartTitle', litersAsPct ? 'Tendencia Mensual % Faltante SIIC' : 'Tendencia Mensual LTS Faltante SIIC');
            safeSetText('lossLitersBreakdownTitle', litersAsPct ? 'Desglose de Litros (% sobre transportado)' : 'Desglose de Litros (Pemex / Absorción / Operador)');
            const lowRankLabel = currentLossLowRankBy === 'UNIDAD' ? 'Unidades' : 'Operadores';
            const topOrderLabel = currentLossTopOrder === 'MAYOR' ? 'Mayor' : 'Menor';
            safeSetText('lossOperatorChartTitle', `Top ${lowRankLabel} con ${topOrderLabel} LTS Faltante SIIC`);
            const lowRankEl = document.getElementById('lossLowRankBy');
            if (lowRankEl && lowRankEl.value !== currentLossLowRankBy) lowRankEl.value = currentLossLowRankBy;
            const topOrderEl = document.getElementById('lossTopOrder');
            if (topOrderEl && topOrderEl.value !== currentLossTopOrder) topOrderEl.value = currentLossTopOrder;

            const companyOrder = ['Yucarro', 'T2020', 'CR MID', 'CR LPZ'];
            const lossPrefixColors = isColorblind
                ? { DESC_PEMEX: '#009E73', ABS_TRANSP: '#F0E442', DESC_OPERADOR: '#D55E00' }
                : LOSS_PREFIX_COLORS;
            const companyColorblindMap = {
                Yucarro: '#0072B2',
                T2020: '#E69F00',
                'CR MID': '#009E73',
                'CR LPZ': '#CC79A7',
                Corpored: '#009E73',
                'La Paz': '#CC79A7'
            };
            const companyMeta = {
                Yucarro: { short: 'YUC', color: isColorblind ? companyColorblindMap.Yucarro : (COMPANY_COLORS['YUC'] || COMPANY_COLORS['YUCARRO'] || '#00B0F0') },
                T2020: { short: 'T2020', color: isColorblind ? companyColorblindMap.T2020 : (COMPANY_COLORS['T2020'] || '#4472C4') },
                'CR MID': { short: 'CR MID', color: isColorblind ? companyColorblindMap['CR MID'] : (COMPANY_COLORS['CR'] || COMPANY_COLORS['CORPORED'] || '#ED7D31') },
                'CR LPZ': { short: 'CR LPZ', color: isColorblind ? companyColorblindMap['CR LPZ'] : (COMPANY_COLORS['CR LPZ'] || COMPANY_COLORS['LA PAZ'] || '#DAA0FA') },
                Corpored: { short: 'CR', color: isColorblind ? companyColorblindMap.Corpored : (COMPANY_COLORS['CR'] || COMPANY_COLORS['CORPORED'] || '#ED7D31') },
                'La Paz': { short: 'CR LPZ', color: isColorblind ? companyColorblindMap['La Paz'] : (COMPANY_COLORS['CR LPZ'] || COMPANY_COLORS['LA PAZ'] || '#DAA0FA') }
            };
            const companyData = companyOrder
                .map(company => {
                    const rows = filteredData.filter(r => r.company === company);
                    const transported = rows.reduce((s, r) => s + r.litersTransported, 0);
                    const siic = rows.reduce((s, r) => s + r.litersFaltSiic, 0);
                    const importe = rows.reduce((s, r) => s + r.importeDescPemex + r.importeDescOperador, 0);
                    const meta = companyMeta[company] || { short: company, color: '#334155' };
                    return {
                        company,
                        short: meta.short,
                        color: meta.color,
                        transported,
                        siic,
                        pct: transported > 0 ? (siic / transported) * 100 : 0,
                        importe
                    };
                })
                .filter(x => currentLossCompanyFilter === 'ALL' ? true : x.company === currentLossCompanyFilter);

            initChart('lossCompanyChart', 'bar', {
                labels: companyData.map(x => x.short),
                datasets: [
                    {
                        type: 'bar',
                        label: litersAsPct ? '% Faltante SIIC' : 'LTS Faltante SIIC',
                        data: companyData.map(x => litersAsPct ? x.pct : x.siic),
                        backgroundColor: companyData.map(x => x.color),
                        yAxisID: 'y'
                    },
                    { type: 'line', label: 'Importe Desc. Total', data: companyData.map(x => x.importe), borderColor: isColorblind ? '#111827' : '#0f172a', pointBackgroundColor: '#ffffff', pointBorderColor: isColorblind ? '#111827' : '#0f172a', pointBorderWidth: 2, yAxisID: 'y1', tension: 0.25 }
                ]
            }, {
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: litersAsPct ? '% Faltante' : 'Litros' },
                        ticks: {
                            callback: (v) => litersAsPct
                                ? `${Number(v).toFixed(2)}%`
                                : Number(v).toLocaleString('es-MX')
                        }
                    },
                    y1: { type: 'linear', position: 'right', title: { display: true, text: 'Importe ($)' }, grid: { drawOnChartArea: false }, ticks: { callback: (v) => `$${Number(v).toLocaleString('es-MX')}` } }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
                                const raw = context.raw;
                                const value = raw && typeof raw === 'object' && raw !== null && raw.y !== undefined ? raw.y : raw;
                                if (context.dataset?.yAxisID === 'y1' || /importe/i.test(context.dataset?.label || '')) {
                                    return `${label}${formatCurrencyMX(value)}`;
                                }
                                if (litersAsPct) return `${label}${Number(value).toFixed(2)}%`;
                                return `${label}${Number(value).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
                            }
                        }
                    },
                    datalabels: { display: false }
                }
            });

            const trendCompanies = currentLossCompanyFilter === 'ALL' ? companyOrder : [currentLossCompanyFilter];
            const allMonthKeys = [...new Set(data.map(r => r.monthKey))].sort();
            const trendLabels = allMonthKeys.map(k => {
                const [y, m] = k.split('-').map(Number);
                return `${monthNamesFull[m - 1].substring(0,3)} ${String(y).substring(2)}`;
            });
            const trendDatasets = trendCompanies.map(company => {
                const monthMap = {};
                filteredData.filter(r => r.company === company).forEach(r => {
                    if (!monthMap[r.monthKey]) monthMap[r.monthKey] = { trans: 0, siic: 0 };
                    monthMap[r.monthKey].trans += r.litersTransported;
                    monthMap[r.monthKey].siic += r.litersFaltSiic;
                });
                return {
                    label: (companyMeta[company]?.short || company),
                    data: allMonthKeys.map(k => {
                        const obj = monthMap[k] || { trans: 0, siic: 0 };
                        if (!litersAsPct) return obj.siic;
                        return obj.trans > 0 ? (obj.siic / obj.trans) * 100 : 0;
                    }),
                    borderColor: companyMeta[company]?.color || '#334155',
                    backgroundColor: 'transparent',
                    tension: 0.25
                };
            });

            initChart('lossMonthlyChart', 'line', {
                labels: trendLabels,
                datasets: trendDatasets
            }, {
                scales: {
                    y: {
                        title: { display: true, text: litersAsPct ? '% Faltante SIIC' : 'LTS Faltante SIIC' },
                        ticks: {
                            callback: (v) => litersAsPct
                                ? `${Number(v).toFixed(2)}%`
                                : Number(v).toLocaleString('es-MX')
                        }
                    }
                },
                plugins: { datalabels: { display: false } }
            });

            const breakdownByCompany = companyOrder
                .map(company => {
                    const rows = filteredData.filter(r => r.company === company);
                    return {
                        company,
                        short: (companyMeta[company]?.short || company),
                        transported: rows.reduce((s, r) => s + r.litersTransported, 0),
                        litersDescPemex: rows.reduce((s, r) => s + r.litersDescPemex, 0),
                        litersAbsTyuc: rows.reduce((s, r) => s + r.litersAbsTyuc, 0),
                        litersDescOperador: rows.reduce((s, r) => s + r.litersDescOperador, 0),
                        importeDescPemex: rows.reduce((s, r) => s + r.importeDescPemex, 0),
                        importeAbsTyuc: rows.reduce((s, r) => s + r.importeAbsTyuc, 0),
                        importeDescOperador: rows.reduce((s, r) => s + r.importeDescOperador, 0)
                    };
                })
                .filter(x => currentLossCompanyFilter === 'ALL' ? true : x.company === currentLossCompanyFilter);

            const breakdownLabels = breakdownByCompany.map(x => x.short);
            const litersValue = (part, total) => {
                if (!litersAsPct) return part;
                if (total <= 0) return 0;
                return (part / total) * 100;
            };
            initChart('lossLitersBreakdownChart', 'bar', {
                labels: breakdownLabels,
                datasets: [
                    {
                        label: litersAsPct ? 'DESC PEMEX (%)' : 'LTS FALTANTE DESC PEMEX',
                        data: breakdownByCompany.map(x => litersValue(x.litersDescPemex, x.transported)),
                        backgroundColor: lossPrefixColors.DESC_PEMEX,
                        stack: 'lit'
                    },
                    {
                        label: litersAsPct ? 'ABS TRANSP. (%)' : 'LTS FALTANTE ABS TRANSP.',
                        data: breakdownByCompany.map(x => litersValue(x.litersAbsTyuc, x.transported)),
                        backgroundColor: lossPrefixColors.ABS_TRANSP,
                        stack: 'lit'
                    },
                    {
                        label: litersAsPct ? 'DESC OPERADOR (%)' : 'LTS FALTANTE DESC OPERADOR',
                        data: breakdownByCompany.map(x => litersValue(x.litersDescOperador, x.transported)),
                        backgroundColor: lossPrefixColors.DESC_OPERADOR,
                        stack: 'lit'
                    }
                ]
            }, {
                scales: {
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        title: { display: true, text: litersAsPct ? '% sobre transportado' : 'Litros' },
                        ticks: {
                            callback: (v) => litersAsPct
                                ? `${Number(v).toFixed(2)}%`
                                : Number(v).toLocaleString('es-MX')
                        }
                    }
                },
                plugins: { datalabels: { display: false } }
            });

            initChart('lossAmountBreakdownChart', 'bar', {
                labels: breakdownLabels,
                datasets: [
                    { label: 'IMPORTE FALTANTE DESC PEMEX', data: breakdownByCompany.map(x => x.importeDescPemex), backgroundColor: lossPrefixColors.DESC_PEMEX, stack: 'amt' },
                    { label: 'IMP. FALT ABS TRANSP.', data: breakdownByCompany.map(x => x.importeAbsTyuc), backgroundColor: lossPrefixColors.ABS_TRANSP, stack: 'amt' },
                    { label: 'IMPORTE FALTANTE DESC OPERADOR', data: breakdownByCompany.map(x => x.importeDescOperador), backgroundColor: lossPrefixColors.DESC_OPERADOR, stack: 'amt' }
                ]
            }, {
                scales: {
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        title: { display: true, text: 'Importe ($)' },
                        ticks: { callback: (v) => formatCurrencyMX(v) }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
                                return `${label}${formatCurrencyMX(context.raw)}`;
                            }
                        }
                    },
                    datalabels: { display: false }
                }
            });

            const monthAmountMap = {};
            filteredData.forEach(r => {
                if (!monthAmountMap[r.monthKey]) {
                    monthAmountMap[r.monthKey] = { pemex: 0, abs: 0, oper: 0 };
                }
                monthAmountMap[r.monthKey].pemex += r.importeDescPemex;
                monthAmountMap[r.monthKey].abs += r.importeAbsTyuc;
                monthAmountMap[r.monthKey].oper += r.importeDescOperador;
            });
            initChart('lossMonthlyAmountChart', 'bar', {
                labels: trendLabels,
                datasets: [
                    { label: 'Imp. Desc Pemex', data: allMonthKeys.map(k => (monthAmountMap[k]?.pemex || 0)), backgroundColor: lossPrefixColors.DESC_PEMEX, stack: 'mamt' },
                    { label: 'Imp. Abs Transp.', data: allMonthKeys.map(k => (monthAmountMap[k]?.abs || 0)), backgroundColor: lossPrefixColors.ABS_TRANSP, stack: 'mamt' },
                    { label: 'Imp. Desc Operador', data: allMonthKeys.map(k => (monthAmountMap[k]?.oper || 0)), backgroundColor: lossPrefixColors.DESC_OPERADOR, stack: 'mamt' }
                ]
            }, {
                scales: {
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        title: { display: true, text: 'Importe ($)' },
                        ticks: { callback: (v) => formatCurrencyMX(v) }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
                                return `${label}${formatCurrencyMX(context.raw)}`;
                            }
                        }
                    },
                    datalabels: { display: false }
                }
            });

            const opMap = {};
            filteredData.forEach(r => {
                const key = currentLossLowRankBy === 'UNIDAD'
                    ? (r.unit || 'SIN UNIDAD')
                    : (r.operator || 'SIN OPERADOR');
                if (!opMap[key]) opMap[key] = { siic: 0, transported: 0, trips: 0 };
                opMap[key].siic += r.litersFaltSiic;
                opMap[key].transported += r.litersTransported;
                opMap[key].trips += r.viajes > 0 ? r.viajes : 1;
            });
            const sortAsc = currentLossTopOrder === 'MENOR';
            const topOps = Object.entries(opMap)
                .map(([name, v]) => ({
                    name,
                    siic: v.siic,
                    pct: v.transported > 0 ? (v.siic / v.transported) * 100 : 0,
                    trips: v.trips,
                    avgPerTrip: v.trips > 0 ? (v.siic / v.trips) : 0
                }))
                .sort((a, b) => sortAsc ? (a.siic - b.siic) : (b.siic - a.siic))
                .slice(0, 10);

            initChart('lossOperatorChart', 'bar', {
                indexAxis: 'y',
                labels: topOps.map(x => x.name),
                datasets: [{
                    label: 'LTS Faltante SIIC',
                    data: topOps.map(x => x.siic),
                    backgroundColor: sortAsc
                        ? (isColorblind ? '#0072B2' : '#16a34a')
                        : (isColorblind ? '#D55E00' : '#dc2626'),
                    pcts: topOps.map(x => x.pct),
                    siicVals: topOps.map(x => x.siic),
                    tripsVals: topOps.map(x => x.trips),
                    avgVals: topOps.map(x => x.avgPerTrip)
                }]
            }, {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const lts = ctx.dataset.siicVals[ctx.dataIndex];
                                return `LTS Faltante: ${Number(lts).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
                            },
                            afterLabel: (ctx) => {
                                const pct = ctx.dataset.pcts[ctx.dataIndex];
                                const trips = ctx.dataset.tripsVals[ctx.dataIndex];
                                const avg = ctx.dataset.avgVals[ctx.dataIndex];
                                return [
                                    `Viajes: ${Number(trips).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`,
                                    `Promedio LTS/viaje: ${Number(avg).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`,
                                    `Porcentaje: ${Number(pct).toFixed(3)}%`
                                ];
                            }
                        }
                    },
                    datalabels: { color: '#ffffff', anchor: 'end', align: 'start', font: { weight: 'bold', size: 10 } }
                },
                scales: {
                    x: {
                        ticks: {
                            callback: (v) => Number(v).toLocaleString('es-MX')
                        }
                    }
                }
            });

            const routeMap = {};
            filteredData.forEach(r => {
                const key = `${r.origin} -> ${r.destination}`;
                if (!routeMap[key]) routeMap[key] = { count: 0, siic: 0, transported: 0 };
                routeMap[key].count += 1;
                routeMap[key].siic += r.litersFaltSiic;
                routeMap[key].transported += r.litersTransported;
            });
            const topRoutes = Object.entries(routeMap)
                .map(([route, v]) => ({ route, count: v.count, siic: v.siic, pct: v.transported > 0 ? (v.siic / v.transported) * 100 : 0 }))
                .sort((a, b) => b.siic - a.siic)
                .slice(0, 12);

            const routesBody = document.getElementById('lossRoutesBody');
            if (routesBody) {
                if (!topRoutes.length) {
                    routesBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-400">Sin datos</td></tr>';
                } else {
                    routesBody.innerHTML = topRoutes.map(r => `
                        <tr class="hover:bg-amber-50 border-b border-slate-100">
                            <td class="p-3 font-semibold text-slate-700">${escapeHtml(normalizeStr(r.route))}</td>
                            <td class="p-3 text-center text-slate-500">${r.count.toLocaleString('es-MX')}</td>
                            <td class="p-3 text-right font-mono text-red-600">${r.siic.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                            <td class="p-3 text-right font-mono text-amber-700">${r.pct.toFixed(3)}%</td>
                        </tr>
                    `).join('');
                }
            }
            updateLossCompanyButtons();
            updateLossLitersModeButtons();
        }

        // --- 5. RENDERERS & LOGIC ---
        function formatChartNumber(val) {
            if (val === null || val === undefined || val === '') return '-';
            if (typeof val !== 'number') return String(val);
            if (!isFinite(val)) return '-';
            if (Math.abs(val) >= 1000) return val.toLocaleString('es-MX', { maximumFractionDigits: 0 });
            if (Math.abs(val) >= 100) return val.toLocaleString('es-MX', { maximumFractionDigits: 1 });
            return val.toLocaleString('es-MX', { maximumFractionDigits: 2 });
        }

        function formatCurrencyMX(val) {
            const num = Number(val || 0);
            return `$${num.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
        }

        function initChart(id,type,cfg,extraOpts){ const ctx=document.getElementById(id); if(!ctx)return; if(charts[id])charts[id].destroy(); 
            const opts={
                responsive:true, maintainAspectRatio:false, resizeDelay:120, indexAxis:cfg.indexAxis||'x', onClick:cfg.onClick,
                interaction: { mode: type === 'line' ? 'index' : 'nearest', intersect: type === 'line' ? false : true },
                animation: { duration: 450, easing: 'easeOutCubic' },
                plugins:{
                    legend:{
                        display:type!=='bar'||cfg.scales?.x?.stacked,
                        labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 10 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
                                const raw = context.raw;
                                if (raw && typeof raw === 'object' && raw !== null && raw.y !== undefined) {
                                    return `${label}${formatChartNumber(raw.y)}`;
                                }
                                return `${label}${formatChartNumber(raw)}`;
                            }
                        }
                    },
                    annotation:cfg.annotation,
                    datalabels: {
                        color: type === 'doughnut' ? '#ffffff' : '#475569',
                        font: { weight: 'bold', size: 11 },
                        clamp: true,
                        display: (context) => {
                            if (window.innerWidth < 768) return false;
                            const len = context.chart?.data?.labels?.length || context.dataset?.data?.length || 0;
                            if (len > 18) return false;
                            const v = context.dataset?.data?.[context.dataIndex];
                            if (typeof v === 'number') return v !== 0;
                            return !!v;
                        },
                        formatter: (value, ctx) => {
                            if(ctx.chart.canvas.id === 'strategyChart') { return value.model ? value.model : ''; }
                            if(type === 'doughnut' && ctx.chart.canvas.id === 'providerChart') return value;
                            if(type === 'doughnut' && ctx.chart.canvas.id === 'scrapReasonChart') { let sum = 0; let dataArr = ctx.chart.data.datasets[0].data; dataArr.map(data => { sum += data; }); let percentage = (value*100 / sum).toFixed(1)+"%"; return percentage; }
                            if(cfg.scales?.x?.stacked) return value > 0 ? value : '';
                            if(ctx.chart.canvas.id === 'wasteChart') return '';
                            return '';
                        }
                    }
                },
                scales:cfg.scales||{}
            }; 
            if (cfg.plugins) { opts.plugins = { ...opts.plugins, ...cfg.plugins }; }
            
            if (extraOpts) { 
                const { plugins: extraPlugins, ...restOpts } = extraOpts;
                if (extraPlugins) { opts.plugins = { ...opts.plugins, ...extraPlugins }; }
                Object.assign(opts, restOpts); 
            }

            if (opts.scales?.x && !opts.scales.x.ticks) {
                opts.scales.x.ticks = { autoSkip: true, maxRotation: 45, minRotation: 0 };
            }
            if (opts.scales?.y && !opts.scales.y.ticks) {
                opts.scales.y.ticks = { callback: (value) => formatChartNumber(value) };
            }
            
            charts[id]=new Chart(ctx,{type:type,data:cfg,options:opts}); 
        }

        function renderDrillDownTable(modelName, segment) {
             const container = document.getElementById('drillDownContainer'); const tbody = document.getElementById('drillDownBody'); const title = document.getElementById('drillDownTitle'); if(!container || !tbody) return;
             
             const baseData = getFilteredPerformanceData(true);
             const allTires = baseData.filter(t => `${t.brand} ${t.model}` === modelName && t.type === segment);
             
             const rule = RANKING_RULES[segment];
             let validTires = allTires;
             
             if (rule) {
                 validTires = allTires.filter(tire => {
                    if (tire.km <= rule.minKm) return false;
                    // Check for infinite efficiency (div by zero)
                    if (!isFinite(tire.efficiency)) return false;
                    if (tire.efficiency <= rule.minEff || tire.efficiency >= rule.maxEff) return false;
                    return true;
                 });
             }

             const diff = allTires.length - validTires.length;
             let subText = `Total: ${validTires.length.toLocaleString('es-MX')} llantas`;
             if (diff > 0) {
                 subText += ` <span class="text-orange-500 font-normal ml-1">(${diff} ocultas por filtros)</span>`;
             }
             
             // Escape model name for display
             title.innerHTML = `<span class="font-bold">${escapeHtml(normalizeStr(modelName))}</span> (${escapeHtml(normalizeStr(segment))}) - ${subText}`; 
             
             tbody.innerHTML = '';
             
             if (validTires.length === 0) {
                 tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-400">Ninguna llanta de este modelo cumple con los criterios estrictos del segmento (${rule ? rule.label : 'Sin Reglas'}).</td></tr>`;
             } else {
                 validTires.forEach((t, index) => { 
                     tbody.innerHTML += `<tr class="hover:bg-indigo-50 border-b border-indigo-50"><td class="p-3 text-center text-slate-400 font-bold text-xs">${index + 1}</td><td class="p-3 text-center text-indigo-900 font-bold">${escapeHtml(normalizeStr(t.unit))}</td><td class="p-3 text-center">${escapeHtml(normalizeStr(t.folio))}</td><td class="p-3">${escapeHtml(normalizeStr(t.brand))}</td><td class="p-3">${escapeHtml(normalizeStr(t.model))}</td><td class="p-3 text-center font-mono">${t.mm}</td><td class="p-3 text-center font-mono">${t.km.toLocaleString('es-MX')}</td><td class="p-3 text-center font-mono text-blue-600">${t.efficiency.toLocaleString('es-MX', {maximumFractionDigits: 0})}</td><td class="p-3 text-right font-bold text-slate-800">$${t.cpk.toFixed(4)}</td></tr>`; 
                 });
             }
             container.classList.remove('hidden'); container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        function renderDynamicPerformanceCharts(stats) {
            const container = document.getElementById('dynamicChartsContainer'); 
            let htmlBuffer = '';
            const activeSegments = currentFilter === 'ALL' ? ['Delanteras', 'Tracción', 'Toda Posición'] : [currentFilter];
            const unclassifiedCount = stats.filter(s => s.type === 'Sin Clasificar').length;
            if (unclassifiedCount > 0 && currentFilter === 'ALL') {
                activeSegments.push('Sin Clasificar');
            }

            activeSegments.forEach(segment => {
                const chartId = `cpkChart${segment.replace(/\s/g, '')}`;
                const widthClass = 'lg:col-span-2'; 
                htmlBuffer += `<div class="${widthClass} bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"><h3 class="text-xs font-bold text-slate-500 uppercase mb-4">${segment}</h3><div class="h-64 w-full"><canvas id="${chartId}"></canvas></div><p class="text-[10px] text-center text-slate-400 mt-2 italic">Haz clic en una barra para ver detalle</p></div>`;
            });
            
            container.innerHTML = htmlBuffer;

            setTimeout(() => {
                activeSegments.forEach(segment => {
                    const chartId = `cpkChart${segment.replace(/\s/g, '')}`;
                    const segData = stats.filter(s => s.type === segment);
                    
                    segData.sort((a,b) => (b.avgKm||0) - (a.avgKm||0));

                    const avg = segData.reduce((acc, i) => acc + (i.avgCPK||0), 0) / (segData.length || 1);
                    const safeAvg = isNaN(avg) || !isFinite(avg) ? 0 : avg; 
                    const top = segData.slice(0, 10);
                    
                    const cGood = isColorblind ? '#56B4E9' : '#22c55e';
                    const cBad = isColorblind ? '#D55E00' : '#ef4444';
                    const cMid = isColorblind ? '#E69F00' : '#eab308';
                    const colors = top.map(i => i.avgCPK < (safeAvg*0.9) ? cGood : (i.avgCPK > (safeAvg*1.1) ? cBad : cMid)); 
                    const labels = top.map(s => s.isTrailer ? `${s.name} 🚛` : s.name);
                    
                    const annotationObj = {
                        annotations: {
                            avgLine: { type: 'line', yMin: safeAvg, yMax: safeAvg, borderColor: cBad, borderWidth: 2, borderDash: [5, 5], label: { content: `Prom: $${safeAvg.toFixed(2)}`, display: true, position: 'end', backgroundColor: 'rgba(239, 68, 68, 0.8)', color: 'white', font: { size: 10, weight: 'bold' } } }
                        }
                    };

                    initChart(chartId, 'bar', { 
                        labels: labels, 
                        datasets: [{ 
                            label: 'CPK ($)', 
                            data: top.map(s => s.avgCPK), 
                            backgroundColor: colors, 
                            borderRadius: 4,
                            avgKms: top.map(s => s.avgKm)
                        }],
                        annotation: annotationObj
                    }, {
                        plugins: { 
                            datalabels: { 
                                display: true, 
                                anchor: 'end', 
                                align: 'end',  
                                color: '#64748b', 
                                font: { size: 10, weight: 'bold' },
                                formatter: (value, ctx) => {
                                    if(ctx.dataset.avgKms && ctx.dataset.avgKms[ctx.dataIndex]) {
                                        const kms = ctx.dataset.avgKms[ctx.dataIndex];
                                        return (kms / 1000).toFixed(0) + 'k';
                                    }
                                    return '';
                                }
                            } 
                        }, 
                        onClick: (e, elements, chart) => { if (elements.length) { const idx = elements[0].index; const modelLabel = chart.data.labels[idx]; const modelName = modelLabel.replace(' 🚛', ''); renderDrillDownTable(modelName, segment); } } 
                    });
                });
            }, 100); 
        }

        function buildDesignCandidateKeys(value) {
            const base = normalizeDesignToken(value);
            if (!base) return [];
            const keys = new Set([base]);
            if (base.endsWith('S') && base.length > 3) keys.add(base.slice(0, -1));
            if (!base.endsWith('S')) keys.add(base + 'S');
            return Array.from(keys);
        }

        function renderCpkGoalSummaryDrillDown(summaryRow) {
            const container = document.getElementById('cpkGoalSummaryDrillContainer');
            const titleEl = document.getElementById('cpkGoalSummaryDrillTitle');
            const bodyEl = document.getElementById('cpkGoalSummaryDrillBody');
            if (!container || !titleEl || !bodyEl) return;

            const detailRows = Array.isArray(summaryRow && summaryRow.detailRows) ? summaryRow.detailRows : [];
            const list = [...detailRows].sort((a, b) => (Number(b.km) || 0) - (Number(a.km) || 0));

            const usedCount = list.length;
            const avgKm = summaryRow && summaryRow.kmAct ? summaryRow.kmAct : 0;
            const avgKpk = summaryRow && summaryRow.kpkAct ? summaryRow.kpkAct : 0;
            titleEl.innerText = `${normalizeStr(summaryRow.design)} | ${normalizeStr(summaryRow.brand)} | ${normalizeStr(summaryRow.tireTypeText)} | ${usedCount} llantas usadas | Km Prom: ${avgKm.toLocaleString('es-MX', { maximumFractionDigits: 0 })} | KPK: $${avgKpk.toFixed(4)}`;

            if (!list.length) {
                bodyEl.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-slate-400">Sin detalle disponible para este diseño.</td></tr>';
                container.classList.remove('hidden');
                return;
            }

            bodyEl.innerHTML = list.map((r, idx) => `
                <tr class="hover:bg-indigo-50">
                    <td class="p-3 text-center text-slate-400 font-bold text-xs">${idx + 1}</td>
                    <td class="p-3 text-center text-indigo-900 font-bold">${escapeHtml(normalizeStr(r.unit || '-'))}</td>
                    <td class="p-3 text-center">${escapeHtml(normalizeStr(r.folio || '-'))}</td>
                    <td class="p-3">${escapeHtml(normalizeStr(r.brand || '-'))}</td>
                    <td class="p-3 font-semibold text-slate-700">${escapeHtml(normalizeStr(r.model || '-'))}</td>
                    <td class="p-3 text-center">${escapeHtml(normalizeStr(r.type || '-'))}</td>
                    <td class="p-3 text-center font-mono">${(Number(r.km) || 0).toLocaleString('es-MX')}</td>
                    <td class="p-3 text-center font-mono text-blue-600">${(Number(r.efficiency) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                    <td class="p-3 text-right font-bold text-slate-800">$${(Number(r.cpk) || 0).toFixed(4)}</td>
                </tr>
            `).join('');

            container.classList.remove('hidden');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function renderCpkGoalSummary(activeRows) {
            const container = document.getElementById('cpkGoalSummaryContainer');
            const head = document.getElementById('cpkGoalSummaryHead');
            const body = document.getElementById('cpkGoalSummaryBody');
            const empty = document.getElementById('cpkGoalSummaryEmpty');
            const countEl = document.getElementById('cpkGoalSummaryCount');
            const kpiKmEl = document.getElementById('cpkGoalKpiMetaKm');
            const kpiKpkEl = document.getElementById('cpkGoalKpiMetaKpk');
            const kpiRiskEl = document.getElementById('cpkGoalKpiRiskHigh');
            const drillContainer = document.getElementById('cpkGoalSummaryDrillContainer');
            if (!container || !head || !body || !empty || !countEl || !kpiKmEl || !kpiKpkEl || !kpiRiskEl) return;

            if (currentPerformanceStatusFilter === 'CONCLUIDA') {
                container.classList.add('hidden');
                if (drillContainer) drillContainer.classList.add('hidden');
                return;
            }
            container.classList.remove('hidden');

            const rulesInfoEl = document.getElementById('cpkGoalSummaryRuleText');
            if (rulesInfoEl) {
                rulesInfoEl.innerText = 'Filtros aplicados: Se excluyen Delanteras. Tracción: Km > 280k (Top 30 por diseño). Toda Posición: Km > 300k (Top 30 por diseño).';
            }

            const validSegments = new Set(['Tracción', 'Toda Posición']);
            const rows = (Array.isArray(activeRows) ? activeRows : []).filter(r =>
                r.status === 'ACTIVA' &&
                validSegments.has(r.type)
            );

            const perfRowsByModel = {};
            const perfRowsByBrand = {};
            rows.forEach((r, idx) => {
                const keys = buildDesignCandidateKeys(r.model);
                const brandCandidates = buildGoalBrandCandidates(r.brand);
                keys.forEach(k => {
                    if (!perfRowsByModel[k]) perfRowsByModel[k] = new Set();
                    perfRowsByModel[k].add(idx);
                    brandCandidates.forEach(bk => {
                        const brandMapKey = `${bk}|${k}`;
                        if (!perfRowsByBrand[brandMapKey]) perfRowsByBrand[brandMapKey] = new Set();
                        perfRowsByBrand[brandMapKey].add(idx);
                    });
                });
            });

            const addSetValues = (target, source) => {
                if (!source || !(source instanceof Set)) return;
                source.forEach(v => target.add(v));
            };

            const findGoalRowIndexes = (goal) => {
                const keys = buildDesignCandidateKeys(goal.design);
                const brandCandidates = buildGoalBrandCandidates(goal.brand);
                const matchedIdx = new Set();

                if (brandCandidates.length > 0) {
                    brandCandidates.forEach(bk => {
                        keys.forEach(k => addSetValues(matchedIdx, perfRowsByBrand[`${bk}|${k}`]));
                    });
                }

                if (matchedIdx.size === 0) {
                    keys.forEach(k => addSetValues(matchedIdx, perfRowsByModel[k]));
                }

                if (matchedIdx.size === 0) {
                    const baseDesign = normalizeDesignToken(goal.design);
                    if (baseDesign.length >= 5) {
                        Object.entries(perfRowsByBrand).forEach(([mapKey, setVals]) => {
                            if (!setVals || !setVals.size) return;
                            const sepIdx = mapKey.indexOf('|');
                            if (sepIdx < 0) return;
                            const brandKey = mapKey.slice(0, sepIdx);
                            const modelKey = mapKey.slice(sepIdx + 1);
                            if (brandCandidates.length > 0 && !brandCandidates.includes(brandKey)) return;
                            const startsMatch = modelKey.startsWith(baseDesign) || baseDesign.startsWith(modelKey);
                            if (!startsMatch) return;
                            addSetValues(matchedIdx, setVals);
                        });
                    }
                }

                if (matchedIdx.size === 0) {
                    const baseDesign = normalizeDesignToken(goal.design);
                    if (baseDesign.length >= 5) {
                        Object.entries(perfRowsByModel).forEach(([modelKey, setVals]) => {
                            if (!setVals || !setVals.size) return;
                            const startsMatch = modelKey.startsWith(baseDesign) || baseDesign.startsWith(modelKey);
                            if (!startsMatch) return;
                            addSetValues(matchedIdx, setVals);
                        });
                    }
                }

                return Array.from(matchedIdx);
            };

            const summaryRows = (Array.isArray(dbCpkGoals) ? dbCpkGoals : [])
                .filter(goal => goal && goal.tireType !== 'DELANTERA')
                .map(goal => {
                    const rule = CPK_GOAL_SUMMARY_RULES[goal.tireType];
                    if (!rule) return null;

                    const selectedRows = findGoalRowIndexes(goal)
                        .map(idx => rows[idx])
                        .filter(r => r && r.type === rule.segment && (Number(r.km) || 0) > rule.minKm)
                        .sort((a, b) => (Number(b.km) || 0) - (Number(a.km) || 0))
                        .slice(0, rule.topN);

                    const agg = selectedRows.reduce((acc, r) => {
                        acc.sumKm += Number(r.km) || 0;
                        acc.sumCost += Number(r.cost) || 0;
                        acc.count += 1;
                        return acc;
                    }, { sumKm: 0, sumCost: 0, count: 0 });

                    const kmAct = agg.count > 0 ? (agg.sumKm / agg.count) : 0;
                    const kpkAct = agg.sumKm > 0 ? (agg.sumCost / agg.sumKm) : 0;
                    const kmDiffPct = goal.kmExpected > 0 ? ((kmAct - goal.kmExpected) / goal.kmExpected) * 100 : null;
                    const kpkDiffPct = goal.kpkExpected > 0 ? ((kpkAct - goal.kpkExpected) / goal.kpkExpected) * 100 : null;

                    return {
                        tireType: goal.tireType,
                        tireTypeLabel: goalTireTypeLabel(goal.tireType),
                        tireTypeText: goal.tireTypeText || goalTireTypeLabel(goal.tireType),
                        brand: goal.brand || '',
                        design: goal.design,
                        kmExpected: goal.kmExpected,
                        kmAct,
                        kmDiffPct,
                        kpkExpected: goal.kpkExpected,
                        kpkAct,
                        kpkDiffPct,
                        activeCount: agg.count,
                        detailRows: selectedRows
                    };
                })
                .filter(r => r && (r.kmExpected > 0 || r.kpkExpected > 0) && (r.activeCount || 0) > 0);

            const withMeta = summaryRows.map(r => {
                const kmGood = r.kmDiffPct != null && isFinite(r.kmDiffPct) && r.kmDiffPct >= 0;
                const kpkGood = r.kpkDiffPct != null && isFinite(r.kpkDiffPct) && r.kpkDiffPct <= 0;
                return { ...r, kmGood, kpkGood };
            });

            countEl.innerText = withMeta.length.toLocaleString('es-MX');
            if (!withMeta.length) {
                body.innerHTML = '';
                empty.classList.remove('hidden');
                kpiKmEl.innerText = '0/0 (0%)';
                kpiKpkEl.innerText = '0/0 (0%)';
                kpiRiskEl.innerText = '0';
                if (drillContainer) drillContainer.classList.add('hidden');
                return;
            }
            empty.classList.add('hidden');

            const fmtPct = (v) => (v == null || !isFinite(v)) ? '-' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
            const pctClass = (v, invertGood) => {
                if (v == null || !isFinite(v)) return 'text-slate-400';
                if (invertGood) return v <= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold';
                return v >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold';
            };

            const total = withMeta.length;
            const kmOnTarget = withMeta.filter(x => x.kmGood).length;
            const kpkOnTarget = withMeta.filter(x => x.kpkGood).length;
            const riskHigh = withMeta.filter(x => !x.kmGood && !x.kpkGood).length;
            const kmPct = total > 0 ? (kmOnTarget / total) * 100 : 0;
            const kpkPct = total > 0 ? (kpkOnTarget / total) * 100 : 0;
            kpiKmEl.innerText = `${kmOnTarget}/${total} (${kmPct.toFixed(0)}%)`;
            kpiKpkEl.innerText = `${kpkOnTarget}/${total} (${kpkPct.toFixed(0)}%)`;
            kpiRiskEl.innerText = riskHigh.toLocaleString('es-MX');

            head.innerHTML = `
                <tr>
                    <th class="p-2">Tipo de llanta</th>
                    <th class="p-2">Marca</th>
                    <th class="p-2">Diseño</th>
                    <th class="p-2 text-right">Km x Mm Esp.</th>
                    <th class="p-2 text-right">Km Prom. Act.</th>
                    <th class="p-2 text-right">Diferencia Km (%)</th>
                    <th class="p-2 text-right">$ x Km Esp.</th>
                    <th class="p-2 text-right">K P K Act.</th>
                    <th class="p-2 text-right">Diferencia $/Km (%)</th>
                    <th class="p-2 text-right">Activas</th>
                </tr>
            `;
            const sortedByName = [...withMeta].sort((a, b) => {
                const typeCmp = normalizeStr(a.tireTypeText).localeCompare(normalizeStr(b.tireTypeText), 'es', { sensitivity: 'base' });
                if (typeCmp !== 0) return typeCmp;
                const brandCmp = normalizeStr(a.brand).localeCompare(normalizeStr(b.brand), 'es', { sensitivity: 'base' });
                if (brandCmp !== 0) return brandCmp;
                return normalizeStr(a.design).localeCompare(normalizeStr(b.design), 'es', { sensitivity: 'base' });
            });
            body.innerHTML = sortedByName.map((r, idx) => `
                <tr class="hover:bg-slate-50 cursor-pointer transition" data-summary-row-idx="${idx}">
                    <td class="p-2 font-semibold text-slate-600">${escapeHtml(normalizeStr(r.tireTypeText))}</td>
                    <td class="p-2 font-semibold text-slate-600">${escapeHtml(normalizeStr(r.brand || '-'))}</td>
                    <td class="p-2 font-bold text-slate-700">${escapeHtml(normalizeStr(r.design))}</td>
                    <td class="p-2 text-right font-mono text-slate-600">${r.kmExpected > 0 ? r.kmExpected.toLocaleString('es-MX', { maximumFractionDigits: 0 }) : '-'}</td>
                    <td class="p-2 text-right font-mono text-indigo-700">${r.kmAct > 0 ? r.kmAct.toLocaleString('es-MX', { maximumFractionDigits: 0 }) : '-'}</td>
                    <td class="p-2 text-right font-mono ${pctClass(r.kmDiffPct, false)}">${fmtPct(r.kmDiffPct)}</td>
                    <td class="p-2 text-right font-mono text-slate-600">${r.kpkExpected > 0 ? '$' + r.kpkExpected.toFixed(4) : '-'}</td>
                    <td class="p-2 text-right font-mono text-indigo-700">${r.kpkAct > 0 ? '$' + r.kpkAct.toFixed(4) : '-'}</td>
                    <td class="p-2 text-right font-mono ${pctClass(r.kpkDiffPct, true)}">${fmtPct(r.kpkDiffPct)}</td>
                    <td class="p-2 text-right font-mono text-slate-700">${(r.activeCount || 0).toLocaleString('es-MX')}</td>
                </tr>
            `).join('');

            const clickableRows = body.querySelectorAll('tr[data-summary-row-idx]');
            clickableRows.forEach(rowEl => {
                rowEl.addEventListener('click', () => {
                    clickableRows.forEach(el => el.classList.remove('bg-indigo-50'));
                    rowEl.classList.add('bg-indigo-50');
                    const idx = Number(rowEl.getAttribute('data-summary-row-idx'));
                    const selected = sortedByName[idx];
                    if (!selected) return;
                    renderCpkGoalSummaryDrillDown(selected);
                });
            });
        }

        // --- 6. LOGIC & ANALYSIS FUNCTIONS ---
        function runCPKAnalysis() {
            let data = getFilteredPerformanceData(true);
            
            // --- NEW: UNIVERSE CALCS ---
            const totalTires = data.length;
            const brands = [...new Set(data.map(d => d.brand))];
            const models = [...new Set(data.map(d => d.model))];
            const totalKm = data.reduce((s, r) => s + r.km, 0);
            
            // KPI 1 - % Cobertura
            const rollingBase = 4999;
            const coveragePct = (totalTires / rollingBase) * 100;
            safeSetText('kpiTotalTires', totalTires.toLocaleString('es-MX'));
            safeSetText('kpiUnivPct', coveragePct.toFixed(1) + '%');

            safeSetText('kpiUnivBrands', brands.length);
            safeSetText('kpiUnivModels', models.length);
            safeSetText('kpiUnivKm', (totalKm / 1000000).toFixed(2) + 'M');

            // KPI CPK por Segmento
            const dataTraction = data.filter(d => d.type === 'Tracción');
            const sumCostTrac = dataTraction.reduce((acc, r) => acc + r.cost, 0);
            const sumKmTrac = dataTraction.reduce((acc, r) => acc + r.km, 0);
            const avgCpkTrac = sumKmTrac > 0 ? sumCostTrac / sumKmTrac : 0;
            safeSetText('kpiCpkTraction', '$' + avgCpkTrac.toFixed(4));

            const dataTP = data.filter(d => d.type === 'Toda Posición');
            const sumCostTP = dataTP.reduce((acc, r) => acc + r.cost, 0);
            const sumKmTP = dataTP.reduce((acc, r) => acc + r.km, 0);
            const avgCpkTP = sumKmTP > 0 ? sumCostTP / sumKmTP : 0;
            safeSetText('kpiCpkAllPos', '$' + avgCpkTP.toFixed(4));

            // --- NUEVOS KPIS SOLICITADOS ---

            // 1. Km/mm Promedio Global (Solo Tracción y Toda Posición)
            const globalEffData = data.filter(d => d.type === 'Tracción' || d.type === 'Toda Posición');
            const sumEffGlobal = globalEffData.reduce((acc, r) => acc + r.efficiency, 0);
            const avgEffGlobal = globalEffData.length > 0 ? sumEffGlobal / globalEffData.length : 0;
            safeSetText('kpiGlobalEff', avgEffGlobal.toLocaleString('es-MX', {maximumFractionDigits: 0}));

            // 2. Conteo de Unidades (ECO Nuevo) Únicas
            const uniqueUnits = new Set(data.map(d => d.unit));
            const countUnits = uniqueUnits.size;
            safeSetText('kpiUniqueUnits', countUnits.toLocaleString());

            // ELIMINADO: Lógica de Total Articulación

            // --- NEW: UNIVERSE CHART ---
            const brandCounts = {};
            data.forEach(r => {
                brandCounts[r.brand] = (brandCounts[r.brand] || 0) + 1;
            });
            
            const sortedBrands = Object.entries(brandCounts).sort((a,b) => b[1] - a[1]);
            // Limit to top 6 + Others
            const topBrands = sortedBrands.slice(0, 6);
            const otherBrands = sortedBrands.slice(6);
            const otherCount = otherBrands.reduce((s, b) => s + b[1], 0);
            
            if(otherCount > 0) topBrands.push(['OTRAS', otherCount]);
            
            const uLabels = topBrands.map(b => b[0]);
            const uData = topBrands.map(b => b[1]);
            const uColors = isColorblind ? 
                ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442', '#56B4E9', '#999999'] :
                uLabels.map((_, i) => FALLBACK_COLORS[i % FALLBACK_COLORS.length]);

            initChart('cpkUniverseChart', 'doughnut', {
                labels: uLabels,
                datasets: [{
                    data: uData,
                    backgroundColor: uColors,
                    borderWidth: 0,
                    // Store other brands data for tooltip
                    otherBrandsData: otherBrands
                }]
            }, {
                cutout: '60%',
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
                    datalabels: { color: 'white', font: { weight: 'bold', size: 10 }, formatter: (val, ctx) => {
                        let sum = 0;
                        let dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.map(data => { sum += data; });
                        let percentage = (val*100 / sum).toFixed(0)+"%";
                        return percentage;
                    }},
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                if (context[0].label === 'OTRAS') {
                                    const dataset = context[0].chart.data.datasets[0];
                                    const others = dataset.otherBrandsData;
                                    if (!others || others.length === 0) return [];
                                    
                                    const totalOther = others.reduce((a, b) => a + b[1], 0);
                                    // Show top 10 from others list
                                    const displayList = others.slice(0, 10).map(b => `• ${b[0]}: ${b[1]} (${(b[1]/totalOther*100).toFixed(0)}%)`);
                                    
                                    if (others.length > 10) {
                                        displayList.push(`... y ${others.length - 10} más.`);
                                    }
                                    return [' ', 'DESGLOSE OTRAS:', ...displayList];
                                }
                            }
                        }
                    }
                },
                onClick: (e, elements, chart) => {
                    if (elements.length) {
                        const idx = elements[0].index;
                        const brandName = chart.data.labels[idx];
                        
                        if(brandName === 'OTRAS') {
                            const dataset = chart.data.datasets[0];
                            const others = dataset.otherBrandsData;
                            showCPKOthersDrillDown(others);
                        } else {
                            showCPKBrandDrillDown(brandName);
                        }
                    }
                }
            });

            renderCpkGoalSummary(data);

            // --- EXISTING LOGIC ---
            const statsMap = {};
            data.forEach(r => {
                const key = `${r.brand}|${r.model}|${r.type}`;
                if (!statsMap[key]) statsMap[key] = { brand: r.brand, model: r.model, type: r.type, count: 0, sumKm: 0, sumCost: 0, sumEff: 0, sumOrigMm: 0, isTrailer: r.isTrailer };
                statsMap[key].count++;
                statsMap[key].sumKm += r.km;
                statsMap[key].sumCost += r.cost;
                statsMap[key].sumEff += r.efficiency;
                statsMap[key].sumOrigMm += r.originalMm; 
            });
            const stats = Object.values(statsMap).map(s => {
                const avgOrigMm = s.count > 0 ? s.sumOrigMm / s.count : 0;
                const avgEfficiency = s.count > 0 ? s.sumEff / s.count : 0;
                
                const usableDepth = Math.max(0, avgOrigMm - 3.5);

                const estimatedLife = avgEfficiency > 0 ? (avgEfficiency * usableDepth) : (s.sumKm / s.count);

                return {
                    name: `${s.brand} ${s.model}`,
                    type: s.type,
                    count: s.count,
                    avgKm: s.sumKm / s.count,
                    avgCPK: s.sumCost / s.sumKm,
                    efficiency: avgEfficiency,
                    estimatedLife: estimatedLife, 
                    isTrailer: s.isTrailer
                };
            });
            safeSetText('perfCount', data.length);
            renderDynamicPerformanceCharts(stats);
            
            // Pasar RAW DATA (data) para que el ranking pueda filtrar llanta por llanta
            renderEfficiencyRanking(data); 
        }

        // --- NEW HELPER: SHOW BRAND DRILL DOWN FOR CPK ---
        function showCPKBrandDrillDown(brand) {
            const container = document.getElementById('drillDownContainer'); 
            const tbody = document.getElementById('drillDownBody'); 
            const title = document.getElementById('drillDownTitle'); 
            const thead = document.getElementById('drillDownHead'); // GET THEAD
            
            if(!container || !tbody) return;
            
            // RESET HEADER FOR NORMAL TIRES
            if (thead) {
                thead.innerHTML = `<tr><th class="p-3 text-center">#</th><th class="p-3 text-center">1. ECO Nuevo</th><th class="p-3 text-center">2. Folio</th><th class="p-3">3. Marca</th><th class="p-3">4. Modelo</th><th class="p-3 text-center">5. MM Actual</th><th class="p-3 text-center">6. KM Rec.</th><th class="p-3 text-center">7. Km/mm</th><th class="p-3 text-right">8. CPK Indiv.</th></tr>`;
            }

            // USE FILTERED DATA (periodo + status del módulo CPK)
            let data = getFilteredPerformanceData(true);

            const validTires = data.filter(t => t.brand === brand);
            
            title.innerHTML = `<span class="font-bold text-indigo-700">MARCA: ${escapeHtml(normalizeStr(brand))}</span> - Detalle de ${validTires.length} llantas`;
            
            tbody.innerHTML = '';
            
            if (validTires.length === 0) {
                 tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-400">Sin registros.</td></tr>`;
            } else {
                 // Sort by KM descending
                 validTires.sort((a,b) => b.km - a.km);
                 
                 validTires.forEach((t, index) => { 
                     tbody.innerHTML += `<tr class="hover:bg-indigo-50 border-b border-indigo-50"><td class="p-3 text-center text-slate-400 font-bold text-xs">${index + 1}</td><td class="p-3 text-center text-indigo-900 font-bold">${escapeHtml(normalizeStr(t.unit))}</td><td class="p-3 text-center">${escapeHtml(normalizeStr(t.folio))}</td><td class="p-3 font-bold text-slate-600">${escapeHtml(normalizeStr(t.brand))}</td><td class="p-3">${escapeHtml(normalizeStr(t.model))}</td><td class="p-3 text-center font-mono">${t.mm}</td><td class="p-3 text-center font-mono">${t.km.toLocaleString('es-MX')}</td><td class="p-3 text-center font-mono text-blue-600">${t.efficiency.toLocaleString('es-MX', {maximumFractionDigits: 0})}</td><td class="p-3 text-right font-bold text-slate-800">$${t.cpk.toFixed(4)}</td></tr>`; 
                 });
            }
            container.classList.remove('hidden'); 
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // --- NEW HELPER: SHOW OTHERS DRILL DOWN FOR CPK ---
        function showCPKOthersDrillDown(othersList) {
            const container = document.getElementById('drillDownContainer'); 
            const tbody = document.getElementById('drillDownBody'); 
            const title = document.getElementById('drillDownTitle'); 
            const thead = document.getElementById('drillDownHead');
            
            if(!container || !tbody) return;

            // CHANGE HEADER FOR BRAND SUMMARY
            if (thead) {
                thead.innerHTML = `<tr><th class="p-3 text-center">#</th><th class="p-3">Marca</th><th class="p-3 text-center">Cantidad Llantas</th><th class="p-3 text-right">% Participación (Universo)</th></tr>`;
            }

            // Calculate total universe count from current filtered set (to show meaningful %)
            // Note: othersList is just [Brand, Count]. We need total to calc %.
            // We can approximate or recalc. Let's recalc sum of this list + top brands? 
            // Better to sum up all counts from othersList if we treat it as "part of others". 
            // Or use the total from runCPKAnalysis.
            // Let's just sum the othersList for now as base, or just show raw counts.
            // To be accurate, let's sum the counts in othersList.
            const totalOthers = othersList.reduce((acc, curr) => acc + curr[1], 0);

            title.innerHTML = `<span class="font-bold text-indigo-700">OTRAS MARCAS</span> - Desglose Agrupado (${othersList.length} marcas)`;
            
            tbody.innerHTML = '';
            
            if (!othersList || othersList.length === 0) {
                 tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Sin registros.</td></tr>`;
            } else {
                 othersList.forEach((item, index) => { 
                     const brand = item[0];
                     const count = item[1];
                     // Using totalOthers as base for %, or could be total fleet. Let's use totalOthers context.
                     const pct = (count / totalOthers * 100).toFixed(1);

                     tbody.innerHTML += `
                        <tr class="hover:bg-indigo-50 border-b border-indigo-50">
                            <td class="p-3 text-center text-slate-400 font-bold text-xs">${index + 1}</td>
                            <td class="p-3 font-bold text-indigo-900">${escapeHtml(normalizeStr(brand))}</td>
                            <td class="p-3 text-center font-mono font-bold text-slate-700">${count}</td>
                            <td class="p-3 text-right text-slate-500 text-xs">${pct}% (del grupo Otras)</td>
                        </tr>`; 
                 });
            }
            container.classList.remove('hidden'); 
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function renderEfficiencyRanking(rawData) {
            const container = document.getElementById('efficiencyRankingGrid');
            if (!container) return;
            container.innerHTML = '';

            const segments = ['Delanteras', 'Tracción', 'Toda Posición'];
            
            segments.forEach(seg => {
                const rule = RANKING_RULES[seg];

                // 1. Filtrar llanta por llanta (Raw Data)
                const validTires = rawData.filter(tire => {
                    if (tire.type !== seg) return false;
                    // Aplicar regla estricta
                    if (rule) {
                        if (tire.km <= rule.minKm) return false;
                        // Evitar divisiones por cero o infinitos
                        if (!isFinite(tire.efficiency)) return false;
                        if (tire.efficiency <= rule.minEff || tire.efficiency >= rule.maxEff) return false;
                    }
                    return true;
                });

                // 2. Agrupar por Modelo
                const modelMap = {};
                validTires.forEach(tire => {
                    const key = `${tire.brand} ${tire.model}`;
                    if(!modelMap[key]) {
                        modelMap[key] = { name: key, count: 0, sumEff: 0 };
                    }
                    modelMap[key].count++;
                    modelMap[key].sumEff += tire.efficiency;
                });

                // 3. Calcular Promedios y Ordenar
                const models = Object.values(modelMap).map(m => ({
                    name: m.name,
                    count: m.count,
                    efficiency: m.sumEff / m.count
                })).sort((a,b) => b.efficiency - a.efficiency).slice(0, 5); // Top 5
                
                let rows = '';
                if (models.length === 0) {
                    rows = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs italic">Sin datos. Criterio: ${escapeHtml(normalizeStr(rule ? rule.label : 'N/A'))}</td></tr>`;
                } else {
                    models.forEach((m, i) => {
                        let rankColor = i === 0 ? 'text-amber-500' : (i === 1 ? 'text-slate-400' : (i===2 ? 'text-amber-700' : 'text-slate-500'));
                        let rankIcon = i < 3 ? '<i class="fa-solid fa-trophy"></i>' : `<span class="font-bold text-[10px]">#${i+1}</span>`;
                        let bgClass = i === 0 ? 'bg-indigo-50' : '';
                        
                        const encodedName = encodeURIComponent(normalizeStr(m.name));
                        const encodedSeg = encodeURIComponent(normalizeStr(seg));
                        const safeName = escapeHtml(normalizeStr(m.name));

                        rows += `
                            <tr data-model="${encodedName}" data-segment="${encodedSeg}" class="js-drill-row cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-100 transition ${bgClass}">
                                <!-- COL 1: CONTEO (NUEVO) -->
                                <td class="py-2 pl-3 text-center w-14 border-r border-slate-100">
                                    <div class="font-mono font-bold text-slate-600 text-sm">${m.count.toLocaleString('es-MX')}</div>
                                    <div class="text-[8px] text-slate-400 uppercase leading-none">Llantas</div>
                                </td>
                                <!-- COL 2: RANK -->
                                <td class="py-2 pl-2 text-center ${rankColor} w-8 text-sm">${rankIcon}</td>
                                <!-- COL 3: MODELO -->
                                <td class="py-2 px-2">
                                    <div class="font-bold text-slate-700 text-xs truncate" title="${safeName}">${safeName}</div>
                                </td>
                                <!-- COL 4: EFICIENCIA -->
                                <td class="py-2 pr-3 text-right">
                                    <div class="font-mono font-bold text-indigo-600 text-sm">${m.efficiency.toLocaleString('es-MX', {maximumFractionDigits: 0})}</div>
                                    <div class="text-[9px] text-slate-400">km/mm</div>
                                </td>
                            </tr>
                        `;
                    });
                }

                container.innerHTML += `
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                        <div class="bg-slate-50 border-b border-slate-100 p-3 text-center">
                            <h4 class="font-bold text-slate-600 text-xs uppercase tracking-wide">${escapeHtml(normalizeStr(seg))}</h4>
                            ${rule ? `<p class="text-[10px] text-indigo-700 mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded-full border border-indigo-200 font-semibold shadow-sm">Filtro: ${escapeHtml(normalizeStr(rule.label))}</p>` : ''}
                        </div>
                        <div class="overflow-y-auto max-h-64 scrollbar-thin flex-grow">
                            <table class="w-full">
                                <tbody class="divide-y divide-slate-50">
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            container.querySelectorAll('.js-drill-row').forEach((row) => {
                row.addEventListener('click', () => {
                    const model = decodeURIComponent(row.dataset.model || '');
                    const segment = decodeURIComponent(row.dataset.segment || '');
                    renderDrillDownTable(model, segment);
                });
            });
        }

        function runScrapAnalysis() {
            let data = dbScrap;
            let creditData = dbScrapCredits;
            const periods = moduleState.scrap.periods;

            if (periods.length > 0) {
                const byPeriod = (d) => {
                    const date = parseFlexibleDate(d.date);
                    if (!date) return false;
                    const key = `${date.getFullYear()}-${date.getMonth()}`;
                    return periods.includes(key);
                };
                data = data.filter(byPeriod);
                creditData = creditData.filter(byPeriod);
            }

            const total = data.length;
            const wastedMm = data.reduce((a, b) => a + Math.max(0, (b.mm || 0) - 3), 0);
            const wastedMoney = wastedMm * 400;

            const provs = {};
            const reasons = {};
            const brandWaste = {};
            const brandCount = {};
            const exitDates = [];

            const creditByProvider = {};
            const creditByLegalName = {};
            const creditByDescription = {};
            const creditTotalMoney = creditData.reduce((a, b) => a + (b.amount || 0), 0);
            const creditTotalQty = creditData.reduce((a, b) => a + (b.qty || 0), 0);

            const today = new Date();
            const trendKeys = [];
            const trendLabels = [];
            const trendMap = {};
            let trendTotalCount = 0;

            for (let i = 12; i >= 1; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const y = d.getFullYear();
                const m = d.getMonth();
                trendKeys.push(`${y}-${m}`);
                trendLabels.push(`${monthNamesFull[m].substring(0, 3)} ${y.toString().substr(2)}`);
            }

            dbScrap.forEach(r => {
                const d = parseFlexibleDate(r.date);
                if (!d) return;
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const idx = trendKeys.indexOf(key);
                if (idx === -1) return;
                const p = r.provider || 'Recolección Pend.';
                if (!trendMap[p]) trendMap[p] = new Array(12).fill(0);
                trendMap[p][idx]++;
                trendTotalCount++;
            });

            const modelStats = {};
            data.forEach(r => {
                provs[r.provider] = (provs[r.provider] || 0) + 1;
                reasons[r.reason] = (reasons[r.reason] || 0) + 1;
                brandWaste[r.brand] = (brandWaste[r.brand] || 0) + Math.max(0, (r.mm || 0) - 3);
                brandCount[r.brand] = (brandCount[r.brand] || 0) + 1;
                const d = parseFlexibleDate(r.date);
                if (d) exitDates.push(d);

                const modelKey = `${r.brand} ${r.model}`;
                if (!modelStats[modelKey]) modelStats[modelKey] = { count: 0, causes: {} };
                modelStats[modelKey].count++;
                const reason = r.reason || 'Desconocida';
                modelStats[modelKey].causes[reason] = (modelStats[modelKey].causes[reason] || 0) + 1;
            });

            creditData.forEach(c => {
                const p = normalizeStr(c.provider) || 'Sin proveedor';
                const legal = normalizeStr(c.legalName) || 'Sin razón social';
                const desc = normalizeStr(c.description) || 'Sin descripción';
                creditByProvider[p] = (creditByProvider[p] || 0) + (c.amount || 0);
                creditByLegalName[legal] = (creditByLegalName[legal] || 0) + (c.amount || 0);
                creditByDescription[desc] = (creditByDescription[desc] || 0) + (c.amount || 0);
                const d = parseFlexibleDate(c.date);
                if (d) exitDates.push(d);
            });

            const modelArray = Object.keys(modelStats).map(key => {
                const item = modelStats[key];
                const sortedCauses = Object.entries(item.causes)
                    .map(([r, c]) => ({ reason: r, count: c }))
                    .sort((a, b) => b.count - a.count);
                return { name: key, count: item.count, topCauses: sortedCauses.slice(0, 2) };
            });
            const top5 = modelArray.sort((a, b) => b.count - a.count).slice(0, 5);
            const sortedReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
            const topReason = sortedReasons.length > 0 ? { name: sortedReasons[0][0], count: sortedReasons[0][1] } : null;

            const tbody = document.getElementById('topScrapModelsBody');
            if (tbody) {
                tbody.innerHTML = '';
                if (top5.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">No hay datos disponibles para el periodo seleccionado.</td></tr>';
                } else {
                    top5.forEach((m, i) => {
                        const rank = i + 1;
                        let medal = `<span class="font-bold text-slate-400">#${rank}</span>`;
                        if (rank === 1) medal = '🥇'; else if (rank === 2) medal = '🥈'; else if (rank === 3) medal = '🥉';
                        let causesHtml = '';
                        m.topCauses.forEach((c, idx) => {
                            const pct = m.count > 0 ? Math.round((c.count / m.count) * 100) : 0;
                            const colorClass = idx === 0 ? 'bg-orange-400' : 'bg-orange-200';
                            causesHtml += `<div class="mb-2 last:mb-0"><div class="flex justify-between items-center text-[10px] mb-0.5"><span class="font-semibold text-slate-700 truncate pr-2" title="${escapeHtml(normalizeStr(c.reason))}">${escapeHtml(normalizeStr(c.reason))}</span><span class="text-slate-500 whitespace-nowrap">${pct}% (${c.count.toLocaleString('es-MX')})</span></div><div class="w-full bg-slate-100 rounded-full h-1.5"><div class="${colorClass} h-1.5 rounded-full" style="width: ${pct}%"></div></div></div>`;
                        });
                        tbody.innerHTML += `<tr class="hover:bg-orange-50 transition border-b border-slate-50 last:border-0"><td class="p-3 text-center text-lg align-middle">${medal}</td><td class="p-3 font-bold text-slate-700 align-middle text-xs">${escapeHtml(normalizeStr(m.name))}</td><td class="p-3 text-center align-middle"><span class="font-mono text-base font-bold text-orange-600 bg-orange-50 rounded-lg px-2 py-1 border border-orange-100">${m.count.toLocaleString('es-MX')}</span></td><td class="p-3 align-middle w-1/3"><div class="flex flex-col">${causesHtml}</div></td></tr>`;
                    });
                }
            }

            renderScrapView({
                total,
                mm: wastedMm,
                money: wastedMoney,
                provs,
                reasons,
                brandWaste,
                brandCount,
                exitDates,
                topModel: top5.length > 0 ? top5[0] : null,
                topReason,
                trendLabels,
                trendMap,
                trendTotal: trendTotalCount,
                creditMoney: creditTotalMoney,
                creditQty: creditTotalQty,
                creditEvents: creditData.length,
                creditRows: creditData.slice(),
                creditByProvider,
                creditByLegalName,
                creditByDescription
            });

            // Estrategia integrada: reutilizamos el motor de match CPK vs Desecho
            // para mostrar el resumen ejecutivo dentro de este módulo.
            runStrategyAnalysis({ compactOnly: true, periodsOverride: periods });
        }

        function renderScrapView(s) {
            let monthsDiff = 1;
            let periodText = "Periodo no definido";

            if (s.exitDates.length > 0) {
                const dates = s.exitDates.sort((a, b) => a - b);
                const minDate = dates[0];
                const maxDate = dates[dates.length - 1];
                monthsDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth()) + 1;
                monthsDiff = Math.max(1, monthsDiff);
                const m1 = monthNamesFull[minDate.getMonth()].substring(0, 3);
                const y1 = minDate.getFullYear();
                const m2 = monthNamesFull[maxDate.getMonth()].substring(0, 3);
                const y2 = maxDate.getFullYear();
                periodText = `${m1} ${y1} - ${m2} ${y2} (${monthsDiff} meses)`;
            }

            const avgMonthlyMm = s.mm / monthsDiff;
            const avgMonthlyMoney = s.money / monthsDiff;
            const avgMonthlyQty = s.total / monthsDiff;
            const avgMonthlyCredit = s.creditMoney / monthsDiff;
            const avgMonthlyNetLoss = avgMonthlyMoney - avgMonthlyCredit;
            const coveragePct = s.money > 0 ? (s.creditMoney / s.money) * 100 : 0;

            safeSetText('scrapTotalCount', s.total);
            safeSetText('scrapTotalPeriod', periodText);
            safeSetText('monthlyRetireCount', s.trendTotal);
            safeSetText('scrapWastedMm', avgMonthlyMm.toFixed(1) + ' mm/mes');
            safeSetText('scrapWastedMoney', 'Est. $' + avgMonthlyMoney.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' /mes');
            safeSetText('monthlyScrapRate', avgMonthlyQty.toFixed(1));
            safeSetText('scrapCreditMoney', '$' + avgMonthlyCredit.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' /mes');
            safeSetText('scrapCreditCount', `${(s.creditEvents || 0).toLocaleString('es-MX')} eventos | ${(s.creditQty || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 })} pzas`);
            safeSetText('scrapCreditCoverage', coveragePct.toFixed(2) + '%');
            safeSetText('scrapNetLossMoney', `${avgMonthlyNetLoss < 0 ? '-' : ''}$${Math.abs(avgMonthlyNetLoss).toLocaleString('es-MX', { maximumFractionDigits: 0 })} /mes`);
            safeSetText('creditLegalTotalAmount', '$' + (s.creditMoney || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }));
            const providerTotalsEl = document.getElementById('creditProviderTotals');
            if (providerTotalsEl) {
                const providerEntries = Object.entries(s.creditByProvider || {})
                    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
                if (!providerEntries.length) {
                    providerTotalsEl.innerHTML = '<span class="text-slate-400">Sin ingresos por proveedor.</span>';
                } else {
                    const badgeList = providerEntries.map(([provider, amount], idx) => {
                        const color = isColorblind
                            ? ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442'][idx % 5]
                            : (PROVIDER_COLORS[provider] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]);
                        const money = '$' + (Number(amount) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
                        return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700"><span class="inline-block w-2 h-2 rounded-full" style="background:${color}"></span><span class="font-semibold">${escapeHtml(provider)}</span><span class="font-mono">${money}</span></span>`;
                    });
                    providerTotalsEl.innerHTML = badgeList.join('');
                }
            }

            const rollingTiresBase = 4999;
            const pctRolling = (avgMonthlyQty / rollingTiresBase) * 100;
            safeSetText('scrapRollingPct', pctRolling.toFixed(2) + '%');

            if (s.topModel) {
                const tmEl = document.getElementById('scrapTopModel');
                if (tmEl) { tmEl.innerText = s.topModel.name; tmEl.title = s.topModel.name; }
                safeSetText('scrapTopModelCount', s.topModel.count);
            } else { safeSetText('scrapTopModel', '-'); safeSetText('scrapTopModelCount', '0'); }

            if (s.topReason) {
                const trEl = document.getElementById('scrapTopReason');
                if (trEl) { trEl.innerText = s.topReason.name; trEl.title = s.topReason.name; }
                safeSetText('scrapTopReasonCount', s.topReason.count);
            } else { safeSetText('scrapTopReason', '-'); safeSetText('scrapTopReasonCount', '0'); }

            const provLabels = Object.keys(s.provs);
            const pColors = provLabels.map((prov, i) => {
                if (isColorblind) return ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442'][i % 5];
                return PROVIDER_COLORS[prov] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
            });
            initChart('providerChart', 'doughnut', { labels: provLabels, datasets: [{ data: Object.values(s.provs), backgroundColor: pColors }] }, {});

            const reasonsSorted = Object.entries(s.reasons).sort((a, b) => b[1] - a[1]);
            const topReasons = reasonsSorted.slice(0, 5);
            const otherReasons = reasonsSorted.slice(5);
            const otherCount = otherReasons.reduce((acc, curr) => acc + curr[1], 0);
            if (otherCount > 0) topReasons.push(['Otros', otherCount]);
            const reasLabels = topReasons.map(r => r[0]);
            const reasData = topReasons.map(r => r[1]);
            const rColors = isColorblind
                ? ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442', '#56B4E9']
                : reasLabels.map((_, i) => FALLBACK_COLORS[i % FALLBACK_COLORS.length]);
            initChart('scrapReasonChart', 'doughnut', { labels: reasLabels, datasets: [{ data: reasData, backgroundColor: rColors }] }, {
                onClick: (e, elements, chart) => {
                    if (!elements.length) return;
                    const idx = elements[0].index;
                    const label = chart.data.labels[idx];
                    if (label === 'Otros' && otherReasons.length > 0) showScrapDrillDown(otherReasons, s.total);
                }
            });

            const brandLabels = Object.keys(s.brandWaste);
            const wasteValues = Object.values(s.brandWaste);
            const countValues = brandLabels.map(b => (s.brandCount && s.brandCount[b]) ? s.brandCount[b] : 0);
            const wasteColor = isColorblind ? '#D55E00' : '#ef4444';
            initChart('wasteChart', 'bar', { labels: brandLabels, datasets: [{ label: 'Desperdicio (mm)', data: wasteValues, backgroundColor: wasteColor, counts: countValues }] }, {
                indexAxis: 'y',
                onClick: (e, elements, chart) => {
                    if (!elements.length) return;
                    const idx = elements[0].index;
                    const brand = chart.data.labels[idx];
                    window.showScrapBrandDetail(brand);
                },
                onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; },
                plugins: {
                    datalabels: {
                        color: '#ffffff',
                        anchor: 'end',
                        align: 'start',
                        font: { weight: 'bold', size: 10 },
                        formatter: (value, ctx) => {
                            if (value > 1000) {
                                const count = ctx.dataset.counts[ctx.dataIndex];
                                return `${count} llantas`;
                            }
                            return '';
                        }
                    }
                }
            });

            const trendProviders = Object.keys(s.trendMap);
            const datasets = trendProviders.map((prov, i) => {
                const color = isColorblind
                    ? ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442'][i % 5]
                    : (PROVIDER_COLORS[prov] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]);
                return { label: prov, data: s.trendMap[prov], backgroundColor: color, stack: 'S1' };
            });
            initChart('monthlyRetireChart', 'bar', {
                labels: s.trendLabels,
                datasets,
                scales: { x: { stacked: true }, y: { stacked: true } }
            });

            const legalEntries = Object.entries(s.creditByLegalName || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
            const legalLabels = legalEntries.length ? legalEntries.map(x => x[0]) : ['Sin datos'];
            const creditRows = Array.isArray(s.creditRows) ? s.creditRows : [];
            const resolveLegalColor = (name, idx) => {
                const n = normalizeStr(name).toUpperCase();
                if (n.includes('LA PAZ') || n.includes('LPZ')) return COMPANY_COLORS['CR LPZ'] || COMPANY_COLORS['LA PAZ'] || '#DAA0FA';
                if (n.includes('CORPORED') || n === 'CR' || n.startsWith('CR ')) return COMPANY_COLORS['CR'] || COMPANY_COLORS['CORPORED'] || '#ED7D31';
                if (n.includes('T2020')) return COMPANY_COLORS['T2020'] || '#4472C4';
                if (n.includes('YUC')) return COMPANY_COLORS['YUC'] || COMPANY_COLORS['YUCARRO'] || '#00B0F0';
                if (COMPANY_COLORS[n]) return COMPANY_COLORS[n];
                return PALETTE_FALLBACK[idx % PALETTE_FALLBACK.length];
            };
            const legalProviderMap = {};
            creditRows.forEach(r => {
                const legal = normalizeStr(r.legalName) || 'Sin razón social';
                const provider = normalizeStr(r.provider) || 'Sin proveedor';
                const amount = Number(r.amount) || 0;
                if (!legalProviderMap[legal]) legalProviderMap[legal] = {};
                legalProviderMap[legal][provider] = (legalProviderMap[legal][provider] || 0) + amount;
            });
            const providerTotals = {};
            Object.values(legalProviderMap).forEach(byProv => {
                Object.entries(byProv).forEach(([prov, val]) => {
                    providerTotals[prov] = (providerTotals[prov] || 0) + (Number(val) || 0);
                });
            });
            const providerList = Object.entries(providerTotals)
                .sort((a, b) => b[1] - a[1])
                .map(x => x[0]);
            const providerPalette = isColorblind
                ? ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#F0E442', '#56B4E9', '#D55E00']
                : null;
            const stackedDatasets = providerList.map((provider, idx) => ({
                label: provider,
                data: legalLabels.map(legal => ((legalProviderMap[legal] && legalProviderMap[legal][provider]) || 0)),
                backgroundColor: isColorblind
                    ? providerPalette[idx % providerPalette.length]
                    : (PROVIDER_COLORS[provider] || resolveLegalColor(provider, idx)),
                borderRadius: 4,
                stack: 'legal-provider'
            }));
            if (!stackedDatasets.length) {
                stackedDatasets.push({
                    label: 'Sin proveedor',
                    data: legalLabels.map(() => 0),
                    backgroundColor: '#cbd5e1',
                    borderRadius: 4,
                    stack: 'legal-provider'
                });
            }
            const legalDrill = document.getElementById('creditLegalDrillDownContainer');
            if (legalDrill) legalDrill.classList.add('hidden');
            initChart('creditProviderChart', 'bar', {
                labels: legalLabels,
                datasets: stackedDatasets,
                indexAxis: 'y',
                scales: { x: { beginAtZero: true, stacked: true }, y: { stacked: true } }
            }, {
                onClick: (e, elements, chart) => {
                    if (!elements || !elements.length) return;
                    const idx = elements[0].index;
                    const dsIdx = elements[0].datasetIndex;
                    const label = chart.data.labels[idx];
                    const provider = chart.data.datasets[dsIdx] ? chart.data.datasets[dsIdx].label : '';
                    if (!label || label === 'Sin datos') return;
                    showCreditLegalDrillDown(label, creditRows, provider);
                },
                onHover: (event, elements) => {
                    if (event && event.native && event.native.target) {
                        event.native.target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
                    }
                },
                plugins: {
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyMX(context.raw)}` } },
                    datalabels: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, stacked: true, ticks: { callback: (value) => formatCurrencyMX(value) } },
                    y: {
                        stacked: true,
                        ticks: {
                            autoSkip: false,
                            callback: function(value) {
                                return this.getLabelForValue ? this.getLabelForValue(value) : value;
                            }
                        }
                    }
                }
            });

            const descEntries = Object.entries(s.creditByDescription || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const descLabels = descEntries.length ? descEntries.map(x => x[0]) : ['Sin datos'];
            const descValues = descEntries.length ? descEntries.map(x => x[1]) : [0];
            initChart('creditDescriptionChart', 'bar', {
                labels: descLabels,
                datasets: [{ label: 'Reembolso', data: descValues, backgroundColor: '#14b8a6' }],
                indexAxis: 'y',
                scales: { x: { beginAtZero: true } }
            }, {
                plugins: {
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrencyMX(context.raw)}` } },
                    datalabels: { display: false }
                },
                scales: { x: { beginAtZero: true, ticks: { callback: (value) => formatCurrencyMX(value) } } }
            });
        }

        function runStrategyAnalysis(options = {}) {
            try {
                // 1. Filtrar Datos según selección de periodo (igual que otros módulos)
                let localPerf = dbPerformance;
                let localScrap = dbScrap;
                const periods = Array.isArray(options.periodsOverride) ? options.periodsOverride : moduleState.strategy.periods;

                if (periods.length > 0) {
                    const filterFn = (d) => {
                        const date = parseFlexibleDate(d.date);
                        if(!date) return false;
                        const key = `${date.getFullYear()}-${date.getMonth()}`;
                        return periods.includes(key);
                    };
                    localPerf = dbPerformance.filter(filterFn);
                    localScrap = dbScrap.filter(filterFn);
                }

                // 2. Normalización para mejorar el match CPK vs Desecho
                // Compactamos tokens para absorber variaciones comunes:
                // ST244 == ST-244 == ST 244 y BF GOODRICH == BFGOODRICH.
                const normalizeToken = (v) => normalizeStr(v)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                const compactToken = (v) => normalizeToken(v).replace(/\s+/g, '');
                const brandAliases = {
                    BFG: 'BFGOODRICH',
                    BFGOODRICH: 'BFGOODRICH'
                };
                const normalizeBrandKey = (brand) => {
                    const b = compactToken(brand);
                    return brandAliases[b] || b;
                };
                const normalizeModelKey = (model) => compactToken(model);
                const buildModelKey = (brand, model) => `${normalizeBrandKey(brand)}|${normalizeModelKey(model)}`;
                const parseModelKey = (k) => {
                    const idx = k.indexOf('|');
                    if (idx < 0) return { brand: '', model: k || '' };
                    return { brand: k.slice(0, idx), model: k.slice(idx + 1) };
                };
                const oneEditDistanceLeq1 = (a, b) => {
                    if (a === b) return true;
                    const la = a.length, lb = b.length;
                    if (Math.abs(la - lb) > 1) return false;
                    let i = 0, j = 0, edits = 0;
                    while (i < la && j < lb) {
                        if (a[i] === b[j]) { i++; j++; continue; }
                        edits++;
                        if (edits > 1) return false;
                        if (la > lb) i++;
                        else if (lb > la) j++;
                        else { i++; j++; }
                    }
                    if (i < la || j < lb) edits++;
                    return edits <= 1;
                };
                const buildModelVariants = (model) => {
                    const m = normalizeModelKey(model);
                    const out = new Set([m]);
                    // Caso común: singular/plural (ROUTECONTROL / ROUTECONTROLS)
                    if (m.length > 3 && m.endsWith('S')) out.add(m.slice(0, -1));
                    if (m.length > 2 && !m.endsWith('S')) out.add(`${m}S`);
                    return [...out];
                };
                const buildCandidateKeys = (brand, model) => {
                    const b = normalizeBrandKey(brand);
                    return buildModelVariants(model).map(m => `${b}|${m}`);
                };
                const displayModel = (brand, model) => `${normalizeStr(brand).toUpperCase()} ${normalizeStr(model).toUpperCase()}`.trim();

                // 3. Performance (CPK + km/mm)
                const cpkMap = {};
                const modelLabelMap = {};
                const cpkAliasToCanonical = {};
                const brandModelIndex = {};
                const cpkRowCountMap = {};
                let totalCost = 0, totalKm = 0;

                localPerf.forEach(r => {
                    const k = buildModelKey(r.brand, r.model);
                    const p = parseModelKey(k);
                    if(!cpkMap[k]) cpkMap[k] = { cost: 0, km: 0, sumEff: 0, effCount: 0, typeVotes: {}, name: displayModel(r.brand, r.model) };
                    cpkMap[k].cost += r.cost;
                    cpkMap[k].km += r.km;
                    if (r.efficiency > 0 && isFinite(r.efficiency)) {
                        cpkMap[k].sumEff += r.efficiency; // km/mm
                        cpkMap[k].effCount++;
                    }
                    const t = r.type || 'Sin Clasificar';
                    cpkMap[k].typeVotes[t] = (cpkMap[k].typeVotes[t] || 0) + 1;
                    modelLabelMap[k] = modelLabelMap[k] || cpkMap[k].name;
                    cpkRowCountMap[k] = (cpkRowCountMap[k] || 0) + 1;
                    buildCandidateKeys(r.brand, r.model).forEach(aliasKey => {
                        if (!(aliasKey in cpkAliasToCanonical)) cpkAliasToCanonical[aliasKey] = k;
                        else if (cpkAliasToCanonical[aliasKey] !== k) cpkAliasToCanonical[aliasKey] = null; // ambiguo
                    });
                    if (!brandModelIndex[p.brand]) brandModelIndex[p.brand] = [];
                    if (!brandModelIndex[p.brand].some(x => x.model === p.model && x.key === k)) {
                        brandModelIndex[p.brand].push({ model: p.model, key: k });
                    }

                    totalCost += r.cost;
                    totalKm += r.km;
                });

                const avgFleetCPK = totalKm > 0 ? totalCost / totalKm : 0;
                const targetCPK = avgFleetCPK * 0.95;

                // 4. Scrap (impacto + frecuencia)
                const wasteMap = {};
                const causeWaste = {};
                const modelCountMap = {};
                const scrapBrandModelIndex = {};
                const unmatchedScrapMap = {};
                const matchedCpkKeys = new Set();
                let totalWasteMM = 0;
                let totalScrapCount = 0;

                localScrap.forEach(r => {
                    const mm = Math.max(0, (r.mm || 0) - 3);
                    const rawKey = buildModelKey(r.brand, r.model);
                    const parsedRaw = parseModelKey(rawKey);
                    const rawDisplay = displayModel(r.brand, r.model);
                    let k = null;

                    if (!scrapBrandModelIndex[parsedRaw.brand]) scrapBrandModelIndex[parsedRaw.brand] = [];
                    if (!scrapBrandModelIndex[parsedRaw.brand].some(x => x.model === parsedRaw.model)) {
                        scrapBrandModelIndex[parsedRaw.brand].push({ model: parsedRaw.model, name: rawDisplay });
                    }

                    // Prioridad 1: match directo por candidatos (incluye singular/plural y alias de marca)
                    const candidates = buildCandidateKeys(r.brand, r.model);
                    for (const ck of candidates) {
                        const mapped = cpkAliasToCanonical[ck];
                        if (mapped && cpkMap[mapped]) { k = mapped; break; }
                    }
                    // Prioridad 2: match difuso controlado (1 carácter) dentro de la misma marca
                    if (!k && brandModelIndex[parsedRaw.brand] && parsedRaw.model.length >= 5) {
                        const near = brandModelIndex[parsedRaw.brand]
                            .filter(item => oneEditDistanceLeq1(parsedRaw.model, item.model));
                        if (near.length === 1) k = near[0].key; // evitar empates ambiguos
                    }
                    if (!k) k = rawKey;
                    const hasPerfMatch = !!(cpkMap[k] && cpkMap[k].km > 0);
                    if (hasPerfMatch) matchedCpkKeys.add(k);
                    else {
                        if (!unmatchedScrapMap[rawKey]) unmatchedScrapMap[rawKey] = {
                            key: rawKey,
                            name: rawDisplay,
                            count: 0,
                            brand: parsedRaw.brand,
                            model: parsedRaw.model
                        };
                        unmatchedScrapMap[rawKey].count++;
                    }

                    if(!wasteMap[k]) wasteMap[k] = { wasteMm: 0, count: 0 };
                    wasteMap[k].wasteMm += mm;
                    wasteMap[k].count++;

                    causeWaste[r.reason] = (causeWaste[r.reason] || 0) + mm;
                    modelCountMap[k] = (modelCountMap[k] || 0) + 1;
                    modelLabelMap[k] = modelLabelMap[k] || rawDisplay;

                    totalWasteMM += mm;
                    totalScrapCount++;
                });

                // 5. Cobertura de match
                const scrapKeys = Object.keys(modelCountMap);
                const matchedKeys = scrapKeys.filter(k => cpkMap[k] && cpkMap[k].km > 0);
                const matchedScrapCount = matchedKeys.reduce((acc, k) => acc + (modelCountMap[k] || 0), 0);
                const unmatchedScrapCount = Math.max(0, totalScrapCount - matchedScrapCount);
                const matchPct = totalScrapCount > 0 ? (matchedScrapCount / totalScrapCount) * 100 : 0;

                const suggestFromCpk = (brand, model) => {
                    const pool = brandModelIndex[brand] || [];
                    const near = pool.filter(item => oneEditDistanceLeq1(model, item.model));
                    if (near.length !== 1) return '';
                    const key = near[0].key;
                    return modelLabelMap[key] || cpkMap[key]?.name || '';
                };
                const suggestFromScrap = (brand, model) => {
                    const pool = scrapBrandModelIndex[brand] || [];
                    const near = pool.filter(item => oneEditDistanceLeq1(model, item.model));
                    if (near.length !== 1) return '';
                    return near[0].name || '';
                };

                const unmatchedScrapRows = Object.values(unmatchedScrapMap)
                    .map(x => ({ name: x.name, count: x.count, possibleMatch: suggestFromCpk(x.brand, x.model) }))
                    .sort((a,b) => b.count - a.count);

                const unmatchedCpkRows = Object.keys(cpkMap)
                    .filter(k => (cpkMap[k]?.km || 0) > 0 && !matchedCpkKeys.has(k))
                    .map(k => {
                        const p = parseModelKey(k);
                        return {
                            name: modelLabelMap[k] || cpkMap[k]?.name || k,
                            count: cpkRowCountMap[k] || 0,
                            possibleMatch: suggestFromScrap(p.brand, p.model)
                        };
                    })
                    .sort((a,b) => b.count - a.count);

                // 6. Construir modelos para matriz (solo modelos con match)
                const models = matchedKeys.map(k => {
                    const c = cpkMap[k];
                    const w = wasteMap[k] || { wasteMm: 0, count: 0 };
                    const avgCPK = c.km > 0 ? c.cost / c.km : 0;
                    const avgEff = c.effCount > 0 ? c.sumEff / c.effCount : 0; // km/mm
                    const wearMmPer10k = avgEff > 0 ? 10000 / avgEff : 0; // mm por 10k km (más alto = peor)
                    const avgWaste = w.count > 0 ? w.wasteMm / w.count : 0;
                    const topType = Object.entries(c.typeVotes).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Sin Clasificar';
                    return {
                        key: k,
                        name: modelLabelMap[k] || c.name,
                        type: topType,
                        avgCPK,
                        avgWastedMm: avgWaste,
                        wearMmPer10k,
                        scrapCount: w.count
                    };
                }).filter(m => m.avgCPK > 0);

                const minMax = (arr, getter) => {
                    if (!arr.length) return { min: 0, max: 0 };
                    const vals = arr.map(getter).filter(v => isFinite(v));
                    if (!vals.length) return { min: 0, max: 0 };
                    return { min: Math.min(...vals), max: Math.max(...vals) };
                };
                const norm = (v, mm) => (mm.max - mm.min) > 0 ? (v - mm.min) / (mm.max - mm.min) : 0.5;

                const mmCpk = minMax(models, m => m.avgCPK);
                const mmWear = minMax(models, m => m.wearMmPer10k);
                const mmScrap = minMax(models, m => m.scrapCount);
                const mmWaste = minMax(models, m => m.avgWastedMm);

                models.forEach(m => {
                    const nCpk = norm(m.avgCPK, mmCpk);
                    const nWear = norm(m.wearMmPer10k, mmWear);
                    const nScrap = norm(m.scrapCount, mmScrap);
                    const nWaste = norm(m.avgWastedMm, mmWaste);
                    m.priorityScore = (0.35 * nCpk + 0.35 * nWear + 0.20 * nScrap + 0.10 * nWaste) * 100;
                });
                models.sort((a,b) => b.priorityScore - a.priorityScore);
                const topRisk = models[0] || null;

                // 7. Enviar todo al renderizador
                renderStrategy({
                    models,
                    avgFleetCPK,
                    targetCPK,
                    cpkMap,
                    modelLabelMap,
                    causeWaste,
                    modelCountMap,
                    totalWasteMM,
                    totalScrapCount,
                    matchPct,
                    matchedModelCount: matchedKeys.length,
                    unmatchedScrapCount,
                    topRisk,
                    unmatchedScrapRows,
                    unmatchedCpkRows
                }, options);
            } catch (e) {
                console.error("Error running Strategy Analysis:", e);
                logStatus("Error en módulo Estrategia", "error");
            }
        }

        function renderStrategy(s, options = {}) { 
            if(!s) return;
            const strategyModels = Array.isArray(s.models) ? s.models : [];
            const compactOnly = !!options.compactOnly;
            
            // Actualizar KPIs de texto
            safeSetText('targetCPK', '$'+s.targetCPK.toFixed(4)); 
            safeSetText('currentAvgCPK', '$'+s.avgFleetCPK.toFixed(4)); 
            safeSetText('strategyMatchPct', `${s.matchPct.toFixed(1)}%`);
            safeSetText('strategyMatchModels', s.matchedModelCount || 0);
            safeSetText('strategyUnmatchedScrap', s.unmatchedScrapCount || 0);
            safeSetText('strategyTopRiskModel', s.topRisk ? s.topRisk.name : '-');
            safeSetText('strategyTopRiskScore', s.topRisk ? `Score ${s.topRisk.priorityScore.toFixed(1)}` : 'Score 0');
            safeSetText('scrapStrategyMatchPct', `${s.matchPct.toFixed(1)}%`);
            safeSetText('scrapStrategyMatchModels', s.matchedModelCount || 0);
            safeSetText('scrapStrategyUnmatchedScrap', s.unmatchedScrapCount || 0);
            safeSetText('scrapStrategyTopRiskModel', s.topRisk ? s.topRisk.name : '-');
            safeSetText('scrapStrategyTopRiskScore', s.topRisk ? `Score ${s.topRisk.priorityScore.toFixed(1)}` : 'Score 0');

            const renderMismatchTable = (rows, bodyId, emptyId) => {
                const body = document.getElementById(bodyId);
                const empty = document.getElementById(emptyId);
                if (!body || !empty) return;
                const safeRows = Array.isArray(rows) ? rows : [];
                if (!safeRows.length) {
                    body.innerHTML = '';
                    empty.classList.remove('hidden');
                    return;
                }
                empty.classList.add('hidden');
                body.innerHTML = safeRows.slice(0, 25).map(row => `
                    <tr>
                        <td class="p-2 text-slate-700">${escapeHtml(normalizeStr(row.name || '-'))}</td>
                        <td class="p-2 text-center text-slate-500 font-mono">${(row.count || 0).toLocaleString('es-MX')}</td>
                        <td class="p-2 text-indigo-700">${row.possibleMatch ? escapeHtml(normalizeStr(row.possibleMatch)) : '<span class="text-slate-300">-</span>'}</td>
                    </tr>
                `).join('');
            };
            renderMismatchTable(s.unmatchedScrapRows, 'strategyUnmatchedScrapBody', 'strategyUnmatchedScrapEmpty');
            renderMismatchTable(s.unmatchedCpkRows, 'strategyUnmatchedCpkBody', 'strategyUnmatchedCpkEmpty');
            renderMismatchTable(s.unmatchedScrapRows, 'scrapStrategyUnmatchedScrapBody', 'scrapStrategyUnmatchedScrapEmpty');
            renderMismatchTable(s.unmatchedCpkRows, 'scrapStrategyUnmatchedCpkBody', 'scrapStrategyUnmatchedCpkEmpty');

            const sortedModels = Object.entries(s.modelCountMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
            const modelLabels = sortedModels.map(x => s.modelLabelMap[x[0]] || x[0]);
            const modelCounts = sortedModels.map(x => x[1]);
            const modelCpkData = sortedModels.map(x => {
                const modelKey = x[0];
                const perfData = s.cpkMap[modelKey];
                if (perfData && perfData.km > 0) return perfData.cost / perfData.km;
                return null;
            });
            const cModelLine = isColorblind ? '#0072B2' : '#3b82f6';
            const cModelBar = isColorblind ? '#D55E00' : '#6366f1';
            initChart('scrapStrategyParetoModelsChart', 'bar', {
                labels: modelLabels,
                datasets: [
                    { type: 'line', label: 'CPK Promedio ($)', data: modelCpkData, borderColor: cModelLine, yAxisID: 'y1', pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: cModelLine, pointBorderWidth: 2 },
                    { type: 'bar', label: 'Llantas Desechadas', data: modelCounts, backgroundColor: cModelBar, yAxisID: 'y', borderRadius: 4 }
                ]
            }, {
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Unidades' } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'CPK ($)' }, ticks: { callback: (v) => '$' + v.toFixed(3) }, beginAtZero: true }
                },
                plugins: {
                    datalabels: { display: ctx => ctx.dataset.type === 'bar', color: 'white', font: { size: 10, weight: 'bold' }, anchor: 'center', align: 'center' },
                    tooltip: {
                        callbacks: { label: (ctx) => {
                            let label = ctx.dataset.label + ': ';
                            if (ctx.dataset.type === 'line') label += (ctx.raw == null ? 'Sin match CPK' : '$' + (ctx.raw || 0).toFixed(4));
                            else label += (ctx.raw || 0) + ' un.';
                            return label;
                        }}
                    }
                }
            });
            if (compactOnly) return;
            
            // --- GRÁFICOS DE BURBUJAS (MATRICES) ---
            const dataTraction = strategyModels.filter(m => m.type.includes('Tracción') || m.type.includes('TRACCIÓN'));
            const dataTrailer = strategyModels.filter(m => !m.type.includes('Tracción') && !m.type.includes('TRACCIÓN'));
            const topLabelNames = new Set(strategyModels.slice(0, 8).map(m => m.name));
            
            const bubbleDataTraction = dataTraction.map(m => ({ x: m.avgCPK, y: m.wearMmPer10k, r: Math.min(22, 4 + Math.sqrt(Math.max(1, m.scrapCount)) * 2.5), model: m.name, waste: m.avgWastedMm, scrapCount: m.scrapCount, score: m.priorityScore }));
            const bubbleDataTrailer = dataTrailer.map(m => ({ x: m.avgCPK, y: m.wearMmPer10k, r: Math.min(22, 4 + Math.sqrt(Math.max(1, m.scrapCount)) * 2.5), model: m.name, waste: m.avgWastedMm, scrapCount: m.scrapCount, score: m.priorityScore }));
            
            // Colores modo daltónico
            const cTraction = isColorblind ? '#0072B2' : '#3b82f6'; 
            const cTrailer = isColorblind ? '#CC79A7' : '#8b5cf6';
            
            // Configuración común para burbujas
            const bubbleOptions = {
                scales: { 
                    x: { title: { display: true, text: 'CPK ($)' } }, 
                    y: { title: { display: true, text: 'mm / 10k km (desgaste)' } } 
                }, 
                plugins: { 
                    tooltip: { 
                        callbacks: { 
                            label: (ctx) => `${ctx.raw.model}: CPK $${ctx.raw.x.toFixed(4)} | ${ctx.raw.y.toFixed(2)} mm/10k | Scrap ${ctx.raw.scrapCount} | Score ${ctx.raw.score.toFixed(1)}`
                        } 
                    }, 
                    datalabels: { 
                        color: '#475569',
                        align: 'top',
                        font: { weight: 'bold', size: 10 },
                        formatter: (v) => topLabelNames.has(v.model) ? v.model : ''
                    } 
                }
            };

            initChart('strategyChartTraction', 'bubble', { 
                datasets: [{ label: 'Tracción', data: bubbleDataTraction, backgroundColor: cTraction }] 
            }, bubbleOptions);
            
            initChart('strategyChartTrailer', 'bubble', { 
                datasets: [{ label: 'Arrastre / TP / Sin Clasificar', data: bubbleDataTrailer, backgroundColor: cTrailer }] 
            }, bubbleOptions);
            
            // --- PARETO 1: CAUSAS (Impacto MM) ---
            const sortedCauses = Object.entries(s.causeWaste).sort((a,b) => b[1] - a[1]).slice(0, 10);
            const paretoLabels = sortedCauses.map(x => x[0]);
            const paretoData = sortedCauses.map(x => x[1]);

            let accum = 0;
            const paretoLine = paretoData.map(v => {
                accum += v;
                return s.totalWasteMM > 0 ? (accum / s.totalWasteMM) * 100 : 0;
            });

            const cLine = isColorblind ? '#E69F00' : '#eab308';
            const cBar = isColorblind ? '#009E73' : '#9333ea';

            initChart('strategyParetoChart', 'bar', {
                labels: paretoLabels,
                datasets: [
                    { type: 'line', label: '% Acumulado', data: paretoLine, borderColor: cLine, yAxisID: 'y1', pointRadius: 3, pointBackgroundColor: cLine },
                    { type: 'bar', label: 'Desperdicio Total (mm)', data: paretoData, backgroundColor: cBar, yAxisID: 'y' }
                ]
            }, {
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Milímetros (mm)' } },
                    y1: { type: 'linear', display: true, position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: (v) => v + '%' } }
                },
                plugins: {
                    datalabels: { display: ctx => ctx.dataset.type === 'bar', color: 'white', font: { size: 10, weight: 'bold' }, anchor: 'end', align: 'start', formatter: Math.round }
                }
            });

            // --- PARETO 2: MODELOS (Frecuencia vs CPK) ---
            initChart('strategyParetoModelsChart', 'bar', {
                labels: modelLabels,
                datasets: [
                    {
                        type: 'line', label: 'CPK Promedio ($)', data: modelCpkData, borderColor: cModelLine, yAxisID: 'y1', pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: cModelLine, pointBorderWidth: 2
                    },
                    {
                        type: 'bar', label: 'Llantas Desechadas', data: modelCounts, backgroundColor: cModelBar, yAxisID: 'y', borderRadius: 4
                    }
                ]
            }, {
                scales: {
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Unidades' } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'CPK ($)' }, ticks: { callback: (v) => '$' + v.toFixed(3) }, beginAtZero: true }
                },
                plugins: {
                    datalabels: { display: ctx => ctx.dataset.type === 'bar', color: 'white', font: { size: 10, weight: 'bold' }, anchor: 'center', align: 'center' },
                    tooltip: {
                        callbacks: { label: (ctx) => {
                            let label = ctx.dataset.label + ': ';
                            if (ctx.dataset.type === 'line') label += (ctx.raw == null ? 'Sin match CPK' : '$' + (ctx.raw || 0).toFixed(4));
                            else label += (ctx.raw || 0) + ' un.';
                            return label;
                        }}
                    }
                }
            });
        }
        
        // --- BLINDADO: RUN WASH ANALYSIS ---
        function runWashAnalysis() {
            try {
                logStatus('Generando gráficos de Lavadero...');
                const data = getWashScopedCurrentRows();
                const periods = moduleState.washing.periods;
                const drillContainer = document.getElementById('washDrillDownContainer');
                const monthlyDetailContainer = document.getElementById('washMonthlyDetailContainer');
                if (drillContainer) drillContainer.classList.add('hidden');
                if (monthlyDetailContainer) monthlyDetailContainer.classList.add('hidden');
                
                // Basic counters
                const clean = data.filter(r => r.daysWithoutWash <= 45).length;
                const alert = data.filter(r => r.daysWithoutWash > 45 && r.daysWithoutWash < 100).length;
                const critical = data.filter(r => r.daysWithoutWash >= 100).length;
                
                safeSetText('washCleanCount', clean);
                safeSetText('washAlertCount', alert);
                safeSetText('washCriticalCount', critical);
                
                // Helpers
                const getStatusFilter = (idx) => {
                    if (idx === 0) return (r) => r.daysWithoutWash <= 45;
                    if (idx === 1) return (r) => r.daysWithoutWash > 45 && r.daysWithoutWash < 100;
                    if (idx === 2) return (r) => r.daysWithoutWash >= 100;
                    return () => false;
                };
                const statusLabels = ['Limpias', 'Alerta', 'Críticas'];
                const safeData = [clean || 0, alert || 0, critical || 0];

                // COLORBLIND COLORS LOCAL
                const cClean = isColorblind ? '#56B4E9' : '#22c55e';
                const cAlert = isColorblind ? '#E69F00' : '#eab308';
                const cCrit = isColorblind ? '#D55E00' : '#ef4444';

                // CHART 1: STATUS
                try {
                    initChart('washStatusChart', 'doughnut', {
                        labels: statusLabels,
                        datasets: [{ data: safeData, backgroundColor: [cClean, cAlert, cCrit] }]
                    }, {
                        onClick: (e, elements, chart) => {
                            if (elements.length) {
                                const idx = elements[0].index;
                                const statusName = chart.data.labels[idx];
                                const filtered = data.filter(getStatusFilter(idx));
                                showWashDrillDown(filtered, `Estatus General: <strong>${statusName}</strong> (${filtered.length} unidades)`);
                            }
                        },
                        onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; }
                    });
                } catch(e1) { console.warn("Error chart 1 wash", e1); logStatus("Error chart 1 wash", "error"); }
                
                // CHART 2: COMPANY STACKED
                try {
                    const compMap = {};
                    data.forEach(r => {
                        if (!compMap[r.company]) compMap[r.company] = { clean: 0, alert: 0, critical: 0 };
                        if (r.daysWithoutWash <= 45) compMap[r.company].clean++;
                        else if (r.daysWithoutWash < 100) compMap[r.company].alert++;
                        else compMap[r.company].critical++;
                    });

                    const companies = Object.keys(compMap).sort();
                    initChart('washCompanyChart', 'bar', {
                        labels: companies,
                        datasets: [
                            { label: 'Limpias', data: companies.map(c => compMap[c].clean), backgroundColor: cClean, stack: 'S1' },
                            { label: 'Alerta', data: companies.map(c => compMap[c].alert), backgroundColor: cAlert, stack: 'S1' },
                            { label: 'Críticas', data: companies.map(c => compMap[c].critical), backgroundColor: cCrit, stack: 'S1' }
                        ]
                    }, {
                        scales: { x: { stacked: true }, y: { stacked: true } },
                        plugins: {
                            datalabels: { color: 'white', font: { weight: 'bold', size: 10 }, display: ctx => ctx.dataset.data[ctx.dataIndex] > 0 },
                            tooltip: { mode: 'index', intersect: false }
                        },
                        onClick: (e, elements, chart) => {
                            if (elements.length) {
                                const el = elements[0];
                                const companyName = chart.data.labels[el.index];
                                const statusName = statusLabels[el.datasetIndex];
                                const filterFn = getStatusFilter(el.datasetIndex);
                                const filtered = data.filter(r => r.company === companyName && filterFn(r));
                                showWashDrillDown(filtered, `Detalle: <strong>${companyName}</strong> - ${statusName} (${filtered.length} unidades)`);
                            }
                        },
                        onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; }
                    });
                } catch(e2) { console.warn("Error chart 2 wash", e2); logStatus("Error chart 2 wash", "error"); }
                
                // TABLE
                const tbody = document.getElementById('washCriticalTableBody');
                const hasSpecificUnit = hasWashSpecificSelection();
                toggleWashSummaryMode(hasSpecificUnit);
                if (hasSpecificUnit) {
                    renderWashHistorySummaryRows(getWashScopedHistoryRows());
                } else if (tbody) {
                    tbody.innerHTML = '';
                    const sorted = [...data].sort((a,b) => b.daysWithoutWash - a.daysWithoutWash).slice(0, 10);
                    sorted.forEach(r => {
                        tbody.innerHTML += `<tr class="hover:bg-red-50"><td class="p-3 font-bold text-slate-700">${r.unit}</td><td class="p-3">${r.company}</td><td class="p-3 text-center font-bold text-red-600">${r.daysWithoutWash}</td></tr>`;
                    });
                }

                // Restaurada: llamada a la funcion que renderiza el grafico historico
                window.renderWashMonthlyChart();
                
            } catch(fatal) {
                console.error(fatal);
                logStatus("Error FATAL Lavadero: " + fatal.message, "error");
            }
        }
        
        // --- RESTORED: renderWashMonthlyChart ---
        function renderWashMonthlyChart() {
            // Histórico de lavados
             const filterEl = document.getElementById('localWashHistoryFilter');
             const filterVal = filterEl ? filterEl.value : 'L12M';
             const scopedHistory = getWashScopedHistoryRows();
             let data = [...scopedHistory];
             if(document.getElementById('washHistoryCount')) safeSetText('washHistoryCount', scopedHistory.length);
             
             // --- LOGICA DE EJES (DINAMICO VS ESTATICO) ---
             let chartLabels = [];
             let timeKeys = []; // Usado para mapear la data al índice correcto
             
             if (filterVal === 'L12M') {
                 // MODO VENTANA MOVIL
                 const today = new Date();
                 for (let i = 11; i >= 0; i--) {
                     const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                     const m = d.getMonth();
                     const y = d.getFullYear();
                     chartLabels.push(`${monthNamesFull[m].substring(0,3)} ${y.toString().substr(2)}`);
                     timeKeys.push(`${y}-${m}`);
                 }
                 data = data.filter(d => timeKeys.includes(`${d.year}-${d.monthIdx}`));
             } else {
                 // MODO AÑO CALENDARIO
                 if (filterVal !== 'ALL') {
                     data = data.filter(d => d.year.toString() === filterVal);
                 }
                 chartLabels = monthNamesFull.map(m => m.substring(0,3));
                 timeKeys = [0,1,2,3,4,5,6,7,8,9,10,11]; 
             }

             // Tabla auxiliar: unidades con ciclos de lavado < 30 días (periodo activo)
             renderWashHighFrequencyTable(data);

             // --- PREPARAR DATASETS APILADOS ---
             const uniqueCompanies = [...new Set(data.map(d => d.company))].sort();
             const companyData = {};
             uniqueCompanies.forEach(c => {
                 companyData[c] = new Array(chartLabels.length).fill(0);
             });
             
             // Array para guardar totales por mes (para la etiqueta superior y promedio)
             const monthlyTotals = new Array(chartLabels.length).fill(0);

             data.forEach(d => {
                 let xIndex = -1;
                 if (filterVal === 'L12M') {
                     xIndex = timeKeys.indexOf(`${d.year}-${d.monthIdx}`);
                 } else {
                     xIndex = d.monthIdx;
                 }

                 if(xIndex >= 0 && xIndex < chartLabels.length && companyData[d.company]) {
                     companyData[d.company][xIndex]++;
                     monthlyTotals[xIndex]++; // Acumular para el total
                 }
             });

             // CÁLCULO DE PROMEDIO
             const sumTotals = monthlyTotals.reduce((a, b) => a + b, 0);
             const avgMonthly = chartLabels.length > 0 ? sumTotals / chartLabels.length : 0;

             // --- PALETA DE COLORES (PASTEL / TENUES) - COMO RESPALDO ---
             const PASTEL_PALETTE = [
                '#93c5fd', '#86efac', '#fca5a5', '#fde047', '#d8b4fe', 
                '#fdba74', '#67e8f9', '#f9a8d4', '#cbd5e1', '#a5b4fc', '#818cf8'
             ];

             const datasets = uniqueCompanies.map((c, i) => {
                 // MODIFICACIÓN: Priorizar color corporativo (buscando directo o en mayúsculas)
                 let color = COMPANY_COLORS[c] || COMPANY_COLORS[c.toUpperCase()] || PASTEL_PALETTE[i % PASTEL_PALETTE.length];
                 
                 return {
                     label: c,
                     data: companyData[c],
                     backgroundColor: color,
                     stack: 'S1',
                     // Etiqueta en el centro de la barra (Conteo individual)
                     datalabels: {
                         color: '#ffffff', // Blanco para mejor contraste
                         textShadowBlur: 2,
                         textShadowColor: 'rgba(0,0,0,0.3)',
                         align: 'center',
                         anchor: 'center',
                         font: { weight: 'bold', size: 10 },
                         formatter: (value) => value > 0 ? value : ''
                     }
                 };
             });

             // DATASET FANTASMA PARA EL TOTAL SUPERIOR
             datasets.push({
                 label: 'Total',
                 data: monthlyTotals,
                 type: 'line',
                 borderColor: 'transparent',
                 backgroundColor: 'transparent',
                 pointRadius: 0,
                 datalabels: {
                     align: 'end',
                     anchor: 'end',
                     color: '#64748b',
                     font: { weight: 'bold', size: 11 },
                     formatter: (value) => value > 0 ? value : ''
                 },
                 order: 0 // Dibujar al frente
             });

             initChart('washMonthlyChart', 'bar', {
                 labels: chartLabels,
                 datasets: datasets
             }, {
                 scales: {
                     x: { stacked: true },
                     y: { stacked: true }
                 },
                 plugins: {
                     legend: { 
                         display: true, 
                         position: 'bottom', 
                         labels: { 
                             boxWidth: 10, 
                             font: { size: 10 },
                             filter: (legendItem, data) => legendItem.text !== 'Total' // Ocultar "Total" de la leyenda
                         } 
                     },
                     tooltip: { 
                         mode: 'index', 
                         intersect: false,
                         filter: (tooltipItem) => tooltipItem.dataset.label !== 'Total' // Ocultar tooltip del total fantasma
                     },
                     datalabels: { display: true }, // Habilitar globalmente para este gráfico
                     annotation: {
                         annotations: {
                             avgLine: {
                                 type: 'line',
                                 yMin: avgMonthly,
                                 yMax: avgMonthly,
                                 borderColor: '#94a3b8',
                                 borderWidth: 2,
                                 borderDash: [5, 5],
                                 label: {
                                     content: `Prom: ${avgMonthly.toFixed(1)}`,
                                     display: true,
                                     position: 'end',
                                     backgroundColor: 'rgba(241, 245, 249, 0.9)',
                                     color: '#475569',
                                     font: { size: 9, weight: 'bold' },
                                     yAdjust: -10
                                 }
                             }
                         }
                     }
                 },
                 // ACTUALIZADO: EVENTO ONCLICK PARA DETALLE MENSUAL (todas las unidades del mes)
                 onClick: (e, elements, chart) => {
                     if (elements.length > 0) {
                         // Obtener elemento clickeado
                         const el = elements[0];
                         const dataIdx = el.index;

                         // Determinar mes y año basado en el modo (L12M o Año Fijo)
                         let targetMonthIdx = -1;
                         let targetYear = -1;
                         let labelText = chart.data.labels[dataIdx] || '-'; // ej: "Ene 24"

                         if (filterVal === 'L12M') {
                             if (timeKeys && timeKeys[dataIdx]) {
                                 const parts = timeKeys[dataIdx].split('-'); // "2024-0"
                                 targetYear = parseInt(parts[0]);
                                 targetMonthIdx = parseInt(parts[1]);
                             }
                         } else {
                             // Modo Año Fijo: dataIdx ES el índice del mes (0=Ene, 11=Dic)
                             targetMonthIdx = dataIdx;
                             targetYear = parseInt(filterVal);
                         }

                         // Filtrar los datos del mes completo (todas las empresas)
                         const filtered = scopedHistory.filter(r => 
                             r.monthIdx === targetMonthIdx && 
                             r.year === targetYear
                         );

                         // Mostrar detalle
                         showWashMonthlyDetail(filtered, `Detalle Histórico: <strong>${labelText}</strong> (${filtered.length} lavados)`);
                     }
                 },
                 onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'; }
             });

             // --- POBLAR DROPDOWN ---
             const select = document.getElementById('localWashHistoryFilter');
             if(select && select.options.length <= 2) {
                 const years = [...new Set(dbWashHistory.map(d => d.year))].sort().reverse();
                 years.forEach(y => {
                     let exists = false;
                     for(let i=0; i<select.options.length; i++) if(select.options[i].value === y.toString()) exists = true;
                     if (!exists) {
                         const opt = document.createElement('option');
                         opt.value = y;
                         opt.innerText = y;
                         select.appendChild(opt);
                     }
                 });
             }
        }
        
        // --- BLINDADO: RUN FUEL ANALYSIS ---
        function runFuelAnalysis() {
            try {
                logStatus('Generando análisis de combustible...');
                
                if (!dbExtra || dbExtra.length === 0) {
                    console.warn("No hay datos de combustible para procesar");
                    return;
                }

                const fuelScoped = getFuelSearchScopedRows();
                // SPLIT DATA
                const heavyDuty = fuelScoped.filter(r => r.company !== 'Pipitas');
                const mediumDuty = fuelScoped.filter(r => r.company === 'Pipitas');

                // --- PART 1: KPI CALCS ---
                try {
                    const totalKm = heavyDuty.reduce((s, r) => s + r.km, 0);
                    const totalLiters = heavyDuty.reduce((s, r) => s + r.liters, 0);
                    const globalYield = totalLiters > 0 ? totalKm / totalLiters : 0;
                    safeSetText('fuelGlobalYield', `${globalYield.toFixed(2)} km/L`);

                    const pipTotalKm = mediumDuty.reduce((s, r) => s + r.km, 0);
                    const pipTotalLit = mediumDuty.reduce((s, r) => s + r.liters, 0);
                    const pipYield = pipTotalLit > 0 ? pipTotalKm / pipTotalLit : 0;
                    safeSetText('pipitasYieldTop', `${pipYield.toFixed(2)} km/L`);

                    // Best/Worst Logic
                    const engineGroups = {};
                    const companyGroups = {};
                    heavyDuty.forEach(r => {
                        if(!engineGroups[r.engine]) engineGroups[r.engine] = { km:0, liters:0, name: r.engine };
                        engineGroups[r.engine].km += r.km;
                        engineGroups[r.engine].liters += r.liters;

                        if(!companyGroups[r.company]) companyGroups[r.company] = { km:0, liters:0, name: r.company };
                        companyGroups[r.company].km += r.km;
                        companyGroups[r.company].liters += r.liters;
                    });

                    const engineStats = Object.values(engineGroups).map(e => ({ name: e.name, yield: e.liters>0?e.km/e.liters:0 }));
                    const bestEngine = engineStats.sort((a,b) => b.yield - a.yield)[0];
                    if(bestEngine) {
                        safeSetText('fuelBestEngine', bestEngine.name);
                        safeSetText('fuelBestEngineVal', `${bestEngine.yield.toFixed(2)} km/L`);
                    }

                    const companyStats = Object.values(companyGroups).map(c => ({ name: c.name, yield: c.liters>0?c.km/c.liters:0 }));
                    const worstCompany = companyStats.sort((a,b) => a.yield - b.yield)[0];
                    if(worstCompany) {
                        safeSetText('fuelWorstCompany', worstCompany.name);
                        safeSetText('fuelWorstCompanyVal', `${worstCompany.yield.toFixed(2)} km/L`);
                    }
                    
                    // --- PART 2: MAIN CHARTS ---
                    // NEW: Filter Logic for Trend Chart
                    const filterEl = document.getElementById('fuelTrendFilter');
                    const filterVal = filterEl ? filterEl.value : 'L12M';
                    
                    let chartLabels = [];
                    let mappingKeys = [];
                    
                    if (filterVal === 'L12M') {
                        const today = new Date();
                        // MODIFICADO: i comienza en 12 y termina en 1 para excluir el mes actual y mostrar solo meses concluidos
                        for(let i=12; i>=1; i--) {
                             const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                             chartLabels.push(`${monthNamesFull[d.getMonth()].substring(0,3)} ${d.getFullYear().toString().substr(2)}`);
                             mappingKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
                        }
                    } else {
                        // Standard Year View (or ALL)
                        chartLabels = monthNamesFull.map(m => m.substring(0,3));
                        mappingKeys = [0,1,2,3,4,5,6,7,8,9,10,11].map(i => i.toString()); // Just indices
                    }

                    // Populate Dropdown if empty
                    if(filterEl && filterEl.options.length <= 2) {
                        const years = [...new Set(dbExtra.map(r => r.year))].sort().reverse();
                        years.forEach(y => {
                            let exists = false;
                            for(let i=0; i<filterEl.options.length; i++) if(filterEl.options[i].value === y.toString()) exists = true;
                            if(!exists) {
                                const opt = document.createElement('option');
                                opt.value = y;
                                opt.innerText = y;
                                filterEl.appendChild(opt);
                            }
                        });
                    }

                    const trendData = {}; 
                    heavyDuty.forEach(r => {
                        // Apply Filter
                        if(filterVal !== 'L12M' && filterVal !== 'ALL' && r.year.toString() !== filterVal) return;

                        if(!trendData[r.engine]) trendData[r.engine] = new Array(chartLabels.length).fill(null).map(()=>({km:0, lit:0}));
                        
                        let idx = -1;
                        if(filterVal === 'L12M') {
                            idx = mappingKeys.indexOf(`${r.year}-${r.mIdx}`);
                        } else {
                            idx = r.mIdx; // 0-11
                        }

                        if(idx >= 0 && idx < chartLabels.length) {
                            trendData[r.engine][idx].km += r.km;
                            trendData[r.engine][idx].lit += r.liters;
                        }
                    });
                    
                    const lineDatasets = Object.keys(trendData).map((eng, idx) => {
                        const data = trendData[eng].map(m => m.lit > 0 ? m.km / m.lit : null);
                        let color = isColorblind
                            ? COLORBLIND_PALETTE[idx % COLORBLIND_PALETTE.length]
                            : FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                        
                        if (!isColorblind && (eng.toUpperCase().includes('EPA 04') || eng.toUpperCase().includes('EPA04'))) {
                            color = '#1d4ed8'; // Azul intenso
                        }

                        return { label: eng, data: data, borderColor: color, backgroundColor: 'transparent', tension: 0.3 };
                    });
                    
                    initChart('fuelEngineTrendChart', 'line', { 
                        labels: chartLabels, // Use dynamic labels
                        datasets: lineDatasets 
                    }, {
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }, datalabels: { display: false } },
                        layout: { padding: { top: 10 } }
                    });

                    // Company Bar Chart
                    const compNames = companyStats.map(c => c.name);
                    const compYields = companyStats.map(c => c.yield);
                    
                    const bgColors = compNames.map((c, i) => {
                        if (isColorblind) {
                            const palette = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'];
                            return palette[i % palette.length];
                        }
                        if (COMPANY_COLORS[c]) return COMPANY_COLORS[c];
                        return PALETTE_FALLBACK[i % PALETTE_FALLBACK.length];
                    });
                    
                    initChart('fuelCompanyBarChart', 'bar', { 
                        labels: compNames, 
                        datasets: [{ label: 'Rendimiento (Km/L)', data: compYields, backgroundColor: bgColors, borderRadius:4 }] 
                    }, {
                        onClick: (e, elements, chart) => {
                            if (elements.length) {
                                const idx = elements[0].index;
                                const companyName = chart.data.labels[idx];
                                window.showFuelDrillDown(companyName);
                            }
                        },
                        plugins: {
                            datalabels: { color: '#ffffff', anchor: 'center', align: 'center', font: { weight: 'bold', size: 11 }, formatter: (value) => value ? value.toFixed(2) : '' },
                            tooltip: { callbacks: { footer: () => 'Click para ver desglose de unidades' } }
                        }
                    });

                    // --- TABLE ---
                    const tbodyHD = document.getElementById('fuelEngineTableBody');
                    if(tbodyHD) {
                        tbodyHD.innerHTML = '';
                        engineStats.sort((a,b) => b.yield - a.yield).forEach((eng, index) => {
                            const rank = index + 1;
                            let rankDisplay = `<span class="font-bold text-slate-400">#${rank}</span>`;
                            if (rank === 1) rankDisplay = '<span class="text-lg">🥇</span>';
                            else if (rank === 2) rankDisplay = '<span class="text-lg">🥈</span>';
                            else if (rank === 3) rankDisplay = '<span class="text-lg">🥉</span>';

                            const raw = engineGroups[eng.name];
                            tbodyHD.innerHTML += `<tr class="hover:bg-teal-50 border-b border-slate-100"><td class="p-3 font-bold text-slate-700">${eng.name}</td><td class="p-3 text-center text-slate-600">${raw.km.toLocaleString()}</td><td class="p-3 text-center text-slate-600">${raw.liters.toLocaleString()}</td><td class="p-3 text-center font-mono font-bold text-teal-700">${eng.yield.toFixed(2)}</td><td class="p-3 text-center">${rankDisplay}</td></tr>`;
                        });
                    }

                } catch (e) {
                    console.error("Error in Fuel KPI/Main Charts:", e);
                }

                // --- PART 3: MANUFACTURER (Try-Catch Block) ---
                try {
                    const unqEng = [...new Set(heavyDuty.map(r => r.engine))].sort();
                    window.populateMultiSelect('dropdownManufEngine', unqEng, 'Motores');
                    const unqComp = [...new Set(heavyDuty.map(r => r.company))].sort();
                    window.populateMultiSelect('dropdownManufCompany', unqComp, 'Sociedades');
                    const unqSeg = [...new Set(heavyDuty.map(r => r.segment))].sort();
                    window.populateMultiSelect('dropdownManufSegment', unqSeg, 'Segmentos');
                    
                    window.updateManufacturerChart();
                } catch(e) {
                    console.warn("Manufacturer Chart Block Failed:", e);
                }

                // --- PART 4: OPERATORS (Try-Catch Block) ---
                try {
                     // OPERATORS RANKING LOGIC
                    const selectedGroup = document.getElementById('operatorGroupFilter') ? document.getElementById('operatorGroupFilter').value : 'ALL';
                    const labelEl = document.getElementById('activeFilterDisplay');
                    if(labelEl) {
                        if(selectedGroup !== 'ALL') {
                            labelEl.innerText = selectedGroup;
                            labelEl.classList.remove('hidden');
                        } else {
                            labelEl.classList.add('hidden');
                        }
                    }

                    const hasSpecific = hasFuelSpecificSelection();
                    if (hasSpecific) {
                        const unitMode = currentFuelSelectedUnit.length > 0
                            || (!!currentFuelSearchUnit && currentFuelSelectedOperator.length === 0 && !currentFuelSearchOperator);
                        toggleFuelRankingMode(true);
                        renderFuelSpecificSummaryRows(fuelScoped, unitMode ? 'UNIT' : 'OP');
                        return;
                    }
                    toggleFuelRankingMode(false);

                    const operatorEngineGroups = {};
                    // NUEVO: Mapa para Unidades
                    const unitEngineGroups = {};

                    fuelScoped.forEach(r => {
                        // --- Logica Operadores ---
                        const opName = r.operator || 'Sin Nombre';
                        const engName = r.engine || 'Desconocido';
                        const opKey = `${opName}|${engName}`;
                        
                        // --- Logica Unidades ---
                        const unitName = r.unit || 'S/N';
                        // Asumimos que una unidad no cambia de motor, pero por seguridad agrupamos por unidad única
                        // Si cambiara de motor, se consideraría como un registro distinto si quisiéramos, 
                        // pero aquí acumularemos por unidad y tomaremos el último motor registrado o el más frecuente.
                        // Para simplificar y dado que el motor es atributo del vehículo:
                        
                        let opGroup = 'Otros';
                        const seg = (r.segment || '').toUpperCase();
                        const comp = (r.company || '').toUpperCase();

                        if (seg.includes('FZS')) opGroup = 'FZS';
                        else if (seg.includes('VIAJE LOCAL')) opGroup = 'Viaje Local';
                        else if (seg.includes('PR MID')) opGroup = 'PR MID';
                        else if (seg.includes('CR LPZ')) opGroup = 'CR LPZ';
                        else if (seg.includes('PIPAS') || comp.includes('PIPITAS')) opGroup = 'Pipas Chicas';

                        // Agregación Operadores
                        if(!operatorEngineGroups[opKey]) {
                            operatorEngineGroups[opKey] = { 
                                name: opName, engine: engName, km: 0, liters: 0, company: r.company, group: opGroup
                            };
                        }
                        operatorEngineGroups[opKey].km += r.km;
                        operatorEngineGroups[opKey].liters += r.liters;

                        // Agregación Unidades (NUEVO)
                        if(!unitEngineGroups[unitName]) {
                            unitEngineGroups[unitName] = {
                                name: unitName, engine: engName, km: 0, liters: 0, company: r.company, group: opGroup
                            };
                        }
                        unitEngineGroups[unitName].km += r.km;
                        unitEngineGroups[unitName].liters += r.liters;
                    });

                    // --- PROCESAMIENTO OPERADORES ---
                    let opEngineStats = Object.values(operatorEngineGroups)
                        .filter(o => o.km > 20000) 
                        .filter(o => {
                            if(selectedGroup === 'ALL') return true;
                            return o.group === selectedGroup;
                        })
                        .map(o => ({
                            name: o.name, engine: o.engine, km: o.km,
                            yield: o.liters > 0 ? o.km / o.liters : 0,
                            company: o.company, group: o.group
                        }));

                    const statsByEngine = {};
                    opEngineStats.forEach(stat => {
                        if(!statsByEngine[stat.engine]) statsByEngine[stat.engine] = [];
                        statsByEngine[stat.engine].push(stat);
                    });

                    // --- PROCESAMIENTO UNIDADES (NUEVO) ---
                    let unitEngineStats = Object.values(unitEngineGroups)
                        // Filtro de kilometraje mínimo para unidades (ajustable, ej: 10,000 km para ser relevante)
                        .filter(u => u.km > 5000) 
                        .filter(u => {
                            if(selectedGroup === 'ALL') return true;
                            return u.group === selectedGroup;
                        })
                        .map(u => ({
                            name: u.name, engine: u.engine, km: u.km,
                            yield: u.liters > 0 ? u.km / u.liters : 0,
                            company: u.company, group: u.group
                        }));

                    const unitStatsByEngine = {};
                    unitEngineStats.forEach(stat => {
                        if(!unitStatsByEngine[stat.engine]) unitStatsByEngine[stat.engine] = [];
                        unitStatsByEngine[stat.engine].push(stat);
                    });

                    // Orden de Motores
                    const enginePriority = ['EPA 04', 'EURO IV', 'EURO V', 'S13 E24'];
                    const sortedEngines = Object.keys(statsByEngine).sort((a,b) => {
                        const nameA = a.toUpperCase(); const nameB = b.toUpperCase();
                        let indexA = enginePriority.findIndex(p => nameA.includes(p));
                        let indexB = enginePriority.findIndex(p => nameB.includes(p));
                        if (indexA === -1) indexA = 999; if (indexB === -1) indexB = 999;
                        if (indexA !== indexB) return indexA - indexB;
                        const kmA = statsByEngine[a].reduce((acc, curr) => acc + curr.km, 0);
                        const kmB = statsByEngine[b].reduce((acc, curr) => acc + curr.km, 0);
                        return kmB - kmA;
                    });

                    // --- RENDERIZADO OPERADORES ---
                    const renderGroupedOpTable = (id, engineList, isBest) => {
                        const tbody = document.getElementById(id);
                        if(!tbody) return;
                        tbody.innerHTML = '';
                        let hasData = false;

                        engineList.forEach(engine => {
                            let ops = statsByEngine[engine];
                            if (!isBest && selectedGroup === 'ALL') ops = ops.filter(op => op.group !== 'CR LPZ');
                            if (ops.length === 0) return; 

                            ops.sort((a,b) => b.yield - a.yield); 
                            const displayOps = isBest ? ops.slice(0, 3) : ops.reverse().slice(0, 3);

                            if (displayOps.length > 0) {
                                hasData = true;
                                tbody.innerHTML += `<tr class="bg-slate-200 border-y border-slate-300"><td colspan="3" class="px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider"><i class="fa-solid fa-cogs mr-1"></i> ${engine}</td></tr>`;
                                displayOps.forEach((op, i) => {
                                    let yieldColor = isBest ? 'text-green-600' : 'text-red-600';
                                    let rankIcon = isBest ? (i===0 ? '🥇' : (i===1 ? '🥈' : '🥉')) : `<span class="text-xs font-bold text-red-400">#${i+1}</span>`;
                                    tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-2 font-bold text-slate-700 flex items-center gap-2"><span class="w-4 text-center">${rankIcon}</span><div class="flex flex-col"><span>${op.name}</span><span class="text-[9px] text-slate-400 font-normal uppercase">${op.company} <span class="text-[8px] bg-slate-100 text-slate-500 px-1 rounded ml-1">${op.group}</span></span></div></td><td class="p-2 text-right text-slate-500 font-mono text-xs">${(op.km/1000).toFixed(1)}k</td><td class="p-2 text-center font-bold ${yieldColor}">${op.yield.toFixed(2)}</td></tr>`;
                                });
                            }
                        });

                        if (!hasData) tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-slate-400 italic text-xs">Sin datos para este grupo</td></tr>';
                    };

                    renderGroupedOpTable('topOperatorsBody', sortedEngines, true);
                    renderGroupedOpTable('bottomOperatorsBody', sortedEngines, false);

                    // --- RENDERIZADO UNIDADES (NUEVO) ---
                    // Usamos la misma lista de motores ordenados, pero buscamos en unitStatsByEngine
                    const renderGroupedUnitTable = (id, engineList, isBest) => {
                        const tbody = document.getElementById(id);
                        if(!tbody) return;
                        tbody.innerHTML = '';
                        let hasData = false;

                        engineList.forEach(engine => {
                            let units = unitStatsByEngine[engine] || [];
                            // Filtro extra opcional para unidades criticas si se desea
                            if (units.length === 0) return; 

                            units.sort((a,b) => b.yield - a.yield); 
                            const displayUnits = isBest ? units.slice(0, 3) : units.reverse().slice(0, 3);

                            if (displayUnits.length > 0) {
                                hasData = true;
                                tbody.innerHTML += `<tr class="bg-slate-200 border-y border-slate-300"><td colspan="3" class="px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider"><i class="fa-solid fa-cogs mr-1"></i> ${engine}</td></tr>`;
                                displayUnits.forEach((u, i) => {
                                    let yieldColor = isBest ? 'text-blue-600' : 'text-orange-600'; // Azul/Naranja para diferenciar
                                    let rankIcon = isBest ? (i===0 ? '🥇' : (i===1 ? '🥈' : '🥉')) : `<span class="text-xs font-bold text-orange-400">#${i+1}</span>`;
                                    tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="p-2 font-bold text-slate-700 flex items-center gap-2"><span class="w-4 text-center">${rankIcon}</span><div class="flex flex-col"><span>${u.name}</span><span class="text-[9px] text-slate-400 font-normal uppercase">${u.company} <span class="text-[8px] bg-slate-100 text-slate-500 px-1 rounded ml-1">${u.group}</span></span></div></td><td class="p-2 text-right text-slate-500 font-mono text-xs">${(u.km/1000).toFixed(1)}k</td><td class="p-2 text-center font-bold ${yieldColor}">${u.yield.toFixed(2)}</td></tr>`;
                                });
                            }
                        });

                        if (!hasData) tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-slate-400 italic text-xs">Sin datos para este grupo</td></tr>';
                    };

                    renderGroupedUnitTable('topUnitsBody', sortedEngines, true);
                    renderGroupedUnitTable('bottomUnitsBody', sortedEngines, false);

                } catch (e) {
                    console.error("Error in Operator/Unit Ranking:", e);
                }

            } catch(fatal) {
                console.error(fatal);
                logStatus("Error FATAL Combustible: " + fatal.message, "error");
            }
        }
        
        function updateManufacturerChart() {
            // Helper to get selected values (supports "ALL" logic)
            const getVals = (id) => {
                const container = document.getElementById(id);
                if(!container) return ['ALL'];
                const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
                const values = Array.from(checkboxes).map(cb => cb.value);
                if(values.includes('ALL')) return ['ALL']; // If ALL is checked, return ALL
                if(values.length === 0) return ['NONE'];
                return values;
            };

            const engFilter = getVals('dropdownManufEngine');
            const compFilter = getVals('dropdownManufCompany');
            const segFilter = getVals('dropdownManufSegment');

            // Use only heavy duty data (ignoring pipitas) and respect fuel Unit/Operator filters
            const baseData = getFuelSearchScopedRows().filter(r => r.company !== 'Pipitas');

            // Apply Filters (Multi-Select Logic)
            const filteredData = baseData.filter(r => {
                if (!engFilter.includes('ALL') && !engFilter.includes(r.engine)) return false;
                if (!compFilter.includes('ALL') && !compFilter.includes(r.company)) return false;
                if (!segFilter.includes('ALL') && !segFilter.includes(r.segment)) return false;
                return true;
            });

            // --- LÓGICA DE VENTANA DE TIEMPO (Últimos 12 Meses Concluidos) ---
            // Ejemplo: Si hoy es 23 de Febrero 2026
            // Queremos mostrar desde Febrero 2025 hasta Enero 2026.
            
            const today = new Date();
            const timeWindowKeys = [];
            const chartLabels = [];

            // Iteramos desde hace 12 meses (i=12) hasta hace 1 mes (i=1)
            // Excluyendo i=0 que sería el mes actual.
            for (let i = 12; i >= 1; i--) {
                // Crear fecha restando 'i' meses a la fecha actual.
                // Usamos el día 1 para evitar problemas con meses de distinta duración (ej. 30 vs 31 vs 28)
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                
                const y = d.getFullYear();
                const m = d.getMonth(); // 0-11
                
                // Clave única para agrupar datos (Año-Mes)
                timeWindowKeys.push(`${y}-${m}`);
                
                // Etiqueta visual para el eje X (Ej: "Ene 26")
                const label = `${monthNamesFull[m].substring(0,3)} ${y.toString().substr(2)}`;
                chartLabels.push(label);
            }

            // Group by Manufacturer -> Window Index
            const manufacturers = [...new Set(filteredData.map(r => r.manufacturer))];
            const manufData = {};
            
            // Inicializar estructura con 12 espacios (uno para cada mes de la ventana)
            manufacturers.forEach(m => {
                manufData[m] = new Array(12).fill(null).map(() => ({ km:0, lit:0 }));
            });

            filteredData.forEach(r => {
                // Generar la clave del registro actual
                const key = `${r.year}-${r.mIdx}`;
                
                // Verificar si esta clave existe en nuestra ventana de tiempo permitida
                const windowIdx = timeWindowKeys.indexOf(key);

                // Si existe (índice 0 a 11), sumamos los datos en la posición correspondiente
                if (windowIdx !== -1) {
                    manufData[r.manufacturer][windowIdx].km += r.km;
                    manufData[r.manufacturer][windowIdx].lit += r.liters;
                }
            });

            // Create Datasets
            const datasets = manufacturers.map((man, idx) => {
                // Convertir acumulados a Rendimiento (Km/L)
                const dataPoints = manufData[man].map(m => m.lit > 0 ? m.km / m.lit : null);
                
                const color = isColorblind
                    ? COLORBLIND_PALETTE[idx % COLORBLIND_PALETTE.length]
                    : PALETTE_FALLBACK[idx % PALETTE_FALLBACK.length];
                return {
                    label: man,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    tension: 0.3
                };
            });

            initChart('manufacturerTrendChart', 'line', {
                labels: chartLabels, // Usamos las etiquetas generadas dinámicamente
                datasets: datasets
            }, {
                plugins: {
                    title: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        offset: 4,
                        color: function(context) {
                            return context.dataset.borderColor;
                        },
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: 3,
                        font: { size: 9, weight: 'bold' },
                        formatter: (value) => value ? value.toFixed(2) : ''
                    }
                },
                scales: {
                    y: { title: { display: true, text: 'Rendimiento (km/L)' } }
                },
                layout: {
                    padding: { top: 20 }
                }
            });
        }
        
        // --- EXPOSE GLOBAL FUNCTIONS (BULLETPROOF) ---
        window.startSystem = startSystem;
        window.manualRefresh = manualRefresh;
        window.switchTab = switchTab;
        window.updatePeriodSelection = updatePeriodSelection;
        window.toggleYearDropdown = toggleYearDropdown;
        window.setCategoryFilter = setCategoryFilter;
        window.setPerformanceStatusFilter = setPerformanceStatusFilter;
        window.handleLinksClick = handleLinksClick;
        window.attemptMainLogin = attemptMainLogin;
        window.attemptLogin = attemptLogin;
        window.logoutSession = logoutSession;
        window.toggleModal = toggleModal;
        window.saveCloudConfig = saveCloudConfig;
        window.resetToDefaults = resetToDefaults;
        window.openCpkGoalsModal = openCpkGoalsModal;
        window.saveCpkGoalsFromEditor = saveCpkGoalsFromEditor;
        window.restoreDefaultCpkGoals = restoreDefaultCpkGoals;
        window.renderWashMonthlyChart = renderWashMonthlyChart;
        // --- FIXED EXPORTS FOR MISSING MODULES ---
        window.runCPKAnalysis = runCPKAnalysis;
        window.runScrapAnalysis = runScrapAnalysis;
        window.runStrategyAnalysis = runStrategyAnalysis;
        window.runWashAnalysis = runWashAnalysis;
        // --- END FIXED EXPORTS ---
        window.runFuelAnalysis = runFuelAnalysis; // FIXED
        window.runLossAnalysis = runLossAnalysis;
        window.updateManufacturerChart = updateManufacturerChart;
        window.toggleColorblindMode = toggleColorblindMode;
        window.setLossCompanyFilter = setLossCompanyFilter;
        window.setLossLitersMode = setLossLitersMode;
        window.setLossLowRankBy = setLossLowRankBy;
        window.setLossTopOrder = setLossTopOrder;
        window.renderFuelSuggestions = renderFuelSuggestions;
        window.toggleFuelSuggestionSelection = toggleFuelSuggestionSelection;
        window.clearFuelSuggestionSelection = clearFuelSuggestionSelection;
        window.applyFuelSearchFilters = applyFuelSearchFilters;
        window.clearFuelSearchFilters = clearFuelSearchFilters;
        window.applyLossSearchFilters = applyLossSearchFilters;
        window.clearLossSearchFilters = clearLossSearchFilters;
        window.renderLossSuggestions = renderLossSuggestions;
        window.toggleLossSuggestionSelection = toggleLossSuggestionSelection;
        window.clearLossSuggestionSelection = clearLossSuggestionSelection;
        window.renderWashSuggestions = renderWashSuggestions;
        window.toggleWashSuggestionSelection = toggleWashSuggestionSelection;
        window.clearWashSuggestionSelection = clearWashSuggestionSelection;
        window.applyWashSearchFilters = applyWashSearchFilters;
        window.clearWashSearchFilters = clearWashSearchFilters;
        window.renderWashDrillDownRows = renderWashDrillDownRows;
        window.setWashDrillSort = setWashDrillSort;
        window.renderWashMonthlyDetailRows = renderWashMonthlyDetailRows;
        window.setWashMonthlyDetailSort = setWashMonthlyDetailSort;
        window.populateMultiSelect = populateMultiSelect;
        window.showWashDrillDown = showWashDrillDown;
        window.showWashMonthlyDetail = showWashMonthlyDetail;
        window.showFuelDrillDown = showFuelDrillDown;
        window.showScrapBrandDetail = showScrapBrandDetail; // NEW EXPORT
        window.showCPKBrandDrillDown = showCPKBrandDrillDown; // NEW EXPORT
        window.showCPKOthersDrillDown = showCPKOthersDrillDown; // NEW EXPORT FOR OTHERS
        window.closeDropdowns = closeDropdowns;
        window.renderUsersTable = renderUsersTable;
        window.resetUserForm = resetUserForm;
        window.saveUserFromForm = saveUserFromForm;
        window.editUserFromTable = editUserFromTable;
        window.deleteUserFromTable = deleteUserFromTable;
        window.downloadSecureUsersBackup = downloadSecureUsersBackup;
        window.openUsersBackupImport = openUsersBackupImport;
        window.openChangePasswordModal = openChangePasswordModal;
        window.submitPasswordChange = submitPasswordChange;
    
