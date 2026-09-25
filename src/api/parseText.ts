import { parseSentence } from "../parser/sentence.js";
import { renderSimple } from "../renderer/simple.js";
import { renderWithSpans } from "../renderer/withSpans.js";
import { renderPrettyWithSpans } from "../renderer/pretty.js";
import { renderStructure } from "../renderer/structure.js";
import { renderGrammar } from "../renderer/grammar.js";
import { buildInspectorItems } from "../inspector/inspector.js";

/**
 * Shared request logic for both the local Express dev server and the Vercel
 * serverless function — parses each sentence in `text` and returns every view
 * (Simple/Structure/Grammar, span mappings, Inspector data) the UI needs.
 */
export function parseText(text: string) {
  if (!text.trim()) {
    return { sentences: [] };
  }

  // Split into sentences on ., !, ? followed by space/end — MVP: one utterance
  // at a time is the primary use case, but handle simple multi-sentence input too.
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results = sentences.map((s) => {
    try {
      const { ast, confidence } = parseSentence(s);
      const { text: code, mappings } = renderWithSpans(ast);
      const pretty = renderPrettyWithSpans(ast);
      return {
        input: s,
        simple: renderSimple(ast),
        codeWithSpans: code,
        mappings,
        codePretty: pretty.text,
        prettyMappings: pretty.mappings,
        structure: renderStructure(ast),
        grammar: renderGrammar(s),
        inspector: buildInspectorItems(s),
        confidence,
      };
    } catch (e) {
      return { input: s, error: (e as Error).message };
    }
  });

  return { sentences: results };
}
