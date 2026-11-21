import {
  Book, Calculator, ChefHat, Cpu, Dumbbell, FlaskConical, Globe, Landmark, Languages, Leaf, Music, Palette,
} from "lucide-react";
import { autoCover, coverBackground, type CoverIcon, type CoverInput } from "@/lib/textbook-cover";
import { cn } from "@/lib/utils";

const ICONS: Record<CoverIcon, typeof Book> = {
  book: Book, calculator: Calculator, flask: FlaskConical, globe: Globe, languages: Languages,
  landmark: Landmark, music: Music, palette: Palette, dumbbell: Dumbbell, cpu: Cpu, leaf: Leaf, chef: ChefHat,
};

interface Props extends CoverInput {
  variant?: "card" | "banner";
  className?: string;
  children?: React.ReactNode;
}

/** Decorative automatic cover; the title is always rendered as real text elsewhere or via children. */
const TextbookCover = ({ variant = "card", className, children, ...input }: Props) => {
  const { gradient, icon } = autoCover(input);
  const Icon = ICONS[icon];
  const banner = variant === "banner";
  return (
    <div
      className={cn(
        "textbook-cover relative overflow-hidden text-[hsl(var(--dashboard-tile-foreground))]",
        banner ? "aspect-[16/7] sm:aspect-[16/5] rounded-2xl" : "aspect-[4/3] rounded-t-2xl",
        className,
      )}
      style={{ background: coverBackground(gradient) }}
      data-cover-gradient={gradient}
    >
      <Icon aria-hidden="true" className={cn("absolute opacity-20", banner ? "-right-6 -bottom-10 h-56 w-56" : "-right-4 -bottom-6 h-28 w-28")} />
      <Icon aria-hidden="true" className={cn("absolute", banner ? "left-6 top-6 h-10 w-10" : "left-4 top-4 h-8 w-8")} />
      {children}
    </div>
  );
};

export default TextbookCover;
