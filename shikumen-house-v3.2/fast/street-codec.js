// Original typed-array bytes, never rounded JSON vertex values. No scene construction.
export function encodeStreet(THREE, hero, neighbours, {detail = 'far', baseURL} = {}) {
  const parts = [], seen = new WeakMap(); let length = 0;
  const originalAttribute = THREE.BufferAttribute.prototype.toJSON;
  const originalGeometry = THREE.BufferGeometry.prototype.toJSON;
  const originalSource = THREE.Source.prototype.toJSON;
  function attribute() {
    if (!this.array || this.isInterleavedBufferAttribute) throw new Error('Unsupported interleaved street attribute');
    let ref = seen.get(this.array);
    if (!ref) {
      const bytes = new Uint8Array(this.array.buffer, this.array.byteOffset, this.array.byteLength);
      const alignment = Math.max(4, this.array.BYTES_PER_ELEMENT);
      length = Math.ceil(length / alignment) * alignment;
      ref = {offset: length, length: bytes.byteLength, type: this.array.constructor.name};
      parts.push({ref, bytes}); seen.set(this.array, ref); length += bytes.byteLength;
    }
    return {itemSize: this.itemSize, type: ref.type, array: {fastBuffer: ref}, normalized: this.normalized,
      name: this.name, usage: this.usage};
  }
  try {
    THREE.BufferAttribute.prototype.toJSON = attribute;
    THREE.BufferGeometry.prototype.toJSON = function () {
      const d = {uuid: this.uuid, type: 'BufferGeometry', data: {attributes: {}}, fastDrawRange: {...this.drawRange}};
      if (this.isInstancedBufferGeometry) throw new Error('Unsupported InstancedBufferGeometry in street snapshot');
      if (this.name) d.name = this.name;
      if (Object.keys(this.userData).length) d.userData = this.userData;
      for (const [key, a] of Object.entries(this.attributes)) {
        if (a.isInterleavedBufferAttribute) throw new Error('Unsupported interleaved street attribute: ' + key);
        d.data.attributes[key] = a.toJSON();
      }
      if (this.index) {const a = this.index.toJSON(); d.data.index = {type: a.type, array: a.array};}
      if (this.groups.length) d.data.groups = this.groups.map(g => ({...g}));
      if (this.boundingSphere) d.data.boundingSphere = {center: this.boundingSphere.center.toArray(), radius: this.boundingSphere.radius};
      if (this.boundingBox) d.fastBoundingBox = {min: this.boundingBox.min.toArray(), max: this.boundingBox.max.toArray()};
      if (Object.keys(this.morphAttributes).length) {
        d.data.morphAttributes = Object.fromEntries(Object.entries(this.morphAttributes).map(([k, list]) => [k, list.map(a => a.toJSON())]));
        d.data.morphTargetsRelative = this.morphTargetsRelative;
      }
      // JSON cannot represent Infinity. Omit the default rather than turning it into null.
      if (!Number.isFinite(d.fastDrawRange.count)) delete d.fastDrawRange;
      return d;
    };
    THREE.Source.prototype.toJSON = function (meta) {
      if (meta?.images[this.uuid]) return meta.images[this.uuid];
      let url;
      if (this.data?.src) {
        const absolute = this.data.src;
        url = baseURL && absolute.startsWith(baseURL) ? './' + absolute.slice(baseURL.length) : absolute;
      } else if (this.data?.toDataURL) url = this.data.toDataURL('image/png');
      else if (this.data?.data) url = {data: Array.from(this.data.data), width: this.data.width, height: this.data.height, type: this.data.data.constructor.name};
      else throw new Error('Unsupported street image source');
      const d = {uuid: this.uuid, url}; if (meta) meta.images[this.uuid] = d; return d;
    };
    function copy(o) {
      if (detail === 'far' && !o.visible) return null;
      const c = o.clone(false);
      for (const child of o.children) {const next = copy(child); if (next) c.add(next);}
      return c;
    }
    const group = new THREE.Group(); group.name = '预构建街区_' + detail;
    for (const [role, source] of [['hero', hero], ['neighbours', neighbours]]) {
      const c = copy(source); if (!c) throw new Error('Missing street root: ' + role);
      c.userData.snapshotRole = role;
      if (detail === 'far') c.userData.fastStreetSnapshot = true;
      else {delete c.userData.fastStreetSnapshot; c.userData.fastStreetDetailSnapshot = true;}
      group.add(c);
    }
    group.updateMatrixWorld(true);
    const json = group.toJSON(), bytes = new Uint8Array(length);
    for (const p of parts) bytes.set(p.bytes, p.ref.offset);
    return {json, bytes};
  } finally {
    THREE.BufferAttribute.prototype.toJSON = originalAttribute;
    THREE.BufferGeometry.prototype.toJSON = originalGeometry;
    THREE.Source.prototype.toJSON = originalSource;
  }
}

export function hydrateStreet(metadata, buffer) {
  const constructors = {Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array, Uint8ClampedArray, Int32Array, Int16Array, Int8Array};
  function visit(v) {
    if (!v || typeof v !== 'object') return;
    if (v.array?.fastBuffer) {
      const a = v.array.fastBuffer, C = constructors[a.type];
      if (!C || !Number.isSafeInteger(a.offset) || !Number.isSafeInteger(a.length) || a.offset < 0 || a.length < 0 ||
          a.offset % C.BYTES_PER_ELEMENT || a.length % C.BYTES_PER_ELEMENT || a.offset + a.length > buffer.byteLength)
        throw new Error('Invalid street binary descriptor: ' + JSON.stringify(a));
      v.array = new C(buffer, a.offset, a.length / C.BYTES_PER_ELEMENT);
    }
    for (const [key, x] of Object.entries(v)) if (key !== 'array') visit(x);
  }
  visit(metadata); return metadata;
}

export async function decodeStreet(THREE, metadata, buffer, resourcePath) {
  hydrateStreet(metadata, buffer);
  const manager = new THREE.LoadingManager(), failures = [];
  manager.onError = url => failures.push(url);
  const loader = new THREE.ObjectLoader(manager); loader.setResourcePath(resourcePath);
  const root = await loader.parseAsync(metadata);
  if (failures.length) throw new Error('Street images failed: ' + failures.join(', '));
  const geometry = new Map((metadata.geometries || []).map(g => [g.uuid, g]));
  root.traverse(o => {
    const d = geometry.get(o.geometry?.uuid); if (!d) return;
    if (d.fastDrawRange) o.geometry.setDrawRange(d.fastDrawRange.start, d.fastDrawRange.count);
    if (d.fastBoundingBox) o.geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(d.fastBoundingBox.min), new THREE.Vector3().fromArray(d.fastBoundingBox.max));
  });
  const hero = root.children.find(o => o.userData.snapshotRole === 'hero');
  const neighbours = root.children.find(o => o.userData.snapshotRole === 'neighbours');
  if (!hero || !neighbours) throw new Error('Street snapshot is missing hero or neighbours');
  return {hero, neighbours};
}
