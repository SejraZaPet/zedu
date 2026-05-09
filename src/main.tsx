import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker for Web Push.
// Skip inside the Lovable editor preview (iframe) — SWs cause stale-content issues there.
if ("serviceWorker" in navigator) {
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const host = window.location.hostname;
  const isPreview =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.dev");

  if (inIframe || isPreview) {
    // Clean up any leftover SW from earlier experiments to avoid stale builds in preview.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[sw] register failed", e));
    });
  }
}
