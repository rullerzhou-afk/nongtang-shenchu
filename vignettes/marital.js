// 二楼婚房 · 负责人：云宝。现物核对见 checks/marital-vignette-20261117/物件核实.json。
// 小电视与全家福 → 开衣柜 → 单件红西装 → 梳妆台全景 → 痰盂花纹 → 转看婚纱照，原地收尾。
import { outfitDetail } from './marital-detail.js?v=11';
// MB01、05、06、07、11、12 仅为录音占位，词条与沪语录音待鹿鹿定。
const HINGES = ['大衣柜西门_门轴', '大衣柜东门_门轴'];
const PORTRAIT = [2.02, 5.72, -3.02];
function restoreClothes(d) { d.detail?.hide(); }
function setDoors(h, d, angle) {
  const q = new h.THREE.Quaternion(), axis = new h.THREE.Vector3(0, 1, 0);
  for (const x of d.doors || []) x.o.quaternion.copy(x.home).multiply(q.setFromAxisAngle(axis, x.sign * angle));
}
function moveDoors(h, d, open, done) {
  const epoch = d.epoch, from = d.opened ? Math.PI / 2 : 0, to = open ? Math.PI / 2 : 0;
  h.tween(1300, k => {
    if (d.active && d.epoch === epoch) setDoors(h, d, from + (to - from) * k * k * (3 - 2 * k));
  }, () => { if (d.active && d.epoch === epoch) { d.opened = open; h.wait(900, done); } });
}
export default {
  spot: { pos: [2.52, 5.45, -4.15], look: [3.38, 4.88, -4.91] },
  sit: /梳妆小方凳/, sitGuides: false,
  names: {
    'ML04': '梳子', '婚房组合柜摆设': '闹钟', '婚房转角组合柜': '组合柜', '婚房大衣柜里的衣服': '衣裳', '梳妆小方凳': '方凳',
    '友谊雪花膏_白瓷绿盖': '雪花膏', '六神花露水_细颈玻璃瓶': '花露水',
    '美加净护手霜_老款软管': '护手霜', '上海牌手表_旧棕皮带': '手表',
    '婚房_杏色荷叶边床罩': '床罩', '婚房成套双人床': '双人床', '婚房成套床头柜': '床头柜',
    '西墙竖版婚纱照': '婚纱照', '床西侧布拖鞋': '布拖鞋', '楼上起居间小电视': '小电视', '合影小镜框': '全家福',
    '屋内灯具_婚房床头台灯': '台灯', '屋内灯具_婚房碗形吊灯': '吊灯',
    '生活器具_marital': '痰盂',
    '婚房_缎面方垫_pink': '缎面靠垫', '婚房_缎面方垫_red': '缎面靠垫',
  },
  props: [
    { target: '六神花露水_细颈玻璃瓶', audio: 'MB13', card: { hu: '花露水', note: '夏天蚊子多，要用点花露水。' } },
    { target: '上海牌手表_旧棕皮带', audio: 'MB14', card: { hu: '手表', note: '老早讲究“三转一响”。脚踏车、洋机、手表都会得转个，响是收音机。这块上海牌手表就占了一样。' } },
    { target: '床西侧布拖鞋', audio: 'MB15', card: { hu: '拖鞋', note: '布拖鞋放在床边。半夜里爬起来，就往里一套，省得找鞋子了。' } },
  ],
  story: {
    setup(h, d) {
      const cabinet = h.find('婚房转角组合柜');
      d.doors = HINGES.map(n => cabinet?.getObjectByName(n)).filter(Boolean)
        .map(o => ({ o, home: o.quaternion.clone(), sign: o.userData.openingSign }));
      d.active = false; d.epoch = 0; d.opened = false;
      const clothes = h.find('婚房大衣柜里的衣服');
      d.detail = outfitDetail(h, clothes?.getObjectByName('婚房_大红女西装'));
    },
    resume(h, d) { d.active = true; d.epoch++; restoreClothes(d); setDoors(h, d, d.opened ? Math.PI / 2 : 0); },
    suspend(h, d) { d.active = false; d.epoch++; restoreClothes(d); setDoors(h, d, d.opened ? Math.PI / 2 : 0); },
    dispose(h, d) { d.active = false; d.epoch++; restoreClothes(d); setDoors(h, d, 0); d.detail?.dispose(); },
    beats: [
      { id: 'tvphoto', audio: 'MB12', label: '看全家福', sub: '小电视旁边，摆着一家三口的照片。', target: '合影小镜框',
        markAt: [3.62, 4.79, -4.91], pose: { pos: [2.94, 5.12, -3.92], look: [3.24, 4.87, -4.91] },
        act: (h, d, done) => h.wait(1700, done),
        card: { hu: '全家福', zh: '全家福', note: '小囡坐在当中，爸爸妈妈坐两边。' } },
      { id: 'wardrobe', audio: 'MB01', label: '开大橱', sub: '出门做客穿的衣裳，都挂在这只大橱里。', target: (h, d) => d.doors[0]?.o,
        markAt: [4.36, 5.35, -4.53], guideFrom: [4.08, 5.44, -3.40], pose: { pos: [4.42, 5.36, -3.88], look: [4.43, 5.35, -4.83] },
        act: (h, d, done) => moveDoors(h, d, true, done),
        card: { hu: '大橱', zh: '大衣柜', note: '老早上海宁办喜事，讲究“四十八只脚”。数的是房间里相个家具，橱子、台子、凳子的脚。' } },
      { id: 'clothes', audio: 'MB06', label: '看看红西装', sub: '一排衣裳挂在一起，数这件红西装最抢眼。', target: h => h.find('婚房_大红女西装'),
        markAt: [4.65, 5.26, -4.65], pose: { pos: [4.43, 5.25, -3.80], look: [4.43, 5.23, -4.84] },
        act(h, d, done) {
          const epoch = d.epoch; h.wait(250, () => { if (d.active && d.epoch === epoch) d.detail?.show(); }); h.say('红西装', null, 0);
          h.wait(1200, () => { if (!d.active || d.epoch !== epoch) return; done(); });
        },
        card: { hu: '西装', zh: '女式西装', note: '穿这件西装到弄堂口子里去，是在是很扎台型。' } },
      { id: 'dresser', audio: 'MB11', label: '看梳妆台', sub: '镜子前面，梳子和雪花膏都在手边。', target: '婚房梳妆台面玻璃板',
        markAt: [4.62, 4.78, -3.64], guideFrom: [3.76, 5.36, -3.90], pose: { pos: [3.87, 5.30, -3.96], look: [4.64, 4.81, -3.77] },
        act: (h, d, done) => moveDoors(h, d, false, done), collect: ['turn', 2],
        card: { hu: '梳妆台', zh: '梳妆台', note: '早晨头洗好脸，用点雪花膏。' } },
      { id: 'chamberpot', audio: 'MB07', label: '看痰盂罐', sub: '床边的红盖子底下，露出一个双喜字。', target: '床侧带盖痰盂_marital',
        markAt: [4.52, 4.19, -1.26], guideFrom: [4.63, 4.96, -2.22], pose: { pos: [4.61, 4.47, -1.82], look: [4.52, 4.18, -1.26] },
        act: (h, d, done) => h.wait(1200, done),
        card: { hu: '痰盂罐', zh: '带盖搪瓷痰盂', note: '上海人嫁女儿，嫁妆里也要放只痰盂罐。印红双喜，是讨个“子孙满堂”个彩头。' } },
      { id: 'portrait', audio: 'MB05', label: '婚纱照', sub: '刚才全家福里的爸爸妈妈，在这张照片里还是新郎新娘。', target: '西墙竖版婚纱照', markAt: PORTRAIT,
        guideFrom: [4.49, 5.45, -2.90], pose: { pos: [3.52, 5.45, -3.02], look: PORTRAIT },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '结婚照', zh: '婚纱照', note: '“姆妈，为啥这张里没我呀？”“因为拍照片的时候你还没生出来呀。”' } },
    ],
    outro: { after: 0, exit: [{ label: '回小客厅', to: 'lounge' }, { label: '去二楼楼梯间', to: 'landing' }] },
  },
};
