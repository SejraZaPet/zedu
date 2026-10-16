import { readFileSync } from "fs";
import { activityToCoreQuestions, coreToGameQuestions } from "@/lib/live-game-core";
import { expandSlidesForLiveGame } from "@/lib/live-game-expand";
const URL = "https://rnndtpfmkanxbckdbflm.supabase.co";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || readFileSync(".env","utf8").match(/VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)/)![1];
const sess = JSON.parse(readFileSync(process.env.HOME + "/.cache/lovable-auth/session.json", "utf8")).session;
const T = sess.access_token, TID = sess.user.id;
const H = (tok = T) => ({ apikey: ANON, Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Prefer: "return=representation" });
const rest = async (path: string, method = "GET", body?: any) => { const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers: H(), body: body && JSON.stringify(body) }); const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${t}`); return t ? JSON.parse(t) : null; };
const fn = async (name: string, body: any, tok?: string) => { const r = await fetch(`${URL}/functions/v1/${name}`, { method: "POST", headers: tok ? H(tok) : { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const errors: string[] = []; const created: string[] = [];
const acts: Record<string, any> = {
  quiz: { activityType: "quiz", quiz: { questions: [{ question: "2+2", answers: [{ text: "3" }, { text: "4", correct: true }, { text: "5" }] }, { question: "3+3", answers: [{ text: "6", correct: true }, { text: "7" }] }, { question: "1+1", answers: [{ text: "2", correct: true }, { text: "0" }] }] } },
  true_false: { activityType: "true_false", trueFalse: { statements: [{ text: "Voda je mokrá", isTrue: true }, { text: "Led je horký", isTrue: false }, { text: "Slunce svítí", isTrue: true }] } },
  matching: { activityType: "matching", matching: { left: ["pes", "kočka", "kráva"], right: ["štěká", "mňouká", "bučí"] } },
  fill_blanks: { activityType: "fill_blanks", fillBlanks: { text: "Pes {{štěká}}. Kočka {{mňouká}}. Kráva {{bučí}}." } },
  ordering: { activityType: "ordering", title: "Čísla", ordering: { items: ["jedna", "dva", "tři"] } },
};
// hráči: P1 vždy správně, P2 jen první dvě, P3 nikdy
const pick = (pi: number, qi: number, ci: number, n: number) => (pi === 0 || (pi === 1 && qi < 2) ? ci : (ci + 1) % n);
const rows: string[] = [];
async function players(code: string) { const out = []; for (const n of ["TEST hráč 1", "TEST hráč 2", "TEST hráč 3"]) { const r = await fn("join-game", { gameCode: code, nickname: n }); if (r.status !== 200) errors.push(`join ${r.status} ${JSON.stringify(r.body)}`); out.push(r.body); } return out; }
const tok = (p: any) => p.joinToken || p.join_token || p.player?.join_token;
const pid = (p: any) => p.playerId || p.player_id || p.player?.id;
async function runA(kind: string, mode: string, teams: boolean) {
  const qs = coreToGameQuestions(activityToCoreQuestions(acts[kind]));
  const [s] = await rest("game_sessions", "POST", { teacher_id: TID, title: `[TEST] A ${kind} ${mode}${teams ? " týmy" : ""}`, game_code: Math.random().toString(36).slice(2, 8).toUpperCase(), activity_data: qs, settings: { timePerQuestion: 20, gameMode: mode, teamModeKind: teams ? "manual" : "none" }, status: "lobby", current_question_index: -1 });
  created.push(s.id);
  const ps = await players(s.game_code);
  if (teams) await rest(`game_sessions?id=eq.${s.id}`, "PATCH", { teams: { teams: [{ id: "t1", name: "A", color: "#000", members: [pid(ps[0]), pid(ps[1])] }, { id: "t2", name: "B", color: "#111", members: [pid(ps[2])] }] } });
  for (let qi = 0; qi < qs.length; qi++) {
    await rest(`game_sessions?id=eq.${s.id}`, "PATCH", { status: "playing", current_question_index: qi, question_started_at: new Date().toISOString() });
    for (let pi = 0; pi < 3; pi++) {
      if (mode === "race") await fetch(`${URL}/rest/v1/game_players?id=eq.${pid(ps[pi])}`, { method: "PATCH", headers: H(), body: JSON.stringify({ student_index: qi }) });
      const ci = qs[qi].answers.findIndex((a) => a.correct);
      const r = await fn("submit-answer", { joinToken: tok(ps[pi]), answerIndex: pick(pi, qi, ci, qs[qi].answers.length) });
      if (r.status !== 200 && !r.body?.retry) errors.push(`A submit ${kind}/${mode} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    }
  }
  const final = await rest(`game_players?session_id=eq.${s.id}&select=nickname,total_score&order=nickname`);
  rows.push(`A | ${kind} | ${mode}${teams ? "+týmy" : ""} | q=${qs.length} | ${final.map((f: any) => f.total_score).join("/")}`);
}
async function runB(kind: string, mode: string) {
  const slides = expandSlidesForLiveGame([{ slideId: "s", type: "activity", activitySpec: kind === "quiz" ? undefined : acts[kind] }].filter((x) => x.activitySpec));
  const r0 = await fn("create-live-session", { title: `[TEST] B ${kind} ${mode}`, slides }, T);
  if (r0.status !== 200) { errors.push(`B create ${kind} ${r0.status} ${JSON.stringify(r0.body).slice(0, 150)}`); return; }
  const s = r0.body.session || r0.body; created.push(s.id);
  await rest(`game_sessions?id=eq.${s.id}`, "PATCH", { settings: { ...(s.settings || {}), timePerQuestion: 20, gameMode: mode } });
  const ps = await players(s.game_code);
  for (let qi = 0; qi < slides.length; qi++) {
    await rest(`game_sessions?id=eq.${s.id}`, "PATCH", { status: "playing", current_question_index: qi, question_started_at: new Date().toISOString() });
    for (let pi = 0; pi < 3; pi++) {
      const sp = slides[qi].activitySpec; const sel = pick(pi, qi, sp.correctIndex, sp.options.length);
      const r = await fn("submit-activity-response", { joinToken: tok(ps[pi]), sessionId: s.id, questionIndex: qi, isCorrect: true, score: 9999, responseTimeMs: 1000, answerData: { selected: [sel] } });
      if (r.status !== 200) errors.push(`B submit ${kind}/${mode} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    }
  }
  const final = await rest(`game_players?session_id=eq.${s.id}&select=nickname,total_score&order=nickname`);
  rows.push(`B | ${kind} | ${mode} | q=${slides.length} | ${final.map((f: any) => f.total_score).join("/")}`);
}
try {
  for (const k of Object.keys(acts)) for (const m of ["standard", "race", "tower", "steal"]) await runA(k, m, false);
  await runA("true_false", "steal", true);
  for (const k of ["true_false", "matching", "fill_blanks", "ordering"]) for (const m of ["standard", "race", "tower", "steal"]) await runB(k, m);
} catch (e) { errors.push(String(e)); }
console.log(rows.join("\n")); console.log("ERRORS", errors.length, errors.slice(0, 15).join("\n"));
require("fs").writeFileSync("/tmp/test-sessions.json", JSON.stringify(created));
