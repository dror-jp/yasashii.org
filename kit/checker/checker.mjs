#!/usr/bin/env node
/**
 * やさしい日本語 機械チェッカー v2
 * 準拠: 在留支援のためのやさしい日本語ガイドライン(入管庁×文化庁)の機械判定可能ルール
 *       (抽出根拠: ../guideline-rules.md の (a)群)
 *
 * 思想: ガイドラインは「あえて厳密な基準を示していない」(本編p5)。
 *       よって本チェッカーは合否を出さず、「要確認箇所のハイライト」と
 *       参考メトリクスを返す。最終判断は人間検証層(ガイドラインSTEP3)が行う。
 *
 * 使い方: node checker.mjs <file.txt>   または  echo "文章" | node checker.mjs
 * 入力: ふりがな《》記法・分かち書きスペースは自動で除去して判定する。
 */
import kuromoji from "kuromoji";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIC = path.join(__dirname, "node_modules", "kuromoji", "dict");

// ガイドライン準拠の固定パターン(ルール番号は guideline-rules.md に対応)
const PATTERNS = [
  { rule: 8,  re: /ないことはない|なくはない|ないわけではない|ないとは言えない/g, why: "二重否定 → 肯定形に" },
  { rule: 16, re: /おそらく|ようです|ではないでしょうか|でしょうか|可能性があります|おそれがあります|と思われます/g, why: "推測表現 → 断定か「〜かもしれません」に" },
  { rule: 14, re: /くらい|ぐらい|ごろ|前後(?=[のにでは、。])/g, why: "曖昧な数量・時間表現 — 具体的な数字を検討" },
  { rule: 21, re: /令和|平成|昭和/g, why: "元号 → 西暦に" },
  { rule: 22, re: /\d{1,4}\/\d{1,2}(\/\d{1,4})?/g, why: "日付の「／」 → 「◯年◯月◯日」に" },
  { rule: 24, re: /\d[^\s。、]*[〜～][^\s。、]*\d/g, why: "「〜」 → 「◯◯から△△まで」に" },
  { rule: 27, re: /いらっしゃ|おっしゃ|お越し|伺い|伺っ|申し上げ|致します|頂き|頂く|参ります|ご覧/g, why: "尊敬語・謙譲語 → です・ます の丁寧語だけに" },
  { rule: 27, re: /ましょう/g, why: "「〜ましょう」は勧誘 — 指示は「〜てください」に" },
  { rule: 6,  re: /ということになります|ということになる|を実施(し|する|します)|を行い(ます)?|を行う/g, why: "回りくどい表現 → 簡単な動詞に(「実施する」→「する」)" },
  { rule: 15, re: /結構です/g, why: "多義表現(良い/要らない) → 意味を1つに" },
  { rule: 10, re: /なければなりません|なければならない/gs, why: "義務表現 — 指示なら「〜てください」を検討(ガイドラインは併用可)" },
  { rule: 10, re: /及び|並びに|又は|若しくは|に係る|の際は|につきましては|所定の|速やかに|直ちに|予め/g, why: "硬い語彙 → やさしい言い換えに(と/や/または/〜のとき/前もって/すぐに)" },
  { rule: 13, re: /(?<![:/.\w])[A-Za-z]{4,}(?![\w./])/g, why: "ローマ字・英語 — URL・固有名詞以外は避ける" },
];

function stripMarkup(text) {
  // ふりがな《》・分かち書きスペース・Markdownリンクを除去して判定用テキストにする
  // リンクは表示テキストだけを残す（URLを文字数・ローマ字として数えない）
  return text
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/《[^》]*》/g, "")
    .replace(/[ \t]+/g, "");
}

function splitSentences(text) {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[。！？!?])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[-—・#*>]/.test(s));
}

const tokenizerP = new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: DIC }).build((err, tk) => (err ? reject(err) : resolve(tk)));
});

export async function check(raw) {
  const tokenizer = await tokenizerP;
  const text = stripMarkup(raw);
  const sentences = splitSentences(text);
  const warnings = [];

  let totals = { tokens: 0, kango: 0, wago: 0, verb: 0, particle: 0, katakana: 0 };
  const lengths = [];

  sentences.forEach((s, i) => {
    const idx = i + 1;
    const len = s.length;
    lengths.push(len);

    // ルール4: 文長(自主基準50字)・読点
    if (len > 50) warnings.push({ sentence: idx, rule: "4 一文一義", detail: `一文が${len}字(自主基準50字以下)` });
    if ((s.match(/、/g) ?? []).length >= 3) warnings.push({ sentence: idx, rule: "4 一文一義", detail: "読点3つ以上 — 文を分けることを検討" });

    // 固定パターン群
    for (const p of PATTERNS) {
      const m = s.match(p.re);
      if (m) warnings.push({ sentence: idx, rule: `${p.rule} ${p.why.split(" ")[0]}`, detail: `「${m[0]}」: ${p.why}` });
    }

    // 形態素解析: 受身/使役(9)・述語数(4)・文末(27)
    const tokens = tokenizer.tokenize(s);
    let predicates = 0;
    tokens.forEach((t) => {
      totals.tokens++;
      const surf = t.surface_form;
      if (/[一-龯]/.test(surf) && t.pos === "名詞") totals.kango++;
      else if (/^[ぁ-ん]+$/.test(surf) && ["動詞", "形容詞", "副詞"].includes(t.pos)) totals.wago++;
      if (t.pos === "動詞") { totals.verb++; if (t.conjugated_form?.includes("基本") || t.conjugated_form?.includes("連用")) predicates++; }
      if (t.pos === "助詞") totals.particle++;
      if (/^[ァ-ヶー]+$/.test(surf)) totals.katakana++;
      if (t.pos === "助動詞" && ["れる", "られる"].includes(t.basic_form))
        warnings.push({ sentence: idx, rule: "9 受身", detail: `受身「${surf}」 — 能動の文に(だれが何をするかを明確に)` });
      if (t.pos === "助動詞" && ["せる", "させる"].includes(t.basic_form))
        warnings.push({ sentence: idx, rule: "9 使役", detail: `使役「${surf}」 — 直接的な表現に` });
    });
    if (predicates >= 3)
      warnings.push({ sentence: idx, rule: "4 一文一義", detail: `動詞が${predicates}個 — 文を分けることを検討` });
  });

  const n = totals.tokens || 1;
  const avgLen = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const kango = (totals.kango / n) * 100;
  const wago = (totals.wago / n) * 100;
  const verb = (totals.verb / n) * 100;
  const particle = (totals.particle / n) * 100;
  const jread = 11.724 - 0.056 * avgLen - 0.126 * kango - 0.042 * wago - 0.145 * verb - 0.044 * particle;

  return {
    note: "合否ではなく要確認箇所の提示(ガイドラインは厳密な基準を意図的に示していない)。最終判断は人間検証で。",
    sentences: sentences.length,
    avg_sentence_chars: Math.round(avgLen * 10) / 10,
    max_sentence_chars: Math.max(...lengths, 0),
    kango_rate: Math.round(kango * 10) / 10,
    katakana_rate: Math.round(((totals.katakana / n) * 100) * 10) / 10,
    jreadability_approx: Math.round(jread * 100) / 100,
    warning_count: warnings.length,
    warnings,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : fs.readFileSync(0, "utf8");
  check(input).then((r) => console.log(JSON.stringify(r, null, 2)));
}
