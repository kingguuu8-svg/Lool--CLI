const express = require("express");

function createApiRouter(sessionService) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json(sessionService.buildHealthPayload());
  });

  router.get("/sessions", (_req, res) => {
    res.json(sessionService.listSessions());
  });

  router.post("/sessions", async (req, res) => {
    try {
      const session = await sessionService.createSession(req.body || {});
      res.status(201).json(sessionService.getSessionSummary(session.id));
    } catch (error) {
      res.status(500).json({
        error: "Failed to create session",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post("/sessions/:id/command", (req, res) => {
    const command = String(req.body?.command || "");
    if (!command) {
      res.status(400).json({ error: "command is required" });
      return;
    }

    const result = sessionService.sendCommand(req.params.id, command);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ ok: true });
  });

  router.delete("/sessions/:id", (req, res) => {
    const session = sessionService.deleteSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}

module.exports = {
  createApiRouter,
};
