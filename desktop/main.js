const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.join(PROJECT_ROOT, ".runtime");
const ACCESS_FILE = path.join(RUNTIME_DIR, "vps-access.txt");
const HEALTH_FILE_URL = "http://127.0.0.1:3000/api/health";

let mainWindow = null;
let activeLauncher = null;

function ensureRuntimeDir() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0b1220",
    title: "PocketCLI Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function runBat(scriptName) {
  if (activeLauncher && !activeLauncher.killed) {
    activeLauncher.kill();
  }

  return new Promise((resolve, reject) => {
    const child = spawn("cmd.exe", ["/c", path.join(PROJECT_ROOT, scriptName)], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
    });

    activeLauncher = child;

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      output += text;
      mainWindow?.webContents.send("launcher-log", text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      errorOutput += text;
      mainWindow?.webContents.send("launcher-log", text);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || output || `${scriptName} failed with exit code ${code}`));
        return;
      }
      resolve(output);
    });
  });
}

async function readVpsAccess() {
  if (!fs.existsSync(ACCESS_FILE)) {
    return { url: "", token: "" };
  }

  const raw = fs.readFileSync(ACCESS_FILE, "utf8");
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    map.set(key.trim(), rest.join("=").trim());
  }

  return {
    url: map.get("URL") || "",
    token: map.get("ACCESS_TOKEN") || "",
  };
}

async function waitForLocalHealth(timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(HEALTH_FILE_URL);
      if (response.ok) {
        return await response.json();
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local server did not become healthy in time.");
}

ipcMain.handle("app-info", async () => {
  const vpsInfo = await readVpsAccess();
  return {
    projectRoot: PROJECT_ROOT,
    vpsInfo,
  };
});

ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("launch-mode", async (_event, mode) => {
  ensureRuntimeDir();
  const mapping = {
    local: "start-local-app.bat",
    lan: "start-lan.bat",
    vps: "start-vps-app.bat",
    stop: "stop-server.bat",
  };

  const scriptName = mapping[mode];
  if (!scriptName) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const output = await runBat(scriptName);
  let health = null;
  if (mode !== "stop") {
    health = await waitForLocalHealth();
  }

  return {
    ok: true,
    output,
    health,
    vpsInfo: await readVpsAccess(),
  };
});

ipcMain.handle("read-runtime-file", async (_event, relativeName) => {
  const fullPath = path.join(RUNTIME_DIR, relativeName);
  if (!fs.existsSync(fullPath)) {
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
