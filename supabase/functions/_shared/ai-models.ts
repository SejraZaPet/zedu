/**
 * Jediné místo AI modelů pro serverové funkce. Žádná funkce nesmí mít model natvrdo
 * (hlídá src/test/ai-models-single-source.test.ts).
 * Ověřeno z katalogu Lovable AI Gateway 19. 11. 2026: oba Gemini modely nejsou zastaralé,
 * chat-completions = zero data retention, vstup text i obrázek, tool calling i response_format.
 */
/** Rychlý: klasifikace, shlukování, krátké texty a návrhy, chat na webu. */
export const AI_MODEL_FAST = "google/gemini-3.1-flash-lite";
/** Kvalitní: generování lekcí, pracovních listů, kvízů, aktivit, OCR, tutor. */
export const AI_MODEL_QUALITY = "google/gemini-3.8-flash";
/**
 * Kvalitní s uvažováním (OpenAI). Používají ho funkce s parametry specifickými pro OpenAI
 * (reasoning_effort, /v1/responses, strict json_schema) — přechod na Gemini by změnil formát volání.
 * Model není zastaralý, proto zůstává; jen je přesunutý sem.
 */
export const AI_MODEL_QUALITY_REASONING = "openai/gpt-6-astra";
