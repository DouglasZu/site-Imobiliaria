# Lar Imóveis - Plataforma Imobiliária

Uma plataforma completa de anúncios imobiliários construída com Next.js 16/17 (App Router), Prisma, SQLite e Tailwind CSS v4. Focada em performance, design moderno e usabilidade.

## Recursos Principais

### Área Pública
- 🏠 **Catálogo de Imóveis**: Grade com filtros dinâmicos por tipo, cidade, faixa de preço e busca textual.
- 📱 **Design Responsivo**: Layout "mobile-first", adaptando-se perfeitamente de celulares a desktops grandes.
- 🖼️ **Galeria de Imagens**: Carrossel elegante com suporte a modo tela cheia (lightbox) para visualização em alta definição.
- 🗺️ **Mapas Integrados**: Visualização da localização de cada imóvel utilizando Leaflet e OpenStreetMap.
- 💬 **Contato Rápido**: Integração com WhatsApp gerando links com mensagens pré-preenchidas.
- 🌙 **Modo Escuro**: Suporte nativo ao modo escuro (Dark Mode) respeitando as configurações do sistema do usuário e toggle manual.

### Área Administrativa (Admin)
- 🔒 **Autenticação Segura**: Login protegido usando JWT (JSON Web Tokens) e cookies HTTP-only (bcryp para senhas).
- 📊 **Dashboard de Gerenciamento**: Visão geral dos imóveis, estatísticas de anúncios e controles rápidos (ativar/desativar).
- 📝 **CRUD Completo**: Interface simples para criar, editar, listar e excluir propriedades.
- 📷 **Gerenciador de Imagens**: Upload de múltiplas fotos (por URL para esta MVP) com recurso de reordenação arrastar/clicar e seleção de foto principal.

## Tecnologias Utilizadas

- **Frontend/Backend**: [Next.js 16.2](https://nextjs.org/) (App Router, Server Actions, Server Components)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) (com configuração CSS-first via `@theme`)
- **Banco de Dados**: SQLite
- **ORM**: [Prisma v7](https://www.prisma.io/) (utilizando driver adapter `better-sqlite3`)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Mapas**: [Leaflet](https://leafletjs.com/) e [React Leaflet](https://react-leaflet.js.org/)
- **Autenticação**: `jose` (JWT) e `bcryptjs`

## Pré-requisitos

- Node.js (v20 ou superior recomendado)
- npm (v10 ou superior)

## Como rodar o projeto localmente

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Configure o Banco de Dados (Migrações)**
   O banco de dados SQLite será criado na pasta `prisma/dev.db`.
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

3. **Configure as Variáveis de Ambiente**
   Copie o arquivo de exemplo e ajuste os valores:
   ```bash
   cp .env.example .env
   ```
   Edite o `.env` com suas configurações (e-mail e senha do admin, etc.).

4. **Popule o Banco de Dados (Opcional - Recomendado)**
   Este comando criará 12 imóveis de exemplo e o usuário administrador usando as credenciais definidas no `.env`.
   ```bash
   npx prisma db seed
   ```

5. **Inicie o Servidor de Desenvolvimento**
   ```bash
   npm run dev
   ```

6. **Acesse a Aplicação**
   - Site Público: [http://localhost:3000](http://localhost:3000)
   - Painel Administrativo: [http://localhost:3000/admin](http://localhost:3000/admin)

## Credenciais do Admin

As credenciais do painel administrativo são definidas no arquivo `.env` (variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`) e criadas ao executar o seed. Consulte o `.env.example` para referência.

## Licença

Projeto desenvolvido para fins educacionais/demonstrativos.
