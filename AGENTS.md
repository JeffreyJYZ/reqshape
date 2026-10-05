# AGENTS.md

Agent-facing notes for `reqshape`. The README is user-facing — keep it that way;
architecture, contracts and the traps live here.

## What this is

A `bun`/TypeScript CLI that measures the token shape of real opencode traffic and
reprices it on any model. It answers "what does one of my requests cost, and how
many does this allowance buy?" — where `mpc` answers the same question with a
fixed workload assumption.

Sibling tooling it depends on, same author:

| tool | what reqshape takes from it |
| --- | --- |
| `mpc` (`~/dev/cmdcode-tools/oc-cmd-compare`) | `mpc --json` — per-model pricing, allowances, and the window ratios derived from `requestsPerFiveHour / requestsPerMonth` |
| `cmduse` (Rust CLI) | `cmduse -1 --json` — the account's own request count for the period, printed as a context line only |

`MPC_BIN` / `CMDUSE_BIN` point either call at a dev build.

## Layout

```
src/index.ts             entry
src/types.ts             Req (one model call), Ask, Profile, Shape, Stats
src/constants/keywords.ts  DEFAULT_KEYWORDS + FILLER (noise filtering)
src/constants/providers.ts CC_PREFIXES (CommandCode provider ids)
src/constants/asks.ts    BOUNDARY (row kind -> AskKind)
src/constants/layout.ts  LABEL + table column widths
src/constants/ansi.ts    ESC + ANSI
src/cli/options.ts       Options, defaultOptions
src/cli/flags.ts         flag readers: str, number, oneOf, sinceOf, keywordList, customOf
src/cli/parse.ts         cac declarations -> Options
src/cli/run.ts           orchestration
src/measure/rows.ts      store rows -> RawMessage (v2 + legacy layouts)
src/measure/store.ts     readStore: layout detection, session metadata merge
src/measure/asks.ts      messages -> asks, with each req's position in its session
src/measure/filter.ts    keep/drop decisions, normalisation, the keyword rule
src/measure/stats.ts     FIELDS + reqProfile + mean + percentiles (one place a field is read)
src/measure/profile.ts   buildShape: per-req, per-conversation and per-side vectors, buckets
src/measure/sides.ts     sideOf + sideProfiles: provider id -> oc / cc
src/market/rates.ts      RateEntry types and labels
src/market/entries.ts    mpc payload -> entries, window ratios, custom entries
src/market/sources.ts    the subprocess calls (mpc --json, cmduse -1 --json)
src/market/project.ts    $/req, req/mo, req/5h, req/wk
src/view/format.ts       counts, money, dates, colour
src/view/sections.ts     the measurement blocks
src/view/table.ts        the model table
src/view/render.ts       renderText
src/view/json.ts         renderJson
test/                    cli, measure, market, view
```

Data flow: `readStore` → `buildAsks` → `filterAsks` → `buildShape` →
`entriesOf(loadMpc())` → `projectAll` → `renderText`/`renderJson`.

## Commands

```sh
bun install
bun test                       # unit tests
bun run typecheck              # tsc --noEmit
bunx biome check --write .     # format + lint (always before commit)
bun run src/index.ts --help
bun link                       # exposes the `reqshape` binary
```

**`bun link` must be re-run after the repo moves, and can be silently pruned.**
It writes `~/.bun/bin/reqshape` → `~/.bun/install/global/node_modules/reqshape/src/index.ts`,
and that global symlink holds an **absolute** path. Moving this checkout (`~/dev/clis/reqshape`
→ `~/dev/cmdcode-tools/reqshape`) left it pointing at the dead old location — and once it
dangled, a later `bun link` in a sibling repo pruned the whole entry, so the `reqshape` bin
vanished. The failure is quiet: `command -v reqshape` prints nothing, and only a consumer
(`mpc --shape measured` shells it) notices. Fix: `bun link` here; verify with
`test -e ~/.bun/install/global/node_modules/reqshape/src/index.ts` (the bin symlink survives
dangling, so `ls -l` on it proves nothing).

## The lexicon

- **req** — one model call: one `assistant` row. This is the sidebar's unit and
  the billing unit. An agentic ask is many reqs.
- **ask** — the prompt that opened a run of reqs, plus those reqs.
- **position** — a req's 1-based index within its session. This is the axis
  cache read grows along, and the only bucket split worth showing: 579 cached
  tokens at position 1 versus 301K at 101+ on the author's history.
- **per-req vs per-conversation** — the two weightings. They disagree by ~4x
  because 78% of reqs sit at position 101+, in a handful of long sessions.

## Contracts

- `mpc --json`: `plans[<id>].{credits,fiveHour,weekly}` and
  `rows[].{oc,cc}.{pricing{input,output,cacheRead,cacheWrite},allowance,
  requestsPerMonth,requestsPerFiveHour,requestsPerWeek,free}`. Anything else is
  optional. A side with `pricing: null` is *unpriced*, not free — `entriesOf`
  skips it rather than pricing it at zero.
- Window ratios are **derived, never restated**. `ratiosOf` prefers the plan
  block (`fiveHour / credits`) and otherwise divides a row's windowed count by
  its monthly count, which is the provider's own rule as mpc already applied it
  (20%/50% on OpenCode Go, 20%/50% on GOAT and Pro, 30%/60% on Max and Go).
- `cmduse -1 --json`: `summary.requests`, `plan`, `periodEnd`. Missing or
  unauthenticated means no account line, never an error.
- **Our own `--format json` is consumed by `mpc --shape measured`**, which reads
  the top-level `profile` (the same vector as `shape.perReq`) as a single
  `Workload` and prices **both** plans on it. Keep `profile` a bare token
  vector; mpc rounds the means, so a fractional mean here is fine. `sides.{oc,cc}`
  is still emitted for our own report but mpc no longer reads it. The oc/cc split
  is still decided here (`command-code*`/`commandcode` → cc, `opencode*` → oc,
  everything else excluded), so a new CommandCode provider id must be added to
  `CC_PREFIXES` in `src/constants/providers.ts`.
- `sides` is additive: an older consumer reading `perReq`/`perSession` is
  unaffected, and a payload without `sides` is a fallback, not an error.

## Rules

- Biome only, tabs width 4, TypeScript, Bun over npm, `cac` the only runtime
  dependency. Imports: `~/` outside the file's own directory, `./` for siblings.
- `tsconfig.json` `paths` has `~/*` with **no `baseUrl`**. Bun honours it at
  runtime and in tests, so there is no build step.
- Tests must not touch the network: unit tests build fixtures, and any live
  `mpc`/`cmduse` call is exercised by hand, not in `bun test`.
- Size limits: aim ~100 lines per file, hard cap 150; at most 6 entries per
  directory. Check with `wc -l $(rg --files -g '*.ts' src test)` and a per-dir
  count. `test/` is split into `cli/`, `measure/`, `market/`, `view/` for this.
- No re-export-only barrels. Import the module that owns the code.

## Traps (each of these was a real bug)

- **cac prints `--help`/`--version` but does not exit.** It sets an internal
  `run = false`, which is already false for us, so the report printed *after* the
  help text (155 lines instead of 39). The parsed bag carries `help: true` /
  `version: true`; `answeredByCac` reports it and `run()` returns before doing any
  work. mpc has the same flaw — it prints the version and then dies on a stray
  `--v` from its own validator — so match the fix here, not its behaviour.
- **`mri` coerces values.** A numeric-looking string becomes a number, `""`
  becomes `0` (so `--keywords ""` arrives as `0`, not `""`), and a valueless flag
  arrives as `true`. Every string option is read through `str()` in `flags.ts`,
  and `number()` refuses a boolean rather than quietly counting it as 1.
- **cac leaves a digit-dash flag hyphenated.** `--cap-5h` arrives as the key
  `"cap-5h"`, not `cap5h`, so it can never be read under the camelCase name — the
  flag existed, parsed, and did nothing. Caps are `--five-hour` / `--weekly`,
  and `test/cli/parse.test.ts` asserts that every declared flag reaches its
  option.
- **cac negates a declared flag itself.** Declaring `--no-color` *and* reading
  `color === false` made the declaration win, giving `color` a default of `true`
  and failing validation. Declare `--color` only; `--no-color` arrives as `false`.
- **Session metadata lives in two tables.** v2 writes `session_v2` (typed rows)
  while the legacy `session` still holds older ones; joining only `session` lost
  the current session entirely, so `--project` matched nothing. Both are read,
  v2 winning, and `session_message` has no orphans across the two.
- **A completed turn carries `cost` and `tokens`; an in-flight one does not.**
  Both v1 and v2 look empty if you sample mid-stream. Turns without `tokens` are
  skipped, never counted as a zero-token request.
- **`cacheRead: null` and `cacheRead: 0` are different.** Null means the model
  publishes no cache rate (bill the context at input rates, flag the row);
  zero means cached reads are stated free. Conflating them either fabricates a
  cost or hides one.
- **Reasoning tokens bill as output** on every provider, so they join the output
  term in `project()`. But `tokens.output` and `tokens.reasoning` in opencode's
  store are *separate* counters, not a subset — a real row read `output 14,
  reasoning 38` — so never fold one into the other while measuring, and never
  bill it twice. Both tools now add it exactly once: `project()` here, and
  mpc's `costPerRequest` since the per-side workload landed, each reproducing
  the store's own priced `cost` for a GLM-5.3 turn (0.01242668).
- **`requestsPerMonth` is `Infinity` for a free model** — JSON has no infinity,
  so it serialises to `null`. That means *unbounded*, not unknown, as the README
  says. Keep them out of comparisons: `sortProjections` compares explicitly
  because `Infinity - Infinity` is `NaN` and would leave the order undefined.
- **A weighted average is two different numbers here.** Do not "fix" the
  per-req mean by silently switching to per-session; both are printed and
  `--weight` picks, because they disagree by 4x and the user should see why.

- **Only a `user` row opens an ask; interjections continue it.** `synthetic` / `system` /
  `compaction` / `shell` rows used to be boundaries too, so a system-reminder that lands after the
  prompt and before its answer made the answer's reqs a `system` ask — which `filterAsks` then
  discarded whole. They now attach to the ask they interrupted. `orphan` still catches reqs before
  any user prompt. (The `AskKind` union keeps the old names for typing, but `buildAsks` no longer
  emits them.)
- **A legacy store's `providerID` is real.** `readLegacy` hardcoded `provider: ""`, so a
  `message`-only store produced no `sides` and the whole PER SIDE section vanished — but
  `message.data` carries `providerID` just like v2's `model.providerID`.
- **`customOf` watches every custom-model flag.** `--five-hour` / `--weekly` / `--label` on their
  own used to be ignored (`custom: null`, no error) because only the rate/budget flags set
  `touched`; now a lone one demands the rates + `--budget` like any other custom run.
- **The MODELS line's "…N more" needs the true total.** `modelsOf` caps the display list at 8;
  `Shape.modelTotal` carries the count before the cap, so the suffix is not the constant
  `capped - 6`.

## Not in scope

- Registering providers or inventing plans — rates come from `mpc`, which reads
  the real docs.
- Caching `mpc --json`. A run costs ~20 seconds of network; the tool is meant to
  be run when you are deciding something, not continuously.
