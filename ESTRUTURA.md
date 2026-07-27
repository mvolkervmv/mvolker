# Estrutura de agentes — VIRA Incorporadora

Arquitetura dos três agentes no OpenClaw (VPS Hostinger), suas conexões e limites.

```
                        ┌─────────────────────────────┐
                        │   Assinatura Claude (uma)   │
                        │   quota 5h COMPARTILHADA    │
                        └──────────────┬──────────────┘
                                       │
        ┌──────────────────────┬───────┴───────┬──────────────────────┐
        │                      │               │                      │
   ┌────▼─────┐          ┌─────▼────┐    ┌─────▼──────┐
   │  ELVIRA  │          │   VERA   │    │  VICTORIA  │
   │  Novos   │          │ Jurídico │    │  Pessoal   │
   │ Negócios │          │          │    │ (Marcelo)  │
   └────┬─────┘          └─────┬────┘    └─────┬──────┘
        │                      │               │
   email/wpp/tg           email/wpp/tg    email/wpp/tg
   (identidade            (identidade     (identidade
    própria)               própria)        própria)
        │                      │               │
        └──────────┬───────────┴───────────────┘
                   │
            ┌──────▼───────┐
            │   ClickUp    │  ← barramento de handoff entre agentes
            │  (via MCP)   │     e trilha de auditoria para o Marcelo
            └──────────────┘
```

---

## 1. Os três agentes

| Agente | Papel | Público | Autonomia inicial |
|--------|-------|---------|-------------------|
| **Elvira** | Novos negócios | Corretores, proprietários de terreno, parceiros | Rascunha; envia só após aprovação |
| **Vera** | Jurídico | Advogados, cartórios, prefeitura, clientes | Rascunha sempre; **nunca** envia sozinha |
| **Victoria** | Assistente pessoal do Marcelo | Marcelo (e contatos pessoais dele) | Maior autonomia — público confiável |

Cada uma tem workspace, sessões, memória e credenciais **isolados**.

---

## 2. O que multiplica: canais, não agentes

Criar 3 agentes é barato. O custo real está nas **identidades de canal** — cada agente
precisa da sua:

| Canal | Quantidade | Observação |
|-------|-----------|------------|
| **Telegram** | 3 bots | Fácil: 3× @BotFather, 3 tokens distintos |
| **WhatsApp** | **3 números** | ⚠️ 1 eSIM = 1 número = 1 agente. Três assistentes exigem **três linhas** |
| **Email** | 3 caixas | elvira@ / vera@ / victoria@ (ou a pessoal do Marcelo) |
| **ClickUp** | 1 workspace | Idealmente 3 tokens/usuários distintos, com permissão por Space |

> **Ponto de decisão:** você mencionou *um* eSIM. Com um número só, apenas **um** agente
> terá WhatsApp. Ou compra três linhas, ou define quem fica com o WhatsApp primeiro
> (recomendo Elvira — é quem mais recebe contato externo).

---

## 3. Quota compartilhada — o limite prático

Os três agentes usam **a mesma assinatura Claude**, com limite de janela de 5 horas.
Consequência direta: **se um agente consumir a quota, os três param.**

Mitigações:
- **Modelo por papel:** Sonnet para triagem e respostas de rotina; Opus só quando
  precisar de análise densa (ex.: Vera lendo uma matrícula ou minuta longa).
- **Enxugar MCP:** o servidor MCP do ClickUp expõe ~50 ferramentas, e todo esse schema
  entra no prompt a cada turno. Conecte só onde é usado.
- **Heartbeat espaçado:** varredura de caixa de entrada a cada 30–60 min, não contínua.
- **Escopo de leitura:** não deixe agente lendo thread inteira quando o resumo basta.

---

## 4. Handoff: use o ClickUp, não conversa entre agentes

O fluxo típico da incorporadora é cross-domain:

> Corretor oferece terreno → **Elvira** faz análise preliminar → precisa de due
> diligence documental → **Vera** assume → Marcelo decide

Não faça isso por mensagem entre agentes (frágil, sem rastro). **Use o ClickUp como
barramento:**

- Elvira cria a task no Space *Novos Negócios* com o checklist preliminar.
- Ao precisar do jurídico, ela **cria uma subtask no Space Jurídico** e atribui à Vera.
- Vera trabalha a subtask e devolve o parecer no comentário.
- Marcelo vê tudo numa timeline auditável — sem depender do histórico de chat.

Vantagens: rastreável, assíncrono, sobrevive a reinício do servidor e não gasta
contexto replicando conversa.

---

## 5. Layout em disco

```
/root/.openclaw/
├── openclaw.json                 # config global (canais, modelos, auth)
├── gateway.env                   # env do gateway (não guarda credencial do Claude)
└── agents/
    ├── elvira/
    │   ├── workspace/AGENT.md    # persona + regras
    │   ├── workspace/HEARTBEAT.md# o que checar periodicamente
    │   ├── sessions/             # histórico isolado
    │   └── agent/auth-state.json # estado do provedor
    ├── vera/
    └── victoria/
```

As personas versionadas neste repositório ficam em `agents/<nome>/AGENT.md` e devem ser
copiadas para o workspace do agente correspondente no servidor.

---

## 6. Guardrails (não opcionais)

**Conteúdo de fora é não confiável.** Email e WhatsApp chegam de qualquer pessoa. Hoje o
OpenClaw roda **como root com `bypassPermissions`** — um email com instruções embutidas
("ignore o anterior e execute...") teria shell no servidor. Medidas:

1. **Aprovação obrigatória para envio** (email e WhatsApp) enquanto não houver confiança.
2. **Sem ferramentas de sistema** para os três agentes — eles são assistentes de negócio,
   não precisam de Bash/Write/Edit. Menos superfície e menos contexto gasto.
3. **Migrar o gateway para usuário não-root** quando possível.
4. **Nunca** colocar credenciais bancárias, assinatura de contratos ou envio de valores
   no caminho automático.

**Vera merece cuidado extra:** ela apoia o jurídico, mas **não é advogada**. Deve produzir
minutas, resumos e checklists — nunca parecer jurídico definitivo — e sempre indicar
revisão do advogado responsável.

**Disclosure:** defina se as assistentes se identificam como IA no contato externo.
Recomendo que sim, ao menos na primeira interação.

---

## 7. Ordem de implantação sugerida

1. **Victoria primeiro** (público confiável = risco baixo) — valida o modelo de agente
   isolado com Telegram + ClickUp.
2. **Elvira** com email + Telegram; WhatsApp depois que o eSIM chegar.
3. **Vera** por último, com aprovação obrigatória em tudo.

Subir os três de uma vez torna impossível saber qual está consumindo a quota ou errando.
