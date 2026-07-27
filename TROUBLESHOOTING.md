# Histórico de erros e soluções

Cada erro enfrentado até o agente responder, com a causa real e a correção.
Ordem cronológica — a última é a que destravou tudo.

---

### 1. `API provider returned a billing error / run out of credits`
**Causa:** o método **"Anthropic setup-token"** no `openclaw configure` envia o token
para a **API paga** da Anthropic (crédito pré-pago), não para a assinatura.
Além disso, o perfil ficava `"mode": "token"` **sem token salvo** — nada em
`~/.openclaw/credentials/`.
**Solução:** usar o método **"Anthropic Claude CLI"**, que faz o OpenClaw chamar o
binário `claude` local (assinatura). Modelo passa a ser `claude-cli/...`.

---

### 2. `Claude CLI is not authenticated on this host. Run claude auth login first`
**Causa:** `claude setup-token` gera um token para a variável
`CLAUDE_CODE_OAUTH_TOKEN`, mas **não deixa a CLI logada em disco**.
**Solução:** rodar `claude` interativamente e fazer `/login` (assinatura). Credenciais
ficam em `/root/.claude.json` e `/root/.claude/.credentials.json`.

---

### 3. Variável de ambiente não chega ao agente
**Sintoma:** `CLAUDE_CODE_OAUTH_TOKEN` definida ao iniciar o gateway, mas
`grep -c` no `/proc/<pid>/environ` do gateway retornava `0`.
**Causa:** o OpenClaw **remove** essa variável do processo. `OPENCLAW_NO_RESPAWN=1`
não muda isso.
**Solução:** abandonar o env; usar o login persistente em disco (item 2).

---

### 4. `Provider claude-cli has billing issue (skipping all models)`
**Causa:** *circuit breaker*. Após uma falha de billing, o OpenClaw grava em
`/root/.openclaw/agents/main/agent/auth-state.json`:
```json
"anthropic:claude-cli": { "disabledUntil": <+5h>, "disabledReason": "billing" }
```
e **para de tentar** — mesmo após a credencial ser corrigida ("skipping all models"
aparece já no primeiro candidato).
**Solução:** resetar o arquivo:
```bash
printf '{\n  "version": 1\n}\n' > /root/.openclaw/agents/main/agent/auth-state.json
```

---

### 5. `--dangerously-skip-permissions cannot be used with root/sudo privileges`
**Causa:** o OpenClaw chama o `claude` com `--permission-mode bypassPermissions`, que o
Claude Code recusa rodando como root.
**Solução:** `IS_SANDBOX=1` no ambiente do `claude` (VPS dedicado = ambiente isolado).

---

### 6. `Not logged in · Please run /login` — **o nó final**
**Sintoma:** `claude -p "ok"` funcionava manualmente; o replay do comando **exato** do
OpenClaw (mesmas flags, mesmo `--resume`, mesmo `stream-json`, mesmo cwd) também
funcionava — mas pelo OpenClaw sempre falhava. O `init` do stream-json subia bem
(`apiKeySource: "none"`), e só a chamada retornava `is_error: true`.

**Como foi achado:** comparando o **ambiente completo** do processo:
```bash
# no wrapper:  env | sort > /root/env-openclaw.txt
env | sort > /root/env-manual.txt
comm -23 /root/env-openclaw.txt /root/env-manual.txt
```

**Causa:** o OpenClaw define
```
CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST=1
```
Isso diz ao Claude Code que **o host gerencia as credenciais** — então ele ignora o
login salvo em disco e espera receber a credencial do OpenClaw, que não a fornece
(ele mesmo removeu o token do ambiente, item 3).

**Solução:** `unset CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` no wrapper. ✅

---

## Hipóteses testadas e descartadas

| Hipótese | Teste | Resultado |
|----------|-------|-----------|
| Falta de memória (OOM) | `free -h`, `dmesg` | 7,2 GB livres, zero OOM |
| systemd necessário | unit próprio | **Piorou** — `SIGKILL`, gateway rodava solto há 106 dias |
| `HOME` errado no gateway | `/proc/<pid>/environ` | `HOME=/root`, correto |
| Flags `--setting-sources` / `bypassPermissions` | replay manual | Funcionaram |
| `stream-json` / `--mcp-config` / `--resume` | replay manual | Funcionaram |
| Concorrência entre processos `claude` | `flock` no wrapper | Não resolveu |
| Sessão antiga corrompida (106 dias) | replay com `--resume` | Funcionou |

---

## Comandos de diagnóstico úteis

```bash
# erros legíveis do log
grep -a '"logLevelName":"ERROR"' /tmp/openclaw/openclaw-$(date +%F).log \
  | grep -v "pairing required" | tail -3 | sed -E 's/.*\{"0":"([^"]{10,400})".*/\1/'

# testar o agente sem passar pelo Telegram
openclaw agent --agent main -m "diga apenas ok"

# ver o que o OpenClaw passa ao claude (instale um wrapper que loga "$@")
# ver provedor bloqueado
grep -o 'disabledReason[^,}]*' /root/.openclaw/agents/main/agent/auth-state.json
```
