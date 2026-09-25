import type { SourceToken, ASTNode, Action, Copula, Entity, Idiom } from "../ast/types.js";
import { parseObjectNP } from "./np.js";
import { isMultiwordToken } from "../lexicon/multiword.js";

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

// Discourse/internet markers: name(content) wrapper. Matched greedily two-word
// first (e.g. "no cap") then single-word.
export const TWO_WORD_MARKERS: Record<string, string> = {
  "no cap": "no_cap",
};
export const ONE_WORD_MARKERS = new Set([
  "ngl",
  "tbh",
  "imo",
  "imho",
  "fr",
  "frfr",
  "btw",
  "rn",
  "afaik",
  "fyi",
  "nvm",
  "lowkey",
  "highkey",
]);

export interface MarkerMatch {
  marker: string;
  restTokens: SourceToken[];
  keywordStart: number;
  keywordEnd: number;
}

export function matchLeadingMarker(tokens: SourceToken[]): MarkerMatch | null {
  if (tokens.length >= 2) {
    const twoWord = `${lower(tokens[0])} ${lower(tokens[1])}`;
    if (TWO_WORD_MARKERS[twoWord]) {
      let restStart = 2;
      if (tokens[restStart] && tokens[restStart].surface === ",") restStart++;
      return { marker: TWO_WORD_MARKERS[twoWord], restTokens: tokens.slice(restStart), keywordStart: tokens[0].start, keywordEnd: tokens[1].end };
    }
  }
  if (tokens.length >= 1 && ONE_WORD_MARKERS.has(lower(tokens[0]))) {
    let restStart = 1;
    if (tokens[restStart] && tokens[restStart].surface === ",") restStart++;
    return { marker: lower(tokens[0]), restTokens: tokens.slice(restStart), keywordStart: tokens[0].start, keywordEnd: tokens[0].end };
  }
  return null;
}

/** Single-token bare-call idiom, e.g. spill_the_tea() / bet(). */
export function bareCallIdiom(tokens: SourceToken[]): Idiom | null {
  if (tokens.length === 1 && (isMultiwordToken(tokens[0]) && tokens[0].role === "verb")) {
    const t = tokens[0];
    return { type: "Idiom", id: t.surface, renderOverride: `${t.surface}()`, start: t.start, end: t.end };
  }
  if (tokens.length === 1 && lower(tokens[0]) === "bet") {
    const t = tokens[0];
    return { type: "Idiom", id: "bet", renderOverride: "bet()", start: t.start, end: t.end };
  }
  return null;
}

/** "hit me up (later)" -> hit_me_up(me[, adverb=later]) */
export function hitMeUpIdiom(tokens: SourceToken[]): Idiom | null {
  if (tokens.length >= 3 && lower(tokens[0]) === "hit" && lower(tokens[1]) === "me" && lower(tokens[2]) === "up") {
    const trailing = tokens.slice(3);
    const args = ["me"];
    if (trailing.length > 0) args.push(`adverb=${trailing.map((t) => t.surface.toLowerCase()).join(" ")}`);
    return { type: "Idiom", id: "hit_me_up", renderOverride: `hit_me_up(${args.join(", ")})`, start: tokens[0].start, end: tokens[tokens.length - 1].end };
  }
  return null;
}

/** "gimme X" -> give(me, X) */
export function gimmeIdiom(tokens: SourceToken[]): Idiom | null {
  if (tokens.length >= 2 && lower(tokens[0]) === "gimme") {
    const obj = parseObjectNP(tokens.slice(1));
    return { type: "Idiom", id: "gimme", renderOverride: `give(me, ${obj.render})`, start: tokens[0].start, end: tokens[tokens.length - 1].end };
  }
  return null;
}

/** "kinda WORD" / "sorta WORD" fragment -> marker(word) */
export function kindaSortaIdiom(tokens: SourceToken[]): Idiom | null {
  if (tokens.length >= 2 && (lower(tokens[0]) === "kinda" || lower(tokens[0]) === "sorta")) {
    const marker = lower(tokens[0]);
    const rest = tokens.slice(1).map((t) => t.surface.toLowerCase()).join(" ");
    return { type: "Idiom", id: marker, renderOverride: `${marker}(${rest})`, start: tokens[0].start, end: tokens[tokens.length - 1].end };
  }
  return null;
}

/** "Cheers, mate." -> cheers(mate) — a bare word + comma-set-off address term,
 * not a discourse marker wrapping a full clause. */
export function commaVocativeIdiom(tokens: SourceToken[]): Idiom | null {
  if (tokens.length === 3 && tokens[1].surface === "," && /^[A-Za-z']+$/.test(tokens[0].surface) && /^[A-Za-z']+$/.test(tokens[2].surface)) {
    const head = lower(tokens[0]);
    const arg = lower(tokens[2]);
    return { type: "Idiom", id: head, renderOverride: `${head}(${arg})`, start: tokens[0].start, end: tokens[2].end };
  }
  return null;
}

/** "Ain't nobody here." -> !(nobody = here) */
export function aintIdiom(tokens: SourceToken[]): Copula | null {
  if (tokens.length >= 3 && lower(tokens[0]) === "ain't") {
    const rest = tokens.slice(1);
    const complement = rest[rest.length - 1];
    const subjectTokens = rest.slice(0, -1);
    const subject: Entity = {
      type: "Entity",
      surface: subjectTokens.map((t) => t.surface).join(" "),
      render: subjectTokens.map((t) => t.surface.toLowerCase()).join(" "),
      kind: "common_noun",
      start: subjectTokens[0].start,
      end: subjectTokens[subjectTokens.length - 1].end,
    };
    const complementEntity: Entity = {
      type: "Entity",
      surface: complement.surface,
      render: complement.surface.toLowerCase(),
      kind: "common_noun",
      start: complement.start,
      end: complement.end,
    };
    return { type: "Copula", subject, complement: complementEntity, negated: true, start: tokens[0].start, end: tokens[tokens.length - 1].end };
  }
  return null;
}

/**
 * "let X verb(...)" / "let's verb(...)" / "lemme verb(...)" -> let(X.verb(...))
 * Delegates the inner clause to `parseClauseFn` (injected to avoid a circular import).
 */
export function letIdiom(
  tokens: SourceToken[],
  parseClauseFn: (t: SourceToken[]) => ASTNode,
  renderFn: (n: ASTNode) => string
): Idiom | null {
  const lw0 = lower(tokens[0]);
  let innerTokens: SourceToken[] | null = null;

  if (lw0 === "lemme" && tokens.length >= 2) {
    innerTokens = [{ surface: "me", start: tokens[0].start, end: tokens[0].end }, ...tokens.slice(1)];
  } else if (lw0 === "let's" && tokens.length >= 2) {
    innerTokens = [{ surface: "us", start: tokens[0].start, end: tokens[0].end }, ...tokens.slice(1)];
  } else if (lw0 === "let" && tokens.length >= 3) {
    innerTokens = tokens.slice(1);
  }

  if (!innerTokens) return null;
  const inner = parseClauseFn(innerTokens);
  return { type: "Idiom", id: "let", renderOverride: `let(${renderFn(inner)})`, start: tokens[0].start, end: tokens[tokens.length - 1].end };
}
