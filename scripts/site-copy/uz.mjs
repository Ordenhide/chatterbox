/**
 * Ochilish sahifasi, o'zbek tilida. Bu katalogdagi har bir fayl bo'lishadigan
 * shaklni en.mjs'da ko'ring; `{policy}` shu tilning maxfiylik siyosatiga
 * havolaga aylanadi, `links.policy` esa havola matni bo'ladi.
 */
export default {
  meta: {
    title: 'Chatterbox — Sizni qidirib topadigan hech narsasi yo\'q messenjer',
    description:
      'Uchidan uchigacha shifrlangan xabar almashinuvi: foydalanuvchilar katalogi yo\'q, elektron pochta manzili umuman yo\'q va nimani qila olmasligini aytadigan maxfiylik siyosati bor. Web va Android.',
  },

  links: {policy: 'maxfiylik siyosati', policyShort: 'O\'qib chiqing'},

  nav: {
    different: 'Nimasi boshqacha',
    features: 'Imkoniyatlar',
    limits: 'Cheklovlar',
    get: 'Yuklab olish',
    language: 'Til',
  },

  hero: {
    eyebrow: 'Web va Android · iOS tayyorlanmoqda',
    title: 'Sizni qidirib topadigan hech narsa yo\'q.',
    lead: `Chatterbox — foydalanuvchilar katalogi bo'lmagan, uchidan uchigacha shifrlangan messenjer. Hech kim sizni qidira olmaydi, chunki qidiradigan indeks yo'q — suhbatga kirishning yagona yo'li o'zingiz kimgadir bergan havoladir.`,
    primary: 'Chatterbox\'ni yuklab olish',
    secondary: 'Maxfiylik siyosatini o\'qish',
    badges: ['Foydalanuvchilar katalogi yo\'q', 'Faqat taklif bilan', '53 til', 'Bepul'],
  },

  different: {
    eyebrow: 'Nimasi boshqacha',
    title: 'Ko\'pchilik messenjerlar qilmaydigan yettita narsa',
    intro: `Bularning har biri ortida mexanizmi bo'lgan qarordir, siz izlab topishingiz kerak bo'lgan sozlama emas. Biror narsa murosaga borish bo'lsa, shu aytiladi.`,
    reasons: [
      {
        title: 'Foydalanuvchilar katalogi yo\'q',
        body: [
          `Foydalanuvchi nomi bo'yicha qidiruv yo'q, telefon raqamini moslashtirish yo'q, “siz tanishingiz mumkin bo'lgan odamlar” yo'q. Suhbatga kirishning yagona yo'li — kimgadir kanaldan tashqarida yuboradigan taklif havolasi. Har bir havola bir marta ishlaydi va 24 soatdan keyin muddati tugaydi, rejalashtirilgan vazifa esa muddati o'tganlarini o'chiradi, kim kimni taklif qilgani haqida doimiy yozuv qoldirish o'rniga.`,
        ],
        note: `Bu maxfiylik sozlamasi emas. Undan voz kechish kerak bo'lgan katalogning o'zi yo'q.`,
      },
      {
        title: 'Saqlanadigan elektron pochta manzili yo\'q',
        body: [
          `Ro'yxatdan o'tish siz haqingizda hech narsa so'ramaydi. Hisobingiz — qurilmangizda yaratilgan 24 so'zli tiklash iborasi, server tekshiradigan hisob ma'lumoti esa o'sha so'zlardan olinadi — u saqlaydigan narsa pochta qabul qila olmaydigan domen ostidagi tasodifiy yorliq. Profil hujjatingizda elektron pochta manzili, ko'rsatiladigan ism va rasm URL'i yo'q, shuning uchun boshqa birov o'qiydigan profil ham yo'q.`,
        ],
      },
      {
        title: 'Xabarlardan ko\'proq narsa muhrlangan',
        body: [
          `Xabar matni — oson qismi. Havola oldindan ko'rishlari va jonli joylashuv ham xuddi shunday suhbatga shifrlanadi — joylashuvni ulashish koordinatalar oqimidir va u boshqa hamma narsa kabi ikkinchi qurilmaning kaliti bilan muhrlanadi. Biriktirmalar yuklashdan oldin shifrlanadi, shuning uchun server saqlaydigan narsa — o'zi ocha olmaydigan baytlar.`,
        ],
      },
      {
        title: 'Har bir xabarning o\'z kaliti bor',
        body: [
          `Ko'pgina bir-birov va guruh suhbatlari ratchet ishlatadi, shuning uchun qurilmaning buzilishi undan oldin kelgan xabarlarni ochib bermaydi. Kimningdir klienti yangiroq kalit materialini e'lon qilmagan suhbatlar bu xususiyatga ega bo'lmagan yagona uzoq muddatli kalitga qaytadi.`,
        ],
        note: `Xabar ostidagi belgi u aslida qaysi birini olganini aytadi. Bu ilova haqidagi da'vo emas; bu o'sha xabar haqidagi da'vo.`,
      },
      {
        title: `Hech qanday AI suhbatlaringizni o'qimaydi`,
        body: [
          `Qisqacha bayon qiluvchi yo'q, tarjima yo'q, matnga aylantirish yo'q. Bu ilovada hech narsa suhbatni shifrdan chiqarib, uni qayta ishlash uchun uchinchi tomonga yubormaydi, chunki bu yerda hech qanday funksiya buni qilmaydi. Javob tavsiyalari oxirgi bir necha xabardan qurilmangizda hisoblanadi va hech qayerga ketmaydi.`,
        ],
        note: `O'sha funksiyalar kodda mavjud va bu versiyada o'chirilgan; ular qaytishi ko'zda tutilgan. Maxfiylik siyosatining 6-bo'limi ular yetib boradigan uchta xizmatni hamon nomlaydi va bugun ularga hech narsa yetib bormasligini aytadi. Qaytganda, ular ana shu oshkoralik va birinchi foydalanishdan oldingi so'rov bilan qaytadi.`,
      },
      {
        title: 'Biror narsani qidirish orqangizdan amalga oshmaydi',
        body: [
          `Xabardagi ismga bosing va Chatterbox sizga uning Vikipediya maqolasini ko'rsatadi. O'sha so'rov bosilganda amalga oshadi va boshqacha yo'q, va u haqida hech narsa suhbatga yozilmaydi.`,
        ],
        note: `Oldingi versiya siz ochgan har bir suhbatning oxirgi o'n beshta xabarini tekshirib, har ochilishda Vikipediyaga o'ttiz martagacha so'rov yuborardi — shu bilan birga hech narsa ko'rsatmasdan, chunki kartalar hech qachon yoqilmagan bayroq ortida edi. U tuzatilmadi, olib tashlandi.`,
      },
      {
        title: 'Maxfiylik siyosati nimani qila olmasligini aytadi',
        body: [
          `Unda shifrlash hech qachon mustaqil auditdan o'tmagani, serverlarini ijaraga olganimiz uchun Google har bir ulanishning metama'lumotlarini ko'rishi va birinchi xabaringizdan oldin almashtirilgan kalit mutlaqo normal ko'rinishi aytilgan. Bu ilovada ham, shu saytda ham bir xil matn, 53 tilda — ingliz tilidagi asl nusxa va uning yumshoqroq tarjimasi emas.`,
        ],
        note: `Yuqoridagilarning biriga ishonishga qaror qilishdan oldin {policyShort}.`,
      },
    ],
  },

  features: {
    eyebrow: 'Imkoniyatlar',
    title: 'U aslida nima qiladi',
    intro: `Bu yerda sanab o'tilgan hamma narsaning siz yetib boradigan interfeysi bor. Bu sahifada faqat kodda mavjud bo'lgan imkoniyat tasvirlanmagan.`,
    cards: [
      {
        title: 'Xabar almashinuvi',
        body: `Matn, rasmlar, video, fayllar va ovozli xabarlar. Javoblar, uzatish, reaksiyalar, o'qilganlik tasdiqlari, qadalgan xabarlar, xatcho'plar va rejalashtirilgan xabarlar.`,
      },
      {
        title: 'Ovozli va video qo\'ng\'iroqlar',
        body: `WebRTC orqali to'g'ridan-to'g'ri qo'ng'iroq — u ikki qurilma o'rtasidagi mediani tanlov sifatida emas, balki sukut bo'yicha shifrlaydi.`,
      },
      {
        title: `Javob tavsiyalari`,
        body: `Suhbatning oxirgi xabarlaridan olingan bir necha tavsiya etilgan javob. Ular qurilmangizda sizning tilingizdagi iboralar ro'yxati bilan solishtiriladi — ularni yaratish uchun hech narsa hech qayerga yuborilmaydi.`,
      },
      {
        title: 'Vikipediyadan qidirish',
        body: `Xabarni bosib turing, undagi ismni tanlang va suhbatdan chiqmasdan maqolani o'qing. Bitta so'rov, sizning bosishingizda, o'z tilingizda.`,
      },
      {
        title: 'Sizning kalitingiz, sizning tiklash iborangiz',
        body: `Xabarlaringizni shifrdan chiqaradigan shaxsiy kalit qurilmangizdan hech qachon chiqmaydi. Uni tiklash iborasi sifatida yozib olishingiz mumkin; biz uni saqlamaymiz va siz uchun tiklay olmaymiz.`,
      },
      {
        title: '53 til',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — o'ngdan chapga yozishni ham qo'shib.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Maxfiylik boshqaruvlari',
    title: 'Nimani qulflab qo\'yishingiz mumkin',
    items: [
      {title: 'Ilova qulfi', body: `Biometriya yoki PIN kod, o'zingiz tanlagan avtomatik qulflanish kechikishi bilan.`},
      {title: 'Bir marta ko\'rish', body: `Ochilgandan keyin butunlay yopiladigan rasm va videolar.`},
      {
        title: 'Yo\'qoluvchi xabarlar',
        body: `Suhbatni o'zini tozalashga sozlang — bir soatdan o'ttiz kungacha.`,
      },
      {
        title: 'O\'qilgandan keyin yo\'q qilish',
        body: `Suhbatdoshingiz o'qishi bilan o'zini yo'q qiladigan xabar.`,
      },
      {
        title: 'Bloklash',
        body: `Istalgan odamni bloklang. Katalog bo'lmaganda, ular qaytish yo'lini topa olmaydi.`,
      },
      {
        title: 'Eksport va o\'chirish',
        body: `Ma'lumotlaringizni olib chiqing yoki hisobni va uning ostidagi hamma narsani o'chirib tashlang.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Cheklovlar',
    title: 'Nima himoyalanmagan',
    intro: `Faqat kuchli tomonlarni sanab o'tadigan sahifa — bu sahifaga asoslanib qaror qabul qila olmaysiz. Bu qisqa versiya; {policy} esa uzuni.`,
    sealed: {
      title: 'Qurilmangizda muhrlangan',
      items: [
        'Xabarlaringiz matni',
        'Siz biriktirgan rasm, video, audio va fayllar',
        'Havola oldindan ko\'rishlari va jonli joylashuv',
        'Ovozli transkriptlar, sizga qaytib kelganidan keyin',
        'Qo\'ng\'iroq ovozi va videosi, ikki qurilma o\'rtasida',
      ],
    },
    visible: {
      title: 'Bizga va Google\'ga ko\'rinadi',
      items: [
        'Suhbat mavjudligi va unda qanday hisoblar borligi',
        'Har bir hisob oxirgi marta qachon faol bo\'lgani',
        'Har bir ulanishning metama\'lumotlari, IP manzilingiz bilan birga',
        'Qo\'ng\'iroq bo\'lgani, kimga va qachon — ovozi yoki videosi emas',
        'Siz yuboradigan har bir biriktirmaning fayl nomi, turi va hajmi',
      ],
    },
    note: `Shifrlash hech qachon mustaqil auditdan o'tmagan. O'sha metama'lumotlarni olib tashlash mazmunni shifrlashdan qiyinroq va bu ish tugallanmagan.`,
  },

  download: {
    title: 'Chatterbox\'ni yuklab olish',
    intro: `Veb-ilova brauzerda hech narsa o'rnatmasdan ishlaydi. Android'da Google Play uni yangilab turadi; bu saytdagi APK do'kondan foydalanmaslikni afzal ko'rganlar uchun aynan shu build.`,
    introWebOnly: `Veb-ilova brauzerda hech narsa o'rnatmasdan ishlaydi — telefonda ham, kompyuterda ham. Android build'i Google Play'ga yo'lda.`,
    web: 'Veb-ilovani ochish',
    play: 'Google Play\'dan oling',
    playPending: 'Google Play\'da tez kunda',
    apk: 'APK\'ni yuklab olish',
    playNote: `Google Play — Android'dagi tavsiya etilgan yo'l: u ilovani fonda yangilaydi va har bir o'rnatishda imzoni tekshiradi.`,
    androidPendingNote: `Android yo'llarining hech biri hali ishlamaydi: Play ro'yxati nashr etilmagan va bu saytda yuklab olish yo'q. Ulardan biri ishlagunicha veb-ilova kirish yo'lidir.`,
    playPendingNote: `Play ro'yxati hali ishlamaydi. Shu vaqtga qadar APK Android yo'lidir — Android birinchi marta bu manbadan o'rnatishga ruxsat berishingizni so'raydi va u o'zini yangilamaydi.`,
    apkNote: `APK Play build'i bilan bir xil kalit bilan imzolangan, shuning uchun uning ustiga o'rnatiladi va ma'lumotlaringizni saqlaydi. U o'zini yangilamaydi.`,
    iosNote: `iOS hali chiqarilmagan.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Shaxsiy loyiha, halol tasvirlangan.',
    privacy: 'Maxfiylik siyosati',
  },
};
