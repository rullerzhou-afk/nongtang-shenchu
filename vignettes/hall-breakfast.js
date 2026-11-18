// 客堂八仙桌上的早饭“四大金刚” · 负责人：曦宝
// 鹿鹿 2026-11-17：果盘拿开（挪到冰箱顶上），四样各用一只碗盆盛着摆在桌面上；吃的用生成的模型，盛器本地做；
// 调羹不放桌上（“上海人不会把勺子放桌上”），搁在豆浆碗里。效果图：concepts/breakfast-four-v1/runs/T1-table-breakfast-v1/
// 现在是进客堂时临时摆进场景的（没有写进房屋模型），等房屋那边的改动定下来再正式装进去。
const GLB = n => new URL('../art/breakfast/' + n + '.glb', import.meta.url).href;
const TABLE_Y = .9065;   // 八仙桌钩花台布的上表面（世界坐标，米）

// 位置：世界坐标 x 向东、z 向南。桌面 x -1.23…-0.28，z -5.82…-4.87。东南角 (-0.5, -5.03) 是阿婆的字条，让开。
// 按效果图摆：四样收拢在桌面中部偏北，整整齐齐两行两列；后排两只盘子（大饼、油条），前排粢饭和豆浆。
const LAYOUT = {
  dabingPlate: { x: -.935, z: -5.535, r: .135 }, youtiaoPlate: { x: -.60, z: -5.535, r: .16 },
  paper: { x: -.935, z: -5.235, size: .20, turn: .06 }, bowl: { x: -.63, z: -5.245, r: .08 },
};

export async function addBreakfast(h, d) {
  const T = h.THREE, host = h.find('客堂_furniture'), g = new T.Group(); g.name = '八仙桌上_早饭';
  host.updateWorldMatrix(true, false); g.applyMatrix4(new T.Matrix4().copy(host.matrixWorld).invert()); host.add(g);   // 用世界坐标摆，挂在客堂陈设组下，才能被点到
  d.breakfast = g; d.fruit = h.find('八仙桌上_果盘');
  // 果盘挪到冰箱顶上（鹿鹿：“很多上海人喜欢把果盘放冰箱上”）：摆在冰箱顶那块钩花布的正中
  const top = h.find('冰箱顶_钩花布') || h.find('客堂电冰箱');
  if (d.fruit && top) {
    d.fruitHome = d.fruit.position.clone(); const a = new T.Box3().setFromObject(top), b = new T.Box3().setFromObject(d.fruit), c = a.getCenter(new T.Vector3()), f = b.getCenter(new T.Vector3());
    const move = new T.Vector3(c.x - f.x, a.max.y - b.min.y + .001, c.z - f.z), p = d.fruit.getWorldPosition(new T.Vector3()).add(move); d.fruit.parent.worldToLocal(p); d.fruit.position.copy(p);
  } else if (d.fruit) d.fruit.visible = false;
  const enamel = new T.MeshStandardMaterial({ color: 0xf2efe6, roughness: .32, metalness: 0 }), rim = new T.MeshStandardMaterial({ color: 0x2f4f8f, roughness: .4, metalness: 0 });
  const porcelain = new T.MeshStandardMaterial({ color: 0xf6f4ee, roughness: .22, metalness: 0, side: T.DoubleSide });
  const lathe = (pts, mat) => { const m = new T.Mesh(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), 48), mat); m.castShadow = m.receiveShadow = true; return m; };
  const named = (name, x, z, ...parts) => { const o = new T.Group(); o.name = name; o.position.set(x, TABLE_Y, z); for (const p of parts) o.add(p); g.add(o); return o; };
  // 搪瓷盘：浅盘，一圈蓝边
  const plate = r => { const o = new T.Group(), body = lathe([[0, .001], [r * .62, .001], [r * .9, .012], [r, .017], [r, .0195], [r * .9, .0145], [r * .62, .004], [0, .004]], enamel); body.material = enamel.clone(); body.material.side = T.DoubleSide;
    const edge = new T.Mesh(new T.TorusGeometry(r, .0016, 8, 64), rim); edge.rotation.x = Math.PI / 2; edge.position.y = .0185; o.add(body, edge); return o; };
  const dabingPlate = named('八仙桌上_大饼', LAYOUT.dabingPlate.x, LAYOUT.dabingPlate.z, plate(LAYOUT.dabingPlate.r));
  const youtiaoPlate = named('八仙桌上_油条', LAYOUT.youtiaoPlate.x, LAYOUT.youtiaoPlate.z, plate(LAYOUT.youtiaoPlate.r));
  // 垫纸：一张略皱的牛皮纸
  const paperGeo = new T.PlaneGeometry(LAYOUT.paper.size, LAYOUT.paper.size, 8, 8), pp = paperGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, .0012 * Math.sin(i * 12.9898) + .0012 * Math.cos(i * 4.1));
  paperGeo.computeVertexNormals(); const paper = new T.Mesh(paperGeo, new T.MeshStandardMaterial({ color: 0xb89a6e, roughness: .95, metalness: 0, side: T.DoubleSide })); paper.rotation.set(-Math.PI / 2, 0, LAYOUT.paper.turn); paper.position.y = .0025; paper.receiveShadow = true;
  const cifan = named('八仙桌上_粢饭', LAYOUT.paper.x, LAYOUT.paper.z, paper);
  // 豆浆：白瓷饭碗，里面一层豆浆，调羹斜搁在碗里
  const R = LAYOUT.bowl.r, bowl = lathe([[0, .004], [R * .42, .004], [R * .46, .012], [R * .8, .04], [R, .058], [R, .06], [R * .93, .058], [R * .74, .04], [R * .4, .014], [0, .012]], porcelain);
  const foot = lathe([[R * .36, 0], [R * .44, 0], [R * .44, .006], [R * .36, .006]], porcelain);
  const milk = new T.Mesh(new T.CircleGeometry(R * .775, 48)   /* 碗在这个高度的内壁半径约 0.80R，再大就戳出碗外 */, new T.MeshStandardMaterial({ color: 0xf3ecd9, roughness: .18, metalness: 0 })); milk.rotation.x = -Math.PI / 2; milk.position.y = .046; for (const m of [bowl, foot, milk]) { m.scale.y = R / .066; } milk.position.y = .046 * R / .066;
  const spoon = new T.Group(), scoop = new T.Mesh(new T.SphereGeometry(.019, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), porcelain); scoop.scale.set(1, .55, 1.35);
  const handle = new T.Mesh(new T.CapsuleGeometry(.0055, .085, 6, 12), porcelain); handle.scale.set(1.25, 1, .5); handle.rotation.x = Math.PI / 2; handle.position.set(0, .004, -.062);
  spoon.add(scoop, handle); spoon.scale.setScalar(R / .066); spoon.position.set(R * .18, .047 * R / .066, R * .27); spoon.rotation.set(.5, .7, 0);   // 勺头浸在豆浆里，勺柄靠在碗沿上
  named('八仙桌上_豆浆', LAYOUT.bowl.x, LAYOUT.bowl.z, foot, bowl, milk, spoon);
  // 三件生成的吃的：按目标长度等比缩放，底面落在盛器上
  const loaded = {}, load = file => loaded[file] ||= h.model(GLB(file));   // 同一个模型只载入一次，用两次就复制一份
  // gain：客堂光线偏暗偏暖，纯哑光的吃的会被压成桌布的色调。把它们受光的强度调高才看得出本色
  // （房屋场景白天不显示自发光，所以不能用自发光来提亮）
  const put = async (file, parent, length, y, turn, dx = 0, dz = 0, gain = 1.22) => {
    const s = (await load(file)).clone(), box = new T.Box3().setFromObject(s), size = box.getSize(new T.Vector3());
    if (size.z > size.x) { s.rotation.y = Math.PI / 2; s.updateMatrixWorld(true); box.setFromObject(s); box.getSize(size); }   // 让长边沿 x
    const k = length / size.x, c = box.getCenter(new T.Vector3()), w = new T.Group(); s.position.set(-c.x, -box.min.y, -c.z); w.add(s); w.scale.setScalar(k); w.rotation.y = turn; w.position.set(dx, y, dz);
    w.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; const mat = m.material = m.material.clone(); mat.metalnessMap = mat.roughnessMap = null; mat.metalness = 0; mat.roughness = .8; mat.color.setScalar(gain); } }); parent.add(w); return w;
  };
  await Promise.all([
    put('dabing', dabingPlate, .165, .007, .32, -.006, -.045), put('dabing', dabingPlate, .165, .007, .32, .006, .045),   // 两只并排，朝同一个方向
    put('youtiao', youtiaoPlate, .27, .007, 0),                                                                              // 一副，横在盘子正中
    put('cifan', cifan, .105, .004, .5, 0, 0, 1.4),
  ]).catch(e => console.error('breakfast models', e));
}

export function removeBreakfast(h, d) {
  if (d.breakfast) { d.breakfast.parent?.remove(d.breakfast); d.breakfast.traverse(m => { if (m.isMesh) { m.geometry.dispose(); } }); d.breakfast = null; }
  if (d.fruit) { d.fruit.visible = true; if (d.fruitHome) d.fruit.position.copy(d.fruitHome); }
}
