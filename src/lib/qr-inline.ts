import QRCode from "qrcode";

/**
 * Synchronně vygeneruje QR kód jako inline SVG data URL.
 * Používá lokální knihovnu "qrcode" (žádná externí služba) —
 * funguje offline i za školním firewallem.
 */
export function qrSvgDataUrl(text: string, size = 150, margin = 2): string {
  if (!text) return "";
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const count: number = (qr.modules as any).size;
    const data: Uint8Array | boolean[] = (qr.modules as any).data;
    const dim = count + margin * 2;

    let path = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (data[row * count + col]) {
          path += `M${col + margin} ${row + margin}h1v1h-1z`;
        }
      }
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
      `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
      `<path d="${path}" fill="#000000"/>` +
      `</svg>`;

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  } catch {
    return "";
  }
}
