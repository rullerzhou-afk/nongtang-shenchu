// 交互只接纳本次运动的 0 或 1 倍，不另加平移、缩放，也不在下一帧补做被拒绝的输入。
// 一次未知姿态试画必须预留一次恢复重画；因此每个动画帧最多两次主场景渲染。
export const MAX_EXTRA_RENDERS = 1;

// accept(pose, edges, goodPose, goodEdges)：可选的验收规则；不给就用 !bare(edges)。起始基准 seed 始终按 bare 判定。
export function createMotionGate({ keyOf, bare, accept = (pose, edges) => !bare(edges), now = () => performance.now() }) {
  let good = null, goodEdges = null, goodKey = '', rejectedKey = null;
  const stats = { maxExtraRenders: MAX_EXTRA_RENDERS, frame: null,
    totals: { accepted: 0, rejected: 0, cached: 0, budgetDrops: 0 } };

  function seed(pose, edges) {
    if (bare(edges)) throw new Error('起始机位仍超过 LIMIT，不能作为交互限位基准');
    good = pose; goodEdges = edges; goodKey = keyOf(pose); rejectedKey = null;
    stats.frame = null;
  }

  function run(pose, epoch, paint, restore) {
    if (!good) throw new Error('交互限位尚未初始化');
    if (stats.frame?.epoch !== epoch) stats.frame = { epoch, mainRenders: 0, extraRenders: 0,
      mainMs: 0, totalMs: 0, decoMs: 0, calls: 0, decision: '', fraction: 0 };
    const f = stats.frame, t0 = now(), requestedKey = keyOf(pose);
    let painted = false;
    const render = p => {
      if (f.mainRenders >= 1 + MAX_EXTRA_RENDERS) throw new Error('超出交互主场景渲染预算');
      const start = now();
      const edges = paint(p);
      f.mainMs += now() - start; f.mainRenders++;
      f.extraRenders = Math.max(0, f.mainRenders - 1); painted = true;
      return edges;
    };
    f.calls++;
    try {
      // 重复越界请求不再试画；即使同一帧被重复调用，也先恢复相机，绝不留下未验证姿态。
      if (requestedKey === goodKey || requestedKey === rejectedKey || f.mainRenders > 0) {
        restore(good);
        if (f.mainRenders < 1 + MAX_EXTRA_RENDERS) render(good);
        f.fraction = requestedKey === goodKey ? 1 : 0;
        f.decision = requestedKey === goodKey ? 'unchanged' : requestedKey === rejectedKey ? 'cached-reject' : 'budget-stop';
        if (f.decision === 'cached-reject') stats.totals.cached++;
        if (f.decision === 'budget-stop') stats.totals.budgetDrops++;
      } else {
        const edges = render(pose);
        if (accept(pose, edges, good, goodEdges)) {
          good = pose; goodEdges = edges; goodKey = requestedKey; rejectedKey = null;
          f.decision = 'accept'; f.fraction = 1; stats.totals.accepted++;
        } else {
          rejectedKey = requestedKey;
          restore(good); render(good);
          f.decision = 'reject'; f.fraction = 0; stats.totals.rejected++;
        }
      }
      return { painted, corrected: f.fraction === 0, decision: f.decision };
    } finally { f.totalMs += now() - t0; }
  }

  return { seed, run, stats, get good() { return good; } };
}

// WheelEvent 没有可靠的设备类型字段。按当前事件判断，避免前一设备的 600ms 分类污染下一次输入。
export function isTrackpadScroll(e) {
  if (e.ctrlKey || e.metaKey || e.deltaMode !== 0) return false;
  if (e.deltaX !== 0) return true;
  // Chromium 的 legacy wheelDelta 也会除以 DPR；Retina 一格可能是 60，
  // 页面缩放后还可能被截成整数。恢复刻度并给截断留出误差，不要求整除。
  const dpr = e.view?.devicePixelRatio || globalThis.devicePixelRatio || 1;
  const pixels = Math.abs(e.deltaY) * dpr, ticks = Math.abs(e.wheelDeltaY || 0) * dpr;
  const notch = Math.round(ticks / 120);
  // 小幅连续滑动优先平移；CDP 也可能为 3px 的滑动附上整格 wheelDelta。
  if (pixels < 8) return true;
  if (notch > 0 && Math.abs(ticks - notch * 120) <= Math.max(1, dpr)) return false;
  // 缺少 legacy 刻度时只剩幅度启发式；WheelEvent 没有标准设备身份。
  return ticks > 0 || pixels < 40;
}
