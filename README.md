# 弄堂深处 · 一九九四年 上海 回阿婆家

一款沪语小游戏：走进 1994 年上海石库门里的阿婆家，点一件老物件，听一句上海话。

- **在线体验**：https://nongtang.rullerzhou.com （电脑上用 Chrome 或 Edge 打开）
- **项目报告书**：https://nongtang.rullerzhou.com/report/ ，PPT 在 [`report/`](report/) 里
- **参考资料**：[296 条原文链接](https://nongtang.rullerzhou.com/report/%E5%8F%82%E8%80%83%E8%B5%84%E6%96%99.html)
- Aholo Lux3D 黑客松参赛作品

## 这是什么

玩家是不会讲上海话的小辈，回到 1994 年的阿婆家。阿婆出门买小菜了，客堂桌上压着一张字条：“侬自家看看”。
从天井走进客堂、灶披间、亭子间、晒台……每间屋里有几件老物件。点一下，镜头凑近，物件自己动起来，
弹出一张沪语词卡：上海话写法、普通话意思、一句家常介绍，还能听到我亲口念的上海话。

整栋石库门和三排弄堂可以一间间走进去：14 间屋、64 张沪语词卡，录音全部由我录制。

## 在自己电脑上运行

在线打开时，第一次要下载约 690MB（弄堂约 330MB，推门进屋再下约 360MB），网速慢时会比较久。
也可以把仓库下载到自己电脑上运行，之后打开只要几秒：

```bash
git clone https://github.com/rullerzhou-afk/nongtang-shenchu.git
cd nongtang-shenchu
python3 -m http.server 8000
```

然后用 Chrome 或 Edge 打开 http://localhost:8000 。不能直接双击 `index.html`：浏览器不允许本地文件加载网页模块。

## 目录

| 路径 | 内容 |
| --- | --- |
| `index.html`、`home.js`、`entry.js`、`indoor.js`、`rooms.js` | 游戏：首页街区、推门进屋、固定机位和各房间之间的走动 |
| `vignettes/` | 每间屋的小剧场和沪语词卡 |
| `audio/` | 64 段沪语词卡录音（我本人录制）和背景音乐 |
| `art/` | 游戏里用到的贴图（阿婆的字条、早点、火柴盒等） |
| `shikumen-house-v3.2/fast/` | 整栋石库门和三排弄堂：用代码建模的建筑（`house.js`、`assets/*.js`），以及 Lux3D 生成后检查修补过的家具器物、贴图 |
| `shikumen-house-v3.2/source/` | three.js r160 运行库 |
| `report/` | 项目报告书网页版、参考资料页、PPTX |

## 怎么做的

- 建筑、门窗、楼梯、规则构件用代码按调研结果建模，三维画面用 three.js 实时渲染。
- 家具、织物、器皿、食物等由 Aholo Lux3D 生成，再逐件检查背面、底面和内腔，在 Blender 里修补后装进房子。
- 这是线上部署用的版本：超过 25MB 的文件切成了小块，贴图改成并行加载，加载页显示下载进度。

详细的调研、制作流程，以及 Lux3D 的用法和效果，见[项目报告书](https://nongtang.rullerzhou.com/report/)。

## 版权

© 2026 [rullerzhou-afk](https://github.com/rullerzhou-afk) 保留所有权利。

仓库公开仅供浏览、学习交流和黑客松评审。未经书面许可，不得复制、修改、再发布或商用其中的代码、模型、贴图、录音和文字。详见 [LICENSE](LICENSE)。
