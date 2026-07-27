#!/usr/bin/env bash
#
# install-claude-wrapper.sh
#
# Instala o wrapper do `claude` que permite ao OpenClaw usar a ASSINATURA do Claude.
# Rode como root. Idempotente — pode rodar quantas vezes quiser.
#
# QUANDO RODAR: após qualquer `npm install -g @anthropic-ai/claude-code` ou
# `openclaw update`, pois o binário original é reinstalado por cima do wrapper.
#
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode como root"; exit 1; }

REAL=/usr/bin/claude-real
LINK=/usr/bin/claude

# Se o wrapper já está instalado e o real existe, só reescreve o wrapper.
if [ ! -e "$REAL" ]; then
  echo "Movendo binário original para $REAL"
  mv "$LINK" "$REAL"
fi

cat > "$LINK" <<'EOF'
#!/bin/bash
# Wrapper que permite ao OpenClaw usar a assinatura do Claude (não a API paga).
export HOME=/root
export IS_SANDBOX=1                        # permite bypassPermissions rodando como root
unset CLAUDE_CODE_OAUTH_TOKEN              # usa o login persistente em disco
unset CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST # sem isso o Claude ignora o login salvo
exec /usr/bin/claude-real "$@"
EOF
chmod +x "$LINK"

echo "Wrapper instalado. Teste:"
echo '  claude -p "diga apenas ok"'
