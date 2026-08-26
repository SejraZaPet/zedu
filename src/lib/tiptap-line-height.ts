import { Extension } from "@tiptap/core";

export const LINE_HEIGHT_OPTIONS = ["1", "1.2", "1.5", "1.75", "2"] as const;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

/**
 * Řádkování (line-height) jako atribut odstavců a nadpisů.
 * Ukládá se jako inline style, takže se propíše i do čtecího zobrazení.
 */
export const LineHeight = Extension.create<{ types: string[] }>({
  name: "lineHeight",

  addOptions() {
    return { types: ["paragraph", "heading"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) =>
          this.options.types
            .map((type) => commands.updateAttributes(type, { lineHeight: value }))
            .some(Boolean),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          this.options.types
            .map((type) => commands.resetAttributes(type, "lineHeight"))
            .some(Boolean),
    };
  },
});

export default LineHeight;
