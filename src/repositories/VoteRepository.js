const { ProjectIndexedRepository } = require("./ProjectIndexedRepository");

/** Public votes on a project. See ProjectIndexedRepository for complexity. */
class VoteRepository extends ProjectIndexedRepository {}

module.exports = { VoteRepository };
