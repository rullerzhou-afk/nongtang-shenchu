import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { CURTAINS_DATA } from './curtains-data.js';

// B1 curtains and door curtains (approved 2026-11-13): 12 new sets plus remakes of the 婚房 and 亭子间 curtains.
// Each set hangs in its room's furniture group so room close-up clones carry it; the old 婚房/亭子间 curtains are removed.
const caches = new WeakMap();
// Close-ups cut away the walls facing the camera (same lists as the viewer's room close-ups). A curtain on a cut wall is hidden.
const CLOSEUP_CUTS = {
  frontWing: [['frontwing', 'frontwingreverse', 'frontclock', 'frontpot'], a => ['frontwingreverse', 'frontclock'].includes(a) ? ['north', 'west'] : ['south', 'east']],
  hall: [['hall', 'hallreverse', 'hallcabinet','hallpower', 'hallphone', 'hallcoat'], a => ['hallreverse', 'hallcoat'].includes(a) ? ['north', 'east'] : ['south', 'west']],
  middleWing: [['middlewing', 'middlewingreverse', 'middlecup', 'middlecard','middlepower'], a => a === 'middlewingreverse' ? ['south', 'east'] : ['north', 'west']],
  rearWing: [['rearwing', 'rearwingreverse', 'bathstorage'], a => a === 'bathstorage' ? ['south', 'west'] : a === 'rearwingreverse' ? ['north', 'west'] : ['south', 'east']],
  lounge: [['lounge', 'loungeflowers', 'loungetv', 'loungereverse', 'loungedoor'], a => a === 'loungedoor' ? ['south', 'west'] : a === 'loungereverse' ? ['north', 'east'] : ['south', 'east']],
  marital: [['marital', 'maritalvanity','maritalpower', 'maritalpot', 'maritalreverse'], a => ['maritalreverse', 'maritalpot'].includes(a) ? ['north', 'east'] : ['south', 'west']],
  tingzi: [['mezzanine', 'tingzireverse', 'tingzipot','tingzipower'], a => a === 'tingzipot' ? ['south', 'west'] : a === 'tingzireverse' ? ['north', 'west'] : ['south', 'east']],
  childRoom: [['childroom', 'childreverse', 'childsheet', 'childbag', 'childwindow', 'childdesk', 'childlamp', 'childcord', 'childbooks', 'childchest', 'childpot'],
    a => a === 'childreverse' ? ['north', 'east'] : ['childdesk', 'childchest', 'childpot'].includes(a) ? ['south', 'east'] : ['south', 'west']],
};
// Sheers are lit from the window behind in daytime: a little self-light by day, half at dusk, none at night.
const SHEER_GLOW = { day: .28, dusk: .14, night: 0 };

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = CURTAINS_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    t.anisotropy = 4; textures.set(key, t); return t;
  }
  function material(i, colored = false) {
    const key = i + ':' + colored; if (materials.has(key)) return materials.get(key);
    const s = d.materials[i], p = s.pbrMetallicRoughness || {}, f = p.baseColorFactor || [1, 1, 1, 1];
    const blend = s.alphaMode === 'BLEND';
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_帘子v1', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: blend,
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: THREE.DoubleSide, roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1, vertexColors: colored });
    m.userData = { asset: d.assetId, curtainsMaterial: i, houseCurtainRevision: 1, sheer: blend };
    if (typeof document !== 'undefined') {
      if (p.baseColorTexture) m.map = texture(p.baseColorTexture, true);
      if (s.normalTexture) { m.normalMap = texture(s.normalTexture); m.normalScale.setScalar(s.normalTexture.scale ?? 1); }
    }
    if (blend) { m.depthWrite = false; m.emissive.setRGB(1, .98, .94); m.emissiveIntensity = 0; }
    materials.set(key, m); return m;
  }
  function node(s) {
    const o = new THREE.Group(); o.name = s.name; o.userData = { ...s.extras };
    if (s.matrix) new THREE.Matrix4().fromArray(s.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (s.translation) o.position.fromArray(s.translation); if (s.rotation) o.quaternion.fromArray(s.rotation); if (s.scale) o.scale.fromArray(s.scale); }
    for (const p of s.primitives || []) {
      const g = geometry(p.geometry), m = new THREE.Mesh(g, material(p.material, !!g.attributes.color)); m.name = s.name + '_表面'; m.userData = { houseCurtainRevision: 1 };
      m.castShadow = !m.material.transparent; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}

// The old 婚房 (ML07–ML09) and 亭子间 (TL01, TL02) curtains: the top group under the room's furniture that holds the part.
function oldCurtain(root, group, partId) {
  const g = root.getObjectByName(group); if (!g) return null;
  let hit = null; g.traverse(o => { if (!hit && o.userData.partId === partId) hit = o; });
  while (hit && hit.parent && hit.parent !== g) hit = hit.parent;
  return hit;
}

export function installHouseCurtains(T, root) {if(!FAST_ENABLED("curtains"))return;
  if (root.userData.houseCurtains) return;
  const c = cache(T); root.updateMatrixWorld(true); const rootInv = root.matrixWorld.clone().invert(), removed = [], sets = [];
  for (const f of CURTAINS_DATA.fixtures) {
    const parent = root.getObjectByName(f.parent); if (!parent) throw new Error('Missing curtain parent ' + f.parent);
    if (f.replaces) { const old = oldCurtain(root, f.parent, f.replaces); if (old) { old.removeFromParent(); removed.push(f.parent + '/' + old.name); } }
    const n = c.node(f.node), house = new T.Matrix4().fromArray(f.node.matrix), rel = rootInv.clone().multiply(parent.matrixWorld);
    rel.invert().multiply(house).decompose(n.position, n.quaternion, n.scale);
    n.name = '屋内帘子_' + f.name;
    n.userData = { ...n.userData, curtainId: f.id, curtainRoom: f.room, curtainSide: f.side, houseCurtainRevision: 1 };
    parent.add(n); sets.push(f.id);
    if(f.room==='kitchen'){
      root.updateMatrixWorld(true);const houseInv=root.matrixWorld.clone().invert(),cloth=[];
      n.traverse(o=>{if(o.isMesh&&o.name.includes('厨房蓝白小格布'))cloth.push(o);});
      const bounds=new T.Box3();for(const o of cloth){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(houseInv.clone().multiply(o.matrixWorld)));}
      const left=bounds.min.x;
      n.traverse(o=>{
        if(!o.isMesh||!(/厨房蓝白小格布|旧镀锌夹子环/.test(o.name)))return;
        const g=o.geometry.clone(),p=g.attributes.position,toHouse=houseInv.clone().multiply(o.matrixWorld),fromHouse=toHouse.clone().invert(),v=new T.Vector3();
        for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i).applyMatrix4(toHouse);
          // Slide the hanging cloth and its clips left. Keep every original
          // vertical coordinate and the original hem length; no lifted corner.
          v.x=left+(v.x-left)*.80;
          v.applyMatrix4(fromHouse);p.setXYZ(i,v.x,v.y,v.z);
        }
        g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;
      });
      n.userData.kitchenRightOpening={date:'2026-11-15',clothMeshes:cloth.length,widthScale:.80,rightDrawMetres:(bounds.max.x-left)*.20,originalHemHeightPreserved:true};
    }
  }
  root.userData.houseCurtains = { revision: 1, source: CURTAINS_DATA.source, sets, removed, placement: 'house-local mounts measured 2026-11-13',
    userVisualApproved: 'samples approved 2026-11-13 (老人房, 婚房 with sheer; others shown without changes requested)' };
  root.userData.textureCount = (root.userData.textureCount || 0) + CURTAINS_DATA.images.length;
}

// view: {active, cut, lighting}. Whole-house section views hide every curtain (鹿鹿 2026-11-13: 统一隐藏);
// a room close-up hides the curtains on its cut walls. Sheers get the daytime self-light.
export function applyHouseCurtains(T, root, view = {}) {
  const c = caches.get(T); if (!c || !root.userData.houseCurtains) return { shown: 0 };
  let shown = 0;
  root.traverse(o => {
    const room = o.userData.curtainRoom; if (!room || o.isMesh) return;
    let want = !view.cut;
    const rule = CLOSEUP_CUTS[room];
    if (want && rule && rule[0].includes(view.active)) want = !rule[1](view.active).includes(o.userData.curtainSide);
    o.visible = want; if (want) shown++;
  });
  const glow = SHEER_GLOW[view.lighting] ?? SHEER_GLOW.day;
  for (const m of c.materials.values()) if (m.userData.sheer && m.emissiveIntensity !== glow) m.emissiveIntensity = glow;
  return { shown };
}

export const HOUSE_CURTAIN_IDS = CURTAINS_DATA.fixtures.map(f => f.id);
