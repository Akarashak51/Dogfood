const express = require("express");
const { requireRole } = require("../auth/requireRole");

/**
 * @param {ReturnType<typeof import('../container').createContainer>['services']} services
 */
function buildExportController(services) {
  const router = express.Router();
  const { export: exportService } = services;

  // T2 (FR-2.4): organizer-only CSV export.
  router.get("/api/export.csv", requireRole("organizer"), (_req, res) => {
    res.status(200).set("Content-Type", "text/csv").send(exportService.toCsv());
  });

  return router;
}

module.exports = { buildExportController };
