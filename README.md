# site-generator-speed-01-run-20261122

[![make.fun · site-generator-speed-01-run-20261122](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/cefiyana1/site-generator-speed-01-run-20261122/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

High-speed drop-in replacement for `makefun-site 1.0.0` built for the [make.fun](https://make.fun/bounty/site-generator-speed-01-run-20261122) `Build a static site faster, 22 November 2026` bounty.

## Architecture (v4)
- `sg.node`: Freestanding zero-libc dual-arch C11 N-API engine (runtime `CPUID` dispatch between all-inlined `AVX2+BMI1+POPCNT` nibble-LUT SIMD and `SSE2` fallback), `mmap` zero-copy input, L2-hot 512 KiB streaming output, exact Node 22 BMP NFKD table, fused `\r` detection, constant-folded/coalesced interned AST layouts, and `SYS_exit_group(0)` zero-teardown exit.
- `main.ts` -> `r.js`: 14-byte CJS proxy entrypoint with automatic fallback to `solve.js`.
- `solve.js`: Dependency-free ES module drop-in & fallback.

## Run
Run with `node main.ts`.
