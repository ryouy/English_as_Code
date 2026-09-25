import type { SourceToken } from "../ast/types.js";

export interface MultiwordToken extends SourceToken {
  isPhrase: true;
  role: "verb" | "complement";
}

interface MultiwordEntry {
  words: string[];
  joined: string;
  role: "verb" | "complement";
}

// MultiwordLexicon (slang subset): phrases whose surface must be recognized as one
// unit before general grammar rules run (compositional=false per slang spec §8).
const ENTRIES: MultiwordEntry[] = [
  { words: ["got", "ratioed"], joined: "got_ratioed", role: "verb" },
  { words: ["locked", "in"], joined: "locked_in", role: "complement" },
  { words: ["hang", "out"], joined: "hang_out", role: "verb" },
  { words: ["spill", "the", "tea"], joined: "spill_the_tea", role: "verb" },
  { words: ["touch", "grass"], joined: "touch_grass", role: "verb" },
  { words: ["shoot", "your", "shot"], joined: "shoot_your_shot", role: "verb" },
  { words: ["say", "less"], joined: "say_less", role: "verb" },
  { words: ["my", "bad"], joined: "my_bad", role: "verb" },
];

export function mergeMultiwordPhrases(tokens: SourceToken[]): SourceToken[] {
  const out: SourceToken[] = [];
  let i = 0;
  outer: while (i < tokens.length) {
    for (const entry of ENTRIES) {
      const n = entry.words.length;
      if (i + n > tokens.length) continue;
      const slice = tokens.slice(i, i + n);
      if (slice.every((t, j) => t.surface.toLowerCase() === entry.words[j])) {
        const merged: MultiwordToken = {
          surface: entry.joined,
          start: slice[0].start,
          end: slice[n - 1].end,
          isPhrase: true,
          role: entry.role,
        };
        out.push(merged);
        i += n;
        continue outer;
      }
    }
    out.push(tokens[i]);
    i++;
  }
  return out;
}

export function isMultiwordToken(t: SourceToken): t is MultiwordToken {
  return (t as MultiwordToken).isPhrase === true;
}
