const { ProjectIndexedRepository } = require("./ProjectIndexedRepository");

/** Public comments on a project. See ProjectIndexedRepository for complexity. */
class CommentRepository extends ProjectIndexedRepository {}

module.exports = { CommentRepository };
