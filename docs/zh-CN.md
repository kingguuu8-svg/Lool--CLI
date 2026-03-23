# PocketCLI 中文说明

PocketCLI 是一个自托管入口，让你在自己的电脑上运行本地 agent CLI，然后从浏览器、Windows 桌面端或 Android 访问它。

当前已验证：

- Claude Code
- 本地 shell 会话
- SSH 会话
- Android 全屏终端壳
- VPS 反向 SSH 公网入口

## 最短使用路径

### 本机

```bat
npm install
start-local-app.bat
```

打开 `http://127.0.0.1:3000`

### VPS 公网

1. 复制 `config/vps.example.json` 为 `config/vps.json`
2. 填入你的 VPS 信息和私钥路径
3. 运行：

```bat
start-vps-app.bat
```

### Android

```bat
build-apk.bat
```

APK 输出到：

- `dist/android/app-debug.apk`
- `dist/android/app-release.apk`，前提是你已配置 `android/keystore.properties`

## 项目定位

- 英文首页优先，方便全球开发者理解
- 当前先支持 Claude Code
- 后续可以扩展到更多本地 agent CLI
- 不追求重做官方产品，而是保留 CLI 本身的操作方式

## 安全提醒

- `config/vps.json`
- `.secrets/`
- 私钥文件

这些内容都不要提交到 Git。
