# Diagnostika: opakovaná hláška „Připojeno“ v živých hrách

Pouze čtením, nic se neměnilo. Příčina je pravděpodobná, zatím nepotvrzená na skutečném zařízení.

## 1. Kde se hláška zobrazuje
- Toast „Připojeno – Spojení bylo obnoveno.“ vzniká jen v `src/components/game/ConnectionStatusBanner.tsx:18-28` (text `src/lib/ui-microcopy.ts:156`). Spustí se, když stav přejde z „reconnecting“/„disconnected“ na „connected“.
- Banner je na: žák `src/pages/StudentGamePlay.tsx:350, 766`; učitel `src/pages/LiveTeacherScreen.tsx:523`, `src/pages/TeacherGameScreen.tsx:73`; projektor `src/pages/LiveProjectorScreen.tsx:30`.
- Na projektoru je banner uvnitř `CloseButton`, komponenty definované v těle stránky (`LiveProjectorScreen.tsx:28-40`) – při každém překreslení se banner znovu vytvoří, takže jeho paměť předchozího stavu se ztrácí.

## 2. Proč se opakuje
Stav dodává `src/hooks/useGameSession.ts` přímo ze stavu realtime kanálu (`subscribe` řádky 243-277):
- SUBSCRIBED → „connected“; CLOSED / CHANNEL_ERROR / TIMED_OUT → „reconnecting“ a nový kanál (`scheduleReconnect`, 302-318).
- Každý přechod CLOSED → SUBSCRIBED tedy vyvolá toast, i když výpadek trval zlomek sekundy a hráč nic nepoznal.

Pravděpodobné spouštěče:
1. **Opakované zakládání kanálu ze strany stránky.** Hlavní efekt (`useGameSession.ts:328-372`) má v závislostech `refetchTrigger`. Stránky do něj posílají `fetchAttempts`, které samy zvyšují: žák v čekárně až 20× (`StudentGamePlay.tsx:77-83`), na začátku hry až 10× (`:86`), učitel až 8× (`LiveTeacherScreen.tsx:265-272`). Každé zvýšení zruší a znovu založí celý kanál, intervaly i posluchače. Uzavření starého kanálu a nové připojení mohou v krátkém sledu projít přes „reconnecting“ → „connected“.
2. **Mobil a tablet na pozadí / zhasnutý displej.** Prohlížeč uspí WebSocket, kanál dostane TIMED_OUT/CLOSED, po návratu SUBSCRIBED → toast. To je skutečné obnovení, ale opakuje se při každém zhasnutí.
3. **Krátké výpadky heartbeatu na školní Wi-Fi** – stejné chování, bez rozlišení délky výpadku.
4. **Toast bez deduplikace**: každá změna stavu přidá nový toast (`use-toast.ts`, limit 1, ale každý nový se znovu ukáže).

Na hře to nic nerozbíjí (data se dočítají i pollingem), jde o rušivou hlášku a zbytečnou zátěž.

## 3. Na co se hláška váže
Na stav kanálu Realtime (SUBSCRIBED/CLOSED/…), nikoli na logiku hry ani presence (presence se v živé hře nepoužívá).

## 4. Nejmenší oprava (návrh, neprovádět)
- **Banner/toast** (`ConnectionStatusBanner.tsx`): toast „Připojeno“ jen když předtím byl banner skutečně viditelný – stav „reconnecting“/„disconnected“ trval alespoň cca 3 s. Krátký výpadek neukáže nic. Pevné `id` toastu, aby se neskládaly.
- **Hook** (`useGameSession.ts`): stav „reconnecting“ nastavit až po krátké prodlevě (např. 2-3 s bez SUBSCRIBED); když se kanál mezitím připojí, stav zůstane „connected“. Při záměrném rušení kanálu (náš `removeChannel`) nepřepínat stav.
- **Zbytečné zakládání kanálu**: `refetchTrigger` vyjmout ze závislostí hlavního efektu a místo toho na jeho změnu jen zavolat `fetchData()` v samostatném efektu. Kanál pak vzniká jednou za návštěvu stránky a znovu jen při skutečném výpadku.
- **Projektor**: banner vykreslit jednou mimo `CloseButton`, aby si pamatoval předchozí stav.
- Testy: čisté pravidlo „ukázat obnovení jen po výpadku delším než X“ a test, že změna `refetchTrigger` nezaloží nový kanál (mock `supabase.channel`).

## 5. Rizika a ošetření
- Opožděný banner výpadku: skutečný výpadek se ukáže o 2-3 s později; záložní polling (2 s) data dál dočítá, takže hra pokračuje.
- Opakované dočtení na začátku hry (`fetchAttempts`) musí dál fungovat – zachová se přes samostatný `fetchData()`.
- Uzamčení telefonu: zůstává `visibilitychange`/`online` (`useGameSession.ts:344-352`) a reconnect s backoffem; po delším uspání se hláška ukáže jednou, což je správně.
- Počet hráčů a seznam: realtime události + pojistný polling hráčů se nemění.
- Bodování, časy, oprávnění a demo ochrany se nemění.
- **Migrace databáze: není potřeba.** Jde jen o zobrazení a správu kanálu v prohlížeči.

## Ověření před opravou
Na zkušební hře s telefonem sledovat v konzoli `Realtime CLOSED/TIMED_OUT` a počet zakládaných kanálů, aby se potvrdilo, který spouštěč převažuje.
