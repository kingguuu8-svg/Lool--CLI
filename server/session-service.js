const path = require("path");
const { randomUUID } = require("crypto");
const WebSocket = require("ws");
const { createLocalTransport } = require("./transports/local-transport");
const {
  createSshHelpers,
  createSshTransport,
} = require("./transports/ssh-transport");

const MAX_CHUNKS = 400;
function sanitizeLocalCwd(defaultCwd, inputCwd) {
  if (!inputCwd || typeof inputCwd !== "string") {
    return defaultCwd;
  }

  return path.resolve(inputCwd);
}

function sanitizeRemoteCwd(inputCwd) {
  if (!inputCwd || typeof inputCwd !== "string") {
    return "";
  }

  return inputCwd.trim().replace(/\0/g, "");
}

function escapePosixSingleQuoted(value) {
  return String(value).replace(/'/g, `'\"'\"'`);
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function buildRemoteChangeDirectoryCommands(cwd) {
  if (!cwd || /[\r\n]/.test(cwd)) {
    return [];
  }

  const posixPath = escapePosixSingleQuoted(cwd);
  const powerShellPath = escapePowerShellSingleQuoted(cwd);

  return [
    `Set-Location -LiteralPath '${powerShellPath}'`,
    `cd -- '${posixPath}'`,
  ];
}

function buildStartupCommands(session) {
  const commands = [];

  if (session.mode === "ssh") {
    commands.push(...buildRemoteChangeDirectoryCommands(session.cwd));
  }

  if (session.startupCommand) {
    commands.push(session.startupCommand);
  }

  return commands;
}

function createSessionService({ defaultCwd, host, port, accessToken, projectRoot }) {
  const sessions = new Map();
  const sshHelpers = createSshHelpers(projectRoot);

  function createSessionBase({ name, cwd, mode, target, shell, startupCommand }) {
    return {
      id: randomUUID(),
      name: name?.trim() || `session-${sessions.size + 1}`,
      cwd,
      mode,
      target,
      shell,
      startupCommand: startupCommand?.trim() || "",
      createdAt: new Date().toISOString(),
      exitedAt: null,
      exitCode: null,
      history: [],
      sockets: new Set(),
      transport: null,
    };
  }

  function toSessionSummary(session) {
    return {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      mode: session.mode,
      target: session.target,
      shell: session.shell,
      startupCommand: session.startupCommand,
      createdAt: session.createdAt,
      exitedAt: session.exitedAt,
      exitCode: session.exitCode,
      running: !session.exitedAt,
    };
  }

  function ensureHistoryLimit(session) {
    while (session.history.length > MAX_CHUNKS) {
      session.history.shift();
    }
  }

  function broadcast(session, message) {
    const payload = JSON.stringify(message);
    for (const socket of session.sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  function appendOutput(session, data) {
    session.history.push(data);
    ensureHistoryLimit(session);
    broadcast(session, { type: "output", data });
  }

  function finalizeExit(session, exitCode) {
    if (session.exitedAt) {
      return;
    }

    session.exitedAt = new Date().toISOString();
    session.exitCode = typeof exitCode === "number" ? exitCode : 0;
    broadcast(session, {
      type: "exit",
      exitCode: session.exitCode,
      exitedAt: session.exitedAt,
    });
  }

  function maybeSendStartup(session) {
    const commands = buildStartupCommands(session);
    if (!commands.length) {
      return;
    }

    session.transport.write(`${commands.join("\r")}\r`);
  }

  function createLocalSession({ name, cwd, startupCommand }) {
    const session = createSessionBase({
      name,
      cwd: sanitizeLocalCwd(defaultCwd, cwd),
      mode: "local",
      target: "this machine",
      shell: "local",
      startupCommand,
    });

    const { shellName, transport } = createLocalTransport({
      cwd: session.cwd,
      onOutput(data) {
        appendOutput(session, data);
      },
      onExit(exitCode) {
        finalizeExit(session, exitCode);
      },
    });

    session.shell = shellName;
    session.transport = transport;

    sessions.set(session.id, session);
    maybeSendStartup(session);
    return session;
  }

  function buildSshConfig(ssh) {
    return sshHelpers.buildSshConfig(ssh);
  }

  function createSshSession({ name, cwd, startupCommand, ssh }) {
    const config = buildSshConfig(ssh);
    const session = createSessionBase({
      name,
      cwd: sanitizeRemoteCwd(cwd),
      mode: "ssh",
      target: `${config.username}@${config.host}:${config.port}`,
      shell: "ssh",
      startupCommand,
    });

    return createSshTransport({
      sshConfig: config,
      onOutput(data) {
        appendOutput(session, data);
      },
      onExit(exitCode) {
        finalizeExit(session, session.exitCode ?? exitCode);
      },
      onRuntimeError(error) {
        appendOutput(session, `\r\n[ssh error] ${error.message}\r\n`);
        finalizeExit(session, 255);
      },
    }).then(({ shellName, transport }) => {
      session.shell = shellName;
      session.transport = transport;
      sessions.set(session.id, session);
      maybeSendStartup(session);
      return session;
    });
  }

  async function createSession(payload) {
    const mode = payload?.mode === "ssh" ? "ssh" : "local";
    if (mode === "ssh") {
      return createSshSession(payload || {});
    }
    return createLocalSession(payload || {});
  }

  function getSession(id) {
    return sessions.get(id) || null;
  }

  function listSessions() {
    return [...sessions.values()].map(toSessionSummary);
  }

  function getSessionSummary(id) {
    const session = getSession(id);
    return session ? toSessionSummary(session) : null;
  }

  function deleteSession(id) {
    const session = getSession(id);
    if (!session) {
      return null;
    }

    if (!session.exitedAt) {
      session.transport.close();
    }
    sessions.delete(id);
    return session;
  }

  function sendCommand(id, command) {
    const session = getSession(id);
    if (!session) {
      return { error: "Session not found", status: 404 };
    }
    if (session.exitedAt) {
      return { error: "Session has already exited", status: 409 };
    }

    session.transport.write(command.endsWith("\n") ? command : `${command}\r`);
    return { ok: true, session };
  }

  function attachSocket(id, socket) {
    const session = getSession(id);
    if (!session) {
      socket.close(1008, "Session not found");
      return;
    }

    session.sockets.add(socket);
    socket.send(
      JSON.stringify({
        type: "history",
        chunks: session.history,
        session: toSessionSummary(session),
      })
    );

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "input" && !session.exitedAt) {
          session.transport.write(String(message.data || ""));
        }
        if (message.type === "resize" && !session.exitedAt) {
          session.transport.resize(
            Number(message.cols || 120),
            Number(message.rows || 32)
          );
        }
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });

    socket.on("close", () => {
      session.sockets.delete(socket);
    });
  }

  function buildHealthPayload() {
    return {
      ok: true,
      host,
      port,
      cwd: defaultCwd,
      authEnabled: Boolean(accessToken),
      sessions: listSessions(),
    };
  }

  return {
    attachSocket,
    buildHealthPayload,
    createSession,
    deleteSession,
    getSession,
    getSessionSummary,
    listSessions,
    sendCommand,
  };
}

module.exports = {
  createSessionService,
};
