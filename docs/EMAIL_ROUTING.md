# メール → 日記（Email Routing と `diary-email`）

**Cloudflare Pages の `diary` はメールルーティングの「宛先 Worker」一覧に出ないことがあります。** そのときは **`oyuzen.com` の Email Routing 用に別名の Worker（例: `diary-email`）を作り、同じ D1 に書き込む**構成にします。

- **サイト（Pages）**: UI・API はこれまでどおり **`diary`** プロジェクトでデプロイ。
- **メール取り込み**: **`diary-email`**（またはあなたが付けた名前）のみが `@oyuzen.com` で受信したメールを処理。

---

## あなたがダッシュボードでやること（チェックリスト）

### 共通前提

1. **`oyuzen.com`** が Cloudflare で **メール転送／Email Routing 有効**（MX・DNS 済み）。
2. **本番と同じ D1** が存在し、`schema.sql` が流し込まれている。

### A. メール取り込み用 Worker（例: `diary-email`）

1. **`oyuzen.com` → Email Routing → 宛先 Workers** で **Worker を作成**（名前は `diary-email` など）。
2. **自分で作成**し、コードに次が入っていること。

```javascript
export default {
  fetch() {
    return new Response("diary-email ok");
  },
  async email(message, env) {
    const body = await new Response(message.raw).text();
    const date = new Date().toISOString().split("T")[0];
    const id = crypto.randomUUID();
    if (!env.diaryD1) return;
    const subject = message.headers.get("subject") || "";
    await env.diaryD1
      .prepare(
        "INSERT INTO entries (id, date, title, content, source) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(id, date, subject, body, "email")
      .run();
  },
};
```

3. **Workers & Pages →（その名前の Worker）→ 設定** で **D1 バインディングを追加**:
   - **変数名**: `diaryD1`（コードと完全一致）
   - **データベース**: **Pages の日記アプリが使っている D1 と同一**
4. **保存／デプロイ**。

### B. ルート

1. **Email Routing → ルーティングルール**（または `diary-email` の **ルートを作成**）。
2. 例: **`diary`** @ `oyuzen.com` → アクション **Worker に送信** → **`diary-email`**。
3. 保存。

### C. 送信側（Perplexity / iCloud など）

- 転送先を **`diary@oyuzen.com`** に設定（または送信先をそれに統一）。

### D. Pages 側（`diary` プロジェクト）

- **`pass` / `JWT_SECRET` / `diaryD1` / `diaryR2`** はこれまでどおり。**メール取り込みのために増やさなくていい**。

---

## リポジトリのコード変更は？

| 項目 | 要否 |
|------|------|
| **`wrangler.toml` / Pages 用 `src/worker.js` のロジック** | **自動取り込みのために必須ではない**（処理の本体は **`diary-email`**）。 |
| **`src/worker.js` の `email()`** | **残してよい**。将来メイン経路に届いた場合の処理。説明コメントあり。 |
| **`diary-config.json` / `.dev.vars`** | **変更不要**。 |

Git を触らず **ダッシュボードだけでも運用できる**。あとから `diary-email` を別 `wrangler` プロジェクトとしてリポジトリへ置くだけでもよい。

---

## 動作確認

1. 別アドレスから **`diary@oyuzen.com`** に試しメール。
2. **`diary-email`** のログでエラーがないか確認。
3. **`diary` のサイト**でログインし、当日エントリに **`source = email`** が増えているか確認。

※ 本文が MIME ソースだらけのときは HTML メールのため。必要なら `diary-email` 側だけでプレーンテキスト抽出を追加する。

---

## 関連

- **`docs/PRODUCTION.md`** … D1 / `pass` / `JWT_SECRET` / R2。
- **`HANDOFF.md`** … cron など。
