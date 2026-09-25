# English as Code — Golden Corpus v1.0

## Purpose

Regression and specification corpus for the English as Code parser/AST/renderer.

**Design principle:** Words stay. Structure changes.

## Corpus size

- Total cases: **590**
- Golden regression cases: **579**
- Review/specification probes: **11**

## Category distribution

- advanced: 12
- ambiguity: 6
- basic: 198
- clause: 14
- complement: 12
- informal: 16
- internet: 14
- modal: 45
- modifier: 96
- negation: 25
- possession: 9
- preposition: 62
- question: 36
- regional: 4
- slang: 35
- unknown: 6

## v1.3 additions (2026-09-25)

35 cases were added covering constructions that produced garbled output
when tested with natural (non-templated) sentences:

- General imperatives with no subject at all ("Call me.", "Open the door."),
  both plain and negated ("Don't touch grass.")
- Existential "there is/are ..."
- Negation of be-copula/progressive, perfect ("haven't", "have not"),
  uncontracted modal negation ("can not"), and uncontracted do-support
  negation ("did not", "does not") — previously only the contracted forms
  ("don't", "can't") were handled
- Negated fronted questions ("Isn't she happy?", "Doesn't he study?",
  "Can't you swim?") — previously only positive fronted questions worked
- be-fronted progressive wh-questions ("What are you doing?") and
  have-fronted perfect questions ("Have you finished?")
- Relative clauses modifying an object NP, not just the subject
  ("I met the man who lives in Tokyo.")
- Double-object (ditransitive) verbs ("Give me a book.", "I sent him a message.")
- "or" as an object-list connector, comma-separated adjectives, "please" as
  a droppable politeness softener, and additional frequency adverbs
  ("never", "usually", ...) in pre-verb position

Known remaining gap: compound-subject coordination ("Ken or Maria will
come.") is not yet supported — the parser currently only handles "and"/"or"
joining objects or full clauses, not two subjects sharing one verb.

## v1.2 additions (2026-09-25)

All 10 `advanced` cases (passive, relative clause, comparative, superlative,
perfect, progressive, perfect-progressive, and the past-perfect conditional)
were promoted from `review` to `golden`: the parser now produces their
existing `expected_eac` deterministically, so their notation is considered
settled rather than experimental.

2 cases were added for complex wh-noun-phrase questions ("What kind of area
do you like the most?"), which previously produced garbled output because
the wh-word handling only recognized a single fronted wh-word.

The remaining `review` cases are all `ambiguity` — genuine multi-parse
detection (PP-attachment, lexical, coordination-scope ambiguity) is a
different kind of feature from grammar coverage and is not yet implemented.

## v1.1 additions (2026-09-24)

18 cases were added after real-world (non-templated) sentences surfaced parser
bugs not covered by the original v1.0 set. Each addition documents a fix, per
the project's own policy of growing the corpus from fixed bugs:

- `question/be_yes_no` — be-fronted yes/no questions ("Are you happy?"), which
  were previously mis-parsed as if "are" were the subject.
- `question/modal_yes_no` — modal-fronted yes/no questions ("Can you swim?").
- `basic/object_coordination` — "and" joining two objects of the same verb
  ("I like you and her mother."), previously mis-split as clause coordination.
- `question/yes_no_coordination` — object coordination nested inside a
  do-support question ("Do you like coffee and tea?").
- `complement/infinitive_extraposition` — copula + infinitival complement
  ("It is nice to meet you."), previously merged into a nonsensical adjective list.
- `clause/and_vp_shared_subject` — VP coordination with an -s inflected verb
  ("He watches TV and plays tennis."), which needed inflected verb forms added
  to the parser's verb-recognition vocabulary.

## Files

- `english_as_code_golden_corpus_v1.0.jsonl` — recommended source for automated tests and agents.
- `english_as_code_golden_corpus_v1.0.json` — corpus metadata + all cases.
- `english_as_code_golden_corpus_v1.0.csv` — human review/editing.
- `english_as_code_golden_corpus_v1.0_README.md` — this document.

## Fields

- `id`: stable case identifier.
- `category`, `subcategory`: coverage taxonomy.
- `input`: source English.
- `expected_eac`: expected Simple View representation or an explicit ambiguity marker.
- `focus`: feature under test.
- `register`: standard / informal / internet_casual / slang.
- `confidence`: expected interpretation confidence.
- `status`: `golden` or `review`.
- `notes`: normalization, slang meaning, ambiguity, or implementation guidance.
- `tags`: pipe-separated labels.

## Critical test policy

1. Do not silently update expected outputs because the parser changed.
2. A change to a `golden` expectation is a language-specification change and should be reviewed.
3. `review` cases are deliberately not fully frozen. They cover advanced grammar, ambiguity, emerging slang, or notation that still needs product decisions.
4. Slang surface forms should remain visible. Normalized meanings belong in metadata/Inspector unless the EAC structure requires normalization.
5. Unknown words may be assigned a probable syntactic role, but their meanings must never be fabricated.
6. Ambiguous sentences must preserve multiple plausible analyses rather than force a false certainty.
7. External dictionary/LLM updates must not change stable outputs without regression review.

## Suggested CI behavior

- Fail CI on any changed `golden` case.
- Report, but do not necessarily fail, changed `review` cases.
- Track parser confidence separately from this corpus's expected interpretation confidence.
- Add a new regression case for every parser bug that is fixed.

## Slang coverage

The corpus explicitly tests:
- spoken contractions (`gonna`, `wanna`, `gotta`, `lemme`, `gimme`, `dunno`)
- internet abbreviations/discourse markers (`ngl`, `tbh`, `idk`, `fr`, `imo`, `afaik`, etc.)
- semantic slang (`fire`, `lit`, `cooked`, `salty`, `cap`, `GOAT`, `mid`, `rizz`, etc.)
- multiword slang/idioms (`hit me up`, `spill the tea`, `touch grass`, `shoot your shot`, etc.)
- emerging/unknown expressions, which must be handled conservatively

## Note

This corpus intentionally distinguishes stable Simple View rules from advanced/review probes. Perfect/progressive/relative-clause/conditional notation should not be treated as permanently frozen merely because examples are present here.
