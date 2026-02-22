# オンラインターン制バトル アーキテクチャ（ブラウザ向けモンスターRPG）

## 1) 目的と制約

- フロントエンド: **React + Phaser**（UIシェル + バトルシーン描画）。
- バックエンド: **Supabase**（Postgres, Auth, Realtime, Edge Functions）。
- バトルは**WebSocketベースのリアルタイム通信**を使いつつ、ゲームロジックはターン制。
- ダメージ計算・状態異常・行動順・乱数は**サーバー権威（Server Authoritative）**。
- 対戦は**ルームベースのマッチメイキング**で管理。
- **クライアント改ざん耐性**を前提に設計。
- 将来のPvE/PvP拡張に耐える**モジュール構成**。

---

## 2) システム全体像

```text
┌────────────────────────────────────────────────────────────────────┐
│                           ブラウザクライアント                      │
│  Reactアプリ                                                        │
│   ├─ ロビー / マッチメイキングUI                                    │
│   ├─ パーティ編成UI                                                  │
│   ├─ バトルHUD / 行動選択UI                                          │
│   └─ 状態管理（Zustand/Redux）                                       │
│       │                                                             │
│       └──> Phaserバトルシーン（描画/演出専用）                        │
│                  │                                                  │
│                  └── WebSocket（Supabase Realtime）                 │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   │ イベント（意図のみ）
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Supabaseバックエンド                          │
│                                                                    │
│  Postgres（真実の単一情報源）                                        │
│   ├─ users / profiles / monsters / player_loadouts                 │
│   ├─ matchmaking_queue / battle_rooms / battles                    │
│   ├─ battle_turns / battle_actions / battle_snapshots              │
│   └─ anti_cheat_audit                                               │
│                                                                    │
│  Realtime                                                           │
│   └─ ルームチャネル: room:{battleId}                                │
│                                                                    │
│  Edge Functions                                                     │
│   ├─ matchmaking-enqueue                                            │
│   ├─ matchmaking-tick（定期実行）                                    │
│   ├─ battle-submit-action                                           │
│   ├─ battle-resolve-turn（権威的ルールエンジン）                      │
│   └─ battle-timeout-forfeit                                         │
└────────────────────────────────────────────────────────────────────┘
```

### コアルール
クライアントは**結果を送信しない**（ダメージ、急所、状態異常成功など）。
クライアントが送るのは**プレイヤーの意図**のみ（例: `use_move(slot=2,target=enemyA)`）。

---

## 3) バトルデータフロー（サーバー権威）

### 3.1 マッチメイキング
1. プレイヤーがReact UIで「対戦開始」を押す。
2. クライアントが選択チームID付きで `matchmaking-enqueue` を呼ぶ。
3. 関数がDBでチーム所有権・レギュレーション適合を検証。
4. プレイヤーを `matchmaking_queue` に投入。
5. `matchmaking-tick` が適合ユーザーをペアリングし、以下を作成:
   - `battle_rooms` レコード
   - `battles` 初期状態レコード
   - `battle_snapshots` 初期スナップショット（turn 0）
6. 双方クライアントが `room:{battleId}` を購読し `battle_started` を受信。

### 3.2 ターン進行
1. サーバーが `turn_started`（締切時刻含む）を配信。
2. 各クライアントが `battle-submit-action` で1行動を送信。
3. 関数側で以下を検証:
   - 認証済みかつ当該バトル参加者か
   - 現在ターンに対してスキーマ妥当か
   - 行動可能条件を満たすか（PP、行動不能、クールダウン等）
4. 行動を `battle_actions` に**意図（pending）**として保存。
5. 両者分が揃う（またはタイムアウト）と `battle-resolve-turn` 実行。
6. リゾルバが決定的に結果を計算:
   - 優先度/素早さ順
   - 命中/回避
   - 急所
   - ダメージ
   - 追加効果
   - ひんし判定とターン終了処理
7. リゾルバが以下を書き込み:
   - 不変のターンログ（`battle_turns`）
   - 正式な最新状態（`battles.current_state`）
   - 必要に応じ圧縮スナップショット（`battle_snapshots`）
8. `room:{battleId}` に `turn_resolved` を配信:
   - 最小限の演出イベント
   - 陣営ごとの公開可能状態（必要なら情報秘匿）
   - 次ターン情報
9. Phaserが演出し、React HUDはサーバー正式状態で更新。

### 3.3 切断・タイムアウト
- 再接続猶予（例: 20秒）を設定。
- 締切までに有効行動がない場合、サーバーがフォールバック適用:
  - `auto_basic_attack`
  - `skip_turn`
  - N回連続で `forfeit`
- いずれも同じ権威リゾルバで処理。

---

## 4) アンチチート戦略

### 4.1 信頼境界
- **信頼する領域**: Edge Functions + Postgres内ルールデータ。
- **信頼しない領域**: ブラウザ実行環境、ローカルストレージ、クライアント送信値。

### 4.2 具体策
1. **意図のみ送信するプロトコル**
   - クライアントは結果ではなく行動意図のみ送る。
2. **サーバー側乱数**
   - 乱数シードはバトル/ターン単位でサーバー生成。
   - 競技モードではcommit-reveal監査も検討。
3. **厳格な行動バリデーション**
   - Edge Functionでスキーマ検証（Zod/Valibot）。
   - 正式状態に対する整合性チェック。
4. **RLS（Row Level Security）**
   - 参加バトルのみ読める。
   - クライアントロールからバトル中核テーブルの書込を禁止。
5. **単調増加ターンID + 冪等キー**
   - リプレイ攻撃・二重送信を防止。
6. **レート制限 + 異常監査ログ**
   - 行動APIをスロットリング。
   - 疑わしい挙動を `anti_cheat_audit` に記録。
7. **署名付きサーバーイベント（任意強化）**
   - 中継改ざん検知のため署名を添付。

---

## 5) Supabaseスキーマ（概念）

```sql
profiles(id, mmr, region, created_at)
player_loadouts(id, player_id, team_blob, locked_ruleset_id)

matchmaking_queue(id, player_id, loadout_id, mmr, joined_at, status)
battle_rooms(id, battle_id, player_a, player_b, status, created_at)

battles(
  id,
  ruleset_id,
  state_version,
  current_turn,
  current_state_json,
  status,
  winner_id,
  created_at,
  updated_at
)

battle_actions(
  id,
  battle_id,
  turn_number,
  player_id,
  action_type,
  action_payload_json,
  idempotency_key,
  received_at,
  UNIQUE(battle_id, turn_number, player_id)
)

battle_turns(
  id,
  battle_id,
  turn_number,
  resolution_log_json,
  resulting_state_hash,
  created_at
)

battle_snapshots(id, battle_id, turn_number, state_json, created_at)
anti_cheat_audit(id, player_id, battle_id, event_type, metadata_json, created_at)
```

### RLS方針
- battle系テーブルは `auth.uid()` が参加者の場合のみ `select`。
- battle中核テーブルの `insert/update/delete` はクライアントロール禁止。
- 権威的更新はEdge Functions（service role）経由のみ。

---

## 6) Realtime / WebSocket イベント契約

バトルごとに1チャネル: `room:{battleId}`。

### Client -> Server（Edge Function経由、直接broadcastしない）
- `submit_action`
  - `{ battleId, turn, actionType, payload, idempotencyKey }`

### Server -> Clients（broadcast）
- `battle_started`
- `turn_started`
  - `{ battleId, turn, deadlineTs, publicState }`
- `turn_resolved`
  - `{ battleId, turn, events, stateDelta, nextDeadlineTs }`
- `battle_ended`
  - `{ battleId, winnerId, reason }`
- `player_disconnected` / `player_reconnected`

### バージョニング
全イベントに `schemaVersion` を持たせ、クライアントは後方互換パーサを維持。

---

## 7) フロントエンド構成（React + Phaser）

### 7.1 役割分担

#### React
- 認証/セッション管理
- ロビー、マッチメイキング、編成UI
- バトルオーバーレイ（技ボタン、タイマー、状態表示、エモート等）
- グローバル状態管理と通信オーケストレーション

#### Phaser
- スプライト描画、アニメーション、VFX、カメラ演出
- Reactストアの正規化イベントを受けて描画
- ルールロジックは持たない（表示専任）

### 7.2 推奨クライアントモジュール
- `BattleGateway`: WebSocket購読/再接続
- `BattleStore`: サーバー配信状態のクライアント正規キャッシュ
- `ActionComposer`: UI入力から行動ペイロード生成
- `PredictionLayer`（任意）: 一時予測表示。常にサーバー結果へ収束。

---

## 8) バックエンドのモジュール化

ルールエンジンは純粋関数として分割し、Edge Functionsとテスト双方で利用。

- `rules/turnOrder.ts`
- `rules/hitResolution.ts`
- `rules/damage.ts`
- `rules/statusEffects.ts`
- `rules/endTurn.ts`
- `rules/applyAction.ts`
- `rules/resolveTurn.ts`（統合オーケストレータ）

```ts
nextState = resolveTurn({
  state,
  actionA,
  actionB,
  rngStream,
  ruleset,
})
```

純粋関数化により、リプレイ検証と不正監査再計算が容易。

---

## 9) 明確なフォルダ構成

```text
monster-rpg/
  apps/
    web/                          # React + Phaserクライアント
      src/
        app/
          routes/
          providers/
        features/
          auth/
          matchmaking/
          battle/
            components/           # React HUDやパネル
            scene/                # Phaserシーン/アセット連携
            store/                # Zustand/Redux slices
            net/                  # Realtime gateway / DTO
            domain/               # 表示用ドメインモデル
        shared/
          ui/
          lib/
          types/

  supabase/
    migrations/                   # SQLスキーマ + RLSポリシー
    functions/
      matchmaking-enqueue/
      matchmaking-tick/
      battle-submit-action/
      battle-resolve-turn/
      battle-timeout-forfeit/
    seed/

  packages/
    battle-engine/                # 決定的ルールエンジン
      src/
        core/
          resolveTurn.ts
          applyAction.ts
        rules/
          damage.ts
          accuracy.ts
          status.ts
        models/
        rng/
        tests/
    protocol/                     # イベント定義 + zodバリデータ
      src/
        events/
        actions/
        versions/

  tooling/
    scripts/
      replay-battle.ts            # 決定的リプレイ検証
      loadtest-matchmaking.ts

  docs/
    online-battle-architecture.md
    sequence-diagrams/
```

---

## 10) マッチメイキング設計（ルームベース）

- キュー軸: `mode`, `ruleset`, `mmr_range`, `region`。
- `matchmaking-tick` を数秒おきに実行:
  - 最古の互換エントリを優先
  - 待機時間に応じMMR幅を段階的拡張
  - トランザクションでバトルルームを原子的作成
- `roomJoinToken` をユーザー/バトルに紐付け、ルーム乗っ取りを防止。

---

## 11) 決定性とテスト戦略

1. ルール別ユニットテスト（ダメージ、状態異常、行動順）。
2. `resolveTurn` のゴールデンスナップショットテスト。
3. リプレイテスト（行動履歴から再構築し状態ハッシュ比較）。
4. 性質ベーステスト（HPは0未満にならない等）。
5. プロトコルの互換性契約テスト。
6. WebSocketライフサイクルの統合テスト（2プレイヤー模擬）。

---

## 12) 最小実装ロードマップ

### Phase 1（基盤）
- スキーマ、RLS、Auth、キュー/バトルテーブル整備。
- `battle-engine` パッケージ実装とテスト。
- `battle-submit-action` / `battle-resolve-turn` 実装。

### Phase 2（対戦可能化）
- Reactロビー + マッチメイキングUI。
- サーバー駆動演出のPhaserバトルシーン。
- 再接続/タイムアウト制御。

### Phase 3（堅牢化）
- 監査ログ、レート制限、リプレイ検証ジョブ。
- 観戦モード、イベント圧縮改善。
- メトリクス可視化（ターン遅延、切断率、不正行動率）。

---

## 13) 実装時の実務メモ

- ペイロードは小さく（全状態ではなく**差分イベント**中心）。
- 再接続高速化のため、Nターンごとにフルスナップショット保存。
- 楽観UIは最小限にし、常にサーバー正へ強制収束。
- プロトコル定義とルール実装を共有パッケージ化して乖離防止。

この構成により、リアルタイム対戦の応答性と、公平性（サーバー権威 + 決定的ルール）を両立できます。
