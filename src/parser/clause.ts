import type { SourceToken, Entity, ASTNode, Action, Copula, ModalExpression, Fragment } from "../ast/types.js";
import {
  SUBJECT_PRONOUNS,
  BE_FORMS,
  BE_CONTRACTIONS,
  BE_CONTRACTION_SUBJECT,
  MODALS,
  MODAL_NEGATIVE_CONTRACTIONS,
  INFORMAL_MODAL_WRAPPERS,
  DO_SUPPORT,
  INFINITIVE_TAKING_VERBS,
  GERUND_TAKING_VERBS,
  isGerund,
  gerundToBase,
  CORPUS_VERBS,
  KNOWN_ADVERBS,
  ADVERB_MODIFIERS,
  WILL_CONTRACTIONS,
  CLAUSE_COMPLEMENT_VERBS,
} from "../lexicon/closedClass.js";
import { parseSubjectNP, parseObjectNP } from "./np.js";
import { parseRemainder, renderAdverbArg } from "./remainder.js";
import { casingRenderSentenceInitial } from "./casing.js";

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

function span(tokens: SourceToken[]) {
  return { start: tokens[0]?.start ?? 0, end: tokens[tokens.length - 1]?.end ?? 0 };
}

function peelLeadingAdverbs(tokens: SourceToken[]): { adverbs: import("../ast/types.js").AdverbPhrase[]; rest: SourceToken[] } {
  const adverbs: import("../ast/types.js").AdverbPhrase[] = [];
  let rest = tokens;
  while (
    rest.length > 1 &&
    !BE_FORMS.has(lower(rest[0])) &&
    !MODALS.has(lower(rest[0])) &&
    (KNOWN_ADVERBS.has(lower(rest[0])) || (ADVERB_MODIFIERS.has(lower(rest[0])) && KNOWN_ADVERBS.has(lower(rest[1]))))
  ) {
    const t = rest[0];
    adverbs.push({ type: "Adverb", surface: t.surface, render: t.surface.toLowerCase(), start: t.start, end: t.end });
    rest = rest.slice(1);
  }
  return { adverbs, rest };
}

/** Builds an Action from an already-resolved subject and the verb-onward tokens. */
export function buildAction(subject: Entity | null, verbTokensRaw: SourceToken[], bareCall = false): Action {
  const { adverbs: preVerbAdverbs, rest: verbTokens } = peelLeadingAdverbs(verbTokensRaw);
  const verbTok = verbTokens[0];
  const rest = verbTokens.slice(1);
  const { start, end } = span(verbTokensRaw);
  let verbRender = verbTok.surface.toLowerCase();
  let negated = false;

  if (verbRender === "dunno") {
    verbRender = "know";
    negated = true;
  }

  // bare-clause complement: reckon + full embedded clause (no "to")
  if (CLAUSE_COMPLEMENT_VERBS.has(verbRender) && rest.length > 0) {
    const inner = parseClause(rest);
    return {
      type: "Action",
      subject,
      verb: { surface: verbTok.surface, render: verbTok.surface.toLowerCase() },
      objects: [inner],
      preps: [],
      adverbs: [],
      negated,
      bareCall,
      start,
      end,
    };
  }

  // infinitive complement: want/decide/hope + "to" + VERB2 + rest
  if (INFINITIVE_TAKING_VERBS.has(verbRender) && rest.length >= 1 && lower(rest[0]) === "to" && rest.length >= 2) {
    const inner = buildAction(subject, rest.slice(1));
    return {
      type: "Action",
      subject,
      verb: { surface: verbTok.surface, render: verbTok.surface.toLowerCase() },
      objects: [inner],
      preps: [],
      adverbs: [],
      negated,
      bareCall,
      start,
      end,
    };
  }

  // gerund complement: enjoy/like/stop/finish + VERBing + rest
  if (GERUND_TAKING_VERBS.has(verbRender) && rest.length >= 1 && isGerund(rest[0].surface)) {
    const innerVerbToken: SourceToken = { surface: gerundToBase(rest[0].surface), start: rest[0].start, end: rest[0].end };
    const inner = buildAction(subject, [innerVerbToken, ...rest.slice(1)]);
    return {
      type: "Action",
      subject,
      verb: { surface: verbTok.surface, render: verbTok.surface.toLowerCase() },
      objects: [inner],
      preps: [],
      adverbs: [],
      negated,
      bareCall,
      start,
      end,
    };
  }

  const { objects, preps, adverbs } = parseRemainder(rest);
  return {
    type: "Action",
    subject,
    verb: { surface: verbTok.surface, render: verbRender },
    objects,
    preps,
    adverbs: [...preVerbAdverbs, ...adverbs],
    negated,
    bareCall,
    start,
    end,
  };
}

function buildCopula(subject: Entity, remainder: SourceToken[], negated = false): ASTNode {
  const start = subject.start;
  const end = remainder[remainder.length - 1]?.end ?? subject.end;

  // idiom: "it/that is giving X" -> subj = giving(X)
  if (remainder.length >= 2 && lower(remainder[0]) === "giving") {
    const objEntity = parseObjectNP(remainder.slice(1));
    const complementAction: Action = {
      type: "Action",
      subject: null,
      verb: { surface: "giving", render: "giving" },
      objects: [objEntity],
      preps: [],
      adverbs: [],
      bareCall: true,
      start: remainder[0].start,
      end,
    };
    const copula: Copula = { type: "Copula", subject, complement: complementAction, negated, start, end };
    return copula;
  }

  // "it is nice to meet you" -> it = nice(meet(you)) — an infinitival tail after
  // the adjective/noun complement is kept as a nested bare call rather than being
  // swallowed into the adjective list as unrelated words.
  const toIdx = remainder.findIndex((t) => lower(t) === "to");
  if (toIdx > 0 && toIdx < remainder.length - 1) {
    const preTokens = remainder.slice(0, toIdx);
    const infTokens = remainder.slice(toIdx + 1);
    const complementEntity = parseObjectNP(preTokens);
    const innerAction = buildAction(null, infTokens, true);
    const wrapped: Action = {
      type: "Action",
      subject: null,
      verb: { surface: complementEntity.render, render: complementEntity.render },
      objects: [innerAction],
      preps: [],
      adverbs: [],
      bareCall: true,
      start: complementEntity.start,
      end,
    };
    const copula: Copula = { type: "Copula", subject, complement: wrapped, negated, start, end };
    return copula;
  }

  const complement = parseObjectNP(remainder);
  const copula: Copula = { type: "Copula", subject, complement, negated, start, end };
  return copula;
}

/**
 * Core declarative-clause parser: subject detection, be-copula, modal wrapping,
 * negation, and the main SVO/intransitive path. Assumes conjunctions, discourse
 * markers, idiom phrases, and questions have already been peeled off by the caller.
 */
export function parseClause(tokens: SourceToken[]): ASTNode {
  if (tokens.length === 0) {
    return { type: "Fragment", entity: { type: "Entity", surface: "", render: "?", kind: "unknown_placeholder", start: 0, end: 0 }, start: 0, end: 0 };
  }

  // "it'll rain" -> will(it.rain()) — 'll contraction implies subject + modal "will"
  if (WILL_CONTRACTIONS[lower(tokens[0])] && tokens.length > 1) {
    const subject: Entity = { type: "Entity", surface: tokens[0].surface, render: WILL_CONTRACTIONS[lower(tokens[0])], kind: "pronoun", start: tokens[0].start, end: tokens[0].end };
    const inner = buildAction(subject, tokens.slice(1));
    const modal: ModalExpression = { type: "ModalExpression", modal: "will", render: "will", content: inner, start: tokens[0].start, end: tokens[tokens.length - 1].end, keywordStart: tokens[0].start, keywordEnd: tokens[0].end };
    return modal;
  }

  // Narrow bare-NP-fragment heuristic: ADJ + single acronym/proper-noun-like head,
  // nothing else in the clause (e.g. "Big W").
  if (tokens.length === 2 && /^[A-Z]/.test(tokens[1].surface) && !SUBJECT_PRONOUNS[lower(tokens[0])] && !BE_FORMS.has(lower(tokens[0]))) {
    const headWord = tokens[1].surface;
    const adjWord = casingRenderSentenceInitial(tokens[0].surface);
    const entity: Entity = {
      type: "Entity",
      surface: tokens.map((t) => t.surface).join(" "),
      render: `${headWord}(adjective=${adjWord})`,
      kind: "proper_noun",
      start: tokens[0].start,
      end: tokens[1].end,
    };
    const fragment: Fragment = { type: "Fragment", entity, start: tokens[0].start, end: tokens[1].end };
    return fragment;
  }

  const t0 = tokens[0];
  const lw0 = lower(t0);

  let subject: Entity;
  let consumed: number;
  let impliedBe: string | null = null;

  if (BE_CONTRACTIONS[lw0]) {
    subject = { type: "Entity", surface: t0.surface, render: BE_CONTRACTION_SUBJECT[lw0], kind: "pronoun", start: t0.start, end: t0.end };
    consumed = 1;
    impliedBe = BE_CONTRACTIONS[lw0];
  } else if (SUBJECT_PRONOUNS[lw0] && !(lw0 === "that" || lw0 === "this")) {
    subject = { type: "Entity", surface: t0.surface, render: SUBJECT_PRONOUNS[lw0], kind: "pronoun", start: t0.start, end: t0.end };
    consumed = 1;
  } else if (lw0 === "that" || lw0 === "this") {
    const next = tokens[1];
    const nextLw = next ? lower(next) : null;
    const nextLooksLikeVerb = nextLw !== null && (BE_FORMS.has(nextLw) || nextLw in MODAL_NEGATIVE_CONTRACTIONS || MODALS.has(nextLw) || CORPUS_VERBS.has(nextLw));
    if (nextLw === null || nextLooksLikeVerb) {
      subject = { type: "Entity", surface: t0.surface, render: lw0, kind: "pronoun", start: t0.start, end: t0.end };
      consumed = 1;
    } else {
      const parsed = parseSubjectNP(tokens);
      subject = parsed.entity;
      consumed = parsed.consumed;
    }
  } else {
    const parsed = parseSubjectNP(tokens);
    subject = parsed.entity;
    consumed = parsed.consumed;
  }

  let rest = tokens.slice(consumed);
  if (rest.length === 0) {
    // subject-only fragment; shouldn't normally happen in this grammar
    const fragment: Fragment = { type: "Fragment", entity: subject, start: subject.start, end: subject.end };
    return fragment;
  }

  // pre-verb (mid-position) adverbs, e.g. "I totally glorped it."
  const leadingAdverbs: { type: "Adverb"; surface: string; render: string; start: number; end: number }[] = [];
  while (rest.length > 1 && !BE_FORMS.has(lower(rest[0])) && !MODALS.has(lower(rest[0])) && (KNOWN_ADVERBS.has(lower(rest[0])) || (ADVERB_MODIFIERS.has(lower(rest[0])) && KNOWN_ADVERBS.has(lower(rest[1]))))) {
    const t = rest[0];
    leadingAdverbs.push({ type: "Adverb", surface: t.surface, render: t.surface.toLowerCase(), start: t.start, end: t.end });
    rest = rest.slice(1);
  }

  const r0 = rest[0];
  const rLw0 = lower(r0);

  // be-copula path (bare be-form or implied by contraction already consumed)
  if (impliedBe || BE_FORMS.has(rLw0)) {
    const beConsumed = impliedBe ? 0 : 1;
    const afterBe = rest.slice(beConsumed);
    if (afterBe.length >= 1 && lower(afterBe[0]) === "gonna" && afterBe.length >= 2) {
      const inner = buildAction(subject, afterBe.slice(1));
      const modal: ModalExpression = { type: "ModalExpression", modal: "going_to", render: "going_to", content: inner, start: subject.start, end: afterBe[afterBe.length - 1].end, keywordStart: afterBe[0].start, keywordEnd: afterBe[0].end };
      return modal;
    }
    return buildCopula(subject, afterBe);
  }

  // negated modal contraction: can't, cannot, won't, ...
  if (rLw0 in MODAL_NEGATIVE_CONTRACTIONS) {
    const modalName = MODAL_NEGATIVE_CONTRACTIONS[rLw0];
    const inner = buildAction(subject, rest.slice(1));
    const modal: ModalExpression = { type: "ModalExpression", modal: modalName, render: modalName, content: inner, negated: true, start: subject.start, end: rest[rest.length - 1].end, keywordStart: rest[0].start, keywordEnd: rest[0].end };
    return modal;
  }

  // plain modal: can, could, may, might, must, should, will, would
  if (MODALS.has(rLw0)) {
    const inner = buildAction(subject, rest.slice(1));
    const modal: ModalExpression = { type: "ModalExpression", modal: rLw0, render: rLw0, content: inner, start: subject.start, end: rest[rest.length - 1].end, keywordStart: rest[0].start, keywordEnd: rest[0].end };
    return modal;
  }

  // informal modal wrapper: gotta -> have_to(...)
  if (INFORMAL_MODAL_WRAPPERS[rLw0] && rLw0 !== "gonna") {
    const wrapperName = INFORMAL_MODAL_WRAPPERS[rLw0];
    const inner = buildAction(subject, rest.slice(1));
    const modal: ModalExpression = { type: "ModalExpression", modal: wrapperName, render: wrapperName, content: inner, start: subject.start, end: rest[rest.length - 1].end, keywordStart: rest[0].start, keywordEnd: rest[0].end };
    return modal;
  }

  // do-support negation: don't / doesn't / do not
  if (rLw0 === "don't" || rLw0 === "doesn't" || (rLw0 === "do" && lower(rest[1] ?? ({} as SourceToken)) === "not")) {
    const skip = rLw0 === "do" ? 2 : 1;
    const action = buildAction(subject, rest.slice(skip));
    action.negated = true;
    action.adverbs = [...leadingAdverbs, ...action.adverbs];
    return action;
  }

  // regular declarative verb path
  const action = buildAction(subject, rest);
  action.adverbs = [...leadingAdverbs, ...action.adverbs];
  return action;
}

export function renderEntity(e: Entity): string {
  return e.render;
}

export function renderPrepArg(prep: string, value: Entity): string {
  return `${prep}=${renderEntity(value)}`;
}

export { renderAdverbArg };
