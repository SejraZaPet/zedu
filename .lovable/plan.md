# Oprava pořadí vrstev bot

## Postup
- Potvrdit všechna místa, která skládají vrstvy avatara, a ověřit sdílený zdroj pořadí.
- Přesunout `clothing_shoes` před `clothing_bottom` v pořadí zdola nahoru; celé outfity ponechat nad botami.
- Ověřit typy, sestavení a cílený test pořadí.
- V přihlášeném náhledu zkontrolovat avatara s botami a kalhotami v editoru i sdíleném vykreslení profilu/hry.

## Technické detaily
Změna má být v jediném sdíleném poli `SLOT_LAYER_ORDER`, pokud průzkum potvrdí, že jej používají všechny renderery. Tím zůstane pořadí shodné v editoru, profilové bublině, administraci i hrách.
