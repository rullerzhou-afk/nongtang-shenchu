// 一楼楼梯间 · 后井通路 · 负责人：曦宝
// 分镜：concepts/room-vignettes/楼梯间分镜.md（鹿鹿 2026-11-17 看过草案后说“可以”）。
// 从客堂北墙左门进来。看完脚踏车和旧报纸，点过道门口的光点直接去后天井。
// 不用阿婆的口吻。词条写法、读音、录音（W31–W32）、车铃声都是占位，等鹿鹿定。

export default {
  spot: { pos: [-1.35, 1.55, -8.15], look: [.5, 1.0, -9.7] },   // 跨进门，右手楼梯底下是脚踏车和旧报纸，正前方是通后天井的过道
  next: { to: 'hall', label: '回客堂' },
  cue: h => h.finished('stairwell') ? {
    label: '去后天井', sub: '过道走到底，就是后天井。', delay: 0,
    at: [-1.35, 1.3, -10.6], run: () => h.go('rearwell'),
  } : null,
  names: { 'STAIRWELL_BICYCLE': '脚踏车', 'L1_墙灯': '墙灯', '明线与开关_ground': '电灯开关', '生活连接_楼梯进线与一层分支': '电线',
    ...Object.fromEntries([1, 2, 3, 4, 5].map(i => ['STORAGE_CRATE_0' + i, '木箱'])),
    ...Object.fromEntries(Array.from({ length: 19 }, (_, i) => ['STORAGE_PAPER_' + String(i + 1).padStart(2, '0'), '旧报纸'])) },
  story: {
    beats: [
      // 脚踏车：走到车跟前看。点一下，车铃响（声音 audio/bell.m4a 还没有）；车不动
      { id: 'bike', audio: 'W31', label: '脚踏车', sub: '楼梯底下停着一部凤凰。', target: 'STAIRWELL_BICYCLE', markAt: [.25, .95, -10.0],
        pose: { pos: [-.35, 1.45, -8.85], look: [.3, .7, -10.05] },
        act: (h, d, done) => { h.sound('bell', { volume: .6 }); h.wait(1500, done); },
        card: { hu: '脚踏车', zh: '自行车', note: '凤凰牌，二八大杠。上班、买小菜、接小囡，后头个架子上还好带人。' }, collect: ['turn', 0] },
      // 旧报纸：楼梯底下一捆一捆扎好的报纸和木箱，凑近看
      { id: 'papers', audio: 'W32', label: '旧报纸', sub: '旧报纸一捆一捆扎好，舍不得掼脱。', target: 'STORAGE_PAPER_07', markAt: [.47, 1.25, -9.15],
        pose: { pos: [-.5, 1.4, -8.55], look: [.5, .85, -9.0] },
        act: (h, d, done) => h.wait(1400, done),
        card: { hu: '申报', zh: '报纸', note: '老上海人管报纸叫申报。看过了不扔掉，扎好了卖给收废品的，或者留着包东西。' } },
    ],
    outro: { after: 600, exit: { label: '回客堂', to: 'hall' } },
  },
};
