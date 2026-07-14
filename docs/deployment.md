# Deployment and rollback

## Required configuration

Copy `.env.example` to `.env`, replace all secrets, and configure PostgreSQL, Redis and MinIO. Cited answers additionally require an OpenAI-compatible chat endpoint; hybrid vector retrieval requires an embeddings endpoint.

```env
CHAT_BASE_URL=https://provider.example/v1
CHAT_API_KEY=replace-me
CHAT_MODEL=model-name
EMBEDDING_BASE_URL=https://provider.example/v1
EMBEDDING_API_KEY=replace-me
EMBEDDING_MODEL=embedding-model-name
```

Never commit `.env` or provider keys.

## Release procedure

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
docker compose config --quiet
pnpm migration:show
pnpm migration:run
docker compose up -d --build --wait
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health/ready
```

The web build output is produced by `pnpm --filter @ai-knowledge/web build` in `apps/web/dist` and can be served by a static host that forwards same-origin `/api` to the API.

## Rollback

1. Redeploy the previous known-good Git commit or container image.
2. Keep additive database tables unless the release must be fully reverted.
3. If schema rollback is required, stop API traffic and run `pnpm migration:revert` once per reverted release.
4. Verify `/api/v1/health/ready`, authentication, document retrieval and cited answers.

Do not revert a migration after production data has been written without first exporting the affected tables.
