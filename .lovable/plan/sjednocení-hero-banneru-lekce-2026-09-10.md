# Sjednocení hero banneru lekce

## Postup
- Dokončit audit všech míst, kde se zobrazuje `hero_image_url`, a rozlišit plný banner od záměrných miniatur.
- Nahradit současné omezení pouze maximální výškou jednotným poměrem stran 21:9, plnou šířkou a stejným ořezem ve všech plných náhledech.
- Opravit přehlédnutý administrační formulář, který stále používá malý náhled.
- Přidat cílený test společného bannerového stylu, ověřit typy, testy a sestavení.
- V přihlášeném náhledu otevřít stejnou lekci v editoru i ve výsledném zobrazení a pořídit porovnávací snímky.

## Technické detaily
`max-h-80` neurčuje poměr stran: při rozdílné šířce rodiče má obrázek jinou výšku a `object-cover` tedy i jiný výřez. Sdílená třída proto dostane explicitní `aspect-[21/9]`, pevné vyplnění výšky a šířky a `object-cover`. Záměrné malé kartičkové miniatury zůstanou samostatným stylem, pokud audit nějaké najde.
