// 音效 · 曦宝 2026-11-18（鹿鹿：看能不能给游戏配音效）
// 全部是在浏览器里现算出来的声音（英文叫 Web Audio 合成：用噪声、正弦波加滤波拼出来），没有下载任何素材，也没有付费生成。
// 想换成真录音：把文件放到 audio/ 下，起名 <名字>.m4a（名字见下面 SYNTH 的各项），有文件就用文件，没有就用合成的。
// 音量由右下角“声音”面板里的“音效”滑条管（bgm.js），这里只读 window.__SOUND.sfx。
// 房间文件里用 h.sound('名字', { loop, volume }) 播，返回的函数用来停掉。
const AC = window.AudioContext || window.webkitAudioContext;
let ctx = null, master = null, noiseBuf = null;
const files = new Map();   // 名字 → 真录音的地址（有的话）
const stats = { played: [], files: [], ready: false };
const vol = () => Math.max(0, Math.min(1, window.__SOUND?.sfx ?? .7));

function boot() {
  if (ctx || !AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = vol(); master.connect(ctx.destination);
  const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  stats.ready = true;
}
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { boot(); ctx?.resume?.(); }, { capture: true });
window.addEventListener('sound-change', () => { if (master) master.gain.setTargetAtTime(vol(), ctx.currentTime, .05); for (const a of live) a.el.volume = a.v * vol(); });

// ---- 拼声音用的小零件 ----
// 一段包络：t0 开始，a 秒升到 peak，再 r 秒落回去
const env = (g, t0, peak, a, r, hold = 0) => { g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t0 + a); if (hold) g.gain.setValueAtTime(Math.max(.0002, peak), t0 + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t0 + a + hold + r); };
const gain = (out, v = 0) => { const g = ctx.createGain(); g.gain.value = v; g.connect(out); return g; };
const filt = (out, type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(out); return b; };
const noise = (out, t0, dur) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(out); s.start(t0, Math.random() * 1.5); if (dur) s.stop(t0 + dur); return s; };
const osc = (out, type, f, t0, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(out); o.start(t0); if (dur) o.stop(t0 + dur); return o; };
// 一下短促的噪声（敲、点、扑）
const puff = (out, t0, f, q, peak, a, r, type = 'bandpass') => { const g = gain(out); noise(filt(g, type, f, q), t0, a + r + .05); env(g, t0, peak, a, r); };
// 一个会慢慢消失的音（铃、钟）
const ping = (out, t0, f, peak, r, type = 'sine') => { const g = gain(out); osc(g, type, f, t0, r + .05); env(g, t0, peak, .004, r); };
// 一直响到叫停的声音：返回停的函数
const sustain = (out, build, fadeIn = .4, fadeOut = .5) => {
  const g = gain(out), t0 = ctx.currentTime, nodes = build(g, t0); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(1, t0 + fadeIn);
  return () => { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(.0001, t + fadeOut); for (const n of nodes) try { n.stop(t + fadeOut + .05); } catch (e) {} };
};

// ---- 每一种声音。写成 (out, t0) => 可选的“停”函数；out 已经乘过这一下的音量 ----
const SYNTH = {
  // 界面
  click(o, t) { ping(o, t, 720, .16, .09); ping(o, t + .02, 1080, .07, .08); },                                   // 点一下引导光点
  card(o, t) { ping(o, t, 659, .13, .7); ping(o, t + .11, 988, .1, .9); },                                        // 词卡出来：两声轻轻的
  page(o, t) { puff(o, t, 2600, .7, .2, .05, .22); },                                                             // 字条、本子翻开
  step(o, t) { for (let i = 0; i < 2; i++) { puff(o, t + i * .34, 150, 1.2, .9, .008, .12, 'lowpass'); puff(o, t + i * .34, 900, 1, .06, .004, .05); } },   // 换一间屋：两步
  // 客堂
  cloth(o, t) { puff(o, t, 1100, .6, .28, .12, .3); puff(o, t + .42, 700, .8, .14, .03, .16); },                   // 外套挂上去
  slide(o, t) { const g = gain(o); noise(filt(g, 'lowpass', 420, .7), t, 1.6); env(g, t, .34, .15, .5, .75); puff(o, t + 1.36, 180, 2, .5, .005, .12, 'lowpass'); },   // 玻璃橱移门推开，到头轻轻一碰
  pour(o, t) { const g = gain(o), f = filt(g, 'bandpass', 700, 1.4); noise(f, t, 2.4); f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(1900, t + 2.1);   // 开水倒进杯子：越满声音越尖
    env(g, t, .3, .15, .3, 1.75); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 17; lg.gain.value = 140; l.connect(lg); lg.connect(f.frequency); l.start(t); l.stop(t + 2.4); },
  tvon(o, t) { puff(o, t, 2200, 2, .4, .002, .03); const g = gain(o); noise(filt(g, 'highpass', 3500, .5), t + .05, 1.3); env(g, t + .05, .12, .25, .9); ping(o, t + .05, 100, .1, 1.1); },   // 电视：咔嗒一声，沙沙声慢慢退掉
  sip(o, t) { puff(o, t, 1500, 3, .3, .1, .25); },
  // 灶披间
  stove(o, t) { puff(o, t, 4200, .8, .3, .01, .2, 'highpass'); puff(o, t + .34, 170, .8, .5, .03, .28, 'lowpass'); const g = gain(o); noise(filt(g, 'bandpass', 1300, .5), t + .4, 2.3); env(g, t + .4, .1, .2, 1.2, .8); },   // 划自来火、噗一声点着、火头呼呼
  tap(o) { const stop = sustain(o, (g, t) => { const a = noise(filt(gain(g, .26), 'bandpass', 2400, .6), t), b = noise(filt(gain(g, .2), 'lowpass', 600, .8), t); return [a, b]; }, .15, .3); setTimeout(stop, 2200); return stop; },   // 水龙头：开两秒多自己关
  door(o, t) { const g = gain(o), f = filt(g, 'bandpass', 620, 7), s = osc(f, 'sawtooth', 70, t, 1.0); s.frequency.setValueAtTime(64, t); s.frequency.linearRampToValueAtTime(98, t + .5); s.frequency.linearRampToValueAtTime(76, t + .95);   // 木门吱呀一声
    env(g, t, .6, .12, .3, .5); puff(o, t + 1.0, 130, 1.5, .8, .005, .16, 'lowpass'); },
  // 中厢、前厢、楼梯间
  sewing(o, t) { for (let i = 0; i < 16; i++) { const x = t + i * .095; puff(o, x, 3200, 1.5, .13, .002, .025); puff(o, x + .03, 170, 2, .2, .003, .04, 'lowpass'); } },   // 缝纫机哒哒哒
  fan(o) { return sustain(o, (g, t) => { const m = gain(g, .16), a = noise(filt(m, 'lowpass', 300, .5), t), l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6.5; lg.gain.value = .05; l.connect(lg); lg.connect(m.gain); l.start(t); const h = osc(gain(g, .03), 'sine', 100, t); return [a, l, h]; }, .9, .8); },   // 电风扇
  bell(o, t) { for (const x of [t, t + .2]) { ping(o, x, 2090, .17, 1.1); ping(o, x, 3140, .1, .8); ping(o, x, 4650, .05, .5); } },   // 脚踏车铃：叮铃
  clock(o, t) { for (let i = 0; i < 6; i++) puff(o, t + i * .5, i % 2 ? 1500 : 2100, 6, .5, .002, .04); },                // 台钟：嘀嗒
  radio(o) {   // 无线电：沙沙的底噪，里头隐隐约约一段调子（合成的，不是哪一首歌）
    const notes = [392, 440, 523, 587, 523, 440, 392, 330, 392, 440, 392, 330, 294, 330, 392, 0]; let timer = 0, i = 0, alive = true;
    const stop = sustain(o, (g, t) => [noise(filt(gain(g, .05), 'bandpass', 3000, .5), t)], .6, .6), band = filt(o, 'bandpass', 1200, .9);
    const next = () => { if (!alive) return; const f = notes[i++ % notes.length], t = ctx.currentTime; if (f) { const g = gain(band), v = osc(g, 'triangle', f, t, .62), l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = 3; l.connect(lg); lg.connect(v.frequency); l.start(t); l.stop(t + .62); env(g, t, .13, .05, .3, .2); } timer = setTimeout(next, 560); };
    timer = setTimeout(next, 500); return () => { alive = false; clearTimeout(timer); stop(); };
  },
  // 晒台、阁楼
  thump(o, t) { puff(o, t, 140, 1, .6, .004, .16, 'lowpass'); puff(o, t, 900, .7, .16, .003, .08); },                    // 藤拍拍在被头上
  flap(o, t) { for (let i = 0; i < 26; i++) puff(o, t + i * .13 + Math.random() * .03, 520 + Math.random() * 300, .9, .22 * Math.sin(Math.PI * (i + 1) / 27), .02, .07); },   // 一群鸽子扑翅膀：由远到近再到远
};

// 真录音：开头问一遍哪些名字有文件（没有的话浏览器会在控制台记一行 404，不影响游戏）
const NativeAudio = window.__NativeAudio || window.Audio, live = new Set();
Promise.all(Object.keys(SYNTH).map(async n => { const url = new URL('./audio/' + n + '.m4a', import.meta.url).href; try { if ((await fetch(url, { method: 'HEAD' })).ok) { files.set(n, url); stats.files.push(n); } } catch (e) {} }));

function play(name, { loop = false, volume = .6 } = {}) {
  stats.played.push(name); if (stats.played.length > 60) stats.played.shift();
  if (files.has(name)) { const a = { el: new NativeAudio(files.get(name)), v: volume }; a.el.loop = loop; a.el.volume = volume * vol(); a.el.play().catch(() => {}); live.add(a); a.el.addEventListener('ended', () => live.delete(a)); return () => { a.el.pause(); live.delete(a); }; }
  boot(); const make = SYNTH[name]; if (!ctx || !make) return () => {};
  if (ctx.state === 'suspended') ctx.resume?.();
  const out = gain(master, Math.min(1.5, volume / .6));
  try { return make(out, ctx.currentTime + .01) || (() => {}); } catch (e) { console.warn('sfx', name, e); return () => {}; }
}
window.__SFX = { play, names: Object.keys(SYNTH), stats, probe: () => { boot(); return { ctx, master }; } };   // probe：检查脚本接一个电平表上去量响度
