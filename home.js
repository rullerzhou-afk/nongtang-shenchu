// 游戏首页试样：只读快速版（iframe 里的 fast/index.html），不改它的任何文件。
// 起始画面贴近街区；之后可以整圈转看、平移、拉远。限制按当前角度计算：
// 不低于地面、镜头不进入房屋体量、最远只到街区基本铺满画面（不留大片空白）、画面中心不离开街区。
import { isTrackpadScroll } from './motion-limit.mjs';
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frame = $('view'), W = frame.contentWindow;

// ---------- 可调参数 ----------
const BG = 0xe3e6df;                         // 街区以外的底色：先沿用原来的纸色，背景以后再设计
const LIMIT = { edge: 0.42, avg: 0.17 };     // 只用于算起始画面：单条边最多露出的比例、四条边平均最多露出的比例
const HOME = { target: [-4.2, 2, -18.6], zoom: 3.1, az: 0.633, polar: 0.951 };   // 初始机位
const POLAR = [0.18, 1.3];                    // 俯仰范围（弧度，从正上方量起）：最俯视约 10°，最平视约 74°。不到 90° 就永远看不到地面以下
const ZOOM = [0.2, 6.5];                      // 最近到 6.5；最远由 fitZoom() 按当前角度算
const COVER = 0.97;                           // 最远时街区在画面里占的比例：宽或高里先撑满的那一边占到九成，另一边超出画面。鹿鹿 2026-11-15 截图定的，不留大片空白
const PAN_INSET = 0.42, PAN_MIN_INSET = 2.5;  // 画面中心离街区边缘至少保持：可见范围的这个比例，且不少于这么多米
const BLOCK = { x0: -12.84, x1: 9.6, y0: 0, y1: 9.44, z0: -53.4, z1: 13 };   // 整个街区的外包范围（米）
const DIST = 91.5;                            // 正交相机到目标点的距离，不影响画面大小
const TARGET_Y = 2;

// ---------- 加载页 ----------
const loadT0 = performance.now(); let sceneReady = false, failed = false;
function showFailure(msg) {   // 出错就在加载页上说出来，不让人对着进度条干等
  if (failed || !$('loading')) return; failed = true; window.__homeFailed = String(msg);
  clearInterval(loadTimer);
  $('lstep').textContent = '没能打开：' + String(msg).slice(0, 80);
  $('lsec').textContent = '请把这一页截图给曦宝';
  const bar = document.querySelector('#loading .bar'); if (bar) bar.style.display = 'none';
}
addEventListener('error', e => showFailure(e.message || e.error));
addEventListener('unhandledrejection', e => showFailure(e.reason?.message || e.reason));
const loadTimer = setInterval(() => {
  let text = ''; if (!sceneReady) try { text = W.document.getElementById('progress')?.textContent || ''; } catch (e) {}
  if (text) $('lstep').textContent = text;
  $('lsec').textContent = '已等 ' + Math.round((performance.now() - loadT0) / 1000) + ' 秒';
}, 500);
async function waitScene() {
  const deadline = performance.now() + 600000;   // 部署版：线上网络慢，放宽到 10 分钟
  for (;;) {
    if (W.__V3_STATUS?.errors?.length) throw new Error(W.__V3_STATUS.errors.join('\n'));
    if (W.__V3_TEST) return W.__V3_TEST;
    if (performance.now() > deadline) throw new Error('街区载入超过三分钟，请检查本地服务与近景预构建资源');
    await sleep(100);
  }
}
const timings = { start: Math.round(performance.timeOrigin), sceneMs: 0, veilMs: 0, detailMs: 0, nearSnapshotMs: 0, settleMs: 0, shownMs: 0 }; window.__homeTimings = timings;
const T = await waitScene(); timings.sceneMs = Math.round(performance.now());
timings.nearSnapshotMs = Math.round(W.__V3_STATUS.streetSnapshotLoadMs || 0); // 包含在 sceneMs 中，不再另有浏览器重建阶段
if (!T.neighbours.userData.fastStreetDetailSnapshot) throw new Error('首页未载入近景街区，请先运行近景预构建');
const THREE = await W.eval("import('three')");

// 只留画布：把快速版自己的面板和标题都藏起来
{
  const d = W.document, canvasBox = d.getElementById('canvas');
  const keep = new Set(); for (let e = canvasBox; e; e = e.parentElement) keep.add(e);
  const st = d.createElement('style');
  st.textContent = '.gh-hide{display:none!important}html,body{background:#e3e6df!important}#canvas,#stage{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important}';
  d.head.appendChild(st);
  for (const k of keep) for (const c of k.children) if (!keep.has(c) && !canvasBox.contains(c) && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') c.classList.add('gh-hide');
  W.dispatchEvent(new W.Event('resize'));
  // 快速版按 #stage 的大小定画布和镜头比例。#stage 必须和窗口一样大，否则画面会被横向拉伸（之前漏了它，俯瞰被拉宽了约 18%）。
  const r = d.getElementById('stage').getBoundingClientRect();
  if (Math.abs(r.width - W.innerWidth) > 1 || Math.abs(r.height - W.innerHeight) > 1) throw new Error('街区画布没有铺满窗口，画面比例会不对');
}

sceneReady = true; $('lstep').textContent = '正在摆好镜头…';
// iframe 用 street=near 直接载入原实体瓦与完整邻居，不再现场重建或篡改内部快照标记。
async function loadStreetDetail() {
  const t = performance.now(); await T.ensureStreetDetail();
  timings.detailMs = Math.round(performance.now() - t);
}

const cam = T.camera, ctl = T.controls, renderer = T.renderer, gl = renderer.getContext();
T.scene.background = new THREE.Color(BG);
const bg = [(BG >> 16) & 255, (BG >> 8) & 255, BG & 255];

function setPose(p) {
  ctl.target.set(p.target[0], TARGET_Y, p.target[2]);
  cam.position.set(p.target[0] + DIST * Math.sin(p.polar) * Math.sin(p.az), TARGET_Y + DIST * Math.cos(p.polar), p.target[2] + DIST * Math.sin(p.polar) * Math.cos(p.az));
  cam.zoom = p.zoom; cam.updateProjectionMatrix(); ctl.update();
  ctl.dispatchEvent({ type: 'change' }); // 外部检查只改 zoom 时也让快速版标记 dirty
}
ctl.minAzimuthAngle = -Infinity; ctl.maxAzimuthAngle = Infinity;   // 一整圈都能转
ctl.minPolarAngle = POLAR[0]; ctl.maxPolarAngle = POLAR[1];
ctl.minZoom = ZOOM[0]; ctl.maxZoom = ZOOM[1];
ctl.rotateSpeed = 0.55; ctl.panSpeed = 0.6; ctl.zoomSpeed = 1.0;
ctl.enableDamping = false; ctl.autoRotate = false; ctl.zoomToCursor = false;
setPose(HOME);

// ---------- 不露底：在主场景同一次绘制里验收请求；初始构图仍沿用原 settle ----------
let lastE = null, lastKey = '', active = true, ready = false, viewKey = '';
const rawRender = renderer.render.bind(renderer);
const deco = new THREE.Scene();          // 街区以外的背景装饰（图纸线稿、投影），单独一遍画在空白处
const draw = () => renderer.render(T.scene, cam);
function strip(x, y, w, h) {
  const b = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
  let n = 0; for (let i = 0; i < b.length; i += 4) if (Math.abs(b[i] - bg[0]) <= 2 && Math.abs(b[i + 1] - bg[1]) <= 2 && Math.abs(b[i + 2] - bg[2]) <= 2) n++;
  return n / (b.length / 4);
}
function readEdges() {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  return { bottom: strip(0, 0, w, 2), top: strip(0, h - 2, w, 2), left: strip(0, 0, 2, h), right: strip(w - 2, 0, 2, h) };
}
const edges = () => lastE;
const avgOf = e => (e.left + e.right + e.top + e.bottom) / 4;
const bare = e => Math.max(e.left, e.right, e.top, e.bottom) > LIMIT.edge || avgOf(e) > LIMIT.avg;   // 露得太多
const R = new THREE.Vector3(), U = new THREE.Vector3(), D = new THREE.Vector3(), d = new THREE.Vector3(), tt = new THREE.Vector3();
function nudge(e, cap) {
  cam.updateMatrixWorld(); R.setFromMatrixColumn(cam.matrixWorld, 0); U.setFromMatrixColumn(cam.matrixWorld, 1); cam.getWorldDirection(D);
  const dx = e.left - e.right, dy = e.bottom - e.top;      // 哪边露得多，就往哪边挪
  const over = (a, b) => a > LIMIT.edge && b > LIMIT.edge;
  // 两边露得差不多、挪也没用，或者对边同时超限：只能拉近
  if (over(e.left, e.right) || over(e.top, e.bottom) || (Math.abs(dx) < .04 && Math.abs(dy) < .04)) { cam.zoom = Math.min(ZOOM[1], cam.zoom * 1.04); cam.updateProjectionMatrix(); }
  const vw = (cam.right - cam.left) / cam.zoom, vh = (cam.top - cam.bottom) / cam.zoom;
  const k = v => Math.sign(v) * Math.min(cap, Math.abs(v) * .22);
  d.set(0, 0, 0).addScaledVector(R, k(dx) * vw).addScaledVector(U, k(dy) * vh);
  shift(d);
}
function shift(delta) {   // 平移后沿视线把目标点拉回固定高度（正交相机下画面不变）
  tt.copy(ctl.target).add(delta); delta.addScaledVector(D, (TARGET_Y - tt.y) / D.y);
  ctl.target.add(delta); cam.position.add(delta);
}
function levelTarget() { cam.getWorldDirection(D); if (Math.abs(ctl.target.y - TARGET_Y) > 1e-4) { d.set(0, 0, 0); shift(d); } }
const snap = () => ({ p: cam.position.clone(), t: ctl.target.clone(), z: cam.zoom });
const restore = s => {
  cam.position.copy(s.p); ctl.target.copy(s.t); cam.zoom = s.z;
  cam.updateProjectionMatrix(); cam.lookAt(ctl.target); cam.updateMatrixWorld();
};
const poseKey = s => [...s.p.toArray(), ...s.t.toArray(), s.z].map(v => v.toFixed(9)).join();
const viewportKey = () => [cam.left, cam.right, cam.top, cam.bottom, gl.drawingBufferWidth, gl.drawingBufferHeight].join();
const key = () => poseKey(snap()) + '|' + viewportKey();
// ---------- 按角度计算的限制（纯几何，不读画面）----------
const CORNERS = [];
for (const x of [BLOCK.x0, BLOCK.x1]) for (const y of [BLOCK.y0, BLOCK.y1]) for (const z of [BLOCK.z0, BLOCK.z1]) CORNERS.push(new THREE.Vector3(x, y, z));
let panInset = PAN_INSET;
function fitZoom() {   // 当前角度下允许的最远缩放：街区的宽或高（先撑满画面的那一边）占画面的 COVER
  cam.updateMatrixWorld(); R.setFromMatrixColumn(cam.matrixWorld, 0); U.setFromMatrixColumn(cam.matrixWorld, 1);
  let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity;
  for (const c of CORNERS) { const r = c.dot(R), u = c.dot(U); r0 = Math.min(r0, r); r1 = Math.max(r1, r); u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
  return COVER * Math.max((cam.right - cam.left) / (r1 - r0), (cam.top - cam.bottom) / (u1 - u0));
}
function panBox() {    // 当前角度和远近下，画面中心（落在地面上的点）允许的范围
  cam.updateMatrixWorld(); R.setFromMatrixColumn(cam.matrixWorld, 0); cam.getWorldDirection(D);
  const hw = (cam.right - cam.left) / 2 / cam.zoom, hh = (cam.top - cam.bottom) / 2 / cam.zoom;
  const fl = Math.hypot(D.x, D.z) || 1e-6, hg = hh / Math.max(-D.y, .3);   // 画面的上下方向落到地面上会被拉长，越平视拉得越长
  const ex = Math.abs(R.x) * hw + Math.abs(D.x / fl) * hg, ez = Math.abs(R.z) * hw + Math.abs(D.z / fl) * hg;
  const cx = (BLOCK.x0 + BLOCK.x1) / 2, cz = (BLOCK.z0 + BLOCK.z1) / 2;
  const ax = Math.max(0, (BLOCK.x1 - BLOCK.x0) / 2 - Math.max(panInset * ex, PAN_MIN_INSET)), az = Math.max(0, (BLOCK.z1 - BLOCK.z0) / 2 - Math.max(panInset * ez, PAN_MIN_INSET));
  return [cx - ax, cx + ax, cz - az, cz + az];
}
function confine() {   // 把远近和画面中心收回允许范围；都是连续的夹取，不会跳。返回有没有改动
  let changed = false;
  const z = Math.min(ZOOM[1], Math.max(fitZoom(), cam.zoom));
  if (Math.abs(z - cam.zoom) > 1e-9) { cam.zoom = z; cam.updateProjectionMatrix(); changed = true; }
  const [x0, x1, z0, z1] = panBox();
  const tx = Math.min(x1, Math.max(x0, ctl.target.x)), tz = Math.min(z1, Math.max(z0, ctl.target.z));
  if (Math.abs(tx - ctl.target.x) > 1e-9 || Math.abs(tz - ctl.target.z) > 1e-9) { d.set(tx - ctl.target.x, 0, tz - ctl.target.z); ctl.target.add(d); cam.position.add(d); changed = true; }
  return changed;
}
function paintMain() {
  rawRender(T.scene, cam); lastE = readEdges();
  return lastE; // 只读刚画的主场景，装饰不会进入判定
}
function paintBackdrop() {
  if (!deco.children.some(o => o.visible)) return;
  const ac = renderer.autoClear; renderer.autoClear = false;
  try { rawRender(deco, cam); } finally { renderer.autoClear = ac; }
}
function settle(maxIter, fresh = false, cap = .12) {   // 只供首次构图、显式 reset 或窗口重排；交互不能调用 nudge
  let e, clean = false;
  for (let i = 0; i <= maxIter; i++) {
    if (i > 0 || !fresh || !lastE || key() !== lastKey) { paintMain(); paintBackdrop(); lastKey = key(); }
    e = edges(); if (!bare(e)) { clean = true; break; }
    if (i < maxIter) {
      // 前十几步照旧推；还不行说明在这个窗口比例下来回摆，之后每隔几步强制拉近一点、步子逐渐减小，保证一定能停下来
      if (i >= 12 && i % 5 === 2) { cam.zoom = Math.min(ZOOM[1], cam.zoom * 1.04); cam.updateProjectionMatrix(); }
      nudge(e, i < 12 ? cap : cap * Math.max(.2, 1 - (i - 12) / 40));
    }
  }
  if (clean) { ctl.update(); viewKey = viewportKey(); lastKey = key(); }
  return clean;
}
function reset() { setPose(HOME); return settle(80); }
let entry = null;   // 进门段接管渲染时不为空（见 entry.js）
renderer.render = (s, c) => {
  if (s !== T.scene || c !== cam) return rawRender(s, c);
  if (entry) return entry.draw();
  if (!ready || !active) { paintMain(); paintBackdrop(); lastKey = key(); return; }
  levelTarget();                     // 只沿视线把目标点拉回固定高度，正交画面不变
  if (confine()) ctl.update();       // 收回允许范围后让控制器从这个位置继续
  rawRender(T.scene, cam); paintBackdrop(); lastKey = key();
};
function step() { if (active && key() !== lastKey) draw(); }

// ---------- 背景装饰：图纸底与投影 ----------
const INK = 0x2f4a3a, GY = -0.18;         // 墨绿线；画在铺地板块的底面高度
const OWN = { x0: -12.84, x1: 9.6, z0: -53.4, z1: 13 };   // 我们这块街区的范围
const planGroup = new THREE.Group(); planGroup.name = '图纸底'; deco.add(planGroup);
{
  const layers = { bold: { w: .10, o: .46, p: [] }, mid: { w: .05, o: .36, p: [] }, fine: { w: .028, o: .28, p: [] } };
  const seg = (L, x1, z1, x2, z2) => {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1, h = L.w / 2;
    const ex = dx / len * h, ez = dz / len * h, nx = -dz / len * h, nz = dx / len * h;
    L.p.push(x1 - ex + nx, z1 - ez + nz, x1 - ex - nx, z1 - ez - nz, x2 + ex - nx, z2 + ez - nz, x2 + ex + nx, z2 + ez + nz);
  };
  const rect = (L, x0, z0, x1, z1) => { seg(L, x0, z0, x1, z0); seg(L, x1, z0, x1, z1); seg(L, x1, z1, x0, z1); seg(L, x0, z1, x0, z0); };
  const dashed = (L, x1, z1, x2, z2, dash, gap) => {
    const len = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / len, uz = (z2 - z1) / len;
    for (let t = 0; t < len; t += dash + gap) { const e = Math.min(len, t + dash); seg(L, x1 + ux * t, z1 + uz * t, x1 + ux * e, z1 + uz * e); }
  };
  let seed = 19940521; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const ROWS = [[3.6, 3.6, 3.6, 7.2], [7.2, 3.6, 3.6, 3.6], [3.6, 3.6, 3.6, 3.6, 3.6], [3.6, 7.2, 3.6, 3.6], [3.6, 3.6, 7.2, 3.6]];
  const P = OWN.x1 - OWN.x0, Q = (OWN.z1 - OWN.z0) + 10;       // 街区在东西、南北方向的重复间距（南北之间隔一条十米的马路）
  const { bold, mid, fine } = layers;
  for (let k = -10; k <= 10; k++) for (let j = -4; j <= 4; j++) {
    const ox = OWN.x0 + k * P, oz = j * Q;
    if (k === 0 && j === 0) continue;                           // 自己这一块不画，由模型本身呈现
    rect(bold, ox, oz + OWN.z0, ox + P, oz + 9.4);             // 里弄外轮廓
    for (const z0 of [0, -17.8, -35.6]) {                       // 三排住宅
      let x = ox;
      for (const w of ROWS[Math.floor(rnd() * ROWS.length)]) {
        rect(mid, x, oz + z0 - 15, x + w, oz + z0);            // 一户的外墙与分户墙
        seg(fine, x, oz + z0 - 3.2, x + w, oz + z0 - 3.2);      // 天井
        seg(fine, x, oz + z0 - 11.6, x + w, oz + z0 - 11.6);    // 后天井、灶间
        if (w > 4) seg(fine, x + 3.6, oz + z0 - 3.2, x + 3.6, oz + z0 - 11.6);   // 双开间的厢房
        seg(fine, x + w * .5 - .55, oz + z0, x + w * .5 + .55, oz + z0 + .001);
        x += w;
      }
    }
    for (let x = ox; x < ox + 17.9; x += 3.6) rect(mid, x, oz + 4, x + 3.6, oz + 9.4);   // 沿街店面
    dashed(fine, ox + 18, oz + 4, ox + 18, oz + 9.4, .5, .35); dashed(fine, ox + 21.84, oz + 4, ox + 21.84, oz + 9.4, .5, .35);   // 过街楼
  }
  for (let j = -4; j <= 4; j++) {                               // 马路：人行道边线和中线
    const z = j * Q;
    seg(mid, -240, z + 13, 240, z + 13); dashed(fine, -240, z + 18, 240, z + 18, 2.4, 1.6);
  }
  // 指北针与比例尺（东南角的马路上；北是 -z）
  const nx = 13.6, nz = 20.6; seg(mid, nx, nz, nx, nz - 3.4); seg(mid, nx, nz - 3.4, nx - .55, nz - 2.3); seg(mid, nx, nz - 3.4, nx + .55, nz - 2.3);
  const bx = 16.4, bz = 20.4; seg(mid, bx, bz, bx + 10, bz); for (const t of [0, 5, 10]) seg(mid, bx + t, bz, bx + t, bz - .5);
  for (const k in layers) {
    const L = layers[k], n = L.p.length / 8, pos = new W.Float32Array(n * 12), idx = new W.Uint32Array(n * 6);   // 数组和画布都要用里层页面的类型，三维引擎才认
    for (let i = 0; i < n; i++) {
      for (let v = 0; v < 4; v++) { pos[i * 12 + v * 3] = L.p[i * 8 + v * 2]; pos[i * 12 + v * 3 + 1] = GY; pos[i * 12 + v * 3 + 2] = L.p[i * 8 + v * 2 + 1]; }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: L.o, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; planGroup.add(m);
  }
  // 平铺在地上的小字
  const label = (text, x, z, h, alongZ = false, o = .5) => {
    const c = W.document.createElement('canvas'), px = 96; const g2 = c.getContext('2d');
    const font = `${px}px "Songti SC","STSong","Noto Serif SC",serif`; g2.font = font;
    c.width = Math.ceil(g2.measureText(text).width + px * .4); c.height = Math.ceil(px * 1.3);
    const g3 = c.getContext('2d'); g3.font = font; g3.fillStyle = '#2f4a3a'; g3.textBaseline = 'middle'; g3.fillText(text, px * .2, c.height / 2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h * c.width / c.height, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: o, depthWrite: false, toneMapped: false }));
    m.rotation.set(-Math.PI / 2, 0, alongZ ? Math.PI / 2 : 0); m.position.set(x, GY + .002, z); planGroup.add(m);
  };
  label('北', 13.6, 15.9, 1.3); label('0', 16.4, 21.5, .9); label('5', 21.4, 21.5, .9); label('10 米', 27.4, 21.5, .9);
  label('支　弄', 18.6, -16.4, 1.1); label('支　弄', 18.6, -34.2, 1.1); label('总　弄', 29.5, -8, 1.1, true);
  label('总　弄', 7.1, -62, 1.1, true); label('支　弄', -22, -16.4, 1.1); label('天井', 11.4, -1.6, .8, false, .4); label('天井', 15, -19.4, .8, false, .4);
}
// 投影：街区轮廓向外晕开的一圈淡影，像模型摆在纸上
const shadowMesh = (() => {
  const pad = 20, ppm = 8, w = OWN.x1 - OWN.x0 + pad * 2, h = OWN.z1 - OWN.z0 + pad * 2;
  const c = W.document.createElement('canvas'); c.width = Math.round(w * ppm); c.height = Math.round(h * ppm);
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.filter = `blur(${Math.round(3.8 * ppm)}px)`; g.fillStyle = '#fff';
  g.fillRect((pad + .6) * ppm, (pad + .6) * ppm, (OWN.x1 - OWN.x0 - 1.2) * ppm, (OWN.z1 - OWN.z0 - 1.2) * ppm);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x3d3529, alphaMap: tex, transparent: true, opacity: .64, depthWrite: false, toneMapped: false }));
  m.name = '纸上投影'; m.rotation.x = -Math.PI / 2;
  m.position.set((OWN.x0 + OWN.x1) / 2 - .6, GY - .01, (OWN.z0 + OWN.z1) / 2 - .8);   // 光从东南来，影子略偏西北
  m.renderOrder = -1; deco.add(m); return m;
})();
function setBackdrop(mode) {
  planGroup.visible = mode === 'plan' || mode === 'both'; shadowMesh.visible = mode === 'shadow' || mode === 'both';
  if (lastE) draw();
}
setBackdrop(new URLSearchParams(location.search).get('bg') || 'both');   // 鹿鹿选定：图纸＋投影。?bg=none|plan|shadow 仅供对照

// 初始机位先算干净（窗口比例不同，可能要多推几步）
{ const t = performance.now(); if (!settle(200)) throw new Error('首页起始构图未能满足 LIMIT'); timings.settleMs = Math.round(performance.now() - t); }
// 近景已包含在首批街区中；保留最终构图复核，直接揭开原加载页。
await loadStreetDetail();
if (!settle(200)) throw new Error('首页起始构图未能满足 LIMIT');   // 细节补齐后按最终画面再确认一次起始机位
// 起始画面必须落在允许范围内：不够就把“离边缘的距离”放宽到刚好容得下，免得一碰就被挪动
{ const inside = () => { const [x0, x1, z0, z1] = panBox(); return ctl.target.x >= x0 - 1e-6 && ctl.target.x <= x1 + 1e-6 && ctl.target.z >= z0 - 1e-6 && ctl.target.z <= z1 + 1e-6; };
  while (!inside() && panInset > .04) panInset -= .02; }
ready = true;
// 快速版在 change/resize 时自行标记 dirty 并绘制；不再另起 rAF 推镜头或读取上一帧。

// ---------- 触控板：双指滑动平移，捏合缩放；鼠标滚轮照旧缩放 ----------
const pointers = new Set(), inputStats = { ignoredWheels: 0, panWheels: 0 };
W.addEventListener('pointerdown', e => { if (renderer.domElement.contains(e.target)) pointers.add(e.pointerId); }, { capture: true });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) W.addEventListener(type, e => pointers.delete(e.pointerId), { capture: true });
W.addEventListener('blur', () => pointers.clear());
W.addEventListener('wheel', e => {
  if (!active) return;
  if (pointers.size || e.buttons) {
    e.preventDefault(); e.stopPropagation(); inputStats.ignoredWheels++;
    return; // 单指/右键拖动拥有本次操作；忽略触控板余下的零星 wheel，不混入另一种运动
  }
  if (e.ctrlKey || e.metaKey) {
    // 触控板捏合（浏览器报成按着 Ctrl 的滚轮）：原控制器对它的反应太慢，这里自己按手势幅度缩放；最远最近仍由 confine() 收住
    e.preventDefault(); e.stopPropagation(); inputStats.pinchWheels = (inputStats.pinchWheels || 0) + 1;
    cam.zoom = Math.min(ZOOM[1], Math.max(ZOOM[0], cam.zoom * Math.exp(-e.deltaY * .012))); cam.updateProjectionMatrix();
    ctl.dispatchEvent({ type: 'change' });
    return;
  }
  if (!isTrackpadScroll(e)) return; // 鼠标滚轮由原 OrbitControls 缩放
  e.preventDefault(); e.stopPropagation();
  inputStats.panWheels++;
  cam.updateMatrixWorld(); R.setFromMatrixColumn(cam.matrixWorld, 0); U.setFromMatrixColumn(cam.matrixWorld, 1); cam.getWorldDirection(D);
  const mpp = (cam.top - cam.bottom) / cam.zoom / renderer.domElement.clientHeight;   // 一个屏幕像素合多少米
  d.set(0, 0, 0).addScaledVector(R, e.deltaX * mpp).addScaledVector(U, -e.deltaY * mpp);   // 画面跟着手指走
  shift(d); ctl.update();
}, { capture: true, passive: false });

// ---------- 亮相 ----------
clearInterval(loadTimer); timings.shownMs = Math.round(performance.now());
$('loading').style.opacity = 0; setTimeout(() => $('loading').remove(), 1200);
$('card').classList.add('on'); $('hint').classList.add('on');
window.dispatchEvent(new Event('shikumen-title'));

// ---------- 默认直达门前；也可主动选择完整走进弄堂 ----------
let busy = false;
async function startEntry(walkIn = false) {
  if (busy || entry) return; busy = true;
  $('start').disabled = $('walk-start').disabled = true;
  window.dispatchEvent(new Event('shikumen-game-start'));
  try {
    const entryModule = new URL('./entry.js', import.meta.url);
    entryModule.search = new URL(import.meta.url).search;
    const { beginEntry } = await import(entryModule.href);
    $('card').classList.remove('on'); $('card').inert = true; $('hint').classList.remove('on');
    active = false; T.setExternalRendering?.(true);
    entry = beginEntry({ T, THREE, W, cam, ctl, renderer, rawRender, deco, BG, paintBackdrop,
      done() {   // 回到首页：恢复起始机位、限位和纸签
        entry = null; T.setExternalRendering?.(false); reset(); active = true; ctl.update(); draw();
        $('card').inert = false; $('card').classList.add('on'); $('hint').classList.add('on');
        window.dispatchEvent(new Event('shikumen-title'));
        $(walkIn ? 'walk-start' : 'start').focus({ preventScroll: true });
      } }, { walkIn });
  } finally { busy = false; $('start').disabled = $('walk-start').disabled = false; }
}
$('start').onclick = () => startEntry();
$('walk-start').onclick = () => startEntry(true);

window.__HOME = { get entry() { return entry; }, loadStreetDetail, timings, setBackdrop, deco, LIMIT, BLOCK, POLAR, fitZoom, panBox, confine, T, THREE, cam, ctl, setPose, settle, reset, edges, draw, snap, step, HOME,
  get good() { return snap(); }, guardStats: { maxExtraRenders: 0, frame: null, totals: {} }, inputStats, get panInset() { return panInset; },
  set active(v) { active = v; } };
