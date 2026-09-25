import type { ASTNode, Action, Entity } from "../ast/types.js";
import { renderAdverbArg } from "../parser/remainder.js";

function renderArgValue(v: Entity | ASTNode): string {
  if ((v as Entity).type === "Entity") return (v as Entity).render;
  return renderSimple(v as ASTNode);
}

function renderAction(a: Action): string {
  const args: string[] = [];
  for (const o of a.objects) args.push(renderArgValue(o));
  for (const p of a.preps) args.push(`${p.prep}=${renderArgValue(p.value)}`);
  const adverbArg = renderAdverbArg(a.adverbs);
  if (adverbArg) args.push(adverbArg);

  const call = `${a.verb.render}(${args.join(", ")})`;
  const withSubject = a.bareCall || !a.subject ? call : `${a.subject.render}.${call}`;
  const negated = a.negated ? `!${withSubject}` : withSubject;
  return a.isQuestion ? `${negated}?` : negated;
}

/** Renders any EAC AST node to its Simple View string. This is the ONLY place
 * that produces final EAC text — the parser never emits strings directly. */
export function renderSimple(node: ASTNode): string {
  switch (node.type) {
    case "Action":
      return renderAction(node);
    case "Copula": {
      const complement = renderArgValue(node.complement as Entity | ASTNode);
      const core = `${node.subject.render} = ${complement}`;
      const negatedCore = node.negated ? `!(${core})` : core;
      return node.isQuestion ? `${negatedCore}?` : negatedCore;
    }
    case "ModalExpression": {
      const inner = `${node.render}(${renderSimple(node.content)})`;
      const negatedInner = node.negated ? `!${inner}` : inner;
      return node.isQuestion ? `${negatedInner}?` : negatedInner;
    }
    case "DiscourseMarker":
      return `${node.marker}(${renderSimple(node.content)})`;
    case "Conditional": {
      const cond = renderSimple(node.condition);
      const conseq = renderSimple(node.consequence);
      if (node.keyword === "if") return `if (${cond}) { ${conseq} }`;
      return `${node.keyword}(${cond}) { ${conseq} }`;
    }
    case "BecauseClause":
      return `${renderSimple(node.main)} because(${renderSimple(node.cause)})`;
    case "Coordination":
      return `${renderSimple(node.left)} ${node.conjunction} ${renderSimple(node.right)}`;
    case "Idiom":
      return node.renderOverride;
    case "Fragment":
      return node.entity.render;
    case "Ambiguous":
      return node.renderOverride;
    default:
      return "?";
  }
}
