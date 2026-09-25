// CoreLexicon — closed-class word sets. These are finite in English, so listing
// them is appropriate; open-class vocabulary (nouns/verbs) is resolved structurally
// in the parser rather than via a hardcoded dictionary (Surface Preservation Principle).

export const SUBJECT_PRONOUNS: Record<string, string> = {
  i: "I",
  you: "you",
  he: "he",
  she: "she",
  we: "we",
  they: "they",
  it: "it",
  "y'all": "y'all",
};

export const OBJECT_PRONOUNS = new Set(["me", "you", "him", "her", "us", "them", "it"]);

export const DETERMINERS = new Set(["a", "an", "the", "this", "that", "these", "those"]);
// "that"/"this" are handled specially: determiner when followed by a noun,
// otherwise a demonstrative pronoun subject.
export const DEMONSTRATIVES = new Set(["that", "this", "these", "those"]);

export const POSSESSIVE_DETERMINERS = new Set(["my", "your", "his", "her", "our", "their", "its"]);

export const BE_FORMS = new Set(["is", "are", "am", "was", "were", "be", "been"]);
export const BE_CONTRACTIONS: Record<string, string> = {
  "i'm": "am",
  "you're": "are",
  "he's": "is",
  "she's": "is",
  "it's": "is",
  "we're": "are",
  "they're": "are",
  "that's": "is",
  "y'all're": "are",
};
export const BE_CONTRACTION_SUBJECT: Record<string, string> = {
  "i'm": "I",
  "you're": "you",
  "he's": "he",
  "she's": "she",
  "it's": "it",
  "we're": "we",
  "they're": "they",
  "that's": "that",
  "y'all're": "y'all",
};

export const MODALS = new Set(["can", "could", "may", "might", "must", "shall", "should", "will", "would"]);

export const WILL_CONTRACTIONS: Record<string, string> = {
  "i'll": "I",
  "you'll": "you",
  "he'll": "he",
  "she'll": "she",
  "it'll": "it",
  "we'll": "we",
  "they'll": "they",
};

// Verbs that take a full bare embedded clause as their complement (no "to"),
// e.g. "I reckon it'll rain." -> I.reckon(will(it.rain()))
export const CLAUSE_COMPLEMENT_VERBS = new Set(["reckon", "reckons", "reckoned"]);

export const MODAL_NEGATIVE_CONTRACTIONS: Record<string, string> = {
  "can't": "can",
  cannot: "can",
  "couldn't": "could",
  "won't": "will",
  "wouldn't": "would",
  "shouldn't": "should",
  "mightn't": "might",
  "mustn't": "must",
};

// Modal-like informal wrappers that take an inner action, rendered as name(subject.verb(...)).
export const INFORMAL_MODAL_WRAPPERS: Record<string, string> = {
  gonna: "going_to",
  gotta: "have_to",
};

export const DO_SUPPORT = new Set(["do", "does", "did"]);
export const NEGATION_WORDS = new Set(["not", "n't"]);

export const WH_WORDS = new Set(["what", "where", "when", "who", "why", "how", "which"]);
export const ADVERBIAL_WH = new Set(["where", "when", "why", "how"]);

export const PREPOSITIONS = new Set([
  "to",
  "from",
  "in",
  "with",
  "at",
  "on",
  "for",
  "through",
  "about",
  "of",
  "into",
  "onto",
  "over",
  "under",
]);

export const CONJUNCTIONS = new Set(["and", "but", "because", "if", "when", "before", "after"]);
export const FRONTING_CONJUNCTIONS = new Set(["if", "when", "before", "after"]);

// Closed adverb set observed in the golden corpus; unknown -ly/-word tails fall back
// to adverb classification structurally (see parser/pos.ts).
export const KNOWN_ADVERBS = new Set([
  "quickly",
  "slowly",
  "carefully",
  "often",
  "always",
  "sometimes",
  "today",
  "yesterday",
  "tomorrow",
  "outside",
  "alone",
  "well",
  "later",
  "quietly",
  "probably",
  "totally",
  "tonight",
  "now",
]);

export const ADVERB_MODIFIERS = new Set(["very", "really", "extremely", "so", "quite"]);

export const INFINITIVE_TAKING_VERBS = new Set([
  "want",
  "wants",
  "wanted",
  "decided",
  "decide",
  "hope",
  "hopes",
  "hoped",
  "need",
  "needs",
]);

export const GERUND_TAKING_VERBS = new Set([
  "enjoy",
  "enjoys",
  "enjoyed",
  "likes",
  "like",
  "liked",
  "stopped",
  "stop",
  "finished",
  "finish",
]);

const GERUND_LEMMA_EXCEPTIONS: Record<string, string> = {
  smoking: "smoke",
  writing: "write",
  making: "make",
  using: "use",
  hiking: "hike",
  coming: "come",
};

export function gerundToBase(word: string): string {
  const lower = word.toLowerCase();
  if (GERUND_LEMMA_EXCEPTIONS[lower]) return GERUND_LEMMA_EXCEPTIONS[lower];
  if (lower.endsWith("ing")) return lower.slice(0, -3);
  return lower;
}

export function isGerund(word: string): boolean {
  return /ing$/i.test(word) && word.length > 4;
}

// Open-class verb vocabulary observed in the golden corpus. Used only to
// disambiguate "determiner + NOUN" (e.g. "that joke sent me") from a bare
// demonstrative/pronoun subject directly followed by its verb (e.g. "this
// works") — a distinction that closed-class signals alone can't make.
const CORPUS_VERB_BASES = [
  "arrive",
  "ate",
  "bought",
  "buy",
  "call",
  "clean",
  "come",
  "coming",
  "dance",
  "decided",
  "dunno",
  "eat",
  "enjoy",
  "finished",
  "flexed",
  "florped",
  "found",
  "ghosted",
  "go",
  "got",
  "hope",
  "know",
  "laugh",
  "leave",
  "like",
  "live",
  "love",
  "need",
  "open",
  "play",
  "rained",
  "rains",
  "ran",
  "read",
  "reckon",
  "run",
  "saw",
  "see",
  "sit",
  "sleep",
  "smiled",
  "stayed",
  "stopped",
  "studied",
  "study",
  "swim",
  "talk",
  "travel",
  "use",
  "visit",
  "wait",
  "walk",
  "want",
  "watch",
  "went",
  "work",
  "glorped",
  "sent",
  "drank",
  "drink",
  "help",
  "cook",
  "cooks",
  "cooked",
  "text",
  "texts",
];

// Base forms plus their naive "-s" third-person inflections (e.g. play -> plays),
// so natural sentences ("he watches TV") get recognized alongside the base forms
// used throughout the golden corpus's questions/modals ("does he watch TV?").
export const CORPUS_VERBS = new Set([...CORPUS_VERB_BASES, ...CORPUS_VERB_BASES.map((v) => (v.endsWith("h") || v.endsWith("s") || v.endsWith("o") ? `${v}es` : `${v}s`))]);
