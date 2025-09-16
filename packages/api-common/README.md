# @turnstile-portal/api-common

Shared database schema and client for the Turnstile API.

## Database Schema

The database schema is defined in `src/schema.ts` using Drizzle ORM. 

Tables:
- `tokens` - Token information with L1/L2 addresses
- `block_progress` - Blockchain scanning state

## Migration Workflow

### Modifying the Schema

1. Edit `src/schema.ts`
2. Generate migration:
   ```bash
   pnpm generate
   ```
3. Review generated SQL in `migrations/`
4. Apply to database:
   ```bash
   pnpm migrate
   ```
5. Commit all files in `migrations/` including `meta/` directory

### Commands

```bash
pnpm generate  # Generate migration from schema changes
pnpm migrate   # Apply pending migrations to database
pnpm studio    # Open Drizzle Studio for database inspection
```

## Multiple Environments

Each environment has its own database URL and tracks migration state independently.

```bash
# Using environment files
cp ../../.env.sandbox .env && pnpm migrate
cp ../../.env.testnet .env && pnpm migrate
cp ../../.env.mainnet .env && pnpm migrate

# Or directly
DATABASE_URL=postgres://sandbox-db/turnstile pnpm migrate
DATABASE_URL=postgres://testnet-db/turnstile pnpm migrate
```

## Migration Files

- `migrations/*.sql` - SQL migration files (generated)
- `migrations/meta/_journal.json` - Migration history
- `migrations/meta/*_snapshot.json` - Schema snapshots

All migration files must be committed to the repository.
