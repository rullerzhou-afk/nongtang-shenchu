import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { ROOM_FINISHING_DATA } from './room-finishing-data.js';

// Desk-top finishing in B1 (2026-11-15; see experiments/room-finishing-20261114/说明.txt): a sheet of glass on the marital-room dressing
// counter, and a sheet of glass over the middle-wing desk with the grandmother's two photographs and two handwritten slips under it.
// Installing it also rounds the squashed desk lamp ('reshape': the stretch is baked into cloned geometry so that exports keep it) and
// lifts the things standing on the desk onto the glass ('lift').  house-services.js re-routes the lamp flex over the glass when
// root.userData.roomFinishing is set, so this must be installed before the services.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = ROOM_FINISHING_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_收尾v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') m.depthWrite = false;
    m.userData = { asset: d.assetId, roomFinishingMaterial: i, houseRoomFinishingRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseRoomFinishingRevision: 1, ...(s.extras && s.extras.mirrorNormalLocal ? { mirrorNormalLocal: s.extras.mirrorNormalLocal } : {}) };
      m.castShadow = !m.material.transparent; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}



export function installRoomFinishing(T, root) {if(!FAST_ENABLED("room-finishing"))return;
  if (root.userData.roomFinishing) return;
  const d = ROOM_FINISHING_DATA, c = cache(T), sets = [], retired = [], moved = []; root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert();
  for (const r of d.retire) {
    const g = root.getObjectByName(r.parent), o = g && g.getObjectByName(r.name); if (!o) throw new Error('Missing furniture to replace ' + r.parent + '/' + r.name);
    o.parent.remove(o); retired.push(r.name);
  }
  for (const r of d.move) {   // houseDelta is in house-local axes; the room group is not rotated, so it applies to the child's position directly
    const g = root.getObjectByName(r.parent), o = g && g.getObjectByName(r.name); if (!o) throw new Error('Missing furniture to move ' + r.parent + '/' + r.name);
    o.position.x += r.houseDelta[0]; o.position.y += r.houseDelta[1]; o.position.z += r.houseDelta[2]; moved.push(r.name);
  }
  const relocated = [];
  for (const r of d.relocate) {   // an existing object moves to another room group: keep its house-local orientation, shift by houseDelta
    const from = root.getObjectByName(r.from), o = from && from.getObjectByName(r.name), to = root.getObjectByName(r.to); if (!o || !to) throw new Error('Missing object to relocate ' + r.from + '/' + r.name);
    root.updateMatrixWorld(true); const house = rootInv.clone().multiply(o.matrixWorld); house.elements[12] += r.houseDelta[0]; house.elements[13] += r.houseDelta[1]; house.elements[14] += r.houseDelta[2];
    rootInv.clone().multiply(to.matrixWorld).invert().multiply(house).decompose(o.position, o.quaternion, o.scale); to.add(o); relocated.push(r.name);
  }
  for (const f of d.fixtures) {
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing finishing parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.userData = { ...n.userData, roomFinishingId: f.id, houseRoomFinishingRevision: 1 };
    parent.add(n); sets.push(f.id);
  }
  const reshaped = [], lifted = [];
  for (const r of d.reshape) {   // stretch about the base centre along a horizontal house-local axis; baked into cloned geometry
    const g = root.getObjectByName(r.parent), o = g && g.getObjectByName(r.name); if (!o) throw new Error('Missing object to reshape ' + r.parent + '/' + r.name);
    root.updateMatrixWorld(true); const n = Math.hypot(...r.axis), a = r.axis.map(v => v / n), k = r.factor - 1, v = new T.Vector3(); let cx = 0, cz = 0, cn = 0;
    o.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position, mm = rootInv.clone().multiply(m.matrixWorld);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mm); if (v.y < r.baseBelowY) { cx += v.x; cz += v.z; cn++; } } });
    cx /= cn; cz /= cn;
    const S = new T.Matrix4().set(1 + k * a[0] * a[0], 0, k * a[0] * a[2], 0, 0, 1, 0, 0, k * a[2] * a[0], 0, 1 + k * a[2] * a[2], 0, 0, 0, 0, 1);
    const full = new T.Matrix4().makeTranslation(cx, 0, cz).multiply(S).multiply(new T.Matrix4().makeTranslation(-cx, 0, -cz));
    o.traverse(m => { if (!m.isMesh) return; const mm = rootInv.clone().multiply(m.matrixWorld);
      m.geometry = m.geometry.clone().applyMatrix4(mm.clone().invert().multiply(full).multiply(mm)); m.geometry.computeBoundingSphere(); });
    reshaped.push({ name: r.name, baseCentre: [+cx.toFixed(4), +cz.toFixed(4)] });
  }
  for (const r of d.lift) {
    const g = root.getObjectByName(r.parent), o = g && g.getObjectByName(r.name); if (!o) throw new Error('Missing object to lift ' + r.parent + '/' + r.name);
    o.position.y += r.dy; lifted.push(r.name);
  }
  root.updateMatrixWorld(true);
  root.userData.roomFinishing = { revision: 1, source: d.source, sets, retired, moved, relocated, reshaped, lifted, placement: 'house-local position from the sample, 2026-11-15', userVisualApproved: 'samples seen 2026-11-15 (我觉得很棒); house placement pending' };
  root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}

export const ROOM_FINISHING_IDS = ROOM_FINISHING_DATA.fixtures.map(f => f.id);
