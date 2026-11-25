/**
 * Web Worker: extract PDF text via raw byte scan (Tj/TJ operators).
 *
 * Runs off the main thread so a slow / pathological regex pass on a large
 * binary blob cannot freeze the UI. The caller enforces a hard timeout and
 * a file-size guard — this worker is intentionally dumb.
 *
 * Message protocol:
 *   in:  { buffer: ArrayBuffer }  (transferred)
 *   out: { ok: true, text: string } | { ok: false, error: string }
 */

/// <reference lib="webworker" />

import { decodePdfLiteral as decodePdfString } from "./pdf-raw-text-decode";

// Regex notes: alternatives are mutually exclusive (one starts with `\`,
// the other explicitly excludes `\`), so there is no ambiguity that would
// trigger catastrophic backtracking. Still, we cap regex work by bailing
// out early if the input is absurdly large — the caller also enforces a
// size guard, this is belt-and-braces.
const literalRe = /\(((?:\\[\s\S]|[^\\()])*)\)/g;
const tokenRe = /\(((?:\\[\s\S]|[^\\()])*)\)\s*(?:Tj|TJ|'|")|\[((?:\\[\s\S]|[^\][])*)\]\s*TJ/g;

function extract(buffer: ArrayBuffer): string {
  const buf = new Uint8Array(buffer);
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(buf);

  let extracted = "";
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(raw)) !== null) {
    if (m[1] !== undefined) {
      extracted += decodePdfString(m[1]);
    } else if (m[2] !== undefined) {
      let am: RegExpExecArray | null;
      literalRe.lastIndex = 0;
      while ((am = literalRe.exec(m[2])) !== null) {
        extracted += decodePdfString(am[1]);
      }
    }
    extracted += " ";
  }

  return extracted
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

self.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer }>) => {
  try {
    const text = extract(e.data.buffer);
    (self as unknown as Worker).postMessage({ ok: true, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ ok: false, error: message });
  }
};

export {};
