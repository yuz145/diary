# 本番環境への移行（D1 / R2 / 変数）

リポジトリの `wrangler.toml` には **JWT 平文を置いていません**。ログイン用の **`pass`** はダッシュボード **Variables** のプレーンテキストで設定します（コードは `env.pass` で照合）。

**バインディング名**はダッシュボードと一致させる: D1 → **`diaryD1`**、R2 → **`diaryR2`**（`wrangler.toml` と同じ）。

**メール取り込み（`diary-email` とルート）**は **`docs/EMAIL_ROUTING.md`** を参照。

---

## CI が失敗する: D1 `database_id` 無効 [code: 10021]

**原因:** `wrangler.toml` の `database_id` が **`YOUR_D1_DATABASE_ID` のまま**（または無効な UUID）。

**対処:**

1. **D1 がまだ無い**場合は作成（名前は例として `diary`。`wrangler.toml` の `database_name` と揃える）:
   ```bash
   wrangler d1 create diary
   ```
2. **UUID を確認**:
   ```bash
   wrangler d1 list
   ```
   または ダッシュボード **ストレージとデータベース** → **D1** → 対象 DB → **データベース ID**（ハイフン付き 36 文字）をコピー。
3. **`wrangler.toml`** の `database_id = "…"` をその UUID に差し替えてコミットする。
4. **初回だけスキーマ**（`database_name` が `diary` の例）:
   ```bash
   wrangler d1 execute diary --remote --file=schema.sql
   ```
5. push してビルドを再実行。

`database_id` は**秘密ではない**のでリポジトリに書いて問題ありません。

---

## あなたが用意するもの（チェックリスト）

| 種別 | 名前 | どこで手に入るか |
|------|------|-------------------|
| **D1 データベース UUID** | `database_id` | D1 の DB 詳細、または `wrangler d1 list` |
| **R2 バケット** | `diary-media` | R2 で作成済み（`wrangler.toml` の `bucket_name` と一致） |
| **JWT 署名用** | `JWT_SECRET` | **Secret** で設定。32 文字以上のランダム（`openssl rand -hex 32` など） |
| **ログイン用パスワード** | **`pass`** | ダッシュボード **Variables**（プレーン）。Worker が入力と `===` 照合 |

### Cloudflare にログインするときの「トークン」

| 用途 | 必要なもの |
|------|------------|
| **PC で `wrangler deploy` / `wrangler secret put`** | **`wrangler login`** で十分なことが多い。CI だけ長期トークンが必要。 |
| **GitHub / CI からデプロイ** | **API トークン**: Workers Scripts 編集、D1 編集、必要なら R2。環境変数名は多くの場合 `CLOUDFLARE_API_TOKEN`。 |
| **rclone で NAS バックアップ**（HANDOFF の rclone 用） | R2 の **S3 API** 用キー。Worker のバインディングとは別です。 |

※ Worker が R2 に触るとき、別途 S3 キーは **不要**です。**バインディング名 `diaryR2`** とバケット `diary-media` が合っていればよいです。

---

## 手順 1: `wrangler.toml` の D1

`database_id` を本番 D1 の **UUID** に書き換える。`database_name` は Cloudflare 上の D1 名（例: **`diary`**）と一致させる。

```bash
wrangler d1 list
wrangler d1 execute diary --remote --file=schema.sql
```

---

## 手順 2: R2

1. バケット **`diary-media`** を作成（済みなら不要）。
2. **Workers & Pages** → **設定** → **バインディング**:
   - **変数名**: **`diaryR2`**
   - **バケット**: `diary-media`
3. `wrangler.toml` の `binding = "diaryR2"` / `bucket_name` と一致していること。

---

## 手順 3: 変数・シークレット（本番）

ローカルは `.dev.vars`（`.dev.vars.example` をコピー）。

### ダッシュボード

**Workers & Pages** → **diary** → **設定** → **変数とシークレット**:

| 種類 | 名前 | 内容 |
|------|------|------|
| Variable（プレーン） | **`pass`** | ログイン用パスワード（平文） |
| Secret | **`JWT_SECRET`** | ランダム長文 |

任意: **Secret** `EMAIL_SECRET`（`/diary/inbound-email` 用のみ）

### CLI

```bash
wrangler login
wrangler secret put JWT_SECRET
# `/diary/inbound-email` のみ（任意）
wrangler secret put EMAIL_SECRET
```

`pass` は **ダッシュボードの Variables** で設定するか、ローカルのみ `.dev.vars` に書く（Git に含めない）。

---

## 手順 4: デプロイ

```bash
npm run sync-static
npm run deploy
```

---

## トラブル時

| 現象 | 確認 |
|------|------|
| Pages でログインできない（`apiBaseUrl` 表示） | **`diary-config.json`** の **`apiBaseUrl`** に、**API 用 Worker の `https://….workers.dev`** を書いて push。例は **`diary-config.pages.example.json`**。**`JWT_SECRET`** も Pages のシークレットに必須 |
| JWT エラー | **`JWT_SECRET`** が Secret として設定されているか |
| 画像 503 | バインディング **`diaryR2`**、バケット **`diary-media`** |
| DB 503 / diaryD1 | バインディング名 **`diaryD1`**、D1 が同じアカウントに存在するか |
| deploy code **10021** | `wrangler.toml` の **`database_id`** を実 UUID に |
