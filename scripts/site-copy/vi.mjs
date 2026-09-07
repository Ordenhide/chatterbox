/** Nội dung trang chủ (tiếng Việt). Cấu trúc: xem en.mjs. */
export default {
  meta: {
    title: `Chatterbox — Ứng dụng nhắn tin không có danh bạ nào để tra ra bạn`,
    description: `Nhắn tin mã hoá đầu cuối, không có danh bạ người dùng, không lưu địa chỉ email, và chính sách quyền riêng tư nói rõ những gì nó không làm được. Web và Android.`,
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
    badges: [`Không có danh bạ`, `Chỉ qua lời mời`, `15 ngôn ngữ`, `Miễn phí`],
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
        title: `Máy chủ không giữ địa chỉ email của bạn`,
        body: [
          `Bạn đăng nhập bằng một địa chỉ, và mọi thứ dừng ở đó. Hồ sơ của bạn không chứa địa chỉ email, không tên hiển thị, không đường dẫn ảnh. Cũng không có hồ sơ nào để người khác đọc, vì những người duy nhất liên lạc được với bạn là những người bạn đã mời.`,
        ],
      },
      {
        title: `Được niêm phong không chỉ là tin nhắn`,
        body: [
          `Chữ trong tin nhắn là phần dễ. Bản xem trước liên kết, danh sách dùng chung, trích dẫn đã lưu và bản gỡ băng giọng nói đều được mã hoá theo cùng một cách cho cuộc trò chuyện đó. Trước đây, một hàm phía máy chủ ghi bản gỡ băng trở lại tin nhắn dưới dạng văn bản thuần; giờ nó được niêm phong ngay trên máy bạn, còn bản dịch thì không được lưu chút nào.`,
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
        title: `AI tắt cho đến khi bạn bật, và mỗi nhà cung cấp đều được nêu tên`,
        body: [
          `Tóm tắt, dịch và gỡ băng sẽ giải mã nội dung ngay trên máy bạn rồi gửi đi. Mục 6 của chính sách quyền riêng tư nêu tên từng dịch vụ nhận nội dung đó — Google Cloud Speech-to-Text, Google Cloud Translation, Cloudflare Workers AI — và nói chính xác cái gì được gửi tới. Ứng dụng hỏi trước lần đầu tiên, và công tắc nằm trong hồ sơ của bạn.`,
        ],
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
          `Nó ghi rằng phần mã hoá chưa bao giờ được kiểm định độc lập, rằng Google thấy siêu dữ liệu của mọi kết nối vì chúng tôi thuê máy chủ của họ, và rằng báo cáo sự cố có mang định danh tài khoản chứ không ẩn danh. Đó là cùng một văn bản trong ứng dụng và trên trang này, bằng mười lăm ngôn ngữ — không phải một bản gốc tiếng Anh kèm một bản dịch nhẹ giọng hơn.`,
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
        title: `AI tuỳ chọn`,
        body: `Tóm tắt cuộc trò chuyện, gợi ý trả lời, gỡ băng giọng nói và dịch tin nhắn. Mặc định tắt; nhà cung cấp được nêu tên trong chính sách.`,
      },
      {
        title: `Tra Wikipedia`,
        body: `Nhấn giữ một tin nhắn, chọn một cái tên trong đó, rồi đọc bài viết mà không rời khỏi cuộc trò chuyện. Một yêu cầu, do bạn chạm, bằng ngôn ngữ của bạn.`,
      },
      {
        title: `Danh sách chung và tường trích dẫn`,
        body: `Một danh sách cả hai cùng tích, và một chỗ để giữ những câu đáng giữ. Cả hai đều được niêm phong cho cuộc trò chuyện như tin nhắn.`,
      },
      {
        title: `Mười lăm ngôn ngữ`,
        body: `Tiếng Anh, tiếng Trung ở cả hai lối viết, tiếng Nhật, Hàn, Tây Ban Nha, Pháp, Đức, Ý, Bồ Đào Nha, Nga, Thổ Nhĩ Kỳ, Việt, Ả Rập và Hindi — bao gồm cả lối viết từ phải sang trái.`,
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
        `Bản xem trước liên kết, danh sách dùng chung, trích dẫn đã lưu`,
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
        `Báo cáo sự cố và sử dụng, vốn mang định danh tài khoản`,
        `Bất cứ thứ gì bạn chọn gửi cho một tính năng AI, trong lúc nó chạy`,
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
