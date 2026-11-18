// 厨房（灶披间）· 负责人：曦宝
// 分镜：concepts/room-vignettes/厨房分镜.md。鹿鹿 2026-11-17 看过草案后补充：“还要带上钥匙/门（后门），最后才是小馄饨”。
// 从后天井进门，顺时针一圈：自来火点煤气 → 油盐酱醋 → 水斗 → 钥匙和后门 → 米缸 → 坐下看包了一半的馄饨。
// 鹿鹿 2026-11-18：水斗之后紧接着是旁边的钥匙和后门；米缸在东边，挪到后门之后、坐下看馄饨之前，不再来回横穿屋子。
// 鹿鹿 2026-11-18：后门默认关着（见 extra-backdoor.js），在厨房里点那扇门才打开。
// 这间屋把收集册“开门七件事”里的柴、米、油、盐、酱、醋收齐（茶在客堂）。
// 不用阿婆的口吻。词条写法、读音、录音（W51–W56）、各样声音都是占位，等鹿鹿定。没有改房子模型。

import { DOOR, shut, opened } from './extra-backdoor.js';
const localDelta = (T, parent, dx, dy, dz) => { parent.updateWorldMatrix(true, false); const a = parent.worldToLocal(new T.Vector3(0, 0, 0)); return parent.worldToLocal(new T.Vector3(dx, dy, dz)).sub(a); };
// 一块看不见的板，给不在陈设组里的东西（窗台上的钥匙）当可以点的目标
const mark = (h, name, w, hh, at) => { const T = h.THREE, m = new T.Mesh(new T.PlaneGeometry(w, hh), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.name = name; m.position.fromArray(at); h.scene.add(m); return m; };

export default {
  spot: { pos: [-.02, 1.55, -12.6], look: [-1.2, 1.0, -13.5] },   // 跨进门再往里一步，左手西墙是灶台，正前方北墙是水斗和后门。进来的那扇门朝屋里开着，门扇占 x 0.19–0.42、z -12.93–-12.04，原先站在 x 0.3 正好站进门扇里，镜头被挡（鹿鹿 11-18）
  next: { to: 'rearwell', label: '回后天井' },
  sit: /竹板凳/,
  names: { 'ST01_灶台与备菜长台': '灶台', 'ST02_完整双眼煤气灶': '煤气灶', 'UT01_炒锅': '镬子', 'UT02_带盖水壶': '铜吊', 'UT03_砧板': '砧墩板', 'UT04_菜刀': '菜刀', 'UT05_搪瓷碗': '搪瓷碗', 'UT06_红塑料盆': '脚盆',
    'W01_壁式水龙头': '水龙头', 'W02_水磨石盆体': '水斗', 'W03_右支脚': '水斗', 'W03_左支脚': '水斗', 'W04_金属下水口': '水斗', 'W05_落水管': '落水管', 'CABINET': '碗橱',
    '米缸_独立三拼木盖': '米缸盖', '酱褐釉米缸_缸体与米': '米缸', '竹器_厨房小方台旁竹板凳': '竹板凳', '开小灶_厨房小方台': '小方台', '开小灶_台上_搪瓷碗与筷子': '肉馅', '开小灶_台上_面板与馄饨': '馄饨', '开小灶_台上_馄饨皮': '馄饨皮',
    '厨房生活物件_中华牙膏': '牙膏', '厨房生活物件_天鱼玫瑰米醋': '醋', '厨房生活物件_海狮食用油': '油', '厨房生活物件_海鸥酱油': '酱油', '厨房生活物件_盐罐': '盐', '厨房生活物件_糖罐': '糖',
    '厨房洗漱物件_杯内牙刷_1': '牙刷', '厨房洗漱物件_杯内牙刷_2': '牙刷', '厨房洗漱物件_洗漱搪瓷杯_1': '牙刷杯', '厨房洗漱物件_洗漱搪瓷杯_2': '牙刷杯', '厨房备菜台_折好的洗碗布': '揩布', '厨房水斗左台沿_肥皂盒与肥皂': '肥皂',
    '屋内灯具_厨房贴顶灯': '电灯', '屋内帘子_厨房后弄窗蓝白格短半帘': '窗帘', '火柴盒（自来火）': '自来火', '生活连接_煤气灶墙阀与软管': '煤气开关', '生活连接_厨房明线与开关': '电灯开关' },
  story: {
    setup(h, d) {
      const T = h.THREE;
      // 煤气灶：两只灶眼上都搁着东西，火圈几乎看不见。点着以后，北边那只灶眼上的水壶嘴慢慢冒热气，壶底露一点蓝光
      const kettle = h.find('UT02_带盖水壶');
      if (kettle) { const kb = new T.Box3().setFromObject(kettle), c = kb.getCenter(new T.Vector3());
        const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d'), grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = grad; sg.fillRect(0, 0, 64, 64);
        const tex = new T.CanvasTexture(sc); d.fx = new T.Group(); d.fx.name = '厨房_火和热气'; h.scene.add(d.fx);
        d.steam = [0, 1, 2].map(() => { const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; d.fx.add(sp); return sp; });
        d.flame = new T.Mesh(new T.TorusGeometry((kb.max.z - kb.min.z) / 2 * .78, .006, 6, 36), new T.MeshBasicMaterial({ color: 0x4f8dff, transparent: true, opacity: 0, depthWrite: false })); d.flame.rotation.x = Math.PI / 2; d.flame.position.set(c.x, kb.min.y - .006, c.z); d.fx.add(d.flame);
        d.kettleTop = new T.Vector3(c.x + (kb.max.x - kb.min.x) * .3, kb.max.y - .05, c.z); d.fire = false;
        d.stopFire = h.loop(now => { if (!d.fire) return; d.flame.material.opacity = .55 + .2 * Math.sin(now / 90); d.steam.forEach((sp, i) => { const k = ((now / 2800) + i / 3) % 1; sp.visible = true; sp.position.set(d.kettleTop.x + Math.sin(now / 900 + i * 2) * .012, d.kettleTop.y + .02 + k * .2, d.kettleTop.z + Math.cos(now / 1100 + i) * .01); const w = .03 + k * .07; sp.scale.set(w, w * 1.5, 1); sp.material.opacity = d.steamGain * .4 * Math.sin(k * Math.PI); }); });
      }
      // 水龙头：一道水流进水斗
      const tap = h.find('W01_壁式水龙头');
      if (tap) { const tb = new T.Box3().setFromObject(tap), top = tb.min.y + .01, bottom = .7;
        d.water = new T.Mesh(new T.CylinderGeometry(.0045, .006, 1, 10), new T.MeshBasicMaterial({ color: 0xe4f1f6, transparent: true, opacity: .6, depthWrite: false }));
        d.water.name = '水龙头_水流'; d.water.visible = false; d.waterTop = top; d.waterLen = top - bottom; d.water.position.set((tb.min.x + tb.max.x) / 2, top, tb.max.z - .012); h.scene.add(d.water); }
      // 米缸盖：独立零件，挪开半边
      d.lid = h.find('米缸_独立三拼木盖'); if (d.lid) { d.lidHome = d.lid.position.clone(); d.lidMove = localDelta(T, d.lid.parent, -.13, 0, 0); d.lidUp = localDelta(T, d.lid.parent, 0, .03, 0); }   /* 往西挪开小半边，还搭在缸沿上。试过整个挪到南边，会和竹板凳穿在一起 */
      // 后门：默认关着（转角 0）；点了以后转到模型原来的开度（1.5）
      d.door = h.find(DOOR); d.doorOpen = shut(d.door);
      d.keys = mark(h, '窗台上的一串钥匙', .34, .22, [-.83, 1.2, -14.82]);
    },
    dispose(h, d) {
      d.stopFire?.(); d.stopTap?.(); if (d.fx) h.scene.remove(d.fx); if (d.water) h.scene.remove(d.water); if (d.keys) h.scene.remove(d.keys);
      if (d.lid) d.lid.position.copy(d.lidHome); shut(d.door);
    },
    beats: [
      // 自来火：点一下，煤气灶点着。声音 audio/stove.m4a 还没有
      { id: 'match', audio: 'W51', label: '点自来火', sub: '灶头旁边一盒自来火。', target: '火柴盒（自来火）', also: ['ST02_完整双眼煤气灶'],
        pose: { pos: [-.45, 1.3, -12.75], look: [-1.42, .92, -12.85] },
        act: (h, d, done) => { h.sound('stove', { volume: .5 }); d.fire = true; d.steamGain = 0; h.tween(2600, k => { d.steamGain = k; }, done); },
        card: { hu: '自来火', zh: '火柴', note: '上海人管火柴叫自来火，放在厨房点煤气用的。' }, collect: ['seven', 0] },
      // 油盐酱醋：灶台靠墙一排
      { id: 'sauces', audio: 'W52', label: '油盐酱醋', sub: '油盐酱醋，一样不缺。', target: '厨房生活物件_海鸥酱油', also: ['厨房生活物件_海狮食用油', '厨房生活物件_天鱼玫瑰米醋', '厨房生活物件_盐罐', '厨房生活物件_糖罐'], markAt: [-1.66, 1.06, -13.52],
        pose: { pos: [-.6, 1.35, -13.6], look: [-1.66, .88, -13.62] },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '油盐酱醋', zh: '油盐酱醋', note: '海狮牌油，海鸥牌酱油，天鱼牌玫瑰米醋。开门七桩事体，这里占了四样。' }, collect: [['seven', 2], ['seven', 3], ['seven', 4], ['seven', 5]] },
      // 水斗：水龙头开一下，水流进水斗，再关上。声音 audio/tap.m4a 还没有
      { id: 'sink', audio: 'W53', label: '开水龙头', sub: '水斗台沿上摆着牙刷牙膏。', target: 'W02_水磨石盆体', also: ['W01_壁式水龙头'], markAt: [-1.32, 1.02, -14.66],
        pose: { pos: [-.95, 1.48, -13.5], look: [-1.25, .86, -14.5] },
        act: (h, d, done) => { if (!d.water) return h.wait(1200, done); d.stopTap = h.sound('tap', { volume: .5 });
          h.tween(2600, k => { const on = k < .85, grow = Math.min(1, k / .08), len = d.waterLen * grow; d.water.visible = on; d.water.scale.set(1, len, 1); d.water.position.y = d.waterTop - len / 2; d.water.material.opacity = .5 + .12 * Math.sin(k * 80); }, () => { d.water.visible = false; d.stopTap?.(); h.wait(300, done); }); },
        card: { hu: '水斗', zh: '水池', note: '上海人汏菜在这里，早上刷牙齿、揩面也在这里。' } },
      // 钥匙和后门：窗台上一串钥匙；点后门（点钥匙也行），关着的后门打开，看得见后弄堂
      { id: 'backdoor', audio: 'W55', label: '开后门', sub: '窗台上一串钥匙，后门通后弄堂。', target: (h, d) => d.door || d.keys, also: ['窗台上的一串钥匙'],
        pose: { pos: [-.15, 1.5, -13.45], look: [-.25, 1.15, -14.9] },
        act: (h, d, done) => { if (!d.door) return h.wait(1200, done); h.sound('door', { volume: .5 });
          h.tween(1600, k => { const e = k * k * (3 - 2 * k); d.door.rotation.y = d.doorOpen * e; }, () => { opened(d.door); h.wait(900, done); }); },   // 门扇自己的转角：0 是关着，1.5 是开着
        // 词卡收起以后门自己关回去（鹿鹿 11-18）：不然后面看米缸时，开着的门扇黑黑一块挡在画面左边
        after: (h, d) => { if (!d.door) return; const from = d.door.rotation.y; h.tween(1200, k => { const e = k * k * (3 - 2 * k); d.door.rotation.y = from * (1 - e); }, () => shut(d.door)); },
        card: { hu: '后门', zh: '后门', note: '石库门人家一般走后门，从灶披间进进出出。前头这扇门，难得开一趟。' } },
      // 米缸：木盖挪开半边，露出里面的米
      { id: 'rice', audio: 'W54', label: '开米缸', sub: '墙角一只米缸。', target: '酱褐釉米缸_缸体与米', also: ['米缸_独立三拼木盖'], markAt: [1.05, .52, -13.45],
        pose: { pos: [.42, 1.42, -13.15], look: [1.05, .34, -13.47] },
        act: (h, d, done) => { if (!d.lid) return done(); h.tween(1400, k => { const e = k * k * (3 - 2 * k); d.lid.position.copy(d.lidHome).addScaledVector(d.lidMove, e).addScaledVector(d.lidUp, Math.sin(e * Math.PI)); }, () => h.wait(700, done)); },
        card: { hu: '米缸', zh: '米缸', note: '米买回来倒在里头，量米用一根竹筒。' }, collect: ['seven', 1] },
      // 馄饨：坐到竹板凳上，看小方台上包了一半的馄饨
      { id: 'wonton', audio: 'W56', label: '坐一坐', sub: '小方台上的馄饨包了一半。', target: '竹器_厨房小方台旁竹板凳',
        sit: { at: [1.11, -12.97], facing: [.58, 0, .82], seatY: .53, eye: 1.13, lean: false },
        then: (h, d, done) => h.gaze([1.5, .84, -12.42], { go: 800, hold: 1800 }, done),
        card: { hu: '馄饨', zh: '馄饨', note: '皮子、肉馅摆摆好，一只一只包。大个馄饨当饭吃，小个馄饨当点心。' } },
    ],
    outro: { after: 1500, sub: '馄饨还没包好，人不晓得到啥地方去了。', exit: [{ label: '回后天井', to: 'rearwell' }, { label: '回客堂', to: 'hall' }] }   /* 鹿鹿 11-18：演完也可以直接回客堂 */,
  },
};
