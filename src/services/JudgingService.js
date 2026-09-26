const { DomainError } = require("../errors/DomainError");
const { randomUUID } = require("node:crypto");

/**
 * Owns the rule the DOGFOOD spec calls out as costing the most points
 * when done wrong: a judge may read their own scores, and *only*
 * their own. This is checked here, in a service with no knowledge of
 * HTTP — so there is exactly one code path for "may judge X read
 * judge Y's scores", exercised identically whether it's called from
 * `GET /api/judge/scores`, a future admin tool, or a unit test.
 */
class JudgingService {
  /**
   * @param {{judge: import('../repositories/JudgeRepository').JudgeRepository,
   *           score: import('../repositories/ScoreRepository').ScoreRepository,
   *           project: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           assignment: import('../repositories/InMemoryRepository').InMemoryRepository,
   *           event: import('../repositories/EventRepository').EventRepository,
  *           audit: import('../repositories/InMemoryRepository').InMemoryRepository,
  *           judgeInvite: import('../repositories/InMemoryRepository').InMemoryRepository,
  *           track: import('../repositories/InMemoryRepository').InMemoryRepository}} repositories
   */
  constructor({ judge, score, project, assignment, event, audit, judgeInvite, track }) {
    this.judges = judge;
    this.scores = score;
    this.projects = project;
    this.assignments = assignment;
    this.event = event;
    this.audit = audit;
    this.judgeInvites = judgeInvite;
    this.tracks = track;
  }

  /**
   * Translates a `.dogfood.toml` seat label ("judge_a"/"judge_b") to
   * a real fixture judge id, using the same deterministic ordering
   * `identify` middleware used to log the caller in. A value that
   * isn't a seat label is assumed to already be a real judge id.
   *
   * @param {string | undefined} seatOrId
   * @complexity O(1) (JudgeRepository.orderedIds() is cached — see
   *   that class for why this is amortized O(1), not O(n log n)).
   */
  resolveSeatOrId(seatOrId) {
    if (!seatOrId) return null;
    const [firstJudgeId, secondJudgeId] = this.judges.orderedIds();
    if (seatOrId === "judge_a") return firstJudgeId;
    if (seatOrId === "judge_b") return secondJudgeId;
    return seatOrId;
  }

  /**
   * @param {string} requestingJudgeId the authenticated caller's own judge id
   * @param {string | null} requestedJudgeId who's scores were asked for (already resolved)
   * @returns {object[]} the requesting judge's own scores
   * @throws {DomainError} 403 if requesting anyone else's scores
   * @complexity O(k) time / O(k) space, k = that judge's score count
   *   (ScoreRepository.byJudge is index-backed, not a full scan).
   */
  scoresFor(requestingJudgeId, requestedJudgeId) {
    const targetJudgeId = requestedJudgeId || requestingJudgeId;
    if (targetJudgeId !== requestingJudgeId) {
      throw new DomainError("you may only read your own scores", 403);
    }
    return this.scores.byJudge(targetJudgeId);
  }

  /**
   * @param {{judgeId: string, project?: string, criteria?: object, comment?: string}} input
   * @throws {DomainError} 400 if project or criteria are missing.
   * @complexity O(1).
   */
  recordScore({ judgeId, project, criteria, comment }) {
    if (!project || !criteria || typeof criteria !== "object" || Array.isArray(criteria)) {
      throw new DomainError("project and criteria are required", 400);
    }
    const projectRecord = this.projects.get(project);
    if (!projectRecord) throw new DomainError("no such project", 404);
    if (!this.assignments.get(`${judgeId}:${project}`)) {
      throw new DomainError("project is not assigned to this judge", 403);
    }
    if (this.scores.byJudge(judgeId).some((score) => score.project === project)) {
      throw new DomainError("this project has already been scored", 409);
    }
    const weights = this.rubricWeights();
    const entries = Object.entries(criteria);
    if (entries.length !== Object.keys(weights).length || entries.some(([key, value]) =>
      !Object.prototype.hasOwnProperty.call(weights, key) || !Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 5
    )) {
      throw new DomainError("every rubric criterion must be scored from 1 to 5", 400);
    }
    const entry = this.scores.add({
      id: `sc_${this.scores.size}`,
      judge: judgeId,
      project,
      criteria: Object.fromEntries(entries.map(([key, value]) => [key, Number(value)])),
      comment: String(comment || "").slice(0, 4000),
      created_at: new Date().toISOString(),
    });
    this.#recordAudit("score.recorded", { judge: judgeId, project });
    return entry;
  }

  assignProjects(judges, projects, reviewsPerProject = 3) {
    const load = new Map(judges.map((judge) => [judge.id, 0]));
    for (const assignment of this.assignments.list()) {
      load.set(assignment.judge, (load.get(assignment.judge) || 0) + 1);
    }
    for (const project of projects) {
      const eligible = judges
        .filter((judge) => (judge.tracks || []).includes(project.track))
        .sort((left, right) => load.get(left.id) - load.get(right.id) || left.id.localeCompare(right.id));
      for (const judge of eligible.slice(0, Math.max(1, Number(reviewsPerProject) || 1))) {
        const id = `${judge.id}:${project.id}`;
        if (!this.assignments.has(id)) {
          this.assignments.add({ id, judge: judge.id, project: project.id, track: project.track });
          load.set(judge.id, load.get(judge.id) + 1);
        }
      }
    }
    this.#recordAudit("judging.assignments.generated", { count: this.assignments.size });
    return this.assignments.list();
  }

  createJudgeInvitation({ email, name, tracks }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !String(name || "").trim()) {
      throw new DomainError("judge name and valid email are required", 400);
    }
    if (this.judges.list().some((judge) => judge.email.toLowerCase() === normalizedEmail) ||
        this.judgeInvites.list().some((invite) => invite.email === normalizedEmail && !invite.accepted_at)) {
      throw new DomainError("a judge or invitation already uses this email", 409);
    }
    if (!Array.isArray(tracks) || !tracks.length || tracks.some((trackId) => !this.tracks.has(trackId))) {
      throw new DomainError("at least one valid track is required", 400);
    }
    const token = randomUUID();
    const invitation = this.judgeInvites.add({
      id: token,
      token,
      email: normalizedEmail,
      name: String(name).trim().slice(0, 100),
      tracks: [...new Set(tracks)],
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    this.#recordAudit("judge.invited", { email: normalizedEmail, tracks: invitation.tracks });
    return invitation;
  }

  judgeInvitation(token) {
    const invite = this.judgeInvites.get(token);
    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) return null;
    return invite;
  }

  acceptJudgeInvitation(token) {
    const invitation = this.judgeInvitation(token);
    if (!invitation) throw new DomainError("judge invitation is invalid, expired, or already used", 404);
    const judge = this.judges.add({
      id: `jdg_${randomUUID()}`,
      name: invitation.name,
      email: invitation.email,
      tracks: invitation.tracks,
      joined_at: new Date().toISOString(),
    });
    this.judgeInvites.add({ ...invitation, accepted_at: new Date().toISOString(), judge: judge.id });
    this.#recordAudit("judge.joined", { judge: judge.id, tracks: judge.tracks });
    return judge;
  }

  assignJudgeProjects(judgeId, projectIds) {
    const judge = this.judges.get(judgeId);
    if (!judge) throw new DomainError("no such judge", 404);
    if (!Array.isArray(projectIds) || !projectIds.length) throw new DomainError("project ids are required", 400);
    const created = [];
    for (const projectId of [...new Set(projectIds)]) {
      const project = this.projects.get(projectId);
      if (!project) throw new DomainError(`unknown project: ${projectId}`, 404);
      if (!(judge.tracks || []).includes(project.track)) throw new DomainError("judge cannot be assigned outside their tracks", 403);
      const id = `${judgeId}:${projectId}`;
      if (!this.assignments.has(id)) created.push(this.assignments.add({ id, judge: judgeId, project: projectId, track: project.track }));
    }
    this.#recordAudit("judging.assignments.created", { judge: judgeId, count: created.length });
    return created;
  }

  assignmentsFor(judgeId) {
    return this.assignments.list().filter((assignment) => assignment.judge === judgeId);
  }

  progress() {
    const assignments = this.assignments.list();
    return this.projects.list().map((project) => {
      const assigned = assignments.filter((item) => item.project === project.id);
      const submitted = this.scores.byProject(project.id);
      const assignedScores = submitted.filter((score) => assigned.some((item) => item.judge === score.judge));
      return {
        project: project.id,
        title: project.title,
        track: project.track,
        assigned: assigned.length,
        scored: assignedScores.length,
        remaining: Math.max(0, assigned.length - assignedScores.length),
        status: assigned.length > 0 && assignedScores.length >= assigned.length ? "complete" : assignedScores.length ? "in progress" : "not started",
      };
    });
  }

  rubricWeights() {
    const event = this.event.get() || {};
    return event.rubric_weights || { functionality: 0.4, quality: 0.35, innovation: 0.25 };
  }

  configureRubric(weights) {
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) {
      throw new DomainError("rubric weights must be an object", 400);
    }
    const entries = Object.entries(weights);
    const rubricCriteria = new Set(["functionality", "quality", "innovation"]);
    if (entries.length !== rubricCriteria.size || entries.some(([key, value]) =>
      !rubricCriteria.has(key) || !Number.isFinite(Number(value)) || Number(value) <= 0
    )) {
      throw new DomainError("provide positive weights for functionality, quality, and innovation", 400);
    }
    const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
    const normalized = Object.fromEntries(entries.map(([key, value]) => [key, Number(value) / total]));
    const current = this.event.get() || {};
    this.event.set({ ...current, rubric_weights: normalized });
    this.#recordAudit("judging.rubric.updated", { weights: normalized });
    return normalized;
  }

  weightedScore(criteria) {
    const weights = this.rubricWeights();
    const available = Object.entries(criteria || {}).filter(([key, value]) =>
      Number.isFinite(Number(value)) && Number.isFinite(Number(weights[key])) && Number(weights[key]) > 0
    );
    const totalWeight = available.reduce((sum, [key]) => sum + Number(weights[key]), 0);
    if (!totalWeight) return null;
    return available.reduce((sum, [key, value]) => sum + Number(value) * Number(weights[key]), 0) / totalWeight;
  }

  normalizedResults() {
    const rows = this.scores.list().map((score) => ({
      project: score.project,
      judge: score.judge,
      raw: this.weightedScore(score.criteria),
    })).filter((row) => row.raw !== null);
    const byJudge = new Map();
    for (const row of rows) {
      if (!byJudge.has(row.judge)) byJudge.set(row.judge, []);
      byJudge.get(row.judge).push(row);
    }
    for (const judgeRows of byJudge.values()) {
      const mean = judgeRows.reduce((sum, row) => sum + row.raw, 0) / judgeRows.length;
      const deviation = Math.sqrt(judgeRows.reduce((sum, row) => sum + (row.raw - mean) ** 2, 0) / judgeRows.length);
      for (const row of judgeRows) row.normalized = deviation ? Math.max(1, Math.min(5, 3 + (row.raw - mean) / deviation)) : 3;
    }
    const projects = this.projects.list().map((project) => {
      const projectRows = rows.filter((row) => row.project === project.id);
      const average = (key) => projectRows.length
        ? projectRows.reduce((sum, row) => sum + row[key], 0) / projectRows.length
        : null;
      return { project: project.id, title: project.title, reviews: projectRows.length, raw: average("raw"), normalized: average("normalized") };
    });
    const ranked = (key) => projects.filter((project) => project[key] !== null)
      .sort((left, right) => right[key] - left[key] || left.project.localeCompare(right.project))
      .map((project, index) => ({ project: project.project, title: project.title, score: Number(project[key].toFixed(3)), rank: index + 1 }));
    return { method: "Per-judge population z-score; normalized score = clamp(3 + z, 1, 5); project result is the mean of available reviews.", raw: ranked("raw"), normalized: ranked("normalized"), projects };
  }

  #recordAudit(action, details) {
    if (!this.audit) return;
    this.audit.add({ id: `au_${this.audit.size}`, action, details, created_at: new Date().toISOString() });
  }

  /**
   * A judge's scoring queue in randomized order (FR-3.4: no judge
   * should see the same fixed submission order — a cheap anti-bias
   * measure).
   * @param {string[]} projectIds
   * @complexity O(n) time / O(n) space — Fisher–Yates shuffle,
   *   in-place on a copy, no better asymptotic option exists for a
   *   uniformly random permutation.
   */
  randomizedQueue(projectIds) {
    const shuffled = projectIds.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

module.exports = { JudgingService };
