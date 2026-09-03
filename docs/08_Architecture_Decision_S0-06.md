# MinePilot Architecture Decision Baseline

> Status: FROZEN for Stage 0 / S0-06  
> Scope: module and directory boundaries only; no gameplay implementation

## 1. Decision

MinePilot uses a small layered architecture. Direct calls and explicit data structures are preferred. A plugin system, global event bus, dependency-injection framework, and speculative abstraction layers are not part of the baseline.

Directories are created only when a real task has a real file to place in them. The intended `src` boundaries are:

| Directory | Responsibility | Must not own |
|---|---|---|
| `core/` | Pure game rules, domain state, invariants, deterministic transitions, save schema validation/migration | Phaser, DOM, storage APIs, animation, input handling |
| `systems/` | Use-case orchestration and side-effect adapters, grouped by capability | Rendering, duplicated rules, direct mutation of another system's internals |
| `scenes/` | Phaser scene lifecycle, input translation, rendering coordination | Game rules or authoritative state |
| `config/` | Declarative, versioned parameters and presentation/content data | Branching business logic or mutable runtime state |
| `ui/` | Non-authoritative UI components and view models | Rule decisions, persistence, authoritative state |
| `audio/` | Audio presentation adapter and playback policy | Rule decisions or authoritative state |
| `assets/` | Static images, fonts, audio and other build-time resources | TypeScript/JavaScript behavior |

Files directly under `src/` are composition/bootstrap files only. They may wire layers together but must not become a second home for domain logic.

## 2. Dependency direction

The dependency rule is deliberately small:

```text
config(type data) --> core <-- systems <-- scenes
                         ^          ^         |
                         |          |         +--> ui / audio
                         +-- ui/audio type views
```

- `core` imports only `core`.
- `config` imports `config`, plus type-only domain definitions from `core`.
- A `systems/<capability>/` folder may import `core`, `config`, and its own capability folder.
- One system capability must not directly import another. Their caller coordinates explicit commands/results. If real implementation proves a coordinator is needed, add one narrowly and update this decision before use.
- `scenes` may call systems and render `core` results through `ui`/`audio`. It does not decide rules.
- `ui` and `audio` may consume `config` and type-only domain views. They do not call systems or scenes.
- Phaser imports are restricted to bootstrap/composition and `scenes`. Presentation helpers remain framework-independent unless a later approved decision says otherwise.
- Static assets may be referenced by presentation code, but executable source does not live in `assets`.

The automated architecture check enforces the high-value import rules for static imports/exports and literal dynamic imports. Architectural meaning—especially whether code contains a disguised rule—still requires review.

## 3. State ownership

`GameState` is the single source of truth for game rules. A rendered sprite, tween, modal, sound, cached view model, or browser storage entry is never authoritative.

- **Cell State**: facts about one cell that rules need, such as its domain kind and revealed/flagged status. It contains no sprite, colour, tween, or DOM data.
- **Run State**: the current attempt: board/cell collection, player position, seed or generated layout reference, progress, run-scoped resources, assistance usage, and unified revealed-mine facts.
- **Account State**: facts that survive runs, such as durable inventory, currency, progression, and one-time reward claims.
- **Local State**: the persisted, versioned envelope containing validated snapshots of game/run, account, tutorial and settings data. It is a storage representation, not a competing runtime authority.

Shared concepts are modeled once. For example, a revealed mine is one rule-level fact with provenance if needed; Detection, movement, or another future item must use that same transition instead of creating separate revealed-mine implementations.

## 4. State, persistence, and animation order

The safe sequence is:

1. Validate a command against the current `GameState`.
2. Produce and commit the valid state transition.
3. Complete required persistence in the same application operation, or return an explicit failure before claiming success.
4. Render/animate the committed result.

Animations may be skipped, replayed, interrupted, or fail without changing the truth. A scene must be able to reconstruct the display from authoritative state. Persistence adapters serialize validated snapshots and report success/failure; they do not decide rules and do not wait for animation callbacks.

## 5. Configuration boundary

Configuration answers “what value/content applies?” Rules answer “what does that value mean and what transition is legal?” Configuration may contain item parameters, level data, copy, asset identifiers, and tuning values. It must not contain executable callbacks, hidden state mutation, or conditional rule branches.

All configuration consumed by rules is validated at a boundary before use. Changing configuration must not silently redefine a state invariant.

## 6. Test mapping

| Test location | Purpose |
|---|---|
| `tests/unit/` | Pure `core` rules, state invariants, configuration validation, and isolated helpers |
| `tests/integration/` | Multiple real modules/adapters working together, including persistence contracts; created only when the first such test exists |
| `tests/e2e/` | Browser-visible user journeys and wiring; never the sole proof of rule correctness |

Every rule transition belongs primarily in unit tests. Integration tests prove boundaries. E2E tests prove the assembled product and baseline remain usable.

## 7. Placement examples (not implementations)

- **Detection Item**: its shared reveal rule and state transition belong in `core`; item-use orchestration belongs in `systems/items/`; parameters belong in `config`; input and effects belong in `scenes`/`ui`/`audio`. Detection must call the same revealed-mine rule as every other source.
- **Save System**: snapshot schema, validation and migration rules belong in `core`; the browser-storage adapter and save/load orchestration belong in `systems/persistence/`; save feedback belongs in `ui`. Animation never gates saved truth.
- **Game Scene**: Phaser lifecycle, input mapping, camera and rendering belong in `scenes/game/`. It submits commands and renders results; it never calculates mines, movement legality, rewards, or inventory changes.

Future Requirements Registry entries may influence the stability of an interface, but they do not justify creating code, directories, hooks, or abstractions before an approved task needs them.

## 8. Placement checklist

For every new file, ask in order:

1. Is it a deterministic rule, invariant, or authoritative state? Put it in `core`.
2. Is it declarative data without rule branches? Put it in `config`.
3. Does it coordinate a use case or a platform side effect? Put it under one named `systems` capability.
4. Is it Phaser lifecycle/render/input? Put it in `scenes`.
5. Is it display-only UI or audio? Put it in `ui` or `audio`.
6. Is it a static resource? Put it in `assets`.

If a file appears to belong to multiple answers, split data/rules/effects at the boundary instead of adding a general-purpose abstraction.

## 9. Explicit prohibitions

- No rule decisions or authoritative state in scenes, UI, audio, sprites, tweens, or DOM nodes.
- No `core` import from Phaser, browser APIs, storage, scenes, UI, audio, systems, or config.
- No system-to-system direct import across capability folders.
- No UI/audio import of systems or scenes.
- No mutable runtime state or business branching in config.
- No animation callback as the trigger that makes a rule transition or required save true.
- No duplicate rule implementation for different items or presentation paths.
- No architecture justified only by an unapproved future requirement.
- No global event bus, plugin framework, service locator, or dependency-injection container without a later explicit architecture decision and demonstrated need.

## 10. Change policy

This baseline may change only from concrete implementation evidence. A change must state the problem, alternatives, compatibility impact, migration and rollback plan, then pass `npm run quality`. Convenience alone is not sufficient.
