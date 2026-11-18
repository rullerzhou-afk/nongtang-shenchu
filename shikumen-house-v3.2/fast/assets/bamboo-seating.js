import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { BAMBOO_SEATING_DATA } from './bamboo-seating-data.js';

// B1 bamboo seats (2026-11-13, concepts and budget approved by 鹿鹿): a bamboo rocking recliner in the elderly room
// (replaces the reused wooden chair by the west window), two country bamboo stools at the hall dining table (replace the
// two wooden stools), a low bamboo chair in the front courtyard (new) and a third stool of the same kind pulled out beside
// the kitchen's small table (BS02-K, added with the kitchen "开小灶" corner). Each seat hangs in its room's furniture group,
// so room close-ups and section views treat it like the furniture it stands among.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = BAMBOO_SEATING_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_竹器v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    m.userData = { asset: d.assetId, bambooSeatingMaterial: i, houseBambooSeatingRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseBambooSeatingRevision: 1 };
      m.castShadow = true; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}

export function installBambooSeating(T, root) {if(!FAST_ENABLED("bamboo-seating"))return;
  if (root.userData.bambooSeating) return;
  const c = cache(T); root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert(), sets = [], retired = [];
  // Take the replaced seats out first (the wooden chair by the elderly room's west window, the hall's two wooden stools).
  for (const r of BAMBOO_SEATING_DATA.retire) {
    const o = root.getObjectByName(r.name); if (!o || !o.parent || o.parent.name !== r.parent) throw new Error('Missing seat to replace ' + r.name);
    o.parent.remove(o); retired.push(r.name);
  }
  // Move objects that stay in their own room data to a new spot (house-local origin; rotation and height kept).
  const relocated = [];
  for (const r of BAMBOO_SEATING_DATA.relocate || []) {
    const o = root.getObjectByName(r.name); if (!o || !o.parent || o.parent.name !== r.parent) throw new Error('Missing object to move ' + r.name);
    const house = rootInv.clone().multiply(o.matrixWorld), at = new T.Vector3().setFromMatrixPosition(house);
    if (at.distanceTo(new T.Vector3(...r.from)) > .01) throw new Error('Unexpected start position for ' + r.name);
    house.setPosition(...r.to);
    rootInv.clone().multiply(o.parent.matrixWorld).invert().multiply(house).decompose(o.position, o.quaternion, o.scale);
    o.updateMatrixWorld(true); relocated.push(r.name);
  }
  for (const f of BAMBOO_SEATING_DATA.fixtures) {
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing seat parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.name = '竹器_' + f.name;
    n.userData = { ...n.userData, seatId: f.id, seatRoom: f.room, houseBambooSeatingRevision: 1 };
    parent.add(n); sets.push(f.id);
  }
  root.userData.bambooSeating = { revision: 1, source: BAMBOO_SEATING_DATA.source, sets, retired, relocated, placement: 'house-local floor positions measured 2026-11-13' };
  root.userData.textureCount = (root.userData.textureCount || 0) + BAMBOO_SEATING_DATA.images.length;
}

export const BAMBOO_SEATING_IDS = BAMBOO_SEATING_DATA.fixtures.map(f => f.id);
