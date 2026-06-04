#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   凌霄錄 · headless 冒煙測試 / 平衡校正
   讀取 src/**.twee 的 [script] 區塊載入 vm sandbox（含最小 SugarCube stub），
   再以純 JS 重現「戰鬥／修煉」核心公式模擬通關路徑，斷言：
     ① 全 script 區塊可載入不拋例外
     ② 屬性結算無 NaN、隨境界單調成長
     ③ 戰鬥一定會結束（不無限迴圈）、早期可勝、BOSS 非低境界可輕鬆通殺
   退出碼非 0 = 失敗（供 CI）。  用法：node smoke.mjs [--quiet]
   ════════════════════════════════════════════════════════════ */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "凌霄錄", "src");
const QUIET = process.argv.includes("--quiet");
const log = (...a) => { if (!QUIET) console.log(...a); };

let errors = 0;
const fail = (m) => { errors++; console.error("✗ " + m); };
const ok = (m) => log("  ✓ " + m);

/* ── 收集所有 .twee ── */
function walk(dir) {
	let out = [];
	for (const f of fs.readdirSync(dir)) {
		const p = path.join(dir, f);
		if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
		else if (f.endsWith(".twee")) out.push(p);
	}
	return out;
}

/* ── 抽出 [script] 區塊本體（逐行，避免跨段落污染） ── */
function extractScripts(text) {
	const lines = text.split(/\r?\n/);
	const blocks = [];
	let cur = null;
	for (const line of lines) {
		if (/^::\s/.test(line)) {                       // 段落標頭
			if (cur) { blocks.push(cur); cur = null; }
			if (/\[script\]/.test(line)) {
				const nm = line.replace(/^::\s*/, "").replace(/\s*\[.*$/, "");
				cur = { name: nm, body: [] };
			}
		} else if (cur) {
			cur.body.push(line);
		}
	}
	if (cur) blocks.push(cur);
	return blocks.map(b => ({ name: b.name, body: b.body.join("\n") }));
}

/* ── 最小 SugarCube / DOM stub ── */
function makeSandbox() {
	const elStub = () => ({ classList: { add() {}, remove() {}, contains() { return false; } }, style: {}, appendChild() {}, insertBefore() {}, setAttribute() {}, querySelector: () => null, firstChild: null, textContent: "" });
	const $stub = function () { return { on() { return this; } }; };
	$stub.fn = {};
	const ctx = {
		setup: {},
		Config: { passages: {}, saves: {}, history: {}, ui: {} },
		State: { variables: {}, active: { variables: {} }, temporary: {} },
		Macro: { add() {} },
		Setting: { addToggle() {}, addList() {}, addRange() {}, addHeader() {}, save() {}, load() {} },
		Scripting: {},
		Engine: {}, Save: {}, UI: {}, Dialog: {},
		$: $stub, jQuery: $stub,
		document: {
			addEventListener() {}, querySelectorAll: () => [], getElementById: () => null,
			createElement: elStub, body: elStub(),
		},
		window: {}, navigator: { userAgent: "node" },
		setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
		memorize: () => {}, recall: (k, d) => d, forget: () => {},
		console, Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, parseInt, parseFloat, isNaN,
	};
	ctx.window = ctx;
	vm.createContext(ctx);
	return ctx;
}

const files = walk(SRC);
const ctx = makeSandbox();
let loaded = 0, scriptCount = 0;
for (const f of files) {
	const text = fs.readFileSync(f, "utf8");
	for (const blk of extractScripts(text)) {
		scriptCount++;
		try {
			vm.runInContext(blk.body, ctx, { filename: blk.name });
			loaded++;
		} catch (e) {
			fail(`script 區塊載入失敗 [${blk.name}] (${path.basename(f)}): ${e.message}`);
		}
	}
}
const setup = ctx.setup;
log(`\n載入 ${loaded}/${scriptCount} 個 script 區塊`);
if (typeof setup.newPlayer !== "function") { fail("setup.newPlayer 未定義 — 引擎未正確載入"); finish(); }

const rnd = (n) => Math.floor(Math.random() * n);
const isNum = (x) => typeof x === "number" && !Number.isNaN(x) && Number.isFinite(x);

/* ════════ ① 新玩家 / 屬性結算 ════════ */
log("\n[1] 玩家初始化與屬性結算");
const p0 = setup.newPlayer();
["atk", "def", "maxHp", "maxMp", "luck", "cultMul"].forEach(k => {
	if (!isNum(p0[k]) || p0[k] <= 0) fail(`新玩家 ${k} 異常: ${p0[k]}`);
});
ok(`新玩家 atk=${p0.atk} maxHp=${p0.maxHp} def=${p0.def} luck=${p0.luck}`);

/* 境界成長單調性 + 無 NaN */
let prevAtk = -1, prevHp = -1, growthOk = true;
const realmCount = setup.realms.length;
for (let r = 0; r < realmCount; r++) {
	const layers = setup.realms[r].layers;
	for (let l = 1; l <= layers; l++) {
		const p = setup.newPlayer();
		p.realm = r; p.layer = l; setup.recompute(p);
		if (!isNum(p.atk) || !isNum(p.maxHp)) { fail(`境界 r${r}l${l} 屬性 NaN`); growthOk = false; }
		if (p.atk < prevAtk || p.maxHp < prevHp) { fail(`境界 r${r}l${l} 屬性非單調(atk ${p.atk}<${prevAtk})`); growthOk = false; }
		prevAtk = p.atk; prevHp = p.maxHp;
	}
}
if (growthOk) ok(`境界 0→${realmCount - 1} 屬性單調成長且無 NaN（頂階 atk=${prevAtk} maxHp=${prevHp}）`);

/* cultNeed 單調 */
let needOk = true, prevNeed = -1;
for (let r = 0; r < realmCount; r++) for (let l = 1; l <= setup.realms[r].layers; l++) {
	const need = setup.cultNeed({ realm: r, layer: l });
	if (!isNum(need) || need <= prevNeed) { needOk = false; fail(`cultNeed r${r}l${l}=${need} 非遞增`); }
	prevNeed = need;
}
if (needOk) ok(`cultNeed 全程遞增（頂階需求 ${prevNeed}）`);

/* ════════ ② 戰鬥模擬（鏡像 21-combat 公式） ════════ */
function simBattle(p, foeId, elem, maxTurns = 300) {
	const b = setup.newBattle(foeId, "w", "l");
	const e = setup.enemies[foeId];
	b.elem = elem || "金";
	let php = p.maxHp, pmp = p.maxMp;
	// 開場道侶援護
	const la = setup.loverAssist ? setup.loverAssist(p) : null;
	if (la) { b.pAtkBuff = la.atk; b.pAtkBuffT = 99; }
	let turn = 0;
	while (b.foeHp > 0 && php > 0) {
		if (++turn > maxTurns) return { ended: false, win: false, php, turns: turn };
		// ── 玩家攻擊 ──
		let base = p.atk + b.pAtkBuff - (b.pWeakT > 0 ? Math.round(p.atk * 0.25) : 0);
		let dmg = base + rnd(8) - rnd(4) - e.def;
		if (Math.random() < p.crit) dmg = Math.round(dmg * 1.7);
		if (p.combo > 0 && Math.random() < p.combo) dmg = Math.round(dmg * 1.5);
		const pe = setup.playerElemMult(b.elem, setup.enemyElem[foeId]); dmg = Math.round(dmg * pe.mult);
		const cc = setup.chaosCounter(p, foeId); dmg = Math.round(dmg * cc.mult);
		if (p.beastEquipped && setup.beasts && setup.beasts[p.beastEquipped]) dmg = Math.round(dmg * 1.08);
		dmg = Math.max(1, dmg);
		b.foeHp -= dmg;
		// 命中附狀態
		const st = setup.elemStatus(b.elem);
		if (st && b.foeHp > 0) b[st.key] = Math.max(b[st.key], st.turns);
		if (b.foeHp <= 0) break;
		// ── 敵方階段 ──
		// DoT
		if (b.foeBurn > 0 || b.foePoison > 0) {
			let dot = 0;
			if (b.foeBurn > 0) dot += Math.round(b.foeMax * 0.05) + 4;
			if (b.foePoison > 0) dot += Math.round(b.foeMax * 0.04) + 3;
			b.foeHp = Math.max(0, b.foeHp - dot);
			if (b.foeHp <= 0) break;
		}
		// BOSS 二階段
		const bp = setup.bossPhase[foeId];
		if (bp && !b.phase2 && (b.foeHp / b.foeMax) <= bp.at) {
			b.phase2 = true; b.foeAtkUp = (b.foeAtkUp || 0) + bp.atkUp;
			b.foeHp = Math.min(b.foeMax, b.foeHp + Math.round(b.foeMax * bp.heal));
			b.foeBurn = b.foePoison = b.foeStun = b.foeWeak = 0;
		}
		let eatk = e.atk + (b.foeAtkUp || 0);
		if (b.foeWeak > 0) eatk = Math.round(eatk * 0.7);
		if (b.foeStun > 0) { b.foeStun--; }
		else {
			const sk = setup.enemySkills[foeId];
			let edmg = Math.max(1, eatk + rnd(6) - rnd(4) - p.def);
			let heal = 0;
			if (sk && Math.random() < sk.chance) {
				if (sk.type === "heavy") edmg = Math.round(edmg * 1.7);
				else if (sk.type === "lifesteal") heal = Math.round(edmg * 0.6);
				else if (sk.type === "weaken") b.pWeakT = Math.max(b.pWeakT, 2);
				else if (sk.type === "poison") b.pPoison = Math.max(b.pPoison, 3);
			}
			if (b.pShieldT > 0) edmg = Math.round(edmg * 0.5);
			// 氣運護盾（每戰一次）
			if ((php - edmg) <= 0 && !b.shieldUsed && Math.random() < (0.16 + p.luck / 700)) { edmg = 0; b.shieldUsed = true; }
			php -= edmg;
			if (heal > 0) b.foeHp = Math.min(b.foeMax, b.foeHp + heal);
		}
		if (b.pPoison > 0 && php > 0) php -= Math.round(p.maxHp * 0.04) + 3;
		// 遞減
		["foeBurn", "foePoison", "foeWeak", "pWeakT", "pPoison", "pShieldT"].forEach(k => { if (b[k] > 0) b[k]--; });
	}
	return { ended: true, win: b.foeHp <= 0 && php > 0, php, turns: turn };
}

function winRate(setupP, foeId, trials = 200, elem) {
	let wins = 0, unended = 0, turnsum = 0;
	for (let i = 0; i < trials; i++) {
		const p = setupP();
		const r = simBattle(p, foeId, elem);
		if (!r.ended) unended++;
		if (r.win) wins++;
		turnsum += r.turns;
	}
	return { rate: wins / trials, unended, avgTurns: Math.round(turnsum / trials) };
}

log("\n[2] 戰鬥模擬（勝率 / 是否收斂）");
// 早期玩家：練氣後期 + 入門劍訣 + 淬體（比武時的合理練度）
const earlyP = () => { const p = setup.newPlayer(); p.books = ["tuna", "sword", "body"]; p.realm = 0; p.layer = 6; setup.recompute(p); p.hp = p.maxHp; p.mp = p.maxMp; p.luck = p.luckBase; return p; };
// 中期：金丹期 + 進階劍意
const midP = () => { const p = setup.newPlayer(); p.books = ["tuna", "sword", "sword2", "body", "storm"]; p.realm = 2; p.layer = 5; setup.recompute(p); p.hp = p.maxHp; p.mp = p.maxMp; p.luck = p.luckBase; return p; };
// 後期：元嬰後期 + 全功法 + 混沌覺醒
const lateP = () => { const p = setup.newPlayer(); p.books = ["tuna", "sword", "sword2", "body", "storm", "eye"]; p.realm = 3; p.layer = 3; p.flags.chaosAwaken = true; setup.recompute(p); p.hp = p.maxHp; p.mp = p.maxMp; p.luck = p.luckBase; return p; };

// 注：模擬器只會「攻擊」，從不用 護體/丹藥/屬性策略，故為「最差下限」勝率；
//     真人善用機制應顯著更高。BOSS 下限落在 20–80% 即代表可勝但需技巧。
// [name, 玩家, 敵, 勝率下限, 最少平均回合(0=不檢)]
// 模擬器只「攻擊」→ 最差下限；BOSS 要求至少數回合，確保深化機制有用武之地。
const cases = [
	["早期(練氣6) vs 散修",      earlyP, "scout",         0.85, 0],
	["早期(練氣6) vs 秦驤",      earlyP, "qinxiang",      0.4,  0],
	["中期(金丹5) vs 鬼道修士",   midP,   "guidao",        0.6,  3],
	["中期(金丹5) vs 血煞先鋒",   midP,   "moqian",        0.5,  3],
	["後期(元嬰3) vs 血魔尊BOSS", lateP,  "bloodlord",     0.18, 6],
	["後期(元嬰3) vs 仙魔殘念",   lateP,  "xianmoremnant", 0.12, 6],
];
let allEnded = true;
for (const [name, mk, foe, lo, minT] of cases) {
	const r = winRate(mk, foe);
	let bad = false;
	if (r.unended > 0) { allEnded = false; bad = true; fail(`${name}: ${r.unended} 場未收斂(疑似無限迴圈)`); }
	if (r.rate < lo) { bad = true; fail(`${name}: 勝率 ${(r.rate * 100).toFixed(0)}% 低於下限 ${lo * 100}%（過難）`); }
	if (minT && r.avgTurns < minT) { bad = true; fail(`${name}: 均 ${r.avgTurns} 回合 < ${minT}（秒殺·深化機制無從發揮）`); }
	log(`  ${bad ? "⚠" : "✓"} ${name.padEnd(26)} 勝率 ${(r.rate * 100).toFixed(0).padStart(3)}%  均 ${r.avgTurns} 回合`);
}
if (allEnded) ok("所有戰鬥皆在回合上限內收斂");

/* ════════ ③ 秘境 / 法寶 掉落 ════════ */
log("\n[3] 秘境隨機事件分佈");
if (typeof setup.srRoll === "function") {
	const types = {};
	for (let i = 0; i < 3000; i++) { const e = setup.srRoll({ srDepth: 3, region: "lingxiao", cultMul: 1, maxHp: 300 }); types[e.type] = (types[e.type] || 0) + 1; }
	const keys = Object.keys(types);
	if (keys.length >= 4) ok(`srRoll 類型分佈: ${keys.map(k => k + ":" + (types[k] / 30).toFixed(0) + "%").join(" ")}`);
	else fail(`srRoll 類型過少: ${keys.join(",")}`);
}
if (typeof setup.srArtifact === "function") {
	const a1 = setup.srArtifact({ srDepth: 1, artifacts: [] });
	const aAll = setup.srArtifact({ srDepth: 9, artifacts: Object.keys(setup.artifacts) });
	if (a1 && setup.artifacts[a1].tier === 1 && aAll === null) ok("srArtifact 淺層給一階、全擁有回 null");
	else fail(`srArtifact 異常: d1=${a1} all=${aAll}`);
}

/* ════════ ④ 天時 / 期限 ════════ */
log("\n[4] 天時節律");
if (setup.worldPulse(7).ling && setup.worldPulse(9).mo) ok("靈氣潮(7)/魔氣潮(9) 觸發正確");
else fail("worldPulse 規則異常");

/* ════════ 結算 ════════ */
function finish() {
	log("");
	if (errors === 0) { console.log("\x1b[32m✓ 冒煙測試全通過\x1b[0m"); process.exit(0); }
	else { console.error(`\x1b[31m✗ 冒煙測試 ${errors} 項失敗\x1b[0m`); process.exit(1); }
}
finish();
