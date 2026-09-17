/** Açılış sayfası metni (Türkçe). Yapı için bkz. en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Sizi arayabilecekleri bir dizini olmayan mesajlaşma`,
    description: `Uçtan uca şifreli mesajlaşma: kullanıcı dizini yok, hiç e-posta adresi yok ve gizlilik politikası neyi yapamadığını da yazıyor. Web ve Android.`,
  },

  links: {policy: `gizlilik politikası`, policyShort: `Önce onu okuyun`},

  nav: {
    different: `Farkı ne`,
    features: `Özellikler`,
    limits: `Sınırlar`,
    get: `Edinin`,
    language: `Dil`,
  },

  hero: {
    eyebrow: `Web ve Android · iOS yolda`,
    title: `Sizi arayabilecekleri bir yer yok.`,
    lead: `Chatterbox, kullanıcı dizini olmayan uçtan uca şifreli bir mesajlaşma uygulamasıdır. Kimse sizi arayıp bulamaz, çünkü aranacak bir dizin yok — bir sohbete girmenin tek yolu, birine kendi elinizle verdiğiniz bir bağlantıdır.`,
    primary: `Chatterbox'ı edinin`,
    secondary: `Gizlilik politikasını okuyun`,
    badges: [`Dizin yok`, `Yalnızca davetle`, `23 dil`, `Ücretsiz`],
  },

  different: {
    eyebrow: `Farkı ne`,
    title: `Çoğu mesajlaşma uygulamasının yapmadığı yedi şey`,
    intro: `Bunların her birinin arkasında bir mekanizma var; bulmanız gereken bir ayar değil. Bir şeyin bedeli varsa, o da yazıyor.`,
    reasons: [
      {
        title: `Kullanıcı dizini diye bir şey yok`,
        body: [
          `Kullanıcı adı araması yok, telefon numarası eşleştirmesi yok, "tanıyor olabileceğiniz kişiler" yok. Bir sohbete giden tek yol, başka bir kanaldan gönderdiğiniz davet bağlantısıdır. Her bağlantı bir kez çalışır ve 24 saat sonra geçersiz olur; zamanlanmış bir görev süresi dolanları siler, kimin kimi davet ettiğine dair kalıcı bir kayıt bırakmak yerine.`,
        ],
        note: `Bu bir gizlilik ayarı değil. Çıkabileceğiniz bir dizin yok.`,
      },
      {
        title: `Saklanacak bir e-posta adresi yok`,
        body: [
          `Kayıt sırasında size dair hiçbir şey sorulmaz. Hesabınız, cihazınızda üretilen 24 kelimelik bir kurtarma ifadesidir ve sunucunun doğruladığı kimlik bilgisi bu kelimelerden türetilir: saklanan şey, posta alamayan bir alan adı altındaki rastgele bir etikettir. Profil belgenizde de e-posta adresi, görünen ad ya da fotoğraf bağlantısı bulunmaz; yani başkasının okuyabileceği bir profil de yoktur.`,
        ],
      },
      {
        title: `Mühürlenen yalnızca mesajlar değil`,
        body: [
          `Mesaj metni işin kolay kısmı. Bağlantı önizlemeleri ve canlı konum da aynı şekilde o konuşmaya şifrelenir: konum paylaşmak bir koordinat akışıdır ve her şey gibi karşı cihazın anahtarına mühürlenir. Ekler yüklenmeden önce şifrelenir, dolayısıyla sunucunun elinde açamadığı baytlar durur.`,
        ],
      },
      {
        title: `Her mesajın kendi anahtarı var`,
        body: [
          `Birebir ve grup sohbetlerinin çoğu bir cırcır mekanizması kullanır; böylece bir cihazın ele geçirilmesi ondan önceki mesajları açığa çıkarmaz. Karşı tarafın istemcisinin daha yeni anahtar malzemesini yayımlamadığı sohbetler, bu özelliği taşımayan tek ve uzun ömürlü bir anahtara geri düşer.`,
        ],
        note: `Mesajın altındaki etiket, o mesajın gerçekte hangisini aldığını söyler. Uygulama hakkında bir iddia değil; o mesaj hakkında bir bilgidir.`,
      },
      {
        title: `Konuşmalarını hiçbir yapay zekâ okumuyor`,
        body: [
          `Özet yok, çeviri yok, yazıya dökme yok. Bu uygulamada hiçbir şey bir konuşmayı çözüp işlenmek üzere üçüncü bir tarafa göndermiyor, çünkü bunu yapan bir özellik burada yok. Yanıt önerileri son birkaç mesajdan senin cihazında hesaplanır ve hiçbir yere gitmez.`,
        ],
        note: `Bu özellikler kodda duruyor ve bu sürümde kapalı; geri gelmeleri planlanıyor. Gizlilik politikasının 6. bölümü ulaşacakları üç hizmeti hâlâ adıyla sayıyor ve bugün onlara hiçbir şeyin ulaşmadığını yazıyor. Geri geldiklerinde, o açıklamayla ve ilk kullanımdan önce sorulan soruyla birlikte gelecekler.`,
      },
      {
        title: `Bir şeye bakmak arkanızdan olmuyor`,
        body: [
          `Bir mesajdaki isme dokunun, Chatterbox size onun Vikipedi maddesini göstersin. O istek yalnızca dokunduğunuz anda yapılır, başka zaman değil; ve bununla ilgili hiçbir şey sohbete yazılmaz.`,
        ],
        note: `Daha eski bir sürüm, açtığınız her sohbetin son on beş mesajını tarıyor ve her açılışta Vikipedi'ye otuza kadar sorgu gönderiyordu — üstelik hiçbir şey göstermeden, çünkü kartlar hiç açılmamış bir bayrağın arkasındaydı. Düzeltilmedi, kaldırıldı.`,
      },
      {
        title: `Gizlilik politikası neyi yapamadığını da yazıyor`,
        body: [
          `Şifrelemenin hiçbir zaman bağımsız denetimden geçmediğini, sunucularını kiraladığımız için Google'ın her bağlantının üst verisini görebildiğini ve ilk mesajından önce değiştirilmiş bir anahtarın son derece normal görüneceğini yazar. Uygulamadaki ve bu sitedeki metin aynıdır, 23 dilde — İngilizce bir asıl ve daha yumuşak bir çeviri değil.`,
        ],
        note: `Yukarıdakilerin herhangi birine güvenmeye karar vermeden önce: {policyShort}.`,
      },
    ],
  },

  features: {
    eyebrow: `Özellikler`,
    title: `Gerçekte ne yapıyor`,
    intro: `Burada sayılan her şeyin ulaşabileceğiniz bir arayüzü var. Bu sayfada yalnızca kodda var olan hiçbir yetenek anlatılmıyor.`,
    cards: [
      {
        title: `Mesajlaşma`,
        body: `Metin, fotoğraf, video, dosya ve sesli not. Yanıt, iletme, tepkiler, okundu bilgisi, sabitlenen mesajlar, yer imleri ve zamanlanmış mesajlar.`,
      },
      {
        title: `Sesli ve görüntülü arama`,
        body: `WebRTC üzerinden uçtan uca bağlantıyla arama; iki cihaz arasındaki akışı seçenek olarak değil, varsayılan olarak şifreler.`,
      },
      {
        title: `Yanıt önerileri`,
        body: `Konuşmanın son mesajlarından çıkarılan birkaç yanıt önerisi. Eşleştirme senin cihazında, kendi dilindeki bir kalıp listesine karşı yapılır — bunları üretmek için hiçbir yere bir şey gönderilmez.`,
      },
      {
        title: `Vikipedi'de arama`,
        body: `Bir mesaja uzun basın, içindeki bir ismi seçin ve sohbetten çıkmadan maddeyi okuyun. Tek istek, sizin dokunuşunuzla, kendi dilinizde.`,
      },
      {
        title: `Anahtarın senin, kurtarma ifaden senin`,
        body: `Mesajlarını çözen özel anahtar cihazından hiç çıkmaz. Onu bir kurtarma ifadesi olarak yazabilirsin; bizde durmaz ve senin için geri getiremeyiz.`,
      },
      {
        title: `23 dil`,
        body: `İngilizce, Çincenin iki yazısı, Japonca, Korece, İspanyolca, Fransızca, Almanca, İtalyanca, Portekizce, Rusça, Türkçe, Vietnamca, Arapça, Hintçe, Farsça, İbranice, Urduca, Lehçe, Ukraynaca, Endonezce, Bengalce ve Tayca — sağdan sola yazım dahil.`,
      },
    ],
  },

  controls: {
    eyebrow: `Gizlilik denetimleri`,
    title: `Kilitleyebilecekleriniz`,
    items: [
      {
        title: `Uygulama kilidi`,
        body: `Biyometri veya PIN; otomatik kilitlenme gecikmesini siz seçersiniz.`,
      },
      {
        title: `Tek görüntüleme`,
        body: `Açıldıktan sonra bir daha açılmamak üzere kapanan fotoğraf ve videolar.`,
      },
      {
        title: `Kaybolan mesajlar`,
        body: `Bir sohbeti kendi kendini temizleyecek şekilde ayarlayın: bir saatten otuz güne kadar.`,
      },
      {
        title: `Okununca yok olsun`,
        body: `Karşı taraf okur okumaz kendini imha eden mesaj.`,
      },
      {
        title: `Engelleme`,
        body: `İstediğinizi engelleyin. Dizin olmadığı için geri dönüş yolunu bulamazlar.`,
      },
      {
        title: `Dışa aktarma ve silme`,
        body: `Verilerinizi alıp gidin ya da hesabı ve altındaki her şeyi silin.`,
      },
    ],
  },

  limits: {
    eyebrow: `Sınırlar`,
    title: `Neler korunmuyor`,
    intro: `Yalnızca güçlü yanları sıralayan bir sayfa, karar vermek için kullanılamayan bir sayfadır. Bu kısa hâli; uzun hâli {policy}.`,
    sealed: {
      title: `Cihazınızda mühürlü`,
      items: [
        `Mesajlarınızın metni`,
        `Eklediğiniz fotoğraf, video, ses ve dosyalar`,
        `Bağlantı önizlemeleri ve canlı konum`,
        `Ses dökümleri, size geri döndükten sonra`,
        `Aramaların sesi ve görüntüsü, iki cihaz arasında`,
      ],
    },
    visible: {
      title: `Bize ve Google'a görünen`,
      items: [
        `Bir sohbetin var olduğu ve içinde hangi hesapların bulunduğu`,
        `Her hesabın en son ne zaman etkin olduğu`,
        `Her bağlantının üst verisi, IP adresiniz dahil`,
        `Bir aramanın yapıldığı, kiminle ve ne zaman — sesi ya da görüntüsü değil`,
        `Gönderdiğin her ekin adı, türü ve boyutu`,
      ],
    },
    note: `Şifreleme hiçbir zaman bağımsız denetimden geçmedi. Bu üst veriyi ortadan kaldırmak, içeriği şifrelemekten daha zor ve o iş bitmiş değil.`,
  },

  download: {
    title: `Chatterbox'ı edinin`,
    intro: `Web uygulaması tarayıcıda çalışır, kurulum gerektirmez. Android'de güncel tutma işini Google Play üstlenir; bu sitedeki APK aynı derlemedir, mağazayı kullanmak istemeyenler için.`,
    introWebOnly: `Web uygulaması tarayıcıda çalışır, kurulum gerektirmez; telefonda da bilgisayarda da. Android sürümü Google Play'e giden yolda.`,
    web: `Web uygulamasını açın`,
    play: `Google Play'den alın`,
    playPending: `Yakında Google Play'de`,
    apk: `APK'yı indirin`,
    playNote: `Android'de önerilen yol Google Play: uygulamayı arka planda günceller ve her kurulumda imzayı doğrular.`,
    androidPendingNote: `Android tarafında henüz iki yol da açık değil: Play sayfası yayımlanmadı ve bu sitede indirilecek bir dosya yok. Biri açılana kadar giriş web uygulamasından.`,
    playPendingNote: `Play sayfası henüz yayında değil. O zamana kadar Android yolu APK'dır — Android ilk seferde bu kaynaktan kuruluma izin vermenizi ister ve APK kendi kendini güncellemez.`,
    apkNote: `APK, Play sürümüyle aynı anahtarla imzalanmıştır; üzerine kurulur ve verilerinizi korur. Kendi kendini güncellemez.`,
    iosNote: `iOS sürümü henüz yayınlanmadı.`,
  },

  footer: {
    rights: `© 2026 Chatterbox. Kişisel bir proje, dürüstçe anlatıldı.`,
    privacy: `Gizlilik Politikası`,
  },
};
