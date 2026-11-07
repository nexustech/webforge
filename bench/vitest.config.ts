import { defineConfig } from "vitest/config";

// The benchmarks (5.1, standards §5): `pnpm bench` from the repository root. One file at a time,
// so the machine's cores don't share out between them and skew the timings, and long enough for a
// full export's iterations.
export default defineConfig({
  test: {
    benchmark: { include: ["src/**/*.bench.ts"] },
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 120_000,
  },
});
