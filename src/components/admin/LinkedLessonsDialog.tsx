import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";

export interface LessonChoice {
  id: string;
  title: string;
  type: "global" | "teacher";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allLessons: LessonChoice[];
  alreadyLinkedKeys: Set<string>; // `${type}-${id}`
  onConfirm: (selected: LessonChoice[]) => void;
}

export default function LinkedLessonsDialog({
  open,
  onOpenChange,
  allLessons,
  alreadyLinkedKeys,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, LessonChoice>>({});

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLessons.filter((l) => {
      const key = `${l.type}-${l.id}`;
      if (alreadyLinkedKeys.has(key)) return false;
      if (!q) return true;
      return l.title.toLowerCase().includes(q);
    });
  }, [allLessons, query, alreadyLinkedKeys]);

  function toggle(l: LessonChoice) {
    const key = `${l.type}-${l.id}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = l;
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Object.values(selected));
    setSelected({});
    setQuery("");
    onOpenChange(false);
  }

  function handleCancel() {
    setSelected({});
    setQuery("");
    onOpenChange(false);
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleCancel())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Připojit lekce k pracovnímu listu</DialogTitle>
          <DialogDescription>
            Vyber lekce, ke kterým má tento pracovní list patřit.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat lekci…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto border border-border rounded-md divide-y divide-border">
          {available.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Žádné další lekce k připojení.
            </div>
          ) : (
            available.map((l) => {
              const key = `${l.type}-${l.id}`;
              const isChecked = !!selected[key];
              return (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox checked={isChecked} onCheckedChange={() => toggle(l)} />
                  <Badge
                    variant={l.type === "global" ? "secondary" : "outline"}
                    className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                  >
                    {l.type === "global" ? "Globální" : "Vlastní"}
                  </Badge>
                  <span className="text-sm truncate flex-1">{l.title}</span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Zrušit
          </Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            Přidat {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
