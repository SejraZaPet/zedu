import { useState } from "react";
import { extractPdfEmbeddedImages } from "@/lib/pdf-page-renderer";

export default function PdfDiag() {
  const [status, setStatus] = useState("idle");
  const [count, setCount] = useState(0);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setStatus("running");
    try {
      const blobs = await extractPdfEmbeddedImages(f, { debug: true });
      setCount(blobs.length);
      setStatus("done");
      (window as any).__pdfDiagDone = true;
      (window as any).__pdfDiagCount = blobs.length;
    } catch (err) {
      console.log("[pdf-img-extract] TOP-LEVEL ERROR", err);
      setStatus("error");
      (window as any).__pdfDiagDone = true;
      (window as any).__pdfDiagError = String(err);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <h1>PDF Diag</h1>
      <input type="file" accept="application/pdf" onChange={onFile} data-testid="pdf-input" />
      <div>Status: <span data-testid="status">{status}</span></div>
      <div>Images: <span data-testid="count">{count}</span></div>
    </div>
  );
}
