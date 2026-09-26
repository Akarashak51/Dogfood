const { DomainError } = require("../errors/DomainError");
const { createHash } = require("node:crypto");

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
  *           comment: import('../repositories/CommentRepository').CommentRepository,
  *           event: import('../repositories/EventRepository').EventRepository,
  *           audit: import('../repositories/InMemoryRepository').InMemoryRepository}} repositories
   */
  constructor({ project, vote, comment, event, audit }) {
    this.projects = project;
    this.votes = vote;
    this.comments = comment;
    this.event = event;
    this.audit = audit;
    this.rateWindows = new Map();
  }

  /**
   * @param {string} projectId @param {string} voterIdentifier best-effort (IP), see README limitations.
   * @throws {DomainError} 404 if the project doesn't exist.
   * @complexity O(1).
   */
  castVote(projectId, voterIdentifier, authenticated = false) {
    if (!this.projects.has(projectId)) throw new DomainError("no such project", 404);
    if (!voterIdentifier) throw new DomainError("voter identity is required", 400);
    const access = this.votingAccess();
    if (access === "authenticated" && !authenticated) throw new DomainError("sign in to vote", 401);
    if (access === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voterIdentifier)) {
      throw new DomainError("a valid email address is required to vote", 400);
    }
    this.#consumeRateLimit(`vote:${voterIdentifier}`, 12);
    const voterHash = createHash("sha256").update(voterIdentifier).digest("hex");
    if (this.votes.byProject(projectId).some((vote) => vote.voter === voterHash)) {
      throw new DomainError("you have already voted for this project", 409);
    }
    const vote = this.votes.add({
      id: `vt_${this.votes.size}`,
      project: projectId,
      voter: voterHash,
      created_at: new Date().toISOString(),
    });
    this.#recordAudit("vote.cast", { project: projectId, voter: this.#fingerprint(voterIdentifier) });
    return vote;
  }

  /**
   * @param {string} projectId @param {string} author @param {string} text
   * @throws {DomainError} 404 if the project doesn't exist; 400 if the comment is empty.
   * @complexity O(1).
   */
  addComment(projectId, author, text, requester = "anonymous") {
    if (!this.projects.has(projectId)) throw new DomainError("no such project", 404);
    this.#consumeRateLimit(`comment:${requester}`, 8);
    const trimmedText = (text || "").trim();
    if (!trimmedText) throw new DomainError("comment text is required", 400);

    const comment = this.comments.add({
      id: `cm_${this.comments.size}`,
      project: projectId,
      author: (author || "Anonymous").slice(0, 80),
      text: trimmedText.slice(0, 2000),
      created_at: new Date().toISOString(),
    });
    this.#recordAudit("comment.created", { project: projectId, comment: comment.id, requester: this.#fingerprint(requester) });
    return comment;
  }

  votingAccess() {
    return (this.event && this.event.get() && this.event.get().voting_access) || "open";
  }

  #consumeRateLimit(key, limit) {
    const now = Date.now();
    const recent = (this.rateWindows.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
    if (recent.length >= limit) throw new DomainError("too many requests; try again in a minute", 429);
    recent.push(now);
    this.rateWindows.set(key, recent);
  }

  #fingerprint(value) {
    return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
  }

  #recordAudit(action, details) {
    if (!this.audit) return;
    this.audit.add({ id: `au_${this.audit.size}`, action, details, created_at: new Date().toISOString() });
  }
}

module.exports = { CommunityService };
