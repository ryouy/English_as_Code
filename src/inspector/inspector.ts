import { tokenize } from "../tokenizer/tokenize.js";
import { renderGrammar } from "../renderer/grammar.js";
import { INFORMAL_CONTRACTIONS, INTERNET_ABBREVIATIONS, SEMANTIC_SLANG } from "../lexicon/slang.js";

export interface InspectorItem {
  start: number;
  end: number;
  word: string;
  pos: string;
  role: string;
  isSlang: boolean;
  category?: string;
  gloss?: string;
  normalized?: string;
  register?: string;
  confidence?: string;
}

/** Per-token Inspector metadata: POS/role plus slang gloss when the token is a
 * known informal/internet/semantic-slang entry. Surface text is never altered —
 * this only adds explanatory metadata for the UI panel. */
export function buildInspectorItems(input: string): InspectorItem[] {
  const tokens = tokenize(input).filter((t) => !/^[.,!?;:]$/.test(t.surface));
  const grammarRows = renderGrammar(input);

  return tokens.map((t, i) => {
    const lw = t.surface.toLowerCase();
    const slang = INFORMAL_CONTRACTIONS[lw] ?? INTERNET_ABBREVIATIONS[lw] ?? SEMANTIC_SLANG[lw];
    const row = grammarRows[i] ?? { pos: "unknown", role: "unknown" };
    return {
      start: t.start,
      end: t.end,
      word: t.surface,
      pos: row.pos,
      role: row.role,
      isSlang: !!slang,
      category: slang?.category,
      gloss: slang?.gloss,
      normalized: slang?.normalized,
      register: slang?.register,
      confidence: slang?.confidence,
    };
  });
}
