const t0 = Date.now()
const ms = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

export const log = {
  step: (m: string) => console.log(`\n\x1b[1m▸ ${m}\x1b[0m`),
  info: (m: string) => console.log(`  ${m}`),
  ok: (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
  warn: (m: string) => console.log(`  \x1b[33m!\x1b[0m ${m}`),
  fail: (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`),
  done: (m: string) => console.log(`  \x1b[2m${m} (${ms()})\x1b[0m`),
}

/** Fail the build loudly. Data errors must never ship silently. */
export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    log.fail(message)
    process.exit(1)
  }
}
