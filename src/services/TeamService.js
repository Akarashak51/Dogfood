const { randomUUID } = require("node:crypto");
const { DomainError } = require("../errors/DomainError");

class TeamService {
  constructor({ team, invite, event }) {
    this.teams = team;
    this.invites = invite;
    this.event = event;
  }

  createTeam(name, email) {
    if (this.event.isClosed()) throw new DomainError("team registration is closed", 403);
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !String(name || "").trim()) throw new DomainError("team name and valid email are required", 400);
    if (String(name).trim().length > 80) throw new DomainError("team name must be 80 characters or fewer", 400);
    if (this.findTeamByEmail(normalizedEmail)) throw new DomainError("this email already belongs to a team", 409);
    const team = this.teams.add({
      id: `tm_${randomUUID()}`,
      name: String(name).trim(),
      members: [normalizedEmail],
      created_at: new Date().toISOString(),
    });
    return team;
  }

  createInvite(teamId, email) {
    const team = this.teams.get(teamId);
    if (!team) throw new DomainError("no such team", 404);
    const normalizedEmail = email ? normalizeEmail(email) : null;
    if (email && !normalizedEmail) throw new DomainError("invite email is invalid", 400);
    if (normalizedEmail && this.findTeamByEmail(normalizedEmail)) {
      throw new DomainError("this email already belongs to a team", 409);
    }
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.invites.add({ id: token, token, team: teamId, email: normalizedEmail, expires_at: expiresAt });
    return { token, team: team.name, expires_at: expiresAt };
  }

  inviteFor(token) {
    const invite = this.invites.get(token);
    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) return null;
    return invite;
  }

  acceptInvite(token, email) {
    const invite = this.inviteFor(token);
    if (!invite) throw new DomainError("invite is invalid, expired, or already used", 404);
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new DomainError("valid email is required", 400);
    if (invite.email && invite.email !== normalizedEmail) throw new DomainError("invite was issued to another email", 403);
    if (this.findTeamByEmail(normalizedEmail)) throw new DomainError("this email already belongs to a team", 409);
    const team = this.teams.get(invite.team);
    if (!team) throw new DomainError("team no longer exists", 404);
    this.teams.add({ ...team, members: [...team.members, normalizedEmail] });
    this.invites.add({ ...invite, accepted_at: new Date().toISOString() });
    return { team, email: normalizedEmail };
  }

  findTeamByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return this.teams.list().find((team) => (team.members || []).some((member) => normalizeEmail(member) === normalizedEmail)) || null;
  }
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

module.exports = { TeamService };