// 厨房后门默认关着 · 负责人：曦宝
// 鹿鹿 2026-11-18：后门应该默认关着，站在后天井往厨房里望也是关着的；站在厨房里点那扇门才打开。
// 房子模型里这扇门扇是开着的（转角 1.5），没有改模型，进屋时在这里把它转回 0。开门那一拍在 vignettes/kitchen.js。
export const DOOR = '门扇_1.001';
export const shut = door => { if (!door) return 0; door.userData.openAngle ??= door.rotation.y || 1.5; door.userData.backdoorOpened = false; door.rotation.y = 0; return door.userData.openAngle; };   // 关上，并记住模型原来开到多大
export const opened = door => { if (door) door.userData.backdoorOpened = true; };   // 厨房那一拍开过门以后记一笔，之后就让它开着

export default {
  add(h, d) { d.door = h.find(DOOR); shut(d.door); },
  // 房子每次换视图（进全屋剖面、再点进房间）都会把所有门转开，这里再摆回去：没开过就关着，开过就开着
  afterView(h, d) { if (d.door) d.door.rotation.y = d.door.userData.backdoorOpened ? d.door.userData.openAngle : 0; },
  remove(h, d) { if (d.door) d.door.rotation.y = d.door.userData.openAngle ?? 1.5; },
};
