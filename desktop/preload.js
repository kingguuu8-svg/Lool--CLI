const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  getAppInfo: () => ipcRenderer.invoke("app-info"),
  launchMode: (mode) => ipcRenderer.invoke("launch-mode", mode),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  readRuntimeFile: (name) => ipcRenderer.invoke("read-runtime-file", name),
  onLauncherLog: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("launcher-log", handler);
    return () => ipcRenderer.removeListener("launcher-log", handler);
  },
});
