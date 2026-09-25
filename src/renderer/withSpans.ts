import type { ASTNode, Action, Entity, AdverbPhrase, PrepArg } from "../ast/types.js";
import { renderAdverbArg } from "../parser/remainder.js";

export interface Mapping {
  outStart: number;
  outEnd: number;
  srcStart: number;
  srcEnd: number;
}

class Builder {
  text = "";
  mappings: Mapping[] = [];

  emit(chunk: string, src?: { start: number; end: number }) {
    const outStart = this.text.length;
    this.text += chunk;
    if (src) this.mappings.push({ outStart, outEnd: this.text.length, srcStart: src.start, srcEnd: src.end });
  }
}

function entityChunk(b: Builder, e: Entity) {
  b.emit(e.render, { start: e.start, end: e.end });
}

function valueChunk(b: Builder, v: Entity | ASTNode) {
  if ((v as Entity).type === "Entity") entityChunk(b, v as Entity);
  else writeNode(b, v as ASTNode);
}

function writeAdverbArg(b: Builder, adverbs: AdverbPhrase[]) {
  const rendered = renderAdverbArg(adverbs);
  if (!rendered) return;
  if (adverbs.length === 1) {
    b.emit("adverb=");
    b.emit(adverbs[0].render, { start: adverbs[0].start, end: adverbs[0].end });
  } else {
    b.emit("adverb=[");
    adverbs.forEach((a, i) => {
      if (i > 0) b.emit(", ");
      b.emit(a.render, { start: a.start, end: a.end });
    });
    b.emit("]");
  }
}

function writeAction(b: Builder, a: Action) {
  if (a.negated) b.emit("!");
  if (!a.bareCall && a.subject) {
    entityChunk(b, a.subject);
    b.emit(".");
  }
  b.emit(a.verb.render, { start: a.start, end: a.start + (a.verb.surface?.length ?? 0) });
  b.emit("(");
  let first = true;
  for (const o of a.objects) {
    if (!first) b.emit(", ");
    valueChunk(b, o);
    first = false;
  }
  for (const p of a.preps) {
    if (!first) b.emit(", ");
    b.emit(`${p.prep}=`);
    valueChunk(b, p.value);
    first = false;
  }
  if (a.adverbs.length > 0) {
    if (!first) b.emit(", ");
    writeAdverbArg(b, a.adverbs);
  }
  b.emit(")");
  if (a.isQuestion) b.emit("?");
}

function writeNode(b: Builder, node: ASTNode) {
  switch (node.type) {
    case "Action":
      writeAction(b, node);
      return;
    case "Copula": {
      if (node.negated) b.emit("!(");
      entityChunk(b, node.subject);
      b.emit(" = ");
      valueChunk(b, node.complement as Entity | ASTNode);
      if (node.negated) b.emit(")");
      if (node.isQuestion) b.emit("?");
      return;
    }
    case "ModalExpression": {
      if (node.negated) b.emit("!");
      b.emit(node.render);
      b.emit("(");
      writeNode(b, node.content);
      b.emit(")");
      if (node.isQuestion) b.emit("?");
      return;
    }
    case "DiscourseMarker":
      b.emit(node.marker);
      b.emit("(");
      writeNode(b, node.content);
      b.emit(")");
      return;
    case "Conditional": {
      if (node.keyword === "if") {
        b.emit("if (");
        writeNode(b, node.condition);
        b.emit(") { ");
        writeNode(b, node.consequence);
        b.emit(" }");
      } else {
        b.emit(node.keyword);
        b.emit("(");
        writeNode(b, node.condition);
        b.emit(") { ");
        writeNode(b, node.consequence);
        b.emit(" }");
      }
      return;
    }
    case "BecauseClause":
      writeNode(b, node.main);
      b.emit(" because(");
      writeNode(b, node.cause);
      b.emit(")");
      return;
    case "Coordination":
      writeNode(b, node.left);
      b.emit(` ${node.conjunction} `);
      writeNode(b, node.right);
      return;
    case "Idiom":
      b.emit(node.renderOverride, { start: node.start, end: node.end });
      return;
    case "Fragment":
      entityChunk(b, node.entity);
      return;
    case "Ambiguous":
      b.emit(node.renderOverride, { start: node.start, end: node.end });
      return;
  }
}

/** Renders EAC code while tracking, for each output substring, the source span
 * of the English token(s) it came from — powers bidirectional highlighting. */
export function renderWithSpans(node: ASTNode): { text: string; mappings: Mapping[] } {
  const b = new Builder();
  writeNode(b, node);
  return { text: b.text, mappings: b.mappings };
}
