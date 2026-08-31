/** Strukturovaná šablona předmětového ŠVP (Markdown). */
const yearTable = (year: number) => `### ${year}. ročník

| Výsledky vzdělávání | Učivo | Časové rozvržení |
|---|---|---|
|  |  |  |
`;

export const CURRICULUM_PLAN_TEMPLATE = `## Pojetí a cíl předmětu



## Charakteristika učiva

(včetně mezipředmětových vztahů)


## Strategie výuky

### Metody výuky


### Metody ověřování


## Hodnocení výsledků žáků



## Přínos ke klíčovým kompetencím a průřezovým tématům



## Rozpis učiva a výsledků vzdělávání

${[1, 2, 3].map(yearTable).join("\n")}`;
