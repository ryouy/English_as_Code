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

`data/` 以下のゴールデンコーパス（553件、うちgolden 532件）に対してパーサーの出力を検証する回帰テスト。`status=golden` のケースは仕様として固定されており、失敗した場合は安易に期待値を書き換えず、パーサー側のバグかどうかをまず確認すること。

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

- 受動態・関係代名詞・完了/進行形・比較級などの高度な文法は未対応（コーパス上は `status=review` として区別）
- 「What kind of area do you like the most?」のような複合疑問詞句は未対応
