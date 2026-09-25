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
  isPastParticiple,
  participleToActivePast,
  CORPUS_VERB_BASES,
  BE_NEGATIVE_CONTRACTIONS,
  HAVE_NEGATIVE_CONTRACTIONS,
  DO_NEGATIVE_CONTRACTIONS,
} from "../lexicon/closedClass.js";
import { parseSubjectNP, parseObjectNP } from "./np.js";
import { parseRemainder, renderAdverbArg } from "./remainder.js";
import { casingRenderSentenceInitial } from "./casing.js";
import { renderSimple } from "../renderer/simple.js";

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

/** Progressive aspect: "am studying English" -> I.studying(English). The
 * -ing form is kept as the surface verb (not converted to base), consistent
 * with Surface Preservation — this is an Action, not a Copula. */
export function buildProgressiveAction(subject: Entity | null, tokens: SourceToken[]): Action {
  const verbTok = tokens[0];
  const { objects, preps, adverbs } = parseRemainder(tokens.slice(1));
  return {
    type: "Action",
    subject,
    verb: { surface: verbTok.surface, render: verbTok.surface.toLowerCase() },
    objects,
    preps,
    adverbs,
    start: subject?.start ?? verbTok.start,
    end: tokens[tokens.length - 1].end,
  };
}

/**
 * Wraps `buildAction` with perfect / perfect-progressive aspect detection:
 * "have/has + participle" -> have(subject.participle(...))
 * "have/has + been + VERBing" -> have(been(subject.VERBing(...)))
 * "had + [participle]" (narrow: exactly one trailing word) -> had_participle()
 *   — a fused verb, matching the one tested conditional-clause case.
 * Falls back to plain buildAction otherwise. Returns ASTNode (not Action)
 * because the perfect-aspect result is a ModalExpression wrapper.
 */
export function buildActionOrAspect(subject: Entity | null, tokens: SourceToken[]): ASTNode {
  if (tokens.length >= 1) {
    const t0 = tokens[0];
    const t0lw = lower(t0);

    // narrow past-perfect fusion (conditional clauses): "had known" -> had_known()
    if (t0lw === "had" && tokens.length === 2 && isPastParticiple(tokens[1].surface)) {
      const fused = `had_${tokens[1].surface.toLowerCase()}`;
      const action: Action = {
        type: "Action",
        subject,
        verb: { surface: fused, render: fused },
        objects: [],
        preps: [],
        adverbs: [],
        start: tokens[0].start,
        end: tokens[1].end,
      };
      return action;
    }

    // normalize contracted/uncontracted "have not"/"haven't" etc. to (auxWord, negated, consumed)
    let auxWord: "have" | "has" | "had" | null = null;
    let negated = false;
    let consumed = 0;
    if (t0lw === "have" || t0lw === "has" || t0lw === "had") {
      auxWord = t0lw;
      consumed = 1;
      if (lower(tokens[1] ?? ({} as SourceToken)) === "not") {
        negated = true;
        consumed = 2;
      }
    } else if (t0lw in HAVE_NEGATIVE_CONTRACTIONS) {
      auxWord = HAVE_NEGATIVE_CONTRACTIONS[t0lw] as "have" | "has" | "had";
      negated = true;
      consumed = 1;
    }

    if (auxWord && tokens.length > consumed && isPastParticiple(tokens[consumed].surface)) {
      const rest = tokens.slice(consumed);
      const keywordStart = t0.start;
      const keywordEnd = t0.end;
      let content: ASTNode;
      if (lower(rest[0]) === "been" && rest.length >= 2 && isGerund(rest[1].surface)) {
        const progressive = buildProgressiveAction(subject, rest.slice(1));
        const been: ModalExpression = {
          type: "ModalExpression",
          modal: "been",
          render: "been",
          content: progressive,
          start: rest[0].start,
          end: tokens[tokens.length - 1].end,
          keywordStart: rest[0].start,
          keywordEnd: rest[0].end,
        };
        content = been;
      } else {
        content = buildAction(subject, rest);
      }
      const have: ModalExpression = {
        type: "ModalExpression",
        modal: auxWord,
        render: auxWord,
        content,
        negated,
        start: tokens[0].start,
        end: tokens[tokens.length - 1].end,
        keywordStart,
        keywordEnd,
      };
      return have;
    }
  }
  return buildAction(subject, tokens);
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

  // comparative: "Ken is taller than Tom." -> Ken = taller(than=Tom)
  const thanIdx = remainder.findIndex((t) => lower(t) === "than");
  if (thanIdx > 0 && thanIdx < remainder.length - 1) {
    const adjTokens = remainder.slice(0, thanIdx);
    const compareTokens = remainder.slice(thanIdx + 1);
    const adjRender = adjTokens.map((t) => t.surface.toLowerCase()).join(" ");
    const compareValue = parseObjectNP(compareTokens);
    const wrapped: Action = {
      type: "Action",
      subject: null,
      verb: { surface: adjRender, render: adjRender },
      objects: [],
      preps: [{ type: "PrepArg", prep: "than", value: compareValue, start: remainder[thanIdx].start, end }],
      adverbs: [],
      bareCall: true,
      start: adjTokens[0].start,
      end,
    };
    const copula: Copula = { type: "Copula", subject, complement: wrapped, negated, start, end };
    return copula;
  }

  const complement = parseObjectNP(remainder);
  const copula: Copula = { type: "Copula", subject, complement, negated, start, end };
  return copula;
}

export const RELATIVE_PRONOUNS = new Set(["who", "that", "which"]);

/** Renders the "who VERB..." / "that|which SUBJ VERB" relative-clause fragment
 * that attaches to a head noun, e.g. "who.lives(in=Tokyo)" or "that=Ken.bought(?)".
 * Returns null if the clause shape doesn't match (too short, etc). */
function renderRelativeClause(relWord: string, relToken: SourceToken, relClauseTokens: SourceToken[]): string | null {
  if (relClauseTokens.length === 0) return null;
  if (relWord === "who") {
    const whoSubject: Entity = { type: "Entity", surface: "who", render: "who", kind: "pronoun", start: relToken.start, end: relToken.end };
    const relAction = buildAction(whoSubject, relClauseTokens);
    return renderSimple(relAction);
  }
  // object-relative ("that"/"which"): [SUBJ] [VERB], relativized element is the object.
  if (relClauseTokens.length < 2) return null;
  const subjTok = relClauseTokens[0];
  const subjEntity: Entity = SUBJECT_PRONOUNS[lower(subjTok)]
    ? { type: "Entity", surface: subjTok.surface, render: SUBJECT_PRONOUNS[lower(subjTok)], kind: "pronoun", start: subjTok.start, end: subjTok.end }
    : { type: "Entity", surface: subjTok.surface, render: subjTok.surface, kind: /^[A-Z]/.test(subjTok.surface) ? "proper_noun" : "common_noun", start: subjTok.start, end: subjTok.end };
  const verbTok = relClauseTokens[1];
  return `${relWord}=${subjEntity.render}.${verbTok.surface.toLowerCase()}(?)`;
}

/**
 * Narrow relative-clause-on-subject support, e.g.:
 * "The man who lives in Tokyo is my brother." -> man(who.lives(in=Tokyo)) = my.brother
 * "The book that I bought was expensive." -> book(that=I.bought(?)) = expensive
 * Detects [head NP] [who|that|which] [relative clause tokens] [outer be/modal ...],
 * builds a synthetic subject Entity whose render already embeds the relative
 * clause, and returns the remaining tokens for the outer clause to continue with.
 */
function tryRelativeClauseSubject(tokens: SourceToken[]): { subject: Entity; mainRest: SourceToken[] } | null {
  const relIdx = tokens.findIndex((t, i) => i > 0 && RELATIVE_PRONOUNS.has(lower(t)));
  if (relIdx <= 0) return null;

  let outerVerbIdx = -1;
  for (let i = relIdx + 1; i < tokens.length; i++) {
    if (BE_FORMS.has(lower(tokens[i])) || MODALS.has(lower(tokens[i]))) {
      outerVerbIdx = i;
      break;
    }
  }
  if (outerVerbIdx === -1) return null;

  const headTokens = tokens.slice(0, relIdx);
  const relWord = lower(tokens[relIdx]);
  const relClauseTokens = tokens.slice(relIdx + 1, outerVerbIdx);
  const mainRest = tokens.slice(outerVerbIdx);
  const relRender = renderRelativeClause(relWord, tokens[relIdx], relClauseTokens);
  if (relRender === null) return null;

  const headEntity = parseObjectNP(headTokens);
  const subject: Entity = {
    type: "Entity",
    surface: tokens.slice(0, outerVerbIdx).map((t) => t.surface).join(" "),
    render: `${headEntity.render}(${relRender})`,
    kind: "common_noun",
    start: headTokens[0].start,
    end: tokens[outerVerbIdx - 1].end,
  };
  return { subject, mainRest };
}

/**
 * Relative-clause-on-object support: given an already-bounded NP token span
 * (e.g. "the man who lives in Tokyo"), attaches a trailing relative clause to
 * the head noun if present, otherwise falls back to a plain NP parse.
 */
export function parseNPWithOptionalRelativeClause(tokens: SourceToken[]): Entity {
  const relIdx = tokens.findIndex((t, i) => i > 0 && RELATIVE_PRONOUNS.has(lower(t)));
  if (relIdx <= 0) return parseObjectNP(tokens);

  const headTokens = tokens.slice(0, relIdx);
  const relWord = lower(tokens[relIdx]);
  const relClauseTokens = tokens.slice(relIdx + 1);
  const relRender = renderRelativeClause(relWord, tokens[relIdx], relClauseTokens);
  if (relRender === null) return parseObjectNP(tokens);

  const headEntity = parseObjectNP(headTokens);
  return {
    type: "Entity",
    surface: tokens.map((t) => t.surface).join(" "),
    render: `${headEntity.render}(${relRender})`,
    kind: "common_noun",
    start: tokens[0].start,
    end: tokens[tokens.length - 1].end,
  };
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

  const relClause = tryRelativeClauseSubject(tokens);
  if (relClause) {
    const { subject, mainRest } = relClause;
    const mLw0 = lower(mainRest[0]);
    if (BE_FORMS.has(mLw0)) {
      return buildCopula(subject, mainRest.slice(1));
    }
    return buildActionOrAspect(subject, mainRest);
  }

  // "it'll rain" -> will(it.rain()) — 'll contraction implies subject + modal "will"
  if (WILL_CONTRACTIONS[lower(tokens[0])] && tokens.length > 1) {
    const subject: Entity = { type: "Entity", surface: tokens[0].surface, render: WILL_CONTRACTIONS[lower(tokens[0])], kind: "pronoun", start: tokens[0].start, end: tokens[0].end };
    const inner = buildAction(subject, tokens.slice(1));
    const modal: ModalExpression = { type: "ModalExpression", modal: "will", render: "will", content: inner, start: tokens[0].start, end: tokens[tokens.length - 1].end, keywordStart: tokens[0].start, keywordEnd: tokens[0].end };
    return modal;
  }

  // existential "there is/are ..." -> there(NP, prep=val, ...)
  if (lower(tokens[0]) === "there" && tokens.length > 2 && BE_FORMS.has(lower(tokens[1]))) {
    const { objects, preps, adverbs } = parseRemainder(tokens.slice(2));
    const action: Action = {
      type: "Action",
      subject: null,
      verb: { surface: "there", render: "there" },
      objects,
      preps,
      adverbs,
      bareCall: true,
      start: tokens[0].start,
      end: tokens[tokens.length - 1].end,
    };
    return action;
  }

  // negated imperative / negated declarative with no prior subject consumed yet:
  // "Don't touch grass." (no subject -> bare imperative) vs "Don't you like
  // coffee?" (explicit subject -> negated declarative), both starting at token 0.
  if (lower(tokens[0]) === "don't" || (lower(tokens[0]) === "do" && lower(tokens[1] ?? ({} as SourceToken)) === "not")) {
    const skip = lower(tokens[0]) === "do" ? 2 : 1;
    const afterNeg = tokens.slice(skip);
    if (afterNeg.length > 0) {
      const nextLw = lower(afterNeg[0]);
      const looksLikeSubject = !!SUBJECT_PRONOUNS[nextLw] || /^[A-Z]/.test(afterNeg[0].surface);
      if (looksLikeSubject && afterNeg.length > 1) {
        const subjTok = afterNeg[0];
        const subject: Entity = SUBJECT_PRONOUNS[nextLw]
          ? { type: "Entity", surface: subjTok.surface, render: SUBJECT_PRONOUNS[nextLw], kind: "pronoun", start: subjTok.start, end: subjTok.end }
          : { type: "Entity", surface: subjTok.surface, render: subjTok.surface, kind: "proper_noun", start: subjTok.start, end: subjTok.end };
        const action = buildAction(subject, afterNeg.slice(1));
        action.negated = true;
        return action;
      }
      const action = buildAction(null, afterNeg, true);
      action.negated = true;
      return action;
    }
  }

  // general imperative: sentence starts directly with a recognized base-form
  // verb and no subject at all (e.g. "Call me.", "Open the door.").
  if (CORPUS_VERB_BASES.has(lower(tokens[0]))) {
    return buildAction(null, tokens, true);
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
    let afterBe = rest.slice(beConsumed);
    let beNegated = false;
    if (afterBe.length > 0 && lower(afterBe[0]) === "not") {
      beNegated = true;
      afterBe = afterBe.slice(1);
    }
    if (beNegated) {
      if (afterBe.length >= 2 && isGerund(afterBe[0].surface) && lower(afterBe[0]) !== "giving") {
        const action = buildProgressiveAction(subject, afterBe);
        action.negated = true;
        return action;
      }
      return buildCopula(subject, afterBe, true);
    }
    if (afterBe.length >= 1 && lower(afterBe[0]) === "gonna" && afterBe.length >= 2) {
      const inner = buildAction(subject, afterBe.slice(1));
      const modal: ModalExpression = { type: "ModalExpression", modal: "going_to", render: "going_to", content: inner, start: subject.start, end: afterBe[afterBe.length - 1].end, keywordStart: afterBe[0].start, keywordEnd: afterBe[0].end };
      return modal;
    }

    // passive: "The window was broken by Ken." -> Ken.broke(window)
    const byIdx = afterBe.findIndex((t) => lower(t) === "by");
    if (byIdx > 0 && isPastParticiple(afterBe[0].surface) && byIdx < afterBe.length - 1) {
      const agentTokens = afterBe.slice(byIdx + 1);
      const agent = parseObjectNP(agentTokens);
      const activeVerb = participleToActivePast(afterBe[0].surface);
      const passiveAction: Action = {
        type: "Action",
        subject: agent,
        verb: { surface: afterBe[0].surface, render: activeVerb },
        objects: [subject],
        preps: [],
        adverbs: [],
        start: subject.start,
        end: afterBe[afterBe.length - 1].end,
      };
      return passiveAction;
    }

    // progressive: "am studying English" -> I.studying(English) — "giving" is
    // a fixed slang idiom (it = giving(summer)), handled separately above.
    // Requires something after the -ing word: a bare "-ing" complement alone
    // ("this is amazing") is an adjective, not a verb being used progressively.
    if (afterBe.length >= 2 && isGerund(afterBe[0].surface) && lower(afterBe[0]) !== "giving") {
      return buildProgressiveAction(subject, afterBe);
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
  // (also handles the uncontracted "MODAL not VERB", e.g. "He can not swim.")
  if (MODALS.has(rLw0)) {
    const modalNegated = lower(rest[1] ?? ({} as SourceToken)) === "not";
    const contentTokens = modalNegated ? rest.slice(2) : rest.slice(1);
    const inner = buildActionOrAspect(subject, contentTokens);
    const modal: ModalExpression = { type: "ModalExpression", modal: rLw0, render: rLw0, content: inner, negated: modalNegated, start: subject.start, end: rest[rest.length - 1].end, keywordStart: rest[0].start, keywordEnd: rest[0].end };
    return modal;
  }

  // informal modal wrapper: gotta -> have_to(...)
  if (INFORMAL_MODAL_WRAPPERS[rLw0] && rLw0 !== "gonna") {
    const wrapperName = INFORMAL_MODAL_WRAPPERS[rLw0];
    const inner = buildAction(subject, rest.slice(1));
    const modal: ModalExpression = { type: "ModalExpression", modal: wrapperName, render: wrapperName, content: inner, start: subject.start, end: rest[rest.length - 1].end, keywordStart: rest[0].start, keywordEnd: rest[0].end };
    return modal;
  }

  // do-support negation: don't/doesn't/didn't, or uncontracted do/does/did + not
  if (rLw0 in DO_NEGATIVE_CONTRACTIONS || (DO_SUPPORT.has(rLw0) && lower(rest[1] ?? ({} as SourceToken)) === "not")) {
    const skip = DO_SUPPORT.has(rLw0) ? 2 : 1;
    const action = buildAction(subject, rest.slice(skip));
    action.negated = true;
    action.adverbs = [...leadingAdverbs, ...action.adverbs];
    return action;
  }

  // regular declarative verb path
  const built = buildActionOrAspect(subject, rest);
  if (built.type === "Action") {
    built.adverbs = [...leadingAdverbs, ...built.adverbs];
  }
  return built;
}

export function renderEntity(e: Entity): string {
  return e.render;
}

export function renderPrepArg(prep: string, value: Entity): string {
  return `${prep}=${renderEntity(value)}`;
}

export { renderAdverbArg };
