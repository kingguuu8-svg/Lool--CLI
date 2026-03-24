const path = require("path");
const pty = require("node-pty");

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

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

function createLocalTransport({ cwd, onOutput, onExit }) {
  const shell = createDefaultShell();
  const term = pty.spawn(shell.file, shell.args, {
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    cwd,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    },
    name: "xterm-color",
  });

  term.onData((data) => onOutput(data));
  term.onExit(({ exitCode }) => onExit(exitCode));

  return {
    shellName: path.basename(shell.file),
    transport: {
      write(data) {
        term.write(data);
      },
      resize(cols, rows) {
        term.resize(cols, rows);
      },
      close() {
        term.kill();
      },
    },
  };
}

module.exports = {
  createLocalTransport,
};
