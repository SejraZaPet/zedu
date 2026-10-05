// Jednorázové založení sdílených demo účtů a ukázkového obsahu (idempotentní). Po použití se funkce maže.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, DEMO_SCHOOL_NAME, randomToken } from "../_shared/demo.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SRC = {
  lessonMedia: "09187477-bc5d-4d51-add8-1b96711d9faa",
  lessonVyziva: "afb128f6-a27b-4322-a6d7-c3af358f3113",
  presMedia: "0c57e063-0b6f-4c81-9fc0-9847a1b4e592",
  presVyziva: "184eb74b-6973-429a-bd48-bae788918e6b",
  wsPrint: "5ae419d2-7b35-454b-8de4-e7aa67b6bcc5",
};

const CLASSMATES = [
  ["Tereza", "Nováková"], ["Jakub", "Svoboda"], ["Eliška", "Dvořáková"], ["Matyáš", "Černý"],
  ["Natálie", "Procházková"], ["Vojtěch", "Kučera"], ["Adéla", "Veselá"], ["Ondřej", "Horák"],
];

function digitalSpec() {
  const base = (id: string, n: number, type: string, prompt: string, points: number, extra: Record<string, unknown> = {}) => ({
    id, itemNumber: n, type, prompt, points, difficulty: "easy", timeEstimateSec: 45,
    answerSpace: { type: "none", heightMm: 0 }, ...extra,
  });
  const items = [
    base("dv-1", 1, "mcq", "Která živina je pro tělo hlavním a nejrychlejším zdrojem energie?", 1, { choices: ["Sacharidy", "Bílkoviny", "Vitamíny", "Minerální látky"] }),
    base("dv-2", 2, "mcq", "Co tvoří základnu (nejširší patro) potravinové pyramidy?", 1, { choices: ["Obiloviny, pečivo, rýže a těstoviny", "Sladkosti a tuky", "Maso a ryby", "Mléko a mléčné výrobky"] }),
    base("dv-3", 3, "mcq", "Kolikrát denně se doporučuje jíst při racionální výživě?", 1, { choices: ["5× denně v menších porcích", "1× denně velkou porci", "2× denně", "Jen když mám hlad"] }),
    base("dv-4", 4, "mcq", "Který vitamín si tělo vytváří pomocí slunečního záření?", 1, { choices: ["Vitamín D", "Vitamín C", "Vitamín B12", "Vitamín K"] }),
    base("dv-5", 5, "true_false", "Bílkoviny jsou základním stavebním materiálem svalů a tkání.", 1),
    base("dv-6", 6, "true_false", "Pitný režim dospívajícího by měl být přibližně 0,5 litru tekutin denně.", 1),
    base("dv-7", 7, "true_false", "Vláknina podporuje správnou činnost střev.", 1),
    base("dv-8", 8, "matching", "Přiřaď potravinu k živině, které obsahuje nejvíce:", 3, {
      matchPairs: [
        { left: "Ovesné vločky", right: "Sacharidy" },
        { left: "Kuřecí maso", right: "Bílkoviny" },
        { left: "Olivový olej", right: "Tuky" },
      ],
    }),
    base("dv-9", 9, "open_answer", "Navrhni zdravou snídani pro školní den a stručně vysvětli, proč je vyvážená.", 3, {
      timeEstimateSec: 180, answerSpace: { type: "lines", heightMm: 40, lineCount: 5 },
    }),
  ];
  const answerKey = [
    { itemId: "dv-1", itemNumber: 1, correctAnswer: "Sacharidy" },
    { itemId: "dv-2", itemNumber: 2, correctAnswer: "Obiloviny, pečivo, rýže a těstoviny" },
    { itemId: "dv-3", itemNumber: 3, correctAnswer: "5× denně v menších porcích" },
    { itemId: "dv-4", itemNumber: 4, correctAnswer: "Vitamín D" },
    { itemId: "dv-5", itemNumber: 5, correctAnswer: "true" },
    { itemId: "dv-6", itemNumber: 6, correctAnswer: "false", explanation: "Doporučuje se zhruba 1,5–2,5 litru denně." },
    { itemId: "dv-7", itemNumber: 7, correctAnswer: "true" },
    { itemId: "dv-8", itemNumber: 8, correctAnswer: ["Sacharidy", "Bílkoviny", "Tuky"] },
    { itemId: "dv-9", itemNumber: 9, correctAnswer: "Otevřená odpověď", rubric: "1 b konkrétní snídaně, 1 b zastoupení více skupin potravin, 1 b zdůvodnění" },
  ];
  return {
    version: "v1",
    header: { title: "Výživa – opakování (digitální)", subject: "Potraviny a výživa", gradeBand: "", instructions: "Odpověz na otázky. Výsledek se spočítá automaticky, poslední otázku ohodnotí učitel.", worksheetMode: "classwork", studentNameField: false, classField: false, dateField: false },
    variants: [{ variantId: "A", seed: 1, items }],
    answerKeys: { A: answerKey },
    metadata: { totalPoints: 13, totalTimeMin: 9, difficultyDistribution: { easy: 9, medium: 0, hard: 0 }, typeDistribution: { mcq: 4, true_false: 3, matching: 1, open_answer: 1 }, createdAt: new Date().toISOString() },
    randomizationRules: [],
    renderConfig: { target: "web", paper: "A4", showPoints: true, showDifficulty: false, showTimeEstimate: false, showTypeLabels: true, includeAnswerKey: false },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = adminClient();
  const { data: school } = await db.from("schools").select("id,name").eq("name", DEMO_SCHOOL_NAME).eq("is_demo", true).single();
  if (!school) return json({ error: "no school" }, 500);

  const ensureUser = async (email: string, first: string, last: string, kind: "teacher" | "student", sharedKind: string) => {
    const { data: ex } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    let id = ex?.id as string | undefined;
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email, password: randomToken(32), email_confirm: true,
        user_metadata: { role_label: kind, status: "approved", first_name: first, last_name: last, is_demo: true, demo_shared: true },
      });
      if (error || !data.user) throw new Error("create " + email + ": " + error?.message);
      id = data.user.id;
    }
    await db.from("profiles").update({ school_id: school.id, school: school.name, status: "approved", first_name: first, last_name: last, email_notifications_enabled: false, parent_email_notifications: false }).eq("id", id);
    await db.from("demo_shared_users").upsert({ user_id: id, kind: sharedKind });
    return id;
  };

  try {
    const seedId = await ensureUser("seed@demo.bezli.cz", "Demo", "Bezli", "teacher", "seed");
    const classmates: string[] = [];
    for (let i = 0; i < CLASSMATES.length; i++) {
      classmates.push(await ensureUser(`student-${i + 1}@demo.bezli.cz`, CLASSMATES[i][0], CLASSMATES[i][1], "student", "classmate"));
    }

    const { count } = await db.from("worksheets").select("id", { count: "exact", head: true }).eq("teacher_id", seedId);
    if ((count ?? 0) > 0) return json({ ok: true, seedId, classmates, note: "content exists" });

    const { data: lessons } = await db.from("textbook_lessons").select("*").in("id", [SRC.lessonMedia, SRC.lessonVyziva]);
    const { data: pres } = await db.from("teacher_presentations").select("*").in("id", [SRC.presMedia, SRC.presVyziva]);
    const { data: ws } = await db.from("worksheets").select("*").eq("id", SRC.wsPrint).single();

    const books = [
      { title: "Ukázková učebnice – Mediální výchova", subject: "Mediální výchova", lesson: SRC.lessonMedia, pres: SRC.presMedia },
      { title: "Ukázková učebnice – Výživa", subject: "Potraviny a výživa", lesson: SRC.lessonVyziva, pres: SRC.presVyziva },
    ];
    const out: Record<string, unknown> = {};
    for (const b of books) {
      const { data: tb, error: tbErr } = await db.from("teacher_textbooks").insert({
        title: b.title, subject: b.subject, teacher_id: seedId, visibility: "private", is_for_sale: false, is_demo_seed: true,
        description: "Ukázkový obsah pro demo režim.", access_code: randomToken(4).toUpperCase(),
      }).select("id").single();
      if (tbErr) throw tbErr;
      const l = lessons!.find((x) => x.id === b.lesson)!;
      const { data: tl, error: tlErr } = await db.from("teacher_textbook_lessons").insert({
        textbook_id: tb.id, title: l.title, blocks: l.blocks, presentation_slides: l.presentation_slides,
        hero_image_url: l.hero_image_url, theme_id: l.theme_id, status: "published", sort_order: 0,
        require_activities: l.require_activities,
      }).select("id").single();
      if (tlErr) throw tlErr;
      const p = pres!.find((x) => x.id === b.pres)!;
      const { data: np, error: pErr } = await db.from("teacher_presentations").insert({
        teacher_id: seedId, title: p.title, slides: p.slides, source_lesson_id: tl.id, source_lesson_type: "teacher", is_demo_seed: true,
      }).select("id").single();
      if (pErr) throw pErr;
      out[b.title] = { textbook: tb.id, lesson: tl.id, presentation: np.id };
    }

    const { data: wsCopy, error: wErr } = await db.from("worksheets").insert({
      teacher_id: seedId, title: ws.title, subject: ws.subject, subject_id: ws.subject_id, grade_band: ws.grade_band,
      worksheet_mode: ws.worksheet_mode, spec: ws.spec, status: ws.status, teacher_notes: ws.teacher_notes,
      is_for_sale: false, is_demo_seed: true,
    }).select("id").single();
    if (wErr) throw wErr;
    const vyz = out["Ukázková učebnice – Výživa"] as { lesson: string };
    const { data: dig, error: dErr } = await db.from("worksheets").insert({
      teacher_id: seedId, title: "Výživa – opakování (digitální)", subject: ws.subject, subject_id: ws.subject_id,
      worksheet_mode: "classwork", spec: digitalSpec(), status: "published", is_for_sale: false, is_demo_seed: true,
      source_lesson_id: vyz.lesson, source_lesson_type: "teacher", ai_generated: false,
    }).select("id").single();
    if (dErr) throw dErr;
    return json({ ok: true, seedId, classmates, out, printWorksheet: wsCopy.id, digitalWorksheet: dig.id });
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
