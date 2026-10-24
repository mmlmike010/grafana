// The IPC allowlist: every channel main and preload may use is named here and nowhere else.
// Empty until IPC v0 (getAppInfo + theme channel).
export const IPC_CHANNELS = {} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
