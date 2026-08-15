# Histórico SQLite legado

Estas migrations pertencem exclusivamente ao banco SQLite anterior à migração
para PostgreSQL. Elas foram preservadas para auditoria e para interpretar o
arquivo `dev.db`, mas não são lidas pelo Prisma 7: `prisma.config.ts` aponta para
`prisma/migrations-postgresql`.

Nunca execute este SQL em Neon/PostgreSQL.
