/** Texte de la page d'accueil (français). Structure : voir en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Une messagerie où rien ne permet de vous retrouver`,
    description: `Messagerie chiffrée de bout en bout, sans annuaire d'utilisateurs, sans aucune adresse e-mail, et avec une politique de confidentialité qui dit ce qu'elle ne peut pas faire. Web et Android.`,
  },

  links: {policy: `politique de confidentialité`, policyShort: `Lisez-la`},

  nav: {
    different: `Ce qui change`,
    features: `Fonctionnalités`,
    limits: `Limites`,
    get: `Obtenir`,
    language: `Langue`,
  },

  hero: {
    eyebrow: `Web et Android · iOS en cours`,
    title: `Rien où vous chercher.`,
    lead: `Chatterbox est une messagerie chiffrée de bout en bout sans annuaire d'utilisateurs. Personne ne peut vous rechercher, parce qu'il n'existe aucun index à parcourir : la seule entrée dans une conversation est un lien que vous remettez vous-même à quelqu'un.`,
    primary: `Obtenir Chatterbox`,
    secondary: `Lire la politique de confidentialité`,
    badges: [`Aucun annuaire`, `Sur invitation`, `53 langues`, `Gratuit`],
  },

  different: {
    eyebrow: `Ce qui change`,
    title: `Sept choses que la plupart des messageries ne font pas`,
    intro: `Chacune est une décision avec un mécanisme derrière, pas un réglage qu'il faut aller chercher. Quand quelque chose a un coût, c'est écrit.`,
    reasons: [
      {
        title: `Il n'y a pas d'annuaire d'utilisateurs`,
        body: [
          `Pas de recherche par pseudo, pas de correspondance de numéros de téléphone, pas de « personnes que vous connaissez peut-être ». La seule voie vers une conversation est un lien d'invitation que vous envoyez par un autre canal. Chaque lien ne sert qu'une fois et expire au bout de 24 heures ; une tâche planifiée supprime les liens expirés au lieu de laisser une trace permanente de qui a invité qui.`,
        ],
        note: `Ce n'est pas un réglage de confidentialité. Il n'y a aucun annuaire dont se retirer.`,
      },
      {
        title: `Il n’y a pas d’adresse e-mail à conserver`,
        body: [
          `L’inscription ne demande rien sur vous. Votre compte est une phrase de récupération de 24 mots générée sur votre appareil, et l’identifiant que vérifie le serveur en est dérivé : ce qui y est conservé est une étiquette aléatoire sous un domaine incapable de recevoir du courrier. Votre fiche de profil ne contient pas davantage d’adresse e-mail, de nom affiché ou d’URL de photo, donc personne n’a de profil à lire.`,
        ],
      },
      {
        title: `Ce n'est pas seulement le message qui est scellé`,
        body: [
          `Le texte des messages est la partie facile. Les aperçus de liens et la position en direct sont chiffrés de la même façon pour la conversation : un partage de position est une suite de coordonnées, scellée à la clé de l’autre appareil comme tout le reste. Les pièces jointes sont chiffrées avant d’être envoyées, si bien que le serveur ne détient que des octets qu’il ne peut pas ouvrir.`,
        ],
      },
      {
        title: `Chaque message a sa propre clé`,
        body: [
          `La plupart des conversations individuelles et de groupe utilisent un cliquet, si bien que la compromission d'un appareil n'expose pas les messages antérieurs. Les conversations où le client de quelqu'un n'a pas publié le matériel de clé plus récent retombent sur une clé unique et durable, qui n'a pas cette propriété.`,
        ],
        note: `L'étiquette sous un message vous dit laquelle il a réellement reçue. Ce n'est pas une affirmation sur l'application ; c'est une affirmation sur ce message-là.`,
      },
      {
        title: `Aucune IA ne lit vos conversations`,
        body: [
          `Pas de résumé, pas de traduction, pas de transcription. Rien dans cette application ne déchiffre une conversation pour l’envoyer se faire traiter ailleurs, parce qu’aucune fonction ici ne fait cela. Les réponses suggérées sont calculées sur votre appareil à partir des derniers messages et ne vont nulle part.`,
        ],
        note: `Ces fonctions sont dans le code et désactivées dans cette version ; elles ont vocation à revenir. La section 6 de la politique de confidentialité nomme toujours les trois services qu’elles atteindraient et précise qu’aujourd’hui rien ne leur parvient. Quand elles reviendront, elles reviendront avec cette déclaration et une demande avant la première utilisation.`,
      },
      {
        title: `Chercher quelque chose ne se fait pas dans votre dos`,
        body: [
          `Touchez un nom dans un message et Chatterbox vous montre son article Wikipédia. Cette requête a lieu au moment où vous touchez, et pas autrement, et rien de tout cela n'est écrit dans la conversation.`,
        ],
        note: `Une version antérieure analysait les quinze derniers messages de chaque fil que vous ouvriez et interrogeait Wikipédia jusqu'à trente fois par ouverture — sans rien afficher, parce que les fiches étaient derrière un drapeau qui n'a jamais été activé. Elle a été supprimée plutôt que corrigée.`,
      },
      {
        title: `La politique de confidentialité dit ce qu'elle ne peut pas faire`,
        body: [
          `Elle indique que le chiffrement n’a jamais fait l’objet d’un audit indépendant, que Google voit les métadonnées de chaque connexion parce que nous louons ses serveurs, et qu’une clé substituée avant votre premier message aurait l’air parfaitement normale. C’est le même texte dans l’application et sur ce site, en 53 langues — pas un original anglais accompagné d’une traduction plus douce.`,
        ],
        note: `{policyShort} avant de décider de faire confiance à quoi que ce soit de ce qui précède.`,
      },
    ],
  },

  features: {
    eyebrow: `Fonctionnalités`,
    title: `Ce qu'elle fait vraiment`,
    intro: `Tout ce qui est listé ici a une interface que vous pouvez atteindre. Rien sur cette page ne décrit une capacité qui n'existe que dans le code.`,
    cards: [
      {
        title: `Messages`,
        body: `Texte, photos, vidéo, fichiers et notes vocales. Réponses, transferts, réactions, accusés de lecture, messages épinglés, favoris et envois programmés.`,
      },
      {
        title: `Appels audio et vidéo`,
        body: `Les appels se connectent directement entre les deux appareils via WebRTC lorsque c'est possible, en chiffrant l'audio et la vidéo par défaut plutôt qu'en option. Quand ce n'est pas possible — souvent à cause de réseaux différents — un relais chiffré achemine l'appel sans pouvoir le déchiffrer.`,
      },
      {
        title: `Réponses suggérées`,
        body: `Quelques réponses proposées à partir des derniers messages de la conversation. Elles sont mises en correspondance sur votre appareil avec une liste de formules dans votre langue : rien n’est envoyé nulle part pour les produire.`,
      },
      {
        title: `Recherche Wikipédia`,
        body: `Appui long sur un message, choisissez un nom, et lisez l'article sans quitter la discussion. Une requête, sur votre geste, dans votre langue.`,
      },
      {
        title: `Votre clé, votre phrase de récupération`,
        body: `La clé privée qui déchiffre vos messages ne quitte jamais votre appareil. Vous pouvez la noter sous forme de phrase de récupération ; nous ne la détenons pas et ne pouvons pas la retrouver pour vous.`,
      },
      {
        title: `53 langues`,
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — écriture de droite à gauche comprise.`,
      },
    ],
  },

  controls: {
    eyebrow: `Contrôles de confidentialité`,
    title: `Ce que vous pouvez verrouiller`,
    items: [
      {
        title: `Verrouillage de l'app`,
        body: `Biométrie ou code. L'app se reverrouille chaque fois que vous la quittez.`,
      },
      {
        title: `Vue unique`,
        body: `Photos et vidéos qui se referment définitivement une fois ouvertes.`,
      },
      {
        title: `Messages éphémères`,
        body: `Réglez une conversation pour qu'elle s'efface d'elle-même, d'une heure à trente jours.`,
      },
      {
        title: `Destruction après lecture`,
        body: `Un message qui se détruit dès que l'autre personne l'a lu.`,
      },
      {
        title: `Blocage`,
        body: `Bloquez qui vous voulez. Sans annuaire, ils ne retrouvent pas le chemin.`,
      },
      {
        title: `Export et suppression`,
        body: `Récupérez vos données, ou supprimez le compte et tout ce qu'il contient.`,
      },
    ],
  },

  limits: {
    eyebrow: `Limites`,
    title: `Ce qui n'est pas protégé`,
    intro: `Une page qui ne liste que des qualités est une page dont on ne peut rien décider. Voici la version courte ; la {policy} est la version longue.`,
    sealed: {
      title: `Scellé sur votre appareil`,
      items: [
        `Le texte de vos messages`,
        `Les photos, vidéos, sons et fichiers que vous joignez`,
        `Les aperçus de liens et la position en direct`,
        `Les transcriptions vocales, une fois revenues à vous`,
        `L'audio et la vidéo des appels, entre les deux appareils`,
      ],
    },
    visible: {
      title: `Visible pour nous, Google et Cloudflare`,
      items: [
        `Qu'une conversation existe, et quels comptes en font partie`,
        `La date de dernière activité de chaque compte`,
        `Les métadonnées de chaque connexion, dont votre adresse IP`,
        `Qu’un appel a eu lieu, avec qui et quand — pas son son ni son image`,
        `Les deux adresses IP, quand un appel doit être relayé pour se connecter — jamais son audio ni sa vidéo`,
        `Le nom, le type et la taille de chaque fichier que vous joignez`,
      ],
    },
    note: `Le chiffrement n'a jamais fait l'objet d'un audit indépendant. Retirer ces métadonnées est plus difficile que chiffrer le contenu, et ce travail n'est pas terminé.`,
  },

  download: {
    title: `Obtenir Chatterbox`,
    intro: `L'application web tourne dans un navigateur, sans rien installer. Sur Android, Google Play la tient à jour ; l'APK de ce site est la même version compilée, pour qui préfère éviter la boutique.`,
    introWebOnly: `L'application web tourne dans un navigateur, sans rien installer, sur téléphone comme sur ordinateur. La version Android est en route vers Google Play.`,
    web: `Ouvrir l'application web`,
    play: `Disponible sur Google Play`,
    playPending: `Bientôt sur Google Play`,
    apk: `Télécharger l'APK`,
    playNote: `Sur Android, Google Play est la voie recommandée : la boutique met l'application à jour en arrière-plan et vérifie la signature à chaque installation.`,
    androidPendingNote: `Aucune des deux voies Android n'est encore ouverte : la fiche Play n'est pas publiée et il n'y a pas de téléchargement sur ce site. En attendant, l'entrée est l'application web.`,
    playPendingNote: `La fiche Play n'est pas encore en ligne. En attendant, l'APK est la voie Android — la première fois, Android vous demandera d'autoriser les installations depuis cette source, et il ne se met pas à jour tout seul.`,
    apkNote: `L'APK est signé avec la même clé que la version Play : il s'installe par-dessus et conserve vos données. Il ne se met pas à jour tout seul.`,
    iosNote: `iOS n'est pas encore publié.`,
  },

  footer: {
    rights: `© 2026 Chatterbox. Un projet personnel, décrit honnêtement.`,
    privacy: `Politique de confidentialité`,
  },
};
