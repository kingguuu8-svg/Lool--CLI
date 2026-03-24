function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
      result[part.slice(0, index)] = safeDecodeURIComponent(part.slice(index + 1));
      return result;
    }, {});
}

function createAuth({ accessToken, authCookieName, appName }) {
  function getRequestToken(req) {
    const cookies = parseCookies(req.headers.cookie || "");
    return (
      String(req.query?.token || "") ||
      String(req.headers["x-access-token"] || "") ||
      String(req.body?.token || "") ||
      String(cookies[authCookieName] || "")
    ).trim();
  }

  function isAuthenticated(req) {
    if (!accessToken) {
      return true;
    }
    return getRequestToken(req) === accessToken;
  }

  function setAuthCookie(res) {
    res.setHeader(
      "Set-Cookie",
      `${authCookieName}=${encodeURIComponent(
        accessToken
      )}; Path=/; HttpOnly; SameSite=Lax`
    );
  }

  function clearAuthCookie(res) {
    res.setHeader(
      "Set-Cookie",
      `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
  }

  function renderLoginPage(errorMessage = "") {
    const safeAppName = escapeHtml(appName);
    const safeMessage = errorMessage
      ? `<p style="color:#fca5a5;margin:0 0 12px 0;">${escapeHtml(errorMessage)}</p>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeAppName} Login</title>
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
      <h1>${safeAppName}</h1>
      <p>Public access is protected. Enter the access token from your local launcher.</p>
      ${safeMessage}
      <input type="password" name="token" placeholder="Access token" autofocus />
      <button type="submit">Enter</button>
    </form>
  </body>
</html>`;
  }

  function authMiddleware(req, res, next) {
    if (!accessToken) {
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
  }

  function socketIsAuthenticated(req) {
    if (!accessToken) {
      return true;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const cookies = parseCookies(req.headers.cookie || "");
    const token =
      String(url.searchParams.get("token") || "") ||
      String(cookies[authCookieName] || "");

    return token.trim() === accessToken;
  }

  return {
    authMiddleware,
    clearAuthCookie,
    getRequestToken,
    isAuthenticated,
    renderLoginPage,
    setAuthCookie,
    socketIsAuthenticated,
  };
}

module.exports = {
  createAuth,
};
