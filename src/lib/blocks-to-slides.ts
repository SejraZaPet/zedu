function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function blocksToSlides(blocks: any[], lessonTitle: string): any[] {
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

    if (type === "heading") {
      const raw = props.text || props.html || props.content || props.value || "";
      const text = stripHtml(raw);
      if (!text) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: text, body: "" },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "paragraph") {
      const raw = props.text || props.html || props.content || props.value || "";
      const text = stripHtml(raw);
      if (!text) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: "", body: text },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "rich_text") {
      const text = stripHtml(props.html || props.text || props.content || "");
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
    } else if (type === "image_text") {
      const text = stripHtml(props.text || props.html || "");
      const imageUrl = props.imageUrl || props.url || "";
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: "", body: text, assetRefs: imageUrl ? [imageUrl] : [] },
        device: { instructions: "Prohlédněte si obrázek a text." },
        teacherNotes: "",
      });
    } else if (type === "callout" || type === "quote") {
      const raw = props.text || props.html || props.content || props.value || "";
      const text = stripHtml(raw);
      if (!text) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: "", body: text },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "table") {
      const headers: string[] = props.headers || [];
      const rows: string[][] = props.rows || [];
      if (headers.length === 0 && rows.length === 0) continue;

      const headerLine = headers.join(" | ");
      const separator = headers.map(() => "---").join(" | ");
      const rowLines = rows.map((row: string[]) => row.join(" | ")).join("\n");
      const tableText = [headerLine, separator, rowLines].filter(Boolean).join("\n");

      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: props.title || "", body: tableText },
        device: { instructions: "Sledujte tabulku." },
        teacherNotes: "",
        tableData: { headers, rows },
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
    } else if (type === "card_grid") {
      const cards = props.cards || [];
      if (cards.length === 0) continue;
      const body = cards.map((c: any) => `• ${c.title || ""}${c.text ? ": " + stripHtml(c.text) : ""}`).join("\n");
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: props.title || "", body },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
        cardData: cards,
      });
    } else if (type === "accordion") {
      const items = props.items || [];
      if (items.length === 0) continue;
      const body = items.map((item: any) => `▸ ${item.title || ""}\n${stripHtml(item.content || item.text || "")}`).join("\n\n");
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: props.title || "", body },
        device: { instructions: "Sledujte výklad." },
        teacherNotes: "",
      });
    } else if (type === "summary") {
      const items = props.items || props.points || [];
      const body = Array.isArray(items) && items.length > 0
        ? items.map((i: any) => `✓ ${typeof i === "string" ? i : i.text || i}`).join("\n")
        : stripHtml(props.html || props.text || "");
      if (!body) continue;
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "summary",
        projector: { headline: props.title || "Shrnutí", body },
        device: { instructions: "Zkontrolujte si znalosti." },
        teacherNotes: "",
      });
    } else if (type === "youtube") {
      const url = props.url || props.videoUrl || "";
      const title = props.title || "Video";
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: title, body: url ? `Video: ${url}` : "" },
        device: { instructions: "Sledujte video." },
        teacherNotes: "",
      });
    } else if (type === "gallery") {
      const images = props.images || [];
      if (images.length === 0) continue;
      const firstUrl = images[0]?.url || "";
      slides.push({
        slideId: `slide-${slideIndex++}`,
        type: "explain",
        projector: { headline: props.title || "", body: `Galerie (${images.length} obrázků)`, assetRefs: firstUrl ? [firstUrl] : [] },
        device: { instructions: "Prohlédněte si obrázky." },
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

  return slides;
}
