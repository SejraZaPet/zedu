/** Wait for the print document's pagination, fonts and decoded images, not a fixed delay. */
export async function waitForWorksheetRender(doc: Document, timeoutMs = 20_000): Promise<HTMLElement[]> {
  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const state = doc.body?.dataset.wsRenderState;
      if (state === "error") {
        reject(new Error("Stránky listu se nepodařilo připravit. Zkus vložení znovu."));
      } else if (state === "ready") {
        resolve();
      } else if (Date.now() - started >= timeoutMs) {
        reject(new Error("Načítání stránek listu trvá příliš dlouho. Zkus vložení znovu."));
      } else {
        setTimeout(poll, 25);
      }
    };
    poll();
  });
  await doc.fonts?.ready;
  await Promise.all(Array.from(doc.images).map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve, reject) => {
        const clear = () => {
          clearTimeout(timer);
          image.removeEventListener("load", loaded);
          image.removeEventListener("error", failed);
        };
        const loaded = () => { clear(); resolve(); };
        const failed = () => { clear(); reject(new Error("Obrázek v pracovním listu se nenačetl. Zkus vložení znovu.")); };
        const timer = setTimeout(failed, timeoutMs);
        image.addEventListener("load", loaded, { once: true });
        image.addEventListener("error", failed, { once: true });
      });
    }
    if (image.naturalWidth === 0) {
      throw new Error("Obrázek v pracovním listu se nenačetl. Zkus vložení znovu.");
    }
    if (typeof image.decode === "function") await image.decode();
  }));
  const pages = Array.from(doc.querySelectorAll<HTMLElement>(".ws-page"));
  if (pages.length === 0) throw new Error("List se nepodařilo převést na stránky.");
  return pages;
}