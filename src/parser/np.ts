import type { SourceToken, Entity } from "../ast/types.js";
import { DETERMINERS, POSSESSIVE_DETERMINERS, BE_FORMS, MODALS, DO_SUPPORT, MODAL_NEGATIVE_CONTRACTIONS, CORPUS_VERBS } from "../lexicon/closedClass.js";
import { casingRenderSentenceInitial } from "./casing.js";

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

function possessiveBase(t: SourceToken): string | null {
  const m = /^(.+)'s$/i.exec(t.surface);
  return m ? m[1] : null;
}

// Regional/informal intensifier adverbs that precede an adjective complement
// (e.g. "bloody brilliant") rather than co-modifying as a second adjective.
const INTENSIFIER_ADVERBS = new Set(["bloody"]);

/**
 * Parses a bounded noun-phrase span (already sliced to its boundary by the caller)
 * into an Entity whose `.render` is the final EAC surface string.
 *
 * Grammar: [possessive-chain]* [determiner]? [adjective]* [head-noun]
 * Per the Possession spec: when a possessor is present, the whole NP renders as a
 * flat dot chain (my.father.car) rather than using adjective=... notation.
 */
export function parseObjectNP(tokens: SourceToken[]): Entity {
  const start = tokens[0]?.start ?? 0;
  const end = tokens[tokens.length - 1]?.end ?? start;
  if (tokens.length === 0) {
    return { type: "Entity", surface: "", render: "?", kind: "unknown_placeholder", start, end };
  }

  let pos = 0;
  const chainParts: string[] = [];
  let hasPossession = false;

  while (pos < tokens.length) {
    const t = tokens[pos];
    const lw = lower(t);
    if (POSSESSIVE_DETERMINERS.has(lw)) {
      chainParts.push(lw);
      hasPossession = true;
      pos++;
      continue;
    }
    const base = possessiveBase(t);
    if (base) {
      chainParts.push(base);
      hasPossession = true;
      pos++;
      continue;
    }
    break;
  }

  if (pos < tokens.length && DETERMINERS.has(lower(tokens[pos])) && !hasPossession && pos < tokens.length - 1) {
    pos++; // determiner dropped, not added to output (only if a noun follows it)
  }

  const content = tokens.slice(pos);
  if (content.length === 0) {
    // possessive chain with nothing left to possess (shouldn't happen in MVP grammar)
    return { type: "Entity", surface: tokens.map((t) => t.surface).join(" "), render: chainParts.join("."), kind: "common_noun", start, end };
  }

  if (hasPossession) {
    for (const t of content) chainParts.push(t.surface);
    return {
      type: "Entity",
      surface: tokens.map((t) => t.surface).join(" "),
      render: chainParts.join("."),
      kind: /^[A-Z]/.test(content[content.length - 1].surface) ? "proper_noun" : "common_noun",
      start,
      end,
    };
  }

  const headToken = content[content.length - 1];
  const adjTokens = content.slice(0, -1);
  const headRender = headToken.surface;
  let render = headRender;
  if (adjTokens.length === 1 && INTENSIFIER_ADVERBS.has(lower(adjTokens[0]))) {
    render = `${headRender}(adverb=${lower(adjTokens[0])})`;
  } else if (adjTokens.length === 1) {
    render = `${headRender}(adjective=${adjTokens[0].surface})`;
  } else if (adjTokens.length > 1) {
    render = `${headRender}(adjective=[${adjTokens.map((t) => t.surface).join(", ")}])`;
  }

  return {
    type: "Entity",
    surface: tokens.map((t) => t.surface).join(" "),
    render,
    kind: /^[A-Z]/.test(headToken.surface) ? "proper_noun" : "common_noun",
    adjectives:
      adjTokens.length > 0
        ? adjTokens.map((t) => ({ type: "Adjective" as const, surface: t.surface, render: t.surface, start: t.start, end: t.end }))
        : undefined,
    start,
    end,
  };
}

/**
 * Subject-position NP parsing. Bare pronoun/proper-noun subjects are exactly one
 * token; a longer NP (adjective(s)+noun) only occurs with a leading determiner or
 * possessive, which is the signal used to decide how many tokens to consume.
 */
export function parseSubjectNP(tokens: SourceToken[]): { entity: Entity; consumed: number } {
  const t0 = tokens[0];
  const lw0 = lower(t0);

  const startsMultiWordNP = DETERMINERS.has(lw0) || POSSESSIVE_DETERMINERS.has(lw0) || possessiveBase(t0) !== null;

  if (!startsMultiWordNP) {
    const sentenceInitialRender = casingRenderSentenceInitial(t0.surface);
    return {
      entity: {
        type: "Entity",
        surface: t0.surface,
        render: sentenceInitialRender,
        kind: /^[A-Z]/.test(sentenceInitialRender) ? "proper_noun" : "common_noun",
        start: t0.start,
        end: t0.end,
      },
      consumed: 1,
    };
  }

  // Scan forward to find the head noun: the last token before the verb region begins.
  let idx = 0;
  while (idx < tokens.length) {
    const next = tokens[idx + 1];
    const nextLw = next ? lower(next) : null;
    const isStop = nextLw === null || BE_FORMS.has(nextLw) || MODALS.has(nextLw) || DO_SUPPORT.has(nextLw) || nextLw in MODAL_NEGATIVE_CONTRACTIONS || CORPUS_VERBS.has(nextLw);
    if (isStop) break;
    idx++;
  }
  const npSlice = tokens.slice(0, idx + 1);
  const entity = parseObjectNP(npSlice);
  // Apply sentence-initial casing to the very first token's contribution if the
  // determiner was dropped and the head noun happens to be that first token's own
  // adjective/noun content (rare in this grammar, but keep correctness for e.g. "Big W"-like heads).
  return { entity, consumed: idx + 1 };
}
