/** Text der Startseite (Deutsch). Struktur: siehe en.mjs. */
export default {
  meta: {
    title: 'Chatterbox — Ein Messenger ohne Verzeichnis, in dem man dich findet',
    description:
      'Ende-zu-Ende-verschlüsselte Nachrichten, ohne Nutzerverzeichnis, ganz ohne E-Mail-Adresse und mit einer Datenschutzerklärung, die sagt, was sie nicht kann. Web und Android.',
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
    badges: ['Kein Verzeichnis', 'Nur per Einladung', '53 Sprachen', 'Kostenlos'],
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
        title: 'Es gibt keine E-Mail-Adresse zu speichern',
        body: [
          `Die Registrierung fragt nichts über dich. Dein Konto ist eine 24-Wort-Wiederherstellungsphrase, die auf deinem Gerät entsteht, und die Anmeldedaten, die der Server prüft, werden daraus abgeleitet — gespeichert wird eine zufällige Kennung unter einer Domain, die keine Post empfangen kann. Dein Profildokument enthält ebenso wenig eine E-Mail-Adresse, einen Anzeigenamen oder eine Foto-URL, es gibt also auch kein Profil zum Lesen.`,
        ],
      },
      {
        title: 'Versiegelt wird mehr als die Nachricht',
        body: [
          `Nachrichtentext ist der einfache Teil. Linkvorschauen und der Live-Standort werden genauso für das Gespräch verschlüsselt — eine Standortfreigabe ist eine Folge von Koordinaten, und sie ist wie alles andere an den Schlüssel des anderen Geräts versiegelt. Anhänge werden vor dem Hochladen verschlüsselt, der Server hält also Bytes, die er nicht öffnen kann.`,
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
          `Sie hält fest, dass die Verschlüsselung nie unabhängig geprüft wurde, dass Google die Metadaten jeder Verbindung sieht, weil wir seine Server mieten, und dass ein vor deiner ersten Nachricht ausgetauschter Schlüssel völlig normal aussähe. Es ist derselbe Text in der App und auf dieser Seite, in 53 Sprachen — kein englisches Original mit einer weicheren Übersetzung.`,
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
        body: `Anrufe verbinden sich über WebRTC direkt zwischen den beiden Geräten, wenn möglich, und verschlüsseln Audio und Video standardmäßig statt optional. Wenn das nicht geht — oft wegen unterschiedlicher Netzwerke — leitet ein verschlüsseltes Relais den Anruf weiter, ohne ihn entschlüsseln zu können.`,
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
        title: 'Dein Schlüssel, deine Wiederherstellungsphrase',
        body: `Der private Schlüssel, der deine Nachrichten entschlüsselt, ist deine Wiederherstellungsphrase, und wir erhalten ihn nie. Neben der Phrase, die du aufschreibst, speichert die App eine Kopie im eigenen Backup deines Telefons — Google Block Store oder iCloud Keychain —, damit ein neues Telefon ihn wiederherstellen kann. In die Cloud gelangt er nur Ende-zu-Ende-verschlüsselt; Einzelheiten stehen in der Datenschutzerklärung. Wir können ihn dir nicht zurückholen.`,
      },
      {
        title: '53 Sprachen',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — Schrift von rechts nach links eingeschlossen.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Datenschutz-Regler',
    title: 'Was du abschließen kannst',
    items: [
      {
        title: 'App-Sperre',
        body: `Biometrie oder PIN. Sperrt sich jedes Mal wieder, wenn du die App verlässt.`,
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
        'Linkvorschauen und Live-Standort',
        'Sprachtranskripte, sobald sie zu dir zurückkommen',
        'Ton und Bild von Anrufen, zwischen den beiden Geräten',
      ],
    },
    visible: {
      title: `Sichtbar für uns, Google und Cloudflare`,
      items: [
        'Dass ein Gespräch existiert und welche Konten darin sind',
        'Wann jedes Konto zuletzt aktiv war',
        'Die Metadaten jeder Verbindung, einschließlich deiner IP-Adresse',
        'Dass ein Anruf stattfand, mit wem und wann — nicht sein Ton oder Bild',
        `Beide IP-Adressen, wenn ein Anruf zur Verbindung weitergeleitet werden muss — niemals Audio oder Video`,
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
