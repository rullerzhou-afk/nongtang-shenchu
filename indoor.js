import { shut as closeKitchenDoor } from './vignettes/extra-backdoor.js';
import { roomLinks, destinations, scenery, followUps, farewells, explorationControls } from './vignettes/exploration.js';
const { ROOMS } = await import(new URL('./rooms.js' + new URL(import.meta.url).search, import.meta.url).href);
// 固定机位和小剧场的内容按房间分文件放在 vignettes/ 下；这个文件只管公共部分（怎么看、怎么引导、怎么演）。
const { ROOM_FILES, EXTRA_FILES = [] } = await import(new URL('./vignettes/index.js' + new URL(import.meta.url).search, import.meta.url).href);
const EXTRAS = []; for (const id of EXTRA_FILES) EXTRAS.push((await import(new URL('./vignettes/' + id + '.js' + new URL(import.meta.url).search, import.meta.url).href)).default);
const VIG = {}; for (const id of ROOM_FILES) VIG[id] = (await import(new URL('./vignettes/' + id + '.js' + new URL(import.meta.url).search, import.meta.url).href)).default;
// 进屋：点门环，黑漆门往里开，跨进天井走两三步；镜头从天井里直直升起，越过屋顶的一刻叠化成剖面，
// 再退远落成正交的斜俯视。屋里按爬楼梯的顺序一层层看：当前层彩色、墙切到腰高；下面的层留在原位变成浅灰底座；上面的层藏起来。
// 鹿鹿 2026-11-16 选定（讨论记录第 8.3 节）。只读快速版场景，不改它的文件；离开时把一切还原。
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const clamp01 = k => Math.max(0, Math.min(1, k));

// ---------- 可调参数（世界坐标，米；北是 -z）----------
const EYE = 1.5;
const GROUPS = ['L0_一楼', 'L1H_亭子间半层', 'L2_二楼', 'L2H_晒台', 'L3_局部阁楼'];
// 四档按爬楼梯的顺序：show 是彩色的层，below 是垫在下面变浅灰的层；lift 是这一档镜头目标点的高度
export const LEVELS = [
  { name: '一层', show: [0], below: [], lift: 1.0 },
  { name: '亭子间', show: [1], below: [0], lift: 2.6 },
  { name: '二层（含晒台）', show: [2, 3], below: [0, 1], lift: 4.6 },
  { name: '阁楼', show: [4], below: [0, 1, 2, 3], lift: 6.9 },
];
const COURT = [0.05, -1.25];                 // 跨进天井后站定的位置（大门在 z≈0，客堂隔扇在 z≈-3）
const HALL_LOOK = [0.05, 1.55, -3.4];        // 站在天井里看向客堂隔扇
const RISE_TOP = 10.5;                       // 从天井里升到这个高度（高过屋脊）再往后退
const RISE_BACK = 3.2;                       // 升起时同时往南（大门方向）退：先升过前墙，再退到弄堂上空，免得贴着客堂楼上的窗
const VIEW = { az: 0.66, polar: 0.62 };      // 剖面斜俯视的方向：从东南高处看（走进来的弄堂口一侧，天井在画面左下）
const NEIGH_CUT = [13, 1.2];                 // 邻居从屋脊以上慢慢切到腰高（米），变成浅灰的总平面模型，不消失
// 邻居灰模只留砌体和地面（砖、石、灰泥、地砖、石板）；木构、五金、玻璃、布、门牌都藏起来，免得切开后露出楼梯和门扇
const NEIGH_KEEP = /砖|砌筑|石板|石材|灰泥|内墙|地砖|实铺|地层|弄堂|THRESHOLD|portal_cool_grey_stone|楼板_灰砂面/;
// 每间房的范围、落脚点和双向门口来自当前 B1 建筑。
const T_DOOR = 1500;                         // 点门或按 E 后走过去的时间
// 房间里走动：方向键或 WASD 走，拖动转头。滚轮可在 42–60°之间调整视野。
// 转头：拖动方向和三维游戏一样（往右拖就往右看），一屏宽约转 1.5 倍画面宽的角度，并稍作平滑；上下各约 70°
const WALK = { speed: 1.3, accel: 7, radius: .24, eye: 1.55, pitch: 1.22, bob: .009, turn: 1.5, smooth: 16 };
const DOOR_NEAR = 1.6, DOOR_FACING = .62;   // 离门洞多近（米）、视线偏离门洞多少（弧度）以内，门框才亮；天井只有三米深，太远会一进来就亮
const T_WALLS = 700;
const ORTHO_DIST = 91.5, SWAP_DIST = 900;    // 正交相机到目标点的距离；透视镜头退到这么远再换正交，画面对得上
const FILL = 1.12;                           // 当前层的外包范围在画面里留一点边
const T_OPEN = 1300, T_WALK = 2300, T_PAUSE = 450, T_RISE = 1500, T_PULL = 2100, T_FADE = 650, T_LEVEL = 650;
const CLAY = 0xdcd8cd;                       // 下面各层的浅灰底座颜色

// 本局首次探索时提示选房，重新开局后可以再看到。
let houseHintSeen = false;

export function enterHouse(api) {
  const { T, THREE, W, pcam, ortho, ctl, rawRender, canvas, say } = api;
  const $ = id => document.getElementById(id);
  const snapImg = $('fpsnap'), levelsNav = $('levels'), roomFade = $('roomfade');
  const v = new THREE.Vector3(), look = new THREE.Vector3();
  const stats = { phase: 'opening', loadMs: 0, levelSwitches: 0 };
  let phase = 'loading', t0 = performance.now(), alive = true, level = 0, levelAnim = null;

  // Source identity lets Three reuse an already resident image while preserving
  // each texture's own colour space, filtering, wrapping and UV transform.
  const staticSources = new Map();
  function staticTexture(t, material) {
    return t?.isTexture && !t.isRenderTargetTexture && !t.isVideoTexture && !t.isCanvasTexture &&
      !material?.userData.houseTvScreensRevision && typeof t.image?.src === 'string';
  }
  // Match the pinned Three r160 upload-cache settings; UV transforms stay on
  // each Texture. Prefer an image already on the GPU over a hidden duplicate.
  function imageKey(t) {
    return t.image.src + '\0' + [t.wrapS, t.wrapT, t.wrapR || 0, t.magFilter, t.minFilter,
      t.anisotropy, t.internalFormat, t.format, t.type, t.generateMipmaps,
      t.premultiplyAlpha, t.flipY, t.unpackAlignment, t.colorSpace].join();
  }
  T.scene.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
    for (const t of Object.values(m)) if (staticTexture(t, m)) {
      const key = imageKey(t), uploaded = api.renderer.properties.get(t).__webglInit !== undefined;
      if (!staticSources.has(key) || uploaded && !staticSources.get(key).uploaded) staticSources.set(key, { source: t.source, uploaded });
    }
  });
  function reuseArrivalImages() {
    const seen = new Set(); let reused = 0, resident = 0;
    house.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
      for (const t of Object.values(m)) {
        if (!staticTexture(t, m) || seen.has(t)) continue; seen.add(t);
        // Never change the source of a texture that has already been uploaded.
        if (api.renderer.properties.get(t).__webglInit !== undefined) continue;
        const key = imageKey(t), cached = staticSources.get(key), source = cached?.source;
        if (source && source !== t.source && source.data.width === t.image.width && source.data.height === t.image.height) {
          t.source = source; reused++; if (cached.uploaded) resident++;
        } else if (!source) staticSources.set(key, { source: t.source, uploaded: false });
      }
    });
    stats.reusedImages = reused; stats.residentImageReuses = resident; stats.staticImageSources = staticSources.size;
  }

  // ---------- 层与浅灰底座 ----------
  // 离开街坊模式后，快速版显示的是这一户单独的一份（不是街坊里那份），层、门都要从它身上取
  let house = null, groups = [], roof = null;
  const clay = new THREE.MeshStandardMaterial({ color: CLAY, roughness: .95, metalness: 0 });
  // 邻居：浅灰、双面，用一张水平切面从上往下切
  const neighPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), NEIGH_CUT[0]);
  const neighClay = new THREE.MeshStandardMaterial({ color: CLAY, roughness: .95, metalness: 0, side: THREE.DoubleSide, clippingPlanes: [neighPlane] });
  const neighSaved = new Map();   // mesh -> [原材质, 原逐块颜色, 原可见]
  function claySlicedNeighbours() {
    T.neighbours.visible = true;
    if (!neighSaved.size) {
      T.neighbours.traverse(o => { if (o.isMesh) neighSaved.set(o, [o.material, o.instanceColor || null, o.visible]); });
      // 场景顶层另有一份弄堂石板（和邻居里那份重叠）：一起变浅灰，否则深浅两份交错，看着斑斑驳驳
      for (const o of T.scene.children) if (o !== T.neighbours && o !== house && o.visible && !o.isLight && o.type !== 'Object3D')
        o.traverse(m => { if (m.isMesh) neighSaved.set(m, [m.material, m.instanceColor || null, m.visible]); });
    }
    for (const o of neighSaved.keys()) {
      o.material = neighClay; if (o.isInstancedMesh) o.instanceColor = null;
      if (o.parent && isNeighbour(o) && !NEIGH_KEEP.test(o.name)) o.visible = false;
    }
    api.renderer.localClippingEnabled = true;
  }
  function isNeighbour(o) { for (let x = o; x; x = x.parent) if (x === T.neighbours) return true; return false; }
  function restoreNeighbours() {
    for (const [o, s] of neighSaved) { o.material = s[0]; if (o.isInstancedMesh) o.instanceColor = s[1]; o.visible = s[2]; }
    api.renderer.localClippingEnabled = false; neighPlane.constant = NEIGH_CUT[0];
  }


  const saved = new Map();   // mesh -> [原材质, 原逐块颜色]
  function bindHouse() {
    house = T.getSelectedHouse?.() || T.hero;
    groups = GROUPS.map(n => house.getObjectByName(n)); roof = house.getObjectByName('ROOF_相交小青瓦屋盖');
    saved.clear(); for (const g of groups) g?.traverse(o => { if (o.isMesh) saved.set(o, [o.material, o.instanceColor || null]); });
  }
  function paintLevel(k) {
    const L = LEVELS[k];
    groups.forEach((g, i) => {
      if (!g) return; const grey = L.below.includes(i);
      g.visible = grey || L.show.includes(i);
      g.traverse(o => { const s = saved.get(o); if (!s) return; o.material = grey ? clay : s[0]; if (o.isInstancedMesh) o.instanceColor = grey ? null : s[1]; });
    });
    if (roof) roof.visible = false;
  }
  // 房子换回完整墙面时会把屋里的东西全部显示出来，小剧场藏着的（客堂还没挂上的外套、换掉的果盘）也跟着冒出来。
  // 去剖面之前记下哪些东西是藏着的，回到屋里再藏回去
  let hiddenKept = [];
  function keepHidden() { hiddenKept = []; house?.traverse(o => { if (!o.visible) hiddenKept.push(o); }); }
  function hideKept() { for (const o of hiddenKept) o.visible = false; hiddenKept = []; }
  function restoreLevels() {
    for (const [o, s] of saved) { o.material = s[0]; if (o.isInstancedMesh) o.instanceColor = s[1]; }
    groups.forEach(g => g && (g.visible = true));
  }

  // ---------- 取景：当前层（连同下面的底座）的外包范围铺满画面 ----------
  const dir = new THREE.Vector3(Math.sin(VIEW.polar) * Math.sin(VIEW.az), Math.cos(VIEW.polar), Math.sin(VIEW.polar) * Math.cos(VIEW.az));
  function frameFor(k) {
    const L = LEVELS[k], box = new THREE.Box3();
    for (const i of [...L.below, ...L.show]) if (groups[i]) box.expandByObject(groups[i]);
    const c = box.getCenter(new THREE.Vector3()); c.y = L.lift;
    // 用最终方向的相机轴量外包盒在画面上的宽高
    const m = new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), R = new THREE.Vector3().setFromMatrixColumn(m, 0), U = new THREE.Vector3().setFromMatrixColumn(m, 1);
    let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).sub(c); const r = v.dot(R), u = v.dot(U); r0 = Math.min(r0, r); r1 = Math.max(r1, r); u0 = Math.min(u0, u); u1 = Math.max(u1, u);
    }
    // 画面中心对准外包盒在画面上的中心
    c.addScaledVector(R, (r0 + r1) / 2).addScaledVector(U, (u0 + u1) / 2);
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const H = FILL * Math.max(u1 - u0, (r1 - r0) / aspect);
    return { c, H };
  }
  function setOrtho(c, H) {
    ortho.position.copy(c).addScaledVector(dir, ORTHO_DIST); ctl.target.copy(c); ortho.lookAt(c);
    ortho.zoom = (ortho.top - ortho.bottom) / H; ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
  }

  // ---------- 叠化：把当前画面定格成一张图盖在上面，底下换好再淡掉 ----------
  function freeze() {
    draw(); snapImg.src = canvas.toDataURL('image/jpeg', .9);
    snapImg.style.transition = 'none'; snapImg.style.opacity = 1; snapImg.classList.add('on');
  }
  function thaw(ms) {
    requestAnimationFrame(() => requestAnimationFrame(() => { snapImg.style.transition = `opacity ${ms}ms ease`; snapImg.style.opacity = 0; }));
    setTimeout(() => { if (snapImg.style.opacity === '0') snapImg.classList.remove('on'); }, ms + 80);
  }

  // ---------- 大门两扇 ----------
  let leaves = [], leafRest = [];

  // ---------- 镜头 ----------
  let walkFrom = null, riseFrom = null, pull = null, finalFrame = null;
  const usePerspective = () => api.setCamera('persp'), useOrtho = () => api.setCamera('ortho');
  function lookAtYawPitch(p, target) {   // 透视相机看向某点，同时把 yaw/pitch 交回进门段（转头、回到街区都靠它）
    pcam.position.copy(p); pcam.lookAt(target); pcam.updateMatrixWorld();
  }

  function draw() {
    if (phase === 'loading') return;   // 纸色盖满时不画，留给载入和准备画面
    api.prepareReflections?.(api.camera() === 'ortho' ? ortho : pcam);
    if (api.camera() === 'ortho') rawRender(T.scene, ortho); else rawRender(T.scene, pcam);
  }

  // 第一步：街坊里这一户的黑漆门先在眼前打开（不用等载入）
  {
    const gate = T.hero.getObjectByName('石库门_双扇黑漆门');
    leaves = gate ? gate.children.filter(o => o.userData.kind === 'door_leaf') : [];
    leafRest = leaves.map(o => o.rotation.y);
    phase = 'opening'; stats.phase = phase; api.hideToast();
  }
  const streetLeaves = leaves, streetRest = leafRest;
  const note = $('fpnote'), noteStep = $('fpnotestep');
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function stepText(s) { noteStep.textContent = s; await nextFrame(); }

  // 字条盖满后直接准备完整房屋。剖面到首次按“全屋”时才切换，
  // 进门只实画门口和天井两个实际机位，不遍历编译看不到的整栋材质。
  async function loadUnderNote() {
    const t = performance.now();
    phase = 'loading'; stats.phase = phase;
    await stepText('进门');
    await api.applyView({ doorsOpen: true, cut: false, roof: true });
    if (!alive) return; stats.loadMs = Math.round(performance.now() - t);
    bindHouse(); addExtras();
    const gate = house.getObjectByName('石库门_双扇黑漆门');
    leaves = gate ? gate.children.filter(o => o.userData.kind === 'door_leaf') : [];
    leafRest = leaves.map(o => o.userData.restOpening ?? 0);
    api.showStreet();
    await stepText('屋里厢摆好');
    const t1 = performance.now(), textures = new Set();
    house.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); });
    const pending = () => [...textures].filter(t => !t.image || (Array.isArray(t.image) ? t.image : [t.image]).some(im => !im || im.complete === false));
    while (pending().length) {
      if (!alive) return;
      if (performance.now() - t1 > 300000) throw new Error('Arrival textures did not finish loading');
      await nextFrame();
    }
    stats.textureWaitMs = Math.round(performance.now() - t1);
    reuseArrivalImages();
    await stepText('开灯');
    const p = pcam.position.clone(), q = pcam.quaternion.clone();
    try {
      api.prepareReflections?.(pcam); rawRender(T.scene, pcam);
      pcam.position.set(COURT[0], EYE, COURT[1]); pcam.lookAt(new THREE.Vector3().fromArray(HALL_LOOK)); pcam.updateMatrixWorld();
      api.prepareReflections?.(pcam); rawRender(T.scene, pcam);
    } finally { pcam.position.copy(p); pcam.quaternion.copy(q); pcam.updateMatrixWorld(); }
    stats.arrivalPrepareMs = Math.round(performance.now() - t1);
    if (!alive) return;
    phase = 'reveal'; stats.phase = phase; draw();
    stats.noteMs = Math.round(performance.now() - t);
    note.classList.remove('on');
    setTimeout(() => { if (!alive) return; walkFrom = { p: pcam.position.clone(), q: pcam.quaternion.clone() }; phase = 'walk'; stats.phase = phase; t0 = performance.now(); }, 950);
  }

  function tick(now) {
    if (!alive) return;
    if (phase === 'opening') {   // 门往里开，开到一大半时纸色字条淡上来
      const k = ease(clamp01((now - t0) / T_OPEN));
      leaves.forEach((o, i) => { o.rotation.y = leafRest[i] + (o.userData.hinge === 'right' ? -1 : 1) * 1.5 * k; });
      if (k > .55 && !note.classList.contains('on')) { api.hideToast(); note.classList.add('on'); }
      if (now - t0 >= T_OPEN + 150) { phase = 'noted'; loadUnderNote().catch(e => { if (!alive) return; phase = 'failed'; stats.phase = phase; noteStep.textContent = '屋里暂时没准备好，请刷新再试'; console.error(e); }); }
    }
    if (phase === 'walk') {   // 跨过门槛走进天井，视线慢慢转向客堂
      const u = clamp01((now - t0) / T_WALK), k = ease(u);
      v.set(lerp(walkFrom.p.x, COURT[0], k), EYE, lerp(walkFrom.p.z, COURT[1], k));
      const qTo = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v, look.fromArray(HALL_LOOK), new THREE.Vector3(0, 1, 0)));
      pcam.position.copy(v); pcam.quaternion.copy(walkFrom.q).slerp(qTo, easeOut(clamp01(u * 1.3))); pcam.updateMatrixWorld();
      if (u >= 1) { phase = 'pause'; stats.phase = phase; t0 = now; }
    }
    if (phase === 'pause' && now - t0 > T_PAUSE) startWalking('courtyard');   // 进了天井就交给人自己走
    if (phase === 'rise') {   // 从天井里直直升起（天井没有屋顶），视线从客堂慢慢低下来看向整栋房子的中心
      const u = clamp01((now - t0) / T_RISE), k = ease(u);
      v.set(riseFrom.p.x, lerp(EYE, RISE_TOP, k), riseFrom.p.z + RISE_BACK * ease(clamp01((u - .35) / .65)));
      look.copy(riseFrom.look).lerp(finalFrame.c, easeOut(u));
      lookAtYawPitch(v, look);
      if (u >= 1) {
        // 高过屋脊：定格这一帧，底下换成剖面（屋顶、上面各层藏起，墙切到腰高），四周从全景换成纸色
        freeze(); phase = 'swap'; stats.phase = phase;
        const top = v.clone();
        (async () => {
          keepHidden(); await api.toCutaway(); if (!alive) return; viewExtras();   /* 切到全屋剖面也会把门转开，后门要摆回去 */
          bindHouse(); finalFrame = frameFor(0); lim = limitsFor(0);
          paintLevel(0); claySlicedNeighbours();
          const d0 = top.distanceTo(finalFrame.c);
          pull = { u0: top.sub(finalFrame.c).normalize(), d0, h0: 2 * d0 * Math.tan(pcam.fov * Math.PI / 360) };
          draw(); thaw(T_FADE);
          phase = 'pull'; stats.phase = phase; t0 = performance.now();
        })();
      }
    }
    if (phase === 'pull') {   // 往后退远并收窄视角，透视慢慢变平，最后换成正交的斜俯视
      const u = clamp01((now - t0) / T_PULL), k = ease(u);
      const ud = pull.u0.clone().lerp(dir, k).normalize();
      const d = pull.d0 * Math.pow(SWAP_DIST / pull.d0, Math.pow(k, 1.6)), h = lerp(pull.h0, finalFrame.H, k);
      pcam.position.copy(finalFrame.c).addScaledVector(ud, d); pcam.lookAt(finalFrame.c);
      pcam.fov = 2 * Math.atan(h / 2 / d) * 180 / Math.PI; pcam.near = Math.max(.08, d - 140, d * .012); pcam.far = d + 160; pcam.updateProjectionMatrix();
      neighPlane.constant = lerp(NEIGH_CUT[0], NEIGH_CUT[1], ease(clamp01(u * 1.15)));
      if (u >= 1) {
        pcam.fov = api.FOV; pcam.near = .08; pcam.far = 520; pcam.updateProjectionMatrix();
        setOrtho(finalFrame.c, finalFrame.H); useOrtho(); api.enableOrbit(true, limitsFor(0));
        levelsNav.classList.add('on'); syncNav();
        say('拖动转看　·　右边换楼层', 4200);
        phase = 'house'; stats.phase = phase;
      }
    }
    if (phase === 'house' && levelAnim) {
      const k = ease(clamp01((now - levelAnim.t0) / T_LEVEL));
      ctl.target.lerpVectors(levelAnim.fromT, levelAnim.toT, k); ortho.position.lerpVectors(levelAnim.fromP, levelAnim.toP, k);
      ortho.zoom = lerp(levelAnim.fromZ, levelAnim.toZ, k); ortho.updateProjectionMatrix(); ortho.lookAt(ctl.target); ortho.updateMatrixWorld();
      if (k >= 1) levelAnim = null;
    }
    if (phase === 'house') clampOrbit();
    roomTick(now);
  }

  // ---------- 屋里：转看的范围，换层 ----------
  let lim = null;
  function limitsFor(k) {
    const f = frameFor(k), z = (ortho.top - ortho.bottom) / f.H;
    const box = new THREE.Box3(); for (const i of [...LEVELS[k].below, ...LEVELS[k].show]) if (groups[i]) box.expandByObject(groups[i]);
    return { minZoom: z * .85, maxZoom: z * 3.2, minPolar: .22, maxPolar: 1.05, box, lift: LEVELS[k].lift };
  }
  function clampOrbit() {   // 画面中心不离开这几层的范围，高度固定在这一档
    if (!lim || levelAnim) return;
    const t = ctl.target, b = lim.box; let dx = Math.min(b.max.x, Math.max(b.min.x, t.x)) - t.x, dz = Math.min(b.max.z, Math.max(b.min.z, t.z)) - t.z;
    if (Math.abs(dx) > 1e-6 || Math.abs(dz) > 1e-6) { t.x += dx; t.z += dz; ortho.position.x += dx; ortho.position.z += dz; ortho.updateMatrixWorld(); }
  }
  function setLevel(k) {
    if (phase !== 'house' || k === level || levelAnim) return;
    freeze(); paintLevel(k); level = k; stats.levelSwitches++;
    // 保持当前转到的角度，只把目标点抬到这一档、远近换成这一档合适的大小
    const f = frameFor(k), off = ortho.position.clone().sub(ctl.target);
    levelAnim = { t0: performance.now(), fromT: ctl.target.clone(), toT: f.c.clone(), fromP: ortho.position.clone(), toP: f.c.clone().add(off), fromZ: ortho.zoom, toZ: (ortho.top - ortho.bottom) / f.H };
    lim = limitsFor(k); api.enableOrbit(true, lim);
    draw(); thaw(T_LEVEL);
    syncNav();
  }
  function syncNav() { levelsNav.querySelectorAll('button').forEach(b => b.classList.toggle('cur', +b.dataset.level === level)); }
  levelsNav.querySelectorAll('button').forEach(b => { b.onclick = () => setLevel(+b.dataset.level); });

  // ---------- 导演机位：点进房间 ----------
  const canvasEl = api.renderer.domElement, ui = $('fpui'), upBtn = $('fpup'), toast = $('fptoast');
  const zoomUi = $('roomzoom'), widerBtn = $('roomwider'), closerBtn = $('roomcloser');
  let zoomOffset = 0;
  const viewFov = R => Math.max(42, Math.min(60, R.fov + zoomOffset));
  function zoomBy(delta) {
    if (phase !== 'room') return;
    zoomOffset = Math.max(42, Math.min(60, viewFov(room) + delta)) - room.fov;
    syncZoom();
  }
  function syncZoom() { widerBtn.disabled = viewFov(room) >= 60; closerBtn.disabled = viewFov(room) <= 42; }
  widerBtn.onclick = () => zoomBy(2); closerBtn.onclick = () => zoomBy(-2);
  const onWheel = e => { if (phase !== 'room') return; e.preventDefault(); if (e.deltaY) zoomBy(Math.sign(e.deltaY)); };
  ui.addEventListener('wheel', onWheel, { passive: false });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorHit = new THREE.Vector3();
  let hoverRoom = null, room = null, dive = null, orthoSaved = null, downAt = null;
  let yaw = 0, pitch = 0, aimYaw = 0, aimPitch = 0, vel = new THREE.Vector2(), stepPhase = 0, lastNow = 0, obstacles = [];
  const keys = new Set();
  // 鼠标移到房间上：地面铺一层暖色，四边一圈金边
  const tintMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: .34, depthWrite: false, toneMapped: false });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe9a93a, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
  const tint = new THREE.Group(), tintFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tintMat), unit = new THREE.PlaneGeometry(1, 1);
  tintFill.rotation.x = -Math.PI / 2; tint.add(tintFill);
  const edges = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(unit, edgeMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; tint.add(m); return m; });
  tintFill.renderOrder = 2; tint.visible = false; T.scene.add(tint);
  function shapeTint(R) {
    const w = R.floor[1] - R.floor[0], d = R.floor[3] - R.floor[2], cx = (R.floor[0] + R.floor[1]) / 2, cz = (R.floor[2] + R.floor[3]) / 2, y = R.floorY + .07, e = .09;
    tintFill.scale.set(w, d, 1); tintFill.position.set(cx, y, cz);
    edges[0].scale.set(w, e, 1); edges[0].position.set(cx, y + .005, R.floor[2] + e / 2); edges[1].scale.set(w, e, 1); edges[1].position.set(cx, y + .005, R.floor[3] - e / 2);
    edges[2].scale.set(e, d, 1); edges[2].position.set(R.floor[0] + e / 2, y + .005, cz); edges[3].scale.set(e, d, 1); edges[3].position.set(R.floor[1] - e / 2, y + .005, cz);
  }
  function roomAt(e) {   // 鼠标落在当前层哪间房的地面上
    const r = canvasEl.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, ortho);
    let best = null, nearest = Infinity;
    for (const [id, R] of Object.entries(ROOMS)) {
      if (R.level !== level) continue;
      const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -R.floorY), floorHit);
      if (p && p.x >= R.floor[0] && p.x <= R.floor[1] && p.z >= R.floor[2] && p.z <= R.floor[3]) {
        const distance = ray.ray.origin.distanceToSquared(p);
        if (distance < nearest) { best = id; nearest = distance; }
      }
    }
    return best;
  }
  function setHover(id) {
    if (id === hoverRoom) return; hoverRoom = id; canvasEl.style.cursor = id ? 'pointer' : '';
    if (id) { const R = ROOMS[id]; shapeTint(R); tint.visible = true; say(R.name + '　·　点一下进去', 0); }
    else { tint.visible = false; api.hideToast(); }
  }
  const onMove = e => { if (phase === 'house' && !levelAnim && !e.buttons) setHover(roomAt(e)); };
  const onDown = e => { downAt = [e.clientX, e.clientY, performance.now()]; };
  const onUp = e => {
    if (phase !== 'house' || levelAnim || !downAt) return; const [x, y, t] = downAt; downAt = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) > 6 || performance.now() - t > 600) return;
    const id = roomAt(e); if (id) enterRoom(id);
  };
  canvasEl.addEventListener('pointermove', onMove); canvasEl.addEventListener('pointerdown', onDown); canvasEl.addEventListener('pointerup', onUp);

  function defaultPose(k) { const f = frameFor(k); return { p: f.c.clone().addScaledVector(dir, ORTHO_DIST), t: f.c.clone(), z: (ortho.top - ortho.bottom) / f.H }; }
  async function enterRoom(id) {   // 从全屋点一间屋：定格剖面，底下把墙和天花换回完整的样子、站到这间屋的站位，再叠化。不飞过去——飞的路线要先转到房间正上方再沉下来，又慢又晕
    if (!alive || phase !== 'house' || levelAnim || !ROOMS[id] || ROOMS[id].level !== level) return;
    room = ROOMS[id]; setHover(null); levelsNav.classList.remove('on'); api.enableOrbit(false, lim);
    orthoSaved = { p: ortho.position.clone(), t: ctl.target.clone(), z: ortho.zoom }; dive = { R: room };   // 记下剖面的样子，点“全屋”时回到这里
    freeze(); phase = 'roomswap'; stats.phase = phase; stats.roomEnters = (stats.roomEnters || 0) + 1;
    restoreLevels(); restoreNeighbours();
    await api.applyView({ cut: false, roof: true }); if (!alive) return; viewExtras();   // 房子换视图时会把所有门重新打开，换完让附加物件把自己管的东西摆回去（厨房后门）
    bindHouse(); restoreLevels(); restoreNeighbours(); api.showStreet(); hideKept();
    const sp = VIG[id]?.spot || room; pcam.position.fromArray(sp.pos); pcam.lookAt(new THREE.Vector3().fromArray(sp.look)); pcam.updateMatrixWorld(); usePerspective();
    startWalking(id); if (fixed) { pcam.position.copy(fixed.base.pos); yaw = aimYaw = fixed.base.yaw; pitch = aimPitch = fixed.base.pitch; }
    pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); pcam.updateMatrixWorld();
    draw(); thaw(T_WALLS);
  }
  function startWalking(id) {   // 在一间房里自由走：方向键或 WASD，拖动转头；门口亮点通往别的房间
    stopRoomDrag();
    room = ROOMS[id]; level = room.level; stats.room = id;
    const e = new THREE.Euler().setFromQuaternion(pcam.quaternion, 'YXZ'); yaw = aimYaw = e.y; pitch = aimPitch = Math.max(-WALK.pitch, Math.min(WALK.pitch, e.x)); vel.set(0, 0); stepPhase = 0; keys.clear();
    pcam.fov = viewFov(room); pcam.near = .05; pcam.far = 520; pcam.updateProjectionMatrix();
    obstacles = furnitureBoxes(room); makeDoorMarks();
    phase = 'room'; stats.phase = phase; lastNow = performance.now(); zoomUi.classList.add('on'); syncZoom();
    ui.classList.add('on'); upBtn.setAttribute('aria-label', room.name + ' · 返回全屋'); upBtn.classList.add('on');
    beginFixed(id);
    if (fixed) { if (!stats.fixedHint) { stats.fixedHint = true; say('按住左键拖动四处看　·　右键拖动或 W A S D 挪一挪　·　点一下物件看细节', 7500); } }
    else if (!stats.walkHint) { stats.walkHint = true; say('方向键或 WASD 走动　·　拖动转头　·　滚轮或右上角调节远近', 6000); }
  }
  // ---------- 门洞：平时什么都不显示；走近并朝着它时门框亮一圈、出提示；点门洞或按 E 顺着走进对面那间 ----------
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const markGeo = new THREE.PlaneGeometry(1, 1);
  let marks = [], activeDoor = null, lastDoor = null, markGlow = 0;
  // 门框：一道细亮线加一圈柔光；门洞里一层很淡的暖光，人走到门口时淡掉（免得整屏发黄）
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  function makeDoorMarks() {
    clearDoorMarks();
    for (const d of room.doors || []) {
      const f = d.frame, g = new THREE.Group();
      g.position.fromArray(f.c); g.position[f.axis === 'x' ? 'x' : 'z'] += f.side * .07;
      if (f.axis === 'x') g.rotation.y = Math.PI / 2;
      for (const [mat, t, order] of [[haloMat, .14, 4], [markMat, .028, 5]])
        for (const [w, h, x, y] of [[f.w + t, t, 0, f.h / 2], [f.w + t, t, 0, -f.h / 2], [t, f.h, -f.w / 2, 0], [t, f.h, f.w / 2, 0]]) {
          const m = new THREE.Mesh(markGeo, mat); m.scale.set(w, h, 1); m.position.set(x, y, 0); m.renderOrder = order; g.add(m); }
      const haze = new THREE.Mesh(markGeo, hazeMat); haze.scale.set(f.w, f.h, 1); haze.renderOrder = 3; g.add(haze);
      g.visible = false; T.scene.add(g); marks.push([d, g]);
    }
  }
  function clearDoorMarks() { for (const [, g] of marks) T.scene.remove(g); marks = []; activeDoor = lastDoor = null; markGlow = 0; }
  function updateDoorMarks(dt, now) {
    let best = null, bestD = Infinity;
    if (phase === 'room' && !fixed) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (const [d] of marks) {
        const dx = d.frame.c[0] - pcam.position.x, dz = d.frame.c[2] - pcam.position.z, dist = Math.hypot(dx, dz);
        const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / Math.max(1e-6, dist))));
        if (dist < DOOR_NEAR && ang < DOOR_FACING && dist < bestD) { best = d; bestD = dist; }
      }
    }
    if (best !== activeDoor) { activeDoor = best; if (best) { lastDoor = best; say((best.label || ROOMS[best.to].name) + '　·　点一下或按 E', 0); } else api.hideToast(); }
    markGlow += ((activeDoor ? 1 : 0) - markGlow) * Math.min(1, dt * 7);   // 亮起、熄灭都是渐变
    const pulse = .8 + .2 * Math.sin(now / 420);
    markMat.opacity = markGlow * .9 * pulse; haloMat.opacity = markGlow * .22 * pulse;
    if (lastDoor) { const dd = Math.hypot(lastDoor.frame.c[0] - pcam.position.x, lastDoor.frame.c[2] - pcam.position.z); hazeMat.opacity = markGlow * .09 * clamp01((dd - .45) / .55); }
    for (const [d, g] of marks) g.visible = markGlow > .01 && d === lastDoor;
  }
  function doorUnderPointer(e) {   // 点的位置是否落在亮着的门洞上（门洞四周放宽一点）
    if (!activeDoor) return false; const f = activeDoor.frame, r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, pcam);
    const p = ray.ray.intersectPlane(new THREE.Plane(f.axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), -f.c[f.axis === 'x' ? 0 : 2]), floorHit);
    return !!p && Math.abs(p[f.axis === 'x' ? 'z' : 'x'] - f.c[f.axis === 'x' ? 2 : 0]) < f.w / 2 + .25 && p.y > f.c[1] - f.h / 2 - .2 && p.y < f.c[1] + f.h / 2 + .2;
  }
  let doorWalk = null;
  function goThroughDoor(d) {
    if (!alive || phase !== 'room' || !d) return; zoomUi.classList.remove('on'); api.hideToast(); keys.clear(); vel.set(0, 0); stopRoomDrag();
    if (d.fade) { beginStairFade(d); return; }
    const to = ROOMS[d.to], enter = d.enter || { pos: to.pos, look: to.look };
    const p0 = pcam.position.clone(), p1 = new THREE.Vector3(d.via[0], room.pos[1], d.via[1]), p2 = new THREE.Vector3().fromArray(enter.pos);
    const q2 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p2, new THREE.Vector3().fromArray(enter.look), new THREE.Vector3(0, 1, 0)));
    const a = p0.distanceTo(p1), b = p1.distanceTo(p2);
    doorWalk = { p0, p1, p2, q0: pcam.quaternion.clone(), q2, split: a / Math.max(1e-6, a + b), to: d.to, fov0: pcam.fov, fov2: viewFov(to), t0: performance.now(), ms: Math.max(900, T_DOOR * Math.min(1.4, (a + b) / 2.2)) };
    phase = 'doorwalk'; stats.phase = phase; activeDoor = null;
  }
  let stairFade = null;
  function beginStairFade(d) {
    stairFade = { d, t: performance.now(), swapped: false };
    phase = 'stairfade'; stats.phase = phase; activeDoor = null;
    for (const [, g] of marks) g.visible = false;
    roomFade.textContent = d.label || ROOMS[d.to].name;
    roomFade.style.opacity = '0'; roomFade.classList.add('on');
  }
  function stairTick(now) {
    const w = stairFade, u = (now - w.t) / 420;
    roomFade.style.opacity = String(ease(clamp01(w.swapped ? 2 - u : u)));
    if (u >= 1 && !w.swapped) {
      w.swapped = true; pcam.position.fromArray(w.d.enter.pos); pcam.lookAt(new THREE.Vector3().fromArray(w.d.enter.look));
      pcam.fov = viewFov(ROOMS[w.d.to]); pcam.updateProjectionMatrix(); pcam.updateMatrixWorld();
      level = ROOMS[w.d.to].level; stats.room = w.d.to;
    }
    if (u >= 2) { stairFade = null; roomFade.classList.remove('on'); stats.doors = (stats.doors || 0) + 1; stats.stairs = (stats.stairs || 0) + 1; startWalking(w.d.to); }
  }
  function doorTick(now) {
    const u = clamp01((now - doorWalk.t0) / doorWalk.ms), k = ease(u), w = doorWalk;
    if (k < w.split) pcam.position.lerpVectors(w.p0, w.p1, k / w.split); else pcam.position.lerpVectors(w.p1, w.p2, (k - w.split) / (1 - w.split));
    pcam.quaternion.copy(w.q0).slerp(w.q2, easeOut(clamp01(u * 1.15))); pcam.fov = lerp(w.fov0, w.fov2, k); pcam.updateProjectionMatrix(); pcam.updateMatrixWorld();
    if (u >= 1) { stats.doors = (stats.doors || 0) + 1; doorWalk = null; startWalking(w.to); }
  }
  async function leaveRoom() {   // “全屋”：定格屋里，直接叠化到这一层的剖面
    if (phase !== 'room') return;
    stopRoomDrag();
    for (const a of sounds) a.pause(); sounds.length = 0;
    endFixed();
    ui.classList.remove('on'); zoomUi.classList.remove('on'); upBtn.classList.remove('on'); api.hideToast(); activeDoor = null; markGlow = 0; for (const [, g] of marks) g.visible = false;
    keys.clear(); vel.set(0, 0);
    level = room.level; syncNav();
    if (!orthoSaved || dive?.R !== room) orthoSaved = orthoSaved && dive?.R?.level === room.level ? orthoSaved : defaultPose(level);
    // 不倒放进屋路线：它必经房间正上方，再转着拉远；叠化底下也不能让镜头继续动，否则会重影。
    freeze(); phase = 'roomswap'; stats.phase = phase;
    keepHidden(); await api.toCutaway(); if (!alive) return; viewExtras();   /* 切到全屋剖面也会把门转开，后门要摆回去 */
    bindHouse(); paintLevel(level); claySlicedNeighbours(); neighPlane.constant = NEIGH_CUT[1];
    ortho.position.copy(orthoSaved.p); ctl.target.copy(orthoSaved.t); ortho.zoom = orthoSaved.z; ortho.lookAt(ctl.target); ortho.updateProjectionMatrix(); ortho.updateMatrixWorld();
    pcam.fov = api.FOV; pcam.near = .08; pcam.far = 520; pcam.updateProjectionMatrix();
    useOrtho(); lim = limitsFor(level); api.enableOrbit(false, lim);
    draw(); thaw(T_WALLS);
    // 定格淡完再交回拖动、换层和点房间，免得新旧两个画面在叠化中各自移动。
    await new Promise(r => setTimeout(r, T_WALLS + 80)); if (!alive) return;
    api.enableOrbit(true, lim); levelsNav.classList.add('on'); room = null; dive = null;
    phase = 'house'; stats.phase = phase;
  }
  // 房间里：拖动转头（左右不限，上下有限）；方向键或 WASD 走动，碰到墙和落地家具就停
  function furnitureBoxes(R) {
    const out = (R.blockers || []).map(b => [b[0] - WALK.radius, b[1] + WALK.radius, b[2] - WALK.radius, b[3] + WALK.radius]);
    const g = house.getObjectByName(R.furniture), b = new THREE.Box3();
    function collect(c) {
      b.setFromObject(c); if (b.isEmpty()) return;
      const dx = b.max.x - b.min.x, dz = b.max.z - b.min.z;
      // Fixtures above the floor, curtains, wiring and surface cloths do not block feet.
      if (b.min.y > R.floorY + .28 || b.max.y < R.floorY + .28 || dx < .09 || dz < .09) return;
      if (dx * dz > 2.5 && c.children.length) { for (const child of c.children) collect(child); return; }
      out.push([b.min.x - WALK.radius, b.max.x + WALK.radius, b.min.z - WALK.radius, b.max.z + WALK.radius]);
    }
    for (const c of g?.children || []) collect(c);
    return out;
  }
  function free(x, z) {
    const r = WALK.radius, areas = room.walkAreas || [room.walk];
    if (!areas.some(w => x >= w[0] + r && x <= w[1] - r && z >= w[2] + r && z <= w[3] - r)) return false;
    return !obstacles.some(o => x > o[0] && x < o[1] && z > o[2] && z < o[3]);
  }
  function walkTick(now) {
    if (fixed) return fixedTick(now);
    const dt = Math.min(.05, (now - lastNow) / 1000); lastNow = now;
    const sm = 1 - Math.exp(-dt * WALK.smooth); yaw += (aimYaw - yaw) * sm; pitch += (aimPitch - pitch) * sm;
    const f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), sd = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const len = Math.hypot(f, sd) || 1, tx = (-Math.sin(yaw) * f + Math.cos(yaw) * sd) / len * WALK.speed, tz = (-Math.cos(yaw) * f - Math.sin(yaw) * sd) / len * WALK.speed;
    const k = Math.min(1, dt * WALK.accel); vel.x += ((f || sd ? tx : 0) - vel.x) * k; vel.y += ((f || sd ? tz : 0) - vel.y) * k;
    const targetFov = viewFov(room);
    if (Math.abs(pcam.fov - targetFov) > .001) { pcam.fov = lerp(pcam.fov, targetFov, sm); pcam.updateProjectionMatrix(); }
    const p = pcam.position; let moved = 0;
    if (free(p.x + vel.x * dt, p.z)) { p.x += vel.x * dt; moved += Math.abs(vel.x * dt); } else vel.x = 0;
    if (free(p.x, p.z + vel.y * dt)) { p.z += vel.y * dt; moved += Math.abs(vel.y * dt); } else vel.y = 0;
    stepPhase += moved * 5.2;                                        // 走动时视线随步子极轻地起伏
    const sp = Math.hypot(vel.x, vel.y) / WALK.speed;
    p.y = lerp(p.y, room.pos[1] + Math.sin(stepPhase) * WALK.bob * sp, Math.min(1, dt * 6));
    pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); pcam.updateMatrixWorld();
    if (moved) stats.walked = +((stats.walked || 0) + moved).toFixed(2);
  }
  const KEYMAP = { w: 'w', arrowup: 'w', s: 's', arrowdown: 's', a: 'a', arrowleft: 'a', d: 'd', arrowright: 'd' };
  const onKey = e => {
    if (phase !== 'room') return; const key = e.key.toLowerCase();
    if (key === ' ' && e.repeat && story.on && story.state === 'card') { e.preventDefault(); return; }
    if (exploring && (key === 'enter' || key === ' ') && e.target.closest?.('#exploration button')) return;
    if (fixed) { if ('wasd'.includes(key) && key.length === 1 && !e.metaKey && !e.ctrlKey) { if (e.type === 'keydown') pan.keys.add(key); else pan.keys.delete(key); e.preventDefault(); return; }   /* W A S D 平移镜头 */ if (e.type === 'keydown' && fixedKey(key)) e.preventDefault(); return; }
    if ((key === 'e' || key === 'enter') && e.type === 'keydown' && activeDoor) { e.preventDefault(); goThroughDoor(activeDoor); return; }
    const k = KEYMAP[key]; if (!k) return; e.preventDefault(); if (e.type === 'keydown') keys.add(k); else keys.delete(k);
  };
  const onBlur = () => { keys.clear(); pan.keys.clear(); stopRoomDrag(); };
  for (const w of [window, W]) { w.addEventListener('keydown', onKey); w.addEventListener('keyup', onKey); w.addEventListener('blur', onBlur); }
  let roomDrag = null;
  function stopRoomDrag() {
    const pointerId = roomDrag?.pointerId;
    roomDrag = null;
    ui.classList.remove('drag');
    if (pointerId != null && ui.hasPointerCapture(pointerId)) ui.releasePointerCapture(pointerId);
  }
  const turnRate = () => {   // 每像素转多少：按当前镜头的横向视角算，一屏宽约转 1.5 倍画面宽
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight), h = 2 * Math.atan(Math.tan(pcam.fov * Math.PI / 360) * aspect);
    return h / Math.max(1, canvas.clientWidth) * WALK.turn;
  };
  const onUiDown = e => {
    if (phase !== 'room' || roomInteraction || roomDrag) return;
    const panning = e.button === 2;
    if (panning ? !fixed || fixed.anim : e.button !== 0 && e.pointerType === 'mouse') return;
    roomDrag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
      yaw: aimYaw, pitch: aimPitch, rate: turnRate(), panning, moved: false };
    ui.setPointerCapture(e.pointerId);
    ui.classList.add('drag');
  };
  const onUiMove = e => {
    if (phase !== 'room') return;
    const drag = roomDrag;
    if (!drag) { if (fixed) fixedHover(e); return; }
    if (e.pointerId !== drag.pointerId) return;
    if (e.pointerType === 'mouse' && !(e.buttons & (drag.panning ? 2 : 1))) { stopRoomDrag(); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.panning) {
      pan.x -= dx * PAN.perPx; pan.y += dy * PAN.perPx; panClamp(fixed.focus || fixed.base);
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    drag.moved ||= Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 5;
    aimYaw = drag.yaw - dx * drag.rate;
    aimPitch = Math.max(-WALK.pitch, Math.min(WALK.pitch, drag.pitch - dy * drag.rate));
    if (fixed) { fixedClamp(); drag.x = e.clientX; drag.y = e.clientY; drag.yaw = aimYaw; drag.pitch = aimPitch; }   // 转到头后，往回拖立刻有反应
  };
  const onUiUp = e => {
    const drag = roomDrag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    stopRoomDrag();
    if (phase !== 'room' || e.type !== 'pointerup' || drag.panning || drag.moved ||
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 5) return;
    if (fixed) { fixedTap(e); return; }
    if (doorUnderPointer(e)) goThroughDoor(activeDoor);
  };
  ui.addEventListener('pointerdown', onUiDown); ui.addEventListener('pointermove', onUiMove); ui.addEventListener('pointerup', onUiUp); ui.addEventListener('pointercancel', onUiUp); ui.addEventListener('lostpointercapture', onUiUp); ui.addEventListener('contextmenu', e => { if (phase === 'room') e.preventDefault(); });
  upBtn.onclick = () => leaveRoom();


  // ---------- 固定机位（公共部分）----------
  // 鹿鹿 2026-11-17：要“人站在屋里”的感觉，不要人物，也不要在小房间里自己走。
  // 每间屋一个人眼高度的站位（在 vignettes/<房间>.js 的 spot 里）；只能转头；别的视角由物件带过去：点物件凑近，点椅子坐下。
  const FIX = { turn: .95, tilt: .34, lean: .34, leanTilt: .24, move: 4.2, wide: 6, down: .66, seatTurn: 1.25, seatTilt: .5 };   // 站位上左右、上下能转多少（弧度）；凑近后能转多少；凑近的快慢；视野放宽几度；坐下后能转多少
  // 物件带人：点到这些陈设不是凑近看，而是做它自己的动作。现在只有“坐”：走到椅子前、转身、坐下、往后一靠。
  const canSit = o => !!fixed && !!VIG[fixed.id]?.sit?.test(o.name);   // 哪些能坐，由各房间文件的 sit 决定
  // 平移镜头：右键拖动，或 W A S D（上、左、下、右）。只在站位附近小范围挪动，换站位、换一拍就归零
  const pan = { x: 0, y: 0, key: '', keys: new Set() }, PAN = { side: .45, up: .3, down: .4, speed: .9, perPx: .0022 };
  const panLimit = b => Math.min(1, (b.dy ?? FIX.turn) / .6);   // 转头范围收得很小的机位（阁楼窗外），平移范围也跟着收小
  function panClamp(b) { const k = panLimit(b); pan.x = Math.max(-PAN.side * k, Math.min(PAN.side * k, pan.x)); pan.y = Math.max(-PAN.down * k, Math.min(PAN.up * k, pan.y)); }
  let fixed = null, fixedHoverAt = 0; const seats = new Map(), guides = [];
  const fixedUi = document.createElement('div');
  fixedUi.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);display:none;align-items:center;gap:6px;z-index:8;font:12px/1 "Songti SC","Noto Serif SC",serif;letter-spacing:.3em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 2px #000';
  const fchip = (text, label, fn) => { const b = document.createElement('button'); b.textContent = text; b.setAttribute('aria-label', label); b.onclick = e => { e.stopPropagation(); b.blur(); fn(); }; b.style.cssText = 'outline:none;padding:.8em .9em .8em 1.2em;border:0;background:none;color:inherit;opacity:.7;cursor:pointer;font:inherit;letter-spacing:inherit;text-shadow:inherit'; b.onmouseenter = () => { b.style.opacity = 1; }; b.onmouseleave = () => { b.style.opacity = .7; }; fixedUi.append(b); return b; };
  const fPrev = fchip('‹', '上一个位置', () => stepSpot(-1)), fCount = document.createElement('span'); fCount.style.cssText = 'min-width:4.5em;text-align:center;opacity:.55'; fixedUi.append(fCount);
  const fNext = fchip('›', '下一个位置', () => stepSpot(1)), fDoor = fchip('', '去隔壁', () => goRoom(VIG[fixed.id].next.to)), fBack = fchip('退后', '回到站位', () => leanBack());
  document.body.append(fixedUi);
  function syncFixedUi() {
    fixedUi.style.display = fixed ? 'flex' : 'none'; if (!fixed) return;
    if (exploring) { fixedUi.style.display = 'none'; return; }
    const next = VIG[fixed.id].next; fDoor.textContent = next?.label || '';
    const busy = fixed.focus || fixed.anim || story.on;
    // 鹿鹿 2026-11-17：不要“1/3”换站位，每间屋只有一个站的地方，别的视角都由物件带过去。换房间的文字只在没有光点引导时出现。
    fPrev.style.display = fNext.style.display = fCount.style.display = 'none'; fDoor.style.display = busy || cue.def || !next ? 'none' : ''; fBack.style.display = fixed.focus && !fixed.anim && (!story.on || VIG[fixed.id]?.props && story.state === 'guide') ? '' : 'none'; /* 小剧场进行中不出换房间的文字，免得和词卡、字幕挤在一起 */
    fBack.textContent = fixed.focus?.seated ? '起身 · 空格' : '退后';
  }
  const near = (a, to) => to + Math.atan2(Math.sin(a - to), Math.cos(a - to));   // 把角度 a 换成离 to 最近的那一圈
  function aimFrom(pos, target) {   // 站在 pos 看向 target 的转头角度（接着当前的 yaw，不绕远路）
    const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0)), e = new THREE.Euler().setFromRotationMatrix(m, 'YXZ');
    return { yaw: near(e.y, yaw), pitch: e.x };
  }
  function spotBase(i) { const sp = fixed.spots[i], pos = new THREE.Vector3().fromArray(sp.pos), a = aimFrom(pos, new THREE.Vector3().fromArray(sp.look)); return { pos, yaw: a.yaw, pitch: a.pitch, dy: FIX.turn, dp: VIG[fixed.id].lookUp ?? FIX.tilt, down: FIX.down }; }   // lookUp：这间屋能抬头多少（露天的天井要能望到天）
  function beginFixed(id) {
    if (!VIG[id]) { endFixed(); return; }
    for (const a of sounds) a.pause(); sounds.length = 0;   // 换一间屋：上一间还响着的声音（无线电、电风扇）停掉
    storyPause(); cueClear(); subtitleOff(); story = storyOf(id);
    fixed = { id, spots: [VIG[id].spot], i: 0, base: null, focus: null }; fixed.base = spotBase(0); document.body.classList.add('cine');
    aimYaw = fixed.base.yaw; aimPitch = fixed.base.pitch; keys.clear(); vel.set(0, 0); stats.fixed = id + ':0'; if (VIG[id].linear) upBtn.classList.remove('on'); syncRoomExit(); makeGuides(); syncFixedUi(); storyUi();
    if (exploring) {
      clearGuides(); clearDoors(); storyExit.style.display = roomExit.style.display = 'none';
      story.def?.resume?.(H, story.data); renderExploration(); return;
    }
    if (story.beats.length && !story.finished) storyEnter();
    else if (story.started) story.def?.resume?.(H,story.data);
    // 这间屋站定后的引导（没有小剧场，或小剧场不在进行时），由房间文件的 cue 给出
    if (story.finished && story.beats.length && id !== 'hall' && VIG[id].replay !== false) { offerStoryReplay(id); return; }   // 房间文件写 replay: false：演过以后再进来不问“重走剧情”，直接是演完的样子（后天井）
    roomCue(id); syncExit(); makeDoors();
  }
  function roomCue(id) { if (exploring) return; if (!story.on && VIG[id].cue) { const first = !story.seen; story.seen = true; const c = VIG[id].cue(H, { first }); if (c) cueSet({ lookFirst: !!c.sub && !c.screenCenter, ...c, run: c.run || (() => goRoom(VIG[id].next.to)), at: () => new THREE.Vector3().fromArray(c.at) }); } }
  function endFixed() { if (!fixed) return; if (exploring) { stopExploringItem(); exploreUi.hide(); follow = null; hallObjects = false; } clearDoors(); storyExit.style.display = 'none'; storyEnd.style.display = 'none'; cancelRoomInteraction(); roomExit.style.display = 'none'; storyPause(); cueClear(); subtitleOff(); document.body.classList.remove('cine'); storySets.style.display = 'none'; storyBook.style.display = 'none'; fixed = null; ui.style.cursor = ''; clearGuides(); syncFixedUi(); }
  function fixedClamp() {
    if (exploring && !story.single && !follow && !fixed.focus && !stats.ended) return;
    const b = fixed.focus || fixed.base;
    aimYaw = Math.max(b.yaw - b.dy, Math.min(b.yaw + b.dy, aimYaw));
    aimPitch = Math.max(b.pitch - (b.down ?? b.dp), Math.min(b.pitch + b.dp, aimPitch));
  }
  function fixedTick(now) {
    const dt = Math.min(.05, (now - lastNow) / 1000); lastNow = now;
    storyTick(now);
    if (fixed.anim) { animTick(now); placeGuides(); placeDoors(); return; }
    const b0 = fixed.focus || fixed.base, reading = !!roomInteraction || story.on && (story.state === 'card' || story.state === 'note');
    fixedClamp();
    const sm = 1 - Math.exp(-dt * WALK.smooth); yaw += (aimYaw - yaw) * sm; pitch += (aimPitch - pitch) * sm;
    const wide = Math.min(60, viewFov(room) + FIX.wide), targetFov = fixed.focus && !fixed.focus.seated ? Math.min(wide, 48) : wide;
    if (Math.abs(pcam.fov - targetFov) > .001) { pcam.fov = lerp(pcam.fov, targetFov, 1 - Math.exp(-dt * FIX.move)); pcam.updateProjectionMatrix(); }
    const pk = b0.pos.x.toFixed(3) + ',' + b0.pos.y.toFixed(3) + ',' + b0.pos.z.toFixed(3); if (pk !== pan.key) { pan.key = pk; pan.x = pan.y = 0; }   // 换了站位：平移归零
    if (pan.keys.size && !reading && !fixed.replayChoice) { const st = PAN.speed * dt; pan.x += ((pan.keys.has('d') ? 1 : 0) - (pan.keys.has('a') ? 1 : 0)) * st; pan.y += ((pan.keys.has('w') ? 1 : 0) - (pan.keys.has('s') ? 1 : 0)) * st; panClamp(b0); }
    const want = v.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(pan.x).add(b0.pos); want.y += pan.y;
    if (room?.floor && b0.pos.x > room.floor[0] && b0.pos.x < room.floor[1] && b0.pos.z > room.floor[2] && b0.pos.z < room.floor[3]) { want.x = Math.max(room.floor[0] + .22, Math.min(room.floor[1] - .22, want.x)); want.z = Math.max(room.floor[2] + .22, Math.min(room.floor[3] - .22, want.z)); }   // 不挪出这间屋的墙
    stats.pan = [+pan.x.toFixed(3), +pan.y.toFixed(3)];
    pcam.position.lerp(want, 1 - Math.exp(-dt * FIX.move));
    pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); pcam.updateMatrixWorld(); placeGuides(); placeDoors(); if (exploring) exploreUi.place(pcam, canvas.getBoundingClientRect());
  }
  // ----- 坐下 / 起身：一串关键姿势，按时间依次过渡 -----
  function seatOf(o) {   // 椅面高度、朝向（靠背在哪一侧，人就背对哪一侧）
    if (seats.has(o)) return seats.get(o);
    const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), top = bb.min.y + (bb.max.y - bb.min.y) * .62, sum = new THREE.Vector3(), q = new THREE.Vector3(); let n = 0;
    o.updateWorldMatrix(true, true); o.traverse(m => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i += 7) { q.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (q.y > top) { sum.add(q); n++; } } });
    const fwd = n ? new THREE.Vector3(c.x - sum.x / n, 0, c.z - sum.z / n) : new THREE.Vector3(0, 0, 1); if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1); fwd.normalize();
    const seatY = bb.min.y + (bb.max.y - bb.min.y) * .46, info = { c, fwd, seatY, top: bb.max.y, eye: seatY + .7 }; seats.set(o, info); return info;
  }
  function sitOn(o, after) {
    if (!fixed || fixed.anim || fixed.focus?.o === o) return; const s = seatOf(o), fy = near(Math.atan2(-s.fwd.x, -s.fwd.z), yaw);
    const stand = new THREE.Vector3(s.c.x + s.fwd.x * .42, room.pos[1], s.c.z + s.fwd.z * .42), up = new THREE.Vector3(s.c.x + s.fwd.x * .05, s.eye, s.c.z + s.fwd.z * .05), back = s.noLean ? up.clone() : new THREE.Vector3(s.c.x - s.fwd.x * .07, s.eye - .035, s.c.z - s.fwd.z * .07), tilt = s.noLean ? -.04 : .07;
    const from = { pos: pcam.position.clone(), yaw, pitch };
    fixed.anim = { t0: performance.now(), keys: [{ t: 0, ...from }, { t: 1150, pos: stand, yaw: lerp(yaw, fy, .7), pitch: -.2 }, { t: 2050, pos: up, yaw: fy, pitch: -.06 }, { t: 2700, pos: back, yaw: fy, pitch: tilt }],
      done() { fixed.focus = { o, seated: true, pos: back.clone(), yaw: fy, pitch: tilt, dy: FIX.seatTurn, dp: FIX.seatTilt, stand }; aimYaw = yaw; aimPitch = pitch; if (after) after(); else say('坐下了　·　四处看看，按空格起身', 2600); } };
    fixed.focus = null; stats.fixedFocus = o.name; stats.sits = (stats.sits || 0) + 1; api.hideToast(); syncFixedUi();
  }
  function standUp() {
    const f = fixed.focus, b = fixed.base; if (!f?.seated || fixed.anim) return; const by = near(b.yaw, yaw);
    fixed.anim = { t0: performance.now(), keys: [{ t: 0, pos: pcam.position.clone(), yaw, pitch }, { t: 650, pos: f.pos.clone().setY(f.pos.y + .05), yaw: f.yaw, pitch: -.1 }, { t: 1500, pos: f.stand, yaw: lerp(f.yaw, by, .35), pitch: -.08 }, { t: 2500, pos: b.pos, yaw: by, pitch: b.pitch }],
      done() { b.yaw = by; aimYaw = yaw; aimPitch = pitch; stats.fixedFocus = null; if (VIG[fixed.id]?.props) resumeRoomCue(); } };
    fixed.focus = null; api.hideToast(); syncFixedUi();
  }
  function animTick(now) {
    const a = fixed.anim, t = now - a.t0, ks = a.keys; let i = 1; while (i < ks.length - 1 && t > ks[i].t) i++;
    const k0 = ks[i - 1], k1 = ks[i], u = ease(clamp01((t - k0.t) / (k1.t - k0.t)));
    pcam.position.lerpVectors(k0.pos, k1.pos, u); yaw = lerp(k0.yaw, k1.yaw, u); pitch = lerp(k0.pitch, k1.pitch, u);
    const wide = Math.min(60, viewFov(room) + FIX.wide); if (Math.abs(pcam.fov - wide) > .001) { pcam.fov = lerp(pcam.fov, wide, .08); pcam.updateProjectionMatrix(); }
    pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); pcam.updateMatrixWorld();
    if (t >= ks[ks.length - 1].t) { fixed.anim = null; a.done(); syncFixedUi(); }
  }
  // ----- 引导：能坐的椅子上方浮一个小圈和“坐一坐”，看得见时才显示 -----
  function makeGuides() {
    clearGuides(); const g = house.getObjectByName(room.furniture); if (!g || VIG[fixed?.id]?.sitGuides === false || story.on || (story.beats.length && !story.finished)) return;
    for (const o of g.children) if (canSit(o)) {
      const el = document.createElement('button'); el.setAttribute('aria-label', '坐到' + fixedLabel(o)); el.innerHTML = '<i></i><span>坐一坐</span>';
      el.style.cssText = 'outline:none;position:fixed;left:0;top:0;z-index:8;display:none;align-items:center;gap:12px;padding:18px 22px 18px 18px;border:0;background:none;cursor:pointer;font:18px/1 \'Songti SC\',\'Noto Serif SC\',serif;letter-spacing:.32em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 2px #000';   // 四周留出一圈看不见的可点范围
      el.firstChild.style.cssText = 'flex:none;width:24px;height:24px;box-sizing:border-box;border-radius:50%;border:3px solid #e6c27a;background:rgba(230,194,122,.18);animation:cinepulse 1.9s ease-in-out infinite';
      el.onclick = e => { e.stopPropagation(); sitOn(o); }; document.body.append(el); guides.push({ o, el });
    }
  }
  function clearGuides() { for (const g of guides) g.el.remove(); guides.length = 0; }
  function placeGuides() {
    const r = canvas.getBoundingClientRect(), fwd = v.set(0, 0, -1).applyQuaternion(pcam.quaternion).clone();
    for (const g of guides) {
      const s = seatOf(g.o), hide = !fixed || fixed.anim || fixed.focus?.o === g.o || phase !== 'room' || (fixed.focus?.seated && cue.shown)   /* 坐着且有引导时，别的椅子上的“坐一坐”先收起，免得抢眼 */;
      look.set(s.c.x, s.top + .1, s.c.z); const ahead = look.clone().sub(pcam.position).dot(fwd) > .2; look.project(pcam);
      const x = r.left + (look.x + 1) / 2 * r.width, y = r.top + (1 - look.y) / 2 * r.height, on = !hide && ahead && Math.abs(look.x) < .96 && Math.abs(look.y) < .92;
      g.el.style.display = on ? 'flex' : 'none'; if (on) g.el.style.transform = `translate(${Math.round(x - 30)}px,${Math.round(y - 30)}px)`;
    }
  }
  function cutTo(set) {   // 叠化：定格当前画面，底下摆好新机位，再淡掉
    freeze(); set(); pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); pcam.updateMatrixWorld(); draw(); thaw(520);
  }
  function stepSpot(d) {
    if (phase !== 'room' || !fixed || fixed.focus || fixed.anim) return;
    cutTo(() => { fixed.i = (fixed.i + d + fixed.spots.length) % fixed.spots.length; fixed.base = spotBase(fixed.i); pcam.position.copy(fixed.base.pos); yaw = aimYaw = fixed.base.yaw; pitch = aimPitch = fixed.base.pitch; });
    stats.fixed = fixed.id + ':' + fixed.i; stats.spotCuts = (stats.spotCuts || 0) + 1; api.hideToast(); syncFixedUi();
  }
  function goRoom(to) {
    if (phase !== 'room' || !fixed || roomInteraction || fixed.focus || fixed.anim || !ROOMS[to]) return;
    const route = VIG[fixed.id]?.enterRoute;
    if (!exploring && route?.to === to) { runRoomRoute(route); return; }
    cutTo(() => { const sp = VIG[to]?.spot || ROOMS[to]; pcam.position.fromArray(sp.pos); pcam.lookAt(new THREE.Vector3().fromArray(sp.look)); pcam.updateMatrixWorld(); startWalking(to); if (fixed) { pcam.position.copy(fixed.base.pos); yaw = aimYaw = fixed.base.yaw; pitch = aimPitch = fixed.base.pitch; } });
    stats.roomCuts = (stats.roomCuts || 0) + 1; api.hideToast(); window.__SFX?.play('step', { volume: .5 });
  }
  // 点到一件陈设时显示的名字。房间文件的 names 优先；模型里给自己人看的名字（带英文、编号、“新增道具”之类）不显示
  const fixedLabel = o => { const own = VIG[fixed?.id]?.names?.[o.name]; if (own != null) return own; const t = o.name.replace(/^(客堂|hall|前天井|courtyard|竹器|老人房|屋内灯具|屋内帘子|墙上挂贴)_?/i, '').replace(/_/g, ' · '); return /[A-Za-z0-9]|新增|道具|器具|连接|表面|转轴/.test(t) ? '' : t; };
  function fixedPick(e) {   // 鼠标下、这间屋里最近的一件陈设（整件，不是零件）；电线、开关不算
    const g = house.getObjectByName(room.furniture); if (!g) return null;
    const extra = (VIG[fixed.id]?.pick || []).map(n => house.getObjectByName(n)).filter(Boolean);
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, pcam);
    const f = room.floor;
    for (const h of ray.intersectObjects([g, ...extra], true)) {
      const special = extra.find(o => { for (let p = h.object; p; p = p.parent) if (p === o) return true; return false; }); if (special) return special;
      const p = h.point; if (p.x < f[0] - .05 || p.x > f[1] + .05 || p.z < f[2] - .05 || p.z > f[3] + .05) continue;
      let o = h.object, shown = true; for (let x = o; x && x !== g; x = x.parent) if (!x.visible) shown = false;
      if (!shown) continue; while (o.parent && o.parent !== g) o = o.parent;
      if (/生活连接|明线|接线|落水|地面|铺地|石板/.test(o.name)) return null;
      return o;
    }
    return null;
  }
  function closeupPosition(o) {   // 往物件凑近：沿视线往前走一段，停在看得清的距离，稍微低头
    const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), r = .5 * bb.getSize(new THREE.Vector3()).length();
    const from = fixed.base.pos, dist = from.distanceTo(c), keep = Math.max(.75, Math.min(dist, r * 2.1 + .45));
    // 只在能站人的地方往前走：一小步一小步试，碰到家具或墙就停在前一步，不从桌子上方飘过去
    const want = c.clone().add(from.clone().sub(c).multiplyScalar(keep / Math.max(1e-6, dist))), pos = from.clone(), step = new THREE.Vector3();
    let started = free(from.x, from.z);
    for (let i = 1, n = Math.ceil(from.distanceTo(want) / .04); i <= n; i++) {
      step.lerpVectors(from, want, i / n); const ok = free(step.x, step.z);
      if (ok) started = true; else if (started) break;
      if (ok || !started) pos.copy(step);
    }
    if (!started) pos.copy(from);
    pos.y = lerp(from.y, Math.max((room.floorY > 1 ? room.floorY : 0) + 1.0, Math.min((room.floorY > 1 ? room.floorY : 0) + 1.6, c.y + .5)), .7 * Math.min(1, pos.distanceTo(from) / Math.max(.3, from.distanceTo(want))));
    return { pos, target: c };
  }
  function leanTo(o, lookAt) {
    const { pos, target } = closeupPosition(o);
    const a = aimFrom(pos, lookAt || target); fixed.focus = { o, pos, yaw: a.yaw, pitch: a.pitch, dy: FIX.lean, dp: FIX.leanTilt };
    aimYaw = a.yaw; aimPitch = a.pitch; stats.fixedFocus = o.name; stats.leans = (stats.leans || 0) + 1; if (fixedLabel(o)) say(fixedLabel(o), 0); else api.hideToast(); syncFixedUi();
  }
  function leanBack() { if (!fixed?.focus || fixed.anim) return; if (fixed.focus.seated) { standUp(); return; } fixed.focus = null; stats.fixedFocus = null; aimYaw = fixed.base.yaw; aimPitch = fixed.base.pitch; api.hideToast(); syncFixedUi(); }
  function fixedTap(e) { if (fixed.replayChoice) return; if (roomInteraction) return; if (exploring) {
      if (story.single) storyTap(e);
      else {
        const point = explorePick(e);
        if (point) point.run();
        else if (!follow) {
          const object = fixedPick(e);
          if (object) {
            const next = story.beats.find(b => b.onFurniture === object.name);
            if (canSit(object)) sitOn(object);
            else leanTo(object, next && exploreItemPoint(next)?.at);
            follow = next?.id || 'detail'; renderExploration();
          }
        }
      }
      return;
    }
    if (tryRoomProp(e)) return; if (story.on) { storyTap(e); return; } if (fixed.anim) return; const o = fixedPick(e); if (o && canSit(o) && o !== fixed.focus?.o) { if (fixed.focus?.seated) return; sitOn(o); } else if (fixed.focus?.seated) { if (!o) return; say(fixedLabel(o), 2200); } else if (o && o !== fixed.focus?.o) leanTo(o); else if (fixed.focus) leanBack(); }
  function fixedHover(e) {
    if (exploring) {
      const now = performance.now();
      if (now - fixedHoverAt > 110) { fixedHoverAt = now; ui.style.cursor = !story.single && explorePick(e) ? 'pointer' : ''; }
      return;
    }
    if (fixed.anim || roomInteraction || fixed.replayChoice) return;
    const now = performance.now(); if (now - fixedHoverAt < 110) return; fixedHoverAt = now;
    const o = fixedPick(e); ui.style.cursor = o && o !== fixed.focus?.o ? 'pointer' : '';
    if (!fixed.focus) { if (o && (VIG[fixed.id]?.props?.find(x=>x.target===o.name)?.label || fixedLabel(o))) say((VIG[fixed.id]?.props?.find(x=>x.target===o.name)?.label || fixedLabel(o)) + (canSit(o) ? '　·　点一下坐下' : ''), 0); else if (stats.fixedHintDone) api.hideToast(); }
  }
  function fixedKey(key) {
    if (exploring && (storyEnd.style.display !== 'none' || storyBook.style.display !== 'none')) return false;
    if (exploring && !story.single) return false;
    if (fixed.replayChoice) return true;
    if (roomInteraction) { if (key === 'escape') closeRoomInteraction(); else if (roomInteraction.kind === 'book' && key === 'arrowright') turnBook(1); else if (roomInteraction.kind === 'book' && key === 'arrowleft') turnBook(-1); return true; }
    if (story.on) { if (story.state === 'card' && key === ' ') { storySpeak(); return true; } if ((story.state === 'card' || story.state === 'note') && (key === 'enter' || key === ' ' || key === 'escape')) { storyAdvance(); return true; } if (story.state === 'card' || story.state === 'note') return true; return key !== 'escape'; }
    if (fixed.anim) return true;
    if (key === ' ' && fixed.focus?.seated) { leanBack(); return true; }   /* 鹿鹿 2026-11-17：坐着按空格起身 */
    if (key === 'escape' || key === 'arrowdown') { if (fixed.focus) { leanBack(); return true; } return key !== 'escape'; }
    if (fixed.focus) return false;
    if ((key === 'arrowup' || key === 'e' || key === 'enter') && VIG[fixed.id].next) { goRoom(VIG[fixed.id].next.to); return true; }
    return false;
  }
  setTimeout(() => { stats.fixedHintDone = true; }, 9000);


  // ---------- 界面与引导（B 电影字幕）----------
  // 鹿鹿 2026-11-17 选定 B：极简，字直接叠在画面上，目标处亮、四周暗。规范见 concepts/hall-vignette-v1/界面与引导规范.md。
  const mk = (tag, css, html) => { const e = document.createElement(tag); e.style.cssText = css; if (html != null) e.innerHTML = html; document.body.append(e); return e; };
  const SERIF = "'Songti SC','Noto Serif SC',serif", KAI = "'Kaiti SC','STKaiti','KaiTi'," + SERIF, GOLD = '#e6c27a';   // 字体名用单引号，才能直接写进 style="…" 里
  const SHADOW = 'text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 2px #000;';
  { const st = document.createElement('style'); st.id = 'cine-style'; st.textContent =
    '@keyframes cinepulse{0%,100%{box-shadow:0 0 0 7px rgba(230,194,122,.18),0 0 22px 6px rgba(230,194,122,.5)}50%{box-shadow:0 0 0 15px rgba(230,194,122,.05),0 0 30px 10px rgba(230,194,122,.8)}}' +
    '@keyframes cineurge{0%,100%{box-shadow:0 0 0 8px rgba(230,194,122,.3),0 0 26px 8px rgba(230,194,122,.7);transform:scale(1)}50%{box-shadow:0 0 0 24px rgba(230,194,122,.04),0 0 40px 14px rgba(230,194,122,1);transform:scale(1.2)}}' +
    'body.cine .fpchip,body.cine #roomzoom button{background:none!important;border:0!important;color:#fff!important;font-size:12px!important;letter-spacing:.3em!important;' + SHADOW + '}body.cine .fpchip.on,body.cine #roomzoom button{opacity:.62}' +
    'body.cine .fpchip.on:hover,body.cine #roomzoom button:hover{opacity:1}' +
    'body.cine #fptoast{bottom:136px!important;background:none!important;border:0!important;box-shadow:none!important;color:#fff!important;font-size:15px!important;letter-spacing:.24em!important;' + SHADOW + '}';
    document.head.append(st); }
  // 字幕：一行白字，说话的人用金色标在前面
  const subEl = mk('div', 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:9;pointer-events:none;opacity:0;transition:opacity .5s ease;white-space:nowrap;color:#fff;font:25px/1.4 ' + SERIF + ';letter-spacing:.2em;' + SHADOW);
  let subTimer = 0;
  function subtitle(text, who, ms) { clearTimeout(subTimer); subEl.innerHTML = (who ? '<i style="font-style:normal;color:' + GOLD + ';margin-right:.7em;font-size:19px">' + who + '</i>' : '') + text; subEl.style.opacity = 1; stats.subtitle = text; if (ms) subTimer = setTimeout(subtitleOff, ms); }
  function subtitleOff() { clearTimeout(subTimer); subEl.style.opacity = 0; stats.subtitle = null; }
  // 聚焦：目标处透明，四周压暗
  const spot = mk('div', 'position:fixed;inset:0;z-index:6;pointer-events:none;opacity:0;transition:opacity .9s ease');
  // 标记：金色光点、一根细线、文字。目标不在画面里时只剩文字和箭头，贴在最近的画面边上
  const cueEl = mk('button', '', '<i></i><b></b><span></span>');
  cueEl.className = 'cine-marker';
  const cueSecondary = mk('button', 'outline:none;position:fixed;left:0;top:0;z-index:9;display:none;padding:16px;border:0;background:none;cursor:pointer;color:#ddd3bf;font:16px/1.2 ' + SERIF + ';letter-spacing:.3em;' + SHADOW);
  cueSecondary.onclick = e => {
    e.stopPropagation();
    if (cueSecondary.classList.contains('explore-offer')) { beginExploration(); return; }
    const d = cue.def;
    if (!d?.secondary || !cue.shown || !fixed || fixed.anim) return;
    cueClear(); subtitleOff(); d.secondary.run();
  };
  const cue = { def: null, t0: 0, introStarted: false, shown: false, urged: false };
  cueEl.onclick = e => { e.stopPropagation(); cueFire(); };
  function cueSet(def) { cueClear(); cue.def = def; cue.t0 = performance.now(); cue.introStarted = cue.shown = cue.urged = false; if (fixed) syncFixedUi(); }
  // 门上的去处在本屋剧情结束后可见，也可以和已经停稳的剧情引导同时出现。
  const doorTemplate = cueEl.cloneNode(true);
  const doorEls = [];
  function clearDoors() { for (const x of doorEls) x.el.remove(); doorEls.length = 0; }
  function makeDoors() {
    clearDoors();
    for (const d of VIG[fixed?.id]?.doors || []) {
      if (d.when && !d.when(H)) continue;
      const el = doorTemplate.cloneNode(true);
      el.lastChild.textContent = d.label;
      el.setAttribute('aria-label', d.label);
      el.onclick = e => { e.stopPropagation(); el.blur(); stats.doorChosen = d.to; H.go(d.to); };
      cueEl.parentNode.appendChild(el);
      doorEls.push({ el, p: new THREE.Vector3().fromArray(d.at), alongsideCue: d.alongsideCue });
    }
  }
  function placeDoors() {
    if (!doorEls.length) return; const show = fixed && phase === 'room' && !story.on && !fixed.anim && !fixed.focus && !fixed.replayChoice && storyOf(fixed.id).finished;
    const r = canvas.getBoundingClientRect(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(pcam.quaternion);
    for (const x of doorEls) { const q = x.p.clone(), ahead = q.clone().sub(pcam.position).dot(fwd) > .15; q.project(pcam);
      if (!show || (cue.def && !(cue.shown && x.alongsideCue)) || !ahead || Math.abs(q.x) > .96 || q.y < -.9 || q.y > .92) { x.el.style.display = 'none'; continue; }
      const px = r.left + (q.x + 1) / 2 * r.width, py = r.top + (1 - q.y) / 2 * r.height, flip = px > r.left + r.width * .72;
      x.el.style.display = 'flex'; x.el.style.flexDirection = flip ? 'row-reverse' : 'row'; x.el.lastChild.style.textAlign = flip ? 'right' : 'left';
      x.el.style.transform = flip ? `translate(${Math.round(px)}px,${Math.round(py)}px) translateX(calc(-100% + 54px))` : `translate(${Math.round(px)}px,${Math.round(py)}px)`; }
  }
  function cueClear() { cue.def = null; cueEl.style.display = cueSecondary.style.display = 'none'; spot.style.opacity = 0; glowOff(); if (fixed) syncFixedUi(); }
  function cueFire() { const d = cue.def; if (!d || !cue.shown || !fixed || fixed.anim) return; cueClear(); subtitleOff(); stats.cuesFired = (stats.cuesFired || 0) + 1; d.run(); }
  // 剧情指定的开场转头先演完，再点亮交互提示。
  function cueTick(now) {
    cueSecondary.style.display = 'none';
    const d = cue.def;
    const intro = atTutorialStart();
    if (!exploring && fixed?.id === 'hall' && !roomInteraction &&
        (intro || (story.finished && !fixed.anim && (!d || cue.shown)))) {
      const r = canvas.getBoundingClientRect();
      cueSecondary.classList.add('explore-offer'); cueSecondary.textContent = intro ? '跳过指引' : '自己随便逛逛';
      cueSecondary.style.display = 'block';
      cueSecondary.style.transform = `translate(${r.left + r.width / 2}px,${r.bottom - 150}px) translate(-50%,-50%)`;
    }
    if (!d || !fixed) { cueEl.style.display = 'none'; spot.style.opacity = 0; return; }
    const busy = !!fixed.focus && !(d.seated && fixed.focus.seated), t = now - cue.t0;   /* seated：坐着的时候也照样出这条引导 */
    if (!cue.shown && t >= d.delay && !busy && !fixed.anim) {
      if (!cue.introStarted && d.lookFirst) {
        cue.introStarted = true;
        if (d.sub) subtitle(d.sub, d.who, 0);
        H.gaze(d.lookAt ?? d.at().toArray(), { from: d.guideFrom, go: d.guideFrom ? 1300 : 1000, hold: 120 });
        return;
      }
      cue.shown = true;
      if (d.sub && !cue.introStarted) subtitle(d.sub, d.who, 0);
      if (d.glow) glowOn(d.glow());
    }
    if (cue.shown && !cue.urged && t >= d.delay + 9500) { cue.urged = true; cueEl.firstChild.style.animation = 'cineurge 1.1s ease-in-out infinite'; }
    if (d.sub && cue.shown) subEl.style.opacity = busy ? 0 : 1;   // 坐下或凑近看别的东西时，这句字幕先收起
    if (!cue.shown || busy) { cueEl.style.display = 'none'; spot.style.opacity = 0; return; }
    const r = canvas.getBoundingClientRect(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(pcam.quaternion), p = d.at().clone(), ahead = p.clone().sub(pcam.position).dot(fwd) > .15; p.project(pcam);
    const inView = ahead && Math.abs(p.x) < .93 && p.y > -.8 && p.y < .9, turning = !!fixed.anim;
    const hint = '<small style="display:block;margin-top:6px;font-size:11px;letter-spacing:.3em;color:' + GOLD + '">点一下</small>';
    cueEl.style.display = 'flex'; cueEl.style.opacity = turning ? .0 : 1; cueEl.style.pointerEvents = turning ? 'none' : 'auto';
    if (!cue.urged) cueEl.firstChild.style.animation = 'cinepulse 1.9s ease-in-out infinite';
    cueEl.style.margin = d.screenCenter ? '0' : '-27px 0 0 -27px';
    if (d.screenCenter) {
      cueEl.firstChild.style.display = cueEl.children[1].style.display = '';
      cueEl.style.flexDirection = 'row'; cueEl.lastChild.style.textAlign = 'left';
      cueEl.lastChild.innerHTML = d.label + hint;
      cueEl.style.transform = `translate(${r.left + r.width / 2}px,${r.top + r.height / 2}px) translate(-50%,-50%)`;
      if (d.secondary && !turning) {
        cueSecondary.classList.remove('explore-offer'); cueSecondary.textContent = d.secondary.label; cueSecondary.style.display = 'block';
        cueSecondary.style.transform = `translate(${r.left + r.width / 2}px,${r.top + r.height / 2 + 68}px) translate(-50%,-50%)`;
      }
      spot.style.opacity = 0; return;
    }
    if (inView) {
      const x = r.left + (p.x + 1) / 2 * r.width, y = r.top + (1 - p.y) / 2 * r.height, flip = x > r.left + r.width * .72;
      cueEl.firstChild.style.display = cueEl.children[1].style.display = ''; cueEl.style.flexDirection = flip ? 'row-reverse' : 'row'; cueEl.lastChild.style.textAlign = flip ? 'right' : 'left';
      cueEl.lastChild.innerHTML = d.label + hint;
      cueEl.style.transform = flip ? `translate(${Math.round(x)}px,${Math.round(y)}px) translateX(calc(-100% + 54px))` : `translate(${Math.round(x)}px,${Math.round(y)}px)`;
      spot.style.background = `radial-gradient(ellipse ${Math.round(r.width * .25)}px ${Math.round(r.height * .34)}px at ${Math.round(x)}px ${Math.round(y)}px,transparent 44%,rgba(8,6,4,.64) 100%)`; spot.style.opacity = turning ? 0 : 1;
    } else {   // 不在画面里：贴在最近的边上，带一个方向箭头
      const right = ahead ? p.x > 0 : p.x < 0, x = r.left + (right ? r.width - 40 : 40), y = r.top + r.height * (ahead ? Math.max(.14, Math.min(.86, (1 - p.y) / 2)) : .5);
      cueEl.firstChild.style.display = cueEl.children[1].style.display = 'none';
      const direction = right ? d.label + '<b style="color:' + GOLD + ';font-weight:400;margin-left:.3em">›</b>' : '<b style="color:' + GOLD + ';font-weight:400;margin-right:.6em">‹</b>' + d.label;
      cueEl.lastChild.innerHTML = direction + hint;
      cueEl.style.flexDirection = 'row'; cueEl.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)` + (right ? ' translateX(-100%)' : ''); spot.style.opacity = 0;
    }
  }

  // ---------- 小剧场（公共部分）----------
  // 每间屋的戏写在 vignettes/<房间>.js 的 story 里：beats 是一拍一拍的内容，这里负责按顺序演。
  // 每一拍先出字幕和镜头，停稳亮光点，点后演动作、出词卡。
  const stories = {};
  const newStory = (id, def) => ({ id, def: def || null, beats: def?.beats || [], tasks: def?.tasks || [], data: {}, on: false, i: -1, state: 'idle', done: new Set(), finished: !def?.beats?.length, started: false, seen: false, target: null, timers: [] });
  const storyOf = id => stories[id] ||= newStory(id, VIG[id]?.story);
  let story = newStory(null, null), glowState = null;
  const tvState = {}, drops = [], tweens = [], loops = [], sounds = []; let tvMod = null, tvAsked = false; let gltfLoader = null;
  // 给房间文件用的工具。房间文件不直接碰镜头和界面，只通过这些做事
  const H = {
    THREE, scene: T.scene,
    find: name => house.getObjectByName(name),                                   // 按名字找屋里的物件
    wait: (ms, fn) => story.timers.push(setTimeout(() => { if (alive && story.on) fn(); }, ms)),
    drop(o, done) { drops.push({ o, y: o.position.y, t: performance.now() }); H.wait(1150, () => { const i = drops.findIndex(x => x.o === o); if (i >= 0) { o.position.y = drops[i].y; drops.splice(i, 1); } done(); }); },   // 物件从上面落下、顿两下
    tween(ms, fn, done) { tweens.push({ t0: performance.now(), ms, fn, done, st: story }); },   // 一段动作：ms 毫秒内每帧调用 fn(0…1)，做完调用 done
    gaze(at, { from, go = 900, hold = 2000 } = {}, done) {   // 看向目标，可先到分镜指定的站位
      if (!fixed || fixed.anim) return done?.();
      const start = pcam.position.clone(), pos = from ? new THREE.Vector3().fromArray(from) : start;
      const {yaw: ay, pitch: ap} = aimFrom(pos, new THREE.Vector3().fromArray(at));
      fixed.anim = { t0: performance.now(), keys: [{ t: 0, pos: start, yaw, pitch }, { t: go, pos, yaw: ay, pitch: ap }, { t: go + hold, pos, yaw: ay, pitch: ap }],
        done() {
          const view = fixed.focus || fixed.base;
          if (from) view.pos.copy(pos);
          view.yaw = aimYaw = yaw; view.pitch = aimPitch = pitch;
          done?.();
        } };
      syncFixedUi();
    },
    sound(name, { loop = false, volume = .6 } = {}) {   // 播一个音效（sfx.js）：audio/<name>.m4a 有真录音就用录音，没有就用合成的。返回的函数用来停掉
      const stop = window.__SFX?.play(name, { loop, volume }) || (() => {}), a = { pause: stop }; sounds.push(a);
      return () => { stop(); const i = sounds.indexOf(a); if (i >= 0) sounds.splice(i, 1); };
    },
    loop(fn) { loops.push(fn); return () => { const i = loops.indexOf(fn); if (i >= 0) loops.splice(i, 1); }; },   // 一直持续的小动静（热气之类）：每帧调用 fn(当前毫秒)，返回的函数用来停掉
    tv(id, on) {                                                                  // 开关电视（用房屋自带的电视画面）
      tvState[id] = !!on;
      if (!tvAsked) { tvAsked = true; W.eval('import(' + JSON.stringify(new URL('./assets/tv-screens.js', W.location.href).href) + ')').then(m => { tvMod = m; }).catch(e => console.error('tv module', e)); }   // 用快速版页面自己的地址，拿到和房屋同一份电视模块
    },
    async model(url) {                                                             // 载入一个 GLB 模型，返回可以直接加进场景的一组物件
      gltfLoader ||= W.eval('import(' + JSON.stringify(new URL('../source/GLTFLoader-r160.mjs', W.location.href).href) + ')').then(m => new m.GLTFLoader());
      const gltf = await (await gltfLoader).loadAsync(url); return gltf.scene;
    },
    started: id => !!storyOf(id).started, finished: id => !!storyOf(id).finished,   // 另一间屋的戏开始了没有、演完了没有
    go: id => { if (fixed?.focus && !fixed.anim) { fixed.focus = null; stats.fixedFocus = null; } return goRoom(id); },                                                          // 叠化到另一间屋
    exit: () => runRoomRoute(VIG[fixed?.id]?.exit),
    say: (text, who, ms) => subtitle(text, who, ms),
  };
  const storyCard = mk('div', 'position:fixed;left:clamp(24px,5.6vw,90px);top:50%;transform:translateY(-50%);z-index:9;display:none;width:min(290px,30vw);padding:30px 30px 22px;background:rgba(20,17,14,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-top:1px solid ' + GOLD + ';border-bottom:1px solid rgba(230,194,122,.4);color:#f6f0e2;font:14px/1.9 ' + SERIF + ';cursor:pointer');
  storyCard.onclick = e => { e.stopPropagation(); storyAdvance(); };
  // 一间屋的戏演完后，画面下方给出去处（房间文件 outro.exit）。写 { label, to } 是去另一间屋，写一句字是离开屋子回街区；可以写成一组，并排出几个
  const storyExit = mk('div', 'position:fixed;left:50%;bottom:clamp(140px,21vh,200px);transform:translateX(-50%);z-index:8;display:none;gap:18px;white-space:nowrap');
  const EXIT_CSS = 'outline:none;padding:.7em 1.6em .7em 1.9em;border:1px solid ' + GOLD + ';background:rgba(20,17,14,.5);cursor:pointer;color:#fff;font:15px/1 ' + SERIF + ';letter-spacing:.34em;' + SHADOW;
  function syncExit() {
    if (exploring) { storyExit.style.display = 'none'; return; }
    const x = fixed && !fixed.replayChoice && phase === 'room' && storyOf(fixed.id).finished && VIG[fixed.id]?.story?.outro?.exit, list = x ? [].concat(x) : [];
    storyExit.textContent = ''; storyExit.style.display = list.length ? 'flex' : 'none';
    for (const o of list) { const b = document.createElement('button'); b.style.cssText = EXIT_CSS; b.textContent = o.label || o; b.onclick = e => { e.stopPropagation(); if (phase !== 'room' || !fixed || fixed.anim || roomInteraction) return; storyExit.style.display = 'none'; stats.exitChosen = o.to || (o.end ? 'end' : true); if (o.end) showEnd(o.end); else if (o.to) H.go(o.to); else document.getElementById('fpback')?.click(); }; storyExit.appendChild(b); }
  }
  const storyShade = mk('div', 'position:fixed;inset:0;z-index:6;pointer-events:none;opacity:0;transition:opacity .6s ease;background:linear-gradient(90deg,rgba(8,6,4,.6),transparent 46%)');
  const storyNote = mk('div', 'position:fixed;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(8,6,4,.6);cursor:pointer');
  storyNote.onclick = e => { e.stopPropagation(); storyAdvance(); };
  const storyTasks = mk('div', 'position:fixed;right:clamp(20px,3vw,44px);top:calc(clamp(18px,3vh,34px) + 50px);z-index:8;display:none;color:#fff;font:16px/2.1 ' + SERIF + ';letter-spacing:.2em;text-align:right;' + SHADOW);
  // 收集册：平时只是左下角三个字；点开是一页说明，写全名，集到的变金色
  const storySets = mk('button', 'outline:none;position:fixed;left:clamp(20px,3vw,44px);bottom:clamp(22px,5vh,44px);z-index:8;display:none;padding:.6em 0;border:0;background:none;cursor:pointer;color:#fff;opacity:.7;font:14px/1 ' + SERIF + ';letter-spacing:.34em;' + SHADOW, '收集册');
  const storyBook = mk('div', 'position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:rgba(8,6,4,.84);cursor:pointer;color:#f6f0e2;font:16px/2 ' + SERIF + ';letter-spacing:.2em');
  storySets.onclick = e => { e.stopPropagation(); storySets.blur(); drawBook(); storyBook.style.display = 'flex'; if (exploring) exploreUi.hide(); stats.bookOpened = (stats.bookOpened || 0) + 1; }; storyBook.onclick = e => { e.stopPropagation(); storyBook.style.display = 'none'; if (exploring) renderExploration(); };
  const storyEnd = mk('div', 'position:fixed;inset:0;z-index:11;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(8,6,4,0);transition:background 2.4s ease;color:#f6f0e2;font:15px/1.8 ' + SERIF + ';letter-spacing:.3em;text-align:center');
  // 结束画面（鹿鹿 2026-11-18：阁楼望出去、鸟飞过之后，游戏在这里结束）。房间文件 outro.exit 里写 { label: '结束', end: { title, lines } }。
  // 画面慢慢暗下来，出一页字和两个按钮：“再看看”回到刚才的画面，“从头再来”重新开始
  function showEnd(o) {
    storyEnd.classList.toggle('explore-ending', exploring);
    const btn = (t, fn) => { const b = document.createElement('button'); if (!exploring) b.style.cssText = EXIT_CSS; b.textContent = t; b.onclick = e => { e.stopPropagation(); fn(); }; return b; };
    const box = document.createElement('div'); box.style.cssText = 'opacity:0;transition:opacity 1.6s ease 1.2s;display:flex;flex-direction:column;align-items:center;gap:16px';
    box.innerHTML = '<div style="font:54px/1.3 ' + KAI + ';letter-spacing:.3em;padding-left:.3em">' + (o.title || '') + '</div>' + (o.lines || []).map(l => '<div style="color:#d8d0bd">' + l + '</div>').join('');
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:18px;margin-top:28px';
    row.append(btn('再看看', hideEnd), btn('从头再来', () => { stats.restart = true; location.reload(); })); box.append(row);
    storyEnd.textContent = ''; storyEnd.append(box); storyEnd.style.background = 'rgba(8,6,4,0)'; storyEnd.style.display = 'flex'; stats.ended = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { storyEnd.style.background = 'rgba(8,6,4,.82)'; box.style.opacity = 1; }));
  }
  function hideEnd() { if (storyEnd.style.display === 'none') return; storyEnd.style.display = 'none'; storyEnd.style.background = 'rgba(8,6,4,0)'; stats.ended = false; syncExit(); if (exploring) { if (follow === 'ending') renderExploration(); else exploreOverview(); } }
  const SETS = {
    turn: { title: '三转一响', note: '七八十年代结婚要备齐的四样：三样会转的，一样会响的。', items: ['自行车', '缝纫机', '手表', '收音机'] },
    seven: { title: '开门七件事', note: '过日子天天离不开的七样。', items: ['柴', '米', '油', '盐', '酱', '醋', '茶'] },
  }, lit = { turn: new Set(), seven: new Set() };
  function drawBook() {
    const block = k => { const S = SETS[k]; return '<div style="margin-top:34px"><div style="font:30px/1.4 ' + KAI + ';letter-spacing:.24em">' + S.title + '<span style="margin-left:1em;font:14px/1 ' + SERIF + ';letter-spacing:.2em;color:' + GOLD + '">' + lit[k].size + ' / ' + S.items.length + '</span></div><div style="font-size:14px;color:#c9c1ae">' + S.note + '</div><div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px">' + S.items.map((c, i) => '<span style="padding:.3em 1em .3em 1.2em;font-size:19px;' + (lit[k].has(i) ? 'background:' + GOLD + ';color:#14110e;border:1px solid ' + GOLD : 'border:1px solid rgba(255,255,255,.35);color:rgba(255,255,255,.6)') + '">' + c + '</span>').join('') + '</div></div>'; };
    storyBook.innerHTML = '<div style="width:min(640px,84vw)"><div style="font-size:12px;letter-spacing:.4em;color:' + GOLD + '">收集册</div><div style="font-size:14px;color:#c9c1ae;margin-top:4px">在屋里找到一样，这里就亮一样。</div>' + block('turn') + block('seven') + '<div style="margin-top:36px;font-size:12px;letter-spacing:.34em;color:#9d9686">点任意处关闭</div></div>';
  }
  function drawTasks() {
    storyTasks.innerHTML = '<div style="font-size:11px;letter-spacing:.34em;color:' + GOLD + '">' + (story.def?.tasksTitle || '') + '</div>' + story.tasks.map((t0, i) => { const t = t0.text || t0, off = !!t0.off, done = story.beats.some(b => b.task === i && story.done.has(b.id)), cur = (story.beats[story.i]?.task ?? story.beats[story.i]?.taskOf) === i && story.on; return '<div style="' + (done ? 'text-decoration:line-through;opacity:.5' : off ? 'opacity:.45;font-size:13px' : cur ? 'color:' + GOLD : '') + '">' + t + '</div>'; }).join('');
  }
  function storyUi() {
    const show = story.on && !!fixed; storySets.style.display = fixed ? 'block' : 'none'; storyTasks.style.display = show && story.tasks.length && (!story.def.tasksAfter || story.done.has(story.def.tasksAfter)) ? 'block' : 'none';
    if (!show) { storyCard.style.display = storyNote.style.display = 'none'; storyShade.style.opacity = 0; } if (show) drawTasks();
  }
  // 发暖光：目标物件的材质换成带自发光的副本，缓慢呼吸；结束时换回原材质
  function glowOn(o) {
    glowOff(); if (!o) return; const saved = [], mats = [];
    o.traverse(m => { if (!m.isMesh) return; const src = Array.isArray(m.material) ? m.material : [m.material], next = src.map(x => { if (!x?.emissive || x.emissiveMap || x.emissive.r + x.emissive.g + x.emissive.b > 0 || x.userData?.houseTvScreensRevision) return x; /* 本来就会发光的（电视屏幕等）不动 */ const c = x.clone(); c.emissive = new THREE.Color(0xffb04a); c.emissiveMap = null; mats.push(c); return c; }); saved.push([m, m.material]); m.material = Array.isArray(m.material) ? next : next[0]; });
    glowState = { saved, mats };
  }
  function glowOff() { const g = glowState; if (!g) return; for (const [m, mat] of g.saved) m.material = mat; for (const c of g.mats) c.dispose(); glowState = null; }
  const beatTarget = b => typeof b.target === 'function' ? b.target(H, story.data) : house.getObjectByName(b.target);
  const centerOf = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  // 客堂保留已完成的生活状态；其他有剧情的房间，再次进入时由玩家选择重走。
  function offerStoryReplay(id) {
    fixed.replayChoice = true; clearGuides(); syncExit(); roomExit.style.display = 'none'; api.hideToast();
    cueSet({ label:'重走剧情', screenCenter:true, delay:600,
      at:() => new THREE.Vector3().fromArray(VIG[id].spot.look), run:restartStory,
      secondary:{ label:'继续看看', run() { fixed.replayChoice = false; makeGuides(); syncRoomExit(); roomCue(id); atEndingView(syncExit); } } });
  }
  function restartStory() {
    if (!fixed || !story.beats.length || VIG[fixed.id].replay === false) return;
    if (fixed.id === 'hall') {
      if (!exploring || story.single || follow) return;
      hideHouseHint(); exploreUi.hide(); exploring = false; hallObjects = false;
      if (!story.finished) {
        // 跳过发生在挂衣裳之前，原来的道具还处于开场状态。
        cutTo(resetView); storyEnter(); return;
      }
    } else if (!story.finished) return;
    const old = story, id = fixed.id;
    cueClear(); subtitleOff(); cancelRoomInteraction(); clearGuides();
    for (const t of old.timers) clearTimeout(t);
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].st === old) tweens.splice(i, 1);
    old.def?.dispose?.(H, old.data); old.prepared = false;
    story = stories[id] = newStory(id, old.def);
    fixed.replayChoice = false; fixed.focus = fixed.anim = null; fixed.i = 0; fixed.base = spotBase(0);
    stats.storyFinished = false; stats.fixedFocus = null; stats.beatsDone = 0;
    keys.clear(); vel.set(0, 0);
    cutTo(() => { pcam.position.copy(fixed.base.pos); yaw = aimYaw = fixed.base.yaw; pitch = aimPitch = fixed.base.pitch; storyEnter(); });
    syncRoomExit(); syncExit();
  }
  function storyEnter() {
    if (!story.started) { story.started = true; story.i = -1; storyPrepare(story); }
    story.def.resume?.(H,story.data);
    story.on = true; clearGuides(); syncFixedUi(); storyUi();
    if (story.i < 0 || story.done.has(story.beats[story.i]?.id)) storyNext(); else storyGuide();
  }
  function storyPause() { if (!story.on) return; for (const t of story.timers) clearTimeout(t); story.timers.length = 0; if (story.state !== 'guide' && story.i >= 0 && !story.done.has(story.beats[story.i]?.id)) story.state = 'guide'; cueClear(); subtitleOff(); story.on = false; storyUi(); }
  function storyNext() { story.i++; if (story.i >= story.beats.length) { storyFinale(); return; } storyGuide(); }
  function storyGuide() {   // 交给通用引导：第一拍先让人看 3 秒，后面每拍等 1 秒
    const b = story.beats[story.i]; if (!b) return; const o = beatTarget(b); story.target = o; story.state = 'guide'; api.hideToast(); storyUi();
    cueSet({ seated: true, screenCenter: b.screenCenter, lookFirst: true, guideFrom: b.guideFrom, label: b.label, sub: b.sub, who: b.who, delay: story.done.size ? 1000 : 3000, at: () => b.markAt ? new THREE.Vector3().fromArray(b.markAt) : centerOf(o), glow: () => o, run: storyRun });
  }
  function storyRun() {   // 点了目标：镜头走近，然后演这一拍
    const b = story.beats[story.i]; if (!story.on || story.state !== 'guide' || !b || fixed.anim) return;
    story.state = 'acting'; window.__SFX?.play('click', { volume: .5 }); if (b.book) bookReturn = { pos: (fixed.focus || fixed.base).pos.clone(), yaw, pitch, focus: fixed.focus }; api.hideToast(); stats.beats = (stats.beats || 0) + 1;
    const finish = () => { if (b.card) showCard(b); else { story.state = 'card'; storyAdvance(); } }, play = () => runAct(b, finish);
    if (!b.pose) { play(); return; }
    const pos = new THREE.Vector3().fromArray(b.pose.pos), a = aimFrom(pos, new THREE.Vector3().fromArray(b.pose.look));
    if (fixed.focus?.seated) fixed.focus = null;
    // pose.fade：不走过去，叠化过去（阁楼从屋里到老虎窗外：中间隔着屋面，走过去会穿墙）
    if (b.pose.fade) { cutTo(() => { pcam.position.copy(pos); yaw = aimYaw = a.yaw; pitch = aimPitch = a.pitch; fixed.base = { pos, yaw: a.yaw, pitch: a.pitch, dy: b.pose.dy ?? .6, dp: b.pose.dp ?? .3, down: b.pose.down ?? .45 }; }); story.timers.push(setTimeout(play, 700)); syncFixedUi(); return; }
    fixed.anim = { t0: performance.now(), keys: [{ t: 0, pos: pcam.position.clone(), yaw, pitch }, { t: 1250, pos, ...a }],
      done() { fixed.base = { pos, yaw: a.yaw, pitch: a.pitch, dy: .6, dp: .3, down: .45 }; aimYaw = yaw; aimPitch = pitch; play(); } };
    syncFixedUi();
  }
  function runAct(b, finish) {   // 一拍的动作有三种：看一张纸（read）、坐下（sit）、物件自己动（act）
    b.enter?.(H, story.data);
    if (b.book) { openBook(finish); return; }
    /* 这一拍开始时先做的事（不用等） */
    if (b.read) { window.__SFX?.play('page'); story.state = 'note'; storyNote.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:16px"><img alt="' + b.read.alt + '" src="' + b.read.img + '" style="height:min(74vh,720px);box-shadow:0 16px 44px rgba(0,0,0,.6);transform:rotate(-1.4deg)"><div style="color:#c9c1ae;font:12px/1.6 ' + SERIF + ';letter-spacing:.3em;' + SHADOW + '">' + (b.read.hint ? b.read.hint + '　·　' : '') + '点任意处或按回车收起</div></div>'; storyNote.style.display = 'flex'; return; }
    if (b.sit === true) { sitOn(story.target, b.then ? () => b.then(H, story.data, finish) : finish); syncFixedUi(); return; }   /* 有靠背的椅子：朝向和高度自动量 */
    if (b.sit) { const o = story.target, q = b.sit; seats.set(o, { c: new THREE.Vector3(q.at[0], 0, q.at[1]), fwd: new THREE.Vector3().fromArray(q.facing).normalize(), seatY: q.seatY, top: q.seatY, eye: q.eye, noLean: q.lean === false }); sitOn(o, b.then ? () => b.then(H, story.data, finish) : finish); syncFixedUi(); return; }   /* then：坐定以后接着演的一小段 */
    if (b.act) b.act(H, story.data, finish); else finish();
  }
  function showCard(b) {
    story.state = 'card'; api.hideToast(); window.__SFX?.play('card', { volume: .5 });
    storyCard.innerHTML = '<div style="font:56px/1.2 ' + KAI + ';letter-spacing:.16em">' + b.card.hu + '</div><div style="margin-top:14px;letter-spacing:.34em;color:#c9c1ae">' + (b.card.zh || b.card.hu) + '</div><div style="margin-top:10px;color:#e7e0d0">' + b.card.note + '</div><div style="margin-top:18px;display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:.3em;color:' + GOLD + '"><b data-snd style="display:inline-flex;width:38px;height:38px;border-radius:50%;border:1px solid ' + GOLD + ';align-items:center;justify-content:center;font-size:16px;font-weight:400;letter-spacing:0;transition:background .2s">🔈</b><span data-sndtext>听一听</span></div><div style="margin-top:16px;font-size:11px;line-height:2;letter-spacing:.3em;color:#9d9686">空格　听一听<br>回车　继续</div>';
    storyCard.querySelector('[data-snd]').parentNode.onclick = e => { e.stopPropagation(); storySpeak(); };
    storyCard.style.display = 'block'; storyShade.style.opacity = 1;
  }
  let cardVoice = null, lastVoiceStart = 0;
  function stopCardVoice() {
    cardVoice?.pause();
    cardVoice = null;
  }
  function playCardVoice(id, status, readyText) {
    const now = performance.now(), url = new URL('./audio/' + id + '.m4a', import.meta.url).href;
    if (cardVoice?.src === url && now - lastVoiceStart < 300) return false;
    stopCardVoice();
    const audio = new Audio(url);
    cardVoice = audio;
    lastVoiceStart = now;
    status.textContent = readyText;
    audio.play().catch(() => {
      if (cardVoice !== audio) return;
      status.textContent = '录音待补';
      cardVoice = null;
    });
    return true;
  }
  function storySpeak() {
    const b = story.beats[story.i], dot = storyCard.querySelector('[data-snd]');
    if (!b?.card || !dot || !playCardVoice(b.audio, storyCard.querySelector('[data-sndtext]'), '听一听')) return;
    dot.style.background = 'rgba(230,194,122,.35)';
    setTimeout(() => { dot.style.background = ''; }, 260);
    stats.speaks = (stats.speaks || 0) + 1;
  }
  function storyAdvance() {   // 收起词卡或字条，这一拍算完成
    const b = story.beats[story.i]; if (!story.on || !b || (story.state !== 'card' && story.state !== 'note')) return;
    stopCardVoice();
    storyCard.style.display = storyNote.style.display = 'none'; storyShade.style.opacity = 0; story.done.add(b.id); stats.beatsDone = story.done.size; if (b.collect) { const cs = Array.isArray(b.collect[0]) ? b.collect : [b.collect]; for (const c of cs) lit[c[0]].add(c[1]); stats.collected = (stats.collected || 0) + cs.length; storySets.textContent = '收集册 · ' + cs.map(c => SETS[c[0]].items[c[1]]).join('') + ' ✓';   /* collect 可以一次写几样：[['seven', 2], ['seven', 3]] */ storySets.style.color = GOLD; storySets.style.opacity = 1; setTimeout(() => { storySets.textContent = '收集册'; storySets.style.color = '#fff'; storySets.style.opacity = .7; }, 4200); } story.state = 'between'; storyUi();
    try { b.after?.(H, story.data); } catch (e) { console.error('after', b.id, e); }   // 这一拍的词卡收起以后顺手做的事（厨房：后门关回去），不挡下一拍
    if (story.single) { exploreFinish(b); return; }
    if (story.i >= story.beats.length - 1) { storyWait(); return; }   // 最后一拍：收尾
    storyNext();
  }
  function storyTap(e) {
    if (story.state === 'card' || story.state === 'note') { storyAdvance(); return; }
    if (story.state !== 'guide' || fixed.anim || roomInteraction) return;
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, pcam);
    if (typeof story.beats[story.i].target === 'function' && story.target && ray.intersectObject(story.target, true).length) { cueFire(); return; }   // 房间文件自己加进场景的东西（如字条）
    const o = fixedPick(e); if (o && (o === story.target || story.beats[story.i].also?.includes(o.name))) cueFire(); else if (o) (fixedLabel(o) && say(fixedLabel(o), 2000));
  }
  // 收尾：一段戏演完不暗场、不弹总结。等一会儿出一句字幕（房间文件的 outro），把屋子交还给玩家
  function storyWait() {
    const o = story.def.outro; if (!o) { storyFinale(); return; }
    if (o.sub) story.timers.push(setTimeout(() => { if (alive && story.on) subtitle(o.sub, o.who || null, 5200); }, o.after));
    story.timers.push(setTimeout(() => { if (alive && story.on) storyFinale(); }, o.after + (o.hold ?? (o.sub ? 1200 : 0))));
  }
  function atEndingView(done) {
    const target = story.def?.outro?.lookAt;
    if (!target || !fixed) { done(); return; }
    const base = fixed.base, pos = base.pos.clone(), angle = aimFrom(pos, new THREE.Vector3().fromArray(target));
    const targetPitch = Math.max(-.62, Math.min(.28, angle.pitch));
    fixed.anim = { t0: performance.now(), keys: [{ t: 0, pos: pcam.position.clone(), yaw, pitch }, { t: 1300, pos, yaw: angle.yaw, pitch: targetPitch }],
      done() {
        base.yaw = aimYaw = yaw; base.pitch = aimPitch = pitch;
        base.dp = Math.max(base.dp, (VIG[fixed.id].lookUp ?? FIX.tilt) - pitch);
        done();
      } };
    api.hideToast(); syncFixedUi();
  }
  function storyFinale() {
    const act = story.def?.outro?.act;
    if (act) { act(H, story.data, finishStory); return; }
    atEndingView(finishStory);
  }
  function finishStory() {
    story.state = 'end'; story.finished = true; stats.storyFinished = true; api.hideToast(); cueClear(); story.on = false; storyUi(); makeGuides(); syncFixedUi(); syncExit(); if (fixed) roomCue(fixed.id);   /* 戏演完，接着出这间屋平时的引导（比如引向下一间屋） */
    // outro.back：演完退回进门的站位（门上的去处要在那里才都看得见）
    if (fixed && story.def?.outro?.back && !fixed.anim && !fixed.focus) { const b = spotBase(0); fixed.anim = { t0: performance.now(), keys: [{ t: 0, pos: pcam.position.clone(), yaw, pitch }, { t: 1400, pos: b.pos, yaw: near(b.yaw, yaw), pitch: b.pitch }], done() { fixed.base = b; aimYaw = yaw; aimPitch = pitch; } }; syncFixedUi(); }
  }
  // 进屋时就摆好的东西（vignettes/index.js 的 EXTRA_FILES）
  const extraData = []; let extrasAdded = false;
  // 每间屋的布置（setup）在进屋子的时候就全部摆好，不等走到那间屋：从天井隔着门窗往客堂里看，看到的已经是布置好的样子
  function storyPrepare(st) { if (st.prepared || !st.def) return; st.prepared = true; try { st.def.setup?.(H, st.data); } catch (e) { console.error('setup', st.id, e); } }
  function addExtras() { for (const id of Object.keys(VIG)) if (VIG[id]?.story) storyPrepare(storyOf(id)); if (extrasAdded) return; extrasAdded = true; EXTRAS.forEach((x, i) => { extraData[i] = {}; try { x.add(H, extraData[i]); } catch (e) { console.error('extra', e); } }); }
  function viewExtras() { if (extrasAdded) EXTRAS.forEach((x, i) => { try { x.afterView?.(H, extraData[i]); } catch (e) { console.error('extra', e); } }); }
  function removeExtras() { if (!extrasAdded) return; EXTRAS.forEach((x, i) => { try { x.remove?.(H, extraData[i]); } catch (e) { console.error('extra', e); } }); extrasAdded = false; }
  function storyTick(now) {
    if (tvMod) { tvMod.getTvScreens(THREE, house, tvState); if (Object.values(tvState).some(Boolean)) tvMod.tickTvScreens(house, now / 1000); }
    if (glowState) { const k = .035 + .05 * (1 + Math.sin(now / 430)); for (const c of glowState.mats) c.emissiveIntensity = k; }
    for (const d of drops) { const u = (now - d.t) / 1000; d.o.position.y = d.y + .16 * Math.exp(-4.2 * u) * Math.cos(9.5 * u); }
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i], k = Math.min(1, (now - w.t0) / w.ms); w.fn(k); if (k >= 1) { tweens.splice(i, 1); if (alive && w.st.on) w.done?.(); } }
    for (const f of loops) f(now);
    cueTick(now);
  }
  function storyDispose() {
    for (const st of Object.values(stories)) { for (const t of st.timers) clearTimeout(t); if (st.started || st.prepared) { st.def?.dispose?.(H, st.data); st.prepared = false; } }
    removeExtras(); for (const d of drops) d.o.position.y = d.y; drops.length = 0; tweens.length = 0; loops.length = 0; for (const a of sounds) a.pause(); sounds.length = 0; cueClear(); subtitleOff(); if (tvMod) tvMod.getTvScreens(THREE, house, {});
    for (const e of [storyExit, cueEl, cueSecondary, spot, subEl, storyCard, storyShade, storyNote, storyTasks, storySets, storyBook, storyEnd]) e.remove(); document.getElementById('cine-style')?.remove(); document.body.classList.remove('cine'); story.on = false;
  }

  // 房间扩展：可取消的立体阅读、旁支物件、指定单向路线。默认房间不启用。
  let roomInteraction = null, bookReturn = null, roomRoute = null;
  const roomJobs = new Set();
  const roomExit = document.createElement('button'); roomExit.id = 'room-story-exit';
  const roomExitStyle = 'position:fixed;right:clamp(20px,3vw,44px);top:80px;z-index:25;display:none;border:0;background:none;color:white;text-shadow:0 2px 7px #000;padding:14px;cursor:pointer;font:15px "Songti SC",serif;letter-spacing:.15em';
  roomExit.style.cssText = roomExitStyle;
  roomExit.onclick = () => { const def = VIG[fixed?.id]?.exit; if (def) runRoomRoute(def); };
  document.body.append(roomExit);
  const interactionUi = document.createElement('div'); interactionUi.id = 'room-object-controls';
  interactionUi.style.cssText = 'position:fixed;inset:0;z-index:18;display:none;pointer-events:none'; document.body.append(interactionUi);
  function syncRoomExit() {
    const def = VIG[fixed?.id]?.exit;
    roomExit.textContent = def?.label || '';
    roomExit.style.cssText = roomExitStyle;
    roomExit.style.display = def && !def.viaCue ? 'block' : 'none';
  }
  function uiTween(ms, fn, done) { const st = { on:true }, w = {t0:performance.now(),ms,fn,st,done:()=>{roomJobs.delete(w);done?.()}};roomJobs.add(w);tweens.push(w); }
  function clearRoomJobs() { for (const w of roomJobs) { w.st.on=false;const i=tweens.indexOf(w);if(i>=0)tweens.splice(i,1); }roomJobs.clear(); }
  function interactionButton(text, label, action) {
    const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',label);b.onclick=e=>{e.stopPropagation();action()};
    b.style.cssText='border:0;background:none;color:white;text-shadow:0 2px 8px #000;font:17px "Songti SC",serif;letter-spacing:.15em;padding:16px;cursor:pointer;pointer-events:auto';return b;
  }
  function controls() { interactionUi.replaceChildren();interactionUi.style.display='block';const row=document.createElement('div');row.style.cssText='position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;align-items:center;white-space:nowrap';interactionUi.append(row);return row; }
  function bookControls() {
    const b=story.data.notebook, row=controls();
    const prev=interactionButton('‹ 上一页','本子上一页',()=>turnBook(-1)), next=interactionButton('下一页 ›','本子下一页',()=>turnBook(1));
    prev.disabled=b.spread===0||b.busy;next.disabled=b.spread>=b.total-1||b.busy;prev.style.opacity=prev.disabled?'.25':'1';next.style.opacity=next.disabled?'.25':'1';
    const label=document.createElement('span');label.textContent=`${b.spread*2+1}—${b.spread*2+2} 页`;label.style.cssText='color:#e6c27a;font:14px serif;padding:12px';
    const putBack = interactionButton('放回桌上','放回本子',closeRoomInteraction);
    putBack.disabled = b.busy;
    row.append(prev,label,next,putBack);
    // 两边页缘也是点击目标；透明按钮只在阅读状态出现，不挡退出。
    for(const [side,dir,off] of [['left',-1,prev.disabled],['right',1,next.disabled]]){const edge=interactionButton('',side==='left'?'点左页翻回':'点右页翻后',()=>turnBook(dir));edge.disabled=off;edge.style.cssText+=`;position:absolute;${side}:25%;top:26%;width:18%;height:46%;`;interactionUi.append(edge)}
  }
  function turnBook(dir) { if(roomInteraction?.kind!=='book')return;const b=story.data.notebook;if(b.flip(dir,uiTween,bookControls)) {stats.pageTurns=(stats.pageTurns||0)+1;bookControls()} }
  function openBook(done) {
    roomInteraction={kind:'book',done};clearGuides();cueClear();subtitleOff();fixedUi.style.display='none';
    const seat = story.beats.find(b=>b.book)?.seatedReturn;
    if(seat){
      const pos=new THREE.Vector3().fromArray(seat.pos),a=aimFrom(pos,new THREE.Vector3().fromArray(seat.look));
      const focus={o:H.find(seat.target),seated:true,pos,yaw:a.yaw,pitch:a.pitch,dy:FIX.seatTurn,dp:FIX.seatTilt,stand:new THREE.Vector3().fromArray(seat.stand)};
      bookReturn={pos,yaw:a.yaw,pitch:a.pitch,focus};
      fixed.focus={...focus,pos:pcam.position.clone(),yaw,pitch,dy:0,dp:0,down:0};
    }
    // 阅读机位固定，书页在三维房间中立起，鼠标不再带动相机。
    fixed.base.dy=fixed.base.dp=fixed.base.down=0;
    story.data.notebook.raise(uiTween,bookControls);
  }
  function closeRoomInteraction() {
    if(!roomInteraction)return;const current=roomInteraction;
    if(current.kind==='book'){
      const b=story.data.notebook;if(b.busy)return;interactionUi.style.display='none';
      b.lower(uiTween,()=>{
        const restore=bookReturn;bookReturn=null;roomInteraction=null;
        if(restore&&fixed){fixed.anim={t0:performance.now(),keys:[{t:0,pos:pcam.position.clone(),yaw,pitch},{t:900,pos:restore.pos,yaw:near(restore.yaw,yaw),pitch:restore.pitch}],done(){fixed.base=spotBase(0);fixed.focus=restore.focus;aimYaw=yaw;aimPitch=pitch;current.done?.();syncFixedUi()}}}
        else current.done?.();
      });return;
    }
    if(current.kind==='motion')return;
    stopCardVoice();
    interactionUi.style.display='none';roomInteraction=null;current.done?.();resumeRoomCue();
  }
  function cancelRoomInteraction() {
    stopCardVoice();
    clearRoomJobs();story.data?.notebook?.reset();bookReturn=null;roomInteraction=null;interactionUi.style.display='none';
    story.def?.suspend?.(H,story.data);
  }
  // 自由探索使用独立的单物件播放进度，和引导路线共用原场景、分镜、配音及收集册。
  const exploreUi = explorationControls(doorTemplate);
  const houseHint = $('house-pick-hint');
  function hideHouseHint() {
    houseHint.removeEventListener('animationend', hideHouseHint);
    houseHint.hidden = true;
    upBtn.removeAttribute('aria-describedby');
  }
  function showFirstHouseHint() {
    if (houseHintSeen) return;
    houseHintSeen = true;
    houseHint.hidden = false;
    upBtn.setAttribute('aria-describedby', houseHint.id);
    houseHint.addEventListener('animationend', hideHouseHint, { once: true });
  }
  let exploring = false, freePoints = [], follow = null, hallObjects = false;
  function resetView() {
    stopRoomDrag(); pan.keys.clear(); pan.x = pan.y = 0;
    fixed.anim = fixed.focus = null; fixed.base = spotBase(0);
    pcam.position.copy(fixed.base.pos); yaw = aimYaw = fixed.base.yaw; pitch = aimPitch = fixed.base.pitch;
    pcam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); pcam.updateMatrixWorld();
    stats.fixedFocus = null;
  }
  function stopExploringItem() {
    hideHouseHint();
    const current = story;
    // 先收尾还在移动的道具，再撤回本拍的读物、声音和回调；新房间不会收到旧动作。
    if (current.single) {
      for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].st === current) {
        const [w] = tweens.splice(i, 1); w.fn(1);
      }
      if (fixed.id === 'kitchen' && current.beats[0].id === 'backdoor' && current.data.door) {
        closeKitchenDoor(current.data.door);
      }
    }
    storyPause(); cancelRoomInteraction();
    for (const a of sounds) a.pause(); sounds.length = 0;
    if (current.data?.flock) { current.data.flock.t0 = 0; current.data.flock.g.visible = false; }
    story = storyOf(fixed.id); fixed.anim = fixed.focus = null;
    storyUi(); subtitleOff(); api.hideToast();
  }
  function exploreOverview() {
    stopExploringItem(); follow = null;
    story.def?.resume?.(H, story.data);
    cutTo(resetView); renderExploration();
  }
  function exploreGo(to) {
    const exit = VIG[fixed?.id]?.exit;
    if (exit?.to === to && exit.route) { runRoomRoute(exit); return; }
    stopExploringItem(); follow = null; hallObjects = false;
    goRoom(to);
  }
  function atTutorialStart() {
    return !exploring && fixed?.id === 'hall' && story.on && story.i === 0 && story.state === 'guide';
  }
  function beginExploration() {
    if (exploring || fixed?.id !== 'hall' || (!story.finished && !atTutorialStart())) return;
    exploring = true; cueClear(); clearDoors(); clearGuides();
    exploreOverview(); showFirstHouseHint();
  }
  function chooseItem(b) {
    if (story.single || !fixed) return;
    const owner = storyOf(fixed.id), target = beatTarget(b);
    if (target && !b.pose && !b.sit) {
      const close = closeupPosition(target);
      b = { ...b, pose: { pos: close.pos.toArray(), look: b.markAt || close.target.toArray() } };
    }
    fixed.focus = null;
    story = { ...newStory(fixed.id, owner.def), beats: [b], tasks: [], data: owner.data,
      i: 0, on: true, state: 'guide', single: true, target };
    follow = null; storyUi(); renderExploration(); storyRun();
  }
  function exploreFinish(b) {
    const next = followUps[fixed.id]?.[b.id];
    if (next || (fixed.id === 'loft' && b.id === 'out') || b.stay) {
      storyPause(); story = storyOf(fixed.id);
      follow = next || (b.stay ? 'detail' : 'ending'); subtitleOff(); renderExploration();
    } else exploreOverview();
  }
  function endExplorationScene(ending) {
    const keepView = follow === 'ending';
    if (!keepView) { stopExploringItem(); resetView(); follow = null; }
    exploreUi.hide();
    // 道别时留在相应的场景：字条在客堂桌面，出门时转向弄堂大门。
    const pose = ending === farewells.hall ? VIG.hall.story.beats.find(b => b.read).pose
      : ending === farewells.courtyard ? { pos: VIG.courtyard.spot.pos, look: [0, 1.35, 0] } : null;
    if (pose) {
      cutTo(() => {
        pcam.position.fromArray(pose.pos);
        const a = aimFrom(pcam.position, new THREE.Vector3().fromArray(pose.look));
        fixed.base = { ...fixed.base, pos: pcam.position.clone(), ...a };
        yaw = aimYaw = a.yaw; pitch = aimPitch = a.pitch;
      });
    }
    showEnd(ending);
  }
  function exploreItemPoint(b) {
    const target = beatTarget(b);
    if (!target && !b.markAt) return null;
    const targets = [target, ...(b.also || []).map(n => H.find(n))].filter(Boolean);
    return { label: b.label || b.card.hu, at: b.markAt ? new THREE.Vector3().fromArray(b.markAt) : centerOf(target),
      targets, run: () => chooseItem(b) };
  }
  function renderExploration() {
    if (!exploring || !fixed) return;
    const id = fixed.id, def = VIG[id], parent = roomLinks[id];
    const bottom = [{ label: '回' + parent[0], run: () => exploreGo(parent[1]) }];
    const upstairs = id === 'mezzanine' || id === 'tingzi';
    if (upstairs) bottom.push({ label: destinations.landing, run: () => exploreGo('landing') });
    freePoints = [];
    if (story.single || follow) bottom.unshift({ label: '回到房间', run: exploreOverview });
    if (follow === 'ending') {
      bottom.unshift({ label: '结束', run: () => endExplorationScene(def.story.outro.exit[0].end) });
    } else if (follow && follow !== 'detail') {
      freePoints.push(exploreItemPoint(def.story.beats.find(b => b.id === follow)));
    } else if (!story.single && !follow) {
      for (const door of room.doors) {
        if (door.to === parent[1] || (upstairs && door.to === 'landing') || (id === 'hall' && hallObjects)) continue;
        const anchor = def.doors?.find(d => d.to === door.to)?.at || door.frame.c;
        freePoints.push({ label: destinations[door.to], at: new THREE.Vector3().fromArray(anchor), door: true, hallChoice: id === 'hall', run: () => exploreGo(door.to) });
      }
      if (id !== 'hall' || hallObjects) {
        const props = def.props || scenery[id] || [];
        const chained = Object.values(followUps[id] || {});
        for (let b of def.story?.beats || []) {
          if (chained.includes(b.id) || props.some(p => p.target === b.target)) continue;
          // 自由看词卡时保留客堂陈设当前的状态，教程动作只在教程里播放。
          if (id === 'hall' && b.card) b = { ...b, label: b.card.hu, act: null, sit: null, then: null, enter: null };
          freePoints.push(exploreItemPoint(b));
        }
        for (const prop of props) freePoints.push(exploreItemPoint({ ...prop, id: prop.target, stay: !prop.card }));
      }
      if (id === 'hall') {
        bottom.push({ label: hallObjects ? '看看去处' : '看看客堂物件',
          run: () => { hallObjects = !hallObjects; renderExploration(); } });
        bottom.push({ label: '回看指引', run: restartStory });
      }
      if (farewells[id]) bottom.push({ label: farewells[id].title, run: () => endExplorationScene(farewells[id]) });
    }
    freePoints = freePoints.filter(Boolean);
    exploreUi.render(freePoints, bottom, () => endExplorationScene(farewells.anywhere));
    syncFixedUi(); exploreUi.place(pcam, canvas.getBoundingClientRect());
  }
  function explorePick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
    ray.setFromCamera(ndc, pcam);
    let nearest = Infinity, chosen = null;
    for (const point of freePoints) {
      if (!point.targets) continue;
      const hit = ray.intersectObjects(point.targets, true).find(hit => {
        for (let node = hit.object; node; node = node.parent) if (!node.visible) return false;
        return true;
      });
      if (hit && hit.distance < nearest) { nearest = hit.distance; chosen = point; }
    }
    return chosen;
  }

  function resumeRoomCue() { if(story.on&&story.state==='guide')storyGuide();else {makeGuides();if(fixed)roomCue(fixed.id);}syncFixedUi(); }
  function showPropCard(def) {
    roomInteraction={kind:'prop'};cueClear();subtitleOff();const row=controls();row.append(interactionButton('收起','收起物件说明',closeRoomInteraction));
    const card=document.createElement('div');card.style.cssText='position:absolute;left:clamp(24px,5vw,80px);top:35%;width:280px;max-width:65vw;background:rgba(20,17,14,.78);border-top:1px solid #e6c27a;padding:28px;color:#f6f0e2;font:17px/1.9 "Songti SC",serif;pointer-events:auto';
    const title=document.createElement('div');title.textContent=def.card.hu;title.style.cssText='font:42px "Kaiti SC",serif;color:white';const note=document.createElement('p');note.textContent=def.card.note;const status=document.createElement('small');status.setAttribute('role','status');status.style.color='#e6c27a';card.append(title,note,status);interactionUi.append(card);
    if (def.audio) row.append(interactionButton('听一听', '播放这张卡的录音', () => playCardVoice(def.audio, status, '')));
  }
  function tryRoomProp(e) {
    if(!VIG[fixed.id]?.props||fixed.anim||story.on&&story.state!=='guide')return false;
    const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,pcam);
    const book=story.data.notebook;
    if(book&&story.finished&&ray.intersectObject(book.g,true).length){
      bookReturn={pos:(fixed.focus||fixed.base).pos.clone(),yaw,pitch,focus:fixed.focus};const b=story.beats.find(x=>x.book),pos=new THREE.Vector3().fromArray(b.pose.pos),a=aimFrom(pos,new THREE.Vector3().fromArray(b.pose.look));
      cueClear();fixed.focus=null;fixed.anim={t0:performance.now(),keys:[{t:0,pos:pcam.position.clone(),yaw,pitch},{t:1000,pos,yaw:a.yaw,pitch:a.pitch}],done(){fixed.base={pos,yaw:a.yaw,pitch:a.pitch,dy:0,dp:0,down:0};openBook(()=>resumeRoomCue())}};return true;
    }
    const o=fixedPick(e);if(!o)return false;
    if(story.on&&story.state==='guide'&&story.target===o)return false;
    if(o.name==='亭子间_前木门'){runRoomRoute(VIG[fixed.id].exit);return true}
    const def=VIG[fixed.id].props.find(x=>x.target===o.name);if(!def)return false;
    if(def.card){showPropCard(def);return true}
    cueClear();subtitleOff();
    if(def.sit){if(fixed.focus?.seated){resumeRoomCue();return true}const q=def.sit;seats.set(o,{c:new THREE.Vector3(q.at[0],0,q.at[1]),fwd:new THREE.Vector3().fromArray(q.facing),seatY:q.seatY,top:q.seatY,eye:q.eye,noLean:true});sitOn(o,()=>{resumeRoomCue()});return true}
    roomInteraction={kind:'motion'};
    const play=()=>def.act({...H,tween:uiTween},story.data,()=>{roomInteraction=null;resumeRoomCue()});
    if(def.pose){const pos=new THREE.Vector3().fromArray(def.pose.pos),a=aimFrom(pos,new THREE.Vector3().fromArray(def.pose.look));fixed.anim={t0:performance.now(),keys:[{t:0,pos:pcam.position.clone(),yaw,pitch},{t:1000,pos,yaw:a.yaw,pitch:a.pitch}],done(){fixed.focus={o,pos,yaw:a.yaw,pitch:a.pitch,dy:.4,dp:.3,down:.45};aimYaw=yaw;aimPitch=pitch;play()}};syncFixedUi()}
    else play();return true;
  }
  function runRoomRoute(def) {
    if(!def||phase!=='room')return;
    const id=fixed.id;cancelRoomInteraction();endFixed();clearDoorMarks();ui.classList.remove('on');zoomUi.classList.remove('on');upBtn.classList.remove('on');api.hideToast();keys.clear();vel.set(0,0);
    const door=house.getObjectByName('亭子间_前木门');door?.traverse(o=>{if(o.userData.kind==='door_leaf')o.rotation.y=1.5});
    const start=def.route[0];cutTo(()=>{pcam.position.fromArray(start.pos);const a=aimFrom(pcam.position,new THREE.Vector3().fromArray(start.look));yaw=aimYaw=a.yaw;pitch=aimPitch=a.pitch});
    roomRoute={def,from:id,i:1,t0:performance.now()+520,p:pcam.position.clone(),q:pcam.quaternion.clone()};phase='roomroute';stats.phase=phase;roomExit.style.display='none';
  }
  function roomRouteTick(now) {
    const r=roomRoute;if(!r||now<r.t0)return;const dest=r.def.route[r.i],u=clamp01((now-r.t0)/(dest.ms||1300));
    const target=new THREE.Vector3().fromArray(dest.pos),a=new THREE.Matrix4().lookAt(target,new THREE.Vector3().fromArray(dest.look),new THREE.Vector3(0,1,0)),q=new THREE.Quaternion().setFromRotationMatrix(a);
    if(dest.fade){roomFade.textContent='二楼';roomFade.classList.add('on');roomFade.style.opacity=String(u<.5?u*2:(1-u)*2);if(u>=.5){pcam.position.copy(target);pcam.quaternion.copy(q)}}
    else{pcam.position.lerpVectors(r.p,target,ease(u));pcam.quaternion.copy(r.q).slerp(q,ease(u))}
    pcam.updateMatrixWorld();
    if(u>=1){roomFade.classList.remove('on');r.i++;r.p=pcam.position.clone();r.q=pcam.quaternion.clone();r.t0=now;
      if(r.i>=r.def.route.length){const to=r.def.to;roomRoute=null;level=ROOMS[to].level;startWalking(to);stats.roomRoutes=(stats.roomRoutes||0)+1}
    }
  }

  function roomTick(now) {
    if (phase === 'room') walkTick(now);
    if (phase === 'doorwalk') doorTick(now);
    if (phase === 'stairfade') stairTick(now);
    if (phase === 'roomroute') roomRouteTick(now);
    updateDoorMarks(Math.min(.05, (now - (roomTick.last || now)) / 1000), now); roomTick.last = now;
  }

  function leave() {
    if (!alive) return; if (exploring && fixed) endFixed(); exploreUi.remove(); alive = false; stopRoomDrag(); cancelRoomInteraction(); roomRoute = null; roomExit.remove(); interactionUi.remove(); storyDispose(); endFixed(); fixedUi.remove();
    restoreLevels(); restoreNeighbours(); if (roof) roof.visible = true;
    canvasEl.removeEventListener('pointermove', onMove); canvasEl.removeEventListener('pointerdown', onDown); canvasEl.removeEventListener('pointerup', onUp); canvasEl.style.cursor = '';
    for (const w of [window, W]) { w.removeEventListener('keydown', onKey); w.removeEventListener('keyup', onKey); w.removeEventListener('blur', onBlur); }
    ui.removeEventListener('pointerdown', onUiDown); ui.removeEventListener('pointermove', onUiMove); ui.removeEventListener('pointerup', onUiUp); ui.removeEventListener('pointercancel', onUiUp); ui.removeEventListener('lostpointercapture', onUiUp);
    zoomUi.classList.remove('on'); widerBtn.onclick = closerBtn.onclick = null; ui.removeEventListener('wheel', onWheel);
    upBtn.classList.remove('on'); upBtn.onclick = null; clearDoorMarks(); markGeo.dispose(); markMat.dispose(); haloMat.dispose(); hazeMat.dispose(); T.scene.remove(tint); tintFill.geometry.dispose(); unit.dispose(); tintMat.dispose(); edgeMat.dispose();
    streetLeaves.forEach((o, i) => { o.rotation.y = streetRest[i]; });
    note.classList.remove('on');
    staticSources.clear();
    roomFade.classList.remove('on'); roomFade.style.opacity = '0';
    levelsNav.classList.remove('on'); snapImg.classList.remove('on'); snapImg.removeAttribute('src');
    levelsNav.querySelectorAll('button').forEach(b => { b.onclick = null; });
  }

  return { tick, draw, leave, stats, setLevel, enterRoom, leaveRoom, inspect: () => ({ interaction: roomInteraction && {kind:roomInteraction.kind, spread:stories.tingzi?.data.notebook?.spread, raised:stories.tingzi?.data.notebook?.raised, busy:stories.tingzi?.data.notebook?.busy}, route:roomRoute?.def.to || null, fixed: fixed && { exploration: exploring ? freePoints.map(p => ({ label: p.label, at: p.at.toArray() })) : null, anim: !!fixed.anim, seated: !!fixed.focus?.seated, follow: false, guides: guides.filter(g => g.el.style.display !== 'none').map(g => g.o.name), story: { room: story.id, on: story.on, beat: story.beats[story.i]?.id || null, state: story.state, done: [...story.done], finished: !!story.finished, tv: !!tvState.hallTv, coat: !!stories.hall?.data.coat?.visible, sub: stats.subtitle || null }, cue: cue.def && { label: cue.def.label, shown: cue.shown, urged: cue.urged, visible: cueEl.style.display !== 'none' && cueEl.style.opacity !== '0', spot: spot.style.opacity, rect: cueEl.getBoundingClientRect().toJSON() }, id: fixed.id, spot: fixed.i, spots: fixed.spots.length, focus: fixed.focus?.o.name || null, yaw, pitch, baseYaw: fixed.base.yaw }, room: stats.room, phase, level, position: pcam.position.toArray(), fov: pcam.fov, targetFov: room ? viewFov(room) : null, activeDoor: activeDoor?.to || null, free: room ? free(pcam.position.x, pcam.position.z) : null, obstacles: obstacles.map(b => [...b]) }), get phase() { return phase; }, get level() { return level; } };
}
