import bcrypt from 'bcryptjs';
import CryptoJS from 'crypto-js';
import DOMPurify from 'dompurify';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'AR_ENTERPRISES_2025_SECURE_KEY_32CH';

// ============================================================
// PASSWORD HASHING
// ============================================================
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// DATA ENCRYPTION
// ============================================================
export function encryptData(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (err) {
    console.error('Encryption error:', err);
    return '';
  }
}

export function decryptData(encryptedData: string): any {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (err) {
    console.error('Decryption error:', err);
    return null;
  }
}

// ============================================================
// INPUT SANITIZATION
// ============================================================
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] });
}

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html);
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================
export interface Session {
  user: any;
  loginTime: string;
  expiresAt: string;
  deviceId: string;
}

export function createSession(user: any, hoursValid: number = 8): Session {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hoursValid * 60 * 60 * 1000);
  
  return {
    user,
    loginTime: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deviceId: getDeviceId()
  };
}

export function isSessionValid(session: Session): boolean {
  const now = new Date();
  const expires = new Date(session.expiresAt);
  return now < expires;
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('AR_DEVICE_ID');
  if (!deviceId) {
    deviceId = 'DEV_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    localStorage.setItem('AR_DEVICE_ID', deviceId);
  }
  return deviceId;
}
