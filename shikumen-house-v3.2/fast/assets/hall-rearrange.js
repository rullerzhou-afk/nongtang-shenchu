import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { HALL_REARRANGE_DATA } from './hall-rearrange-data.js';
import { LIGHTING_DATA } from './lighting-data.js';

// B1 hall rearrangement (2026-11-14; layout, concept, parts and samples approved by 鹿鹿 step by step, see
// experiments/hall-furniture-20261114/说明.txt).  The ground-floor hall becomes a dining room around an eight-immortals table:
// - out: two-seat sofa, small dining table, desk fan, the two bamboo stools at the table, coat stand with winter overcoat;
// - in: eight-immortals table with two benches (the two wooden chairs stay, north and south), fruit bowl, three-blade ceiling fan,
//   refrigerator with lace cover, glass-fronted cabinet with its contents, lace runner, radio cassette recorder, tapes, plastic
//   flowers and teapot, and on the west wall a coat-hook shelf box with a straw hat and a thin jacket;
// - moved: chairs to the new table, thermos and mugs to the TV cabinet, the pendant lamp (and its light point) over the new table;
// - fixed: the bamboo-cased thermos was squashed east-west to 0.7 of its depth; stretched back layer by layer.
// The hall wiring that goes with this (lamp and fan lines, fan regulator, fridge/radio socket, single TV socket) is in
// house-services.js.  Everything hangs in 客堂_furniture like the other hall furniture.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = HALL_REARRANGE_DATA, geometries = [], materials = new Map(), textures = new Map();
  const arrays = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  function attribute(a) { const raw = FAST_BYTES(a); return new THREE.BufferAttribute(new arrays[a.type](raw.buffer), a.size, !!a.normalized); }
  function geometry(i) {
    if (geometries[i]) return geometries[i];
    const s = d.geometries[i], g = new THREE.BufferGeometry(), names = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', TANGENT: 'tangent' };
    for (const [k, a] of Object.entries(s.attributes)) g.setAttribute(names[k], attribute(a));
    if (s.indices) g.setIndex(attribute(s.indices));
    g.computeBoundingSphere(); return geometries[i] = g;
  }
  function texture(info, color = false) {
    const i = info.index, channel = info.texCoord || 0, key = i + ':' + color + ':' + channel;
    if (textures.has(key)) return textures.get(key);
    const def = d.textures[i], im = d.images[def.source], sam = d.samplers[def.sampler] || {};
    const t = new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href, () => { window.dispatchEvent(new Event('shikumen-asset-ready')); });
    t.flipY = false; t.channel = channel; t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = sam.wrapS === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = sam.wrapT === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 8; textures.set(key, t); return t;
  }
  function material(i) {
    if (materials.has(i)) return materials.get(i);
    const s = d.materials[i], p = s.pbrMetallicRoughness || {}, f = p.baseColorFactor || [1, 1, 1, 1];
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_客堂重排v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    // Glass panes, tumblers and bottles: see-through, so they must not write depth (things behind them stay visible).
    if (s.alphaMode === 'BLEND') m.depthWrite = false;
    m.userData = { asset: d.assetId, hallRearrangeMaterial: i, houseHallRearrangeRevision: 1 };
    if (typeof document !== 'undefined') {
      if (p.baseColorTexture) m.map = texture(p.baseColorTexture, true);
      if (p.metallicRoughnessTexture) { m.roughnessMap = m.metalnessMap = texture(p.metallicRoughnessTexture); }
      if (s.normalTexture) { m.normalMap = texture(s.normalTexture); m.normalScale.setScalar(s.normalTexture.scale ?? 1); }
    }
    materials.set(i, m); return m;
  }
  function node(s) {
    const o = new THREE.Group(); o.name = s.name; o.userData = { ...s.extras };
    if (s.matrix) new THREE.Matrix4().fromArray(s.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (s.translation) o.position.fromArray(s.translation); if (s.rotation) o.quaternion.fromArray(s.rotation); if (s.scale) o.scale.fromArray(s.scale); }
    for (const p of s.primitives || []) {
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseHallRearrangeRevision: 1 };
      m.castShadow = !m.material.transparent; m.receiveShadow = !m.material.transparent; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}


// Move an object by a house-local translation, whatever its parent chain is.
function shift(T, rootInv, o, dx, dy, dz) {
  o.updateWorldMatrix(true, false);
  const house = new T.Matrix4().makeTranslation(dx, dy, dz).multiply(rootInv.clone().multiply(o.matrixWorld));
  o.parent.updateWorldMatrix(true, false);
  rootInv.clone().multiply(o.parent.matrixWorld).invert().multiply(house).decompose(o.position, o.quaternion, o.scale);
  o.updateMatrixWorld(true);
}
function houseBox(T, rootInv, o) { o.updateWorldMatrix(true, true); return new T.Box3().setFromObject(o).applyMatrix4(rootInv); }

// The thermos: per height layer, compare the half-width on the side without the handle (X) with the half-depth (Z) and stretch X
// about the bottle axis so the body, neck and cap are round again.  Geometry is cloned first; normals are corrected to match.
function roundThermos(T, rootInv, th, cfg) {
  if (th.userData.hallRearrangeRounded) return th.userData.hallRearrangeRounded;
  const meshes = [], pts = [], v = new T.Vector3(); th.updateWorldMatrix(true, true); th.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) { const pa = m.geometry.attributes.position, M = rootInv.clone().multiply(m.matrixWorld); for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); pts.push([v.x, v.y, v.z]); } }
  let y0 = Infinity, y1 = -Infinity; for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const H = y1 - y0, N = cfg.layers, ext = (a, i) => { let lo = Infinity, hi = -Infinity; for (const p of a) { if (p[i] < lo) lo = p[i]; if (p[i] > hi) hi = p[i]; } return [lo, hi]; };
  const base = pts.filter(p => p[1] < y0 + .2 * H), bx = ext(base, 0), bz = ext(base, 2), cx = (bx[0] + bx[1]) / 2, ks = [];
  for (let sl = 0; sl < N; sl++) {
    const band = pts.filter(p => p[1] >= y0 + sl / N * H && p[1] <= y0 + (sl + 1) / N * H); if (band.length < 12) { ks.push(null); continue; }
    const ex = ext(band, 0), ez = ext(band, 2); ks.push(Math.min(cfg.maxStretch, Math.max(1, (ez[1] - ez[0]) / 2 / Math.min(cx - ex[0], ex[1] - cx))));
  }
  for (let i = 0; i < N; i++) if (ks[i] === null) ks[i] = ks[i - 1] ?? ks.find(x => x !== null);
  const sm = ks.map((k, i) => (ks[Math.max(0, i - 1)] + k * 2 + ks[Math.min(N - 1, i + 1)]) / 4);
  const kAt = t => { const f = Math.min(N - 1, Math.max(0, t * N - .5)), a = Math.floor(f), b = Math.min(N - 1, a + 1); return sm[a] + (sm[b] - sm[a]) * (f - a); };
  for (const m of meshes) {
    const g = m.geometry.clone(), pa = g.attributes.position, na = g.attributes.normal, M = rootInv.clone().multiply(m.matrixWorld), MI = M.clone().invert(), n = new T.Vector3(), NM = new T.Matrix3().getNormalMatrix(M), NI = new T.Matrix3().getNormalMatrix(MI);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(M); const kk = kAt((v.y - y0) / H); v.x = cx + (v.x - cx) * kk; v.applyMatrix4(MI); pa.setXYZ(i, v.x, v.y, v.z);
      if (na) { n.fromBufferAttribute(na, i).applyMatrix3(NM).normalize(); n.x /= kk; n.normalize().applyMatrix3(NI).normalize(); na.setXYZ(i, n.x, n.y, n.z); }
    }
    pa.needsUpdate = true; if (na) na.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); m.geometry = g;
  }
  const b = houseBox(T, rootInv, th);
  return th.userData.hallRearrangeRounded = { before: [+(bx[1] - bx[0]).toFixed(4), +(bz[1] - bz[0]).toFixed(4)], after: [+(b.max.x - b.min.x).toFixed(4), +(b.max.z - b.min.z).toFixed(4)], stretch: [+Math.min(...sm).toFixed(2), +Math.max(...sm).toFixed(2)] };
}

export function installHallRearrange(T, root) {if(!FAST_ENABLED("hall-rearrange"))return;
  if (root.userData.hallRearrange) return;
  const d = HALL_REARRANGE_DATA, c = cache(T); root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert();
  const hall = root.getObjectByName('客堂_furniture'); if (!hall) throw new Error('Missing 客堂_furniture');
  const retired = [], relocated = [], sets = [];
  // 1. Take out what the rearrangement replaces.
  for (const name of d.retire) { const o = hall.getObjectByName(name); if (!o) throw new Error('Missing hall object to retire ' + name); o.parent.remove(o); retired.push(name); }
  // 1b. A piece that leaves the hall for another room keeps its model: re-parent it (world transform kept), turn it, then put its
  //     bounding-box centre and its feet where the data says (house-local metres).
  const rehomed = [];
  for (const r of d.rehome || []) {
    const o = hall.getObjectByName(r.name), g = root.getObjectByName(r.toGroup); if (!o || !g) throw new Error('Missing object or group to rehome ' + r.name + ' → ' + r.toGroup);
    g.attach(o); o.rotateOnWorldAxis(new T.Vector3(0, 1, 0), (r.rotY || 0) * Math.PI / 180);
    const b = houseBox(T, rootInv, o); shift(T, rootInv, o, r.to[0] - (b.min.x + b.max.x) / 2, r.bottom - b.min.y, r.to[1] - (b.min.z + b.max.z) / 2);
    o.name = r.newName; o.userData = { ...o.userData, hallRearrangeRehomedFrom: r.name }; rehomed.push(r.newName);
  }
  // 2. Round the thermos, then move the kept pieces (bounding-box centre to the new floor position, optional height change).
  const th = hall.getObjectByName(d.roundThermos.name); if (!th) throw new Error('Missing ' + d.roundThermos.name);
  const thermos = roundThermos(T, rootInv, th, d.roundThermos);
  for (const r of d.relocate) {
    const o = hall.getObjectByName(r.name); if (!o) throw new Error('Missing hall object to move ' + r.name);
    const b = houseBox(T, rootInv, o); shift(T, rootInv, o, r.to[0] - (b.min.x + b.max.x) / 2, r.dy || 0, r.to[1] - (b.min.z + b.max.z) / 2); relocated.push(r.name);
  }
  // 3. Pendant lamp over the new table: move the fixture, and the light point in the shared lighting data (absolute, so repeatable).
  let lamp = null; hall.traverse(o => { if (!lamp && o.userData.houseLampId === d.lamp.id) lamp = o; });
  if (!lamp) throw new Error('Missing hall lamp fixture');
  { const b = houseBox(T, rootInv, lamp); shift(T, rootInv, lamp, d.lamp.to[0] - (b.min.x + b.max.x) / 2, 0, d.lamp.to[1] - (b.min.z + b.max.z) / 2); }
  let lights = 0; for (const l of LIGHTING_DATA.lights) if (l.lamp === d.lamp.id) { l.position = [d.lamp.to[0], l.position[1], d.lamp.to[1]]; lights++; }
  if (!lights) throw new Error('Missing hall light point');
  // 4. New pieces at their house-local places.  Wall-mounted ones carry the wall-decor tags so room close-ups hide them with their wall.
  for (const f of d.fixtures) {
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing hall parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.userData = { ...n.userData, hallRearrangeId: f.id, hallRearrangeRoom: f.room, houseHallRearrangeRevision: 1 };
    if (f.wallSide) { n.userData.wallRoom = 'hall'; n.userData.wallSide = f.wallSide; n.userData.wallItemId = f.id; }
    parent.add(n); sets.push(f.id);
  }
  root.updateMatrixWorld(true);
  root.userData.hallRearrange = { revision: 1, source: d.source, sets, retired, rehomed, relocated, lamp: { id: d.lamp.id, to: d.lamp.to, lightPoints: lights }, thermos,
    placement: 'house-local positions from the approved samples, 2026-11-14', userVisualApproved: 'samples approved step by step 2026-11-14; house placement pending' };
  root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}

export const HALL_REARRANGE_IDS = HALL_REARRANGE_DATA.fixtures.map(f => f.id);
