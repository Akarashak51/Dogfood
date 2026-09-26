/**
 * Route guard: only lets the request through if `req.user.role` is
 * one of `allowedRoles`. This is the one place role isolation is
 * enforced for a given route — it runs before the controller touches
 * any data, so there is no code path where a forbidden caller ever
 * reaches a repository. See ARCHITECTURE.md for why this matters for
 * the DOGFOOD judge-isolation check specifically.
 *
 * @param {...string} allowedRoles
 * @complexity O(k) time / O(1) space, where k = allowedRoles.length
 *   (a handful of strings — effectively O(1) in practice).
 */
function requireRole(...allowedRoles) {
  return function guard(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

module.exports = { requireRole };
