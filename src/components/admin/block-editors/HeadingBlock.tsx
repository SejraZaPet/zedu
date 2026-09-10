import MiniRichEditor from "./MiniRichEditor";
import type { Block } from "@/lib/textbook-config";

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

/** Úroveň nadpisu se nastavuje v plovoucí liště vlastností bloku. */
const HeadingBlock = ({ block, onChange }: Props) => {
  const level = Number(block.props.level) || 2;
  const sizeClass =
    level === 1
      ? "[&_.ProseMirror]:text-[32px] [&_.ProseMirror]:font-bold"
      : level === 3
        ? "[&_.ProseMirror]:text-[20px] [&_.ProseMirror]:font-bold"
        : level === 4
          ? "[&_.ProseMirror]:text-[18px] [&_.ProseMirror]:font-bold"
          : "[&_.ProseMirror]:text-[24px] [&_.ProseMirror]:font-bold";

  return (
    <div className={sizeClass}>
      <MiniRichEditor
        content={block.props.text || ""}
        onChange={(html) => onChange({ ...block.props, text: html })}
        placeholder="Text nadpisu…"
        minHeight="36px"
        showHeadings={false}
        showLists={false}
        showAlign
        bare
      />
    </div>
  );
};

export default HeadingBlock;
