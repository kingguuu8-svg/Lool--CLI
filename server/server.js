const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const { createAuth } = require("./auth");
const { createApiRouter } = require("./routes/api");
const { createSessionService } = require("./session-service");

const APP_NAME = "PocketCLI";
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_CWD = process.env.DEFAULT_CWD || process.cwd();
const ACCESS_TOKEN = String(process.env.ACCESS_TOKEN || "").trim();
const AUTH_COOKIE_NAME = "pocketcli_token";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const auth = createAuth({
  accessToken: ACCESS_TOKEN,
  authCookieName: AUTH_COOKIE_NAME,
  appName: APP_NAME,
});

const sessionService = createSessionService({
  defaultCwd: DEFAULT_CWD,
  host: HOST,
  port: PORT,
  accessToken: ACCESS_TOKEN,
  projectRoot: path.join(__dirname, ".."),
});

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
app.use(auth.authMiddleware);

app.get("/login", (req, res) => {
  if (!ACCESS_TOKEN) {
    res.redirect("/");
    return;
  }

  if (auth.isAuthenticated(req)) {
    auth.setAuthCookie(res);
    res.redirect("/");
    return;
  }

  res.status(200).send(auth.renderLoginPage());
});

app.post("/login", (req, res) => {
  if (!ACCESS_TOKEN) {
    res.redirect("/");
    return;
  }

  if (auth.isAuthenticated(req)) {
    auth.setAuthCookie(res);
    res.redirect("/");
    return;
  }

  res.status(401).send(auth.renderLoginPage("Token incorrect."));
});

app.get("/logout", (_req, res) => {
  auth.clearAuthCookie(res);
  res.redirect("/login");
});

app.use("/api", createApiRouter(sessionService));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

wss.on("connection", (socket, req) => {
  if (!auth.socketIsAuthenticated(req)) {
    socket.close(1008, "Authentication required");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "ws" || parts[1] !== "sessions" || !parts[2]) {
    socket.close(1008, "Invalid session path");
    return;
  }

  sessionService.attachSocket(parts[2], socket);
});

server.listen(PORT, HOST, () => {
  console.log(`${APP_NAME} server running at http://${HOST}:${PORT}`);
  console.log(`Default working directory: ${DEFAULT_CWD}`);
  console.log(`Access token enabled: ${ACCESS_TOKEN ? "yes" : "no"}`);
});
