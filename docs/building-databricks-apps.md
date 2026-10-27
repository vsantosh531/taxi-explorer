# Building a Databricks App with AppKit: a worked example

This guide walks through how the **taxi-explorer** app was built, from an empty machine to a deployed app. It uses the `samples.nyctaxi.trips` table that ships with every Databricks workspace, so you can follow along without your own data.

What the finished app does:

- Date range and multi-select pickup ZIP filters
- Two KPI cards (total trips, average fare)
- Charts: trips by hour, trips per day, trips by fare range
- A trip details table with export to CSV or JSON, with pickup times in US Eastern time

Versions used: Databricks CLI v1.0.0, Node 24.14.0, npm 11.9.0, AppKit template 0.76.1.

Placeholders used below: `<profile>` is your CLI profile name, `<warehouse-id>` is your SQL warehouse ID, `<workspace-url>` is your workspace URL.

---

## How the pieces fit together

```
Browser (React page)                      Databricks App server (Node)              SQL warehouse
client/src/pages/...  --useAnalyticsQuery-->  AppKit analytics plugin  --runs SQL-->  samples.nyctaxi.trips
        ^                                       reads config/queries/*.sql
        |__ types generated from the SQL files (shared/appkit-types/analytics.d.ts)
```

The key idea: **SQL lives in files, not in React code.** Each file in `config/queries/` becomes a query you reference by file name (without `.sql`). The page never builds SQL strings, and it never talks to the warehouse directly.

---

## Part 1: Set up your machine

### 1.1 Node.js and npm

Check: `node -v` and `npm -v`. AppKit needs Node 22 or newer.

If you installed Node with **nvm** and get `command not found` in a new terminal, nvm is installed but never loaded by zsh. Add this to `~/.zshrc`, then run `source ~/.zshrc`:

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

Tools that run non-interactive shells (CI, some editors, AI assistants) don't load nvm either. If something says "npm not found" while your own terminal works, put the Node `bin` folder on the PATH for that command, for example `export PATH="$HOME/.nvm/versions/node/<version>/bin:$PATH"`.

### 1.2 Databricks CLI

Check: `databricks --version`. You need v0.292.0 or newer (we used v1.0.0). To install on macOS:

```sh
brew tap databricks/tap
brew install databricks
```

Don't use the old PyPI package `databricks-cli`. It is a different, legacy tool.

### 1.3 Authenticate, using OAuth and a named profile

Profiles live in `~/.databrickscfg`. Use **OAuth**, not personal access tokens (PATs). Tokens are long-lived secrets sitting in a plain-text file.

```sh
databricks auth login --host <workspace-url> --profile <profile>
databricks auth profiles                       # the profile should show Valid = YES
databricks current-user me --profile <profile> # confirms who you are
```

Good practice:

- Give profiles descriptive names. Avoid `DEFAULT`, because it silently applies to every command that has no `--profile`, and it is easy to run something against the wrong workspace.
- We removed a `DEFAULT` profile that held a PAT. Delete its `[DEFAULT]` section from `~/.databrickscfg`. Deleting it is permanent, so make sure you don't need that token.
- Pass `--profile <profile>` explicitly, or set it for your terminal session: `export DATABRICKS_CONFIG_PROFILE=<profile>`. The variable only lasts for that terminal session. Put it in `~/.zshrc` to make it permanent.

---

## Part 2: Create the app

### 2.1 Look at what AppKit can scaffold

```sh
databricks apps manifest --profile <profile>
```

This prints the available **plugins** and the resources each one needs. Relevant ones:

| Plugin | Use it for | Needs |
|---|---|---|
| `analytics` | SQL against a warehouse: charts, KPIs, tables | A SQL warehouse ID |
| `lakebase` | Reading and writing app data (forms, CRUD) | A Lakebase Postgres project, branch and database |
| `genie` | Natural-language questions over tables | A Genie space ID |
| `serving` | Calling ML model endpoints | A serving endpoint name |
| `files`, `jobs`, `agents`, `aiSearch` | Volumes, Lakeflow jobs, AI agents, vector search | Their own resources |
| `server` | HTTP server | Nothing. It is always included |

Choose plugins by what the app does. **Don't add a database "just in case."** A read-only analytics app only needs `analytics`. Lakebase is for apps that store data.

If you only need a few charts and no custom behaviour, a managed AI/BI dashboard is simpler than a custom app. Build a custom app when you need your own interactivity, export, write-back, or an embedded workflow.

### 2.2 Find your SQL warehouse and make sure it is running

```sh
databricks warehouses list --profile <profile>
databricks warehouses start <warehouse-id> --profile <profile>   # if it shows STOPPED
```

The scaffold rules say the warehouse must be running before `init`.

### 2.3 Scaffold

```sh
databricks apps init \
  --name taxi-explorer \
  --features analytics \
  --set analytics.sql-warehouse.id=<warehouse-id> \
  --description "NYC taxi explorer" \
  --run none \
  --profile <profile>
```

Common mistakes we hit or avoided:

- **No space after `=`** in `--set`. `id= 95643...` breaks the value.
- `--name` is a flag, not a positional argument.
- The name must be lowercase letters, numbers and hyphens, 26 characters or fewer.
- Use a profile that exists. A typo like `--profile free` doesn't always fail loudly. Commands that don't need authentication just ignore it.
- `--run none` stops it from starting the app so you can review the code first.

The scaffold uses names derived from the manifest. Never guess plugin or resource names. Always take them from `databricks apps manifest`.

### 2.4 Install dependencies and look around

```sh
cd taxi-explorer
npm install
```

Key files:

| Path | Purpose |
|---|---|
| `config/queries/*.sql` | One file per query. The file name is the query key |
| `client/src/pages/` | React pages. `AnalyticsPage.tsx` is ours |
| `client/src/App.tsx` | Layout and routes |
| `server/server.ts` | Server entry point |
| `shared/appkit-types/` | **Generated** types for your queries. Don't edit by hand |
| `databricks.yml` | Deployment definition, including the warehouse binding |
| `app.yaml` | How the platform starts the app |
| `.env` | Local settings only (profile, warehouse ID). Never commit it. It is already in `.gitignore` |

---

## Part 3: Write the SQL

### 3.1 Test SQL on the warehouse before putting it in a file

```sh
databricks experimental aitools tools query \
  "SELECT hour(tpep_pickup_datetime) AS hr, count(*) AS trips
   FROM samples.nyctaxi.trips
   WHERE date(tpep_pickup_datetime) BETWEEN '2016-02-01' AND '2016-02-29'
   GROUP BY hr ORDER BY hr" --profile <profile>
```

Also inspect the table first: `DESCRIBE samples.nyctaxi.trips`. We found `pickup_zip` is an `int`, which mattered for the ZIP filter.

Check your data's date range before writing date filters. This sample data is from 2016, so `CURRENT_DATE()` returns nothing.

### 3.2 The file format: parameters are declared in comments

`config/queries/trips_by_hour.sql`:

```sql
-- @param start_date DATE
-- @param end_date DATE
-- @param zip STRING
SELECT hour(tpep_pickup_datetime) AS hr, count(*) AS trips
FROM samples.nyctaxi.trips
WHERE date(tpep_pickup_datetime) >= CAST(:start_date AS DATE)
  AND date(tpep_pickup_datetime) <= CAST(:end_date AS DATE)
  AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
GROUP BY hr
ORDER BY hr;
```

Rules:

- Parameters use `:name` in the SQL and a `-- @param name TYPE` line at the top. The `@param` lines are what typegen reads.
- It is Databricks SQL, not PostgreSQL. For example `DATEDIFF` takes three arguments and there is no `ILIKE`.
- Every query selecting an aggregate next to a plain column needs a `GROUP BY`. This one is easy to miss.
- A query that must not take parameters (like `zip_options`) has no `@param` lines and no `:name` placeholders.
- A query with a `LIMIT` keeps result payloads small. AppKit's event cap is about 1 MB. Queries returning thousands of rows fail with `Event exceeds max size`.

Queries in this app:

| File | Returns | Parameters |
|---|---|---|
| `trips_by_hour.sql` | trips per hour of day | start, end, zip |
| `trips_by_day.sql` | trips per day | start, end, zip |
| `trips_by_fare_range.sql` | trips per fare bucket, ordered by fare | start, end, zip |
| `trip_details.sql` | up to 200 trips, pickup time in Eastern | start, end, zip |
| `kpis.sql` | total trips and average fare | start, end, zip |
| `zip_options.sql` | top 50 pickup ZIPs, to fill the dropdown | none |

### 3.3 Generate types

```sh
npm run typegen -- --wait
```

This creates `shared/appkit-types/analytics.d.ts`, which gives every query a typed name, parameters and row type. Write the SQL **before** the UI. Without the generated types the UI won't compile.

Gotcha: plain `npm run typegen` can print `OFFLINE` for a new query. That means typegen couldn't reach the warehouse and generated nothing for it. Starting `npm run dev` resolves it, because the server describes the query. After that, `npm run typegen -- --wait` picks it up from cache. The `prebuild` script already uses `--wait`.

---

## Part 4: Build the page

All the UI is in `client/src/pages/analytics/AnalyticsPage.tsx`. The components come from `@databricks/appkit-ui/react`.

### 4.1 Filters and shared parameters

```tsx
const [start, setStart] = useState('2016-02-01');
const [end, setEnd] = useState('2016-02-29');
const [selectedZips, setSelectedZips] = useState<string[]>([]);

const parameters = useMemo(
  () => ({
    start_date: sql.date(start),
    end_date: sql.date(end),
    zip: sql.string(selectedZips.join(',')),
  }),
  [start, end, selectedZips],
);
```

Why `useMemo`: the `parameters` object is a dependency of every query. Written inline it would be a new object on each render, so every query would re-run on every render. For a query with no parameters, define the empty object once the same way: `const noParams = useMemo(() => ({}), [])`.

Use the `sql.*` helpers (`sql.date`, `sql.string`, `sql.number`) so values are sent with the right type. Pass the same shared object only to queries that declare those parameters.

### 4.2 Charts and tables take a query key

```tsx
<BarChart queryKey="trips_by_hour" parameters={parameters} xKey="hr" yKey="trips" orientation="vertical" />
<LineChart queryKey="trips_by_day" parameters={parameters} xKey="day" yKey="trips" />
<DataTable queryKey="trip_details" parameters={parameters} pageSize={10} />
```

They fetch their own data. Don't also fetch the same key yourself unless you need the rows (we do, for export).

Checking component props: the docs index (`npx @databricks/appkit docs`) didn't have a page for every component. When it doesn't, read the installed type definitions in `node_modules/@databricks/appkit-ui/dist/react/` (for example `charts/types.d.ts`). The training data of AI tools is often stale on these APIs, so verify.

Gotcha: we set `orientation="vertical"` explicitly on the bar charts. Without it they rendered with horizontal bars, so hours ran bottom to top. Look at the real chart before trusting a default.

### 4.3 KPI cards: always wrap numbers in `Number()`

```tsx
const { data: kpi, loading, error } = useAnalyticsQuery('kpis', parameters);
const row = kpi?.[0];
...
{loading ? <Skeleton className="h-8 w-24" /> : Number(row?.total_trips ?? 0).toLocaleString()}
{`$${Number(row?.avg_fare ?? 0).toFixed(2)}`}
```

`AVG`, `SUM`, `DECIMAL` and large `BIGINT` values often arrive as **strings**. Calling `.toFixed()` on a string throws. Show a loading skeleton, and show the error if the query fails.

### 4.4 Pattern: multi-select filter

SQL parameters are single values, so for several ZIPs we send **one comma-separated string** and split it in SQL:

```sql
AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
```

- An empty string means "no filter", so it is the "all" value.
- The column is cast to a string because the parameter is a string, and `pickup_zip` is an integer.
- A dropdown item can't have an empty value, which is why the single-select version used a sentinel `'all'`. With the multi-select, an empty selection list is the sentinel.

The component is `client/src/components/ZipMultiSelect.tsx`. It uses `Popover` with a searchable `Command` list, check marks for selected items, a Clear button, and `Badge` chips for the selected ZIPs. Options come from `zip_options.sql`, which returns the top 50 ZIPs.

Layout tip: give every filter a label and align them in one flex row with `flex flex-wrap items-start gap-4`. An unlabeled control next to labeled ones will sit out of line.

### 4.5 Time zones

Timestamps in this table are UTC. To show Eastern time:

```sql
date_format(from_utc_timestamp(tpep_pickup_datetime, 'America/New_York'), 'yyyy-MM-dd HH:mm:ss') AS pickup_time_est
```

- Use `'America/New_York'`, not a fixed `-5` offset. It gives EST in winter and EDT in summer.
- Return a formatted **string**. A real timestamp would be serialized with a trailing `Z`, which wrongly means UTC.
- The date filters still compare the UTC date. A trip at 11 pm Eastern on Feb 1 falls on Feb 2 in UTC. If you want the filters in Eastern too, apply the same conversion in the `WHERE` of every query so the table, charts and KPIs agree.

### 4.6 Export to CSV or JSON

`client/src/lib/export.ts` builds the file in the browser and downloads it through a temporary link. Good practice built in:

- CSV values containing commas, quotes or line breaks are quoted correctly.
- A UTF-8 byte order mark at the start of the CSV, so Excel opens it with the right encoding.
- The file name carries the filters, for example `trip-details_2016-02-01_to_2016-02-29_10001-10003_est.csv`.
- The button is disabled while loading or when there are no rows.
- The page tells the user what is exported.

Known limit: it exports the rows the query returned (up to 200). A full export needs a separate query without the `LIMIT`, and large results can exceed the 1 MB payload cap. Excel `.xlsx` files would need an extra library. CSV already opens in Excel.

### 4.7 Choosing a chart

A pie chart was our first choice for "trips by fare range", and we replaced it. The fare ranges are ordered buckets with very uneven sizes, and slice angles are hard to compare. A bar chart with the bars in fare order (`ORDER BY MIN(fare_amount)` in the SQL) shows both the order and the sizes. Use pie charts only for a few parts of a whole.

---

## Part 5: Test

### 5.1 Run locally

```sh
npm run dev
```

Opens at `http://localhost:8000` with hot reload. It uses the profile and warehouse from `.env`. Look at the page yourself and try the filters. Passing tests don't replace this.

### 5.2 Type check and lint

```sh
npx tsc --noEmit -p tsconfig.client.json
npx eslint client/src
```

Don't use `as unknown as Type` casts. The AppKit lint rule rejects them. Narrow types with a check instead.

### 5.3 End-to-end tests with Playwright

The scaffold didn't include browser tests, so we added them:

```sh
npm install -D @playwright/test
npx playwright install chromium
```

- `playwright.config.ts` points at `http://localhost:8000` and reuses a running dev server.
- `tests/smoke.spec.ts` opens `/analytics` and checks the headings, card titles and default dates.
- `tests/zip-filter.spec.ts` selects two ZIPs, checks the badges and the total (1,256), then clears.
- `vitest.config.ts` excludes `tests/**`, so Vitest doesn't try to run Playwright files.
- Run them with `npm run test:e2e`.

Playwright gotchas:

- Strict mode: a selector must match exactly one element. Use `getByRole`, or `getByText('Text', { exact: true })`.
- Because of that, don't also set a chart's `title` prop to the same text as its card header. The text would appear twice and the test would fail.
- Use only Playwright locator methods (`getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`). `getByLabelText` is React Testing Library, not Playwright.
- Keep result sets small in tests. Big result sets hit the 1 MB event cap.

### 5.4 Validate before deploying

```sh
databricks apps validate --profile <profile>
```

Runs type generation, AST-grep lint, type checking, the build and the tests.

---

## Part 6: Deploy

```sh
DATABRICKS_BUNDLE_ENGINE=direct databricks apps deploy --profile <profile>
```

This validates, uploads the bundle to your workspace, deploys and starts the app, then prints the URL.

Problems we hit:

1. **`lifecycle.started is only supported in direct deployment mode`.** The template's `databricks.yml` uses `lifecycle: started: true`, which needs the "direct" bundle engine. Setting `DATABRICKS_BUNDLE_ENGINE=direct` fixes it without editing the file.
2. **`Workspace has reached the maximum limit of 3 apps`.** Our workspace allowed a maximum of 3 apps (limits depend on the workspace). List them with `databricks apps list --profile <profile>`. To free a slot you must delete an app. That is permanent, so confirm with its owner first. Stopped apps still count.

After deploying:

```sh
databricks apps get taxi-explorer --profile <profile>             # status
databricks apps logs taxi-explorer --follow --profile <profile>   # live logs (needs OAuth)
```

Then open the URL, sign in, and test the app in the browser. Our local tests ran against the dev server, not the deployed app.

For each change after the first deploy, repeat: edit, test locally, validate, deploy.

---

## Part 7: Things not done in this walkthrough, and what to add

These are gaps you should close for a team project:

1. **Source control.** The project was never put on GitHub. Do this early: `git init`, commit, create an empty GitHub repo, add it as `origin` and push. The scaffold's `.gitignore` already excludes `node_modules/`, `.env`, `.databricks/` and `.smoke-test/`. Never commit secrets.
2. **Who can use the app, and what data it can read.** By default the app runs as its own **service principal**, so that principal needs permission on the tables it reads (the `samples` data was readable without extra grants). For your own tables grant `SELECT` on the catalog, schema and table, and `CAN_USE` on the warehouse. If you need each viewer's own permissions enforced (row-level access), look at on-behalf-of-user execution. Choose it deliberately, and share the app with the right people.
3. **Cost.** A running warehouse costs money. Serverless warehouses stop on their own after being idle, but check the auto-stop setting. Stop apps you aren't using.
4. **Continuous integration.** Run `databricks apps validate` and `npm run test:e2e` on every pull request.
5. **Lint setup.** `npm run lint` currently reports errors on generated type files, a template test and our `tests/` folder, because the ESLint config doesn't cover them. Add them to the ESLint ignores or configure them.
6. **Larger exports.** The export is capped at 200 rows. Decide whether users need a full export and how to deliver it.
7. **Date filters in Eastern time.** Decide whether the date filters should use Eastern dates so they match the displayed times.
8. **Security hygiene.** Keep secrets only in `app.yaml`, `databricks.yml` or `.env`, never in client code. Don't embed credentials in anything that goes into the browser bundle.

---

## Quick reference: the whole flow

```sh
# One time
# Node + nvm in ~/.zshrc, Databricks CLI installed
databricks auth login --host <workspace-url> --profile <profile>

# Create
databricks apps manifest --profile <profile>
databricks warehouses start <warehouse-id> --profile <profile>
databricks apps init --name <name> --features analytics \
  --set analytics.sql-warehouse.id=<warehouse-id> --run none --profile <profile>
cd <name> && npm install

# Build loop
# 1. test SQL:  databricks experimental aitools tools query "..." --profile <profile>
# 2. add config/queries/<key>.sql with -- @param lines
# 3. npm run typegen -- --wait
# 4. use the key in the page (queryKey / useAnalyticsQuery)
# 5. npm run dev, check it in the browser
# 6. npx tsc --noEmit -p tsconfig.client.json ; npm run test:e2e

# Ship
databricks apps validate --profile <profile>
DATABRICKS_BUNDLE_ENGINE=direct databricks apps deploy --profile <profile>
```

## Lessons learned (the short list)

| Symptom | Cause | Fix |
|---|---|---|
| `node: command not found` | nvm isn't loaded by zsh | Add the nvm lines to `~/.zshrc` |
| `--set` value rejected | Space after `=` | `id=<value>`, no space |
| Typegen shows `OFFLINE` | Couldn't reach the warehouse | Run the dev server, then `npm run typegen -- --wait` |
| `.toFixed is not a function` | Numeric result came back as a string | Wrap in `Number()` |
| Every query re-runs on each render | Parameters object is rebuilt each render | Create it with `useMemo` |
| Aggregate query fails | Missing `GROUP BY` | Group by the non-aggregated column |
| Bar chart draws horizontally | Orientation not forced | `orientation="vertical"` |
| Deploy: `lifecycle.started ... direct deployment` | Template needs the direct engine | `DATABRICKS_BUNDLE_ENGINE=direct` |
| Deploy: 3-app limit | Workspace app limit (3 in ours) | Delete an app you own, or use another workspace |
| Playwright: strict mode violation | Selector matches more than one element | Role selectors, `exact: true`, no duplicate text |
