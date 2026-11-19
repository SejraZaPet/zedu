import { PRACTICE_AI_MODEL } from "../_shared/practice-ai-model.ts";
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  handleExtractPracticePhotoText,
  PRACTICE_PHOTO_MAX_BASE64_CHARS,
} from "./core.ts";

const AUTH_OK = { ok: true as const, userId: "student-1", isServiceRole: false, authHeader: "Bearer test" };
const VALID_BODY = { imageBase64: "aGVsbG8=", mimeType: "image/jpeg" };
const LONG_TEXT = "Fotosyntéza probíhá v chloroplastech. ".repeat(8).trim();

function request(body: unknown = VALID_BODY, withAuth = true): Request {
  return new Request("http://localhost/functions/v1/extract-practice-photo-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: "Bearer test" } : {}),
    },
    body: JSON.stringify(body),
  });
}

function gatewayResponse(text: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ text }) } }] } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function deps(fetchImpl: typeof fetch = async () => gatewayResponse(LONG_TEXT), demoGuard?: () => Promise<Response | null>) {
  return {
    auth: async (req: Request) => req.headers.has("Authorization")
      ? AUTH_OK
      : { ok: false as const, status: 401, body: { error: "Unauthorized" } },
    demoGuard: demoGuard ?? (async () => null),
    fetchImpl,
    apiKey: "test-key",
  };
}

Deno.test("bez JWT vrátí 401 a AI se nezavolá", async () => {
  let calls = 0;
  const response = await handleExtractPracticePhotoText(
    request(VALID_BODY, false),
    deps(async () => { calls++; return gatewayResponse(LONG_TEXT); }),
  );
  assertEquals(response.status, 401);
  assertEquals(calls, 0);
  await response.text();
});

Deno.test("špatný MIME a vstup nad 4 MB vrátí 400", async () => {
  let calls = 0;
  const dependencies = deps(async () => { calls++; return gatewayResponse(LONG_TEXT); });
  const wrongMime = await handleExtractPracticePhotoText(request({ ...VALID_BODY, mimeType: "image/png" }), dependencies);
  assertEquals(wrongMime.status, 400);
  await wrongMime.text();

  const tooLarge = await handleExtractPracticePhotoText(
    request({ imageBase64: "a".repeat(PRACTICE_PHOTO_MAX_BASE64_CHARS), mimeType: "image/jpeg" }),
    dependencies,
  );
  assertEquals(tooLarge.status, 400);
  await tooLarge.text();
  assertEquals(calls, 0);
});

Deno.test("prázdný výstup je UNREADABLE_PHOTO a krátký text INSUFFICIENT_TEXT", async () => {
  const empty = await handleExtractPracticePhotoText(request(), deps(async () => gatewayResponse("")));
  assertEquals(empty.status, 422);
  assertEquals((await empty.json()).error, "UNREADABLE_PHOTO");

  const short = await handleExtractPracticePhotoText(request(), deps(async () => gatewayResponse("málo")));
  assertEquals(short.status, 422);
  assertEquals((await short.json()).error, "INSUFFICIENT_TEXT");
});

Deno.test("402, 429 a 5xx se neopakují a zachovají bezpečnou hlášku", async () => {
  for (const [upstream, expected] of [[402, 402], [429, 429], [500, 502]] as const) {
    let calls = 0;
    const response = await handleExtractPracticePhotoText(request(), deps(async () => {
      calls++;
      return new Response("upstream error", { status: upstream });
    }));
    assertEquals(response.status, expected);
    assertEquals(calls, 1);
    const body = await response.json();
    assertEquals(typeof body.error, "string");
  }
});

Deno.test("demo odmítnutí proběhne před AI", async () => {
  let calls = 0;
  const response = await handleExtractPracticePhotoText(
    request(),
    deps(
      async () => { calls++; return gatewayResponse(LONG_TEXT); },
      async () => new Response(JSON.stringify({ error: "Demo limit" }), { status: 429 }),
    ),
  );
  assertEquals(response.status, 429);
  assertEquals(calls, 0);
  await response.text();
});

Deno.test("úspěch vrací pouze přepsaný text", async () => {
  let requestBody = "";
  const response = await handleExtractPracticePhotoText(request(), deps(async (_url, init) => {
    requestBody = String(init?.body ?? "");
    return gatewayResponse(LONG_TEXT);
  }));
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(Object.keys(body), ["text"]);
  assertEquals(body.text, LONG_TEXT);
  assertEquals(requestBody.includes(PRACTICE_AI_MODEL), true);
  assertEquals(requestBody.includes("data:image/jpeg;base64,aGVsbG8="), true);
});
