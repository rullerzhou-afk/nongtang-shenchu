// 二楼阁梯间 · 云宝。看完电熨斗，在桌边转身面向孩子房门口。
import { ROOMS } from '../rooms.js';
const IRON = [4.59, 4.88, -6.36];
const childDoor = ROOMS.atticroom.doors.find(door => door.to === 'childroom');
export default {
  spot: { pos: [3.58, 5.45, -9.55], look: [4.45, 5.05, -6.85] },
  story: {
    beats: [
      {
        id: 'iron', audio: 'IR01', label: '看熨斗', target: h => h.find('桌南端电熨斗'),
        sub: '整理桌上搁着一只电熨斗。', markAt: IRON, guideFrom: [3.56, 5.46, -7.36],
        pose: { pos: [3.95, 5.33, -6.89], look: IRON },
        card: { hu: '电熨斗', zh: '电熨斗', note: '着衣裳之前，领头总归要烫烫。烫好了，插头拔了，放勒架子高头。' },
      },
    ],
    outro: { after: 0, lookAt: childDoor.frame.c, exit: [
      { label: '去孩子房', to: 'childroom' },
      { label: '上阁楼', to: 'loft' },
      { label: '回二楼楼梯间', to: 'landing' },
    ] },
  },
};
