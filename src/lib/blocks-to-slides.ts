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

function getText(props: any): string {
  return stripHtml(props.text || props.html || props.content || props.value || "");
}

function blockToBodyText(block: any): { text: string; assetRef?: string; activitySpec?: any; tableData?: any; cardData?: any } {
  const type = block.type;
  const props = block.props || {};
  switch (type) {
    case "paragraph":
    case "rich_text":
    case "callout":
    case "quote":
      return { text: getText(props) };
    case "bullet_list":
    case "bulletList": {
      const items = props.items || props.bullets || [];
      if (Array.isArray(items) && items.length > 0) {
        return { text: items.map((i: any) => `• ${typeof i === "string" ? i : i.text || i}`).join("\n") };
      }
      return { text: stripHtml(props.html || "") };
    }
    case "table": {
      const headers: string[] = props.headers || [];
      const rows: string[][] = props.rows || [];
      const headerLine = headers.join(" | ");
      const separator = headers.map(() => "---").join(" | ");
      const rowLines = rows.map((row: string[]) => row.join(" | ")).join("\n");
      const text = [headerLine, separator, rowLines].filter(Boolean).join("\n");
      return { text, tableData: { headers, rows } };
    }
    case "two_column":
    case "twoColumn": {
      const left = props.leftText || props.left || "";
      const right = props.rightText || props.right || "";
      return { text: `${stripHtml(left)}\n\n${stripHtml(right)}`.trim() };
    }
    case "card_grid": {
      const cards = props.cards || [];
      const text = cards.map((c: any) => `• ${c.title || ""}${c.text ? ": " + stripHtml(c.text) : ""}`).join("\n");
      return { text, cardData: cards };
    }
    case "accordion": {
      const items = props.items || [];
      return {
        text: items.map((item: any) => `▸ ${item.title || ""}\n${stripHtml(item.content || item.text || "")}`).join("\n\n"),
      };
    }
    case "summary": {
      const items = props.items || props.points || [];
      const text = Array.isArray(items) && items.length > 0
        ? items.map((i: any) => `✓ ${typeof i === "string" ? i : i.text || i}`).join("\n")
        : stripHtml(props.html || props.text || "");
      return { text };
    }
    case "image":
      return { text: stripHtml(props.caption || ""), assetRef: props.url || props.src || "" };
    case "image_text":
      return { text: stripHtml(props.text || props.html || ""), assetRef: props.imageUrl || props.url || "" };
    case "gallery": {
      const images = props.images || [];
      const firstUrl = images[0]?.url || "";
      return { text: images.length > 0 ? `Galerie (${images.length} obrázků)` : "", assetRef: firstUrl };
    }
    case "youtube": {
      const url = props.url || props.videoUrl || "";
      const title = props.title || "";
      return { text: [title, url ? `Video: ${url}` : ""].filter(Boolean).join("\n") };
    }
    case "activity": {
      const title = props.title || props.question || props.activityType || "Aktivita";
      const instructions = props.instructions || "";
      return { text: [title, instructions].filter(Boolean).join("\n"), activitySpec: props };
    }
    default:
      return { text: "" };
  }
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
  let current: any = null;

  const flush = () => {
    if (current && (current.projector.headline || current.projector.body || (current.projector.assetRefs && current.projector.assetRefs.length))) {
      current.slideId = `slide-${slideIndex++}`;
      slides.push(current);
    }
    current = null;
  };

  const newSlide = (headline = "") => ({
    slideId: "",
    type: "explain",
    projector: { headline, body: "", assetRefs: [] as string[] },
    device: { instructions: "Sledujte výklad." },
    teacherNotes: "",
  });

  const appendBody = (text: string) => {
    if (!text) return;
    current.projector.body = current.projector.body
      ? `${current.projector.body}\n\n${text}`
      : text;
  };

  for (const block of (blocks || [])) {
    if (!block || block.visible === false) continue;
    const type = block.type;
    const props = block.props || {};

    if (type === "divider") {
      flush();
      continue;
    }

    if (type === "heading") {
      flush();
      const headline = getText(props);
      if (!headline) continue;
      current = newSlide(headline);
      continue;
    }

    if (!current) current = newSlide("");

    const converted = blockToBodyText(block);
    appendBody(converted.text);
    if (converted.assetRef) current.projector.assetRefs.push(converted.assetRef);
    if (converted.activitySpec) {
      current.type = "activity";
      current.activitySpec = converted.activitySpec;
    }
    if (converted.tableData) current.tableData = converted.tableData;
    if (converted.cardData) current.cardData = converted.cardData;
  }

  flush();

  slides.push({
    slideId: "slide-summary",
    type: "summary",
    projector: { headline: "Shrnutí", body: `Lekce: ${lessonTitle}` },
    device: { instructions: "Zkontrolujte si znalosti." },
    teacherNotes: "",
  });

  return slides;
}
