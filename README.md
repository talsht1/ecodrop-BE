# EcoDrop API

A Node.js + Express API for locating the nearest recycling bin using PostGIS proximity queries.

## What we built

The backend provides bin listing and nearest-bin lookup, coordinate validation
middleware, database record validation, configurable CORS, Swagger documentation,
and mock-database API tests. Bin responses include coordinates, an address for
map popups, and a stable material type for map icons.

We added `/whoami` for application identity, `/health` for process liveness,
and `/ready` for database connectivity, timing, and PostgreSQL version.
Docker supports either a local PostGIS database with Node running on the host,
or the entire API/database stack in containers.

The repository is hosted at https://github.com/talsht1/ecodrop-BE on `main`.
GitHub Actions applies database migrations to Supabase; Render hosts the backend
independently. Authentication and authorization are not implemented.

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
- `app/schemas/bin.js` - Supported bin type keys shared by validation and Swagger.
- `openapi.json` - Exported API contract for frontend integration.
- `Dockerfile` - API container image.
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

   ```powershell
   Copy-Item .env.example .env
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

### Run the entire stack in Docker

From the project root:

```bash
docker compose up --build -d
docker compose exec api npm run db:seed
```

The API is available at `http://localhost:3000`, Swagger at
`http://localhost:3000/docs/`, and PostgreSQL at `localhost:5432`.
Stop any host API already using port 3000 before starting the containerized API.
The API container uses `db` as its database hostname; a host Node process uses
`localhost`.

Use `docker compose down` to stop the stack while retaining database data.
Do not add `--volumes` unless you intend to delete the local database volume.

## Environment variables

- `PORT` – API port, defaults to `3000`
- `NODE_ENV` – Runtime environment
- `DATABASE_URL` – PostgreSQL/PostGIS connection string
- `CORS_ORIGIN` – Allowed CORS origin or `*`
- `POSTGRES_DB` – Local database name for Docker Compose
- `POSTGRES_USER` – Local database user
- `POSTGRES_PASSWORD` – Local database password

The current Compose file explicitly sets database name `ecodrop`, user
`postgres`, password `postgres`, and host ports 5432/3000. Changing `.env`
alone does not override those Compose values. These credentials are for local
development only; hosted credentials belong in Render settings or GitHub secrets.

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

## Sample locations and seeding

We started with three Manhattan bins, expanded Manhattan to 18, and added six
bins each in Moran and Almagor. `supabase/seed.sql` now contains **30 mock bins**:

| Area | Bins | Type coverage | Suggested map center (latitude, longitude) |
| --- | --- | --- | --- |
| Manhattan, New York | 18 | Three of each of the six types | `40.7829, -73.9654` |
| Moran, Israel | 6 | One of each type | `32.9194, 35.3956` |
| Almagor, Israel | 6 | One of each type | `32.9125, 35.6021` |

All include coordinates, display addresses, and types. These are illustrative
map placeholders, not verified recycling facilities. The 30 records were loaded
locally; each hosted database must be seeded separately.

### Add a new location

1. Edit `supabase/seed.sql`, the shared sample-data source.
2. Add a tuple to its `VALUES` list using a unique, stable name, a nonblank address,
   an allowed type, and coordinates for the intended location.
3. Separate tuples with commas: add a comma after the previous last tuple and
   leave no trailing comma before `) AS v(name, address, type, location)`.
4. Save the file and apply it to the intended database using one of the methods below.

Example tuple for another **mock** point near Almagor:

```sql
('Almagor Extra Mixed Demo Point',
 'Mock location 7, Almagor, Emek HaYarden, Israel',
 'mixed',
 ST_SetSRID(ST_MakePoint(35.6025, 32.9128), 4326))
```

**Coordinate order matters:** `ST_MakePoint(longitude, latitude)`, not latitude
first. Use longitude between -180 and 180 and latitude between -90 and 90.
Allowed type keys are exactly `glass`, `paper`, `plastic`, `metal`, `electronics`,
and `mixed`. SQL strings use single quotes; escape an apostrophe as two single
quotes, for example `'Visitor''s collection point'`. IDs are generated by the
database and may differ across environments.

Adding sample rows does not require a new schema migration or API change.
Commit and push seed-file changes when you want them shared in the repository;
pushing alone does not load them into Supabase.

### Apply locally

Ensure `.env` / `DATABASE_URL` targets the local database, then run:

```bash
docker compose up -d --wait db
npm run db:seed
```

The helper creates the local base schema if needed, applies the address/type
migration, and executes `supabase/seed.sql`. It is a local setup helper, not a
general-purpose migration runner. For an already running Docker API, use
`docker compose exec api npm run db:seed` instead.

### Apply to hosted Supabase

1. Confirm the GitHub Actions database migration step succeeded.
2. Open the Supabase project used by Render's `DATABASE_URL`.
3. Go to **SQL Editor → New query**.
4. Copy the **entire current contents** of `supabase/seed.sql`, paste, and click **Run**.
5. Refresh the deployed `/api/bins` endpoint or the frontend map.

This is the manual workflow used to supply the same placeholders to the hosted
database. Repeat it after adding locations to the file. The seed SQL assumes the
PostGIS extension, `bins` table, and `address`/`type` columns already exist.
No Render redeployment or API restart is needed for database-only additions.

### Reruns, updates, and verification

The seed uses `WHERE NOT EXISTS` matching **bin name**. Sequential reruns skip
existing names rather than duplicating or overwriting them, preserving other
records. Run one seed operation at a time; this is not a database uniqueness
constraint. Renaming a seed creates a new record. Editing the address, type,
or coordinates of an existing name does not update that record; make an explicit
targeted database update if that is intended.

To inspect the data in Supabase SQL Editor:

```sql
SELECT id, name, address, type,
       ST_Y(location) AS latitude,
       ST_X(location) AS longitude
FROM bins
ORDER BY id;

SELECT type, COUNT(*) AS total
FROM bins
GROUP BY type
ORDER BY type;
```

A database containing only the current seed has 30 bins, five of each type.
Do not reset the database or delete existing bins just to add new locations.

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

`/ready` currently tests connectivity only, not schema completeness. It can
return 200 even if `bins` is missing; use `/api/bins` to confirm the table is usable.
`GET /whoami` returns the service name, version, and environment.

## Swagger/OpenAPI

The API exposes Swagger documentation at `/docs/`, making it easier to debug endpoints and test requests interactively.
Give the frontend `openapi.json` from the repository root as the API contract.
Its server URL defaults to localhost; configure the frontend's API base URL
separately for deployment.

After changing the API documentation, regenerate the exported contract from
the project root:

```bash
node -e "require('node:fs').writeFileSync('openapi.json', JSON.stringify(require('./app/swagger').swaggerSpec, null, 2) + '\n')"
```

Changing seed data alone does not change the API contract.

## Tests

Run `npm test`. The API tests inject mocked database pools and do not require a
running PostgreSQL instance. They cover bin metadata, invalid records and input,
identity, liveness, database readiness/failure, and the map-related Swagger contract.

## CI/CD

The GitHub Actions workflow runs on pushes to `main` and performs:

- dependency installation
- test execution
- Supabase CLI setup
- database migration push using repository secrets

Configure these under **GitHub repository → Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from https://supabase.com/dashboard/account/tokens, not an anon/service-role key |
| `SUPABASE_PROJECT_ID` | Supabase project reference from the dashboard URL |
| `SUPABASE_DB_PASSWORD` | That project's PostgreSQL database password |

The initial run failed at `supabase link` because these secrets were empty.
After adding or correcting secrets, open the failed Actions run and choose
**Re-run jobs → Re-run failed jobs**; saving secrets does not rerun it automatically.
The workflow runs `supabase db push` for schema migrations, **not** `supabase/seed.sql`.
The original migration inserts only three mock bins; use the seeding instructions
above for all 30.

## Deployment

Render is configured through `render.yaml` for a free web service deployment.

The deployed backend URL is https://ecodrop-api-l2wd.onrender.com.
Swagger is at https://ecodrop-api-l2wd.onrender.com/docs/ and bin data at
https://ecodrop-api-l2wd.onrender.com/api/bins.

To set up this deployment, connect the GitHub repository in
**Render → New → Blueprint**, select `main`, and use `render.yaml`.
Set Render's `DATABASE_URL` from **Supabase → Connect → Session pooler**,
replacing the password placeholder and URL-encoding reserved password characters.
The connection must target the same project as GitHub's `SUPABASE_PROJECT_ID`.
Keep the connection string out of source control and frontend code.

Render runs `npm install` and `node server.js`; its supplied `PORT` is used by
the API (the observed deployment used port 10000 internally). Clients use the
public HTTPS URL without a port. Configure that URL as the frontend API base URL.

Render auto-deploys independently of GitHub Actions and does not wait for
migrations. A successful Render startup therefore does not mean the database
schema is installed. Free services can sleep when idle.

If `/api/bins` returns `relation "bins" does not exist`, check that the migration
workflow succeeded and both services target the same database. If the table is
present but new locations are absent, rerun the seed SQL in that database.

## License

MIT
