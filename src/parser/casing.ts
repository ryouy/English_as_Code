import { KNOWN_PROPER_NOUNS } from "../lexicon/properNouns.js";

/**
 * Sentence-initial casing normalization. English capitalizes the first word of a
 * sentence regardless of part of speech; EAC needs to undo that for common words
 * while preserving genuine proper nouns/acronyms. Only ever call this for a token
 * in true sentence-initial position — everywhere else the source casing is kept
 * as-is (mid-sentence proper nouns are already capitalized; common words already
 * lowercase).
 */
export function casingRenderSentenceInitial(word: string): string {
  if (word.toLowerCase() === "i") return "I";
  if (KNOWN_PROPER_NOUNS.has(word)) return word;
  if (/^[A-Z]$/.test(word)) return word; // single-letter acronym/initial, e.g. "W"
  if (/^[A-Z]{2,}$/.test(word)) return word; // acronym, e.g. "TV"
  return word.charAt(0).toLowerCase() + word.slice(1);
}
