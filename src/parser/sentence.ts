import type { SourceToken, ASTNode, ParseResult, Action, Conditional, BecauseClause, Coordination, DiscourseMarker } from "../ast/types.js";
import { tokenize, stripTrailingPunct } from "../tokenizer/tokenize.js";
import { mergeMultiwordPhrases } from "../lexicon/multiword.js";
import { FRONTING_CONJUNCTIONS, SUBJECT_PRONOUNS, CORPUS_VERBS, MODALS, BE_FORMS, DO_SUPPORT, BE_CONTRACTIONS } from "../lexicon/closedClass.js";
import { parseClause, buildAction } from "./clause.js";
import { parseQuestionOrEmbedded } from "./question.js";
import { renderSimple } from "../renderer/simple.js";
import { matchLeadingMarker, bareCallIdiom, hitMeUpIdiom, gimmeIdiom, kindaSortaIdiom, aintIdiom, letIdiom, commaVocativeIdiom } from "./idioms.js";

/** True if none of the tokens look like a verb/auxiliary — i.e. this is just a
 * bare noun phrase, not an independent (or subject-sharing) clause. */
function looksLikeBareNP(tokens: SourceToken[]): boolean {
  return tokens.every((t) => {
    const lw = lower(t);
    return !CORPUS_VERBS.has(lw) && !MODALS.has(lw) && !BE_FORMS.has(lw) && !DO_SUPPORT.has(lw) && !BE_CONTRACTIONS[lw];
  });
}

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

function isComma(t: SourceToken | undefined): boolean {
  return !!t && t.surface === ",";
}

function stripTrailingComma(tokens: SourceToken[]): SourceToken[] {
  if (tokens.length && isComma(tokens[tokens.length - 1])) return tokens.slice(0, -1);
  return tokens;
}

/** Splits on a top-level occurrence of a single-word conjunction, dropping a comma
 * immediately before it if present. Returns null if the conjunction isn't found. */
function splitOnConjunction(tokens: SourceToken[], word: string): { left: SourceToken[]; right: SourceToken[] } | null {
  const idx = tokens.findIndex((t) => lower(t) === word);
  if (idx <= 0 || idx >= tokens.length - 1) return null;
  const left = stripTrailingComma(tokens.slice(0, idx));
  const right = tokens.slice(idx + 1);
  return { left, right };
}

function parseCore(tokens: SourceToken[], topLevelQuestion: boolean): ASTNode {
  return parseQuestionOrEmbedded(tokens, topLevelQuestion);
}

/** Entry point: parses one sentence of raw English text into an EAC AST. */
export function parseSentence(input: string): ParseResult {
  const raw = tokenize(input);
  const { core: strippedCore, endedWithQuestion } = stripTrailingPunct(raw);
  const ast = parseTokenSequence(strippedCore, endedWithQuestion);
  return { input, ast, confidence: 0.9 };
}

/** "wanna" is sugar for "want to"; expanding it lets the general infinitive-
 * complement grammar (want + to + VERB) handle it with no separate rule. */
function expandWanna(tokens: SourceToken[]): SourceToken[] {
  const out: SourceToken[] = [];
  for (const t of tokens) {
    if (t.surface.toLowerCase() === "wanna") {
      out.push({ surface: "want", start: t.start, end: t.end }, { surface: "to", start: t.start, end: t.end });
    } else {
      out.push(t);
    }
  }
  return out;
}

function parseTokenSequence(tokensIn: SourceToken[], topLevelQuestion: boolean): ASTNode {
  // "please" is a pure politeness softener with no structural meaning to
  // preserve in EAC notation — drop it (and an optional following comma) and
  // parse the rest as if it weren't there.
  let tokens = tokensIn;
  if (tokens.length > 1 && lower(tokens[0]) === "please") {
    tokens = tokens.slice(isComma(tokens[1]) ? 2 : 1);
  } else if (tokens.length > 1 && lower(tokens[tokens.length - 1]) === "please") {
    tokens = tokens.slice(0, isComma(tokens[tokens.length - 2]) ? -2 : -1);
  }

  const merged = mergeMultiwordPhrases(expandWanna(tokens));

  const bare = bareCallIdiom(merged);
  if (bare) return bare;

  const hitMeUp = hitMeUpIdiom(merged);
  if (hitMeUp) return hitMeUp;

  if (merged.length > 0 && lower(merged[0]) === "idk") {
    const rest = merged.slice(1);
    const embedded = parseQuestionOrEmbedded(rest, false);
    const subject = { type: "Entity" as const, surface: merged[0].surface, render: "I", kind: "pronoun" as const, start: merged[0].start, end: merged[0].end };
    const action: Action = {
      type: "Action",
      subject,
      verb: { surface: "know", render: "know" },
      objects: [embedded as any],
      preps: [],
      adverbs: [],
      negated: true,
      start: merged[0].start,
      end: merged[merged.length - 1].end,
    };
    return action;
  }

  const ain = aintIdiom(merged);
  if (ain) return ain;

  const gimme = gimmeIdiom(merged);
  if (gimme) return gimme;

  const lw0 = merged.length > 0 ? lower(merged[0]) : "";
  if (lw0 === "let" || lw0 === "lemme" || lw0 === "let's") {
    const let_ = letIdiom(merged, (t) => parseClause(t), (n) => renderSimple(n));
    if (let_) return let_;
  }

  const kindaSorta = kindaSortaIdiom(merged);
  if (kindaSorta) return kindaSorta;

  const vocative = commaVocativeIdiom(merged);
  if (vocative) return vocative;

  const marker = matchLeadingMarker(merged);
  if (marker) {
    const inner = parseTokenSequence(marker.restTokens, false);
    const dm: DiscourseMarker = { type: "DiscourseMarker", marker: marker.marker, content: inner, start: merged[0].start, end: merged[merged.length - 1].end, keywordStart: marker.keywordStart, keywordEnd: marker.keywordEnd };
    return dm;
  }

  // generic vocative/address aside: "bro, we're cooked" -> bro(we.are(cooked))
  if (merged.length >= 3 && isComma(merged[1]) && /^[A-Za-z]+$/.test(merged[0].surface) && !FRONTING_CONJUNCTIONS.has(lw0)) {
    const inner = parseTokenSequence(merged.slice(2), false);
    const dm: DiscourseMarker = { type: "DiscourseMarker", marker: lw0, content: inner, start: merged[0].start, end: merged[merged.length - 1].end, keywordStart: merged[0].start, keywordEnd: merged[0].end };
    return dm;
  }

  // fronting conjunctions: If/When/Before/After COND, CONSEQ.
  if (merged.length > 0 && FRONTING_CONJUNCTIONS.has(lower(merged[0])) && lower(merged[0]) !== "and" && lower(merged[0]) !== "but" && lower(merged[0]) !== "because") {
    const keyword = lower(merged[0]) as "if" | "when" | "before" | "after";
    const commaIdx = merged.findIndex((t) => isComma(t));
    if (commaIdx > 0) {
      const condTokens = merged.slice(1, commaIdx);
      const conseqTokens = merged.slice(commaIdx + 1);
      const condition = parseTokenSequence(condTokens, false);
      const consequence = parseTokenSequence(conseqTokens, false);
      const cond: Conditional = { type: "Conditional", keyword, condition, consequence, start: merged[0].start, end: merged[merged.length - 1].end };
      return cond;
    }
  }

  const becauseSplit = splitOnConjunction(merged, "because");
  if (becauseSplit) {
    const main = parseTokenSequence(becauseSplit.left, false);
    const cause = parseTokenSequence(becauseSplit.right, false);
    const bc: BecauseClause = { type: "BecauseClause", main, cause, start: merged[0].start, end: merged[merged.length - 1].end };
    return bc;
  }

  const butSplit = splitOnConjunction(merged, "but");
  if (butSplit) {
    const left = parseTokenSequence(butSplit.left, false);
    const right = parseTokenSequence(butSplit.right, false);
    const co: Coordination = { type: "Coordination", conjunction: "but", left, right, start: merged[0].start, end: merged[merged.length - 1].end };
    return co;
  }

  const andSplit = splitOnConjunction(merged, "and");
  // Only treat top-level "and" as CLAUSE coordination ("I ate pizza and drank
  // beer.") when the right side plausibly contains its own verb phrase. A bare
  // NP on the right ("I like you and her mother.", "coffee and tea?") is just an
  // argument-list separator — leave it unsplit and let parseRemainder (which
  // understands "and" as a separator between objects) handle it in context,
  // however deeply the clause is nested (question, modal, copula, ...).
  if (andSplit && !looksLikeBareNP(andSplit.right)) {
    const rightFirstLw = andSplit.right.length > 0 ? lower(andSplit.right[0]) : "";
    const rightHasOwnSubject = !!SUBJECT_PRONOUNS[rightFirstLw] || /^[A-Z]/.test(andSplit.right[0]?.surface ?? "");
    const left = parseTokenSequence(andSplit.left, false);

    let right: ASTNode;
    if (rightHasOwnSubject) {
      right = parseTokenSequence(andSplit.right, false);
    } else if (left.type === "Action" && left.subject) {
      right = buildAction(left.subject, andSplit.right);
    } else {
      right = parseTokenSequence(andSplit.right, false);
    }
    const co: Coordination = { type: "Coordination", conjunction: "and", left, right, start: merged[0].start, end: merged[merged.length - 1].end };
    return co;
  }

  return parseCore(merged, topLevelQuestion);
}
