import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z2-7]+$/.test(clean)) {
    throw new Error("Invalid base32 secret");
  }
  let bits = "";
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export type TotpOptions = {
  digits?: number;
  period?: number;
  algorithm?: "sha1" | "sha256" | "sha512";
  timestamp?: number;
};

export function generateTotp(secret: string, opts: TotpOptions = {}): {
  code: string;
  remainingSeconds: number;
  period: number;
} {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
  const algorithm = opts.algorithm ?? "sha1";
  const now = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);

  const key = decodeBase32(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac(algorithm, key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = binary % 10 ** digits;
  return {
    code: otp.toString().padStart(digits, "0"),
    remainingSeconds: period - (now % period),
    period,
  };
}

export function parseOtpAuthUri(input: string): { secret: string; digits?: number; period?: number; algorithm?: "sha1" | "sha256" | "sha512" } | null {
  const trimmed = input.trim();
  if (!trimmed.toLowerCase().startsWith("otpauth://")) return null;
  try {
    const url = new URL(trimmed);
    const secret = url.searchParams.get("secret");
    if (!secret) return null;
    const out: ReturnType<typeof parseOtpAuthUri> = { secret };
    const digits = url.searchParams.get("digits");
    if (digits) out!.digits = parseInt(digits, 10);
    const period = url.searchParams.get("period");
    if (period) out!.period = parseInt(period, 10);
    const algorithm = url.searchParams.get("algorithm");
    if (algorithm) {
      const a = algorithm.toLowerCase();
      if (a === "sha1" || a === "sha256" || a === "sha512") out!.algorithm = a;
    }
    return out;
  } catch {
    return null;
  }
}
