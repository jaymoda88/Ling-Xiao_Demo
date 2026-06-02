# 凌霄錄 · 開發工作流程與擴充指南

## 1. 環境與指令
```bash
./build.sh          # 編譯 凌霄錄/src/**.twee → 凌霄錄/build/凌霄錄.html（會先清除 macOS ._* 垃圾檔）
node server.mjs     # 本機預覽 http://localhost:8137
```
- 工具鏈內附於 `tools/`（Tweego macOS x64 + SugarCube 2.37.3 story format）。
- `build.sh` 設 `TWEEGO_PATH` 後呼叫 Tweego；Tweego 遞迴讀 `src/` 下所有 `.twee`。

## 2. 開發循環
1. 編輯 `src/**/*.twee`
2. `./build.sh`
3. 重整瀏覽器預覽 → 驗證
4. 連結檢查（見 §3）
5. `git add -A && git commit -m "…" && git push`

## 3. 測試檢查清單
**連結完整性**（每次大改後跑）：
```bash
cd 凌霄錄/src && node -e '
const fs=require("fs");
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+"/"+e.name):(e.name.endsWith(".twee")?[d+"/"+e.name]:[]));}
let t=walk(".").map(f=>fs.readFileSync(f,"utf8")).join("\n");
const P=new Set(),T=new Set();let m;
for(const r=/^::\s*([^\[\n]+?)\s*(\[[^\]]*\])?\s*$/gm;m=r.exec(t);)P.add(m[1].trim());
for(const r=/<<goto\s+"([^"]+)"/g;m=r.exec(t);)T.add(m[1]);
for(const r=/<<startBattle\s+"[^"]+"\s+"([^"]+)"\s+"([^"]+)"/g;m=r.exec(t);){T.add(m[1]);T.add(m[2]);}
for(const r=/passage:"([^"]+)"/g;m=r.exec(t);)T.add(m[1]);
console.log("missing:",[...T].filter(x=>!P.has(x)).join(", ")||"none");'
```
**手動驗證重點**：新事件能在正確地點/條件浮現、結尾回到 `$p.loc`、好感/旗標只計一次、立繪正常、無 `.macro-error` 紅框。

## 4. 擴充食譜（Cookbook）

### 加一個劇情事件
1. 在 `framework/02-engine.twee` 的 `setup.events` 加一筆：
   ```js
   { passage:"my_event", loc:"jianya", label:"⚡ 事件標題",
     cond:function(p){ return p.flags.someFlag && !p.flags.myEventDone; } },
   ```
2. 在對應 `story/*.twee` 寫段落（記得設旗標、結尾回地點）：
   ```
   :: my_event [game]
   <div class="scene">
   <<portrait "suyuyao">>            /% 若有角色登場 %/
   <div class="scene-title">標題</div>
   <p>…內文…</p>
   </div>
   <div class="choices">
     <<link "選項一">><<set $p.flags.myEventDone to true>><<rel "suyuyao" 5>><<goto $p.loc>><</link>>
   </div>
   ```
3. `cond` 自帶「未完成」判斷（用旗標短路），事件演完設旗標即自動消失。

### 加一個地點
1. `setup.locations` 加：`myloc: { name:"地名", region:"lingxiao", icon:"🌙", desc:"…" }`
2. 把 id 放進 `setup.regions[區域].locs` 陣列（決定地圖順序）。
3. 在 `locations/*.twee` 寫段落（套用框架 widget）：
   ```
   :: myloc [game]
   <<enterLoc "myloc">>
   <div class="scene"><<locheader>></div>
   <<eventhere>>
   <div class="choices">
     <<link "某行動<span class='lx-hint'>提示</span>">><<pass 2>>…<<goto "myloc">><</link>>
     <<travelfoot>>
   </div>
   ```

### 加一個區域
1. `setup.regions` 加 `myreg:{ name:"區域名", locs:[...] }`、`setup.locations` 補各地點。
2. 在 `ui/11-map.twee` 加跨域遠行連結 + 一個 `journey_xxx` 段落（`<<pass N>><<enterLoc 首站>><<goto 首站>>`）。

### 加一位角色（+ 立繪 + 好感）
1. `setup.newPlayer` 的 `rel` 加 `newgirl: 0`。
2. `setup.relText` 加 `if(who==="newgirl"){…}` 分級文字。
3. `framework/04-caption.twee` 的 `cap-rel` 加一列。
4. `framework/09-portraits.twee` 的 `setup.portraits` 加一筆（hair1/hair2/skin/accent/glyph/glyphColor）；事件場景用 `<<portrait "newgirl">>`。
5. 好感變更**只用** `<<rel "newgirl" N>>`（會同時加值並顯示），勿再額外 `<<set $p.rel...>>`（會重複計算）。

### 加功法 / 丹方 / 敵人 / 日常
- **功法**：`setup.books` 加 `{name,cost,school,desc,eff:{atk/maxHp/def/cultMul/luck/crit/combo}}`，`recompute` 會自動結算。
- **丹方**：`setup.recipes` 加 `{name,mat:{herb:n},ideal,tol,desc}`；如需「進階丹方」隨書解鎖，仿 `library` 買書時 push recipe 的寫法。
- **敵人**：`setup.enemies` 加 `{name,hp,atk,def,stones,intro}`，用 `<<startBattle "id" "勝passage" "敗passage">>`。
- **日常**：`systems/23-dailies.twee` 的 `setup.dailies[loc]` 加 `{t:敘述, cult/stones/herb/stat:[k,n]/rel:[who,n]…}`。

## 5. SugarCube 慣例與陷阱（務必遵守）
1. **物件字面量別用 `<<set>>` 多行寫**：在 `[script]` 用 JS 函式組裝（如 `setup.newPlayer`），twee 端只 `<<set $p to setup.fn()>>`。
2. **macro 引數不支援行內括號/字串相接**：`<<m _dmg (_a+"x")>>` 會壞 → 先 `<<set _msg to …>>` 再 `<<m _dmg _msg>>`，或用反引號 `` `expr` ``。
3. **`<<capture _id>>…<</capture>>`** 必須成對包住 `<<for>>` 內用到迴圈變數的 `<<link>>`。
4. **全段落 `Config.passages.nobr = true`**：段落間距靠 `<p>`，別靠空行。
5. **別碰 `Config.saves.maxSlots`**（2.37 會丟錯使整個 script 中斷）。
6. **好感單一來源**：`<<rel>>` 同時 mutate + 顯示；事件分支不同數值就放在各自的目標段落，避免雙重計算。
7. **HUD/狀態欄用 StoryCaption**（段落後渲染），不要放 `PassageHeader`（段落 body 改了 $p 會顯示舊值）。

## 6. 測試小抄（preview_eval / 自動化）
- SugarCube 段落導航**延後一個 tick** → 用 eval 連續點擊時一次只點一個連結。
- 點指定選項：`[...document.querySelectorAll('.choices a.link-internal')].find(x=>x.textContent.includes('文字')).click()`
- 重置存檔回標題：`sessionStorage.removeItem('凌霄錄.state'); location.reload()`
- 模擬快捷鍵：`document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}))`

## 7. 提交慣例
- 中文 commit 訊息，簡述動機與範圍。
- 結尾署名：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- 編譯後的 `build/凌霄錄.html` 一併提交（方便直接遊玩）。
