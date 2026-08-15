# Configuração de produção

Este runbook configura Next.js/Vercel + Neon PostgreSQL + Cloudflare R2 +
Resend + Pusher sem colocar credenciais no repositório.

## 1. Neon PostgreSQL

1. Crie um projeto e um banco para Production.
2. Crie uma branch/banco separado para Preview; nunca aponte Preview para o
   banco de Production.
3. Copie duas URLs:
   - pooled (`-pooler` no hostname) para `DATABASE_URL`;
   - direta/unpooled (sem `-pooler`) para `DIRECT_URL`.
4. Preserve `sslmode=require` e `channel_binding=require` quando a Neon os
   fornecer.
5. Configure `DATABASE_ADAPTER=neon` na Vercel.
6. No GitHub, crie o environment `production`, restrinja-o à branch `main`,
   configure required reviewers e adicione somente o secret
   `NEON_DIRECT_URL`.
7. Antes do primeiro deploy do app, execute o workflow manual
   `Deploy production migrations` a partir da `main`. Ele serializa
   `prisma migrate deploy` e recusa qualquer outra branch.
8. Crie também o environment `preview`, com proteção e o secret isolado
   `NEON_PREVIEW_DIRECT_URL`; execute `Deploy preview migrations` na branch que
   será validada antes de abrir o respectivo Preview.

O build da Vercel não executa migrations. Para mudanças de schema, não permita
que o auto-deploy de produção ultrapasse o workflow: use migrations compatíveis
com a versão anterior (expand/contract) ou desative a promoção automática e
promova o build somente depois da migration. Production e Preview usam
workflows, environments, secrets e branches de banco independentes.

### Catálogo legado

1. Faça snapshot/backup do Neon vazio.
2. Execute `LEGACY_SQLITE_PATH=... npm run db:migrate:legacy:check`.
3. Confirme as contagens.
4. Aplique a baseline com `npm run db:deploy`.
5. No catálogo ainda vazio, defina
   `LEGACY_MIGRATION_CONFIRM=IMPORT_LEGACY_CATALOG` e execute
   `npm run db:migrate:legacy` uma única vez.
6. Compare as contagens e faça smoke test de listagem/detalhe.
7. Provisione um admin novo com `npm run admin:provision` e credenciais inéditas.

O script não importa admins legados, hashes de senha ou rate limits. Se algo
falhar, ele não apaga dados; restaure o snapshot e investigue antes de repetir.

Referências: [Prisma + Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon) e
[Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy).

## 2. Cloudflare R2

1. Crie um bucket privado.
2. Crie um token S3 com `Object Read & Write`, restrito somente a esse bucket.
3. Configure um domínio público customizado para leitura e use sua origem HTTPS
   em `R2_PUBLIC_URL`. Desabilite o domínio `r2.dev` em produção.
4. Configure o CORS do bucket com origens exatas. URLs variáveis de Preview
   devem usar um alias estável ou ser cadastradas explicitamente; não use `*`.

Exemplo:

```json
[
  {
    "AllowedOrigins": [
      "https://www.seudominio.com",
      "https://preview.seudominio.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "If-None-Match",
      "x-amz-meta-upload-id",
      "x-amz-meta-property-id"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` e `R2_PUBLIC_URL` na Vercel.
6. Gere `CRON_SECRET` com pelo menos 32 caracteres. A Vercel chama a cada hora
   `/api/cron/cleanup-uploads` conforme `vercel.json`. Use um plano Vercel que
   aceite essa frequência ou um scheduler externo equivalente; manter o
   intervalo abaixo de 24 horas é necessário para retries idempotentes do
   Resend.
7. Faça um upload real JPEG/PNG/WebP, confirme a visualização pelo domínio
   público, remova a imagem e verifique o cleanup.

A URL assinada usa o endpoint S3 da R2, não o domínio público. Ela expira em
cinco minutos. Por definição, ela inclui o access-key ID no escopo da
credencial e uma assinatura temporária; o browser nunca recebe o secret access
key. O backend baixa o objeto com limite estrito, prende a leitura ao ETag e
valida metadados, tamanho, envelope, dimensões/pixels e decodificação completa
após o PUT. Exclusões ficam em uma fila durável até a URL assinada não poder
mais ser reutilizada; o cron revalida que nenhuma `Image` referencia a key antes
do DELETE externo.

Referências: [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) e
[CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## 3. Resend

1. Adicione um domínio/subdomínio de envio no Resend.
2. Publique os registros DNS fornecidos (SPF e DKIM). Configure DMARC conforme a
   política do domínio.
3. Aguarde o domínio ficar `verified`.
4. Crie uma API key com permissão de envio, restrita ao domínio quando possível.
5. Configure `RESEND_API_KEY`, `EMAIL_FROM` e `CONTACT_EMAIL` na Vercel.
6. Envie um lead controlado e valide recebimento, Reply-To e logs do Resend.

O lead é commitado no PostgreSQL antes do envio. Falha, timeout ou ausência de
credencial não perde o contato. A resposta HTTP não espera Resend/Pusher; o
trabalho pós-resposta e o cron processam o outbox com tentativas limitadas. A
chamada usa uma chave idempotente baseada no ID do lead, e o formulário usa um
UUID próprio para não criar outro lead quando a resposta ao cliente se perde.
Resultados `UNKNOWN` e tentativas interrompidas ainda em `PENDING` só são
reintentados dentro de uma margem de 23 horas da janela de idempotência do
Resend; depois disso ficam visíveis no painel para reconciliação manual,
evitando um segundo e-mail potencialmente duplicado.

Defina uma política organizacional de retenção para nome, e-mail, telefone e
mensagem armazenados em `Lead`. O projeto não apaga leads automaticamente sem
essa decisão de negócio; faça exportação/remoção controlada conforme a base
legal e o prazo aplicáveis.

Referências: [domínios](https://resend.com/docs/dashboard/domains/introduction) e
[idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys).

## 4. Pusher Channels

1. Crie um app Channels e selecione o cluster mais próximo.
2. Configure `PUSHER_APP_ID`, `PUSHER_SECRET`, `PUSHER_KEY`, `PUSHER_CLUSTER`,
   `NEXT_PUBLIC_PUSHER_KEY` e `NEXT_PUBLIC_PUSHER_CLUSTER`.
3. Os pares KEY e CLUSTER devem ser idênticos entre server/public.
4. Não habilite Client Events. Ative Authorized Connections se o plano permitir.
5. Abra duas sessões administrativas; altere um imóvel em uma e confirme o
   refetch na outra.

O único canal é `private-admin`. `/api/pusher/auth` exige a sessão administrativa
e aceita somente esse canal. Eventos carregam apenas `entityId`; nenhum dado de
lead é enviado ao Pusher.

Referência: [private channels](https://pusher.com/docs/channels/using_channels/private-channels/).

O E2E local/CI desabilita R2, Resend e Pusher no servidor iniciado pelo
Playwright, mesmo que o `.env` tenha credenciais. Para um smoke real, use somente
contas e destinatários controlados, configure as credenciais e habilite
explicitamente `PLAYWRIGHT_EXTERNAL_SMOKE=1` ao executar `npm run test:e2e`.
Esse modo pode enviar e-mail e publicar eventos reais de Resend/Pusher; confirme
também os logs dos provedores. O upload R2 do E2E permanece mockado: execute
separadamente o smoke real do passo 2 para validar CORS, PUT, HEAD/GET e domínio
público.

## 5. Vercel e variáveis por ambiente

Configure em Production e, com recursos isolados, em Preview:

```text
DATABASE_URL
DIRECT_URL
DATABASE_ADAPTER
JWT_SECRET
WHATSAPP_PHONE
SITE_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
RESEND_API_KEY
EMAIL_FROM
CONTACT_EMAIL
PUSHER_APP_ID
PUSHER_SECRET
PUSHER_KEY
PUSHER_CLUSTER
NEXT_PUBLIC_PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER
CRON_SECRET
```

`ADMIN_EMAIL` e `ADMIN_PASSWORD` são usados apenas por scripts controlados e não
precisam permanecer no runtime. Nunca crie `NEXT_PUBLIC_DATABASE_URL`,
`NEXT_PUBLIC_R2_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_RESEND_API_KEY` ou equivalente.
O seed de demonstração é bloqueado em produção; provisione ou rotacione apenas
o admin desejado com `npm run admin:provision`.

Ordem recomendada de release:

1. backup/snapshot do banco;
2. `prisma migrate deploy` pelo workflow protegido;
3. deploy Vercel;
4. smoke test público e administrativo;
5. teste real R2, Resend e Pusher;
6. verificação do cron e logs redigidos;
7. promoção de domínio/DNS.

Rotacione imediatamente qualquer segredo suspeito. Rotacionar `JWT_SECRET`
invalida todas as sessões administrativas existentes.
