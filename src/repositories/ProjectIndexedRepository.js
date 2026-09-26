/**
 * Base for any entity whose only real read pattern is "all of these
 * belonging to project X" (comments, votes). Factored out once both
 * repositories needed the identical id-plus-project-index shape,
 * rather than copy-pasting the same Map<projectId, Set<id>> logic
 * twice — same output-sensitive reasoning as ScoreRepository, applied
 * to a single foreign key instead of two.
 *
 * @complexity
 *   add(entity):       O(1) average time, O(1) additional space.
 *   byProject(id):     O(k) time / O(k) space, k = matching entities.
 *   list():             O(n) time / O(n) space.
 */
class ProjectIndexedRepository {
  #byId = new Map();
  #idsByProject = new Map(); // projectId -> Set<entityId>

  /** @param {{id: string, project: string}} entity */
  add(entity) {
    this.#byId.set(entity.id, entity);
    if (!this.#idsByProject.has(entity.project)) {
      this.#idsByProject.set(entity.project, new Set());
    }
    this.#idsByProject.get(entity.project).add(entity.id);
    return entity;
  }

  list() {
    return Array.from(this.#byId.values());
  }

  get size() {
    return this.#byId.size;
  }

  /** @param {string} projectId */
  byProject(projectId) {
    const ids = this.#idsByProject.get(projectId);
    if (!ids) return [];
    return Array.from(ids, (id) => this.#byId.get(id));
  }
}

module.exports = { ProjectIndexedRepository };
