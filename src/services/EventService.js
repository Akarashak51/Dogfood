const { randomUUID } = require("node:crypto");
const { DomainError } = require("../errors/DomainError");

class EventService {
  constructor({ event, track, project, judge }) {
    this.event = event;
    this.tracks = track;
    this.projects = project;
    this.judges = judge;
  }

  details() {
    return { event: this.event.get(), tracks: this.tracks.list() };
  }

  configure(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new DomainError("event details are required", 400);
    const current = this.event.get() || {};
    const name = String(input.name === undefined ? current.name || "" : input.name).trim();
    if (!name || name.length > 120) throw new DomainError("event name is required and limited to 120 characters", 400);
    const next = { ...current, id: current.id || `evt_${randomUUID()}`, name };
    for (const key of ["starts_at", "submissions_close", "voting_open", "voting_close", "results_publish_at"]) {
      if (input[key] === undefined) continue;
      next[key] = parseDate(input[key], key);
    }
    if (next.voting_open && next.voting_close && next.voting_close < next.voting_open) {
      throw new DomainError("voting_close must be later than voting_open", 400);
    }
    const votingAccess = input.voting_access === undefined ? next.voting_access : input.voting_access;
    if (votingAccess !== undefined && !["open", "email", "authenticated"].includes(votingAccess)) {
      throw new DomainError("voting_access must be open, email, or authenticated", 400);
    }
    if (input.voting_access !== undefined) next.voting_access = votingAccess;
    if (input.prizes !== undefined) {
      if (!Array.isArray(input.prizes) || input.prizes.length > 30) throw new DomainError("prizes must be an array of at most 30 entries", 400);
      next.prizes = input.prizes.map((prize) => {
        if (typeof prize === "string" && prize.trim()) return prize.trim().slice(0, 160);
        if (prize && typeof prize === "object" && String(prize.name || "").trim()) {
          return { name: String(prize.name).trim().slice(0, 160), description: String(prize.description || "").slice(0, 500) };
        }
        throw new DomainError("each prize needs a name", 400);
      });
    }
    if (input.tracks !== undefined) this.#configureTracks(input.tracks);
    this.event.set(next);
    return this.details();
  }

  #configureTracks(tracks) {
    if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > 30) {
      throw new DomainError("provide between 1 and 30 tracks", 400);
    }
    const normalized = tracks.map((track) => {
      const name = String(track && track.name || "").trim();
      const id = track && track.id ? String(track.id) : `trk_${randomUUID()}`;
      if (!name || name.length > 80) throw new DomainError("track names are required and limited to 80 characters", 400);
      return { id, name };
    });
    if (new Set(normalized.map((track) => track.id)).size !== normalized.length) throw new DomainError("track ids must be unique", 400);
    const keep = new Set(normalized.map((track) => track.id));
    for (const track of this.tracks.list()) {
      if (keep.has(track.id)) continue;
      if (this.projects.list().some((project) => project.track === track.id) ||
          this.judges.list().some((judge) => (judge.tracks || []).includes(track.id))) {
        throw new DomainError(`track ${track.id} is still assigned`, 409);
      }
      this.tracks.delete(track.id);
    }
    normalized.forEach((track) => this.tracks.add(track));
  }
}

function parseDate(value, field) {
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new DomainError(`${field} must be a valid date`, 400);
  return date.toISOString();
}

module.exports = { EventService };