const state = {
  data: null,
  activeTable: "top",
  filter: ""
};

const elements = {
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  perPage: document.querySelector("#perPage"),
  refreshButton: document.querySelector("#refreshButton"),
  sourceStatus: document.querySelector("#sourceStatus"),
  errorMessage: document.querySelector("#errorMessage"),
  totalSearches: document.querySelector("#totalSearches"),
  totalNoResults: document.querySelector("#totalNoResults"),
  noResultRate: document.querySelector("#noResultRate"),
  trackedQueries: document.querySelector("#trackedQueries"),
  topBars: document.querySelector("#topBars"),
  noResultBars: document.querySelector("#noResultBars"),
  topTab: document.querySelector("#topTab"),
  noResultTab: document.querySelector("#noResultTab"),
  queryFilter: document.querySelector("#queryFilter"),
  queryRows: document.querySelector("#queryRows"),
  downloadButton: document.querySelector("#downloadButton")
};

setDefaultDates();
wireEvents();
loadAnalytics();

function wireEvents() {
  elements.refreshButton.addEventListener("click", loadAnalytics);
  elements.topTab.addEventListener("click", () => setTable("top"));
  elements.noResultTab.addEventListener("click", () => setTable("noResult"));
  elements.queryFilter.addEventListener("input", (event) => {
    state.filter = event.target.value.trim().toLowerCase();
    renderTable();
  });
  elements.downloadButton.addEventListener("click", downloadJson);
}

function setDefaultDates() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  elements.startDate.value = toInputDate(start);
  elements.endDate.value = toInputDate(end);
}

async function loadAnalytics() {
  elements.sourceStatus.textContent = "Loading";
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = "";
  elements.refreshButton.disabled = true;

  const params = new URLSearchParams({
    start_date: elements.startDate.value,
    end_date: elements.endDate.value,
    per_page: elements.perPage.value
  });

  try {
    const response = await fetch(`/api/analytics?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load analytics.");
    state.data = data;
    render();
  } catch (error) {
    elements.sourceStatus.textContent = "API Error";
    elements.errorMessage.hidden = false;
    elements.errorMessage.textContent = error.message;
    elements.queryRows.innerHTML = `<tr><td class="empty" colspan="5">${escapeHtml(error.message)}</td></tr>`;
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function render() {
  const summary = state.data.summary || {};
  elements.sourceStatus.textContent = sourceLabel(state.data.source);
  elements.totalSearches.textContent = formatNumber(summary.totalSearches);
  elements.totalNoResults.textContent = formatNumber(summary.totalNoResults);
  elements.noResultRate.textContent = formatPercent(summary.noResultRate);
  elements.trackedQueries.textContent = formatNumber(summary.trackedQueries);
  renderBars(elements.topBars, state.data.topQueries || []);
  renderBars(elements.noResultBars, state.data.noResultQueries || []);
  renderTable();
}

function renderBars(container, rows) {
  const topRows = rows.slice(0, 8);
  const max = Math.max(...topRows.map((row) => row.searches), 1);
  container.innerHTML = topRows
    .map((row) => {
      const width = Math.max((row.searches / max) * 100, 3);
      return `
        <div class="bar-row">
          <div class="bar-label" title="${escapeHtml(row.query)}">${escapeHtml(row.query)}</div>
          <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
          <div class="bar-value">${formatNumber(row.searches)}</div>
        </div>
      `;
    })
    .join("");
}

function renderTable() {
  if (!state.data) return;

  const rows = (state.activeTable === "top" ? state.data.topQueries : state.data.noResultQueries) || [];
  const total = rows.reduce((sum, row) => sum + Number(row.searches || 0), 0);
  const filtered = state.filter
    ? rows.filter((row) => row.query.toLowerCase().includes(state.filter))
    : rows;

  if (!filtered.length) {
    elements.queryRows.innerHTML = '<tr><td class="empty" colspan="5">No queries found for this view.</td></tr>';
    return;
  }

  elements.queryRows.innerHTML = filtered
    .map((row) => {
      const share = total ? row.searches / total : 0;
      return `
        <tr>
          <td>${formatNumber(row.rank)}</td>
          <td>${escapeHtml(row.query)}</td>
          <td>${formatNumber(row.searches)}</td>
          <td>${formatNumber(row.clicks)}</td>
          <td>${formatPercent(share)}</td>
        </tr>
      `;
    })
    .join("");
}

function setTable(table) {
  state.activeTable = table;
  elements.topTab.classList.toggle("active", table === "top");
  elements.noResultTab.classList.toggle("active", table === "noResult");
  renderTable();
}

function downloadJson() {
  if (!state.data) return;
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `swiftype-analytics-${state.data.range.startDate}_to_${state.data.range.endDate}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sourceLabel(source) {
  if (source === "live") return "Live API";
  if (source === "cache") return "Cached";
  return "Sample";
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatPercent(value) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
