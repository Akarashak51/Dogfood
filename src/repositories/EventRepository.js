/**
 * Holds the single fixture `event` and answers the one question every
 * other layer needs about it: is it closed. Kept separate from a
 * generic InMemoryRepository because an event isn't a collection —
 * there's exactly one per portal instance (Single Responsibility: this
 * class's only job is "what does the event say, and is it closed").
 *
 * @complexity set/get/isClosed: O(1) time, O(1) space.
 */
class EventRepository {
  #event = null;

  /** @param {object} event raw event object from fixtures.json */
  set(event) {
    this.#event = event;
  }

  get() {
    return this.#event;
  }

  /** @param {Date} [now] injectable for tests; defaults to real time. */
  isClosed(now = new Date()) {
    if (!this.#event || !this.#event.submissions_close) return false;
    return new Date(this.#event.submissions_close).getTime() < now.getTime();
  }

  resultsAreVisible(now = new Date()) {
    if (!this.#event) return false;
    const releaseAt = this.#event.results_publish_at || this.#event.voting_close;
    return Boolean(releaseAt && new Date(releaseAt).getTime() <= now.getTime());
  }
}

module.exports = { EventRepository };
