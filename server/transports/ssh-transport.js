const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client: SshClient } = require("ssh2");

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

function createAllowedKeyRoots(projectRoot) {
  const roots = new Set([
    path.join(projectRoot, ".secrets"),
    path.join(projectRoot, ".runtime"),
    path.join(os.homedir(), ".ssh"),
  ]);

  const extraRoots = String(process.env.SSH_KEY_ALLOWED_ROOTS || "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const root of extraRoots) {
    roots.add(root);
  }

  return [...roots].map((root) => path.resolve(root));
}

function createSshHelpers(projectRoot) {
  const allowedKeyRoots = createAllowedKeyRoots(projectRoot);

  function resolvePrivateKeyPath(privateKeyPath) {
    const candidate = path.resolve(String(privateKeyPath || ""));
    const extension = path.extname(candidate).toLowerCase();
    if (![".pem", ".key", ""].includes(extension)) {
      throw new Error("private key file must use a supported key extension");
    }

    const isAllowed = allowedKeyRoots.some((root) => {
      const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
      return candidate === root || candidate.startsWith(normalizedRoot);
    });

    if (!isAllowed) {
      throw new Error(
        "private key path must be inside an allowed SSH key directory on this host"
      );
    }

    if (!fs.existsSync(candidate)) {
      throw new Error("private key file not found");
    }

    return candidate;
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
      const resolvedPath = resolvePrivateKeyPath(ssh.privateKeyPath);
      config.privateKey = fs.readFileSync(resolvedPath);
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

  return {
    buildSshConfig,
  };
}

function createSshTransport({ sshConfig, onOutput, onExit, onRuntimeError }) {
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

          stream.on("data", (data) => onOutput(data.toString("utf8")));
          stream.stderr?.on("data", (data) => onOutput(data.toString("utf8")));
          stream.on("close", () => {
            onExit(0);
            conn.end();
          });
          conn.on("close", () => onExit(0));

          if (!settled) {
            settled = true;
            resolve({
              shellName: "ssh",
              transport: {
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
              },
            });
          }
        }
      );
    });

    conn.on("error", (error) => {
      if (!settled) {
        fail(error);
      } else {
        onRuntimeError(error);
      }
    });

    conn.connect(sshConfig);
  });
}

module.exports = {
  createSshHelpers,
  createSshTransport,
};
