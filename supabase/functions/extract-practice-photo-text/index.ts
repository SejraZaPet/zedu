import { requireAuth } from "../_shared/auth.ts";
import { demoAiGuard } from "../_shared/demo-ai-guard.ts";
import { handleExtractPracticePhotoText } from "./core.ts";

Deno.serve((req) => handleExtractPracticePhotoText(req, {
  auth: requireAuth,
  demoGuard: demoAiGuard,
}));
