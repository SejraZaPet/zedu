import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_my_assignments",
  title: "Seznam mých úloh",
  description:
    "Vrátí úlohy (assignments) viditelné přihlášenému uživateli pod RLS. Volitelně lze omezit počet.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximální počet vrácených úloh (výchozí 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nepřihlášený uživatel." }], isError: true };
    }
    const n = Math.min(Math.max(Number.isFinite(limit as number) ? (limit as number) : 25, 1), 100);
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("assignments")
      .select("id, title, description, due_at, created_at, class_id, status")
      .order("created_at", { ascending: false })
      .limit(n);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { assignments: data ?? [] },
    };
  },
});
