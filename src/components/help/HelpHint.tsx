import { useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDemoPair } from "@/lib/demo";
import { academyHref, DEMO_ACADEMY_TEXT, getHelpHint } from "@/lib/help-hints";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  role?: "teacher" | "student";
  className?: string;
  /** Světlá ikona na tmavém podkladu (živá prezentace). */
  tone?: "default" | "light";
}

/** Otazníček s krátkou nápovědou; otevírá se klepnutím, Esc / klik mimo zavře. */
export function HelpHint({ id, role = "teacher", className, tone = "default" }: Props) {
  const entry = getHelpHint(id);
  const pair = useDemoPair();
  const [open, setOpen] = useState(false);
  if (!entry) return null;
  const isDemo = !!pair;
  const href = academyHref(entry, { isDemo, role });
  const showDemoExplain = isDemo && !!entry.academy && !href;
  const titleId = `help-hint-${id.replace(/\W/g, "-")}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Nápověda: ${entry.title}`}
          data-help-hint={id}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle",
            "before:absolute before:-inset-3 before:content-['']",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone === "light" ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-labelledby={titleId} className="w-[min(20rem,calc(100vw-2rem))] space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
        <p id={titleId} className="font-semibold text-foreground">{entry.title}</p>
        <p className="text-muted-foreground">{isDemo && entry.demo?.body ? entry.demo.body : entry.body}</p>
        {entry.when && <p className="text-muted-foreground"><span className="font-medium text-foreground">Kdy použít: </span>{entry.when}</p>}
        {href && (
          <Link to={href} onClick={() => setOpen(false)} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-2">
            Zjistit víc v Akademii
          </Link>
        )}
        {showDemoExplain && <p className="text-xs text-muted-foreground">{DEMO_ACADEMY_TEXT}</p>}
      </PopoverContent>
    </Popover>
  );
}

export default HelpHint;
