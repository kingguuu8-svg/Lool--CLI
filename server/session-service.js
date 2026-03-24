const path = require("path");
const { randomUUID } = require("crypto");
const WebSocket = require("ws");
const { Terminal: HeadlessTerminal } = require("@xterm/headless");
const { SerializeAddon } = require("@xterm/addon-serialize");
const { createLocalTransport } = require("./transports/local-transport");
const {
  createSshHelpers,
  createSshTransport,
} = require("./transports/ssh-transport");

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const SNAPSHOT_SCROLLBACK = 10000;
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
    const snapshotTerminal = new HeadlessTerminal({
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      scrollback: SNAPSHOT_SCROLLBACK,
      allowProposedApi: true,
    });
    const serializeAddon = new SerializeAddon();
    snapshotTerminal.loadAddon(serializeAddon);

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
      sockets: new Set(),
      transport: null,
      snapshotTerminal,
      serializeAddon,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
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

  function broadcast(session, message) {
    const payload = JSON.stringify(message);
    for (const socket of session.sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  function appendOutput(session, data) {
    session.snapshotTerminal.write(data);
    broadcast(session, { type: "output", data });
  }

  function getSessionSnapshot(session) {
    return session.serializeAddon.serialize({
      scrollback: SNAPSHOT_SCROLLBACK,
      excludeModes: true,
    });
  }

  function applySessionResize(session, cols, rows) {
    const nextCols = Math.max(20, Number(cols || DEFAULT_COLS));
    const nextRows = Math.max(8, Number(rows || DEFAULT_ROWS));
    session.cols = nextCols;
    session.rows = nextRows;
    session.transport.resize(nextCols, nextRows);
    session.snapshotTerminal.resize(nextCols, nextRows);
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

    for (const existingSocket of [...session.sockets]) {
      if (existingSocket === socket) {
        continue;
      }

      if (existingSocket.readyState === WebSocket.OPEN) {
        existingSocket.send(
          JSON.stringify({
            type: "viewer_replaced",
            message: "This session was opened on another device or tab.",
          })
        );
      }

      existingSocket.close(4001, "Viewer replaced");
      session.sockets.delete(existingSocket);
    }

    const snapshot = getSessionSnapshot(session);
    socket.send(
      JSON.stringify({
        type: "snapshot",
        data: snapshot,
        session: toSessionSummary(session),
      })
    );
    session.sockets.add(socket);

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "input" && !session.exitedAt) {
          session.transport.write(String(message.data || ""));
        }
        if (message.type === "resize" && !session.exitedAt) {
          applySessionResize(session, message.cols, message.rows);
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
