/** Texto da página inicial (português). Estrutura: ver en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Uma aplicação de mensagens sem nada onde te procurar`,
    description: `Mensagens cifradas ponta a ponta, sem diretório de utilizadores, sem qualquer endereço de e-mail e com uma política de privacidade que diz o que não consegue fazer. Web e Android.`,
  },

  links: {policy: `política de privacidade`, policyShort: `Lê-a`},

  nav: {
    different: `O que muda`,
    features: `Funcionalidades`,
    limits: `Limites`,
    get: `Obter`,
    language: `Idioma`,
  },

  hero: {
    eyebrow: `Web e Android · iOS em curso`,
    title: `Nada onde te procurar.`,
    lead: `O Chatterbox é uma aplicação de mensagens cifrada ponta a ponta, sem diretório de utilizadores. Ninguém te consegue pesquisar, porque não existe índice nenhum para pesquisar — a única entrada numa conversa é um link que entregas tu próprio a alguém.`,
    primary: `Obter o Chatterbox`,
    secondary: `Ler a política de privacidade`,
    badges: [`Sem diretório`, `Só por convite`, `53 idiomas`, `Grátis`],
  },

  different: {
    eyebrow: `O que muda`,
    title: `Sete coisas que a maioria das aplicações de mensagens não faz`,
    intro: `Cada uma é uma decisão com um mecanismo por trás, não uma definição que tens de ir descobrir. Onde há um custo, está dito.`,
    reasons: [
      {
        title: `Não existe diretório de utilizadores`,
        body: [
          `Sem pesquisa por nome de utilizador, sem cruzamento de números de telefone, sem «pessoas que talvez conheças». O único caminho para uma conversa é um link de convite que envias por outro meio. Cada link serve uma vez e expira ao fim de 24 horas, e uma tarefa agendada apaga os expirados em vez de deixar um registo permanente de quem convidou quem.`,
        ],
        note: `Isto não é uma definição de privacidade. Não há diretório nenhum de onde sair.`,
      },
      {
        title: `Não há endereço de e-mail para guardar`,
        body: [
          `Criar conta não pergunta nada sobre ti. A tua conta é uma frase de recuperação de 24 palavras gerada no teu dispositivo, e a credencial que o servidor verifica é derivada dessas palavras — o que fica guardado é uma etiqueta aleatória num domínio que não consegue receber correio. O documento do teu perfil também não tem endereço de e-mail, nem nome visível, nem URL de fotografia, por isso não há perfil que alguém possa ler.`,
        ],
      },
      {
        title: `Selado é mais do que as mensagens`,
        body: [
          `O texto das mensagens é a parte fácil. As pré-visualizações de links e a localização em tempo real são cifradas da mesma forma para aquela conversa: partilhar a localização é uma sequência de coordenadas, selada à chave do outro dispositivo como tudo o resto. Os anexos são cifrados antes de serem enviados, por isso o que o servidor guarda são bytes que não consegue abrir.`,
        ],
      },
      {
        title: `Cada mensagem tem a sua própria chave`,
        body: [
          `A maioria das conversas individuais e de grupo usa um roquete, por isso comprometer um dispositivo não expõe as mensagens anteriores. As conversas em que o cliente de alguém não publicou o material de chave mais recente recaem numa única chave de longa duração, que não tem essa propriedade.`,
        ],
        note: `A etiqueta por baixo de uma mensagem diz-te qual foi a que ela realmente recebeu. Não é uma afirmação sobre a aplicação; é uma afirmação sobre aquela mensagem.`,
      },
      {
        title: `Nenhuma IA lê as tuas conversas`,
        body: [
          `Não há resumos, nem tradução, nem transcrição. Nada nesta aplicação decifra uma conversa para a mandar processar por terceiros, porque aqui não existe nenhuma funcionalidade que o faça. As respostas sugeridas são calculadas no teu dispositivo a partir das últimas mensagens e não vão a lado nenhum.`,
        ],
        note: `Essas funcionalidades estão no código e desligadas nesta versão; a intenção é que voltem. A secção 6 da política de privacidade continua a nomear os três serviços que alcançariam e diz que hoje nada lhes chega. Quando voltarem, voltam com essa divulgação e com uma pergunta antes da primeira utilização.`,
      },
      {
        title: `Consultar algo não acontece nas tuas costas`,
        body: [
          `Toca num nome dentro de uma mensagem e o Chatterbox mostra-te o artigo da Wikipédia. Esse pedido acontece no toque e não de outra forma, e nada dele é escrito na conversa.`,
        ],
        note: `Uma versão anterior analisava as últimas quinze mensagens de cada conversa que abrias e consultava a Wikipédia até trinta vezes por abertura — sem mostrar nada, porque os cartões estavam atrás de um interruptor que nunca esteve ligado. Foi removida em vez de corrigida.`,
      },
      {
        title: `A política de privacidade diz o que não consegue fazer`,
        body: [
          `Declara que a cifra nunca foi auditada de forma independente, que a Google vê os metadados de todas as ligações porque lhe alugamos os servidores, e que uma chave substituída antes da tua primeira mensagem pareceria perfeitamente normal. É o mesmo texto na aplicação e neste site, em 53 idiomas — não um original inglês com uma tradução mais suave.`,
        ],
        note: `{policyShort} antes de decidires confiar em alguma das afirmações acima.`,
      },
    ],
  },

  features: {
    eyebrow: `Funcionalidades`,
    title: `O que faz de facto`,
    intro: `Tudo o que está aqui listado tem uma interface a que consegues chegar. Nada nesta página descreve uma capacidade que só exista no código.`,
    cards: [
      {
        title: `Mensagens`,
        body: `Texto, fotografias, vídeo, ficheiros e notas de voz. Respostas, reencaminhamento, reações, confirmações de leitura, mensagens afixadas, marcadores e mensagens agendadas.`,
      },
      {
        title: `Chamadas de voz e vídeo`,
        body: `As chamadas ligam-se diretamente entre os dois dispositivos via WebRTC quando possível, cifrando o áudio e o vídeo por predefinição em vez de como opção. Quando não conseguem — muitas vezes por estarem em redes diferentes — um relay cifrado transporta a chamada sem conseguir decifrá-la.`,
      },
      {
        title: `Respostas sugeridas`,
        body: `Algumas respostas propostas a partir das últimas mensagens da conversa. São comparadas no teu dispositivo com uma lista de frases no teu idioma: não é enviado nada para lado nenhum para as produzir.`,
      },
      {
        title: `Consulta na Wikipédia`,
        body: `Mantém premida uma mensagem, escolhe um nome nela e lê o artigo sem sair da conversa. Um pedido, com o teu toque, no teu idioma.`,
      },
      {
        title: `A tua chave, a tua frase de recuperação`,
        body: `A chave privada que decifra as tuas mensagens nunca sai do teu dispositivo. Podes anotá-la como frase de recuperação; nós não a temos e não a conseguimos recuperar por ti.`,
      },
      {
        title: `53 idiomas`,
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — incluindo escrita da direita para a esquerda.`,
      },
    ],
  },

  controls: {
    eyebrow: `Controlos de privacidade`,
    title: `O que podes trancar`,
    items: [
      {
        title: `Bloqueio da aplicação`,
        body: `Biometria ou PIN. Volta a bloquear sempre que sai da app.`,
      },
      {
        title: `Ver uma vez`,
        body: `Fotografias e vídeos que se fecham de vez depois de abertos.`,
      },
      {
        title: `Mensagens temporárias`,
        body: `Define uma conversa para se limpar sozinha, de uma hora até trinta dias.`,
      },
      {
        title: `Destruir após leitura`,
        body: `Uma mensagem que se destrói assim que a outra pessoa a lê.`,
      },
      {
        title: `Bloquear`,
        body: `Bloqueia quem quiseres. Sem diretório, não encontram o caminho de volta.`,
      },
      {
        title: `Exportar e apagar`,
        body: `Leva os teus dados, ou apaga a conta e tudo o que está por baixo dela.`,
      },
    ],
  },

  limits: {
    eyebrow: `Limites`,
    title: `O que não está protegido`,
    intro: `Uma página que só lista virtudes é uma página com que não consegues decidir nada. Esta é a versão curta; a {policy} é a longa.`,
    sealed: {
      title: `Selado no teu dispositivo`,
      items: [
        `O texto das tuas mensagens`,
        `Fotografias, vídeo, áudio e ficheiros que anexas`,
        `Pré-visualizações de links e localização em tempo real`,
        `Transcrições de voz, assim que voltam para ti`,
        `O áudio e o vídeo das chamadas, entre os dois dispositivos`,
      ],
    },
    visible: {
      title: `Visível para nós, a Google e a Cloudflare`,
      items: [
        `Que existe uma conversa, e que contas estão nela`,
        `Quando cada conta esteve ativa pela última vez`,
        `Os metadados de todas as ligações, incluindo o teu endereço IP`,
        `Que houve uma chamada, com quem e quando — não o seu áudio nem o vídeo`,
        `Os dois endereços IP, quando uma chamada precisa de ser retransmitida para ligar — nunca o seu áudio ou vídeo`,
        `O nome, o tipo e o tamanho de cada ficheiro que anexas`,
      ],
    },
    note: `A cifra nunca foi auditada de forma independente. Retirar esses metadados é mais difícil do que cifrar o conteúdo, e esse trabalho não está terminado.`,
  },

  download: {
    title: `Obter o Chatterbox`,
    intro: `A aplicação web corre no navegador sem instalar nada. No Android, a Google Play mantém-na atualizada; o APK deste site é a mesma compilação, para quem preferir não passar pela loja.`,
    introWebOnly: `A aplicação web corre no navegador sem instalar nada, tanto no telemóvel como no computador. A versão Android está a caminho da Google Play.`,
    web: `Abrir a aplicação web`,
    play: `Disponível na Google Play`,
    playPending: `Brevemente na Google Play`,
    apk: `Transferir o APK`,
    playNote: `No Android, a Google Play é o caminho recomendado: atualiza a aplicação em segundo plano e verifica a assinatura em cada instalação.`,
    androidPendingNote: `Ainda não há nenhum caminho no Android: a página na Play não está publicada e neste site não há transferência. Até haver, entra-se pela aplicação web.`,
    playPendingNote: `A página na Play ainda não está publicada. Até estar, o APK é o caminho no Android — da primeira vez o Android vai pedir autorização para instalar a partir desta origem, e ele não se atualiza sozinho.`,
    apkNote: `O APK está assinado com a mesma chave da versão da Play, por isso instala-se por cima e mantém os teus dados. Não se atualiza sozinho.`,
    iosNote: `O iOS ainda não foi publicado.`,
  },

  footer: {
    rights: `© 2026 Chatterbox. Um projeto pessoal, descrito com honestidade.`,
    privacy: `Política de Privacidade`,
  },
};
