# Oprava fullscreen zobrazení a rychlosti editoru prezentací

## Cíl
- Zobrazit PNG slidy ve fullscreen režimu celé, vystředěné a bez ořezu.
- Zajistit okamžitou odezvu přesouvání slidů a spolehlivé uložení nového pořadí.
- Omezit zbytečnou práci editoru s velkými obrázky bez změny obsahu prezentací.

## Postup
1. Sjednotit vykreslení obrázkového pozadí editoru a fullscreen přehrávače na 16:9 režim `contain`.
2. Opravit stav editoru tak, aby reorder nejprve změnil lokální pořadí a následně ho uložil, bez čekání na databázi či návratu starých dat.
3. Stabilizovat výpočty a vykreslování náhledů, aby velké PNG nevyvolávaly zbytečné překreslení všech slidů.
4. Přidat cílené regresní testy pro celé obrázkové slidy a okamžitý reorder; ověřit náhled ve fullscreen rozměru.

## Technické detaily
- Zachovat `teacher_presentations.slides` jako autoritativní uloženou podobu.
- Neměnit texty, obrázky ani pořadí prezentace „Bez•li“ mimo opravu chování editoru.
- Použít existující `SlideCanvas` a současný mechanismus ukládání, ne zavádět druhý stavový systém.
