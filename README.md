# site-generator-speed-01-run-20261122

[![make.fun · site-generator-speed-01-run-20261122](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

High-speed drop-in replacement for `makefun-site 1.0.0` built for the [make.fun](https://make.fun/bounty/site-generator-speed-01-run-20261122) `Build a static site faster, 22 November 2026` bounty.

## Architecture (v2)
- `sg.node`: Freestanding zero-libc C11 + SSE2 N-API engine using direct Linux syscalls (`openat`/`read`/`write`/`mmap`), exact BMP NFKD lookup table, interned template symbol IDs (zero `memcmp` in render), site-level partial & post-card memoization, and single-slab JSON output.
- `main.ts`: Zero-ESM CJS entrypoint invoking `sg.node` directly with automatic fallback to `solve.js`.
- `solve.js`: Dependency-free ES module drop-in & fallback.

## Run
Run with `node main.ts`.
