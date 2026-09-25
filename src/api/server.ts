import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSentence } from "../parser/sentence.js";
import { renderSimple } from "../renderer/simple.js";
import { renderWithSpans } from "../renderer/withSpans.js";
import { renderPrettyWithSpans } from "../renderer/pretty.js";
import { renderStructure } from "../renderer/structure.js";
import { renderGrammar } from "../renderer/grammar.js";
import { buildInspectorItems } from "../inspector/inspector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../../ui")));

app.post("/api/parse", (req, res) => {
  const text: string = req.body?.text ?? "";
  if (!text.trim()) {
    res.json({ sentences: [] });
    return;
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

  res.json({ sentences: results });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
app.listen(PORT, () => {
  console.log(`English as Code API listening on http://localhost:${PORT}`);
});
