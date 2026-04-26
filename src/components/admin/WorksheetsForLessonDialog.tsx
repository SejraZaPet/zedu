import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

export interface WorksheetForLessonItem {
  id: string;
  title: string;
  status: "draft" | "published" | "scheduled" | string;
  updated_at: string;
  item_count?: number;
  teacher_id?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  lessonType: "global" | "teacher";
  lessonTitle: string;
  worksheets: WorksheetForLessonItem[];
  onCreateNew: () => void;
}

function statusLabel(status: string) {
  if (status === "published") return { label: "Publikováno", variant: "default" as const };
  if (status === "scheduled") return { label: "Naplánováno", variant: "outline" as const };
  return { label: "Koncept", variant: "secondary" as const };
}

export default function WorksheetsForLessonDialog({
  open,
  onOpenChange,
  lessonTitle,
  worksheets,
  onCreateNew,
}: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pracovní listy k lekci: {lessonTitle}</DialogTitle>
          <DialogDescription>
            Vyber existující pracovní list nebo vytvoř nový.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "60vh" }}>
          {worksheets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Žádné pracovní listy zatím nejsou napojeny na tuto lekci.
            </div>
          ) : (
            worksheets.map((w) => {
              const s = statusLabel(w.status);
              return (
                <div
                  key={w.id}
                  className="border border-border rounded-lg p-4 bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold leading-tight flex-1">{w.title}</h4>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Upraveno{" "}
                    {formatDistanceToNow(new Date(w.updated_at), {
                      addSuffix: true,
                      locale: cs,
                    })}
                    {typeof w.item_count === "number" && (
                      <> · {w.item_count} otázek</>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/ucitel/pracovni-listy/${w.id}`);
                      }}
                    >
                      Otevřít
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            toast({ title: "Brzy bude k dispozici" })
                          }
                        >
                          Duplikovat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            toast({ title: "Brzy bude k dispozici" })
                          }
                        >
                          Smazat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button onClick={onCreateNew} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Vytvořit nový pracovní list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
