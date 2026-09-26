const { DomainError } = require("../errors/DomainError");

/**
 * Every controller's catch block does the same thing: a DomainError
 * knows its own HTTP status, anything else is a bug and should not be
 * silently swallowed. Factored out once, rather than repeating the
 * same `if (err instanceof DomainError)` in every controller file.
 *
 * @param {unknown} err
 * @param {import('express').Response} res
 */
function handleControllerError(err, res) {
  if (err instanceof DomainError) return res.status(err.status).json({ error: err.message });
  throw err;
}

module.exports = { handleControllerError };
