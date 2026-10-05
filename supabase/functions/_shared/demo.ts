// Společné helpery pro veřejný demo režim (create-demo-session, demo-switch, demo-restore).
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

export const DEMO_SCHOOL_NAME = "Demo škola Bezli";
export const DEMO_EMAIL_DOMAIN = "demo.bezli.cz";

export const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const anonClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Klientova IP → SHA-256(sůl + IP). Holá IP se nikde neukládá. */
export async function ipHash(req: Request): Promise<string> {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const salt = Deno.env.get("DEMO_IP_SALT") ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${raw}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
type Db = any;

/** Zapíše událost a vrátí, zda je volající pod limitem (počítá i aktuální pokus). */
export async function countRecent(db: Db, kind: string, sinceMs: number, hash?: string): Promise<number> {
  let q = db
    .from("demo_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  if (hash) q = q.eq("ip_hash", hash);
  const { count } = await q;
  return count ?? 0;
}

export async function recordEvent(db: Db, kind: string, hash: string) {
  await db.from("demo_rate_events").insert({ kind, ip_hash: hash });
}

/**
 * Vydá relaci pro uživatele na serveru bez hesla: admin generateLink (žádný e-mail se
 * neodesílá) → verifyOtp s token_hash. Vrací jen access/refresh token.
 */
export async function issueSession(db: Db, email: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) throw new Error("link_failed");
  const { data: v, error: vErr } = await anonClient().auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
  if (vErr || !v?.session) throw new Error("verify_failed");
  return {
    access_token: v.session.access_token,
    refresh_token: v.session.refresh_token,
    expires_at: v.session.expires_at,
  };
}

/** Porovnání řetězců v konstantním čase (vzhledem k délce b). */
export function constantTimeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < eb.length; i++) diff |= (ea[i % (ea.length || 1)] ?? 0) ^ eb[i];
  return diff === 0;
}

/** Normalizace návratového kódu: velká písmena, mezery/podtržítka/vícenásobné pomlčky → jedna pomlčka. */
export function normalizeCode(input: unknown): string {
  return String(input ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// 256 snadno čitelných českých slov bez diakritiky (8 bitů na slovo).
export const CODE_WORDS = (
  "KOCKA LOUKA PES LES HORA REKA MORE SLUNCE MESIC HVEZDA MRAK DEST VITR SNIH LED OHEN VODA ZEME KAMEN PISEK " +
  "STROM LIST KVET TRAVA HOUBA JABLKO HRUSKA SVESTKA MALINA JAHODA MRKEV CIBULE DYNE MELOUN CITRON BANAN " +
  "OREL SOVA VRANA KOS LISKA VLK MEDVED ZAJIC JELEN SRNA JEZEK VEVERKA MYS KRTEK ZABA RYBA KAPR STIKA LOSOS KRAB " +
  "KUN KRAVA OVCE KOZA PRASE KOHOUT SLEPICE KACHNA HUSA LABUT CAP VLAST DOMOV CHATA CHALUPA HRAD ZAMEK VEZ MOST " +
  "BRANA ZAHRADA SAD POLE CESTA SILNICE ULICE NAMESTI PARK RYBNIK POTOK JEZERO OSTROV SKALA JESKYNE UDOLI KOPEC " +
  "VLAK AUTO KOLO LOD LETADLO RAKETA BALON TRAMVAJ AUTOBUS TRAKTOR KNIHA SESIT TUZKA PERO PAPIR TABULE KRIDA " +
  "LAVICE SKOLA TRIDA MAPA GLOBUS LUPA KOMPAS HODINY ZVON KLIC ZAMKY OKNO DVERE STUL ZIDLE POSTEL POLSTAR DEKA " +
  "HRNEK TALIR LZICE VIDLICKA NUZ KASTROL PEKAC CHLEBA ROHLIK SYR MASLO MLEKO MED CUKR SUL CAJ KAKAO DORT " +
  "KOLAC BUCHTA PALACINKA KNEDLIK POLEVKA GULAS KAPUSTA BRAMBOR RYZE TESTO KAPSA BOTA CEPICE SALA RUKAVICE " +
  "KABAT SVETR TRIKO SUKNE KOSILE KNOFLIK PASKA STUHA KORALEK PRSTEN KORUNA MINCE POKLAD TRUHLA MAPKA DOPIS " +
  "BALIK RADIO PISEN BUBEN HOUSLE FLETNA KYTARA KLAVIR TANEC DIVADLO KINO OBRAZ BARVA STETEC SOCHA HLINA " +
  "VOSK SVICKA LAMPA BATERKA DRAK SKRITEK VILA OBR TROLL RYTIR KRAL PRINC PIRAT KAPITAN NAMORNIK PILOT " +
  "LEKAR HASIC KUCHAR PEKAR ZAHRADNIK MALIR BASNIK ZPEVAK SPORT FOTBAL TENIS HOKEJ PLAVANI BEH SKOK LYZE " +
  "SANKY BRUSLE MICEK SIF HRA KOSTKA PUZZLE ROBOT POCITAC MYSKA OBRAZOVKA SIGNAL ENERGIE MAGNET ZRCADLO " +
  "DUHA BLESK HROM MLHA ROSA JARO LETO PODZIM ZIMA RANO VECER NOC DEN TYDEN ROK STOLETI CHVILE MINUTA SEKUNDA " +
  "ZELENA MODRA ZLUTA CERVENA FIALOVA BILA CERNA SEDA ORANZOVA HNEDA RUZOVA ZLATO STRIBRO MED BRONZ ZELEZO " +
  "CIHLA BETON SKLO DREVO PRKNO HREBIK KLADIVO PILA SROUB LANO REBRIK KOS SITO MISKA VEDRO KONEV ZALIVKA SEMINKO"
)
  .split(/\s+/)
  .filter((w, i, a) => w && a.indexOf(w) === i);

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

/** SLOVO-SLOVO-SLOVO-NN (≥ 256³·100 ≈ 2^30,6 kombinací). */
export function generateReturnCode(): string {
  const w = () => CODE_WORDS[randInt(CODE_WORDS.length)];
  return `${w()}-${w()}-${w()}-${String(randInt(100)).padStart(2, "0")}`;
}

export function randomToken(bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
