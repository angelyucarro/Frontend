(function () {
    'use strict';

    const FORMAT_VERSION = 'yucarro-users-v1';
    const PBKDF2_ITERATIONS = 250000;

    const te = new TextEncoder();
    const td = new TextDecoder();

    function b64FromBytes(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function bytesFromB64(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function deriveAesKey(passphrase, saltBytes, usages) {
        const baseKey = await crypto.subtle.importKey(
            'raw',
            te.encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: saltBytes,
                iterations: PBKDF2_ITERATIONS
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            usages
        );
    }

    async function exportEncrypted(users, passphrase) {
        if (!Array.isArray(users)) throw new Error('Lista de usuarios inválida.');
        if (!passphrase || passphrase.length < 8) throw new Error('La clave debe tener al menos 8 caracteres.');
        if (!window.crypto || !window.crypto.subtle) throw new Error('Este navegador no soporta cifrado seguro.');

        const payload = {
            users,
            createdAt: new Date().toISOString()
        };
        const plainBytes = te.encode(JSON.stringify(payload));
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const aesKey = await deriveAesKey(passphrase, salt, ['encrypt']);
        const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plainBytes);

        return {
            format: FORMAT_VERSION,
            alg: 'AES-GCM-256',
            kdf: 'PBKDF2-SHA256',
            iterations: PBKDF2_ITERATIONS,
            salt: b64FromBytes(salt),
            iv: b64FromBytes(iv),
            data: b64FromBytes(new Uint8Array(cipherBuffer))
        };
    }

    async function importEncrypted(serialized, passphrase) {
        if (!passphrase) throw new Error('Clave requerida.');
        if (!window.crypto || !window.crypto.subtle) throw new Error('Este navegador no soporta cifrado seguro.');

        let backup;
        try {
            backup = JSON.parse(serialized);
        } catch (_e) {
            throw new Error('Archivo inválido (JSON corrupto).');
        }

        if (!backup || backup.format !== FORMAT_VERSION) {
            throw new Error('Formato de respaldo no compatible.');
        }
        if (!backup.salt || !backup.iv || !backup.data) {
            throw new Error('Archivo de respaldo incompleto.');
        }

        const salt = bytesFromB64(backup.salt);
        const iv = bytesFromB64(backup.iv);
        const cipherBytes = bytesFromB64(backup.data);
        const aesKey = await deriveAesKey(passphrase, salt, ['decrypt']);

        let plainBuffer;
        try {
            plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
        } catch (_e) {
            throw new Error('No se pudo descifrar (clave incorrecta o archivo alterado).');
        }

        let payload;
        try {
            payload = JSON.parse(td.decode(plainBuffer));
        } catch (_e) {
            throw new Error('Contenido descifrado inválido.');
        }

        if (!payload || !Array.isArray(payload.users)) {
            throw new Error('Respaldo sin lista de usuarios válida.');
        }

        return payload.users;
    }

    window.UsersVault = {
        format: FORMAT_VERSION,
        exportEncrypted,
        importEncrypted
    };
})();
