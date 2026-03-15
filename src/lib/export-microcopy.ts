/**
 * Export Wizard — Microcopy (cs-CZ)
 *
 * Tone: profesionální, přátelský, stručný
 * All button labels ≤ 40 chars.
 * Error messages always include a next step.
 */

export const EXPORT_COPY = {
  // ────────── Buttons ──────────
  buttons: {
    exportPptx: "Stáhnout PPTX",
    exportPdf: "Stáhnout PDF",
    exportHtml: "Exportovat HTML",
    retry: "Zkusit znovu",
    reExport: "Exportovat znovu",
    cancel: "Zrušit",
    openFile: "Otevřít soubor",
    printPdf: "Tisknout do PDF",
    downloadReady: "Stáhnout",
    chooseFormat: "Vybrat formát",
    exportForStudent: "Export pro žáky",
    exportForTeacher: "Export pro učitele",
    includeNotes: "Poznámky učitele",
    includeAnswerKey: "Klíč odpovědí",
  },

  // ────────── Modal / Dialog ──────────
  modals: {
    exportTitle: "Export plánu lekce",
    exportDescription: "Vyberte formát a cíl exportu. Žákovský handout neobsahuje klíč odpovědí ani poznámky.",
    confirmOverwrite: "Přepsat existující export?",
    confirmOverwriteBody: "Předchozí export bude nahrazen novým souborem.",
    confirmOverwriteConfirm: "Přepsat",
    confirmOverwriteCancel: "Ponechat stávající",
    targetLabel: "Export pro:",
    targetStudent: "Žák (handout)",
    targetTeacher: "Učitel (klíč)",
    paperLabel: "Formát papíru:",
    paperA4: "A4 (worksheet)",
    paper169: "16:9 (slide handout)",
    formatPptx: "Prezentace pro projektor",
    formatPdf: "Tisknutelný dokument",
    formatHtml: "Interaktivní v prohlížeči",
    formatPptxStudent: "Handout: výklad + placeholdery",
    formatPdfStudent: "Žákovský handout (bez odpovědí)",
    formatHtmlStudent: "Offline balíček pro žáky",
    processingTitle: "Připravuji export…",
    processingBody: "Generování může trvat několik sekund.",
  },

  // ────────── Error messages ──────────
  errors: {
    generic: "Export se nezdařil. Zkuste to prosím znovu.",
    timeout: "Export trval příliš dlouho. Zkuste to znovu nebo zmenšete počet slidů.",
    network: "Nepodařilo se připojit k serveru. Zkontrolujte připojení a zkuste to znovu.",
    unauthorized: "Nemáte oprávnění k exportu. Přihlaste se znovu.",
    planNotFound: "Plán lekce nebyl nalezen. Možná byl smazán.",
    storageFull: "Nedostatek místa pro uložení. Smažte starší exporty a zkuste to znovu.",
    formatUnsupported: "Tento formát zatím není podporován.",
    serverError: "Došlo k chybě na serveru. Zkuste to za chvíli znovu.",
    retryExhausted: "Export se nepodařil ani po opakovaných pokusech. Kontaktujte podporu ZEdu.",
    pptxGeneration: "Nepodařilo se vygenerovat prezentaci. Zkuste to prosím znovu.",
  },

  // ────────── Toasts / Notifications ──────────
  toasts: {
    exportStarted: {
      title: "Export zahájen",
      description: "Soubor se připravuje…",
    },
    exportSucceededPptx: {
      title: "Prezentace stažena",
      description: "PPTX soubor byl uložen do složky Stažené.",
    },
    exportSucceededPdf: {
      title: "PDF připraven",
      description: "Otevřete soubor a použijte Ctrl+P pro tisk.",
    },
    exportSucceededHtml: {
      title: "HTML exportován",
      description: "Soubor je připraven ke sdílení.",
    },
    exportFailed: {
      title: "Export se nezdařil",
      description: "Zkuste to prosím znovu.",
    },
    exportRetrying: {
      title: "Zkouším znovu…",
      description: "Automatický opakovaný pokus.",
    },
    exportTimeout: {
      title: "Časový limit vypršel",
      description: "Zkuste export znovu nebo zmenšete lekci.",
    },
    copied: {
      title: "Odkaz zkopírován",
      description: "Odkaz na export byl zkopírován do schránky.",
    },
  },

  // ────────── Status labels ──────────
  status: {
    idle: "Připraveno",
    queued: "Ve frontě",
    running: "Generuji…",
    succeeded: "Hotovo",
    failed: "Chyba",
  },

  // ────────── Accessibility ──────────
  aria: {
    exportPanel: "Panel exportu plánu lekce",
    formatSelect: "Vyberte formát exportu",
    targetSelect: "Vyberte cíl exportu",
    exportButton: (format: string) => `Exportovat jako ${format}`,
    retryButton: (format: string) => `Zkusit znovu export ${format}`,
    statusLabel: (format: string, status: string) => `Export ${format}: ${status}`,
  },
} as const;

export type ExportCopy = typeof EXPORT_COPY;
