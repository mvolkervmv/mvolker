#!/usr/bin/env node
// Servidor MCP (stdio) para a API v2 da Conta Azul.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config, loadTokens, apiRequest } from "./client.mjs";

const MAX_CHARS = 60_000;

const server = new McpServer({ name: "contaazul", version: "0.1.0" });

function result(payload, isError = false) {
  let text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  if (text.length > MAX_CHARS) {
    text = `${text.slice(0, MAX_CHARS)}\n\n[... resposta truncada em ${MAX_CHARS} caracteres — use paginação/filtros]`;
  }
  return { content: [{ type: "text", text }], isError };
}

async function call(method, path, opts) {
  try {
    const res = await apiRequest(method, path, opts);
    return result({ status: res.status, data: res.data }, !res.ok);
  } catch (err) {
    return result(`Erro: ${err.message}`, true);
  }
}

const pathSchema = z
  .string()
  .regex(/^\/?v\d+\//, "Use um caminho da API v2, ex.: /v1/pessoas")
  .describe("Caminho do endpoint, relativo à URL base da API (ex.: /v1/pessoas)");
const querySchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]))
  .optional()
  .describe("Parâmetros de query string (filtros, pagina, tamanho_pagina, datas...)");

server.registerTool(
  "contaazul_status",
  {
    title: "Status da conexão Conta Azul",
    description: "Mostra se há tokens salvos, quando o access_token expira e se escrita está habilitada.",
    inputSchema: {},
  },
  async () => {
    const tokens = loadTokens();
    return result({
      api_base: config.apiBase,
      autorizado: Boolean(tokens?.refresh_token || tokens?.access_token),
      access_token_expira_em: tokens?.expires_at ? new Date(tokens.expires_at).toISOString() : null,
      tem_refresh_token: Boolean(tokens?.refresh_token),
      escrita_habilitada: config.allowWrite,
    });
  }
);

server.registerTool(
  "contaazul_get",
  {
    title: "Consultar API Conta Azul (GET)",
    description:
      "Faz uma requisição GET (somente leitura) na API v2 da Conta Azul e devolve o JSON. " +
      "Use para consultar pessoas (clientes/fornecedores), produtos, serviços, vendas, " +
      "contas a pagar/receber, contas financeiras, categorias, centros de custo, contratos e notas fiscais. " +
      "Consulte a documentação (developers.contaazul.com) para o caminho e filtros exatos de cada recurso.",
    inputSchema: { path: pathSchema, query: querySchema },
    annotations: { readOnlyHint: true },
  },
  async ({ path, query }) => call("GET", path, { query })
);

if (config.allowWrite) {
  server.registerTool(
    "contaazul_write",
    {
      title: "Alterar dados na Conta Azul (POST/PUT/PATCH/DELETE)",
      description:
        "Cria, altera ou exclui dados na Conta Azul. AÇÃO REAL no ERP da empresa: " +
        "só use quando o usuário pedir explicitamente e após confirmar com ele o que será enviado.",
      inputSchema: {
        method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
        path: pathSchema,
        query: querySchema,
        body: z.unknown().optional().describe("Corpo JSON da requisição"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ method, path, query, body }) => call(method, path, { query, body })
  );
}

await server.connect(new StdioServerTransport());
