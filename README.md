# 個人日記アプリ

Cloudflare Workers + D1 + R2 と Pages 単一 HTML クライアントで構成する個人用日記です。

## リポジトリ構成

| パス | 内容 |
|------|------|
| `HANDOFF.md` | Cursor 引き継ぎ・運用手順の詳細 |
| `schema.sql` | D1 スキーマ |
| `wrangler.toml` | Worker / D1 / R2 バインディング（プレースホルダーを置換） |
| `src/worker.js` | REST API と Email ハンドラ |
| `diary-app/diary-config.json` | API のベース URL（`YOUR_SUBDOMAIN` を差し替え、`?api=` が最優先） |
| `diary-app/index.html` | Pages 用フロントエンド |
| `scripts/diary-gen.py` | Ubuntu cron 用：inbox → Gemini → POST `/diary` |

## Cloudflare（変数・R2・サイト表示）

- **`wrangler.toml` の `[assets]`** で `diary-app` を Worker と同じ URL から配信します。**デプロイ後に `https://…workers.dev/` を開けばログイン画面が出ます**（以前は API のみで `/` が 404 になりがちでした）。
- **R2**: バインディング名は **`R2`** 固定（`env.R2`）。バケット名は `diary-images`（`wrangler.toml` の `bucket_name` と一致）。
- **Variables**: `JWT_SECRET` / `ADMIN_PASSWORD_HASH` はダッシュボードの Variables でも上書き可。
- **`diary-app/diary-config.json`**: `sameOrigin: false` のままだと、`*.workers.dev` 上では自動で **同一オリジン** に API を向けます。独自ドメインで Worker と同一ホストにしている場合は `"sameOrigin": true` に。

## ローカルでホーム画面を表示

リポジトリ直下で次を実行します（Python 3 のみ使用、`diary-app` を静的配信します）。

```bash
npm run dev
```

ブラウザで **http://127.0.0.1:5173/** を開くと、ログイン画面（ホーム）が表示されます。

- API 未デプロイでも画面枠だけ見たい場合：`http://127.0.0.1:5173?preview=1`
- 別 URL の Worker を試す場合：`?api=https://あなたのworker.workers.dev`

## Cloudflare のビルドが失敗するとき（Workers & Pages）

ログに `Your config file is using the Worker name ... expected "diary"` と出る場合は、`wrangler.toml` の `name` をダッシュボードのプロジェクト名（例: **diary**）に揃えてください。本リポジトリでは `name = "diary"` です。

**CI で `npx wrangler deploy` を使う場合（Worker を Git からデプロイ）**

1. `database_id = "YOUR_D1_DATABASE_ID"` の**プレースホルダーのままではデプロイできません**。D1 を作成し UUID を `wrangler.toml` に書いてください。  
2. 例: `wrangler d1 create diary-db` → `wrangler d1 list` で ID をコピー → `wrangler d1 execute diary-db --file=schema.sql`。  
3. R2 バケット `diary-images` が無いと失敗することがあります。`wrangler r2 bucket create diary-images` で作成。

**静的サイトだけ先に載せたい場合（`diary-app` の HTML のみ）**

Workers のビルドは使わず、Pages の次の設定にします。

| 項目 | 推奨値 |
|------|--------|
| ビルドコマンド | （空） |
| ビルド出力ディレクトリ | `diary-app` |

`npx wrangler deploy` は **API 用 Worker**向けです。D1 ID を入れていない状態でこのコマンドが走ると失敗します。

## クイックセットアップ

`HANDOFF.md` の「8. セットアップ順序」に従ってください。デプロイ前に次を必ず置換してください。

- `YOUR_SUBDOMAIN`（Workers URL）
- `YOUR_D1_DATABASE_ID`
- `JWT_SECRET` / `ADMIN_PASSWORD_HASH`（`verifyPassword` は平文の SHA-256 16進と比較。開発用は `wrangler.toml` で `"test"` のハッシュを入れてある。本番は Cloudflare の Variables / Secrets で上書き）
- `diary-app/diary-config.json` の `apiBaseUrl`（または `?api=`。プレースホルダーのままならパスワード `test` は表示のみログイン）
- 任意：`EMAIL_SECRET` を `wrangler secret put EMAIL_SECRET` で設定（`/diary/inbound-email` 用）

## ライセンス

個人利用を想定しています。
