/**
 * Builds the `identify` middleware: attaches `req.user` (or `null`)
 * from whatever `authProvider` resolves, translating the two judge
 * "seats" (judge_a / judge_b) into a real fixture judge id.
 *
 * This middleware never rejects a request itself — it only labels
 * who's asking. Rejection is `requireRole`'s job (see requireRole.js).
 * Keeping identification and authorization as two separate,
 * single-purpose middlewares is the Single-Responsibility split that
 * lets each be tested and reasoned about independently.
 *
 * @param {{resolve(req): {roleLabel: string} | null}} authProvider
 * @param {import('../repositories/JudgeRepository')} judgeRepository
 * @complexity O(1) per request (delegates to authProvider.resolve,
 *   O(1), and to judgeRepository.orderedIds(), amortized O(1) — see
 *   JudgeRepository for why that call is cheap on every request).
 */
function createIdentifyMiddleware(authProvider, judgeRepository) {
  return function identify(req, _res, next) {
    const resolved = authProvider.resolve(req);

    if (!resolved) {
      req.user = null;
      return next();
    }

    const { roleLabel } = resolved;

    if (roleLabel === "judge_a" || roleLabel === "judge_b") {
      const [firstJudgeId, secondJudgeId] = judgeRepository.orderedIds();
      req.user = {
        role: "judge",
        seat: roleLabel,
        judgeId: roleLabel === "judge_a" ? firstJudgeId : secondJudgeId,
      };
    } else {
      req.user = { role: roleLabel };
    }

    next();
  };
}

module.exports = { createIdentifyMiddleware };
