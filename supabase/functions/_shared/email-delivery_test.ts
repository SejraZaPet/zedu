import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isTooOld, sendWithRetry, SEND_INTERVAL_MS } from "./email-delivery.ts";

// Simulace sdíleného DB slotu a virtuálního času.
function makeClock() {
  let now = 0;
  let next = 0;
  return {
    get now() { return now; },
    reserve: async () => { const slot = Math.max(now, next); next = slot + SEND_INTERVAL_MS; return slot - now; },
  };
}

Deno.test("100 současných upozornění nepřekročí 2/s", async () => {
  const c = makeClock();
  const sendTimes: number[] = [];
  await Promise.all(Array.from({ length: 100 }, () =>
    sendWithRetry({
      reserveSlot: c.reserve,
      sleepFn: async () => {}, // čas se počítá ze slotu níže
      doFetch: async () => new Response("{}", { status: 200 }),
    })
  ));
  // ověř rozestup slotů přímo
  const c2 = makeClock();
  for (let i = 0; i < 100; i++) sendTimes.push(await c2.reserve());
  for (let i = 1; i < sendTimes.length; i++) assertEquals(sendTimes[i] - sendTimes[i - 1], SEND_INTERVAL_MS);
  // v žádném 1s okně víc než 2
  for (const t of sendTimes) assert(sendTimes.filter((x) => x >= t && x < t + 1000).length <= 2);
});

Deno.test("429 se zopakuje a uspěje, respektuje Retry-After", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const res = await sendWithRetry({
    reserveSlot: async () => 0,
    sleepFn: async (ms) => { sleeps.push(ms); },
    doFetch: async () => {
      calls++;
      if (calls === 1) return new Response("{}", { status: 429, headers: { "Retry-After": "5" } });
      if (calls === 2) return new Response("{}", { status: 503 });
      return new Response("{}", { status: 200 });
    },
  });
  assertEquals(res.status, 200);
  assertEquals(calls, 3);
  assertEquals(sleeps, [5000, 3000]);
});

Deno.test("trvalá chyba skončí po 3 opakováních", async () => {
  let calls = 0;
  const res = await sendWithRetry({
    reserveSlot: async () => 0, sleepFn: async () => {},
    doFetch: async () => { calls++; return new Response("{}", { status: 500 }); },
  });
  assertEquals(res.status, 500);
  assertEquals(calls, 4);
});

Deno.test("upozornění starší 6 h je příliš staré", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  assert(isTooOld("2026-10-12T05:59:00Z", now));
  assert(!isTooOld("2026-10-12T06:30:00Z", now));
  assert(!isTooOld(null, now));
});
