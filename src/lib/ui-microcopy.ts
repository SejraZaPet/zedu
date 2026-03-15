/**
 * Unified UI Microcopy (cs-CZ)
 *
 * Tone convention:
 *   – Teacher: vykání (profesionální, respektující)
 *   – Student: tykání (přátelské, motivující)
 *   – Projector: neutrální, stručné (3. osoba / infinitiv)
 *
 * Button labels ≤ 30 chars. Error messages always include a next step.
 */

export const UI_COPY = {
  // ═══════════════════════════════════════
  //  TEACHER
  // ═══════════════════════════════════════
  teacher: {
    buttons: {
      startInClass: "Spustit ve třídě",
      assignOnline: "Zadat online",
      export: "Exportovat",
      exportPptx: "Stáhnout PPTX",
      exportPdf: "Stáhnout PDF",
      generateWorksheet: "Vygenerovat pracovní list",
      reports: "Reporty",
      viewResults: "Zobrazit výsledky",
      endSession: "Ukončit hodinu",
      nextQuestion: "Další otázka",
      showLeaderboard: "Zobrazit žebříček",
      saveChanges: "Uložit změny",
      publish: "Publikovat",
      unpublish: "Stáhnout z publikace",
      duplicate: "Duplikovat",
      delete: "Smazat",
      addItem: "Přidat položku",
      generateMore: "Vygenerovat další",
      preview: "Náhled",
      backToDashboard: "Zpět na přehled",
    },
    modals: {
      endSession: {
        title: "Ukončit hodinu?",
        body: "Výsledky žáků budou uloženy. Hodinu poté nelze znovu spustit.",
        confirm: "Ukončit",
        cancel: "Pokračovat v hodině",
      },
      deleteConfirm: {
        title: "Smazat položku?",
        body: "Tato akce je nevratná. Data budou trvale odstraněna.",
        confirm: "Smazat",
        cancel: "Ponechat",
      },
      publishConfirm: {
        title: "Publikovat pro žáky?",
        body: "Žáci s přístupem uvidí tento obsah okamžitě.",
        confirm: "Publikovat",
        cancel: "Zatím ne",
      },
      assignOnline: {
        title: "Zadat úkol online",
        body: "Vyberte třídu a nastavte termín odevzdání.",
        confirm: "Zadat",
        cancel: "Zrušit",
      },
    },
    labels: {
      className: "Třída",
      deadline: "Termín odevzdání",
      maxAttempts: "Počet pokusů",
      selectClass: "Vyberte třídu",
      noClassesYet: "Zatím nemáte žádnou třídu.",
      studentsCompleted: (n: number, total: number) =>
        `${n} z ${total} žáků odevzdalo`,
      averageScore: (pct: number) => `Průměr: ${pct} %`,
    },
    toasts: {
      saved: { title: "Uloženo", description: "Změny byly uloženy." },
      published: { title: "Publikováno", description: "Obsah je dostupný žákům." },
      deleted: { title: "Smazáno", description: "Položka byla odstraněna." },
      sessionEnded: { title: "Hodina ukončena", description: "Výsledky byly uloženy." },
      assignmentCreated: { title: "Úkol zadán", description: "Žáci ho uvidí ve svém přehledu." },
      exportStarted: { title: "Export zahájen", description: "Soubor se připravuje…" },
    },
    errors: {
      saveFailed: "Uložení se nezdařilo. Zkuste to prosím znovu.",
      loadFailed: "Nepodařilo se načíst data. Obnovte stránku.",
      sessionStartFailed: "Hodinu se nepodařilo spustit. Zkontrolujte připojení a zkuste to znovu.",
      noStudents: "Ve třídě nejsou žádní žáci. Přidejte žáky a zkuste to znovu.",
    },
  },

  // ═══════════════════════════════════════
  //  STUDENT
  // ═══════════════════════════════════════
  student: {
    buttons: {
      join: "Připojit se",
      submit: "Odeslat",
      continue: "Pokračovat",
      back: "Zpět",
      tryAgain: "Zkusit znovu",
      startAssignment: "Začít úkol",
      resumeAssignment: "Pokračovat v úkolu",
      viewResults: "Zobrazit výsledky",
      nextItem: "Další",
      previousItem: "Předchozí",
      finishWorksheet: "Dokončit a odeslat",
      confirmSubmit: "Ano, odeslat",
      cancelSubmit: "Ještě ne",
    },
    states: {
      waitingForTeacher: "Čekej na učitele…",
      done: "Hotovo!",
      submitting: "Odesílám…",
      saving: "Ukládám…",
      loading: "Načítám…",
      connecting: "Připojuji se…",
      gameOver: "Hra skončila",
      timesUp: "Čas vypršel!",
      correctAnswer: "Správně!",
      wrongAnswer: "Špatně",
      partialAnswer: "Částečně správně",
      alreadySubmitted: "Úkol už máš odevzdaný.",
      noAttemptsLeft: "Vyčerpal jsi všechny pokusy.",
      scoreResult: (score: number, max: number) =>
        `${score} z ${max} bodů`,
      percentResult: (pct: number) => `${pct} %`,
    },
    modals: {
      submitAssignment: {
        title: "Odevzdat úkol?",
        body: "Po odeslání už odpovědi nepůjde změnit.",
        confirm: "Odeslat",
        cancel: "Ještě zkontrolovat",
      },
      connectionLost: {
        title: "Přerušeno připojení",
        body: "Tvoje odpovědi jsou uložené. Zkus se připojit znovu.",
        confirm: "Zkusit znovu",
      },
      timeWarning: {
        title: "Zbývá málo času!",
        body: (mins: number) =>
          `Zbývá ${mins} ${mins === 1 ? "minuta" : mins < 5 ? "minuty" : "minut"}. Nezapomeň odeslat.`,
      },
      exitConfirm: {
        title: "Opravdu odejít?",
        body: "Odpovědi se uloží, ale úkol nebude odevzdán.",
        confirm: "Odejít",
        cancel: "Zůstat",
      },
    },
    toasts: {
      submitted: { title: "Odevzdáno!", description: "Tvoje odpovědi byly odeslány." },
      saved: { title: "Uloženo", description: "Postup je uložen." },
      joined: { title: "Připojeno", description: "Jsi ve hře!" },
      connectionRestored: { title: "Připojeno", description: "Spojení bylo obnoveno." },
    },
    errors: {
      joinFailed: "Nepodařilo se připojit. Zkontroluj kód a zkus to znovu.",
      submitFailed: "Odeslání se nezdařilo. Zkus to znovu.",
      loadFailed: "Nepodařilo se načíst úkol. Obnov stránku.",
      gameNotFound: "Hra s tímto kódem neexistuje. Zkontroluj kód.",
      sessionEnded: "Tato hodina už skončila.",
    },
  },

  // ═══════════════════════════════════════
  //  PROJECTOR / LIVE SCREEN
  // ═══════════════════════════════════════
  projector: {
    headline: "Naskenuj QR kód",
    body: "nebo zadej kód na zedu.cz/hra",
    waitingForPlayers: "Čekáme na hráče…",
    getReady: "Připravte se!",
    questionOf: (current: number, total: number) =>
      `Otázka ${current} z ${total}`,
    leaderboard: "Žebříček",
    finalResults: "Konečné výsledky",
    gameOver: "Hra skončila!",
    nextQuestionIn: (sec: number) =>
      `Další otázka za ${sec} s`,
    playerCount: (n: number) =>
      `${n} ${n === 1 ? "hráč" : n < 5 ? "hráči" : "hráčů"}`,
  },

  // ═══════════════════════════════════════
  //  SHARED / COMMON
  // ═══════════════════════════════════════
  common: {
    loading: "Načítání…",
    error: "Něco se pokazilo",
    retry: "Zkusit znovu",
    cancel: "Zrušit",
    close: "Zavřít",
    yes: "Ano",
    no: "Ne",
    ok: "OK",
    search: "Hledat…",
    noResults: "Žádné výsledky",
    connectionLost: "Připojení ztraceno. Zkontroluj internet a zkus to znovu.",
  },

  // ═══════════════════════════════════════
  //  ACCESSIBILITY
  // ═══════════════════════════════════════
  a11y: {
    lobby: {
      playerListLabel: "Seznam připojených hráčů",
      playerJoined: (name: string) => `Hráč ${name} se připojil`,
      gameCodeLabel: "Kód hry",
    },
    export: {
      panelLabel: "Panel exportu lekce",
      statusSuccess: "Export byl úspěšný",
      statusFailed: "Export se nezdařil",
      statusRunning: "Export probíhá…",
    },
    matching: {
      instruction: "Ke každé položce vlevo vyberte odpovídající položku vpravo.",
      leftItemLabel: (item: string) => `Položka: ${item}`,
      selectMatch: (item: string) => `Vyberte pár pro: ${item}`,
      chooseOption: "Vyberte odpověď",
      paired: "Spárováno",
      checkAnswers: "Ověřit odpovědi",
      allCorrect: "Všechny páry jsou správně!",
      someWrong: "Některé páry jsou špatně.",
      tryAgain: "Zkusit znovu",
    },
    hotspot: {
      instruction: "Vyberte oblast na obrázku, která odpovídá zadání.",
      selectArea: "Vyberte oblast",
      areaOption: (label: string) => `Oblast: ${label}`,
      correct: "Správně!",
      wrong: "Špatně – správná oblast je vyznačena.",
      next: "Další",
      showResults: "Zobrazit výsledky",
      result: (correct: number, total: number, pct: number) =>
        `${correct} z ${total} správně (${pct} %)`,
      retry: "Zkusit znovu",
    },
  },
} as const;

export type UiCopy = typeof UI_COPY;
