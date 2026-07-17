import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMyClassesTool from "./tools/list-my-classes";
import listMyAssignmentsTool from "./tools/list-my-assignments";

// Build the OAuth issuer from the project ref (Vite inlines this at build time).
// Must be the direct supabase.co host, NOT the Lovable Cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "zedu-mcp",
  title: "ZEdu",
  version: "0.1.0",
  instructions:
    "Nástroje pro platformu ZEdu (učebnice, třídy, úlohy). Volajte `whoami` pro ověření identity, `list_my_classes` pro seznam tříd přihlášeného uživatele a `list_my_assignments` pro jeho úlohy. Data se čtou pod RLS jako přihlášený uživatel.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMyClassesTool, listMyAssignmentsTool],
});
