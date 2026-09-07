/** Açılış sayfası metni (Türkçe). Yapı için bkz. en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Sizi arayabilecekleri bir dizini olmayan mesajlaşma`,
    description: `Uçtan uca şifreli mesajlaşma: kullanıcı dizini yok, e-posta adresiniz saklanmıyor ve gizlilik politikası neyi yapamadığını da yazıyor. Web ve Android.`,
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
    badges: [`Dizin yok`, `Yalnızca davetle`, `15 dil`, `Ücretsiz`],
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
        title: `Sunucu e-posta adresinizi saklamıyor`,
        body: [
          `Bir adresle giriş yaparsınız, iş orada biter. Profil belgenizde e-posta adresi, görünen ad ve fotoğraf bağlantısı bulunmaz. Başkasının okuyabileceği bir profil de yoktur; çünkü size ulaşabilecek tek kişiler, davet ettiğiniz kişilerdir.`,
        ],
      },
      {
        title: `Mühürlenen yalnızca mesajlar değil`,
        body: [
          `Mesaj metni işin kolay kısmı. Bağlantı önizlemeleri, paylaşılan listeler, kaydedilen alıntılar ve ses dökümleri de aynı şekilde o sohbete şifrelenir. Ses dökümü eskiden bir sunucu işlevi tarafından mesajın içine düz metin olarak geri yazılıyordu; artık sizin cihazınızda mühürleniyor, çeviriler ise hiç saklanmıyor.`,
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
        title: `Yapay zekâ siz açana kadar kapalı ve her sağlayıcının adı yazılı`,
        body: [
          `Özetler, çeviri ve döküm, içeriği cihazınızda çözer ve dışarı gönderir. Gizlilik politikasının 6. bölümü içeriği alan her hizmeti adıyla sayar — Google Cloud Speech-to-Text, Google Cloud Translation, Cloudflare Workers AI — ve oraya tam olarak neyin gittiğini yazar. Uygulama ilk seferden önce sorar, düğme de profilinizdedir.`,
        ],
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
          `Şifrelemenin hiçbir zaman bağımsız denetimden geçmediğini, sunucularını kiraladığımız için Google'ın her bağlantının üst verisini görebildiğini ve çökme raporlarının bir hesap kimliği taşıdığını, anonim olmadığını yazar. Uygulamadaki ve bu sitedeki metin aynıdır, on beş dilde — İngilizce bir asıl ve daha yumuşak bir çeviri değil.`,
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
        title: `İsteğe bağlı yapay zekâ`,
        body: `Sohbet özetleri, akıllı yanıtlar, ses dökümü ve mesaj çevirisi. Varsayılan olarak kapalı; sağlayıcıların adı politikada yazılı.`,
      },
      {
        title: `Vikipedi'de arama`,
        body: `Bir mesaja uzun basın, içindeki bir ismi seçin ve sohbetten çıkmadan maddeyi okuyun. Tek istek, sizin dokunuşunuzla, kendi dilinizde.`,
      },
      {
        title: `Paylaşılan listeler ve alıntı duvarı`,
        body: `İkinizin de işaretleyebileceği bir liste ve saklanmaya değer cümleler için bir yer. İkisi de mesajlar gibi o sohbete mühürlü.`,
      },
      {
        title: `On beş dil`,
        body: `İngilizce, Çincenin iki yazısı, Japonca, Korece, İspanyolca, Fransızca, Almanca, İtalyanca, Portekizce, Rusça, Türkçe, Vietnamca, Arapça ve Hintçe — sağdan sola yazım dahil.`,
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
        `Bağlantı önizlemeleri, paylaşılan listeler, kaydedilen alıntılar`,
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
        `Çökme ve kullanım raporları; bunlar bir hesap kimliği taşır`,
        `Bir yapay zekâ özelliğine göndermeyi seçtiğiniz her şey, o çalıştığı sürece`,
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
