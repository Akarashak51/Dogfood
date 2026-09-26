/**
 * A minimal id-keyed collection backed by a Map. Every entity
 * repository that needs nothing fancier than "store it, fetch it by
 * id, list them all" extends or wraps this instead of re-implementing
 * the same three methods.
 *
 * Swapping this for a real database later means writing a class with
 * the same four methods backed by SQL instead of a Map — nothing
 * calling a repository needs to change (Open/Closed: this class is
 * closed for modification, but the app is open to a different
 * repository implementation via the same shape).
 *
 * @complexity
 *   add(item):    O(1) average time, O(1) additional space per item.
 *   get(id):      O(1) average time.
 *   has(id):      O(1) average time.
 *   list():       O(n) time, O(n) space (must materialize every item —
 *                 this is output-sensitive, not avoidable if the
 *                 caller genuinely needs all n items).
 *   size:         O(1) time.
 */
class InMemoryRepository {
  #itemsById = new Map();

  /** @param {{id: string}} item */
  add(item) {
    this.#itemsById.set(item.id, item);
    return item;
  }

  /** @param {string} id */
  get(id) {
    return this.#itemsById.get(id);
  }

  /** @param {string} id */
  has(id) {
    return this.#itemsById.has(id);
  }

  /** @param {string} id */
  delete(id) {
    return this.#itemsById.delete(id);
  }

  list() {
    return Array.from(this.#itemsById.values());
  }

  get size() {
    return this.#itemsById.size;
  }
}

module.exports = { InMemoryRepository };
