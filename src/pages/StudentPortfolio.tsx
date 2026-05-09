import { useEffect, useState, useCallback } from "react";
import SiteHeader from "@/components/SiteHeader";
import PortfolioTimeline from "@/components/portfolio/PortfolioTimeline";
import AddPortfolioItemDialog from "@/components/portfolio/AddPortfolioItemDialog";
import { Button } from "@/components/ui/button";
import { Download, FolderOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loadFullPortfolio, PortfolioItem, TYPE_LABEL } from "@/lib/portfolio";
import { downloadHtmlAsPdf } from "@/lib/html-to-pdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function StudentPortfolio() {
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await loadFullPortfolio(user.id);
    setItems(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfileName(`${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
      });
  }, [user, refresh]);

  const exportPdf = async () => {
    if (items.length === 0) { toast.error("Portfolio je prázdné"); return; }
    const rows = items.map((i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;white-space:nowrap;">
          ${new Date(i.created_at).toLocaleDateString("cs-CZ")}
        </td>
        <td style="padding:8px;border-bottom:1px solid #ddd;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(i.title)}</div>
          <div style="font-size:11px;color:#666;">${TYPE_LABEL[i.type] || i.type}${i.subject ? " · " + escapeHtml(i.subject) : ""}</div>
          ${i.description ? `<div style="font-size:12px;margin-top:4px;">${escapeHtml(i.description)}</div>` : ""}
          ${i.type === "worksheet_result" && i.content_json?.score != null
            ? `<div style="font-size:12px;margin-top:4px;">Skóre: <b>${i.content_json.score}${i.content_json.max_score ? " / " + i.content_json.max_score : ""}</b></div>`
            : ""}
        </td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Portfolio</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;color:#222;padding:24px;}
        h1{font-size:22px;margin:0 0 4px;}
        .sub{color:#666;font-size:13px;margin-bottom:18px;}
        table{width:100%;border-collapse:collapse;}
      </style></head><body>
      <h1>Portfolio${profileName ? " — " + escapeHtml(profileName) : ""}</h1>
      <div class="sub">Vygenerováno ${new Date().toLocaleDateString("cs-CZ")} · ${items.length} položek</div>
      <table>${rows}</table>
    </body></html>`;
    await downloadHtmlAsPdf({ html, filename: `portfolio-${(profileName || "zak").toLowerCase().replace(/\s+/g, "-")}.pdf` });
  };

  return (
    <>
      <SiteHeader />
      <main className="pt-24 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Tvoje portfolio</h1>
              <p className="text-sm text-muted-foreground">
                Sbírka tvých výsledků, projektů, reflexí a úspěchů.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={exportPdf}>
              <Download className="w-4 h-4" /> Exportovat portfolio
            </Button>
            {user && <AddPortfolioItemDialog studentId={user.id} onAdded={refresh} />}
          </div>
        </header>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Načítám…</p>
        ) : (
          <PortfolioTimeline items={items} canDelete onItemDeleted={refresh} />
        )}
      </main>
    </>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
