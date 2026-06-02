# 凌霄錄 · Ling-Xiao Demo

轉生修仙文字遊戲 — 以 **SugarCube 2.37.3**（與 *Degrees of Lewdity* 同款引擎）打造的獨立網頁遊戲，
採 DoL / Course of Temptation 式的**時間 × 地點沙盒 + 引導主線**架構。

> 18+ 成人向設定。所有角色均為成年人，親密情節以氛圍與留白呈現，不含露骨描寫。

## 立即遊玩

下載後直接用瀏覽器開啟 [`凌霄錄/build/凌霄錄.html`](凌霄錄/build/凌霄錄.html)（單一檔案，內含引擎與存檔）。

## 特色

- **右側狀態欄**：時辰/日期、地點、境界、氣血/靈力/修為、靈石/書幣、道心/心魔/聲望/疲勞（門檻顏色）、好感。
- **時間系統**：十二時辰 + 天數，行動與移動消耗時辰、累積疲勞，日夜影響事件。
- **地點地圖**：凌霄峰 7 地、南疆 5 地、幽冥澤 5 地，移動耗時，NPC 與事件依條件出現；各地皆有「四處走走」隨機日常。
- **四大系統**：修煉養成・回合制戰鬥・煉丹火候小遊戲・採集探索。
- **四卷主線**：轉生復仇 → 凌霄劍宗 → 南疆萬妖山 → 幽冥禁地。
- **三女主感情線**：蘇羽瑤、青玲兒、陰離，里程碑事件解鎖專屬劇情；每位皆有程式生成的水墨風立繪（可換真實圖）。
- **數字鍵/快捷鍵**：1–9 選項、空白 確認、M 地圖、R 歇息、Esc 返回。

## 開發 / 自行編譯

本倉庫已內附 Tweego（macOS x64）與 SugarCube 2.37.3 story format：

```bash
./build.sh          # 編譯 凌霄錄/src/**.twee → 凌霄錄/build/凌霄錄.html
node server.mjs     # 本機預覽 http://localhost:8137
```

## 文件

- [專案資訊・資料模型・內容地圖](凌霄錄/docs/PROJECT.md)
- [開發流程・擴充食譜・SugarCube 陷阱](凌霄錄/docs/WORKFLOW.md)
- [開發 Roadmap / 待辦](凌霄錄/docs/ROADMAP.md)
- [原始碼結構速覽](凌霄錄/README.md)
- 世界觀與設定：[`凌霄錄/docs/`](凌霄錄/docs/)
- 給 Claude Code 的工作指引：[`CLAUDE.md`](CLAUDE.md)

## 授權

遊戲程式碼為本專案作品。引擎 [SugarCube 2](https://www.motoslave.net/sugarcube/2/) 與 [Tweego](https://www.motoslave.net/tweego/) 各依其原授權（見 `tools/LICENSE`）。
