/**
 * Scores are looked up by judge (every T2 "own scores" / "peer scores"
 * request) and by project (CSV export, project detail page) far more
 * often than by their own id. A flat array + `.filter()` would be
 * O(n) per lookup regardless of how few scores match; at hackathon
 * scale (tens to low hundreds of scores) that's not slow, but it's
 * also not the right shape to reach for by habit, so this maintains
 * two secondary Maps<key, Set<scoreId>> alongside the primary store —
 * standard "make the read path output-sensitive" indexing.
 *
 * @complexity
 *   add(score):        O(1) average time, O(1) additional space
 *                       (one entry in three maps).
 *   get(id):            O(1) average time.
 *   list():              O(n) time / O(n) space (n = total scores).
 *   byJudge(judgeId):    O(k) time / O(k) space, k = that judge's
 *                        score count (must materialize k objects —
 *                        optimal, not improvable below O(k)).
 *   byProject(projectId): O(k) time / O(k) space, same reasoning.
 */
class ScoreRepository {
  #byId = new Map();
  #idsByJudge = new Map(); // judgeId -> Set<scoreId>
  #idsByProject = new Map(); // projectId -> Set<scoreId>

  /** @param {{id: string, judge: string, project: string}} score */
  add(score) {
    this.#byId.set(score.id, score);
    this.#indexAppend(this.#idsByJudge, score.judge, score.id);
    this.#indexAppend(this.#idsByProject, score.project, score.id);
    return score;
  }

  /** @param {string} id */
  get(id) {
    return this.#byId.get(id);
  }

  list() {
    return Array.from(this.#byId.values());
  }

  get size() {
    return this.#byId.size;
  }

  /** @param {string} judgeId */
  byJudge(judgeId) {
    return this.#materialize(this.#idsByJudge.get(judgeId));
  }

  /** @param {string} projectId */
  byProject(projectId) {
    return this.#materialize(this.#idsByProject.get(projectId));
  }

  /** @param {Map<string, Set<string>>} index @param {string} key @param {string} id */
  #indexAppend(index, key, id) {
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(id);
  }

  /** @param {Set<string> | undefined} ids */
  #materialize(ids) {
    if (!ids) return [];
    return Array.from(ids, (id) => this.#byId.get(id));
  }
}

module.exports = { ScoreRepository };
