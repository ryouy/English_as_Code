# English as Code (EAC)

英文を入力すると、その文法・依存構造をプログラミングコードのような記法で可視化する英語学習ツール。

```
I can speak English very well.
→
can(
    I.speak(
        English,
        adverb=very(well)
    )
)
```

設計原則: **Words stay. Structure changes.**（単語はそのまま残し、構造だけをコードとして見せる）

## 起動方法

```
npm install
npm run dev:api
```

`http://localhost:4173` を開く。英文を入力して「Analyze」を押すと、English/Codeパネルとインスペクターが表示される。Simple / Structure / Grammar の表示モード切り替えあり。

## テスト

```
npm run golden
```

`data/` 以下のゴールデンコーパス（590件、うちgolden 579件）に対してパーサーの出力を検証する回帰テスト。`status=golden` のケースは仕様として固定されており、失敗した場合は安易に期待値を書き換えず、パーサー側のバグかどうかをまず確認すること。

## ディレクトリ構成

```
src/
├── tokenizer/   英文のトークン化（位置情報つき）
├── lexicon/     品詞・スラング・略語・複合語などの辞書
├── parser/      構文解析（AST生成）。LLMは使わず決定的なルールベース
├── ast/         EAC ASTのスキーマ
├── renderer/    ASTからSimple/Structure/Grammar表示・色分け情報を生成
├── inspector/   単語ごとの品詞・スラング解説などのメタ情報
├── api/         Express API サーバー
└── test/        ゴールデンコーパス回帰テスト
ui/              フロントエンド（素のHTML/CSS/JS）
data/            ゴールデンコーパスとその仕様書
```

## 既知の制限

- 受動態・関係代名詞（主語・目的語どちらの位置も）・完了/進行形・比較級・複合疑問詞句・一般的な命令文（肯定/否定）・存在文（There is/are）・二重目的語（ditransitive）には対応済み
- 複合主語の等位接続（例: 「Ken or Maria will come.」）は未対応。「and」「or」は目的語の並列や節の並列としては扱えるが、2つの主語が1つの動詞を共有する構文はまだ扱えない
- 曖昧性の検出・複数解釈の提示（例: "I saw the man with a telescope." のPP付加のあいまいさ）は未対応。コーパス上は `status=review` の `ambiguity` カテゴリとして区別
