// Sandboxed preload. Intentionally empty until IPC v0 (getAppInfo + theme channel).
// Keep it thin: imports are limited to `electron` (contextBridge, ipcRenderer) and ../shared/*, enforced by
// scripts/check-preload-imports.mjs, and the bundle has a size budget enforced by scripts/build.mjs.
export {};
