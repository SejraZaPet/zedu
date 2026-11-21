import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { demoAiGuard } from "../_shared/demo-ai-guard.ts";
import { AI_MODEL_FAST } from "../_shared/ai-models.ts";
import {
  buildEvaluationRepetitionPrompt,
  normalizeEvaluationSuggestions,
  sanitizeEvaluationCandidates,
  type EvaluationCandidate,
} from "./prompt.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type AssignmentRow = {
  id: string;
  class_id: string | null;
  group_id: string | null;
  subject_id: string | null;
  lesson_plan_id: string | null;
  lesson_id: string | null;
  settings: unknown;
};

function assignmentSubjectKey(assignment: AssignmentRow, planSubjects: Map<string, string>): string {
  if (assignment.subject_id) return `id:${assignment.subject_id}`;
  const label = assignment.lesson_plan_id ? planSubjects.get(assignment.lesson_plan_id)?.trim() : "";
  return label ? `name:${label}` : "__none__";
}

function practiceHref(key: string): string {
  if (key.startsWith("lesson:")) {
    const lessonId = key.slice("lesson:".length);
    return `/student/metody/5p/procviceni?lesson=${encodeURIComponent(lessonId)}&min=10`;
  }
  return "/student/metody";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metoda není povolena." }, 405);
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  const demoBlock = await demoAiGuard(auth, "suggest-evaluation-repetition");
  if (demoBlock) return demoBlock;

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Neplatný požadavek." }, 400);
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const requestedSubject = typeof body.subjectKey === "string" ? body.subjectKey : "";
    const subjectLabel = typeof body.subjectLabel === "string" ? body.subjectLabel.trim().slice(0, 160) : "Předmět";
    if (!UUID.test(studentId) || !requestedSubject || requestedSubject === "__all__" || requestedSubject.length > 200) {
      return json({ error: "Pro návrh vyberte žáka a jeden předmět." }, 400);
    }
    const supplied = sanitizeEvaluationCandidates(body.topics);
    if (supplied.length < 3) return json({ error: "Pro návrh jsou potřeba alespoň tři ohodnocená témata." }, 400);

    // Všechna data o vazbě učitel–žák se čtou tokenem učitele. Service role se používá jen uvnitř demoAiGuard.
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth.authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: ownedData, error: ownedError } = await db.from("assignments")
      .select("id, class_id, group_id, subject_id, lesson_plan_id, lesson_id, settings")
      .eq("teacher_id", auth.userId);
    if (ownedError) return json({ error: "Oprávnění se nepodařilo ověřit." }, 403);
    const owned = ((ownedData ?? []) as AssignmentRow[]).filter((assignment) => {
      const kind = assignment.settings && typeof assignment.settings === "object" && !Array.isArray(assignment.settings)
        ? (assignment.settings as Record<string, unknown>).kind : null;
      return kind !== "material" && kind !== "announcement";
    });
    const planIds = [...new Set(owned.map((assignment) => assignment.lesson_plan_id).filter(Boolean))] as string[];
    const { data: plans } = planIds.length
      ? await db.from("lesson_plans").select("id, subject").in("id", planIds)
      : { data: [] as Array<{ id: string; subject: string | null }> };
    const planSubjects = new Map((plans ?? []).map((plan) => [plan.id, plan.subject || ""]));
    const assignmentIds = owned.map((assignment) => assignment.id);
    if (!assignmentIds.length) return json({ error: "Návrh je dostupný jen pro žáky vašich úkolů." }, 403);

    const classIds = [...new Set(owned.map((a) => a.class_id).filter(Boolean))] as string[];
    const groupIds = [...new Set(owned.map((a) => a.group_id).filter(Boolean))] as string[];
    const [{ data: recipients }, { data: classMembers }, { data: groupMembers }] = await Promise.all([
      db.from("assignment_recipients").select("assignment_id, student_id").in("assignment_id", assignmentIds),
      classIds.length ? db.from("class_members").select("class_id, user_id").in("class_id", classIds) : Promise.resolve({ data: [] as Array<{ class_id: string; user_id: string }> }),
      groupIds.length ? db.from("subject_group_members").select("group_id, student_id").in("group_id", groupIds) : Promise.resolve({ data: [] as Array<{ group_id: string; student_id: string }> }),
    ]);
    const recipientMap = new Map<string, string[]>();
    for (const row of recipients ?? []) recipientMap.set(row.assignment_id, [...(recipientMap.get(row.assignment_id) ?? []), row.student_id]);
    const isTargeted = (assignment: AssignmentRow): boolean => {
      const members = assignment.class_id
        ? (classMembers ?? []).filter((member) => member.class_id === assignment.class_id).map((member) => member.user_id)
        : assignment.group_id
          ? (groupMembers ?? []).filter((member) => member.group_id === assignment.group_id).map((member) => member.student_id)
          : [];
      const recipients = recipientMap.get(assignment.id) ?? [];
      return recipients.length > 0
        ? members.includes(studentId) && recipients.includes(studentId)
        : members.includes(studentId);
    };
    const targetedInSubject = owned.filter((assignment) => isTargeted(assignment)
      && assignmentSubjectKey(assignment, planSubjects) === requestedSubject);
    if (!targetedInSubject.length) return json({ error: "Návrh je dostupný jen pro žáky a předměty vašich úkolů." }, 403);

    const allowedKeys = new Set<string>();
    for (const assignment of targetedInSubject) {
      if (assignment.lesson_id) allowedKeys.add(`lesson:${assignment.lesson_id}`);
      else allowedKeys.add(`subject:${requestedSubject}`);
    }
    const candidates = supplied.filter((candidate) => allowedKeys.has(candidate.key));
    if (candidates.length < 3) return json({ error: "Pro tento výběr nemá AI alespoň tři povolená témata z vašich úkolů." }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI služba není nastavená." }, 500);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL_FAST,
        messages: [{ role: "user", content: buildEvaluationRepetitionPrompt(subjectLabel, candidates) }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "evaluation_repetition",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array", minItems: 3, maxItems: 5,
                  items: {
                    type: "object",
                    properties: { id: { type: "string" }, reason: { type: "string" } },
                    required: ["id", "reason"], additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"], additionalProperties: false,
            },
          },
        },
      }),
    });
    if (response.status === 429) return json({ error: "AI je teď vytížená. Zkuste to prosím za chvíli." }, 429);
    if (response.status === 402) return json({ error: "AI návrh teď není dostupný pro nedostatek kreditů." }, 402);
    if (!response.ok) {
      console.error("suggest-evaluation-repetition gateway", response.status);
      return json({ error: "AI návrh se nepodařilo vytvořit. Zkuste to znovu." }, 502);
    }
    const gatewayData = await response.json();
    const content = gatewayData.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return json({ error: "AI nevrátila použitelný návrh." }, 502);
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { return json({ error: "AI nevrátila použitelný návrh." }, 502); }
    const suggestions = normalizeEvaluationSuggestions(parsed, candidates).map((suggestion) => ({
      ...suggestion,
      practiceHref: practiceHref(suggestion.key),
    }));
    if (suggestions.length < 3) return json({ error: "AI nevrátila tři použitelná témata." }, 502);
    const basedOn = typeof body.basedOn === "string" && Number.isFinite(new Date(body.basedOn).getTime())
      ? body.basedOn
      : new Date().toISOString();
    console.log("suggest-evaluation-repetition", { candidates: candidates.length, suggestions: suggestions.length });
    return json({ suggestions, basedOn });
  } catch {
    return json({ error: "Návrh se nepodařilo vytvořit. Zkuste to prosím znovu." }, 500);
  }
});
