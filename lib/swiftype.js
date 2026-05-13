import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { URL } from "node:url";

const API_BASE = "https://api.swiftype.com/api/v1/engines";

export function loadEnvFile(filePath = ".env") {
  return fs
    .readFile(filePath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (!process.env[key]) {
          process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
        }
      }
    })
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
}

export function defaultDateRange(today = new Date()) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

export function validateDateRange(startDate, endDate) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }
  if (startDate > endDate) {
    throw new Error("start_date must be before or equal to end_date.");
  }
}

export async function fetchAnalytics({ endpoint, authToken, engine, startDate, endDate, perPage = 100 }) {
  validateDateRange(startDate, endDate);

  if (!authToken) {
    throw new Error("Missing SWIFTYPE_AUTH_TOKEN. Add it to .env or your deployment environment.");
  }

  const url = new URL(`${API_BASE}/${encodeURIComponent(engine)}/analytics/${endpoint}.json`);
  const payload = JSON.stringify({
    auth_token: authToken,
    start_date: startDate,
    end_date: endDate,
    per_page: String(perPage)
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          let parsed;
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch {
            parsed = { raw: body };
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Swiftype returned ${response.statusCode}: ${JSON.stringify(parsed)}`));
            return;
          }

          resolve(parsed);
        });
      }
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

export function normalizeRows(payload) {
  const candidateLists = [
    payload?.results,
    payload?.queries,
    payload?.top_queries,
    payload?.records,
    Array.isArray(payload) ? payload : null
  ];

  const rows = candidateLists.find(Array.isArray) || [];
  return rows.map((item, index) => {
    if (Array.isArray(item)) {
      return {
        rank: index + 1,
        query: String(item[0] ?? ""),
        searches: asNumber(item[1]),
        clicks: asNumber(item[2]),
        raw: item
      };
    }

    const query = item.query ?? item.term ?? item.search_term ?? item.key ?? item.value ?? "";
    const searches = item.count ?? item.searches ?? item.total ?? item.frequency ?? item.value;
    const clicks = item.clicks ?? item.click_count ?? item.total_clicks;

    return {
      rank: item.rank ?? index + 1,
      query: String(query),
      searches: asNumber(searches),
      clicks: asNumber(clicks),
      raw: item
    };
  });
}

export function summarize(topQueries, noResultQueries) {
  const totalSearches = sum(topQueries.map((row) => row.searches));
  const totalNoResults = sum(noResultQueries.map((row) => row.searches));
  const totalClicks = sum(topQueries.map((row) => row.clicks));
  return {
    totalSearches,
    totalNoResults,
    totalClicks,
    noResultRate: totalSearches ? totalNoResults / totalSearches : 0,
    trackedQueries: topQueries.length,
    trackedNoResultQueries: noResultQueries.length
  };
}

export async function readCachedSnapshot(dataDir = "data") {
  const files = await fs.readdir(dataDir).catch(() => []);
  const snapshots = files
    .filter((file) => file.startsWith("swiftype-analytics-") && file.endsWith(".json"))
    .sort()
    .reverse();

  if (!snapshots.length) return null;
  const latest = path.join(dataDir, snapshots[0]);
  const content = await fs.readFile(latest, "utf8");
  return JSON.parse(content);
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + asNumber(value), 0);
}
