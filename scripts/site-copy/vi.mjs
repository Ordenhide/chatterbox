/** Nội dung trang chủ (tiếng Việt). Cấu trúc: xem en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Ứng dụng nhắn tin không có danh bạ nào để tra ra bạn`,
    description: `Nhắn tin mã hoá đầu cuối, không có danh bạ người dùng, không hề có địa chỉ email, và chính sách quyền riêng tư nói rõ những gì nó không làm được. Web và Android.`,
  },

  links: {policy: `chính sách quyền riêng tư`, policyShort: `Hãy đọc nó`},

  nav: {
    different: `Khác ở đâu`,
    features: `Tính năng`,
    limits: `Giới hạn`,
    get: `Tải về`,
    language: `Ngôn ngữ`,
  },

  hero: {
    eyebrow: `Web và Android · iOS đang làm`,
    title: `Không có chỗ nào để tra ra bạn.`,
    lead: `Chatterbox là ứng dụng nhắn tin mã hoá đầu cuối, không có danh bạ người dùng. Không ai tìm được bạn, bởi vì chẳng có danh mục nào để tìm — cách duy nhất bước vào một cuộc trò chuyện là một liên kết do chính bạn đưa cho người khác.`,
    primary: `Tải Chatterbox`,
    secondary: `Đọc chính sách quyền riêng tư`,
    badges: [`Không có danh bạ`, `Chỉ qua lời mời`, `53 ngôn ngữ`, `Miễn phí`],
  },

  different: {
    eyebrow: `Khác ở đâu`,
    title: `Bảy điều mà phần lớn ứng dụng nhắn tin không làm`,
    intro: `Mỗi điều đều có một cơ chế đứng sau, không phải một tuỳ chọn bạn phải đi tìm. Chỗ nào có cái giá phải trả, chỗ đó nói rõ.`,
    reasons: [
      {
        title: `Không tồn tại danh bạ người dùng`,
        body: [
          `Không tìm theo tên người dùng, không đối chiếu số điện thoại, không có "những người bạn có thể biết". Lối duy nhất vào một cuộc trò chuyện là liên kết mời mà bạn gửi qua một kênh khác. Mỗi liên kết dùng được một lần và hết hạn sau 24 giờ, và một tác vụ định kỳ xoá những liên kết đã hết hạn, thay vì để lại một bản ghi vĩnh viễn về việc ai mời ai.`,
        ],
        note: `Đây không phải một thiết lập quyền riêng tư. Không có danh bạ nào để bạn rút tên ra cả.`,
      },
      {
        title: `Không có địa chỉ email nào để giữ`,
        body: [
          `Việc đăng ký không hỏi gì về bạn. Tài khoản của bạn là một cụm từ khôi phục gồm 24 từ được tạo ngay trên máy bạn, và thông tin đăng nhập mà máy chủ kiểm tra được suy ra từ những từ đó — thứ được lưu chỉ là một nhãn ngẫu nhiên dưới một tên miền không thể nhận thư. Hồ sơ của bạn cũng không chứa địa chỉ email, tên hiển thị hay đường dẫn ảnh, nên chẳng có hồ sơ nào để người khác đọc.`,
        ],
      },
      {
        title: `Được niêm phong không chỉ là tin nhắn`,
        body: [
          `Chữ trong tin nhắn là phần dễ. Bản xem trước liên kết và vị trí trực tiếp được mã hoá cho cuộc trò chuyện theo đúng cách đó: chia sẻ vị trí là một chuỗi toạ độ, và nó được niêm phong bằng khoá của máy bên kia như mọi thứ khác. Tệp đính kèm được mã hoá trước khi tải lên, nên thứ máy chủ giữ là những byte nó không mở được.`,
        ],
      },
      {
        title: `Mỗi tin nhắn có khoá riêng`,
        body: [
          `Phần lớn cuộc trò chuyện đơn và nhóm dùng cơ chế bánh cóc, nên một thiết bị bị xâm nhập không làm lộ những tin nhắn trước đó. Những cuộc trò chuyện mà máy của ai đó chưa công bố phần khoá mới hơn sẽ lùi về một khoá dùng lâu dài duy nhất, và khoá đó không có tính chất trên.`,
        ],
        note: `Nhãn dưới mỗi tin nhắn cho bạn biết nó thực sự nhận được loại nào. Đó không phải lời tuyên bố về ứng dụng; đó là lời nói về đúng tin nhắn ấy.`,
      },
      {
        title: `Không AI nào đọc cuộc trò chuyện của bạn`,
        body: [
          `Không tóm tắt, không dịch, không chép lời. Không có gì trong ứng dụng này giải mã một cuộc trò chuyện rồi gửi cho bên thứ ba xử lý, bởi ở đây không có tính năng nào làm thế. Gợi ý trả lời được tính ngay trên máy bạn từ vài tin nhắn gần nhất, và không đi đâu cả.`,
        ],
        note: `Những tính năng đó nằm trong mã nguồn và đã tắt ở bản này; dự kiến sẽ quay lại. Mục 6 của chính sách quyền riêng tư vẫn nêu tên ba dịch vụ mà chúng sẽ chạm tới, và nói rằng hôm nay không có gì đến được đó. Khi quay lại, chúng quay lại kèm phần công bố ấy và một lời hỏi trước lần dùng đầu tiên.`,
      },
      {
        title: `Việc tra cứu không diễn ra sau lưng bạn`,
        body: [
          `Chạm vào một cái tên trong tin nhắn và Chatterbox hiện bài Wikipedia về nó. Yêu cầu đó xảy ra đúng lúc bạn chạm, không lúc nào khác, và không có gì về nó được ghi vào cuộc trò chuyện.`,
        ],
        note: `Một phiên bản trước đó quét mười lăm tin nhắn gần nhất của mọi cuộc trò chuyện bạn mở và gọi Wikipedia tới ba mươi lần mỗi lần mở — mà chẳng hiện gì cả, vì các thẻ nằm sau một cờ chưa từng được bật. Nó bị gỡ bỏ chứ không phải được sửa.`,
      },
      {
        title: `Chính sách quyền riêng tư nói rõ những gì nó không làm được`,
        body: [
          `Nó ghi rằng phần mã hoá chưa bao giờ được kiểm định độc lập, rằng Google thấy siêu dữ liệu của mọi kết nối vì chúng tôi thuê máy chủ của họ, và rằng một khoá bị tráo trước tin nhắn đầu tiên của bạn sẽ trông hoàn toàn bình thường. Đó là cùng một văn bản trong ứng dụng và trên trang này, bằng 53 ngôn ngữ — không phải một bản gốc tiếng Anh kèm một bản dịch nhẹ giọng hơn.`,
        ],
        note: `{policyShort} trước khi bạn quyết định có tin điều nào ở trên hay không.`,
      },
    ],
  },

  features: {
    eyebrow: `Tính năng`,
    title: `Nó thật sự làm được gì`,
    intro: `Mọi thứ liệt kê ở đây đều có giao diện mà bạn chạm tới được. Không có dòng nào trên trang này mô tả một khả năng chỉ tồn tại trong mã nguồn.`,
    cards: [
      {
        title: `Nhắn tin`,
        body: `Chữ, ảnh, video, tệp và ghi âm. Trả lời, chuyển tiếp, biểu cảm, báo đã đọc, ghim tin nhắn, đánh dấu và hẹn giờ gửi.`,
      },
      {
        title: `Gọi thoại và gọi video`,
        body: `Gọi ngang hàng qua WebRTC, vốn mã hoá luồng giữa hai máy theo mặc định chứ không phải như một tuỳ chọn.`,
      },
      {
        title: `Gợi ý trả lời`,
        body: `Vài câu trả lời được gợi ý từ những tin nhắn gần nhất của cuộc trò chuyện. Việc đối chiếu diễn ra ngay trên máy bạn với một danh sách câu mẫu bằng ngôn ngữ của bạn — không có gì được gửi đi đâu để tạo ra chúng.`,
      },
      {
        title: `Tra Wikipedia`,
        body: `Nhấn giữ một tin nhắn, chọn một cái tên trong đó, rồi đọc bài viết mà không rời khỏi cuộc trò chuyện. Một yêu cầu, do bạn chạm, bằng ngôn ngữ của bạn.`,
      },
      {
        title: `Khoá của bạn, cụm từ khôi phục của bạn`,
        body: `Khoá riêng giải mã tin nhắn của bạn không bao giờ rời khỏi máy bạn. Bạn có thể chép nó ra thành cụm từ khôi phục; chúng tôi không giữ nó và không thể lấy lại giúp bạn.`,
      },
      {
        title: `53 ngôn ngữ`,
        body: `English, 简体中文, 繁體中文, Español, Français, Deutsch, Italiano, Português, Русский, Türkçe, Tiếng Việt, 日本語, 한국어, العربية, हिन्दी, فارسی, עברית, اردو, Polski, Українська, Bahasa Indonesia, বাংলা, ไทย, Filipino, Bahasa Melayu, မြန်မာဘာသာ, ខ្មែរ, ລາວ, தமிழ், తెలుగు, मराठी, ਪੰਜਾਬੀ, नेपाली, සිංහල, Kiswahili, Hausa, አማርኛ, Nederlands, Ελληνικά, Svenska, Dansk, Norsk, Čeština, Română, Magyar, Қазақша, Oʻzbekcha, ქართული, Հայերեն, བོད་ཡིག, Беларуская, ትግርኛ, Монгол — bao gồm cả lối viết từ phải sang trái.`,
      },
    ],
  },

  controls: {
    eyebrow: `Kiểm soát quyền riêng tư`,
    title: `Những thứ bạn có thể khoá lại`,
    items: [
      {
        title: `Khoá ứng dụng`,
        body: `Sinh trắc học hoặc mã PIN, với thời gian tự khoá do bạn chọn.`,
      },
      {
        title: `Xem một lần`,
        body: `Ảnh và video đóng lại vĩnh viễn sau khi đã mở.`,
      },
      {
        title: `Tin nhắn tự xoá`,
        body: `Đặt một cuộc trò chuyện tự dọn sạch, từ một giờ đến ba mươi ngày.`,
      },
      {
        title: `Đọc xong là mất`,
        body: `Một tin nhắn tự huỷ ngay khi người kia đọc xong.`,
      },
      {
        title: `Chặn`,
        body: `Chặn bất kỳ ai. Không có danh bạ, họ không tìm được đường quay lại.`,
      },
      {
        title: `Xuất và xoá`,
        body: `Mang dữ liệu của bạn đi, hoặc xoá tài khoản cùng mọi thứ thuộc về nó.`,
      },
    ],
  },

  limits: {
    eyebrow: `Giới hạn`,
    title: `Những gì không được bảo vệ`,
    intro: `Một trang chỉ liệt kê ưu điểm là một trang bạn không thể dùng để ra quyết định. Đây là bản ngắn; {policy} là bản đầy đủ.`,
    sealed: {
      title: `Được niêm phong trên máy bạn`,
      items: [
        `Chữ trong tin nhắn của bạn`,
        `Ảnh, video, âm thanh và tệp bạn đính kèm`,
        `Bản xem trước liên kết và vị trí trực tiếp`,
        `Bản gỡ băng giọng nói, sau khi quay về với bạn`,
        `Âm thanh và hình ảnh cuộc gọi, giữa hai thiết bị`,
      ],
    },
    visible: {
      title: `Chúng tôi và Google nhìn thấy`,
      items: [
        `Việc một cuộc trò chuyện tồn tại, và những tài khoản nào ở trong đó`,
        `Lần cuối mỗi tài khoản hoạt động`,
        `Siêu dữ liệu của mọi kết nối, kể cả địa chỉ IP của bạn`,
        `Rằng đã có một cuộc gọi, với ai và khi nào — không phải tiếng hay hình của nó`,
        `Tên, kiểu và kích thước của mọi tệp bạn đính kèm`,
      ],
    },
    note: `Phần mã hoá chưa bao giờ được kiểm định độc lập. Bỏ đi những siêu dữ liệu đó khó hơn mã hoá nội dung, và việc đó chưa xong.`,
  },

  download: {
    title: `Tải Chatterbox`,
    intro: `Bản web chạy thẳng trong trình duyệt, không phải cài gì. Trên Android, Google Play lo việc cập nhật; tệp APK trên trang này là cùng một bản dựng, dành cho ai không muốn qua cửa hàng.`,
    introWebOnly: `Bản web chạy thẳng trong trình duyệt, không phải cài gì, trên điện thoại cũng như trên máy tính. Bản Android đang trên đường lên Google Play.`,
    web: `Mở bản web`,
    play: `Tải trên Google Play`,
    playPending: `Sắp có trên Google Play`,
    apk: `Tải tệp APK`,
    playNote: `Trên Android, Google Play là đường khuyến nghị: cửa hàng cập nhật ứng dụng ở nền và kiểm tra chữ ký ở mỗi lần cài.`,
    androidPendingNote: `Cả hai lối vào Android đều chưa mở: trang trên Play chưa đăng, và trang này cũng chưa có tệp để tải. Cho đến khi có một lối, bản web là đường vào.`,
    playPendingNote: `Trang trên Play chưa lên. Cho đến khi đó, APK là đường vào của Android — lần đầu Android sẽ hỏi bạn có cho phép cài từ nguồn này không, và nó không tự cập nhật.`,
    apkNote: `APK được ký bằng đúng khoá của bản trên Play, nên cài đè lên được và giữ nguyên dữ liệu của bạn. Nó không tự cập nhật.`,
    iosNote: `Bản iOS chưa phát hành.`,
  },

  footer: {
    rights: `© 2026 Chatterbox. Một dự án cá nhân, được mô tả một cách trung thực.`,
    privacy: `Chính sách quyền riêng tư`,
  },
};
