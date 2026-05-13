import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultDateRange,
  fetchAnalytics,
  loadEnvFile,
  normalizeRows,
  readCachedSnapshot,
  summarize,
  validateDateRange
} from "./lib/swiftype.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);

await loadEnvFile(path.join(__dirname, ".env"));

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/analytics") {
      await handleAnalytics(url, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    json(response, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Contentstack Swiftype dashboard running at http://localhost:${port}`);
});

async function handleAnalytics(url, response) {
  const defaults = defaultDateRange();
  const startDate = url.searchParams.get("start_date") || defaults.startDate;
  const endDate = url.searchParams.get("end_date") || defaults.endDate;
  const perPage = Number(url.searchParams.get("per_page") || 100);
  const useCache = url.searchParams.get("cache") === "1";
  validateDateRange(startDate, endDate);

  if (useCache || !process.env.SWIFTYPE_AUTH_TOKEN) {
    const cached = await readCachedSnapshot(path.join(__dirname, "data"));
    if (cached) {
      json(response, 200, { ...cached, source: "cache" });
      return;
    }

    json(response, 200, sampleData(startDate, endDate));
    return;
  }

  const engine = process.env.SWIFTYPE_ENGINE || "contentstack-documentation";
  const [topPayload, noResultPayload] = await Promise.all([
    fetchAnalytics({
      endpoint: "top_queries",
      authToken: process.env.SWIFTYPE_AUTH_TOKEN,
      engine,
      startDate,
      endDate,
      perPage
    }),
    fetchAnalytics({
      endpoint: "top_no_result_queries",
      authToken: process.env.SWIFTYPE_AUTH_TOKEN,
      engine,
      startDate,
      endDate,
      perPage
    })
  ]);

  const topQueries = normalizeRows(topPayload);
  const noResultQueries = normalizeRows(noResultPayload);
  json(response, 200, {
    generatedAt: new Date().toISOString(),
    source: "live",
    engine,
    range: { startDate, endDate, perPage },
    summary: summarize(topQueries, noResultQueries),
    topQueries,
    noResultQueries
  });
}

async function serveStatic(pathname, response) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, normalized));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    throw error;
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function sampleData(startDate, endDate) {
  const topQueries = [
    { rank: 1, query: "graphql", searches: 842, clicks: 210 },
    { rank: 2, query: "delivery token", searches: 611, clicks: 174 },
    { rank: 3, query: "webhook", searches: 486, clicks: 139 },
    { rank: 4, query: "content model", searches: 402, clicks: 120 },
    { rank: 5, query: "launch", searches: 318, clicks: 96 },
    { rank: 6, query: "workflow", searches: 277, clicks: 71 }
  ];
  const noResultQueries = [
    { rank: 1, query: "bulk publish api", searches: 73, clicks: 0 },
    { rank: 2, query: "branch alias", searches: 58, clicks: 0 },
    { rank: 3, query: "visual builder sdk", searches: 44, clicks: 0 },
    { rank: 4, query: "release automation", searches: 37, clicks: 0 },
    { rank: 5, query: "graphql pagination limit", searches: 29, clicks: 0 }
  ];

  return {
    generatedAt: new Date().toISOString(),
    source: "sample",
    engine: process.env.SWIFTYPE_ENGINE || "contentstack-documentation",
    range: { startDate, endDate, perPage: 100 },
    summary: summarize(topQueries, noResultQueries),
    topQueries,
    noResultQueries
  };
}
