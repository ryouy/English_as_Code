import type { SourceToken, PrepArg, AdverbPhrase, Entity } from "../ast/types.js";
import { PREPOSITIONS, KNOWN_ADVERBS, ADVERB_MODIFIERS } from "../lexicon/closedClass.js";
import { parseObjectNP } from "./np.js";

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

export function isAdverbToken(t: SourceToken): boolean {
  const lw = lower(t);
  return KNOWN_ADVERBS.has(lw) || /ly$/.test(lw);
}

function isBoundary(t: SourceToken): boolean {
  const lw = lower(t);
  return PREPOSITIONS.has(lw) || isAdverbToken(t) || ADVERB_MODIFIERS.has(lw) || lw === "and";
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

    if (lw === "and") {
      pos++;
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

    // start of a bare object NP
    let npEnd = pos;
    while (npEnd < tokens.length && !isBoundary(tokens[npEnd])) npEnd++;
    const entity = parseObjectNP(tokens.slice(pos, npEnd));
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
