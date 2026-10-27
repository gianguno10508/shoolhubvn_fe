// Số câu từng phần của đề AI từ cấu hình — giữ giống frontend/src/pages/teacher/aiExam/examMatrix.js (examCounts)
//   objectivePercent: % điểm trắc nghiệm (bội số của 10), còn lại là tự luận
//   mcPercent: trong phần trắc nghiệm, % điểm câu nhiều lựa chọn; còn lại là câu đúng/sai (1 điểm / câu, 4 ý)
//   mcPoints: điểm mỗi câu nhiều lựa chọn (0,25 / 0,5 / 1)

function examCounts({ objectivePercent, mcPercent, mcPoints, essayCount }) {
  const objective = (10 * objectivePercent) / 100;
  let tf = mcPercent >= 100 ? 0 : Math.round((objective * (100 - mcPercent)) / 100);
  if (mcPercent <= 0) tf = Math.round(objective);
  const mc = mcPercent > 0 ? Math.round((objective - tf) / mcPoints) : 0;
  const essayPoints = Math.max(0, Math.round((10 - mc * mcPoints - tf) * 100) / 100);
  return { mc, tf, essay: essayPoints > 0 ? essayCount : 0, essayPoints };
}

module.exports = { examCounts };
