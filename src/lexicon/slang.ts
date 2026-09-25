// SlangLexicon — categorized per spec (section 19/2 of the slang spec): each entry
// distinguishes category, register, and gloss. Surface forms are never replaced in
// EAC output; this metadata feeds the Inspector only, except where the EAC notation
// itself requires normalization (e.g. gonna -> going_to wrapper).

export interface SlangEntry {
  surface: string;
  category:
    | "informal_contraction"
    | "internet_abbreviation"
    | "semantic_slang"
    | "slang_phrase"
    | "discourse_marker"
    | "regional_form";
  gloss: string;
  register: "very_informal" | "informal" | "internet_casual" | "slang";
  normalized?: string;
  confidence: "high" | "medium" | "low";
}

export const INFORMAL_CONTRACTIONS: Record<string, SlangEntry> = {
  gonna: { surface: "gonna", category: "informal_contraction", gloss: "going to", register: "very_informal", normalized: "going to", confidence: "high" },
  wanna: { surface: "wanna", category: "informal_contraction", gloss: "want to", register: "very_informal", normalized: "want to", confidence: "high" },
  gotta: { surface: "gotta", category: "informal_contraction", gloss: "have to / got to", register: "very_informal", normalized: "have to", confidence: "high" },
  lemme: { surface: "lemme", category: "informal_contraction", gloss: "let me", register: "very_informal", normalized: "let me", confidence: "high" },
  gimme: { surface: "gimme", category: "informal_contraction", gloss: "give me", register: "very_informal", normalized: "give me", confidence: "high" },
  dunno: { surface: "dunno", category: "informal_contraction", gloss: "don't know", register: "very_informal", normalized: "don't know", confidence: "high" },
  kinda: { surface: "kinda", category: "informal_contraction", gloss: "kind of", register: "informal", normalized: "kind of", confidence: "high" },
  sorta: { surface: "sorta", category: "informal_contraction", gloss: "sort of", register: "informal", normalized: "sort of", confidence: "high" },
  "ain't": { surface: "ain't", category: "informal_contraction", gloss: "nonstandard negation (am not / is not / are not / haven't)", register: "very_informal", confidence: "high" },
  "y'all": { surface: "y'all", category: "regional_form", gloss: "you all", register: "informal", normalized: "you all", confidence: "high" },
};

export const INTERNET_ABBREVIATIONS: Record<string, SlangEntry> = {
  ngl: { surface: "ngl", category: "discourse_marker", gloss: "not gonna lie", register: "internet_casual", confidence: "high" },
  tbh: { surface: "tbh", category: "discourse_marker", gloss: "to be honest", register: "internet_casual", confidence: "high" },
  idk: { surface: "idk", category: "internet_abbreviation", gloss: "I don't know", register: "internet_casual", confidence: "high" },
  imo: { surface: "imo", category: "discourse_marker", gloss: "in my opinion", register: "internet_casual", confidence: "high" },
  imho: { surface: "imho", category: "discourse_marker", gloss: "in my humble opinion", register: "internet_casual", confidence: "high" },
  fr: { surface: "fr", category: "discourse_marker", gloss: "for real", register: "internet_casual", confidence: "high" },
  frfr: { surface: "frfr", category: "discourse_marker", gloss: "for real for real", register: "internet_casual", confidence: "high" },
  btw: { surface: "btw", category: "discourse_marker", gloss: "by the way", register: "internet_casual", confidence: "high" },
  rn: { surface: "rn", category: "discourse_marker", gloss: "right now", register: "internet_casual", confidence: "high" },
  afaik: { surface: "afaik", category: "discourse_marker", gloss: "as far as I know", register: "internet_casual", confidence: "high" },
  fyi: { surface: "fyi", category: "discourse_marker", gloss: "for your information", register: "internet_casual", confidence: "high" },
  nvm: { surface: "nvm", category: "discourse_marker", gloss: "never mind", register: "internet_casual", confidence: "high" },
  lowkey: { surface: "lowkey", category: "discourse_marker", gloss: "quietly / somewhat", register: "internet_casual", confidence: "high" },
  highkey: { surface: "highkey", category: "discourse_marker", gloss: "openly / strongly", register: "internet_casual", confidence: "high" },
};

export const SEMANTIC_SLANG: Record<string, SlangEntry> = {
  fire: { surface: "fire", category: "semantic_slang", gloss: "excellent / exciting / very good", register: "slang", confidence: "high" },
  sick: { surface: "sick", category: "semantic_slang", gloss: "excellent / impressive", register: "slang", confidence: "high" },
  lit: { surface: "lit", category: "semantic_slang", gloss: "exciting / great", register: "slang", confidence: "high" },
  cooked: { surface: "cooked", category: "semantic_slang", gloss: "in serious trouble / exhausted / finished", register: "slang", confidence: "high" },
  salty: { surface: "salty", category: "semantic_slang", gloss: "resentful / annoyed", register: "slang", confidence: "high" },
  cringe: { surface: "cringe", category: "semantic_slang", gloss: "embarrassing / awkward", register: "slang", confidence: "high" },
  cap: { surface: "cap", category: "semantic_slang", gloss: "lie / falsehood", register: "slang", confidence: "high" },
  based: { surface: "based", category: "semantic_slang", gloss: "context-sensitive approval / independence of thought", register: "slang", confidence: "medium" },
  clean: { surface: "clean", category: "semantic_slang", gloss: "stylish / good-looking (in context)", register: "slang", confidence: "medium" },
  mid: { surface: "mid", category: "semantic_slang", gloss: "mediocre", register: "slang", confidence: "high" },
  goat: { surface: "GOAT", category: "semantic_slang", gloss: "greatest of all time", register: "slang", confidence: "high" },
  dead: { surface: "dead", category: "semantic_slang", gloss: "strong amusement/shock (figurative; context dependent)", register: "slang", confidence: "medium" },
  down: { surface: "down", category: "semantic_slang", gloss: "willing / interested (context dependent)", register: "slang", confidence: "medium" },
  rizz: { surface: "rizz", category: "semantic_slang", gloss: "charisma, especially romantic", register: "slang", confidence: "high" },
};

export interface PhraseEntry {
  surface: string;
  gloss: string;
  compositional: boolean;
  register: SlangEntry["register"];
}

export const SLANG_PHRASES: Record<string, PhraseEntry> = {
  hit_me_up: { surface: "hit me up", gloss: "contact me", compositional: false, register: "slang" },
  spill_the_tea: { surface: "spill the tea", gloss: "share gossip / details", compositional: false, register: "slang" },
  no_cap: { surface: "no cap", gloss: "seriously / not lying", compositional: false, register: "slang" },
  my_bad: { surface: "my bad", gloss: "apology / acknowledgement of a mistake", compositional: false, register: "slang" },
  let_him_cook: { surface: "let him cook", gloss: "let him continue (uninterrupted)", compositional: false, register: "slang" },
  touch_grass: { surface: "touch grass", gloss: "go outside / reconnect with reality", compositional: false, register: "slang" },
  shoot_your_shot: { surface: "shoot your shot", gloss: "take a chance, often romantic", compositional: false, register: "slang" },
  hang_out: { surface: "hang out", gloss: "spend time socially", compositional: false, register: "informal" as SlangEntry["register"] },
  say_less: { surface: "say less", gloss: "understood / no need to explain further", compositional: false, register: "slang" },
  bet: { surface: "bet", gloss: "agreement / confirmation", compositional: false, register: "slang" },
  locked_in: { surface: "locked in", gloss: "highly focused / committed", compositional: false, register: "slang" },
  got_ratioed: { surface: "got ratioed", gloss: "received more negative engagement than the original post", compositional: false, register: "slang" },
};
