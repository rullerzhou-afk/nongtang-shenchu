import * as THREE from '../source/three.module.js';
import {decodeStreet} from './street-codec.js';
// Cloudflare Pages 单文件上限 25 MiB：超过的文件切成 .partN，这里下载后按顺序拼回（构建脚本 scripts/build_cf_site.py 自动改写）
const SPLIT_PARTS = {"street-near-faac7dd2622f345fe44db6d3a58f6cc5e83564fb178889918eaf22f8c3282f17.bin.gz": 5, "street.bin.gz": 4};
async function response(file) {
  const parts = SPLIT_PARTS[file];
  if (parts) {
    const blobs = await Promise.all(Array.from({ length: parts }, async (_, i) => {
      const p = await fetch(new URL('./' + file + '.part' + i, import.meta.url));
      if (!p.ok) throw new Error('Street resource ' + file + '.part' + i + ' (' + p.status + ')');
      const reader = p.body.getReader(), chunks = [];   // 边下边计数，给加载页显示进度
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); self.__dlLive = (self.__dlLive || 0) + value.length; }
      return new Blob(chunks);
    }));
    return new Response(new Blob(blobs));
  }
  const r = await fetch(new URL('./' + file, import.meta.url));
  if (!r.ok) throw new Error('Street resource ' + file + ' (' + r.status + ')');
  return r;
}
async function unpack(r) {
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
export async function loadStreet(detail = 'far') {
  let metadata, buffer;
  if (detail === 'near') {
    const manifest = await (await response('street-near.json')).json();
    if (manifest.version !== 1 || !/^street-near-[a-f0-9]{64}\.json\.gz$/.test(manifest.metadata) ||
        !/^street-near-[a-f0-9]{64}\.bin\.gz$/.test(manifest.binary)) throw new Error('Invalid near-street manifest; rebuild bake-street.mjs --detail=near');
    const [json, bytes] = await Promise.all([response(manifest.metadata).then(unpack), response(manifest.binary).then(unpack)]);
    metadata = JSON.parse(new TextDecoder().decode(json)); buffer = bytes;
  } else if (detail === 'far') {
    [metadata, buffer] = await Promise.all([response('street.json').then(r => r.json()), response('street.bin.gz').then(unpack)]);
  } else throw new Error('Unknown street detail: ' + detail);
  return decodeStreet(THREE, metadata, buffer, new URL('./', import.meta.url).href);
}
