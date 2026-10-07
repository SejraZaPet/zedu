import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ALL_SCOPE, ALL_STATUS, type AssignmentStatus, type SubjectOption } from "@/lib/results-filters";

export interface AssignmentFilterTarget { id: string; name: string; subject?: string | null }

export function readAssignmentFilter(key: "scope" | "subject" | "status", fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const stored = window.sessionStorage.getItem(`bezli:assignment-filter:${key}`);
  if (!stored) return fallback;
  if (key === "scope" && stored.startsWith("class:")) return `c:${stored.slice(6)}`;
  if (key === "scope" && stored.startsWith("group:")) return `g:${stored.slice(6)}`;
  return stored;
}

export function saveAssignmentFilter(key: "scope" | "subject" | "status", value: string) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(`bezli:assignment-filter:${key}`, value);
}

export default function AssignmentListFilters({
  classes,
  groups,
  subjects,
  scope,
  subject,
  status,
  counts,
  loading,
  onScopeChange,
  onSubjectChange,
  onStatusChange,
}: {
  classes: AssignmentFilterTarget[];
  groups: AssignmentFilterTarget[];
  subjects: SubjectOption[];
  scope: string;
  subject: string;
  status: string;
  counts: Record<AssignmentStatus | "all", number>;
  loading?: boolean;
  onScopeChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <Label className="text-xs">Třída / skupina</Label>
        <Select value={scope} onValueChange={onScopeChange} disabled={loading}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Všechny" /></SelectTrigger>
          <SelectContent position="popper" className="max-h-72 overflow-y-auto overscroll-contain">
            <SelectItem value={ALL_SCOPE}>Všechny</SelectItem>
            {classes.length > 0 && <SelectGroup><SelectLabel>Třídy</SelectLabel>{classes.map((item) => <SelectItem key={item.id} value={`c:${item.id}`}>{item.name}</SelectItem>)}</SelectGroup>}
            {groups.length > 0 && <><SelectSeparator /><SelectGroup><SelectLabel>Skupiny</SelectLabel>{groups.map((item) => <SelectItem key={item.id} value={`g:${item.id}`}>{item.subject ? `${item.name} · ${item.subject}` : item.name}</SelectItem>)}</SelectGroup></>}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Předmět</Label>
        <Select value={subject} onValueChange={onSubjectChange} disabled={loading}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Všechny předměty" /></SelectTrigger>
          <SelectContent position="popper" className="max-h-72 overflow-y-auto overscroll-contain">
            <SelectItem value={ALL_SCOPE}>Všechny předměty</SelectItem>
            {subjects.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Stav</Label>
        <Select value={status} onValueChange={onStatusChange} disabled={loading}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Všechny" /></SelectTrigger>
          <SelectContent position="popper" className="max-h-72 overflow-y-auto overscroll-contain">
            <SelectItem value={ALL_STATUS}>Všechny ({counts.all})</SelectItem>
            <SelectItem value="published">Publikované ({counts.published})</SelectItem>
            <SelectItem value="scheduled">Naplánované ({counts.scheduled})</SelectItem>
            <SelectItem value="draft">Koncept ({counts.draft})</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}