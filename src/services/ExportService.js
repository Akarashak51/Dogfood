/**
 * Builds the organizer's CSV export. Kept separate from
 * JudgingService because "how scores get formatted for export" and
 * "who's allowed to read which scores" are different reasons to
 * change — exactly the kind of split Single Responsibility is asking
 * for.
 */
class ExportService {
  /**
   * @param {{score: import('../repositories/ScoreRepository').ScoreRepository,
   *           project: import('../repositories/InMemoryRepository').InMemoryRepository}} repositories
   */
  constructor({ score, project }) {
    this.scores = score;
    this.projects = project;
  }

  /**
   * @returns {string} CSV text, header row included.
   * @complexity O(n) time / O(n) space, n = total score count (one
   *   O(1) project lookup per row via the Map-backed ProjectRepository).
   */
  toCsv() {
    const header = ["project_id", "project_title", "team", "judge", "criteria", "comment"];
    const rows = this.scores.list().map((entry) => {
      const project = this.projects.get(entry.project);
      return [
        entry.project,
        project ? project.title : "",
        project ? project.team : "",
        entry.judge,
        JSON.stringify(entry.criteria || {}),
        entry.comment || "",
      ];
    });

    return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  }

  projectsToCsv() {
    const header = ["project_id", "title", "team_id", "track_id", "summary", "repository_url", "submitted_at"];
    const rows = this.projects.list().map((project) => [
      project.id,
      project.title,
      project.team,
      project.track || "",
      project.summary || "",
      project.repo_url || "",
      project.submitted_at || "",
    ]);
    return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  }
}

/** @param {unknown} value @complexity O(m), m = value's string length. */
function csvEscape(value) {
  const text = String(value === undefined || value === null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

module.exports = { ExportService };
