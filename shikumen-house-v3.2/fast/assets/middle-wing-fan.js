import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { MIDDLE_WING_FAN_DATA } from './middle-wing-fan-data.js';

// B1 middle-wing floor fan (2026-11-14; chosen by 鹿鹿 over a Taiwanese box fan, concept and sample approved step by step, see
// experiments/middle-wing-floor-fan-20261114/说明.txt).  A mid-1980s household pedestal fan, 1.257 m tall, guard 0.45 m, base 0.40 m,
// standing in front of the east wall north of the sewing machine, head turned towards the sewing stool and the desk chair.
// It does not turn, oscillate or change height.  Its wall socket, supply line and cord are in house-services.js.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = MIDDLE_WING_FAN_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_中厢落地扇v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    // The translucent blades must not write depth (the guard wires and motor behind them stay visible).
    if (s.alphaMode === 'BLEND') m.depthWrite = false;
    m.userData = { asset: d.assetId, middleWingFanMaterial: i, houseMiddleWingFanRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseMiddleWingFanRevision: 1 };
      m.castShadow = !m.material.transparent; m.receiveShadow = !m.material.transparent; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}



export function installMiddleWingFan(T, root) {if(!FAST_ENABLED("middle-wing-fan"))return;
  if (root.userData.middleWingFan) return;
  const d = MIDDLE_WING_FAN_DATA, c = cache(T), sets = []; root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert();
  for (const f of d.fixtures) {
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing middle-wing parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.userData = { ...n.userData, middleWingFanId: f.id, middleWingFanRoom: f.room, houseMiddleWingFanRevision: 1 };
    parent.add(n); sets.push(f.id);
  }
  root.updateMatrixWorld(true);
  root.userData.middleWingFan = { revision: 1, source: d.source, sets, placement: 'house-local position from the approved sample, 2026-11-14', userVisualApproved: 'sample and house placement approved by 鹿鹿 2026-11-14' };
  root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}

export const MIDDLE_WING_FAN_IDS = MIDDLE_WING_FAN_DATA.fixtures.map(f => f.id);
