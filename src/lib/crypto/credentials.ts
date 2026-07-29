import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.CREDENTIAL_ENCRYPTION_KEY ?? '';

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
  }
  return Buffer.from(KEY_HEX.slice(0, 32), 'utf8');
}

export function encryptPassword(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + ciphertext → base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptPassword(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
