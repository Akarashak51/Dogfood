const { InMemoryRepository } = require("./repositories/InMemoryRepository");
const { EventRepository } = require("./repositories/EventRepository");
const { JudgeRepository } = require("./repositories/JudgeRepository");
const { ScoreRepository } = require("./repositories/ScoreRepository");
const { CommentRepository } = require("./repositories/CommentRepository");
const { VoteRepository } = require("./repositories/VoteRepository");

const { GalleryService } = require("./services/GalleryService");
const { SubmissionService } = require("./services/SubmissionService");
const { JudgingService } = require("./services/JudgingService");
const { ExportService } = require("./services/ExportService");
const { CommunityService } = require("./services/CommunityService");
const { StretchService } = require("./services/StretchService");
const { TeamService } = require("./services/TeamService");
const { EventService } = require("./services/EventService");

/**
 * The single place that knows every concrete class in the app and
 * wires them together. Every repository is constructed exactly once
 * here and injected into whichever services need it; controllers, in
 * turn, receive only `services` (see server.js). Nothing outside this
 * file ever does `new SomeRepository()` or `new SomeService()` —
 * that's the Dependency Inversion payoff: swap an in-memory repository
 * for a database-backed one here, and no controller or service file
 * changes at all.
 *
 * @complexity O(1) — a fixed, small number of object constructions,
 *   independent of fixture size.
 */
function createContainer() {
  const repositories = {
    event: new EventRepository(),
    track: new InMemoryRepository(),
    judge: new JudgeRepository(),
    team: new InMemoryRepository(),
    project: new InMemoryRepository(),
    score: new ScoreRepository(),
    comment: new CommentRepository(),
    vote: new VoteRepository(),
    webhook: new InMemoryRepository(),
    webhookDelivery: new InMemoryRepository(),
    assignment: new InMemoryRepository(),
    audit: new InMemoryRepository(),
    invite: new InMemoryRepository(),
    judgeInvite: new InMemoryRepository(),
  };

  const services = {
    gallery: new GalleryService(repositories),
    submission: new SubmissionService(repositories),
    judging: new JudgingService(repositories),
    export: new ExportService(repositories),
    community: new CommunityService(repositories),
    stretch: new StretchService(repositories),
    teamManagement: new TeamService(repositories),
    eventManagement: new EventService(repositories),
  };

  return { repositories, services };
}

module.exports = { createContainer };
