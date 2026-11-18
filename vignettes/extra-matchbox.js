// 厨房灶台上的一盒火柴（自来火）· 负责人：曦宝
// 收集册“开门七件事”的“柴”：厨房烧的是煤气，没有柴，用取火的火柴代替。
// 样子和位置照云宝 2026-11-17 做的那一版（鹿鹿看过预览后说“留火柴”）；他那批房子文件的改动没有保留，
// 这里在游戏运行时把它摆回去。盒面的大象火花图和纸壳颜色取自他那一版的贴图，放在 art/matchbox/。
const ART = name => new URL('../art/matchbox/' + name, import.meta.url).href;
const AT = [-1.22, .781, -12.49];   // 世界坐标：灶台台面上（高 0.781 米），煤气灶东侧和台沿之间。云宝那版写的是房子自己的坐标 x=0.82，房子整体在世界里往西偏 2.04 米

export default {
  add(h, d) {
    const T = h.THREE, host = h.find('已确认厨房_fixtures'); if (!host) return;
    const tex = file => { const t = new T.TextureLoader().load(ART(file)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; };
    const g = new T.Group(); g.name = '火柴盒（自来火）'; host.updateWorldMatrix(true, false); g.position.copy(host.worldToLocal(new T.Vector3().fromArray(AT))); g.rotation.y = .2;
    const paper = new T.MeshStandardMaterial({ map: tex('paper.png'), roughness: .92, metalness: 0 });
    const box = new T.Mesh(new T.BoxGeometry(.045, .014, .05), paper); box.position.y = .007; box.name = '自来火_纸壳盒套';
    const label = new T.Mesh(new T.PlaneGeometry(.043, .048), new T.MeshStandardMaterial({ map: tex('label.png'), roughness: .85, metalness: 0 })); label.rotation.x = -Math.PI / 2; label.position.y = .0142; label.name = '自来火_大象火花';
    const strike = new T.MeshStandardMaterial({ color: 0x4d3a29, roughness: 1, metalness: 0 });   // 两侧的擦火面
    const s1 = new T.Mesh(new T.BoxGeometry(.0004, .009, .044), strike), s2 = s1.clone(); s1.position.set(.0227, .007, 0); s2.position.set(-.0227, .007, 0);
    g.add(box, label, s1, s2); host.add(g); d.g = g;
  },
  remove(h, d) {
    if (!d.g) return; d.g.parent?.remove(d.g); d.g.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); d.g = null;
  },
};
