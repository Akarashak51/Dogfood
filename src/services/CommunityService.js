const { DomainError } = require("../errors/DomainError");

/**
 * The public, unauthenticated actions (T3): voting and commenting.
 * Grouped together because both are "anonymous write against an
 * existing project" with the identical existence check, and neither
 * has anything to do with judging or submission rules.
 */
class CommunityService {
  /**
   * @param {{project: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           vote: import('../repositories/VoteRepository').VoteRepository,
   *           comment: import('../repositories/CommentRepository').CommentRepository}} repositories
   */
  constructor({ project, vote, comment }) {
    this.projects = project;
    this.votes = vote;
    this.comments = comment;
  }

  /**
   * @param {string} projectId @param {string} voterIdentifier best-effort (IP), see README limitations.
   * @throws {DomainError} 404 if the project doesn't exist.
   * @complexity O(1).
   */
  castVote(projectId, voterIdentifier) {
    if (!this.projects.has(projectId)) throw new DomainError("no such project", 404);
    if (!voterIdentifier) throw new DomainError("voter identity is required", 400);
    if (this.votes.byProject(projectId).some((vote) => vote.voter === voterIdentifier)) {
      throw new DomainError("you have already voted for this project", 409);
    }
    return this.votes.add({
      id: `vt_${this.votes.size}`,
      project: projectId,
      voter: voterIdentifier,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * @param {string} projectId @param {string} author @param {string} text
   * @throws {DomainError} 404 if the project doesn't exist; 400 if the comment is empty.
   * @complexity O(1).
   */
  addComment(projectId, author, text) {
    if (!this.projects.has(projectId)) throw new DomainError("no such project", 404);
    const trimmedText = (text || "").trim();
    if (!trimmedText) throw new DomainError("comment text is required", 400);

    return this.comments.add({
      id: `cm_${this.comments.size}`,
      project: projectId,
      author: (author || "Anonymous").slice(0, 80),
      text: trimmedText.slice(0, 2000),
      created_at: new Date().toISOString(),
    });
  }
}

module.exports = { CommunityService };
