# 第三方开源组件

本工具使用了以下开源组件，许可证原文见各项目仓库。

| 组件 | 用途 | 许可证 |
|---|---|---|
| [Tauri](https://github.com/tauri-apps/tauri) 及官方插件 | 桌面应用框架 | MIT / Apache-2.0 |
| [React](https://github.com/facebook/react) | 界面 | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | 图标 | ISC |
| [Vite](https://github.com/vitejs/vite) | 构建 | MIT |

## 说明

- 钉钉 / 飞书签名使用浏览器自带的 Web Crypto（HmacSHA256），企业微信图片的 MD5 为按 RFC 1321 自行实现，未引入额外依赖，也没有复制任何其他项目的代码。
- 本工具没有上游项目（`tool.json` 的 `upstream` 为 null）。平台消息格式与限制来自各平台官方文档，见 README「核实来源与限制」。
- 目前 `package.json` 里的其余依赖（Tauri 插件、React 等）均为模板自带，许可证见各自仓库。
