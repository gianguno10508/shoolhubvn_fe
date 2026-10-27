// Prompt cho "Tạo đề với AI": lấy danh sách bài theo SGK và soạn ma trận / bản đặc tả / đề kiểm tra

const LEVELS = {
  primary: {
    label: "Tiểu học",
    guide:
      "Học sinh tiểu học: câu hỏi rất ngắn gọn, từ ngữ đơn giản, gần gũi đời sống hằng ngày của trẻ; " +
      "mỗi câu chỉ kiểm tra 1 ý; tránh thuật ngữ khó; mức vận dụng / vận dụng cao chỉ là tình huống thực tế quen thuộc, giải trong 1–2 bước.",
  },
  lower_secondary: {
    label: "Trung học cơ sở",
    guide:
      "Học sinh THCS: độ khó vừa phải, bám sát yêu cầu cần đạt của chương trình; vận dụng cao là bài toán / tình huống thực tiễn nhiều bước nhưng không đánh đố.",
  },
  upper_secondary: {
    label: "Trung học phổ thông",
    guide:
      "Học sinh THPT: theo định dạng đề kiểm tra, đánh giá mới của Bộ GD&ĐT (CT GDPT 2018); câu hỏi có ngữ cảnh, phân hoá rõ giữa các mức độ.",
  },
  gdtx: {
    label: "Trung tâm GDNN - GDTX",
    guide:
      "Học viên trung tâm GDNN-GDTX (đa phần học lực trung bình, vừa học vừa làm): đề PHẢI NHẸ NHÀNG, DỄ HƠN đề THPT/THCS cùng khối; " +
      "ưu tiên kiến thức cơ bản, trọng tâm; câu chữ ngắn, rõ ràng; hạn chế tính toán phức tạp; " +
      "vận dụng và vận dụng cao chỉ ở mức liên hệ thực tế đơn giản, gắn với nghề nghiệp, đời sống.",
  },
};

const LEVEL_NAMES = { nb: "Nhận biết", th: "Thông hiểu", vd: "Vận dụng", vdc: "Vận dụng cao" };

const CURRICULUM_SYSTEM = `Bạn là chuyên gia chương trình giáo dục phổ thông 2018 của Việt Nam, thuộc lòng mục lục các bộ sách giáo khoa hiện hành.
Nhiệm vụ: liệt kê mục lục (chủ đề/chương và các bài học) của một cuốn sách giáo khoa.
Quy tắc:
- Ghi đúng tên chương/chủ đề và tên bài như trong sách (giữ cả số thứ tự, ví dụ "Bài 1. ..."). Không bịa bài không có trong sách.
- Bỏ các mục không phải bài học để kiểm tra (lời nói đầu, hướng dẫn sử dụng sách, bảng thuật ngữ...). Giữ bài ôn tập / luyện tập chung nếu có.
- semester = 1 nếu bài thuộc học kì I, 2 nếu thuộc học kì II (ước lượng theo phân phối chương trình phổ biến).
- Chỉ trả về JSON đúng mẫu: {"chapters":[{"title":"...","semester":1,"lessons":["Bài 1. ...","Bài 2. ..."]}]}`;

function buildCurriculumPrompt({ grade, subject, bookSeries }) {
  return `Liệt kê mục lục sách giáo khoa môn ${subject} lớp ${grade}, bộ sách "${bookSeries}".`;
}

const EXAM_SYSTEM = `Bạn là chuyên gia ra đề kiểm tra, đánh giá theo Chương trình GDPT 2018 và hướng dẫn của Bộ GD&ĐT Việt Nam (Công văn 7991/BGDĐT-GDTrH).
Bạn soạn đồng thời: bản đặc tả (yêu cầu cần đạt theo từng mức độ) và đề kiểm tra kèm đáp án, đúng cấu hình giáo viên đưa ra.

QUY TẮC CHUNG
- Câu hỏi chính xác về kiến thức, chỉ dùng nội dung trong các bài được chọn, đúng chương trình của khối lớp và bộ sách.
- Mức độ: nb = Nhận biết, th = Thông hiểu, vd = Vận dụng, vdc = Vận dụng cao. Gắn đúng mức độ cho từng câu / từng ý.
- Không dùng LaTeX hay Markdown. Công thức viết bằng ký tự Unicode thường (x², x³, √2, π, ≤, ≥, ≠, →, H₂O, ½...).
- Trường "lesson" của mỗi câu phải chép NGUYÊN VĂN 1 tên bài trong danh sách bài được chọn.
- Rải câu hỏi đều theo các bài, bài dài / quan trọng có thể nhiều câu hơn.

DẠNG CÂU HỎI
1) Trắc nghiệm nhiều lựa chọn (mcQuestions): 4 phương án, chỉ 1 đáp án đúng; phương án nhiễu hợp lý; vị trí đáp án đúng phân bố đều A/B/C/D; không dùng "Tất cả đều đúng/sai".
   Không ghi chữ "A.", "B."... ở đầu phương án.
2) Trắc nghiệm đúng/sai (tfQuestions): mỗi câu có 1 phần dẫn (ngữ cảnh / thông tin) và đúng 4 ý a, b, c, d; mỗi ý là 1 nhận định để học sinh chọn Đúng hoặc Sai.
   Mỗi câu có từ 2 đến 3 ý đúng (không để cả 4 ý cùng đúng hoặc cùng sai). Các ý trong 1 câu thường tăng dần mức độ. Mỗi ý có level riêng.
   Không ghi "a)", "b)" ở đầu ý.
3) Tự luận (essayQuestions): câu hỏi rõ yêu cầu, có điểm (points) và hướng dẫn chấm chi tiết từng bước kèm điểm thành phần (answerGuide, xuống dòng bằng \\n).

BẢN ĐẶC TẢ (specification): mỗi bài được chọn 1 dòng; requirements mô tả yêu cầu cần đạt theo từng mức độ mà đề kiểm tra
(bắt đầu bằng động từ: "Nêu được...", "Trình bày được...", "Giải thích được...", "Vận dụng được..."); mức độ nào bài không có câu hỏi thì để chuỗi rỗng.

Chỉ trả về JSON đúng mẫu:
{
  "title": "tên đề, VD: Đề kiểm tra giữa học kì I – Toán 10",
  "specification": [{ "lesson": "...", "requirements": { "nb": "...", "th": "...", "vd": "...", "vdc": "..." } }],
  "mcQuestions": [{ "lesson": "...", "level": "nb", "question": "...", "options": ["...", "...", "...", "..."], "answer": "A" }],
  "tfQuestions": [{ "lesson": "...", "stem": "...", "statements": [{ "text": "...", "correct": true, "level": "nb" }] }],
  "essayQuestions": [{ "lesson": "...", "level": "vd", "points": 1, "question": "...", "answerGuide": "..." }]
}`;

const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

/** @param {object} c cấu hình đã làm sạch + counts tính sẵn */
function buildExamPrompt(c) {
  const lv = LEVELS[c.level];
  const { counts } = c;
  const lessons = c.lessons.map((l, i) => `${i + 1}. ${l.title}${l.chapter ? ` (thuộc: ${l.chapter})` : ""}`).join("\n");
  const ratioText = Object.entries(c.ratios)
    .map(([k, v]) => `${LEVEL_NAMES[k]} ${v}%`)
    .join(", ");

  const parts = [];
  if (counts.mc) parts.push(`- Phần I – Trắc nghiệm nhiều lựa chọn: ĐÚNG ${counts.mc} câu, mỗi câu ${fmt(c.mcPoints)} điểm (tổng ${fmt(counts.mc * c.mcPoints)} điểm).`);
  if (counts.tf) parts.push(`- Phần ${counts.mc ? "II" : "I"} – Trắc nghiệm đúng/sai: ĐÚNG ${counts.tf} câu × 4 ý, mỗi câu 1 điểm (tổng ${counts.tf} điểm).`);
  if (counts.essay) {
    parts.push(
      `- Phần tự luận: ĐÚNG ${counts.essay} câu, tổng ${fmt(counts.essayPoints)} điểm (chia điểm từng câu theo độ khó, bội số của 0,25).`,
    );
  } else {
    parts.push("- Không có phần tự luận (essayQuestions là mảng rỗng).");
  }

  return `CẤU HÌNH ĐỀ
- Đối tượng: ${lv.label}, lớp ${c.grade}. ${lv.guide}
- Môn: ${c.subject}. Bộ sách: ${c.bookSeries}.
- Loại bài kiểm tra: ${c.examName || "Kiểm tra định kì"}. Thời gian làm bài: ${c.duration} phút. Thang điểm 10.
- Tỉ lệ mức độ (tính theo điểm toàn đề): ${ratioText}.
  Phân bổ để tổng điểm mỗi mức độ sát tỉ lệ trên nhất có thể (mỗi ý đúng/sai tính 0,25 điểm).
- Cấu trúc: ${c.objectivePercent}% trắc nghiệm, ${100 - c.objectivePercent}% tự luận.
${parts.join("\n")}

CÁC BÀI ĐƯỢC CHỌN
${lessons}
${c.notes ? `\nYÊU CẦU THÊM CỦA GIÁO VIÊN\n${c.notes}\n` : ""}
Hãy soạn bản đặc tả và đề kiểm tra đúng số câu từng phần như trên.`;
}

module.exports = { LEVELS, LEVEL_NAMES, CURRICULUM_SYSTEM, buildCurriculumPrompt, EXAM_SYSTEM, buildExamPrompt };
