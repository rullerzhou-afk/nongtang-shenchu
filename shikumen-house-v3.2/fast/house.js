import { installHouseDoorBolts, updateHouseDoorBolts } from './assets/door-bolts.js';
import { installHouseDoorHandles, updateHouseDoorHandles } from './assets/door-handles.js';
import { installHouseSkirting } from './assets/house-skirting.js';
import { installHouseServices } from './assets/house-services.js';
import { installAtticStorage, setAtticStorageOpening } from './assets/attic-storage.js';
import { installAtticRoom, setAtticCabinetOpening, finishSharedCorridor } from './assets/attic-room.js';
import { installHouseLighting, setHouseLightingRoof } from './assets/lighting.js';
import { installHouseCurtains } from './assets/curtains.js';
import { installWallDecor } from './assets/wall-decor.js';
import { installBambooSeating } from './assets/bamboo-seating.js';
import { installKitchenSnack } from './assets/kitchen-snack.js';
import { installKitchenCondiments } from './assets/kitchen-condiments.js';
import { installKitchenWash } from './assets/kitchen-wash.js';
import { installHallRearrange } from './assets/hall-rearrange.js';
import { installMiddleWingFan } from './assets/middle-wing-fan.js';
import { installLaceCloths } from './assets/lace-cloths.js';
import { installBedding } from './assets/bedding.js';
import { installMaritalCombo } from './assets/marital-combo.js';
import { installElderWardrobe } from './assets/elder-wardrobe.js';
import { installWardrobeClothes } from './assets/wardrobe-clothes.js';
import { installRoomFinishing } from './assets/room-finishing.js';
import { installHallTvClock } from './assets/hall-tv-clock.js';
import { installTvScreens } from './assets/tv-screens.js';
import { installCollectionProps } from './assets/collection-props.js';
import { installSmallParts } from './assets/small-parts.js';
import { installNeighbourLife } from './assets/neighbour-life.js';
import { installStairwellProps } from './assets/stairwell-props.js';
import { installTerrace } from './assets/terrace.js';
import { installChildRoom, setChildRoomCabinetOpening } from './assets/child-room.js';
import { installStorage, setStorageChestOpening } from './assets/storage.js';
import { installLounge, setLoungeCabinetOpening } from './assets/lounge.js';
import { installMarital, setMaritalCabinetOpening } from './assets/marital.js';
import { installTingzi, setTingziCabinetOpening } from './assets/tingzijian.js';
import { installStairwell } from './assets/stairwell.js';
import { installMiddleWing, setMiddleWingCabinetOpening } from './assets/middle-wing.js';
import { installRearWing, setRearWingChestOpening } from './assets/rear-wing.js';
import { installFrontWing, setFrontWingCabinetOpening } from './assets/front-wing.js';
import { installRearCourtyard } from './assets/rear-courtyard.js';
import { installCourtyard, createCourtyardPlant, sliceGeometry } from './assets/courtyard.js';
import { installHall, setHallCabinetOpening, installUpperPanelDoors } from './assets/hall.js';
import * as THREE from 'three';
import { installApprovedKitchen, updateApprovedKitchen } from './assets/kitchen.js';
import { createBrassRing } from './assets/brass-ring.js';
import { installWindowHardware, updateWindowHardware } from './assets/window-hardware.js';
import { getThresholdStoneMaterial, createPedimentRelief, createRainwaterHopper } from './assets/portal-details.js';

/** V3 双开间单厢端户。几何局部坐标X自西墙起，Y向上，Z=-s；根物体默认以门中心为世界原点。 */
export const SHIKUMEN_DIMENSIONS=Object.freeze({width:7.2,depth:15,wall:.24,ground:.1,tingzijian:2.4,second:4,terrace:4.8,attic:6.7,eave:7.05,pitchDegrees:30,clearWidth:3.6,wingClearWidth:2.94,frontLane:3.2,rearLane:2.8,mainLane:4.2});
// 状态引用放 WeakMap；避免 THREE.Object3D 混进 userData 导致 GLB 循环序列化。
const registries = new WeakMap();
let sharedMaterials;

function group(parent, name, data = {}) {
  const g = new THREE.Group(); g.name = name; g.userData = data;
  parent.add(g); return g;
}

// 按实际米数投影 UV。每个面独立，墙面连续对齐，不按墙段宽度拉伸砖块。
function metricUV(geometry, material, offset = new THREE.Vector3()) {
  const size = material.userData?.textureSize || [1, 1];
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + offset.x, y = p.getY(i) + offset.y, z = p.getZ(i) + offset.z;
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny > nx && ny > nz) { u = x; v = -z; }
    else if (nx > nz) { u = -z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u / size[0]; uv[i * 2 + 1] = v / size[1];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geometry;
}

function mesh(parent, name, geometry, material) {
  const m = new THREE.Mesh(geometry, material); m.name = name;
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

function box(parent, name, x, y, z, w, h, d, mat) {
  if (w < 0.0001 || h < 0.0001 || d < 0.0001) return null;
  const geo = new THREE.BoxGeometry(w, h, d);
  metricUV(geo, mat, new THREE.Vector3(x, y, z));
  const m = mesh(parent, name, geo, mat); m.position.set(x, y, z); return m;
}

function rod(parent, name, a, b, radius, mat, segments = 8) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), v = vb.clone().sub(va);
  const m = mesh(parent, name, new THREE.CylinderGeometry(radius, radius, v.length(), segments), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return m;
}

// 同一构件内按材质合并，保留墙/门窗/层级对象，不制造数千个绘制调用。
function mergeMeshes(parent,name,list,material){
  if(!list.length)return null;parent.updateWorldMatrix(true,true);const inv=parent.matrixWorld.clone().invert();
  const prepared=[];let count=0,hasColors=false;const cast=list.some(m=>m.castShadow),order=Math.max(...list.map(m=>m.renderOrder));
  for(const m of list){m.updateWorldMatrix(true,false);const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(inv.clone().multiply(m.matrixWorld));prepared.push(g);count+=g.attributes.position.count;hasColors ||= !!g.attributes.color;}
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),colors=hasColors?new Float32Array(count*3):null;let off=0;
  for(const g of prepared){const n=g.attributes.position.count;positions.set(g.attributes.position.array,off*3);normals.set(g.attributes.normal.array,off*3);if(g.attributes.uv)uvs.set(g.attributes.uv.array,off*2);if(colors){if(g.attributes.color)colors.set(g.attributes.color.array,off*3);else colors.fill(1,off*3,(off+n)*3);}off+=n;g.dispose();}
  for(const m of list){m.removeFromParent();m.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));if(colors){g.setAttribute('color',new THREE.BufferAttribute(colors,3));material.vertexColors=true;}g.computeBoundingSphere();
  const out=mesh(parent,name,g,material);out.castShadow=cast;out.renderOrder=order;return out;
}

function consolidate(parent) {
  const buckets = new Map();
  for (const c of [...parent.children]) if (c.isMesh && !c.isInstancedMesh && !Array.isArray(c.material)) {
    if (!buckets.has(c.material)) buckets.set(c.material, []);
    buckets.get(c.material).push(c);
  }
  for (const [mat, list] of buckets) if (list.length > 1) mergeMeshes(parent, `${parent.name}_${mat.name}`, list, mat);
}

/** 矩形开洞通过网格分块生成实心砌体；不使用黑色面假装门窗。 */
function wall(parent, name, spec, registry) {
  const { axis = 'x', fixed, from, to, bottom, top, thickness = .24,
    material, innerMaterial = null, inside = 1, openings = [], cut = false } = spec;
  const root = group(parent, name, { kind: 'wall', axis, from, to, bottom, top, thickness, openings });
  const vm=registry.materials;const coreMat=(material===vm.redBrick||material===vm.greyBrick)?vm.mortar:material;
  const build = (h, label) => {
    const part = group(root, label);
    const xs = [...new Set([from, to, ...openings.flatMap(o => [Math.max(from, o.a), Math.min(to, o.b)])])].sort((a,b)=>a-b);
    const ys = [...new Set([bottom, h, ...openings.flatMap(o => [Math.max(bottom, Math.min(h,o.y0)), Math.max(bottom,Math.min(h,o.y1))])])].sort((a,b)=>a-b);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const a=xs[i], b=xs[i+1], y0=ys[j], y1=ys[j+1], cx=(a+b)/2, cy=(y0+y1)/2;
      if (b-a < .0001 || y1-y0 < .0001 || openings.some(o=>cx>o.a && cx<o.b && cy>o.y0 && cy<o.y1)) continue;
      if (axis === 'x') box(part, '实心墙段', cx, cy, fixed, b-a, y1-y0, thickness, coreMat);
      else box(part, '实心墙段', fixed, cy, cx, thickness, y1-y0, b-a, coreMat);
      if (innerMaterial) {
        if (axis === 'x') box(part, '内侧石灰饰面', cx, cy, fixed+inside*(thickness/2+.002), b-a, y1-y0, .004, innerMaterial);
        else box(part, '内侧石灰饰面', fixed+inside*(thickness/2+.002), cy, cx, .004, y1-y0, b-a, innerMaterial);
      }
    }
    if(bottom>0&&bottom<=.13&&(material===vm.redBrick||material===vm.greyBrick)){for(let i=0;i<xs.length-1;i++){const a=xs[i],b=xs[i+1],c=(a+b)/2;if(openings.some(o=>c>o.a&&c<o.b&&o.y0<bottom+.01))continue;if(axis==='x')box(part,'墙基_接地',c,bottom/2,fixed,b-a,bottom,thickness,vm.greyBrick);else box(part,'墙基_接地',fixed,bottom/2,c,thickness,bottom,b-a,vm.greyBrick);}}
    v2WallSurface(part,name,spec,h,vm);
    if(innerMaterial)v2PaintWall(part,name+'_室内', {...spec,thickness:thickness+.006,paintSigns:[inside]},h,vm);
    consolidate(part); return part;
  };
  const full = build(top, '完整墙体'), low = cut ? build(Math.min(top,bottom+1), '剖切_实心一米矮墙') : null;
  if (low) { low.visible=false; registry.cuts.push({full,low}); }
  return {root,full,low};
}

function slab(parent, name, x0, x1, z0, z1, top, thick, mat, holes = []) {
  const g=group(parent,name,{kind:'slab',top,thickness:thick,holes});
  const inset=/杉木|红陶|青石/.test(mat.name)?.020:0;
  const xs=[...new Set([x0,x1,...holes.flatMap(h=>[h.x0,h.x1])])].filter(x=>x>=x0&&x<=x1).sort((a,b)=>a-b);
  const zs=[...new Set([z0,z1,...holes.flatMap(h=>[h.z0,h.z1])])].filter(z=>z>=z0&&z<=z1).sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
    if(holes.some(h=>x>h.x0&&x<h.x1&&z>h.z0&&z<h.z1))continue;
    box(g,'楼板实心分块',x,top-thick/2-inset/2,z,xs[i+1]-xs[i],thick-inset,zs[j+1]-zs[j],mat);
  }
  v2FloorBoards(g,name,x0,x1,z0,z1,top,mat,holes);consolidate(g); return g;
}

// 窗框坐标在自身局部平面，正面朝 +Z；rotationY 可转到北/东立面。
// ===== V2 实体木作与石库门；无贴图、无 Canvas、无贴花 =====
// 此片段替换 timberWindow / door / portal；其余 helper 均使用 jn_ 前缀。
const jn_materialCache = new WeakMap();

function jn_seed(text) {
  let n = 2166136261;
  for (const ch of String(text)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
}

function jn_palette(mats) {
  if (jn_materialCache.has(mats)) return jn_materialCache.get(mats);
  const make = (key, source, color, settings = {}) => {
    const m = source ? source.clone() : new THREE.MeshStandardMaterial({ color, roughness: .83 });
    // 兼容旧材质表的调用，但这里绝不沿用任何图像纹理。
    const hadMap = !!source?.map;
    for (const prop of Object.keys(m)) if (m[prop]?.isTexture) m[prop] = null;
    if (!source || hadMap) m.color.setHex(color);
    Object.assign(m, settings); m.vertexColors = true; m.name = `MAT_JOINERY_${key}`;
    m.userData = { category: key, construction: 'solid_geometry', textureSize: [1, 1] };
    return m;
  };
  const p = {
    wood: make('aged_dark_wood', mats.wood, 0x514032, { roughness: .84 }),
    black: make('worn_black_lacquer', mats.blackWood, 0x292a25, { roughness: .68 }),
    raw: make('exposed_grey_wood', mats.woodRaw, 0x8c8067, { roughness: .95 }),
    stone: make('carved_stone', mats.stone, 0xb4ac98, { roughness: .94 }),
    stoneDark: make('stone_recess', mats.stoneDark, 0x928a76, { roughness: .98 }),
    portalStone: make('portal_cool_grey_stone', null, 0xb6bcb9, { roughness: .94 }),
    portalRecess: make('portal_cool_grey_recess', null, 0xa6ada9, { roughness: .98 }),
    putty: make('old_glazing_putty', mats.putty, 0xb1ac96, { roughness: .98 }),
    iron: make('old_iron', mats.iron || mats.metal, 0x4a4940, { roughness: .81, metalness: .43 }),
    brass: make('aged_brass', mats.brass, 0x8b794d, { roughness: .57, metalness: .76 }),
    enamel: make('enamel_number_plate', null, 0x254047, { roughness: .45, metalness: .20 }),
    glass: make('clear_old_glass', mats.glass, 0xbac6bf, { transparent: true, opacity: .20, roughness: .20, metalness: 0, depthWrite: false }),
    warmGlass: make('warm_clear_old_glass', mats.glassWarm || mats.glass, 0xc1c4b3, { transparent: true, opacity: .19, roughness: .23, metalness: 0, depthWrite: false })
  };
  p.glass.color.setHex(0xbac6bf); p.warmGlass.color.setHex(0xc1c4b3);
  p.glass.emissive.setHex(0); p.warmGlass.emissive.setHex(0);
  p.glass.emissiveIntensity = p.warmGlass.emissiveIntensity = 0;
  jn_materialCache.set(mats, p); return p;
}

function jn_color(geometry, seed = 0, shade = .98) {
  const pos = geometry.attributes.position, colors = new Float32Array(pos.count * 3);
  const phase = (seed % 1009) / 61;
  for (let i = 0; i < pos.count; i++) {
    // 低频色差沿整根木料/石块变化，不用随机噪点伪装老化。
    const f = Math.min(1, Math.max(.65, shade * (.966 + .019 * Math.sin(pos.getY(i) * 2.1 + phase) + .012 * Math.sin(pos.getX(i) * 3.6 + phase * .7))));
    colors[i * 3] = f; colors[i * 3 + 1] = f * .995; colors[i * 3 + 2] = f * .985;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return geometry;
}

function jn_mesh(parent, name, geo, mat, seed = 0, shade = .98) {
  jn_color(geo, seed, shade);
  const m = mesh(parent, name, geo, mat);
  if (mat.transparent) { m.castShadow = false; m.renderOrder = 1; }
  return m;
}

function jn_block(parent, name, x, y, z, w, h, d, mat, seed = 0, bevel = .0025, shade = .98) {
  if (Math.min(w, h, d) <= .00005) return null;
  const b = Math.min(bevel, w * .12, h * .12, d * .20);
  let geo;
  if (b < .0002) geo = new THREE.BoxGeometry(w, h, d);
  else {
    const shape = new THREE.Shape(), a = w / 2 - b, c = h / 2 - b;
    shape.moveTo(-a, -c); shape.lineTo(a, -c); shape.lineTo(a, c); shape.lineTo(-a, c); shape.closePath();
    geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: b, bevelThickness: b, curveSegments: 1 });
    geo.translate(0, 0, -d / 2 + b);
  }
  const m = jn_mesh(parent, name, geo, mat, seed, shade); m.position.set(x, y, z); return m;
}

function jn_shape(parent, name, points, z, depth, mat, seed = 0, bevel = 0) {
  const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 10 });
  geo.translate(0, 0, z); return jn_mesh(parent, name, geo, mat, seed);
}

function jn_rod(parent, name, a, b, radius, mat, seed = 0, segments = 7) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), axis = end.clone().sub(start);
  if (axis.lengthSq() < 1e-10) return null;
  const m = jn_mesh(parent, name, new THREE.CylinderGeometry(radius, radius, axis.length(), segments), mat, seed);
  m.position.copy(start).add(end).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()); return m;
}

function jn_frame(parent, name, cx, y0, w, h, z, bar, depth, mat, seed = 0, shade = .98) {
  if (w <= bar * 2 || h <= bar * 2) return;
  jn_block(parent, `${name}_左`, cx - w / 2 + bar / 2, y0 + h / 2, z, bar, h, depth, mat, seed, .0015, shade);
  jn_block(parent, `${name}_右`, cx + w / 2 - bar / 2, y0 + h / 2, z, bar, h, depth, mat, seed + 1, .0015, shade);
  jn_block(parent, `${name}_上`, cx, y0 + h - bar / 2, z, w - 2 * bar, bar, depth, mat, seed + 2, .0015, shade);
  jn_block(parent, `${name}_下`, cx, y0 + bar / 2, z, w - 2 * bar, bar, depth, mat, seed + 3, .0015, shade);
}

function jn_scar(parent, name, x, y, z, w, h, mat, seed = 0) {
  // 几何露底片沿边口延伸；只在少数手摸、脚踢和接缝位置出现。
  const points = [[x, y], [x + w * .57, y + h * .05], [x + w, y + h * .32], [x + w * .67, y + h * .61], [x + w * .81, y + h], [x + w * .21, y + h * .88], [x + w * .32, y + h * .42]];
  return jn_shape(parent, name, points, z, .0011, mat, seed);
}

function jn_board(parent, name, x, y, z, w, h, d, mat, seed = 0) {
  // 闭合实体拼板：正面两道不等长的 V 形木纤维凹槽，深约 0.7–1.3 mm。
  // 与贴一条暗线不同，凹槽有真实边坡、法线和背板；只用于较宽的板心。
  const channel = Math.min(.0021, w * .015), a = -w / 2, b = w / 2;
  const c1 = a + w * (.29 + (seed % 5) * .013), c2 = a + w * .72;
  const xs = [a, c1 - channel, c1, c1 + channel, c2 - channel, c2, c2 + channel, b];
  const ys = [-h / 2, -h * .36, -h * .12, h * .16, h * .38, h / 2];
  const positions = [], uv = [], indices = [];
  for (let iy = 0; iy < ys.length; iy++) for (let ix = 0; ix < xs.length; ix++) {
    const bend = ix > 0 && ix < xs.length - 1 ? Math.sin(iy * .85 + seed * .07) * Math.min(.0017, w * .01) : 0;
    const dip = (ix === 2 || ix === 5) ? (.0008 + (seed % 3) * .0002) * Math.sin(Math.PI * iy / (ys.length - 1)) : 0;
    positions.push(xs[ix] + bend, ys[iy], d / 2 - dip); uv.push(xs[ix] / Math.max(w, .001) + .5, ys[iy] / h + .5);
  }
  const row = xs.length;
  for (let iy = 0; iy < ys.length - 1; iy++) for (let ix = 0; ix < row - 1; ix++) {
    const n = iy * row + ix; indices.push(n, n + 1, n + row + 1, n, n + row + 1, n + row);
  }
  const ring = [];
  for (let ix = 0; ix < row; ix++) ring.push(ix);
  for (let iy = 1; iy < ys.length; iy++) ring.push(iy * row + row - 1);
  for (let ix = row - 2; ix >= 0; ix--) ring.push((ys.length - 1) * row + ix);
  for (let iy = ys.length - 2; iy > 0; iy--) ring.push(iy * row);
  const rear = positions.length / 3;
  for (const i of ring) { positions.push(positions[i * 3], positions[i * 3 + 1], -d / 2); uv.push(uv[i * 2], uv[i * 2 + 1]); }
  const centre = positions.length / 3; positions.push(0, 0, -d / 2); uv.push(.5, .5);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    indices.push(ring[i], rear + i, rear + j, ring[i], rear + j, ring[j]);
    indices.push(centre, rear + j, rear + i);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  const m = jn_mesh(parent, name, geo, mat, seed, .91 + (seed % 7) * .012); m.position.set(x, y, z); return m;
}

function jn_screw(parent, x, y, z, radius, mat, seed = 0) {
  const cap = jn_mesh(parent, '实体圆头铆钉', new THREE.CylinderGeometry(radius * .86, radius, .0035, 7), mat, seed);
  cap.rotation.x = Math.PI / 2; cap.position.set(x, y, z);
}

function jn_hinge(parent, x, y, z, sign, p, scale = 1, seed = 0) {
  jn_block(parent, '铁铰链叶片', x + sign * .024 * scale, y, z - .004, .045 * scale, .115 * scale, .006 * scale, p.iron, seed, .001);
  for (let i = 0; i < 5; i++) jn_rod(parent, '五节铰链卷筒', [x, y - .065 * scale + i * .026 * scale, z], [x, y - .041 * scale + i * .026 * scale, z], .010 * scale, p.iron, seed + i, 7);
  for (const s of [-1, 1]) jn_screw(parent, x + sign * .026 * scale, y + s * .035 * scale, z + .001, .0055 * scale, p.iron, seed + 7);
}

function jn_meander(parent, name, x, y, w, h, z, sign, mat, seed) {
  const t = Math.min(.017, w * .11, h * .11);
  jn_block(parent, `${name}_横`, x + sign * w / 2, y, z, w, t, .025, mat, seed, .0012);
  jn_block(parent, `${name}_转`, x + sign * (w - t / 2), y - h / 2, z, t, h, .025, mat, seed + 1, .0012);
  jn_block(parent, `${name}_回`, x + sign * w * .66, y - h + t / 2, z, w * .67, t, .025, mat, seed + 2, .0012);
}

// 窗口外包尺寸与原版本完全一致；窗扇开启只向局部 +Z，投影仍落在原洞口内。
function legacyTimberWindow(parent, name, x, y, z, w, h, mats, opt = {}) {
  const p = jn_palette(mats), seed = jn_seed(`${name}/${x}/${y}`), wood = opt.black ? p.black : p.wood;
  const g = group(parent, name, { kind: 'window', width: w, height: h, construction: '实木框扇_独立玻璃格', noTextures: true });
  g.position.set(x, y, z); g.rotation.y = opt.rotationY || 0;
  const frame = Math.min(.075, Math.max(.045, w * .056)), depth = opt.fullLength ? .17 : .145;
  jn_frame(g, '外框榫接木料', 0, 0, w, h, 0, frame, depth, wood, seed);
  jn_frame(g, '后口窗止', 0, frame * .56, w - frame * 1.12, h - frame * 1.12, -.061, .012, .027, wood, seed + 1, .78);
  jn_block(g, '木窗槛滴水前沿', 0, frame * .43, depth / 2 + .009, w - .01, .027, .036, wood, seed + 8, .002);
  // 两个可读的木榫端口，避免把窗框当成无接缝的注塑边框。
  for (const sign of [-1, 1]) {
    jn_block(g, '框榫端面', sign * (w / 2 - frame * .54), h - frame * .53, depth / 2 + .0008, frame * .46, frame * .38, .002, wood, seed + 3, .0003, .77);
  }
  if (h > .95) jn_scar(g, '窗槛磨出的木质', -w * .27, .011, depth / 2 + .029, .045, .020, p.raw, seed);
  const panels = Math.max(1, Math.min(6, opt.panels || 2)), cell = (w - 2 * frame) / panels, leafW = cell - .009, leafH = h - 2 * frame - .008;
  const opening = opt.open !== undefined ? Math.max(0, Math.min(.28, opt.open)) : !opt.simple && !opt.fullLength && ((name.includes('前楼') && x > 0) || name.includes('朝北')) ? .115 : 0;
  for (let i = 0; i < panels; i++) {
    const sign = i === panels - 1 && panels > 1 ? -1 : 1;
    const left = -w / 2 + frame + i * cell + .0045;
    const hingeX = sign > 0 ? left : left + leafW;
    const leaf = group(g, `窗扇_${i + 1}`, { kind: 'sash', hinge: sign > 0 ? 'left' : 'right', openingRadians: i === 0 ? opening : 0 });
    leaf.position.set(hingeX, frame + .004, .045); leaf.rotation.y = i === 0 ? -sign * opening : 0;
    const cx = sign * leafW / 2, stile = Math.min(.044, Math.max(.025, leafW * .12)), bodyZ = -.040;
    jn_frame(leaf, '窗扇框挺', cx, 0, leafW, leafH, bodyZ, stile, .080, wood, seed + i * 13);
    const panelH = opt.fullLength ? Math.min(.70, leafH * .27) : leafH > .85 ? Math.min(.18, leafH * .16) : 0;
    let glassBottom = stile + .006;
    if (panelH > 0) {
      const pw = leafW - 2 * stile - .008, py = stile + .006;
      jn_board(leaf, '退进木裙板', cx, py + panelH / 2, -.058, pw, panelH, .028, wood, seed + i + 31);
      jn_frame(leaf, '裙板倒角压线', cx, py - .002, pw + .012, panelH + .005, -.011, .012, .020, wood, seed + i + 41, .87);
      jn_block(leaf, '窗扇腰枋', cx, py + panelH + .020, bodyZ, leafW - 2 * stile, .046, .080, wood, seed + i + 51);
      if (opt.fullLength && i === 0) jn_scar(leaf, '裙板脚边露底', cx - pw * .35, py + .014, -.0426, .018, .085, p.raw, seed + i);
      glassBottom = py + panelH + .047;
    }
    const glassTop = leafH - stile - .007, gh = glassTop - glassBottom, gw = leafW - 2 * stile - .013;
    const bar = Math.min(.020, Math.max(.013, gw * .064));
    const rows = gh > 1.35 ? [glassBottom, glassBottom + gh * .46, glassBottom + gh * .77, glassTop] : gh > .64 ? [glassBottom, glassBottom + gh * .66, glassTop] : [glassBottom, glassTop];
    let paneCount = 0;
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = rows[r] + (r ? bar / 2 : 0), y1 = rows[r + 1] - (r < rows.length - 2 ? bar / 2 : 0);
      const divisions = !opt.simple && r === rows.length - 2 && gw > .23 && y1 - y0 > .17 ? 2 : 1;
      for (let c = 0; c < divisions; c++) {
        const paneW = (gw - (divisions - 1) * bar) / divisions, px = cx - gw / 2 + paneW / 2 + c * (paneW + bar);
        const pane = jn_block(leaf, `独立玻璃格_${++paneCount}`, px, (y0 + y1) / 2, -.023, paneW - .004, y1 - y0 - .004, .0055, opt.warm ? p.warmGlass : p.glass, seed + paneCount, 0);
        if (pane) { pane.castShadow = false; pane.renderOrder = 1; }
        jn_frame(leaf, '玻璃油灰细边', px, y0 - .002, paneW + .004, y1 - y0 + .004, -.015, .0055, .009, p.putty, seed + paneCount);
      }
      if (divisions === 2) jn_block(leaf, '上格短窗棂', cx, (y0 + y1) / 2, -.006, bar, y1 - y0, .035, wood, seed + r);
      if (r < rows.length - 2) jn_block(leaf, '细横棂榫条', cx, rows[r + 1], -.006, gw + .016, bar, .037, wood, seed + r + 2);
    }
    if (!opt.simple && gw > .19 && gh > .55) {
      const mw = Math.min(.105, gw * .32), mh = Math.min(.12, gh * .12), yy = glassTop - .045;
      jn_meander(leaf, '上角左回纹', cx - gw / 2 + .001, yy, mw, mh, .008, 1, wood, seed + i);
      jn_meander(leaf, '上角右回纹', cx + gw / 2 - .001, yy, mw, mh, .008, -1, wood, seed + i + 6);
    }
    if (leafH > .65) for (const hy of [leafH * .22, leafH * .80]) jn_hinge(leaf, 0, hy, .004, sign, p, .60, seed + i);
    if (leafH > .8) {
      jn_block(leaf, '小窗插销座', sign * (leafW - stile * .60), leafH * .48, .009, .015, .057, .012, p.iron, seed + i, .001);
      jn_rod(leaf, '小窗插销', [sign * (leafW - stile * .60), leafH * .46, .019], [sign * (leafW - stile * .60), leafH * .51, .019], .0035, p.iron, seed + i, 6);
    }
    leaf.userData.glassPanes = paneCount; consolidate(leaf);
  }
  consolidate(g); return g;
}

// Housing windows are distinct from the unchanged shopfront/background windows.
const windowMechanisms = new WeakMap();
function timberWindow(parent, name, x, y, z, w, h, mats, opt = {}) {
  if (!opt.residential) return legacyTimberWindow(parent, name, x, y, z, w, h, mats, opt);
  const p=jn_palette(mats),seed=jn_seed(`${name}/${x}/${y}`),wood=opt.black?p.black:p.wood;
  const long=!!opt.fullLength, transom=!!opt.fixed||!!opt.simple&&h<.8;
  const panels=Math.max(1,Math.min(4,opt.panels||2)),frame=Math.min(.065,Math.max(.038,w*.045));
  const depth=long?.17:.145,inside=w-2*frame,leafH=h-2*frame-.008,stile=long?.037:.033;
  const g=group(parent,name,{kind:'window',width:w,height:h,windowRevision:'20261108',
    windowType:transom?'fixed-transom':long?'full-length':opt.dormer?'dormer-casement':panels===3?'casement-fixed-casement':panels===4?'two-pairs':'paired-casement',
    construction:'木框玻璃平开窗_固定中梃_框扇分装五金',noTextures:true});
  g.position.set(x,y,z);g.rotation.y=opt.rotationY||0;
  jn_frame(g,'外框榫接木料',0,0,w,h,0,frame,depth,wood,seed);
  jn_frame(g,'后口窗止',0,frame*.55,w-frame*1.1,h-frame*1.1,-.061,.010,.025,wood,seed+1,.78);
  jn_block(g,'木窗槛滴水前沿',0,frame*.43,depth/2+.009,w-.01,.027,.036,wood,seed+8,.002);
  for(const sign of[-1,1])jn_block(g,'框榫端面',sign*(w/2-frame*.5),h-frame*.5,depth/2+.0008,frame*.45,frame*.36,.002,wood,seed+3,.0003,.77);
  // Four lights form two paired casements; three lights have one fixed centre light.
  const mullion=panels>2?Math.min(.058,inside*.04):0,regions=[];
  if(panels===4){
    jn_block(g,'固定中梃_双组窗',0,h/2,0,mullion,h-2*frame,depth,wood,seed+21,.002);
    const pairW=(inside-mullion)/2;
    for(const side of[-1,1]){const centre=side*(mullion/2+pairW/2);for(let j=0;j<2;j++)regions.push({a:centre-pairW/2+j*pairW/2,b:centre-pairW/2+(j+1)*pairW/2,sign:j===0?1:-1,fixed:transom});}
  }else if(panels===3){
    const cell=(inside-2*mullion)/3;
    for(let i=0;i<3;i++){const a=-inside/2+i*(cell+mullion);regions.push({a,b:a+cell,sign:i===2?-1:1,fixed:transom||i===1});if(i<2)jn_block(g,'固定中梃_三格窗',a+cell+mullion/2,h/2,0,mullion,h-2*frame,depth,wood,seed+21+i,.002);}
  }else for(let i=0;i<panels;i++)regions.push({a:-inside/2+i*inside/panels,b:-inside/2+(i+1)*inside/panels,sign:i===1?-1:1,fixed:transom});
  const moving=[];
  regions.forEach(({a,b,sign,fixed},i)=>{
    const leafW=b-a-.008,hingeX=sign>0?a+.004:b-.004;
    // Pivot is on the outer front corner; all wooden sash thickness lies behind it.
    const leaf=group(g,`${fixed?'固定玻璃框':'窗扇'}_${i+1}`,{kind:fixed?'fixed_light':'sash',hinge:sign>0?'left':'right',openingRadians:0,width:leafW,height:leafH});
    const hingeScale=opt.dormer?.66:long?1.1:1;
    leaf.position.set(hingeX,frame+.004,depth/2+.0022*hingeScale);
    const cx=sign*leafW/2,bodyZ=-.036-.0022*hingeScale,st=Math.min(stile,leafW*.15);
    jn_frame(leaf,'窗扇框挺',cx,0,leafW,leafH,bodyZ,st,.072,wood,seed+i*13);
    let glassBottom=st+.005;
    if(long){
      const panelH=Math.min(.70,leafH*.26),pw=leafW-2*st-.008,py=st+.006;
      jn_board(leaf,'退进木裙板',cx,py+panelH/2,-.060,pw,panelH,.028,wood,seed+i+31);
      jn_frame(leaf,'裙板倒角压线',cx,py-.002,pw+.012,panelH+.005,-.011,.012,.020,wood,seed+i+41,.87);
      jn_block(leaf,'窗扇腰枋',cx,py+panelH+.020,bodyZ,leafW-2*st,.046,.072,wood,seed+i+51);
      glassBottom=py+panelH+.047;
    }
    const glassTop=leafH-st-.006,gh=glassTop-glassBottom,gw=leafW-2*st-.012;
    const count=transom?1:gh>1.35?3:2,bar=long?.018:.016;
    for(let j=0;j<count;j++){
      const y0=glassBottom+j*gh/count+(j?bar/2:0),y1=glassBottom+(j+1)*gh/count-(j<count-1?bar/2:0);
      const pane=jn_block(leaf,`独立玻璃格_${j+1}`,cx,(y0+y1)/2,-.038,gw-.003,y1-y0-.003,.0055,opt.warm?p.warmGlass:p.glass,seed+i+j,0);
      if(pane){pane.castShadow=false;pane.renderOrder=1;}
      jn_frame(leaf,'玻璃油灰细边',cx,y0-.002,gw+.004,y1-y0+.004,-.030,.0055,.009,p.putty,seed+j);
      if(j<count-1)jn_block(leaf,'细横棂榫条',cx,glassBottom+(j+1)*gh/count,-.019,gw+.016,bar,.035,wood,seed+j);
    }
    // Restrained meander survives only on the full-length hall screen.
    if(long&&gw>.19){const mw=Math.min(.09,gw*.30),mh=.095,yy=glassTop-.035;
      jn_meander(leaf,'长窗上角左回纹',cx-gw/2+.001,yy,mw,mh,-.006,1,wood,seed+i);
      jn_meander(leaf,'长窗上角右回纹',cx+gw/2-.001,yy,mw,mh,-.006,-1,wood,seed+i+6);
    }
    leaf.userData.glassPanes=count;
    if(!fixed){
      const hardware=installWindowHardware(THREE,g,leaf,{hingeX,sign,frame,leafW,leafH,stile:st,dormer:!!opt.dormer,long,hookSide:opt.hookSide,boltSide:opt.boltSide});
      moving.push({leaf,hardware});
    }
    consolidate(leaf);
  });
  consolidate(g);windowMechanisms.set(g,moving);setWindowOpening(g,false);return g;
}
function setWindowOpening(window,open){
  const moving=windowMechanisms.get(window);if(!moving)return;
  for(const {leaf,hardware}of moving){
    leaf.rotation.y=-hardware.sign*(open?hardware.openAngle:0);
    leaf.userData.openingRadians=open?hardware.openAngle:0;
    updateWindowHardware(THREE,hardware,open);
  }
  window.userData.open=!!open;
}

function door(parent, name, x, y, z, w, h, mats, opt = {}) {
  const p = jn_palette(mats), seed = jn_seed(`${name}/${x}/${y}`), timber = opt.black ? p.black : p.wood;
  const g = group(parent, name, { kind: 'door', clearOpening: [w, h], construction: opt.plainExterior ? '平板黑漆厚木门，门环独立安装' : '实体框档拼板门', noTextures: opt.hardware !== 'separate' });
  g.position.set(x, y, z); g.rotation.y = opt.rotationY || 0;
  const frame = .065;
  jn_block(g, '门框左挺', -w / 2 - frame / 2, h / 2 + .025, 0, frame, h + .05, .15, timber, seed, .004);
  jn_block(g, '门框右挺', w / 2 + frame / 2, h / 2 + .025, 0, frame, h + .05, .15, timber, seed + 2, .004);
  jn_block(g, '门框上横榫', 0, h + .030, 0, w + frame * 2, .070, .15, timber, seed + 4, .004);
  if(opt.plainExterior){
    // 内开厚门的止口在门板正面；底部由石门槛收口，不能再放横木挡住开门。
    for(const sign of[-1,1])jn_block(g,'门框内口止线_侧',sign*(w/2-.001),h/2,.0575,.014,h,.025,timber,seed+7,.0015,.80);
    jn_block(g,'门框内口止线_上',0,h+.005,.0575,w-.016,.014,.025,timber,seed+9,.0015,.80);
  }else jn_frame(g, '门框内口止线', 0, .004, w + .012, h + .012, -.053, .014, .025, timber, seed + 7, .80);
  const count = opt.double ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const sign = count === 2 && i === 1 ? -1 : 1;
    const hingeGap = opt.plainExterior ? .003 : 0;
    const leafW = opt.plainExterior ? (w - 2 * hingeGap - .014) / count : w / count - .015;
    const cx = sign * (hingeGap + leafW / 2);
    const hingeX = sign > 0 ? -w / 2 + i * w / count : w / 2;
    const leaf = group(g, `门扇_${i + 1}`, { kind: 'door_leaf', hinge: sign > 0 ? 'left' : 'right', openingRadians: opt.open || 0 });
    leaf.position.set(hingeX, 0, opt.plainExterior?-.048:.040); leaf.rotation.y = (opt.open || 0) * sign;
    const skin=opt.plainExterior?group(leaf,'门板与随动附件'):leaf;
    if(opt.plainExterior){skin.position.z=.088;leaf.userData.pivotAtRear=true;leaf.userData.closedCentreGap=.014;}
    const stile = Math.min(.080, Math.max(.052, leafW * .12)), bodyZ = -.040, panelW = leafW - 2 * stile;
    if (opt.plainExterior) {
      // 入户门按鹿鹿选定的平板概念图制作，正面不再有三格凸框和横档。
      // 保留原门轴、8.8 厘米厚度和背面穿带，开合与原门洞继续匹配。
      jn_block(skin, '平板黑漆厚木门扇', cx, h / 2, bodyZ, leafW, h - .010, .088, timber, seed + i * 20, .002);
      leaf.userData.exterior = 'plain_black_lacquer';
      leaf.userData.thickness = .088;
    } else {
      jn_frame(leaf, '门扇实木框挺', cx, .005, leafW, h - .010, bodyZ, stile, .088, timber, seed + i * 20);
      const rails = [stile, h * .31, h * .66, h - stile];
      for (let j = 1; j < rails.length - 1; j++) jn_block(leaf, '贯通横档', cx, rails[j], bodyZ, panelW, .085, .088, timber, seed + j, .0035);
      for (let j = 0; j < rails.length - 1; j++) {
        const bottom = rails[j] + (j ? .0425 : .009), top = rails[j + 1] - (j === rails.length - 2 ? .009 : .0425), ph = top - bottom;
        const boards = panelW > .64 ? 4 : 3, boardW = (panelW - .004 * (boards - 1)) / boards;
        // 背舌封住拼缝；正面相邻窄板留 4 mm 真实层次，而非画一条线。
        jn_block(leaf, '板心背舌', cx, (bottom + top) / 2, -.078, panelW + .006, ph + .006, .012, timber, seed + j, 0, .72);
        for (let n = 0; n < boards; n++) {
          const bx = cx - panelW / 2 + boardW / 2 + n * (boardW + .004);
          jn_board(leaf, '纵向拼板与木纤维槽', bx, (bottom + top) / 2, -.057, boardW, ph, .036, timber, seed + i * 37 + j * 11 + n);
        }
        jn_frame(leaf, '退进板心四边压线', cx, bottom - .005, panelW + .010, ph + .010, -.012, .015, .027, timber, seed + j + 9, .88);
        if (j === 0) jn_scar(leaf, '下裙板局部露木', cx - panelW * .36, bottom + .016, -.0386, .016, Math.min(.11, ph * .24), p.raw, seed + i);
      }
    }
    if (opt.black) {
      // 平板黑漆门不沿用旧框挺旁的两条对称掉漆竖痕。
      if (!opt.plainExterior) jn_scar(leaf, '门挺常摸处掉漆', sign * (leafW - stile * .75), h * .47, .0048, .014 * sign, .092, p.raw, seed + i + 30);
      jn_scar(skin, '下槛一小处漆面缺口', cx - leafW * .19, .014, .0048, .055, .017, p.raw, seed + i + 32);
    }
    for (const hy of [h * .17, h * .80]) {
      const hinge=opt.plainExterior?group(leaf,'后置门轴铰链'):leaf;
      if(opt.plainExterior)hinge.scale.z=-1;
      jn_hinge(hinge, 0, hy, 0, sign, p, .94, seed + i);
      jn_block(g, '固定门框铰链片', hingeX - sign * .022, hy, opt.plainExterior?-.044:.038, .040, .112, .006, p.iron, seed + i, .001);
    }
    const handleX = sign * (hingeGap + leafW - stile - .030), handleY = Math.min(1.23, h * .49);
    if (opt.hardware === 'separate') {
      // 调平后的底座背面为 Z=0；留 0.5 毫米表面余量，随所属门扇开合。
      const anchor = group(skin, '铜门环_独立安装位', { kind: 'door_hardware_anchor', asset: 'brass-ring-fitted-v2', status: 'installed', targetHeight: .14 });
      anchor.position.set(handleX, handleY, .0045);
      anchor.add(createBrassRing(THREE));
    } else if (opt.double) {
      const plate = jn_shape(leaf, '门环铜叶底座', [[handleX - .037, handleY + .071], [handleX + .037, handleY + .071], [handleX + .043, handleY + .004], [handleX + .022, handleY - .033], [handleX - .022, handleY - .033], [handleX - .043, handleY + .004]], .010, .009, p.brass, seed + i, .001);
      const ring = jn_mesh(leaf, '可见实体铜门环', new THREE.TorusGeometry(.055, .009, 7, 20), p.brass, seed + i); ring.position.set(handleX, handleY - .017, .047); ring.rotation.x = -.12;
      jn_rod(leaf, '门环横轴', [handleX - .019, handleY + .045, .032], [handleX + .019, handleY + .045, .032], .009, p.brass, seed + i);
      jn_screw(leaf, handleX, handleY + .055, .024, .006, p.brass, seed + i);
    } else {
      jn_block(leaf, '铁拉手底板', handleX, handleY, .010, .043, .155, .008, p.iron, seed + i, .002);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(handleX, handleY - .052, .020), new THREE.Vector3(handleX, handleY - .042, .054), new THREE.Vector3(handleX, handleY + .042, .054), new THREE.Vector3(handleX, handleY + .052, .020)]);
      jn_mesh(leaf, '实体弓形铁拉手', new THREE.TubeGeometry(curve, 12, .0065, 6, false), p.iron, seed);
    }
    // 门闩处于收回位置，不在门扇开启时悬跨两片门。
    const bx = sign * (leafW - .17), by = Math.min(1.43, h * .59), back = -.094;
    jn_rod(skin, '背面收回的铁门闩', [bx - .100, by, back], [bx + .100, by, back], .007, p.iron, seed + i);
    for (const dx of [-.065, .065]) jn_block(skin, '铁闩导环', bx + dx, by, back + .004, .018, .047, .023, p.iron, seed + i, .0015);
    jn_rod(skin, '门闩短把', [bx + sign * .027, by, back], [bx + sign * .027, by - .035, back - .018], .006, p.iron, seed + i);
    for (const yy of [.20, h - .23]) jn_block(skin, '背面木穿带', cx, yy, -.097, leafW - .055, .066, .026, timber, seed + i + 44, .003, .86);
    if(skin!==leaf)consolidate(skin);
    consolidate(leaf);
  }
  consolidate(g); return g;
}

function jn_curveBand(parent, name, points, width, depth, mat, seed = 0, steps = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), positions = [], indices = [], uvs = [];
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPoint(i / steps), t = curve.getTangent(i / steps), normal = new THREE.Vector3(-t.y, t.x, 0).normalize();
    for (const [s, z] of [[-1, -depth / 2], [1, -depth / 2], [-1, depth / 2], [1, depth / 2]]) { positions.push(p.x + normal.x * width * s / 2, p.y + normal.y * width * s / 2, p.z + z); uvs.push(i / steps, s > 0 ? 1 : 0); }
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 4, b = a + 4;
    indices.push(a + 2, b + 2, b + 3, a + 2, b + 3, a + 3, a, b + 1, b, a, a + 1, b + 1, a, b, b + 2, a, b + 2, a + 2, a + 1, a + 3, b + 3, a + 1, b + 3, b + 1);
  }
  const last = steps * 4; indices.push(0, 2, 3, 0, 3, 1, last, last + 1, last + 3, last, last + 3, last + 2);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return jn_mesh(parent, name, geo, mat, seed);
}

function jn_jamb(parent, x, y0, y1, p, sign, seed, chipped = false) {
  // 石框背口让出木门套的企口；门洞净空在柱脚处也不被基座挤窄。
  const points = [[-.070, -.09], [.125, -.09], [.125, .25], [-.125, .25], [-.125, .075], [-.070, .075]];
  const shape = new THREE.Shape(); points.forEach(([px, pz], i) => i ? shape.lineTo(px * sign, -pz) : shape.moveTo(px * sign, -pz)); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, steps: 1 }); geo.rotateX(-Math.PI / 2); geo.translate(x, y0, 0);
  if (chipped) {
    const a = geo.attributes.position;
    for (let i = 0; i < a.count; i++) if (a.getX(i) * sign > Math.abs(x) + .112 && a.getY(i) < y0 + .005 && a.getZ(i) > .24) a.setXYZ(i, a.getX(i) - sign * .021, a.getY(i) + .018, a.getZ(i) - .024);
    geo.computeVertexNormals();
  }
  return jn_mesh(parent, '分块石门框_背面企口', geo, p.stone, seed, .93 + (seed % 4) * .015);
}

function jn_leafRelief(parent, x, y, z, angle, size, p, seed) {
  const shape = new THREE.Shape(); shape.moveTo(0, -size * .5); shape.bezierCurveTo(-size * .34, -size * .11, -size * .31, size * .27, 0, size * .5); shape.bezierCurveTo(size * .26, size * .20, size * .30, -size * .07, 0, -size * .5);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .014, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1, curveSegments: 6, steps: 1 });
  const m = jn_mesh(parent, '植物叶片浅浮雕', geo, p.stone, seed); m.position.set(x, y, z); m.rotation.z = angle;
}

const oldNumberMaterials = new Map();
function oldNumberMaterial(number) {
  const digits = String(number).replace(/\D/g, '').slice(0, 3) || '27';
  if (oldNumberMaterials.has(digits)) return oldNumberMaterials.get(digits);
  const m = new THREE.MeshStandardMaterial({name:'老搪瓷门牌_平印白字_'+digits,color:0xffffff,roughness:.54,metalness:.06});
  m.userData = {asset:'old-enamel-door-number-v1-'+digits, number:digits, road:'成都北路', fullAddress:'成都北路'+digits+'号', addressLayout:'上排路名、下排大号数字；牌面不另印号字', historicalDesign:'参照拆迁前留存的老搪瓷门牌排版；未指定真实弄号'};
  if (typeof document !== 'undefined') {
    const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
    g.fillStyle='#19458c';g.fillRect(0,0,512,512);
    const glaze=g.createLinearGradient(0,0,512,512);glaze.addColorStop(0,'rgba(255,255,235,.045)');glaze.addColorStop(1,'rgba(0,10,20,.035)');g.fillStyle=glaze;g.fillRect(0,0,512,512);
    // A surviving old plate taken down before its owner's 1997 relocation
    // prints the road above a large number, with no separate 号 glyph.
    // Road name sized like the surviving plate (spread across ~78% of the width) and
    // thickened with a thin stroke so it still reads at the gate-front viewing distance.
    g.fillStyle=g.strokeStyle='#eeecd9';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.lineJoin='round';
    g.font='600 96px "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", "SimSun", serif';
    {const road=[...'成都北路'],span=400,size=96;road.forEach((ch,i)=>{const x=256-span/2+size/2+i*(span-size)/(road.length-1);g.fillText(ch,x,94);g.strokeText(ch,x,94);});}
    g.fillStyle='#eeecd9';
    g.save();g.translate(256,326);g.scale(digits.length>2?.75:1,1);g.font='900 274px "Arial Black", Impact, sans-serif';g.fillText(digits,0,0);g.restore();
    // Minor exposed steel at the mounting corners; the number field stays legible.
    for(let i=0;i<12;i++){const x=i%2?493:12,y=18+(i%6)*92;g.fillStyle=i%3?'#666354':'#554a3c';g.fillRect(x+(i%3)*2,y,3+i%4,2+i%3);}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;m.map=t;
  } else m.color.set(0x19458c);
  oldNumberMaterials.set(digits,m);return m;
}
function jn_numberPlate(parent, number, p, detailed) {
  const cx=1.19,cy=2.20,z=.148,w=.18,h=.18;
  // Separate the front and the folded steel back without two surfaces at the same depth.
  const body=new THREE.BoxGeometry(w,h,.003),indices=Array.from(body.index.array),front=body.groups[4];
  const face=body.clone();face.clearGroups();face.setIndex(indices.slice(front.start,front.start+front.count));
  body.clearGroups();body.setIndex([...indices.slice(0,front.start),...indices.slice(front.start+front.count)]);
  mesh(parent,'搪瓷门牌实体',body,p.enamel).position.set(cx,cy,z);
  mesh(parent,'门牌_釉面平印数字',face,oldNumberMaterial(number)).position.set(cx,cy,z);
  for(const sx of[-1,1])for(const sy of[-1,1])jn_screw(parent,cx+sx*.079,cy+sy*.079,z+.002,.0025,p.iron,27+sx+sy);
  parent.userData={...parent.userData,doorNumber:String(number),roadName:'成都北路',displayAddress:'成都北路'+String(number)+'号',enamelPlateRevision:5,sizeMetres:[w,h,.003]};
}

const neighbourClothMaterials=new Map();
function neighbourClothMaterial(style){
  if(neighbourClothMaterials.has(style))return neighbourClothMaterials.get(style);
  const sheer=style==='sheer',m=new THREE.MeshStandardMaterial({name:'邻户薄布_'+style,color:0xffffff,roughness:1,side:THREE.DoubleSide,
    transparent:sheer,opacity:sheer?.64:1,depthWrite:!sheer});
  m.userData={asset:'neighbour-curtain-v1-'+style,neighbourCurtain:true,sheer};
  if(typeof document!=='undefined'){
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
    const bases={check:'#c6cfc8',stripe:'#c7c4ae',flower:'#d6cbb9',plain:'#acb9b0',sheer:'#e3e0cf'};
    g.fillStyle=bases[style];g.fillRect(0,0,256,256);
    if(style==='check')for(let i=0;i<256;i+=32){g.fillStyle='rgba(60,91,107,.30)';g.fillRect(i,0,9,256);g.fillRect(0,i,256,9);g.fillStyle='rgba(236,231,207,.55)';g.fillRect(i+16,0,2,256);g.fillRect(0,i+16,256,2);}
    if(style==='stripe')for(let i=0;i<256;i+=32){g.fillStyle='#8d9a8e';g.fillRect(i,0,8,256);g.fillStyle='#ddd4be';g.fillRect(i+13,0,3,256);}
    if(style==='flower')for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const x=col*64+22+(row%2)*18,y=row*64+24;g.strokeStyle='#839880';g.lineWidth=2;g.beginPath();g.moveTo(x,y+13);g.quadraticCurveTo(x-6,y+5,x,y);g.stroke();
      for(let k=0;k<5;k++){g.fillStyle=k%2?'#b7817b':'#ba8a83';g.beginPath();g.ellipse(x+Math.cos(k*1.257)*4,y+Math.sin(k*1.257)*4,3,4,k*1.257,0,Math.PI*2);g.fill();}
      g.fillStyle='#d2b99c';g.fillRect(x-1,y-1,3,3);
    }
    // Fine weave stays low contrast so distant windows do not sparkle.
    g.fillStyle='rgba(90,93,81,.035)';for(let i=0;i<256;i+=4){g.fillRect(i,0,1,256);g.fillRect(0,i,256,1);}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;m.map=t;
  }
  neighbourClothMaterials.set(style,m);return m;
}
function installNeighbourWindowCurtains(root,id,mats){
  const house=Number(id.slice(1))-1,windows=[];root.traverse(o=>{if(o.userData.kind==='window'&&o.userData.height>=.75&&(id!=='A6'||o.name.startsWith('35号_东侧新增')))windows.push(o);});
  const styles=['flower','check','stripe','plain','sheer'],fixtures=[];
  for(let index=0;index<windows.length;index++){
    const w=windows[index],W=w.userData.width-.14,H=w.userData.height-.14;if(W<.20||H<.30)continue;
    const front=w.name==='前楼_四扇木窗',seed=jn_seed(w.name)+house*17;
    const style=front?['flower','check','stripe'][house]:styles[(house+index*2)%styles.length],mat=neighbourClothMaterial(style);
    const curtain=group(w,'邻户窗内_细杆夹环与薄布',{neighbourCurtain:true,style,owner:id,window:w.name,fixedToWall:true});
    const z=-.29,top=w.userData.height-.07,bottom=.07;
    rod(curtain,'窗内细铁杆',[-W/2-.045,top+.024,z],[W/2+.045,top+.024,z],.0045,mats.iron,6);
    const closed=front?house===1:(house+index)%3===1,fraction=closed?.465:.21+((index+house)%2)*.035,panelW=W*fraction;
    for(const side of[-1,1]){
      const left=side<0?-W/2:W/2-panelW,cols=32,rows=6,pos=[],uv=[],indices=[];
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
        const u=i/cols,v=j/rows,folds=closed?7:5,wave=Math.sin(u*Math.PI*2*folds+.2*side);
        const hem=.012*Math.sin(u*Math.PI)+.006*Math.sin(u*19+seed);
        pos.push(left+panelW*u,bottom+(top-bottom)*v-hem*(1-v),z+.020*wave*(.82+.18*v));
        uv.push(u*panelW/.24,v*(top-bottom)/.24);
      }
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;indices.push(a,a+1,a+cols+2,a,a+cols+2,a+cols+1);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
      const cloth=mesh(curtain,'自然垂挂的'+style+'薄布',g,mat);cloth.castShadow=!mat.transparent;cloth.receiveShadow=true;
      for(let i=0;i<=5;i++){const ring=mesh(curtain,'小挂环',new THREE.TorusGeometry(.009,.0018,4,8),mats.iron);ring.position.set(left+panelW*i/5,top+.014,z);ring.rotation.y=Math.PI/2;}
    }
    consolidate(curtain);fixtures.push({window:w.name,style,closed,width:W,height:H,clothLocalZ:[z-.02,z+.02]});
  }
  root.userData.neighbourCurtains={revision:1,owner:id,fixtures,excluded:'门上固定横披；不改B1已确认帘子'};
  nb3_completeVertexColors(root);
}

function portal(parent, mats, detail, number = '27') {
  const basePalette = jn_palette(mats), p = { ...basePalette, stone: basePalette.portalStone, stoneDark: basePalette.portalRecess };
  const detailed = detail === 'hero', g = group(parent, '石库门_石框门楣', {
    kind: 'portal', clearOpening: [1.4, 2.8], noTextures: false,
    design: '灰石直框、平直横楣与三角山花；按鹿鹿提供照片适配现有门洞',
    reliefStatus: 'installed_pending_user_visual_acceptance',
    reference: 'user-grey-triangular-portal-20261108.png'
  });
  // 石料背部止于墙芯：当地 z=-.10（整屋 z=-.22），比内侧灰缝退进2厘米。
  // 固定原来的街面端点；只缩短藏在墙内的背部，不移动正面、出挑或山花。
  const portalBlock=(name,x,y,z,w,h,d,mat,seed,bevel,shade)=>{
    const front=z+d/2,back=Math.max(z-d/2,-.10);
    return jn_block(g,name,x,y,(front+back)/2,w,h,front-back,mat,seed,bevel,shade);
  };
  g.userData.innerStoneBackLocalZ=-.10;
  // 宽直壁柱在门洞外展开；正面以浅凹长方框与短悬饰表现参考中的层次。
  for (const sign of [-1, 1]) {
    const x = sign * 1.01;
    portalBlock('直框石柱脚', sign * 1.025, .16, .080, .60, .32, .40, p.stone, sign + 20, .006);
    portalBlock('柱脚平直收口', sign * 1.025, .34, .092, .60, .048, .42, p.stone, sign + 23, .003);
    portalBlock('宽直石壁柱', x, 1.585, .055, .57, 2.45, .33, p.stone, sign + 30, .005);
    portalBlock('壁柱浅凹长方底面', x, 1.40, .224, .39, 1.94, .009, p.stoneDark, sign + 33, .002, .99);
    jn_frame(g, '壁柱长方细线框', x, .43, .43, 1.98, .237, .022, .023, p.stone, sign + 37, .99);
    for (const dx of [-.105, .105]) {
      portalBlock('壁柱上部短悬饰', x + dx, 2.565, .248, .073, .20, .068, p.stone, sign + 40, .003);
      portalBlock('短悬饰下端', x + dx, 2.455, .242, .051, .036, .054, p.stone, sign + 42, .003);
    }
    portalBlock('壁柱上端横带', x, 2.765, .080, .59, .075, .38, p.stone, sign + 46, .003);
    const corner = new THREE.Shape();
    corner.moveTo(sign * .725, 2.62); corner.lineTo(sign * .725, 2.80); corner.lineTo(sign * .545, 2.80);
    corner.quadraticCurveTo(sign * .725, 2.80, sign * .725, 2.62); corner.closePath();
    const cornerGeo = new THREE.ExtrudeGeometry(corner, { depth: .14, bevelEnabled: false, steps: 1, curveSegments: 12 });
    cornerGeo.translate(0,0,.11); jn_mesh(g, '门洞上角小圆弧收口', cornerGeo, p.stone, sign + 48);
  }
  // 参考中的厚横楣由下檐、素面长方额枋、上部叠线组成。
  portalBlock('门洞上方石横梁', 0, 2.855, .055, 2.61, .12, .35, p.stone, 51, .005);
  portalBlock('横楣下挑檐', 0, 2.950, .085, 2.75, .070, .43, p.stone, 54, .004);
  portalBlock('横楣下细线', 0, 2.997, .086, 2.67, .025, .40, p.stone, 55, .002);
  portalBlock('素面石额枋', 0, 3.200, .055, 2.61, .38, .33, p.stone, 60, .004);
  portalBlock('额枋中央浅凹底面', 0, 3.200, .224, 1.63, .266, .009, p.stoneDark, 61, .002, .99);
  jn_frame(g, '额枋中央长方细线框', 0, 3.055, 1.69, .29, .237, .018, .022, p.stone, 63, .99);
  for (const sign of [-1, 1]) portalBlock('额枋两侧竖分带', sign * .91, 3.20, .237, .045, .37, .035, p.stone, sign + 65, .002);
  portalBlock('横楣上细线', 0, 3.410, .075, 2.70, .034, .41, p.stone, 68, .003);
  portalBlock('三角山花下平檐', 0, 3.463, .090, 2.88, .072, .46, p.stone, 70, .004);

  // 等距内收的三角形线脚；独立浮雕贴合内侧安装区。
  const slope = .90 / 1.42, normalLength = Math.hypot(1, slope);
  const triangle = inset => {
    const top = 4.40 - inset * normalLength, bottom = 3.50 + inset, half = (top - bottom) / slope;
    return [[-half, bottom], [half, bottom], [0, top]];
  };
  const band = (name, outside, inside, z, depth, seed) => {
    const shape = new THREE.Shape();
    triangle(outside).forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
    const hole = new THREE.Path();
    triangle(inside).reverse().forEach(([x,y],i) => i ? hole.lineTo(x,y) : hole.moveTo(x,y)); hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 1, steps: 1 });
    geo.translate(0,0,z); return jn_mesh(g, name, geo, p.stone, seed);
  };
  jn_shape(g, '三角山花_平整石底', triangle(0), .040, .16, p.stoneDark, 74, .002);
  band('三角山花_直线外檐', 0, .055, .195, .085, 77);
  band('三角山花_内侧细线', .065, .082, .198, .024, 79);
  const field = triangle(.09), width = field[1][0] - field[0][0], height = field[2][1] - field[0][1];
  const relief = group(g, '三角山花_浮雕独立安装位', { kind: 'pediment_relief_anchor', status: 'installed', widthMetres: width, heightMetres: height, maxDepthMetres: .05 });
  relief.position.set(0, field[0][1] + height / 2, .202);
  relief.add(createPedimentRelief(THREE));
  const plate = group(g, '门牌_外侧安装位'); plate.position.x = .31;
  jn_numberPlate(plate, number, p, detailed);
  consolidate(g); return g;
}


function railing(parent,name,a,b,y,mats,opt={}) {
  const g=group(parent,name),va=new THREE.Vector3(a[0],y,a[1]),vb=new THREE.Vector3(b[0],y,b[1]);
  const length=va.distanceTo(vb),height=opt.height||.90,mat=opt.metal?mats.metal:mats.wood;
  const n=Math.max(1,Math.ceil(length/.18));
  for(let i=0;i<=n;i++){
    const p=va.clone().lerp(vb,i/n);rod(g,'栏杆',p.toArray(),[p.x,p.y+height,p.z],i===0||i===n?.028:.015,mat,6);
  }
  rod(g,'扶手',[va.x,y+height,va.z],[vb.x,y+height,vb.z],.036,mat,8);
  rod(g,'下横档',[va.x,y+.12,va.z],[vb.x,y+.12,vb.z],.022,mat,6);consolidate(g);return g;
}

function stairFlight(parent,name,{x,z,y,steps,rise=.2,going=.24,width=.88,dir=-1},mats) {
  const g=group(parent,name,{kind:'stair',start:[x,y,z],steps,rise,going,width,dir,slopeDegrees:Math.atan(rise/going)*180/Math.PI});
  // steps 个踢面，steps-1 个独立踏面；末一级落在上平台，不额外伸出一块踏步。
  for(let i=1;i<steps;i++){
    const cz=z+dir*(i-.5)*going,cy=y+i*rise;
    box(g,`踏步_${String(i).padStart(2,'0')}`,x,cy-.025,cz,width,.05,going+.018,mats.wood);
    box(g,`踢面_${i}`,x,cy-rise/2-.015,z+dir*(i-1)*going,width,rise-.02,.025,mats.woodDark||mats.wood);
    box(g,'踏鼻',x,cy-.008,z+dir*((i-1)*going-.006),width+.012,.026,.028,mats.wood);
  }
  const len=(steps-1)*going, endZ=z+dir*len, endY=y+steps*rise;
  for(const sx of [-1,1]){
    rod(g,'木梯梁',[x+sx*(width/2-.055),y-.08,z],[x+sx*(width/2-.055),endY-.18,endZ],.070,mats.woodDark||mats.wood,4);
    rod(g,'斜扶手',[x+sx*(width/2-.025),y+.90,z],[x+sx*(width/2-.025),endY+.90,endZ],.031,mats.wood,8);
    for(let i=0;i<steps;i++){
      const zz=z+dir*i*going,yy=y+(i+1)*rise;
      rod(g,'木栏杆',[x+sx*(width/2-.025),yy-.04,zz],[x+sx*(width/2-.025),yy+.86,zz],.014,mats.wood,6);
    }
  }
  consolidate(g);return g;
}

function drainage(parent,name,x,z,bottom,top,mats,opt={}) {
  const g=group(parent,name,{kind:'rainwater'});
  const lower=opt.bottom!==false,upper=opt.top!==false;
  rod(g,'白铁落水管',[x,bottom+(lower?.16:0),z],[x,top-(upper?.13:0),z],.041,mats.metal,8);
  for(let y=bottom+.45;y<top-.1;y+=1.32){
    const b=mesh(g,'管箍',new THREE.TorusGeometry(.044,.009,4,10),mats.metal);b.rotation.x=Math.PI/2;b.position.set(x,y,z);
  }
  if(lower)rod(g,'下出水弯管',[x,bottom+.16,z],[x,bottom+.06,z+.14],.041,mats.metal,8);
  if(upper)rod(g,'接檐弯管',[x,top-.13,z],[x,top,z+.15],.042,mats.metal,8);consolidate(g);return g;
}

// 有厚度、双面封闭的屋面灰背。V2 瓦片、脊瓦和檐口均由独立实体构件形成。
function roofPatch(parent,name,x0,x1,z0,z1,heightAt,mat,holes=[]) {
  const g=group(parent,name);
  const xs=[...new Set([x0,x1,...holes.flatMap(h=>[h.x0,h.x1])])].filter(x=>x>=x0&&x<=x1).sort((a,b)=>a-b);
  const zs=[...new Set([z0,z1,...holes.flatMap(h=>[h.z0,h.z1])])].filter(z=>z>=z0&&z<=z1).sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const xa=xs[i],xb=xs[i+1],za=zs[j],zb=zs[j+1],mx=(xa+xb)/2,mz=(za+zb)/2;
    if(holes.some(h=>mx>h.x0&&mx<h.x1&&mz>h.z0&&mz<h.z1))continue;
    const ya=heightAt(za),yb=heightAt(zb),pts=[xa,ya,za, xb,ya,za, xb,yb,zb, xa,yb,zb, xa,ya-.16,za, xb,ya-.16,za, xb,yb-.16,zb, xa,yb-.16,zb];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    geo.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);geo.computeVertexNormals();
    const non=geo.toNonIndexed();non.computeVertexNormals();metricUV(non,mat);
    // 坡向 UV 按斜面长度，不把一米材质投成一米水平投影。
    const factor=Math.hypot(1,(yb-ya)/(zb-za)),uv=non.attributes.uv;
    for(let k=0;k<uv.count;k++)uv.setY(k,uv.getY(k)*factor);
    mesh(g,'坡面实心板',non,mat);geo.dispose();
  }
  consolidate(g);return g;
}

function gable(parent,name,x,zFront,zRidge,zBack,eave,ridge,mats) {
  const shape=new THREE.Shape();shape.moveTo(zFront,eave);shape.lineTo(zBack,eave);shape.lineTo(zRidge,ridge);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false});
  // 局部 X 对应全局 Z、局部 Y 为 Y、挤出轴转成 X。
  geo.rotateY(-Math.PI/2);geo.translate(x+.12,0,0);metricUV(geo,mats.redBrick);
  const col=[];const pp=geo.attributes.position;for(let i=0;i<pp.count;i++){const z=pp.getZ(i),y=pp.getY(i),v=.86+.08*Math.sin(z*2.2+y*1.9)+.035*Math.sin(z*11+y*7);const c=v2Color(0xafa38b,v);col.push(c.r,c.g,c.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));const gm=mats.plaster.clone();gm.color.set(0xffffff);gm.vertexColors=true;return mesh(parent,name,geo,gm);
}

export function getShikumenMaterials(){return sharedMaterials ||= createShikumenMaterials(THREE);}

/*
 * V2 实体小青瓦屋面。没有颜色贴图、法线贴图或置换贴图。
 * 所有底瓦、盖瓦和脊瓦均为带封闭边缘的 6–9 mm 薄弧壳，不是圆管或波浪板。
 * 规格依据：上海市绿化市容局 2020-10-27「当青瓦不再用于屋面…」；
 * 铺法依据：上观「房可圆」2024-03-20「历史建筑修缮技术——屋面施工篇（一）」。
 * 长 .24 m / 厚 .006 m 在资料范围内；大小头、弧高、横向节距为模型选值。
 */
const v2RoofGeometryCache = new Map();
const v2RoofMaterialCache = new WeakMap();

function v2RoofHash(a, b=0, c=0) {
  let n = Math.imul((a|0)^0x6d2b79f5, 0x45d9f3b) ^ Math.imul((b|0)+71, 0x27d4eb2d) ^ Math.imul((c|0)+13,0x85ebca6b);
  n ^= n >>> 16; n = Math.imul(n,0x45d9f3b); n ^= n >>> 16;
  return (n>>>0)/4294967295;
}

function v2RoofPlainMaterial(source,name,settings={}) {
  const material = source ? source.clone() : new THREE.MeshStandardMaterial();
  for (const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','aoMap','alphaMap','displacementMap','emissiveMap','lightMap']) material[key]=null;
  material.name=name; material.userData={...(material.userData||{}),geometryDetail:true,usesTextures:false};
  for(const [key,value] of Object.entries(settings)) {
    if(key==='color')material.color.set(value);else if(key==='emissive')material.emissive.set(value);else material[key]=value;
  }
  return material;
}

function v2RoofMaterials(mats) {
  if(v2RoofMaterialCache.has(mats))return v2RoofMaterialCache.get(mats);
  const out={...mats,
    tile:v2RoofPlainMaterial(mats.tile,'MAT_实体小青瓦_有限实例色',{color:0xffffff,roughness:.92,metalness:0}),
    mortar:v2RoofPlainMaterial(mats.greyBrick,'MAT_屋面灰背与灰缝',{color:0x7c776c,roughness:.97,metalness:0}),
    gableBrick:v2RoofPlainMaterial(mats.redBrick,'MAT_山墙实体砖_实例色',{color:0xffffff,roughness:.91,metalness:0}),
    wood:v2RoofPlainMaterial(mats.wood,'MAT_屋檐实木构件',{roughness:.88,metalness:0}),
    woodDark:v2RoofPlainMaterial(mats.woodDark||mats.wood,'MAT_屋架阴面木材',{roughness:.95,metalness:0}),
    stone:v2RoofPlainMaterial(mats.stone,'MAT_山墙分段石压顶',{roughness:.93,metalness:0}),
    greyBrick:v2RoofPlainMaterial(mats.greyBrick,'MAT_屋面灰色砌体',{roughness:.94,metalness:0}),
    plaster:v2RoofPlainMaterial(mats.plaster,'MAT_老虎窗石灰面',{roughness:.95,metalness:0}),
    metal:v2RoofPlainMaterial(mats.metal,'MAT_折边白铁泛水',{color:0x70736b,roughness:.72,metalness:.38}),
    glass:mats.glass ? v2RoofPlainMaterial(mats.glass,'MAT_老虎窗清玻璃') : undefined,
    glassWarm:mats.glassWarm ? v2RoofPlainMaterial(mats.glassWarm,'MAT_老虎窗暖玻璃') : undefined,
  };
  v2RoofMaterialCache.set(mats,out);return out;
}

/** 闭合薄壳：两端弧形断面、上下弧面、两侧边，36 三角/四弧段。 */
function v2RoofTileGeometry(spec) {
  const s={length:.24,width0:.178,width1:.198,rise:.027,thickness:.006,segments:4,lift0:.018,lift1:0,convex:false,variant:0,...spec};
  const key=Object.values(s).map(v=>typeof v==='number'?v.toFixed(6):String(v)).join('|');
  if(v2RoofGeometryCache.has(key))return v2RoofGeometryCache.get(key);
  const positions=[],uvs=[],indices=[],n=s.segments,meanWidth=(s.width0+s.width1)/2;
  const radius=meanWidth*meanWidth/(8*s.rise)+s.rise/2;
  const maxAngle=Math.asin(meanWidth/(2*radius));
  const id=(layer,ring,j)=>(layer*2+ring)*(n+1)+j;
  for(let layer=0;layer<2;layer++)for(let ring=0;ring<2;ring++)for(let j=0;j<=n;j++) {
    const a=-maxAngle+2*maxAngle*j/n, ratio=(ring?s.width1:s.width0)/meanWidth;
    const arc=radius*(1-Math.cos(a))*ratio;
    let x=radius*Math.sin(a)*ratio;
    let y=(s.convex?s.rise*ratio-arc:arc)+(ring?s.lift1:s.lift0);
    let z=(ring-.5)*s.length;
    // 窑烧边缘的小缺口限制在 1–2 mm，几何仍闭合，不挖破瓦身。
    if(!ring && s.variant===1 && (j===0||j===n)) { z+=.0016;x*=.993; }
    if(!ring && s.variant===2 && j===n) { z+=.0020;x-=.0018; }
    if(!ring && s.variant===2 && j===n-1)z+=.0007;
    if(layer) { x-=(s.convex?1:-1)*Math.sin(a)*s.thickness;y-=Math.cos(a)*s.thickness; }
    positions.push(x,y,z);uvs.push(j/n,ring);
  }
  for(let j=0;j<n;j++) {
    const a=id(0,0,j),b=id(0,0,j+1),c=id(0,1,j),d=id(0,1,j+1);
    indices.push(a,c,d,a,d,b);
    const e=id(1,0,j),f=id(1,0,j+1),g=id(1,1,j),h=id(1,1,j+1);
    indices.push(e,f,h,e,h,g);
    indices.push(a,b,f,a,f,e); // 下口可直接看见的弧形厚度。
    indices.push(c,h,d,c,g,h);
  }
  for(const j of [0,n]) {
    const a=id(0,0,j),b=id(0,1,j),c=id(1,0,j),d=id(1,1,j);
    if(j===0)indices.push(a,c,d,a,d,b);else indices.push(a,b,d,a,d,c);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
  geo.userData={kind:'closed-curved-tile',...s,triangles:indices.length/3};
  v2RoofGeometryCache.set(key,geo);return geo;
}

function v2RoofBatch(parent,name,entries,geometry,material,palette) {
  if(!entries.length)return null;
  const inst=new THREE.InstancedMesh(geometry,material,entries.length);inst.name=name;
  entries.forEach((entry,i)=>{
    inst.setMatrixAt(i,entry.matrix);
    if(palette)inst.setColorAt(i,new THREE.Color(palette[entry.color%palette.length]));
  });
  inst.castShadow=true;inst.receiveShadow=true;inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  inst.userData={kind:'physical-tile-batch',count:entries.length,tile:geometry.userData};
  parent.add(inst);return inst;
}

/** 一个平面的局部坐标：X 横过瓦垄，Y 为坡面法向，Z 从檐口指向屋脊。 */
function v2RoofTiledSlope(parent,name,{origin,uphill,normal,length,width,holes=[],seed=1,segments=4,endsVisible=true},rm) {
  const root=group(parent,name,{kind:'physical-tiled-slope',length,width,pitch:30});
  const v=new THREE.Vector3(...uphill).normalize(),n=new THREE.Vector3(...normal).normalize();
  const u=new THREE.Vector3().crossVectors(n,v).normalize(),o=new THREE.Vector3(...origin);
  const frame=new THREE.Matrix4().makeBasis(u,n,v),buckets=new Map();
  const colors=[0x5c635f,0x626964,0x69706a,0x535b57,0x72766d,0x60655f,0x646a62];
  const columnPitch=.19,tileLength=.24,columns=Math.round(width/columnPitch);
  const specs=[
    {key:'底瓦',count:columns,step:.095,offset:0,base:0,width0:.178,width1:.198,rise:.027,lift:.018,convex:false},
    {key:'盖瓦',count:columns-1,step:.075,offset:0,base:.040,width0:.145,width1:.125,rise:.040,lift:.024,convex:true},
  ];
  const intersectsHole=(centerX,start,end,maxWidth)=>{
    const pts=[];
    for(const dx of [-maxWidth/2,maxWidth/2])for(const s of [start,end])pts.push(o.clone().addScaledVector(u,centerX+dx).addScaledVector(v,s));
    const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x));
    const minZ=Math.min(...pts.map(p=>p.z)),maxZ=Math.max(...pts.map(p=>p.z));
    // 6 cm 保留量包括凸瓦法向投影；这些裁边由实体折边泛水覆盖。
    return holes.some(h=>maxX>h.x0-.06&&minX<h.x1+.06&&maxZ>h.z0-.06&&minZ<h.z1+.06);
  };
  let tileCount=0;
  for(const spec of specs)for(let col=0;col<spec.count;col++) {
    const across=(col-(spec.count-1)/2)*columnPitch;
    for(let row=0,start=-.060;start<length-.025;row++,start+=spec.step) {
      const cutLength=Math.min(tileLength,length+.022-start);
      if(cutLength<.035||intersectsHole(across,start,start+cutLength,Math.max(spec.width0,spec.width1)))continue;
      let w0=spec.width0,w1=spec.width1;
      // 上海修缮工法：普通底瓦小头朝下；唯独檐口首排底瓦大头朝下。
      if(spec.key==='底瓦'&&row===0)[w0,w1]=[w1,w0];
      const ratio=cutLength/tileLength,variant=Math.floor(v2RoofHash(seed+col,row,spec.convex?7:3)*3);
      const geo=v2RoofTileGeometry({length:cutLength,width0:w0,width1:w0+(w1-w0)*ratio,rise:spec.rise,segments,
        thickness:.006,lift0:spec.lift,lift1:spec.lift*(1-ratio),convex:spec.convex,variant});
      const center=o.clone().addScaledVector(u,across).addScaledVector(v,start+cutLength/2).addScaledVector(n,spec.base);
      // 有界微变形：最大偏航 .18°、侧倾 .07°、俯仰 .04°，不会掀瓦破坏搭接。
      const yaw=(v2RoofHash(seed+17,col,row)-.5)*.0062;
      const roll=(v2RoofHash(seed+31,row,col)-.5)*.0024;
      const pitch=(v2RoofHash(seed+47,col,row)-.5)*.0014;
      const tilt=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch,yaw,roll,'XYZ'));
      const mat=frame.clone().multiply(tilt).setPosition(center);
      const key=spec.key+'|'+geo.uuid;
      if(!buckets.has(key))buckets.set(key,{spec,geo,entries:[]});
      buckets.get(key).entries.push({matrix:mat,color:Math.floor(v2RoofHash(seed,col,row+71)*colors.length)});tileCount++;
    }
  }
  let batch=0;
  for(const {spec,geo,entries}of buckets.values())v2RoofBatch(root,`${spec.key}_${spec.convex?'凸面压缝':'凹面承水'}_实体瓦批_${++batch}`,entries,geo,rm.tile,colors);
  root.userData={...root.userData,tileCount,tileLength,bottomExposure:.095,coverExposure:.075,columnPitch,
    minimumNominalThickness:.006,bottomDirection:'小头向檐；首排例外反向',coverDirection:'大头向檐'};

  // 檐口三排以内的灰箍与垫片；不把全坡逐片描成白色格子。
  if(endsVisible) {
    const mortar=group(root,'檐口_暗灰瓦箍与垫片');
    for(let col=0;col<columns-1;col++) {
      const across=(col-(columns-2)/2)*columnPitch;
      const center=o.clone().addScaledVector(u,across).addScaledVector(v,.046).addScaledVector(n,.024);
      const pad=box(mortar,'盖瓦脚灰箍',0,0,0,.092,.036,.20,rm.mortar);
      pad.matrixAutoUpdate=false;pad.matrix.copy(frame).setPosition(center);
    }
    consolidate(mortar);
  }
  return root;
}

function v2RoofSegmentedBeam(parent,name,a,b,width,height,material,segmentLength=.49) {
  const root=group(parent,name),start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
  const delta=end.clone().sub(start),length=delta.length(),dir=delta.clone().normalize();
  const count=Math.max(1,Math.ceil(length/segmentLength));
  for(let i=0;i<count;i++) {
    const span=length/count-.003,center=start.clone().addScaledVector(dir,(i+.5)*length/count);
    const chamfer=Math.min(.008,width*.12,height*.12),hw=width/2,hh=height/2;
    const section=new THREE.Shape();section.moveTo(-hw+chamfer,-hh);section.lineTo(hw-chamfer,-hh);
    section.lineTo(hw,-hh+chamfer);section.lineTo(hw,hh-chamfer);section.lineTo(hw-chamfer,hh);
    section.lineTo(-hw+chamfer,hh);section.lineTo(-hw,hh-chamfer);section.lineTo(-hw,-hh+chamfer);section.closePath();
    const stoneGeo=new THREE.ExtrudeGeometry(section,{depth:span,bevelEnabled:false});stoneGeo.translate(0,0,-span/2);metricUV(stoneGeo,material);
    const piece=mesh(root,`分段倒角构件_${i+1}`,stoneGeo,material);
    piece.position.copy(center);piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
  }
  consolidate(root);return root;
}

function v2RoofGable(parent,side,x,zFront,zRidge,zBack,eave,ridge,rm,detail) {
  const root=group(parent,`${side}_屋顶山墙与压顶`,{kind:'gable',partyWall:true});
  const shape=new THREE.Shape();shape.moveTo(zFront,eave);shape.lineTo(zBack,eave);
  shape.lineTo(zBack,eave+.06);shape.lineTo(zRidge,ridge+.06);shape.lineTo(zFront,eave+.06);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false});geo.rotateY(-Math.PI/2);geo.translate(x+.12,0,0);metricUV(geo,rm.mortar);
  mesh(root,'山墙_连续实心灰缝基体',geo,rm.mortar);
  // 三角山墙的清水砖也是独立体块；山墙内部面仍由连续实体封闭。
  const bricks=[],rowPitch=.075,brickLength=.225,joint=.008,slope=(ridge-eave)/(zFront-zRidge),sign=x>0?1:-1;
  for(let row=0,y=eave+.0375;y<ridge+.045;row++,y+=rowPitch) {
    const halfDepth=Math.max(0,(ridge+.06-(y+.029))/slope);
    const za=Math.max(zBack,zRidge-halfDepth),zb=Math.min(zFront,zRidge+halfDepth);
    let start=za-((row%2)*brickLength/2);
    for(;start<zb;start+=brickLength) {
      const lo=Math.max(za,start+joint/2),hi=Math.min(zb,start+brickLength-joint/2);
      if(hi-lo<.025)continue;
      const mat=new THREE.Matrix4().compose(new THREE.Vector3(x+sign*.127,y,(lo+hi)/2),new THREE.Quaternion(),new THREE.Vector3(.018,.058,hi-lo));
      bricks.push({matrix:mat,color:Math.floor(v2RoofHash(row,Math.round(start*100),sign)*6)});
    }
  }
  const cubeKey='gable-brick-cube';let cube=v2RoofGeometryCache.get(cubeKey);
  if(!cube){cube=new THREE.BoxGeometry(1,1,1);v2RoofGeometryCache.set(cubeKey,cube);}
  const brickInst=v2RoofBatch(root,'山墙_逐块清水砖',bricks,cube,rm.gableBrick,[0x875841,0x80543f,0x93664d,0x77523e,0x88654d,0x7d5c47]);
  if(brickInst)brickInst.userData.kind='physical-gable-bricks';
  return root;
}

function v2RoofRidge(parent,name,{start,end,y,width=.30,rise=.075,segments=6},rm) {
  const root=group(parent,name,{kind:'physical-ridge',capHeight:rise});
  const a=new THREE.Vector3(start[0],y,start[1]),b=new THREE.Vector3(end[0],y,end[1]),v=b.clone().sub(a).normalize();
  const n=new THREE.Vector3(0,1,0),u=new THREE.Vector3().crossVectors(n,v),frame=new THREE.Matrix4().makeBasis(u,n,v);
  const total=a.distanceTo(b),buckets=new Map(),capLength=.28,step=.22;
  for(let i=0,s=0;s<total-.025;i++,s+=step) {
    const len=Math.min(capLength,total-s),fraction=len/capLength;
    const geo=v2RoofTileGeometry({length:len,width0:width,width1:width-.018*fraction,rise,thickness:.009,
      segments,lift0:.014,lift1:.014*(1-fraction),convex:true,variant:i%3});
    if(!buckets.has(geo))buckets.set(geo,[]);
    buckets.get(geo).push({matrix:frame.clone().setPosition(a.clone().addScaledVector(v,s+len/2)),color:i%5});
  }
  let number=0;for(const [geo,entries]of buckets)v2RoofBatch(root,`逐片搭接脊瓦_${++number}`,entries,geo,rm.tile,[0x5a605c,0x646a64,0x6c7068,0x555c58,0x666d66]);
  // 瓦脊下连续坐灰，末端另有堵头；不是一根封闭圆管冒充瓦脊。
  const bed=box(root,'脊下连续坐灰',0,0,0,width*.72,.090,total,rm.mortar);
  bed.matrixAutoUpdate=false;bed.matrix.copy(frame).setPosition(a.clone().addScaledVector(v,total/2).addScaledVector(n,-.012));
  for(const [index,endPoint]of [[0,a],[1,b]]) {
    const endShape=new THREE.Shape();endShape.moveTo(-width*.45,-.055);endShape.lineTo(width*.45,-.055);
    for(let i=8;i>=0;i--){const xx=(i/8-.5)*width*.9;const yy=rise*Math.sqrt(Math.max(0,1-(xx/(width*.5))**2))-.010;endShape.lineTo(xx,yy);}
    endShape.closePath();const endGeo=new THREE.ExtrudeGeometry(endShape,{depth:.018,bevelEnabled:false});metricUV(endGeo,rm.mortar);
    const closure=mesh(root,`瓦脊灰堵头_${index+1}`,endGeo,rm.mortar);
    closure.matrixAutoUpdate=false;closure.matrix.copy(frame).setPosition(endPoint.clone().addScaledVector(v,index?-.018:0));
  }
  return root;
}

function v2RoofSlopeFlash(parent,name,x0,x1,z0,z1,heightAt,material,offset=.105) {
  // 实体折边铁皮的坡面部分，厚 2 mm；跨过邻瓦后把水引到下方瓦面。
  const g=group(parent,name),a=heightAt(z0)+offset,b=heightAt(z1)+offset,t=.002;
  const positions=[x0,a,z0,x1,a,z0,x1,b,z1,x0,b,z1,x0,a-t,z0,x1,a-t,z0,x1,b-t,z1,x0,b-t,z1];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  const non=geo.toNonIndexed();non.computeVertexNormals();metricUV(non,material);mesh(g,'有厚度坡向泛水',non,material);geo.dispose();return g;
}

// 第二版：所有建筑表面由实体几何与顶点颜色组成，不创建任何图像贴图。
let v2BuildSeed=27, v2BuildDetail='hero';
function v2Hash(a,b=0,c=0){const n=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453123;return n-Math.floor(n);}
function v2NameSeed(s){let n=0;for(const c of s)n=(n*31+c.charCodeAt(0))>>>0;return n%997;}
function v2Color(hex,level=1){return new THREE.Color(hex).multiplyScalar(level);}

// 有倒角的薄砌块。正面四角有有界的缺损，背面仍完整，不会产生空洞。
function v2BlockGeometry(w=1,h=1,d=1,b=.03,seed=0){
  const x=w/2,y=h/2,z=d/2,bevel=Math.min(b,w*.13,h*.16,d*.38);
  const ring=[[-x+bevel,-y,z-bevel],[x-bevel,-y,z-bevel],[x,-y+bevel,z-bevel],[x,y-bevel,z-bevel],[x-bevel,y,z-bevel],[-x+bevel,y,z-bevel],[-x,y-bevel,z-bevel],[-x,-y+bevel,z-bevel]];
  const front=ring.map(([a,b])=>[a*(1-bevel/w*.55),b*(1-bevel/h*.35),z]);
  const rear=ring.map(([a,b])=>[a,b,-z]);const p=[];
  const tri=(a,b,c)=>p.push(...a,...b,...c);
  for(let i=0;i<8;i++){
    const j=(i+1)%8;tri([0,0,z],front[i],front[j]);tri(front[i],ring[i],ring[j]);tri(front[i],ring[j],front[j]);
    tri(ring[i],rear[i],rear[j]);tri(ring[i],rear[j],ring[j]);tri([0,0,-z],rear[j],rear[i]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();
  const col=[];for(let i=0;i<p.length;i+=3){const shade=.93+.07*v2Hash(Math.round(p[i]*35)+seed,Math.round(p[i+1]*35),Math.round(p[i+2]*11));col.push(shade,shade*.995,shade*.982);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(p.filter((_,i)=>i%3!==2),2));return g;
}

export function createShikumenMaterials(THREE,options={}){
  const material=(name,color,roughness=.86,metalness=0,extra={})=>{
    const m=new THREE.MeshStandardMaterial({name,color,roughness,metalness,...extra});m.userData={surfaceMethod:'真实几何与顶点色；无图像贴图',textureSize:[1,1]};return m;
  };
  const mats={
    redBrick:material('砖墙_旧红砖实体',0x8d5140,.96),
    greyBrick:material('砖墙_青灰砖实体',0x62635a,.98),
    mortar:material('砌筑_旧灰缝',0x777467,1),
    plaster:material('外墙_风化石灰抹面',0xc6ba9f,1),
    interiorPlaster:material('内墙_旧石灰灰泥',0xcfc5ad,.99),
    stone:material('石材_风化砂岩',0xa79e8b,.96),
    stoneDark:material('石材_旧接缝与阴影',0x756c5a,.98),
    wood:material('木构_旧深褐漆',0x493c2e,.77),
    woodDark:material('木构_凹槽及接缝',0x2b211a,.91),
    woodRaw:material('木构_磨损露木',0x806f55,.92),
    blackWood:material('木门_旧黑漆',0x272522,.61),
    woodFloor:material('楼板_旧杉木板',0x815d3c,.81),
    tile:material('瓦片_烧制青灰陶瓦',0x585954,.94),
    paving:material('石板_旧青石',0x77796d,.96),
    terracotta:material('地砖_旧红陶',0x925e43,.92),
    concrete:material('楼板_灰砂面',0x999582,.99),
    metal:material('金属_旧白铁与锈迹',0x63594a,.72,.42),
    iron:material('五金_黑铁',0x302e28,.77,.62),
    brass:material('五金_旧黄铜',0x9a783b,.48,.76),
    putty:material('窗户_旧油灰嵌缝',0xa09375,.94),
    glass:material('玻璃_旧平板玻璃',0x728b89,.30,.03,{transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide}),
    glassWarm:material('玻璃_暮色暖光玻璃',0x927b56,.32,.02,{transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,emissive:0xc78030,emissiveIntensity:.12}),
  };
  return mats;
}

// 本项目住宅各外立面统一清水红砖；室内抹面与地块外的背景建筑保持原材质。
// 只改变墙芯之外的饰层；墙芯、门窗洞、厚度、楼层与切面标高不变。
function v31WallFinish(name,spec,top,seed){
  const brickNames=/^(?:[南北]_(?:前围墙|客堂木立面|二楼前楼木立面|主屋|侧厢|厨房|亭子间|晒台)|[东西]_(?:天井围墙|主屋|后井围墙|厨房|亭子间|晒台|厢房|横墙端部接合))/;
  const finish=spec.surfaceFinish||(brickNames.test(name)?'exposed-brick':'light-plaster');
  if(!['exposed-brick','light-plaster'].includes(finish))throw new Error('未知墙饰类别：'+finish);
  const patches=[];
  // The former elliptical chip islands read as dots along the street walls.
  // Retain the continuous aged plaster and its colour variation, without
  // isolated holes or the underlying brick skins at those holes.
  const field=(u,y)=>{
    if(finish==='exposed-brick')return -1;
    let f=1;
    for(const p of patches){
      const q=((u-p.x)/p.rx)**2+((y-p.y)/p.ry)**2-1;
      if(q<1)f=Math.min(f,q+.045*Math.sin(u*25+y*33+seed)+.025*Math.sin(u*47-y*29));
    }
    return f;
  };
  return {finish,patches,field};
}

// 让小缺损中心落在网格里，避免把细小缺口量化成大块剥落或完全漏掉。
function v31WallGrid(a,b,step,patches,key,radius){
  const values=[a,b];for(let x=a+step;x<b-.00001;x+=step)values.push(x);
  for(const p of patches)for(const factor of[-1,-.5,0,.5,1]){
    const x=p[key]+p[radius]*factor;if(x>a+.00001&&x<b-.00001)values.push(x);
  }
  values.sort((x,y)=>x-y);return values.filter((x,i)=>!i||x-values[i-1]>.00001);
}

let sharedMasonryBrick;
function masonryBrickGeometry(){
  // The street and the furnished house use the same brick edge and front shading.
  // Reuse one instanced geometry; house-specific colour remains on each instance.
  return sharedMasonryBrick||(sharedMasonryBrick=v2BlockGeometry(1,1,1,.075,27));
}

function v2WallSurface(parent,name,spec,top,mats){
  const {axis='x',fixed,from,to,bottom,thickness=.24,openings=[],inside=1}=spec;
  const isBrick=spec.material===mats.redBrick||spec.material===mats.greyBrick;
  if(!isBrick){v2PaintWall(parent,name,spec,top,mats);return;}
  const signs=spec.innerMaterial?[-inside]:[-1,1];
  const seed=v2NameSeed(name.replace(/_[一二]楼/,'').replace(/^([东西])_主屋檐墙$/,'$1_主屋承重墙').replace(/_厢房檐墙$/,'_厢房承重墙'))+v2BuildSeed;
  const profile=v31WallFinish(name,spec,top,seed),field=profile.field;
  const solid=(a,b,c,d)=>!openings.some(o=>a<o.b-.0001&&b>o.a+.0001&&c<o.y1-.0001&&d>o.y0+.0001);
  const clipRects=(r)=>{
    let rs=[r];for(const o of openings){const next=[];for(const a of rs){const x0=Math.max(a[0],o.a),x1=Math.min(a[1],o.b),y0=Math.max(a[2],o.y0),y1=Math.min(a[3],o.y1);if(x1<=x0||y1<=y0){next.push(a);continue;}if(a[0]<x0)next.push([a[0],x0,a[2],a[3]]);if(x1<a[1])next.push([x1,a[1],a[2],a[3]]);if(a[2]<y0)next.push([x0,x1,a[2],y0]);if(y1<a[3])next.push([x0,x1,y1,a[3]]);}rs=next;}return rs;
  };
  const pitchX=.239,pitchY=.073, bw=.227,bh=.061;
  // At the B1 bridge ends, one solid brick turns the corner. The separate
  // face skins stop at its mortar joint instead of stacking thin edge strips.
  const bond=spec.bondedEnd;
  const bondJoint=row=>{
    const offset=(row%2)*pitchX*.5,end=bond.north?from:to;
    let joint=bond.north?(Math.floor((end-offset)/pitchX)+1)*pitchX+offset-.006:Math.floor((end-offset)/pitchX)*pitchX+offset+.006;
    if(Math.abs(joint-end)<.08)joint+=bond.north?pitchX:-pitchX;
    return joint;
  };
  if(bond){
    const g=group(parent,'木桥墙端_整砖交错包角',{bridgeCornerRepair:1});
    const mat=spec.material.clone();mat.name+='整砖包角';mat.color.set(0xffffff);mat.vertexColors=true;
    const left=fixed-thickness/2-(signs.includes(-1)?.024:0),right=fixed+thickness/2+(signs.includes(1)?.024:0);
    for(let row=Math.floor(Math.max(bottom,bond.bottom)/pitchY);row<Math.ceil(top/pitchY);row++){
      const y0=Math.max(bottom,bond.bottom,row*pitchY+.006),y1=Math.min(top,(row+1)*pitchY-.006);if(y1-y0<.001)continue;
      const joint=bondJoint(row),z0=bond.north?from-.024:joint,z1=bond.north?joint:to+.024;
      // Alternate the exposed end course between a stretcher and two headers.
      // This also gives the doorway return real vertical mortar joints instead
      // of reading as a stack of long, flat strips at eye height.
      const widths=bond.headers&&row%2?[[left,fixed-.006],[fixed+.006,right]]:[[left,right]];
      widths.forEach(([a0,a1],part)=>{
        const geo=bond.headers?masonryBrickGeometry().clone().scale(a1-a0,y1-y0,z1-z0):v2BlockGeometry(a1-a0,y1-y0,z1-z0,.002,seed+row);
        const color=v2Color(0x8e6250,.94+Math.floor(v2Hash(row,seed+part)*5)*.012),a=geo.attributes.color;
        for(let i=0;i<a.count;i++)a.setXYZ(i,a.getX(i)*color.r,a.getY(i)*color.g,a.getZ(i)*color.b);
        const q=mesh(g,'交错整砖_'+row+(bond.headers?'_'+part:''),geo,mat);q.position.set((a0+a1)/2,(y0+y1)/2,(z0+z1)/2);
      });
    }
  }
  for(const sign of signs){
    const sg=group(parent,'墙面实体饰层_'+(sign>0?'正面':'背面'),{surface:'geometric masonry',seed,finish:profile.finish,damageAnchors:profile.patches.map(p=>({...p}))});
    if(bottom<=.13){
      const plinth=group(sg,'墙脚_旧青石勒脚');
      for(let u=from;u<to;u+=.48){
        const end=Math.min(to,u+.48);
        for(const [a,b,c,d]of clipRects([u,end,Math.max(0,bottom),Math.min(top,.32)])){
          if(b-a<.025||d-c<.02)continue;
          const along=(a+b)/2,py=(c+d)/2,dd=thickness/2+.023;
          const geo=v2BlockGeometry(b-a-.007,d-c-.006,.045,.004,seed),mat=mats.greyBrick;
          const m=mesh(plinth,'勒脚分块',geo,mat);m.position.set(axis==='x'?along:fixed+sign*dd,py,axis==='x'?fixed+sign*dd:along);m.rotation.y=axis==='x'?(sign>0?0:Math.PI):(sign>0?Math.PI/2:-Math.PI/2);
        }
      }consolidate(plinth);
    }
    const transforms=[],colors=[];
    const brickBottom=Math.max(bottom,spec.exposedBrickBottom??bottom);
    const minRow=Math.floor(brickBottom/pitchY),maxRow=Math.ceil(top/pitchY);
    for(let row=minRow;row<maxRow;row++){
      const ya=Math.max(brickBottom,row*pitchY+.006),yb=Math.min(top,(row+1)*pitchY-.006);if(yb-ya<.001)continue;
      const offset=(row%2)*pitchX*.5;
      for(let col=Math.floor((from-offset)/pitchX)-1;col<=Math.ceil((to-offset)/pitchX);col++){
        const a=Math.max(from,col*pitchX+offset+.006),b=Math.min(to,(col+1)*pitchX+offset-.006);if(b-a<.018)continue;
        let skins=[[a,b,ya,yb]];
        if(bond&&yb>bond.bottom){
          const joint=bondJoint(row),aa=bond.north?Math.max(a,joint+.012):a,bb=bond.north?b:Math.min(b,joint-.012);
          if(aa>a+.000001||bb<b-.000001){
            skins=[];
            // The corner begins partway through a brick course. Preserve its
            // lower face below that height, beside and under the stone coping.
            if(ya<bond.bottom)skins.push([a,b,ya,bond.bottom]);
            if(bb-aa>=.018)skins.push([aa,bb,Math.max(ya,bond.bottom),yb]);
          }
        }
        for(const rect of skins.flatMap(clipRects)){
          const [u0,u1,y0,y1]=rect;if(u1-u0<.012||y1-y0<.001)continue;
          // 连续抹面覆盖下的砖不生成表皮；墙芯依然是有厚度的实体。
          if(profile.finish!=='exposed-brick'&&!profile.patches.some(p=>u0<p.x+p.rx*1.12&&u1>p.x-p.rx*1.12&&y0<p.y+p.ry*1.12&&y1>p.y-p.ry*1.12))continue;
          const u=(u0+u1)/2,y=(y0+y1)/2,depth=.022+.006*v2Hash(col,row,seed);
          const pos=axis==='x'?[u,y,fixed+sign*(thickness/2+depth/2-.002)]:[fixed+sign*(thickness/2+depth/2-.002),y,u];
          const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),axis==='x'?(sign>0?0:Math.PI):(sign>0?Math.PI/2:-Math.PI/2));
          const m=new THREE.Matrix4().compose(new THREE.Vector3(...pos),q,new THREE.Vector3(u1-u0,y1-y0,depth));transforms.push(m);
          const r=v2Hash(col,row,seed),wet=.95+.05*Math.min(1,Math.max(0,y-bottom)/.60);
          // 砖色差收敛在同一批旧砖的范围，不另画高反差补丁矩形。
          const c=v2Color(spec.material===mats.greyBrick?0x77796f:0x8e6250,.94+Math.floor(r*5)*.012);
          c.multiplyScalar(wet);colors.push(c);
        }
      }
    }
    if(transforms.length){
      const mat=spec.material.clone();mat.name=spec.material.name+'_顶点及实例色';mat.color.set(0xffffff);mat.vertexColors=true;
      const brickGeometry=masonryBrickGeometry();
      if(!brickGeometry.attributes.color)brickGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(brickGeometry.attributes.position.count*3).fill(1),3));
      const inst=new THREE.InstancedMesh(brickGeometry,mat,transforms.length);inst.name='逐块砌筑_共用倒角砖_真实灰缝';
      transforms.forEach((m,i)=>{inst.setMatrixAt(i,m);inst.setColorAt(i,colors[i]);});inst.castShadow=true;inst.receiveShadow=true;sg.add(inst);
    }
    if(profile.finish==='exposed-brick')continue;
    // 连续抹面只扣除有物理原因的小缺口，保留厚度侧边；不生成大范围随机孤岛。
    const pos=[],normal=[],cols=[],uv=[];
    const toP=(u,y,d)=>axis==='x'?[u,y,fixed+sign*(thickness/2+d)]:[fixed+sign*(thickness/2+d),y,u];
    const flip=axis==='x'?sign<0:sign>0;
    const emit=(a,b,c,shade=1)=>{
      if(flip)[b,c]=[c,b];const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),vc=new THREE.Vector3(...c),n=vb.sub(va).cross(vc.sub(va));
      // 洞口与剥落等值线恰好相交时可能重复一个顶点；零面积三角形不加入网格。
      if(n.lengthSq()<1e-18)return;n.normalize();
      for(const p of[a,b,c]){
        pos.push(...p);normal.push(n.x,n.y,n.z);const y=p[1],u=axis==='x'?p[0]:p[2];
        const upper=Math.max(0,(spec.top??top)-y),runoff=(.5+.5*Math.sin(u*3.1+seed*.17))**8;
        let sillDirt=0;
        for(const o of openings)if(o.y0>bottom+.27&&y<o.y0&&y>o.y0-.8){
          const edge=Math.min(Math.abs(u-o.a),Math.abs(u-o.b));
          sillDirt=Math.max(sillDirt,.018*Math.exp(-edge/.16)*Math.exp(-(o.y0-y)/.48));
        }
        const dirt=.955+.012*Math.sin(u*.73+y*.31+seed*.08)+.008*Math.sin(u*1.7-y*.92)
          -.022*Math.exp(-upper/.50)-.014*runoff*Math.exp(-upper/1.3)-.055*Math.exp(-Math.max(0,y)/.58)-sillDirt;
        const c0=v2Color(0xc2bcad,dirt*shade);cols.push(c0.r,c0.g,c0.b);uv.push(u,y);
      }
    };
    const clip=(poly,fn)=>{const out=[];for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],fa=fn(a),fb=fn(b);if(fa>=0)out.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}}return out;};
    const us=v31WallGrid(from,to,.24,profile.patches,'x','rx'),ys=v31WallGrid(bottom,top,.19,profile.patches,'y','ry');
    for(let ui=0;ui<us.length-1;ui++)for(let yi=0;yi<ys.length-1;yi++){
      const u=us[ui],x1=us[ui+1],y=ys[yi],y1=ys[yi+1];let cells=clipRects([u,x1,y,y1]);
      for(const [a,b,c,d] of cells){
        const points=[[a,c,field(a,c)],[b,c,field(b,c)],[b,d,field(b,d)],[a,d,field(a,d)]];
        for(const inds of [[0,1,2],[0,2,3]]){
          let poly=clip(inds.map(i=>points[i]),p=>p[2]);if(poly.length<3)continue;
          const front=poly.map(p=>toP(p[0],p[1],.037+.00045*Math.sin(p[0]*1.35+p[1]*.4))),back=poly.map(p=>toP(p[0],p[1],.020));
          for(let k=1;k<poly.length-1;k++)emit(front[0],front[k],front[k+1]);
          for(let k=0;k<poly.length;k++){const j=(k+1)%poly.length;if(Math.abs(poly[k][2])<.0001&&Math.abs(poly[j][2])<.0001){emit(front[k],back[k],back[j],.92);emit(front[k],back[j],front[j],.92);}}
        }
      }
    }
    if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const mat=mats.plaster.clone();mat.name='灰泥_连续旧抹面与少量实体缺口';mat.color.set(0xffffff);mat.vertexColors=true;mesh(sg,'连续石灰抹面_含局部缺口厚度边缘',g,mat);}
  }
}

// 内侧灰泥以低密度实体网格存储水渍与修补色；没有 Canvas 或图像采样。
function v2PaintWall(parent,name,spec,top,mats){
  if(top<=spec.bottom)return;
  const {axis='x',fixed,from,to,bottom,thickness=.10,openings=[]}=spec;
  const seed=v2NameSeed(name)+v2BuildSeed;
  const p=[],c=[],uv=[];
  for(const sign of(spec.paintSigns||[-1,1]))for(let a=from;a<to;a+=.28)for(let y=bottom;y<top;y+=.24){
    const b=Math.min(to,a+.28),h=Math.min(top,y+.24),u=(a+b)/2,cy=(y+h)/2;
    if(openings.some(o=>a<o.b&&b>o.a&&y<o.y1&&h>o.y0))continue;
    const v=[[a,y],[b,y],[b,h],[a,h]],make=([x,Y])=>axis==='x'?[x,Y,fixed+sign*(thickness/2+.002)]:[fixed+sign*(thickness/2+.002),Y,x];
    const order=(axis==='x'?sign<0:sign>0)?[0,2,1,0,3,2]:[0,1,2,0,2,3];
    for(const k of order){p.push(...make(v[k]));uv.push(...v[k]);const t=.91+.045*Math.sin(v[k][0]*1.5+v[k][1]*2+seed)*Math.sin(v[k][0]*2.4-v[k][1]);const dark=1-.14*Math.exp(-(v[k][1]-bottom)*3);const col=v2Color(0xcfc5ad,t*dark);c.push(col.r,col.g,col.b);}
  }
  if(p.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();const mat=mats.interiorPlaster.clone();mat.color.set(0xffffff);mat.vertexColors=true;mesh(parent,'石灰墙面_顶点色渗痕',g,mat);}
}

function v2FloorBoards(parent,name,x0,x1,z0,z1,top,mat,holes=[]){
  const mtype=mat.name.includes('杉木')?'wood':mat.name.includes('红陶')?'clay':mat.name.includes('青石')?'stone':null;
  if(!mtype||v2BuildDetail==='low'&&mtype==='wood')return;
  const wx=mtype==='wood'?.17:mtype==='clay'?.30:.57,wz=mtype==='wood'?1.42:mtype==='clay'?.30:.41;
  const transforms=[],colors=[],seed=v2NameSeed(name)+v2BuildSeed;
  for(let row=0,z=z0;z<z1-.01;z+=wz,row++)for(let col=-1;col<Math.ceil((x1-x0)/wx)+1;col++){
    const offset=mtype==='stone'?(row%2)*wx*.5:0;const a=Math.max(x0,x0+col*wx+offset),b=Math.min(x1,x0+(col+1)*wx+offset),c=z,d=Math.min(z1,z+wz);
    if(b-a<.025||d-c<.025||holes.some(o=>a<o.x1&&b>o.x0&&c<o.z1&&d>o.z0))continue;
    const h=.014+v2Hash(row,col,seed)*.003,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    transforms.push(new THREE.Matrix4().compose(new THREE.Vector3((a+b)/2,top-h/2,(c+d)/2),q,new THREE.Vector3(b-a-.008,d-c-.009,h)));
    const base=mat.color.clone(),v=.82+Math.floor(v2Hash(col,row,seed)*8)*.035;base.multiplyScalar(v);colors.push(base);
  }
  const tm=mat.clone();tm.color.set(0xffffff);tm.vertexColors=true;const geo=v2BuildDetail==='low'?new THREE.BoxGeometry(1,1,1):v2BlockGeometry(1,1,1,.035,seed);if(!geo.attributes.color)geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*3).fill(1),3));const inst=new THREE.InstancedMesh(geo,tm,transforms.length);inst.name='实铺_'+(mtype==='wood'?'杉木地板':mtype==='clay'?'红陶地砖':'青石板');transforms.forEach((t,i)=>{inst.setMatrixAt(i,t);inst.setColorAt(i,colors[i]);});inst.castShadow=true;inst.receiveShadow=true;parent.add(inst);
}

function v2FacadeCarpentry(parent,mats){
  const beam=group(parent,'前楼木立面_连贯槛框与裙板');
  for(const x of[-1.73,1.73]){
    box(beam,'旧木立柱',x,5.16,-2.49,.11,2.64,.19,mats.wood);
    box(beam,'柱脚石垫',x,3.87,-2.49,.16,.22,.23,mats.stone);
    box(beam,'柱顶叠涩',x,6.48,-2.46,.20,.12,.25,mats.wood);
  }
  for(const [y,h,d]of[[3.90,.17,.20],[4.08,.055,.24],[6.45,.11,.21],[6.59,.15,.24]])box(beam,'通长木槛',0,y,-2.48,3.60,h,d,mats.wood);
  for(let i=0;i<8;i++){
    const x=-1.55+i*.442;
    box(beam,'裙板拼缝',x,3.93,-2.365,.008,.14,.012,mats.woodDark);
    if(i%2===0)box(beam,'旧漆露木边',x+.08,4.02,-2.354,.11,.008,.006,mats.woodRaw);
  }
  consolidate(beam);return beam;
}

/** 查看器用弄堂实铺石板，与主屋GLB保持分离。 */
export function buildStreetPaving(rectangles,materials=getShikumenMaterials()){
  const g=new THREE.Group();g.name='弄堂_逐块石板与排水缝';
  const matrices=[],colors=[],wx=.38,wz=.26;
  for(const [x0,x1,z0,z1]of rectangles)for(let row=0,z=z0;z<z1-.01;z+=wz,row++){
    for(let i=-1;i<Math.ceil((x1-x0)/wx)+1;i++){
      const a=Math.max(x0,x0+i*wx+(row%2)*wx/2),b=Math.min(x1,x0+(i+1)*wx+(row%2)*wx/2),zz=Math.min(z1,z+wz);if(b-a<.02)continue;
      const r=v2Hash(i,row,11),h=.035+(r-.5)*.004;
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,(r-.5)*.012));
      matrices.push(new THREE.Matrix4().compose(new THREE.Vector3((a+b)/2,-.009,(z+zz)/2),q,new THREE.Vector3(b-a-.014,zz-z-.013,h)));
      colors.push(v2Color(r>.93?0x696b60:0x706d62,.77+Math.floor(r*7)*.045));
    }
  }
  const mat=materials.paving.clone();mat.name='弄堂_磨损石板实体';mat.color.set(0xffffff);mat.vertexColors=true;
  const inst=new THREE.InstancedMesh(v2BlockGeometry(1,1,1,.09,2),mat,matrices.length);inst.name='弄堂铺石实例';matrices.forEach((m,i)=>{inst.setMatrixAt(i,m);inst.setColorAt(i,colors[i]);});inst.receiveShadow=true;inst.castShadow=false;g.add(inst);return g;
}




// V3 architecture. Plan coordinates X, s map to Three.js X, -Z.
function v3S(parent,name,s,x0,x1,y0,y1,openings,mats,reg,opt={}){
  return wall(parent,name,{axis:'x',fixed:-s,from:x0,to:x1,bottom:y0,top:y1,thickness:opt.thickness??.24,
    material:opt.material||mats.redBrick,innerMaterial:opt.inner===false?null:mats.interiorPlaster,
    inside:opt.inside??-1,openings:openings||[],cut:opt.cut??true,surfaceFinish:opt.surfaceFinish},reg);
}
function v3X(parent,name,x,s0,s1,y0,y1,openings,mats,reg,opt={}){
  const holes=(openings||[]).map(o=>({...o,a:-o.b,b:-o.a}));
  return wall(parent,name,{axis:'z',fixed:x,from:-s1,to:-s0,bottom:y0,top:y1,thickness:opt.thickness??.24,
    material:opt.material||mats.redBrick,innerMaterial:opt.inner===false?null:mats.interiorPlaster,
    inside:opt.inside??1,openings:holes,cut:opt.cut??true,surfaceFinish:opt.surfaceFinish,bondedEnd:opt.bondedEnd},reg);
}
function v3WindowS(parent,name,s,x,y,w,h,mats,opt={}){
  const north=!!opt.north;
  const g=timberWindow(parent,name,x,y,-s+(north?-.145:.145),w,h,mats,{panels:2,residential:true,...opt,rotationY:north?Math.PI:0});
  if(!opt.fullLength){
    box(g,'石窗台_滴水挑沿',0,-.065,0,w+.16,.10,.28,mats.stone);
    box(g,'旧窗楣平线',0,h+.07,-.02,w+.15,.08,.22,mats.stone);
  }return g;
}
function v3WindowX(parent,name,x,s,y,w,h,mats,opt={}){
  const east=!!opt.east;
  const g=timberWindow(parent,name,x+(east?.145:-.145),y,-s,w,h,mats,{panels:2,residential:true,...opt,rotationY:east?Math.PI/2:-Math.PI/2});
  box(g,'石窗台_滴水挑沿',0,-.065,0,w+.14,.10,.28,mats.stone);
  box(g,'旧窗楣平线',0,h+.07,-.02,w+.15,.08,.22,mats.stone);return g;
}
function v3DoorS(parent,name,s,x,y,w,h,mats,opt={}){
  return door(parent,name,x,y,-s+(opt.north?-.03:.03),w,h,mats,{open:1.46,...opt,rotationY:opt.north?Math.PI:0});
}
function v3DoorX(parent,name,x,s,y,w,h,mats,opt={}){
  return door(parent,name,x+(opt.east?.025:-.025),y,-s,w,h,mats,{open:1.46,...opt,rotationY:opt.east?Math.PI/2:-Math.PI/2});
}
function v3CapS(g,s,x0,x1,y,m){box(g,'连续石压顶',(x0+x1)/2,y,-s,x1-x0-.006,.095,.31,m.stone);}
function v3CapX(g,x,s0,s1,y,m){box(g,'连续石压顶',x,y,-(s0+s1)/2,.31,.095,s1-s0+.006,m.stone);}

function v3AtticPartition(parent,mats,reg){
  const g=group(parent,'阁层_中隔墙与低矮通口',{kind:'wall',opening:{x:[3.84,4.02],s:[6,6.8],y:[6.7,8.55]}});
  const roof=s=>7.05+Math.min(s-3,10.74-s)*Math.tan(Math.PI/6)-.17;
  const clip=(pts,fn)=>{const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],fa=fn(a),fb=fn(b);if(fa>=0)out.push(a);if((fa>=0)!==(fb>=0)){let t=fa/(fa-fb);out.push(a.map((n,j)=>n+(b[j]-n)*t));}}return out;};
  const make=(top,name)=>{
    const p=group(g,name),bands=[3,6,6.8,6.87,10.74];
    for(let i=0;i<bands.length-1;i++){
      const a=bands[i],b=bands[i+1];
      for(const [y0,y1]of [[6.7,8.55],[8.55,9.2]]){
        if(a>=6-1e-6&&b<=6.8+1e-6&&y0<8.55)continue;
        let ps=[[a,y0],[b,y0],[b,Math.min(y1,top)],[a,Math.min(y1,top)]];
        if(y0>=Math.min(y1,top))continue;
        ps=clip(ps,v=>roof(v[0])-v[1]);if(ps.length<3)continue;
        const shape=new THREE.Shape();ps.forEach(([s,y],j)=>j?shape.lineTo(s,y):shape.moveTo(s,y));shape.closePath();
        const geo=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false,curveSegments:1});
        // Shape horizontal u=-s maps to world z; extrusion maps to world +X.
        geo.rotateY(Math.PI/2);geo.translate(3.84,0,0);
        mesh(p,'阁层实体隔墙',geo,mats.interiorPlaster);
      }
    }
    consolidate(p);return p;
  };
  const full=make(9.2,'完整墙体'),low=make(7.4,'剖切_阁层矮墙');low.visible=false;reg.cuts.push({full,low});
  // Only jambs and lintel, no closed leaf in this deliberately low storage opening.
  const fr=group(full,'阁楼低口_实木包边');
  for(const s of [6.01,6.79])box(fr,'低口木边',3.835,7.60,-s,.035,1.80,.034,mats.wood);
  box(fr,'低口上包边',3.835,8.56,-6.4,.035,.040,.84,mats.wood);consolidate(fr);
}

function v3AtticProgram(isB,interior,enabled=true){
  const hole=isB?{x:[4.02,4.98],s:[6.80,9.30]}:{x:[2.40,3.36],s:[4.08,6.72]};
  return {enabled,accessible:enabled&&interior,use:'低矮局部储藏与短时使用；非标准卧室、非完整第三层',
    elevation:6.70,mainFloor:{x:[.12,isB?7.08:3.48],s:[5.40,8.40],thickness:.16,hole},
    windowPocket:{x:[1.12,2.08],s:[5.00,5.40],elevation:6.70,handrailCentreHeight:.88,guardTop:7.616,standingPoint:[1.60,6.70,-5.30]},
    access:enabled&&interior?{from:4.00,to:6.70,risers:14,width:.82,
      start:isB?[4.49,4,-9.60]:[2.89,4,-4.08],end:isB?[4.49,6.7,-6.80]:[2.89,6.7,-6.72],
      going:isB?2.8/13:2.64/13,kind:isB?'东厢共用区独立阁梯':'前部东侧独立阁梯'}:null,
    lowOpening:isB?{x:[3.84,4.02],s:[6,6.8],height:1.85,use:'低阁储物通口'}:null,
    basis:'V3.2每户有可进入局部阁层的用户批准方案；窗由本程序采光需求配置',
    ordinaryRouteHeadroomTarget:2.0,codeCertification:false};
}

/** Complete A/B house. Architecture uses vertex colours; fitted brass rings share two PBR images. */
export function buildShikumen(options={}){
  const type=options.type||'B',isB=type==='B',width=isB?7.2:3.6,mainRight=isB?3.84:3.36,cx=(.24+mainRight)/2;
  const detail=options.detail||'hero',interior=options.interior!==false;
  const frontWingHookSide=isB&&interior&&detail==='hero'&&(options.id||'B1')==='B1'?'interior':'exterior';
  const atticProgram=v3AtticProgram(isB,interior,options.attic!==false);
  const hasDormer=atticProgram.enabled&&(options.dormer??true);
  atticProgram.daylight={type:'老虎窗',count:hasDormer?1:0,requiredByUse:atticProgram.enabled};
  const mats=options.materials||getShikumenMaterials();v2BuildSeed=options.weatherSeed??27;v2BuildDetail=detail;
  const root=new THREE.Group();root.name=options.name||`石库门_${type}_${options.number||27}号`;root.position.x=-cx;
  root.userData={kind:'shikumen',revision:3.2,units:'m',front:'+Z',up:'+Y',type,dimensions:{...SHIKUMEN_DIMENSIONS,width,clearWidth:mainRight-.24,wingClearWidth:isB?2.94:0},
    origin:'门中心位于世界x=0；几何局部x从西外墙起，z=-s',design:isB?'V3双开间单厢端户与V3.2完整阁层程序；设计估值':'V3.2单开间专用室内交通；外包沿批准方案，尺寸为设计估值',textureCount:7,
    sourcePlan:'shikumen-v3-plan/layout.json',weatherSeed:v2BuildSeed,roomProgram:'空建筑；不含家具电器盆栽',
    interiorProgram:{complete:interior,type},atticProgram,hasAccessibleAttic:atticProgram.accessible,
    dormerProgram:{enabled:!!hasDormer,reason:'本户独立阁层程序的采光构件；关窗显示不删除楼板或楼梯',neighbourInteriorIsSchematic:!interior}};
  const reg={cuts:[],levels:[],roof:null,materials:mats};registries.set(root,reg);
  const gf=group(root,'L0_一楼',{floor:'ground',elevation:.1}),half=group(root,'L1H_亭子间半层',{floor:'mezzanine',elevation:2.4});
  const f2=group(root,'L2_二楼',{floor:'second',elevation:4}),terrace=group(root,'L2H_晒台',{floor:'terrace',elevation:4.8});
  const attic=group(root,'L3_局部阁楼',{floor:'attic',elevation:6.7}),roof=group(root,'ROOF_相交小青瓦屋盖',{floor:'roof'});
  reg.levels=[gf,half,f2,terrace,attic];reg.roof=roof;
  const yard=group(gf,'前天井'),hall=group(gf,'客堂与后梯底'),rear=group(gf,'后天井'),kitchen=group(gf,'厨房'),wing=group(gf,'东侧厢房');
  slab(yard,'露天前井_青石地',.24,mainRight,-3,-.24,.025,.14,mats.paving);
  slab(hall,'客堂与后梯_地砖',.24,mainRight,-10.5,-3.24,.1,.18,mats.terracotta);
  slab(rear,'后天井_青石地',.24,mainRight,-11.94,-10.74,.025,.14,mats.paving);
  slab(rear,'后井西侧通路',.24,1.14,-12.12,-10.5,.10,.14,mats.paving);
  slab(kitchen,'厨房_地砖',.24,mainRight,-14.76,-12.12,.1,.18,mats.terracotta);
  if(isB)for(const [a,b,n]of [[.24,5.16,'前'],[5.28,10.14,'中'],[10.26,14.76,'后']])slab(wing,n+'厢_地面',4.02,6.96,-b,-a,.1,.18,mats.terracotta);

  // 三角山花贴在连续高墙上；墙顶高于山花尖，门洞仍保持原来的净空。
  // 4.95 m 是按参考照片比例适配的场景值，不是实测建筑尺寸。
  const frontWallTop=4.95,frontWallEnd=isB?4.02:width;
  // 石套内口在 ±0.725 m；砖洞须退入石套背后，不能以 ±0.72 m 留下一条露砖边。
  const gate=v3S(yard,'南_前围墙',.12,0,frontWallEnd,0,frontWallTop,[{a:cx-.735,b:cx+.735,y0:0,y1:2.82}],mats,reg,{inside:-1,inner:false});
  gate.root.userData.portalReveal={masonryHalfOpening:.735,stoneInnerEdge:.725,masonryHead:2.82,stoneLintelUnderside:2.795};
  gate.root.userData.pedimentWall={heightMetres:frontWallTop,pedimentApexMetres:4.40,continuousCoping:true};
  // 前墙独占 s=0…0.24 的转角体积，侧墙从其背面接起。
  const portalRoot=group(gate.full,'门轴与石框');portalRoot.position.set(cx,0,-.12);portal(portalRoot,mats,detail,options.number||'27');
  v3DoorS(gate.full,'石库门_双扇黑漆门',.12,cx,.15,1.36,2.60,mats,{double:true,black:true,plainExterior:true,hardware:'separate',open:options.gateOpen??0});
  box(yard,'石库门门槛',cx,.075,-.12,1.42,.15,.38,getThresholdStoneMaterial(THREE));
  v3CapS(gate.full,.12,0,frontWallEnd,frontWallTop+.03,mats);

  // Side-wall chains have stable names so shared walls can be omitted in row assemblies.
  for(const [side,x,inside,skip] of [['西',.12,1,options.partyWest],['东',width-.12,-1,options.partyEast]]){
    if(skip)continue;
    const eastWing=isB&&side==='东';
    const sg0=group(gf,`${side}_外墙`),sg2=group(f2,`${side}_外墙`),sg3=group(attic,`${side}_外墙`);
    if(eastWing){
      const os=[1.1,6.25,11.75].map(s=>({a:s,b:s+1.3,y0:1.05,y1:2.55}));
      const w0=v3X(sg0,side+'_厢房承重墙_一楼',x,.24,14.76,0,4,os,mats,reg,{inside,cut:true});
      const ou=[1.1,6.25,11.75].map(s=>({a:s,b:s+1.3,y0:5.00,y1:6.40}));
      const w2=v3X(sg2,side+'_厢房承重墙_二楼',x,.24,14.76,4,6.7,ou,mats,reg,{inside,cut:true});
      for(const [level,bottom,top]of [[w0.full,0,4],[w2.full,4,6.7]])for(const [from,to]of [[-.24,0],[-15,-14.76]])
        v2WallSurface(level,'东_侧厢转角包砖',{axis:'z',fixed:x,from,to,bottom,top,thickness:.24,material:mats.redBrick,
          innerMaterial:mats.interiorPlaster,inside,openings:[],surfaceFinish:'exposed-brick'},top,mats);
      for(const s of [1.75,6.90,12.40]){
        v3WindowX(w0.full,'东厢_临主弄木窗',x,s,1.05,1.3,1.5,mats,{east:true,open:detail==='hero'?.15:0,hookSide:frontWingHookSide});
        v3WindowX(w2.full,'东厢二层_临主弄木窗',x,s,5,1.3,1.4,mats,{east:true,hookSide:s===6.90&&frontWingHookSide==='interior'?'interior':s===1.75||s===12.40?frontWingHookSide:'exterior'});
      }
      v3X(sg3,side+'_厢房檐墙',x,.24,14.76,6.7,6.91,[],mats,reg,{inside,cut:true});
    }else{
      const cw=v3X(sg0,side+'_天井围墙',x,.24,3,0,frontWallTop,[],mats,reg,{inside,inner:false});
      // 只给前墙裸露的端面包砖，不再放第二堵重叠墙芯。
      v2WallSurface(cw.full,side+'_天井围墙端面',{axis:'z',fixed:x,from:-.24,to:0,bottom:0,top:frontWallTop,thickness:.24,
        material:mats.redBrick,innerMaterial:mats.interiorPlaster,inside,openings:[],surfaceFinish:'exposed-brick'},frontWallTop,mats);
      cw.root.userData.courtyardReturn={matchesFrontWallHeight:true,topMetres:frontWallTop,courtyardOpenToSky:true};
      // 侧墙与前高墙等高；压顶在前墙压顶后缘相接，避免转角叠面。
      v3CapX(cw.full,x,.284,3,frontWallTop+.03,mats);
      const bridgeCorner=isB&&interior&&detail==='hero'&&(options.id||'B1')==='B1'&&side==='西';
      const northBond=bridgeCorner?{north:true,bottom:3.2}:undefined,southBond=bridgeCorner?{north:false,bottom:3.2}:undefined;
      // A6 is the exposed east end of the row behind B1. Its east wall faces
      // the main lane, not a party wall. Ground hall and upper shared passage
      // get one real opening each; the upper window clears the attic stair
      // occupying s=4.08..6.72, so symmetry cannot dictate its position.
      const addSideWindows=!isB&&options.id==='A6'&&side==='东';
      const sideGround=addSideWindows?[{a:4.55,b:5.65,y0:1.10,y1:2.55}]:[];
      const sideUpper=addSideWindows?[{a:6.925,b:7.975,y0:5.0,y1:6.4}]:[];
      const mw0=v3X(sg0,side+'_主屋承重墙_一楼',x,3,10.74,0,4,sideGround,mats,reg,{inside,cut:true,bondedEnd:northBond});
      const mw2=v3X(sg2,side+'_主屋承重墙_二楼',x,3,10.74,4,6.7,sideUpper,mats,reg,{inside,cut:true,bondedEnd:northBond});
      if(addSideWindows){
        v3WindowX(mw0.full,'35号_东侧新增_客堂木窗',x,5.10,1.10,1.10,1.45,mats,{east:true,panels:2});
        v3WindowX(mw2.full,'35号_东侧新增_二楼木窗',x,7.45,5.0,1.05,1.40,mats,{east:true,panels:2});
        root.userData.neighbourSideWindows={revision:1,count:2,side:'east',reason:'临主弄的真实外墙；上窗避开s4.08..6.72阁梯',openings:[...sideGround,...sideUpper],userVisualApproved:false};
      }
      const mw3=v3X(sg3,side+'_主屋檐墙',x,3,10.74,6.7,6.91,[],mats,reg,{inside,cut:true,bondedEnd:northBond});
      const rw=v3X(sg0,side+'_后井围墙',x,10.74,11.94,0,3.2,[],mats,reg,{inside,material:mats.redBrick});v3CapX(rw.full,x,10.74,11.94,3.23,mats);
      const ks=group(gf,`${side}_外墙_厨房`),ts=group(half,`${side}_外墙_亭子间`),ps=group(terrace,`${side}_外墙_晒台`);
      const kw=v3X(ks,side+'_厨房边墙',x,11.94,15,0,2.4,[],mats,reg,{inside});
      const tw=v3X(ts,side+'_亭子间边墙',x,11.94,15,2.4,4.8,[],mats,reg,{inside,bondedEnd:southBond?{...southBond,headers:true}:undefined});
      const pp=v3X(ps,side+'_晒台栏墙',x,11.94,15,4.8,5.7,[],mats,reg,{inside,inner:false,thickness:.18,bondedEnd:southBond});v3CapX(pp.full,x,11.94,15,5.73,mats);
      // 横墙止于侧墙内皮；只给露出的厚度端面包砖，不添加重叠墙芯或封住通口。
      for(const [part,label,s,bottom,top,north,wallWidth]of[
        [mw0,'主屋后端一楼',10.74,3.2,4,true,.24],
        [mw2,'主屋后端二楼',10.74,4,6.7,true,.24],[mw3,'主屋后端檐下',10.74,6.7,6.91,true,.24],
        [mw2,'主屋前端二楼',3,frontWallTop,6.7,false,.24],[mw3,'主屋前端檐下',3,6.7,6.91,false,.24],
        [kw,'厨房后端',15,0,2.4,true,.24],[tw,'亭子间后端',15,2.4,4.8,true,.24],
        [pp,'晒台后端',15,4.8,5.7,true,.18],
        [tw,'亭子间前端',11.94,3.2,4.8,false,.24],[pp,'晒台前端',11.94,4.8,5.7,false,.18]
      ]){
        if(bridgeCorner&&(/主屋后端|亭子间前端|晒台前端/).test(label))continue;
        v2WallSurface(part.full,side+'_'+label+'_端面包砖',{
        axis:'x',fixed:-s,from:x-wallWidth/2,to:x+wallWidth/2,bottom,top,thickness:0,
        material:mats.redBrick,innerMaterial:mats.interiorPlaster,inside:north?1:-1,openings:[],surfaceFinish:'exposed-brick'
      },top,mats);
      }
    }
  }
  // Courtyard-facing main facade: long timber windows flank real central doors.
  const front=v3S(hall,'南_客堂木立面',3.12,.24,mainRight,0,4,[{a:.38,b:mainRight-.14,y0:.1,y1:3.30}],mats,reg);
  const doorW=isB?1.30:1.16, sideW=(mainRight-.38-.14-doorW)/2;
  v3DoorS(front.full,'客堂_对开木门',3.12,cx,.1,doorW,2.50,mats,{double:true});
  for(const sign of [-1,1])v3WindowS(front.full,'客堂_'+(sign<0?'西':'东')+'长窗',3.12,cx+sign*(doorW/2+sideW/2),.1,sideW-.012,3.20,mats,{panels:2,fullLength:true});
  v3WindowS(front.full,'客堂门上横披',3.12,cx,2.70,doorW,.60,mats,{panels:3,simple:true});
  box(front.full,'前檐通长木枋',cx,3.55,-2.97,mainRight-.24,.18,.22,mats.wood);
  box(front.full,'通长石门槛',cx,.12,-3.08,mainRight-.24,.09,.32,mats.stone);
  const uf=v3S(f2,'南_二楼前楼木立面',3.12,.24,mainRight,4,6.7,[{a:.42,b:mainRight-.18,y0:4.42,y1:6.40}],mats,reg);
  v3WindowS(uf.full,'前楼_四扇木窗',3.12,cx,4.42,mainRight-.60,1.98,mats,{panels:4,open:.1,hookSide:frontWingHookSide});
  for(const x of [.33,mainRight-.09])box(uf.full,'前楼木立柱',x,5.4,-2.96,.12,2.7,.20,mats.wood);
  for(const [y,h]of [[4.12,.16],[4.34,.06],[6.47,.10],[6.61,.12]])box(uf.full,'前楼通长槛',cx,y,-2.96,mainRight-.12,h,.22,mats.wood);
  v3S(attic,'南_主屋檐墙',3.12,.24,mainRight,6.7,6.91,[],mats,reg);

  // Main rear facade: three independent aligned openings for ground passage and split-level bridges.
  // B1 木桥穿过后墙；洞底让出完整 16cm 楼板厚度，墙顶不与铺板共面。
  const bridgeSeatDepth=interior?.16:0;
  // The ground passage's stone paving occupies the sill: no masonry below it.
  const rearOpen=[{a:.24,b:1.14,y0:0,y1:2.15},{a:.24,b:1.14,y0:2.4-bridgeSeatDepth,y1:4.5},{a:.24,b:1.14,y0:4.8-bridgeSeatDepth,y1:6.90},
    {a:1.75,b:Math.min(mainRight-.20,3.2),y0:1.15,y1:2.30},{a:1.75,b:Math.min(mainRight-.20,3.2),y0:5.1,y1:6.40}];
  for(const [level,a,b,title]of [[gf,0,4,'一楼'],[f2,4,6.7,'二楼'],[attic,6.7,6.91,'檐下']]){
    const rr=v3S(level,'北_主屋后墙_'+title,10.62,.24,mainRight,a,b,rearOpen,mats,reg,{inside:1,material:mats.redBrick,cut:false});
    if(title==='一楼')v3WindowS(rr.full,'后井采光窗',10.62,(1.75+Math.min(mainRight-.20,3.2))/2,1.15,Math.min(mainRight-.20,3.2)-1.75,1.15,mats,{north:true,hookSide:isB&&interior&&detail==='hero'&&(options.id||'B1')==='B1'?'interior':'exterior'});
    if(title==='二楼')v3WindowS(rr.full,'二楼后井采光窗',10.62,(1.75+Math.min(mainRight-.20,3.2))/2,5.1,Math.min(mainRight-.20,3.2)-1.75,1.3,mats,{north:true});
  }

  // Rear kitchen and tingzi form one lower block, each with real front and rear openings.
  for(const [level,base,top,title]of [[kitchen,.1,2.4,'厨房'],[half,2.4,4.8,'亭子间']]){
    const doorX=title==='厨房'?2.70:.69,doorWidth=.90;
    const win=title==='厨房'?{a:.40,b:1.60,y0:1.10,y1:2.16}:{a:1.75,b:Math.min(mainRight-.16,3.50),y0:3.16,y1:4.42};
    const fw=v3S(level,'南_'+title+'前墙',12.03,.24,mainRight,base,top,[{a:doorX-doorWidth/2,b:doorX+doorWidth/2,y0:base,y1:base+2.1},win],mats,reg,{material:mats.redBrick,thickness:.18});
    v3DoorS(fw.full,title+'_前木门',12.03,doorX,base,.90,2.10,mats,{open:1.48});
    v3WindowS(fw.full,title+'_后井木窗',12.03,(win.a+win.b)/2,win.y0,win.b-win.a,win.y1-win.y0,mats,{hookSide:frontWingHookSide,boltSide:title==='厨房'?frontWingHookSide:'exterior'});
    const backHoles=title==='厨房'?[{a:1.62,b:2.52,y0:.1,y1:2.2},{a:.45,b:1.35,y0:1.15,y1:2.15}]:[{a:.60,b:mainRight-.35,y0:3.10,y1:4.38}];
    const bw=v3S(level,'北_'+title+'后弄墙',14.88,.24,mainRight,base,top,backHoles,mats,reg,{inside:1,material:mats.redBrick,cut:false});
    if(title==='厨房'){
      v3DoorS(bw.full,'厨房_通后弄木门',14.88,2.07,.1,.9,2.1,mats,{north:true,black:true,open:.15});
      v3WindowS(bw.full,'厨房_后弄窗',14.88,.9,1.15,.9,1.0,mats,{north:true});
    }else v3WindowS(bw.full,'亭子间_后弄木窗',14.88,(.60+mainRight-.35)/2,3.10,mainRight-.95,1.28,mats,{north:true,panels:3,hookSide:frontWingHookSide});
  }
  for(const [s,n,holes]of [[12.03,'南',[{a:.24,b:1.14,y0:4.8,y1:5.8}]],[14.88,'北',[]]]){
    const pp=v3S(terrace,n+'_晒台栏墙',s,.24,mainRight,4.8,5.70,holes,mats,reg,{inner:false,thickness:.18,inside:n==='北'?1:-1});
    if(n==='南')v3CapS(pp.full,s,1.14,mainRight,5.73,mats);else v3CapS(pp.full,s,.24,mainRight,5.73,mats);
  }
  const dry=group(terrace,'固定晾衣杆');
  for(const x of [.75,mainRight-.45])rod(dry,'晾衣杆_立柱',[x,4.8,-14.2],[x,6.63,-14.2],.026,mats.metal,8);
  rod(dry,'晾衣杆_横杆',[.65,6.63,-14.2],[mainRight-.35,6.63,-14.2],.026,mats.metal,8);consolidate(dry);

  if(isB){
    // Front and rear wing facades.
    for(const [level,y0,y1,title]of [[wing,0,4,'一层'],[f2,4,6.7,'二层']]){
      for(const [s,n,north]of [[.12,'南',false],[14.88,'北',true]]){
        const low=y0===0,holes=y0<6.7?[{a:4.55,b:6.35,y0:low?1.05:5.0,y1:low?2.55:6.4}]:[];
        const ww=v3S(level,`${n}_侧厢${title}外墙`,s,4.02,7.2,y0,y1,holes,mats,reg,{inside:north?1:-1,cut:!north});
        if(y0<6.7)v3WindowS(ww.full,`${n}_厢房${title}木窗`,s,5.45,low?1.05:5.0,1.80,low?1.5:1.4,mats,{north,panels:3,hookSide:frontWingHookSide});
      }
    }
    // 横向收口的西侧厚度面同样露天；沿中隔墙砖网格续铺，墙芯及室内部分保持不变。
    const westReturn=(part,name,from,to,bottom,top)=>{
      for(const [parent,h]of[[part.full,top],[part.low,Math.min(top,bottom+1)]]){
        if(!parent||h<=bottom)continue;
        const finish=group(parent,name,{kind:'exterior-endcap-brick',axis:'z',fixed:3.84,from,to,bottom,top:h});
        v2WallSurface(finish,'中隔墙_露天一侧红砖饰层',{axis:'z',fixed:3.84,from,to,bottom,top:h,thickness:0,
          material:mats.redBrick,innerMaterial:mats.interiorPlaster,inside:1,openings:[],surfaceFinish:'exposed-brick'},h,mats);
      }
    };
    const frontEnd=v3S(f2,'南_侧厢西端收口',.12,3.84,4.02,frontWallTop,6.91,[],mats,reg,{inner:false,surfaceFinish:'exposed-brick'});
    westReturn(frontEnd,'南_侧厢西端_转角包砖',-.24,0,frontWallTop,6.91);
    for(const [level,a,b]of[[wing,0,4],[f2,4,6.7],[attic,6.7,6.91]]){
      const backEnd=v3S(level,'北_侧厢西端收口',14.88,3.84,4.02,a,b,[],mats,reg,{inner:false,cut:false});
      if(b>4.8)westReturn(backEnd,'北_侧厢西端_转角包砖',-15,-14.76,Math.max(a,4.8),b);
    }
    // Middle spine: openings are explicitly different on GF and 2F.
    // Doorways continue through the wall base; plaster must not cover their sills.
    const gfHoles=[{a:.85,b:2.20,y0:1.05,y1:2.55},{a:3.80,b:4.65,y0:0,y1:2.25},{a:6.75,b:7.60,y0:0,y1:2.25},{a:10.88,b:11.72,y0:0,y1:2.25}];
    const ugHoles=[{a:.85,b:2.20,y0:5.00,y1:6.40},{a:3.80,b:4.65,y0:4,y1:6.1},{a:9.65,b:10.50,y0:4,y1:6.1},{a:10.95,b:11.80,y0:5.1,y1:6.40}];
    // 二楼婚房与共用廊门口的一楼墙顶让出木楼板厚度，避免与门口铺板共面。
    if(bridgeSeatDepth)for(const[a,b]of[[3.80,4.65],[9.65,10.50]])gfHoles.push({a,b,y0:4-bridgeSeatDepth,y1:4});
    const spine=v3X(wing,'中隔墙_一楼',3.93,.24,14.76,0,4,gfHoles,mats,reg,{thickness:.18,material:mats.interiorPlaster,inner:false,inside:1});
    const spine2=v3X(f2,'中隔墙_二楼',3.93,.24,14.76,4,6.7,ugHoles,mats,reg,{thickness:.18,material:mats.interiorPlaster,inner:false,inside:1});
    // 同一中隔墙的西侧只有天井及晒台段露天；用薄砂浆底层与实体砖覆盖这些外表面。
    for(const [level,sa,sb,lo,hi,holes]of[
      [wing,.24,3,0,4,gfHoles],[wing,10.74,11.94,0,4,gfHoles],
      [f2,.24,3,4,6.7,ugHoles],[f2,10.74,11.94,4,6.7,ugHoles],[f2,11.94,14.76,4.8,6.7,ugHoles],
      [attic,.24,3,6.7,6.91,[]],[attic,10.74,14.76,6.7,6.91,[]]
    ]){
      const clippedHoles=holes.filter(o=>o.a<sb&&o.b>sa&&o.y0<hi&&o.y1>lo)
        .map(o=>({a:Math.max(sa,o.a),b:Math.min(sb,o.b),y0:Math.max(lo,o.y0),y1:Math.min(hi,o.y1)}));
      v3X(level,'中隔墙_露天一侧红砖饰层',3.836,sa,sb,lo,hi,clippedHoles,mats,reg,
        {thickness:.004,material:mats.redBrick,inside:1,surfaceFinish:'exposed-brick'});
    }
    v3WindowX(spine.full,'前厢_朝前天井木窗',3.93,1.525,1.05,1.35,1.50,mats,{hookSide:frontWingHookSide});
    v3WindowX(spine2.full,'前厢二层_朝天井木窗',3.93,1.525,5,1.35,1.4,mats,{hookSide:frontWingHookSide});
    v3WindowX(spine2.full,'后厢_后天井高窗',3.93,11.375,5.1,.85,1.30,mats,{hookSide:frontWingHookSide});
    for(const [s,w,n]of [[4.225,.85,'前厢'],[7.175,.85,'中厢'],[11.30,.84,'后厢']])v3DoorX(spine.full,n+'_木门',3.93,s,.1,w,2.15,mats);
    for(const [s,w,n]of [[4.225,.85,'前厢'],[7.175,.85,'中厢']]){
      const sill=box(wing,n+'_青石门槛',3.93,.05,-s,.18,.10,w,getThresholdStoneMaterial(THREE)),tint=new THREE.Color(0x68766f),colors=new Float32Array(sill.geometry.attributes.position.count*3);
      for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);
      sill.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));sill.material.vertexColors=true;
    }
    v3DoorX(spine2.full,'前厢二层_木门',3.93,4.225,4,.85,2.1,mats);
    // Corridor doorway remains a framed opening; no leaf sweeps across the attic stair landing.
    const cg=group(spine2.full,'共用廊_开口木包边');
    for(const s of [9.65,10.5])box(cg,'通口立木',3.835,5.06,-s,.06,2.12,.055,mats.wood);
    box(cg,'通口上木枋',3.835,6.14,-10.075,.06,.075,.905,mats.wood);consolidate(cg);
    // Wing room partitions. Upper rear wall moves north to free the attic stair access.
    for(const s of [5.22,10.20])v3S(wing,'厢房_一楼分隔',s,4.02,6.96,.1,4,[],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
    v3S(f2,'前厢_二楼分隔',5.22,4.02,6.96,4,6.7,[],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
    const rearWingWall=v3S(f2,'后厢_二楼北移分隔',10.71,4.02,6.96,4,6.7,[{a:5.70,b:6.55,y0:4,y1:6.1}],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
    v3DoorS(rearWingWall.full,'后厢二层_共用廊门',10.71,6.125,4,.85,2.1,mats);
    // Ground hall-to-stair two openings: western under-platform passage, eastern stair entry.
    if(interior){
      const hw=v3S(hall,'客堂后隔墙_双通口',7.80,.24,3.84,.1,4,[{a:.24,b:1.14,y0:.1,y1:2.15},{a:2.94,b:3.84,y0:.1,y1:2.40}],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
      for(const [x,hh]of [[.69,2.05],[3.39,2.25]]){
        const g=group(hw.full,'后隔扇通口木边');box(g,'门楣',x,.1+hh+.025,-7.72,.94,.065,.11,mats.wood);
      }
      const frontRoom=v3S(f2,'前楼_后期轻分隔',6.36,.24,3.84,4,6.7,[{a:2.94,b:3.84,y0:4,y1:6.1}],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
      v3DoorS(frontRoom.full,'前楼_门',6.36,3.39,4,.9,2.1,mats,{open:1.50});
      const backRoom=v3X(f2,'后楼小间_轻隔墙',2.88,6.42,8.50,4,6.7,[{a:7.05,b:7.87,y0:4,y1:6.1}],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
      v3DoorX(backRoom.full,'后楼小间_木门',2.88,7.46,4,.82,2.1,mats,{east:true,open:1.50});
      v3S(f2,'后楼小间_北隔墙',8.44,.24,2.82,4,6.7,[],mats,reg,{thickness:.12,material:mats.interiorPlaster,inner:false});
      if(atticProgram.enabled)v3AtticPartition(attic,mats,reg);
    }
    // The taller wing spine outside the main roof retains solid eave walls.
    for(const [sa,sb]of [[.24,3],[10.74,14.76]])v3X(attic,'厢房_内侧檐墙',3.93,sa,sb,6.7,6.91,[],mats,reg,{thickness:.18,material:mats.interiorPlaster,inner:false});
  }

  if(!isB&&interior){
    // Dedicated A core: the west doorway feeds the first northbound flight;
    // the middle doorway is the level route beneath the return to the rear well.
    // The second floor remains a shared open front room, so attic access never
    // requires walking through an invented private bedroom.
    const aHall=v3S(hall,'A客堂后隔墙_主梯与地面双通口',6.74,.24,3.36,.1,4,
      [{a:.24,b:1.14,y0:.1,y1:2.40},{a:1.25,b:2.15,y0:.1,y1:2.40}],mats,reg,
      {thickness:.12,material:mats.interiorPlaster,inner:false});
    for(const x of[.69,1.70])box(aHall.full,'A后通口_实木门楣',x,2.425,-6.66,.94,.065,.11,mats.wood);
  }

  if(interior)v3BuildInterior(root,{gf,half,f2,terrace,attic},mats,reg);
  else{
    slab(f2,'代理_二楼主屋板',.24,mainRight,-10.5,-3.24,4,.16,mats.woodFloor);
    if(isB)slab(f2,'代理_二楼厢房板',4.02,6.96,-14.76,-.24,4,.16,mats.woodFloor);
    slab(half,'代理_亭子间楼板',.24,mainRight,-14.76,-12.12,2.4,.16,mats.woodFloor);
    slab(terrace,'代理_晒台楼板',.12,mainRight+.12,-14.88,-12.03,4.8,.18,mats.concrete);
    if(atticProgram.enabled){
      slab(attic,'外观代理_独立程序局部阁板_未配置交通',.24,isB?6.96:mainRight,-8.4,-5.4,6.7,.16,mats.woodFloor);
      v3i_atticWindowPocket(attic,mats);
    }
  }
  // A shared wall belongs to one adjacent parcel. Extend the other parcel's
  // transverse ends and floor edges across its omitted 0.24 m wall strip.
  for(const [side,skip,x0,x1]of [['西',options.partyWest,0,.24],['东',options.partyEast,width-.24,width]]){
    if(!skip)continue;
    const eastWing=isB&&side==='东',edge=group(gf,side+'_共墙接合边带');
    for(const [a,b,h]of (eastWing?[[.24,14.76,.1]]:[[.24,3,.025],[3,10.74,.1],[10.74,11.94,.025],[11.94,14.76,.1]]))slab(edge,'共墙边带地坪',x0,x1,-b,-a,h,.15,mats.terracotta);
    slab(f2,'共墙边带二楼板',x0,x1,-(eastWing?14.76:10.74),-(eastWing?.24:3),4,.16,mats.woodFloor);
    if(atticProgram.enabled&&!interior&&!eastWing)slab(attic,'共墙边带局部阁板',x0,x1,-8.4,-5.4,6.7,.16,mats.woodFloor);
    if(!eastWing){slab(half,'共墙边带亭子板',x0,x1,-14.76,-12.12,2.4,.16,mats.woodFloor);slab(terrace,'共墙边带晒台板',x0,x1,-14.88,-12.03,4.8,.18,mats.concrete);}
    const spans=eastWing?[[14.88,6.7],[5.22,6.7],[10.20,4]]:[[3.12,6.91],[10.62,6.91],[12.03,5.7],[14.88,5.7]];
    for(const [s,top]of spans)for(const [lev,a,b]of [[gf,0,4],[f2,4,6.7],[attic,6.7,7.05]]){
      if(a>=top)continue;
      v3S(lev,side+'_横墙端部接合',s,x0,x1,a,Math.min(b,top),[],mats,reg,{inner:false,cut:true});
    }
  }
  v3BuildRoof(roof,mats,detail,reg,{type,width,partyWest:options.partyWest,partyEast:options.partyEast,dormer:hasDormer,exposedBrick:true,rearCourtyard:isB&&interior&&detail==='hero'&&(options.id||'B1')==='B1'});
  // Rainwater pipes are split per floor, so section cuts never leave a full floating pipe.
  for(const [lev,a,b]of [[gf,.07,4],[f2,4,6.7],[attic,6.7,6.96]]){
    const pp=group(lev,'前檐_分层雨水管');drainage(pp,'前天井落水',mainRight-.04,-2.89,a,b,mats,{top:false,bottom:a<.1});reg.cuts.push({full:pp,low:null});
    if(isB&&!options.partyEast&&a<6.7){const ep=group(lev,'东厢_分层雨水管');drainage(ep,'东侧檐口落水',7.27,-.42,a,Math.min(b,6.54),mats,{top:false,bottom:a<.1});reg.cuts.push({full:ep,low:null});}
  }
  if(isB&&!options.partyEast){
    const hp=group(attic,'东侧檐沟_白铁皮接水斗与短接管',{kind:'rainwater-hopper-assembly'});
    const hopper=createRainwaterHopper(THREE);hopper.rotation.y=Math.PI/2;hopper.position.set(7.245,6.65,-.42);hp.add(hopper);
    for(const z of[-.53,-.31])box(hp,'雨水斗_后背安装垫块',7.235,6.88,z,.026,.030,.024,mats.metal);
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(7.27,6.52,-.42),new THREE.Vector3(7.27,6.56,-.42),new THREE.Vector3(7.325,6.62,-.42),new THREE.Vector3(7.325,6.672,-.42)]);
    const connector=mesh(hp,'雨水斗下口_开口偏移短接管',new THREE.TubeGeometry(path,16,.037,12,false),mats.metal);
    connector.userData={kind:'hopper-outlet-connector',openEnds:true,lower:[7.27,6.52,-.42],upper:[7.325,6.672,-.42],radiusMetres:.037};
    hp.userData.installation={hopperBottom:6.65,wallClearanceNominal:.018,gutterGapZ:[-.52,-.32],gutterOutletX:7.265,gutterOutletY:6.93,outletCentre:[7.325,6.65,-.42]};
    reg.cuts.push({full:hp,low:null});
  }
  for(const [lev,a,b]of [[gf,.08,2.4],[half,2.4,4.72]])drainage(lev,'后附屋_落水管',mainRight-.04,-15.11,a,b,mats,{top:b>4,bottom:a<.1});
  const drain=group(yard,'前天井线性排水');box(drain,'铁沟盖',cx,.035,-.58,mainRight-.42,.018,.14,mats.metal);
  for(let x=.35;x<mainRight-.1;x+=.15)box(drain,'沟盖间隙',x,.046,-.58,.014,.01,.14,mats.stoneDark);consolidate(drain);
  box(rear,'后井地漏',mainRight-.45,.034,-11.32,.28,.025,.28,mats.metal);
  root.userData.rooms=v3Rooms(isB,mainRight,{interior,atticProgram});
  root.userData.planSummary={outer:[width,15],mainCourtyard:[mainRight-.24,2.76],rearOpenWell:[mainRight-1.14,1.2],sideWing:isB,fullThirdStorey:false};
  root.userData.sharedSides={west:!!options.partyWest,east:!!options.partyEast};
  if(options.id==='A5'||options.id==='A8'){
    const plant=createCourtyardPlant(THREE,{id:options.id+'-yard',owner:options.id,source:'CY01',
      height:options.id==='A5'?.58:.62,width:options.id==='A5'?.40:.43,angle:options.id==='A5'?1.05:-1.2});
    plant.position.set(.60,.025,-2.40);yard.add(plant);
  }
  if(isB&&interior&&detail==='hero'&&(options.id||'B1')==='B1'&&!options.deferAssets){installApprovedKitchen(THREE,root);installHall(THREE,root);installCourtyard(THREE,root);installRearCourtyard(THREE,root);installFrontWing(THREE,root);installRearWing(THREE,root);installMiddleWing(THREE,root);installTingzi(THREE,root);installStairwell(THREE,root);installMarital(THREE,root);installLounge(THREE,root);installUpperPanelDoors(THREE,root);installStorage(THREE,root);installChildRoom(THREE,root);installTerrace(THREE,root);installStairwellProps(THREE,root);installAtticRoom(THREE,root);installHouseLighting(THREE,root);installHouseCurtains(THREE,root);installWallDecor(THREE,root);installBambooSeating(THREE,root);installKitchenSnack(THREE,root);installKitchenCondiments(THREE,root);installKitchenWash(THREE,root);installAtticStorage(THREE,root);installHallRearrange(THREE,root);installMiddleWingFan(THREE,root);installLaceCloths(THREE,root);installBedding(THREE,root);installMaritalCombo(THREE,root);installElderWardrobe(THREE,root);installWardrobeClothes(THREE,root);installRoomFinishing(THREE,root);installHallTvClock(THREE,root);installTvScreens(THREE,root);installSmallParts(THREE,root);installCollectionProps(THREE,root);installHouseServices(THREE,root);installHouseSkirting(THREE,root);installHouseDoorHandles(THREE,root);installHouseDoorBolts(THREE,root);}
  // A shared material may gain vertexColours when another component is merged.
  // Supply a neutral per-vertex factor on every remaining uncoloured mesh.
  root.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o.geometry.attributes.color)return;
    const list=Array.isArray(o.material)?o.material:[o.material];if(!list.some(m=>m.vertexColors))return;
    const geometry=o.geometry.clone();geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));o.geometry=geometry;
  });
  setShikumenView(root,{floors:'all',roof:true,cut:false,doorsOpen:false});
  if(options.interior!==false&&!options.deferAssets)v3NeighbourJoints(root,{hero:options.type!=='A'&&(options.detail||'hero')==='hero'&&(options.id||'B1')==='B1'});
  // Finish the corridor after joint trimming so unrelated wall masks stay exact.
  if(!options.deferAssets)finishSharedCorridor(THREE,root);
  if(/^A[1236]$/.test(options.id||''))installNeighbourWindowCurtains(root,options.id,mats);
  installNeighbourLife(THREE,root,options.id);nb3_completeVertexColors(root);
  return root;
}

function v3Rooms(isB,r,{interior,atticProgram}){
  const room=(name,floor,x0,x1,s0,s1,y0,y1,extra={})=>({name,floor,bounds:[[x0,y0,-s1],[x1,y1,-s0]],
    clearSize:[x1-x0,s1-s0],evidence:'V3/V3.2设计估值；包围范围不含梯孔净面积计算',...extra});
  const out=[room('前天井',0,.24,r,.24,3,.025,3.2),room('客堂',0,.24,r,3.24,isB?7.74:6.68,.1,3.8),
    room('后天井',0,1.14,r,10.74,11.94,.025,8),room('厨房',0,.24,r,12.12,14.76,.1,2.24),
    room('亭子间',1,.24,r,12.12,14.76,2.4,4.62,{accessible:interior}),
    room('晒台',2,.24,r,12.12,14.76,4.8,5.8,{accessible:interior})];
  if(isB){
    out.push(room('前楼',2,.24,r,3.24,6.30,4,6.55,{accessible:interior}),
      room('前厢',0,4.02,6.96,.24,5.16,.1,3.8),room('中厢',0,4.02,6.96,5.28,10.14,.1,3.8),
      room('后厢',0,4.02,6.96,10.26,14.76,.1,3.8),room('前厢二层',2,4.02,6.96,.24,5.16,4,6.7,{accessible:interior}),
      room(atticProgram.enabled?'共用上阁间':'二楼共用区',2,4.95,6.96,5.28,9.6,4,6.7,{accessible:interior}),
      room('后厢二层',2,4.02,6.96,10.77,14.76,4,6.7,{accessible:interior}));
  }else{
    out.push(room(atticProgram.enabled?'A二楼_共享前楼与阁梯起步区':'A二楼_共享前楼',2,.24,3.36,3.24,7.87,4,6.7,
      {accessible:interior,use:'前楼共用起居及交通；不标成独立私密卧室',stairsOccupy:atticProgram.accessible?{x:[2.48,3.30],s:[4.08,6.72]}:null}));
  }
  if(atticProgram.enabled)out.push(room('局部储藏阁层',3,.24,isB?6.96:r,5.4,8.4,6.7,9.0,
    {accessible:atticProgram.accessible,use:atticProgram.use,fullThirdStorey:false,habitableBedroom:false,
      floorHole:atticProgram.mainFloor.hole,windowPocket:atticProgram.windowPocket,lowOpening:atticProgram.lowOpening,
      roofLimitsHeight:true,access:atticProgram.access}));
  return out;
}

export function setShikumenView(root,state={}){
  const reg=registries.get(root);if(!reg)return;
  const v={floors:'all',roof:true,cut:false,doorsOpen:false,windowsOpen:false,...root.userData.view,...state};
  if(!['ground','mezzanine','second','attic','all'].includes(v.floors))throw new Error('Invalid floor mode');
  if(v.floors==='mezzanine'){
    reg.levels.forEach((level,i)=>level.visible=i===1);reg.roof.visible=false;
  }else if(v.floors==='attic'){
    // Keep the real attic stair and its +4.00 landing with the attic floor.
    // Dormer-only roof visibility is a viewer concern, not a second state path.
    reg.levels.forEach((level,i)=>level.visible=i===2||i===4);reg.roof.visible=false;
  }else{
    reg.levels[0].visible=true;
    for(let i=1;i<4;i++)reg.levels[i].visible=v.floors!=='ground';
    reg.levels[4].visible=v.floors==='all';reg.roof.visible=v.roof&&v.floors==='all';
  }
  setHouseLightingRoof(THREE,root,reg.roof.visible);
  for(const entry of reg.cuts){entry.full.visible=!v.cut;if(entry.low)entry.low.visible=v.cut;}
  root.traverse(o=>{if(o.userData.kind==='door_leaf'){
    if(o.userData.restOpening===undefined)o.userData.restOpening=o.rotation.y;
    o.rotation.y=v.doorsOpen?(o.userData.hinge==='right'?-1:1)*1.50:o.userData.restOpening;
  }});
  root.traverse(o=>{if(o.userData.windowRevision==='20261108')setWindowOpening(o,!!v.windowsOpen);});
  updateHouseDoorHandles(root);updateHouseDoorBolts(root);
  updateApprovedKitchen(root,!!v.windowsOpen);
  setAtticCabinetOpening(root,v.cabinetOpen?90:0);setChildRoomCabinetOpening(root,v.cabinetOpen?90:0);setStorageChestOpening(root,v.cabinetOpen?90:0);setLoungeCabinetOpening(root,v.cabinetOpen?90:0);setMaritalCabinetOpening(root,v.cabinetOpen?90:0);setTingziCabinetOpening(root,v.cabinetOpen?90:0);setMiddleWingCabinetOpening(root,v.cabinetOpen?90:0);setRearWingChestOpening(root,v.cabinetOpen?95:0);setFrontWingCabinetOpening(root,v.cabinetOpen?90:0);setHallCabinetOpening(root,v.cabinetOpen?90:0);
  setAtticStorageOpening(root,v);
  root.userData.view={...v};root.updateMatrixWorld(true);
}

// 屋脊是否接邻户与共墙归属独立；单户保留两端，街坊只隐藏内部堵头。
export function refreshHouseDoorHandles(root){updateHouseDoorHandles(root);updateHouseDoorBolts(root);}

export function setShikumenRoofJoins(root,{west=false,east=false}={}){
  root.traverse(o=>{if(o.name!=='主屋横向正脊_逐片搭接弧脊瓦')return;
    const a=o.getObjectByName('瓦脊灰堵头_1'),b=o.getObjectByName('瓦脊灰堵头_2');
    if(a)a.visible=!west;if(b)b.visible=!east;
  });
  // A shared, continuous roof has no exposed rake here. Include the saved attic
  // copy, whose original flashing survives as a named group without the role tag.
  root.traverse(edge=>{
    const joined=edge.name==='西_屋面边部'?west:edge.name==='东_屋面边部'?east:null;
    if(joined===null)return;
    edge.traverse(o=>{
      if(o.userData.v3RoofRole==='rake-flashing'||/^分坡实体侧边泛水/.test(o.name)){
        o.visible=!joined;o.userData.internalRoofRakeHidden=joined;
      }
    });
  });
  root.userData.roofJoins={west,east};
}


/* V3 横向木梯、错层桥与真实开孔楼板。
 * 方案坐标 X 向东、s 向北；Three 坐标为 [X,h,-s]。
 * 只依赖 THREE 与主文件已有 group/box/rod/slab/railing/consolidate。
 * 不创建墙、门窗、地坪或晒台栏墙；所有材质来自无贴图实材质表。
 */

function v3i_mesh(parent,name,geometry,material,data={}) {
  if (!geometry.attributes.uv) {
    const p=geometry.attributes.position,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){uv[2*i]=p.getX(i);uv[2*i+1]=-p.getZ(i);}
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  const m=new THREE.Mesh(geometry,material);m.name=name;m.userData=data;
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}

function v3i_prism(parent,name,points,top,thickness,material) {
  const sh=new THREE.Shape();
  points.forEach(([x,s],i)=>i?sh.lineTo(x,s):sh.moveTo(x,s));sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});
  geo.rotateX(-Math.PI/2);geo.translate(0,top-thickness,0);
  return v3i_mesh(parent,name,geo,material,{kind:'solid-winder-tread',top,thickness});
}

function v3i_beam(parent,name,a,b,width,depth,material) {
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),dv=vb.clone().sub(va);
  if(dv.length()<.0001)return null;
  const geo=new THREE.BoxGeometry(width,dv.length(),depth);
  const m=v3i_mesh(parent,name,geo,material);m.position.copy(va).add(vb).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dv.normalize());return m;
}

function v3i_riser(parent,name,a,b,height,thickness,material) {
  // a/b 的 Y 为竖板中心；水平法向决定板厚，不能把踢板随梯宽轴滚转成平板。
  const dx=b[0]-a[0],ds=-b[2]+a[2],len=Math.hypot(dx,ds),nx=-ds/len,nS=dx/len;
  const h=thickness/2,points=[
    [a[0]+nx*h,-a[2]+nS*h],[b[0]+nx*h,-b[2]+nS*h],
    [b[0]-nx*h,-b[2]-nS*h],[a[0]-nx*h,-a[2]-nS*h]
  ];return v3i_prism(parent,name,points,a[1]+height/2,height,material);
}

// 护栏只沿梯侧；不在梯口或桥门口横拉栏杆。
function v3i_slopeRail(parent,name,points,mats,height=.90) {
  const g=group(parent,name,{kind:'stair-side-guard',height});
  points.forEach((p,i)=>{
    rod(g,'木栏杆立柱',p,[p[0],p[1]+height,p[2]],i===0||i===points.length-1?.024:.014,mats.wood,6);
    if(i) {
      const a=points[i-1];
      rod(g,'连续木扶手',[a[0],a[1]+height,a[2]],[p[0],p[1]+height,p[2]],.030,mats.wood,8);
      rod(g,'梯侧下横档',[a[0],a[1]+.14,a[2]],[p[0],p[1]+.14,p[2]],.018,mats.woodDark||mats.wood,6);
    }
  });consolidate(g);return g;
}

// xy 为平面 [X,s]；末个踢面可落在上平台，亦可连接另一个转折梯段。
function v3i_flight(parent,name,{start,end,bottom,top,risers,width=.88,treads=risers-1},mats,records) {
  const g=group(parent,name,{kind:'stair-flight',start:[start[0],bottom,-start[1]],end:[end[0],top,-end[1]],risers,treads,width});
  const dx=end[0]-start[0],ds=end[1]-start[1],len=Math.hypot(dx,ds),ux=dx/len,us=ds/len;
  const px=-us,ps=ux,going=len/treads,rise=(top-bottom)/risers,T=.044;
  g.userData.going=going;g.userData.rise=rise;g.userData.slopeDegrees=Math.atan2(rise,going)*180/Math.PI;
  const local=(u,v,h)=>[start[0]+ux*u+px*v,h,-(start[1]+us*u+ps*v)];
  const treadMat=mats.woodFloor||mats.wood,dark=mats.woodDark||mats.wood;
  for(let i=0;i<treads;i++) {
    const y=bottom+(i+1)*rise,u0=i*going,u1=(i+1)*going;
    const pts=[[u0-.012,-width/2],[u1,-width/2],[u1,width/2],[u0-.012,width/2]].map(([u,v])=>[start[0]+ux*u+px*v,start[1]+us*u+ps*v]);
    v3i_prism(g,`杉木踏板_${i+1}`,pts,y,T,treadMat);
    const a=local(u0,-width/2,y-rise/2),b=local(u0,width/2,y-rise/2);
    v3i_riser(g,`实木踢板_${i+1}`,a,b,rise,.024,dark);
    const na=local(u0-.013,-width/2,y-.010),nb=local(u0-.013,width/2,y-.010);
    rod(g,'磨圆木踏鼻',na,nb,.012,mats.woodRaw||mats.wood,6);
    records.push({name:`${name}/踏步${i+1}`,foot:local((u0+u1)/2,0,y),kind:'tread',required:2.0});
  }
  // 平台是最后一个踢面；其后不再伸一块悬浮踏板。
  if(treads===risers-1) {
    const a=local(len,-width/2,top-rise/2),b=local(len,width/2,top-rise/2);
    v3i_riser(g,'上平台最后踢板',a,b,rise,.024,dark);
  }
  for(const sign of[-1,1]) {
    const v=sign*(width/2-.045);
    const a=local(0,v,bottom+.03),b=local(len,v,top-.11);
    v3i_beam(g,'连续实木梯梁',a,b,.075,.15,dark);
    const rails=[];
    rails.push(local(0,sign*(width/2-.018),bottom));
    for(let i=0;i<treads;i++)rails.push(local((i+.5)*going,sign*(width/2-.018),bottom+(i+1)*rise));
    rails.push(local(len,sign*(width/2-.018),top));
    v3i_slopeRail(g,sign<0?'梯侧木扶手_左':'梯侧木扶手_右',rails,mats);
  }
  consolidate(g);return g;
}

function v3i_winders(parent,mats,records) {
  // 东南侧三块 30° 扇步，转向由北行改为西行。不是弧形贴面。
  const g=group(parent,'主梯_三块实木转角扇步',{kind:'winder-stair',count:3,turnCentreXZ:[2.96,8.50],walkRadius:.60});
  const cx=2.96,cs=8.50,w=.88,rise=2.30/12,base=.10+3*rise;
  const edge=t=>{const c=Math.cos(t),s=Math.sin(t),r=w/Math.max(c,s);return[cx+r*c,cs+r*s];};
  for(let k=0;k<3;k++) {
    const a=k*Math.PI/6,b=(k+1)*Math.PI/6,pa=edge(a),pb=edge(b),poly=[[cx,cs],pa];
    if(a<Math.PI/4&&b>Math.PI/4)poly.push([cx+w,cs+w]);poly.push(pb);
    const y=base+(k+1)*rise;
    v3i_prism(g,`有厚度转角踏板_${k+1}`,poly,y,.048,mats.woodFloor||mats.wood);
    v3i_riser(g,`转角扇步踢板_${k+1}`,[cx,y-rise/2,-cs],[pa[0],y-rise/2,-pa[1]],rise,.025,mats.woodDark||mats.wood);
    rod(g,'扇步踏鼻',[cx,y-.010,-cs],[pa[0],y-.010,-pa[1]],.012,mats.woodRaw||mats.wood,6);
    const t=(a+b)/2;
    records.push({name:`主梯/转角扇步${k+1}`,foot:[cx+.60*Math.cos(t),y,-(cs+.60*Math.sin(t))],kind:'winder',required:2.0});
  }
  // 内角实木柱和转角扶手将尖角排除在正常步行线之外。
  box(g,'转角内侧木柱',cx+.032,1.19,-(cs+.032),.064,2.18,.064,mats.woodDark||mats.wood);
  const inner=[],outer=[];
  for(let k=0;k<=6;k++) {
    const a=k*Math.PI/12,y=base+(k/6)*3*rise;
    const p=edge(a);outer.push([p[0]-.016,y,-(p[1]-.016)]);
    inner.push([cx+.115*Math.cos(a),y,-(cs+.115*Math.sin(a))]);
  }
  v3i_slopeRail(g,'转角外侧连续木扶手',outer,mats);
  v3i_slopeRail(g,'转角内侧护手',inner,mats);
  rod(g,'转角内扶手接前直跑',[cx+.018,base+.90,-cs],[cx+.115,base+.90,-cs],.030,mats.wood,8);
  rod(g,'转角内扶手接西直跑',[cx,base+3*rise+.90,-(cs+.115)],[cx,base+3*rise+.90,-(cs+.018)],.030,mats.wood,8);
  for(const [i,p] of[[cx+w-.045,cs+.045],[cx+w-.045,cs+w-.045],[cx+.045,cs+w-.045]].entries()) {
    v3i_beam(g,'扇步外沿承托木',[p[0],base-.10,-p[1]],[p[0],base+(i+1)*rise-.052,-p[1]],.07,.12,mats.woodDark||mats.wood);
  }
  consolidate(g);return g;
}

function v3i_floor(parent,name,x0,x1,s0,s1,top,mats,holes=[],material=null) {
  const mat=material||mats.woodFloor||mats.wood;
  const g=group(parent,name,{kind:'floor-slab',boundsX:[x0,x1],boundsS:[s0,s1],elevation:top,top,thickness:.16,holesPlan:holes});
  // 先将实体板分割成实际矩形，再由既有 helper 铺木板。
  // 否则旧 helper 会整块省略跨孔的饰面板，留下梯顶落脚处低 20mm 的裸板。
  const xs=[...new Set([x0,x1,...holes.flatMap(h=>[h.x0,h.x1])])].filter(x=>x>=x0&&x<=x1).sort((a,b)=>a-b);
  const ss=[...new Set([s0,s1,...holes.flatMap(h=>[h.s0,h.s1])])].filter(s=>s>=s0&&s<=s1).sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ss.length-1;j++) {
    const x=(xs[i]+xs[i+1])/2,s=(ss[j]+ss[j+1])/2;
    if(holes.some(h=>x>h.x0&&x<h.x1&&s>h.s0&&s<h.s1))continue;
    // Core's low-detail wood omits 20 mm finish boards.  Keep a full-thickness
    // structural surface here so neighbour landings still meet the actual
    // last tread at the approved elevation, without changing the soffit.
    if(v2BuildDetail==='low'&&mat.name.includes('杉木')){
      box(g,`低细节完整厚度木板_${i+1}_${j+1}`,(xs[i]+xs[i+1])/2,top-.08,-(ss[j]+ss[j+1])/2,
        xs[i+1]-xs[i],.16,ss[j+1]-ss[j],mat);
    }else slab(g,`实体板与铺板_${i+1}_${j+1}`,xs[i],xs[i+1],-ss[j+1],-ss[j],top,.16,mat);
  }
  return g;
}

function v3i_joists(parent,name,x0,x1,s0,s1,top,mats,holes=[]) {
  const g=group(parent,name,{kind:'floor-joists'});
  for(let s=s0+.26;s<s1-.12;s+=.62) {
    let spans=[[x0,x1]];
    for(const h of holes)if(s+.055>h.s0&&s-.055<h.s1)spans=spans.flatMap(([a,b])=>b<=h.x0||a>=h.x1?[[a,b]]:[[a,Math.min(b,h.x0)],[Math.max(a,h.x1),b]].filter(q=>q[1]-q[0]>.05));
    for(const[a,b]of spans)box(g,'木搁栅',(a+b)/2,top-.22,-s,b-a,.12,.11,mats.woodDark||mats.wood);
  }consolidate(g);return g;
}

// Neighbour interiors retain the approved dimensions. Remove only surfaces
// concealed by their existing floor solids and overlapping coplanar faces.
// Moving leaves are separate scopes: opening a door must never reveal a hole.
function v3NeighbourJoints(root,{hero=false}={}) {
  // Treads have a textured top and timber edges. Keep both materials while
  // making their individual surfaces available to the same joint clipping.
  if(hero){
    const treads=[];root.traverse(o=>{if(o.isMesh&&Array.isArray(o.material)&&o.userData.stairwellRevision)treads.push(o);});
    for(const o of treads){
      const parent=group(o.parent,o.name,{...o.userData});parent.position.copy(o.position);parent.quaternion.copy(o.quaternion);parent.scale.copy(o.scale);
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
      for(const [slot,mat]of o.material.entries()){
        const values=Object.fromEntries(Object.keys(g.attributes).map(k=>[k,[]]));
        for(const range of g.groups.filter(r=>r.materialIndex===slot))for(let i=range.start;i<range.start+range.count;i++)for(const[k,a]of Object.entries(g.attributes))for(let j=0;j<a.itemSize;j++)values[k].push(a.getComponent(i,j));
        const part=new THREE.BufferGeometry();for(const[k,a]of Object.entries(g.attributes))part.setAttribute(k,new THREE.Float32BufferAttribute(values[k],a.itemSize));part.computeBoundingSphere();
        const m=mesh(parent,slot?'木质边口':'原有踏面',part,mat);m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;
      }
      o.removeFromParent();
    }
  }
  root.updateMatrixWorld(true);
  const inv=root.matrixWorld.clone().invert(),floors=[],walls=[],audit={floorCuts:0,coplanarMeshes:0,coplanarArea:0};
  root.traverse(o=>{
    if(o.isMesh&&/^(低细节完整厚度木板_|楼板实心分块)/.test(o.name)){
      let owner=o.parent;while(owner&&owner!==root&&owner.userData.kind!=='floor-slab')owner=owner.parent;
      if(owner&&owner!==root){const matrix=inv.clone().multiply(o.matrixWorld),b=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(matrix);b.max.y=Math.max(b.max.y,owner.userData.top);floors.push(b);}
    }
    if(o.userData.kind==='wall')walls.push(o);
  });
  for(const wall of walls){
    const items=[];wall.traverse(o=>{if(!o.isMesh)return;for(let p=o.parent;p&&p!==wall;p=p.parent)if(['door','window','door_leaf','sash'].includes(p.userData.kind))return;items.push(o);});
    for(const o of items){
      const matrix=inv.clone().multiply(o.matrixWorld),pieces=[],kept=[],im=new THREE.Matrix4(),tint=new THREE.Color();let changed=false;
      const trim=source=>{
        let g=source,owned=false;
        const bounds=new THREE.Box3().setFromBufferAttribute(source.attributes.position).applyMatrix4(matrix);
        for(const b of floors){
          if(!bounds.intersectsBox(b))continue;
          const planes=[0,1,2].flatMap(axis=>[{axis,value:b.min.getComponent(axis)-.00001,sign:1},{axis,value:b.max.getComponent(axis)+.00001,sign:-1}]);
          const cut=sliceGeometry(THREE,g,matrix,planes);if(!cut.inside){cut.outside?.dispose();continue;}
          cut.inside.dispose();if(owned)g.dispose();g=cut.outside;owned=true;changed=true;audit.floorCuts++;if(!g)break;
        }
        return {g,owned};
      };
      if(o.isInstancedMesh){
        for(let i=0;i<o.count;i++){
          o.getMatrixAt(i,im);const source=o.geometry.clone().applyMatrix4(im),part=trim(source);
          if(!part.owned)kept.push(i);
          else if(part.g){const mat=o.material.clone();if(o.instanceColor){o.getColorAt(i,tint);mat.color.multiply(tint);}pieces.push({geometry:part.g,material:mat});}
          source.dispose();
        }
        if(!changed)continue;
        if(kept.length){const n=new THREE.InstancedMesh(o.geometry,o.material,kept.length);n.name=o.name;n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);kept.forEach((i,j)=>{o.getMatrixAt(i,im);n.setMatrixAt(j,im);if(o.instanceColor){o.getColorAt(i,tint);n.setColorAt(j,tint);}});n.castShadow=o.castShadow;n.receiveShadow=o.receiveShadow;o.parent.add(n);}
        for(const part of pieces){const n=new THREE.Mesh(part.geometry,part.material);n.name=o.name+'_楼板承口';n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);n.castShadow=o.castShadow;n.receiveShadow=o.receiveShadow;o.parent.add(n);}o.removeFromParent();
      }else{const part=trim(o.geometry);if(part.owned){if(part.g)o.geometry=part.g;else o.removeFromParent();}}
    }
  }
  root.updateMatrixWorld(true);
  const items=[];
  root.traverse(o=>{
    if(!o.isMesh||(!hero&&o.isInstancedMesh)||Array.isArray(o.material)||o.material.transparent)return;
    let scope='fixed',low=false,full=false,roof=false,architecture=false,path=o.name;
    for(let p=o.parent;p&&p!==root;p=p.parent){path=p.name+'/'+path;if(p.name.startsWith('ROOF_'))roof=true;if(p.name==='剖切_实心一米矮墙')low=true;if(p.name==='完整墙体'&&p.parent.children.some(c=>c.name==='剖切_实心一米矮墙'))full=true;if(['wall','slab','floor-slab','stair-flight','winder-stair'].includes(p.userData.kind))architecture=true;if((hero?['door','window','door_leaf','sash']:['door_leaf','sash']).includes(p.userData.kind))scope=p.id;}
    if(roof||scope!=='fixed')return;
    if(hero&&!architecture&&!/门槛/.test(path))return;
    const priority=hero?(/踏板_|转角扇步_|原.*(?:铺板|杉木|红陶)|平台独立杉木板/.test(path)?4:/楼板实心分块|门槛/.test(o.name)?3:/灰泥|墙面|饰面|旧感/.test(o.name+' '+o.material.name)?2:1):/低细节完整厚度木板|楼板实心分块|杉木踏板|有厚度转角踏板/.test(path)?3:/木|石压顶/.test(o.material.name)?2:1;
    const materialKey=JSON.stringify([o.material.color.toArray(),o.material.roughness,o.material.metalness]);
    const mode=hero?(low?'low':full?'full':'common'):String(low);
    items.push({o,scope:scope+'/'+mode,common:hero&&mode==='common',maskOnly:hero&&!!o.isInstancedMesh,priority,materialKey});
  });
  // Common floors/stairs are present in both wall modes. Each wall mode clips
  // against them, while complete and cut walls never subtract from each other.
  items.sort((a,b)=>Number(b.common)-Number(a.common)||Number(b.maskOnly)-Number(a.maskOnly)||b.priority-a.priority);
  const cells=new Map(),cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const area=p=>Math.abs(p.reduce((s,v,i)=>{const w=p[(i+1)%p.length];return s+v.xy[0]*w.xy[1]-v.xy[1]*w.xy[0];},0))/2;
  const interpolate=(a,b,t)=>{const v={xy:a.xy.map((x,k)=>x+(b.xy[k]-x)*t),attrs:{}};for(const k in a.attrs)v.attrs[k]=a.attrs[k].map((x,j)=>x+(b.attrs[k][j]-x)*t);return v;};
  const clip=(poly,a,b,sign,inside)=>{const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],x=sign*cross(a,b,p.xy),y=sign*cross(a,b,q.xy),ip=inside?x>=0:x<=0,iq=inside?y>=0:y<=0;if(ip)out.push(p);if(ip!==iq)out.push(interpolate(p,q,x/(x-y)));}return out;};
  const subtract=(poly,mask)=>{
    const sign=Math.sign(cross(mask[0],mask[1],mask[2]));let intersection=poly;
    for(let i=0;i<3&&intersection.length;i++)intersection=clip(intersection,mask[i],mask[(i+1)%3],sign,true);
    if(intersection.length<3||area(intersection)<1e-9)return [poly];
    let inside=poly;const outside=[];
    for(let i=0;i<3&&inside.length;i++){const part=clip(inside,mask[i],mask[(i+1)%3],sign,false);if(part.length>=3&&area(part)>1e-10)outside.push(part);inside=clip(inside,mask[i],mask[(i+1)%3],sign,true);}
    return outside;
  };
  for(const {o,scope,materialKey,maskOnly}of items)for(let instance=0;instance<(o.isInstancedMesh?o.count:1);instance++){
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,attrs=Object.entries(g.attributes),matrix=inv.clone().multiply(o.matrixWorld),replacements=new Map();let removed=0;
    if(o.isInstancedMesh){const im=new THREE.Matrix4();o.getMatrixAt(instance,im);matrix.multiply(im);}
    const vertex=i=>({p:new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix)});
    for(let i=0;i<g.attributes.position.count;i+=3){
      const tri=[vertex(i),vertex(i+1),vertex(i+2)],normal=tri[1].p.clone().sub(tri[0].p).cross(tri[2].p.clone().sub(tri[0].p)).normalize(),axis=['x','y','z'].find(k=>Math.abs(normal[k])>.999999);
      if(!axis)continue;
      const uv=['x','y','z'].filter(k=>k!==axis);tri.forEach(v=>v.xy=uv.map(k=>v.p[k]));
      const originalArea=area(tri);if(originalArea<1e-10)continue;
      const plane=tri[0].p[axis],suffix='/'+axis+'/'+Math.round(plane*1e4)+'/'+Math.sign(normal[axis]),base=scope+suffix,lo=[0,1].map(k=>Math.min(...tri.map(v=>v.xy[k]))),hi=[0,1].map(k=>Math.max(...tri.map(v=>v.xy[k]))),keys=[],masks=new Set();
      for(let x=Math.floor(lo[0]*2);x<=Math.floor(hi[0]*2);x++)for(let y=Math.floor(lo[1]*2);y<=Math.floor(hi[1]*2);y++){
        const tail='/'+x+'/'+y,key=base+tail;keys.push(key);
        if(!maskOnly)for(const lookup of hero&&scope!=='fixed/common'?[key,'fixed/common'+suffix+tail]:[key])for(const m of cells.get(lookup)||[])if((hero||m.materialKey!==materialKey)&&Math.abs(m.plane-plane)<.00001&&m.lo[0]<hi[0]-1e-7&&m.hi[0]>lo[0]+1e-7&&m.lo[1]<hi[1]-1e-7&&m.hi[1]>lo[1]+1e-7)masks.add(m);
      }
      // Most faces have no competing surface. Decode/interpolate attributes
      // only for actual candidates; untouched triangles keep their exact bytes.
      if(masks.size)tri.forEach((v,j)=>{v.attrs={};for(const[k,a]of attrs)v.attrs[k]=Array.from({length:a.itemSize},(_,n)=>a.getComponent(i+j,n));});
      let pieces=[tri];if(!maskOnly)for(const mask of masks){pieces=pieces.flatMap(p=>subtract(p,mask.xy));if(!pieces.length)break;}
      const delta=originalArea-pieces.reduce((s,p)=>s+area(p),0);
      if(delta>1e-8){removed+=delta;replacements.set(i,pieces);}
      const entry={xy:tri.map(v=>v.xy),plane,materialKey,lo,hi};for(const key of keys){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry);}
    }
    if(removed>1e-8){
      let count=g.attributes.position.count;for(const pieces of replacements.values())count+=pieces.reduce((n,p)=>n+(p.length-2)*3,0)-3;
      const result=new THREE.BufferGeometry();
      for(const[k,a]of attrs){const output=new Float32Array(count*a.itemSize);let offset=0;
        for(let i=0;i<g.attributes.position.count;i+=3){const pieces=replacements.get(i);if(pieces){for(const poly of pieces)for(let j=1;j<poly.length-1;j++)for(const v of[poly[0],poly[j],poly[j+1]]){output.set(v.attrs[k],offset);offset+=a.itemSize;}}
          else{output.set(a.array.subarray(i*a.itemSize,(i+3)*a.itemSize),offset);offset+=3*a.itemSize;}}
        result.setAttribute(k,new THREE.BufferAttribute(output,a.itemSize,a.normalized));
      }
      result.computeBoundingSphere();o.geometry=result;audit.coplanarMeshes++;audit.coplanarArea+=removed;
    }
    // Source geometries may be shared; retain them for the other instances.
  }
  root.userData[hero?'interiorJointRepair':'neighbourJointRepair']={revision:hero?'20261116':'20261115',...audit};
}

function v3BuildInteriorB(root,{gf,half,f2,terrace,attic},mats,reg) {
  const probes=[],floorMat=mats.woodFloor||mats.wood,dark=mats.woodDark||mats.wood;
  const levels={ground:.10,tingzi:2.40,second:4.00,terrace:4.80,attic:6.70};
  const system=group(gf,'V3_一楼至二楼横向木梯',{kind:'stair-system',elevations:[.10,2.40,4.00]});
  const upper=group(f2,'V3_二楼至晒台短回梯',{kind:'stair-system',elevations:[4.00,4.80]});
  const atticStair=group(f2,'V3_中厢独立上阁木梯',{kind:'stair-system',elevations:[4.00,6.70]});

  // 二楼主板在梯区完整退出，只保留东侧落地廊；两片在中隔墙内接缝。
  const mainHole={x0:.12,x1:2.94,s0:8.50,s1:10.62};
  const mainFloor=v3i_floor(f2,'二楼_主开间木楼板_横向梯井',.12,3.96,3.12,10.62,4,mats,[mainHole]);
  const wingFloor=v3i_floor(f2,'二楼_东厢连续木楼板_共用廊与三间',3.96,7.08,.12,14.88,4,mats);
  v3i_joists(mainFloor,'正楼板下木搁栅',.24,3.84,3.24,8.38,4,mats);
  v3i_joists(wingFloor,'厢房板下木搁栅',4.02,6.96,.24,14.76,4,mats);
  // 后侧横跑上方没有另加搁栅，防止主梯高端被穿过。
  box(mainFloor,'二楼梯井南边梁',1.65,3.77,-8.44,2.58,.14,.12,dark);
  box(mainFloor,'二楼东廊梯井边梁',2.985,3.77,-9.50,.09,.14,2.0,dark);

  // 亭子间板与晒台板覆盖前墙厚度，桥在其南皮处接合，没有重叠平面。
  const halfFloor=v3i_floor(half,'亭子间_实木楼板',.12,3.96,11.94,14.88,2.4,mats);
  // 低厨房不另下挂梁；托梁包在 .16 m 楼板厚度内。
  const roofFloor=v3i_floor(terrace,'晒台_灰砂实体屋面板',.12,3.96,11.94,14.88,4.8,mats,[],mats.concrete||mats.stone);

  const westLanding=v3i_floor(system,'亭子平台_西侧转身与地面通路上盖',.24,1.14,8.50,10.50,2.4,mats);
  Object.assign(westLanding.userData,{groundPassageBelow:true,minimumUnderside:2.24});
  const halfBridge=v3i_floor(half,'亭子间_西侧窄桥_保持后井露天',.24,1.14,10.50,11.94,2.4,mats);
  const sunLanding=v3i_floor(upper,'晒台短梯_上平台',.24,2.19,8.50,9.38,4.8,mats);
  v3i_floor(upper,'晒台平台_西侧回廊',.24,1.14,9.38,10.50,4.8,mats);
  const sunBridge=v3i_floor(terrace,'晒台_西侧窄桥_保持后井露天',.24,1.14,10.50,11.94,4.8,mats);

  // 12 个 .1917m 踢面：3 短直步、3 扇步、6 西向直步。最末踏面与西平台同高。
  const r=2.30/12;
  v3i_flight(system,'主梯第1段_入门短步向北',{start:[3.40,7.86],end:[3.40,8.50],bottom:.10,top:.10+3*r,risers:3,treads:3},mats,probes);
  v3i_winders(system,mats,probes);
  v3i_flight(system,'主梯第1段_转西至亭子平台',{start:[2.96,8.94],end:[1.14,8.94],bottom:.10+6*r,top:2.40,risers:6,treads:6},mats,probes);
  // 8 个 .20m 踢面，7 个实际踏板；二楼东廊是最终平台。
  v3i_flight(system,'主梯第2段_向东至二楼',{start:[1.14,10.06],end:[2.94,10.06],bottom:2.4,top:4,risers:8,treads:7},mats,probes);
  v3i_flight(upper,'主梯第3段_向西上晒台',{start:[2.94,8.94],end:[2.19,8.94],bottom:4,top:4.8,risers:4,treads:3},mats,probes);

  // 平台护栏严格避开两跑梯口和后桥口。
  railing(westLanding,'亭子平台_南缘木护栏',[.27,-8.515],[1.11,-8.515],2.4,mats,{height:.90});
  railing(westLanding,'亭子平台_两跑间短护栏',[1.115,-9.40],[1.115,-9.60],2.4,mats,{height:.90});
  railing(mainFloor,'二楼东廊_两梯口间短护栏',[2.96,-9.40],[2.96,-9.60],4,mats,{height:.90});
  railing(sunLanding,'晒台平台_北缘护栏',[1.14,-9.355],[2.17,-9.355],4.8,mats,{height:.90});
  railing(upper,'晒台西廊_东缘护栏',[1.115,-9.38],[1.115,-10.48],4.8,mats,{height:.90});
  for(const [bridge,y] of[[halfBridge,2.4],[sunBridge,4.8]])for(const x of[.268,1.112]) {
    railing(bridge,x<.7?'西桥_西缘木栏杆':'西桥_东缘木栏杆',[x,-10.755],[x,-11.925],y,mats,{height:.90});
  }

  // 局部阁板与独立梯口；孔向北与阁板外缘贯通，低段上方没有天花板。
  const atticHole={x0:4.02,x1:4.98,s0:6.80,s1:9.30};
  const loft=v3i_floor(attic,'局部阁楼_杉木楼板_独立梯口',.12,7.08,5.40,8.40,6.7,mats,[atticHole]);
  v3i_joists(loft,'局部阁楼_主间木搁栅',.24,3.84,5.40,8.40,6.7,mats);
  v3i_joists(loft,'局部阁楼_东厢木搁栅_避让梯孔',4.02,6.96,5.40,8.40,6.7,mats,[atticHole]);
  box(loft,'阁梯孔东边托梁',5.035,6.48,-7.60,.11,.12,1.60,dark);
  // 梯口横梁完全放在南侧实板内，不能越过 s=6.80 压住最后一级。
  box(loft,'阁梯口南边托梁',4.50,6.48,-6.74,.96,.12,.12,dark);
  v3i_flight(atticStair,'阁梯_共用廊向南上局部阁楼',{start:[4.49,9.60],end:[4.49,6.80],bottom:4,top:6.7,risers:14,treads:13,width:.82},mats,probes);
  // V3.2 阁窗前移后，南护栏给有围护的短舌板留入口。
  railing(loft,'阁楼_南侧西段木护栏',[.27,-5.425],[1.10,-5.425],6.7,mats,{height:.88});
  railing(loft,'阁楼_南侧东段木护栏',[2.10,-5.425],[6.93,-5.425],6.7,mats,{height:.88});
  v3i_atticWindowPocket(loft,mats);
  railing(loft,'阁楼_北缘主间木护栏',[.27,-8.375],[3.81,-8.375],6.7,mats,{height:.88});
  railing(loft,'阁楼_北缘东厢木护栏',[5.01,-8.375],[6.93,-8.375],6.7,mats,{height:.88});
  railing(loft,'阁楼_梯孔东缘木护栏',[5.005,-6.825],[5.005,-8.375],6.7,mats,{height:.88});

  probes.push(
    {name:'一楼_西平台下通路',foot:[.69,.10,-9.45],kind:'passage',required:2.0},
    {name:'一楼_后墙西门前',foot:[.69,.10,-10.40],kind:'passage',required:2.0},
    {name:'一楼_客堂后西门洞',foot:[.69,.10,-7.80],kind:'doorway',required:2.0},
    {name:'一楼_主屋后西门洞',foot:[.69,.10,-10.62],kind:'doorway',required:2.0},
    {name:'亭子平台_转身中心',foot:[.69,2.4,-9.48],kind:'landing',required:2.0},
    {name:'亭子间_西桥中心',foot:[.69,2.4,-11.35],kind:'bridge',required:2.0},
    {name:'亭子间_主屋后桥门洞',foot:[.69,2.4,-10.62],kind:'doorway',required:2.0},
    {name:'亭子间_附屋入口门洞',foot:[.69,2.4,-12.03],kind:'doorway',required:2.0},
    {name:'二楼_横梯落地东廊',foot:[3.38,4,-10.06],kind:'landing',required:2.0},
    {name:'二楼_中厢共用廊',foot:[4.50,4,-10.10],kind:'passage',required:2.0},
    {name:'二楼_通中厢门洞',foot:[3.93,4,-10.10],kind:'doorway',required:2.0},
    {name:'晒台_西侧转身平台',foot:[.69,4.8,-9.48],kind:'landing',required:2.0},
    {name:'晒台_后桥中心',foot:[.69,4.8,-11.35],kind:'bridge',required:2.0},
    {name:'晒台_主屋后桥门洞',foot:[.69,4.8,-10.62],kind:'doorway',required:2.0},
    {name:'阁梯_顶部到达',foot:[4.49,6.7,-6.76],kind:'landing',required:2.0},
    {name:'阁楼_跨中墙低通口',foot:[3.93,6.7,-6.40],kind:'low-attic-opening',required:1.78}
  );

  const circulation={
    coordinateSystem:'local Three [X,h,-s]; root translation is external',levels,
    sourceLayout:'shikumen-v3-plan/layout.json',
    estimates:true,probes,
    paths:{
      groundToRearCourt:[[.69,.10,-7.86],[.69,.10,-8.70],[.69,.10,-10.40],[.69,.10,-11.35]],
      tingzi:[[.69,2.4,-8.94],[.69,2.4,-10.40],[.69,2.4,-11.35],[.69,2.4,-12.25]],
      secondToRearWing:[[3.38,4,-10.06],[4.49,4,-10.10],[5.9,4,-10.10],[5.9,4,-11.05]],
      secondToTerrace:[[3.38,4,-8.94],[2.94,4,-8.94],[2.19,4.8,-8.94],[.69,4.8,-8.94],[.69,4.8,-11.35],[.69,4.8,-12.25]],
      secondToAttic:[[4.49,4,-10.10],[4.49,4,-9.60],[4.49,6.7,-6.80],[4.49,6.7,-6.40],[3.50,6.7,-6.40]]
    },
    floorHoles:{second:mainHole,attic:atticHole},
    courtyardOpen:{x:[1.14,3.84],s:[10.74,11.94]},
    stairDesign:{
      first:{risers:12,rise:r,shortStraightGoing:.64/3,winders:3,winderWalkRadius:.60,westGoing:1.82/6},
      second:{risers:8,rise:.20,going:1.8/7},
      terrace:{risers:4,rise:.20,going:.25},
      attic:{risers:14,rise:2.7/14,going:2.8/13}
    },
    notes:[
      '主梯为3短直步+3扇步+6西向直步；最后西向踏面与亭子平台同高。',
      '西侧地面通道的托梁包在平台厚度内，中心线上不下挂横梁。',
      '桥的实际独立板在s=11.94止；到12.12的门槛段由附屋楼板连续接替。',
      '阁层跨中墙低口由建筑墙体负责；本函数的楼板完整承接其南侧。'
    ]
  };
  root.userData.v3Circulation=circulation;
  if(reg)reg.v3Circulation=circulation;
  return {system,upper,atticStair,mainFloor,wingFloor,halfFloor,roofFloor,loft,circulation};
}

// The storage attic exists independently of the dormer.  The window is one
// lighting component; neither its visibility nor render detail creates a floor.
function v3i_atticWindowPocket(loft,mats) {
  const g=v3i_floor(loft,'阁窗前_有护栏的短舌板',1.12,2.08,5.00,5.40,6.70,mats);
  Object.assign(g.userData,{kind:'attic-window-pocket',floorKind:'floor-slab',standingPoint:[1.60,6.70,-5.30]});
  railing(g,'窗前舌板_南缘安全木栏',[1.14,-5.045],[2.06,-5.045],6.70,mats,{height:.88});
  railing(g,'窗前舌板_西缘安全木栏',[1.14,-5.045],[1.14,-5.425],6.70,mats,{height:.88});
  railing(g,'窗前舌板_东缘安全木栏',[2.06,-5.045],[2.06,-5.425],6.70,mats,{height:.88});
  return g;
}

function v3BuildInteriorA(root,{gf,half,f2,terrace,attic},mats,reg) {
  const probes=[],dark=mats.woodDark||mats.wood;
  const levels={ground:.10,tingzi:2.40,second:4.00,terrace:4.80,attic:6.70};
  const system=group(gf,'A_一楼至二楼纵向折返木梯',{kind:'stair-system',elevations:[.10,2.40,4.00]});
  const upper=group(f2,'A_二楼至晒台西侧短梯',{kind:'stair-system',elevations:[4.00,4.80]});
  const atticStair=group(f2,'A_前部东侧独立上阁木梯',{kind:'stair-system',elevations:[4.00,6.70],use:'partial-storage-attic-access'});

  // A has its own stair well.  The 3.12 m clear width is not a scaled B plan.
  // At +4.00 the complete front floor meets the south-facing middle return;
  // an eastern strip remains as a real rear landing, outside both low flights.
  const mainHole={x0:.12,x1:2.18,s0:7.87,s1:10.62};
  const mainFloor=v3i_floor(f2,'A二楼_前楼与东侧通行木板',.12,3.48,3.12,10.62,4,mats,[mainHole]);
  v3i_joists(mainFloor,'A二楼_前部木搁栅',.24,3.36,3.24,7.76,4,mats);
  v3i_joists(mainFloor,'A二楼_东带木搁栅',2.18,3.36,7.87,10.50,4,mats);
  box(mainFloor,'A二楼_东侧梯井边梁',2.225,3.77,-9.19,.09,.14,2.64,dark);
  // The western short starting platform is separate from the slab cut-out.
  const terraceStart=v3i_floor(upper,'A晒台梯_二楼西侧起步平台',.24,1.14,7.87,8.12,4,mats);

  const halfFloor=v3i_floor(half,'A亭子间_实木楼板',.12,3.48,11.94,14.88,2.4,mats);
  const roofFloor=v3i_floor(terrace,'A晒台_灰砂实体屋面板',.12,3.48,11.94,14.88,4.8,mats,[],mats.concrete||mats.stone);
  const westLanding=v3i_floor(system,'A亭子平台_北侧转身与地面通路上盖',.24,2.18,9.62,10.50,2.4,mats);
  Object.assign(westLanding.userData,{groundPassageBelow:true,minimumUnderside:2.24});
  const halfBridge=v3i_floor(half,'A亭子间_西侧窄桥_保持后井露天',.24,1.14,10.50,11.94,2.4,mats);
  const sunLanding=v3i_floor(upper,'A晒台梯_西侧上平台与回廊',.24,1.14,8.87,10.50,4.8,mats);
  const sunBridge=v3i_floor(terrace,'A晒台_西侧窄桥_保持后井露天',.24,1.14,10.50,11.94,4.8,mats);

  v3i_flight(system,'A主梯第1跑_西侧向北至亭子平台',
    {start:[.69,6.87],end:[.69,9.62],bottom:.10,top:2.40,risers:12,treads:11,width:.86},mats,probes);
  v3i_flight(system,'A主梯第2跑_中侧向南至二楼',
    {start:[1.69,9.62],end:[1.69,7.87],bottom:2.40,top:4.00,risers:8,treads:7,width:.86},mats,probes);
  v3i_flight(upper,'A主梯第3跑_西侧向北至晒台',
    {start:[.69,8.12],end:[.69,8.87],bottom:4.00,top:4.80,risers:4,treads:3,width:.86},mats,probes);

  // Guard the void edges, leaving actual full-width entries at both ends.
  railing(westLanding,'A亭子平台_东侧木护栏',[2.155,-9.65],[2.155,-10.475],2.4,mats,{height:.90});
  railing(mainFloor,'A二楼_东带梯井木护栏',[2.205,-7.90],[2.205,-10.475],4,mats,{height:.90});
  railing(terraceStart,'A晒台起步平台_短东栏',[1.112,-7.89],[1.112,-8.10],4,mats,{height:.90});
  railing(sunLanding,'A晒台上平台_东缘木护栏',[1.112,-8.90],[1.112,-10.475],4.8,mats,{height:.90});
  for(const [bridge,y] of[[halfBridge,2.4],[sunBridge,4.8]])for(const x of[.268,1.112]) {
    railing(bridge,x<.7?'A西桥_西缘木栏杆':'A西桥_东缘木栏杆',[x,-10.755],[x,-11.925],y,mats,{height:.90});
  }

  // The attic flight starts on the FRONT shared second-floor zone and rises
  // northwards, so no rear passage has to squeeze alongside a steep flight.
  // It is compact storage access (43.5 degrees), not a full-height third floor.
  const atticHole={x0:2.40,x1:3.36,s0:4.08,s1:6.72};
  const loft=v3i_floor(attic,'A局部阁层_实体杉木板与贯通梯孔',.12,3.48,5.40,8.40,6.7,mats,[atticHole]);
  v3i_joists(loft,'A局部阁层_避让阁梯孔木搁栅',.24,3.36,5.40,8.40,6.7,mats,[atticHole]);
  // Headers are inside the slab thickness; no downstand crosses the last
  // attic tread or the western +4.80 flight below the rear floor edge.
  box(loft,'A阁梯口_北侧嵌板封边梁',2.88,6.62,-6.78,.96,.12,.12,dark);
  box(loft,'A阁梯孔_西侧嵌板边梁',2.35,6.62,-6.06,.10,.12,1.32,dark);
  v3i_flight(atticStair,'A阁梯_二楼前部向北上局部阁层',
    {start:[2.89,4.08],end:[2.89,6.72],bottom:4,top:6.7,risers:14,treads:13,width:.82},mats,probes);
  railing(loft,'A阁层_南边西段木护栏',[.27,-5.425],[1.10,-5.425],6.7,mats,{height:.88});
  railing(loft,'A阁层_南边中段木护栏',[2.10,-5.425],[2.375,-5.425],6.7,mats,{height:.88});
  railing(loft,'A阁层_梯孔西缘木护栏',[2.375,-5.425],[2.375,-6.695],6.7,mats,{height:.88});
  railing(loft,'A阁层_北缘木护栏',[.27,-8.375],[3.33,-8.375],6.7,mats,{height:.88});
  v3i_atticWindowPocket(loft,mats);

  probes.push(
    {name:'A一楼_主梯西入口',foot:[.69,.10,-6.74],kind:'doorway',required:2},
    {name:'A一楼_中通路入口',foot:[1.69,.10,-6.74],kind:'doorway',required:2},
    {name:'A一楼_中通路_南',foot:[1.69,.10,-7.45],kind:'passage',required:2},
    {name:'A一楼_中通路_回梯下',foot:[1.69,.10,-8.55],kind:'passage',required:2},
    {name:'A一楼_中通路_北',foot:[1.69,.10,-9.75],kind:'passage',required:2},
    {name:'A一楼_平台下转西',foot:[1.14,.10,-10.05],kind:'passage',required:2},
    {name:'A一楼_后墙西门前',foot:[.69,.10,-10.40],kind:'passage',required:2},
    {name:'A一楼_主屋后西门洞',foot:[.69,.10,-10.62],kind:'doorway',required:2},
    {name:'A亭子平台_西梯到达',foot:[.69,2.40,-10.02],kind:'landing',required:2},
    {name:'A亭子平台_转向中梯',foot:[1.69,2.40,-10.02],kind:'landing',required:2},
    {name:'A亭子间_主屋后桥门洞',foot:[.69,2.40,-10.62],kind:'doorway',required:2},
    {name:'A亭子间_后井窄桥',foot:[.69,2.40,-11.35],kind:'bridge',required:2},
    {name:'A亭子间_附屋入口',foot:[.69,2.40,-12.03],kind:'doorway',required:2},
    {name:'A二楼_主梯到达',foot:[1.69,4,-7.65],kind:'landing',required:2},
    {name:'A二楼_转西去晒台梯',foot:[.69,4,-7.65],kind:'passage',required:2},
    {name:'A二楼_西短梯底平台',foot:[.69,4,-8.00],kind:'landing',required:2},
    {name:'A二楼_东带后廊',foot:[2.70,4,-9.45],kind:'passage',required:2},
    {name:'A二楼_共享阁梯前落脚',foot:[2.89,4,-3.65],kind:'landing',required:2},
    {name:'A二楼_共享阁梯旁通路',foot:[1.80,4,-5.15],kind:'passage',required:2},
    {name:'A晒台_西侧上平台',foot:[.69,4.80,-9.48],kind:'landing',required:2},
    {name:'A晒台_主屋后桥门洞',foot:[.69,4.80,-10.62],kind:'doorway',required:2},
    {name:'A晒台_后井窄桥',foot:[.69,4.80,-11.35],kind:'bridge',required:2},
    {name:'A阁梯_顶部到达',foot:[2.89,6.70,-6.95],kind:'landing',required:2},
    {name:'A阁层_顶平台转西',foot:[2.25,6.70,-7.05],kind:'passage',required:2},
    {name:'A阁层_屋脊下通行',foot:[1.60,6.70,-7.05],kind:'passage',required:2},
    {name:'A阁层_去窗前主板',foot:[1.60,6.70,-6.35],kind:'passage',required:2}
  );
  const circulation={coordinateSystem:'local Three [X,h,-s]; root translation is external',levels,
    sourceLayout:'V3.2 A-specific interior design inside approved 3.60 x 15.00 m shell',estimates:true,probes,
    paths:{
      groundToRearCourt:[[1.69,.10,-6.74],[1.69,.10,-9.95],[.69,.10,-9.95],[.69,.10,-11.35]],
      tingzi:[[.69,2.4,-10.02],[.69,2.4,-11.35],[.69,2.4,-12.25]],
      secondToTerrace:[[1.69,4,-7.65],[.69,4,-7.65],[.69,4,-8.12],[.69,4.8,-8.87],[.69,4.8,-11.35],[.69,4.8,-12.25]],
      secondToAttic:[[1.69,4,-7.65],[1.80,4,-3.65],[2.89,4,-3.65],[2.89,4,-4.08],[2.89,6.7,-6.72],[2.89,6.7,-7.05],[1.60,6.7,-7.05]],
      atticToWindow:[[1.60,6.7,-7.05],[1.60,6.7,-6.35],[1.60,6.7,-5.30]]
    },floorHoles:{second:mainHole,attic:atticHole},
    courtyardOpen:{x:[1.14,3.36],s:[10.74,11.94]},
    stairDesign:{
      first:{risers:12,rise:2.30/12,going:.25,width:.86,direction:'north'},
      second:{risers:8,rise:.20,going:.25,width:.86,direction:'south'},
      terrace:{risers:4,rise:.20,going:.25,width:.86,direction:'north'},
      attic:{risers:14,rise:2.70/14,going:2.64/13,width:.82,direction:'north',slopeDegrees:Math.atan2(2.7/14,2.64/13)*180/Math.PI,use:'compact storage-attic access'}
    },notes:[
      'A型专用纵向折梯，未缩放B型横向扇步梯。各标高为批准方案值。',
      'GF通道从中梯下到北平台下再转西，避开低西跑。北平台底2.24m，地坪顶.10m。',
      '阁梯从二楼前部共用区独立起步，阁板与坡屋盖之间为低矮局部储藏层，不是第三层卧室。',
      '普通通行2m为本案几何设计目标，射线核验不代替规范、结构或施工审批。'
    ]};
  root.userData.v3Circulation=circulation;if(reg)reg.v3Circulation=circulation;
  return {system,upper,atticStair,mainFloor,wingFloor:null,halfFloor,roofFloor,loft,circulation};
}

function v3BuildInterior(root,levels,mats,reg) {
  const built=root.userData.type==='A'?v3BuildInteriorA(root,levels,mats,reg):v3BuildInteriorB(root,levels,mats,reg);
  const c=built.circulation,atticEnabled=root.userData.atticProgram?.enabled!==false;
  if(atticEnabled){
    c.probes.push(
      {name:'阁层_窗前入口',foot:[1.60,6.70,-5.55],kind:'attic-window-route',required:2},
      {name:'阁层_窗前有栏舌板站位',foot:[1.60,6.70,-5.30],kind:'attic-window-route',required:2}
    );
    c.paths.atticToWindow ||= [[3.50,6.7,-6.40],[1.60,6.7,-6.40],[1.60,6.7,-5.30]];
    c.atticUse='low partial storage and short-duration use; not a standard bedroom or full third storey';
    c.windowPocket={x:[1.12,2.08],s:[5,5.4],top:6.7,handrailCentre:7.58,guardTop:7.616,stand:[1.6,6.7,-5.3]};
    c.lowStorageOpening=root.userData.type==='B'?{height:1.85,x:[3.84,4.02],s:[6,6.8]}:null;
    for(const p of c.probes)if(p.kind==='low-attic-opening')p.required=1.85;
  }else{
    built.atticStair.removeFromParent();built.loft.removeFromParent();
    c.probes=c.probes.filter(p=>!/阁/.test(p.name));
    delete c.paths.secondToAttic;delete c.paths.atticToWindow;c.floorHoles.attic=null;c.stairDesign.attic=null;
  }
  return built;
}


/*
 * V3 roof, scene-design dimensions only. No image/canvas/texture assets.
 * Requires THREE and existing group/mesh/box/rod/consolidate,
 * v2RoofMaterials, v2RoofTileGeometry, v2RoofBatch, v2RoofRidge helpers.
 * Coordinates: X east; Y height; Z = -s (s north/rear).
 * Public entry: v3BuildRoof(parent,mats,detail,reg,options={}).
 */
const v3rEPS = 1e-7;
const v3rPalette = [0x555c58,0x5d645f,0x656b64,0x6b7068,0x59615b,0x72766c];
const v3rNormalCache = new WeakMap();
// One coordinated opening/cheek/flashing envelope for both A and B homes.
// The 6.70 m attic has a guarded front tongue; the 1.55 m sill stays a high
// lighting window, without enlarging the main roof or pretending this is a
// measured historical proportion. Floor and rails are built by the interior.
const v3rDormerSpec = Object.freeze({
  x0:1.12,x1:2.08,front:5.00,back:6.20,eave:9.00,ridgeX:1.60,
  roofX0:1.02,roofX1:2.18,roofFront:4.88,roofBack:6.28,
  glassX0:1.27,glassX1:1.93,glassBottom:8.25,glassTop:8.93,
  tileX0:.99,tileX1:2.21,tileFront:4.85,tileBack:6.34,
  apronFront:4.80,flashingBack:6.43,atticFloor:6.70,
});

/** V2 positions are reused exactly, but thin shell edges must not share a
 * shading normal with BOTH the top and the underside. Smooth only within each
 * curved surface; use a separate outward normal on each cut/end/side face.
 */
function v3rShellNormals(source) {
  if(source.userData.v3SplitNormals)return source;
  if(v3rNormalCache.has(source))return v3rNormalCache.get(source);
  const out=source.toNonIndexed(),p=source.attributes.position,ids=source.index.array,n=source.userData.segments;
  const sums=[new Map(),new Map()],faceNormals=[];
  for(let t=0;t<ids.length/3;t++) {
    const a=new THREE.Vector3().fromBufferAttribute(p,ids[t*3]),b=new THREE.Vector3().fromBufferAttribute(p,ids[t*3+1]),c=new THREE.Vector3().fromBufferAttribute(p,ids[t*3+2]);
    const face=b.sub(a).cross(c.sub(a));faceNormals.push(face.clone().normalize());
    const curved=t<n*8&&(t%8)<4,surface=(t%8)<2?0:1;
    if(curved)for(let j=0;j<3;j++){const id=ids[t*3+j];if(!sums[surface].has(id))sums[surface].set(id,new THREE.Vector3());sums[surface].get(id).add(face);}
  }
  const normals=[];
  for(let t=0;t<ids.length/3;t++)for(let j=0;j<3;j++) {
    const curved=t<n*8&&(t%8)<4,surface=(t%8)<2?0:1;
    const v=curved?sums[surface].get(ids[t*3+j]).clone().normalize():faceNormals[t];normals.push(v.x,v.y,v.z);
  }
  out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));out.userData={...source.userData,v3SplitNormals:true};
  v3rNormalCache.set(source,out);return out;
}

function v3rHash(a,b=0,c=0) {
  let n=Math.imul((a|0)^0x46d51f3d,0x45d9f3b)^Math.imul((b|0)+67,0x27d4eb2d)^Math.imul((c|0)+29,0x85ebca6b);
  n^=n>>>16;n=Math.imul(n,0x45d9f3b);n^=n>>>16;return (n>>>0)/4294967295;
}
function v3rClipPoly(poly,p) {
  if(!poly.length)return [];
  const out=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=p[0]*a[0]+p[1]*a[1]+p[2],db=p[0]*b[0]+p[1]*b[1]+p[2];
    if(da>=-v3rEPS)out.push(a);
    if((da>v3rEPS&&db<-v3rEPS)||(da<-v3rEPS&&db>v3rEPS)) {
      const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
    }
  }
  return out.filter((a,i)=>!i||Math.hypot(a[0]-out[i-1][0],a[1]-out[i-1][1])>v3rEPS);
}
function v3rPolygon(x0,x1,s0,s1,planes=[]) {
  let p=[[x0,s0],[x1,s0],[x1,s1],[x0,s1]];
  for(const plane of planes)p=v3rClipPoly(p,plane);
  return p;
}
function v3rArea(p) {let a=0;for(let i=0;i<p.length;i++){const b=p[(i+1)%p.length];a+=p[i][0]*b[1]-b[0]*p[i][1];}return a/2;}
function v3rPlanes(poly) {
  const out=[],sign=v3rArea(poly)>0?1:-1;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],ds=b[1]-a[1],l=Math.hypot(dx,ds);
    if(l>v3rEPS)out.push([-sign*ds/l,0,-sign*dx/l,sign*(ds*a[0]-dx*a[1])/l]);
  }
  return out;
}
function v3rSubtractRect(poly,hole) {
  if(poly.length<3)return [];
  const xs=poly.map(p=>p[0]),ss=poly.map(p=>p[1]);
  if(Math.max(...xs)<=hole.x0+v3rEPS||Math.min(...xs)>=hole.x1-v3rEPS||Math.max(...ss)<=hole.s0+v3rEPS||Math.min(...ss)>=hole.s1-v3rEPS)return [poly];
  const fragments=[];
  for(const ps of [
    [[-1,0,hole.x0]],[[1,0,-hole.x1]],
    [[1,0,-hole.x0],[-1,0,hole.x1],[0,-1,hole.s0]],
    [[1,0,-hole.x0],[-1,0,hole.x1],[0,1,-hole.s1]],
  ]) {let p=poly;for(const plane of ps)p=v3rClipPoly(p,plane);if(p.length>2&&Math.abs(v3rArea(p))>1e-9)fragments.push(p);}
  return fragments;
}
function v3rWithHoles(polys,holes=[]) {for(const hole of holes)polys=polys.flatMap(p=>v3rSubtractRect(p,hole));return polys;}
function v3rBounds(poly) {return {x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),s0:Math.min(...poly.map(p=>p[1])),s1:Math.max(...poly.map(p=>p[1]))};}

/** Watertight prism; top can be any planar height function on a convex plan. */
function v3rPrism(poly,height,thickness,offset=0) {
  if(poly.length<3)return null;
  const p=v3rArea(poly)>0?poly:[...poly].reverse(),pos=[],ind=[],n=p.length;
  for(const q of p)pos.push(q[0],height(q[0],q[1])+offset,-q[1]);
  for(const q of p)pos.push(q[0],height(q[0],q[1])+offset-thickness,-q[1]);
  for(let i=1;i<n-1;i++){ind.push(0,i,i+1,n,n+i+1,n+i);}
  for(let i=0;i<n;i++){const j=(i+1)%n;ind.push(i,n+i,n+j,i,n+j,j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ind);
  const out=g.toNonIndexed();g.dispose();out.computeVertexNormals();out.computeBoundingSphere();
  out.userData={kind:'v3-solid-roof-prism',thickness,plan:p};return out;
}
function v3rVertex(p,n) {return {p:p.clone(),n:n.clone()};}
function v3rLerp(a,b,t) {return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()};}
function v3rPlaneValue(p,v) {return p[0]*v.x+p[1]*v.y+p[2]*v.z+p[3];}
function v3rKey(p) {return `${Math.round(p.x*1e6)},${Math.round(p.y*1e6)},${Math.round(p.z*1e6)}`;}

function v3rCapIndices(contour,xy) {
  const queue=THREE.ShapeUtils.triangulateShape(xy,[]).filter(ids=>contour[ids[1]].clone().sub(contour[ids[0]]).cross(contour[ids[2]].clone().sub(contour[ids[0]])).lengthSq()>1e-18),out=[];
  // Earcut omits some collinear boundary vertices. Reinsert those vertices by
  // splitting the adjacent NON-degenerate triangle, instead of adding zero-area
  // triangles whose normals become unstable after Float32 conversion.
  for(let guard=0;queue.length&&guard<5000;guard++) {
    const ids=queue.pop();let split=false;
    for(let edge=0;edge<3&&!split;edge++) {
      const ai=ids[edge],bi=ids[(edge+1)%3],ci=ids[(edge+2)%3],a=contour[ai],b=contour[bi],ab=b.clone().sub(a),l2=ab.lengthSq();
      if(l2<1e-18)continue;
      const middle=[];
      for(let pi=0;pi<contour.length;pi++) {
        if(ids.includes(pi))continue;const ap=contour[pi].clone().sub(a),t=ap.dot(ab)/l2;
        if(t>1e-7&&t<1-1e-7&&ap.clone().addScaledVector(ab,-t).lengthSq()<1e-14)middle.push([t,pi]);
      }
      if(middle.length) {
        middle.sort((a,b)=>a[0]-b[0]);const chain=[ai,...middle.map(v=>v[1]),bi];
        for(let i=0;i<chain.length-1;i++)queue.push([chain[i],chain[i+1],ci]);split=true;
      }
    }
    if(!split)out.push(ids);
  }
  return out;
}

/** Clip an already closed tile by vertical half spaces, capping every cut.
 * Retained side is >=0. Original curved surface normals are interpolated;
 * saw-cut caps have their own outward normals. No black mask or hidden plane.
 */
function v3rClipTriangles(triangles,planes,diagnostics) {
  for(const plane of planes) {
    let min=Infinity,max=-Infinity;
    for(const t of triangles)for(const v of t){const d=v3rPlaneValue(plane,v.p);min=Math.min(min,d);max=Math.max(max,d);}
    if(max<-v3rEPS)return [];
    if(min>=-v3rEPS)continue;
    const next=[],segments=[];
    for(const tri of triangles) {
      const out=[];let anyOut=false;
      for(let i=0;i<3;i++) {
        const a=tri[i],b=tri[(i+1)%3],da=v3rPlaneValue(plane,a.p),db=v3rPlaneValue(plane,b.p);
        if(da>=-v3rEPS)out.push(a);else anyOut=true;
        if((da>v3rEPS&&db<-v3rEPS)||(da<-v3rEPS&&db>v3rEPS))out.push(v3rLerp(a,b,da/(da-db)));
      }
      if(out.length<3)continue;
      for(let i=1;i<out.length-1;i++) {
        if(out[i].p.clone().sub(out[0].p).cross(out[i+1].p.clone().sub(out[0].p)).lengthSq()>1e-20)next.push([out[0],out[i],out[i+1]]);
      }
      if(anyOut) {
        const on=out.filter(v=>Math.abs(v3rPlaneValue(plane,v.p))<1e-6);
        const unique=[...new Map(on.map(v=>[v3rKey(v.p),v.p])).values()];
        if(unique.length===2&&unique[0].distanceToSquared(unique[1])>1e-16)segments.push(unique);
      }
    }
    if(!next.length)return [];
    const points=new Map(),edges=new Map(),adj=new Map();
    for(const [a,b]of segments) {
      const ka=v3rKey(a),kb=v3rKey(b);if(ka===kb)continue;
      points.set(ka,a);points.set(kb,b);const key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
      if(edges.has(key))continue;edges.set(key,[ka,kb]);
      for(const [u,v]of[[ka,kb],[kb,ka]]){if(!adj.has(u))adj.set(u,[]);adj.get(u).push(v);}
    }
    const normal=new THREE.Vector3(-plane[0],-plane[1],-plane[2]).normalize();
    const u=new THREE.Vector3().crossVectors(Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),normal).normalize();
    const v=new THREE.Vector3().crossVectors(normal,u).normalize();
    const unused=new Set(edges.keys());
    while(unused.size) {
      const firstKey=unused.values().next().value,[start,second]=edges.get(firstKey),keys=[start];
      unused.delete(firstKey);let prev=start,cur=second,closed=false;
      for(let guard=0;guard<edges.size+2;guard++) {
        if(cur===start){closed=true;break;}keys.push(cur);
        const candidates=(adj.get(cur)||[]).filter(k=>{const e=cur<k?`${cur}|${k}`:`${k}|${cur}`;return unused.has(e);});
        const to=candidates.find(k=>k!==prev)||candidates[0];if(!to)break;
        const ek=cur<to?`${cur}|${to}`:`${to}|${cur}`;unused.delete(ek);prev=cur;cur=to;
      }
      if(!closed){diagnostics.openCapLoops++;continue;}
      const contour=keys.map(k=>points.get(k)),xy=contour.map(p=>new THREE.Vector2(p.dot(u),p.dot(v)));
      for(const ids of v3rCapIndices(contour,xy)) {
        const a=contour[ids[0]],b=contour[ids[1]],c=contour[ids[2]];
        const cross=b.clone().sub(a).cross(c.clone().sub(a));
        // Earcut can emit a collinear cap triangle between consecutive cuts.
        // Its area is zero in double precision but Float32 rounding can flip
        // its face normal, so omit it before conversion to render buffers.
        if(cross.lengthSq()<1e-18)continue;
        if(cross.dot(normal)<0)[ids[1],ids[2]]=[ids[2],ids[1]];
        next.push(ids.map(i=>v3rVertex(contour[i],normal)));
      }
    }
    triangles=next;
  }
  return triangles;
}
function v3rGeometryTriangles(geometry,matrix) {
  const pos=geometry.attributes.position,norm=geometry.attributes.normal,idx=geometry.index?.array;
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),verts=[];
  for(let i=0;i<pos.count;i++)verts.push({p:new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix),n:new THREE.Vector3().fromBufferAttribute(norm,i).applyMatrix3(normalMatrix).normalize()});
  const out=[],count=idx?idx.length:pos.count;
  for(let i=0;i<count;i+=3)out.push([verts[idx?idx[i]:i],verts[idx?idx[i+1]:i+1],verts[idx?idx[i+2]:i+2]]);
  return out;
}
function v3rTrianglesGeometry(tris,color) {
  const pos=[],norm=[],colors=[],col=new THREE.Color(color);
  for(const t of tris)for(const v of t){pos.push(v.p.x,v.p.y,v.p.z);norm.push(v.n.x,v.n.y,v.n.z);colors.push(col.r,col.g,col.b);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeBoundingSphere();return geo;
}
function v3rAddToBuffer(buffer,tris,color) {
  const col=new THREE.Color(color),start=buffer.pos.length/9;
  for(const source of tris) {
    const t=[...source],fp=t.map(v=>new THREE.Vector3(Math.fround(v.p.x),Math.fround(v.p.y),Math.fround(v.p.z)));
    const cross=fp[1].clone().sub(fp[0]).cross(fp[2].clone().sub(fp[0])),normal=t[0].n.clone().add(t[1].n).add(t[2].n);
    // A few micron-scale cap slivers can reverse winding only when rounded to
    // Float32. Correct those slivers against the already established outward
    // cap normal; do not mask a reversal on a substantive surface triangle.
    if(cross.dot(normal)<0&&cross.length()<1e-7){[t[1],t[2]]=[t[2],t[1]];buffer.roundoffFlips=(buffer.roundoffFlips||0)+1;}
    for(const v of t){buffer.pos.push(v.p.x,v.p.y,v.p.z);buffer.norm.push(v.n.x,v.n.y,v.n.z);buffer.colors.push(col.r,col.g,col.b);}
  }
  buffer.pieces.push({firstTriangle:start,triangleCount:tris.length});
}

function v3rTileFace(parent,face,rm,segments,seed,diagnostics) {
  const root=group(parent,face.name,{kind:'v3-physical-tiled-face',faceId:face.id,roofOwner:face.owner,planDomains:face.tilePolys,roofPreview:{polys:face.tilePolys,origin:face.origin,normal:face.normal,uphill:face.uphill}});
  const domains=face.tilePolys.map(p=>({poly:p,planes:v3rPlanes(p),bounds:v3rBounds(p)}));
  const n=new THREE.Vector3(...face.normal),v=new THREE.Vector3(...face.uphill),u=new THREE.Vector3().crossVectors(n,v).normalize();
  const origin=new THREE.Vector3(...face.origin),frame=new THREE.Matrix4().makeBasis(u,n,v),buckets=new Map();
  const cutBuffer={pos:[],norm:[],colors:[],pieces:[]};let nominal=0,clipped=0,full=0,discarded=0;
  const pitch=.19,L=.24,columns=Math.ceil(face.width/pitch)+2;
  for(const spec of [
    {name:'底瓦',cover:false,step:.095,width0:.178,width1:.198,rise:.027,lift:.018,base:0,count:columns},
    {name:'盖瓦',cover:true,step:.075,width0:.145,width1:.125,rise:.040,lift:.024,base:.040,count:columns+1},
  ])for(let col=0;col<spec.count;col++) {
    const across=(col-(spec.count-1)/2)*pitch;
    for(let row=0,start=-.045;start<face.length+.020;row++,start+=spec.step) {
      let w0=spec.width0,w1=spec.width1;if(!spec.cover&&row===0)[w0,w1]=[w1,w0];
      const variant=Math.floor(v3rHash(seed+col,row,spec.cover?9:4)*3);
      const geo=v3rShellNormals(v2RoofTileGeometry({length:L,width0:w0,width1:w1,rise:spec.rise,thickness:.006,segments,lift0:spec.lift,lift1:0,convex:spec.cover,variant}));
      const center=origin.clone().addScaledVector(u,across).addScaledVector(v,start+L/2).addScaledVector(n,spec.base),matrix=frame.clone().setPosition(center);
      const color=Math.floor(v3rHash(seed,col,row+(spec.cover?99:37))*v3rPalette.length);
      const pos=geo.attributes.position,world=[];let minX=Infinity,maxX=-Infinity,minS=Infinity,maxS=-Infinity;
      for(let i=0;i<pos.count;i++){const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);world.push(p);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minS=Math.min(minS,-p.z);maxS=Math.max(maxS,-p.z);}
      let contributed=false,raw=null;
      for(const domain of domains) {
        const b=domain.bounds;if(maxX<b.x0-v3rEPS||minX>b.x1+v3rEPS||maxS<b.s0-v3rEPS||minS>b.s1+v3rEPS)continue;
        let allInside=true,outside=false;
        for(const plane of domain.planes) {let min=Infinity,max=-Infinity;for(const p of world){const d=v3rPlaneValue(plane,p);min=Math.min(min,d);max=Math.max(max,d);}if(max<-v3rEPS){outside=true;break;}if(min<-v3rEPS)allInside=false;}
        if(outside)continue;
        if(allInside) {
          const key=spec.name+'|'+geo.uuid;if(!buckets.has(key))buckets.set(key,{geo,entries:[],name:spec.name});
          buckets.get(key).entries.push({matrix,color});full++;contributed=true;break;
        }
        if(!raw)raw=v3rGeometryTriangles(geo,matrix);
        const clippedTris=v3rClipTriangles(raw,domain.planes,diagnostics);
        if(clippedTris.length){v3rAddToBuffer(cutBuffer,clippedTris,v3rPalette[color]);clipped++;contributed=true;}
      }
      if(contributed)nominal++;else discarded++;
    }
  }
  for(const {geo,entries,name}of buckets.values()) {
    const batch=v2RoofBatch(root,`${name}_闭合弧壳_实体实例`,entries,geo,rm.tile,v3rPalette);
    batch.userData={...batch.userData,v3RoofRole:'tile',faceId:face.id,roofOwner:face.owner};
  }
  if(cutBuffer.pos.length) {
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(cutBuffer.pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(cutBuffer.norm,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cutBuffer.colors,3));geo.computeBoundingSphere();
    geo.userData={kind:'closed-clipped-curved-tiles',nominalThickness:.006,pieces:cutBuffer.pieces};
    const mat=rm.tile.clone();mat.name='MAT_V3_裁切弧壳瓦_顶点色';mat.vertexColors=true;
    const object=mesh(root,'边界与谷沟_逐片裁切并封口的瓦',geo,mat);object.userData={v3RoofRole:'tile',faceId:face.id,roofOwner:face.owner,clippedPieces:clipped};
  }
  root.userData={...root.userData,nominalTiles:nominal,uncutTiles:full,clippedPieces:clipped,discardedCandidates:discarded,length:.24,thickness:.006,panExposure:.095,coverExposure:.075,curveSegments:segments,float32SliverWindingCorrections:cutBuffer.roundoffFlips||0};
  diagnostics.faces.push({id:face.id,nominalTiles:nominal,uncutTiles:full,clippedPieces:clipped,float32SliverWindingCorrections:cutBuffer.roundoffFlips||0});
  return root;
}

function v3rLinePrism(parent,name,plan,heights,thickness,material) {
  const n=plan.length,pos=[],idx=[];
  for(let layer=0;layer<2;layer++)for(let i=0;i<n;i++)pos.push(plan[i][0],heights[i]-layer*thickness,-plan[i][1]);
  const xy=plan.map(p=>new THREE.Vector2(...p)),faces=THREE.ShapeUtils.triangulateShape(xy,[]);
  for(const t of faces){const a=new THREE.Vector3(...pos.slice(t[0]*3,t[0]*3+3)),b=new THREE.Vector3(...pos.slice(t[1]*3,t[1]*3+3)),c=new THREE.Vector3(...pos.slice(t[2]*3,t[2]*3+3));if(b.clone().sub(a).cross(c.clone().sub(a)).y<0)[t[1],t[2]]=[t[2],t[1]];idx.push(...t,t[0]+n,t[2]+n,t[1]+n);}
  const sign=v3rArea(plan)>0?1:-1;
  for(let i=0;i<n;i++){const j=(i+1)%n;if(sign>0)idx.push(i,n+i,n+j,i,n+j,j);else idx.push(i,n+j,n+i,i,j,n+j);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);const g=geo.toNonIndexed();geo.dispose();g.computeVertexNormals();g.computeBoundingSphere();g.userData={kind:'v3-solid-folded-sheet',thickness};return mesh(parent,name,g,material);
}

/** Four sloping open valleys; pan overlap goes UNDER the cut tiles. */
function v3rValley(parent,name,a,b,rm,bounds,diagnostics) {
  const root=group(parent,name,{kind:'v3-open-valley',high:a,low:b,clearTileGap:.15,linerWidth:.34,thickness:.0025});
  const dx=b[0]-a[0],ds=b[1]-a[1],L=Math.hypot(dx,ds),tx=dx/L,ts=ds/L,ux=-ts,us=tx;
  const start=-.14,end=L+.22,drop=(a[2]-b[2])/L;
  const profile=[[-.17,.0514],[-.075,.0106],[-.055,.002],[.055,.002],[.075,.0106],[.17,.0514]];
  for(let i=0;i<profile.length-1;i++) {
    const [u0,h0]=profile[i],[u1,h1]=profile[i+1];
    let p=[[a[0]+tx*start+ux*u0,a[1]+ts*start+us*u0],[a[0]+tx*end+ux*u0,a[1]+ts*end+us*u0],[a[0]+tx*end+ux*u1,a[1]+ts*end+us*u1],[a[0]+tx*start+ux*u1,a[1]+ts*start+us*u1]];
    for(const plane of [[1,0,-bounds.x0],[-1,0,bounds.x1],[0,1,-bounds.s0],[0,-1,bounds.s1]])p=v3rClipPoly(p,plane);
    if(p.length<3)continue;
    const height=(x,s)=>{const along=(x-a[0])*tx+(s-a[1])*ts,cross=(x-a[0])*ux+(s-a[1])*us;return a[2]-drop*along+h0+(cross-u0)*(h1-h0)/(u1-u0);};
    const g=v3rPrism(p,height,.0025);g.userData.kind='v3-valley-sheet';
    const m=mesh(root,`连续折面沟底_${i+1}`,g,rm.metal);m.userData.v3RoofRole='valley';
  }
  diagnostics.valleys.push({name,high:a,low:b,planLength:L,fall:a[2]-b[2],slope:drop,linerWidth:.34,clearGap:.15});return root;
}

function v3rGutter(parent,name,a,b,rm,segments=6) {
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),length=va.distanceTo(vb);
  if(length<.1)return null;
  const geo=v2RoofTileGeometry({length,width0:.14,width1:.14,rise:.045,thickness:.0025,segments,lift0:0,lift1:0,convex:false,variant:0});
  const out=mesh(parent,name,geo,rm.metal),v=vb.clone().sub(va).normalize(),up=new THREE.Vector3(0,1,0),u=new THREE.Vector3().crossVectors(up,v).normalize(),n=new THREE.Vector3().crossVectors(v,u).normalize();
  out.matrixAutoUpdate=false;out.matrix.makeBasis(u,n,v).setPosition(va.clone().add(vb).multiplyScalar(.5));out.userData={v3RoofRole:'eave-gutter',openChannel:true,thickness:.0025};return out;
}

// 为凸形外墙铺同模数实体砖，边界砖沿真实斜边裁切；u 为世界 X 或世界 Z。
function v3BrickFace(parent,name,outline,{axis='x',fixed,sign=1,mats,seed=27}){
  const face=group(parent,name,{finish:'exposed-brick',surface:'geometric masonry',brickGrid:[.239,.073],axis,sign});
  const direction=axis==='x'?sign:-sign;
  face.rotation.y=axis==='x'?(sign>0?0:Math.PI):(sign>0?Math.PI/2:-Math.PI/2);
  if(axis==='x')face.position.z=fixed;else face.position.x=fixed;
  const mat=mats.redBrick.clone();mat.color.setHex(0xffffff);mat.vertexColors=true;mat.name='外墙斜边_统一红砖';
  const area=outline.reduce((v,a,i)=>{const b=outline[(i+1)%outline.length];return v+a[0]*b[1]-b[0]*a[1];},0),winding=area>=0?1:-1;
  const planes=outline.map((a,i)=>{const b=outline[(i+1)%outline.length];return p=>winding*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));});
  const clip=(poly,fn)=>{const out=[];for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],fa=fn(a),fb=fn(b);if(fa>=-1e-9)out.push(a);
    if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }return out;};
  const minU=Math.min(...outline.map(p=>p[0])),maxU=Math.max(...outline.map(p=>p[0]));
  const minY=Math.min(...outline.map(p=>p[1])),maxY=Math.max(...outline.map(p=>p[1])),matrices=[],colors=[];
  for(let row=Math.floor(minY/.073);row*.073<maxY;row++){
    const lo=Math.max(minY,row*.073+.006),hi=Math.min(maxY,(row+1)*.073-.006),offset=(row%2)*.239/2;
    for(let col=Math.floor((minU-offset)/.239);col*.239+offset<maxU;col++){
      const a=Math.max(minU,col*.239+offset+.006),b=Math.min(maxU,(col+1)*.239+offset-.006);
      if(b-a<.012||hi-lo<.001)continue;
      let p=[[a,lo],[b,lo],[b,hi],[a,hi]];
      const depth=.022+.006*v2Hash(col,row,seed),color=v2Color(0x8e6250,.94+Math.floor(v2Hash(col,row,seed)*5)*.012);
      if(planes.every(fn=>p.every(v=>fn(v)>=-1e-9))){
        matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(direction*(a+b)/2,(lo+hi)/2,depth/2-.002),new THREE.Quaternion(),new THREE.Vector3(b-a,hi-lo,depth)));
        colors.push(color);continue;
      }
      for(const fn of planes){p=clip(p,fn);if(p.length<3)break;}
      const clippedArea=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
      if(p.length<3||Math.abs(clippedArea)<1e-7)continue;
      const brick=jn_shape(face,'沿边界裁切的实体砖',p.map(([u,y])=>[u*direction,y]),-.002,depth,mat,row*31+col);
      const c=brick.geometry.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,color.r,color.g,color.b);
    }
  }
  if(matrices.length){
    const geometry=masonryBrickGeometry();
    if(!geometry.attributes.color)geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
    const inst=new THREE.InstancedMesh(geometry,mat,matrices.length);inst.name='同模数砌筑砖';
    matrices.forEach((m,i)=>{inst.setMatrixAt(i,m);inst.setColorAt(i,colors[i]);});inst.castShadow=inst.receiveShadow=true;face.add(inst);
  }
  consolidate(face);return face;
}

function v3rGable(parent,name,x0,x1,s0,s1,eave,ridgeS,ridgeY,rm,mats,exteriorSign,redBrick,wallSeedName) {
  const bottom=eave-(redBrick?.14:.02),top=ridgeY-(redBrick?.14:.022);
  const shape=new THREE.Shape();shape.moveTo(s0,bottom);shape.lineTo(s1,bottom);shape.lineTo(ridgeS,top);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:x1-x0,bevelEnabled:false});g.rotateY(Math.PI/2);g.translate(x0,0,0);
  const out=mesh(parent,name,g,redBrick?mats.mortar:rm.plaster);out.userData={v3RoofRole:'gable',solidThickness:x1-x0,roofUndersideOffset:redBrick?.14:.022,bottom};
  if(!redBrick){
    // Match the wall's plaster skin position (+37 mm) and colour, including its quiet ageing.
    const seed=v2NameSeed('背景山墙'),pos=[],col=[],uv=[];
    const shade=(u,y)=>.955+.012*Math.sin(u*.73+y*.31+seed*.08)+.008*Math.sin(u*1.7-y*.92)-.022*Math.exp(-Math.max(0,top-y)/.50);
    const a=new THREE.Vector2(-s1,eave),b=new THREE.Vector2(-s0,eave),c=new THREE.Vector2(-ridgeS,top);
    const n=24,fixed=(exteriorSign>0?x1:x0)+exteriorSign*.037;
    const point=(i,j)=>a.clone().addScaledVector(b.clone().sub(a),i/n).addScaledVector(c.clone().sub(a),j/n);
    const emit=(ps)=>{if(exteriorSign<0)ps.reverse();for(const p of ps){pos.push(fixed,p.y,p.x);const cc=v2Color(0xc2bcad,shade(p.x,p.y));col.push(cc.r,cc.g,cc.b);uv.push(p.x,p.y);}};
    for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){emit([point(i,j),point(i,j+1),point(i+1,j)]);if(i+j<n-1)emit([point(i+1,j),point(i,j+1),point(i+1,j+1)]);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    const mat=mats.plaster.clone();mat.color.set(0xffffff);mat.vertexColors=true;mat.name='背景山墙_接续下墙旧灰泥';mesh(parent,'山墙外侧_连续灰泥饰面',geo,mat);
  }
  if(redBrick)v3BrickFace(parent,'三角山墙清水红砖',[[-s1,bottom],[-s0,bottom],[-ridgeS,top]],{
    axis:'z',fixed:exteriorSign>0?x1:x0,sign:exteriorSign,mats,seed:v2NameSeed(wallSeedName||(exteriorSign>0?'东':'西')+'_主屋承重墙')+v2BuildSeed});
  return out;
}

function v3rDormer(parent,rm,detail,roofHeight,diagnostics,mats) {
  const d=v3rDormerSpec;
  const root=group(parent,'单一老虎窗_实体小瓦顶与贯通屋面洞',{kind:'v3-dormer',roofOpening:{x0:d.x0,x1:d.x1,s0:d.front,s1:d.back},glassOpening:{x0:d.glassX0,x1:d.glassX1,y0:d.glassBottom,y1:d.glassTop},atticFloor:d.atticFloor,sillAboveAttic:d.glassBottom-d.atticFloor,designUse:'guarded attic lighting and high sightline; not a standard habitable-room window'});
  const {x0,x1,front,back,eave,ridgeX,roofX0,roofX1}=d,rf=d.roofFront,rb=d.roofBack,k=Math.tan(Math.PI/6),ridge=eave+.58*k;
  const winLo=d.glassBottom,winHi=d.glassTop,winMid=(winLo+winHi)/2,winHeight=winHi-winLo;
  const bottom=roofHeight(0,front)-.085,wallEave=eave+(.58-Math.abs(x0-ridgeX))*k-.073,wallRidge=ridge-.073;
  const rect=(a,b,lo,hi)=>[[a,lo],[b,lo],[b,hi],[a,hi]];
  const face=(name,poly,axis,fixed,sign)=>v3BrickFace(root,name,poly,{axis,fixed,sign,mats,seed:v2NameSeed(name)+v2BuildSeed});
  for(const [a,b]of[[x0,1.27],[1.93,x1]]){
    box(root,'老虎窗实体侧窗墩',(a+b)/2,(bottom+wallEave)/2,-(front+.0375),b-a,wallEave-bottom,.075,rm.mortar);
    face('老虎窗正面窗墩红砖',rect(a,b,bottom,wallEave),'x',-front,1);
  }
  box(root,'老虎窗实体窗台下墙',1.6,(bottom+winLo)/2,-(front+.0375),.66,winLo-bottom,.075,rm.mortar);
  face('老虎窗窗台下红砖',rect(1.27,1.93,bottom,winLo),'x',-front,1);
  box(root,'老虎窗实体窗过梁',1.6,(winHi+wallEave)/2,-(front+.0375),.66,wallEave-winHi,.075,rm.mortar);
  face('老虎窗窗上红砖',rect(1.27,1.93,winHi,wallEave),'x',-front,1);
  for(const [x,label]of[[x0,'西'],[x1-.075,'东']]) {
    const shape=new THREE.Shape();shape.moveTo(front,roofHeight(0,front)-.085);shape.lineTo(back,roofHeight(0,back)-.085);shape.lineTo(back,wallEave);shape.lineTo(front,wallEave);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:false});geo.rotateY(Math.PI/2);geo.translate(x,0,0);mesh(root,`${label}_老虎窗侧壁`,geo,rm.mortar);
    face(`${label}_老虎窗侧壁红砖`,[[-front,bottom],[-back,roofHeight(0,back)-.085],[-back,wallEave],[-front,wallEave]],'z',label==='西'?x0:x1,label==='西'?-1:1);
  }
  for(const [s,base,label]of[[front,wallEave,'前山花'],[back,roofHeight(0,back)-.085,'后实心封板']]) {
    const poly=[[x0,base],[x1,base],[x1,wallEave],[ridgeX,wallRidge],[x0,wallEave]];
    const unique=poly.filter((p,i)=>!i||p[0]!==poly[i-1][0]||p[1]!==poly[i-1][1]);
    if(unique.length>1&&unique[0][0]===unique.at(-1)[0]&&unique[0][1]===unique.at(-1)[1])unique.pop();
    jn_shape(root,`老虎窗_${label}`,unique,s===front?-s-.075:-s,.075,rm.mortar);
    face(`老虎窗_${label}红砖`,unique,'x',-s,s===front?1:-1);
  }
  const win=timberWindow(root,'老虎窗_实木双扇玻璃窗',1.6,winLo,-front+.014,.66,winHeight,mats,{residential:true,dormer:true,panels:2});
  box(win,'实木滴水窗台',0,-.025,.018,.78,.045,.15,rm.wood);
  // The apron and side sheets lie below the remaining clay tiles; their upstands meet the cheek walls.
  for(const [name,p]of[
    ['西侧坡面泛水',v3rPolygon(.92,x0,d.apronFront,d.flashingBack)],['东侧坡面泛水',v3rPolygon(x1,2.28,d.apronFront,d.flashingBack)],
    ['窗前下口围裙',v3rPolygon(roofX0,roofX1,d.apronFront,front)],['后侧背水板',v3rPolygon(roofX0,roofX1,back,d.flashingBack)],
  ])mesh(root,name,v3rPrism(p,roofHeight,.003,-.012),rm.metal);
  for(const x of[x0-.003,x1]) {
    const sh=new THREE.Shape();sh.moveTo(front,roofHeight(0,front)-.014);sh.lineTo(back,roofHeight(0,back)-.014);sh.lineTo(back,Math.min(eave,roofHeight(0,back)+.12));sh.lineTo(front,roofHeight(0,front)+.12);sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:.003,bevelEnabled:false});g.rotateY(Math.PI/2);g.translate(x,0,0);mesh(root,'侧壁泛水立边',g,rm.metal);
  }
  const faces=[];
  for(const [side,lo,hi,origin,uphill,normal]of[
    ['西',roofX0,ridgeX,[roofX0,eave,-(rf+rb)/2],[Math.cos(Math.PI/6),.5,0],[-.5,Math.cos(Math.PI/6),0]],
    ['东',ridgeX,roofX1,[roofX1,eave,-(rf+rb)/2],[-Math.cos(Math.PI/6),.5,0],[.5,Math.cos(Math.PI/6),0]],
  ]) {
    const h=(x,s)=>eave+(.58-Math.abs(x-ridgeX))*k,poly=v3rPolygon(lo,hi,rf,rb);
    mesh(root,`${side}_小顶实木望板`,v3rPrism(poly,h,.055,-.018),rm.woodDark);
    faces.push({id:`dormer-${side}`,owner:'dormer',name:`${side}_老虎窗真实小瓦坡`,origin,uphill,normal,width:rb-rf,length:.58/Math.cos(Math.PI/6),tilePolys:[poly]});
  }
  for(let i=0;i<faces.length;i++)v3rTileFace(root,faces[i],rm,detail==='low'?3:4,581+i*79,diagnostics);
  v2RoofRidge(root,'老虎窗_分片小脊瓦',{start:[ridgeX,-rf],end:[ridgeX,-rb],y:ridge+.040,width:.20,rise:.048,segments:detail==='low'?4:6},rm);
  root.userData.eave=eave;root.userData.ridge=ridge;return root;
}

// 端墙从二层墙顶起砌，砖缝使用同一全局网格，砖块按屋面下沿真实裁切。
function v3WingEndGable(parent,mats,north,heightAt,ridgeX) {
  const x0=4.02,x1=7.2,bottom=6.7,underside=x=>heightAt(x)-.14;
  const root=group(parent,north?'东厢后侧三角山墙':'东厢临街三角砖山墙',{
    kind:north?'wing-rear-gable':'wing-front-gable',bottom,roofUndersideOffset:.14,brickGrid:[.239,.073],solid:true});
  const outline=[[x0,bottom],[x1,bottom],[x1,underside(x1)],[ridgeX,underside(ridgeX)],[x0,underside(x0)]];
  const z=north?-15:-.24;
  jn_shape(root,'山墙连续实体',outline,z,.24,mats.mortar);
  v3BrickFace(root,'侧厢三角山墙清水红砖',outline,{axis:'x',fixed:north?-15:0,sign:north?-1:1,mats,
    seed:v2NameSeed((north?'北':'南')+'_侧厢二层外墙')+v2BuildSeed});
  jn_shape(root,'山墙内侧抹面',outline,north?z+.24:z-.004,.004,mats.interiorPlaster);
  // 山墙的侧面也是外墙：补齐檐下 24 cm 深的转角砖，避免露出灰色墙芯。
  v3BrickFace(root,'侧厢山墙东端_檐下转角补砖',[[z,bottom],[z+.24,bottom],[z+.24,underside(x1)],[z,underside(x1)]],{
    axis:'z',fixed:x1,sign:1,mats,seed:v2NameSeed('东_厢房檐墙')+v2BuildSeed});
  // 西侧既有墙端保留至 6.91 m；加宽后的屋盖只补它上方的封口，不重砌或挤占墙身。
  const closureRoot=group(root,'加宽屋檐_独立墙顶封口',{kind:'roof-infill'});
  const closure=[[3.84,6.91],[x0,6.91],[x0,underside(x0)],[3.84,underside(3.84)]];
  jn_shape(closureRoot,'加宽屋檐下_墙顶封口',closure,z,.24,mats.mortar);
  v3BrickFace(closureRoot,'加宽屋檐下_墙顶封口红砖',closure,{axis:'x',fixed:north?-15:0,sign:north?-1:1,mats,
    seed:v2NameSeed((north?'北':'南')+'_侧厢二层外墙')+v2BuildSeed});
  jn_shape(closureRoot,'加宽屋檐下_内侧封口',closure,north?z+.24:z-.004,.004,mats.interiorPlaster);
  consolidate(root);return root;
}

function v3BuildRoof(parent,mats,detail,reg,options={}) {
  const type=options.type==='A'?'A':'B',hero=detail!=='low',width=Number(options.width||(type==='A'?3.6:7.2));
  const range=type==='A'&&options.mainS?options.mainS:[3,10.74],s0=Number(range[0]),s1=Number(range[1]),eave=Number(options.eaveHeight??7.05);
  if(!(width>.4&&s1>s0+.4))throw new Error('v3BuildRoof requires width > .4 and an increasing mainS.');
  const pitch=Math.PI/6,k=Math.tan(pitch),sin=.5,cos=Math.cos(pitch),ridgeS=(s0+s1)/2,half=(s1-s0)/2,ridgeY=eave+half*k,overhang=.16;
  const mainH=(x,s)=>eave+(half-Math.abs(s-ridgeS))*k;
  // 西檐须盖过中隔墙及其外侧红砖（最外约 X=3.809），不能沿室内净边 X=4.02 截断。
  // 保持东檐与 30° 坡度，屋脊、交谷、瓦面和望板共用加宽后的跨度。
  const withWing=type==='B',wx0=3.78,wx1=7.2,wr=(wx0+wx1)/2,wh=(wx1-wx0)/2,wingH=(x,s)=>eave+(wh-Math.abs(x-wr))*k,wingRidge=eave+wh*k;
  // Both standard A and B homes have the west terrace bridge. Custom short
  // street roofs opt out by mainS, or callers may specify westBridge directly.
  const hasWestBridge=options.westBridge??(withWing||!options.mainS);
  if(withWing&&Math.abs(width-7.2)>.001)throw new Error('B roof is the approved 7.20 m type; use type A for arbitrary width.');
  // Architectural presence is an explicit per-home decision; detail only changes tessellation.
  const dormer=options.dormer===true;
  const rm=v2RoofMaterials(mats),root=group(parent,`V3_${type}_实体相交屋盖`,{kind:'v3-roof',type,width,mainS:[s0,s1],pitchDegrees:30,eaveHeight:eave,mainRidge:[width/2,ridgeY,-ridgeS],usesTextures:false,partyWest:!!options.partyWest,partyEast:!!options.partyEast,hasDormer:dormer,hasWestBridge:!!hasWestBridge});
  const diagnostics={openCapLoops:0,faces:[],valleys:[],dimensionsAreDesignEstimates:true};
  const ds=v3rDormerSpec;
  const holes=dormer?[{x0:ds.x0,x1:ds.x1,s0:ds.front,s1:ds.back}]:[],tileHoles=dormer?[{x0:ds.tileX0,x1:ds.tileX1,s0:ds.tileFront,s1:ds.tileBack}]:[];
  const delta=.075*Math.SQRT2,baseFaces=[],tileFaces=[];
  function addFace(id,name,owner,height,origin,uphill,normal,length,span,base,tile) {
    const bp=v3rWithHoles(base,owner==='main'?holes:[]),tp=v3rWithHoles(tile,owner==='main'?tileHoles:[]);
    baseFaces.push({id,height,polys:bp});tileFaces.push({id,name,owner,origin,uphill,normal,length,width:span,tilePolys:tp});
  }
  for(const north of[false,true]) {
    const a=north?ridgeS:s0-overhang,b=north?s1+overhang:ridgeS,originS=north?s1+overhang:s0-overhang;
    let bp=[v3rPolygon(0,width,a,b)],tp=bp;
    if(withWing) {
      // Diagonals are x+s <= s1+wx0 / s-x >= s0-wx0 etc.
      const westPlane=north?[-1,-1,s1+wx0]:[-1,1,wx0-s0];
      const eastPlane=north?[1,-1,s1-wx1]:[1,1,-s0-wx1];
      bp=[v3rPolygon(0,wx0,a,b),v3rPolygon(wx0,wr,a,b,[westPlane]),v3rPolygon(wr,wx1,a,b,[eastPlane])];
      // Continue the western diagonal to the short outlet overhang; a metal pan covers this small end cut.
      tp=[v3rPolygon(0,wr,a,b,[[westPlane[0],westPlane[1],westPlane[2]-delta]]),v3rPolygon(wr,wx1,a,b,[[eastPlane[0],eastPlane[1],eastPlane[2]-delta]])];
    }
    addFace(north?'main-north':'main-south',north?'主屋北坡_裁谷沟真实瓦':'主屋南坡_裁谷沟真实瓦','main',mainH,[width/2,mainH(0,originS),-originS],[0,sin,north?cos:-cos],[0,cos,north?-sin:sin],(half+overhang)/cos,width,bp,tp);
  }
  if(withWing)for(const east of[false,true]) {
    const lo=east?wr:wx0,hi=east?wx1:wr,originX=east?wx1:wx0;
    const frontPlane=east?[-1,-1,s0+wx1]:[1,-1,s0-wx0];
    const rearPlane=east?[-1,1,wx1-s1]:[1,1,-s1-wx0];
    const bp=[v3rPolygon(lo,hi,-overhang,15+overhang,[frontPlane]),v3rPolygon(lo,hi,-overhang,15+overhang,[rearPlane])];
    const tp=[v3rPolygon(lo,hi,-overhang,15+overhang,[[...frontPlane.slice(0,2),frontPlane[2]-delta]]),v3rPolygon(lo,hi,-overhang,15+overhang,[[...rearPlane.slice(0,2),rearPlane[2]-delta]])];
    addFace(east?'wing-east':'wing-west',east?'东厢东坡_前后两段实体瓦':'东厢西坡_前后两段实体瓦','wing',wingH,[originX,eave,-7.5],[east?-cos:cos,sin,0],[east?sin:-sin,cos,0],wh/cos,15+2*overhang,bp,tp);
  }
  const substrate=group(root,'上包络屋面_有厚度望板与灰背',{kind:'v3-envelope-substrate',verticalThickness:.118,topOffset:-.022});
  for(const face of baseFaces)for(let i=0;i<face.polys.length;i++) {
    if(face.polys[i].length<3)continue;
    const m=mesh(substrate,`${face.id}_裁交线实体望板_${i+1}`,v3rPrism(face.polys[i],face.height,.118,-.022),rm.woodDark);m.userData={v3RoofRole:'substrate',faceId:face.id};
  }
  const seed=Number(options.seed??1941);
  for(let i=0;i<tileFaces.length;i++)v3rTileFace(root,tileFaces[i],rm,hero?4:3,seed+i*173,diagnostics);
  if(withWing) {
    v3WingEndGable(root,mats,false,x=>wingH(x,0),wr);
    v3WingEndGable(root,mats,true,x=>wingH(x,15),wr);
    const vf=s0+wh,vr=s1-wh;
    for(const [name,a,b]of[
      ['南西谷沟',[wr,vf,wingRidge],[wx0,s0,eave]],['南东谷沟',[wr,vf,wingRidge],[wx1,s0,eave]],
      ['北西谷沟',[wr,vr,wingRidge],[wx0,s1,eave]],['北东谷沟',[wr,vr,wingRidge],[wx1,s1,eave]],
    ])v3rValley(root,name,a,b,rm,{x0:b[0]<wr?0:wr,x1:b[0]<wr?wr:width,s0:-overhang,s1:15+overhang},diagnostics);
    for(const [name,a,b]of[['东厢前脊',-.13,vf-.20],['东厢后脊',vr+.20,15.13]])v2RoofRidge(root,name,{start:[wr,-a],end:[wr,-b],y:wingRidge+.050,width:.27,rise:.065,segments:hero?6:4},rm);
    // Paired liners meet at the current wing ridge without overlapping. Their high ends extend
    // under the main-roof tiles and their low sides lap beneath the wing cap.
  }
  v2RoofRidge(root,'主屋横向正脊_逐片搭接弧脊瓦',{start:[0,-ridgeS],end:[width,-ridgeS],y:ridgeY+.050,width:.30,rise:.075,segments:hero?6:4},rm);

  // Side groups are optional at party walls; no X overhang beyond the footprint.
  for(const [east,disabled]of[[false,options.partyWest],[true,options.partyEast]]) {
    if(disabled)continue;
    const name=east?'东_屋面边部':'西_屋面边部',edge=group(root,name,{kind:'v3-roof-side',partyWall:false}),x=east?width:0;
    v3rGable(edge,'实心山墙',east?width-.24:0,east?width:.24,s0,s1,eave,ridgeS,ridgeY,rm,mats,east?1:-1,options.exposedBrick===true,(east&&withWing?'东_厢房承重墙':(east?'东':'西')+'_主屋承重墙'));
    for(const [a,b]of[[s0-overhang,ridgeS],[ridgeS,s1+overhang]]) {
      const p=v3rPolygon(east?width-.105:0,east?width:.105,a,b),m=mesh(edge,'分坡实体侧边泛水',v3rPrism(p,mainH,.003,.116),rm.metal);m.userData.v3RoofRole='rake-flashing';
      rod(edge,'斜檐实木封边',[east?width-.065:.065,mainH(0,a)-.105,-a],[east?width-.065:.065,mainH(0,b)-.105,-b],.045,rm.wood,hero?8:6);
    }
    if(withWing&&east) {
      for(const [a,b]of[[-.14,s0-.02],[s1+.02,15.14]]) {
        box(edge,'厢房外侧封檐',width-.04,eave-.12,-(a+b)/2,.08,.14,b-a,rm.wood);
        if(a<0){
          // 前段檐沟放在封檐板外，两端向雨水斗的敞口落水，避免沟底封住接水口。
          v3rGutter(edge,'前厢外檐沟_短段向斗口找坡',[width+.065,eave-.10,-a],[width+.065,eave-.12,-.32],rm,hero?7:4);
          v3rGutter(edge,'前厢外檐沟_长段向斗口找坡',[width+.065,eave-.12,-.52],[width+.065,eave-.10,-b],rm,hero?7:4);
        }else v3rGutter(edge,'厢房外侧_开口金属檐沟',[width-.071,eave-.115,-a],[width-.071,eave-.135,-b],rm,hero?7:4);
      }
    }
  }
  const eaves=group(root,'前后檐_实体封檐与开口排水槽');
  for(const north of[false,true]) {
    const s=north?s1+overhang:s0-overhang,end=withWing?wx0-.06:width;
    const intervals=north&&hasWestBridge?[[0,.12],[1.27,end]]:[[0,end]];
    const rearConnection=north&&options.rearCourtyard;
    for(const [lo,hi]of intervals){const stop=rearConnection?Math.min(hi,end-.12):hi;box(eaves,north?'后檐实木封檐板_避让西桥':'前檐实木封檐板',(lo+stop)/2,mainH(0,s)-.105,-s+(rearConnection?.13:0),stop-lo,.12,.06,rm.wood);}
    v3rGutter(eaves,north?'后檐_开口白铁檐沟':'前檐_开口白铁檐沟',[.04,mainH(0,s)-.12,-s],[end-.04+(rearConnection?.05:0),mainH(0,s)-.135,-s],rm,hero?7:4);
    if(rearConnection)for(const x of [1.4,2.2,3.1,3.58])rod(eaves,'后檐沟托条',[x,mainH(0,s)-.13,-s+.11],[x,mainH(0,s)-.14,-s],.004,rm.metal,6);
  }
  if(withWing)for(const [a,b,name]of[[-.13,s0-.025,'前院'],[s1+.025,15.13,'后院']]) {
    const rearConnection=name==='后院'&&options.rearCourtyard;
    box(eaves,`厢房${name}侧封檐`,wx0-.015+(rearConnection?.095:0),eave-.12,-(a+b)/2,.03,.13,b-a,rm.wood);
    if(rearConnection){
      const outletY=mainH(0,s1+overhang)-.131;
      v3rGutter(eaves,'厢房后院短檐沟_向接水斗找坡',[wx0-.045,eave-.12,-a],[wx0-.045,outletY,-10.88],rm,hero?7:4);
      v3rGutter(eaves,'厢房后院长檐沟_向接水斗找坡',[wx0-.045,outletY,-10.92],[wx0-.045,eave-.12,-b],rm,hero?7:4);
      for(const s of [11.3,12.3,13.3,14.3])rod(eaves,'厢房后檐沟托条',[wx0+.065,eave-.14,-s],[wx0-.045,eave-.15,-s],.004,rm.metal,6);
    }else v3rGutter(eaves,`厢房${name}侧_开口檐沟`,[wx0-.045,eave-.12,-a],[wx0-.045,eave-.135,-b],rm,hero?7:4);
  }
  // Sparse structural members. Explicit exclusions protect the approved attic opening and bridge door.
  const framing=group(root,'屋架_避让阁口与桥门的实木檩椽');
  rod(framing,'主脊下实木檩',[.12,ridgeY-.225,-ridgeS],[width-.12,ridgeY-.225,-ridgeS],.060,rm.woodDark,hero?8:6);
  const avoid=[{x0:3.72,x1:4.14,s0:5.90,s1:6.95},{x0:.12,x1:1.27,s0:10.25,s1:10.78}];
  if(dormer)avoid.push({x0:ds.roofX0,x1:ds.roofX1,s0:ds.roofFront-.01,s1:ds.tileBack});
  function splitLine(x0,x1,s) {
    let out=[[x0,x1]];for(const h of avoid)if(s>h.s0&&s<h.s1)out=out.flatMap(([a,b])=>{if(b<=h.x0||a>=h.x1)return[[a,b]];return[[a,Math.min(b,h.x0)],[Math.max(a,h.x1),b]].filter(q=>q[1]-q[0]>.08);});return out;
  }
  for(const ratio of[.20,.37,.64,.81]) {
    const s=s0+(s1-s0)*ratio;
    for(const [a,b]of splitLine(.14,width-.14,s))rod(framing,'主坡实木横檩',[a,mainH(0,s)-.21,-s],[b,mainH(0,s)-.21,-s],.048,rm.woodDark,hero?8:6);
  }
  if(withWing)for(const [a,b]of[[.10,s0+wh-.24],[s1-wh+.24,14.9]])rod(framing,'厢脊下实木檩',[wr,wingRidge-.23,-a],[wr,wingRidge-.23,-b],.05,rm.woodDark,hero?8:6);
  if(dormer)v3rDormer(root,rm,detail,mainH,diagnostics,mats);
  root.traverse(o=>{if(o.isMesh&&o.geometry.userData.kind==='closed-curved-tile')o.geometry=v3rShellNormals(o.geometry);});
  consolidate(eaves);consolidate(framing);
  root.userData={...root.userData,tileNominalLength:.24,tileThickness:.006,panExposure:.095,coverExposure:.075,curveSegments:hero?4:3,valleyCount:diagnostics.valleys.length,diagnostics,atticClearanceExclusions:avoid,
    ...(withWing?{wingRoofEnvelope:{westEdge:wx0,eastEdge:wx1,ridgeX:wr,ridgeY:wingRidge,wallCoreWest:3.84,wallFinishWest:3.809,wallTop:6.91}}:{}),
    construction:'upper-envelope domains; each boundary tile clipped and capped; solid folded valley liners; one real dormer hole when enabled',
    dimensionsAreDesignEstimates:true};
  return root;
}


// V3 街坊：批准的三排 4/3/3 户、沿街商住楼、过街入口与分级弄堂。
// 这里只组装邻里；B1 主户由调用者独立 buildShikumen()，不会重复生成。
// 所有坐标为米，X 向东、s 向北；世界 x=X-12.84，世界 z=-s。
const nb3_LAYOUT = Object.freeze({
  offsetX: -12.84,
  mainAlley: [18, 22.2],
  rowStarts: [0, 17.8, 35.6],
  houses: [
    { id: 'A1', type: 'A', x: 0, s: 0, width: 3.6, depth: 15, number: '21', partyWest: false, partyEast: false, dormer: true },
    { id: 'A2', type: 'A', x: 3.6, s: 0, width: 3.6, depth: 15, number: '23', partyWest: true, partyEast: false, dormer: true },
    { id: 'A3', type: 'A', x: 7.2, s: 0, width: 3.6, depth: 15, number: '25', partyWest: true, partyEast: true, dormer: true },
    // X=10.8,s=0 的 B1 主户保留两侧墙，A3 因此省去东墙。
    { id: 'A4', type: 'A', x: 7.2, s: 17.8, width: 3.6, depth: 15, number: '31', partyWest: false, partyEast: false, dormer: true },
    { id: 'A5', type: 'A', x: 10.8, s: 17.8, width: 3.6, depth: 15, number: '33', partyWest: true, partyEast: false, dormer: true },
    { id: 'A6', type: 'A', x: 14.4, s: 17.8, width: 3.6, depth: 15, number: '35', partyWest: true, partyEast: false, dormer: true },
    { id: 'A7', type: 'A', x: 3.6, s: 35.6, width: 3.6, depth: 15, number: '41', partyWest: false, partyEast: false, dormer: true },
    { id: 'A8', type: 'A', x: 7.2, s: 35.6, width: 3.6, depth: 15, number: '43', partyWest: true, partyEast: false, dormer: true },
    { id: 'B2', type: 'B', x: 10.8, s: 35.6, width: 7.2, depth: 15, number: '45', partyWest: true, partyEast: false, dormer: true },
  ],
  // 每个铺地区域互不叠盖。沿街道路是模型裁切范围，不假设完整城市道路红线。
  paving: [
    { id: '街前铺地', x: [0, 22.44], s: [-13, -9.2], kind: 'street' },
    { id: '贯通主弄', x: [18, 22.2], s: [-9.2, 53.4], kind: 'main', nominalWidth: 4.2 },
    { id: '前支弄', x: [0, 18], s: [-3.2, 0], kind: 'branch', nominalWidth: 3.2 },
    { id: '中支弄一', x: [0, 18], s: [15, 17.8], kind: 'branch', nominalWidth: 2.8 },
    { id: '中支弄二', x: [0, 18], s: [32.8, 35.6], kind: 'branch', nominalWidth: 2.8 },
    { id: '北侧后弄', x: [0, 18], s: [50.6, 53.4], kind: 'branch', nominalWidth: 2.8 },
  ],
});

function nb3_registry(mats) {
  return { materials: mats, cuts: [], levels: [], roof: null };
}

// 兼容组装期间的母型版本。端部横墙和楼板的补接由 buildShikumen 负责。
function nb3_removeSharedSides(root, entry) {
  const names = new Set();
  if (entry.partyWest) { names.add('西_外墙'); names.add('西_屋面边部'); }
  if (entry.partyEast) { names.add('东_外墙'); names.add('东_屋面边部'); }
  const remove = [];
  root.traverse(o => { if (names.has(o.name)) remove.push(o); });
  for (const o of remove) o.removeFromParent();
}

function nb3_beam(parent, name, a, b, width, height, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va);
  const out = box(parent, name, 0, 0, 0, width, height, delta.length(), mat);
  out.position.copy(va).add(vb).multiplyScalar(.5);
  out.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize());
  return out;
}

// 商住楼的室内仅保留上下层和实际可走的服务梯，不放置生活物件。
function nb3_shopStair(parent, x0, mats) {
  const g = group(parent, '商住楼_后部实体木梯', { kind: 'stair', lower: .1, upper: 3.4 });
  const w = .88, cx = x0 + 2.88, firstS = -8.4, going = .24, risers = 17, rise = 3.3 / risers;
  for (let i = 0; i < risers - 1; i++) {
    const top = .1 + (i + 1) * rise, s = firstS + (i + .5) * going;
    box(g, '商铺木踏板', cx, top - .023, -s, w, .046, going + .012, mats.woodFloor || mats.wood);
    box(g, '商铺木踢面', cx, top - rise / 2, -(firstS + i * going), w - .045, rise, .024, mats.woodDark || mats.wood);
  }
  for (const side of [-1, 1]) {
    const x = cx + side * (w / 2 - .035);
    nb3_beam(g, '木梯斜边梁', [x, .12, -firstS], [x, 3.38, -(firstS + 16 * going)], .065, .16, mats.woodDark || mats.wood);
  }
  const railX = cx - w / 2;
  for (const i of [1, 5, 9, 13, 16]) {
    const s = firstS + (i - .5) * going, y = .1 + i * rise;
    box(g, '木梯栏杆', railX, y + .43, -s, .035, .86, .035, mats.wood);
  }
  nb3_beam(g, '木梯扶手', [railX, .1 + rise + .86, -(firstS + .5 * going)], [railX, .1 + 16 * rise + .86, -(firstS + 15.5 * going)], .055, .055, mats.wood);
  consolidate(g);
  return g;
}

function nb3_buildStreetRow(mats) {
  const g = new THREE.Group();
  g.name = '沿街商住楼_五店面与一过街入口';
  g.position.x = nb3_LAYOUT.offsetX;
  g.userData = { kind: 'street_frontage', commercialBays: 5, entranceBays: 1, frontageX: [0, 22.44], s: [-9.2, -3.2], floors: 2 };
  const reg = nb3_registry(mats), top = 6.6, upper = 3.4;
  const frontZ = 9.08, backZ = 3.32;

  for (let i = 0; i < 5; i++) {
    const x0 = i * 3.6, cx = x0 + 1.8;
    const bay = group(g, `沿街商住_${i + 1}`, { kind: 'shop_house', bay: i + 1, x: [x0, x0 + 3.6], s: [-9.2, -3.2] });
    // 同一街沿有一致的构造节奏，局部开门方向服务于商铺内的交通。
    const front = wall(bay, '商住南_沿街开口墙', {
      fixed: frontZ, from: x0, to: x0 + 3.6, bottom: .1, top, thickness: .24,
      material: mats.redBrick, innerMaterial: mats.interiorPlaster, inside: -1,
      openings: [
        { a: x0 + .30, b: x0 + 2.22, y0: .60, y1: 2.82 },
        { a: x0 + 2.39, b: x0 + 3.29, y0: .10, y1: 2.75 },
        { a: x0 + .41, b: x0 + 1.49, y0: 4.20, y1: 5.82 },
        { a: x0 + 2.11, b: x0 + 3.19, y0: 4.20, y1: 5.82 },
      ],
    }, reg);
    timberWindow(front.full, '沿街_木橱窗', x0 + 1.26, .60, 9.215, 1.92, 2.22, mats, { panels: 3, fullLength: true, open: 0, simple: true });
    door(front.full, '沿街_店铺实木门', x0 + 2.84, .10, 9.215, .90, 2.65, mats, { open: i === 2 ? .16 : 0 });
    for (const u of [.95, 2.65]) timberWindow(front.full, '商住二楼_南窗', x0 + u, 4.20, 9.215, 1.08, 1.62, mats, { panels: 2, open: 0, simple: true });
    box(bay, '街沿连续木招牌底板', cx, 3.035, 9.265, 3.05, .31, .065, mats.woodDark || mats.wood);
    box(bay, '商铺石门槛', x0 + 2.84, .075, 9.11, 1.02, .15, .27, mats.stone);
    box(bay, '橱窗下实木裙脚', x0 + 1.26, .40, 9.218, 1.92, .30, .065, mats.blackWood || mats.woodDark || mats.wood);

    const back = wall(bay, '商住北_朝前支弄墙', {
      fixed: backZ, from: x0, to: x0 + 3.6, bottom: .1, top, thickness: .24,
      material: mats.greyBrick, innerMaterial: mats.interiorPlaster, inside: 1,
      openings: [
        { a: cx - .46, b: cx + .46, y0: .10, y1: 2.30 },
        { a: cx - .69, b: cx + .69, y0: 4.18, y1: 5.65 },
        { a: x0 + .45, b: x0 + 1.00, y0: 2.16, y1: 2.72 },
      ],
    }, reg);
    door(back.full, '商铺后门_通前支弄', cx, .10, 3.185, .92, 2.20, mats, { rotationY: Math.PI, open: 0 });
    timberWindow(back.full, '商住二楼_北窗', cx, 4.18, 3.185, 1.38, 1.47, mats, { rotationY: Math.PI, panels: 2, open: 0, simple: true });
    timberWindow(back.full, '商铺后通气窗', x0 + .725, 2.16, 3.185, .55, .56, mats, { rotationY: Math.PI, panels: 1, open: 0, simple: true });
    slab(bay, '商铺底层地坪', x0 + .12, x0 + 3.48, 3.44, 8.96, .10, .14, mats.terracotta || mats.concrete);
    slab(bay, '商住二楼板_实体楼梯孔', x0 + .12, x0 + 3.48, 3.44, 8.96, upper, .16, mats.woodFloor || mats.wood,
      [{ x0: x0 + 2.37, x1: x0 + 3.40, z0: 4.56, z1: 7.40 }]);
    nb3_shopStair(bay, x0, mats);
  }

  // 商住间仅一堵共墙，外侧墙和过街楼支承均不侵入主弄净界。
  wall(g, '街沿西端_实体山墙', { axis: 'z', fixed: .12, from: 3.2, to: 9.2, bottom: .1, top, thickness: .24,
    material: mats.greyBrick, innerMaterial: mats.interiorPlaster, inside: 1 }, reg);
  for (const x of [3.6, 7.2, 10.8, 14.4]) box(g, '商住单元共墙_仅一层', x, (top + .10) / 2, 6.2, .18, top - .10, 6.0, mats.interiorPlaster);
  wall(g, '街沿东端_过街楼左支承', { axis: 'z', fixed: 17.88, from: 3.2, to: 9.2, bottom: .1, top, thickness: .24,
    material: mats.greyBrick, innerMaterial: mats.interiorPlaster, inside: -1 }, reg);

  const gateway = group(g, '主弄入口_真实过街楼', {
    kind: 'gateway', clearX: [18, 22.2], s: [-9.2, -3.2], soffit: 3.14,
    nominalClearWidth: 4.2, nominalClearHeightAbovePaving: 3.12,
  });
  wall(gateway, '过街楼右_边界外支承墙', { axis: 'z', fixed: 22.32, from: 3.2, to: 9.2, bottom: .02, top, thickness: .24,
    material: mats.greyBrick, innerMaterial: mats.interiorPlaster, inside: -1 }, reg);
  for (const [z, rotation, name] of [[frontZ, 0, '南'], [backZ, Math.PI, '北']]) {
    const f = wall(gateway, `过街楼上层_${name}开口墙`, {
      fixed: z, from: 18, to: 22.44, bottom: upper, top, thickness: .24, material: mats.redBrick,
      innerMaterial: mats.interiorPlaster, inside: rotation === 0 ? -1 : 1,
      openings: [{ a: 18.56, b: 19.80, y0: 4.18, y1: 5.83 }, { a: 20.45, b: 21.69, y0: 4.18, y1: 5.83 }],
    }, reg);
    for (const x of [19.18, 21.07]) timberWindow(f.full, `过街楼上层_${name}木窗`, x, 4.18, z + (rotation === 0 ? .135 : -.135), 1.24, 1.65, mats,
      { rotationY: rotation, panels: 2, open: 0, simple: true });
    box(gateway, `过街楼_${name}实际承重梁`, 20.1, 3.27, z, 4.2, .26, .30, mats.woodDark || mats.wood);
  }
  slab(gateway, '过街楼上层实体楼板', 17.76, 22.44, 3.2, 9.2, upper, .16, mats.woodFloor || mats.wood);
  // 上层房间由最东商住间进入；不另画一个没有楼梯的悬空住房。
  // 左支承墙的上层接门按实际墙网格开洞，以免靠黑色门板假冒通路。
  const leftWall = g.getObjectByName('街沿东端_过街楼左支承');
  if (leftWall) leftWall.removeFromParent();
  const through = wall(g, '街沿东端_过街楼左支承_含上层门', {
    axis: 'z', fixed: 17.88, from: 3.2, to: 9.2, bottom: .1, top, thickness: .24,
    material: mats.greyBrick, innerMaterial: mats.interiorPlaster, inside: -1,
    openings: [{ a: 3.56, b: 4.42, y0: upper, y1: 5.55 }],
  }, reg);
  door(through.full, '商住上层_通往过街楼房间', 17.88, upper, 3.99, .86, 2.15, mats, { rotationY: -Math.PI / 2, open: 0 });

  v3BuildRoof(g, mats, 'low', reg, { type: 'A', width: 22.44, mainS: [-9.2, -3.2], eaveHeight: top,
    partyWest: false, partyEast: false, dormer: false });
  for (const x of [3.48, 14.28, 22.32]) {
    rod(g, '街沿白铁落水管', [x, .16, 9.26], [x, 6.55, 9.26], .036, mats.metal, 8);
  }
  return g;
}

// 两处非本项目地块只表现建筑截面，绝不把阶梯状边界空余铺成花园。
function nb3_buildContextFragment(mats, id, x, s, width, depth) {
  const g = new THREE.Group(); g.name = `邻地截取体量_${id}`;
  g.position.set(x + nb3_LAYOUT.offsetX, 0, -s);
  g.userData = { kind: 'adjoining_parcel_fragment', notCountedAsProjectHouse: true, blockX: x, blockS: s, width, depth };
  const reg = nb3_registry(mats), top = 6.6;
  const openings = [];
  for (let cx = 1.8; cx < width; cx += 3.6) {
    openings.push({ a: cx - .58, b: cx + .58, y0: 1.02, y1: 2.48 }, { a: cx - .58, b: cx + .58, y0: 4.20, y1: 5.64 });
  }
  for (const [z, ry, side] of [[-.12, 0, '南'], [-depth + .12, Math.PI, '北']]) {
    const f = wall(g, `邻地_${side}面`, { fixed: z, from: 0, to: width, bottom: .1, top, thickness: .24,
      material: side === '南' ? mats.redBrick : mats.greyBrick,
      ...(side === '南' ? { surfaceFinish: 'exposed-brick', exposedBrickBottom: .32 } : {}),
      innerMaterial: mats.interiorPlaster, inside: ry === 0 ? -1 : 1, openings }, reg);
    for (let cx = 1.8; cx < width; cx += 3.6) for (const [y, h] of [[1.02, 1.46], [4.20, 1.44]]) {
      timberWindow(f.full, `邻地_${side}普通木窗`, cx, y, z + (ry === 0 ? .135 : -.135), 1.16, h, mats,
        { rotationY: ry, panels: 2, simple: true, open: 0 });
    }
  }
  wall(g, '邻地西_边界墙', { axis: 'z', fixed: .12, from: -depth, to: 0, bottom: .1, top, thickness: .24,
    material: mats.greyBrick, innerMaterial: mats.interiorPlaster, inside: 1 }, reg);
  // 东面由本项目对应排首户的西墙承担，不再叠置一堵同向外墙。
  slab(g, '邻地截面地坪', .12, width, -depth + .12, -.12, .10, .14, mats.concrete);
  slab(g, '邻地截面二楼板', .12, width, -depth + .12, -.12, 3.4, .16, mats.woodFloor || mats.wood);
  const roofFrame = group(g, '邻地_沿地界转向屋盖');
  roofFrame.position.x = width; roofFrame.rotation.y = Math.PI / 2;
  // 前后檐挑 .16m 在此旋转后沿 X；预先内收，屋面仍止于邻地户界。
  const roof = v3BuildRoof(roofFrame, mats, 'low', reg, { type: 'A', width: depth, mainS: [.16, width - .16], eaveHeight: top,
    partyWest: false, partyEast: false, dormer: false });
  // Local west becomes south after the roof's 90-degree turn. Replace only that
  // plaster skin; retain the existing solid gable profile, roof and north finish.
  const southEdge = roof.getObjectByName('西_屋面边部');
  southEdge.remove(southEdge.getObjectByName('山墙外侧_连续灰泥饰面'));
  const gable = southEdge.getObjectByName('实心山墙');
  gable.material = mats.mortar;
  gable.geometry.computeBoundingBox();
  const bounds = gable.geometry.boundingBox;
  const brick = v3BrickFace(roof, '邻地南_三角山墙清水红砖',
    [[width + bounds.min.z, top], [width + bounds.max.z, top], [width / 2, bounds.max.y]],
    { axis: 'x', fixed: 0, sign: 1, mats, seed: v2NameSeed('邻地_南面') + v2BuildSeed });
  // Lay out the bricks in the window wall's coordinates before mapping them
  // back into the turned roof frame, so courses and vertical joints continue.
  roofFrame.updateMatrix();
  brick.applyMatrix4(roofFrame.matrix.clone().invert());
  return g;
}

function nb3_buildPaving(mats) {
  const g = new THREE.Group(); g.name = 'V3_主弄支弄与街前铺地';
  g.userData = { kind: 'lane_ground', rectangles: nb3_LAYOUT.paving.map(r => ({ ...r, x: [...r.x], s: [...r.s] })) };
  // 底板仅是地层截面，顶面压在独立石板以下；不吞掉天井或虚构绿地。
  box(g, '街坊地层截面', 11.22 + nb3_LAYOUT.offsetX, -.105, -20.2, 22.44, .15, 66.4, mats.concrete);
  const rectangles = nb3_LAYOUT.paving.map(r => [r.x[0] + nb3_LAYOUT.offsetX, r.x[1] + nb3_LAYOUT.offsetX, -r.s[1], -r.s[0]]);
  g.add(buildStreetPaving(rectangles, mats));

  // 排水沟位于铺地内，顶面低于走道，不能以高路缘缩窄弄堂。
  const drains = group(g, '弄堂_地坪内排水缝');
  for (const s of [15.10, 32.90, 50.70]) {
    box(drains, '支弄排水石沿', 9 + nb3_LAYOUT.offsetX, -.018, -s, 17.80, .028, .10, mats.stoneDark || mats.stone);
    for (let x = .55; x < 17.8; x += .65) box(drains, '石沟排水窄孔', x + nb3_LAYOUT.offsetX, -.002, -s, .19, .006, .028, mats.iron || mats.metal);
  }
  for (const s of [4.0, 21.8, 39.6]) {
    const x = 21.80 + nb3_LAYOUT.offsetX;
    box(drains, '主弄排水井框', x, -.006, -s, .36, .025, .48, mats.stoneDark || mats.stone);
    for (let i = 0; i < 7; i++) box(drains, '主弄井盖实体格条', x - .135 + i * .045, .006, -s, .018, .018, .38, mats.iron || mats.metal);
  }
  consolidate(drains);
  return g;
}

// 材质按实际 PBR 参数共用；不按 UUID 或名字复制成数百个相同材质。
function nb3_materialKey(m) {
  if(m.userData?.asset)return JSON.stringify([m.userData.asset,m.color.toArray(),m.roughness,m.metalness,m.vertexColors]);
  for (const key of ['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'lightMap', 'displacementMap']) {
    if (m[key]) throw new Error(`V3 邻里只接受无贴图材质：${m.name || m.type}.${key}`);
  }
  const rgb = c => c ? [c.r, c.g, c.b] : null;
  return JSON.stringify([m.type, rgb(m.color), m.roughness, m.metalness, rgb(m.emissive), m.emissiveIntensity,
    m.opacity, m.transparent, m.alphaTest, m.side, m.depthWrite, m.depthTest, m.vertexColors, m.flatShading,
    m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.toneMapped, m.wireframe,
    m.blending, m.blendSrc, m.blendDst, m.blendEquation, m.premultipliedAlpha]);
}

function nb3_geometryDigest(geo) {
  let h = 2166136261, count = 0;
  const add = n => { h = Math.imul(h ^ n, 16777619); };
  const descriptors = [];
  for (const key of [...Object.keys(geo.attributes).sort(), '@index']) {
    const a = key === '@index' ? geo.index : geo.attributes[key];
    if (!a) { descriptors.push(key + ':none'); continue; }
    if (a.isInterleavedBufferAttribute) return 'interleaved:' + geo.uuid;
    const bytes = new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
    for (let i = 0; i < bytes.length; i++) add(bytes[i]);
    count += bytes.length;
    descriptors.push(`${key}:${a.itemSize}:${a.count}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`);
  }
  return descriptors.join('|') + '/' + count + '/' + (h >>> 0);
}

// 摘要相同后仍逐字节比较，避免把散列碰撞误当成相同屋瓦或木作。
function nb3_equalGeometry(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a.attributes).sort(), kb = Object.keys(b.attributes).sort();
  if (ka.join('|') !== kb.join('|')) return false;
  for (const key of [...ka, '@index']) {
    const aa = key === '@index' ? a.index : a.attributes[key], bb = key === '@index' ? b.index : b.attributes[key];
    if (!aa || !bb) { if (aa !== bb) return false; continue; }
    if (aa.isInterleavedBufferAttribute || bb.isInterleavedBufferAttribute || aa.itemSize !== bb.itemSize || aa.normalized !== bb.normalized) return false;
    const ab = new Uint8Array(aa.array.buffer, aa.array.byteOffset, aa.array.byteLength), ba = new Uint8Array(bb.array.buffer, bb.array.byteOffset, bb.array.byteLength);
    if (ab.length !== ba.length) return false;
    for (let i = 0; i < ab.length; i++) if (ab[i] !== ba[i]) return false;
  }
  return true;
}

function nb3_mergeRegular(parent, name, list, material) {
  // 开启顶点色的材质必须有恒白底色；不能依赖上一条绘制调用遗留的属性值。
  let total = 0, useColor = !!material.vertexColors, order = -Infinity;
  const prepared = [];
  for (const item of list) {
    const g = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
    g.applyMatrix4(item.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    total += g.attributes.position.count; useColor ||= !!g.attributes.color; order = Math.max(order, item.order);
    prepared.push(g);
  }
  const pos = new Float32Array(total * 3), normal = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const color = useColor ? new Float32Array(total * 3) : null;
  let offset = 0;
  for (const g of prepared) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, offset * 3); normal.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, offset * 2);
    if (color) {
      if (g.attributes.color) color.set(g.attributes.color.array, offset * 3);
      else color.fill(1, offset * 3, (offset + n) * 3);
    }
    offset += n; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (color) { geo.setAttribute('color', new THREE.BufferAttribute(color, 3)); material.vertexColors = true; }
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, material); m.name = name;
  m.castShadow = list[0].cast; m.receiveShadow = list[0].receive; m.renderOrder = Number.isFinite(order) ? order : 0;
  parent.add(m); return m;
}

function nb3_batchSources(sources) {
  const out = new THREE.Group(); out.name = 'V3_邻里按材质与实体几何合批';
  sources.updateMatrixWorld(true);
  const inverse = sources.matrixWorld.clone().invert();
  const materialPool = new Map(), geometryPool = new Map(), geometryIds = new WeakMap(), regular = new Map(), instances = new Map();
  const whiteColorGeometry = new WeakMap();
  const stats = { sourceMeshes: 0, sourceInstancedMeshes: 0, sourceInstances: 0, materialCount: 0, sharedInstanceGeometries: 0, regularBatches: 0, instanceBatches: 0, missingInstanceColorAttributesFilled: 0 };
  const canonicalMaterial = mat => {
    const key = nb3_materialKey(mat);
    if (!materialPool.has(key)) { const c = mat.clone(); c.name = '街坊共用_' + (mat.name || mat.type); materialPool.set(key, c); }
    return { key, material: materialPool.get(key) };
  };
  const canonicalGeometry = (geometry, requiresColor = false) => {
    if (requiresColor && !geometry.attributes.color) {
      // 低精实例的普通 BoxGeometry 可能无 color；克隆补白，保留共享源与 instanceColor。
      let corrected = whiteColorGeometry.get(geometry);
      if (!corrected) {
        corrected = geometry.clone();
        corrected.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(corrected.attributes.position.count * 3).fill(1), 3));
        whiteColorGeometry.set(geometry, corrected); stats.missingInstanceColorAttributesFilled++;
      }
      geometry = corrected;
    }
    if (geometryIds.has(geometry)) return geometryIds.get(geometry);
    const digest = nb3_geometryDigest(geometry), bucket = geometryPool.get(digest) || [];
    for (const item of bucket) if (nb3_equalGeometry(item.geometry, geometry)) { geometryIds.set(geometry, item); return item; }
    const item = { geometry, id: digest + ':' + bucket.length };
    bucket.push(item); geometryPool.set(digest, bucket); geometryIds.set(geometry, item); return item;
  };
  const local = new THREE.Matrix4(), transform = new THREE.Matrix4(), color = new THREE.Color();
  sources.traverseVisible(o => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) throw new Error('V3 邻里合批暂不接受多材质单网格：' + o.name);
    const { key: materialKey, material } = canonicalMaterial(o.material);
    const cast = !!o.castShadow && !material.transparent, receive = !!o.receiveShadow, order = o.renderOrder || 0;
    // 玻璃按建筑分组，避免一整片街坊的透明面被压成一个排序对象。
    let owner = o;
    while (owner.parent && owner.parent !== sources) owner = owner.parent;
    const transparentOwner = material.transparent ? owner.name : '';
    const roofTile=o.userData.v3RoofRole==='tile';
    const stateKey = Number(roofTile)+'/'+materialKey + '/' + Number(cast) + '/' + Number(receive) + '/' + order + '/' + transparentOwner;
    const matrix = inverse.clone().multiply(o.matrixWorld);
    if (o.isInstancedMesh) {
      stats.sourceInstancedMeshes++; stats.sourceInstances += o.count;
      const canonical = canonicalGeometry(o.geometry, material.vertexColors), key = stateKey + '/' + canonical.id;
      if (!instances.has(key)) instances.set(key, { geometry: canonical.geometry, material, cast, receive, order, roofTile, matrices: [], colors: [], label: o.name });
      const b = instances.get(key);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, local); transform.copy(matrix).multiply(local); b.matrices.push(transform.clone());
        if (o.instanceColor) o.getColorAt(i, color); else color.setRGB(1, 1, 1);
        b.colors.push(color.clone());
      }
    } else {
      stats.sourceMeshes++;
      if (!regular.has(stateKey)) regular.set(stateKey, { material, roofTile, items: [] });
      regular.get(stateKey).items.push({ geometry: o.geometry, matrix, cast, receive, order });
    }
  });
  let number = 0;
  for (const b of regular.values()) {
    const repeated=new Map(),remaining=[];
    for(const item of b.items){
      // Keep reflected transforms on the original path: InstancedMesh does not support negative scales.
      if(item.matrix.determinant()<0){remaining.push(item);continue;}
      const canonical=canonicalGeometry(item.geometry,b.material.vertexColors);
      if(!repeated.has(canonical.id))repeated.set(canonical.id,{geometry:canonical.geometry,items:[]});
      repeated.get(canonical.id).items.push(item);
    }
    for(const r of repeated.values()){
      if(r.items.length<2){remaining.push(...r.items);continue;}
      const inst=new THREE.InstancedMesh(r.geometry,b.material,r.items.length);
      inst.name='邻里无损复用_'+(++number)+'_'+b.material.name;
      r.items.forEach((item,i)=>inst.setMatrixAt(i,item.matrix));
      inst.castShadow=r.items[0].cast;inst.receiveShadow=r.items[0].receive;inst.renderOrder=r.items[0].order;
      inst.userData.v3RoofRole=b.roofTile?'tile':undefined;inst.computeBoundingBox();inst.computeBoundingSphere();out.add(inst);
    }
    if(remaining.length){const m=nb3_mergeRegular(out,`邻里实体合批_${++number}_${b.material.name}`,remaining,b.material);m.userData.v3RoofRole=b.roofTile?'tile':undefined;}
  }
  for (const b of instances.values()) {
    const inst = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length);
    inst.name = '邻里实体实例_' + b.label;
    for (let i = 0; i < b.matrices.length; i++) { inst.setMatrixAt(i, b.matrices[i]); inst.setColorAt(i, b.colors[i]); }
    inst.castShadow = b.cast; inst.receiveShadow = b.receive; inst.renderOrder = b.order;
    inst.computeBoundingBox(); inst.computeBoundingSphere();
    inst.userData = { kind: 'shared_geometric_instances', count: b.matrices.length, textureCount: 0, v3RoofRole:b.roofTile?'tile':undefined };
    out.add(inst);
  }
  stats.completedBatchColorGeometries = nb3_completeVertexColors(out);
  stats.materialCount = materialPool.size;
  stats.sharedInstanceGeometries = Array.from(geometryPool.values()).reduce((n, a) => n + a.length, 0);
  stats.regularBatches = regular.size; stats.instanceBatches = instances.size;
  out.userData = { kind: 'batched_neighbourhood', ...stats };
  return out;
}

function nb3_bounds(root) {
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  return { min: b.min.toArray(), max: b.max.toArray(), size: b.getSize(new THREE.Vector3()).toArray() };
}

// 完整层级导出也使用明确的恒白顶点底色，不依赖 WebGL 默认属性状态。
function nb3_completeVertexColors(root) {
  const replacements = new WeakMap(); let count = 0;
  root.traverse(o => {
    if (!o.isMesh || o.geometry.attributes.color) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (!materials.some(m => m.vertexColors)) return;
    let geometry = replacements.get(o.geometry);
    if (!geometry) {
      geometry = o.geometry.clone();
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
      replacements.set(o.geometry, geometry); count++;
    }
    o.geometry = geometry;
  });
  return count;
}

export function buildNeighbourhood(options = {}) {
  const mats = options.materials || getShikumenMaterials(), holder = new THREE.Group();
  holder.name = 'V3_三排里弄与沿街商住街坊';
  const sources = new THREE.Group(); sources.name = 'V3_街坊组装源';
  const records = [];
  const roofParcels=[...nb3_LAYOUT.houses,{id:'B1',x:10.8,s:0,width:7.2}];
  for (const entry of nb3_LAYOUT.houses) {
    const root = buildShikumen({ id: entry.id, type: entry.type, detail: 'low', interior: true, attic: true, materials: mats,
      name: '邻户_' + entry.id, number: entry.number, weatherSeed: entry.type === 'A' ? 37 : 61,
      partyWest: entry.partyWest, partyEast: entry.partyEast, dormer: entry.dormer });
    root.name = '邻户_' + entry.id;
    Object.assign(root.userData, { id: entry.id, number: entry.number, hasAccessibleAttic: true, dormerCount: 1 });
    root.position.x = entry.x + nb3_LAYOUT.offsetX; root.position.z = -entry.s;
    nb3_removeSharedSides(root, entry);
    setShikumenRoofJoins(root,{
      west:roofParcels.some(p=>p.s===entry.s&&Math.abs(p.x+p.width-entry.x)<.0001),
      east:roofParcels.some(p=>p.s===entry.s&&Math.abs(entry.x+entry.width-p.x)<.0001)
    });
    sources.add(root);
    records.push({ ...entry, interior: true, attic: true, hasAccessibleAttic: true,
      worldPosition: [root.position.x, root.position.y, root.position.z], bounds: nb3_bounds(root) });
  }
  const includeStreet = options.includeStreet !== false, includeContext = options.includeContext !== false, includePaving = options.includePaving !== false;
  if (includeStreet) sources.add(nb3_buildStreetRow(mats));
  if (includeContext) {
    sources.add(nb3_buildContextFragment(mats, '中排西侧', 0, 17.8, 7.2, 15));
    sources.add(nb3_buildContextFragment(mats, '北排西侧', 0, 35.6, 3.6, 15));
    // 主弄东界属于相邻地块；界墙位于 X>=22.2，不侵占主弄平面净宽。
    const boundary = group(sources, '主弄东侧_邻地界墙', { kind: 'adjoining_boundary' });
    const reg = nb3_registry(mats);
    wall(boundary, '邻地长界墙', { axis: 'z', fixed: 22.32 + nb3_LAYOUT.offsetX, from: -50.6, to: 3.2,
      bottom: 0, top: 2.72, thickness: .24, material: mats.greyBrick }, reg);
  }
  sources.updateMatrixWorld(true);
  const roofPreviews=[];sources.traverse(o=>{if(o.userData.roofPreview)roofPreviews.push({...o.userData.roofPreview,matrix:o.matrixWorld.toArray()});});
  const completedColorGeometries = nb3_completeVertexColors(sources);
  const preserveHouseHierarchy = options.preserveHouseHierarchy === true;
  const optimized = options.optimize !== false && !preserveHouseHierarchy;
  // Keep the two textured courtyard plants independently identifiable in the block preview.
  // Their source material indices must not be folded into the architecture-only material pool.
  const greenery=new THREE.Group();greenery.name='街区新增盆栽_20261115';
  if(optimized){const plants=[];sources.traverse(o=>{if(o.userData.kind==='block_potted_plant')plants.push(o);});
    for(const plant of plants){const matrix=plant.matrixWorld.clone();plant.removeFromParent();matrix.decompose(plant.position,plant.quaternion,plant.scale);greenery.add(plant);}}
  const before = nb3_bounds(sources);
  const assembled = optimized ? nb3_batchSources(sources) : sources;
  holder.add(assembled);
  const after = nb3_bounds(assembled);
  const batchingError = Math.max(...before.min.map((v, i) => Math.abs(v - after.min[i])), ...before.max.map((v, i) => Math.abs(v - after.max[i])));
  if (includePaving) {
    const paving=nb3_buildPaving(mats);holder.add(paving);paving.updateMatrixWorld(true);
    const pots=[
      ['lane-front-tall','CY01',21.82,7.15,.84,.55,.25],
      ['lane-front-low','CY02',21.78,8.12,.57,.50,1.12],
      ['lane-middle-tall','CY01',21.83,25.00,.79,.54,2.45],
      ['lane-middle-low','CY01',21.80,26.04,.70,.50,-.72],
      ['lane-rear-tall','CY01',21.81,42.95,.82,.56,1.60],
      ['lane-rear-low','CY02',21.79,43.96,.58,.51,-.44],
    ];
    const ray=new THREE.Raycaster();
    for(const[id,source,x,s,height,width,angle]of pots){
      const plant=createCourtyardPlant(THREE,{id,owner:'main-alley',source,height,width,angle});
      ray.set(new THREE.Vector3(x+nb3_LAYOUT.offsetX,1,-s),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(paving,true)[0];if(!hit)throw new Error('盆栽未找到支撑地坪：'+id);
      plant.position.set(x+nb3_LAYOUT.offsetX,hit.point.y,-s);plant.userData.layoutXS=[x,s];plant.userData.floorContactY=hit.point.y;greenery.add(plant);
    }
  }
  holder.add(greenery);
  holder.userData = {
    roofPreviews, kind: 'neighbourhood', version: 3.2, units: 'm', front: '+Z', up: '+Y', textureCount: 2,
    designSource: 'shikumen-v3-plan/layout.json；概念方案取值，非历史实测复原',
    houseCount: 9, housingTotalIncludingIndependentHero: 10, houseTypes: { A: 8, B: 1 }, rowCountsIncludingHero: [4, 3, 3],
    commercialBays: includeStreet ? 5 : 0, entranceBays: includeStreet ? 1 : 0, adjoiningParcelFragments: includeContext ? 2 : 0,
    heroOmitted: { id: 'B1', type: 'B', number: '27', width: 7.2, depth: 15, x: 10.8, s: 0,
      worldX: -2.04, worldPosition: [-2.04, 0, 0], interior: true, attic: true, dormer: true }, placements: records,
    dormerProgram:{includingHero:10,byRow:[4,3,3],houseIds:['A1','A2','A3','B1','A4','A5','A6','A7','A8','B2'],
      basis:'用户确认的本案每户局部阁层与一个老虎窗配置；不是历史建筑统计比例；精细度只影响曲率分段'},
    atticProgram:{includingHero:10,uses:'低阁层储物及短时使用；非标准卧室，非完整第三层',
      interiorTypes:{A:'单开间独立梯井与阁层通路',B:'单厢式主梯、后桥与侧厢阁梯'},
      fullInteriorsInBlock:true,realStairsAndFloorOpenings:true},
    lanes: nb3_LAYOUT.paving.filter(r => r.kind !== 'street').map(r => ({ ...r, x: [...r.x], s: [...r.s] })),
    passage: includeStreet ? { clearX: [18, 22.2], s: [-9.2, -3.2], nominalWidth: 4.2, structuralSoffitY: 3.14 } : null,
    clearanceNote: '弄宽是外墙界线之间的方案净值；门扇、墙脚等细部侵入需在完整主屋装配后另做实体采样。',
    batching: { optimized, preserveHouseHierarchy, completedColorGeometries, boundsErrorMetres: batchingError, ...assembled.userData },
    bounds: nb3_bounds(holder),
  };
  return holder;
}

export async function buildShikumenAsync(options={}){
 const root=buildShikumen({...options,deferAssets:true});
 if(options.id==='B1'){const steps=[()=>installApprovedKitchen(THREE,root),()=>installHall(THREE,root),()=>installCourtyard(THREE,root),()=>installRearCourtyard(THREE,root),()=>installFrontWing(THREE,root),()=>installRearWing(THREE,root),()=>installMiddleWing(THREE,root),()=>installTingzi(THREE,root),()=>installStairwell(THREE,root),()=>installMarital(THREE,root),()=>installLounge(THREE,root),()=>installUpperPanelDoors(THREE,root),()=>installStorage(THREE,root),()=>installChildRoom(THREE,root),()=>installTerrace(THREE,root),()=>installStairwellProps(THREE,root),()=>installAtticRoom(THREE,root),()=>installHouseLighting(THREE,root),()=>installHouseCurtains(THREE,root),()=>installWallDecor(THREE,root),()=>installBambooSeating(THREE,root),()=>installKitchenSnack(THREE,root),()=>installKitchenCondiments(THREE,root),()=>installKitchenWash(THREE,root),()=>installAtticStorage(THREE,root),()=>installHallRearrange(THREE,root),()=>installMiddleWingFan(THREE,root),()=>installLaceCloths(THREE,root),()=>installBedding(THREE,root),()=>installMaritalCombo(THREE,root),()=>installElderWardrobe(THREE,root),()=>installWardrobeClothes(THREE,root),()=>installRoomFinishing(THREE,root),()=>installHallTvClock(THREE,root),()=>installTvScreens(THREE,root),()=>installSmallParts(THREE,root),()=>installCollectionProps(THREE,root),()=>installHouseServices(THREE,root),()=>installHouseSkirting(THREE,root),()=>installHouseDoorHandles(THREE,root),()=>installHouseDoorBolts(THREE,root)];for(let i=0;i<steps.length;i++){options.onProgress?.(i,steps.length);await new Promise(resolve=>setTimeout(resolve,0));steps[i]();}}
  // A shared material may gain vertexColours when another component is merged.
  // Supply a neutral per-vertex factor on every remaining uncoloured mesh.
  root.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o.geometry.attributes.color)return;
    const list=Array.isArray(o.material)?o.material:[o.material];if(!list.some(m=>m.vertexColors))return;
    const geometry=o.geometry.clone();geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));o.geometry=geometry;
  });
  setShikumenView(root,{floors:'all',roof:true,cut:false,doorsOpen:false});
  if(options.interior!==false&&!options.deferAssets)v3NeighbourJoints(root,{hero:options.type!=='A'&&(options.detail||'hero')==='hero'&&(options.id||'B1')==='B1'});
  // Finish the corridor after joint trimming so unrelated wall masks stay exact.
  if(!options.deferAssets)finishSharedCorridor(THREE,root);
  if(/^A[1236]$/.test(options.id||''))installNeighbourWindowCurtains(root,options.id,mats);
  installNeighbourLife(THREE,root,options.id);nb3_completeVertexColors(root);
  
 return root;
}
