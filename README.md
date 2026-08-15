# Lar Imóveis

Catálogo imobiliário em Next.js 16.3 (App Router), React 19, TypeScript,
Prisma 7 e Tailwind CSS 4, preparado para Vercel com PostgreSQL/Neon,
Cloudflare R2, Resend e Pusher Channels.

## Arquitetura

- Next.js na Vercel, com Server Components e Route Handlers no runtime Node.js.
- PostgreSQL como única base da aplicação. Em produção, Prisma usa
  `@prisma/adapter-neon` e a URL pooled da Neon.
- O adapter `pg` existe somente para PostgreSQL local/efêmero e para o CI; não
  há SQLite no runtime.
- Preços são `Decimal(14,2)`, tipos/finalidades são enums e leads permanecem no
  banco mesmo se o provedor de e-mail falhar.
- Imagens novas fazem PUT direto no R2 por URL assinada. O backend confirma
  tamanho, MIME, metadados, envelope, dimensões e decodificação completa antes
  de associar o upload.
- Uploads abandonados e exclusões que falham entram em limpeza durável pelo
  Vercel Cron horário, depois da janela de replay da URL assinada. O mesmo cron
  tenta novamente notificações de lead pendentes ou com falha transitória.
- Pusher usa somente `private-admin`; eventos são sinais e o dashboard relê o
  PostgreSQL como fonte de verdade.
- Autenticação administrativa por JWT HS256 em cookie HttpOnly, autorização
  revalidada no banco, same-origin nas mutações e rate limits persistentes.

O passo a passo de produção está em [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md).

## Requisitos

- Node.js 24.x
- npm
- PostgreSQL acessível (Neon ou PostgreSQL local)

## Desenvolvimento local

1. Copie `.env.example` para `.env` e configure, no mínimo,
   `DATABASE_URL`, `DIRECT_URL`, `DATABASE_ADAPTER`, `JWT_SECRET`,
   `WHATSAPP_PHONE` e `SITE_URL`. Para PostgreSQL local use
   `DATABASE_ADAPTER=pg`; para Neon use `neon`.
2. Instale as dependências (o `postinstall` executa `prisma generate`):

   ```bash
   npm install
   ```

3. Aplique a baseline PostgreSQL:

   ```bash
   npm run db:deploy
   ```

4. Em desenvolvimento/CI, carregue fixtures idempotentes se necessário:

   ```bash
   npm run seed
   ```

   O seed não apaga catálogo nem outros admins. Ele é destinado a
   desenvolvimento/CI e falha em produção sem a confirmação explícita
   `SEED_PRODUCTION_CONFIRM=UPSERT_DEMO_FIXTURES`. Em produção, use
   `npm run admin:provision`, que altera somente o admin informado.

5. Inicie o app:

   ```bash
   npm run dev
   ```

Site: <http://localhost:3000>

Painel: <http://localhost:3000/admin>

R2, Resend e Pusher são integrações opcionais no desenvolvimento: quando todo o
grupo de variáveis de um serviço está ausente, a função correspondente fica
desabilitada. Configuração parcial é rejeitada com erro explícito no servidor.

## Migração do SQLite legado

O histórico antigo foi preservado em `prisma/migrations-sqlite-legacy`; o Prisma
usa exclusivamente `prisma/migrations-postgresql`.

Validação somente leitura:

```bash
LEGACY_SQLITE_PATH=./dev.db npm run db:migrate:legacy:check
```

Importação para um catálogo PostgreSQL vazio:

```bash
LEGACY_SQLITE_PATH=./dev.db \
LEGACY_MIGRATION_CONFIRM=IMPORT_LEGACY_CATALOG \
npm run db:migrate:legacy
```

O migrador usa `node:sqlite` em modo read-only, preserva imóveis, imagens, IDs,
ordem e timestamps, e recusa um destino com catálogo existente. Admins e
buckets de rate limit não são importados. Nenhuma dependência SQLite permanece.

## Comandos

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

O CI sobe `postgres:17-alpine`, aplica a baseline em banco limpo, verifica drift,
semeia fixtures sem apagar dados, executa lint, tipos, testes, build, E2E e
auditoria. Integrações externas são mockadas; smoke tests reais exigem
credenciais próprias.

Por padrão, o Playwright inicia um servidor próprio com R2, Resend e Pusher
desabilitados, mesmo que existam credenciais no `.env`. Também não reutiliza um
servidor já ativo. Para um smoke controlado de Resend/Pusher, configure
credenciais de teste e habilite explicitamente `PLAYWRIGHT_EXTERNAL_SMOKE=1`
antes de executar `npm run test:e2e`; esse modo pode enviar e-mail e publicar
eventos reais. O contrato de upload R2 no E2E é mockado; valide R2/CORS/domínio
com o smoke manual descrito no runbook.
`PLAYWRIGHT_REUSE_SERVER=1` é outro opt-in e usa o ambiente do servidor já em
execução, portanto não oferece esse isolamento.

## Variáveis de ambiente

| Grupo | Variáveis |
| --- | --- |
| Banco | `DATABASE_URL`, `DIRECT_URL`, `DATABASE_ADAPTER` |
| Auth/contato | `JWT_SECRET`, `WHATSAPP_PHONE`, `SITE_URL` |
| Admin scripts | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_PRODUCTION_CONFIRM` |
| R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `CRON_SECRET` |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_EMAIL` |
| Pusher server | `PUSHER_APP_ID`, `PUSHER_SECRET`, `PUSHER_KEY`, `PUSHER_CLUSTER` |
| Pusher browser | `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` |
| Migração one-off | `LEGACY_SQLITE_PATH`, `LEGACY_MIGRATION_CONFIRM` |

Somente a chave e o cluster públicos do Pusher usam `NEXT_PUBLIC_*`. URLs de
banco, `R2_SECRET_ACCESS_KEY`, chave Resend e segredo Pusher nunca chegam ao
browser. No upload direto, a URL assinada contém temporariamente o
`R2_ACCESS_KEY_ID` no escopo da credencial, além da assinatura, mas nunca expõe
o secret access key.
