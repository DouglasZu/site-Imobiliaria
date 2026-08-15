# Lar Imóveis

Catálogo imobiliário em Next.js 16.3 (App Router), React 19, TypeScript, Prisma 7 e Tailwind CSS 4. O projeto inclui páginas públicas, filtros, detalhes com mapa, contato por WhatsApp e um painel administrativo com CRUD.

## Arquitetura

- Server Components nas páginas públicas e acesso a dados somente no servidor.
- Route Handlers REST em `src/app/api`.
- Autenticação administrativa por JWT assinado, cookie HttpOnly e autorização revalidada no banco.
- Prisma com SQLite para desenvolvimento local.
- Vitest para testes unitários/de integração e Playwright para E2E desktop/mobile.
- Imagens por URL HTTPS de `images.unsplash.com`, com até 12 imagens por anúncio. Upload de arquivo não faz parte desta versão.
- Leaflet/OpenStreetMap e Nominatim para o mapa/geocodificação.

## Bloqueio de deploy na Vercel

> **Não publique esta versão na Vercel usando SQLite.** O filesystem das Functions é efêmero e não compartilhado. Antes do deploy, migre schema e dados para um banco externo persistente, gere migrações para o novo provider e use bancos separados em Production e Preview.

## Requisitos

- Node.js 24.x
- npm com suporte a `package-lock.json` v3

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha todos os valores obrigatórios. Os campos vazios são intencionais: não existem credenciais padrão.

3. Aplique as migrações existentes. O SQLite local será criado como `dev.db` na raiz:

   ```bash
   npm run db:deploy
   ```

4. Opcionalmente, carregue os dados de demonstração:

   ```bash
   npm run seed
   ```

   O seed substitui o catálogo e os administradores dentro de uma transação. Ele só executa com `SEED_REPLACE_CONFIRM=REPLACE_CATALOG_AND_ADMINS`; remova essa confirmação logo depois. Em produção, exige também `ALLOW_PRODUCTION_SEED=true` para aquela execução.

5. Inicie o servidor:

   ```bash
   npm run dev
   ```

Site público: <http://localhost:3000>

Painel: <http://localhost:3000/admin>

## Variáveis de ambiente

| Variável | Escopo | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Server/runtime e migrations | Conexão Prisma |
| `JWT_SECRET` | Server/runtime | Assinatura de sessão e HMAC do rate limit |
| `WHATSAPP_PHONE` | Server/runtime | Contato padrão |
| `ADMIN_EMAIL` | Seed somente | Criação do administrador |
| `ADMIN_PASSWORD` | Seed somente | Senha inicial, nunca exposta ao cliente |
| `SEED_REPLACE_CONFIRM` | Seed somente | Confirmação explícita para apagar e recriar catálogo/admins |
| `ALLOW_PRODUCTION_SEED` | Seed somente | Trava explícita para produção |
| `SITE_URL` | Build/runtime | Canonical, sitemap e robots |

Não há variáveis `NEXT_PUBLIC_*` nem secrets enviados ao navegador.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

O workflow em `.github/workflows/ci.yml` repete lint, tipos, testes, build, E2E, migrations em banco limpo e auditoria de dependências.
