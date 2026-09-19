/**
 * Ukurasa wa kutua, kwa Kiswahili. Angalia en.mjs kwa muundo ambao kila faili
 * katika saraka hii inashiriki; `{policy}` inakuwa kiungo cha sera ya faragha
 * ya lugha hii, na `links.policy` kama maandishi ya kiungo.
 */
export default {
  meta: {
    title: 'Chatterbox — Programu ya ujumbe bila kitu cha kukutafuta ndani yake',
    description:
      'Ujumbe uliosimbwa mwanzo hadi mwisho bila orodha ya watumiaji, bila anwani ya barua pepe kabisa, na sera ya faragha inayosema kile ambacho haiwezi. Web na Android.',
  },

  links: {policy: 'sera ya faragha', policyShort: 'Isome'},

  nav: {
    different: 'Kinachotofautiana',
    features: 'Vipengele',
    limits: 'Mipaka',
    get: 'Ipate',
    language: 'Lugha',
  },

  hero: {
    eyebrow: 'Web na Android · iOS inaendelea',
    title: 'Hakuna kitu cha kukutafuta ndani yake.',
    lead: `Chatterbox ni programu ya ujumbe iliyosimbwa mwanzo hadi mwisho bila orodha ya watumiaji. Hakuna anayeweza kukutafuta, kwa sababu hakuna faharasa ya kutafuta — njia pekee ya kuingia kwenye mazungumzo ni kiungo unachompa mtu mwenyewe.`,
    primary: 'Pata Chatterbox',
    secondary: 'Soma sera ya faragha',
    badges: ['Hakuna orodha ya watumiaji', 'Kwa mwaliko pekee', 'Lugha 53', 'Bila malipo'],
  },

  different: {
    eyebrow: 'Kinachotofautiana',
    title: 'Mambo saba ambayo programu nyingi za ujumbe hazifanyi',
    intro: `Kila moja ya haya ni uamuzi ulio na utaratibu nyuma yake, si mpangilio unaotakiwa kuutafuta. Pale ambapo kitu ni biashara ya kubadilishana, inasemwa.`,
    reasons: [
      {
        title: 'Hakuna orodha ya watumiaji',
        body: [
          `Hakuna utafutaji wa jina la mtumiaji, hakuna ulinganishaji wa namba ya simu, hakuna “watu unaowafahamu”. Njia pekee ya kuingia kwenye mazungumzo ni kiungo cha mwaliko unachomtumia mtu nje ya njia hii. Kila kiungo hufanya kazi mara moja na kinaisha muda baada ya masaa 24, na kazi iliyopangwa hufuta vilivyoisha muda badala ya kuacha rekodi ya kudumu ya nani alimwalika nani.`,
        ],
        note: `Hii si mpangilio wa faragha. Hakuna orodha ya kujitoa kutoka kwake.`,
      },
      {
        title: 'Hakuna anwani ya barua pepe ya kushikilia',
        body: [
          `Kujisajili hakuulizi chochote kukuhusu. Akaunti yako ni kifungu cha kurejesha cha maneno 24 kinachotengenezwa kwenye kifaa chako, na kitambulisho ambacho seva hukagua kinatokana na maneno hayo — kinachohifadhiwa ni lebo ya nasibu chini ya kikoa kisichoweza kupokea barua pepe. Hati ya wasifu wako haina anwani ya barua pepe, jina la kuonyesha wala URL ya picha, kwa hivyo hakuna wasifu kwa mtu mwingine kuusoma pia.`,
        ],
      },
      {
        title: 'Zaidi ya ujumbe kimefungwa',
        body: [
          `Maandishi ya ujumbe ni sehemu rahisi. Muhtasari wa viungo na mahali pa moja kwa moja husimbwa kwa mazungumzo kwa njia ile ile — kushiriki mahali ni mkondo wa viwianishi, na umefungwa kwa ufunguo wa kifaa kingine kama kila kitu kingine. Viambatisho husimbwa kabla ya kupakiwa, kwa hivyo kinachoshikiliwa na seva ni baiti ambazo haiwezi kuzifungua.`,
        ],
      },
      {
        title: 'Kila ujumbe una ufunguo wake',
        body: [
          `Mazungumzo mengi ya mtu-kwa-mtu na ya kikundi hutumia ratchet, ili kuathiriwa kwa kifaa kisifichue ujumbe uliotangulia. Mazungumzo ambapo kifaa cha mtu hakijachapisha nyenzo mpya za ufunguo hurudi kwenye ufunguo mmoja wa muda mrefu, ambao hauna sifa hiyo.`,
        ],
        note: `Lebo iliyo chini ya ujumbe inakuambia ni ipi hasa iliyopokea. Si dai kuhusu programu; ni dai kuhusu ujumbe huo.`,
      },
      {
        title: `Hakuna AI inayosoma mazungumzo yako`,
        body: [
          `Hakuna kifupishaji, hakuna tafsiri, hakuna uandishi wa sauti. Hakuna chochote katika programu hii kinachofungua mazungumzo na kukituma kwa mtu wa tatu kuchakatwa, kwa sababu hakuna kipengele hapa kinachofanya hivyo. Mapendekezo ya majibu yanahesabiwa kwenye kifaa chako kutoka ujumbe wa mwisho, na hayaendi mahali popote.`,
        ],
        note: `Vipengele hivyo vipo katika msimbo na vimezimwa kwa toleo hili; vimekusudiwa kurudi. Sehemu ya 6 ya sera ya faragha bado inataja huduma tatu ambazo vingezifikia na kusema kwamba hakuna kinachozifikia leo. Vinaporudi, vinarudi na ufunuo huo na ujumbe kabla ya matumizi ya kwanza.`,
      },
      {
        title: 'Kutafuta kitu hakutokei nyuma yako',
        body: [
          `Gusa jina katika ujumbe na Chatterbox inakuonyesha makala yake ya Wikipedia. Ombi hilo hutokea wakati wa kugusa na sio vinginevyo, na hakuna chochote kuhusu hilo kinachoandikwa kwenye mazungumzo.`,
        ],
        note: `Toleo la awali lilichanganua ujumbe kumi na tano wa mwisho wa kila mazungumzo uliyofungua na kuuliza Wikipedia hadi mara thelathini kila kufunguliwa — wakati haikuonyesha kitu, kwa sababu kadi zilikuwa nyuma ya kifungo ambacho hakikuwashwa kamwe. Iliondolewa badala ya kurekebishwa.`,
      },
      {
        title: 'Sera ya faragha inasema kile ambacho haiwezi',
        body: [
          `Inasema kwamba usimbaji haujafanyiwa ukaguzi wa kujitegemea kamwe, kwamba Google inaweza kuona metadata ya kila muunganisho kwa sababu tunakodisha seva zake, na kwamba ufunguo uliobadilishwa kabla ya ujumbe wako wa kwanza ungeonekana wa kawaida kabisa. Ni maandishi yale yale katika programu na kwenye tovuti hii, katika lugha 53 — si asili ya Kiingereza yenye tafsiri laini zaidi.`,
        ],
        note: `{policyShort} kabla ya kuamua kuamini chochote kati ya hayo yaliyo juu.`,
      },
    ],
  },

  features: {
    eyebrow: 'Vipengele',
    title: 'Kile inachofanya kwa kweli',
    intro: `Kila kilichoorodheshwa hapa kina kiolesura unaweza kukifikia. Hakuna chochote kwenye ukurasa huu kinachoelezea uwezo uliopo kwenye msimbo pekee.`,
    cards: [
      {
        title: 'Kutuma ujumbe',
        body: `Maandishi, picha, video, faili na ujumbe wa sauti. Majibu, kusambaza, itikio, risiti za kusoma, ujumbe uliobandikwa, alamisho na ujumbe uliopangwa.`,
      },
      {
        title: 'Simu za sauti na video',
        body: `Simu za moja-kwa-moja kupitia WebRTC, ambayo husimba midia kati ya vifaa viwili kwa chaguo-msingi badala ya kama chaguo.`,
      },
      {
        title: `Mapendekezo ya majibu`,
        body: `Majibu machache yanayopendekezwa kutoka ujumbe wa mwisho wa mazungumzo. Yanalinganishwa kwenye kifaa chako na orodha ya vifungu vya maneno katika lugha yako — hakuna kinachotumwa mahali popote kuyatoa.`,
      },
      {
        title: 'Utafutaji wa Wikipedia',
        body: `Bonyeza kwa muda mrefu ujumbe, chagua jina ndani yake, na usome makala bila kutoka kwenye mazungumzo. Ombi moja, unapogusa, katika lugha yako mwenyewe.`,
      },
      {
        title: 'Ufunguo wako, kifungu chako cha kurejesha',
        body: `Ufunguo wa faragha unaofungua ujumbe wako haondoki kamwe kwenye kifaa chako. Unaweza kukiandika kama kifungu cha kurejesha; sisi hatukishikilii na hatuwezi kukirejesha kwa ajili yako.`,
      },
      {
        title: 'Lugha 53',
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — ikijumuisha maandishi ya kulia kwenda kushoto.`,
      },
    ],
  },

  controls: {
    eyebrow: 'Vidhibiti vya faragha',
    title: 'Kile unaweza kufunga',
    items: [
      {title: 'Kufunga programu', body: `Biometriki au PIN, na muda wa kufunga kiotomatiki unaouchagua.`},
      {title: 'Tazama mara moja', body: `Picha na video zinazofungwa kabisa baada ya kufunguliwa.`},
      {
        title: 'Ujumbe unaotoweka',
        body: `Weka mazungumzo yajifute yenyewe, kutoka saa moja hadi siku thelathini.`,
      },
      {
        title: 'Teketeza baada ya kusoma',
        body: `Ujumbe unaojiharibu mara mtu mwingine anapousoma.`,
      },
      {
        title: 'Kuzuia',
        body: `Zuia mtu yeyote. Bila orodha, hawawezi kupata njia ya kurudi.`,
      },
      {
        title: 'Hamisha na futa',
        body: `Chukua data yako, au futa akaunti na kila kitu kilicho chini yake.`,
      },
    ],
  },

  limits: {
    eyebrow: 'Mipaka',
    title: 'Kile kisicholindwa',
    intro: `Ukurasa unaoorodhesha nguvu pekee ni ukurasa usioweza kukutumia kufanya uamuzi. Hii ni toleo fupi; {policy} ni ndefu.`,
    sealed: {
      title: 'Kimefungwa kwenye kifaa chako',
      items: [
        'Maandishi ya ujumbe wako',
        'Picha, video, sauti na faili unazoambatanisha',
        'Muhtasari wa viungo na mahali pa moja kwa moja',
        'Nakala za maandishi za sauti, mara zinaporudi kwako',
        'Sauti na video ya simu, kati ya vifaa viwili',
      ],
    },
    visible: {
      title: 'Kinachoonekana kwetu na kwa Google',
      items: [
        'Kwamba mazungumzo yapo, na akaunti zipi ziko humo',
        'Kila akaunti ilikuwa hai mara ya mwisho lini',
        'Metadata ya kila muunganisho, ikiwa ni pamoja na anwani yako ya IP',
        'Kwamba simu ilipigwa, kwa nani na lini — si sauti au video yake',
        'Jina la faili, aina na ukubwa wa kila kiambatisho unachotuma',
      ],
    },
    note: `Usimbaji haujafanyiwa ukaguzi wa kujitegemea kamwe. Kuondoa metadata hiyo ni ngumu zaidi kuliko kusimba maudhui, na kazi hiyo haijakamilika.`,
  },

  download: {
    title: 'Pata Chatterbox',
    intro: `Programu ya wavuti hufanya kazi katika kivinjari bila kusakinisha chochote. Kwenye Android, Google Play huiweka imeboreshwa; APK iliyo kwenye tovuti hii ni build ile ile kwa yeyote anayependelea kutotumia duka.`,
    introWebOnly: `Programu ya wavuti hufanya kazi katika kivinjari bila kusakinisha chochote, kwenye simu kama vile kwenye kompyuta. Build ya Android iko njiani kuelekea Google Play.`,
    web: 'Fungua programu ya wavuti',
    play: 'Ipate kwenye Google Play',
    playPending: 'Inakuja kwenye Google Play',
    apk: 'Pakua APK',
    playNote: `Google Play ni njia inayopendekezwa kwenye Android: huboresha programu nyuma na kuthibitisha saini kwa kila usakinishaji.`,
    androidPendingNote: `Hakuna njia yoyote ya Android iliyo tayari bado: orodha ya Play haijachapishwa, na hakuna upakuaji kwenye tovuti hii. Programu ya wavuti ni njia ya kuingia hadi mojawapo iwe tayari.`,
    playPendingNote: `Orodha ya Play haiko tayari bado. Hadi itakapokuwa, APK ni njia ya Android — Android itakuomba uruhusu usakinishaji kutoka chanzo hiki mara ya kwanza, na haijiboreshi yenyewe.`,
    apkNote: `APK imetiwa saini kwa ufunguo ule ule kama build ya Play, kwa hivyo hujisakinisha juu yake na kubakiza data yako. Haijiboreshi yenyewe.`,
    iosNote: `iOS haijatolewa bado.`,
  },

  footer: {
    rights: '© 2026 Chatterbox. Mradi wa kibinafsi, ulioelezwa kwa uaminifu.',
    privacy: 'Sera ya Faragha',
  },
};
