const { DomainError } = require("../errors/DomainError");

/**
 * The one rule that matters here (FR-1.4 in SRS.md): once the event's
 * deadline has passed, no new submission is accepted — checked
 * against the fixture's own `submissions_close`, never a value the
 * caller supplies. Kept as its own service (rather than folded into
 * GalleryService) because "can I still submit" and "what does the
 * gallery show" are different responsibilities that happen to share
 * a `project` repository.
 */
class SubmissionService {
  /**
   * @param {{project: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           event: import('../repositories/EventRepository').EventRepository}} repositories
   */
  constructor({ project, event }) {
    this.projects = project;
    this.event = event;
  }

  /** @complexity O(1). */
  isOpen() {
    return !this.event.isClosed();
  }

  /**
   * @param {{title?: string, team?: string, track?: string, repo_url?: string, summary?: string}} input
   * @throws {DomainError} 403 if the event is closed; 400 if required fields are missing.
   * @complexity O(1) time / O(1) additional space.
   */
  submit(input) {
    if (this.event.isClosed()) {
      throw new DomainError("submissions are closed", 403);
    }

    const { title, team, track, repo_url: repoUrl, summary } = input || {};
    if (!title || !team) {
      throw new DomainError("title and team are required", 400);
    }

    return this.projects.add({
      id: `prj_${Date.now()}`,
      team,
      track: track || null,
      title,
      summary: summary || "",
      repo_url: repoUrl || "",
      submitted_at: new Date().toISOString(),
    });
  }
}

module.exports = { SubmissionService };
