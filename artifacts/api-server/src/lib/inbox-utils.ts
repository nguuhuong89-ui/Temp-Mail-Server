import { customAlphabet } from "nanoid";

const wordAlphabet = "abcdefghijkmnpqrstuvwxyz23456789";
const localPartGen = customAlphabet(wordAlphabet, 10);
const tokenGen = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789",
  32,
);

export function generateLocalPart(): string {
  return localPartGen();
}

export function generateToken(): string {
  return tokenGen();
}

export function defaultExpiry(minutes = 30): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isValidLocalPart(s: string): boolean {
  return /^[a-z0-9._-]{1,32}$/i.test(s);
}

export function makePreview(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "\u2026";
}
