// EAC AST — single source of truth for parser output. Renderer never sees raw text.

export interface Span {
  start: number;
  end: number;
}

export interface SourceToken extends Span {
  surface: string;
}

export type EntityKind = "pronoun" | "proper_noun" | "common_noun" | "unknown_placeholder" | "wh_placeholder";

export interface Entity extends Span {
  type: "Entity";
  surface: string;
  render: string; // casing-normalized display form
  kind: EntityKind;
  adjectives?: AdjectivePhrase[];
  possessor?: Entity; // e.g. my.father in my.father.car
  confidence?: number;
}

export interface AdjectivePhrase extends Span {
  type: "Adjective";
  surface: string;
  render: string;
}

export interface AdverbPhrase extends Span {
  type: "Adverb";
  surface: string;
  render: string;
  modifiers?: AdverbPhrase[]; // e.g. very(quickly)
}

export interface PrepArg extends Span {
  type: "PrepArg";
  prep: string;
  value: Entity;
}

/** Subject.Verb(objects, preps, adverb=..) */
export interface Action extends Span {
  type: "Action";
  subject: Entity | null; // null => imperative / bare call
  verb: {
    surface: string;
    render: string;
    lemma?: string;
    confidence?: number;
  };
  objects: (Entity | ASTNode)[];
  preps: PrepArg[];
  adverbs: AdverbPhrase[];
  negated?: boolean;
  isQuestion?: boolean;
  bareCall?: boolean; // render without "subject." prefix (imperative)
  confidence?: number;
}

/** A = B */
export interface Copula extends Span {
  type: "Copula";
  subject: Entity;
  complement: Entity | AdjectivePhrase | ASTNode; // may be nested call for idioms
  negated?: boolean;
  isQuestion?: boolean;
  confidence?: number;
}

/** modal(content) */
export interface ModalExpression extends Span {
  type: "ModalExpression";
  modal: string;
  render: string;
  content: ASTNode;
  negated?: boolean;
  isQuestion?: boolean;
  /** Span of the modal keyword itself (e.g. just "can"), for syntax highlighting —
   * distinct from `start`/`end`, which cover the whole wrapped expression. */
  keywordStart?: number;
  keywordEnd?: number;
}

/** marker(content) — discourse/internet markers */
export interface DiscourseMarker extends Span {
  type: "DiscourseMarker";
  marker: string;
  content: ASTNode;
  keywordStart?: number;
  keywordEnd?: number;
}

export interface Conditional extends Span {
  type: "Conditional";
  keyword: "if" | "when" | "before" | "after";
  condition: ASTNode;
  consequence: ASTNode;
}

export interface BecauseClause extends Span {
  type: "BecauseClause";
  main: ASTNode;
  cause: ASTNode;
}

export interface Coordination extends Span {
  type: "Coordination";
  conjunction: "and" | "but";
  left: ASTNode;
  right: ASTNode;
}

/** Escape hatch for idiom/phrase patterns that render directly. */
export interface Idiom extends Span {
  type: "Idiom";
  id: string;
  renderOverride: string;
  gloss?: string;
}

/** Bare NP fragment used as a whole utterance, e.g. "Big W." -> W(adjective=big) */
export interface Fragment extends Span {
  type: "Fragment";
  entity: Entity;
}

export interface Ambiguous extends Span {
  type: "Ambiguous";
  renderOverride: string;
}

export type ASTNode =
  | Action
  | Copula
  | ModalExpression
  | DiscourseMarker
  | Conditional
  | BecauseClause
  | Coordination
  | Idiom
  | Fragment
  | Ambiguous;

export interface ParseResult {
  input: string;
  ast: ASTNode;
  confidence: number;
}
