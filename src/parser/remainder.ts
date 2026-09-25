import type { SourceToken, PrepArg, AdverbPhrase, Entity } from "../ast/types.js";
import { PREPOSITIONS, KNOWN_ADVERBS, ADVERB_MODIFIERS } from "../lexicon/closedClass.js";

// Unambiguous object pronouns only — "her"/"its"/"your" etc. are excluded since
// they double as possessive determiners ("her bag") and would wrongly split
// off from the noun they possess.
const UNAMBIGUOUS_OBJECT_PRONOUNS = new Set(["me", "him", "us", "them"]);
import { parseObjectNP } from "./np.js";
import { RELATIVE_PRONOUNS, parseNPWithOptionalRelativeClause } from "./clause.js";

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

export function isAdverbToken(t: SourceToken): boolean {
  const lw = lower(t);
  return KNOWN_ADVERBS.has(lw) || /ly$/.test(lw);
}

function isBoundary(t: SourceToken): boolean {
  const lw = lower(t);
  return PREPOSITIONS.has(lw) || isAdverbToken(t) || ADVERB_MODIFIERS.has(lw) || lw === "and" || lw === "or";
}

export interface RemainderResult {
  objects: Entity[];
  preps: PrepArg[];
  adverbs: AdverbPhrase[];
}

/**
 * Parses everything after subject+verb: direct object(s), preposition arguments,
 * and adverb(s) (including nested "very quickly" modifiers), in source order.
 * "and" between two objects/prep-args (e.g. "I like you and her mother") is an
 * argument-list separator here, not clause coordination — it's dropped and both
 * sides become separate entries, same as a comma in the rendered output.
 */
export function parseRemainder(tokens: SourceToken[]): RemainderResult {
  const objects: Entity[] = [];
  const preps: PrepArg[] = [];
  const adverbs: AdverbPhrase[] = [];

  let pos = 0;
  while (pos < tokens.length) {
    const t = tokens[pos];
    const lw = lower(t);

    if (lw === "and" || lw === "or") {
      pos++;
      continue;
    }

    // "the most" (superlative adverbial, e.g. "do you like the most?") -> adverb=most
    if (lw === "the" && lower(tokens[pos + 1] ?? ({} as SourceToken)) === "most") {
      adverbs.push({ type: "Adverb", surface: `${t.surface} ${tokens[pos + 1].surface}`, render: "most", start: t.start, end: tokens[pos + 1].end });
      pos += 2;
      continue;
    }

    if (PREPOSITIONS.has(lw)) {
      pos++;
      let npEnd = pos;
      while (npEnd < tokens.length && !isBoundary(tokens[npEnd])) npEnd++;
      const value = parseObjectNP(tokens.slice(pos, npEnd));
      preps.push({ type: "PrepArg", prep: lw, value, start: t.start, end: tokens[npEnd - 1]?.end ?? t.end });
      pos = npEnd;
      continue;
    }

    if (ADVERB_MODIFIERS.has(lw)) {
      const inner = tokens[pos + 1];
      const innerLw = inner ? lower(inner) : "";
      adverbs.push({
        type: "Adverb",
        surface: inner ? `${t.surface} ${inner.surface}` : t.surface,
        render: inner ? `${lw}(${innerLw})` : lw,
        start: t.start,
        end: inner?.end ?? t.end,
      });
      pos += inner ? 2 : 1;
      continue;
    }

    if (isAdverbToken(t)) {
      adverbs.push({ type: "Adverb", surface: t.surface, render: lw, start: t.start, end: t.end });
      pos++;
      continue;
    }

    // ditransitive: "give me a book" -> a bare object pronoun immediately
    // followed by MORE content is a separate indirect object, not one NP
    // ("book(adjective=[me, a])"). Split it off and let the next loop
    // iteration parse the direct object on its own.
    if (UNAMBIGUOUS_OBJECT_PRONOUNS.has(lw) && pos + 1 < tokens.length && !isBoundary(tokens[pos + 1])) {
      objects.push({ type: "Entity", surface: t.surface, render: lw, kind: "pronoun", start: t.start, end: t.end });
      pos++;
      continue;
    }

    // start of a bare object NP. If it contains a relative clause ("the man who
    // lives in Tokyo"), that clause's own prepositions/adverbs aren't top-level
    // boundaries, so it swallows the rest of the remainder rather than stopping
    // at the first one.
    let npEnd = pos;
    while (npEnd < tokens.length && !isBoundary(tokens[npEnd])) npEnd++;
    const hasRelativeClause = tokens.slice(pos, npEnd).some((t, i) => i > 0 && RELATIVE_PRONOUNS.has(lower(t)));
    if (hasRelativeClause) npEnd = tokens.length;
    const entity = parseNPWithOptionalRelativeClause(tokens.slice(pos, npEnd));
    objects.push(entity);
    pos = npEnd;
  }

  return { objects, preps, adverbs };
}

export function renderAdverbArg(adverbs: AdverbPhrase[]): string | null {
  if (adverbs.length === 0) return null;
  if (adverbs.length === 1) return `adverb=${adverbs[0].render}`;
  return `adverb=[${adverbs.map((a) => a.render).join(", ")}]`;
}
