// 运行配置（由 build 脚本生成 / 手动填写）。
// 字段会被 H5 内核在启动时读取，用于对接真实后端。
// API_BASE 留空表示同源（本地联调用）；上线时填你的后端域名，例如：
//   https://api.cichuang.com
// SIGN_SECRET 必须与后端 .env 的 SIGN_SECRET 完全一致。
window.__APP_CONFIG__ = {
  API_BASE: "",
  SIGN_SECRET: "wc_anon_secret_2026_dev"
};
