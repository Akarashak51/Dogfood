Reserved for a dedicated frontend (e.g. a small SPA) if the team wants
one later. Right now all human-facing pages (gallery, project detail,
submission form) are server-rendered directly in
`src/controllers/galleryController.js` and
`src/controllers/submissionController.js` — nothing here is served YET.
