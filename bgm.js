// 背景音乐 · 曦宝 2026-11-18（鹿鹿：整个游戏需要一首背景音乐，先把管线搭好，她用 Suno 生成后放进来）
// - 点“开始”或“走进弄堂”才载入并播放游戏曲；回到首页即停止。
// - 词卡的录音、屋里的声音一响，音乐自动压低，放完再回来。
// - 右下角“声音”，点开两根滑条：音乐、音效各调各的（鹿鹿 2026-11-18），拉到 0 就是关。选择记在这台电脑的浏览器里。
// 靠接管 window.Audio 知道别的声音什么时候在放。
const GAME = 'bgm-game.mp3', MAX = .5, FADE_IN = .65, KEY = 'sound-v1';
// 两个音量：音乐、音效，都是 0 到 1。默认音乐 0.64（实际响度 0.32）、音效 0.7。记在这台电脑的浏览器里
const sound = { music: .64, sfx: .7 };
try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { if (o.music >= 0) sound.music = Math.min(1, +o.music); if (o.sfx >= 0) sound.sfx = Math.min(1, +o.sfx); } else if (localStorage.getItem('bgm-off-v1') === '1') sound.music = 0; } catch (e) {}
window.__SOUND = sound;   // sfx.js 读这里的 sfx
const VOL = () => sound.music * MAX, DUCK = () => Math.min(.1, VOL() * .3);
const state = { el: null, file: null, started: false, get off() { return sound.music <= 0; }, others: new Set(), vol: 0, target: 0 };
window.__BGM = state;   // 检查脚本读这个

// 别的声音：凡是用 new Audio() 放的（词卡录音、收音机之类），放的时候记一笔
const NativeAudio = window.Audio; window.__NativeAudio = NativeAudio;   // 音效用原来的，不让音乐因为音效压低
window.Audio = function (...args) {
  const a = new NativeAudio(...args);
  const on = () => { state.others.add(a); aim(); }, offFn = () => { state.others.delete(a); aim(); };
  a.addEventListener('playing', on); for (const ev of ['pause', 'ended', 'error', 'emptied']) a.addEventListener(ev, offFn);
  return a;
};
window.Audio.prototype = NativeAudio.prototype;

// 右下角“声音”：点开是两根滑条，音乐和音效各调各的
const SERIF = "'Songti SC','Noto Serif SC',serif", SHADOW = 'text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 2px #000';
const btn = document.createElement('button');
btn.style.cssText = 'outline:none;position:fixed;right:clamp(20px,3vw,44px);bottom:clamp(22px,5vh,44px);z-index:9;padding:.6em 0;border:0;background:none;cursor:pointer;color:#fff;opacity:.7;font:14px/1 ' + SERIF + ';letter-spacing:.34em;' + SHADOW;
btn.textContent = '声音'; btn.setAttribute('aria-label', '调节音乐和音效的音量'); btn.setAttribute('aria-expanded', 'false');
const panel = document.createElement('div');
panel.style.cssText = 'display:none;position:fixed;right:clamp(20px,3vw,44px);bottom:calc(clamp(22px,5vh,44px) + 40px);z-index:9;width:230px;padding:18px 20px 14px;background:rgba(20,17,14,.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-top:1px solid #e6c27a;border-bottom:1px solid rgba(230,194,122,.4);color:#f6f0e2;font:13px/1 ' + SERIF + ';letter-spacing:.3em';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sound)); } catch (e) {} };
const rows = {};
for (const [k, name] of [['music', '音乐'], ['sfx', '音效']]) {
  const row = document.createElement('label'); row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;cursor:pointer';
  const t = document.createElement('span'); t.textContent = name; t.style.cssText = 'flex:none';
  const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 100; r.step = 1; r.value = Math.round(sound[k] * 100); r.setAttribute('aria-label', name + '音量'); r.style.cssText = 'flex:1;min-width:0;accent-color:#e6c27a;cursor:pointer';
  const n = document.createElement('span'); n.style.cssText = 'flex:none;width:2.4em;text-align:right;letter-spacing:.05em;color:#c9c1ae'; n.textContent = r.value;
  r.oninput = () => { sound[k] = r.value / 100; n.textContent = r.value; save(); if (k === 'music') { aim(); playCurrent(); } else window.dispatchEvent(new Event('sound-change')); };
  if (k === 'sfx') r.onchange = () => window.__SFX?.play('card');   // 松手时响一声，听听现在多响
  for (const ev of ['pointerdown', 'keydown', 'click']) r.addEventListener(ev, e => e.stopPropagation());   // 拖滑条、按方向键不要传给游戏
  row.append(t, r, n); panel.append(row); rows[k] = { row, r };
}
const note = document.createElement('div'); note.style.cssText = 'display:none;margin-top:2px;font-size:11px;letter-spacing:.2em;color:#a39b89'; note.textContent = '还没有放进音乐文件'; panel.append(note);
const open = on => { panel.style.display = on ? 'block' : 'none'; btn.setAttribute('aria-expanded', String(on)); btn.style.opacity = on ? '1' : '.7'; };
btn.onclick = e => { e.stopPropagation(); btn.blur(); open(panel.style.display === 'none'); };
for (const ev of ['pointerdown', 'click']) panel.addEventListener(ev, e => e.stopPropagation());
window.addEventListener('pointerdown', e => { if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) open(false); }, { capture: true });   // 点别处收起
document.body.append(btn, panel);

function aim() { state.target = !state.started || state.off ? 0 : state.others.size ? DUCK() : VOL(); }
let last = performance.now();
function tick(now) {   // 音乐淡入，播放词卡时轻轻压低音量
  const dt = Math.min(.1, (now - last) / 1000); last = now; requestAnimationFrame(tick); if (!state.el) return;
  const full = Math.max(.1, VOL()), rate = state.target > state.vol ? full / (state.others.size || state.vol > DUCK() * 1.5 ? .7 : FADE_IN) : full / .6;
  state.vol += Math.max(-rate * dt, Math.min(rate * dt, state.target - state.vol));
  state.el.volume = state.vol;
  if (state.off && state.vol <= .001 && !state.el.paused) state.el.pause();   // 关掉后真的停下来，不白白占着
}
requestAnimationFrame(tick);

function playCurrent() {
  if (state.off || !state.el?.paused) return;
  const el = state.el, file = state.file;
  el.play().then(() => {
    if (el === state.el) console.debug('背景音乐开始播放', file);
  }, error => {
    if (el === state.el) console.debug('背景音乐未能播放', file, error.name);
  });
}
window.addEventListener('shikumen-game-start', () => {
  if (state.el) return;
  const audio = new NativeAudio(new URL('./audio/' + GAME, import.meta.url).href);
  audio.loop = true; audio.volume = 0;
  audio.addEventListener('error', () => {
    if (audio !== state.el) return;
    rows.music.r.disabled = true; rows.music.row.style.opacity = '.45'; note.style.display = 'block';
  });
  state.el = audio; state.file = GAME; state.started = true;
  aim(); playCurrent();
});
window.addEventListener('shikumen-title', () => {
  state.el?.pause();
  state.el = null; state.file = null; state.started = false; state.vol = 0;
  aim();
});
