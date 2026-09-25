import type { ASTNode, Entity } from "../ast/types.js";

function entityLabel(e: Entity): string {
  return e.render;
}

function valueLabel(v: Entity | ASTNode): string {
  if ((v as Entity).type === "Entity") return entityLabel(v as Entity);
  return nodeLabel(v as ASTNode);
}

function nodeLabel(node: ASTNode): string {
  switch (node.type) {
    case "Action":
      return node.verb.render;
    case "Copula":
      return "=";
    case "ModalExpression":
      return node.render;
    case "DiscourseMarker":
      return node.marker;
    case "Conditional":
      return node.keyword;
    case "BecauseClause":
      return "because";
    case "Coordination":
      return node.conjunction;
    default:
      return "?";
  }
}

interface Line {
  depth: number;
  text: string;
}

function addChild(lines: Line[], depth: number, label: string, value: string) {
  lines.push({ depth, text: `${label} → ${value}` });
}

function walk(node: ASTNode, depth: number, lines: Line[]) {
  lines.push({ depth, text: nodeLabel(node) });
  switch (node.type) {
    case "Action": {
      if (node.subject) addChild(lines, depth + 1, "subject", entityLabel(node.subject));
      node.objects.forEach((o, i) => addChild(lines, depth + 1, node.objects.length > 1 ? `object[${i}]` : "object", valueLabel(o)));
      node.preps.forEach((p) => addChild(lines, depth + 1, p.prep, entityLabel(p.value)));
      if (node.adverbs.length) addChild(lines, depth + 1, "adverb", node.adverbs.map((a) => a.render).join(", "));
      if (node.negated) addChild(lines, depth + 1, "negated", "true");
      return;
    }
    case "Copula": {
      addChild(lines, depth + 1, "subject", entityLabel(node.subject));
      addChild(lines, depth + 1, "complement", valueLabel(node.complement as Entity | ASTNode));
      return;
    }
    case "ModalExpression":
      walk(node.content, depth + 1, lines);
      return;
    case "DiscourseMarker":
      walk(node.content, depth + 1, lines);
      return;
    case "Conditional":
      walk(node.condition, depth + 1, lines);
      walk(node.consequence, depth + 1, lines);
      return;
    case "BecauseClause":
      walk(node.main, depth + 1, lines);
      walk(node.cause, depth + 1, lines);
      return;
    case "Coordination":
      walk(node.left, depth + 1, lines);
      walk(node.right, depth + 1, lines);
      return;
    case "Idiom":
    case "Ambiguous":
      lines.push({ depth: depth + 1, text: node.renderOverride });
      return;
    case "Fragment":
      lines.push({ depth: depth + 1, text: entityLabel(node.entity) });
      return;
  }
}

/** Renders a simplified dependency tree, e.g.:
 * can
 * └── run
 *     ├── subject → I
 *     └── adverb → quickly
 */
export function renderStructure(node: ASTNode): string {
  const lines: Line[] = [];
  walk(node, 0, lines);
  return lines
    .map((l, i) => {
      if (l.depth === 0) return l.text;
      const prefix = "    ".repeat(l.depth - 1);
      const isLast = i === lines.length - 1 || lines[i + 1].depth < l.depth;
      return `${prefix}${isLast ? "└── " : "├── "}${l.text}`;
    })
    .join("\n");
}
