// 客堂泡茶用的东西 · 负责人：曦宝
// 鹿鹿 2026-11-17：不演拿茶叶。开了茶叶橱，到热水瓶那里一点就泡好。
// 都在游戏运行时做，不改房子的模型文件：
//   玻璃橱是移门 —— 把右边那扇玻璃（连同它的指窝）从整块里分出来，才能单独滑开；
//   茶杯里的干茶叶、茶水、水柱、热气是这里加的小零件；
//   热水瓶和茶杯各套一个“转轴”（pivot，物件绕着它转和移动的那个点），动完能原样放回去。

const WEAVE = new URL('../art/thermos/weave.jpg', import.meta.url).href;   // 竹编纹理（生图做的，原图和提示词在 concepts/thermos-v1/）
const SLIDE = .40;                        // 右扇玻璃往左滑开多少米
const ON_TABLE = [-1.15, .9065, -5.63];   // 坐下以后茶杯在桌上的位置：西侧条凳正前方，桌沿和大饼盘子之间

export function addTea(h, d) {
  const T = h.THREE, t = d.tea = { made: [], undo: [] };
  const v = new T.Vector3(), box = o => new T.Box3().setFromObject(o);
  // 世界坐标里的一段位移，换算成某个父物件自己坐标里的位移
  const localDelta = (parent, dx, dy, dz) => { parent.updateWorldMatrix(true, false); const a = parent.worldToLocal(new T.Vector3(0, 0, 0)), b = parent.worldToLocal(new T.Vector3(dx, dy, dz)); return b.sub(a); };
  // 给物件套一个转轴，轴心在世界坐标 point
  const pivotAt = (o, point) => { const p = new T.Group(), parent = o.parent; p.name = o.name + '_转轴'; parent.updateWorldMatrix(true, false); p.position.copy(parent.worldToLocal(point.clone())); parent.add(p); p.attach(o);
    t.undo.push(() => { parent.attach(o); parent.remove(p); }); return p; };

  // 把一个网格（mesh，由许多三角面拼成的形状）按“三角面中心在哪”分成两份
  const split = (mesh, test) => {
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry, pos = g.attributes.position, keep = [[], []], a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < pos.count; i += 3) { a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2); v.copy(a).add(b).add(c).divideScalar(3).applyMatrix4(mesh.matrixWorld); keep[test(v) ? 1 : 0].push(i, i + 1, i + 2); }
    return keep.map(ids => { const out = new T.BufferGeometry(); for (const [k, at] of Object.entries(g.attributes)) { const n = at.itemSize, arr = new at.array.constructor(ids.length * n); ids.forEach((id, j) => { for (let q = 0; q < n; q++) arr[j * n + q] = at.array[id * n + q]; }); out.setAttribute(k, new T.BufferAttribute(arr, n, at.normalized)); }
      const m = new T.Mesh(out, mesh.material); m.name = mesh.name; m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale); m.renderOrder = mesh.renderOrder; mesh.parent.add(m); t.made.push(m); return m; });
  };

  // ---- 玻璃橱的右扇移门 ----
  const cab = h.find('客堂玻璃橱');
  if (cab) {
    cab.updateWorldMatrix(true, true);
    const pick = name => { let m = null; cab.traverse(o => { if (o.isMesh && o.material?.name?.includes(name)) m = o; }); return m; };
    const glass = pick('移门玻璃'), dimple = pick('磨砂指窝');
    if (glass) {
      const gb = box(glass), zMid = (gb.min.z + gb.max.z) / 2, [back, front] = split(glass, p => p.z > zMid);
      const right = box(front).max.x > box(back).max.x ? front : back;   // 两扇一前一后，靠右的那扇挡着茶叶罐
      glass.visible = false; t.undo.push(() => { glass.visible = true; });
      t.door = [right];
      if (dimple) { const db = box(dimple), xMid = (db.min.x + db.max.x) / 2, [, r] = split(dimple, p => p.x > xMid); dimple.visible = false; t.undo.push(() => { dimple.visible = true; }); t.door.push(r); }
      t.doorHome = t.door.map(m => m.position.clone()); t.doorMove = localDelta(right.parent, -SLIDE, 0, 0);
    }
  }

  // ---- 茶杯：干茶叶、茶水、热气 ----
  const cup = h.find('茶杯_1');
  if (cup) {
    const body = cup.getObjectByName('茶杯_1_杯壁与内底') || cup, bb = box(body), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, R = (bb.max.x - bb.min.x) / 2;
    // 从杯口正上方往下量，找到杯子的内底
    const hit = new T.Raycaster(new T.Vector3(cx, bb.max.y + .1, cz), new T.Vector3(0, -1, 0)).intersectObject(body, true)[0], floorY = hit ? hit.point.y : bb.min.y + .006;
    t.cupPivot = pivotAt(cup, new T.Vector3(cx, bb.min.y, cz)); t.cupHome = { pos: t.cupPivot.position.clone(), quat: t.cupPivot.quaternion.clone() };
    const inCup = new T.Group(); inCup.name = '茶杯_1_茶'; t.cupPivot.add(inCup); t.made.push(inCup);
    const s = t.cupScale = 1 / (t.cupPivot.getWorldScale(v).x || 1);   // 转轴里 1 个单位是多少米（一般就是 1）
    // 干茶叶：杯底一小撮
    const lc = document.createElement('canvas'); lc.width = lc.height = 64; const lg = lc.getContext('2d'); lg.fillStyle = '#2f3319'; lg.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 130; i++) { lg.fillStyle = ['#3d4420', '#23280f', '#4a4a26', '#2b2414'][i % 4]; lg.save(); lg.translate((i * 37) % 64, (i * 53) % 64); lg.rotate(i * 1.7); lg.fillRect(-4, -1, 8, 2); lg.restore(); }
    const ltex = new T.CanvasTexture(lc); ltex.colorSpace = T.SRGBColorSpace;
    t.leaves = new T.Mesh(new T.SphereGeometry(R * .62, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ map: ltex, roughness: 1, metalness: 0 }));
    t.leaves.scale.set(s, s * .22, s); t.leaves.position.y = (floorY - bb.min.y) * s; t.leaves.visible = false; inCup.add(t.leaves);
    // 茶水：一片茶色的水面，倒水时从杯底升上来
    t.teaLow = (floorY - bb.min.y + .006) * s; t.teaHigh = (bb.max.y - bb.min.y - .012) * s;
    t.liquid = new T.Mesh(new T.CircleGeometry(R * .86 * s, 28), new T.MeshStandardMaterial({ color: 0xa8721f, roughness: .18, metalness: 0, transparent: true, opacity: .92 }));
    t.liquid.rotation.x = -Math.PI / 2; t.liquid.position.y = t.teaLow; t.liquid.visible = false; inCup.add(t.liquid);
    // 热气：几缕淡白的往上飘
    const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d'), grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = grad; sg.fillRect(0, 0, 64, 64);
    const stex = new T.CanvasTexture(sc);
    t.steam = [0, 1, 2].map(i => { const sp = new T.Sprite(new T.SpriteMaterial({ map: stex, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; inCup.add(sp); return sp; });
    t.steamOn = false;
    t.stopSteam = h.loop(now => { if (!t.steamOn) return; t.steam.forEach((sp, i) => { const k = ((now / 2600) + i / 3) % 1; sp.visible = true; sp.position.set(Math.sin(now / 900 + i * 2.1) * .008 * s, t.teaHigh + (.01 + k * .13) * s, Math.cos(now / 1100 + i) * .006 * s); const w = (.02 + k * .045) * s; sp.scale.set(w, w * 1.5, 1); sp.material.opacity = .34 * Math.sin(k * Math.PI); }); });
    t.cupWorld = new T.Vector3(cx, bb.max.y, cz);
  }

  // ---- 热水瓶：抬起、朝茶杯倾斜；一道水柱 ----
  // 鹿鹿 2026-11-17：原来那只是生成的模型，只有外面一层壳，盖子一拿开就看穿了（“塞子拔掉整个穿模”）。
  // 热水瓶是规整的东西，改成本地做：竹编瓶身、两道竹箍、竹片提手、铝瓶肩和瓶口、软木塞、铝盖。大小和位置照原来那只。
  const flask = h.find('竹壳热水瓶');
  if (flask && cup) {
    flask.updateWorldMatrix(true, true);
    const fb = box(flask), HGT = .326, base = new T.Vector3(fb.min.x + (fb.max.z - fb.min.z) / 2, fb.min.y, (fb.min.z + fb.max.z) / 2), c = base.clone().setY(base.y + HGT / 2);   // 原模型 x 方向多出来的是提手，瓶身直径看 z 方向
    const old = []; flask.traverse(o => { if (o.isMesh) old.push(o); }); for (const o of old) o.visible = false; t.undo.push(() => { for (const o of old) o.visible = true; });
    const weave = new T.TextureLoader().load(WEAVE); weave.colorSpace = T.SRGBColorSpace; weave.wrapS = weave.wrapT = T.MirroredRepeatWrapping;   /* 来回镜像着铺，接缝看不出来 */ weave.repeat.set(4, 2.3); weave.anisotropy = 8;
    const bamboo = new T.MeshStandardMaterial({ map: weave, roughness: .72, metalness: 0 }), hoop = new T.MeshStandardMaterial({ color: 0x8a5a2a, roughness: .7, metalness: 0 });
    const alu = new T.MeshStandardMaterial({ color: 0xb9bab4, roughness: .38, metalness: .7, side: T.DoubleSide }), cork = new T.MeshStandardMaterial({ color: 0xb08a5c, roughness: .95, metalness: 0 });
    const lathe = (pts, mat) => new T.Mesh(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 40), mat);
    const body = new T.Group(); body.name = '竹壳热水瓶_本地'; const dir = new T.Vector3(t.cupWorld.x - c.x, 0, t.cupWorld.z - c.z), dist = dir.length(); dir.normalize();
    body.add(lathe([[0, 0], [.064, 0], [.066, .004], [.066, .016], [.063, .018]], alu));                                   // 底圈
    body.add(lathe([[.063, .016], [.0665, .02], [.0665, .225], [.062, .243], [.052, .258]], bamboo));                      // 竹编瓶身
    body.add(lathe([[.052, .257], [.050, .262], [.040, .278], [.031, .286], [.029, .300], [.0262, .300], [.0262, .27]], alu));   // 铝瓶肩和瓶口
    const dark = new T.Mesh(new T.CircleGeometry(.0262, 24), new T.MeshBasicMaterial({ color: 0x120e0b })); dark.rotation.x = -Math.PI / 2; dark.position.y = .272; body.add(dark);   // 瓶口里面是黑的
    for (const y of [.032, .212]) { const ring = new T.Mesh(new T.TorusGeometry(.0672, .0032, 8, 40), hoop); ring.rotation.x = Math.PI / 2; ring.position.y = y; body.add(ring); }
    const grip = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([[.066, .06], [.088, .075], [.097, .135], [.088, .195], [.066, .21]].map(([x, y]) => new T.Vector3(x, y, 0))), 24, .0048, 8), hoop); grip.scale.z = 1.9; body.add(grip);   // 竹片提手
    body.rotation.y = Math.atan2(dir.z, -dir.x);   // 提手在背对茶杯的一侧
    const k = 1 / (flask.getWorldScale(v).x || 1); body.scale.setScalar(k); body.position.copy(flask.worldToLocal(base.clone())); flask.add(body); t.made.push(body);
    t.flaskPivot = pivotAt(flask, c); t.flaskHome = { pos: t.flaskPivot.position.clone(), quat: t.flaskPivot.quaternion.clone() };
    // 盖子（铝盖连同里面的软木塞）单独一件：倒水前先放到热水瓶另一边的柜面上
    const hostP = t.flaskPivot.parent, capG = new T.Group(), CAP_Y = .272; capG.name = '竹壳热水瓶_盖';
    capG.add(lathe([[.0335, 0], [.036, .003], [.036, .044], [.032, .052], [.012, .054], [0, .054]], alu));
    const plug = new T.Mesh(new T.CylinderGeometry(.0255, .0235, .03, 20), cork); plug.position.y = .025; capG.add(plug);
    capG.position.set(base.x, base.y + CAP_Y, base.z); h.scene.add(capG); hostP.attach(capG); t.made.push(capG); t.cap = capG; t.capHome = capG.position.clone();
    t.capMove = localDelta(hostP, -dir.x * .125, -CAP_Y, -dir.z * .125); t.capUp = localDelta(hostP, 0, .07, 0);
    const he = .300 - HGT / 2, neckR = .029, ANG = 1.05, LIFT = .06, shift = dist - he * Math.sin(ANG) - neckR * Math.cos(ANG);   // 倾斜约 60°，瓶口正好到杯子上方
    t.pour = { axis: localDelta(hostP, dir.z, 0, -dir.x).normalize(), move: localDelta(hostP, dir.x * shift, LIFT, dir.z * shift), ANG };
    const lipY = c.y + LIFT + he * Math.cos(ANG) - neckR * Math.sin(ANG), len = lipY - (t.cupWorld.y - .02);
    t.stream = new T.Mesh(new T.CylinderGeometry(.0032, .0042, 1, 10), new T.MeshBasicMaterial({ color: 0xeef6fa, transparent: true, opacity: .62, depthWrite: false }));
    t.stream.name = '热水瓶_水柱'; t.stream.visible = false; t.streamTop = lipY; t.streamLen = len; t.stream.position.set(t.cupWorld.x, lipY, t.cupWorld.z); h.scene.add(t.stream); t.made.push(t.stream);
  }
}

// 第④拍：右扇玻璃滑开，杯里出现一小撮茶叶
export function openCabinet(h, d, done) {
  const t = d.tea; if (!t?.door || t.opened) return done(); t.opened = true;
  const ease = k => k * k * (3 - 2 * k);
  h.tween(1400, k => { t.door.forEach((m, i) => m.position.copy(t.doorHome[i]).addScaledVector(t.doorMove, ease(k))); }, () => { if (t.leaves) t.leaves.visible = true; h.wait(500, done); });
}

// 第⑤拍：盖子拿下来放一边，热水瓶抬起、倾斜，水注进杯子，茶色升上来，冒热气；热水瓶放回去，盖子盖上
export function pourTea(h, d, done) {
  const t = d.tea; if (!t?.flaskPivot || t.poured) return done(); t.poured = true;
  const ease = k => k * k * (3 - 2 * k), seg = (k, a, b) => ease(Math.min(1, Math.max(0, (k - a) / (b - a)))), T = h.THREE, q = new T.Quaternion();
  const pose = a => { t.flaskPivot.position.copy(t.flaskHome.pos).addScaledVector(t.pour.move, a); t.flaskPivot.quaternion.copy(t.flaskHome.quat).multiply(q.setFromAxisAngle(t.pour.axis, t.pour.ANG * a)); };
  const cap = a => { t.cap.position.copy(t.capHome).addScaledVector(t.capMove, a).addScaledVector(t.capUp, Math.sin(a * Math.PI)); };   // a：0 盖着，1 放在柜面上
  const A = .30, B = .70;   // 水流着的那一段
  h.tween(4800, k => {
    cap(seg(k, 0, .13) - seg(k, .87, 1)); pose(seg(k, .13, .29) - seg(k, .72, .87));
    const flow = k > A && k < B, f = Math.min(1, Math.max(0, (k - A) / (B - A - .02)));   // f：杯子灌到几成
    t.stream.visible = flow;
    if (flow) { const len = t.streamLen * Math.min(1, (k - A) / .04); t.stream.scale.set(1, len, 1); t.stream.position.y = t.streamTop - len / 2; t.stream.material.opacity = .5 + .14 * Math.sin(k * 120); }
    if (k > A + .03) { t.liquid.visible = true; t.liquid.position.y = t.teaLow + (t.teaHigh - t.teaLow) * ease(f); if (f > .25) t.leaves.visible = false; }
    if (k > .5) t.steamOn = true;
  }, () => { pose(0); cap(0); t.stream.visible = false; h.wait(600, done); });
}

// 第⑦拍：坐下的同时，这杯茶已经在手边的桌上
export function cupToTable(h, d) {
  const t = d.tea; if (!t?.cupPivot || !t.poured || t.onTable) return; t.onTable = true;
  const T = h.THREE, p = t.cupPivot.parent; p.updateWorldMatrix(true, false);
  t.cupPivot.position.copy(p.worldToLocal(new T.Vector3().fromArray(ON_TABLE))); t.cupPivot.rotateY(-Math.PI / 2);   // 把手朝南，顺着右手
}

// 坐定以后：低头看那杯茶，茶杯自己凑上来、倾一下（吃一口），杯里浅下去一点，再放回桌上
export function sipTea(h, d, done) {
  const t = d.tea; if (!t?.onTable || t.sipped) return done(); t.sipped = true;
  const T = h.THREE, ease = k => k * k * (3 - 2 * k), seg = (k, a, b) => ease(Math.min(1, Math.max(0, (k - a) / (b - a)))), p = t.cupPivot.parent, q = new T.Quaternion();
  p.updateWorldMatrix(true, false); const w0 = p.worldToLocal(new T.Vector3(0, 0, 0)), toFace = p.worldToLocal(new T.Vector3(-.07, .15, 0)).sub(w0), axis = p.worldToLocal(new T.Vector3(0, 0, 1)).sub(w0).normalize();
  const home = t.cupPivot.position.clone(), quat = t.cupPivot.quaternion.clone(), level = t.liquid.position.y, low = level - (t.teaHigh - t.teaLow) * .3;
  h.gaze([ON_TABLE[0], ON_TABLE[1] + .1, ON_TABLE[2]], { go: 900, hold: 3300 });   // 低头看茶
  h.wait(800, () => h.tween(3000, k => {
    const up = seg(k, 0, .3) - seg(k, .72, 1), tip = seg(k, .25, .45) - seg(k, .6, .78);
    t.cupPivot.position.copy(home).addScaledVector(toFace, up); t.cupPivot.quaternion.copy(quat).premultiply(q.setFromAxisAngle(axis, .5 * tip));
    t.liquid.position.y = level + (low - level) * seg(k, .4, .62);
  }, () => { t.cupPivot.position.copy(home); t.cupPivot.quaternion.copy(quat); h.wait(500, done); }));
}

export function removeTea(h, d) {
  const t = d.tea; if (!t) return; t.stopSteam?.();
  if (t.door) t.door.forEach((m, i) => m.position.copy(t.doorHome[i]));
  if (t.cupPivot) { t.cupPivot.position.copy(t.cupHome.pos); t.cupPivot.quaternion.copy(t.cupHome.quat); }
  if (t.flaskPivot) { t.flaskPivot.position.copy(t.flaskHome.pos); t.flaskPivot.quaternion.copy(t.flaskHome.quat); }
  if (t.cap) t.cap.position.copy(t.capHome);
  for (const m of t.made) { m.parent?.remove(m); m.traverse?.(o => { o.geometry?.dispose?.(); if (o.material?.map && o.material.map.isCanvasTexture) o.material.map.dispose(); }); }
  for (const u of t.undo.reverse()) u();
  d.tea = null;
}
