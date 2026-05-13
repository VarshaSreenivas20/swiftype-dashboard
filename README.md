# Contentstack Swiftype Search Dashboard

Local dashboard and automation script for Contentstack Docs Swiftype analytics.

## What It Tracks

- Top search queries for a selected date range.
- Top queries that returned no results.
- Total searches, no-result searches, no-result rate, tracked query counts, and query share.
- JSON snapshots that can be committed, archived, or used as cached dashboard data.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Add `SWIFTYPE_AUTH_TOKEN`.
3. Run the dashboard:

```bash
npm start
```

The dashboard runs at `http://localhost:4173`.

If no token is configured, the UI shows sample data. If a cached file exists in `data/`, the UI uses the latest cached snapshot.

## Fetch Automation

Run a one-off fetch:

```bash
npm run fetch -- --start-date=2025-10-01 --end-date=2025-10-31 --per-page=100
```

The script writes a snapshot to:

```text
data/swiftype-analytics-YYYY-MM-DD_to_YYYY-MM-DD.json
```

For recurring automation, run the same command from your scheduler or CI. Keep `SWIFTYPE_AUTH_TOKEN` in environment variables or deployment secrets.

## GitHub Actions Cron

The workflow in `.github/workflows/swiftype-analytics.yml` runs daily at 11:00 AM IST.

GitHub cron schedules use UTC, so the configured schedule is:

```yaml
cron: "30 5 * * *"
```

Before enabling it, add this repository secret:

```text
SWIFTYPE_AUTH_TOKEN
```

Optionally add this repository variable:

```text
SWIFTYPE_ENGINE=contentstack-documentation
```

The workflow can also be run manually from the GitHub Actions tab with optional `start_date`, `end_date`, and `per_page` inputs.

## Deployment Notes

- The app uses only Node built-ins, so no dependency install is required.
- Set `SWIFTYPE_AUTH_TOKEN`, `SWIFTYPE_ENGINE`, and `PORT` in the deployment environment.
- For Contentstack Launch, point the start command to `npm start`.
