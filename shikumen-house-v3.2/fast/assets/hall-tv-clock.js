import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { HALL_TV_CLOCK_DATA } from './hall-tv-clock-data.js';

// Hall television cabinet and hall wall clock in B1, both built locally from numbers (2026-11-16).
// Television: the generated cabinet (HF07) had an uneven underside and the crochet runner on the low cupboard poked through it below
// the screen.  It is replaced by a rounded cabinet of the same size (0.48 wide, 0.43 high, about 0.40 deep): front shell with the
// screen opening and a closed liner, a smaller tapering rear housing, vent and speaker slots, three small keys and a power key, four
// rubber feet and a cord boss.  The feet stand on the cupboard top; the shell clears it by 16 mm, above the runner.  The screen, the
// inner frame and the pictures stay with tv-screens.js; the opening here equals the outer loop of that frame.
// Clock: the flat round clock on the north wall is replaced by a landscape quartz wall clock (0.40 x 0.34, 42 mm off the wall) in the
// style 鹿鹿 picked from searched photos: dark brown wood-grain plastic frame, a gold strip on each side, white dial, black hands, red
// second hand.  Same wall position and the same time (9:25) as the old clock.
// Samples and history: experiments/hall-tv-rebuild-20261116/说明.txt, experiments/hall-clock-20261116/说明.txt.
// Local frames: X right, Y up, Z towards the viewer.  Television origin: on the cupboard top under the middle of the set.  Clock origin: on the wall, middle of the clock.
const TV = {
  tile: 0.25, corner: 7, fillet: 6, zf: 0.1935,
  front: { hw: 0.24, y0: 0.016, y1: 0.43, rc: 0.034, rf: 0.016, zb: -0.012, rb: 0.009 },
  opening: { x0: -0.2, x1: 0.196, y0: 0.066, y1: 0.392, r: 0.022, depth: 0.05 },
  rear: { zs: 0.02, z0: -0.012, z1: -0.184, hw0: 0.222, hw1: 0.165, top0: 0.412, top1: 0.335, bottom: 0.02, rc0: 0.046, rc1: 0.052, rb: 0.014 },
  buttons: { x: 0.211, hw: 0.007, hh: 0.0035, ys: [0.346, 0.331, 0.316], proud: 0.0022, power: { y: 0.086, hh: 0.007 } },
  grille: { x: 0.211, hw: 0.007, h: 0.0028, y0: 0.118, y1: 0.286, step: 0.008 },
  feet: [[0.185, 0.145], [-0.185, 0.145], [0.11, -0.13], [-0.11, -0.13]], footR: 0.012, footTop: 0.023,
  cord: { a: [-0.03, 0.07, -0.19], b: [-0.0387, 0.0661, -0.206], r: 0.0055 },
};
const CLOCK = {
  tile: 0.3, corner: 6, fillet: 5,
  frame: { hw: 0.2, hh: 0.17, r: 0.015, z: 0.042, rf: 0.007 },
  opening: { hw: 0.167, hh: 0.14, r: 0.011, depth: 0.011 },
  strip: { x: 0.1835, hw: 0.006, hh: 0.155, proud: 0.0018 },
  hands: { hour: 9, minute: 25, second: 41 },
};
const MAT = { shell: 0, slots: 1, keys: 2, rubber: 3, frame: 4, gold: 5, dial: 6, hand: 7, second: 8, glass: 9 };
const caches = new WeakMap();

function roundedLoop(cx, cy, hw, hh, r, z, n) {   // counter-clockwise seen from +Z, starts on the right side
  r = Math.max(0.0004, Math.min(r, hw, hh)); const pts = [];
  for (const [sx, sy, a0] of [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]])
    for (let k = 0; k <= n; k++) { const a = (a0 + k * 90 / n) * Math.PI / 180; pts.push([cx + sx * (hw - r) + r * Math.cos(a), cy + sy * (hh - r) + r * Math.sin(a), z]); }
  return pts;
}

// around: texture V runs round the section on lofted faces (the printed grain of the clock frame); otherwise U does.
function builder(tile, around) {
  const pos = [], uv = [], idx = [], seams = [];
  const put = (p, u, v) => { pos.push(p[0], p[1], p[2]); uv.push(u, v); return pos.length / 3 - 1; };
  return {
    loft(rings, inward = false) {   // rings front to back; the seam column is doubled for the texture and its normals are joined afterwards
      const n = rings[0].length, start = [];
      for (const ring of rings) {
        let u = 0; start.push(pos.length / 3);
        for (let j = 0; j <= n; j++) { const p = ring[j % n]; if (j) { const q = ring[j - 1]; u += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); } if (around) put(p, p[2] / tile, u / tile); else put(p, u / tile, p[2] / tile); }
        seams.push([start[start.length - 1], start[start.length - 1] + n]);
      }
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) { const a = start[i] + j, b = a + 1, c = start[i + 1] + j, d = c + 1; if (inward) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    },
    cap(ring, towardFront) {   // flat face closing a loop
      const n = ring.length, c = [0, 0, 0]; for (const p of ring) for (let k = 0; k < 3; k++) c[k] += p[k] / n;
      const ci = put(c, c[0] / tile, c[1] / tile), s = pos.length / 3; for (const p of ring) put(p, p[0] / tile, p[1] / tile);
      for (let j = 0; j < n; j++) { const a = s + j, b = s + (j + 1) % n; if (towardFront) idx.push(ci, a, b); else idx.push(ci, b, a); }
    },
    band(outer, inner) {   // flat front face between two loops with matching point counts
      const n = outer.length, s = pos.length / 3; for (const p of outer) put(p, p[0] / tile, p[1] / tile); for (const p of inner) put(p, p[0] / tile, p[1] / tile);
      for (let j = 0; j < n; j++) { const a = s + j, b = s + (j + 1) % n, c = s + n + j, d = s + n + (j + 1) % n; idx.push(a, b, c, c, b, d); }
    },
    quad(a, b, c, d, out) {   // flat strip, wound so that it faces `out`
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      const flip = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2] < 0, s = pos.length / 3;
      for (const p of flip ? [a, d, c, b] : [a, b, c, d]) put(p, 0, 0); idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
    },
    rect(x0, x1, y0, y1, z) {   // flat front-facing rectangle, the picture stretched once across it (v = 0 at the top, glTF convention)
      const s = pos.length / 3; put([x0, y0, z], 0, 1); put([x1, y0, z], 1, 1); put([x1, y1, z], 1, 0); put([x0, y1, z], 0, 0); idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
    },
    geometry(T) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const nrm = g.attributes.normal;
      for (const [a, b] of seams) { const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b), l = Math.hypot(x, y, z) || 1; nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l); }
      g.computeBoundingBox(); g.computeBoundingSphere(); return g;
    },
  };
}

// Rings of a block with a rounded section running along Z; section(z) gives {cx, cy, hw, hh, r}.  rf / rb round the front / back edge.
function blockRings(S, section, zFront, rf, zBack, rb) {
  const rings = [], F = S.fillet, at = (z, d) => { const c = section(z); return roundedLoop(c.cx, c.cy, c.hw - d, c.hh - d, c.r - d, z, S.corner); };
  if (rf > 0) for (let k = 0; k <= F; k++) { const a = (1 - k / F) * Math.PI / 2; rings.push(at(zFront - rf + rf * Math.sin(a), rf * (1 - Math.cos(a)))); } else rings.push(at(zFront, 0));
  if (rb > 0) for (let k = 0; k <= F; k++) { const a = k / F * Math.PI / 2; rings.push(at(zBack + rb - rb * Math.sin(a), rb * (1 - Math.cos(a)))); } else rings.push(at(zBack, 0));
  return rings;
}

function material(T, i) {
  let c = caches.get(T); if (!c) caches.set(T, c = { materials: [], textures: [] });
  if (c.materials[i]) return c.materials[i];
  const d = HALL_TV_CLOCK_DATA, s = d.materials[i], p = s.pbrMetallicRoughness, f = p.baseColorFactor;
  const m = new T.MeshStandardMaterial({ name: s.name, color: new T.Color().setRGB(f[0], f[1], f[2]), roughness: p.roughnessFactor, metalness: p.metallicFactor });
  if (s.alphaMode === 'BLEND') { m.transparent = true; m.opacity = f[3]; m.depthWrite = false; }
  m.userData = { asset: d.assetId, hallTvClockMaterial: i, houseHallTvClockRevision: 1 };
  if (typeof document !== 'undefined') {   // exports attach the same pictures from the data file instead
    const texture = (index, srgb) => {
      if (c.textures[index]) return c.textures[index];
      const t = d.textures[index], im = d.images[t.source], wrap = d.samplers[t.sampler].wrapS === 33071 ? T.ClampToEdgeWrapping : T.RepeatWrapping;
      const x = new T.TextureLoader().load(new URL(im.url,import.meta.url).href, () => { window.dispatchEvent(new Event('shikumen-asset-ready')); });
      x.flipY = false; x.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; x.wrapS = x.wrapT = wrap; x.anisotropy = 8; return c.textures[index] = x;
    };
    if (p.baseColorTexture) m.map = texture(p.baseColorTexture.index, true);
    if (p.metallicRoughnessTexture) m.roughnessMap = m.metalnessMap = texture(p.metallicRoughnessTexture.index, false);
  }
  return c.materials[i] = m;
}

function part(T, group, name, geometry, mat, shadow, kind) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const m = new T.Mesh(geometry, material(T, mat)); m.name = name; m.castShadow = shadow; m.receiveShadow = true; m.userData = { [kind]: name, houseHallTvClockRevision: 1 }; group.add(m); return m;
}

function buildHallTv(T) {
  const S = TV, shell = builder(S.tile, false), dark = builder(S.tile, false), keys = builder(S.tile, false), f = S.front, o = S.opening, r = S.rear, e = 0.0004;
  // front shell: flat face with the screen opening, rounded edges front and back, closed back
  const fr = blockRings(S, () => ({ cx: 0, cy: (f.y0 + f.y1) / 2, hw: f.hw, hh: (f.y1 - f.y0) / 2, r: f.rc }), S.zf, f.rf, f.zb, f.rb); shell.loft(fr); shell.cap(fr[fr.length - 1], false);
  const open = z => roundedLoop((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, (o.x1 - o.x0) / 2, (o.y1 - o.y0) / 2, o.r, z, S.corner);
  shell.band(fr[0], open(S.zf));
  // liner behind the opening, so nothing shows past the edge of the screen from the side
  shell.loft([open(S.zf), open(S.zf - o.depth)], true); shell.cap(open(S.zf - o.depth), true);
  // rear housing: straight taper, starts inside the front shell
  const span = r.z0 - r.z1, rc = z => { const t = (r.z0 - z) / span, top = r.top0 + (r.top1 - r.top0) * t; return { cx: 0, cy: (r.bottom + top) / 2, hw: r.hw0 + (r.hw1 - r.hw0) * t, hh: (top - r.bottom) / 2, r: r.rc0 + (r.rc1 - r.rc0) * t }; };
  const rr = blockRings(S, rc, r.zs, 0, r.z1 - r.rb, r.rb); shell.loft(rr); shell.cap(rr[rr.length - 1], false);
  // slots: flat dark strips a hair above the surface
  const g = S.grille; for (let y = g.y0; y <= g.y1 + 1e-6; y += g.step) dark.quad([g.x - g.hw, y - g.h / 2, S.zf + e], [g.x + g.hw, y - g.h / 2, S.zf + e], [g.x + g.hw, y + g.h / 2, S.zf + e], [g.x - g.hw, y + g.h / 2, S.zf + e], [0, 0, 1]);
  for (const sx of [1, -1]) {
    for (let y = 0.13; y <= 0.2501; y += 0.012) dark.quad([sx * (f.hw + e), y - 0.002, 0.13], [sx * (f.hw + e), y - 0.002, 0.03], [sx * (f.hw + e), y + 0.002, 0.03], [sx * (f.hw + e), y + 0.002, 0.13], [sx, 0, 0]);
    for (let y = 0.10; y <= 0.2601; y += 0.0115) { const za = r.z0 - 0.03, zb = r.z0 - 0.15, xa = rc(za).hw + e, xb = rc(zb).hw + e; dark.quad([sx * xa, y - 0.0022, za], [sx * xb, y - 0.0022, zb], [sx * xb, y + 0.0022, zb], [sx * xa, y + 0.0022, za], [sx, 0, 0]); }
  }
  const k = (r.top0 - r.top1) / span, lift = e / Math.hypot(1, k);
  for (let s = 0.03; s <= 0.1501; s += 0.012) { const top = z => r.top0 - k * (r.z0 - z) + lift, za = r.z0 - s + 0.0025, zb = r.z0 - s - 0.0025, L = 0.1; dark.quad([-L, top(za), za], [L, top(za), za], [L, top(zb), zb], [-L, top(zb), zb], [0, 1, 0]); }
  // keys
  const b = S.buttons, key = (y, hh) => { const rings = blockRings(S, () => ({ cx: b.x, cy: y, hw: b.hw, hh, r: 0.002 }), S.zf + b.proud, 0.0009, S.zf - 0.002, 0); keys.loft(rings); keys.cap(rings[0], true); };
  for (const y of b.ys) key(y, b.hh); key(b.power.y, b.power.hh);
  const group = new T.Group(), add = (name, geometry, mat, shadow = true) => part(T, group, name, geometry, mat, shadow, 'hallTvPart'); group.name = '客堂电视_本地机身';
  add('客堂电视_机壳', shell.geometry(T), MAT.shell); add('客堂电视_散热与扬声槽', dark.geometry(T), MAT.slots, false); add('客堂电视_按键', keys.geometry(T), MAT.keys);
  S.feet.forEach(([x, z], i) => { const foot = new T.CylinderGeometry(S.footR, S.footR * 0.92, S.footTop, 20); foot.translate(x, S.footTop / 2, z); add('客堂电视_机脚_' + (i + 1), foot, MAT.rubber); });
  const a = new T.Vector3(...S.cord.a), c = new T.Vector3(...S.cord.b), boss = new T.CylinderGeometry(S.cord.r * 0.8, S.cord.r, a.distanceTo(c), 14);
  boss.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), c.clone().sub(a).normalize())); boss.translate(...a.clone().add(c).multiplyScalar(0.5).toArray()); add('客堂电视_后盖出线护套', boss, MAT.rubber);
  group.userData = { kind: 'hall_television_cabinet', houseHallTvClockRevision: 1, size: [f.hw * 2, f.y1, S.zf - (r.z1 - r.rb)] };
  return group;
}

function buildHallClock(T) {
  const S = CLOCK, frame = builder(S.tile, true), gold = builder(S.tile, true), dial = builder(1, false), glass = builder(1, false), f = S.frame, o = S.opening, s = S.strip, zd = f.z - o.depth, h = S.hands;
  // frame: rounded outside, flat front with the dial opening, a short wall down to the dial
  const fr = blockRings(S, () => ({ cx: 0, cy: 0, hw: f.hw, hh: f.hh, r: f.r }), f.z, f.rf, 0, 0), open = z => roundedLoop(0, 0, o.hw, o.hh, o.r, z, S.corner);
  frame.loft(fr); frame.band(fr[0], open(f.z)); frame.loft([open(f.z), open(zd)], true);
  dial.rect(-o.hw, o.hw, -o.hh, o.hh, zd); glass.rect(-o.hw, o.hw, -o.hh, o.hh, f.z - 0.002);
  for (const sx of [1, -1]) { const r = blockRings(S, () => ({ cx: sx * s.x, cy: 0, hw: s.hw, hh: s.hh, r: 0.002 }), f.z + s.proud, 0.0012, f.z - 0.001, 0); gold.loft(r); gold.cap(r[0], true); }
  const group = new T.Group(), add = (name, geometry, mat, shadow = false) => part(T, group, name, geometry, mat, shadow, 'hallClockPart'); group.name = '客堂挂钟_本地石英挂钟';
  add('客堂挂钟_外框', frame.geometry(T), MAT.frame, true); add('客堂挂钟_金色边条', gold.geometry(T), MAT.gold); add('客堂挂钟_钟面', dial.geometry(T), MAT.dial); add('客堂挂钟_面玻璃', glass.geometry(T), MAT.glass).renderOrder = 2;
  // hands: flat blades under the glass; angles clockwise from twelve
  const blade = (pts, z, angle) => { const sh = new T.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth: 0.001, bevelEnabled: false }); g.rotateZ(-angle); g.translate(0, 0, z); return g; };
  const spade = (len, w) => [[-w * 0.45, -len * 0.16], [w * 0.45, -len * 0.16], [w * 0.5, len * 0.1], [w, len * 0.55], [0, len], [-w, len * 0.55], [-w * 0.5, len * 0.1]];
  add('客堂挂钟_时针', blade(spade(0.067, 0.0056), zd + 0.0020, (h.hour % 12 + h.minute / 60) * Math.PI / 6), MAT.hand);
  add('客堂挂钟_分针', blade(spade(0.100, 0.0042), zd + 0.0036, (h.minute + h.second / 60) * Math.PI / 30), MAT.hand);
  add('客堂挂钟_秒针', blade([[-0.0018, -0.028], [0.0018, -0.028], [0.0006, 0.108], [-0.0006, 0.108]], zd + 0.0052, h.second * Math.PI / 30), MAT.second);
  const hub = new T.CylinderGeometry(0.0065, 0.0065, 0.0052, 24); hub.rotateX(Math.PI / 2); hub.translate(0, 0, zd + 0.0036); add('客堂挂钟_指针轴', hub, MAT.hand);
  const cap = new T.CylinderGeometry(0.0033, 0.0033, 0.0012, 16); cap.rotateX(Math.PI / 2); cap.translate(0, 0, zd + 0.0068); add('客堂挂钟_秒针轴帽', cap, MAT.second);
  group.userData = { kind: 'wall_clock', houseHallTvClockRevision: 1, size: [2 * f.hw, 2 * f.hh, f.z + s.proud] };
  return group;
}

// Replaces the generated television cabinet and the old round clock where they exist (the fast viewer builds the house without the hall first).
export function installHallTvClock(T, root) {if(!FAST_ENABLED("hall-tv-clock"))return;
  if (root.userData.hallTvClock) return;
  const d = HALL_TV_CLOCK_DATA, done = { revision: 1, source: d.source, television: null, clocks: [], userVisualApproved: 'samples approved 2026-11-16 (可以很棒 / 这种式样的就可以了; clock enlarged after 有点小); house placement pending' };
  const tv = root.getObjectByName('显像管电视');
  if (tv) {   // the screen glass stays for tv-screens.js to retire; everything else of the generated set goes
    const old = []; tv.traverse(o => { if (o.isMesh && !o.userData.tvScreenRole && ![].concat(o.material).some(m => m.name.includes('曲面屏玻璃'))) old.push(o); });
    if (old.length) {
      const host = old[0], g = buildHallTv(T); host.parent.add(g); g.position.copy(host.position); g.quaternion.copy(host.quaternion); g.scale.copy(host.scale);
      for (const o of old) o.removeFromParent();
      done.television = { parent: tv.name, retired: old.map(o => o.name), parts: g.children.map(o => o.name), size: g.userData.size };
    }
  }
  const clocks = []; root.traverse(o => { if (o.name === 'HALL_CLOCK') clocks.push(o); });
  if (clocks.length) root.updateMatrixWorld(true);
  for (const old of clocks) {   // same spot on the wall; the back of the old clock is the wall face
    const box = new T.Box3(), inv = old.parent.matrixWorld.clone().invert(); let meshes = 0;
    old.traverse(o => { if (o.isMesh) { meshes++; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); } });
    const g = buildHallClock(T); g.userData = { ...old.userData, ...g.userData }; old.parent.add(g); g.position.set(old.position.x, old.position.y, box.min.z + 0.001); old.removeFromParent();
    done.clocks.push({ parent: g.parent.name, retired: old.name, retiredMeshes: meshes, position: g.position.toArray().map(v => +v.toFixed(4)), parts: g.children.map(o => o.name), size: g.userData.size });
  }
  root.userData.hallTvClock = done;
  if (done.television || done.clocks.length) root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}
