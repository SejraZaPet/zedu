# Cílené umístění lekcí

## Co změním
- Rozšířím umístění lekce o volitelnou třídu nebo skupinu, období a rozsah jednoho či všech ročníků.
- V editoru přidám tři srozumitelné volby a vyhledávací výběr pouze z vlastních tříd a skupin učitele.
- Zachovám dnešní výchozí chování: celý ročník, celý školní rok, jeden ročník.

## Viditelnost pro žáka
- Konkrétní třída bude vyžadovat členství právě v této třídě.
- Konkrétní skupina bude vyžadovat členství právě v této skupině.
- Bez konkrétního cíle bude umístění platit všem oprávněným žákům odpovídající učebnice.
- „Celé studium oboru“ nebude vyžadovat shodu aktuálního ročníku; přístup k oboru zůstane omezen propojením učebnice s třídou, předmětem nebo skupinou.
- Období bude uložená organizační informace; bez školního kalendáře nebude samo automaticky skrývat obsah podle dnešního data.

## Databáze a bezpečnost
- Přidám `subject_group_id`, `school_term` a `scope_all_grades` a upravím jedinečnost umístění pro různé cíle.
- Přidám serverovou kontrolu způsobilosti žáka a použiji ji pro umístění i samotné lekce, aby klientské filtrování nešlo obejít.
- Zachovám přístup vlastníků, učitelů a správců a stávající chování lekcí bez umístění.

## Ověření
- Obnovím databázové typy, ověřím kontrolu typů, testy a sestavení.
- V náhledu nastavím konkrétní třídu s rozsahem celého studia a ověřím u oprávněného i jiného žáka.
