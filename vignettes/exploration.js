// 自由探索沿用房间原有的门洞和物件。每间都有一条始终可走的回路。
export const roomLinks = {
  hall: ['前天井', 'courtyard'], courtyard: ['客堂', 'hall'],
  frontwing: ['客堂', 'hall'], middlewing: ['客堂', 'hall'], stairwell: ['客堂', 'hall'],
  rearwell: ['楼梯间', 'stairwell'], rearwing: ['后天井', 'rearwell'], kitchen: ['后天井', 'rearwell'],
  mezzanine: ['客堂', 'hall'], tingzi: ['亭子平台', 'mezzanine'], landing: ['亭子平台', 'mezzanine'],
  storage: ['二楼楼梯间', 'landing'], terrace: ['二楼楼梯间', 'landing'], lounge: ['二楼楼梯间', 'landing'],
  marital: ['小客厅', 'lounge'], atticroom: ['二楼楼梯间', 'landing'],
  childroom: ['阁梯间', 'atticroom'], loft: ['阁梯间', 'atticroom'],
};
export const destinations = {
  frontwing: '去阿婆房间', middlewing: '去中厢', stairwell: '去楼梯间', mezzanine: '上楼亭子间',
  rearwell: '去后天井', rearwing: '去杂物间', kitchen: '去灶披间', tingzi: '进亭子间',
  landing: '上二楼', storage: '去储藏室', lounge: '去小客厅', atticroom: '去阁梯间',
  terrace: '上晒台', marital: '去婚房', childroom: '去孩子房', loft: '上阁楼',
};
// 没有剧情词卡的空间也可以挑一件陈设凑近看，看够了自己退回。
export const scenery = {
  courtyard: [
    { target: '东北吊兰盆栽', label: '吊兰' }, { target: '凳上搪瓷盆', label: '搪瓷盆' },
    { target: '晾晒白衬衫', label: '晾着的衬衫' },
  ],
  storage: [
    { target: '木架底层旅行箱_1', label: '旅行箱' }, { target: '旧蓝衣被包', label: '衣被包' },
    { target: '木架顶层_横长竹编衣箱', label: '竹编衣箱' },
  ],
};
export const followUps = { marital: { wardrobe: 'clothes' }, loft: { dormer: 'out' } };
export const farewells = {
  hall: { title: '给阿婆留句话', lines: ['阿婆，我来过了。', '下趟再来。'] },
  courtyard: { title: '今朝先回去了', lines: ['轻轻带上门，走回弄堂里。'] },
  anywhere: { title: '下趟再来', lines: [] },
};

export function explorationControls(markerTemplate) {
  const root = document.createElement('div');
  root.id = 'exploration';
  root.hidden = true;
  const markers = document.createElement('div'), toolbar = document.createElement('nav'), exits = document.createElement('nav');
  markers.className = 'explore-marks'; toolbar.className = 'explore-tools'; exits.className = 'explore-exits';
  toolbar.setAttribute('aria-label', '探索选项'); exits.setAttribute('aria-label', '去处');
  root.append(markers, toolbar, exits); document.body.append(root);
  let items = [], marksVisible = true, dirty = true;
  let viewMatrix, projectionMatrix, lastRect;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  function button(label, action, parent) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.onclick = e => { e.stopPropagation(); action(); };
    parent.append(b); return b;
  }
  function visibility(toggle) {
    dirty = true;
    markers.classList.toggle('no-object-marks', !marksVisible);
    if (!marksVisible) for (const item of items) if (!item.door) item.el.hidden = true;
    toggle.textContent = marksVisible ? '隐藏光点' : '显示光点';
    toggle.setAttribute('aria-pressed', String(marksVisible));
  }
  return {
    render(points, bottom, quit) {
      markers.replaceChildren(); toolbar.replaceChildren(); exits.replaceChildren(); root.hidden = false;
      items = points.map(point => {
        const el = markerTemplate.cloneNode(true);
        el.type = 'button'; el.lastElementChild.textContent = point.label;
        el.setAttribute('aria-label', point.label); el.onclick = point.run;
        markers.append(el); return { ...point, el };
      });
      const toggle = button('', () => { marksVisible = !marksVisible; visibility(toggle); }, toolbar);
      visibility(toggle);
      toggle.hidden = !points.length;
      button('结束游玩', quit, toolbar);
      for (const x of bottom) button(x.label, x.run, exits);
    },
    hide() { root.hidden = true; items = []; },
    remove() { root.remove(); },
    // 只有客堂选路需要同时列出所有去处。屋内的提示随玩家的视线出现。
    place(camera, rect) {
      if (!items.length || root.hidden) return;
      if (!dirty && lastRect.width === rect.width && lastRect.height === rect.height &&
          lastRect.left === rect.left && lastRect.top === rect.top &&
          viewMatrix.equals(camera.matrixWorldInverse) && projectionMatrix.equals(camera.projectionMatrix)) return;
      viewMatrix = camera.matrixWorldInverse.clone(); projectionMatrix = camera.projectionMatrix.clone();
      lastRect = rect; dirty = false;
      const occupied = [];
      const projected = items.map(item => ({ item, p: item.at.clone().project(camera) }));
      const nearby = projected.filter(({ item, p }) =>
        !item.hallChoice && (marksVisible || item.door) && p.z >= -1 && p.z <= 1 &&
        Math.abs(p.x) < .84 && Math.abs(p.y) < .78);
      // 优先显示最靠近视线的两个物件；转向另一个物件时，它自然成为新的提示。
      const distance = ({ p }) => Math.hypot(p.x * camera.aspect, p.y);
      nearby.sort((a, b) => distance(a) - distance(b));
      const visible = new Set(nearby.slice(0, 2).map(({ item }) => item));
      for (const { item, p } of projected) {
        item.el.hidden = !item.hallChoice && !visible.has(item);
        if (item.el.hidden) continue;
        const behind = p.z > 1;
        const side = (behind ? -p.x : p.x) >= 0 ? 1 : -1;
        const off = behind || Math.abs(p.x) > .93 || Math.abs(p.y) > .89;
        const el = item.el, ring = el.firstElementChild, line = ring.nextElementSibling;
        el.dataset.side = off ? (side < 0 ? 'left' : 'right') : '';
        const w = el.offsetWidth, h = el.offsetHeight, ringInset = 9 + ring.offsetWidth / 2;
        const px = (1 + p.x) * rect.width / 2, py = (1 - (behind ? 0 : p.y)) * rect.height / 2;
        const top = Math.min(100, rect.height * .20), bottom = rect.height - 108 - h;
        const ideal = clamp(py - h / 2, top, bottom);
        const flips = off ? [false] : [p.x > .36, p.x <= .36];
        let x, y, flip;
        // 优先把字放到圆环的另一侧；只有左右都挤才上下错开。
        positions: for (let n = 0; n <= items.length * 2; n++) {
          const dy = Math.ceil(n / 2) * (h + 5) * (n % 2 ? -1 : 1);
          y = clamp(ideal + dy, top, bottom);
          for (flip of flips) {
            const left = off ? (side < 0 ? 10 : rect.width - w - 10) : px - (flip ? w - ringInset : ringInset);
            x = clamp(left, 10, rect.width - w - 10);
            if (!off && Math.abs(left - x) > 2 && n < items.length * 2) continue;
            if (!occupied.some(a => x < a.x + a.w + 5 && x + w + 5 > a.x && y < a.y + a.h + 4 && y + h + 4 > a.y)) break positions;
          }
        }
        occupied.push({ x, y, w, h });
        el.dataset.flip = String(flip);
        if (!off && line.offsetWidth) {
          // 文字可以让位，环心始终钉在物件上。引线从文字一端转向实际环心。
          const dx = px - x - (flip ? w - ringInset : ringInset), dy = py - y - h / 2;
          ring.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          const span = line.offsetWidth + (flip ? dx : -dx);
          const angle = Math.atan2(flip ? dy : -dy, span);
          line.style.transformOrigin = flip ? 'left center' : 'right center';
          line.style.transform = 'rotate(' + angle + 'rad) scaleX(' + Math.hypot(span, dy) / line.offsetWidth + ')';
        }
        item.el.style.transform = 'translate(' + Math.round(rect.left + x) + 'px,' + Math.round(rect.top + y) + 'px)';
      }
    },
  };
}
