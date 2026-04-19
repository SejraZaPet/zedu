function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function blocksToSlides(blocks: any[], lessonTitle: string): any[] {
  console.log("[blocksToSlides] input:", { lessonTitle, blockCount: blocks?.length, blocks });

  const slides: any[] = [];

  slides.push({
    slideId: "slide-intro",
    type: "intro",
    projector: { headline: lessonTitle, body: "Připojte se pomocí kódu níže." },
    device: { instructions: "Naskenujte QR kód nebo zadejte kód pro připojení." },
    teacherNotes: "",
  });

  let slideIndex = 1;
  for (const block of (blocks || [])) {
    if (!block || block.visible === false) continue;
    const type = block.type;
    const props = block.props || {};
    console.log("[blocksToSlides] block:", { type, props });

    if (type === "heading") {
      const text = props.text || stripHtml(props.html || "") || props.content || props.value || "";
      if (!text) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: text, body: "" },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "paragraph") {
      const text = props.text || stripHtml(props.html || "") || props.content || props.value || "";
      if (!text) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: "", body: text },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "bullet_list" || type === "bulletList") {
      const rawItems = props.items || props.bullets || [];
      const itemsText = Array.isArray(rawItems) && rawItems.filter((i: any) => (typeof i === "string" ? i.trim() : i)).length > 0
        ? rawItems.map((i: any) => `• ${typeof i === "string" ? i : i.text || i}`).join("\n")
        : stripHtml(props.html || "");
      const title = props.title || props.heading || "";
      const body = itemsText;
      if (!title && !body) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: title, body },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "activity") {
      const title = props.title || props.activityType || "Aktivita";
      const instructions = props.instructions || "";
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "activity",
        projector: { headline: title, body: instructions },
        device: { instructions: instructions || "Splňte aktivitu na svém zařízení." },
        teacherNotes: "",
        activitySpec: props,
      });
    } else if (type === "image") {
      const caption = props.caption || props.alt || "";
      const url = props.url || props.src || "";
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: caption, body: "", assetRefs: url ? [url] : [] },
        device: { instructions: "Prohlédněte si obrázek." },
        teacherNotes: "",
      });
    } else if (type === "callout" || type === "quote") {
      const text = props.text || stripHtml(props.html || "") || props.content || props.value || "";
      if (!text) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: "", body: text },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "two_column" || type === "twoColumn") {
      const left = props.leftText || props.left || "";
      const right = props.rightText || props.right || "";
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: props.title || "", body: `${left}\n\n${right}`.trim() },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    }
  }

  slides.push({
    slideId: "slide-summary",
    type: "summary",
    projector: { headline: "Shrnutí", body: `Lekce: ${lessonTitle}` },
    device: { instructions: "Zkontrolujte si znalosti." },
    teacherNotes: "",
  });

  console.log("[blocksToSlides] output slides:", slides.length, slides);
  return slides;
}
