/**
 * Heuristic verification-code extractor.
 *
 * Strategy (in order):
 *  1. If caller provides a custom regex `pattern`, run it and return the first
 *     capture group (or full match) — caller knows best.
 *  2. Look for a code on the same line / nearby a context keyword like
 *     "code", "verification", "verify", "OTP", "PIN", "mã" (Vietnamese),
 *     "passcode", "security". This avoids false positives like phone numbers
 *     in footers or order ids.
 *  3. Fall back to the longest plausible numeric/alphanumeric token in the
 *     first ~500 chars of the body (most OTPs appear early).
 *
 * Code shapes recognised:
 *   - 4–8 digits:        `123456`
 *   - 6–8 digits split:  `123-456`, `123 456`
 *   - 6–10 alnum upper:  `A1B2C3`
 */

export type ExtractedCode = {
  code: string;
  /** Where the code was found: "context" | "fallback" | "custom" */
  source: "context" | "fallback" | "custom";
};

const CONTEXT_RE =
  /\b(?:code|verification|verify|otp|one[\s-]?time|passcode|pin|security|confirm(?:ation)?|m[ãa])\b/i;

// 4–8 digits, optionally separated by space or dash mid-way (e.g. "123-456").
const DIGIT_CODE_RE = /\b(\d{3,4}[\s-]?\d{3,4}|\d{4,8})\b/g;

// 6–10 alphanumeric. Caller filters for letter+digit mix.
const ALNUM_CODE_RE = /\b([A-Z0-9]{6,10})\b/g;

// Patterns that look like real codes but are usually NOT OTPs.
// Year-like 4-digit numbers (1900–2099) and obvious phone fragments.
const NOT_A_CODE = /^(?:19|20)\d{2}$/;

function normalise(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

function scoreDigitCode(raw: string): number {
  const n = normalise(raw);
  if (NOT_A_CODE.test(n)) return -1;
  // Prefer 6 digits (most common OTP length), then 4, 5, 7, 8.
  const lenScore = { 6: 100, 4: 70, 5: 70, 7: 70, 8: 60 }[n.length] ?? 30;
  // Bonus if the original used a separator (looks intentional).
  const sepBonus = raw.includes("-") || raw.includes(" ") ? 5 : 0;
  return lenScore + sepBonus;
}

function findCodeNear(line: string): string | null {
  let best: { code: string; score: number } | null = null;
  for (const m of line.matchAll(DIGIT_CODE_RE)) {
    const raw = m[1];
    if (!raw) continue;
    const score = scoreDigitCode(raw);
    if (score < 0) continue;
    if (!best || score > best.score) best = { code: normalise(raw), score };
  }
  if (best) return best.code;
  for (const a of line.matchAll(ALNUM_CODE_RE)) {
    const tok = a[1];
    if (!tok) continue;
    if (/\d/.test(tok) && /[A-Z]/.test(tok)) return tok;
  }
  return null;
}

export function extractCode(
  bodyText: string,
  customPattern?: string,
): ExtractedCode | null {
  if (!bodyText) return null;
  const text = bodyText.slice(0, 4000); // cap work

  if (customPattern) {
    try {
      const re = new RegExp(customPattern, "i");
      const m = text.match(re);
      if (m) return { code: (m[1] ?? m[0]).trim(), source: "custom" };
    } catch {
      // invalid user-supplied regex — fall through
    }
  }

  const lines = text.split(/\r?\n/);
  // Pass 1: lines that mention a context keyword.
  for (const line of lines) {
    if (CONTEXT_RE.test(line)) {
      const c = findCodeNear(line);
      if (c) return { code: c, source: "context" };
    }
  }
  // Pass 2: also look at the line directly after a context-only line
  // (e.g. "Your verification code is:\n123456").
  for (let i = 0; i < lines.length - 1; i++) {
    if (CONTEXT_RE.test(lines[i] ?? "") && !findCodeNear(lines[i] ?? "")) {
      const c = findCodeNear(lines[i + 1] ?? "");
      if (c) return { code: c, source: "context" };
    }
  }
  // Pass 3: any code in the first 500 chars.
  const head = text.slice(0, 500);
  const c = findCodeNear(head);
  if (c) return { code: c, source: "fallback" };
  return null;
}

export function extractCodeFromEmail(
  email: { subject: string | null; textBody: string | null; htmlBody: string | null },
  customPattern?: string,
): ExtractedCode | null {
  // Prefer text body; fall back to subject; lastly strip HTML tags from html.
  const subj = email.subject ?? "";
  const text = email.textBody ?? "";
  const html = (email.htmlBody ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const combined = [subj, text, html].filter(Boolean).join("\n");
  return extractCode(combined, customPattern);
}
