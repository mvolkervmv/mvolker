# Agente de IA (OpenClaw + Claude) na Hostinger — configuração que funciona

Documentação da configuração **real e funcionando** do agente OpenClaw usando a
**assinatura do Claude** (sem gastar créditos de API), num VPS Hostinger.

- **VPS:** Hostinger, Ubuntu, `srv1571237`
- **OpenClaw:** 2026.7.1-2 · **Claude Code:** 2.1.220 · **Node:** 22.23.1
- **Modelo:** `claude-cli/claude-sonnet-4-6` (backend Claude CLI = assinatura)
- **Agentes:** `main`, `elvira` 🏗️, `vera` ⚖️, `victoria` 📋 — um bot Telegram cada ✅
- **Pendente:** ClickUp por agente, email (Office 365) e WhatsApp

> **Node ≥ 22.22.3 é requisito** da 2026.7.x. Atualizar o OpenClaw sem atualizar o Node
> deixa o binário instalado porém inexecutável (`openclaw` recusa a rodar).

Arquitetura dos três agentes: veja [`ESTRUTURA.md`](ESTRUTURA.md).

---

## 1. A peça-chave: o wrapper do `claude`

Este é **o ajuste que fez tudo funcionar**. Sem ele, o agente responde
*"Not logged in · Please run /login"* ou erro de billing.

**Por quê:** o OpenClaw invoca o `claude` com a variável
`CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST=1`, que manda o Claude Code **ignorar o login
salvo em disco** e esperar credencial do host — que o OpenClaw não fornece. Além
disso, o Claude Code recusa `--permission-mode bypassPermissions` rodando como root
(resolvido com `IS_SANDBOX=1`).

O wrapper fica em `/usr/bin/claude`, e o binário original foi movido para
`/usr/bin/claude-real`:

```bash
#!/bin/bash
export HOME=/root
export IS_SANDBOX=1                        # permite bypassPermissions como root
unset CLAUDE_CODE_OAUTH_TOKEN              # usa o login salvo em disco
unset CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST # <<< SEM ISSO NAO FUNCIONA
exec /usr/bin/claude-real "$@"
```

> ⚠️ **Se atualizar o Claude Code via npm, o wrapper é sobrescrito.** Reinstale com
> `sudo bash install-claude-wrapper.sh` (script neste repositório).

---

## 2. Como iniciar / reiniciar o agente

A partir da **2026.7.x** o OpenClaw se supervisiona sozinho por um serviço **systemd de
usuário** (`openclaw-gateway.service`). Use o mecanismo dele — **não** inicie por
`nohup`/cron em paralelo, senão dá conflito de porta e `lock timeout`.

```bash
openclaw gateway status     # estado do serviço + conectividade
openclaw gateway restart
openclaw gateway stop
openclaw gateway install    # (re)instala o unit para a versão atual
```

Equivalentes via systemd:
```bash
systemctl --user status  openclaw-gateway
systemctl --user restart openclaw-gateway
```

### ⚠️ Linger — obrigatório

Serviço de usuário **morre quando a sessão SSH encerra**. Sem isto, o bot para de
responder assim que você desconecta:

```bash
loginctl enable-linger root
loginctl show-user root | grep -i linger    # deve dizer Linger=yes
```

**Teste correto de persistência:** saia do SSH (`exit`), espere ~2 min e mande mensagem
para um bot. Testar com a sessão aberta não prova nada.

---

## 3. Autenticação (assinatura, não API paga)

O agente usa sua **assinatura Claude**, via login persistente do Claude Code:

```bash
claude          # faz /login interativo, salva credencial em disco
```
Credenciais ficam em `/root/.claude.json` e `/root/.claude/.credentials.json`.

Verificar se está válido:
```bash
claude -p "diga apenas ok"     # deve responder
```

No OpenClaw, o provedor está configurado como **Anthropic → Claude CLI**
(`openclaw configure` → Model → Anthropic → *Anthropic Claude CLI*), o que resulta em
`"primary": "claude-cli/claude-sonnet-4-6"` no `openclaw.json`.

---

## 4. Diagnóstico rápido

```bash
openclaw health                              # canais + agente
tail -f /root/.openclaw/_gw_manual.log       # log do gateway
grep -o '"primary":"[^"]*"' /root/.openclaw/openclaw.json   # modelo em uso
```

**Se voltar erro de billing:** o OpenClaw desativa o provedor por 5h após uma falha.
Limpe o estado e reinicie:
```bash
printf '{\n  "version": 1\n}\n' > /root/.openclaw/agents/main/agent/auth-state.json
```

Veja `TROUBLESHOOTING.md` para o histórico completo de erros e causas.

---

## 5. Armadilhas conhecidas (não repita)

| ❌ Não faça | Por quê |
|------------|---------|
| Iniciar por `nohup`/cron **junto** com o serviço | A 2026.7.x supervisiona via systemd de usuário. Dois starts = `lock timeout` + porta 18789 ocupada, e o bot para. Use `openclaw gateway start/restart`. |
| Criar um unit systemd **próprio** | Na 2026.4.x isso causava `SIGKILL`/`already running under systemd`. Use o unit oficial (`openclaw gateway install`). |
| Esquecer o **linger** | Serviço de usuário morre no logout do SSH. `loginctl enable-linger root`. |
| Passar a credencial por **variável de ambiente** | O OpenClaw remove `CLAUDE_CODE_OAUTH_TOKEN` do processo filho. Use o login em disco. |
| Escolher **"Anthropic setup-token"** no configure | Vai para a API paga → erro de billing. Use **"Anthropic Claude CLI"**. |
| Atualizar o OpenClaw sem checar o **Node** | A 2026.7.x exige Node ≥ 22.22.3; abaixo disso o binário não executa. |

---

## 6. Pendências

- [ ] **Segurança:** rotacionar o token do bot Telegram original (@BotFather → `/revoke`)
      e o token do gateway — ambos foram expostos durante o setup.
- [x] **Segurança:** `dmPolicy` do Telegram passou de `open` para `allowlist`; contas
      novas usam pareamento (`openclaw pairing approve telegram <código>`).
- [ ] **Ferramentas por agente:** tirar Bash/Write/Edit de Elvira, Vera e Victoria —
      são assistentes de negócio, não precisam de shell (veja `ESTRUTURA.md` §6).
- [ ] **ClickUp por agente** — usar `openclaw mcp tools` para filtrar as ~50 ferramentas
      e reduzir consumo de contexto.
- [ ] **Email Office 365** — MCP `o365` (`@softeria/ms-365-mcp-server`) já configurado
      para uma conta; cada caixa adicional exige uma instância própria.
- [ ] **Conta Azul** — MCP local em `mcp/contaazul/` pronto; falta instalar no VPS,
      rodar `npm run auth` e liberar para o agente do financeiro.
- [ ] **WhatsApp** — pendente do eSIM. Usar número dedicado (risco de ban pela Meta).

---

## Arquivos deste repositório

| Arquivo | Função |
|---------|--------|
| `install-claude-wrapper.sh` | Instala/reinstala o wrapper (rode após update do npm). |
| `restart-gateway.sh` | Reinicia o gateway do jeito correto. |
| `gateway.env.example` | Modelo do `/root/.openclaw/gateway.env`. |
| `AGENT.example.md` | Modelo de instruções de comportamento do agente. |
| `TROUBLESHOOTING.md` | Histórico de erros, causas e soluções. |
| `mcp/contaazul/` | Servidor MCP local da API v2 da Conta Azul (ver README próprio). |
