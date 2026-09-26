/**
 * A business-rule violation (e.g. "submissions are closed", "not your
 * scores to read"). Carries the HTTP status it should map to, so
 * controllers never need to know *why* a service rejected a call —
 * only how to report it.
 */
class DomainError extends Error {
  /**
   * @param {string} message
   * @param {number} status HTTP status code this error maps to.
   */
  constructor(message, status = 400) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }
}

module.exports = { DomainError };
