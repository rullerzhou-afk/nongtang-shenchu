// 客堂 · 负责人：曦宝
// 分镜：concepts/hall-vignette-v1/客堂分镜.md。七拍都做了：进门引导 → 挂衣裳 → 阿婆的字条 → 开茶叶橱 → 泡茶 → 开电视 → 坐下。
// 词条的沪语写法、字条后三句、录音都是占位，等鹿鹿定。
// 字条用手写的图（生图做的，蓝色圆珠笔写在横格便笺上）；原图和提示词在 concepts/hall-vignette-v1/note/
const NOTE_IMG = new URL('../art/apo-note.jpg', import.meta.url).href;
import { addBreakfast, removeBreakfast } from './hall-breakfast.js';   // 八仙桌上的早饭“四大金刚”
import { addTea, removeTea, openCabinet, pourTea, cupToTable, sipTea } from './hall-tea.js';   // 泡茶：移门、茶叶、热水瓶、热气

export default {
  spot: { pos: [.2, 1.55, -3.45], look: [-.35, 1.15, -6.6] },   // 跨进客堂，八仙桌在正中
  next: { to: 'courtyard', label: '回天井' },
  sit: /木椅/,
  // 客堂的戏演完以后，不用先起身：坐着就出引导，点了直接起身去东墙门帘后面的阿婆房间（去过了就不再引）
  // 鹿鹿 2026-11-17：原来要等字幕、起身、再等引导，太拖沓。坐着吃茶的时候就提示“还没回来”，然后去阿婆房间看看
  cue: h => !h.finished('hall') ? null
    : !h.started('frontwing') ? { label: '去阿婆房间看看', sub: '阿婆还没回来。去她房间里看看。', delay: 600, seated: true, at: [1.9, 1.3, -4.1], run: () => h.go('frontwing') }
    : h.finished('frontwing') && !h.started('middlewing') ? { label: '去隔壁看看', sub: '冰箱旁边还有一扇门。', delay: 1500, at: [1.9, 1.3, -7.175], run: () => h.go('middlewing') }   // 老人房看完回到客堂，再引向中厢
    : h.finished('middlewing') && !h.started('stairwell') ? { label: '楼梯间', sub: '左手这扇门后面是楼梯间。', delay: 1500, at: [-1.35, 1.3, -7.8], lookAt: [0, 1.25, -7.8], run: () => h.go('stairwell') }
    : null,
  doors: [
    { label: '上楼去亭子间', at: [1.35, 1.3, -7.8], to: 'mezzanine', when: h => h.finished('middlewing'), alongsideCue: true },
  ],
  story: {
    // 第一次进屋时摆好：外套先藏起来（点了才挂上）；桌上放一张字条
    setup(h, d) {
      d.coat = h.find('挂钩木盒下_薄外套'); if (d.coat) d.coat.visible = false;
      const T = h.THREE, tex = new T.TextureLoader().load(NOTE_IMG); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
      d.note = new T.Mesh(new T.PlaneGeometry(.13, .195), new T.MeshStandardMaterial({ map: tex, roughness: .9, metalness: 0 }));
      d.note.name = '阿婆的字条'; d.note.rotation.set(-Math.PI / 2, 0, .22); d.note.position.set(-.5, .906, -5.03); d.note.renderOrder = 1; h.scene.add(d.note);
      addBreakfast(h, d);   // 果盘拿开，换成四样早点
      addTea(h, d);         // 玻璃橱右扇移门能滑开；茶杯里的茶叶、茶水、热气；热水瓶能倾斜
    },
    // 离开游戏时还原
    dispose(h, d) {
      if (d.coat) d.coat.visible = true; h.tv('hallTv', false); removeBreakfast(h, d); removeTea(h, d);
      if (d.note) { h.scene.remove(d.note); d.note.geometry.dispose(); d.note.material.map.dispose(); d.note.material.dispose(); }
    },
    tasksTitle: '阿婆的字条', tasksAfter: 'note',   // 看过字条后，右上角出任务单
    tasks: ['泡杯茶吃吃', '电视开开看', '坐下来等我'],
    beats: [
      { id: 'coat', audio: 'W1', label: '挂衣裳', sub: '进门先把外套挂起来。', target: '客堂西墙_衣帽挂钩木盒',
        pose: { pos: [-.66, 1.55, -3.99], look: [-1.7, 1.3, -3.99] },
        act: (h, d, done) => { if (!d.coat) return done(); d.coat.visible = true; h.sound('cloth'); h.drop(d.coat, done); },   // 外套落到钩子上，轻轻顿两下
        card: { hu: '衣裳', zh: '衣服', note: '进门第一桩事体，外套挂挂好。' } },
      { id: 'note', label: '阿婆留的字条', sub: '桌上压着一张字条。', target: (h, d) => d.note,
        pose: { pos: [-.3, 1.55, -4.4], look: [-.5, .9, -5.03] },
        read: { img: NOTE_IMG, alt: '阿婆留的字条：我去买小菜了，侬自家看看。泡杯茶吃吃，电视开开看，坐下来等我。阿婆' } },   // 字条后三句仍是占位，等鹿鹿定（不写在画面上）
      // 茶叶罐在玻璃橱上层靠右。蹲下一点，视线降到那一层；右扇移门滑开
      { id: 'cabinet', audio: 'W4', label: '开茶叶橱', sub: '泡杯茶吃吃。', who: '阿婆', taskOf: 0, target: '客堂玻璃橱', markAt: [-.1, 1.06, -7.3],
        pose: { pos: [-.12, 1.2, -6.5], look: [-.12, 1.03, -7.46] },
        act: (h, d, done) => { h.sound('slide'); openCabinet(h, d, done); },
        card: { hu: '茶叶', zh: '茶叶', note: '茶叶罐收勒玻璃橱里向，移门一推就能够拿得了。' }, collect: ['seven', 6] },
      // 不演拿茶叶：杯里已经有一小撮。点热水瓶或茶杯，热水瓶自己抬起来倒
      { id: 'tea', audio: 'W5', label: '倒开水', sub: '热水瓶在电视机旁边。', task: 0, target: '竹壳热水瓶', also: ['茶杯_1_转轴'],
        pose: { pos: [.66, 1.3, -6.02], look: [1.47, .84, -6.2] },
        act: pourTea,
        card: { hu: '热水瓶', zh: '暖水瓶', note: '竹头壳子个热水瓶，早上灌开水，夜里还是热的。' } },
      { id: 'tv', audio: 'W2', label: '开电视', sub: '电视开开看。', who: '阿婆', task: 1, target: '显像管电视',
        pose: { pos: [.5, 1.55, -5.63], look: [1.5, .98, -5.63] },
        act: (h, d, done) => { h.sound('tvon'); h.tv('hallTv', true); h.wait(1500, done); },
        card: { hu: '电视机', zh: '电视机', note: '显像管电视机，开机要等慢慢亮起来。' } },
      // 条凳没有靠背：朝向直接指定为面朝东（对着电视），不往后靠。条凳被八仙桌挡住，光点另指到凳子上方
      { id: 'sit', audio: 'W3', label: '坐到这里', sub: '坐下来等我。', who: '阿婆', task: 2, target: '客堂条凳_西', markAt: [-1.375, 1.02, -5.63],
        enter: (h, d) => cupToTable(h, d),   // 坐下的同时，泡好的那杯茶已经在面前
        then: (h, d, done) => { h.wait(2000, () => h.sound('sip')); sipTea(h, d, done); },   // 坐定后低头吃一口茶（鹿鹿 11-17：坐着很难转到看见茶，干脆做成低头喝茶）
        sit: { at: [-1.375, -5.63], facing: [1, 0, 0], seatY: .55, eye: 1.25, lean: false },
        card: { hu: '吃茶', zh: '喝茶', note: '上海话里向，茶是要“吃”的。比如，吃茶，吃香烟，吃老酒。' } },   // 原来这张是“八仙桌”，挪到支线物件里再做
      // 鹿鹿 2026-11-18：喝完茶以后介绍四大金刚。人还坐在条凳上，不站起来：低头看桌上四样早点，出一张词卡。词条写法、读音、录音（W6）是占位，等鹿鹿定
      { id: 'four', audio: 'W6', label: '四大金刚', sub: '桌上四样早点，还热着。', target: (h, d) => d.breakfast, markAt: [-.78, .96, -5.39],
        act: (h, d, done) => { h.gaze([-.78, .92, -5.39], { go: 900, hold: 2200 }); h.wait(2400, done); },
        card: { hu: '四大金刚', zh: '大饼、油条、粢饭、豆浆', note: '上海人的早饭，大饼、油条、粢饭、豆浆。' } },
    ],
    // 演完：不做“阿婆回来”（鹿鹿 2026-11-17：阿婆不是导游）。出一句字幕，屋子交还给玩家
    outro: { after: 1200 },
  },
};
