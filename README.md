# site-generator-speed-01-run-20261122

[![make.fun · site-generator-speed-01-run-20261122](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

High-speed drop-in replacement for `makefun-site 1.0.0` built for the [make.fun](https://make.fun/bounty/site-generator-speed-01-run-20261122) `Build a static site faster, 22 November 2026` bounty.

## Architecture (v6-PGO)
- `sg.node`: Freestanding zero-libc dual-arch C11 N-API engine compiled with GCC PGO (`CPUID` runtime dispatch between all-inlined `AVX2+BMI1+POPCNT` speculative-store SIMD and `SSE2` fallback), Direct N-API CLI via `/proc/self/environ`, `mmap` zero-copy input, L2-hot 512 KiB streaming output & reusable page buffer, zero-copy multi-line paragraphs, fast-path link resolver, site-partial baking + include inlining, exact Node 22 BMP NFKD table, and `SYS_exit_group(0)` zero-teardown exit.
- `main.ts`: 38-byte Direct N-API CLI entrypoint (`require('./sg.node').f&&require('./r')`) with automatic fallback to `r.js` / `solve.js` for supplementary Unicode (> `0xFFFF`).
- `solve.js`: Dependency-free ES module drop-in & fallback.

## Run
Run with `node main.ts`.
