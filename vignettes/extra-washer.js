// 后天井的双桶洗衣机 · 负责人：曦宝
// 鹿鹿 2026-11-17：洗衣机放后天井；看过等大色块后定在南墙窗台下、铁皮桶和地漏之间（“就放这里”）。
// 款式照搜到的实物：淡绿色机身、后面一条竖起的控制台带三个圆旋钮、上面左右两块米白盖板（concepts/washer-rearwell-v1/references/）。
// 尺寸 74×44×92 厘米，参照现在一款双桶机的官方尺寸；当年的规格表没查到。外壳是规整形状，本地建模，没有用生成。
// 现在是进屋时临时摆进场景的（没有写进房屋模型），等房屋那边的改动定下来再正式装进去。
// 做旧贴图（生图）：机身一圈搪瓷漆，底部锈和污渍重、上面是水痕和细划痕；盖板是发黄的塑料。原图和提示词在 concepts/washer-rearwell-v1/
const ART = n => new URL('../art/washer/' + n + '.jpg', import.meta.url).href;
const AT = { x: .84, z: -10.74 - .22 - .006, y: .025 };   // 世界坐标：背贴南墙（z = -10.74），窗台下沿 1.035 米，机顶 0.945 米

export default {
  add(h, d) {
    const T = h.THREE, host = h.find('后天井_rear'); if (!host) return;
    const g = new T.Group(); g.name = '后天井_双桶洗衣机'; host.updateWorldMatrix(true, false); g.applyMatrix4(new T.Matrix4().copy(host.matrixWorld).invert());
    const m = new T.Group(); m.position.set(AT.x, AT.y, AT.z); g.add(m); host.add(g); d.washer = g;   // m 里：x 沿墙，y 向上，-z 是正面（朝厨房）
    const mat = (color, roughness = .45) => new T.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const tex = n => { const t = new T.TextureLoader().load(ART(n)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; t.wrapS = T.RepeatWrapping; return t; };
    const enamel = tex('body'), plastic = tex('lid'), withMap = (map, roughness) => new T.MeshStandardMaterial({ map, roughness, metalness: 0 });
    const green = withMap(enamel, .5), skirt = withMap(enamel, .62), deck = withMap(plastic, .55), cream = withMap(plastic, .55), dark = mat(0x4a4f45, .6), rubber = mat(0x55585a, .85), dial = mat(0xcfc7ac, .5);
    skirt.color.setHex(0xd9dccb); deck.color.setHex(0xdfe9dc); cream.color.setHex(0xf4f6f2);   // 底座一圈更暗更脏；上框是带一点绿的旧塑料
    // 贴图怎么铺：侧面绕机身一圈（接缝在背面，贴着墙看不到），从下到上取贴图的 v0…v1 一段；顶面平铺
    const wrap = (geo, height, v0, v1) => { const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, b = geo.boundingBox || (geo.computeBoundingBox(), geo.boundingBox);
      for (let i = 0; i < p.count; i++) { if (Math.abs(n.getY(i)) < .5) uv.setXY(i, Math.atan2(p.getX(i), -p.getZ(i)) / (Math.PI * 2) + .5, v0 + (v1 - v0) * p.getY(i) / height); else uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getZ(i) - b.min.z) / (b.max.z - b.min.z)); }
      uv.needsUpdate = true; return geo; };
    const flat = geo => wrap(geo, 1, 0, 0);   // 盖板、上框：只用到顶面的平铺
    const add = (geo, material, x, y, z) => { const o = new T.Mesh(geo, material); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; m.add(o); return o; };
    // 圆角的方块：用圆角矩形往上拉出来
    const slab = (w, depth, height, r) => { const s = new T.Shape(), x = w / 2, z = depth / 2; s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z); s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
      const geo = new T.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 6 }); geo.rotateX(-Math.PI / 2); return geo; };
    for (const x of [-.31, .31]) for (const z of [-.17, .17]) add(new T.CylinderGeometry(.022, .026, .03, 16), rubber, x, .015, z);   // 四只脚
    add(wrap(slab(.74, .44, .06, .03), .06, 0, .075), skirt, 0, .03, 0);                    // 底座一圈：取贴图最底下锈最重的一条
    add(wrap(slab(.735, .435, .70, .028), .70, .075, .97), green, 0, .09, 0);               // 机身
    add(flat(slab(.74, .44, .022, .03)), deck, 0, .79, 0);                                  // 上框
    add(flat(slab(.40, .29, .012, .02)), cream, -.15, .812, -.055);                         // 洗衣桶盖板
    add(flat(slab(.25, .29, .012, .02)), cream, .205, .812, -.055);                         // 甩干桶盖板
    add(new T.BoxGeometry(.006, .014, .29), deck, .065, .819, -.055);   // 两块盖板之间的隔条
    add(wrap(slab(.74, .10, .11, .02), .11, .84, .99), green, 0, .812, .17);                // 后面竖起的控制台：取贴图靠上干净的一段
    add(new T.BoxGeometry(.66, .07, .004), cream, 0, .868, .118);       // 控制台面板
    for (const x of [-.22, 0, .22]) {                                    // 三个圆旋钮：洗涤定时、水流、甩干定时
      const k = add(new T.CylinderGeometry(.027, .03, .022, 28), dial, x, .868, .106); k.rotation.x = Math.PI / 2;
      add(new T.BoxGeometry(.006, .03, .006), dark, x, .874, .093);
    }
    // 排水管：从机身右下角出来，贴着地面搭到东头的地漏上
    const drain = new T.CatmullRomCurve3([[.36, .1, -.05], [.44, .05, -.1], [.56, .018, -.12], [.70, .016, -.09]].map(p => new T.Vector3(...p)));
    add(new T.TubeGeometry(drain, 32, .016, 10), rubber, 0, 0, 0);
    // 进水皮管：一圈盘在洗衣桶盖板上
    const coil = add(new T.TorusGeometry(.085, .011, 10, 40), rubber, -.15, .835, -.05); coil.rotation.x = Math.PI / 2;
    const tail = new T.CatmullRomCurve3([[-.065, .835, -.05], [-.03, .84, -.12], [.02, .835, -.17]].map(p => new T.Vector3(...p))); add(new T.TubeGeometry(tail, 16, .011, 10), rubber, 0, 0, 0);
  },
  remove(h, d) { if (d.washer) { d.washer.parent?.remove(d.washer); d.washer.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); d.washer = null; } },
};
