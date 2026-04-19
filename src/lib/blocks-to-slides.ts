export function blocksToSlides(blocks: any[], lessonTitle: string): any[] {
  const slides: any[] = [];

  slides.push({
    slideId: `slide-intro`,
    type: "intro",
    projector: { headline: lessonTitle, body: "Připojte se pomocí kódu níže." },
    device: { instructions: "Naskenujte QR kód nebo zadejte kód pro připojení." },
    teacherNotes: "",
  });

  let slideIndex = 1;
  for (const block of blocks || []) {
    if (!block || block.visible === false) continue;
    if (block.type === "heading") {
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: block.props?.text || "", body: "" },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (block.type === "paragraph") {
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: "", body: block.props?.text || "" },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (block.type === "activity") {
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "activity",
        projector: { headline: block.props?.title || "Aktivita", body: block.props?.instructions || "" },
        device: { instructions: block.props?.instructions || "Splňte aktivitu na svém zařízení." },
        teacherNotes: "",
        activitySpec: block.props,
      });
    } else if (block.type === "image") {
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: block.props?.caption || "", body: "", assetRefs: [block.props?.url].filter(Boolean) },
        device: { instructions: "Prohlédněte si obrázek." },
        teacherNotes: "",
      });
    } else if (block.type === "bullet_list") {
      const items = (block.props?.items || []).join("\n• ");
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: block.props?.title || "", body: items ? `• ${items}` : "" },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    }
  }

  slides.push({
    slideId: `slide-summary`,
    type: "summary",
    projector: { headline: "Shrnutí", body: `Lekce: ${lessonTitle}` },
    device: { instructions: "Lekce ukončena. Děkujeme!" },
    teacherNotes: "",
  });

  return slides;
}
