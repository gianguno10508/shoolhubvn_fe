// utils/lessonPlanPptx.js — dựng file PowerPoint (16:9) từ dàn ý slide AI tạo cho giáo án
/* Dàn ý: [{ kind: section|content|activity|quiz|summary, title, emoji, subtitle, bullets, task, time,
 *          question, options, answer, notes }] — mỗi câu trắc nghiệm sinh 2 slide: câu hỏi và đáp án.
 * Giao diện theo chủ đề (utils/slideThemes.js): ảnh nền vẽ SVG + emoji minh hoạ, đều chuyển thành ảnh
 * ngay trên trình duyệt nên file PowerPoint mở ở máy nào cũng giống nhau. */

import { subjectEmoji, themeById } from "./slideThemes";

const W = 13.333;
const H = 7.5;
const LETTERS = ["A", "B", "C", "D"];
const OPTION_COLORS = ["2563EB", "DC2626", "F59E0B", "16A34A"];
const DEFAULT_EMOJI = { section: "🚀", content: null, activity: "👥", quiz: "❓", summary: "⭐" };

/* ---------- chuyển SVG / emoji thành ảnh ---------- */

const imageCache = new Map();

/** "data:image/png;base64,..." → "image/png;base64,..." (định dạng pptxgenjs nhận) */
const pptxData = (url) => url.replace(/^data:/, "");

function svgToJpeg(markup) {
  if (imageCache.has(markup)) return imageCache.get(markup);
  const job = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 900;
      canvas.getContext("2d").drawImage(img, 0, 0, 1600, 900);
      resolve(pptxData(canvas.toDataURL("image/jpeg", 0.9)));
    };
    img.onerror = () => reject(new Error("Không vẽ được ảnh nền slide."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
  imageCache.set(markup, job);
  return job;
}

function emojiPng(emoji) {
  const key = `emoji:${emoji}`;
  if (!imageCache.has(key)) {
    const px = 256;
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${px * 0.78}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(emoji, px / 2, px / 2 + px * 0.05);
    imageCache.set(key, pptxData(canvas.toDataURL("image/png")));
  }
  return imageCache.get(key);
}

/* ---------- bố cục ---------- */

/** Cỡ chữ theo lượng chữ để nội dung không tràn khung */
function fitSize(texts, sizes) {
  const chars = texts.reduce((n, t) => n + (t || "").length, 0) + texts.length * 25;
  if (chars < 260) return sizes[0];
  if (chars < 420) return sizes[1];
  if (chars < 620) return sizes[2];
  return sizes[3];
}

function makeDeck(pptx, theme, plan) {
  const c = theme.color;
  const font = theme.font;
  const ink = (dark) => (dark ? "FFFFFF" : c.text);
  const lessonEmoji = subjectEmoji(plan.subject);

  const bulletRuns = (items, bullet = { code: "25CF", indent: 22 }) =>
    items.map((text, i) => ({ text, options: { bullet, breakLine: i < items.length - 1, paraSpaceAfter: 8 } }));

  function picture(slide, emoji, x, y, size, ring) {
    if (!emoji) return;
    if (ring) {
      slide.addShape("ellipse", { x, y, w: size, h: size, fill: { color: ring }, line: { color: c.line, width: 2 } });
      const inner = size * 0.68;
      slide.addImage({ data: emojiPng(emoji), x: x + (size - inner) / 2, y: y + (size - inner) / 2, w: inner, h: inner });
    } else slide.addImage({ data: emojiPng(emoji), x, y, w: size, h: size });
  }

  function addTitle(slide, title, w = W - 1.2) {
    slide.addText(title, {
      x: 0.6,
      y: 0.35,
      w,
      h: 0.95,
      fontFace: font,
      fontSize: title.length > 60 ? 24 : 30,
      bold: true,
      color: c.title,
      valign: "middle",
      fit: "shrink",
    });
    slide.addShape("roundRect", { x: 0.6, y: 1.3, w: 1.4, h: 0.09, rectRadius: 0.04, fill: { color: c.accent }, line: { color: c.accent } });
  }

  const addNotes = (slide, ...parts) => {
    const text = parts.filter(Boolean).join("\n\n");
    if (text) slide.addNotes(text);
  };

  /** Khung mờ phía sau tiêu đề để chữ luôn đọc rõ trên ảnh nền */
  const backdrop = (slide, dark, x, y, w, h) =>
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      rectRadius: 0.25,
      fill: { color: dark ? "000000" : "FFFFFF", transparency: dark ? 72 : 18 },
      line: { color: dark ? "000000" : "FFFFFF", transparency: 100 },
    });

  return {
    cover() {
      const dark = theme.dark.cover;
      const slide = pptx.addSlide({ masterName: "COVER" });
      const title = plan.title || "Bài giảng";
      backdrop(slide, dark, 0.6, 0.8, 8.4, 5.2);
      picture(slide, lessonEmoji, 1.0, 1.15, 1.3, c.soft);
      slide.addText("BÀI GIẢNG", { x: 2.5, y: 1.45, w: 5, h: 0.6, fontFace: font, fontSize: 18, bold: true, color: dark ? "FDE68A" : c.accent, charSpacing: 4 });
      slide.addText(title, {
        x: 1.0,
        y: 2.65,
        w: 7.6,
        h: 2.1,
        fontFace: font,
        fontSize: title.length > 70 ? 30 : title.length > 40 ? 36 : 42,
        bold: true,
        color: dark ? "FFFFFF" : c.title,
        valign: "top",
        fit: "shrink",
      });
      const info = [plan.subject, plan.grade && `Lớp ${plan.grade}`, plan.bookSeries].filter(Boolean).join("  •  ");
      if (info) slide.addText(info, { x: 1.0, y: 4.95, w: 7.6, h: 0.6, fontFace: font, fontSize: 18, color: dark ? "E0F2FE" : c.muted });
    },

    section(s, index) {
      const dark = theme.dark.section;
      const slide = pptx.addSlide({ masterName: "SECTION" });
      if (!dark) backdrop(slide, false, 0.6, 1.0, 8.6, 4.9);
      picture(slide, s.emoji || DEFAULT_EMOJI.section, 0.95, 1.3, 1.5, dark ? "FFFFFF" : c.soft);
      slide.addText(`PHẦN ${index}`, { x: 0.95, y: 3.0, w: 6, h: 0.5, fontFace: font, fontSize: 18, bold: true, color: dark ? "FDE68A" : c.accent, charSpacing: 4 });
      slide.addText(s.title, {
        x: 0.95,
        y: 3.5,
        w: 8,
        h: 1.3,
        fontFace: font,
        fontSize: 42,
        bold: true,
        color: dark ? "FFFFFF" : c.title,
        valign: "top",
        fit: "shrink",
      });
      if (s.subtitle) {
        slide.addText(s.subtitle, { x: 0.95, y: 4.8, w: 8, h: 0.9, fontFace: font, fontSize: 20, color: dark ? "E2E8F0" : c.muted, valign: "top" });
      }
      addNotes(slide, s.notes);
    },

    content(s, kind = "content") {
      const dark = theme.dark.content;
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      const bullets = s.bullets || [];
      const emoji = s.emoji || DEFAULT_EMOJI[kind] || lessonEmoji;
      const long = bullets.join("").length > 650;
      addTitle(slide, s.title, long ? W - 1.2 : W - 4.2);
      if (!long) picture(slide, emoji, W - 3.75, 1.9, 3.0, c.soft);
      const textW = long ? W - 1.6 : W - 5.0;
      if (bullets.length) {
        const summary = kind === "summary";
        slide.addText(bulletRuns(bullets, summary ? { code: "2714", indent: 26 } : undefined), {
          x: 0.75,
          y: 1.65,
          w: textW,
          h: 5.0,
          fontFace: font,
          fontSize: fitSize(bullets, long ? [24, 20, 18, 16] : [26, 22, 19, 17]),
          color: ink(dark),
          valign: "top",
          ...(summary
            ? { shape: "roundRect", rectRadius: 0.12, fill: { color: c.soft }, line: { color: c.line, width: 1.5 }, margin: 16 }
            : {}),
        });
      }
      addNotes(slide, s.notes);
    },

    activity(s) {
      const dark = theme.dark.content;
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      addTitle(slide, s.title, W - 4);
      if (s.time) {
        slide.addText(`⏱ ${s.time}`, {
          x: W - 2.8,
          y: 0.5,
          w: 2.2,
          h: 0.62,
          shape: "roundRect",
          rectRadius: 0.3,
          fill: { color: c.soft },
          line: { color: c.line, width: 1.5 },
          fontFace: font,
          fontSize: 18,
          bold: true,
          color: c.title,
          align: "center",
          valign: "middle",
        });
      }
      const bullets = s.bullets || [];
      const taskH = bullets.length ? 2.0 : 4.6;
      slide.addShape("roundRect", { x: 0.75, y: 1.65, w: W - 1.5, h: taskH, rectRadius: 0.14, fill: { color: c.soft }, line: { color: c.line, width: 2 } });
      picture(slide, s.emoji || DEFAULT_EMOJI.activity, W - 2.25, 1.65 + (taskH - 1.25) / 2, 1.25);
      slide.addText(
        [
          { text: "NHIỆM VỤ", options: { bold: true, color: c.title, fontSize: 16, breakLine: true } },
          { text: s.task || "", options: { color: ink(dark) } },
        ],
        { x: 0.95, y: 1.65, w: W - 3.6, h: taskH, fontFace: font, fontSize: fitSize([s.task], [24, 21, 19, 17]), valign: "middle" },
      );
      if (bullets.length) {
        slide.addText(bulletRuns(bullets, { type: "number" }), {
          x: 0.85,
          y: 1.65 + taskH + 0.25,
          w: W - 1.7,
          h: H - 1.65 - taskH - 1.05,
          fontFace: font,
          fontSize: fitSize(bullets, [22, 20, 18, 16]),
          color: ink(dark),
          valign: "top",
        });
      }
      addNotes(slide, s.notes);
    },

    quiz(s, showAnswer) {
      const dark = theme.dark.content;
      const slide = pptx.addSlide({ masterName: "CONTENT" });
      addTitle(slide, showAnswer ? `${s.title || "Câu hỏi"} — Đáp án` : s.title || "Câu hỏi", W - 2.6);
      picture(slide, showAnswer ? "✅" : s.emoji || DEFAULT_EMOJI.quiz, W - 1.75, 0.3, 1.05);
      slide.addText(s.question, {
        x: 0.75,
        y: 1.55,
        w: W - 1.5,
        h: 1.45,
        fontFace: font,
        fontSize: s.question.length > 160 ? 21 : 25,
        bold: true,
        color: ink(dark),
        valign: "middle",
        fit: "shrink",
      });
      const colW = (W - 1.5 - 0.4) / 2;
      const rowH = 1.5;
      const optSize = fitSize(s.options, [22, 20, 18, 16]);
      s.options.forEach((opt, i) => {
        const x = 0.75 + (i % 2) * (colW + 0.4);
        const y = 3.15 + Math.floor(i / 2) * (rowH + 0.22);
        const correct = showAnswer && i === s.answer;
        const faded = showAnswer && !correct;
        slide.addShape("roundRect", {
          x,
          y,
          w: colW,
          h: rowH,
          rectRadius: 0.14,
          fill: { color: correct ? "DCFCE7" : c.card, transparency: faded ? 35 : 0 },
          line: { color: correct ? "16A34A" : c.line, width: correct ? 3 : 1.5 },
        });
        slide.addText(LETTERS[i], {
          x: x + 0.2,
          y: y + (rowH - 0.75) / 2,
          w: 0.75,
          h: 0.75,
          shape: "ellipse",
          fill: { color: correct ? "16A34A" : faded ? "94A3B8" : OPTION_COLORS[i] },
          line: { color: "FFFFFF" },
          fontFace: font,
          fontSize: 22,
          bold: true,
          color: "FFFFFF",
          align: "center",
          valign: "middle",
        });
        slide.addText(correct ? `${opt}  ✓` : opt, {
          x: x + 1.1,
          y,
          w: colW - 1.25,
          h: rowH,
          fontFace: font,
          fontSize: optSize,
          bold: correct,
          color: correct ? "14532D" : faded ? c.muted : ink(dark),
          valign: "middle",
          fit: "shrink",
        });
      });
      if (showAnswer) addNotes(slide, `Đáp án: ${LETTERS[s.answer]}. ${s.options[s.answer] || ""}`, s.notes);
      else addNotes(slide, "Cho học sinh suy nghĩ / giơ thẻ A, B, C, D rồi chuyển slide để xem đáp án.");
    },
  };
}

const safeName = (s) =>
  (s || "Bai-giang")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "Bai-giang";

/** Dựng bản trình chiếu (chưa tải xuống) — tách riêng để có thể xuất dạng khác */
export async function buildLessonPlanPptx(plan, slides, themeId) {
  const theme = themeById(themeId);
  const [{ default: PptxGenJS }, coverBg, sectionBg, contentBg] = await Promise.all([
    import("pptxgenjs"),
    svgToJpeg(theme.cover()),
    svgToJpeg(theme.section()),
    svgToJpeg(theme.content()),
  ]);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = plan.title || "Bài giảng";
  pptx.subject = [plan.subject, plan.grade && `Lớp ${plan.grade}`].filter(Boolean).join(" - ");
  pptx.theme = { headFontFace: theme.font, bodyFontFace: theme.font };

  pptx.defineSlideMaster({ title: "COVER", background: { data: coverBg } });
  pptx.defineSlideMaster({ title: "SECTION", background: { data: sectionBg } });
  pptx.defineSlideMaster({
    title: "CONTENT",
    background: { data: contentBg },
    slideNumber: {
      x: W - 1.15,
      y: 0.05,
      w: 0.9,
      h: 0.3,
      fontFace: theme.font,
      fontSize: 11,
      color: theme.dark.content ? "CBD5E1" : theme.color.muted,
      align: "right",
    },
  });

  const deck = makeDeck(pptx, theme, plan);
  deck.cover();
  let section = 0;
  for (const s of slides) {
    if (s.kind === "section") deck.section(s, ++section);
    else if (s.kind === "activity") deck.activity(s);
    else if (s.kind === "quiz") {
      deck.quiz(s, false);
      deck.quiz(s, true);
    } else deck.content(s, s.kind === "summary" ? "summary" : "content");
  }
  return pptx;
}

/** @param {{title,subject,grade,bookSeries}} plan  @param {object[]} slides — dàn ý từ API  @param {string} themeId */
export async function exportLessonPlanPptx(plan, slides, themeId) {
  const pptx = await buildLessonPlanPptx(plan, slides, themeId);
  await pptx.writeFile({ fileName: `Bai-giang-${safeName(plan.title)}.pptx` });
}
