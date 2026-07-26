# Agente de IA (OpenClaw + Claude) na Hostinger

Kit de instalação para rodar um **agente de IA self-hosted** — o [OpenClaw](https://openclaw.ai)
usando o **Claude** da Anthropic — num **VPS da Hostinger**, com o agente respondendo
**email** e **WhatsApp**.

> ⚠️ **Leia antes de começar.** Este guia envolve custos (API da Anthropic), riscos
> (WhatsApp não-oficial pode banir o número) e acesso ao shell do servidor. Veja a
> seção [Avisos importantes](#avisos-importantes).

---

## 1. O que você vai precisar

| Item | Detalhe |
|------|---------|
| **VPS na Hostinger** | Plano VPS (KVM 2 ou superior recomendado: 2 vCPU / 8 GB RAM). Hospedagem compartilhada **não serve**. |
| **Sistema** | Ubuntu 22.04 ou 24.04 (na criação do VPS, escolha essa imagem). |
| **Acesso SSH** | Usuário root e o IP do VPS (o hPanel da Hostinger mostra isso). |
| **API key da Anthropic** | Crie em https://console.anthropic.com → *API Keys*. Precisa de crédito/cartão. |
| **Número de WhatsApp** | De preferência um número **secundário/dedicado** (risco de ban — veja avisos). |
| **Conta Gmail** | Para o canal de email (configuração OAuth). |

---

## 2. Passo a passo

### 2.1 Criar o VPS na Hostinger
1. hPanel → **VPS** → *Comprar/Gerenciar*.
2. Escolha o plano (mín. KVM 2) e **Ubuntu 24.04** como sistema operacional.
3. Defina a senha de root e anote o **IP** do servidor.

### 2.2 Conectar via SSH
No seu computador (terminal / PowerShell):
```bash
ssh root@SEU_IP_DO_VPS
```
Digite a senha de root quando pedir.

### 2.3 Rodar o script de instalação
Copie o script `setup-vps.sh` deste repositório para o VPS e execute. A forma mais
rápida — cole isto no terminal do VPS:
```bash
curl -fsSL https://raw.githubusercontent.com/mvolkervmv/mvolker/claude/hostinger-ia-agent-setup-bo8neg/setup-vps.sh -o setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```
O script instala Node.js 22, firewall (UFW), o OpenClaw, cria um usuário dedicado
`openclaw` e configura o serviço para iniciar sozinho.

### 2.4 Configurar a API key e canais
Depois da instalação, edite o arquivo de configuração:
```bash
nano /home/openclaw/.openclaw/.env
```
Preencha pelo menos:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
```
(Use `.env.example` deste repositório como referência dos campos.)

### 2.5 Ligar o WhatsApp (QR code)
```bash
sudo -u openclaw openclaw channel whatsapp login
```
Vai aparecer um **QR code** no terminal. No celular: WhatsApp → *Aparelhos conectados*
→ *Conectar aparelho* → aponte para o QR. Pronto, o agente passa a responder mensagens.

### 2.6 Ligar o Email (Gmail)
```bash
sudo -u openclaw openclaw channel email login
```
Siga o link de autorização OAuth do Google e conceda acesso à conta. O agente passa a
ler e responder emails.

### 2.7 Iniciar o serviço
```bash
sudo systemctl enable --now openclaw
sudo systemctl status openclaw      # verificar se está rodando
journalctl -u openclaw -f            # ver os logs ao vivo
```

---

## 3. Como usar / personalizar
- **Instruções do agente** (personalidade, regras de resposta): edite
  `/home/openclaw/.openclaw/AGENT.md`. É aqui que você diz coisas como *"responda
  emails de forma formal, em português, e sempre confirme comigo antes de enviar"*.
- **Comandos úteis:**
  ```bash
  sudo systemctl restart openclaw    # reiniciar após mudar config
  sudo -u openclaw openclaw status   # status dos canais
  ```

---

## 4. Avisos importantes

- **Custo da API:** cada resposta consome tokens do Claude (pago por uso). Comece com
  um limite de gasto no console da Anthropic para não ter surpresa.
- **Risco no WhatsApp:** o OpenClaw usa o protocolo multi-dispositivo **não-oficial**.
  A Meta pode **banir o número**. Nunca use seu número pessoal principal — use um chip
  dedicado. Para uso empresarial sério, o ideal seria migrar para a **API oficial do
  WhatsApp Business** (Cloud API) mais adiante.
- **Segurança:** o agente pode executar comandos no servidor. Mantenha este VPS
  **isolado** (não use o mesmo servidor de um site em produção), troque a senha de root
  por chave SSH, e mantenha o firewall ativo (o script já configura o UFW).
- **Revisão humana:** recomendo começar com o agente em modo "rascunho" (ele prepara a
  resposta e você aprova) antes de deixar 100% automático. Ajuste isso no `AGENT.md`.

---

## 5. Arquivos deste kit
| Arquivo | Função |
|---------|--------|
| `setup-vps.sh` | Script de instalação automática no VPS Ubuntu. |
| `openclaw.service` | Definição do serviço systemd (o script já instala). |
| `.env.example` | Modelo das variáveis de ambiente (API key, canais). |
| `AGENT.example.md` | Modelo de instruções de comportamento do agente. |

---

## Dúvidas
Se algo falhar na instalação, rode `journalctl -u openclaw -n 100` no VPS e me mande a
saída — eu ajusto o script/config.
