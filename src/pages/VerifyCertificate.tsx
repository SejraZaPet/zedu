import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Award, Calendar, User, GraduationCap, AlertCircle, BookOpen } from "lucide-react";

interface VerifiedCert {
  certificate_number: string;
  issued_at: string;
  course_title: string;
  course_audience: string | null;
  recipient_name: string | null;
}

interface VerifiedPathwayCert {
  certificate_number: string;
  issued_at: string;
  pathway_title: string;
  pathway_description: string | null;
  recipient_name: string | null;
  courses: { id: string; title: string; sort_order: number }[];
}

type Result =
  | { kind: "course"; data: VerifiedCert }
  | { kind: "pathway"; data: VerifiedPathwayCert };

export default function VerifyCertificate() {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!certificateNumber) { setNotFound(true); setLoading(false); return; }
      const isPathway = certificateNumber.startsWith("Bezli-PATHWAY-");
      if (isPathway) {
        const { data, error } = await supabase.rpc("verify_academy_pathway_certificate" as any, {
          _cert_number: certificateNumber,
        });
        if (error || !data || (Array.isArray(data) && data.length === 0)) {
          setNotFound(true);
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          setResult({ kind: "pathway", data: row as VerifiedPathwayCert });
        }
      } else {
        const { data, error } = await supabase.rpc("verify_academy_certificate" as any, {
          _cert_number: certificateNumber,
        });
        if (error || !data || (Array.isArray(data) && data.length === 0)) {
          setNotFound(true);
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          setResult({ kind: "course", data: row as VerifiedCert });
        }
      }
      setLoading(false);
    };
    load();
  }, [certificateNumber]);

  useEffect(() => {
    document.title = result
      ? `Ověřený certifikát ${result.data.certificate_number} – Bezli Akademie`
      : "Ověření certifikátu – Bezli Akademie";
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 flex flex-col">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg tracking-tight">Bezli</Link>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Veřejné ověření certifikátu
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {loading ? (
          <div className="text-muted-foreground">Ověřuji…</div>
        ) : notFound || !result ? (
          <div className="max-w-md text-center bg-card border rounded-2xl p-10 shadow-sm">
            <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <h1 className="text-xl font-semibold mb-1">Certifikát nenalezen</h1>
            <p className="text-sm text-muted-foreground">
              Zadané číslo certifikátu neodpovídá žádnému platnému záznamu v Bezli Akademii.
            </p>
          </div>
        ) : result.kind === "course" ? (
          <CourseView cert={result.data} />
        ) : (
          <PathwayView cert={result.data} />
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground p-4">
        <Link to="/" className="hover:underline">bezli.cz</Link>
      </footer>
    </div>
  );
}

function CourseView({ cert }: { cert: VerifiedCert }) {
  return (
    <article className="w-full max-w-2xl bg-card border rounded-3xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--accent))] p-8 text-primary-foreground">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <ShieldCheck className="w-4 h-4" />
          Ověřený certifikát Bezli Akademie
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">{cert.course_title}</h1>
        {cert.course_audience && (
          <p className="opacity-90 text-sm mt-1">
            Kurz pro: {cert.course_audience === "teachers" ? "učitele" : cert.course_audience === "students" ? "žáky" : cert.course_audience}
          </p>
        )}
      </div>

      <div className="p-8 flex flex-col md:flex-row gap-8 items-center">
        <BadgeGraphic title={cert.course_title} />
        <div className="flex-1 space-y-3 w-full">
          <Field icon={<User className="w-4 h-4" />} label="Absolvent">{cert.recipient_name || "—"}</Field>
          <Field icon={<GraduationCap className="w-4 h-4" />} label="Kurz">{cert.course_title}</Field>
          <Field icon={<Calendar className="w-4 h-4" />} label="Datum vydání">
            {new Date(cert.issued_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
          </Field>
          <Field icon={<Award className="w-4 h-4" />} label="Číslo certifikátu">
            <span className="font-mono">{cert.certificate_number}</span>
          </Field>
        </div>
      </div>

      <VerifiedFooter />
    </article>
  );
}

function PathwayView({ cert }: { cert: VerifiedPathwayCert }) {
  return (
    <article className="w-full max-w-2xl bg-card border rounded-3xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--accent))] p-8 text-primary-foreground">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <ShieldCheck className="w-4 h-4" />
          Ověřená kvalifikace Bezli Akademie
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">{cert.pathway_title}</h1>
        {cert.pathway_description && (
          <p className="opacity-90 text-sm mt-1">{cert.pathway_description}</p>
        )}
      </div>

      <div className="p-8 flex flex-col md:flex-row gap-8">
        <BadgeGraphic title={cert.pathway_title} />
        <div className="flex-1 space-y-3 w-full">
          <Field icon={<User className="w-4 h-4" />} label="Absolvent">{cert.recipient_name || "—"}</Field>
          <Field icon={<GraduationCap className="w-4 h-4" />} label="Kvalifikace">{cert.pathway_title}</Field>
          <Field icon={<Calendar className="w-4 h-4" />} label="Datum vydání">
            {new Date(cert.issued_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
          </Field>
          <Field icon={<Award className="w-4 h-4" />} label="Číslo certifikátu">
            <span className="font-mono">{cert.certificate_number}</span>
          </Field>
        </div>
      </div>

      <div className="px-8 pb-6">
        <h2 className="text-sm font-semibold flex items-center gap-1 mb-2 text-muted-foreground">
          <BookOpen className="w-4 h-4" /> Kurzy zahrnuté v kvalifikaci ({cert.courses?.length ?? 0})
        </h2>
        <ol className="space-y-1 list-decimal list-inside">
          {(cert.courses || []).map((c) => (
            <li key={c.id} className="text-sm">{c.title}</li>
          ))}
        </ol>
      </div>

      <VerifiedFooter />
    </article>
  );
}

function VerifiedFooter() {
  return (
    <div className="border-t p-5 bg-muted/40 flex items-center gap-3 text-xs text-muted-foreground">
      <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
      <p>Tento certifikát byl ověřen v databázi Bezli Akademie. Autenticitu můžete kdykoli znovu zkontrolovat sdílením této stránky.</p>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="font-medium text-foreground">{children}</div>
    </div>
  );
}

function BadgeGraphic({ title }: { title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "Z";
  return (
    <svg viewBox="0 0 200 220" className="w-40 h-44 shrink-0" aria-label="Digitální odznak">
      <defs>
        <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>
      <path d="M60 150 L60 210 L100 190 L140 210 L140 150 Z" fill="hsl(var(--primary))" opacity="0.9" />
      <path
        d="M100 10 L180 40 L180 110 C180 150 145 175 100 195 C55 175 20 150 20 110 L20 40 Z"
        fill="url(#badgeGrad)"
        stroke="hsl(var(--background))"
        strokeWidth="4"
      />
      <circle cx="100" cy="95" r="50" fill="hsl(var(--background))" opacity="0.15" />
      <text x="100" y="108" textAnchor="middle" fontSize="42" fontWeight="700" fill="hsl(var(--primary-foreground))" fontFamily="Lato, system-ui, sans-serif">
        {initials}
      </text>
      <text x="100" y="150" textAnchor="middle" fontSize="11" letterSpacing="2" fill="hsl(var(--primary-foreground))" fontFamily="Lato, system-ui, sans-serif">
        Bezli AKADEMIE
      </text>
    </svg>
  );
}
