# Judge0 — Code Execution Engine

CodingKida uses [Judge0 CE](https://github.com/judge0/judge0) for secure code execution.

## Prerequisites

- **Docker Desktop** installed and running
- Minimum 4GB RAM available for Docker

## Quick Start

```bash
cd judge0
docker compose up -d
```

Wait 30-60 seconds for all services to start, then verify:

```bash
curl http://localhost:2358/about
```

You should see Judge0 version info.

## Test Code Execution

```bash
# Submit a Python "Hello World"
curl -X POST http://localhost:2358/submissions?wait=true \
  -H "Content-Type: application/json" \
  -d '{
    "source_code": "print(\"Hello, CodingKida!\")",
    "language_id": 71,
    "stdin": ""
  }'
```

Expected response includes `stdout: "Hello, CodingKida!\n"`.

## Language IDs

| Language   | Judge0 ID |
|-----------|-----------|
| C         | 50        |
| C++       | 54        |
| Java      | 62        |
| Python 3  | 71        |
| JavaScript| 63        |

## Security Limits (Default)

| Limit          | Value    |
|---------------|----------|
| CPU Time      | 2 sec    |
| Wall Time     | 5 sec    |
| Memory        | 256 MB   |
| Stack         | 128 MB   |
| Network       | Disabled |
| Max File Size | 1 MB     |

## Architecture

```
Next.js Backend (port 3000)
    │
    ▼ POST /api/code/run
    │
Judge0 API (port 2358)
    │
    ▼ Workers execute in sandboxed containers
    │
    └── Redis (queue) + PostgreSQL (results)
```

## Stop Services

```bash
docker compose down
```

## Production Deployment

For production, deploy Judge0 on a separate VPS (Ubuntu 22.04+):

```bash
# On production VPS
git clone https://github.com/judge0/judge0.git
cd judge0
# Edit .env with production settings
docker compose up -d
```

Key production changes:
- Set `AUTHN_TOKEN` and `AUTHZ_TOKEN` for API authentication
- Increase `NUMBER_OF_WORKERS` based on expected load
- Use managed Redis/PostgreSQL for reliability
- Put behind nginx reverse proxy with rate limiting
