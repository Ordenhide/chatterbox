/**
 * The landing page, in Polish. Every other file in this directory is the
 * same shape in another language, and build-site-html.mjs turns each into a
 * page. See en.mjs for what each field means.
 */
export default {
  meta: {
    title: 'Chatterbox — komunikator, w którym nie ma jak Cię wyszukać',
    description:
      'Szyfrowanie end-to-end bez katalogu użytkowników, bez żadnego adresu e-mail, i polityka prywatności, która mówi, czego nie potrafi. Web i Android.',
  },

  links: {policy: 'polityką prywatności', policyShort: 'Przeczytaj ją'},

  nav: {
    different: 'Co jest inne',
    features: 'Funkcje',
    limits: 'Ograniczenia',
    get: 'Pobierz',
    language: 'Język',
  },

  hero: {
    eyebrow: 'Web i Android · iOS w trakcie',
    title: 'Nie ma tu jak Cię wyszukać.',
    lead: `Chatterbox to komunikator szyfrowany end-to-end bez katalogu użytkowników. Nikt nie może Cię wyszukać, bo nie ma indeksu do przeszukania — jedyną drogą do rozmowy jest link, który sam komuś przekazujesz.`,
    primary: 'Pobierz Chatterbox',
    secondary: 'Przeczytaj politykę prywatności',
    badges: ['Brak katalogu użytkowników', 'Tylko z zaproszenia', '53 języki', 'Za darmo'],
  },

  different: {
    eyebrow: 'Co jest inne',
    title: 'Siedem rzeczy, których nie robi większość komunikatorów',
    intro: `Każda z nich to decyzja z mechanizmem stojącym za nią, a nie ustawienie, które trzeba znaleźć. Tam, gdzie coś jest kompromisem, jest to powiedziane wprost.`,
    reasons: [
      {
        title: 'Nie ma katalogu użytkowników',
        body: [
          `Żadnego wyszukiwania nazwy użytkownika, dopasowywania numeru telefonu, „osób, które możesz znać”. Jedyną drogą do rozmowy jest link z zaproszeniem, który wysyłasz komuś poza aplikacją. Każdy link działa raz i wygasa po 24 godzinach, a zaplanowane zadanie usuwa te, które wygasły, zamiast zostawiać trwały zapis, kto kogo zaprosił.`,
        ],
        note: `To nie jest ustawienie prywatności. Nie ma katalogu, z którego można by zrezygnować.`,
      },
      {
        title: 'Nie ma adresu e-mail do przechowywania',
        body: [
          `Rejestracja nie pyta o nic na Twój temat. Twoje konto to 24-wyrazowa fraza odzyskiwania wygenerowana na Twoim urządzeniu, a poświadczenie, które sprawdza serwer, pochodzi z tych właśnie słów — to, co przechowuje, to tylko losowa etykieta pod domeną, która nie może odbierać poczty. Twój dokument profilu nie zawiera adresu e-mail, nazwy wyświetlanej ani adresu URL zdjęcia, więc nie ma też profilu do przeczytania przez kogokolwiek innego.`,
        ],
      },
      {
        title: 'Zapieczętowane jest więcej niż same wiadomości',
        body: [
          `Tekst wiadomości to łatwa część. Podglądy linków i lokalizacja na żywo są szyfrowane do rozmowy w ten sam sposób — udostępnianie lokalizacji to strumień współrzędnych, i jest zapieczętowany kluczem drugiego urządzenia jak wszystko inne. Załączniki są szyfrowane przed przesłaniem, więc to, co przechowuje serwer, to bajty, których nie może otworzyć.`,
        ],
      },
      {
        title: 'Każda wiadomość ma własny klucz',
        body: [
          `Większość rozmów jeden na jeden i grupowych korzysta z mechanizmu ratchet, więc kompromitacja urządzenia nie ujawnia wcześniejszych wiadomości. Rozmowy, w których klient kogoś jeszcze nie opublikował nowszego materiału kluczowego, wracają do jednego, długotrwałego klucza, który nie ma tej właściwości.`,
        ],
        note: `Etykieta pod wiadomością mówi Ci, którą z nich faktycznie otrzymała. To nie jest twierdzenie o aplikacji; to twierdzenie o tej konkretnej wiadomości.`,
      },
      {
        title: `Żadna sztuczna inteligencja nie czyta Twoich rozmów`,
        body: [
          `Nie ma streszczania, tłumaczenia ani transkrypcji. Nic w tej aplikacji nie odszyfrowuje rozmowy i nie wysyła jej do strony trzeciej w celu przetworzenia, bo żadna funkcja tego tutaj nie robi. Sugestie odpowiedzi są obliczane na Twoim urządzeniu na podstawie kilku ostatnich wiadomości i nigdzie nie trafiają.`,
        ],
        note: `Te funkcje są w kodzie i wyłączone w tej wersji; mają wrócić. Sekcja 6 polityki prywatności wciąż wymienia trzy usługi, do których by trafiały, i mówi, że dziś nic do nich nie dociera. Gdy wrócą, wrócą z tym ujawnieniem i pytaniem przed pierwszym użyciem.`,
      },
      {
        title: 'Wyszukiwanie czegoś nie dzieje się za Twoimi plecami',
        body: [
          `Dotknij nazwy w wiadomości, a Chatterbox pokaże Ci jej artykuł w Wikipedii. To żądanie dzieje się przy dotknięciu i nie inaczej, i nic o nim nie jest zapisywane w rozmowie.`,
        ],
        note: `Wcześniejsza wersja skanowała ostatnie piętnaście wiadomości każdego otwieranego wątku i pytała Wikipedię do trzydziestu razy przy każdym otwarciu — nic przy tym nie pokazując, bo karty były ukryte za flagą, która nigdy nie była włączona. Została usunięta, a nie naprawiona.`,
      },
      {
        title: 'Polityka prywatności mówi, czego nie potrafi',
        body: [
          `Stwierdza, że szyfrowanie nigdy nie zostało niezależnie zaudytowane, że Google widzi metadane każdego połączenia, bo wynajmujemy jego serwery, i że klucz podmieniony przed Twoją pierwszą wiadomością wyglądałby zupełnie normalnie. To ten sam tekst w aplikacji i na tej stronie, w 53 językach — nie angielski oryginał z łagodniejszym tłumaczeniem.`,
        ],
        note: `{policyShort}, zanim zdecydujesz się zaufać czemukolwiek powyżej.`,
      },
    ],
  },

  features: {
    eyebrow: 'Funkcje',
    title: 'Co faktycznie robi',
    intro: `Wszystko, co tu wymienione, ma interfejs, do którego można dotrzeć. Nic na tej stronie nie opisuje możliwości istniejącej wyłącznie w kodzie.`,
    cards: [
      {
        title: 'Wiadomości',
        body: `Tekst, zdjęcia, wideo, pliki i notatki głosowe. Odpowiedzi, przekazywanie, reakcje, potwierdzenia odczytu, przypięte wiadomości, zakładki i zaplanowane wiadomości.`,
      },
      {
        title: 'Połączenia głosowe i wideo',
        body: `Połączenia łączą się bezpośrednio między dwoma urządzeniami przez WebRTC, gdy to możliwe, szyfrując dźwięk i obraz domyślnie, a nie opcjonalnie. Gdy nie mogą — często z powodu różnych sieci — zaszyfrowany przekaźnik przenosi połączenie, nie mogąc go odszyfrować.`,
      },
      {
        title: `Sugestie odpowiedzi`,
        body: `Kilka sugerowanych odpowiedzi wyciągniętych z ostatnich wiadomości rozmowy. Są dopasowywane na Twoim urządzeniu do listy fraz w Twoim języku — nic nie jest nigdzie wysyłane, żeby je wygenerować.`,
      },
      {
        title: 'Wyszukiwanie w Wikipedii',
        body: `Naciśnij i przytrzymaj wiadomość, wybierz nazwę w niej zawartą, i przeczytaj artykuł bez opuszczania czatu. Jedno żądanie, przy Twoim dotknięciu, w Twoim własnym języku.`,
      },
      {
        title: 'Twój klucz, Twoja fraza odzyskiwania',
        body: `Klucz prywatny, który odszyfrowuje Twoje wiadomości, nigdy nie opuszcza Twojego urządzenia. Możesz go zapisać jako frazę odzyskiwania; my go nie przechowujemy i nie możemy go dla Ciebie odzyskać.`,
      },
      {
        title: '53 języki',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — w tym pismo od prawej do lewej.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Kontrola prywatności',
    title: 'Co możesz zabezpieczyć',
    items: [
      {title: 'Blokada aplikacji', body: `Biometria lub PIN, z opóźnieniem automatycznej blokady, które sam wybierasz.`},
      {title: 'Jednorazowe wyświetlenie', body: `Zdjęcia i filmy, które zamykają się na stałe po otwarciu.`},
      {
        title: 'Znikające wiadomości',
        body: `Ustaw rozmowę tak, by sama się czyściła, od godziny do trzydziestu dni.`,
      },
      {
        title: 'Spalanie po przeczytaniu',
        body: `Wiadomość, która niszczy się po przeczytaniu przez drugą osobę.`,
      },
      {
        title: 'Blokowanie',
        body: `Zablokuj każdego. Bez katalogu nie znajdą drogi z powrotem.`,
      },
      {
        title: 'Eksport i usuwanie',
        body: `Wyeksportuj swoje dane albo usuń konto i wszystko, co jest pod nim.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Ograniczenia',
    title: 'Co nie jest chronione',
    intro: `Strona, która wymienia tylko mocne strony, to strona, na podstawie której nie da się podjąć decyzji. To krótka wersja; {policy} to długa.`,
    sealed: {
      title: 'Zapieczętowane na Twoim urządzeniu',
      items: [
        'Tekst Twoich wiadomości',
        'Zdjęcia, wideo, audio i pliki, które załączasz',
        'Podglądy linków i lokalizacja na żywo',
        'Transkrypcje głosowe, gdy już do Ciebie wracają',
        'Audio i wideo połączeń, między dwoma urządzeniami',
      ],
    },
    visible: {
      title: `Widoczne dla nas, Google i Cloudflare`,
      items: [
        'Że rozmowa istnieje i jakie konta w niej uczestniczą',
        'Kiedy każde konto było ostatnio aktywne',
        'Metadane każdego połączenia, w tym Twój adres IP',
        'Że wykonano połączenie, do kogo i kiedy — nie jego audio ani wideo',
        `Oba adresy IP, gdy połączenie wymaga przekazania, aby się połączyć — nigdy jego dźwięk ani obraz`,
        'Nazwę pliku, typ i rozmiar każdego wysyłanego załącznika',
      ],
    },
    note: `Szyfrowanie nigdy nie zostało niezależnie zaudytowane. Usunięcie tych metadanych jest trudniejsze niż zaszyfrowanie treści, i ta praca nie jest ukończona.`,
  },

  download: {
    title: 'Pobierz Chatterbox',
    intro: `Aplikacja webowa działa w przeglądarce, nie ma nic do zainstalowania. Na Androidzie Google Play aktualizuje ją na bieżąco; APK na tej stronie to ta sama wersja dla tych, którzy woleliby nie korzystać ze sklepu.`,
    introWebOnly: `Aplikacja webowa działa w przeglądarce, nie ma nic do zainstalowania, zarówno na telefonie, jak i na komputerze. Wersja na Androida jest w drodze do Google Play.`,
    web: 'Otwórz aplikację webową',
    play: 'Pobierz z Google Play',
    playPending: 'Wkrótce w Google Play',
    apk: 'Pobierz APK',
    playNote: `Google Play to zalecana droga na Androidzie: aktualizuje aplikację w tle i weryfikuje podpis przy każdej instalacji.`,
    androidPendingNote: `Żadna z dwóch dróg na Androida jeszcze nie działa: wpis w Play nie jest opublikowany, a na tej stronie nie ma pliku do pobrania. Aplikacja webowa jest sposobem na wejście, dopóki jedna z nich nie zadziała.`,
    playPendingNote: `Wpis w Play jeszcze nie działa. Do tego czasu APK jest drogą na Androida — Android poprosi Cię o zgodę na instalacje z tego źródła za pierwszym razem, i nie aktualizuje się sam.`,
    apkNote: `APK jest podpisany tym samym kluczem co wersja z Play, więc instaluje się na niej i zachowuje Twoje dane. Nie aktualizuje się sam.`,
    iosNote: `iOS jeszcze nie został wydany.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Osobisty projekt, opisany uczciwie.',
    privacy: 'Polityka prywatności',
  },
};
