# Database Safety — Universal Rule (ALWAYS FOLLOW)

This is a hard, non-negotiable rule set by the user for ALL database work in this
project. It applies to every session, every phase, every task.

## The Rule

1. **Never run a destructive database command.** Not even once, not even by
   accident. Zero tolerance for the loss of even a single row of data.
2. **Before running ANY database command**, first STOP and explain — with 100%
   certainty — exactly what the command does and whether there is ANY risk of
   data loss. Only proceed after the user explicitly approves.
3. If there is even the smallest chance of data loss, DO NOT run it. Pause and
   ask the user first.

## What counts as DESTRUCTIVE / data-loss risk (require explicit approval, prefer to avoid)

- `prisma migrate reset` (DROPS the whole database — NEVER run)
- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` without a verified scope
- Renaming a column/table (Prisma may drop + recreate → data loss)
- Changing a column type in a way that forces a destructive recreate
- Adding a `@unique` / `NOT NULL` constraint on existing data without a safe default
- Any migration whose generated SQL contains `DROP`, `TRUNCATE`, or non-defaulted
  `NOT NULL` additions
- `--force-reset`, `--accept-data-loss` flags

## What is generally SAFE (still explain first, still get approval)

- Adding a NEW optional column, or a NEW column WITH a default value
  (e.g. `Boolean @default(false)`) — existing rows just get the default
- Adding a NEW table / NEW index
- Read-only queries

## Required workflow for schema changes

1. Edit `schema.prisma`.
2. Explain the exact change + the generated SQL intent + confirm "no data loss".
3. Let the USER run the migration themselves, OR get explicit approval to run it.
4. Prefer additive migrations (`prisma migrate dev --name ...`) over `db push`
   so there is a reviewable migration file. Never use reset/force flags.

The `DATABASE_URL` points to a PRODUCTION Neon database. Treat it with maximum
caution at all times.
