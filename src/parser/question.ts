import type { SourceToken, Entity, ASTNode, Action, ModalExpression, Copula } from "../ast/types.js";
import { WH_WORDS, ADVERBIAL_WH, DO_SUPPORT, BE_FORMS, MODALS, SUBJECT_PRONOUNS } from "../lexicon/closedClass.js";
import { buildAction, parseClause } from "./clause.js";
import { parseObjectNP } from "./np.js";

function lower(t: SourceToken): string {
  return t.surface.toLowerCase();
}

function whPlaceholder(t: SourceToken): Entity {
  return { type: "Entity", surface: t.surface, render: "?", kind: "wh_placeholder", start: t.start, end: t.end };
}

const WH_KIND_WORDS = new Set(["kind", "type", "sort"]);

/** "What kind of area do you like...?" -> merges the 4-token complex wh-phrase
 * into one synthetic "what"-shaped token, spanning the whole phrase, so the
 * rest of the wh-question logic (which only looks at tokens[0]) applies unchanged. */
function mergeComplexWhPhrase(tokens: SourceToken[]): SourceToken[] {
  if (
    tokens.length >= 4 &&
    (lower(tokens[0]) === "what" || lower(tokens[0]) === "which") &&
    WH_KIND_WORDS.has(lower(tokens[1])) &&
    lower(tokens[2]) === "of"
  ) {
    const merged: SourceToken = { surface: tokens[0].surface, start: tokens[0].start, end: tokens[3].end };
    return [merged, ...tokens.slice(4)];
  }
  return tokens;
}

function resolveSimpleSubject(tok: SourceToken): Entity {
  const lw = lower(tok);
  if (SUBJECT_PRONOUNS[lw]) {
    return { type: "Entity", surface: tok.surface, render: SUBJECT_PRONOUNS[lw], kind: "pronoun", start: tok.start, end: tok.end };
  }
  return { type: "Entity", surface: tok.surface, render: tok.surface, kind: /^[A-Z]/.test(tok.surface) ? "proper_noun" : "common_noun", start: tok.start, end: tok.end };
}

/**
 * Parses a wh-fronted or do-support question, or an embedded wh-clause (e.g. the
 * object of "idk what he wants"). `topLevelQuestion` controls whether a trailing
 * "?" suffix is added — wh-questions never need one since the "?" placeholder
 * already signals it; only bare do-support yes/no questions do.
 */
export function parseQuestionOrEmbedded(tokensRaw: SourceToken[], topLevelQuestion: boolean): ASTNode {
  if (tokensRaw.length === 0) {
    return { type: "Fragment", entity: { type: "Entity", surface: "", render: "?", kind: "unknown_placeholder", start: 0, end: 0 }, start: 0, end: 0 };
  }

  const tokens = mergeComplexWhPhrase(tokensRaw);
  const t0 = tokens[0];
  const lw0 = lower(t0);

  if (WH_WORDS.has(lw0)) {
    const afterWh = tokens.slice(1);
    const nextLw = afterWh[0] ? lower(afterWh[0]) : null;
    const nextIsAux = nextLw !== null && (DO_SUPPORT.has(nextLw) || BE_FORMS.has(nextLw) || MODALS.has(nextLw));

    if (lw0 === "who" && afterWh.length > 0 && !nextIsAux) {
      // who-as-subject: "Who broke this?" -> ?.broke(this)
      const action = buildAction(whPlaceholder(t0), afterWh);
      return action;
    }

    let rest = afterWh;
    if (rest.length > 0 && DO_SUPPORT.has(lower(rest[0]))) rest = rest.slice(1);
    const subjTok = rest[0];
    const subject = subjTok ? resolveSimpleSubject(subjTok) : whPlaceholder(t0);
    const verbAndRest = rest.slice(1);

    // "where he is" -> he = where=? (wh-adverbial over a bare copula, no complement left)
    if (ADVERBIAL_WH.has(lw0) && verbAndRest.length === 1 && BE_FORMS.has(lower(verbAndRest[0]))) {
      const complement = { type: "Entity" as const, surface: t0.surface, render: `${lw0}=?`, kind: "wh_placeholder" as const, start: t0.start, end: t0.end };
      return { type: "Copula", subject, complement, start: t0.start, end: verbAndRest[0].end };
    }

    const action = buildAction(subject, verbAndRest);
    if (ADVERBIAL_WH.has(lw0)) {
      action.preps.push({ type: "PrepArg", prep: lw0, value: whPlaceholder(t0), start: t0.start, end: t0.end });
    } else {
      action.objects.push(whPlaceholder(t0));
    }
    return action;
  }

  if (topLevelQuestion && (DO_SUPPORT.has(lw0) || BE_FORMS.has(lw0) || MODALS.has(lw0))) {
    const rest = tokens.slice(1);
    const subjTok = rest[0];
    const subject = resolveSimpleSubject(subjTok);
    const afterSubject = rest.slice(1);

    if (DO_SUPPORT.has(lw0)) {
      // "Do you like coffee?" -> you.like(coffee)?
      const action = buildAction(subject, afterSubject);
      action.isQuestion = true;
      return action;
    }

    if (BE_FORMS.has(lw0)) {
      // "Are you a human?" -> you = human?
      const complement = parseObjectNP(afterSubject);
      const copula: Copula = { type: "Copula", subject, complement, isQuestion: true, start: t0.start, end: tokens[tokens.length - 1].end };
      return copula;
    }

    // modal-fronted: "Can you swim?" -> can(you.swim())?
    const inner = buildAction(subject, afterSubject);
    const modal: ModalExpression = { type: "ModalExpression", modal: lw0, render: lw0, content: inner, isQuestion: true, start: t0.start, end: tokens[tokens.length - 1].end, keywordStart: t0.start, keywordEnd: t0.end };
    return modal;
  }

  const result = parseClause(tokens);
  if (topLevelQuestion && result.type === "Action") {
    (result as Action).isQuestion = true;
  }
  return result;
}
