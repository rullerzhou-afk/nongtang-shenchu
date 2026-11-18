// 二楼小客厅（起居间）· 负责人：云宝。
// 现物/位置核对：checks/lounge-vignette-20261117/物件核实.json。
// 开书橱 → 钩花巾 → 坐沙发 → 看栀子花 → 收起词卡后望南窗，再看向婚房门。
// LG01–LG04 为独立录音占位编号，写法、读音和录音仍待鹿鹿定。
const DOORS = ['书柜_upper_left_独立门轴', '书柜_upper_right_独立门轴'];
const FLOWERS = [-.33, 4.77, -4.59];
const SOUTH_WINDOW = [.3, 5.55, -2.3];
const NEXT_DOOR = [1.78, 5.285, -4.225];
function restoreDoors(d) { for (const x of d.doors || []) x.o.quaternion.copy(x.home); }
export default {
  spot: { pos: [1.2, 5.45, -5.85], look: [-.72, 4.95, -4.85] },
  next: { to: 'marital', label: '去隔壁' },
  sit: /西侧双人木沙发|北侧单人木扶手椅/, sitGuides: false,
  cue(h) {
    if (!h.finished('lounge')) return null;
    return {
      label: '去隔壁', sub: '门帘后面还有一间屋。', screenCenter: true,
      seated: true, delay: 800, at: NEXT_DOOR, run: () => h.go('marital'),
    };
  },
  names: {
    '北侧浅木书柜': '书橱', '北侧单人木扶手椅': '扶手椅', '西侧双人木沙发': '木沙发',
    '双层木茶几': '茶几', '搪瓷杯_1': '搪瓷杯', '搪瓷杯_2': '搪瓷杯', '棕红暖水瓶': '热水瓶',
    '双人沙发_钩花靠背巾': '钩花巾', '扶手椅_钩花靠背巾': '钩花巾', '茶几_钩花台布': '钩花台布',
    '茶几_素青瓷瓶与三枝白栀子': '栀子花', '茶几下旧画报_1': '旧画报', '茶几下旧画报_2': '旧画报', '茶几下旧画报_3': '旧画报',
    '墙上挂贴_起居间西墙时装挂历': '挂历', '屋内灯具_起居间三头吊灯': '吊灯',
    '屋内帘子_起居间四扇窗两层帘': '窗帘', '屋内帘子_起居间进婚房门帘': '门帘',
  },
  story: {
    setup(h, d) {
      const cabinet = h.find('北侧浅木书柜');
      d.doors = DOORS.map(name => cabinet?.getObjectByName(name)).filter(Boolean).map(o => ({ o, home: o.quaternion.clone(), sign: o.userData.openingSign }));
      d.opened = false; d.active = false; d.epoch = 0;
    },
    // 中途从全屋返回时，把被暂停的开门动画复位到这一拍已经完成的状态。
    resume(h, d) {
      d.active = true; d.epoch++;
      const q = new h.THREE.Quaternion(), axis = new h.THREE.Vector3(0, 1, 0);
      for (const x of d.doors || []) x.o.quaternion.copy(x.home).multiply(q.setFromAxisAngle(axis, d.opened ? x.sign * Math.PI / 2 : 0));
    },
    suspend(h, d) { this.resume(h, d); d.active = false; d.epoch++; },
    dispose(h, d) { d.active = false; d.epoch++; restoreDoors(d); },
    beats: [
      { id: 'books', audio: 'LG01', label: '开书橱', sub: '玻璃门后面，收着家里的旧书。', target: '北侧浅木书柜',
        markAt: [-1.30, 4.99, -5.92], pose: { pos: [-1.16, 5.10, -5.08], look: [-1.42, 4.79, -6.02] },
        act(h, d, done) {
          const q = new h.THREE.Quaternion(), axis = new h.THREE.Vector3(0, 1, 0);
          const epoch = d.epoch;
          h.tween(1350, k => { if (!d.active || d.epoch !== epoch) return; const e = k * k * (3 - 2 * k); for (const x of d.doors) x.o.quaternion.copy(x.home).multiply(q.setFromAxisAngle(axis, x.sign * Math.PI / 2 * e)); }, () => { if (!d.active || d.epoch !== epoch) return; d.opened = true; h.wait(1000, done); });
        },
        card: { hu: '书橱', zh: '书柜', note: '“阿婆，上次这本《故事会》呢？”“就在书橱里，侬自家看看。”' } },
      { id: 'lace', audio: 'LG02', label: '钩花巾', sub: '木沙发的靠背上，搭着白色的钩花巾。', target: '双人沙发_钩花靠背巾',
        markAt: [-1.53, 4.81, -4.43], pose: { pos: [-.75, 5.18, -3.63], look: [-1.54, 4.76, -4.45] },
        act: (h, d, done) => h.wait(1000, done),
        card: { hu: '钩花巾', zh: '钩花靠背巾', note: '脏了可以拿下来洗洗，晒干了再搭回去。' } },
      { id: 'sit', audio: 'LG03', label: '坐一坐', sub: '茶几旁边，空着一个座位。', target: '西侧双人木沙发',
        markAt: [-1.22, 4.61, -4.62],
        sit: { at: [-1.34, -4.67], facing: [1, 0, 0], seatY: 4.44, eye: 5.14, lean: false },
        card: { hu: '沙发', zh: '木扶手沙发', note: '沙发还有个位置，我们可以一道看书。' } },
      { id: 'flowers', audio: 'LG04', label: '看看花', sub: '茶几上插着三枝白栀子。', target: '茶几_素青瓷瓶与三枝白栀子', markAt: FLOWERS,
        // 用转头保持坐姿，不另设 pose；收尾不用起身，也不会退到沙发后面。
        act: (h, d, done) => h.gaze(FLOWERS, { go: 700, hold: 1300 }, done),
        card: { hu: '栀子花', zh: '栀子花', note: '弄堂里有人喊“栀子花，白兰花！”买几枝回来，屋里向都是香味道。' } },
    ],
    outro: {
      after: 1200,
      act(h, d, done) {
        h.gaze(SOUTH_WINDOW, { go: 1100, hold: 2200 },
          () => h.gaze(NEXT_DOOR, { go: 1100, hold: 600 }, done));
      },
    },
  },
};
