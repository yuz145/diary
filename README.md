# 個人日記アプリ

Cloudflare Workers + D1 + R2 と Pages 単一 HTML クライアントで構成する個人用日記です。

## リポジトリ構成

| パス | 内容 |
|------|------|
| `HANDOFF.md` | Cursor 引き継ぎ・運用手順の詳細 |
| `schema.sql` | D1 スキーマ |
| `wrangler.toml` | Worker / D1 / R2 バインディング（プレースホルダーを置換） |
| `src/worker.js` | REST API と Email ハンドラ |
| `/index.html` | フロントエンド（**リポジトリ直下**。Pages のサイトルート） |
| `/diary-config.json` | API ベース URL など（`?api=` が最優先） |
| `static/` | Worker の `[assets]` 用。`index.html` / `diary-config.json` のコピー（`npm run sync-static` で更新） |
| `scripts/diary-gen.py` | Ubuntu cron 用：inbox → Gemini → POST `/diary` |
| `docs/PRODUCTION.md` | **本番**: D1 / R2 / Secrets / 必要なトークン一覧 |
| `.dev.vars.example` | ローカル `wrangler dev` 用（コピーして `.dev.vars`） |

## R2 を接続する（画像アップロード・閲覧）

1. **バケット作成**（未作成のとき）  
   `wrangler r2 bucket create diary-media`  
   名前は `wrangler.toml` の `bucket_name` と同じにする。
2. **`wrangler.toml`** に既にある `[[r2_buckets]]` で `binding = "R2"` とバケット名が一致しているか確認。
3. **Worker を再デプロイ** `npm run deploy`（`static/` 同期含む）。
4. **ダッシュボード**でも確認する場合: Worker → **設定** → **バインディング** → R2 を追加する際、**変数名は `R2`**（コードは `env.R2` のみ参照）。
5. 接続できていれば、日記に画像を付けて保存後、プレビューで表示され、`GET /images/...` で取得できる。

**Cloudflare Pages のみ**でフロントを出し、**Worker は別ドメイン**（`*.workers.dev`）のとき:

1. デプロイ済み Worker の URL を確認（例: `https://diary.xxxxx.workers.dev`）
2. リポジトリの **`diary-config.json`** を次のように編集して push（`apiBaseUrl` は **https ごとそのまま**）

```json
{
  "apiBaseUrl": "https://あなたのWorker名.アカウント名.workers.dev",
  "sameOrigin": false
}
```

3. Pages を再デプロイ  
4. **`test` では表示のみモード**になることがあるので、**本番で設定したパスワード**でログイン（`ADMIN_PASSWORD_HASH` と一致するもの）

※ `*.pages.dev` だけでは API に届かないため、`apiBaseUrl` 未設定のままだと保存できません。

## Cloudflare（変数・R2・サイト表示）

- **`wrangler.toml` の `[assets]`** はディレクトリ **`static/`** を指します（リポジトリ直下に `node_modules` があるため、アセット全体を `.` にできません）。**デプロイ前に** `npm run sync-static` でルートの HTML/JSON を `static/` にコピーするか、**`npm run deploy`** を使ってください。
- **Cloudflare Pages**: ビルドコマンドは空でよく、**ビルド出力ディレクトリは `/`（リポジトリルート）**、または「プロジェクトのルート」に **`index.html` を置く**設定にすると `/` で表示されます。
- **R2**: バインディング名は **`R2`** 固定（`env.R2`）。バケット名は `diary-media`（`wrangler.toml` の `bucket_name` と一致）。
- **シークレット**（本番）: `JWT_SECRET` / `ADMIN_PASSWORD_HASH` は **`wrangler secret put`** またはダッシュボードの **シークレット** で設定（`wrangler.toml` には書かない）。詳細は **`docs/PRODUCTION.md`**。
- **`diary-config.json`**（ルート）: `sameOrigin: false` のままだと、`*.workers.dev` 上では自動で **同一オリジン** に API を向けます。独自ドメインで Worker と同一ホストにしている場合は `"sameOrigin": true` に。

## ローカルでホーム画面を表示

リポジトリ直下で次を実行します（ルートの `index.html` を配信します）。

```bash
npm run dev
```

ブラウザで **http://127.0.0.1:5173/** を開くと、ログイン画面（ホーム）が表示されます。

- API 未デプロイでも画面枠だけ見たい場合：`http://127.0.0.1:5173?preview=1`
- 別 URL の Worker を試す場合：`?api=https://あなたのworker.workers.dev`

## Cloudflare のビルドが失敗するとき（Workers & Pages）

ログに `Your config file is using the Worker name ... expected "diary"` と出る場合は、`wrangler.toml` の `name` をダッシュボードのプロジェクト名（例: **diary**）に揃えてください。本リポジトリでは `name = "diary"` です。

**CI で Worker をデプロイする場合**

- **`npm run deploy`** を推奨（`sync-static` のあと `wrangler deploy`。ルートの HTML が `static/` にコピーされてからアップロードされます）。
- 手動で `npx wrangler deploy` だけだと `static/` が古い可能性があるため、事前に **`npm run sync-static`** を実行してください。

その他の前提:

1. `database_id = "YOUR_D1_DATABASE_ID"` の**プレースホルダーのままではデプロイできません**。D1 を作成し UUID を `wrangler.toml` に書いてください。  
2. 例: `wrangler d1 create diary-db` → `wrangler d1 list` で ID をコピー → `wrangler d1 execute diary-db --file=schema.sql`。  
3. R2 バケット `diary-media` が無いと失敗することがあります。`wrangler r2 bucket create diary-media` で作成。

**静的サイトだけ先に載せたい場合（ルートの `index.html` のみ）**

Workers のビルドは使わず、Pages の次の設定にします。

| 項目 | 推奨値 |
|------|--------|
| ビルドコマンド | （空） |
| ビルド出力ディレクトリ | `/`（リポジトリルート）または `.` |

`npx wrangler deploy` は **API 用 Worker**向けです。CI では **`npm run deploy`**（`sync-static` 付き）を推奨。D1 ID を入れていないと失敗します。

## クイックセットアップ

`HANDOFF.md` の「8. セットアップ順序」に従ってください。デプロイ前に次を必ず置換してください。

- `YOUR_D1_DATABASE_ID`（`wrangler.toml` を本番 UUID に）
- **本番シークレット**: `JWT_SECRET` / `ADMIN_PASSWORD_HASH`（平文は保存せず、SHA-256 ハッシュのみ。手順は **`docs/PRODUCTION.md`**）
- ルートの `diary-config.json` の `apiBaseUrl`（または `?api=`。プレースホルダーのままならパスワード `test` は表示のみログイン）
- 任意：`EMAIL_SECRET` を `wrangler secret put EMAIL_SECRET` で設定（`/diary/inbound-email` 用）

## ライセンス

個人利用を想定しています。
