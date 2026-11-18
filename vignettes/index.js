// 哪些房间用固定机位和小剧场。一间屋一个同名文件；没列在这里的房间仍是原来的走动方式。
// 加一间屋：在本目录新建 <房间编号>.js（编号见 ../rooms.js），再把编号加到下面这一行。
export const ROOM_FILES = ['courtyard', 'hall', 'mezzanine', 'tingzi', 'landing', 'terrace', 'atticroom', 'storage', 'frontwing', 'middlewing', 'lounge', 'stairwell', 'rearwell', 'kitchen', 'rearwing', 'loft', 'childroom', 'marital'];

// 不属于某一出戏、进屋时就摆好的东西（比如放在别的房间里的物件）。一样东西一个文件，导出 { add(h, d), remove(h, d) }。
export const EXTRA_FILES = ['extra-washer', 'extra-matchbox', 'extra-backdoor'];
