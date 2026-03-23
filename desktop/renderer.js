const statusEl = document.getElementById("status");
const currentUrlEl = document.getElementById("current-url");
const currentTokenEl = document.getElementById("current-token");
const logEl = document.getElementById("launcher-log");
const frame = document.getElementById("app-frame");

let currentVpsUrl = "";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#fca5a5" : "#a7f3d0";
}

function appendLog(message) {
  logEl.textContent += message;
  logEl.scrollTop = logEl.scrollHeight;
}

function setEmbeddedUrl(url) {
  if (!url) {
    return;
  }
  frame.src = url;
}

function applyRuntimeInfo(vpsInfo) {
  currentVpsUrl = vpsInfo?.url || currentVpsUrl;
  currentUrlEl.textContent = currentVpsUrl ? `VPS URL: ${currentVpsUrl}` : "";
  currentTokenEl.textContent = vpsInfo?.token ? `Token: ${vpsInfo.token}` : "";
}

async function launch(mode) {
  setStatus(`Running ${mode}...`);
  appendLog(`\n> ${mode}\n`);
  try {
    const result = await window.desktopApi.launchMode(mode);
    applyRuntimeInfo(result.vpsInfo);
    if (mode === "local" || mode === "lan") {
      setEmbeddedUrl("http://127.0.0.1:3000");
    }
    if (mode === "vps" && result.vpsInfo?.url) {
      setEmbeddedUrl("http://127.0.0.1:3000");
    }
    if (mode === "stop") {
      frame.src = "about:blank";
    }
    setStatus(`${mode} finished.`);
  } catch (error) {
    setStatus(error.message || String(error), true);
    appendLog(`${error.stack || error.message || error}\n`);
  }
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => launch(button.dataset.mode));
});

document.getElementById("load-local").addEventListener("click", () => {
  setEmbeddedUrl("http://127.0.0.1:3000");
});

document.getElementById("load-vps").addEventListener("click", () => {
  if (!currentVpsUrl) {
    setStatus("No VPS URL yet. Start VPS mode first.", true);
    return;
  }
  setEmbeddedUrl(currentVpsUrl);
});

document.getElementById("reload-web").addEventListener("click", () => {
  frame.contentWindow?.location.reload();
});

document.getElementById("open-local").addEventListener("click", () => {
  window.desktopApi.openExternal("http://127.0.0.1:3000");
});

document.getElementById("open-vps").addEventListener("click", () => {
  if (!currentVpsUrl) {
    setStatus("No VPS URL yet. Start VPS mode first.", true);
    return;
  }
  window.desktopApi.openExternal(currentVpsUrl);
});

document.getElementById("clear-log").addEventListener("click", () => {
  logEl.textContent = "";
});

window.desktopApi.onLauncherLog((text) => {
  appendLog(text);
});

window.desktopApi.getAppInfo().then((info) => {
  applyRuntimeInfo(info.vpsInfo);
  setStatus(`Ready. Project: ${info.projectRoot}`);
});
