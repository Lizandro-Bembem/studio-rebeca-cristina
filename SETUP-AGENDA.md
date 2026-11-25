# Agenda online — guia de configuração

## Como funciona
1. A cliente cria a conta no site (nome, WhatsApp e senha) ou entra com WhatsApp e senha.
2. Ela escolhe serviço, dia e horário e envia o pedido. Os horários já confirmados não aparecem.
3. A cliente recebe no WhatsApp: "Recebemos o seu pedido..." (modelo `agendamento_recebido`).
4. A Rebeca recebe uma **notificação** no celular com os dados do pedido.
5. Ao tocar na notificação, o app abre a janela **"Adicionar Agendamento?"**.
   - **Adicionar** → o horário entra na página **Agendamentos**. Se já houver alguém no horário, aparece um **aviso**.
     A cliente recebe a confirmação no WhatsApp (modelo `agendamento_confirmado`).
   - **Recusar** → abre o WhatsApp da Rebeca com a mensagem "horário indisponível" e a lista de dias e horários livres.

Enquanto a API do WhatsApp não estiver ativa, ao tocar em **Adicionar** o WhatsApp da Rebeca abre com a
confirmação pronta e ela só aperta enviar. Quando a API for ativada, a mensagem passa a sair sozinha.

## Arquivos
| Arquivo | O que faz |
|---|---|
| `config.js` | Chaves públicas (Supabase e notificações) |
| `app.js` | Login, cadastro e envio do pedido no site |
| `admin.html` / `admin.js` | Página **Agendamentos** da Rebeca |
| `sw.js` | App offline + notificações |
| `supabase/migrations/` | Tabelas e regras de segurança |
| `supabase/functions/` | Funções do servidor: `cadastro`, `agendar`, `decidir`, `recuperar-senha`, `redefinir-senha` |

## Segredos do servidor (Supabase → Edge Functions → Secrets)
| Nome | Valor |
|---|---|
| `ADMIN_TELEFONE` | WhatsApp da Rebeca (a conta criada com esse número vira administradora) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Chaves das notificações |
| `WHATSAPP_TOKEN` | Token permanente da API do WhatsApp (Meta) |
| `WHATSAPP_PHONE_ID` | ID do número na API do WhatsApp (Meta) |
| `BREVO_API_KEY` | Chave da API do Brevo (e-mails de "Esqueci minha senha") |
| `EMAIL_REMETENTE` | E-mail remetente verificado no Brevo |

## Modelos de mensagem para criar na Meta (categoria: Utilidade, idioma: Português (BR))

**`agendamento_recebido`**
```
Olá, {{1}}! Recebemos o seu pedido de agendamento no Studio Rebeca Cristina 💅

Serviço: {{2}}
Dia: {{3}}
Horário: {{4}}

Assim que a Rebeca confirmar, você recebe a confirmação aqui.
```

**`agendamento_confirmado`**
```
MENSAGEM AUTOMÁTICA

Agendamento realizado! ✅
Você marcou um serviço de {{1}} com a profissional Rebeca Cristina no dia {{2}} às {{3}}.

*Nossa tolerância para atraso é de 20 minutos. Após esse tempo seu horário é cancelado ou seu serviço reduzido.

Caso precise desmarcar, por favor avise com antecedência.
```

## Ativar as notificações no iPhone da Rebeca (iOS 16.4 ou mais novo)
1. Abrir o site no **Safari** → Compartilhar → **Adicionar à Tela de Início**.
2. Abrir o app pela Tela de Início → menu → **Agendamentos** → entrar com o WhatsApp e a senha dela.
3. Tocar em **Ativar** (notificações) e permitir.

## Mudou horários, serviços ou dias de atendimento?
Atualize nos **três** lugares: `script.js` (CONFIG), `admin.js` (SERVICOS/HORARIOS) e
`supabase/functions/_shared/comum.ts` (STUDIO). Depois aumente a versão no topo do `sw.js`.
