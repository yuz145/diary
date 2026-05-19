# 本番環境への移行（D1 / R2 / シークレット）

リポジトリの `wrangler.toml` には **パスワードや JWT 用の平文を置いていません**。本番では **Cloudflare Secrets** と **ダッシュボードのバインディング**で揃えます。

---

## あなたが用意するもの（チェックリスト）

| 種別 | 名前 | どこで手に入るか |
|------|------|-------------------|
| **D1 データベース UUID** | `database_id` | [ダッシュボード] ストレージ & データベース → D1 → `diary-db` の ID、または `wrangler d1 list` |
| **R2 バケット** | `diary-media` | R2 でバケット作成済みであること（名前は `wrangler.toml` の `bucket_name` と一致） |
| **JWT 署名用シークレット** | `JWT_SECRET` | **自分で生成**（32 文字以上のランダム。パスワード生成器や `openssl rand -hex 32` など） |
| **ログイン用パスワードハッシュ** | `ADMIN_PASSWORD_HASH` | **自分のパスワード**を SHA-256（16進小文字64文字）にしたもの（下のコマンド参照） |
| **（任意）メール取込用** | `EMAIL_SECRET` | **自分で生成**したランダム文字列（inbound 用 Webhook だけ使う場合） |

### Cloudflare にログインするときの「トークン」

| 用途 | 必要なもの |
|------|------------|
| **PC で `wrangler deploy` / `wrangler secret put`** | **`wrangler login`**（ブラウザ認証）で十分なことが多い。CI だけ長期トークンが必要。 |
| **GitHub / CI からデプロイ** | [ダッシュボード] マイプロフィール → **API トークン** で作成。**権限の例**: `Account` → Cloudflare Workers Scripts 編集、`Account` → D1 編集、必要なら R2 管理。テンプレート「Edit Cloudflare Workers」をベースに調整。環境変数名は多くの場合 `CLOUDFLARE_API_TOKEN`。 |
| **rclone で NAS バックアップ**（HANDOFF の rclone 用） | R2 の **S3 API** 用に、アカウント詳細で **R2 用の Access Key ID / Secret Access Key**（または API トークンに R2 読み取り）を発行。Worker とは別の認証です。 |

※ **Worker が R2 に触るとき**に追加の S3 トークンは **不要**です。`wrangler.toml` の `[[r2_buckets]]` とダッシュボードの **バインディング名 `R2`** が合っていれば、Cloudflare 側で配線されます。

---

## 手順 1: `wrangler.toml` の D1 ID

`database_id = "YOUR_D1_DATABASE_ID"` を、本番の D1 の **UUID** に書き換える。

```bash
wrangler d1 list
# 無ければ: wrangler d1 create diary-db
wrangler d1 execute diary-db --remote --file=schema.sql
```

---

## 手順 2: R2 本番バケット

1. R2 でバケット **`diary-media`** を作成（済みなら不要）。
2. **Workers & Pages** → 該当 Worker / プロジェクト → **設定** → **バインディング**:
   - **変数名**: `R2`（コードは `env.R2` のみ）
   - **バケット**: `diary-media`
3. `wrangler.toml` の `bucket_name = "diary-media"` と一致していることを確認。

---

## 手順 3: シークレットの登録（本番）

ローカルでは `.dev.vars`（`.dev.vars.example` をコピー）を使う。**本番**では次のいずれか。

### A. CLI（推奨）

```bash
wrangler login
# 対話で貼り付け（入力は画面に表示されない）
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_PASSWORD_HASH
# 任意
wrangler secret put EMAIL_SECRET
```

`ADMIN_PASSWORD_HASH` の値の作り方（macOS / Linux）:

```bash
echo -n 'あなたの本番パスワード' | shasum -a 256
# 出た64文字の16進をそのまま Secret の値にする（小文字のままでOK）
```

### B. ダッシュボード

**Workers & Pages** → **diary** → **設定** → **変数とシークレット**:
- **シークレット**として `JWT_SECRET` / `ADMIN_PASSWORD_HASH` を追加（名前は上記と完全一致）。

`[vars]` に同じ名前で平文を置かないこと（漏洩防止）。

---

## 手順 4: デプロイ

```bash
npm run sync-static
npm run deploy
# または
npx wrangler deploy
```

---

## トラブル時

| 現象 | 確認 |
|------|------|
| ログイン 401 | `ADMIN_PASSWORD_HASH` が平文パスワードの SHA-256 と一致しているか |
| JWT エラー | `JWT_SECRET` が本番に設定されているか |
| 画像 503 R2 | バインディング名が **`R2`**、バケットが **`diary-media`** か |
| D1 エラー | `database_id` が正しいか、`schema.sql` 流し込み済みか |
