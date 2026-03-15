/**
 * GDPR / Privacy UI Copy (cs-CZ)
 *
 * Určeno pro školní prostředí. Právně závislé položky
 * jsou označeny jako „nespecifikováno" – konkrétní hodnoty
 * doplní provozovatel dle své role (správce / zpracovatel).
 */

export const GDPR_COPY = {
  privacyCopy: {
    teacherUi: {
      modeSelector: {
        title: "Režim ochrany soukromí",
        description:
          "Zvolte, jak budou žáci identifikováni v této aktivitě.",
        anonymousMode: {
          label: "Anonymní režim",
          badge: "Bez jmen",
          description:
            "Žáci se zobrazují pod pseudonymem (např. „Hráč 7"). Výsledky nelze zpětně přiřadit ke konkrétnímu žákovi.",
          hint: "Vhodné pro procvičování, formativní hodnocení a hry bez známkování.",
        },
        identifiedMode: {
          label: "Známkovaný režim",
          badge: "S identitou",
          description:
            "Výsledky jsou propojeny s účtem žáka. Učitel vidí jméno a skóre.",
          hint: "Vhodné pro testy, úkoly a sumativní hodnocení.",
          warning:
            "Ujistěte se, že zákonní zástupci byli informováni o zpracování osobních údajů žáků.",
        },
      },
      dataRetention: {
        title: "Doba uložení dat",
        body: "Data aktivity jsou uchovávána po dobu stanovenou provozovatelem. Po uplynutí jsou automaticky smazána.",
        unspecified:
          "Konkrétní dobu uložení stanoví škola jako správce údajů.",
      },
      exportWarning:
        "Export obsahuje osobní údaje žáků. Nakládejte s ním v souladu s interními pravidly školy.",
      deleteData: {
        button: "Smazat data aktivity",
        confirm: {
          title: "Smazat data?",
          body: "Budou odstraněny všechny odpovědi a výsledky žáků pro tuto aktivitu. Akce je nevratná.",
          confirm: "Smazat trvale",
          cancel: "Ponechat",
        },
      },
    },

    studentUi: {
      anonymousBanner: {
        title: "Anonymní režim",
        body: "Tvé odpovědi jsou anonymní. Učitel vidí pouze výsledky, ne tvé jméno.",
        icon: "shield",
      },
      identifiedBanner: {
        title: "Známkovaný režim",
        body: "Tvé odpovědi jsou propojeny s tvým účtem. Učitel uvidí tvé jméno a výsledky.",
        icon: "user",
      },
      consentNotice:
        "Odesláním souhlasíš se zpracováním tvých odpovědí pro účely hodnocení.",
      dataInfo: {
        title: "Co se děje s tvými daty?",
        items: [
          "Tvé odpovědi vidí pouze tvůj učitel.",
          "Data jsou uložena na zabezpečeném serveru.",
          "Po skončení školního roku mohou být smazána.",
          "Máš právo požádat o jejich výmaz.",
        ],
      },
    },
  },

  consentFlow: {
    steps: [
      {
        id: "info",
        type: "info" as const,
        title: "Informace o zpracování údajů",
        body: "Tato aplikace zpracovává údaje žáků za účelem vzdělávání a hodnocení. Rozsah závisí na zvoleném režimu (anonymní / známkovaný).",
      },
      {
        id: "purpose",
        type: "detail" as const,
        title: "Účel zpracování",
        items: [
          {
            label: "Vzdělávání",
            description:
              "Zobrazení učebních materiálů, interaktivních aktivit a pracovních listů.",
          },
          {
            label: "Hodnocení",
            description:
              "Zaznamenání odpovědí a výpočet skóre (pouze ve známkovaném režimu).",
          },
          {
            label: "Statistiky pro učitele",
            description:
              "Agregované přehledy úspěšnosti třídy. V anonymním režimu bez identifikace žáka.",
          },
        ],
      },
      {
        id: "scope",
        type: "detail" as const,
        title: "Rozsah zpracovávaných údajů",
        items: [
          {
            label: "Anonymní režim",
            description:
              "Pseudonym, odpovědi, skóre, časové razítko. Žádné jméno ani e-mail.",
          },
          {
            label: "Známkovaný režim",
            description:
              "Jméno, e-mail, odpovědi, skóre, časové razítko, příslušnost ke třídě.",
          },
        ],
      },
      {
        id: "retention",
        type: "info" as const,
        title: "Doba uložení",
        body: "Údaje jsou uchovávány po dobu stanovenou školou. Typicky do konce školního roku, pokud škola nestanoví jinak.",
        unspecified: true,
      },
      {
        id: "rights",
        type: "info" as const,
        title: "Tvá práva",
        body: "Máš právo na přístup ke svým údajům, jejich opravu nebo výmaz. Obrať se na svého učitele nebo kontaktní osobu školy.",
      },
      {
        id: "contact",
        type: "action" as const,
        title: "Kontakt",
        body: "Pro dotazy ohledně zpracování osobních údajů kontaktujte správce aplikace.",
        contactPlaceholder: "Kontaktní údaje doplní provozovatel.",
        unspecified: true,
      },
    ],
  },

  modals: {
    privacyModeSwitch: {
      title: "Změnit režim soukromí?",
      body: "Změna režimu ovlivní, jak budou zobrazeny výsledky žáků. Existující data zůstanou beze změny.",
      confirm: "Změnit",
      cancel: "Zrušit",
    },
    dataExportConsent: {
      title: "Export osobních údajů",
      body: "Exportovaný soubor může obsahovat osobní údaje žáků. Zajistěte, aby byl uložen a sdílen v souladu s GDPR a pravidly školy.",
      confirm: "Exportovat",
      cancel: "Zrušit",
    },
    accountDeletion: {
      title: "Smazání účtu",
      body: "Všechna tvá data budou trvale odstraněna. Tuto akci nelze vrátit zpět.",
      confirm: "Smazat účet",
      cancel: "Ponechat účet",
    },
  },

  helpTexts: {
    whatIsAnonymousMode:
      "V anonymním režimu se žáci zobrazují pod pseudonymem. Učitel vidí výsledky třídy, ale nemůže je přiřadit ke konkrétnímu žákovi. Tento režim je vhodný pro procvičování a neformální aktivity.",
    whatIsIdentifiedMode:
      "Ve známkovaném režimu jsou výsledky propojeny s účtem žáka. Učitel vidí jméno a skóre každého žáka. Tento režim vyžaduje, aby byli zákonní zástupci informováni o zpracování údajů.",
    howLongIsDataStored:
      "Doba uložení závisí na nastavení školy. Doporučujeme data smazat na konci školního roku. Učitel může data smazat kdykoli v nastavení aktivity.",
    whoSeesMyData:
      "Tvé odpovědi vidí pouze tvůj učitel a správce systému. Ostatní žáci tvé výsledky nevidí (pokud učitel nezobrazí žebříček).",
    howToDeleteData:
      "Požádej svého učitele nebo kontaktní osobu školy. Mají možnost tvá data smazat.",
  },

  unspecified: [
    "Konkrétní doba uložení dat – závisí na rozhodnutí školy jako správce údajů.",
    "Role provozovatele aplikace (správce vs. zpracovatel) – závisí na smluvním vztahu se školou.",
    "Kontaktní údaje pověřence pro ochranu osobních údajů (DPO) – doplní škola.",
    "Právní základ zpracování (souhlas vs. oprávněný zájem vs. plnění úkolu ve veřejném zájmu) – závisí na posouzení školy.",
    "Předávání údajů do třetích zemí – závisí na infrastruktuře poskytovatele.",
    "Věková hranice pro souhlas bez zákonného zástupce – dle národní úpravy (v ČR typicky 15 let).",
  ],
} as const;

export type GdprCopy = typeof GDPR_COPY;
