import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultDateRange,
  fetchAnalytics,
  loadEnvFile,
  normalizeRows,
  summarize
} from "../lib/swiftype.js";

await loadEnvFile();

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ""] = arg.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const defaults = defaultDateRange();
const startDate = args.get("start-date") || process.env.START_DATE || defaults.startDate;
const endDate = args.get("end-date") || process.env.END_DATE || defaults.endDate;
const perPage = Number(args.get("per-page") || process.env.PER_PAGE || 100);
const engine = process.env.SWIFTYPE_ENGINE || "contentstack-documentation";
const authToken = process.env.SWIFTYPE_AUTH_TOKEN;

const [topPayload, noResultPayload] = await Promise.all([
  fetchAnalytics({
    endpoint: "top_queries",
    authToken,
    engine,
    startDate,
    endDate,
    perPage
  }),
  fetchAnalytics({
    endpoint: "top_no_result_queries",
    authToken,
    engine,
    startDate,
    endDate,
    perPage
  })
]);

const topQueries = normalizeRows(topPayload);
const noResultQueries = normalizeRows(noResultPayload);
const snapshot = {
  generatedAt: new Date().toISOString(),
  engine,
  range: {
    startDate,
    endDate,
    perPage
  },
  summary: summarize(topQueries, noResultQueries),
  topQueries,
  noResultQueries,
  raw: {
    topQueries: topPayload,
    noResultQueries: noResultPayload
  }
};

await fs.mkdir("data", { recursive: true });
const outputPath = path.join("data", `swiftype-analytics-${startDate}_to_${endDate}.json`);
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`Saved ${outputPath}`);
console.log(`Top queries: ${topQueries.length}`);
console.log(`No-result queries: ${noResultQueries.length}`);
