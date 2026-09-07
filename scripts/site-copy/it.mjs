/** Testo della pagina iniziale (italiano). Struttura: vedi en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Una messaggistica senza un elenco in cui cercarti`,
    description: `Messaggi cifrati end-to-end, senza elenco utenti, senza alcun indirizzo e-mail e con un'informativa sulla privacy che dice ciò che non può fare. Web e Android.`,
  },

  links: {policy: `informativa sulla privacy`, policyShort: `Leggila`},

  nav: {
    different: `Cosa cambia`,
    features: `Funzioni`,
    limits: `Limiti`,
    get: `Scaricala`,
    language: `Lingua`,
  },

  hero: {
    eyebrow: `Web e Android · iOS in corso`,
    title: `Nessun elenco in cui cercarti.`,
    lead: `Chatterbox è una messaggistica cifrata end-to-end senza elenco utenti. Nessuno può cercarti, perché non esiste alcun indice da cercare: l'unica via per entrare in una conversazione è un link che consegni tu stesso a qualcuno.`,
    primary: `Scarica Chatterbox`,
    secondary: `Leggi l'informativa sulla privacy`,
    badges: [`Nessun elenco utenti`, `Solo su invito`, `15 lingue`, `Gratis`],
  },

  different: {
    eyebrow: `Cosa cambia`,
    title: `Sette cose che quasi nessuna messaggistica fa`,
    intro: `Dietro ognuna c'è un meccanismo, non un'impostazione da andare a cercare. Dove qualcosa ha un prezzo, è scritto.`,
    reasons: [
      {
        title: `Non esiste un elenco utenti`,
        body: [
          `Nessuna ricerca per nome utente, nessun confronto di numeri di telefono, nessun «persone che potresti conoscere». L'unica strada verso una conversazione è un link di invito che mandi per un altro canale. Ogni link funziona una volta e scade dopo 24 ore, e un'operazione pianificata cancella quelli scaduti invece di lasciare un registro permanente di chi ha invitato chi.`,
        ],
        note: `Non è un'impostazione sulla privacy. Non c'è alcun elenco da cui uscire.`,
      },
      {
        title: `Non c'è alcun indirizzo e-mail da conservare`,
        body: [
          `La registrazione non chiede nulla su di te. Il tuo account è una frase di recupero di 24 parole generata sul tuo dispositivo, e la credenziale che il server verifica ne deriva: quello che conserva è un'etichetta casuale sotto un dominio che non può ricevere posta. Nemmeno il documento del tuo profilo contiene indirizzo e-mail, nome visualizzato o URL della foto, quindi non c'è un profilo che altri possano leggere.`,
        ],
      },
      {
        title: `A essere sigillati non sono solo i messaggi`,
        body: [
          `Il testo dei messaggi è la parte facile. Le anteprime dei link e la posizione in tempo reale sono cifrate allo stesso modo per quella conversazione: condividere la posizione è una sequenza di coordinate, sigillata alla chiave dell'altro dispositivo come tutto il resto. Gli allegati sono cifrati prima di essere caricati, quindi il server conserva byte che non può aprire.`,
        ],
      },
      {
        title: `Ogni messaggio ha la propria chiave`,
        body: [
          `La maggior parte delle conversazioni singole e di gruppo usa un cricchetto, così compromettere un dispositivo non espone i messaggi precedenti. Le conversazioni in cui il client di qualcuno non ha pubblicato il materiale di chiave più recente ricadono su un'unica chiave di lunga durata, che non ha quella proprietà.`,
        ],
        note: `L'etichetta sotto un messaggio ti dice quale ha ricevuto davvero. Non è un'affermazione sull'app; è un'affermazione su quel messaggio.`,
      },
      {
        title: `Nessuna IA legge le tue conversazioni`,
        body: [
          `Niente riassunti, niente traduzione, niente trascrizione. Nulla in quest'app decifra una conversazione per mandarla a elaborare a terzi, perché qui non c'è alcuna funzione che lo faccia. Le risposte suggerite sono calcolate sul tuo dispositivo dagli ultimi messaggi e non vanno da nessuna parte.`,
        ],
        note: `Quelle funzioni sono nel codice e spente in questa versione; l'intenzione è che tornino. La sezione 6 dell'informativa nomina ancora i tre servizi che raggiungerebbero e dice che oggi non arriva loro nulla. Quando torneranno, torneranno con quell'informativa e con una richiesta prima del primo uso.`,
      },
      {
        title: `Cercare qualcosa non avviene alle tue spalle`,
        body: [
          `Tocca un nome dentro un messaggio e Chatterbox ti mostra la sua voce di Wikipedia. Quella richiesta avviene al tocco e non altrimenti, e nulla di essa viene scritto nella conversazione.`,
        ],
        note: `Una versione precedente scansionava gli ultimi quindici messaggi di ogni conversazione che aprivi e interrogava Wikipedia fino a trenta volte per apertura — senza mostrare nulla, perché le schede erano dietro un interruttore mai acceso. È stata rimossa anziché corretta.`,
      },
      {
        title: `L'informativa dice ciò che non può fare`,
        body: [
          `Dichiara che la cifratura non è mai stata verificata da terzi indipendenti, che Google vede i metadati di ogni connessione perché ne affittiamo i server, e che una chiave sostituita prima del tuo primo messaggio sembrerebbe del tutto normale. È lo stesso testo nell'app e su questo sito, in quindici lingue — non un originale inglese con una traduzione più morbida.`,
        ],
        note: `{policyShort} prima di decidere se fidarti di qualcosa di quanto sopra.`,
      },
    ],
  },

  features: {
    eyebrow: `Funzioni`,
    title: `Cosa fa davvero`,
    intro: `Tutto ciò che è elencato qui ha un'interfaccia che puoi raggiungere. Niente in questa pagina descrive una capacità che esiste solo nel codice.`,
    cards: [
      {
        title: `Messaggi`,
        body: `Testo, foto, video, file e note vocali. Risposte, inoltri, reazioni, conferme di lettura, messaggi fissati, segnalibri e messaggi programmati.`,
      },
      {
        title: `Chiamate audio e video`,
        body: `Chiamate peer-to-peer su WebRTC, che cifra il flusso tra i due dispositivi per impostazione predefinita e non come opzione.`,
      },
      {
        title: `Risposte suggerite`,
        body: `Qualche risposta proposta a partire dagli ultimi messaggi della conversazione. Il confronto avviene sul tuo dispositivo con un elenco di frasi nella tua lingua: per produrle non viene inviato nulla da nessuna parte.`,
      },
      {
        title: `Ricerca su Wikipedia`,
        body: `Tieni premuto un messaggio, scegli un nome al suo interno e leggi la voce senza uscire dalla chat. Una richiesta, al tuo tocco, nella tua lingua.`,
      },
      {
        title: `La tua chiave, la tua frase di recupero`,
        body: `La chiave privata che decifra i tuoi messaggi non lascia mai il tuo dispositivo. Puoi annotarla come frase di recupero; noi non la conserviamo e non possiamo recuperarla per te.`,
      },
      {
        title: `Quindici lingue`,
        body: `Inglese, cinese in entrambe le scritture, giapponese, coreano, spagnolo, francese, tedesco, italiano, portoghese, russo, turco, vietnamita, arabo e hindi — scrittura da destra a sinistra compresa.`,
      },
    ],
  },

  controls: {
    eyebrow: `Controlli sulla privacy`,
    title: `Cosa puoi chiudere a chiave`,
    items: [
      {
        title: `Blocco dell'app`,
        body: `Biometria o PIN, con il ritardo di blocco automatico che scegli tu.`,
      },
      {
        title: `Visualizzazione singola`,
        body: `Foto e video che si chiudono per sempre dopo essere stati aperti.`,
      },
      {
        title: `Messaggi a tempo`,
        body: `Imposta una conversazione perché si svuoti da sola, da un'ora a trenta giorni.`,
      },
      {
        title: `Distruggi dopo la lettura`,
        body: `Un messaggio che si distrugge appena l'altra persona lo ha letto.`,
      },
      {
        title: `Blocco dei contatti`,
        body: `Blocca chi vuoi. Senza elenco, non trovano la strada del ritorno.`,
      },
      {
        title: `Esporta ed elimina`,
        body: `Porta via i tuoi dati, oppure elimina l'account e tutto ciò che contiene.`,
      },
    ],
  },

  limits: {
    eyebrow: `Limiti`,
    title: `Cosa non è protetto`,
    intro: `Una pagina che elenca solo i pregi è una pagina con cui non puoi decidere nulla. Questa è la versione breve; l'{policy} è quella lunga.`,
    sealed: {
      title: `Sigillato sul tuo dispositivo`,
      items: [
        `Il testo dei tuoi messaggi`,
        `Foto, video, audio e file che alleghi`,
        `Anteprime dei link e posizione in tempo reale`,
        `Le trascrizioni vocali, una volta tornate a te`,
        `Audio e video delle chiamate, tra i due dispositivi`,
      ],
    },
    visible: {
      title: `Visibile a noi e a Google`,
      items: [
        `Che una conversazione esiste, e quali account ne fanno parte`,
        `Quando ogni account è stato attivo l'ultima volta`,
        `I metadati di ogni connessione, incluso il tuo indirizzo IP`,
        `Che una chiamata c'è stata, con chi e quando — non il suo audio né il video`,
        `Il nome, il tipo e la dimensione di ogni file che alleghi`,
      ],
    },
    note: `La cifratura non è mai stata verificata da terzi indipendenti. Togliere quei metadati è più difficile che cifrare i contenuti, e quel lavoro non è finito.`,
  },

  download: {
    title: `Scarica Chatterbox`,
    intro: `L'app web gira nel browser senza installare nulla. Su Android, Google Play la tiene aggiornata; l'APK su questo sito è la stessa build, per chi preferisce evitare lo store.`,
    introWebOnly: `L'app web gira nel browser senza installare nulla, sul telefono come sul computer. La build per Android è in viaggio verso Google Play.`,
    web: `Apri l'app web`,
    play: `Disponibile su Google Play`,
    playPending: `Presto su Google Play`,
    apk: `Scarica l'APK`,
    playNote: `Su Android la via consigliata è Google Play: aggiorna l'app in secondo piano e verifica la firma a ogni installazione.`,
    androidPendingNote: `Nessuna delle due vie Android è ancora aperta: la scheda su Play non è pubblicata e su questo sito non c'è alcun download. Fino ad allora si entra dall'app web.`,
    playPendingNote: `La scheda su Play non è ancora online. Fino ad allora l'APK è la via Android — la prima volta Android ti chiederà di consentire le installazioni da questa origine, e non si aggiorna da solo.`,
    apkNote: `L'APK è firmato con la stessa chiave della build su Play, quindi si installa sopra e conserva i tuoi dati. Non si aggiorna da solo.`,
    iosNote: `iOS non è ancora stato pubblicato.`,
  },

  footer: {
    rights: `© 2026 Chatterbox. Un progetto personale, descritto onestamente.`,
    privacy: `Informativa sulla privacy`,
  },
};
