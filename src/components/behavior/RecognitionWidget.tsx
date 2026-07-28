import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BEHAVIOR_CATEGORIES,
  getBehaviorCategoryLabel,
  BEHAVIOR_CATEGORY_MAP,
  type BehaviorCategory,
} from "@/lib/behavior-categories";

interface Props {
  studentId: string;
  studentName?: string;
  title?: string;
  limit?: number;
}

interface Row {
  id: string;
  category: BehaviorCategory;
  note: string | null;
  created_at: string;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "právě teď";
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `před ${Math.floor(diff / 86400)} dny`;
  return d.toLocaleDateString("cs-CZ");
};

const RecognitionWidget = ({ studentId, studentName, title = "Uznání", limit = 5 }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from("behavior_points" as any)
          .select("id, category, note, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("behavior_points" as any)
          .select("id", { count: "exact", head: true })
          .eq("student_id", studentId),
      ]);
      if (!mounted) return;
      setRows((data as any[]) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [studentId, limit]);

  const byCategory = BEHAVIOR_CATEGORIES.map((c) => ({
    ...c,
    count: rows.filter((r) => r.category === c.key).length,
  }));

  return (
    <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            {title}
            {studentName && (
              <span className="text-xs font-normal text-muted-foreground">— {studentName}</span>
            )}
          </span>
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
            {total}×
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Načítání…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím žádná uznání. Kladné návyky přijdou brzy ⭐
          </p>
        ) : (
          <>
            {rows.length > 0 && (
              <ul className="space-y-1.5">
                {rows.map((r) => {
                  const meta = BEHAVIOR_CATEGORY_MAP[r.category];
                  const Icon = meta?.icon ?? Star;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 text-sm bg-card border border-amber-100 dark:border-amber-500/20 rounded-md px-2.5 py-1.5"
                    >
                      <Icon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="flex-1 truncate">
                        {getBehaviorCategoryLabel(r.category)}
                        {r.note && (
                          <span className="text-muted-foreground"> — {r.note}</span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {fmt(r.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-amber-100 dark:border-amber-500/20">
              {byCategory.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-500/10 rounded-full px-2 py-0.5"
                >
                  <c.icon className="w-3 h-3" />
                  {c.label}: {c.count}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RecognitionWidget;
