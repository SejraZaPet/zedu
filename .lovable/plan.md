# Zeď třídy: nejvýše 5 položek a tlačítko „Otevřít vše“ (diagnostika a návrh, NEIMPLEMENTOVÁNO)

## Co jsem zjistil
- Zeď je jen jedna sdílená komponenta `ClassWall`. Používá se ve dvou místech: na záložce Zeď stránky třídy/skupiny u učitele (`TeacherSubjectClass`, včetně formuláře pro nový příspěvek) a u žáka (`StudentSubjectClass`). Na dashboardu ani jinde se nezobrazuje.
- Zeď čerpá z úloh třídy (`assignments`), které stránka už načetla. `buildWallFeed` vezme jen zveřejněné položky, vynechá oznámení, kterým skončila viditelnost, a seřadí vše **od nejnovějších**. V hlavním seznamu se připnuté položky **neřadí jako první**.
- Nad seznamem je zvláštní blok „Oznámení“ (`wallAnnouncements`): ukazuje max. 3 oznámení, připnutá jsou první. Žák u něj má odkaz na všechna oznámení.
- Seznam se dnes zobrazuje po 10 položkách a pod ním je tlačítko „Zobrazit další“ (+10). Komentáře se načítají jen pro právě zobrazené položky.
- Plný seznam je tedy dostupný už dnes, ale jen postupným přidáváním po 10. Samostatná stránka „celá Zeď“ neexistuje.

## Návrh (jen frontend, bez DB)
1. Ve výchozím stavu ukázat **nejvýše 5 položek**: nejdřív připnuté, potom ostatní od nejnovějších. Nová čistá funkce `wallPreview(feed, 5)` v `class-wall.ts`.
2. Pod nimi tlačítko **„Otevřít vše (N)“**, jen když je položek víc než 5. Bude na celou šířku, vysoké aspoň 44 px a na šířce 390 px bez vodorovného posouvání.
3. Doporučená varianta je **rozbalení na místě**, ne nová stránka. Je jednodušší a bezpečnější: žádná nová adresa, oprávnění ani načítání dat, vše zůstane v komponentě, kterou už používáte. Po rozbalení se zobrazí celý seznam (při velkém počtu dál po 10 přes „Zobrazit další“) a tlačítko „Sbalit“. Stav rozbalení se nikam neukládá, po obnovení stránky je Zeď zase sbalená.
4. Blok „Oznámení“ (3 položky) zůstane beze změny.
5. Komentáře se dál načtou jen u zobrazených položek. Ve sbaleném stavu tedy bude méně dotazů. Psaní, úpravy i moderace komentářů se nemění.

## Co je „informace“
Za jednu informaci se počítá každá položka hlavního seznamu Zdi: příspěvek na Zeď, oznámení, materiál i úkol. Blok „Oznámení“ se do limitu 5 nepočítá. Komentáře se nepočítají, patří ke své položce.

## Testy
- `class-wall.test.ts`: limit 5; připnuté první; při 5 a méně položkách bez tlačítka; skrytá oznámení (konec viditelnosti) a koncepty se nepočítají.
- Test komponenty: tlačítko „Otevřít vše“ rozbalí seznam a „Sbalit“ ho zase sbalí.
- Kontrola v prohlížeči na 390 a 1440 px (učitel i žák).

## Otevřené otázky
1. Rozbalení na místě (doporučuji), nebo samostatná stránka?
2. Mají být připnuté položky první i v rozbaleném seznamu? Doporučuji ano, kvůli konzistenci.
3. Má se do limitu 5 započítat i blok „Oznámení“? Doporučuji ne, ten zůstane zvlášť.
