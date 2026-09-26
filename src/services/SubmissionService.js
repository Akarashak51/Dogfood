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
   *           team: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           track: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           event: import('../repositories/EventRepository').EventRepository}} repositories
   */
  constructor({ project, team, track, event }) {
    this.projects = project;
    this.teams = team;
    this.tracks = track;
    this.event = event;
  }

  /** @complexity O(1). */
  isOpen() {
    return !this.event.isClosed();
  }

  availableTracks() {
    return this.tracks.list();
  }

  projectsForTeam(teamId) {
    return this.projects.list().filter((project) => project.team === teamId);
  }

  trackName(trackId) {
    const track = trackId && this.tracks.get(trackId);
    return track ? track.name : "Open track";
  }

  /**
  * @param {{title?: string, team?: string, track?: string, repo_url?: string, summary?: string}} input
  * @param {string} ownerTeam the authenticated participant's team id
   * @throws {DomainError} 403 if the event is closed; 400 if required fields are missing.
   * @complexity O(1) time / O(1) additional space.
   */
  submit(input, ownerTeam) {
    if (this.event.isClosed()) {
      throw new DomainError("submissions are closed", 403);
    }

    const { title, track, repo_url: repoUrl, summary } = input || {};
    if (!title || !ownerTeam) {
      throw new DomainError("title and participant team are required", 400);
    }
    if (!this.teams.has(ownerTeam)) throw new DomainError("no such team", 404);
    if (track && !this.tracks.has(track)) throw new DomainError("no such track", 400);
    if (String(title).trim().length > 120) throw new DomainError("title must be 120 characters or fewer", 400);
    if (summary && String(summary).length > 2000) throw new DomainError("summary must be 2000 characters or fewer", 400);
    if (repoUrl && !isHttpUrl(repoUrl)) throw new DomainError("repo_url must be a valid http(s) URL", 400);

    return this.projects.add({
      id: `prj_${Date.now()}_${this.projects.size}`,
      team: ownerTeam,
      track: track || null,
      title: String(title).trim(),
      summary: summary || "",
      repo_url: repoUrl || "",
      submitted_at: new Date().toISOString(),
    });
  }

  update(projectId, input, ownerTeam) {
    if (this.event.isClosed()) throw new DomainError("submissions are closed", 403);
    const current = this.projects.get(projectId);
    if (!current) throw new DomainError("no such project", 404);
    if (!ownerTeam || current.team !== ownerTeam) throw new DomainError("you may only edit your team's project", 403);
    const { title, track, repo_url: repoUrl, summary } = input || {};
    if (!title || String(title).trim().length > 120) throw new DomainError("a title of at most 120 characters is required", 400);
    if (track && !this.tracks.has(track)) throw new DomainError("no such track", 400);
    if (summary && String(summary).length > 2000) throw new DomainError("summary must be 2000 characters or fewer", 400);
    if (repoUrl && !isHttpUrl(repoUrl)) throw new DomainError("repo_url must be a valid http(s) URL", 400);
    return this.projects.add({
      ...current,
      title: String(title).trim(),
      track: track || null,
      summary: summary || "",
      repo_url: repoUrl || "",
      updated_at: new Date().toISOString(),
    });
  }
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

module.exports = { SubmissionService };
