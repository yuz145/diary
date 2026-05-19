# 個人日記アプリ — Cursor引き継ぎドキュメント

## プロジェクト概要

個人用の日記Webアプリ。どのデバイス・どこからでもアクセス可能。
手動入力とAI自動生成の両方に対応。

**技術スタック：**
- フロントエンド：Cloudflare Pages（HTML/CSS/JS 1枚構成）
- バックエンド：Cloudflare Workers（REST API）
- DB：Cloudflare D1（SQLite）
- ストレージ：Cloudflare R2（写真）
- 自動化：Ubuntu（Proxmox上）cron + Python
- バックアップ：Synology NAS（rclone週1同期）

---

## 1. D1 スキーマ

`schema.sql` を参照（リポジトリ同梱）。

---

## 2. wrangler.toml

`wrangler.toml` を参照。`YOUR_D1_DATABASE_ID` 等を実環境に置換すること。

---

## 3. Cloudflare Workers API

`src/worker.js` を参照。

---

## 4. フロントエンド（Cloudflare Pages）

リポジトリ直下の `index.html` を参照。`diary-config.json` で API 向き先を調整（デプロイ済み Worker と同一オリジンなら `sameOrigin` / `*.workers.dev` 自動）。

---

## 4b. Worker 用静的アセット（`static/`）

`wrangler.toml` の `[assets]` は `static/` を指します。ルートの `index.html` / `diary-config.json` を編集したら **`npm run sync-static`** を実行してから `wrangler deploy`（または **`npm run deploy`** 一括）。

---

## 5. Ubuntu cronスクリプト

リポジトリでは `scripts/diary-gen.py` を参照。サーバー上の配置先・`INBOX_DIR` は環境に合わせて調整。

```bash
# crontab -e に追加
# 毎日23:59に実行
59 23 * * * DIARY_TOKEN=your_token GEMINI_API_KEY=your_key /usr/bin/python3 /home/youruser/diary/diary-gen.py >> /home/youruser/diary/cron.log 2>&1
```

---

## 6. rclone設定

```bash
# インストール
curl https://rclone.org/install.sh | sudo bash

# 設定（対話式）
rclone config
# → R2のアクセスキーを入力してリモート名「r2」を作成

# 手動テスト
rclone sync r2:diary-images /volume1/diary-backup --progress

# crontab に追加（毎週日曜3時）
0 3 * * 0 /usr/bin/rclone sync r2:diary-images /volume1/diary-backup >> /home/youruser/diary/rclone.log 2>&1
```

---

## 7. Cloudflare Email Routing設定

ダッシュボード操作のみ（コード不要）：

1. Cloudflare ダッシュボード → **Email** → **Email Routing**
2. カスタムアドレス `diary@yourdomain.com` を追加
3. アクション：**Send to a Worker** → `diary`（`wrangler.toml` の `name` と一致する Worker）を選択
4. Worker側の `email()` ハンドラが自動でD1に保存

---

## 8. セットアップ順序

```
1. wrangler d1 create diary-db
2. wrangler d1 execute diary-db --file=schema.sql
3. wrangler r2 bucket create diary-images
4. wrangler deploy
5. Cloudflare Pages にリポジトリルート（`index.html` がある階層）をデプロイ、または Worker の `npm run deploy` のみで同一 URL に統合
6. Email Routing を設定
7. Ubuntu に diary-gen.py を配置 → cron登録
8. rclone 設定 → cron登録
```

---

## Cursorへの引き継ぎメモ

- `YOUR_SUBDOMAIN` を実際のWorkersサブドメインに置換
- `ADMIN_PASSWORD_HASH` はSHA-256ハッシュを事前に生成して設定
- フロントのスタイルは Nexus Design System（ダークモード基調）で仕上げる
- エディター/ビューワーの切り替えUI、カレンダーUIはCursorで実装
- 画像はWebPに変換してからR2にアップロードする処理を追加推奨
