/** Texto de la portada (español). Estructura: ver en.mjs. */
export default {
  meta: {
    title: 'Chatterbox — Un mensajero sin ningún sitio donde buscarte',
    description:
      'Mensajería cifrada de extremo a extremo, sin directorio de usuarios, sin guardar tu dirección de correo y con una política de privacidad que dice lo que no puede hacer. Web y Android.',
  },

  links: {policy: 'política de privacidad', policyShort: 'Léela'},

  nav: {
    different: 'Qué cambia',
    features: 'Funciones',
    limits: 'Límites',
    get: 'Obtenerlo',
    language: 'Idioma',
  },

  hero: {
    eyebrow: 'Web y Android · iOS en curso',
    title: 'No hay dónde buscarte.',
    lead: `Chatterbox es un mensajero cifrado de extremo a extremo sin directorio de usuarios. Nadie puede buscarte, porque no existe ningún índice donde buscar: la única forma de entrar en una conversación es un enlace que tú mismo le entregas a alguien.`,
    primary: 'Obtener Chatterbox',
    secondary: 'Leer la política de privacidad',
    badges: ['Sin directorio', 'Solo por invitación', '15 idiomas', 'Gratis'],
  },

  different: {
    eyebrow: 'Qué cambia',
    title: 'Siete cosas que la mayoría de los mensajeros no hace',
    intro: `Cada una es una decisión con un mecanismo detrás, no un ajuste que tengas que encontrar. Donde algo tiene un coste, aquí se dice.`,
    reasons: [
      {
        title: 'No existe un directorio de usuarios',
        body: [
          `Sin búsqueda por nombre de usuario, sin cruce de números de teléfono, sin «personas que quizá conozcas». La única vía hacia una conversación es un enlace de invitación que envías por otro canal. Cada enlace sirve una vez y caduca a las 24 horas, y una tarea programada borra los caducados en lugar de dejar un registro permanente de quién invitó a quién.`,
        ],
        note: `Esto no es un ajuste de privacidad. No hay ningún directorio del que salirse.`,
      },
      {
        title: 'El servidor no guarda tu dirección de correo',
        body: [
          `Inicias sesión con una, y ahí se acaba. Tu documento de perfil no contiene dirección de correo, ni nombre visible, ni URL de foto. No hay perfil que nadie pueda leer, porque las únicas personas que pueden llegar a ti son las que invitaste.`,
        ],
      },
      {
        title: 'Se sella más que los mensajes',
        body: [
          `El texto de los mensajes es la parte fácil. Las vistas previas de enlaces, las listas compartidas, las citas guardadas y las transcripciones de voz se cifran igual, contra la conversación. Antes, una función del servidor devolvía la transcripción al mensaje en texto claro; ahora se sella en tu dispositivo, y las traducciones no se guardan en absoluto.`,
        ],
      },
      {
        title: 'Cada mensaje tiene su propia clave',
        body: [
          `La mayoría de las conversaciones individuales y de grupo usan un trinquete, así que comprometer un dispositivo no expone los mensajes anteriores. Las conversaciones en las que el cliente de alguien no ha publicado el material de clave más reciente recaen en una única clave de larga duración, que no tiene esa propiedad.`,
        ],
        note: `La etiqueta bajo cada mensaje te dice cuál le tocó realmente. No es una afirmación sobre la aplicación; es una afirmación sobre ese mensaje.`,
      },
      {
        title: 'La IA está apagada hasta que la enciendes, y cada proveedor tiene nombre',
        body: [
          `Los resúmenes, la traducción y la transcripción descifran contenido en tu dispositivo y lo envían fuera. La sección 6 de la política de privacidad nombra cada servicio que lo recibe —Google Cloud Speech-to-Text, Google Cloud Translation, Cloudflare Workers AI— y dice exactamente qué le llega. La aplicación pregunta antes de la primera vez, y el interruptor está en tu perfil.`,
        ],
      },
      {
        title: 'Consultar algo no ocurre a tus espaldas',
        body: [
          `Toca un nombre dentro de un mensaje y Chatterbox te muestra su artículo de Wikipedia. Esa petición ocurre con el toque y no en otro momento, y nada de ella se escribe en la conversación.`,
        ],
        note: `Una versión anterior escaneaba los últimos quince mensajes de cada hilo que abrías y consultaba Wikipedia hasta treinta veces por apertura, sin mostrar nada, porque las tarjetas estaban detrás de un interruptor que nunca estuvo activado. Se eliminó en lugar de arreglarse.`,
      },
      {
        title: 'La política de privacidad dice lo que no puede hacer',
        body: [
          `Declara que el cifrado nunca ha sido auditado de forma independiente, que Google puede ver los metadatos de cada conexión porque le alquilamos sus servidores, y que los informes de fallos llevan un identificador de cuenta y no son anónimos. Es el mismo texto en la aplicación y en este sitio, en quince idiomas: no un original en inglés con una traducción más suave.`,
        ],
        note: `{policyShort} antes de decidir si te fías de algo de lo anterior.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funciones',
    title: 'Lo que hace de verdad',
    intro: `Todo lo que aparece aquí tiene una interfaz a la que puedes llegar. Nada en esta página describe una capacidad que solo exista en el código.`,
    cards: [
      {
        title: 'Mensajería',
        body: `Texto, fotos, vídeo, archivos y notas de voz. Respuestas, reenvíos, reacciones, confirmaciones de lectura, mensajes fijados, marcadores y mensajes programados.`,
      },
      {
        title: 'Llamadas de voz y vídeo',
        body: `Llamadas entre pares sobre WebRTC, que cifra el medio entre los dos dispositivos por defecto y no como opción.`,
      },
      {
        title: 'IA opcional',
        body: `Resúmenes de conversación, respuestas sugeridas, transcripción de voz y traducción de mensajes. Apagado por defecto; los proveedores están nombrados en la política.`,
      },
      {
        title: 'Consulta en Wikipedia',
        body: `Mantén pulsado un mensaje, elige un nombre y lee el artículo sin salir del chat. Una petición, con tu toque, en tu idioma.`,
      },
      {
        title: 'Listas compartidas y muro de citas',
        body: `Una lista que los dos podéis ir marcando, y un sitio donde guardar las frases que merecen quedarse. Ambas selladas contra la conversación, igual que los mensajes.`,
      },
      {
        title: 'Quince idiomas',
        body: `Inglés, chino en sus dos escrituras, japonés, coreano, español, francés, alemán, italiano, portugués, ruso, turco, vietnamita, árabe e hindi, con escritura de derecha a izquierda incluida.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Controles de privacidad',
    title: 'Lo que puedes cerrar bajo llave',
    items: [
      {title: 'Bloqueo de la app', body: `Biometría o PIN, con el retardo de bloqueo que elijas.`},
      {title: 'Ver una vez', body: `Fotos y vídeos que se cierran para siempre al abrirse.`},
      {
        title: 'Mensajes temporales',
        body: `Haz que una conversación se borre sola, de una hora a treinta días.`,
      },
      {
        title: 'Destruir tras leer',
        body: `Un mensaje que se destruye en cuanto la otra persona lo ha leído.`,
      },
      {
        title: 'Bloquear',
        body: `Bloquea a quien quieras. Sin directorio, no encuentran el camino de vuelta.`,
      },
      {
        title: 'Exportar y borrar',
        body: `Llévate tus datos, o borra la cuenta y todo lo que cuelga de ella.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Límites',
    title: 'Lo que no está protegido',
    intro: `Una página que solo enumera virtudes no sirve para decidir. Esta es la versión corta; la {policy} es la larga.`,
    sealed: {
      title: 'Sellado en tu dispositivo',
      items: [
        'El texto de tus mensajes',
        'Fotos, vídeo, audio y archivos que adjuntas',
        'Vistas previas de enlaces, listas compartidas, citas guardadas',
        'Transcripciones de voz, una vez que vuelven a ti',
        'El audio y el vídeo de las llamadas, entre los dos dispositivos',
      ],
    },
    visible: {
      title: 'Visible para nosotros y para Google',
      items: [
        'Que existe una conversación, y qué cuentas están en ella',
        'Cuándo estuvo activa cada cuenta por última vez',
        'Los metadatos de cada conexión, incluida tu dirección IP',
        'Los informes de fallos y de uso, que llevan un identificador de cuenta',
        'Lo que elijas enviar a una función de IA, mientras se ejecuta',
      ],
    },
    note: `El cifrado nunca ha sido auditado de forma independiente. Quitar esos metadatos es más difícil que cifrar el contenido, y ese trabajo no está terminado.`,
  },

  download: {
    title: 'Obtener Chatterbox',
    intro: `La aplicación web funciona en el navegador sin instalar nada. En Android, Google Play la mantiene actualizada; el APK de este sitio es la misma compilación, para quien prefiera no pasar por la tienda.`,
    introWebOnly: `La aplicación web funciona en el navegador sin instalar nada, lo mismo en el móvil que en el escritorio. La versión de Android va camino de Google Play.`,
    web: 'Abrir la aplicación web',
    play: 'Disponible en Google Play',
    playPending: 'Próximamente en Google Play',
    apk: 'Descargar el APK',
    playNote: `En Android, Google Play es la vía recomendada: actualiza la aplicación en segundo plano y verifica la firma en cada instalación.`,
    androidPendingNote: `Todavía no hay ninguna vía en Android: la ficha de Play no está publicada y en este sitio no hay descarga. Hasta que haya una, la entrada es la aplicación web.`,
    playPendingNote: `La ficha de Play todavía no está publicada. Hasta que lo esté, el APK es la vía en Android: Android te pedirá permiso para instalar desde este origen la primera vez, y no se actualiza solo.`,
    apkNote: `El APK está firmado con la misma clave que la versión de Play, así que se instala encima y conserva tus datos. No se actualiza solo.`,
    iosNote: `iOS todavía no está publicado.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Un proyecto personal, descrito con honestidad.',
    privacy: 'Política de privacidad',
  },
};
