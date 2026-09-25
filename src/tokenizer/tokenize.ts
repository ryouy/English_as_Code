import type { SourceToken } from "../ast/types.js";

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*|[.,!?;:]/g;

/**
 * Tokenizes preserving source spans for bidirectional highlighting.
 * Contractions like "don't", "I'm", "y'all" stay as single tokens;
 * the parser layer decides how to expand them.
 */
export function tokenize(input: string): SourceToken[] {
  const tokens: SourceToken[] = [];
  let match: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(input)) !== null) {
    tokens.push({ surface: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

export function stripTrailingPunct(tokens: SourceToken[]): { core: SourceToken[]; endedWithQuestion: boolean } {
  const core = tokens.slice();
  let endedWithQuestion = false;
  while (core.length && /^[.,!?;:]$/.test(core[core.length - 1].surface)) {
    if (core[core.length - 1].surface === "?") endedWithQuestion = true;
    core.pop();
  }
  return { core, endedWithQuestion };
}
