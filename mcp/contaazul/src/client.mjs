// Configuração, armazenamento de tokens e chamadas HTTP à API v2 da Conta Azul.
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Carrega mcp/contaazul/.env se existir (variáveis já definidas no ambiente têm prioridade).
const envFile = process.env.CONTAAZUL_ENV_FILE || resolve(ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const config = {
  clientId: process.env.CONTAAZUL_CLIENT_ID,
  clientSecret: process.env.CONTAAZUL_CLIENT_SECRET,
  redirectUri: process.env.CONTAAZUL_REDIRECT_URI || "https://www.contaazul.com",
  scope: process.env.CONTAAZUL_SCOPE || "openid profile aws.cognito.signin.user.admin",
  authUrl: process.env.CONTAAZUL_AUTH_URL || "https://auth.contaazul.com/login",
  tokenUrl: process.env.CONTAAZUL_TOKEN_URL || "https://auth.contaazul.com/oauth2/token",
  apiBase: (process.env.CONTAAZUL_API_BASE || "https://api-v2.contaazul.com").replace(/\/+$/, ""),
  tokenFile: resolve(ROOT, process.env.CONTAAZUL_TOKEN_FILE || "tokens.json"),
  allowWrite: process.env.CONTAAZUL_ALLOW_WRITE === "1",
};

export function requireCredentials() {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "CONTAAZUL_CLIENT_ID e CONTAAZUL_CLIENT_SECRET não definidos. Copie .env.example para .env e preencha."
    );
  }
}

export function loadTokens() {
  if (!existsSync(config.tokenFile)) return null;
  return JSON.parse(readFileSync(config.tokenFile, "utf8"));
}

export function saveTokens(tokens) {
  const tmp = `${config.tokenFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  renameSync(tmp, config.tokenFile);
}

// POST no endpoint de token (troca de code ou refresh), autenticado com Basic client_id:client_secret.
export async function requestToken(params) {
  requireCredentials();
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Falha no token (${res.status}): ${text}`);
  const data = JSON.parse(text);
  const previous = loadTokens() || {};
  const tokens = {
    access_token: data.access_token,
    // Alguns provedores não devolvem novo refresh_token no refresh: mantém o anterior.
    refresh_token: data.refresh_token || previous.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

let refreshing = null;

async function getAccessToken({ force = false } = {}) {
  const tokens = loadTokens();
  if (!tokens?.refresh_token && !tokens?.access_token) {
    throw new Error("Sem tokens. Rode `npm run auth` em mcp/contaazul para autorizar a empresa.");
  }
  // Renova com 2 min de folga antes de expirar.
  if (!force && tokens.access_token && Date.now() < tokens.expires_at - 120_000) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) throw new Error("access_token expirado e sem refresh_token. Rode `npm run auth`.");
  refreshing ??= requestToken({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }).finally(
    () => (refreshing = null)
  );
  return (await refreshing).access_token;
}

export async function apiRequest(method, path, { query, body } = {}) {
  if (!path.startsWith("/")) path = `/${path}`;
  const url = new URL(config.apiBase + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null) continue;
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }

  const send = async (token) =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await send(await getAccessToken());
  if (res.status === 401) res = await send(await getAccessToken({ force: true }));

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}
