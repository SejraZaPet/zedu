import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Copy, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Textbook {
  id: string;
  title: string;
  description: string;
  subject: string;
  access_code: string;
  visibility: string;
  created_at: string;
}

interface Props {
  textbooks: Textbook[];
  loading: boolean;
  subjects: any[];
  onOpen: (tb: Textbook) => void;
  onCreate: () => void;
}

const TextbookList = ({ textbooks, loading, subjects, onOpen }: Props) => {
  const { toast } = useToast();
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: `Kód ${code} zkopírován do schránky.` });
  };

  if (loading) return <p className="text-muted-foreground">Načítání...</p>;

  if (textbooks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
        <p className="text-muted-foreground mb-4">Učebnice se vytvoří automaticky, když přidáte nový předmět v administraci.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {textbooks.map((tb) => {
        const matchedSubject = subjects?.find(s => s.slug === tb.subject);
        return (
          <div key={tb.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {matchedSubject && (
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: matchedSubject.color }} />
                  )}
                  <h3 className="font-heading font-semibold text-lg truncate">{tb.title}</h3>
                </div>
                {matchedSubject && (
                  <div className="flex gap-1 mt-1">
                    {matchedSubject.grades.map((g: any) => (
                      <Badge key={g.id} variant="secondary" className="text-[10px] px-1.5 py-0">{g.label}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {tb.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tb.description}</p>}
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
                <span className="text-xs text-muted-foreground">Kód:</span>
                <span className="font-mono text-sm font-bold text-primary">{tb.access_code}</span>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(tb.access_code)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpen(tb)} className="gap-1">
                <Eye className="w-4 h-4" /> Detail
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TextbookList;
