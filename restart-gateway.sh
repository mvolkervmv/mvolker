#!/usr/bin/env bash
#
# restart-gateway.sh — Reinicia o gateway do OpenClaw do jeito correto.
#
# NÃO use systemd para isso: o OpenClaw se autogerencia e é morto com SIGKILL
# quando embrulhado num unit (mensagem "already running under systemd").
#
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode como root"; exit 1; }

echo "==> parando gateways existentes"
pkill -9 -f openclaw 2>/dev/null || true
sleep 3

# Limpa o "castigo" de billing (o OpenClaw desativa o provedor por 5h após 1 falha)
STATE=/root/.openclaw/agents/main/agent/auth-state.json
if [ -f "$STATE" ] && grep -q disabledReason "$STATE" 2>/dev/null; then
  echo "==> limpando bloqueio de provedor em auth-state.json"
  cp "$STATE" "$STATE.bak"
  printf '{\n  "version": 1\n}\n' > "$STATE"
fi

echo "==> subindo gateway"
set -a; . /root/.openclaw/gateway.env 2>/dev/null; set +a
nohup setsid openclaw gateway >/root/.openclaw/_gw_manual.log 2>&1 </dev/null & disown

echo "==> aguardando canais reconectarem (25s)"
sleep 25

echo "==> health"
openclaw health 2>&1 | grep -iE "telegram|agents" || openclaw health
echo "==> modelo"
grep -o '"primary":"[^"]*"' /root/.openclaw/openclaw.json
