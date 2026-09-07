/** Text der Startseite (Deutsch). Struktur: siehe en.mjs. */
export default {
  meta: {
    title: 'Chatterbox — Ein Messenger ohne Verzeichnis, in dem man dich findet',
    description:
      'Ende-zu-Ende-verschlüsselte Nachrichten, ohne Nutzerverzeichnis, ohne gespeicherte E-Mail-Adresse und mit einer Datenschutzerklärung, die sagt, was sie nicht kann. Web und Android.',
  },

  links: {policy: 'Datenschutzerklärung', policyShort: 'Lies sie'},

  nav: {
    different: 'Was anders ist',
    features: 'Funktionen',
    limits: 'Grenzen',
    get: 'Holen',
    language: 'Sprache',
  },

  hero: {
    eyebrow: 'Web und Android · iOS in Arbeit',
    title: 'Nichts, worin man dich nachschlagen kann.',
    lead: `Chatterbox ist ein Ende-zu-Ende-verschlüsselter Messenger ohne Nutzerverzeichnis. Niemand kann nach dir suchen, weil es keinen Index gibt, in dem gesucht werden könnte — der einzige Weg in ein Gespräch ist ein Link, den du selbst jemandem gibst.`,
    primary: 'Chatterbox holen',
    secondary: 'Datenschutzerklärung lesen',
    badges: ['Kein Verzeichnis', 'Nur per Einladung', '15 Sprachen', 'Kostenlos'],
  },

  different: {
    eyebrow: 'Was anders ist',
    title: 'Sieben Dinge, die die meisten Messenger nicht tun',
    intro: `Hinter jedem Punkt steht ein Mechanismus, keine Einstellung, die du erst finden musst. Wo etwas seinen Preis hat, steht es dabei.`,
    reasons: [
      {
        title: 'Es gibt kein Nutzerverzeichnis',
        body: [
          `Keine Suche nach Benutzernamen, kein Abgleich von Telefonnummern, keine „Personen, die du kennen könntest“. Der einzige Weg in ein Gespräch ist ein Einladungslink, den du über einen anderen Kanal verschickst. Jeder Link funktioniert einmal und verfällt nach 24 Stunden, und ein geplanter Job löscht die abgelaufenen, statt eine dauerhafte Aufzeichnung darüber zu hinterlassen, wer wen eingeladen hat.`,
        ],
        note: `Das ist keine Datenschutzeinstellung. Es gibt kein Verzeichnis, aus dem man sich abmelden könnte.`,
      },
      {
        title: 'Der Server speichert deine E-Mail-Adresse nicht',
        body: [
          `Du meldest dich mit einer an, und damit hat es sich. Dein Profildokument enthält keine E-Mail-Adresse, keinen Anzeigenamen und keine Foto-URL. Es gibt kein Profil, das jemand anderes lesen könnte, denn die Einzigen, die dich erreichen, sind die, die du eingeladen hast.`,
        ],
      },
      {
        title: 'Versiegelt wird mehr als die Nachricht',
        body: [
          `Nachrichtentext ist der einfache Teil. Linkvorschauen, geteilte Listen, gespeicherte Zitate und Sprachtranskripte werden genauso für das Gespräch verschlüsselt. Ein Sprachtranskript wurde früher von einer Serverfunktion im Klartext zurück in die Nachricht geschrieben; heute wird es auf deinem Gerät versiegelt, und Übersetzungen werden überhaupt nicht gespeichert.`,
        ],
      },
      {
        title: 'Jede Nachricht hat ihren eigenen Schlüssel',
        body: [
          `Die meisten Einzel- und Gruppengespräche nutzen eine Ratsche, sodass ein kompromittiertes Gerät die vorherigen Nachrichten nicht preisgibt. Gespräche, in denen der Client einer Person das neuere Schlüsselmaterial nicht veröffentlicht hat, fallen auf einen einzelnen langlebigen Schlüssel zurück, der diese Eigenschaft nicht hat.`,
        ],
        note: `Die Beschriftung unter einer Nachricht sagt dir, was sie tatsächlich bekommen hat. Das ist keine Aussage über die App, sondern über diese eine Nachricht.`,
      },
      {
        title: `Keine KI liest deine Gespräche`,
        body: [
          `Keine Zusammenfassungen, keine Übersetzung, keine Transkription. Nichts in dieser App entschlüsselt ein Gespräch, um es zur Verarbeitung an Dritte zu schicken, denn es gibt hier keine Funktion, die das tut. Antwortvorschläge werden auf deinem Gerät aus den letzten Nachrichten berechnet und gehen nirgendwohin.`,
        ],
        note: `Diese Funktionen stehen im Code und sind in dieser Version abgeschaltet; sie sollen zurückkommen. Abschnitt 6 der Datenschutzerklärung nennt weiterhin die drei Dienste, die sie erreichen würden, und sagt, dass sie heute nichts erreichen. Wenn sie zurückkommen, kommen sie mit dieser Offenlegung und einer Nachfrage vor dem ersten Mal.`,
      },
      {
        title: 'Etwas nachzuschlagen passiert nicht hinter deinem Rücken',
        body: [
          `Tippe einen Namen in einer Nachricht an, und Chatterbox zeigt dir den Wikipedia-Artikel dazu. Diese Anfrage geschieht beim Tippen und sonst nicht, und nichts davon wird in das Gespräch geschrieben.`,
        ],
        note: `Eine frühere Version durchsuchte die letzten fünfzehn Nachrichten jedes geöffneten Verlaufs und fragte Wikipedia bis zu dreißigmal pro Öffnung ab — und zeigte dabei nichts an, weil die Karten hinter einem Schalter lagen, der nie an war. Sie wurde entfernt statt repariert.`,
      },
      {
        title: 'Die Datenschutzerklärung sagt, was sie nicht kann',
        body: [
          `Sie hält fest, dass die Verschlüsselung nie unabhängig geprüft wurde, dass Google die Metadaten jeder Verbindung sieht, weil wir seine Server mieten, und dass Absturzberichte eine Kontokennung tragen und nicht anonym sind. Es ist derselbe Text in der App und auf dieser Seite, in fünfzehn Sprachen — kein englisches Original mit einer weicheren Übersetzung.`,
        ],
        note: `{policyShort}, bevor du entscheidest, ob du irgendetwas davon glaubst.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funktionen',
    title: 'Was sie wirklich kann',
    intro: `Alles hier hat eine Oberfläche, die du erreichen kannst. Nichts auf dieser Seite beschreibt eine Fähigkeit, die nur im Code existiert.`,
    cards: [
      {
        title: 'Nachrichten',
        body: `Text, Fotos, Video, Dateien und Sprachnachrichten. Antworten, Weiterleiten, Reaktionen, Lesebestätigungen, angeheftete Nachrichten, Lesezeichen und geplante Nachrichten.`,
      },
      {
        title: 'Sprach- und Videoanrufe',
        body: `Peer-to-Peer-Anrufe über WebRTC, das die Medien zwischen den beiden Geräten standardmäßig verschlüsselt und nicht erst auf Wunsch.`,
      },
      {
        title: `Antwortvorschläge`,
        body: `Ein paar Antworten, vorgeschlagen anhand der letzten Nachrichten des Gesprächs. Abgeglichen wird auf deinem Gerät gegen eine Phrasenliste in deiner Sprache — es wird nichts irgendwohin geschickt, um sie zu erzeugen.`,
      },
      {
        title: 'Wikipedia-Nachschlag',
        body: `Nachricht lange drücken, einen Namen darin wählen und den Artikel lesen, ohne den Chat zu verlassen. Eine Anfrage, auf dein Antippen, in deiner Sprache.`,
      },
      {
        title: 'Geteilte Listen und Zitatwand',
        body: `Eine Liste, die ihr beide abhaken könnt, und ein Ort für die Sätze, die es wert sind. Beide für das Gespräch versiegelt wie die Nachrichten.`,
      },
      {
        title: 'Fünfzehn Sprachen',
        body: `Englisch, Chinesisch in beiden Schriften, Japanisch, Koreanisch, Spanisch, Französisch, Deutsch, Italienisch, Portugiesisch, Russisch, Türkisch, Vietnamesisch, Arabisch und Hindi — Schrift von rechts nach links eingeschlossen.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Datenschutz-Regler',
    title: 'Was du abschließen kannst',
    items: [
      {
        title: 'App-Sperre',
        body: `Biometrie oder PIN, mit einer Sperrverzögerung deiner Wahl.`,
      },
      {
        title: 'Einmal ansehen',
        body: `Fotos und Videos, die sich nach dem Öffnen endgültig schließen.`,
      },
      {
        title: 'Verschwindende Nachrichten',
        body: `Lass ein Gespräch sich selbst leeren, von einer Stunde bis zu dreißig Tagen.`,
      },
      {
        title: 'Nach dem Lesen zerstören',
        body: `Eine Nachricht, die sich zerstört, sobald die andere Person sie gelesen hat.`,
      },
      {
        title: 'Blockieren',
        body: `Blockiere, wen du willst. Ohne Verzeichnis finden sie nicht zurück.`,
      },
      {
        title: 'Export und Löschung',
        body: `Nimm deine Daten mit, oder lösche das Konto und alles darunter.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Grenzen',
    title: 'Was nicht geschützt ist',
    intro: `Eine Seite, die nur Stärken auflistet, ist eine Seite, mit der man nichts entscheiden kann. Das hier ist die kurze Fassung; die {policy} ist die lange.`,
    sealed: {
      title: 'Auf deinem Gerät versiegelt',
      items: [
        'Der Text deiner Nachrichten',
        'Fotos, Video, Audio und Dateien, die du anhängst',
        'Linkvorschauen, geteilte Listen, gespeicherte Zitate',
        'Sprachtranskripte, sobald sie zu dir zurückkommen',
        'Ton und Bild von Anrufen, zwischen den beiden Geräten',
      ],
    },
    visible: {
      title: 'Für uns und für Google sichtbar',
      items: [
        'Dass ein Gespräch existiert und welche Konten darin sind',
        'Wann jedes Konto zuletzt aktiv war',
        'Die Metadaten jeder Verbindung, einschließlich deiner IP-Adresse',
        'Absturz- und Nutzungsberichte, die eine Kontokennung tragen',
        'Name, Typ und Größe jeder Datei, die du anhängst',
      ],
    },
    note: `Die Verschlüsselung wurde nie unabhängig geprüft. Diese Metadaten loszuwerden ist schwerer, als den Inhalt zu verschlüsseln, und diese Arbeit ist nicht fertig.`,
  },

  download: {
    title: 'Chatterbox holen',
    intro: `Die Web-App läuft im Browser, ohne Installation. Auf Android hält Google Play sie aktuell; die APK auf dieser Seite ist derselbe Build, für alle, die den Store lieber meiden.`,
    introWebOnly: `Die Web-App läuft im Browser, ohne Installation, auf dem Telefon wie am Rechner. Der Android-Build ist auf dem Weg zu Google Play.`,
    web: 'Web-App öffnen',
    play: 'Bei Google Play',
    playPending: 'Demnächst bei Google Play',
    apk: 'APK herunterladen',
    playNote: `Auf Android ist Google Play der empfohlene Weg: Der Store aktualisiert die App im Hintergrund und prüft bei jeder Installation die Signatur.`,
    androidPendingNote: `Noch ist kein Android-Weg offen: Der Play-Eintrag ist nicht veröffentlicht, und auf dieser Seite gibt es keinen Download. Bis dahin führt der Weg über die Web-App.`,
    playPendingNote: `Der Play-Eintrag ist noch nicht online. Bis dahin ist die APK der Android-Weg — Android fragt beim ersten Mal, ob es Installationen aus dieser Quelle erlauben darf, und sie aktualisiert sich nicht selbst.`,
    apkNote: `Die APK ist mit demselben Schlüssel signiert wie der Play-Build, installiert sich also darüber und behält deine Daten. Sie aktualisiert sich nicht selbst.`,
    iosNote: `iOS ist noch nicht veröffentlicht.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Ein persönliches Projekt, ehrlich beschrieben.',
    privacy: 'Datenschutzerklärung',
  },
};
