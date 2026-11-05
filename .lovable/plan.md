
---

# Diagnostika: AI aktivita „Doplň z nabídky“ v editoru lekce (5. 11. 2026)

## Souhrn pro učitelku
- AI služba dnes **fungovala**: kolem 11:00 (9:54–10:00 UTC) proběhlo 7 volání AI, všechna úspěšná, žádný limit ani nedostatek kreditů.
- Nejpravděpodobnější příčina: AI vrátí text v jiném tvaru, než editor u „Doplň z nabídky“ čeká. Editor pak obsah tiše zahodí a nezobrazí ani chybu. Vypadá to, že se nic nestalo.
- Příčina ještě **není potvrzená**, protože obsah odpovědí AI se z ochrany soukromí neukládá. Prvním krokem opravy je tedy ověřit ji na testovacím tématu.
- Oprava je jen v kódu, databázi nemění.

## Kde se aktivita volí a spouští
- Typ `fill_choice` („Doplň z nabídky“) je v `ACTIVITY_TYPES` v `src/components/admin/block-editors/ActivityBlock.tsx:43`. Liší se od `fill_blanks` i od banky slov `FillWordBank`, která je jen pro lekce.
- Generování obstarává `AiSuggestPanel` (ActivityBlock.tsx ~1486). Tlačítko „Navrhnout pomocí AI“ zavolá `handleGenerate` → `generate-activity-content` s `activityType`.
- Server (`supabase/functions/generate-activity-content/index.ts:29`) typ podporuje. Tvar odpovědi: `{"fillChoice":{"text":"Věta s {{slovem}}.","options":[…]}}` a pokyn „3 až 6 vět a 3 distraktory“.
- Klient ho převádí v `normalizeAiProps` (ActivityBlock.tsx:1375): **jen** když je `fillChoice.text` a zároveň chybí `fillChoice.tokens`.
- `FillChoiceEditor` (ActivityBlock.tsx:992) zobrazuje jen `fillChoice.tokens`. Bez tokenů ukáže prázdný editor.

## Proč se „nic nestane“ (hypotézy seřazené podle pravděpodobnosti)
1. **Tiché zahození výstupu (pravděpodobné, nepotvrzené).** Klient obsah zahodí, když AI vrátí:
   - pole vět (`fillChoice: [...]` nebo `fillChoice.sentences`),
   - `fillChoice.text` jako pole,
   - nebo `tokens: []`.

   `normalizeAiProps` pak nic nevyrobí a do bloku se uloží `fillChoice` bez tokenů. Klientská kontrola hlídá jen, že `props` je objekt, takže chyba se nezobrazí a editor zůstane prázdný. Pokyn „3 až 6 vět“ v jediném poli `text` k tomu AI svádí.
2. **Chyba v drobném textu.** Neúspěch se ukazuje jen jako malý červený text pod panelem, ne jako toast. U odpovědi, která není 2xx, je to obecná hláška supabase-js. Dnes ale žádné AI volání neselhalo, takže tohle je méně pravděpodobné.
3. **Zmatení v ovládání.** Výběr typu v rozbalovacím seznamu sám nic negeneruje. Je potřeba ještě otevřít „Navrhnout pomocí AI“ a kliknout na generování. Opraví to lepší popisek.
4. Vyloučeno:
   - typ chybějící ve `switch`/`SHAPES` (je tam),
   - chybějící funkce nebo CORS (hlavičky jsou v pořádku),
   - AI limity (všechna volání vrátila 200),
   - demo guard (týká se jen dema).

## Data a logy (jen počty, bez obsahu)
- AI Gateway za 5. 11. od 08:00 UTC: 12 volání, 12× status 200, model gemini-3-flash-preview. Žádné 402/429/5xx. Těla odpovědí jsou `redacted`, takže tvar výstupu z nich ověřit nelze.
- Logy edge funkce `generate-activity-content`: pro dnešek nic nevrátily. Volání nelze s jistotou přiřadit k funkci ani k učitelce.
- Ostatní AI aktivity používají stejnou cestu, ale svůj tvar mají jednodušší (pole položek). Problém by měl být specifický pro `fill_choice` a podobně i pro `fill_blanks`.

## Navržená minimální oprava (jen kód, bez DB)
1. **Ověření jako první krok:** testovací blok `[TEST]` s tématem bez osobních údajů a kontrola tvaru `data.props` v konzoli prohlížeče. Nic se neukládá.
2. `normalizeAiProps` vytvoří tokeny pro `fill_choice` i `fill_blanks` z těchto tvarů:
   - `text` jako řetězec i jako pole,
   - `sentences[]`,
   - pole objektů `{text}`,
   - prázdné `tokens`.

   Distraktory sloučí s odpověďmi bez duplicit, jako dosud.
3. Po normalizaci kontrola: pokud u `fill_choice`/`fill_blanks` nevznikne aspoň jedna mezera k doplnění, vyhodit chybu „AI se nepodařilo vygenerovat, zkuste to znovu.“ a blok neměnit.
4. Viditelná zpětná vazba: k inline chybě přidat `toast.error` a po úspěchu `toast.success("Návrh vložen, zkontrolujte ho.")`.
5. Server (volitelné, po vašem souhlasu, protože jde o změnu edge funkce): upřesnit tvar na „všechny věty v jednom řetězci `text`“. Kód funkce se nasadí jen po „nasadit“.

## Regresní testy
Nový `src/test/activity-ai-normalize.test.ts`. Kvůli testovatelnosti se `normalizeAiProps` přesune do čisté funkce (`export`):
- řetězec `text` s `{{x}}` → tokeny a options obsahují odpověď i distraktory,
- `text` jako pole vět → tokeny,
- `fillChoice` jako pole `{text}` → tokeny,
- výstup bez jediné mezery → chyba, blok beze změny.

Spustit cílené testy, `fill-word-bank.test.tsx`, `activity-from-*.test.tsx` a tsgo.

## Rollback
Vrátit `ActivityBlock.tsx` a smazat nový test (případně vrátit i `generate-activity-content/index.ts`). Databáze ani data nejsou dotčené.

## Nedělat
Žádné migrace, změny RLS ani demo guardů, žádné nasazení bez „nasadit“, žádné změny `FillWordBank` ani živých her.
