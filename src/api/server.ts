import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseText } from "./parseText.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../../ui")));

app.post("/api/parse", (req, res) => {
  const text: string = req.body?.text ?? "";
  res.json(parseText(text));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
app.listen(PORT, () => {
  console.log(`English as Code API listening on http://localhost:${PORT}`);
});
