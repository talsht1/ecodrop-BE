# EcoDrop API

A Node.js + Express API for locating the nearest recycling bin using PostGIS proximity queries.

## What we built

The backend provides bin creation, listing and nearest-bin lookup, coordinate validation
middleware, database record validation, configurable CORS, Swagger documentation,
and mock-database API tests. Bin responses include coordinates, an address for
map popups, and a stable material type for map icons.

`POST /api/reports` accepts map incident reports with optional images and
dispatches them to a configured email address in the background using Resend.

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
- `app/routes/reports.js` - Report submission and non-blocking email dispatch.
- `app/middleware/validate-report.js` - Multipart/image parsing and report validation.
- `app/services/report-mailer.js` - Resend HTTPS email integration.
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
- `REPORT_TARGET_EMAIL` - Permanent destination for all report emails (single plain email address)
- `REPORT_FROM_EMAIL` - Sender address authorized by Resend (single plain email address)
- `RESEND_API_KEY` - Resend API key; server-side only, never exposed to the frontend

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

The migration `20260915060000_replace_bin_types.sql` replaces the original
material categories with the ten bin categories below. It changes only `type`:
`mixed` becomes `general_waste`, `plastic` and `metal` become `packaging`,
and `glass`, `paper`, `electronics`, and `null` are preserved. IDs, names,
addresses, and coordinates are unchanged. This mapping was explicitly chosen
for existing data; new `packaging` bins represent packaging, not all plastic
or metal objects.

This is a **breaking API/database change**. The new API rejects retired
`mixed`, `plastic`, and `metal` values; the old API rejects the new values.
Coordinate the database migration, backend deployment, and frontend icon/form
updates in a maintenance window. Render and GitHub Actions deploy independently:
do not assume they switch together. Apply the migration before starting the
new backend and do not run the old backend against the migrated schema.
On an already-migrated database, do not manually replay the old address/type
migration; use the current helper locally or pending migrations through CI.

## Sample locations and seeding

We started with three Manhattan bins, expanded Manhattan to 18, and added six
bins each in Moran and Almagor. `supabase/seed.sql` now contains **30 mock bins**:

| Area | Bins | Type coverage | Suggested map center (latitude, longitude) |
| --- | --- | --- | --- |
| Manhattan, New York | 18 | Six packaging; three each general waste, glass, paper, electronics | `40.7829, -73.9654` |
| Moran, Israel | 6 | Two packaging; one each general waste, glass, paper, electronics | `32.9194, 35.3956` |
| Almagor, Israel | 6 | Two packaging; one each general waste, glass, paper, electronics | `32.9125, 35.6021` |

All include coordinates, display addresses, and types. These are illustrative
map placeholders, not verified recycling facilities. The 30 records were loaded
locally; each hosted database must be seeded separately.

Seed names containing "Mixed", "Plastic", or "Metal" remain unchanged to keep
name-based reruns duplicate-free, but their `type` values use the new mapping.
Use `type`, not the name, to choose map icons. No sample bins were reclassified
as textile, cardboard, bulky waste, bottle recycling machines, or yard waste
without evidence; these categories can be supplied when creating new bins.

### Add a new location

1. Edit `supabase/seed.sql`, the shared sample-data source.
2. Add a tuple to its `VALUES` list using a unique, stable name, a nonblank address,
   an allowed type, and coordinates for the intended location.
3. Separate tuples with commas: add a comma after the previous last tuple and
   leave no trailing comma before `) AS v(name, address, type, location)`.
4. Save the file and apply it to the intended database using one of the methods below.

Example tuple for another **mock** point near Almagor:

```sql
('Almagor Extra General Waste Demo Point',
 'Mock location 7, Almagor, Emek HaYarden, Israel',
 'general_waste',
 ST_SetSRID(ST_MakePoint(35.6025, 32.9128), 4326))
```

**Coordinate order matters:** `ST_MakePoint(longitude, latitude)`, not latitude
first. Use longitude between -180 and 180 and latitude between -90 and 90.
Use one of the ten exact API keys listed under **Bin types** below.
SQL strings use single quotes; escape an apostrophe as two single
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
migration when those columns are missing, applies the type-replacement migration,
and executes `supabase/seed.sql`. It is a local setup helper, not a
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

A database containing only the current seed has 30 bins: ten `packaging`,
and five each of `general_waste`, `glass`, `paper`, and `electronics`.
Do not reset the database or delete existing bins just to add new locations.

## Bin types

The API stores and returns stable English keys. Hebrew and English names below
are display labels, not accepted substitutes for the keys.

| API key | Original (Hebrew) | English label | Accepted waste / context |
| --- | --- | --- | --- |
| `general_waste` | ירוק | Green Bin | General / mixed municipal waste |
| `packaging` | אריזות (כתום) | Orange Packaging Bin | Plastic, metal, and beverage carton packaging |
| `glass` | זכוכית (סגול) | Purple Glass Bin | Glass bottles and food jars |
| `paper` | נייר (כחול) | Blue Paper Bin | Newspapers, magazines, and office paper |
| `textile` | טקסטיל | Textile Bin | Used clothing, shoes, and fabrics |
| `electronics` | אלקטרוניקה | Electronics / E-Waste Bin | Small electronic appliances and devices |
| `cardboard` | קרטוניה | Cardboard Cage / Bin | Large flattened cardboard boxes |
| `bulky_waste` | מכולה לפסולת גושית | Bulky Waste Container | Large items like old furniture and mattresses |
| `bottle_recycling_machine` | מכונה למיחזור בקבוקים | Bottle Recycling Machine | Reverse vending machine (RVM) for deposit bottles |
| `yard_waste` | גזם | Yard Waste / Pruning | Tree branches, leaves, and garden trimmings |

`null` still means unknown and is allowed for existing and newly created bins.
Color labels describe bin categories; they do not introduce a separate color field.
For the frontend, replace the old mixed icon key with `general_waste`, merge
plastic/metal icon keys into `packaging`, and add icons for the five new categories.
Use the green/orange/purple/blue scheme for the four explicitly colored categories
and a generic icon for null or unrecognized keys.

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
and `address` in the popup on click. Supported type keys are listed in **Bin types**.
Unknown types are `null` (use
a generic icon); unknown addresses are `null` (display "Address unavailable").
Non-null addresses must be nonblank and types must match an exact supported key.
Both fields are always present in API responses. Seed addresses and material
types are illustrative mock data, not verified recycling facilities.

### Create a bin through the API

Send `POST /api/bins` with `Content-Type: application/json`.
Required fields are `name`, `latitude`, and `longitude`. `address` and `type`
may be omitted or explicitly `null` for unknown values.

```json
{
  "name": "New Moran Collection Point",
  "address": "Moran, Israel",
  "type": "general_waste",
  "latitude": 32.9194,
  "longitude": 35.3956
}
```

The API returns **201 Created** with the saved bin object, including its
database-generated `id`, name, address, type, latitude, and longitude.
It is persisted in PostgreSQL and available from the list and nearest-bin
endpoints without a restart. This does not edit the seed file.

Try it through Swagger's **POST /api/bins → Try it out**, or locally in PowerShell:

```powershell
$body = @{
  name = 'New Moran Collection Point'
  latitude = 32.9194
  longitude = 35.3956
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/bins' -ContentType 'application/json' -Body $body
```

Name/address strings are trimmed. Names must be nonblank and at most 255
characters; supplied addresses must be nonblank. Types must match a supported
key exactly. Coordinates must be finite JSON numbers (not numeric strings),
within latitude -90..90 and longitude -180..180. Unknown fields, including
client-supplied `id`, are rejected. Null characters are not accepted in text.

Invalid fields or malformed JSON return **400**, oversized JSON bodies
(over 100 KB) return **413**, unsupported content types/encodings return **415**,
and database failures return **500** with a generic error.
Each successful request creates a new row; duplicate names/locations are allowed.
Unlike the seed script, this endpoint does not deduplicate requests. Avoid
automatic retries that could create duplicate bins.

**This endpoint has no authentication or authorization.** Once deployed,
anyone who can reach it can add bins. CORS does not restrict direct API clients.
The schema supports insertion after all pending migrations, including the
type-replacement migration, have been applied.

## Report a map incident

Send `POST /api/reports` as **multipart/form-data**, including the clicked
map coordinates. This endpoint is independent of the bins table and does not
require a bin ID.

| Form field | Required | Format |
| --- | --- | --- |
| `latitude` | Yes | Decimal text, -90 through 90 |
| `longitude` | Yes | Decimal text, -180 through 180 |
| `reporterName` | No | Text, up to 200 characters |
| `incidentTime` | No | RFC 3339 timestamp with timezone, e.g. `2026-09-15T09:00:00+03:00` |
| `message` | No | Free text, up to 10,000 characters |
| `image` | No | One JPEG, PNG, or WebP file, at most 5 MiB (5,242,880 bytes) |

Omit unknown optional fields; empty optional text is treated as absent. Text is
trimmed, null characters are rejected, and invalid calendar dates are rejected.
Images are checked by declared content type and file signature, held in memory,
and attached to the email with a server-generated filename. They are not stored
on disk, in Supabase, or at a public URL. Duplicate/unknown fields, multiple
images, and URL/base64 text in place of a file are rejected.

Frontend example (use your configured API base URL):

```javascript
const form = new FormData();
form.append('latitude', String(clickedLocation.latitude));
form.append('longitude', String(clickedLocation.longitude));
if (reporterName) form.append('reporterName', reporterName);
if (incidentTime) form.append('incidentTime', new Date(incidentTime).toISOString());
if (message) form.append('message', message);
if (imageFile) form.append('image', imageFile);

const response = await fetch(`${apiBaseUrl}/api/reports`, {
  method: 'POST',
  body: form
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
```

Do **not** set `Content-Type` manually when using browser `FormData`; the browser
must include the multipart boundary. Convert a local datetime picker value to a
timestamp with a timezone before submission. The email includes the selected
location, any supplied reporter/time/message, and a separate server submission time.

After upload and validation, configured report submissions return **200 OK**:

```json
{ "success": true, "message": "Report submitted successfully" }
```

The route schedules dispatch with `setImmediate` and does not wait for the email
provider response. A 200 means **accepted for best-effort dispatch**, not delivered.
Provider failures/timeouts are logged with an internal report ID, without the
image/message contents, and cannot change a response already sent.
No database record, persistent queue, automatic retry, or delivery-status endpoint
is created. A process restart, redeploy, or Render spin-down can lose an in-flight
report. Use a durable queue/outbox in a future change if guaranteed delivery is needed.

Invalid fields/multipart/image signatures return **400**, images over 5 MiB or
text upload fields over 40,000 bytes return **413**, unsupported request/image
content types return **415**, and missing/invalid email configuration returns **503**
instead of pretending the report was accepted. Other API endpoints remain usable
when report email is not configured. `/ready` does not check email availability.

### Configure report email

We use the [Resend HTTPS API](https://resend.com/docs/api-reference/emails/send-email)
instead of SMTP because [Render Free blocks outbound SMTP ports 25, 465, and 587](https://render.com/docs/free).
The provider endpoint and 10-second request timeout live in `app/config/index.js`.

1. Create a Resend account and generate an API key authorized to send email.
2. Verify a sending domain in Resend and choose a sender on that domain.
3. Set `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, and `REPORT_TARGET_EMAIL` in the
   server environment. Use `.env` locally or **Render service → Environment**
   for the deployed API. These are not Supabase/GitHub migration secrets.
4. Restart the local process, or deploy the updated Render environment.
   For Docker, rebuild/recreate the API with `docker compose up --build -d api`.
5. Submit a report through Swagger and inspect the target inbox, Resend dashboard,
   and API logs for delivery failures.

For initial testing, Resend's `onboarding@resend.dev` sender can send only to
the email address associated with your Resend account. To target another inbox,
use a verified domain. Set the destination only through `REPORT_TARGET_EMAIL`;
clients cannot supply or override recipients.

This remains a public endpoint without authentication or rate limiting. Only
enable it when you accept that public submissions consume your email quota.
No database migration is needed for reports.

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
Report tests cover optional fields and images, invalid uploads, fixed recipients,
background failures/timeouts, and a pending email that does not delay the response.
Email provider calls are mocked; the suite sends no real email and requires no
Resend credentials.

An optional PostGIS migration test exercises the complete migration chain,
legacy mapping, null preservation, database constraints, and seed reruns using
a temporary table and rollback. To include it against the local PostGIS database:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ecodrop'
npm test
Remove-Item Env:TEST_DATABASE_URL
```

Without `TEST_DATABASE_URL`, this integration test is skipped and the mocked
API tests still run.

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
