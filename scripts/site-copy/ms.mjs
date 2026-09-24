/**
 * Halaman pendaratan, dalam bahasa Melayu. Lihat en.mjs untuk bentuk yang
 * dikongsi setiap fail dalam direktori ini; `{policy}` menjadi pautan ke dasar
 * privasi bahasa ini, dengan `links.policy` sebagai teks pautan.
 */
export default {
  meta: {
    title: 'Chatterbox — Pemesej tanpa apa-apa untuk mencari anda',
    description:
      'Pemesejan disulitkan hujung ke hujung tanpa direktori pengguna, tanpa alamat e-mel sama sekali, dan dengan dasar privasi yang menyatakan apa yang tidak boleh dilakukannya. Web dan Android.',
  },

  links: {policy: 'dasar privasi', policyShort: 'Baca ia'},

  nav: {
    different: 'Apa yang berbeza',
    features: 'Ciri',
    limits: 'Had',
    get: 'Dapatkan',
    language: 'Bahasa',
  },

  hero: {
    eyebrow: 'Web & Android · iOS dalam pembinaan',
    title: 'Tiada apa untuk mencari anda.',
    lead: `Chatterbox ialah pemesej disulitkan hujung ke hujung tanpa direktori pengguna. Tiada siapa boleh mencari anda, kerana tiada indeks untuk dicari — satu-satunya jalan masuk ke perbualan ialah pautan yang anda sendiri berikan kepada seseorang.`,
    primary: 'Dapatkan Chatterbox',
    secondary: 'Baca dasar privasi',
    badges: ['Tiada direktori pengguna', 'Hanya dengan jemputan', '53 bahasa', 'Percuma'],
  },

  different: {
    eyebrow: 'Apa yang berbeza',
    title: 'Tujuh perkara yang tidak dilakukan oleh kebanyakan pemesej',
    intro: `Setiap satu daripadanya ialah keputusan dengan mekanisme di belakangnya, bukan tetapan yang perlu anda cari. Di mana sesuatu itu satu pertukaran, ia dinyatakan.`,
    reasons: [
      {
        title: 'Tiada direktori pengguna',
        body: [
          `Tiada carian nama pengguna, tiada pemadanan nombor telefon, tiada “orang yang mungkin anda kenali”. Satu-satunya laluan ke perbualan ialah pautan jemputan yang anda hantar kepada seseorang di luar talian. Setiap pautan berfungsi sekali dan tamat tempoh selepas 24 jam, dan tugas berjadual memadamkan yang telah tamat tempoh, bukannya meninggalkan rekod kekal tentang siapa menjemput siapa.`,
        ],
        note: `Ini bukan tetapan privasi. Tiada direktori untuk anda menarik diri daripadanya.`,
      },
      {
        title: 'Tiada alamat e-mel untuk disimpan',
        body: [
          `Pendaftaran tidak bertanya apa-apa tentang anda. Akaun anda ialah frasa pemulihan 24 perkataan yang dihasilkan pada peranti anda, dan bukti kelayakan yang diperiksa pelayan diperoleh daripada perkataan itu — apa yang disimpannya ialah label rawak di bawah domain yang tidak boleh menerima mel. Dokumen profil anda tidak menyimpan alamat e-mel, nama paparan atau URL foto, jadi tiada juga profil untuk orang lain membacanya.`,
        ],
      },
      {
        title: 'Lebih daripada mesej dimeterai',
        body: [
          `Teks mesej ialah bahagian yang mudah. Pratonton pautan dan lokasi langsung disulitkan kepada perbualan dengan cara yang sama — perkongsian lokasi ialah aliran koordinat, dan ia dimeterai kepada kunci peranti yang lain seperti semua yang lain. Lampiran disulitkan sebelum dimuat naik, jadi apa yang dipegang pelayan ialah bait yang tidak boleh dibukanya.`,
        ],
      },
      {
        title: 'Setiap mesej mempunyai kuncinya sendiri',
        body: [
          `Kebanyakan perbualan satu-lawan-satu dan kumpulan menggunakan ratchet, jadi kompromi sebuah peranti tidak mendedahkan mesej yang datang sebelumnya. Perbualan di mana klien seseorang belum menerbitkan bahan kunci yang lebih baharu kembali menggunakan satu kunci berjangka hayat panjang, yang tidak mempunyai ciri itu.`,
        ],
        note: `Label di bawah mesej memberitahu anda yang mana sebenarnya diterima. Ia bukan dakwaan tentang apl; ia dakwaan tentang mesej itu.`,
      },
      {
        title: `Tiada AI membaca perbualan anda`,
        body: [
          `Tiada peringkas, tiada terjemahan, tiada transkripsi. Tiada apa dalam apl ini menyahsulit perbualan dan menghantarnya kepada pihak ketiga untuk diproses, kerana tiada ciri di sini melakukannya. Cadangan balasan dikira pada peranti anda daripada beberapa mesej terakhir, dan tidak pergi ke mana-mana.`,
        ],
        note: `Ciri-ciri itu ada dalam kod dan dimatikan untuk keluaran ini; ia dimaksudkan untuk kembali. Bahagian 6 dasar privasi masih menamakan tiga perkhidmatan yang akan dicapainya dan menyatakan bahawa tiada apa mencapainya hari ini. Apabila ia kembali, ia kembali dengan pendedahan itu dan gesaan sebelum penggunaan pertama.`,
      },
      {
        title: 'Mencari sesuatu tidak berlaku di belakang anda',
        body: [
          `Ketik nama dalam mesej dan Chatterbox menunjukkan anda artikel Wikipedianya. Permintaan itu berlaku pada ketikan dan tidak sebaliknya, dan tiada apa mengenainya ditulis ke dalam perbualan.`,
        ],
        note: `Versi terdahulu memindai lima belas mesej terakhir setiap bicara yang anda buka dan bertanya kepada Wikipedia sampai tiga puluh kali setiap kali dibuka — sambil tidak memaparkan apa-apa, kerana kad-kad itu berada di belakang bendera yang tidak pernah dihidupkan. Ia dibuang dan bukan dibetulkan.`,
      },
      {
        title: 'Dasar privasi menyatakan apa yang tidak boleh dilakukannya',
        body: [
          `Ia menyatakan bahawa penyulitan tidak pernah diaudit secara bebas, bahawa Google boleh melihat metadata setiap sambungan kerana kami menyewa pelayannya, dan bahawa kunci yang digantikan sebelum mesej pertama anda akan kelihatan sepenuhnya normal. Ia teks yang sama dalam apl dan di laman ini, dalam 53 bahasa — bukan asal bahasa Inggeris dengan terjemahan yang lebih lembut.`,
        ],
        note: `{policyShort} sebelum anda memutuskan untuk mempercayai apa-apa di atas.`,
      },
    ],
  },

  features: {
    eyebrow: 'Ciri',
    title: 'Apa yang sebenarnya dilakukannya',
    intro: `Semua yang disenaraikan di sini mempunyai antara muka yang boleh anda capai. Tiada apa di halaman ini menerangkan keupayaan yang hanya wujud dalam kod.`,
    cards: [
      {
        title: 'Pemesejan',
        body: `Teks, foto, video, fail dan nota suara. Balasan, pemajuan, reaksi, resit bacaan, mesej yang disemat, penanda buku dan mesej berjadual.`,
      },
      {
        title: 'Panggilan suara & video',
        body: `Panggilan bersambung terus antara kedua-dua peranti melalui WebRTC apabila boleh, menyulitkan audio dan video secara lalai dan bukan sebagai pilihan. Apabila tidak boleh — selalunya kerana rangkaian berbeza — geganti yang disulitkan membawa panggilan tanpa dapat menyahsulitkannya.`,
      },
      {
        title: `Cadangan balasan`,
        body: `Beberapa balasan yang dicadangkan daripada mesej terakhir dalam perbualan. Ia dipadankan pada peranti anda dengan senarai frasa dalam bahasa anda — tiada apa dihantar ke mana-mana untuk menghasilkannya.`,
      },
      {
        title: 'Carian Wikipedia',
        body: `Tekan lama sebuah mesej, pilih nama di dalamnya, dan baca artikel tanpa meninggalkan sembang. Satu permintaan, pada ketikan anda, dalam bahasa anda sendiri.`,
      },
      {
        title: 'Kunci anda, frasa pemulihan anda',
        body: `Kunci peribadi yang menyahsulit mesej anda ialah frasa pemulihan anda sendiri, dan kami tidak pernah menerimanya. Selain frasa yang anda tulis, aplikasi menyimpan salinannya dalam sandaran telefon anda sendiri — Google Block Store atau iCloud Keychain — supaya telefon baharu boleh memulihkannya. Ia hanya sampai ke awan dalam keadaan disulitkan hujung ke hujung; butirannya ada dalam dasar privasi. Kami tidak boleh memulihkannya untuk anda.`,
      },
      {
        title: '53 bahasa',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — termasuk tulisan kanan ke kiri.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Kawalan privasi',
    title: 'Apa yang boleh anda kunci',
    items: [
      {title: 'Kunci apl', body: `Biometrik atau PIN. Ia berkunci semula setiap kali anda meninggalkan apl.`},
      {title: 'Lihat sekali', body: `Foto dan video yang tertutup selamanya selepas dibuka.`},
      {
        title: 'Mesej hilang',
        body: `Tetapkan perbualan untuk membersihkan dirinya, dari sejam sampai tiga puluh hari.`,
      },
      {
        title: 'Musnah selepas dibaca',
        body: `Mesej yang memusnahkan dirinya setelah orang lain membacanya.`,
      },
      {
        title: 'Menyekat',
        body: `Sekat sesiapa. Tanpa direktori, mereka tidak boleh mencari jalan balik.`,
      },
      {
        title: 'Eksport & padam',
        body: `Keluarkan data anda, atau padamkan akaun dan segala di bawahnya.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Had',
    title: 'Apa yang tidak dilindungi',
    intro: `Halaman yang hanya menyenaraikan kekuatan ialah halaman yang tidak boleh anda gunakan untuk membuat keputusan. Ini versi ringkas; {policy} ialah yang panjang.`,
    sealed: {
      title: 'Dimeterai pada peranti anda',
      items: [
        'Teks mesej anda',
        'Foto, video, audio dan fail yang anda lampirkan',
        'Pratonton pautan dan lokasi langsung',
        'Transkrip suara, sebaik ia kembali kepada anda',
        'Audio dan video panggilan, antara dua peranti',
      ],
    },
    visible: {
      title: `Boleh dilihat oleh kami, Google dan Cloudflare`,
      items: [
        'Bahawa perbualan itu wujud, dan akaun mana yang terlibat',
        'Bila setiap akaun terakhir aktif',
        'Metadata setiap sambungan, termasuk alamat IP anda',
        'Bahawa panggilan telah dibuat, kepada siapa dan bila — bukan audio atau videonya',
        `Kedua-dua alamat IP, apabila panggilan perlu digeganti untuk menyambung — bukan audio atau videonya`,
        'Nama fail, jenis dan saiz setiap lampiran yang anda hantar',
      ],
    },
    note: `Penyulitan tidak pernah diaudit secara bebas. Membuang metadata itu lebih sukar daripada menyulitkan kandungan, dan kerja itu belum selesai.`,
  },

  download: {
    title: 'Dapatkan Chatterbox',
    intro: `Apl web berjalan dalam pelayar tanpa apa-apa untuk dipasang. Pada Android, Google Play memastikan ia dikemas kini; APK di laman ini ialah build yang sama untuk sesiapa yang lebih suka tidak menggunakan gedung.`,
    introWebOnly: `Apl web berjalan dalam pelayar tanpa apa-apa untuk dipasang, pada telefon mahupun komputer. Build Android sedang menuju ke Google Play.`,
    web: 'Buka apl web',
    play: 'Dapatkan di Google Play',
    playPending: 'Akan datang di Google Play',
    apk: 'Muat turun APK',
    playNote: `Google Play ialah laluan yang disyorkan pada Android: ia mengemas kini apl di latar belakang dan mengesahkan tandatangan pada setiap pemasangan.`,
    androidPendingNote: `Kedua-dua laluan Android belum aktif: penyenaraian Play belum diterbitkan, dan tiada muat turun di laman ini. Apl web ialah jalan masuk sehingga salah satu daripadanya aktif.`,
    playPendingNote: `Penyenaraian Play belum aktif. Sementara itu, APK ialah laluan Android — Android akan meminta anda membenarkan pemasangan daripada sumber ini kali pertama, dan ia tidak mengemas kini dirinya.`,
    apkNote: `APK ditandatangani dengan kunci yang sama seperti build Play, jadi ia dipasang di atasnya dan menyimpan data anda. Ia tidak mengemas kini dirinya.`,
    iosNote: `iOS belum dikeluarkan.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Projek peribadi, diterangkan dengan jujur.',
    privacy: 'Dasar Privasi',
  },
};
