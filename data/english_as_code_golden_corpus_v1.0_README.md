# English as Code — Golden Corpus v1.0

## Purpose

Regression and specification corpus for the English as Code parser/AST/renderer.

**Design principle:** Words stay. Structure changes.

## Corpus size

- Total cases: **553**
- Golden regression cases: **532**
- Review/specification probes: **21**

## Category distribution

- advanced: 10
- ambiguity: 6
- basic: 189
- clause: 14
- complement: 12
- informal: 16
- internet: 14
- modal: 45
- modifier: 93
- negation: 12
- possession: 9
- preposition: 62
- question: 26
- regional: 4
- slang: 35
- unknown: 6

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
