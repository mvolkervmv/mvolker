# Agente de IA (OpenClaw + Claude) na Hostinger — configuração que funciona

Documentação da configuração **real e funcionando** do agente OpenClaw usando a
**assinatura do Claude** (sem gastar créditos de API), num VPS Hostinger.

- **VPS:** Hostinger, Ubuntu, `srv1571237`
- **OpenClaw:** 2026.4.8 · **Claude Code:** 2.1.220
- **Modelo:** `claude-cli/claude-sonnet-4-6` (backend Claude CLI = assinatura)
- **Canal ativo:** Telegram (`@valeriavira_bot`) ✅
- **Pendente:** Email (Office 365) e WhatsApp

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

O gateway roda **solto** (não use systemd — veja a seção 5).

```bash
pkill -9 -f openclaw; sleep 3
set -a; . /root/.openclaw/gateway.env; set +a
nohup setsid openclaw gateway >/root/.openclaw/_gw_manual.log 2>&1 </dev/null & disown
sleep 22
openclaw health
```

Ou use o script pronto: `sudo bash restart-gateway.sh`

**Persistência no boot** — cron `@reboot` (já instalado):
```
@reboot /bin/bash -lc "set -a; . /root/.openclaw/gateway.env; exec setsid openclaw gateway >/root/.openclaw/_gw_boot.log 2>&1"
```

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
| Rodar o gateway via **systemd** | O OpenClaw se autogerencia e é morto com `SIGKILL` (`already running under systemd`). Rodou 106 dias estável no modo solto. |
| Passar a credencial por **variável de ambiente** | O OpenClaw remove `CLAUDE_CODE_OAUTH_TOKEN` do processo filho. Use o login em disco. |
| Escolher **"Anthropic setup-token"** no configure | Vai para a API paga → erro de billing. Use **"Anthropic Claude CLI"**. |
| Deixar dois gateways rodando | Um bloqueia o outro (`already running`) e o bot para de responder. |

---

## 6. Pendências

- [ ] **Segurança:** rotacionar o token do bot Telegram (@BotFather → `/revoke`) e o
      token do gateway — ambos foram expostos durante o setup.
- [ ] **Segurança:** `channels.telegram.dmPolicy` está `open` (qualquer um conversa com
      o bot e consome sua assinatura). Restringir ao seu ID.
- [ ] **Email Office 365** — não há canal de email nativo no OpenClaw; precisa ser
      conectado via **MCP**.
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
