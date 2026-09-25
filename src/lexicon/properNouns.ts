// Curated proper-noun allowlist for the MVP corpus domain (names, places, brands,
// the language name "English", and common acronyms). Per spec §41, any OTHER
// capitalized word defaults to being treated as a proper noun too (see casing.ts) —
// this list only matters for disambiguating sentence-initial position, where a
// common word must be told apart from a name.
export const KNOWN_PROPER_NOUNS = new Set([
  "Ken",
  "Maria",
  "Tokyo",
  "Japan",
  "Osaka",
  "Acme",
  "English",
  "TV",
  "GOAT",
  "Tom",
]);
