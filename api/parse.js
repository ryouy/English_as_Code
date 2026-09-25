// Vercel serverless function. Imports the compiled output (produced by
// `npm run build`, which Vercel runs before bundling this function) rather than
// the TypeScript source, to avoid depending on Vercel's TS resolution for the
// project's ESM ".js"-extension-importing-a-".ts"-file convention.
import { parseText } from "../dist/api/parseText.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const text = (req.body && req.body.text) || "";
  res.status(200).json(parseText(text));
}
