# site-generator-speed-01-run-20261122

[![make.fun · site-generator-speed-01-run-20261122](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

High-speed drop-in replacement for `makefun-site 1.0.0` built for the [make.fun](https://make.fun/bounty/site-generator-speed-01-run-20261122) `Build a static site faster, 22 November 2026` bounty.

## Architecture
- `main.ts` -> `r.js`: 17-byte CJS lean-start wrapper with Liftoff-only / zero-background-thread V8 flags.
- `sg.wasm`: End-to-end JSON-to-JSON C-to-WASM `v128` SIMD engine (Markdown lexer/inline, AST template renderer with site-level partial & post-card caching, direct 512 KiB streaming JSON output).
- `solve.js`: Dependency-free ES module drop-in & fallback.

## Run
Run with `node main.ts`.
