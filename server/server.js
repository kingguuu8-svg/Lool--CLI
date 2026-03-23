const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { randomUUID } = require("crypto");
const pty = require("node-pty");
const { Client: SshClient } = require("ssh2");
const WebSocket = require("ws");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_CWD = process.env.DEFAULT_CWD || process.cwd();
const ACCESS_TOKEN = String(process.env.ACCESS_TOKEN || "").trim();
const MAX_CHUNKS = 400;
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const AUTH_COOKIE_NAME = "pocketcli_token";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/assets", express.static(path.join(__dirname, "..", "public")));
app.use(
  "/vendor/xterm",
  express.static(path.join(__dirname, "..", "node_modules", "@xterm", "xterm"))
);
app.use(
  "/vendor/xterm-addon-fit",
  express.static(path.join(__dirname, "..", "node_modules", "@xterm", "addon-fit"))
);

const sessions = new Map();

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        return result;
      }
      result[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return result;
    }, {});
}

function getRequestToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return (
    String(req.query?.token || "") ||
    String(req.headers["x-access-token"] || "") ||
    String(req.body?.token || "") ||
    String(cookies[AUTH_COOKIE_NAME] || "")
  ).trim();
}

function isAuthenticated(req) {
  if (!ACCESS_TOKEN) {
    return true;
  }
  return getRequestToken(req) === ACCESS_TOKEN;
}

function setAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(
      ACCESS_TOKEN
    )}; Path=/; HttpOnly; SameSite=Lax`
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function renderLoginPage(errorMessage = "") {
  const safeMessage = errorMessage
    ? `<p style="color:#fca5a5;margin:0 0 12px 0;">${errorMessage}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PocketCLI Login</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111827; color: #e5e7eb; font-family: Consolas, "Courier New", monospace; }
      .card { width: min(420px, calc(100vw - 32px)); background: #0f172a; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; }
      h1 { margin-top: 0; font-size: 24px; }
      p { color: #94a3b8; line-height: 1.5; }
      input, button { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid #374151; font: inherit; }
      input { background: #111827; color: #f9fafb; margin-bottom: 12px; }
      button { background: #1d4ed8; color: white; cursor: pointer; }
    </style>
  </head>
  <body>
    <form class="card" method="post" action="/login">
      <h1>PocketCLI</h1>
      <p>Public access is protected. Enter the access token from your local launcher.</p>
      ${safeMessage}
      <input type="password" name="token" placeholder="Access token" autofocus />
      <button type="submit">Enter</button>
    </form>
  </body>
</html>`;
}

app.get("/login", (req, res) => {
  if (!ACCESS_TOKEN) {
    res.redirect("/");
    return;
  }

  if (isAuthenticated(req)) {
    setAuthCookie(res);
    res.redirect("/");
    return;
  }

  res.status(200).send(renderLoginPage());
});

app.post("/login", (req, res) => {
  if (!ACCESS_TOKEN) {
    res.redirect("/");
    return;
  }

  if (isAuthenticated(req)) {
    setAuthCookie(res);
    res.redirect("/");
    return;
  }

  res.status(401).send(renderLoginPage("Token incorrect."));
});

app.get("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.redirect("/login");
});

app.use((req, res, next) => {
  if (!ACCESS_TOKEN) {
    next();
    return;
  }

  if (
    req.path === "/login" ||
    req.path === "/logout" ||
    req.path === "/api/health" ||
    req.path.startsWith("/assets/") ||
    req.path.startsWith("/vendor/")
  ) {
    if (isAuthenticated(req)) {
      setAuthCookie(res);
    }
    next();
    return;
  }

  if (isAuthenticated(req)) {
    setAuthCookie(res);
    next();
    return;
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  res.redirect("/login");
});

function socketIsAuthenticated(req) {
  if (!ACCESS_TOKEN) {
    return true;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const cookies = parseCookies(req.headers.cookie || "");
  const token =
    String(url.searchParams.get("token") || "") ||
    String(cookies[AUTH_COOKIE_NAME] || "");

  return token.trim() === ACCESS_TOKEN;
}

function createDefaultShell() {
  if (process.platform === "win32") {
    return {
      file: process.env.COMSPEC || "C:\\Windows\\System32\\cmd.exe",
      args: ["/K", "chcp 65001>nul"],
    };
  }

  return {
    file: process.env.SHELL || "/bin/bash",
    args: ["-l"],
  };
}

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

function sanitizeLocalCwd(inputCwd) {
  if (!inputCwd || typeof inputCwd !== "string") {
    return DEFAULT_CWD;
  }

  return path.resolve(inputCwd);
}

function sanitizeRemoteCwd(inputCwd) {
  if (!inputCwd || typeof inputCwd !== "string") {
    return "";
  }

  return inputCwd.trim();
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

function bestEffortChangeDirectoryCommand(cwd) {
  if (!cwd) {
    return "";
  }

  const escapedForCmd = cwd.replace(/"/g, '""');
  const escapedForPosix = cwd.replace(/(["\\$`])/g, "\\$1");
  return `cd /d "${escapedForCmd}" 2>nul || cd "${escapedForPosix}"`;
}

function maybeSendStartup(session) {
  const commands = [];
  if (session.cwd) {
    commands.push(bestEffortChangeDirectoryCommand(session.cwd));
  }
  if (session.startupCommand) {
    commands.push(session.startupCommand);
  }

  if (!commands.length) {
    return;
  }

  session.transport.write(`${commands.join("\r")}\r`);
}

function createLocalSession({ name, cwd, startupCommand }) {
  const shell = createDefaultShell();
  const session = createSessionBase({
    name,
    cwd: sanitizeLocalCwd(cwd),
    mode: "local",
    target: "this machine",
    shell: path.basename(shell.file),
    startupCommand,
  });

  const term = pty.spawn(shell.file, shell.args, {
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    cwd: session.cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    },
    name: "xterm-color",
  });

  session.transport = {
    write(data) {
      term.write(data);
    },
    resize(cols, rows) {
      term.resize(cols, rows);
    },
    close() {
      term.kill();
    },
  };

  term.onData((data) => appendOutput(session, data));
  term.onExit(({ exitCode }) => finalizeExit(session, exitCode));

  sessions.set(session.id, session);
  maybeSendStartup(session);
  return session;
}

function buildSshConfig(ssh) {
  if (!ssh || typeof ssh !== "object") {
    throw new Error("ssh configuration is required for ssh sessions");
  }

  if (!ssh.host || !ssh.username) {
    throw new Error("ssh host and username are required");
  }

  const config = {
    host: String(ssh.host),
    port: Number(ssh.port || 22),
    username: String(ssh.username),
    readyTimeout: 15000,
    tryKeyboard: false,
  };

  if (ssh.authType === "privateKey") {
    if (!ssh.privateKeyPath) {
      throw new Error("private key path is required");
    }
    config.privateKey = fs.readFileSync(String(ssh.privateKeyPath));
    if (ssh.passphrase) {
      config.passphrase = String(ssh.passphrase);
    }
  } else {
    if (!ssh.password) {
      throw new Error("password is required");
    }
    config.password = String(ssh.password);
  }

  return config;
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

  const conn = new SshClient();

  return new Promise((resolve, reject) => {
    let settled = false;

    function fail(error) {
      if (settled) {
        return;
      }
      settled = true;
      conn.end();
      reject(error);
    }

    conn.on("ready", () => {
      conn.shell(
        {
          term: "xterm-256color",
          cols: DEFAULT_COLS,
          rows: DEFAULT_ROWS,
        },
        (error, stream) => {
          if (error) {
            fail(error);
            return;
          }

          session.transport = {
            write(data) {
              stream.write(data);
            },
            resize(cols, rows) {
              stream.setWindow(rows, cols, 0, 0);
            },
            close() {
              stream.end("exit\r");
              conn.end();
            },
          };

          stream.on("data", (data) => appendOutput(session, data.toString("utf8")));
          stream.stderr?.on("data", (data) =>
            appendOutput(session, data.toString("utf8"))
          );
          stream.on("close", () => {
            finalizeExit(session, session.exitCode ?? 0);
            conn.end();
          });
          conn.on("close", () => finalizeExit(session, session.exitCode ?? 0));

          sessions.set(session.id, session);
          maybeSendStartup(session);

          if (!settled) {
            settled = true;
            resolve(session);
          }
        }
      );
    });

    conn.on("error", (error) => {
      if (!settled) {
        fail(error);
      } else {
        appendOutput(session, `\r\n[ssh error] ${error.message}\r\n`);
        finalizeExit(session, 255);
      }
    });

    conn.connect(config);
  });
}

async function createSession(payload) {
  const mode = payload?.mode === "ssh" ? "ssh" : "local";
  if (mode === "ssh") {
    return createSshSession(payload || {});
  }
  return createLocalSession(payload || {});
}

function getSessionOrThrow(id, res) {
  const session = sessions.get(id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }
  return session;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    host: HOST,
    port: PORT,
    cwd: DEFAULT_CWD,
    authEnabled: Boolean(ACCESS_TOKEN),
    sessions: [...sessions.values()].map(toSessionSummary),
  });
});

app.get("/api/sessions", (_req, res) => {
  res.json([...sessions.values()].map(toSessionSummary));
});

app.post("/api/sessions", async (req, res) => {
  try {
    const session = await createSession(req.body || {});
    res.status(201).json(toSessionSummary(session));
  } catch (error) {
    res.status(500).json({
      error: "Failed to create session",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/sessions/:id/command", (req, res) => {
  const session = getSessionOrThrow(req.params.id, res);
  if (!session) {
    return;
  }

  if (session.exitedAt) {
    res.status(409).json({ error: "Session has already exited" });
    return;
  }

  const command = String(req.body?.command || "");
  if (!command) {
    res.status(400).json({ error: "command is required" });
    return;
  }

  session.transport.write(command.endsWith("\n") ? command : `${command}\r`);
  res.json({ ok: true });
});

app.delete("/api/sessions/:id", (req, res) => {
  const session = getSessionOrThrow(req.params.id, res);
  if (!session) {
    return;
  }

  if (!session.exitedAt) {
    session.transport.close();
  }
  sessions.delete(session.id);
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

wss.on("connection", (socket, req) => {
  if (!socketIsAuthenticated(req)) {
    socket.close(1008, "Authentication required");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] !== "ws" || parts[1] !== "sessions" || !parts[2]) {
    socket.close(1008, "Invalid session path");
    return;
  }

  const session = sessions.get(parts[2]);
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
          Number(message.cols || DEFAULT_COLS),
          Number(message.rows || DEFAULT_ROWS)
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
});

server.listen(PORT, HOST, () => {
  console.log(`PocketCLI server running at http://${HOST}:${PORT}`);
  console.log(`Default working directory: ${DEFAULT_CWD}`);
  console.log(`Access token enabled: ${ACCESS_TOKEN ? "yes" : "no"}`);
});
