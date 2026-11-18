// B1 world coordinates (metres). Keep the approved building and furniture intact.
// Navigation follows the actual openings; stairs change levels under a paper fade.
function room(name, level, floor, floorY, pos, look, furniture, extra = {}) {
  return { name, level, floor, floorY, pos, look, furniture, fov: 50,
    above: [(floor[0] + floor[1]) / 2, floorY + 6.3, (floor[2] + floor[3]) / 2],
    walk: floor, doors: [], ...extra };
}
export const ROOMS = {
  courtyard: room('前天井', 0, [-1.8, 1.8, -2.97, -.24], .025, [.05, 1.55, -1.25], [.05, 1.55, -3.4], '前天井_courtyard'),
  hall: room('客堂', 0, [-1.8, 1.8, -7.8, -2.97], .1, [.2, 1.55, -3.45], [-.35, 1.15, -6.6], '客堂_furniture', { fov: 48 }),
  frontwing: room('前厢 · 老人房', 0, [1.98, 4.92, -5.16, -.24], .1, [2.5, 1.55, -4.25], [3.65, 1.25, -1.5], '前厢_furniture'),
  middlewing: room('中厢 · 读书缝纫间', 0, [1.98, 4.92, -10.14, -5.28], .1, [2.5, 1.55, -7.175], [4.2, 1.1, -6.4], '中厢_furniture'),
  stairwell: room('楼梯间 · 后井通路', 0, [-1.8, 1.8, -10.74, -7.8], .1, [-1.35, 1.55, -8.2], [-1.35, 1.45, -10.6], '楼梯间陈设_一楼', { walk: [-1.8, -.9, -10.74, -7.8] }),
  rearwell: room('后天井', 0, [-1.8, 1.8, -12.03, -10.74], .025, [-1.35, 1.55, -11.3], [1.3, 1.2, -11.35], '后天井_rear'),
  rearwing: room('后厢 · 杂物间', 0, [1.98, 4.92, -14.76, -10.26], .1, [3.2, 1.55, -12], [3.4, 1, -14.2], '后厢_furniture'),
  kitchen: room('厨房', 0, [-1.8, 1.8, -14.76, -12.03], .1, [.1, 1.55, -13.05], [-1.15, 1.1, -14.1], '已确认厨房_fixtures'),
  mezzanine: room('亭子平台与木桥', 1, [-1.8, -.9, -12.03, -8.5], 2.4, [-1.35, 3.85, -9.5], [-1.35, 3.75, -12.05], null),
  tingzi: room('亭子间', 1, [-1.8, 1.8, -14.76, -12.03], 2.4, [-.65, 3.85, -13], [.65, 3.4, -14.1], '亭子间_furniture'),
  landing: room('二楼楼梯间', 2, [.9, 1.8, -10.5, -6.36], 4, [1.35, 5.45, -9.6], [1.35, 5.3, -6.5], '楼梯间陈设_二楼'),
  lounge: room('二楼起居间', 2, [-1.8, 1.8, -6.36, -3.24], 4, [1.2, 5.45, -5.85], [-1, 4.8, -4.4], '起居间_furniture'),
  storage: room('衣被储藏间', 2, [-1.8, .84, -8.38, -6.42], 4, [.3, 5.45, -7.46], [-1.3, 4.9, -7.6], '储藏间_furniture'),
  marital: room('前厢二楼 · 婚房', 2, [1.98, 4.92, -5.16, -.24], 4, [2.5, 5.45, -4.225], [3.65, 4.8, -1.4], '婚房_furniture'),
  atticroom: room('阁梯间 · 衣物整理角', 2, [1.98, 4.92, -10.71, -5.28], 4, [3.65, 5.45, -9.95], [4.3, 4.9, -6.5], '阁梯间_furniture', {
    walkAreas: [[1.98, 4.92, -10.71, -9.36], [2.99, 4.92, -10.1, -5.28]],
  }),
  childroom: room('后厢二楼 · 孩子房', 2, [1.98, 4.92, -14.76, -10.71], 4, [4.085, 5.45, -11.25], [3.2, 4.9, -14.1], '孩子卧房_furniture'),
  terrace: room('晒台', 2, [-1.8, 1.8, -14.76, -12.03], 4.8, [-1.35, 6.25, -12.55], [.7, 5.5, -13.6], '晒台_furniture', {
    walkAreas: [[-1.8, 1.8, -14.76, -11.5], [-1.8, -.9, -12.1, -9.38], [-1.8, .15, -9.94, -8.5]],
  }),
  loft: room('局部储藏阁楼', 3, [-1.8, 4.92, -8.38, -5.4], 6.7, [2.45, 8.05, -6.2], [.3, 7.55, -6.5], '阁楼_furniture', {
    walkAreas: [[-1.8, 1.8, -8.38, -5.4], [1.25, 4.92, -6.8, -5.4], [2.99, 4.92, -8.38, -5.4]],
    blockers: [[1.78, 2.02, -8.38, -6.8], [1.78, 2.02, -6, -5.4]],
  }),
};

// side is the side of the opening facing this room; axis is its normal.
function frame(x, y, z, w = .85, h = 2.1, axis = 'z', side = 1) { return { c: [x, y, z], w, h, axis, side }; }
function connect(a, b, fa, { fb, fade = false, labelA, labelB, enterA, enterB } = {}) {
  fb ||= { ...fa, c: [...fa.c], side: -fa.side };
  const inside = (id, f) => {
    const p = [...f.c]; p[1] = ROOMS[id].pos[1]; p[f.axis === 'x' ? 0 : 2] += f.side * .48;
    return { pos: p, look: [p[0] + (f.axis === 'x' ? f.side * 2 : 0), p[1] - .1, p[2] + (f.axis === 'z' ? f.side * 2 : 0)] };
  };
  for (const [from, to, f, dest, label] of [[a, b, fa, fb, labelA], [b, a, fb, fa, labelB]]) {
    const entry = (to === a ? enterA : enterB) || inside(to, dest), approach = ((from === a ? enterA : enterB) || inside(from, f)).pos;
    ROOMS[from].doors.push({ to, frame: f, via: [approach[0], approach[2]], enter: entry, fade, label });
  }
}
connect('courtyard', 'hall', frame(0, 1.44, -2.97, 1.06, 2.54));
connect('hall', 'frontwing', frame(1.89, 1.175, -4.225, .85, 2.15, 'x', -1));
connect('hall', 'middlewing', frame(1.89, 1.175, -7.175, .85, 2.15, 'x', -1));
connect('hall', 'stairwell', frame(-1.35, 1.125, -7.8, .9, 2.05), { labelA: '后井通路 · 楼梯间' });
connect('hall', 'mezzanine', frame(1.35, 1.225, -7.8, .9, 2.25), {
  fb: frame(-.9, 3.45, -8.94, .85, 2.1, 'x', -1), fade: true,
  enterB: { pos: [-1.35, 3.85, -9.25], look: [-1.35, 3.75, -11.5] }, labelA: '上楼 · 亭子平台', labelB: '下楼 · 客堂',
});
connect('stairwell', 'rearwell', frame(-1.35, 1.15, -10.62, .9, 2.1));
connect('rearwell', 'rearwing', frame(1.89, 1.175, -11.3, .84, 2.15, 'x', -1), { enterB: { pos: [2.85, 1.55, -11.65], look: [3.3, 1.2, -13.8] } });
connect('rearwell', 'kitchen', frame(.66, 1.15, -12.03, .9, 2.1), { enterB: { pos: [.1, 1.55, -12.95], look: [-1.1, 1.1, -14.1] } });
connect('mezzanine', 'tingzi', frame(-1.35, 3.45, -12.03, .9, 2.1), { enterB: { pos: [-.65, 3.85, -12.9], look: [.65, 3.5, -14.1] } });
connect('mezzanine', 'landing', frame(-.9, 3.45, -10.06, .85, 2.1, 'x', -1), {
  fb: frame(.93, 5.05, -10.06, .85, 2.1, 'x', 1), fade: true,
  enterA: { pos: [-1.35, 3.85, -10.06], look: [-1.35, 3.7, -11.8] },
  enterB: { pos: [1.35, 5.45, -10.06], look: [1.35, 5.3, -7.3] }, labelA: '上楼 · 二楼', labelB: '下楼 · 亭子平台',
});
connect('landing', 'lounge', frame(1.35, 5.05, -6.36, .9, 2.1, 'z', -1));
connect('landing', 'storage', frame(.84, 5.05, -7.46, .82, 2.1, 'x', 1), { enterA: { pos: [1.35, 5.45, -7.46], look: [1.35, 5.2, -9.5] } });
connect('lounge', 'marital', frame(1.89, 5.05, -4.225, .85, 2.1, 'x', -1));
connect('landing', 'atticroom', frame(1.89, 5.05, -10.075, .85, 2.1, 'x', -1));
connect('atticroom', 'childroom', frame(4.085, 5.05, -10.71, .85, 2.1));
connect('landing', 'terrace', frame(.9, 5.05, -8.94, .85, 2.1, 'x', 1), {
  fb: frame(.15, 5.85, -8.94, .85, 2.1, 'x', -1), fade: true,
  enterA: { pos: [1.38, 5.45, -8.94], look: [1.35, 5.3, -7] },
  enterB: { pos: [-.35, 6.25, -8.94], look: [-1.35, 6.05, -10.2] }, labelA: '上短梯 · 晒台', labelB: '下短梯 · 二楼',
});
connect('atticroom', 'loft', frame(2.45, 5.05, -9.6, .82, 2.1, 'z', -1), {
  fb: frame(2.45, 7.75, -6.8, .82, 2.1), fade: true,
  enterA: { pos: [2.45, 5.45, -10.08], look: [4.2, 5.1, -8] },
  enterB: { pos: [2.45, 8.05, -6.32], look: [.5, 7.6, -6.6] }, labelA: '上阁梯 · 阁楼', labelB: '下阁梯 · 阁梯间',
});
