# GitHub Pages で 404 になる原因と対策

## 結論（今回の主因）
今回のリポジトリには **`index.html` が存在せず**、GitHub Pages がルートURL（`/RPGgame2/`）で配信すべきエントリーファイルを見つけられなかったため、404 が発生していました。

## 根拠
- 前状態は設計ドキュメントのみで、Webアプリ本体（HTML/CSS/JS）が未配置。
- GitHub Pages は、配信対象ディレクトリ（通常 `root` か `docs/`）に `index.html` が必要。

## 実施した対策
1. ルートに `index.html` を追加。
2. 表示用 `styles.css` とゲームロジック `src/game.js` を追加。
3. これにより、ビルド不要の静的サイトとして即時配信可能に変更。

## GitHub Pages 側の確認ポイント
1. **Settings → Pages** を開く。
2. Build and deployment の Source を **Deploy from a branch** に設定。
3. Branch を公開したいブランチ（例: `main`）に設定。
4. Folder を `/ (root)` に設定（本実装は root 配置のため）。
5. 保存後、デプロイ完了まで数分待って再アクセス。

## 補足
- もし `docs/` 配信にしたい場合は、`index.html` / `styles.css` / `src/game.js` を `docs/` 配下へ移動し、Pages の Folder を `/docs` に変更してください。
