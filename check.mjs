#!/usr/bin/env node
// 凌霄錄 — 原始碼健檢腳本（lint / 連結 / macro 配對 / 已知陷阱）
//
// 用法：
//   node check.mjs            # 跑全部檢查；有 error 時 exit 1（可接 CI / pre-push）
//   node check.mjs --quiet    # 只印 error/warn 與總結
//
// 檢查項目：
//   [E] 連結缺漏 — <<goto>>/[[..]]/<<startBattle>>/passage:/<<link a b>>/<<include>> 指向不存在的段落
//   [E] macro 未配對 — <<if>>/<<for>>/<<switch>>/<<capture>>/<<silently>>/<<nobr>>/<<script>>/<<widget>> 及自訂 container widget
//   [E] Config.saves.maxSlots — 2.37 會丟錯使整個 script 中斷（CLAUDE.md 雷區 #3）
//   [W] 多行物件字面量 <<set ... {>> — 易壞，建議改在 [script] 用 JS 組裝（雷區 #1）
//   [W] 孤立段落 — 定義了但任何地方都沒被引用（可能是死碼；動態 <<goto _var>> 無法靜態追蹤，故僅警告）
//
// 註：以字串字面量為準。動態目標（<<goto $p.loc>> / <<goto _id>>）無法靜態驗證，會略過。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "凌霄錄", "src");
const QUIET = process.argv.includes("--quiet");

// ── 終端色 ──
const C = { red: "\x1b[31m", yel: "\x1b[33m", grn: "\x1b[32m", dim: "\x1b[2m", cyan: "\x1b[36m", rst: "\x1b[0m" };
const errors = [];
const warns = [];
const E = (msg) => errors.push(msg);
const W = (msg) => warns.push(msg);

// SugarCube 特殊段落（不算孤立）
const SPECIAL = new Set([
  "Start", "StoryInit", "StoryTitle", "StorySubtitle", "StoryAuthor", "StoryBanner",
  "StoryCaption", "StoryMenu", "StoryInterface", "StoryShare", "StoryData", "StorySettings",
  "PassageReady", "PassageDone", "PassageHeader", "PassageFooter",
  "StoryStylesheet", "StoryScript",
]);

// 一律是 container 的內建 macro（開/閉必成對）。link/button 因有自閉與容器兩種形式，故不納入嚴格配對。
const CONTAINERS = new Set([
  "if", "for", "switch", "capture", "silently", "nobr", "script", "widget",
  "append", "prepend", "replace", "repeat",
]);

// ── 蒐集 .twee 檔 ──
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith("._")) return []; // macOS AppleDouble 垃圾檔
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith(".twee") ? [p] : [];
  });
}

if (!fs.existsSync(SRC)) {
  console.error(`找不到原始碼目錄：${SRC}`);
  process.exit(2);
}
const files = walk(SRC).sort();

// 去除 /% … %/ 區塊註解，避免註解內的 macro 影響配對
const stripComments = (s) => s.replace(/\/%[\s\S]*?%\//g, "");

// ── 解析每個檔案：段落定義、container widget、各引用 ──
const passages = new Map(); // name -> { file, tags }
const refs = []; // { name, file, kind }
const customContainers = new Set();
const rawJoined = []; // 用於孤立段落的「字串引用」掃描

const HEADER = /^::\s*([^[\]{}\n]+?)\s*(\[[^\]]*\])?\s*(\{[^}]*\})?\s*$/;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, "utf8");
  rawJoined.push(raw);
  const body = stripComments(raw);
  const lines = body.split("\n");

  // 段落 header
  for (const line of lines) {
    const m = HEADER.exec(line);
    if (m) {
      const name = m[1].trim();
      const tags = (m[2] || "").replace(/[[\]]/g, "").trim();
      if (passages.has(name)) E(`段落重複定義：「${name}」（${passages.get(name).file} 與 ${rel}）`);
      passages.set(name, { file: rel, tags });
    }
  }

  // 自訂 container widget：<<widget "name" container>>
  for (const m of body.matchAll(/<<widget\s+["']([^"']+)["']\s+container\s*>>/g)) customContainers.add(m[1]);

  // ── 引用蒐集（皆字串字面量）──
  const add = (name, kind) => refs.push({ name, file: rel, kind });
  for (const m of body.matchAll(/<<goto\s+["']([^"']+)["']\s*>>/g)) add(m[1], "goto");
  for (const m of body.matchAll(/<<startBattle\s+["'][^"']+["']\s+["']([^"']+)["']\s+["']([^"']+)["']/g)) { add(m[1], "startBattle勝"); add(m[2], "startBattle敗"); }
  for (const m of body.matchAll(/passage\s*:\s*["']([^"']+)["']/g)) add(m[1], "event.passage");
  for (const m of body.matchAll(/<<(?:include|display)\s+["']([^"']+)["']/g)) add(m[1], "include");
  // <<link "label" "passage">> 兩引數自閉形式（避免吃到 [[a|b]] 形式）
  for (const m of body.matchAll(/<<(?:link|button)\s+["'][^"']*["']\s+["']([^"']+)["']\s*>>/g)) add(m[1], "link");
  // [[..]] 標準連結：[[target]] / [[text|target]] / [[text->target]] / [[target<-text]]
  for (const m of body.matchAll(/\[\[([^\]]+?)\]\]/g)) {
    let t = m[1];
    if (t.includes("->")) t = t.split("->").pop();
    else if (t.includes("<-")) t = t.split("<-")[0];
    else if (t.includes("|")) t = t.split("|").pop();
    t = t.trim();
    if (t && !t.startsWith("$") && !t.startsWith("_")) add(t, "link[[]]");
  }

  // ── macro 配對（依檔案各自堆疊）──
  const stack = [];
  for (const m of body.matchAll(/<<(\/?)([A-Za-z][\w]*)/g)) {
    const closing = m[1] === "/";
    const name = m[2];
    const isContainer = CONTAINERS.has(name) || customContainers.has(name);
    if (closing) {
      if (!CONTAINERS.has(name) && !customContainers.has(name)) continue; // 只追蹤已知 container 的關閉
      const top = stack.pop();
      if (top !== name) E(`macro 未配對：${rel} 出現 <</${name}>>，但堆疊頂端是 ${top ? "<<" + top + ">>" : "(空)"}`);
    } else if (isContainer) {
      stack.push(name);
    }
  }
  if (stack.length) E(`macro 未閉合：${rel} 仍有未關閉的 ${stack.map((s) => "<<" + s + ">>").join(", ")}`);

  // ── 已知陷阱 ──
  if (/Config\.saves\.maxSlots/.test(body)) E(`雷區：${rel} 設了 Config.saves.maxSlots（2.37 會使整個 script 崩，見 CLAUDE.md #3）`);
  // 多行物件字面量 <<set ... { （該行未閉合 }）
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (/<<set\b[^>]*\{/.test(ln) && (ln.match(/\{/g) || []).length > (ln.match(/\}/g) || []).length) {
      W(`可能的多行物件 <<set>>：${rel}:${i + 1} —— 建議改在 [script] 用 JS 函式組裝（雷區 #1）`);
    }
  }
}

// ── 連結缺漏 ──
const missing = new Map(); // name -> [{file,kind}]
for (const r of refs) {
  if (!passages.has(r.name)) {
    if (!missing.has(r.name)) missing.set(r.name, []);
    missing.get(r.name).push(r);
  }
}
for (const [name, rs] of missing) {
  E(`連結缺漏：段落「${name}」不存在 —— 被引用於 ${rs.map((r) => `${r.file}(${r.kind})`).join(", ")}`);
}

// ── 孤立段落（warn）──
// referenced = 任何字串字面量引用 ∪ 整體原始碼中以引號出現的名稱（涵蓋 setup 表內的 id）
const referenced = new Set(refs.map((r) => r.name));
const allText = rawJoined.join("\n");
const quoted = new Set();
for (const m of allText.matchAll(/["']([^"'\n]{1,60})["']/g)) quoted.add(m[1]);
for (const [name, meta] of passages) {
  if (SPECIAL.has(name)) continue;
  if (/\b(stylesheet|script|widget)\b/.test(meta.tags)) continue; // 樣式/腳本/widget 段落由 SC2 自動載入，不需被連結
  if (referenced.has(name) || quoted.has(name)) continue;
  W(`孤立段落：「${name}」（${meta.file}）未被任何字串引用 —— 可能是死碼，或僅由動態 <<goto>> 進入`);
}

// ── 輸出 ──
const log = (...a) => { if (!QUIET) console.log(...a); };
log(`${C.cyan}凌霄錄 健檢${C.rst}  段落 ${passages.size}・引用 ${refs.length}・檔案 ${files.length}`);
log(`${C.dim}────────────────────────────────────────${C.rst}`);

if (warns.length) {
  console.log(`${C.yel}⚠ 警告 ${warns.length}${C.rst}`);
  for (const w of warns) console.log(`  ${C.yel}•${C.rst} ${w}`);
}
if (errors.length) {
  console.log(`${C.red}✖ 錯誤 ${errors.length}${C.rst}`);
  for (const e of errors) console.log(`  ${C.red}•${C.rst} ${e}`);
}

if (!errors.length && !warns.length) console.log(`${C.grn}✓ 全部通過${C.rst}`);
else if (!errors.length) console.log(`${C.grn}✓ 無錯誤${C.rst}（${warns.length} 個警告）`);
else console.log(`${C.red}✖ ${errors.length} 個錯誤${C.rst}，${warns.length} 個警告`);

process.exit(errors.length ? 1 : 0);
