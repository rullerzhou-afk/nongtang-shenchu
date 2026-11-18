import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { KITCHEN_CONDIMENTS_DATA } from './kitchen-condiments-data.js';

// Six approved condiment and toothpaste samples, placed on the existing counter and sink ledge.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = KITCHEN_CONDIMENTS_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_厨房生活物件v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
    m.userData = { asset: d.assetId, kitchenCondimentsMaterial: i, houseKitchenCondimentsRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseKitchenCondimentsRevision: 1 };
      m.castShadow = true; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}

export function installKitchenCondiments(T, root) {if(!FAST_ENABLED("kitchen-condiments"))return;
  if (root.userData.kitchenCondiments) return;
  const c = cache(T); root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert(), sets = [];
  for (const f of KITCHEN_CONDIMENTS_DATA.fixtures) {
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing kitchen parent ' + f.parent);
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.name = '厨房生活物件_' + f.name;
    n.userData = { ...n.userData, condimentId: f.id, condimentRoom: f.room, houseKitchenCondimentsRevision: 1 };
    parent.add(n); sets.push(f.id);
  }
  root.userData.kitchenCondiments = { revision: 1, source: KITCHEN_CONDIMENTS_DATA.source, sets, placement: 'house-local positions from the approved sample, 2026-11-14' };
  root.userData.textureCount = (root.userData.textureCount || 0) + KITCHEN_CONDIMENTS_DATA.images.length;
}

export const KITCHEN_CONDIMENTS_IDS = KITCHEN_CONDIMENTS_DATA.fixtures.map(f => f.id);
