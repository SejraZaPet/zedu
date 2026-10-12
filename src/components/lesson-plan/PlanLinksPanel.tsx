import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ClipboardList, FileText, Image as ImageIcon, Link2, ListChecks, Paperclip, Presentation, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PublishWorksheetDialog from "@/components/worksheet/PublishWorksheetDialog";
import { mediaKindOf, normalizeUrl, signedMaterialUrl, type AssignmentMaterial } from "@/lib/assignment-materials";
import { WORKSHEET_STATE_LABEL } from "@/lib/plan-worksheets";
import { ASSIGNMENT_STATUS_LABEL, hasPlanLinks, type PlanLinks, type PlanLinkWorksheet } from "@/lib/plan-links";
import { formatDeadline } from "@/lib/lesson-worksheets";

export function materialIcon(m: AssignmentMaterial) {
  if (m.kind === "link") return Link2;
  return mediaKindOf(m) === "image" ? ImageIcon : FileText;
}

export async function openMaterial(m: AssignmentMaterial) {
  if (m.kind === "link" && m.url) { window.open(normalizeUrl(m.url), "_blank", "noopener"); return; }
  if (!m.path) return;
  const w = window.open("", "_blank");
  const url = await signedMaterialUrl(m.path);
  if (url && w) w.location.href = url; else w?.close();
}

const chip = "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Panel „K této hodině“ nahoře v plánu. Nic nevykreslí, když k hodině nic není. */
export default function PlanLinksPanel({ links, onChanged }: { links: PlanLinks | null; onChanged?: () => void }) {
  const [publishing, setPublishing] = useState<PlanLinkWorksheet | null>(null);
  if (!links || !hasPlanLinks(links)) return null;
  const Group = ({ icon: Icon, label, count, children }: any) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label} <span>({count})</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
  return (
    <section aria-label="K této hodině" data-testid="plan-links-panel" className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
      <h2 className="text-sm font-semibold">K této hodině</h2>
      {links.lesson && (
        <Group icon={BookOpen} label="Lekce z učebnice" count={1}>
          <Link to={links.lesson.href} className={chip} data-testid="link-lesson">
            <BookOpen className="h-4 w-4" aria-hidden />
            {links.lesson.title}{links.lesson.textbook ? <span className="text-muted-foreground"> · {links.lesson.textbook}</span> : null}
          </Link>
        </Group>
      )}
      {links.worksheets.length > 0 && (
        <Group icon={ClipboardList} label="Pracovní listy" count={links.worksheets.length}>
          {links.worksheets.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1">
              <Link to={w.href} className={chip} data-testid="link-worksheet">
                <ClipboardList className="h-4 w-4" aria-hidden /> {w.title}
                <Badge variant={w.state === "published" ? "default" : "secondary"}>{WORKSHEET_STATE_LABEL[w.state]}</Badge>
              </Link>
              {w.state === "draft" && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setPublishing(w)}>
                  <Send className="mr-1 h-3 w-3" /> Publikovat
                </Button>
              )}
            </span>
          ))}
        </Group>
      )}
      {links.materials.length > 0 && (
        <Group icon={Paperclip} label="Přílohy" count={links.materials.length}>
          {links.materials.map((m) => {
            const Icon = materialIcon(m);
            return (
              <button key={m.id} type="button" className={chip} onClick={() => void openMaterial(m)} data-testid="link-material">
                <Icon className="h-4 w-4" aria-hidden /> {m.title}
              </button>
            );
          })}
        </Group>
      )}
      {links.assignments.length > 0 && (
        <Group icon={ListChecks} label="Úkoly k hodině" count={links.assignments.length}>
          {links.assignments.map((a) => (
            <Link key={a.id} to={a.href} className={chip} data-testid="link-assignment">
              <ListChecks className="h-4 w-4" aria-hidden /> {a.title}
              <span className="text-xs text-muted-foreground">· {formatDeadline(a.deadline)}</span>
              <Badge variant="outline">{ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
            </Link>
          ))}
        </Group>
      )}
      {links.presentations.length > 0 && (
        <Group icon={Presentation} label="Prezentace" count={links.presentations.length}>
          {links.presentations.map((p) => (
            <Link key={p.id} to={p.href} className={chip} data-testid="link-presentation">
              <Presentation className="h-4 w-4" aria-hidden /> {p.title}
            </Link>
          ))}
        </Group>
      )}
      {publishing && (
        <PublishWorksheetDialog
          open
          onOpenChange={(o) => { if (!o) setPublishing(null); }}
          worksheetId={publishing.id}
          worksheetTitle={publishing.title}
          subjectId={publishing.subject_id}
          onPublished={() => { setPublishing(null); onChanged?.(); }}
        />
      )}
    </section>
  );
}

/** Malé ikonky u řádku hodiny na stránce předmětu (učitel). */
export function PlanLinkIcons({ links }: { links: PlanLinks | null | undefined }) {
  if (!links || !hasPlanLinks(links)) return null;
  const items: { key: string; label: string; icon: any; to?: string; onClick?: () => void }[] = [];
  if (links.lesson) items.push({ key: "l", label: `Lekce: ${links.lesson.title}`, icon: BookOpen, to: links.lesson.href });
  links.worksheets.forEach((w) => items.push({ key: `w${w.id}`, label: `Pracovní list: ${w.title}`, icon: ClipboardList, to: w.href }));
  links.materials.forEach((m) => items.push({ key: `m${m.id}`, label: `Příloha: ${m.title}`, icon: materialIcon(m), onClick: () => void openMaterial(m) }));
  links.assignments.forEach((a) => items.push({ key: `a${a.id}`, label: `Úkol: ${a.title}`, icon: ListChecks, to: a.href }));
  const cls = "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted";
  return (
    <TooltipProvider>
      <span className="inline-flex flex-wrap items-center gap-1" data-testid="plan-link-icons">
        {items.map((it) => {
          const Icon = it.icon;
          const inner = <Icon className="h-3.5 w-3.5" aria-hidden />;
          return (
            <Tooltip key={it.key}>
              <TooltipTrigger asChild>
                {it.to ? (
                  <Link to={it.to} aria-label={it.label} className={cls} onClick={(e) => e.stopPropagation()}>{inner}</Link>
                ) : (
                  <button type="button" aria-label={it.label} className={cls} onClick={(e) => { e.stopPropagation(); it.onClick?.(); }}>{inner}</button>
                )}
              </TooltipTrigger>
              <TooltipContent>{it.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}
