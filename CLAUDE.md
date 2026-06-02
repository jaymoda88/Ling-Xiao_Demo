# CLAUDE.md — 凌霄錄 專案工作指引

轉生修仙文字遊戲，**SugarCube 2.37.3 + Tweego**（與 *Degrees of Lewdity* 同源），DoL/CoT 式時間×地點沙盒。18+ 成人向、非露骨。

## 必讀文件
- 專案資訊・資料模型・內容地圖 → [`凌霄錄/docs/PROJECT.md`](凌霄錄/docs/PROJECT.md)
- 開發流程・擴充食譜・SugarCube 陷阱 → [`凌霄錄/docs/WORKFLOW.md`](凌霄錄/docs/WORKFLOW.md)
- 待辦/路線圖 → [`凌霄錄/docs/ROADMAP.md`](凌霄錄/docs/ROADMAP.md)
- 世界觀/情慾設定 → `凌霄錄/docs/lingxiao_*_setting.md`

## 指令
```bash
./build.sh          # 編譯 src/**.twee → 凌霄錄/build/凌霄錄.html
node server.mjs     # 預覽 http://localhost:8137
```

## 核心約定（細節見 WORKFLOW.md §5）
- 原始碼在 `凌霄錄/src/`（framework/ ui/ systems/ locations/ story/）；段落為全域命名空間，檔名僅作整理。
- 玩家狀態全在 `$p`（進存檔）；靜態資料掛 `setup.*`（不進存檔）。
- 加事件＝`setup.events` 加一筆 `{passage,loc,label,cond}` + 寫對應段落（結尾 `<<goto $p.loc>>`）。
- 好感**只用** `<<rel "who" N>>`（mutate+顯示一次）。

## 最容易踩的雷
1. 多行物件字面量別用 `<<set>>`，改在 `[script]` 用 JS 函式組裝。
2. macro 引數不支援行內 `(a+"b")`：先存成變數或用反引號。
3. 別設 `Config.saves.maxSlots`（會讓整個 script 崩）。
4. HUD 用 StoryCaption（段落後渲染），別用 PassageHeader。
5. `<<for>>` 內含迴圈變數的 `<<link>>` 要用 `<<capture>>…<</capture>>`。

## 改完流程
`./build.sh` → 預覽驗證 → `node check.mjs`（須全綠）→ `git add -A && git commit && git push`
commit 署名：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- 編譯產物 `凌霄錄/build/` **不入版控**（已 gitignore）；可玩 HTML 由 Release 發佈。
- 多 Agent 協作見 [`凌霄錄/docs/COLLAB.md`](凌霄錄/docs/COLLAB.md)：一人一 branch、只動自己的檔、PR 前 `node check.mjs`、Manager 整合。

GitHub：https://github.com/jaymoda88/Ling-Xiao_Demo
