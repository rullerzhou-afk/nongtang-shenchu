// 前天井 · 负责人：曦宝
// 进门后站定的地方。没有小剧场，只引导进客堂；小竹椅可以坐。
export default {
  spot: { pos: [.05, 1.55, -1.25], look: [.05, 1.55, -3.4] },   // 进门站定，正对客堂落地长窗
  next: { to: 'hall', label: '进客堂' },
  sit: /小竹椅/,
  lookUp: 1.25,   // 露天：能抬头约 70°，望到天井上面那一方天
  // 站定后的引导：客堂那段戏没演完之前，光点落在客堂门上。第一次带一句字幕。
  cue: (h, { first }) => h.finished('hall') ? null : {
    label: h.started('hall') ? '回客堂' : '进客堂', sub: first ? '屋里好像没人……进去看看。' : null, delay: first ? 3000 : 1500,
    at: [0, 1.3, -2.97], run: () => h.go('hall'),
  },
};
