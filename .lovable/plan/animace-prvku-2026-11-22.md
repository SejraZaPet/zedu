# Animace prvků jako v Canvě

Datum: 2026-11-22  
Stav: etapy 1–3 implementovány; etapy 4–5 jsou navazující práce. Bez DB/RLS a bez nasazení.

## Zachovat

- Staré `props.animation`: `none`, `scale`, `from-bottom`, `from-top`. Mapování: Žádná, Rozprostření, Nahoru, Nahoru se směrem shora. Převod je líný až při úpravě; stará prezentace se sama nepřepisuje.
- Odrážkové `revealMode`, `revealStep`, navigaci, ruční spuštění aktivit, serverový čas a bodování.
- Miniatury, PDF a tisk vždy ukazují úplný statický obsah. Animace nemění pozice, výběr, kreslení ani historii.
- Přechody mezi slidy zůstávají oddělené v `transitionStyle` a souvisejících polích.

## Model

```ts
props.animation?: string | {
  preset: string;
  speed: number;       // 0,2–2 s
  delay: number;       // 0–10 s
  trigger: "auto" | "click";
  order: number;       // stabilní pořadí klikacích skupin
  direction?: "left" | "right" | "up" | "down";
}
slide.animationPack?: string; // etapa 4
```

Neznámý preset se bezpečně čte jako žádná animace. Klikací prvky tvoří seřazené skupiny; další navigace nejprve odhalí skupinu a teprve potom změní slide. Skrytý prvek nemá ukazatel ani události. `prefers-reduced-motion` odstraní pohyb a čekání, nikoli odhalovací pořadí.

## Etapa 1 – model, 10 presetů a přehrávání

- Normalizace a legacy mapování v samostatném pomocníkovi.
- Základní presety: Žádná, Objevení, Prolnutí, Nahoru, Posun, Bum, Rozprostření, Rozostření, Drift, Psací stroj.
- Psací stroj jen pro text, bez změny rozložení; ostatní efekty na kontejneru celého bloku.
- Sdílený renderer pro editor, projekci a telefon. Editor přehrává po výběru nebo tlačítkem Přehrát; realtime render nerestartuje animaci.
- Testy: legacy, limity, neznámá data, pořadí, reduced-motion třídy a statický export.

## Etapa 2 – panel Animace

- Zavírací křížek, záložky Strana a Text/Prvek podle typu výběru.
- Dlaždice s ikonou, popiskem a živým náhledem při najetí; výběr přehraje prvek na plátně.
- Strana nabídne Přehrát celý slide a přehled animovaných prvků. Skutečné balíčky Doporučené/Obecné/Navržené a Použít na všechny slidy patří do etapy 4, bez nefunkčních lákadel.
- Text/Prvek nabídne implementované presety, Zobrazit při kliknutí, Rychlost/délku, Zpoždění, Směr a Odebrat animaci.
- deck-* tokeny, Oswald + DM Sans, klávesnice, dotyk a kontrast 4,5:1.

## Etapa 3 – klikání, pořadí a aktivity

- Přepínač Zobrazit při kliknutí; číslovaný seznam s posunem výš/níž.
- Šipka, PageDown, dálkové ovládání i tlačítko Další nejprve odhalí další skupinu; Zpět nejprve vrátí odhalení.
- Projekce i telefon používají stejný `animationRevealCount`; nový slide začíná na nule.
- Aktivita se animuje jako celek, nikdy jednotlivé odpovědi. Dokud je klikací aktivita skrytá, odpovídání a odpočet neběží; automatické spuštění dostane nový čas až po odhalení, ruční režim zůstane ruční.
- Testy: nastavení/zrušení, změna pořadí, poslední skupina → další slide, aktivita a starý revealStep.

## Etapa 4 – další presety a balíčky stránek

- Doplnit všechny požadované Navržené/Obecné textové a prvkové efekty a Přidané efekty: Otočit, Poblikávání, Tep, Potřepávání.
- `slide.animationPack`: Jednoduchý, Luxusní, Zábavné, Párty, Firemní, Pohoda a další obecné balíčky; rozdílná předvolba pro text, obrázky a tvary.
- Použít na všechny slidy s potvrzením rozsahu. Navržené fotografické balíčky jen při přítomnosti obrázku.
- Výkon: transform/opacity přednostně, blur jen na malých plochách, žádné animace layoutu.

## Etapa 5 – PPTX import/export

- Samostatný parser `p:timing`; nikdy jej nepoužívat jako zdroj obsahu.
- Export mapovat jen ověřitelné vstupy; psaní, složité efekty a nepodporované klikací sekvence výslovně uvést jako aproximace nebo statický obsah.
- Round-trip musí zachovat veškerý text, odpovědi a poznámky. Ověřit PowerPoint i LibreOffice; bez toho netvrdit věrnost.

## Rizika

1. Realtime odpovědi nesmí restartovat animace: stabilní klíč slide/blok/playback, ne key na celé aktivitě.
2. Vizuální skrytí není bezpečnostní filtr; serverová pravidla odpovědí se nemění.
3. Klikací odhalení a navigace musí mít jedinou navigační funkci, aby nedošlo k přeskočení.
4. PPTX `p:timing` je výrazně složitější než přechody; etapa 5 vyžaduje samostatné QA.
5. Vlastní tempo žáka a nativní PowerPoint zůstávají samostatně ověřit.

## Povinné ověření etap 1–3

- Jednotkové testy modelu, pořadí a navigace; související regresní testy, typecheck a build.
- Přihlášený průchod: výběr presetu, okamžitý náhled, Přehrát, klikací pořadí, uložení a znovuotevření.
- Projekce a telefon: automatický vstup, odhalení po kliknutí, reduced motion, žádná změna bodování.
- Vlastní testovací data označit [TEST] a po ověření odstranit.