#!/usr/bin/env node
// Autorização OAuth 2.0 (Authorization Code) da Conta Azul — rodar uma vez por empresa.
//
//   npm run auth                 → mostra o link de login
//   npm run auth -- "<URL ou code>" → troca o code pelos tokens e salva em tokens.json
import { randomBytes } from "node:crypto";
import { config, requireCredentials, requestToken } from "./client.mjs";

requireCredentials();
const input = process.argv[2];

if (!input) {
  const url = new URL(config.authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", randomBytes(16).toString("hex"));
  url.searchParams.set("scope", config.scope);
  console.log(`1. Abra no navegador e faça login na Conta Azul:\n\n${url}\n`);
  console.log(`2. Após autorizar, você será redirecionado para ${config.redirectUri}?code=...`);
  console.log(`3. Copie a URL inteira da barra de endereço e rode:\n\n   npm run auth -- "<URL copiada>"\n`);
  console.log("O code expira em poucos minutos — faça o passo 3 logo em seguida.");
  process.exit(0);
}

let code = input;
if (/^https?:\/\//.test(input)) {
  const params = new URL(input).searchParams;
  if (params.get("error")) {
    console.error(`Autorização negada: ${params.get("error")} ${params.get("error_description") ?? ""}`);
    process.exit(1);
  }
  code = params.get("code");
  if (!code) {
    console.error("A URL não contém ?code=. Copie a URL depois do redirecionamento.");
    process.exit(1);
  }
}

try {
  const tokens = await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  console.log(`Tokens salvos em ${config.tokenFile} (chmod 600).`);
  console.log(`access_token válido até ${new Date(tokens.expires_at).toLocaleString("pt-BR")}.`);
  console.log(tokens.refresh_token ? "refresh_token recebido — o MCP renova sozinho." : "AVISO: sem refresh_token.");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
