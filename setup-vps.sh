#!/usr/bin/env bash
#
# setup-vps.sh — Instala o OpenClaw (agente de IA com Claude) num VPS Ubuntu.
# Testado em Ubuntu 22.04 / 24.04. Rode como root:  ./setup-vps.sh
#
set -euo pipefail

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode como root:  sudo ./setup-vps.sh"

OC_USER="openclaw"
OC_HOME="/home/${OC_USER}"
OC_DIR="${OC_HOME}/.openclaw"

log "Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git ca-certificates ufw build-essential

log "Configurando firewall (UFW)"
ufw allow OpenSSH || ufw allow 22/tcp
ufw --force enable

log "Instalando Node.js 22 (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
log "Node: $(node -v)  |  npm: $(npm -v)"

log "Criando usuário dedicado '${OC_USER}'"
if ! id "${OC_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${OC_USER}"
fi
mkdir -p "${OC_DIR}"

log "Instalando o OpenClaw (npm global)"
npm install -g openclaw@latest || die "Falha ao instalar o OpenClaw via npm"

log "Criando arquivos de configuração"
if [ ! -f "${OC_DIR}/.env" ]; then
  cat > "${OC_DIR}/.env" <<'ENVEOF'
# === Chave da Anthropic (obrigatória) ===
ANTHROPIC_API_KEY=

# Modelo do Claude a usar
ANTHROPIC_MODEL=claude-opus-4-8

# Fuso horário
TZ=America/Sao_Paulo
ENVEOF
  warn "Edite ${OC_DIR}/.env e preencha ANTHROPIC_API_KEY"
fi

if [ ! -f "${OC_DIR}/AGENT.md" ]; then
  cat > "${OC_DIR}/AGENT.md" <<'AGENTEOF'
# Instruções do agente

Você é meu assistente pessoal. Responda em português do Brasil.

## Email
- Leia e resuma emails novos.
- Para responder, PREPARE um rascunho e me peça confirmação antes de enviar.
- Tom profissional e cordial.

## WhatsApp
- Responda mensagens de forma breve e educada.
- Se não souber algo, diga que vai verificar comigo.

## Regras gerais
- Nunca envie nada financeiro/sensível sem minha aprovação explícita.
AGENTEOF
fi

chown -R "${OC_USER}:${OC_USER}" "${OC_HOME}"
chmod 600 "${OC_DIR}/.env"

log "Instalando serviço systemd"
cat > /etc/systemd/system/openclaw.service <<SVCEOF
[Unit]
Description=OpenClaw AI Agent (Claude)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${OC_USER}
WorkingDirectory=${OC_DIR}
EnvironmentFile=${OC_DIR}/.env
ExecStart=/usr/bin/openclaw serve
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload

log "Instalação concluída!"
cat <<'NEXT'

Próximos passos (rode no VPS):

  1) Edite a chave da API:
       nano /home/openclaw/.openclaw/.env      (preencha ANTHROPIC_API_KEY)

  2) Conecte o WhatsApp (vai mostrar um QR code):
       sudo -u openclaw openclaw channel whatsapp login

  3) Conecte o email (Gmail via OAuth):
       sudo -u openclaw openclaw channel email login

  4) Inicie o serviço:
       sudo systemctl enable --now openclaw
       sudo systemctl status openclaw
       journalctl -u openclaw -f

NEXT
