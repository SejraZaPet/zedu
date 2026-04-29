import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Calendar as CalendarIcon, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "admin" | "teacher";

type ReceiverType = "all" | "all_teachers" | "all_students" | "class" | "user";

type ClassRow = { id: string; name: string };
type StudentRow = { id: string; first_name: string; last_name: string; class_id: string };

interface Props {
  mode: Mode;
  /** Pre-fill from a context (e.g. from assignment / class page) */
  defaults?: {
    title?: string;
    content?: string;
    receiverType?: ReceiverType;
    receiverIds?: string[];
    type?: "reminder" | "message" | "warning" | "info" | "update";
    link?: string;
  };
  onSent?: () => void;
}

const TYPE_OPTIONS_ADMIN = [
  { value: "message", label: "Zpráva" },
  { value: "info", label: "Informace" },
  { value: "warning", label: "Upozornění" },
  { value: "update", label: "Novinka" },
  { value: "reminder", label: "Připomenutí" },
];

const TYPE_OPTIONS_TEACHER = [
  { value: "reminder", label: "Připomenutí úkolu" },
  { value: "info", label: "Nový materiál k dispozici" },
  { value: "warning", label: "Termín testu" },
  { value: "message", label: "Obecná zpráva" },
];

export default function NotificationComposer({ mode, defaults, onSent }: Props) {
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [content, setContent] = useState(defaults?.content ?? "");
  const [type, setType] = useState<string>(defaults?.type ?? (mode === "teacher" ? "reminder" : "message"));
  const [receiverType, setReceiverType] = useState<ReceiverType>(
    defaults?.receiverType ?? (mode === "teacher" ? "class" : "all_teachers")
  );
  const [classIds, setClassIds] = useState<string[]>(
    defaults?.receiverType === "class" ? defaults.receiverIds ?? [] : []
  );
  const [studentIds, setStudentIds] = useState<string[]>(
    defaults?.receiverType === "user" ? defaults.receiverIds ?? [] : []
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [link, setLink] = useState(defaults?.link ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState("");

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  // Load teacher's classes (and admin's all classes if needed)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let q = supabase.from("classes").select("id, name").eq("archived", false).order("name");
      const { data: cls } = await q;
      setClasses((cls ?? []) as ClassRow[]);
    })();
  }, []);

  // Load students of selected classes (for "user" recipient type)
  useEffect(() => {
    if (receiverType !== "user" || classIds.length === 0) {
      if (receiverType !== "user") setStudents([]);
      return;
    }
    (async () => {
      const { data: members } = await supabase
        .from("class_members")
        .select("user_id, class_id")
        .in("class_id", classIds);
      const uids = (members ?? []).map((m: any) => m.user_id);
      if (uids.length === 0) {
        setStudents([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", uids);
      const map = new Map<string, string>();
      (members ?? []).forEach((m: any) => map.set(m.user_id, m.class_id));
      setStudents(
        (profs ?? [])
          .map((p: any) => ({ ...p, class_id: map.get(p.id) ?? "" }))
          .sort((a: any, b: any) =>
            (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name, "cs")
          ) as StudentRow[]
      );
    })();
  }, [receiverType, classIds]);

  const receiverOptions = useMemo(() => {
    if (mode === "admin") {
      return [
        { value: "all", label: "Všichni uživatelé" },
        { value: "all_teachers", label: "Všichni učitelé" },
        { value: "all_students", label: "Všichni žáci" },
        { value: "class", label: "Konkrétní třída" },
        { value: "user", label: "Konkrétní uživatel(é)" },
      ];
    }
    return [
      { value: "class", label: "Celá třída" },
      { value: "user", label: "Vybraní žáci" },
    ];
  }, [mode]);

  const reset = () => {
    setTitle("");
    setContent("");
    setLink("");
    setScheduleEnabled(false);
    setScheduledAt("");
    setClassIds([]);
    setStudentIds([]);
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const audience =
        receiverType === "all_teachers"
          ? "učitele"
          : receiverType === "all_students" || receiverType === "user"
            ? "žáky"
            : receiverType === "class"
              ? "celou třídu"
              : "uživatele";
      const { data, error } = await supabase.functions.invoke(
        "generate-notification-text",
        {
          body: {
            type,
            subject: title || aiHint || "obecné sdělení",
            audience,
            extra: aiHint || undefined,
          },
        },
      );
      if (error) throw error;
      const d = data as { title?: string; content?: string; error?: string };
      if (d?.error) throw new Error(d.error);
      if (d?.title && !title.trim()) setTitle(d.title);
      if (d?.content) setContent(d.content);
      toast.success("Návrh textu vložen");
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se vygenerovat text");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Vyplň název zprávy");
      return;
    }
    let receiverIds: string[] = [];
    if (receiverType === "class") receiverIds = classIds;
    else if (receiverType === "user") receiverIds = studentIds;

    if (receiverType === "class" && receiverIds.length === 0) {
      toast.error("Vyber alespoň jednu třídu");
      return;
    }
    if (receiverType === "user" && receiverIds.length === 0) {
      toast.error("Vyber alespoň jednoho příjemce");
      return;
    }

    let scheduledIso: string | null = null;
    if (scheduleEnabled && scheduledAt) {
      const d = new Date(scheduledAt);
      if (isNaN(d.getTime())) {
        toast.error("Neplatné datum naplánování");
        return;
      }
      if (d.getTime() <= Date.now()) {
        toast.error("Naplánovaný čas musí být v budoucnu");
        return;
      }
      scheduledIso = d.toISOString();
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("send_notification" as any, {
      _title: title.trim(),
      _content: content.trim(),
      _receiver_type: receiverType,
      _receiver_ids: receiverIds,
      _type: type,
      _scheduled_at: scheduledIso,
      _link: link.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Nepodařilo se odeslat: " + error.message);
      return;
    }
    toast.success(scheduledIso ? "Notifikace naplánována" : "Notifikace odeslána");
    reset();
    onSent?.();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h3 className="font-heading text-lg font-semibold">Nová notifikace</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="notif-title">Název zprávy *</Label>
          <Input
            id="notif-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Např. Připomenutí: Test z chemie"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notif-type">Typ</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="notif-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(mode === "admin" ? TYPE_OPTIONS_ADMIN : TYPE_OPTIONS_TEACHER).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notif-content">Text zprávy</Label>
        <Textarea
          id="notif-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Napiš podrobnosti…"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="notif-receiver">Cílová skupina</Label>
          <Select value={receiverType} onValueChange={(v) => setReceiverType(v as ReceiverType)}>
            <SelectTrigger id="notif-receiver"><SelectValue /></SelectTrigger>
            <SelectContent>
              {receiverOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notif-link">Odkaz (volitelný)</Label>
          <Input
            id="notif-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/student/ulohy/…"
          />
        </div>
      </div>

      {receiverType === "class" && (
        <div className="space-y-1.5">
          <Label>Třídy</Label>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné dostupné třídy.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 max-h-48 overflow-y-auto border border-border rounded-md p-3">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={classIds.includes(c.id)}
                    onCheckedChange={(checked) => {
                      setClassIds((prev) =>
                        checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                      );
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {receiverType === "user" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nejprve vyber třídy</Label>
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žádné dostupné třídy.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-3 max-h-32 overflow-y-auto border border-border rounded-md p-3">
                {classes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={classIds.includes(c.id)}
                      onCheckedChange={(checked) => {
                        setClassIds((prev) =>
                          checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                        );
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          {classIds.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Žáci ({students.length})</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setStudentIds(students.map((s) => s.id))}
                  >Vybrat vše</button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setStudentIds([])}
                  >Zrušit výběr</button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 max-h-56 overflow-y-auto border border-border rounded-md p-3">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={studentIds.includes(s.id)}
                      onCheckedChange={(checked) => {
                        setStudentIds((prev) =>
                          checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                        );
                      }}
                    />
                    {s.last_name} {s.first_name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={scheduleEnabled}
            onCheckedChange={(c) => setScheduleEnabled(!!c)}
          />
          <CalendarIcon className="w-4 h-4" />
          Naplánovat odeslání na konkrétní čas
        </label>
        {scheduleEnabled && (
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={reset} disabled={submitting}>Vyčistit</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          <Send className="w-4 h-4 mr-2" />
          {scheduleEnabled ? "Naplánovat" : "Odeslat notifikaci"}
        </Button>
      </div>
    </div>
  );
}
