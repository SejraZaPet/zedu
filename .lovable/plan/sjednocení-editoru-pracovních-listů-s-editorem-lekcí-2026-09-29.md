# Sjednocení editoru pracovních listů s editorem lekcí

## Cíl a hranice změny

Přestavím pouze editační rozhraní pracovního listu. Zachovám beze změny `WorksheetSpec`, typy položek, odpovědní klíče, bodování, automatické ukládání, publikaci i současný tisk/PDF renderer.

Protože záhlaví pracovního listu dnes nemá datové pole pro vlastní obrázek, bude 21:9 banner vizuální záhlaví složené ze stávajícího názvu a metadat. Nepřidám nové ukládání obrázku ani změnu schématu.

## Co se změní

### 1. Živé A4 plátno

- Hlavní prostřední část nahradím stránkami A4 o rozměru 210 × 297 mm.
- Použiji stejné tiskové okraje: 14 mm nahoře a po stranách, 16 mm dole.
- Stránky budou mít stejné písmo Lato, velikosti a rozestupy jako finální tisk.
- Položky se budou automaticky přelévat na další A4 stránku při psaní, přidání, smazání nebo přetažení.
- Logika stránkování bude respektovat stejný princip jako dnešní tiskový náhled: položka zůstane pokud možno celá; příliš vysoká samostatná položka dostane vlastní stránku a jasné upozornění na přesah.
- Čísla stran a konce listů budou stále viditelné. Na menších displejích se A4 plátno přizpůsobí šířce, ale zachová poměr a hranice stran.

### 2. Editace přímo ve vzhledu výsledné stránky

- Sbalené šedé řádky nahradím skutečným vzhledem položky na papíře.
- Kliknutí položku vybere; výběr a najetí zobrazí jemný rámeček a plovoucí ovládání ve stylu editoru lekce.
- Přesun, smazání, přidání mezi položky, AI úpravy a napojení na lekci zůstanou funkčně stejné.
- Pole nutná pro nastavení otázky zůstanou dostupná v kompaktní editační vrstvě, ale nebudou měnit vypočtené hranice tisku. Stránkování se bude řídit tiskovou podobou položky, nikoli dočasně otevřenými ovládacími prvky.
- Čtyři hotové vizuální bloky z lekce pouze začlením do stejného výběru, okrajů a typografie; jejich obsah ani chování nezměním.

### 3. Záhlaví a 21:9 banner

- Na první A4 stránce vytvořím 21:9 záhlaví ve vizuálním stylu lekce.
- Název zůstane editovatelný a bude zobrazen reálnou tiskovou typografií.
- Předmět, ročník a režim přesunu z hlavního plátna do nastavení.
- Pokyny pro žáka zůstanou součástí tisknutelného záhlaví, aby živé plátno odpovídalo výstupu.
- Poznámky pro učitele a QR nastavení přesunu do nastavení; jejich současná pravidla viditelnosti a tisku zůstanou zachována.

### 4. Postranní panely

- Levou paletu zachovám se všemi současnými vstupy: banka otázek, typy položek, offline aktivity, lekce a AI návrhy.
- Vizuálně ji sjednotím s paletou a ovládáním editoru lekce, bez změny pořadí nebo akcí.
- Doplním pravý panel „Nastavení“ pro metadata listu a nastavení vybrané položky. Dnes připravený obsah vlastností není v rozložení zapojený; využiji jej místo duplikování logiky.
- Na mobilu zůstanou paleta a nastavení v samostatných výsuvných panelech.

## Technické provedení

- Rozdělím monolitickou stránku na malé prezentační části: A4 plátno, stránka, editovatelná položka a panel nastavení.
- Sdílené tiskové rozměry a typografii vyvedu do jednoho zdroje používaného živým plátnem i existujícím rendererem; samotné generování HTML, tisk a PDF tok nezměním.
- Stránkování A4 plátna bude měřit tiskovou podobu položek pomocí `ResizeObserver` a přepočítá stránky po skutečné změně rozměrů. Ovládací prvky editoru zůstanou mimo měřený tiskový tok.
- Zachovám současná ID položek a zapojení drag-and-drop, `updateSpec`, historii změn, přepočet metadat a ukládání.
- Nové prezentační části dostanou cílené testy pro rozdělení položek na stránky, přepočet po změně a přesun bez změny dat.

## Ověření

- Ověřím přidání, editaci, přesun, smazání a vrácení změny.
- Ověřím automatické uložení a návrat do editoru bez zamrznutí.
- Porovnám hranice stran a pořadí obsahu živého plátna s dnešním náhledem Tisk/PDF na skutečném pracovním listu.
- Ověřím studentský i učitelský tisk/PDF, včetně odpovědního klíče, poznámek učitele, QR kódů a čtyř vizuálních bloků.
- Ověřím desktop a mobil a spustím celý build i testy.

## Rizika a jejich omezení

- **Dynamické stránkování při psaní:** přepočet může způsobit posun položky mezi stranami. Omezím jej stabilním měřením tiskové vrstvy a zachováním výběru podle ID.
- **Rozdíl mezi editačními poli a tiskem:** ovládací prvky nebudou vstupovat do výpočtu výšky; rozhodující bude tisková podoba položky.
- **Velmi vysoká položka:** nelze ji beze změny obsahu vždy rozdělit stejně jako běžný text. Zůstane na samostatné stránce s upozorněním, data se automaticky nezkrátí.
- **Přetažení přes hranice stran:** zachovám jeden společný seznam a po přesunu pouze znovu vypočtu stránky, aby se neporušilo pořadí ani odpovědní klíč.
- **Regrese tisku/PDF:** tiskový renderer nebude přepsán; sdílet se budou jen konstanty vzhledu. Stávající výstupy porovnám před a po změně.
