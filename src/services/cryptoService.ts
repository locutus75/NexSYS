/**
 * services/cryptoService.ts
 * Cryptographic helpers for password-protected AES-GCM wallet storage.
 * Uses native Web Crypto API which is highly secure and fast.
 */

export interface PasswordRules {
  isValid: boolean;
  length: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

/**
 * Validates a password against strong wallet password rules:
 * - Minimum 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special/strange character
 */
export function validatePassword(password: string): PasswordRules {
  const length = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return {
    isValid: length && hasUpper && hasLower && hasDigit && hasSpecial,
    length,
    hasUpper,
    hasLower,
    hasDigit,
    hasSpecial,
  };
}

/**
 * Encrypts plaintext using AES-GCM 256-bit with a key derived from password using PBKDF2.
 * Returns a JSON string containing the ciphertext, salt, and iv in hex format.
 */
export async function encryptData(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Import raw password bytes
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256-bit key from password
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Encrypt the plaintext
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plaintext)
  );

  const bufferToHex = (buf: ArrayBuffer) =>
    Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

  return JSON.stringify({
    ciphertext: bufferToHex(ciphertext),
    salt: bufferToHex(salt),
    iv: bufferToHex(iv),
  });
}

/**
 * Decrypts hex-encoded JSON string using AES-GCM 256-bit with key derived from password.
 */
export async function decryptData(encryptedJson: string, password: string): Promise<string> {
  const { ciphertext, salt, iv } = JSON.parse(encryptedJson);

  const hexToBuffer = (hex: string) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
  };

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Import raw password bytes
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256-bit key from password using matching parameters
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: hexToBuffer(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decrypt ciphertext
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBuffer(iv) },
    key,
    hexToBuffer(ciphertext)
  );

  return dec.decode(decrypted);
}
