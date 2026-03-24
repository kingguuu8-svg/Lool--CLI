const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ASSET_DIR = path.join(PROJECT_ROOT, "docs", "assets");
const LOCAL_URL = "http://127.0.0.1:3000";
const CAPTURE_DESKTOP = !process.argv.includes("--browser-only");
const CAPTURE_BROWSER = !process.argv.includes("--desktop-only");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function logStep(message) {
  console.log(`[capture] ${message}`);
}

function runCommand(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      env: {
        ...process.env,
        ...options.env,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `${file} exited with ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function runBat(scriptName, extraArgs = [], env = {}) {
  const scriptPath = path.join(PROJECT_ROOT, scriptName);
  return runCommand("cmd.exe", ["/c", scriptPath, ...extraArgs], { env });
}

async function waitForHealth(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${LOCAL_URL}/api/health`);
      if (response.ok) {
        const payload = await response.json();
        if (payload?.ok) {
          return payload;
        }
      }
    } catch {}
    await delay(500);
  }

  throw new Error("Server did not become healthy in time.");
}

async function api(pathname, options = {}) {
  const response = await fetch(`${LOCAL_URL}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${pathname} failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function resetSessions() {
  const sessions = await api("/api/sessions");
  for (const session of sessions) {
    await fetch(`${LOCAL_URL}/api/sessions/${session.id}`, { method: "DELETE" });
  }
}

async function createDemoSession() {
  return api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      mode: "local",
      name: "pocketcli-demo",
      cwd: PROJECT_ROOT,
      startupCommand:
        "echo PocketCLI demo session && echo Self-hosted terminal access on your own machine && echo Type claude when you are ready.",
    }),
  });
}

async function loadWindow(target) {
  return new Promise((resolve, reject) => {
    target.once("did-finish-load", resolve);
    target.once("did-fail-load", (_event, code, description) => {
      reject(new Error(`Failed to load window: ${code} ${description}`));
    });
  });
}

async function waitForCondition(window, script, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await window.webContents.executeJavaScript(script, true);
      if (result) {
        return true;
      }
    } catch {}
    await delay(300);
  }
  throw new Error("Condition timed out.");
}

async function captureBrowserTerminal() {
  logStep("Capturing browser terminal screenshot...");
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    show: false,
    backgroundColor: "#0b1220",
  });

  try {
    const loaded = loadWindow(window.webContents);
    await window.loadURL(LOCAL_URL);
    await loaded;
    await waitForCondition(
      window,
      `(() => {
        const cards = document.querySelectorAll(".session-card");
        return cards && cards.length > 0;
      })()`
    );
    await delay(1800);
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(ASSET_DIR, "browser-terminal.png"), image.toPNG());
    logStep("Saved docs/assets/browser-terminal.png");
  } finally {
    window.destroy();
  }
}

async function captureDesktopLauncher() {
  logStep("Capturing desktop launcher screenshot...");
  const window = new BrowserWindow({
    width: 1460,
    height: 960,
    show: false,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(PROJECT_ROOT, "desktop", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    const loaded = loadWindow(window.webContents);
    await window.loadFile(path.join(PROJECT_ROOT, "desktop", "index.html"));
    await loaded;
    await window.webContents.executeJavaScript(
      `document.querySelector('[data-mode="local"]').click();`,
      true
    );
    await waitForCondition(
      window,
      `(() => {
        const status = document.getElementById("status");
        const frame = document.getElementById("app-frame");
        return status && status.textContent.includes("finished") && frame && frame.src.includes("127.0.0.1:3000");
      })()`,
      30000
    );
    await delay(2200);
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(ASSET_DIR, "desktop-launcher.png"), image.toPNG());
    logStep("Saved docs/assets/desktop-launcher.png");
  } finally {
    window.destroy();
  }
}

async function main() {
  ensureDir(ASSET_DIR);

  try {
    logStep("Stopping old server...");
    await runBat("stop-server.bat").catch(() => {});
    logStep("Starting local server...");
    await runBat("start-server.bat", ["local"], { NO_OPEN_BROWSER: "1" });
    logStep("Waiting for health check...");
    await waitForHealth();
    logStep("Resetting sessions...");
    await resetSessions();
    logStep("Creating demo session...");
    await createDemoSession();
    if (CAPTURE_BROWSER) {
      await captureBrowserTerminal();
    }
    if (CAPTURE_DESKTOP) {
      await captureDesktopLauncher();
    }
  } finally {
    logStep("Stopping server...");
    await runBat("stop-server.bat").catch(() => {});
  }
}

app.whenReady().then(async () => {
  try {
    await main();
    app.quit();
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    app.exit(1);
  }
});
