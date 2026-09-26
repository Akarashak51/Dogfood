/**
 * Read-side rules for the public gallery: list projects, and assemble
 * a single project's detail view — including the "results are hidden
 * until the event closes" rule (FR-3.3 in SRS.md). Depends only on
 * repository interfaces, injected via the constructor, so this class
 * never needs to know whether data comes from memory or (later) a
 * real database (Dependency Inversion).
 */
class GalleryService {
  /**
   * @param {{project: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           team: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           score: import('../repositories/ScoreRepository').ScoreRepository,
   *           comment: import('../repositories/CommentRepository').CommentRepository,
   *           vote: import('../repositories/VoteRepository').VoteRepository,
   *           event: import('../repositories/EventRepository').EventRepository}} repositories
   */
  constructor({ project, team, score, comment, vote, event }) {
    this.projects = project;
    this.teams = team;
    this.scores = score;
    this.comments = comment;
    this.votes = vote;
    this.event = event;
  }

  /** @complexity O(n) time / O(n) space, n = project count. */
  listProjects() {
    return this.projects.list();
  }

  /** @param {string} teamId @complexity O(1). */
  teamName(teamId) {
    const team = this.teams.get(teamId);
    return team ? team.name : teamId;
  }

  /**
   * @param {string} projectId
   * @returns {null | {project: object, comments: object[], voteCount: number,
   *                    resultsVisible: boolean, scores: object[]}}
   * @complexity O(k) time / O(k) space, k = comments + votes + scores
   *   for this one project (each lookup is index-backed — see the
   *   respective repositories — never a full scan of all projects).
   */
  getProjectDetail(projectId) {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const resultsVisible = this.event.isClosed();

    return {
      project,
      comments: this.comments.byProject(projectId),
      voteCount: this.votes.byProject(projectId).length,
      resultsVisible,
      scores: resultsVisible ? this.scores.byProject(projectId) : [],
    };
  }
}

module.exports = { GalleryService };
