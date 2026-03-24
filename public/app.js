const terminalHost = document.getElementById("terminal");
const sessionList = document.getElementById("session-list");
const createForm = document.getElementById("create-session-form");
const agentPresetInput = document.getElementById("agent-preset");
const sessionModeInput = document.getElementById("session-mode");
const sessionNameInput = document.getElementById("session-name");
const sessionCwdInput = document.getElementById("session-cwd");
const startupCommandInput = document.getElementById("startup-command");
const sshFields = document.getElementById("ssh-fields");
const sshHostInput = document.getElementById("ssh-host");
const sshPortInput = document.getElementById("ssh-port");
const sshUsernameInput = document.getElementById("ssh-username");
const sshAuthTypeInput = document.getElementById("ssh-auth-type");
const sshPasswordInput = document.getElementById("ssh-password");
const sshPrivateKeyPathInput = document.getElementById("ssh-private-key-path");
const sshPassphraseInput = document.getElementById("ssh-passphrase");
const activeSessionTitle = document.getElementById("active-session-title");
const statusText = document.getElementById("status-text");
const refreshButton = document.getElementById("refresh-sessions");
const runClaudeButton = document.getElementById("run-claude");
const runCodexButton = document.getElementById("run-codex");
const clearButton = document.getElementById("send-clear");
const killButton = document.getElementById("kill-session");

const AGENT_PRESETS = {
  claude: {
    startupCommand: "claude",
    suggestedName: "claude",
  },
  codex: {
    startupCommand: "codex",
    suggestedName: "codex",
  },
};

const term = new Terminal({
  cursorBlink: true,
  fontSize: 15,
  theme: {
    background: "#111827",
    foreground: "#e5e7eb",
  },
});
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(terminalHost);
fitAddon.fit();

let currentSessionId = null;
let currentSocket = null;
let sessionCache = [];

function setStatus(message) {
  statusText.textContent = message;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function renderSessions() {
  sessionList.innerHTML = "";

  if (!sessionCache.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No sessions yet. Create one on the left.";
    sessionList.appendChild(empty);
    return;
  }

  for (const session of sessionCache) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `session-card${session.id === currentSessionId ? " active" : ""}`;
    card.innerHTML = `
      <div class="name">${session.name}</div>
      <div class="meta">${session.mode} | ${session.target}</div>
      <div class="meta">${session.cwd}</div>
      <div class="meta">${session.running ? "running" : `exited (${session.exitCode})`}</div>
    `;
    card.addEventListener("click", () => connectSession(session.id));
    sessionList.appendChild(card);
  }
}

async function loadSessions(preferredSessionId) {
  sessionCache = await api("/api/sessions");
  renderSessions();

  if (preferredSessionId) {
    await connectSession(preferredSessionId);
    return;
  }

  if (!currentSessionId && sessionCache.length) {
    await connectSession(sessionCache[0].id);
  }
}

function disconnectSocket() {
  if (currentSocket) {
    currentSocket.onclose = null;
    currentSocket.close();
    currentSocket = null;
  }
}

function updateTitle() {
  const session = sessionCache.find((item) => item.id === currentSessionId);
  activeSessionTitle.textContent = session
    ? `${session.name}  |  ${session.mode}  |  ${session.target}  |  ${session.cwd || "~"}`
    : "No session selected";
}

function updateSshFieldVisibility() {
  const isSsh = sessionModeInput.value === "ssh";
  const usePrivateKey = sshAuthTypeInput.value === "privateKey";

  sshFields.classList.toggle("hidden", !isSsh);
  sshPasswordInput.classList.toggle("hidden", !isSsh || usePrivateKey);
  sshPrivateKeyPathInput.classList.toggle("hidden", !isSsh || !usePrivateKey);
  sshPassphraseInput.classList.toggle("hidden", !isSsh || !usePrivateKey);
}

function buildCreatePayload() {
  const payload = {
    mode: sessionModeInput.value,
    name: sessionNameInput.value,
    cwd: sessionCwdInput.value,
    startupCommand: startupCommandInput.value,
  };

  if (payload.mode === "ssh") {
    payload.ssh = {
      host: sshHostInput.value,
      port: sshPortInput.value,
      username: sshUsernameInput.value,
      authType: sshAuthTypeInput.value,
      password: sshPasswordInput.value,
      privateKeyPath: sshPrivateKeyPathInput.value,
      passphrase: sshPassphraseInput.value,
    };
  }

  return payload;
}

function applyPresetSelection() {
  const preset = AGENT_PRESETS[agentPresetInput.value];
  if (!preset) {
    return;
  }

  if (!startupCommandInput.value.trim()) {
    startupCommandInput.value = preset.startupCommand;
  }

  if (!sessionNameInput.value.trim()) {
    sessionNameInput.value = preset.suggestedName;
  }
}

async function sendCommandToCurrentSession(command) {
  if (!currentSessionId) {
    setStatus("Create or select a session first.");
    return false;
  }

  await api(`/api/sessions/${currentSessionId}/command`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
  setStatus(`Sent: ${command}`);
  return true;
}

async function connectSession(sessionId) {
  if (!sessionId) {
    return;
  }

  disconnectSocket();
  currentSessionId = sessionId;
  renderSessions();
  updateTitle();
  term.reset();
  setStatus("Connecting...");

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}/ws/sessions/${sessionId}`);
  currentSocket = socket;

  socket.onopen = () => {
    fitAddon.fit();
    socket.send(
      JSON.stringify({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      })
    );
    setStatus("Connected.");
    term.focus();
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "history") {
      for (const chunk of message.chunks) {
        term.write(chunk);
      }
      return;
    }

    if (message.type === "output") {
      term.write(message.data);
      return;
    }

    if (message.type === "exit") {
      setStatus(`Session exited with code ${message.exitCode}.`);
      loadSessions(currentSessionId).catch((error) => setStatus(error.message));
      return;
    }

    if (message.type === "error") {
      setStatus(message.message);
    }
  };

  socket.onclose = () => {
    if (currentSocket === socket) {
      setStatus("Disconnected.");
    }
  };
}

term.onData((data) => {
  if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
    currentSocket.send(JSON.stringify({ type: "input", data }));
  }
});

window.addEventListener("resize", () => {
  fitAddon.fit();
  if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
    currentSocket.send(
      JSON.stringify({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      })
    );
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  applyPresetSelection();
  const session = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify(buildCreatePayload()),
  });
  const selectedPreset = agentPresetInput.value;
  const presetName = selectedPreset || session.mode;
  agentPresetInput.value = "";
  sessionNameInput.value = "";
  sessionCwdInput.value = "";
  startupCommandInput.value = "";
  sshPasswordInput.value = "";
  sshPassphraseInput.value = "";
  setStatus(`Created ${presetName} session ${session.name}.`);
  await loadSessions(session.id);
});

refreshButton.addEventListener("click", () => {
  loadSessions(currentSessionId).catch((error) => setStatus(error.message));
});

runClaudeButton.addEventListener("click", async () => {
  await sendCommandToCurrentSession("claude");
});

runCodexButton.addEventListener("click", async () => {
  await sendCommandToCurrentSession("codex");
});

clearButton.addEventListener("click", async () => {
  const session = sessionCache.find((item) => item.id === currentSessionId);
  const clearCommand = session?.shell === "cmd.exe" ? "cls" : "clear";
  await sendCommandToCurrentSession(clearCommand);
});

killButton.addEventListener("click", async () => {
  if (!currentSessionId) {
    setStatus("Create or select a session first.");
    return;
  }
  const sessionId = currentSessionId;
  disconnectSocket();
  currentSessionId = null;
  await api(`/api/sessions/${sessionId}`, { method: "DELETE" });
  setStatus("Session killed.");
  await loadSessions();
  term.reset();
  updateTitle();
});

sessionModeInput.addEventListener("change", updateSshFieldVisibility);
sshAuthTypeInput.addEventListener("change", updateSshFieldVisibility);
agentPresetInput.addEventListener("change", applyPresetSelection);
updateSshFieldVisibility();

loadSessions().catch((error) => setStatus(error.message));
