// 默认“开始”：俯瞰镜头推近到 27 号门头，纸色淡出（拍远景板和全景的停顿藏在这里），再在门前淡入、走完最后两三步、抬头看门头。
// 主动选择“走进弄堂”时，保留俯瞰、降到街面和完整步行路线。
// 走动时整个街区都是真模型；停下后把四周拍成全景图，再收起邻居的真模型（人只转头，画面不变，回头来路还在）。
// 只读快速版场景，不改它的文件；首页（home.js）把渲染权交给这里，结束时交回。
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => k * k * (3 - 2 * k);
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

// ---------- 可调参数（世界坐标，米；北是 -z，西是 -x）----------
const EYE = 1.5, FOV = 62;
const OVER = { target: [7.27, 2, 8.5], az: 0.16, polar: 1.1, viewH: 15 };   // 降下来之前的俯瞰机位：从东南偏南看弄堂口
const STREET = [7.27, 12.4];                 // 街面上的起步点（过街楼正前方）
// 步行路线（x, z）：像人一样走近路——进过街楼就往拐角内侧靠，贴着拐角划一道弧进支弄，斜着走到门前。
// 过街楼西墙在 x=5.2，沿街房背墙在 z=3.16，拐角点 (5.2, 3.16)；支弄北侧是 z≈0.05 的天井墙。
const ROUTE = [[7.27, 12.4], [6.95, 9.2], [6.3, 5.6], [5.85, 2.85], [4.3, 2.0], [2.2, 1.95], [.15, 2.22]];
const DOLLY_LOOK_Z = 4;                      // 降到街面时视线落在过街楼里的位置
const GATE_LOOK = [0, 1.75, -.1];            // 到门前时看向的位置：大门中间偏上
// 到门前站定后抬头看一眼门头再放下（秒）：先停一下、抬头、停留、放下。之后门环亮点才出现。
const GLANCE = { pause: .25, up: .8, hold: .7, down: .7 };   // 共约 2.5 秒
const GLANCE_MARGIN = 5;                     // 抬头时门头顶离画面上沿留几度
const LOOK_AHEAD = 2.4, GAZE_LEAD = 4.2;     // 走路时看前方多远；离终点多远开始把视线转向大门
// 平行镜头换透视镜头的那一刻，透视镜头要站得非常远、视角非常窄，两者画面才对得上；91 米远时近处会突然变大、远处变小（“抽”一下）。
const SWAP_DIST = 900;
const WALK_SPEED = 2.6, ACCEL = .9, DECEL = 1.3;   // 步行速度（米/秒，比真人走路快一些）与起停时间
const GLIDE_MS = 1500, DOLLY_MS = 3600;
// 默认入口的推近：从首页机位转到正南偏东、陡一些地俯看 27 号门头并拉近；推到 VEIL_AT 时纸色开始盖上来。
const PUSH = { target: [0, 2, .2], az: .2, polar: .48, viewH: 9 }, PUSH_MS = 1500, VEIL_AT = .55;
const APPROACH = 2.4, APPROACH_S = 1.8;      // 淡入后走完的最后一段（米、秒）：起步约每秒 2.7 米，减速停在门前
const BLOCK = { x0: -12.84, x1: 9.6, z0: -53.4, z1: 13 };   // 街区范围
const CARD_H = [-.2, 10.4], CARD_PPM = 40;   // 远景板拍摄的高度范围（米）和清晰度（每米像素）
const RING = { north: -68, south: 27, west: -26, east: 24 };   // 四周远景板的位置：离街区边缘十几米
const PANO_RANGE = [1024, 2048];             // 全景图每个面的边长范围；实际按画面清晰度取，够用就不多占显存

export function beginEntry(ctx, { walkIn = false } = {}) {
  const { T, THREE, W, cam: ortho, ctl, renderer, rawRender, deco, BG } = ctx;
  const PAPER = new THREE.Color(BG);
  const pcam = new THREE.PerspectiveCamera(FOV, 1, .08, 520);
  const canvas = renderer.domElement;
  const resize = () => { pcam.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight); pcam.updateProjectionMatrix(); };
  resize(); W.addEventListener('resize', resize);

  const ui = $('fpui'), dot = $('fpdot'), skipBtn = $('fpskip'), backBtn = $('fpback'), toast = $('fptoast'), veil = $('fpveil');
  const stats = { phase: walkIn ? 'glide' : 'push', entryMode: walkIn ? 'walk' : 'direct', frames: 0, worstMs: 0, walkMs: [], pano: null, tris: 0 };
  let phase = walkIn ? 'glide' : 'push', alive = true, yaw = 0, pitch = 0, pano = null, ground = null;
  const savedBg = T.scene.background, decoOpacity = new Map();
  deco.traverse(o => { if (o.material) decoOpacity.set(o.material, o.material.opacity); });
  const setDeco = k => { for (const [m, o] of decoOpacity) m.opacity = o * k; };

  // ---------- 街区以外的环境：渐变天空、淡入天色的地面、四周的远景板（用自己街区的立面拍成）----------
  const HORIZON = new THREE.Color(0xe4e7df), ZENITH = new THREE.Color(0xa9c3d3);
  const env = new THREE.Group(); env.name = '进门段_街区外环境'; env.visible = false; T.scene.add(env);
  // 地面：中间是路面色，远处淡成地平线的颜色，看不到一条硬边
  { const c = W.document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const grd = g.createRadialGradient(256, 256, 40, 256, 256, 256); grd.addColorStop(0, '#8c8e85'); grd.addColorStop(.32, '#8c8e85'); grd.addColorStop(.75, '#d9dcd4'); grd.addColorStop(1, '#e4e7df');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0 }));
    ground.name = '街区外地面'; ground.rotation.x = -Math.PI / 2; ground.position.set(-1.6, -.185, -20); ground.renderOrder = -5; env.add(ground); }
  // 上海弄堂晴天：淡蓝天顶、薄霭地平线与少量疏云。确定性噪声只在初始化绘制一次。
  const SKY = { ox: 20.5, oz: 2.4, lo: .53, hi: .65, sc: 4 };   /* 云的位置（ox、oz）和多少（lo 越小云越多） */
  const sky = (() => { const geo = new THREE.SphereGeometry(390, 64, 40), c=W.document.createElement('canvas');c.width=2048;c.height=1024;
    const g=c.getContext('2d'),im=g.createImageData(c.width,c.height),data=im.data;
    const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
    const smooth=t=>t*t*(3-2*t),noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy),a=hash(ix,iy),b=hash(ix+1,iy),d=hash(ix,iy+1),e=hash(ix+1,iy+1);return(a+(b-a)*u)*(1-v)+(d+(e-d)*u)*v;};
    /* 曦宝 11-17：云按“头顶一层平铺的云”来画（把每个方向投到一张水平面上取噪声），这样头顶的云不会被球面贴图拉成条纹，越靠地平线越扁越密，和真的一样 */
    const fbm=(x,y)=>{let f=0,w=.5,s=1;for(let i=0;i<5;i++){f+=noise(x*s+i*17.3,y*s+i*9.1)*w;s*=2.03;w*=.5;}return f/.96875;};
    const step=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
    for(let y=0;y<c.height;y++){const th=y/c.height*Math.PI,cy=Math.cos(th),r=Math.sin(th),t=Math.pow(Math.max(0,cy),.6),base=[226+(150-226)*t,231+(190-231)*t,226+(219-226)*t];
      for(let x=0;x<c.width;x++){const k=(y*c.width+x)*4;let a=0,sh=1;
        if(cy>.03){const ph=x/c.width*Math.PI*2,q=1/(cy+.16),px=r*Math.cos(ph)*q*SKY.sc+SKY.ox,pz=r*Math.sin(ph)*q*SKY.sc+SKY.oz;
          const f=fbm(px,pz)*.72+fbm(px*3.1+40,pz*3.1+7)*.28;a=step(SKY.lo,SKY.hi,f)*step(.03,.22,cy)*.9;sh=1-.1*step(SKY.hi,SKY.hi+.16,f);}
        data[k]=base[0]*(1-a)+250*sh*a;data[k+1]=base[1]*(1-a)+250*sh*a;data[k+2]=base[2]*(1-a)+247*sh*a;data[k+3]=255;}
    }
    g.putImageData(im,0,0);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=THREE.RepeatWrapping;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:tex, side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false, transparent: true, opacity: 0 }));
    m.name = '渐变天空'; m.position.set(-1.6, 0, -20); m.renderOrder = -10; m.frustumCulled = false; env.add(m); return m; })();
  // 远景板：把自己街区的立面拍成图，立在四周。拍的时候只拍街区本身，背景透明。
  const cards = [];
  function shootElevation(eye, lookDir, width, near, far) {
    const h = CARD_H[1] - CARD_H[0], rt = new THREE.WebGLRenderTarget(Math.min(4096, Math.round(width * CARD_PPM)), Math.round(h * CARD_PPM), { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    rt.texture.wrapS = THREE.MirroredRepeatWrapping; rt.texture.anisotropy = 8; rt.texture.generateMipmaps = false;
    const oc = new THREE.OrthographicCamera(-width / 2, width / 2, h / 2, -h / 2, near, far);
    oc.position.set(eye[0], (CARD_H[0] + CARD_H[1]) / 2, eye[1]); oc.lookAt(eye[0] + lookDir[0], oc.position.y, eye[1] + lookDir[1]); oc.updateMatrixWorld();
    const bg = T.scene.background, col = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha(), was = env.visible, target = renderer.getRenderTarget();
    T.scene.background = null; env.visible = false; renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(rt);
    try { rawRender(T.scene, oc); } finally { renderer.setRenderTarget(target); renderer.setClearColor(col, alpha); T.scene.background = bg; env.visible = was; }
    return rt;
  }
  function addCard(rt, width, repeat, x, z, rotY, tint, normal) {
    const h = CARD_H[1] - CARD_H[0];
    const mat = new THREE.MeshBasicMaterial({ map: rt.texture, color: tint, transparent: true, opacity: 0, alphaTest: .001, fog: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(width * repeat, h); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * repeat);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, (CARD_H[0] + CARD_H[1]) / 2, z); m.rotation.y = rotY; m.name = '远景板'; m.userData.inward = new THREE.Vector3(normal[0], 0, normal[1]); env.add(m); cards.push(m);
  }
  function buildCards() {
    const W0 = BLOCK.x1 - BLOCK.x0, L0 = BLOCK.z1 - BLOCK.z0, cx = (BLOCK.x0 + BLOCK.x1) / 2, cz = (BLOCK.z0 + BLOCK.z1) / 2;
    const rowSouth = shootElevation([cx, 3.1], [0, -1], W0, .01, 18.2);         // 第一排朝南的立面：石库门、天井墙、二楼窗、屋面
    const shopSouth = shootElevation([cx, BLOCK.z1 + .5], [0, -1], W0, .01, 9.6);   // 沿街店面朝南的立面
    const east = shootElevation([9.3, cz], [-1, 0], L0, .01, 22.3);            // 整个街区朝东的立面：三排山墙、支弄口、沿街房的端头
    const spanX = 7, spanZ = 3;
    addCard(rowSouth, W0, spanX, cx, RING.north, 0, 0xffffff, [0, 1]);                // 北面：对着我们的是另一条弄堂的石库门
    addCard(shopSouth, W0, spanX, cx, RING.south, Math.PI, 0xd9d9d6, [0, -1]);         // 南面：街对面的一排店面（背光，压暗一点）
    addCard(east, L0, spanZ, RING.west, cz, Math.PI / 2, 0xffffff, [1, 0]);           // 西面：隔壁弄堂的山墙
    addCard(east, L0, spanZ, RING.east, cz, -Math.PI / 2, 0xdcdcd8, [-1, 0]);          // 东面：界墙外面的山墙（背光）
    stats.cards = { rts: [rowSouth, shopSouth, east].map(r => [r.width, r.height]) };
    return [rowSouth, shopSouth, east];
  }
  let cardRts = [];
  function setEnv(k) {   // 0 = 首页的纸面；1 = 街面上的天空、地面和远景板
    const e = smooth(Math.max(0, Math.min(1, k)));
    sky.material.opacity = e; ground.material.opacity = e;
    const c = smooth(Math.max(0, Math.min(1, (k - .5) / .2)));            // 远景板等镜头降到屋顶高度附近再出现，而且出现得快：半透明的时间长了会像一层层重影
    // 每块板子都要等镜头进到它里侧（朝街区的一侧）至少 2 米才开始出现、8 米时完全出现。
    // 镜头是从南边高处降下来的，会穿过街对面那块板子所在的平面；不这样做，穿过的一瞬间板子会从眼前扫过。
    for (const m of cards) {
      const inside = v.copy(pcam.position).sub(m.position).dot(m.userData.inward), o = c * .94 * smooth(Math.max(0, Math.min(1, (inside - 2) / 6)));
      m.material.opacity = o; m.visible = o > .001; m.userData.inside = inside;
    }
    bgColor.copy(PAPER).lerp(HORIZON, e);
  }
  const bgColor = PAPER.clone();

  // ---------- 相机 ----------
  const look = new THREE.Vector3(), v = new THREE.Vector3();
  const spherical = (az, polar, d, out) => out.set(Math.sin(polar) * Math.sin(az) * d, Math.cos(polar) * d, Math.sin(polar) * Math.cos(az) * d);
  function setWalker(x, z, y, p) { pcam.position.set(x, EYE, z); pcam.quaternion.setFromEuler(new THREE.Euler(p, y, 0, 'YXZ')); yaw = y; pitch = p; }

  // ---------- 步行路线：一条平滑的弧线，按走过的距离取位置；朝向是“看着前方的路”，快到时转去看大门 ----------
  // 朝向 0 = 朝北，π/2 = 朝西。
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'); curve.arcLengthDivisions = 600;
  const TOTAL = curve.getLength(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  const mixAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  function pathAt(s) {
    s = Math.max(0, Math.min(TOTAL, s)); curve.getPointAt(s / TOTAL, pa);
    const ahead = Math.min(TOTAL, s + LOOK_AHEAD);
    if (ahead - s > .05) curve.getPointAt(ahead / TOTAL, pb).sub(pa); else curve.getTangentAt(1, pb);
    let y = Math.atan2(-pb.x, -pb.z);                                   // 看着前方的路
    y = mixAngle(0, y, smooth(Math.min(1, s / 1.6)));                   // 起步时从正北接过来，不甩头
    const g = smooth(Math.max(0, Math.min(1, (s - (TOTAL - GAZE_LEAD)) / (GAZE_LEAD - .5))));   // 快到了：视线转向大门
    const toGate = Math.atan2(-(GATE_LOOK[0] - pa.x), -(GATE_LOOK[2] - pa.z));
    y = mixAngle(y, toGate, g);
    const p = Math.atan2(GATE_LOOK[1] - EYE, Math.hypot(GATE_LOOK[0] - pa.x, GATE_LOOK[2] - pa.z)) * g;
    return [pa.x, pa.z, y, p];
  }
  const WALK_T = TOTAL / WALK_SPEED + (ACCEL + DECEL) / 2;
  function distanceAt(t) {   // 梯形速度：起步加速、匀速、到门前减速
    t = Math.max(0, Math.min(WALK_T, t)); const cruise = WALK_T - ACCEL - DECEL;
    if (t < ACCEL) return WALK_SPEED * t * t / (2 * ACCEL);
    if (t < ACCEL + cruise) return WALK_SPEED * (ACCEL / 2 + (t - ACCEL));
    const r = WALK_T - t; return TOTAL - WALK_SPEED * r * r / (2 * DECEL);
  }

  // ---------- 全景：停下后拍一张，再收起邻居 ----------
  function capturePano(apply = true) {   // apply=false：先拍好，邻居照旧是真模型，等站定时再换（换的一下没有停顿）
    const t0 = performance.now();
    // 全景一个面管 90°，画面高度管 FOV 度：按同样的每度像素数定边长，停下后不会比走动时糊
    const size = Math.min(PANO_RANGE[1], Math.max(PANO_RANGE[0], Math.ceil(renderer.getContext().drawingBufferHeight / FOV * 90 / 256) * 256));
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    const cc = new THREE.CubeCamera(.08, 520, rt); cc.position.copy(pcam.position);
    const heroWas = T.hero.visible; T.hero.visible = false;      // 主户保持真模型，不进全景；它投在地上的影子是静态的，仍然在
    T.scene.background = bgColor; cc.update(renderer, T.scene);
    T.hero.visible = heroWas; T.scene.background = bgColor;
    pano = { rt, at: pcam.position.clone(), applied: false }; stats.pano = { ms: Math.round(performance.now() - t0), size };
    if (apply) applyPano();
  }
  function applyPano() { T.neighbours.visible = false; env.visible = false; T.scene.background = pano.rt.texture; pano.applied = true; }
  function releasePano() {
    if (!pano) return; T.neighbours.visible = true; env.visible = true; T.scene.background = bgColor; pano.rt.dispose(); pano = null;
  }

  // ---------- 门环亮点 ----------
  const ring = new THREE.Vector3(.2, 1.36, 0);
  { const b = new THREE.Box3(); let found = false; T.hero.traverse(o => { if (!found && /门环/.test(o.name)) { b.setFromObject(o); if (!b.isEmpty()) { b.getCenter(ring); found = true; } } });
    if (!found) T.hero.traverse(o => { if (!found && o.name === '石库门_双扇黑漆门') { b.setFromObject(o); ring.set((b.min.x + b.max.x) / 2 + .2, 1.36, b.max.z + .02); found = true; } }); }
  // 门头：从黑漆门往上找到整座石库门（含门框、门楣、山花）的外包范围，取它的上半截作为抬头看的位置
  const gateTop = { y: 4.2, x: 0, z: -.1 };
  { const door = T.hero.getObjectByName('石库门_双扇黑漆门'), b = new THREE.Box3(), db = new THREE.Box3();
    if (door) { db.setFromObject(door); gateTop.x = (db.min.x + db.max.x) / 2; gateTop.z = db.max.z; let p = door.parent, best = null;
      for (let i = 0; p && p !== T.hero && i < 4; i++, p = p.parent) { b.setFromObject(p); if (b.max.x - b.min.x < 4.5 && b.max.y - db.max.y > .5) { best = b.max.y; break; } }
      if (best) gateTop.y = best; stats.gate = { doorTop: +db.max.y.toFixed(2), gateTop: +gateTop.y.toFixed(2) }; } }
  function placeDot() {
    if (phase !== 'station') { dot.style.display = 'none'; return; }
    v.copy(ring).project(pcam);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { dot.style.display = 'none'; return; }
    dot.style.display = 'block'; dot.style.left = (v.x + 1) / 2 * canvas.clientWidth + 'px'; dot.style.top = (1 - v.y) / 2 * canvas.clientHeight + 'px';
  }

  // ---------- 绘制与主循环 ----------
  function draw() {
    if (phase === 'indoor' && indoor) { indoor.draw(); stats.tris = renderer.info.render.triangles; return; }
    if (phase === 'veiled') return;   // 纸色已经盖满：不画，留给拍远景板和全景
    if (phase === 'glide' || phase === 'push') { rawRender(T.scene, ortho); ctx.paintBackdrop(); } else rawRender(T.scene, pcam);
    stats.tris = renderer.info.render.triangles;
  }
  let t0 = performance.now(), last = t0, glideFrom = null, dolly = null, walkStart = 0, veiledFrames = 0, approachStart = 0;
  function orbitTo(to, k) {   // 平行镜头从首页机位按 k 插值到 to（目标点、方位、俯角、画面高度）
    let da = to.az - glideFrom.az; da = Math.atan2(Math.sin(da), Math.cos(da));
    const az = glideFrom.az + da * k, polar = lerp(glideFrom.polar, to.polar, k), d = glideFrom.d;
    look.set(lerp(glideFrom.t.x, to.target[0], k), lerp(glideFrom.t.y, to.target[1], k), lerp(glideFrom.t.z, to.target[2], k));
    ortho.position.copy(look).add(spherical(az, polar, d, v)); ortho.lookAt(look);
    // 画面高度按比例插值（不是按 zoom 线性），推近的速度看起来均匀
    const h0 = (ortho.top - ortho.bottom) / glideFrom.zoom, h = h0 * Math.pow(to.viewH / h0, k);
    ortho.zoom = (ortho.top - ortho.bottom) / h; ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
  }
  function tick(now) {
    if (!alive) return; requestAnimationFrame(tick);
    const dt = now - last; last = now; stats.frames++; if (phase === 'walk') stats.walkMs.push(Math.round(dt));
    if (phase === 'push') {
      const u = Math.min(1, (now - t0) / PUSH_MS);
      orbitTo(PUSH, ease(u));
      if (u >= VEIL_AT) veil.classList.add('on');
      if (u >= 1) { phase = 'veiled'; stats.phase = phase; veiledFrames = 0; }
    } else if (phase === 'veiled') {
      if (++veiledFrames === 3) prepareGate();   // 纸色确实画上去之后再做重活
    }
    if (phase === 'approach') {
      const u = Math.min(1, (now - approachStart) / (APPROACH_S * 1000)), [x, z, y, p] = pathAt(TOTAL - APPROACH * (1 - u) * (1 - u));
      setWalker(x, z, y, p);
      if (u >= 1) arrive(now);
    }
    if (phase === 'glide') {
      const k = ease(Math.min(1, (now - t0) / GLIDE_MS));
      let da = OVER.az - glideFrom.az; da = Math.atan2(Math.sin(da), Math.cos(da));
      const az = glideFrom.az + da * k, polar = lerp(glideFrom.polar, OVER.polar, k), d = glideFrom.d;
      look.set(lerp(glideFrom.t.x, OVER.target[0], k), lerp(glideFrom.t.y, OVER.target[1], k), lerp(glideFrom.t.z, OVER.target[2], k));
      ortho.position.copy(look).add(spherical(az, polar, d, v)); ortho.lookAt(look);
      ortho.zoom = lerp(glideFrom.zoom, (ortho.top - ortho.bottom) / OVER.viewH, k); ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
      setDeco(1 - k);
      if (k >= 1) {   // 换成透视相机：站得很远、视角很窄，画面和平行镜头几乎一样，再边靠近边放宽
        dolly = { d0: SWAP_DIST, h0: OVER.viewH, az0: OVER.az, polar0: OVER.polar }; phase = 'dolly'; stats.phase = phase; t0 = now; env.visible = true; setEnv(0); setDeco(0);
      }
    }
    if (phase === 'dolly') {
      const k = ease(Math.min(1, (now - t0) / DOLLY_MS));
      const d1 = STREET[1] - DOLLY_LOOK_Z, h1 = 2 * d1 * Math.tan(FOV * Math.PI / 360);
      // 距离按比例缩短（900 米到 8 米），画面里的东西大小连续变化；透视是渐渐出来的。前段走得快些，不在极远处磨蹭。
      const u = Math.pow(k, .7), d = dolly.d0 * Math.pow(d1 / dolly.d0, u), h = lerp(dolly.h0, h1, k);
      look.set(lerp(OVER.target[0], STREET[0], k), lerp(OVER.target[1], EYE, k), lerp(OVER.target[2], DOLLY_LOOK_Z, k));
      pcam.position.copy(look).add(spherical(lerp(dolly.az0, 0, k), lerp(dolly.polar0, Math.PI / 2, k), d, v)); pcam.lookAt(look);
      pcam.fov = 2 * Math.atan(h / 2 / d) * 180 / Math.PI;
      // 中段仍离建筑百米时，近裁剪面不能先落到 8 厘米：否则毫米级的勒脚／墙皮会争抢同一深度。
      // 用距离的 1% 托住近裁剪面；接近街面时自然回到原来的 8 厘米，不改机位、视角或路线。
      pcam.near = Math.max(.08, d - 140, d * .01); pcam.far = Math.max(520, d + 320);
      pcam.updateProjectionMatrix();
      setEnv(k); T.scene.background = bgColor;
      if (k >= 1) { setEnv(1); pcam.fov = FOV; pcam.near = .08; pcam.far = 520; pcam.updateProjectionMatrix(); setWalker(STREET[0], STREET[1], 0, 0); phase = 'walk'; stats.phase = phase; walkStart = now; }
    }
    if (phase === 'walk') {
      const t = (now - walkStart) / 1000, [x, z, y, p] = pathAt(distanceAt(t));
      setWalker(x, z, y, p);
      if (t >= WALK_T) arrive(now);
    }
    if (phase === 'glance') {   // 站定后像人一样抬头确认一下门头，再把视线放回门上
      const t = (now - glance.t0) / 1000, { pause, up, hold, down } = GLANCE;
      let k = 0;
      if (t > pause) k = t < pause + up ? ease((t - pause) / up) : t < pause + up + hold ? 1 : 1 - ease(Math.min(1, (t - pause - up - hold) / down));
      pcam.position.set(glance.x, EYE, glance.z);
      yaw = lerp(glance.y0, glance.y1, k); pitch = lerp(glance.p0, glance.p1, k); pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      if (t >= pause + up + hold + down) settleAtGate();
    }
    if (phase === 'station' && aim) {   // 门前转头的平滑
      const sm = 1 - Math.exp(-Math.min(.05, dt / 1000) * 16); yaw += (aim[0] - yaw) * sm; pitch += (aim[1] - pitch) * sm;
      pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    }
    if (phase === 'indoor' && indoor) indoor.tick(now);
    draw(); placeDot();
    stats.worstMs = Math.max(stats.worstMs, dt);
  }
  let glance = null;
  function arrive(now) {
    skipBtn.classList.remove('on');
    if (pano) { if (!pano.applied) applyPano(); }   // 默认入口已在纸色下从这个位置拍好：直接换上，没有停顿
    else { draw(); capturePano(); }   // 人已经站定：先拍全景、收起邻居，这一下停顿正好落在“站住”的瞬间
    const dist = Math.hypot(gateTop.x - pcam.position.x, gateTop.z - pcam.position.z);
    // 只抬到门头刚好完整入画：门头的顶落在画面上沿往下一点（留 GLANCE_MARGIN 度），不必把它抬到画面正中
    const topAngle = Math.atan2(gateTop.y - EYE, dist), aimY = gateTop.y;
    glance = { t0: performance.now(), x: pcam.position.x, z: pcam.position.z, y0: yaw, p0: pitch,
      y1: Math.atan2(-(gateTop.x - pcam.position.x), -(gateTop.z - pcam.position.z)), p1: Math.max(pitch, Math.min(1.05, topAngle - (FOV / 2 - GLANCE_MARGIN) * Math.PI / 180)) };
    stats.glance = { pitchUpDeg: +(glance.p1 * 180 / Math.PI).toFixed(1), aimY: +aimY.toFixed(2) };
    phase = 'glance'; stats.phase = phase;
  }
  function settleAtGate() {
    phase = 'station'; stats.phase = phase;
    ui.classList.add('on'); backBtn.classList.add('on'); say('拖动转头看看　·　点一下门环', 5200);
    backBtn.focus({ preventScroll: true });
  }
  function prepareGate() {   // 纸色盖满时：拍远景板，站到门前拍好全景（暂不换上），再退回两三步准备淡入
    const t = performance.now(); cardRts = buildCards(); stats.cards.ms = Math.round(performance.now() - t);
    const [x, z, y, p] = pathAt(TOTAL);
    setWalker(x, z, y, p); pcam.fov = FOV; pcam.near = .08; pcam.far = 520; pcam.updateProjectionMatrix();
    setDeco(0); env.visible = true; setEnv(1); T.scene.background = bgColor;
    capturePano(false);
    const [x0, z0, y0, p0] = pathAt(TOTAL - APPROACH); setWalker(x0, z0, y0, p0); setEnv(1);
    stats.veiledMs = Math.round(performance.now() - t);
    phase = 'approach'; stats.phase = phase; draw(); approachStart = performance.now();
    veil.classList.remove('on');
  }
  function jumpToGate() {
    document.body.classList.add('entry-direct');
    const [x, z, y, p] = pathAt(TOTAL);
    setWalker(x, z, y, p);
    pcam.fov = FOV; pcam.near = .08; pcam.far = 520; pcam.updateProjectionMatrix();
    phase = 'station'; stats.phase = phase;
    setDeco(0); env.visible = true; setEnv(1); T.scene.background = bgColor;
    skipBtn.classList.remove('on');
    if (!pano) capturePano();
    settleAtGate(); draw(); placeDot();
  }

  // ---------- 站着的时候：拖动转头 ----------
  let drag = null;
  // 拖动转头：方向和三维游戏一样（往右拖往右看、往上拖往上看），一屏宽约转 1.5 倍画面宽的角度；转动稍作平滑，免得晕
  let aim = null;
  const turnRate = () => { const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight), h = 2 * Math.atan(Math.tan(pcam.fov * Math.PI / 360) * aspect); return h / Math.max(1, canvas.clientWidth) * 1.5; };
  ui.onpointerdown = e => { if (phase !== 'station') return; aim = aim || [yaw, pitch]; drag = [e.clientX, e.clientY, aim[0], aim[1], turnRate()]; ui.setPointerCapture(e.pointerId); ui.classList.add('drag'); };
  ui.onpointermove = e => {
    if (!drag) return; const k = drag[4];
    aim = [drag[2] - (e.clientX - drag[0]) * k, Math.max(-1.15, Math.min(1.15, drag[3] - (e.clientY - drag[1]) * k))];
  };
  ui.onpointerup = ui.onpointercancel = () => { drag = null; ui.classList.remove('drag'); };
  let sayTimer; function say(text, ms) { toast.textContent = text; toast.classList.add('on'); clearTimeout(sayTimer); if (ms) sayTimer = setTimeout(() => toast.classList.remove('on'), ms); }
  // ---------- 点门环：开门进屋（indoor.js）----------
  let indoor = null, camMode = 'persp', orbitSaved = null;
  dot.onclick = async e => {
    e.stopPropagation(); if (phase !== 'station' || indoor) return;
    phase = 'indoor'; stats.phase = phase; dot.style.display = 'none'; drag = null; ui.classList.remove('drag');
    const { enterHouse } = await import(new URL('./indoor.js' + new URL(import.meta.url).search, import.meta.url).href);
    indoor = enterHouse({ T, THREE, W, pcam, ortho, ctl, renderer, rawRender, canvas, say, FOV,
      hideToast: () => toast.classList.remove('on'),
      prepareReflections: camera => T.updateGameReflections?.(camera),
      camera: () => camMode, setCamera: m => { camMode = m; },
      async applyView(patch) {   // 快速版换视图时会改背景色，背景必须是颜色；全景纹理先换下来，换完再还原
        const bg = T.scene.background; T.scene.background = PAPER.clone();
        try { await T.apply(patch, { reframe: false }); } finally { T.scene.background = bg; }
      },
      showStreet() {   // 走进天井起，四周换回真模型（全景只在门前站着时用）；升起时邻居都在，不会突然不见
        releasePano(); T.neighbours.visible = true; env.visible = true; setEnv(1); T.scene.background = bgColor;
      },
      async toCutaway() {   // 高过屋脊的那一刻：剖开墙、藏屋顶，天空和远景板换成纸色；邻居留着（画面此时定格着）
        T.scene.background = PAPER.clone(); await T.apply({ cut: true, roof: false }, { reframe: false });
        releasePano(); T.neighbours.visible = true; env.visible = false; T.scene.background = PAPER;
      },
      enableOrbit(on, lim) {   // 屋里用快速版自己的转看控制，范围按这一档收住
        if (!orbitSaved) orbitSaved = { enabled: ctl.enabled, minZoom: ctl.minZoom, maxZoom: ctl.maxZoom, minPolar: ctl.minPolarAngle, maxPolar: ctl.maxPolarAngle, minAz: ctl.minAzimuthAngle, maxAz: ctl.maxAzimuthAngle };
        ui.classList.remove('on'); ctl.enabled = on;
        ctl.minZoom = lim.minZoom; ctl.maxZoom = lim.maxZoom; ctl.minPolarAngle = lim.minPolar; ctl.maxPolarAngle = lim.maxPolar;
      } });
    stats.indoor = indoor.stats;
  };
  skipBtn.onclick = () => { if (alive && phase !== 'station') jumpToGate(); };
  backBtn.onclick = () => leave();

  // ---------- 结束：把一切还回首页 ----------
  async function leave() {
    if (!alive) return; alive = false; clearTimeout(sayTimer); drag = null; ui.classList.remove('drag');
    if (indoor) {   // 从屋里回街区：还原各层、材质、门和视图，再交回首页
      indoor.leave();
      if (orbitSaved) { ctl.enabled = orbitSaved.enabled; ctl.minZoom = orbitSaved.minZoom; ctl.maxZoom = orbitSaved.maxZoom; ctl.minPolarAngle = orbitSaved.minPolar; ctl.maxPolarAngle = orbitSaved.maxPolar; ctl.minAzimuthAngle = orbitSaved.minAz; ctl.maxAzimuthAngle = orbitSaved.maxAz; }
      T.scene.background = PAPER.clone(); await T.apply({ floors: 'all', roof: true, cut: false, doorsOpen: false, context: true }, { reframe: false });
      indoor = null;
    }
    releasePano();
    T.scene.remove(env); env.traverse(o => { o.geometry?.dispose(); if (o.material) { if (o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); o.material.dispose(); } }); for (const r of cardRts) r.dispose();
    T.scene.background = savedBg; setDeco(1); W.removeEventListener('resize', resize);
    for (const e of [ui, backBtn, skipBtn, toast, veil]) e.classList.remove('on'); dot.style.display = 'none';
    document.body.classList.remove('entry-direct');
    ctx.done();
  }

  // ---------- 开始 ----------
  { const o = v.copy(ortho.position).sub(ctl.target), d = o.length();
    glideFrom = { t: ctl.target.clone(), d, az: Math.atan2(o.x, o.z), polar: Math.acos(o.y / d), zoom: ortho.zoom }; }
  if (walkIn) { const t = performance.now(); cardRts = buildCards(); stats.cards.ms = Math.round(performance.now() - t); skipBtn.classList.add('on'); }
  else document.body.classList.add('entry-direct');   // 纸签与操作提示随推近淡出
  requestAnimationFrame(tick);
  return { draw, leave, stats, inspectIndoor: () => indoor?.inspect(), pcam, cards, OVER, SWAP_DIST, FOV, get phase() { return phase; }, get yaw() { return yaw; }, get pitch() { return pitch; },
    look(y, p) { aim = null; yaw = y; pitch = p; pcam.quaternion.setFromEuler(new THREE.Euler(p, y, 0, 'YXZ')); },
    setPanoEnabled(on) { if (on && !pano && phase === 'station') capturePano(); if (!on) releasePano(); }, ring, pathAt, TOTAL };
}
