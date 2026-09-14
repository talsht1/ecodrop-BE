# EcoDrop API

A production-ready Node.js + Express API for locating the nearest recycling bin using PostGIS proximity queries.

## Features

- PostGIS-enabled database migration for geographic bin records.
- Express REST API with nearest-bin lookup and list endpoint.
- Swagger/OpenAPI documentation at `/docs` for easy debugging.
- Local Postgres/PostGIS support via Docker Compose.
- Sample data seeding for a working database immediately out of the box.
- Input validation for latitude/longitude.
- CORS configuration and structured error handling.
- CI/CD pipeline for automated database pushes and deployments.

## Project structure

- `app/server.js` – Express API entry point.
- `app/swagger.js` – Swagger/OpenAPI configuration.
- `app/config/index.js` – Centralized environment-based configuration.
- `app/scripts/seed-sample-data.js` – Seeds the database with sample bin data.
- `app/tests/server.test.js` – API test coverage.
- `docker-compose.yml` – Local Postgres/PostGIS container setup.
- `supabase/migrations/` – Database migration files.
- `supabase/seed.sql` – Supabase seed SQL for local or staging initialization.
- `.github/workflows/backend-ci-cd.yml` – GitHub Actions workflow.
- `render.yaml` – Render deployment blueprint.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file and update values as needed:

   ```bash
   cp .env.example .env
   ```

3. Start the local Postgres/PostGIS database:

   ```bash
   docker compose up -d db
   ```

4. Seed the database with sample recycling bins:

   ```bash
   npm run db:seed
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open Swagger UI:

   ```text
   http://localhost:3000/docs/
   ```

7. Query the API directly:

   ```bash
   curl "http://localhost:3000/api/bins/nearest?lat=40.7829&lng=-73.9654"
   ```

## Environment variables

- `PORT` – API port, defaults to `3000`
- `NODE_ENV` – Runtime environment
- `DATABASE_URL` – PostgreSQL/PostGIS connection string
- `CORS_ORIGIN` – Allowed CORS origin or `*`
- `POSTGRES_DB` – Local database name for Docker Compose
- `POSTGRES_USER` – Local database user
- `POSTGRES_PASSWORD` – Local database password

## Database setup

The migration in `supabase/migrations/20260914_000001_create_bins_table.sql`:

- enables PostGIS
- creates a `bins` table
- stores a `GEOMETRY(Point, 4326)` `location`
- builds a GiST index for nearest-neighbor queries
- inserts sample recycling bin locations

The `app/scripts/seed-sample-data.js` helper ensures the same data exists in a local PostgreSQL/PostGIS environment.

The additive migration `20260914151214_add_bin_address_and_type.sql` adds
nullable `address` and `type` columns with database constraints. It backfills
the original mock bins without replacing existing metadata. Other existing
bins keep `null` for unknown values; no address or material is guessed.
Apply migrations before deploying the updated API (`supabase db push` in CI).
For local development, run `npm run db:seed` to upgrade and seed an existing
database without deleting its records. For the Docker API, rebuild with
`docker compose up --build -d` and run `docker compose exec api npm run db:seed`.

## Bin data for the map

`GET /api/bins` returns an array of bins. `GET /api/bins/nearest?lat=40.7829&lng=-73.9654`
returns the same fields inside `nearestBin`, plus the existing distance fields.

```json
{
  "id": 2,
  "name": "Central Park Collection Point",
  "address": "Central Park, New York, NY",
  "type": "paper",
  "latitude": 40.7829,
  "longitude": -73.9654
}
```

Use `latitude` and `longitude` to position the marker, `type` to choose its icon,
and `address` in the popup on click. Supported type keys are `glass`, `paper`,
`plastic`, `metal`, `electronics`, and `mixed`. Unknown types are `null` (use
a generic icon); unknown addresses are `null` (display "Address unavailable").
Non-null addresses must be nonblank and types must match an exact supported key.
Both fields are always present in API responses. Seed addresses and material
types are illustrative mock data, not verified recycling facilities.

## Health and readiness

The API exposes two distinct probes for operational monitoring:

- `GET /health` – liveness check. Confirms the process is running and responds with service metadata and uptime.
- `GET /ready` – readiness check. Verifies the database is reachable and reports timing and PostgreSQL version information.

Example:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Use `/health` for container/process liveness and `/ready` for load balancer or orchestration gating.

## Swagger/OpenAPI

The API exposes Swagger documentation at `/docs`, making it easier to debug endpoints and test requests interactively.

## CI/CD

The GitHub Actions workflow runs on pushes to `main` and performs:

- dependency installation
- test execution
- Supabase CLI setup
- database migration push using repository secrets

## Deployment

Render is configured through `render.yaml` for a free web service deployment.

## License

MIT
