# Animace prvků jako v Canvě – návrh (bez implementace)

Datum: 2026-11-22  
Rozsah: editor prezentací, sdílené vykreslení slidů, projekce a žákovský telefon. Beze změn DB/RLS.

## Východisko

- Blok má dnes `props.animation`: `none`, `scale`, `from-bottom`, `from-top`.
- Animace se přehrává jen při vstupu do živé projekce; editor zobrazuje statický obsah.
- Odrážky už umí `props.revealMode` a projekce drží `settings.revealStep`; `SlideCanvas` při každém kroku zobrazí prvních N odrážek.
- `SlideCanvas` je společný základ editoru, projekce, telefonu, PDF a miniatur. Animace proto nesmí změnit rozměry, pozice, výběr, kreslení ani exportovaný obsah.
- Nové přechody mezi slidy jsou oddělené: `transitionStyle`, `transitionDirection`, `transitionDuration`. Nesmí se sloučit s animacemi prvků.

## Cílová nabídka „Animovat“

### 1. Animovat celý slide

V pravém panelu bez výběru prvku: **Animace slidu → Animovat všechny prvky**. Nabídne styl, rychlost a režim **najednou / postupně / po kliknutí**. Jde o výchozí nastavení pro bloky, které nemají vlastní `animationSpec`; nepřepisuje individuální volby.

### 2. Animovat vybraný prvek

V současné liště **Animace** a v pravém panelu:

- styly: Bez animace, Objevení, Prolnutí, Vstup zespodu, Vstup ze strany, Vyskočení, Zvětšení, Posun, Psaní, Otočení, Rozmazání;
- rychlost: pomalu / středně / rychle + přesná délka 0,2–2 s;
- zpoždění 0–10 s po 0,1 s;
- režim: najednou / postupně / po kliknutí;
- pořadí: automaticky podle čtení (flow, potom `zIndex`, potom ID), ručně číslované, přetahovatelný seznam „Pořadí animací“;
- náhled na aktuálním slidu, tlačítko Přehrát a vypnutí náhledu během úprav.

„Psaní“ pouze pro textové bloky a bez rozhození řádků: odhalování znaků ve stejnoměrném kroku, kurzor pouze vizuální, plná délka textu rezervovaná od začátku. HTML značky, diakritika a emoji se nesmí rozseknout.

## Doporučený datový model

Zachovat staré `props.animation` pro zpětnou kompatibilitu. Při otevření editoru jej líně číst jako výchozí hodnotu; nic se neukládá, dokud učitel nezmění nastavení a neklikne na Uložit.

```ts
type SlideAnimationSpec = {
  version: 1;
  style: "none" | "appear" | "fade" | "rise" | "side" | "pop" |
    "scale" | "drift" | "typewriter" | "rotate" | "blur";
  direction?: "left" | "right" | "up" | "down";
  durationMs: number;       // 200–2000
  delayMs: number;          // 0–10000
  trigger: "with-slide" | "after-previous" | "on-click";
  order: number;            // stabilní pořadí, ne array index
  clickGroup?: number;      // více prvků odhalených stejným kliknutím
};

// blok
props.animation?: string;              // legacy, jen čtení/staré exporty
props.animationSpec?: SlideAnimationSpec;

// výchozí animace celého slidu
slide.animationDefaults?: Omit<SlideAnimationSpec, "order" | "clickGroup">;
slide.animationOrder?: string[];        // ID bloků pro ruční seřazení
```

Pravidla:

- neznámý styl = `none`, nevalidní čísla se bezpečně ořežou do limitů;
- smazání/duplikace bloku odstraní/obnoví jeho ID i v `animationOrder`;
- seskupené bloky mají jednu animaci skupiny; vnořené bloky se neanimačně neskrývají;
- `animationOrder` není zdroj pravdy pro obsah ani pořadí čtení;
- `revealMode` odrážek zůstane zachovaný a převede se na `clickGroup` jednotlivých odrážek až po úpravě animace, nikoli hromadnou migrací.

## Pořadí a odhalování po kliknutí

Jeden sdílený přehrávač `slide-animation-player.ts` spočítá časovou osu:

1. `with-slide`: spustí se po vstupním přechodu slidu;
2. `after-previous`: délka předchozí animace + vlastní zpoždění;
3. `on-click`: čeká na další kliknutí / šipku / PageDown / dotyk ve stejné zóně jako navigace.

Kliknutí nejprve dokončí nebo odhalí další `clickGroup`; teprve po vyčerpání skupin přejde na další slide. **Zpět** obnoví předchozí stav odhalení, nejen index slidu. `revealStep` bude nadále zpětně kompatibilní; nový přehrávač z něj vytvoří počáteční stav, ale nesmí souběžně používat dvě různá pořadí.

V editoru je vidět statický výsledek. Tlačítko **Přehrát** spustí dočasný náhled nad plátnem bez změny uložených dat, výběru a historie.

## Aktivity

- Vstupní animace se aplikuje na kontejner aktivity jako celek, nikdy na jednotlivé odpovědi před jejich zveřejněním.
- Časovač a možnost odpovídat nesmí začít dřív, než je aktivita viditelná. U `on-click` aktivity zůstane `armedQuestion`/manuální spuštění oddělené od animačního odhalení.
- Skrytá aktivita nesmí prozradit správné odpovědi v DOM/textu pro žáka; serverová pravidla a bodování zůstanou beze změny.
- Výsledky, zeď, slovní mrak a nové odpovědi se nerestartují animací při každém realtime update. Animace se váže na `(slideId, block.id, playbackEpoch)`, ne na každý render.
- Vlastní tempo žáka má vlastní stav animací podle jeho `student_index`; učitelovo kliknutí neodhaluje prvky na telefonu v režimu vlastního tempa.

## Projekce, telefon a přístupnost

- Projektory i telefon použijí stejný výpočet osy; transformace přechodu slidu, zoomu a animace bloku budou na oddělených vrstvách.
- Ovládání, tabule, zpětná vazba a odpovědi zůstanou mimo animovaný prvek.
- `prefers-reduced-motion`: bez pohybu, psaní a zpoždění; obsah je okamžitě viditelný. **Po kliknutí zůstane pořadí odhalování zachované**, jen bez animace.
- Na telefonu žádné automatické přehrávání zvuku, vibrování ani změny rozvržení. Dotykové cíle a kontrast zůstanou podle Bezli/deck-*.
- Editor, miniatury, PDF a tisk vždy zobrazí plný statický obsah. Náhled animace nesmí změnit výsledek exportu.

## Export a import

- **PDF/tisk:** plný obsah, bez animací a bez skrytých kroků.
- **PPTX export:** jednoduché vstupy mapovat na nejbližší PowerPoint animace v `p:timing` až v samostatné etapě; délka, zpoždění a pořadí zapsat, pokud bude ověřené v PowerPointu i LibreOffice.
- **Psaní, složité skupiny a po-kliknutí odrážky:** pokud nebudou věrné, exportní souhrn výslovně řekne, že byly nahrazeny statickým obsahem nebo jednoduchým prolnutím. Nikdy se nezahodí text ani odpovědi.
- **PPTX import:** číst `p:timing` jen v odděleném parseru, nepoužívat ho jako zdroj obsahu. Nepodporované efekty převést na nejbližší a uvést v importním souhrnu.
- Round-trip testy musí prokázat zachování obsahu i při nepřenositelné animaci.

## Rizika a omezení

1. **Realtime restart animací:** řešit stabilním playback klíčem a epochou, ne dalším `key` na celé aktivitě.
2. **Kolize navigace a odhalování:** jediná navigační funkce rozhodne „další animace vs. další slide“ pro projektor i telefon.
3. **Časování aktivit:** animace nesmí obejít manuální start, serverový čas ani bodování.
4. **Výkon:** omezit `filter: blur()` na malé plochy; na telefonu preferovat opacity/transform. Žádná animace layoutu.
5. **Skrytý obsah a soukromí:** vizuální skrytí není bezpečnostní filtr; odpovědi a výsledky stále řídí existující server.
6. **PPTX interoperabilita:** `p:timing` je podstatně složitější než přechody; nezačít exportem bez ověřovacích souborů.
7. **Historie a propojené kopie:** pouze lokální změny do Uložit, zachovat `lessonRef`, undo/redo a stávající synchronizaci aktivit.

## Etapy a odhad

1. **Model + přehrávač + migrace legacy (2–3 dny):** normalizace, časová osa, reduced motion, testy pořadí a historie.
2. **Editor Animovat + náhled + pořadí (2–3 dny):** výchozí slide, jednotlivé prvky, ruční pořadí, dotyk a klávesnice.
3. **Projekce + telefon + aktivity (2–3 dny):** klikací odhalování, vlastní tempo, žádné realtime restarty, regrese startu a bodování.
4. **Styly navíc + odrážky (1–2 dny):** Psaní, Vyskočení, Posun, Rozmazání; převod stávajícího `revealMode`.
5. **PPTX import/export (3–5 dní, samostatné schválení):** `p:timing`, souhrn aproximací, round-trip a vizuální ověření v cílových přehrávačích.

Celkem bez PPTX: **8–11 pracovních dnů**. PPTX: dalších **3–5 dnů** a samostatné QA. První použitelná etapa by měla pokrýt Prolnutí, Objevení, Vstup zespodu, Vyskočení, délku/zpoždění a pořadí najednou/postupně/po kliknutí; Psaní a PPTX nejsou nutné pro první vydání.

## Povinné testy

- legacy `animation` → spec bez uložení; neznámá data; duplikace/smazání a undo/redo;
- najednou/postupně/po kliknutí, zpět, skok na slide, poslední skupina → další slide;
- odrážky a starý `revealStep`; psaní s HTML, diakritikou a emoji;
- učitel/žák, vlastní tempo, swipe/klávesy/dotyk, reduced motion;
- realtime odpovědi nerestartují animaci; manuální start, čas a bodování beze změny;
- PDF/tisk vždy plné; PPTX buď věrný, nebo s přesným souhrnem aproximace;
- 20slidová prezentace s více animacemi na telefonu bez ztráty obsahu a výkonu.
