# Online Turn-Based Battle Architecture (Browser Monster RPG)

## 1) Goals & Constraints

- Frontend stack: **React + Phaser** (UI shell + battle scene engine).
- Backend stack: **Supabase** (Postgres, Auth, Realtime, Edge Functions).
- Battles are **real-time over WebSockets** while still turn-based in game logic.
- Combat rules are **server authoritative** (damage, status effects, RNG, turn order).
- Players join via **room-based matchmaking**.
- Design must **minimize client-side cheating**.
- Architecture should be **modular** for future PvE/PvP modes.

---

## 2) High-Level System Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                          Browser Client                            │
│  React App                                                         │
│   ├─ Lobby/Matchmaking UI                                          │
│   ├─ Team Builder UI                                               │
│   ├─ Battle HUD/Action UI                                          │
│   └─ State Store (Zustand/Redux)                                   │
│       │                                                            │
│       └──> Phaser Battle Scene (render/animation only)             │
│                  │                                                 │
│                  └── WebSocket (Supabase Realtime channel)         │
└──────────────────┬─────────────────────────────────────────────────┘
                   │
                   │ events (intent only)
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                      Supabase Backend                              │
│                                                                    │
│  Postgres (source of truth)                                        │
│   ├─ users / profiles / monsters / player_loadouts                │
│   ├─ matchmaking_queue / battle_rooms / battles                    │
│   ├─ battle_turns / battle_actions / battle_snapshots              │
│   └─ anti_cheat_audit                                               │
│                                                                    │
│  Realtime                                                           │
│   └─ Room channels: room:{battleId}                                │
│                                                                    │
│  Edge Functions                                                     │
│   ├─ matchmaking-enqueue                                            │
│   ├─ matchmaking-tick (scheduled)                                  │
│   ├─ battle-submit-action                                           │
│   ├─ battle-resolve-turn (authoritative rules engine)              │
│   └─ battle-timeout-forfeit                                         │
└────────────────────────────────────────────────────────────────────┘
```

### Core Rule
Clients **never send computed outcomes** (damage, KO, critical, status hit chance). Clients only send **player intent** (e.g., `use_move(slot=2,target=enemyA)`).

---

## 3) Battle Data Flow (Authoritative)

## 3.1 Matchmaking
1. Player clicks "Find Match" in React.
2. Client calls `matchmaking-enqueue` Edge Function with selected team ID.
3. Function validates ownership + loadout legality from DB.
4. Player enters `matchmaking_queue`.
5. `matchmaking-tick` pairs compatible players and creates:
   - `battle_rooms` row,
   - `battles` initial state row,
   - initial `battle_snapshots` row (turn 0).
6. Both clients subscribe to `room:{battleId}` channel and receive `battle_started` event.

## 3.2 Turn Loop
1. Server broadcasts `turn_started` with timeout metadata.
2. Each client submits one action via `battle-submit-action`.
3. Function checks:
   - requester is authenticated and is battle participant,
   - action schema is valid for current turn,
   - move is available under current rules (PP, status lock, cooldown).
4. Action is stored in `battle_actions` as **pending intent**.
5. Once both intents are in (or timer expires), `battle-resolve-turn` runs.
6. Resolver computes full outcome deterministically:
   - speed/priority ordering,
   - hit/miss,
   - crit,
   - damage,
   - secondary effects,
   - fainting and end-turn effects.
7. Resolver writes:
   - immutable turn log (`battle_turns`),
   - new canonical state (`battles.current_state`),
   - optional compressed snapshot (`battle_snapshots`).
8. Resolver publishes `turn_resolved` event to `room:{battleId}` with:
   - minimal animation payload,
   - redacted state for each side (fog-of-war friendly),
   - next turn metadata.
9. Phaser animates from payload; React updates HUD from canonical state.

## 3.3 Disconnects/Timeouts
- Grace window (e.g., 20s reconnect).
- If no valid action by timeout, server applies configured fallback:
  - `auto_basic_attack`, or
  - `skip_turn`, or
  - `forfeit` after N misses.
- Outcome is resolved by the same authoritative resolver.

---

## 4) Anti-Cheat Strategy

## 4.1 Trust Boundaries
- **Trusted**: Edge Functions + Postgres rules data.
- **Untrusted**: browser runtime, local storage, network payloads from client.

## 4.2 Anti-Cheat Controls
1. **Intent-only protocol**
   - Client can request action, not result.
2. **Server-side RNG**
   - RNG seed generated server-side per battle/turn.
   - Optional commit-reveal hash for auditability in competitive modes.
3. **Strict action validation**
   - Schema validation (Zod/Valibot) in Edge Functions.
   - State validation against canonical battle state.
4. **Row Level Security (RLS)**
   - Player can read only battles they belong to.
   - No direct write permissions to battle state tables from client role.
5. **Monotonic turn IDs + idempotency keys**
   - Prevent replay/double-submit attacks.
6. **Rate limiting + anomaly logging**
   - Throttle action endpoints.
   - Write suspicious events to `anti_cheat_audit`.
7. **Signed server events (optional hardening)**
   - Include server signature in battle event payload to detect tampering proxies.

---

## 5) Supabase Schema (Conceptual)

```sql
-- Core matchup lifecycle
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

### RLS Notes
- `select` on battle tables only where `auth.uid()` in participants.
- `insert/update/delete` on battle-critical tables disabled for client role.
- Edge Functions use service role key for authoritative writes.

---

## 6) Realtime/WebSocket Event Contract

Use one channel per battle room: `room:{battleId}`.

### Client -> Server (via Edge Function call, not direct broadcast)
- `submit_action`
  - `{ battleId, turn, actionType, payload, idempotencyKey }`

### Server -> Clients (broadcast)
- `battle_started`
- `turn_started`
  - `{ battleId, turn, deadlineTs, publicState }`
- `turn_resolved`
  - `{ battleId, turn, events, stateDelta, nextDeadlineTs }`
- `battle_ended`
  - `{ battleId, winnerId, reason }`
- `player_disconnected` / `player_reconnected`

### Versioning
Include `schemaVersion` in each event payload and keep backward-compatible parsers on client.

---

## 7) Frontend Architecture (React + Phaser)

## 7.1 Responsibilities Split

### React
- Authentication/session handling.
- Lobby, matchmaking UI, roster selection.
- Battle overlays: move buttons, timers, status text, chat/emotes.
- Global store + networking orchestration.

### Phaser
- Sprite scene graph, animations, VFX, camera shake.
- Receives normalized battle animation events from React store.
- No game-rule ownership; purely visual state projection.

## 7.2 Suggested Client Modules
- `BattleGateway`: websocket subscribe/unsubscribe + reconnection logic.
- `BattleStore`: canonical client copy of **server-provided** battle state.
- `ActionComposer`: builds legal action payload candidates from UI inputs.
- `PredictionLayer` (optional): temporary UI anticipation only; always reconciles to server events.

---

## 8) Backend Modularization

Implement rules engine as pure modules so it can run in Edge Functions and tests.

- `rules/turnOrder.ts`
- `rules/hitResolution.ts`
- `rules/damage.ts`
- `rules/statusEffects.ts`
- `rules/endTurn.ts`
- `rules/applyAction.ts`
- `rules/resolveTurn.ts` (orchestrator)

Each module should be deterministic and side-effect free:

```ts
nextState = resolveTurn({
  state,
  actionA,
  actionB,
  rngStream,
  ruleset,
})
```

This allows replay tests and anti-cheat audit re-simulation.

---

## 9) Clear Folder Structure

```text
monster-rpg/
  apps/
    web/                          # React + Phaser client
      src/
        app/
          routes/
          providers/
        features/
          auth/
          matchmaking/
          battle/
            components/           # React HUD and panels
            scene/                # Phaser scene + assets bindings
            store/                # Zustand/Redux slices
            net/                  # Realtime gateway + DTO mapping
            domain/               # client-side battle view models
        shared/
          ui/
          lib/
          types/

  supabase/
    migrations/                   # SQL schema + RLS policies
    functions/
      matchmaking-enqueue/
      matchmaking-tick/
      battle-submit-action/
      battle-resolve-turn/
      battle-timeout-forfeit/
    seed/

  packages/
    battle-engine/                # shared deterministic rules engine
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
    protocol/                     # event schemas + zod validators
      src/
        events/
        actions/
        versions/

  tooling/
    scripts/
      replay-battle.ts            # verify deterministic replay
      loadtest-matchmaking.ts

  docs/
    online-battle-architecture.md
    sequence-diagrams/
```

---

## 10) Matchmaking Design (Room-based)

- Queue key dimensions: `mode`, `ruleset`, `mmr_range`, `region`.
- `matchmaking-tick` runs every few seconds:
  - picks oldest compatible entries,
  - gradually widens MMR window over wait time,
  - creates battle room atomically in transaction.
- Store a `roomJoinToken` mapped to authenticated users/battle to prevent room hijacking.

---

## 11) Determinism & Testing Strategy

1. **Unit tests** on each rules module (damage, status, ordering).
2. **Golden snapshot tests** on full `resolveTurn` outputs.
3. **Replay tests**: rebuild battle from turn intents and compare resulting hash.
4. **Property-based tests** for invariants (HP never < 0, fainted can’t act).
5. **Contract tests** for protocol schema version compatibility.
6. **Integration tests**: simulate two players through websocket lifecycle.

---

## 12) Minimal Implementation Roadmap

### Phase 1 (Foundation)
- Set up schema, RLS, auth, queue and battle tables.
- Build deterministic `battle-engine` package with tests.
- Implement `battle-submit-action` + `battle-resolve-turn`.

### Phase 2 (Playable PvP)
- React lobby + matchmaking queue UX.
- Phaser battle scene with server-driven animations.
- Reconnect/timeout behavior.

### Phase 3 (Hardening)
- Anti-cheat audits, rate limits, replay validation jobs.
- Spectator mode and richer event compression.
- Metrics dashboards (turn latency, disconnect rate, invalid action rate).

---

## 13) Practical Notes

- Keep payloads small: send **delta events**, not full state each turn.
- Persist full snapshots every N turns for fast reconnect.
- Use optimistic UI sparingly; reconcile aggressively to server truth.
- Keep protocol and rules in shared packages to avoid drift.

This architecture gives you responsive realtime PvP while preserving fairness through strict server authority and a deterministic battle engine.
