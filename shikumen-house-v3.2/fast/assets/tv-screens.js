import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { TV_SCREENS_DATA } from './tv-screens-data.js';

// Switched-on television screens in B1 (2026-11-15; see experiments/tv-screen-20261115/说明.txt).
// Hall colour set: the generated screen glass is ragged and short on the right, so it is retired; a locally built bulged screen fills the
// measured cabinet opening and a sloped inner frame of black plastic covers the ragged lip.  Marital-room wooden set (black and white):
// a rounded patch with the same bulge sits just in front of the baked screen and is hidden while the set is off.
// Each set rotates five pictures (8 s each, a burst of snow on every change) and carries scan lines, fine snow, a slow rolling bright
// bar with a slight sideways wobble and a thin dark line.  The web viewer switches the sets with the night lamp chips and calls
// tickTvScreens only while a lit set is shown.  GLB exports carry the first picture of each set, switched on, without the animation.
const caches = new WeakMap();
const SETS = Object.fromEntries(TV_SCREENS_DATA.sets.map(s => [s.id, s]));

function roundedLoop(x0, x1, y0, y1, r, z) {   // counter-clockwise seen from +Z, nine points per corner
  const pts = [];
  for (const [cx, cy, a0] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]])
    for (let k = 0; k <= 8; k++) { const a = (a0 + k * 90 / 8) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]); }
  return pts;
}

function build(T, pos, uv, idx) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}

// Texture coordinates follow the glTF convention (v = 0 at the top of the picture; textures are loaded with flipY off) so exports need no change.
function framedScreen(T, s) {   // a bulged rectangle filling the cabinet opening; the inner frame gives it rounded corners
  const cx = (s.rect[0] + s.rect[1]) / 2, cy = (s.rect[2] + s.rect[3]) / 2, hw = (s.rect[1] - s.rect[0]) * s.grow / 2, hh = (s.rect[3] - s.rect[2]) * s.grow / 2, NX = 24, NY = 18, pos = [], uv = [], idx = [];
  const zEdge = s.zFront - s.back - s.bulge;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const nx = i / NX * 2 - 1, ny = j / NY * 2 - 1; pos.push(cx + nx * hw, cy + ny * hh, zEdge + s.bulge * (1 - (nx * nx + ny * ny) / 2)); uv.push(0.5 + 0.5 * nx, 0.5 - 0.5 * ny); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  return build(T, pos, uv, idx);
}

function innerFrame(T, f) {   // sloped band: outer loop on the cabinet front, inner loop set back
  const O = roundedLoop(f.outer[0], f.outer[1], f.outer[2], f.outer[3], f.ro, f.zo), I = roundedLoop(f.inner[0], f.inner[1], f.inner[2], f.inner[3], f.ri, f.zi), n = O.length, pos = [], idx = [];
  for (let i = 0; i < n; i++) { pos.push(...O[i], ...I[i]); const j = (i + 1) % n; idx.push(2 * i, 2 * j, 2 * i + 1, 2 * i + 1, 2 * j, 2 * j + 1); }
  return build(T, pos, null, idx);
}

function patchScreen(T, s) {   // rounded patch following the baked screen bulge
  const hw = (s.rect[1] - s.rect[0]) / 2, hh = (s.rect[3] - s.rect[2]) / 2, cx = (s.rect[0] + s.rect[1]) / 2, cy = (s.rect[2] + s.rect[3]) / 2, loop = roundedLoop(-hw, hw, -hh, hh, s.r, 0), n = loop.length, RINGS = 8, pos = [], uv = [], idx = [];
  const put = (x, y) => { const nx = x / hw, ny = y / hh; pos.push(cx + x, cy + y, s.zc - s.ax * nx * nx - s.ay * ny * ny + s.axy * nx * nx * ny * ny); uv.push(0.5 + 0.5 * nx, 0.5 - 0.5 * ny); };
  put(0, 0); for (let q = 1; q <= RINGS; q++) for (let i = 0; i < n; i++) put(loop[i][0] * q / RINGS, loop[i][1] * q / RINGS);
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + (i + 1) % n);
  for (let q = 1; q < RINGS; q++) for (let i = 0; i < n; i++) { const a = 1 + (q - 1) * n + i, b = 1 + (q - 1) * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  return build(T, pos, uv, idx);
}

function material(T, i) {
  const d = TV_SCREENS_DATA, s = d.materials[i], p = s.pbrMetallicRoughness, f = p.baseColorFactor;
  const m = new T.MeshStandardMaterial({ name: s.name, color: new T.Color().setRGB(f[0], f[1], f[2]), roughness: p.roughnessFactor, metalness: p.metallicFactor, side: s.doubleSided ? T.DoubleSide : T.FrontSide });
  m.userData = { asset: d.assetId, tvScreensMaterial: i, houseTvScreensRevision: 1 };
  if (s.emissiveFactor) { m.emissive.setRGB(...s.emissiveFactor); m.emissiveIntensity = 1; }
  return m;
}

function screenMaterial(T, set) {
  const d = TV_SCREENS_DATA, m = material(T, set.screenMaterial), textures = [];
  if (typeof document !== 'undefined') {
    const im = d.images[d.textures[d.materials[set.screenMaterial].emissiveTexture.index].source];
    for (const b64 of [im.url, ...d.frames[set.id]]) {
      const t = new T.TextureLoader().load(new URL(b64,import.meta.url).href, () => { window.dispatchEvent(new Event('shikumen-asset-ready')); });
      t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 8; textures.push(t);
    }
    m.emissiveMap = textures[0];
  }
  const U = { tvTime: { value: 0 }, tvBurst: { value: 0 } };
  m.customProgramCacheKey = () => 'house-tv-screen-1';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float tvTime; uniform float tvBurst;\nfloat tvHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
        vec2 tvUv = vEmissiveMapUv; float tvLine = floor(tvUv.y * 144.0), tvT = floor(tvTime * 25.0);
        float tvRoll = fract(tvUv.y + tvTime * 0.07);                                   // rolling bar: about 14 s per pass
        float tvBar = smoothstep(0.0, 0.05, tvRoll) * (1.0 - smoothstep(0.05, 0.16, tvRoll));
        tvUv.x += (tvHash(vec2(tvLine, tvT)) - 0.5) * 0.0035 + tvBar * 0.007 * sin(tvUv.y * 70.0 + tvTime * 9.0);
        vec3 tvCol = texture2D(emissiveMap, tvUv).rgb; tvCol.r = mix(tvCol.r, texture2D(emissiveMap, tvUv - vec2(0.004, 0.0)).r, 0.5);
        // 72 scan lines (fewer than a real set, so they read from room distance); they fade out when the screen is small on the page
        float tvScanAmp = 0.34 * clamp(1.6 - fwidth(tvUv.y * 72.0) * 1.6, 0.0, 1.0);
        tvCol *= 1.0 - tvScanAmp * (0.5 + 0.5 * sin(tvUv.y * 72.0 * 6.2831853));
        float tvSnow = tvHash(floor(tvUv * vec2(384.0, 288.0)) + tvT * 7.31);
        tvCol += (tvSnow - 0.5) * (0.030 + 0.025 * tvBar); tvCol *= 1.0 + 0.24 * tvBar - 0.05 * sin((tvUv.y + tvTime * 0.31) * 6.2831853);
        float tvThin = fract(tvUv.y + tvTime * 0.19); tvCol *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.012, abs(tvThin - 0.5)));   // thin dark line, about 5 s per pass
        tvCol = mix(tvCol, vec3(0.10 + 0.75 * tvSnow), tvBurst);
        totalEmissiveRadiance *= max(tvCol, 0.0);
      #endif`);
  };
  return { material: m, textures, uniforms: U };
}

export function installTvScreens(T, root) {if(!FAST_ENABLED("tv-screens"))return;
  if (root.userData.tvScreens) return;
  const d = TV_SCREENS_DATA, reg = new Map(), installed = [], retired = [];
  for (const set of d.sets) { if(!FAST_ROOMS.has(FAST_ROOM(set.parent)))continue;
    const group = root.getObjectByName(set.parent); if (!group) throw new Error('Missing television parent ' + set.parent);
    let host = null;
    group.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m.name.includes(set.findMaterial)) && (!host || o.geometry.attributes.position.count > host.geometry.attributes.position.count)) host = o; });
    if (!host) throw new Error('Missing television part ' + set.parent + '/' + set.findMaterial);
    const sm = screenMaterial(T, set), parts = [];
    const add = (geometry, mat, name, role) => {
      const m = new T.Mesh(geometry, mat); m.name = name; m.position.copy(host.position); m.quaternion.copy(host.quaternion); m.scale.copy(host.scale);
      m.userData = { tvScreenId: set.id, tvScreenRole: role, houseTvScreensRevision: 1 }; m.castShadow = false; m.receiveShadow = role === 'frame'; host.parent.add(m); parts.push(name); return m;
    };
    if (set.kind === 'framed') { add(framedScreen(T, set), sm.material, set.label + '_开机屏幕', 'screen'); add(innerFrame(T, set.frame), material(T, set.frameMaterial), set.label + '_屏幕内框', 'frame'); }
    else add(patchScreen(T, set), sm.material, set.label + '_开机屏幕', 'screen');
    if (set.retireFound) { retired.push(set.parent + '/' + host.name + ' (' + set.findMaterial + ')'); host.parent.remove(host); }
    reg.set(set.id, { ...sm, on: true, frame: 0 }); installed.push({ id: set.id, parts });
  }
  caches.set(root, reg);
  root.userData.tvScreens = { revision: 1, source: d.source, sets: installed, retired, frames: 1 + d.frames[d.sets[0].id].length, holdSeconds: d.hold,
    placement: 'measured in each cabinet mesh local frame, 2026-11-15', userVisualApproved: 'samples approved 2026-11-15 (我觉得可以 / 合适 / 可以); house placement pending' };
  root.userData.textureCount = (root.userData.textureCount || 0) + d.images.length;
}

// on: {hallTv: boolean, maritalTv: boolean}.  Off: the hall screen is dark glass, the marital patch is hidden so the baked screen shows.
// Returns one light point per set (house world position) for the night lamp slots; visible only when the set is shown and on.
export function getTvScreens(T, root, on = {}) {
  const reg = caches.get(root); if (!reg) return [];
  const shown = new Map(); root.traverseVisible(o => { if (o.userData.tvScreenRole === 'screen' && !shown.has(o.userData.tvScreenId)) shown.set(o.userData.tvScreenId, o); });
  const out = [];
  for (const [id, r] of reg) {
    const set = SETS[id], lit = !!on[id], m = r.material;
    if (r.on !== lit) {
      r.on = lit;
      if (set.kind === 'patch') m.visible = lit;
      else { m.emissiveIntensity = lit ? 1 : 0; m.color.setRGB(...(lit ? [0.02, 0.02, 0.02] : [0.012, 0.016, 0.014])); m.roughness = lit ? 0.55 : 0.22; }
    }
    const o = shown.get(id); let position = [0, 0, 0];
    if (o) { o.updateWorldMatrix(true, false); position = o.localToWorld(new T.Vector3().fromArray(set.light.local)).toArray(); }
    out.push({ id, lamp: id, position, energy: set.light.energy, color: set.light.color, present: !!o, visible: lit && !!o });
  }
  return out;
}

// Advance the pictures and the interference of every lit set; returns true if anything changed on screen.
export function tickTvScreens(root, seconds) {
  const reg = caches.get(root); if (!reg) return false; let any = false;
  for (const [id, r] of reg) {
    if (!r.on || !r.textures.length) continue;
    const hold = TV_SCREENS_DATA.hold, t = seconds + SETS[id].shift, k = Math.floor(t / hold), ph = t - k * hold, frame = k % r.textures.length;
    r.uniforms.tvTime.value = t % 3600; r.uniforms.tvBurst.value = ph < 0.15 ? 1 - ph / 0.15 : hold - ph < 0.15 ? 1 - (hold - ph) / 0.15 : 0;
    if (frame !== r.frame) { r.frame = frame; r.material.emissiveMap = r.textures[frame]; }
    any = true;
  }
  return any;
}

export const TV_SCREEN_IDS = TV_SCREENS_DATA.sets.map(s => s.id);
