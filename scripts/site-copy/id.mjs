/**
 * The landing page, in Indonesian. Every other file in this directory is the
 * same shape in another language, and build-site-html.mjs turns each into a
 * page. See en.mjs for what each field means.
 */
export default {
  meta: {
    title: 'Chatterbox — messenger yang tidak punya apa pun untuk mencari Anda',
    description:
      'Pesan terenkripsi ujung ke ujung tanpa direktori pengguna, tanpa alamat email sama sekali, dan kebijakan privasi yang mengatakan apa yang tidak bisa dilakukannya. Web dan Android.',
  },

  links: {policy: 'kebijakan privasi', policyShort: 'Baca kebijakannya'},

  nav: {
    different: 'Apa yang berbeda',
    features: 'Fitur',
    limits: 'Batasan',
    get: 'Dapatkan',
    language: 'Bahasa',
  },

  hero: {
    eyebrow: 'Web & Android · iOS sedang dikerjakan',
    title: 'Tidak ada apa pun untuk mencari Anda di sini.',
    lead: `Chatterbox adalah messenger terenkripsi ujung ke ujung tanpa direktori pengguna. Tidak ada yang bisa mencari Anda, karena tidak ada indeks untuk dicari — satu-satunya jalan masuk ke percakapan adalah tautan yang Anda berikan sendiri kepada seseorang.`,
    primary: 'Dapatkan Chatterbox',
    secondary: 'Baca kebijakan privasi',
    badges: ['Tanpa direktori pengguna', 'Hanya dengan undangan', '23 bahasa', 'Gratis'],
  },

  different: {
    eyebrow: 'Apa yang berbeda',
    title: 'Tujuh hal yang tidak dilakukan kebanyakan messenger',
    intro: `Masing-masing ini adalah keputusan dengan mekanisme di baliknya, bukan pengaturan yang harus Anda temukan. Jika ada yang merupakan kompromi, itu dinyatakan dengan jelas.`,
    reasons: [
      {
        title: 'Tidak ada direktori pengguna',
        body: [
          `Tidak ada pencarian nama pengguna, pencocokan nomor telepon, atau "orang yang mungkin Anda kenal". Satu-satunya jalan masuk ke percakapan adalah tautan undangan yang Anda kirim ke seseorang di luar aplikasi. Setiap tautan berfungsi sekali dan kedaluwarsa setelah 24 jam, dan sebuah tugas terjadwal menghapus yang sudah kedaluwarsa alih-alih meninggalkan catatan permanen siapa mengundang siapa.`,
        ],
        note: `Ini bukan pengaturan privasi. Tidak ada direktori untuk keluar darinya.`,
      },
      {
        title: 'Tidak ada alamat email untuk disimpan',
        body: [
          `Pendaftaran tidak menanyakan apa pun tentang Anda. Akun Anda adalah frasa pemulihan 24 kata yang dibuat di perangkat Anda, dan kredensial yang diperiksa server berasal dari kata-kata itu — yang disimpannya hanyalah label acak di bawah domain yang tidak bisa menerima surat. Dokumen profil Anda tidak memuat alamat email, nama tampilan, atau URL foto, jadi tidak ada juga profil untuk dibaca orang lain.`,
        ],
      },
      {
        title: 'Lebih dari sekadar pesan yang disegel',
        body: [
          `Teks pesan adalah bagian yang mudah. Pratinjau tautan dan lokasi langsung dienkripsi ke percakapan dengan cara yang sama — berbagi lokasi adalah aliran koordinat, dan itu disegel ke kunci perangkat lain seperti yang lainnya. Lampiran dienkripsi sebelum diunggah, jadi yang dipegang server adalah byte yang tidak bisa dibukanya.`,
        ],
      },
      {
        title: 'Setiap pesan punya kuncinya sendiri',
        body: [
          `Sebagian besar percakapan satu-satu dan grup menggunakan ratchet, sehingga kompromi pada satu perangkat tidak mengungkap pesan-pesan sebelumnya. Percakapan di mana klien seseorang belum menerbitkan materi kunci yang lebih baru kembali ke satu kunci berumur panjang, yang tidak memiliki sifat itu.`,
        ],
        note: `Label di bawah pesan memberi tahu Anda mana yang sebenarnya diterima. Ini bukan klaim tentang aplikasinya; ini klaim tentang pesan itu.`,
      },
      {
        title: `Tidak ada AI yang membaca percakapan Anda`,
        body: [
          `Tidak ada peringkas, tidak ada terjemahan, tidak ada transkripsi. Tidak ada yang di aplikasi ini mendekripsi percakapan dan mengirimkannya ke pihak ketiga untuk diproses, karena tidak ada fitur di sini yang melakukan itu. Saran balasan dihitung di perangkat Anda dari beberapa pesan terakhir, dan tidak pergi ke mana pun.`,
        ],
        note: `Fitur-fitur itu ada dalam kode dan dimatikan untuk rilis ini; mereka dimaksudkan untuk kembali. Bagian 6 kebijakan privasi masih menyebutkan tiga layanan yang akan mereka jangkau dan mengatakan bahwa tidak ada yang mencapainya hari ini. Ketika mereka kembali, mereka kembali dengan pengungkapan itu dan permintaan sebelum penggunaan pertama.`,
      },
      {
        title: 'Mencari sesuatu tidak terjadi di belakang Anda',
        body: [
          `Ketuk nama dalam pesan dan Chatterbox menunjukkan artikel Wikipedianya. Permintaan itu terjadi saat diketuk dan tidak dengan cara lain, dan tidak ada apa pun tentangnya yang ditulis ke dalam percakapan.`,
        ],
        note: `Versi sebelumnya memindai lima belas pesan terakhir dari setiap utas yang Anda buka dan meminta Wikipedia hingga tiga puluh kali per pembukaan — sambil tidak menampilkan apa pun, karena kartu-kartu itu berada di balik flag yang tidak pernah aktif. Ini dihapus, bukan diperbaiki.`,
      },
      {
        title: 'Kebijakan privasi mengatakan apa yang tidak bisa dilakukannya',
        body: [
          `Kebijakan itu menyatakan bahwa enkripsinya belum pernah diaudit secara independen, bahwa Google dapat melihat metadata setiap koneksi karena kami menyewa servernya, dan bahwa kunci yang diganti sebelum pesan pertama Anda akan tampak sepenuhnya normal. Ini adalah teks yang sama di aplikasi dan di situs ini, dalam 23 bahasa — bukan aslinya bahasa Inggris dengan terjemahan yang lebih lunak.`,
        ],
        note: `{policyShort} sebelum Anda memutuskan untuk memercayai salah satu hal di atas.`,
      },
    ],
  },

  features: {
    eyebrow: 'Fitur',
    title: 'Apa yang sebenarnya dilakukannya',
    intro: `Semua yang tercantum di sini memiliki antarmuka yang bisa Anda jangkau. Tidak ada di halaman ini yang menjelaskan kemampuan yang hanya ada dalam kode.`,
    cards: [
      {
        title: 'Perpesanan',
        body: `Teks, foto, video, file, dan catatan suara. Balasan, penerusan, reaksi, tanda terima baca, pesan yang disematkan, bookmark, dan pesan terjadwal.`,
      },
      {
        title: 'Panggilan suara & video',
        body: `Panggilan peer-to-peer melalui WebRTC, yang mengenkripsi media antara dua perangkat secara default, bukan sebagai opsi.`,
      },
      {
        title: `Saran balasan`,
        body: `Beberapa balasan yang disarankan diambil dari pesan terakhir dalam percakapan. Balasan itu dicocokkan di perangkat Anda dengan daftar frasa dalam bahasa Anda — tidak ada yang dikirim ke mana pun untuk menghasilkannya.`,
      },
      {
        title: 'Pencarian Wikipedia',
        body: `Tekan lama sebuah pesan, pilih nama di dalamnya, dan baca artikelnya tanpa meninggalkan obrolan. Satu permintaan, saat Anda mengetuk, dalam bahasa Anda sendiri.`,
      },
      {
        title: 'Kunci Anda, frasa pemulihan Anda',
        body: `Kunci privat yang mendekripsi pesan Anda tidak pernah meninggalkan perangkat Anda. Anda dapat menuliskannya sebagai frasa pemulihan; kami tidak menyimpannya dan tidak dapat memulihkannya untuk Anda.`,
      },
      {
        title: '23 bahasa',
        body: `Inggris, kedua aksara Tionghoa, Jepang, Korea, Spanyol, Prancis, Jerman, Italia, Portugis, Rusia, Turki, Vietnam, Arab, Hindi, Persia, Ibrani, Urdu, Polandia, Ukraina, Indonesia, Bengali, dan Thai — termasuk penulisan kanan ke kiri.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Kontrol privasi',
    title: 'Apa yang bisa Anda kunci',
    items: [
      {title: 'Kunci aplikasi', body: `Biometrik atau PIN, dengan penundaan kunci otomatis yang Anda pilih.`},
      {title: 'Lihat sekali', body: `Foto dan video yang tertutup untuk selamanya setelah dibuka.`},
      {
        title: 'Pesan yang menghilang',
        body: `Atur percakapan untuk membersihkan dirinya sendiri, dari satu jam hingga tiga puluh hari.`,
      },
      {
        title: 'Bakar setelah dibaca',
        body: `Pesan yang menghancurkan dirinya sendiri setelah dibaca orang lain.`,
      },
      {
        title: 'Pemblokiran',
        body: `Blokir siapa saja. Tanpa direktori, mereka tidak dapat menemukan jalan kembali.`,
      },
      {
        title: 'Ekspor & hapus',
        body: `Keluarkan data Anda, atau hapus akun dan semua yang ada di bawahnya.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Batasan',
    title: 'Apa yang tidak dilindungi',
    intro: `Halaman yang hanya mencantumkan kekuatan adalah halaman yang tidak bisa Anda gunakan untuk mengambil keputusan. Ini versi singkatnya; {policy} adalah versi panjangnya.`,
    sealed: {
      title: 'Disegel di perangkat Anda',
      items: [
        'Teks pesan Anda',
        'Foto, video, audio, dan file yang Anda lampirkan',
        'Pratinjau tautan dan lokasi langsung',
        'Transkrip suara, setelah kembali kepada Anda',
        'Audio dan video panggilan, antara dua perangkat',
      ],
    },
    visible: {
      title: 'Terlihat oleh kami dan oleh Google',
      items: [
        'Bahwa sebuah percakapan ada, dan akun mana saja yang terlibat',
        'Kapan setiap akun terakhir aktif',
        'Metadata setiap koneksi, termasuk alamat IP Anda',
        'Bahwa panggilan dilakukan, kepada siapa dan kapan — bukan audio atau videonya',
        'Nama file, jenis, dan ukuran setiap lampiran yang Anda kirim',
      ],
    },
    note: `Enkripsinya belum pernah diaudit secara independen. Menghapus metadata itu lebih sulit daripada mengenkripsi isinya, dan pekerjaan itu belum selesai.`,
  },

  download: {
    title: 'Dapatkan Chatterbox',
    intro: `Aplikasi web berjalan di peramban tanpa perlu instalasi. Di Android, Google Play menjaganya tetap terbarui; APK di situs ini adalah build yang sama bagi mereka yang lebih suka tidak menggunakan toko aplikasi.`,
    introWebOnly: `Aplikasi web berjalan di peramban tanpa perlu instalasi, di ponsel maupun desktop. Build Android sedang dalam perjalanan ke Google Play.`,
    web: 'Buka aplikasi web',
    play: 'Dapatkan di Google Play',
    playPending: 'Segera hadir di Google Play',
    apk: 'Unduh APK',
    playNote: `Google Play adalah jalur yang direkomendasikan di Android: memperbarui aplikasi di latar belakang dan memverifikasi tanda tangan pada setiap pemasangan.`,
    androidPendingNote: `Belum ada jalur Android yang aktif: listingan Play belum diterbitkan, dan tidak ada unduhan di situs ini. Aplikasi web adalah cara masuk sampai salah satunya siap.`,
    playPendingNote: `Listingan Play belum aktif. Sampai saat itu, APK adalah jalur Android — Android akan meminta Anda mengizinkan pemasangan dari sumber ini untuk pertama kalinya, dan tidak memperbarui dirinya sendiri.`,
    apkNote: `APK ditandatangani dengan kunci yang sama seperti build Play, jadi ia terpasang di atasnya dan menyimpan data Anda. Ia tidak memperbarui dirinya sendiri.`,
    iosNote: `iOS belum dirilis.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Proyek pribadi, dijelaskan dengan jujur.',
    privacy: 'Kebijakan Privasi',
  },
};
