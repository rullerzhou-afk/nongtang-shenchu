import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { NEIGHBOUR_LIFE_DATA } from './neighbour-life-data.js';

// Sparse neighbour life: only A2, A5, A6; untouched originals and inspection in experiments/neighbour-balconies-20261116.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = NEIGHBOUR_LIFE_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_邻里晒台v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') m.depthWrite = false;
    m.userData = { asset: d.assetId + ':material:' + i, neighbourLifeMaterial: i, neighbourLifeRevision: 1 };
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
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { neighbourLifeRevision: 1, ...(s.extras && s.extras.mirrorNormalLocal ? { mirrorNormalLocal: s.extras.mirrorNormalLocal } : {}) };
      m.castShadow = !m.material.transparent; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}



export function installNeighbourLife(T, root, id) {if(!FAST_ENABLED("neighbour-life"))return;
  const assignment = {A2:'NB02', A5:'NB01', A6:'NB03'}, ident=assignment[id];
  if (!ident || root.userData.neighbourLife) return;
  const parent=root.getObjectByName('L2H_晒台');
  if (!parent) throw new Error('Missing neighbour balcony '+id);
  const c=cache(T), group=new T.Group();group.name='邻里晒台_'+ident;group.userData={neighbourLife:ident,sourceTask:NEIGHBOUR_LIFE_DATA.source.tasks[ident]};
  for (const s of NEIGHBOUR_LIFE_DATA.parts[ident]) group.add(c.node(s));
  if(ident==='NB01') {
    const a=NEIGHBOUR_LIFE_DATA.supportAnchor;group.position.set(1.8-a[0],6.63-a[1],-14.2-a[2]);
  } else {
    if(ident==='NB02'){group.rotation.y=-.5;group.position.set(2.35,0,-13.1);}
    else {group.rotation.x=1.35;group.position.set(2.45,0,-14.65);}
    group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(group);group.position.y=4.8-box.min.y;
    if(ident==='NB03')group.position.z+=-14.79-box.min.z+.002; // upper rim contacts the inner north parapet
  }
  parent.add(group);root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(group),inv=root.matrixWorld.clone().invert();box.applyMatrix4(inv);
  root.userData.neighbourLife={revision:1,part:ident,sourceTask:group.userData.sourceTask,bounds:{min:box.min.toArray(),max:box.max.toArray()},userVisualApproved:false};
}
