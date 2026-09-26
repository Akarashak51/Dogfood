const { InMemoryRepository } = require("./InMemoryRepository");

/**
 * Judges, plus the one extra thing the auth layer needs from them:
 * a stable, deterministic ordering so ".dogfood.toml"'s seat labels
 * (judge_a, judge_b) can be mapped to real fixture judge ids the same
 * way every time, regardless of what ids the real fixtures.json uses.
 *
 * The sorted id list is cached after the first call and invalidated
 * on `add`, since judges are only ever added during boot seeding —
 * this avoids re-sorting on every single request that needs it
 * (every request from a judge_a/judge_b seat, i.e. most of T2's
 * traffic).
 *
 * @complexity
 *   add(judge):     O(1) average (inherited), plus invalidates the cache.
 *   orderedIds():   O(n log n) once per change (n = judge count, sorts
 *                   the id list), then O(1) for every subsequent call
 *                   until the next `add` — amortized O(1) in practice
 *                   since all judges are added once at boot.
 */
class JudgeRepository extends InMemoryRepository {
  #cachedOrderedIds = null;

  add(judge) {
    this.#cachedOrderedIds = null; // invalidate: membership changed
    return super.add(judge);
  }

  orderedIds() {
    if (!this.#cachedOrderedIds) {
      this.#cachedOrderedIds = this.list()
        .map((judge) => judge.id)
        .sort();
    }
    return this.#cachedOrderedIds;
  }
}

module.exports = { JudgeRepository };
