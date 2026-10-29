const configuredServerUrl = (import.meta.env.VITE_GAME_SERVER_URL as string | undefined)?.trim();

export const GAME_CLIENT_VERSION = '0.5.0';
export const GAME_SERVER_URL = configuredServerUrl || (() => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.hostname}:8787`;
})();

export const SESSION_STORAGE_KEY = 'the-last-diya-session';
export const BUILD_INFO = {
  version: GAME_CLIENT_VERSION,
  environment: (import.meta.env.MODE || 'production') as string,
};
