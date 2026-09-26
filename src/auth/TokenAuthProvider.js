const { randomUUID } = require("node:crypto");

/**
 * Resolves an HTTP `Cookie` header into a role label, given a fixed
 * table of {sessionValue: roleLabel}.
 *
 * This is the one piece of the app that knows *how* a caller proves
 * who they are. Everything downstream (middleware, controllers,
 * services) only ever sees the result — a role label — never a
 * cookie or a token. To support a real login system later (JWT,
 * OAuth, whatever), write a new class with the same `resolve(req)`
 * signature and pass it into `createIdentifyMiddleware` instead;
 * nothing else in the app changes. That substitutability is the
 * Liskov/DIP payoff of keeping this behind a narrow interface.
 *
 * @complexity resolve: O(1) time (single regex + object lookup), O(1) space.
 */
class TokenAuthProvider {
  /** @param {Readonly<Record<string,string>>} tokens sessionValue -> roleLabel */
  constructor(tokens) {
    this.tokens = { ...tokens };
    this.bootstrapSessions = new Set(Object.keys(tokens));
  }

  /**
   * @param {import('express').Request} req
   * @returns {{roleLabel: string} | null}
   */
  resolve(req) {
    const sessionId = this.#parseSessionCookie(req.headers.cookie);
    if (!sessionId) return null;

    const identity = this.tokens[sessionId];
    if (!identity) return null;
    return typeof identity === "string" ? { roleLabel: identity } : { ...identity };
  }

  issueSession(identity) {
    const sessionId = randomUUID();
    this.tokens[sessionId] = identity;
    return sessionId;
  }

  revokeSession(sessionId) {
    if (this.bootstrapSessions.has(sessionId)) return;
    delete this.tokens[sessionId];
  }

  /** @param {string | undefined} cookieHeader */
  #parseSessionCookie(cookieHeader) {
    if (!cookieHeader) return null;
    const match = /(?:^|;\s*)session=([^;]+)/.exec(cookieHeader);
    return match ? match[1] : null;
  }
}

module.exports = { TokenAuthProvider };
