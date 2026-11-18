import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { MARITAL_COMBO_DATA } from './marital-combo-data.js';

// B1 marital-room corner combination cabinet (2026-11-14; 鹿鹿 chose layout 乙 and approved the second sample, see
// experiments/marital-combo-20261114/说明.txt).  Cream lacquered panels in brown veneer frames after her 1990 Shanghai reference photo.
// Install removes the old three-door wardrobe and dressing table (MARITAL_COMBO_DATA.retire), shifts the stool (…move), then adds the
// cabinet and its props to 婚房_furniture.  2026-11-14 (鹿鹿): the recorder is gone and the small TV from the lounge bookcase top moves
// into the open niche (…relocate); house-services.js then skips the TV plug and cord on the lounge socket.
// Later the same day: the matching bed (cream panels in a brown frame headboard), bedside cabinet and a vertical colour wedding portrait
// replace the old dark bed, bedside cabinet and the horizontal black-and-white photo. The portrait keeps part id ML02 and the wall
// mirror ML09, so the room's cut-away views hide them together with the wall they hang on.  The 13 door hinges carry kind 'wardrobe_leaf', so the marital room's existing cabinet
// toggle opens them; the mirror mesh name starts with 独立银镜面, so the viewer gives it the existing planar reflection.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = MARITAL_COMBO_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_组合柜v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') m.depthWrite = false;
    m.userData = { asset: d.assetId, maritalComboMaterial: i, houseMaritalComboRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseMaritalComboRevision: 1 };
      m.castShadow = !m.material.transparent; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}



export function installMaritalCombo(T, root) {if(!FAST_ENABLED("marital-combo"))return;
  if (root.userData.maritalCombo) return;
  const d = MARITAL_COMBO_DATA, c = cache(T), sets = [], retired = [], moved = []; root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert();
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
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing combination cabinet parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.userData = { ...n.userData, maritalComboId: f.id, houseMaritalComboRevision: 1 };
    parent.add(n); sets.push(f.id);
  }
  root.updateMatrixWorld(true);
  root.userData.maritalCombo = { revision: 1, source: d.source, sets, retired, moved, relocated, placement: 'house-local position from the approved sample, 2026-11-14', userVisualApproved: 'second sample approved 2026-11-14; house placement pending' };
  root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}

export const MARITAL_COMBO_IDS = MARITAL_COMBO_DATA.fixtures.map(f => f.id);
