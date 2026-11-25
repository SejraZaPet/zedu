/**
 * Pure helpers for the raw PDF text fallback (pdf-text-raw.worker.ts).
 *
 * Many PDFs (Word/PowerPoint exports, Identity-H fonts) store text as
 * 2-byte big-endian codes. Reading them byte-by-byte as Latin-1 keeps only
 * the low byte, so Czech letters break: ř (U+0159) → "Y", š (U+0161) → "a",
 * ů (U+016F) → "o", ž (U+017E) → "~", ě (U+011B) → control char. Plain
 * Latin-1 letters (á é í ý) survive, which is why only háčky broke.
 */

/** Undo PDF literal-string escapes; result is a "byte string" (chars 0–255). */
export function unescapePdfLiteral(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") { out += ch; continue; }
    const next = s[i + 1];
    if (next === undefined) break;
    if (next === "n") { out += "\n"; i++; }
    else if (next === "r") { out += "\r"; i++; }
    else if (next === "t") { out += "\t"; i++; }
    else if (next === "b") { out += "\b"; i++; }
    else if (next === "f") { out += "\f"; i++; }
    else if (next === "(" || next === ")" || next === "\\") { out += next; i++; }
    else if (next === "\r" || next === "\n") {
      // line continuation
      i++;
      if (next === "\r" && s[i + 1] === "\n") i++;
    } else if (next >= "0" && next <= "7") {
      let oct = next;
      if (s[i + 2] && s[i + 2] >= "0" && s[i + 2] <= "7") { oct += s[i + 2]; i++; }
      if (s[i + 2] && s[i + 2] >= "0" && s[i + 2] <= "7") { oct += s[i + 2]; i++; }
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
      i++;
    } else {
      out += next; i++;
    }
  }
  return out;
}

/**
 * Detects whether a byte string is UTF-16BE: explicit BOM, or an even
 * length where most high bytes are 0x00/0x01–0x05 (Latin + Latin Extended).
 */
export function looksLikeUtf16be(bytes: string): boolean {
  if (bytes.length >= 2 && bytes.charCodeAt(0) === 0xfe && bytes.charCodeAt(1) === 0xff) return true;
  if (bytes.length < 2 || bytes.length % 2 !== 0) return false;
  let pairs = 0;
  let lowHigh = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    pairs++;
    const hi = bytes.charCodeAt(i);
    if (hi <= 0x05) lowHigh++;
  }
  // Real 1-byte text practically never has a control byte at every even position.
  return lowHigh / pairs >= 0.9 && bytes.split("").some((c, i) => i % 2 === 0 && c.charCodeAt(0) === 0);
}

function decodeUtf16be(bytes: string): string {
  let start = 0;
  if (bytes.charCodeAt(0) === 0xfe && bytes.charCodeAt(1) === 0xff) start = 2;
  let out = "";
  for (let i = start; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1));
  }
  return out;
}

/** Converts one PDF text string (already unescaped) into Unicode text. */
export function decodePdfTextBytes(bytes: string): string {
  const text = looksLikeUtf16be(bytes) ? decodeUtf16be(bytes) : bytes;
  // Drop leftover control chars (keep tab/newline) so garbage never reaches lessons.
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").normalize("NFC");
}

export function decodePdfLiteral(s: string): string {
  return decodePdfTextBytes(unescapePdfLiteral(s));
}
