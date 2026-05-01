# Codex 用量悬浮窗

Windows 桌面悬浮窗，用于查看 `https://code.ylsagi.com/codex/info` 的今日/本周用量、余额和订阅包状态。

## 功能

- 球形悬浮窗：支持拖动、靠边半隐藏、悬停展开。
- 独立用量面板：显示今日剩余、本周剩余、请求数、Token 数和订阅包。
- 状态提示：正常、刷新中、缓存、警告、错误会在悬浮球和面板中同步体现。
- 本地缓存：接口失败时保留上次成功数据。
- 托盘菜单：刷新、打开设置、重置位置、打开日志目录、打开配置目录、退出。
- 桌面稳定性：单实例、多屏/任务栏变化自动恢复位置、点击外部关闭面板。
- 上线加固：CSP、sandbox、单实例锁、日志、崩溃记录、开机启动设置。

## 运行

```powershell
npm install
npm start
```

首次启动后打开设置，粘贴 Bearer Token 并保存。也可以通过环境变量提供 Token：

```powershell
$env:YLS_CODEX_TOKEN="你的 token"
npm start
```

支持的环境变量：

- `YLS_Codex_TOKEN`
- `YLS_CODEX_TOKEN`
- `CODEX_INFO_TOKEN`

## 验证

```powershell
npm run verify
```

该命令会执行主进程语法检查、Preload 语法检查、TypeScript 检查和生产构建。

## 构建

```powershell
npm run build
```

## 打包

```powershell
npm run pack
```

生成的 Windows 便携版在 `dist` 目录。安装包构建：

```powershell
npm run dist
```

## 日志和配置

日志目录：

```txt
%APPDATA%\Codex 用量悬浮窗\logs
```

配置目录：

```txt
%APPDATA%\Codex 用量悬浮窗
```

设置面板和托盘菜单都提供了打开日志/配置目录的入口。

## 结构

```txt
src/main/
  app-lifecycle.js  单实例、安全策略、开机启动
  api.js            接口请求和 token 读取
  cache.js          接口数据缓存
  constants.js      桌面窗口尺寸和接口常量
  data-service.js   主进程统一数据刷新和广播
  geometry.js       窗口定位、吸边、边界约束
  ipc.js            Renderer 可调用的 IPC
  logger.js         本地日志
  settings.js       本地设置读写和归一化
  tray.js           托盘菜单
  windows.js        悬浮球窗口和面板窗口管理

src/renderer/src/
  apps/             BubbleApp 和 PanelApp
  components/       UI 组件
  hooks/            useCodexData 数据状态
  styles/           base、bubble、panel 样式
  types.ts          接口和 preload 类型
  utils.ts          格式化和用量计算
```
