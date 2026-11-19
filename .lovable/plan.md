# Podklady pro přílohu o zpracování osobních údajů (jen analýza, nic se nemění)

Označení: **[kód]** = ověřeno z kódu nebo konfigurace projektu. **[předpoklad]** = neověřeno, nutno potvrdit u poskytovatele nebo v rozhraní.

## 1) Region databáze a úložiště
- **[konfigurace]** Projekt běží na Lovable Cloud (technicky Supabase). Připojení k databázi vede přes `aws-1-eu-west-1`, tedy AWS **eu-west-1 = Irsko (EU)**.
- **[předpoklad]** Soubory se ukládají ve stejném regionu jako databáze, protože úložiště je součástí stejné instance. Zvlášť ověřeno nebylo.
- **[předpoklad]** Serverové funkce běží na globální síti poskytovatele a mohou se spustit mimo EU, nejblíže uživateli. Data ukládají jen do databáze v Irsku.
- Ověření v rozhraní: Lovable → projekt → Cloud (View Backend) → přehled instance.

## 2) Funkce volající AI
- **[kód]** Všech 41 funkcí volá jen **Lovable AI Gateway**. Žádná funkce nevolá Google, OpenAI ani jiného poskytovatele napřímo.
- **[kód]** Endpoint je `https://ai.gateway.lovable.dev/v1/chat/completions`, jen `generate-section-teacher-note` používá `.../v1/responses`.
- Modely podle funkcí **[kód]**:
  - `google/gemini-3.8-flash` (sdílená konstanta): ai-practice-rag, extract-practice-photo-text.
  - `google/gemini-3.6-flash`: website-assistant-chat.
  - `google/gemini-3-flash-preview`: edit-slide, generate-activity-content, generate-activity-from-text, generate-activity-spec, generate-hierarchy, generate-items, generate-lesson-outline, generate-lesson-phases, generate-lesson-plan, generate-lesson-worksheet, generate-matching, generate-mcq, generate-practice, generate-video-checkpoints, generate-worksheet-qa, generate-worksheet, lesson-study-helper.
  - `google/gemini-2.5-flash`: ask-zedai-tutor, cluster-open-responses, generate-block-suggestions, generate-content-from-material, generate-differentiated-tasks, generate-notification-text, generate-section-activity, generate-slide-text, parse-curriculum-document, parse-curriculum-topics, process-file-content, recommend-learning-methods, suggest-grading-feedback, suggest-lesson-from-methods, worksheet-block-refine.
  - `google/gemini-2.5-flash-lite`: classify-images, export-session-report.
  - `openai/gpt-6-astra`: generate-lesson-quiz, generate-section-teacher-note.
  - `generate-full-worksheet` používá oba: `google/gemini-2.5-flash` i `openai/gpt-6-astra`.
- **[předpoklad]** Gateway předává požadavky dál Googlu (Gemini) a OpenAI. Kde je zpracovávají a za jakých smluvních podmínek (DPA, místo zpracování), je potřeba doplnit z dokumentace Lovable.

## 3) Jaká data jdou do AI
- **Hlavně obsah [kód]:** texty lekcí, zadání, učebních materiálů, nahraných dokumentů (DOCX, PDF, PPTX, osnovy) a fotek v „Učím se“. Do vybraných AI funkcí se jména ani e-maily z databáze nepřikládají.
- **Odpovědi žáků bez jmen [kód]:**
  - `suggest-grading-feedback`: text odpovědi žáka a zadání.
  - `cluster-open-responses`: volné odpovědi žáků.
  - `export-session-report`: jen název hodiny, počet žáků, průměr a nejčastější chybné odpovědi. Jména žáků se načítají jen do exportu, do AI nejdou.
- **Volný text žáka [kód]:** `ask-zedai-tutor` posílá zprávy žáka a historii rozhovoru. Žák do nich může sám napsat osobní údaje.
- **[předpoklad]** Osobní údaje se do AI dostanou, jen když je někdo napíše do textu nebo jsou vidět na nahrané fotce či v dokumentu, například jméno na sešitu. Aplikace je neodstraňuje, fotky jen zbavuje údajů o pořízení (EXIF).
- **Chat na webu [kód]:** `website-assistant-chat` posílá dotaz návštěvníka do AI. Pokud návštěvník zadá e-mail, uloží se jako kontakt do CRM, ale do AI se nepošle.

## 4) Další externí služby s osobními údaji
- **Resend [kód]** (api.resend.com): e-mailové adresy, jména a obsah e-mailů. Týká se e-mailů o úkolech, termínech, poptávkách, zpětné vazbě a připomínek dema.
- **Odesílání oznámení do prohlížeče [kód]** (`send-push`): adresa odběru a text oznámení jdou službám prohlížečů (Google, Apple, Mozilla). **[předpoklad]** Které služby to v praxi jsou, záleží na prohlížeči uživatele.
- **Unsplash [kód]** (`unsplash-search`): posílá se jen hledaný výraz, žádné osobní údaje.
- **jsDelivr [kód]:** jen načítání knihoven, žádná data uživatelů.
- **Lovable AI Gateway [kód]:** viz body 2 a 3.
- **[předpoklad]** Hosting webu (Lovable) vidí běžné technické údaje návštěvy (IP adresa v přístupových záznamech).

## 5) Záznamy AI požadavků a jejich uchování
- **Naše funkce [kód]:** po úpravách z 19. 11. neukládají do svých logů text odpovědí AI, jen stav a délku. Obsah požadavků se do databáze neukládá.
- **Výjimky v databázi [kód]:**
  - `website_chat_logs` ukládá dotaz návštěvníka i odpověď AI. Automatický úklid tabulky není, záznamy zůstávají trvale.
  - `student_practice_sessions` u lekcí ukládá otázky a odpovědi. U vlastních zdrojů (foto, text, soubor) jen druh zdroje a skóre.
  - `email_log` ukládá u běžných e-mailů celý obsah a nemaže se. Výjimkou jsou připomínky dema: jen typ, stav a příjemce, mazání po 30 dnech.
  - `demo_ai_usage`: jen počty pro limity dema.
- **AI Gateway [předpoklad]:** Lovable vede vlastní záznamy požadavků (model, tokeny, cena, případně i obsah). Jak dlouho je drží, se řídí podmínkami Lovable a v kódu to vidět není.
- **Logy serverových funkcí [předpoklad]:** krátkodobé provozní záznamy u poskytovatele, obvykle dny. Délka se v projektu nenastavuje.

## Doporučení (nic neprovedeno, jen k rozhodnutí)
- Doplnit úklid `website_chat_logs` a obsahu v `email_log`, například po 90 dnech.
- V příloze uvést Lovable a přes ni Google a OpenAI jako zpracovatele. Ověřit u nich DPA a předávání dat mimo EU.
