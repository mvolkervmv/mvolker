# MCP Conta Azul (local)

Servidor MCP (stdio) que conecta os agentes à **API v2 da Conta Azul**, usando as
credenciais da **nossa própria aplicação** (`client_id`/`client_secret`) — sem
intermediário pago. Roda no VPS, ao lado do OpenClaw.

- **Somente leitura por padrão.** Escrita só com `CONTAAZUL_ALLOW_WRITE=1`.
- **Renova o token sozinho** com o `refresh_token` (e tenta de novo em caso de 401).
- Tokens ficam em `tokens.json` (`chmod 600`), fora do Git.

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `contaazul_status` | Mostra se está autorizado, validade do token e se a escrita está ligada |
| `contaazul_get` | `GET` em qualquer endpoint da API v2 (ex.: `/v1/pessoas`) com filtros de query |
| `contaazul_write` | `POST/PUT/PATCH/DELETE` — **só existe** com `CONTAAZUL_ALLOW_WRITE=1` |

Os caminhos e filtros de cada recurso estão na documentação oficial
(<https://developers.contaazul.com>).

## Instalação (no VPS)

```bash
cd mvolker/mcp/contaazul
npm ci
cp .env.example .env && chmod 600 .env
nano .env        # preencha CONTAAZUL_CLIENT_ID e CONTAAZUL_CLIENT_SECRET
```

## Autorizar a empresa (uma vez)

```bash
npm run auth
```

1. Abra o link exibido e faça login na Conta Azul; autorize a empresa.
2. Você será redirecionado para `https://www.contaazul.com/?code=...` (app de desenvolvimento).
3. Copie a URL inteira **logo em seguida** (o code expira rápido) e rode:

```bash
npm run auth -- "https://www.contaazul.com/?code=XXXX&state=YYYY"
```

Pronto: `tokens.json` criado. Se o `refresh_token` expirar ou for revogado, repita.

## Conectar ao agente

Comando do servidor: `node /caminho/para/mvolker/mcp/contaazul/src/server.mjs`

**Claude Code:**
```bash
claude mcp add contaazul -- node /root/mvolker/mcp/contaazul/src/server.mjs
```

**Config JSON (Claude Desktop / clientes MCP genéricos):**
```json
{
  "mcpServers": {
    "contaazul": {
      "command": "node",
      "args": ["/root/mvolker/mcp/contaazul/src/server.mjs"]
    }
  }
}
```

No OpenClaw, registre o mesmo comando como servidor MCP stdio e libere-o **só para o
agente que precisa do financeiro** (veja `ESTRUTURA.md` §3 e §6 — menos contexto e menos
superfície de risco).

## Segurança

- `.env` e `tokens.json` **nunca** vão para o Git (já estão no `.gitignore`).
  A Conta Azul exclui a aplicação sem aviso se as credenciais vazarem.
- Mantenha `CONTAAZUL_ALLOW_WRITE=0` enquanto os agentes recebem conteúdo externo
  (email/WhatsApp): um texto malicioso poderia induzir lançamentos ou baixas.
- As URLs de autenticação e da API são configuráveis no `.env` caso a documentação
  oficial indique valores diferentes dos padrões.
