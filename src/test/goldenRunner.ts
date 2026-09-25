import { readFileSync } from "node:fs";
import { parseSentence } from "../parser/sentence.js";
import { renderSimple } from "../renderer/simple.js";

interface GoldenCase {
  id: string;
  category: string;
  subcategory: string;
  input: string;
  expected_eac: string;
  status: "golden" | "review";
  register: string;
}

const dataPath = new URL("../../data/english_as_code_golden_corpus_v1.0.json", import.meta.url);
const data = JSON.parse(readFileSync(dataPath, "utf-8"));
const cases: GoldenCase[] = data.tests;

let goldenPass = 0;
let goldenFail = 0;
let reviewPass = 0;
let reviewFail = 0;
const failuresByCategory: Record<string, { id: string; input: string; expected: string; actual: string }[]> = {};

for (const c of cases) {
  let actual = "ERROR";
  try {
    const result = parseSentence(c.input);
    actual = renderSimple(result.ast);
  } catch (e) {
    actual = `ERROR: ${(e as Error).message}`;
  }

  const pass = actual === c.expected_eac;
  if (c.status === "golden") {
    if (pass) goldenPass++;
    else {
      goldenFail++;
      (failuresByCategory[c.category] ??= []).push({ id: c.id, input: c.input, expected: c.expected_eac, actual });
    }
  } else {
    if (pass) reviewPass++;
    else reviewFail++;
  }
}

const totalGolden = goldenPass + goldenFail;
const totalReview = reviewPass + reviewFail;

console.log(`\n=== Golden Corpus Results ===`);
console.log(`golden: ${goldenPass}/${totalGolden} passing (${((goldenPass / totalGolden) * 100).toFixed(1)}%)`);
console.log(`review: ${reviewPass}/${totalReview} passing (${((reviewPass / totalReview) * 100).toFixed(1)}%)`);

console.log(`\n=== Failures by category (golden only) ===`);
for (const [cat, fails] of Object.entries(failuresByCategory).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${cat}: ${fails.length} failing`);
  for (const f of fails.slice(0, Number(process.env.EAC_MAX_FAIL_PRINT ?? 8))) {
    console.log(`  [${f.id}] "${f.input}"`);
    console.log(`      expected: ${f.expected}`);
    console.log(`      actual:   ${f.actual}`);
  }
}

process.exitCode = goldenFail > 0 ? 1 : 0;
