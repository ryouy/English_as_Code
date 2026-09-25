import { tokenize } from "../tokenizer/tokenize.js";
import {
  SUBJECT_PRONOUNS,
  DETERMINERS,
  POSSESSIVE_DETERMINERS,
  BE_FORMS,
  BE_CONTRACTIONS,
  MODALS,
  MODAL_NEGATIVE_CONTRACTIONS,
  DO_SUPPORT,
  PREPOSITIONS,
  CONJUNCTIONS,
  WH_WORDS,
  KNOWN_ADVERBS,
  ADVERB_MODIFIERS,
} from "../lexicon/closedClass.js";

export interface GrammarRow {
  word: string;
  pos: string;
  role: string;
}

/**
 * Best-effort per-token POS/role table (the "Grammar" display mode). This is a
 * lightweight, independent pass over the raw tokens rather than a full AST walk —
 * it is illustrative, not part of the golden-tested EAC notation.
 */
export function renderGrammar(input: string): GrammarRow[] {
  const tokens = tokenize(input).filter((t) => !/^[.,!?;:]$/.test(t.surface));
  const rows: GrammarRow[] = [];

  for (const t of tokens) {
    const lw = t.surface.toLowerCase();
    let pos = "unknown";
    let role = "unknown";

    if (lw === "i" || SUBJECT_PRONOUNS[lw]) {
      pos = "pronoun";
      role = "subject";
    } else if (POSSESSIVE_DETERMINERS.has(lw)) {
      pos = "possessive determiner";
      role = "modifier";
    } else if (DETERMINERS.has(lw)) {
      pos = "determiner";
      role = "modifier";
    } else if (BE_FORMS.has(lw) || BE_CONTRACTIONS[lw]) {
      pos = "be-verb";
      role = "copula";
    } else if (MODALS.has(lw) || lw in MODAL_NEGATIVE_CONTRACTIONS) {
      pos = "modal";
      role = "auxiliary";
    } else if (DO_SUPPORT.has(lw)) {
      pos = "auxiliary";
      role = "do-support";
    } else if (lw === "not" || lw === "n't" || lw.endsWith("n't")) {
      pos = "negation";
      role = "negation";
    } else if (PREPOSITIONS.has(lw)) {
      pos = "preposition";
      role = "preposition";
    } else if (CONJUNCTIONS.has(lw)) {
      pos = "conjunction";
      role = "conjunction";
    } else if (WH_WORDS.has(lw)) {
      pos = "wh-word";
      role = "question";
    } else if (ADVERB_MODIFIERS.has(lw)) {
      pos = "adverb";
      role = "intensifier";
    } else if (KNOWN_ADVERBS.has(lw) || /ly$/.test(lw)) {
      pos = "adverb";
      role = "modifier";
    } else if (/^[A-Z]/.test(t.surface)) {
      pos = "proper noun";
      role = "entity";
    } else {
      pos = "verb/noun (context-dependent)";
      role = "predicate/complement";
    }

    rows.push({ word: t.surface, pos, role });
  }

  return rows;
}
