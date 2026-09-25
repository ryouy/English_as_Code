import type { ASTNode, Action, Entity, AdverbPhrase } from "../ast/types.js";
import { renderAdverbArg } from "../parser/remainder.js";

export interface Mapping {
  outStart: number;
  outEnd: number;
  srcStart: number;
  srcEnd: number;
}

const INDENT = "    ";

class Builder {
  text = "";
  mappings: Mapping[] = [];

  emit(chunk: string, src?: { start: number; end: number }) {
    const outStart = this.text.length;
    this.text += chunk;
    if (src) this.mappings.push({ outStart, outEnd: this.text.length, srcStart: src.start, srcEnd: src.end });
  }
}

type Slot = { isComplex: boolean; write: (b: Builder, depth: number) => void };

function isCallNode(n: ASTNode): n is Action {
  return n.type === "Action";
}

function isWrapperNode(n: ASTNode): boolean {
  return n.type === "ModalExpression" || n.type === "DiscourseMarker";
}

function entityChunk(b: Builder, e: Entity) {
  b.emit(e.render, { start: e.start, end: e.end });
}

function isComplexValue(v: Entity | ASTNode): boolean {
  if ((v as Entity).type === "Entity") return false; // adjective=/possession NPs always stay inline
  const node = v as ASTNode;
  if (isCallNode(node)) return wouldBreak(node);
  if (isWrapperNode(node)) return wouldBreak(node as any);
  return false; // Copula/Idiom/Fragment/etc. never force a break
}

function buildSlots(a: Action): Slot[] {
  const slots: Slot[] = [];
  for (const o of a.objects) {
    slots.push({ isComplex: isComplexValue(o), write: (b, d) => writeValue(b, o, d) });
  }
  for (const p of a.preps) {
    slots.push({
      isComplex: isComplexValue(p.value),
      write: (b, d) => {
        b.emit(`${p.prep}=`);
        writeValue(b, p.value, d);
      },
    });
  }
  if (a.adverbs.length > 0) {
    slots.push({ isComplex: false, write: (b) => writeAdverbArg(b, a.adverbs) });
  }
  return slots;
}

function wouldBreak(node: Action | { type: "ModalExpression" | "DiscourseMarker"; content: ASTNode }): boolean {
  if ((node as Action).type === "Action") {
    const slots = buildSlots(node as Action);
    return slots.length > 1 || (slots.length === 1 && slots[0].isComplex);
  }
  const content = (node as any).content as ASTNode;
  if (isCallNode(content)) return wouldBreak(content);
  if (isWrapperNode(content)) return wouldBreak(content as any);
  return false;
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

function writeValue(b: Builder, v: Entity | ASTNode, depth: number, flatOnly = false) {
  if ((v as Entity).type === "Entity") entityChunk(b, v as Entity);
  else writeNode(b, v as ASTNode, depth, flatOnly);
}

function writeAction(b: Builder, a: Action, depth: number, flatOnly: boolean) {
  if (a.negated) b.emit("!");
  if (!a.bareCall && a.subject) {
    entityChunk(b, a.subject);
    b.emit(".");
  }
  b.emit(a.verb.render, { start: a.start, end: a.start + (a.verb.surface?.length ?? 0) });
  b.emit("(");

  const slots = buildSlots(a);
  const breakIt = !flatOnly && (slots.length > 1 || (slots.length === 1 && slots[0].isComplex));

  if (slots.length === 0) {
    // nothing between the parens
  } else if (!breakIt) {
    slots.forEach((s, i) => {
      if (i > 0) b.emit(", ");
      s.write(b, depth);
    });
  } else {
    slots.forEach((s, i) => {
      b.emit("\n" + INDENT.repeat(depth + 1));
      s.write(b, depth + 1);
      if (i < slots.length - 1) b.emit(",");
    });
    b.emit("\n" + INDENT.repeat(depth));
  }

  b.emit(")");
  if (a.isQuestion) b.emit("?");
}

function writeWrapper(
  b: Builder,
  name: string,
  negated: boolean | undefined,
  content: ASTNode,
  depth: number,
  flatOnly: boolean,
  isQuestion?: boolean,
  keywordSpan?: { start: number; end: number }
) {
  if (negated) b.emit("!");
  b.emit(name, keywordSpan);
  b.emit("(");
  const breakIt = !flatOnly && (isCallNode(content) || isWrapperNode(content)) && wouldBreak(content as any);
  if (breakIt) {
    b.emit("\n" + INDENT.repeat(depth + 1));
    writeNode(b, content, depth + 1, flatOnly);
    b.emit("\n" + INDENT.repeat(depth));
  } else {
    writeNode(b, content, depth, true);
  }
  b.emit(")");
  if (isQuestion) b.emit("?");
}

function writeNode(b: Builder, node: ASTNode, depth: number, flatOnly: boolean) {
  switch (node.type) {
    case "Action":
      writeAction(b, node, depth, flatOnly);
      return;
    case "Copula": {
      if (node.negated) b.emit("!(");
      entityChunk(b, node.subject);
      b.emit(" = ");
      writeValue(b, node.complement as Entity | ASTNode, depth, true);
      if (node.negated) b.emit(")");
      if (node.isQuestion) b.emit("?");
      return;
    }
    case "ModalExpression":
      writeWrapper(
        b,
        node.render,
        node.negated,
        node.content,
        depth,
        flatOnly,
        node.isQuestion,
        node.keywordStart !== undefined ? { start: node.keywordStart, end: node.keywordEnd! } : undefined
      );
      return;
    case "DiscourseMarker":
      writeWrapper(
        b,
        node.marker,
        false,
        node.content,
        depth,
        flatOnly,
        undefined,
        node.keywordStart !== undefined ? { start: node.keywordStart, end: node.keywordEnd! } : undefined
      );
      return;
    case "Conditional": {
      if (node.keyword === "if") {
        b.emit("if (");
        writeNode(b, node.condition, depth, true);
        b.emit(") { ");
        writeNode(b, node.consequence, depth, true);
        b.emit(" }");
      } else {
        b.emit(node.keyword);
        b.emit("(");
        writeNode(b, node.condition, depth, true);
        b.emit(") { ");
        writeNode(b, node.consequence, depth, true);
        b.emit(" }");
      }
      return;
    }
    case "BecauseClause":
      writeNode(b, node.main, depth, true);
      b.emit(" because(");
      writeNode(b, node.cause, depth, true);
      b.emit(")");
      return;
    case "Coordination":
      writeNode(b, node.left, depth, true);
      b.emit(` ${node.conjunction} `);
      writeNode(b, node.right, depth, true);
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

/** Renders EAC code formatted like real source — nested calls with more than one
 * argument (or a single complex nested argument) break onto indented lines —
 * while tracking source spans for bidirectional highlighting. */
export function renderPrettyWithSpans(node: ASTNode): { text: string; mappings: Mapping[] } {
  const b = new Builder();
  writeNode(b, node, 0, false);
  return { text: b.text, mappings: b.mappings };
}
