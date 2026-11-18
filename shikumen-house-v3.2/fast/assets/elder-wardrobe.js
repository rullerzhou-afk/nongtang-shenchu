import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { ELDER_WARDROBE_DATA } from './elder-wardrobe-data.js';

// B1 elder-room three-part wardrobe with a mirror door, and two old cases on top (2026-11-14; 鹿鹿 chose design 甲 and approved the
// sample, see experiments/elder-wardrobe-20261114/说明.txt).  Install removes the old two-door wardrobe (ELDER_WARDROBE_DATA.retire) and
// adds the new pieces to 前厢_furniture.  The three door hinges carry the room's existing kind 'front_wing_cabinet_leaf', so the room's
// cabinet toggle opens them.  The mirror mesh name starts with 独立银镜面 and its node carries mirrorNormalLocal, so the viewer's planar
// reflection follows the door as it turns.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = ELDER_WARDROBE_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_大橱v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') m.depthWrite = false;
    m.userData = { asset: d.assetId, elderWardrobeMaterial: i, houseElderWardrobeRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseElderWardrobeRevision: 1, ...(s.extras && s.extras.mirrorNormalLocal ? { mirrorNormalLocal: s.extras.mirrorNormalLocal } : {}) };
      m.castShadow = !m.material.transparent; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}



export function installElderWardrobe(T, root) {if(!FAST_ENABLED("elder-wardrobe"))return;
  if (root.userData.elderWardrobe) return;
  const d = ELDER_WARDROBE_DATA, c = cache(T), sets = [], retired = [], moved = []; root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert();
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
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing wardrobe parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.userData = { ...n.userData, elderWardrobeId: f.id, houseElderWardrobeRevision: 1 };
    parent.add(n); sets.push(f.id);
  }
  root.updateMatrixWorld(true);
  root.userData.elderWardrobe = { revision: 1, source: d.source, sets, retired, moved, relocated, placement: 'house-local position from the approved sample, 2026-11-14', userVisualApproved: 'sample and hardware approved 2026-11-14' };
  root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}

export const ELDER_WARDROBE_IDS = ELDER_WARDROBE_DATA.fixtures.map(f => f.id);
