# Gerôncio — contexto do projeto

Gerenciamento de pedidos, estoque e entregas para restaurantes que vendem por vários canais (iFood, Rappi, 99Food, Keeta, Uber Eats). Projeto da disciplina de Engenharia de Software (UNIFESP). Código, comentários, commits e nomes de domínio são em **português (pt-BR)**; mantenha isso.

> O `README.md` está defasado: diz que o backend não foi implementado, mas `backend/` já tem 5 microsserviços funcionando. Na dúvida, confie no código, não no README.

## Estrutura

```
.
├── frontend/   # App Expo + React Native (expo-router em src/app)
├── backend/    # Microsserviços Express 5 + pacote compartilhado de banco (pnpm workspace)
│   ├── api-clientes | api-pedidos | api-restaurantes | api-produtos | api-integracao
│   └── packages/shared-db/   # Prisma 5.22 + client `db` + tipos (@geroncio/shared-db)
├── mock/       # Simula as plataformas de delivery (API + banco próprio + formulário web)
├── testes/     # Arquivos .http (REST Client) para testar as APIs na mão
└── docs/       # Pitch, diagrama do BD, swagger da 99Food (docs/99food/swagger.yaml)
```

Há **instalações pnpm independentes**: raiz, `frontend/`, `backend/` (workspace com `api-*` e `packages/*`), `mock/` e `mock/mock_frontend/` (Create React App, `react-scripts`; usa `REACT_APP_MOCK_API_URL` e `REACT_APP_PRODUTOS_API_URL`). Rode `pnpm install` dentro de cada pasta em que for trabalhar.

## Comandos

Da raiz:

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Expo (frontend) |
| `pnpm db` | Sobe só o Postgres do backend (Docker) |
| `pnpm backend` | Sobe o DB, aplica migrations, gera o Prisma Client e roda as 5 APIs em modo watch |
| `pnpm backend:docker` | Sobe DB + as 5 APIs em containers |
| `pnpm studio` | Prisma Studio do banco do backend |
| `pnpm db:migrate` | `prisma migrate dev` no backend |
| `pnpm mock` | Sobe o banco e a API do mock (Docker) e abre o formulário web (porta 3000) |
| `pnpm mock:studio` | Prisma Studio do banco do mock |

Os scripts `db:status` e `db:generate` da raiz não apontam para o schema; use os de `backend/` (`pnpm db:generate`, `pnpm db:deploy`, `pnpm db:migrate`).

Em `backend/`: `pnpm typecheck` (todos os pacotes), `pnpm docker:logs`, `pnpm docker:down`. Em `frontend/`: `pnpm lint`, `pnpm android|ios|web`. Em `mock/`: `pnpm api` (API fora do Docker), `pnpm db:down`, `pnpm db:reset`. **Não há suíte de testes automatizados**; a verificação é `typecheck` + os `.http` em `testes/`.

## Portas

| Serviço | Porta |
| --- | --- |
| api-clientes / api-pedidos / api-restaurantes / api-produtos / api-integracao | 3001 / 3002 / 3003 / 3004 / 3005 |
| Postgres do backend (imagem PostGIS 16) | 5432 (user/senha/db: `geroncio` / `geroncio_dev` / `geroncio`) |
| API do mock | 3333 |
| Formulário web do mock | 3000 |
| Postgres do mock | 5433 (`mock` / `mock` / `mock_delivery`) |

Dentro de containers, `localhost` não alcança outros serviços: o compose usa `host.docker.internal` (mock → api-integracao e api-integracao → mock). Para rodar o mock, suba o backend antes (o formulário busca o cardápio na `api-produtos`).

## Arquitetura e fluxo de pedidos

```
Mock (plataformas) --webhook--> api-integracao --adapter--> Prisma --> Postgres (backend)
                                     ^                                      ^
                  GET detalhes (iFood, Uber) -> mock               api-pedidos / api-produtos / ...
frontend --> api-pedidos (3002) ...
```

1. A mock_api grava o pedido no banco do mock e dispara o webhook para `POST /api/webhooks/:plataforma` da api-integracao.
2. `api-integracao/src/routes.ts` escolhe um **adapter** por plataforma (`ifood | 99food | keeta | ubereats | rappi`). Cada adapter implementa `validarAssinatura`, `extrairNotificacoes`, `buscarPedido` e `converterPedido`.
3. O pedido convertido vira `Pedido` + `ItemPedido`. Cada item externo é traduzido para `Produto` pela tabela **`MapeamentoApp`** (`plataforma` + `idExternoApp`); **sem mapeamento o pedido falha**.
4. A rota responde **202 antes de processar**. Erros de processamento só vão para o `console.error`; o remetente não fica sabendo.

Estado dos adapters: **iFood, Rappi e Uber Eats implementados. 99Food e Keeta são `adapterNaoImplementado`**: hoje `POST /api/webhooks/99food` e `/keeta` respondem 400. Para implementar um novo, preencha o adapter e registre-o em `ADAPTERS`.

Para adicionar uma plataforma no mock: crie `mock/mock_backend/<plataforma>/index.ts` seguindo `rappi/index.ts` (tipos nativos, `montarPedidoX`, `dispararWebhook`, assinatura HMAC opcional), registre-a em `PLATAFORMAS` e em `criarPedido` na `mock_api/index.ts`, e adicione a variável `<PLATAFORMA>_WEBHOOK_URL` no `mock/docker-compose.yml`.

## Convenções: backend

- Express **5** (`^5.2.1`), TypeScript executado por **`tsx`** (sem build). `strict` e `noUncheckedIndexedAccess` ligados.
- Estrutura de cada serviço: `src/index.ts` (listen) → `src/server.ts` (middlewares, CORS aberto, `/health`, montagem das rotas, 404 e error handler) → `src/routes.ts`.
- Prefixo das rotas: `api-clientes`, `api-pedidos`, `api-restaurantes` e `api-integracao` montam em **`/api`**; a **`api-produtos` monta na raiz (sem `/api`)**, por isso o frontend do mock usa `http://localhost:3004` sem prefixo. Ao criar rotas ou consumi-las, confira o `server.ts` do serviço.
- Imports **sem extensão** (`./routes`), resolução `Bundler`.
- Acesso a dados **somente** via `import { db, parseId } from '@geroncio/shared-db'`. Não instancie `PrismaClient` nos serviços.
- Erros no formato `{ error: string }` (às vezes com `detalhe`). Valide ids com `parseId` (retorna `null` se inválido → 400).
- Valores monetários no banco: `Decimal(10,2)` em reais.
- Nomes de colunas em snake_case via `@map`; campos Prisma em camelCase.
- Prisma **5.22**; schema em `backend/packages/shared-db/prisma/schema.prisma`. Mudança de schema: `pnpm db:migrate` (cria a migration) e comite a pasta gerada em `prisma/migrations/`.
- Variáveis de ambiente em `backend/.env` (`DATABASE_URL`); o `.gitignore` já ignora `.env`.

Modelo, em resumo: `Restaurante` 1–N `Produto`, `CredencialPlataforma`, `VinculoFuncionario` (N–N com `Funcionario`); `Pedido` 1–N `ItemPedido` (PK composta pedido+produto), 1–1 `Entrega` (com `entregador`); `Cliente` 1–N `Pedido`; `MapeamentoApp` (produto ↔ id externo por plataforma); `EstoqueSyncLog`. `StatusPedido`: `novo → em_preparo → pronto → saiu_para_entrega → entregue | cancelado`. O campo `Pedido.app` guarda o id da plataforma em minúsculas (`ifood`, `99food`, `ubereats`...).

## Convenções: mock

- É um sistema **separado**: Prisma **7** (`prisma-client`, client gerado em `mock/src/generated/prisma`, que é versionado — não edite à mão), config em `prisma7.config.ts`, banco próprio. **Nunca compartilhe o schema do mock com `shared-db`.**
- Roda TypeScript direto no Node (>= 22.18), por isso os imports **têm extensão `.ts`** (`../rappi/index.ts`). Servidor HTTP puro (`node:http`), sem Express.
- Valores em **centavos inteiros** (`...Centavos`); cada módulo de plataforma converte para o formato nativo dela.
- Erros no formato `{ erro: string }` (diferente do backend, que usa `error`).
- Cada pedido guarda em `payload` o pedido no formato nativo da plataforma (devolvido nos GETs) e cada `Evento` guarda o corpo exato do webhook.

## Convenções: frontend

- **Expo 57.** `frontend/AGENTS.md` exige ler a doc versionada (https://docs.expo.dev/versions/v57.0.0/) antes de escrever código; as APIs mudaram. React 19 com React Compiler e `typedRoutes` ligados.
- Rotas em `src/app` (expo-router); telas do painel em `src/app/(painel)/` (`index`, `estoque`, `relatorios`).
- Alias `@/` aponta para `src/`. Chamadas HTTP ficam em `src/services/` (`api-pedidos.ts`, `api-relatorios.ts`); a URL base vem de `EXPO_PUBLIC_API_PEDIDOS_URL` (padrão `http://localhost:3002/api`).
- Cores, espaçamento e raios vêm de `src/constants/tokens.ts`, que espelha `src/design-system/variables/*.json`. Use os tokens e o hook `use-cores`; não escreva hex solto.
- A API devolve `preco` como string e `app` como id da plataforma; `services/api-pedidos.ts` converte para o formato da UI (`nomeDoCanal`).

## Pontos de atenção conhecidos

- **99Food: o mock e o contrato real divergem.** `docs/99food/swagger.yaml` é a API oficial (DiDi Food): ids inteiros, `GET /v1/order/order/detail?auth_token&order_id`, `order_items`, `receive_address`, `price`, `pay_type` numérico, e ações `confirm`/`cancel`/`ready`/`delivered`. O `mock/mock_backend/99/index.ts` usa um formato **inventado** (`amounts`, `delivery_address`, evento `1001`) e precisa ser realinhado ao swagger antes de implementar o adapter. A doc não define o corpo do webhook de pedido novo.
- **99Food: bug na mock_api.** `notificarWebhook99Food(..., pedido99)` envia o pedido inteiro como corpo do webhook; o desenho diz que deve ir só `montarEventoNovoPedido99Food(pedido99)` (`{ eventId, messageId, shopId, timestamp, orderId }`).
- **Sem idempotência de pedidos:** `Pedido` não tem coluna de id externo nem unicidade por plataforma, então o mesmo webhook entregue duas vezes cria dois pedidos. `MapeamentoApp` também não tem `@@unique([plataforma, idExternoApp])`.
- `api-integracao/src/server.ts` responde `/health` com `service: 'api-pedidos'` (cópia do outro serviço) e tem o comentário de arquivo errado.
- iFood: `validarAssinatura` sempre retorna `true`; Rappi e Uber só validam quando o segredo (`RAPPI_WEBHOOK_SECRET`, `UBER_WEBHOOK_SECRET`) está definido.
- A imagem do Postgres é PostGIS, mas o schema guarda `latitude`/`longitude` como `Float`; nenhuma consulta geoespacial existe ainda (alocação por proximidade e frete por rota com Google Maps são requisitos ainda não implementados).
- `CredencialPlataforma` guarda `accessToken`/`refreshToken` em texto puro.
- `mock/mock_backend/keeta/index.ts` está vazio e a pasta da 99Food chama-se `99/` (não `99food/`).

## Fluxo de trabalho

- Uma branch por tarefa (`feature/<assunto>`), push e **Pull Request** para revisão; não commite direto na `main`.
- Não commite `.env`, `node_modules` nem credenciais. `.claude/`, `.agents/` e `.cursor/` estão no `.gitignore`.
- Antes de abrir PR: `pnpm typecheck` em `backend/` e `pnpm lint` em `frontend/`. Para APIs, exercite as rotas pelos `.http` em `testes/`.
- Ao mudar o contrato de uma API (rota, campo, status), atualize o consumidor (`frontend/src/services/*`) e o `.http` correspondente no mesmo PR.
