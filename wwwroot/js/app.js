"use strict";

// Alle Daten kommen ausschließlich über die lokale ASP.NET-Core-API.
// Der Browser verbindet sich NIEMALS direkt mit SQL Server.
const state = { all: [], room: "all", type: "", loaded: false };
const $ = (id) => document.getElementById(id);
const number = (v, digits = 1) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(v);
const units = { Helligkeit: "lx", Luftfeuchtigkeit: "%", CO2: "ppm", Lautstärke: "dB", Temperatur: "°C" };
const symbols = { Helligkeit: "☀", Luftfeuchtigkeit: "◈", CO2: "CO₂", Lautstärke: "♪", Temperatur: "℃" };
const palette = ["#4169eb", "#18a88c", "#dc9651", "#9b78dc", "#dc7293"];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function timestampLabel(raw) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}
function isOutside(reading) {
  if (reading.value === null) return null;
  return (reading.min !== null && reading.value < reading.min) ||
         (reading.max !== null && reading.value > reading.max);
}
function currentReadings() {
  return state.room === "all" ? state.all : state.all.filter((m) => String(m.roomId) === state.room);
}
function setOptions() {
  const rooms = new Map(state.all.map((m) => [String(m.roomId), `${m.roomName} · ${m.building ?? "Gebäude ?"}`]));
  const roomOptions = [...rooms.entries()].sort((a, b) => a[1].localeCompare(b[1], "de-DE"));
  $("roomSelect").replaceChildren(new Option("Alle Räume", "all"), ...roomOptions.map(([id, label]) => new Option(label, id)));
  if (state.room !== "all" && !rooms.has(state.room)) state.room = "all";
  $("roomSelect").value = state.room;

  const types = [...new Map(state.all.map((m) => [String(m.measurementTypeId), m.measurementName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "de-DE"));
  $("typeSelect").replaceChildren(...types.map(([id, label]) => new Option(label, id)));
  if (!types.some(([id]) => id === state.type)) {
    state.type = types.find(([, name]) => name === "CO2")?.[0] ?? types[0]?.[0] ?? "";
  }
  $("typeSelect").value = state.type;
}
function display() {
  const rows = currentReadings();
  const roomIds = new Set(rows.map((m) => m.roomId));
  const deviceIds = new Set(rows.map((m) => m.deviceId));
  $("statMeasurements").textContent = number(rows.length, 0);
  $("statRooms").textContent = number(roomIds.size, 0);
  $("statDevices").textContent = number(deviceIds.size, 0);
  $("statAlerts").textContent = number(rows.filter((m) => isOutside(m) === true).length, 0);
  renderLatest(rows);
  renderTable(rows);
  drawLine(rows);
  drawBars(rows);
}
function renderLatest(rows) {
  const latest = new Map();
  for (const item of rows) {
    const key = item.measurementName;
    // SQL liefert die Daten bereits mit neuestem Zeitpunkt und ID zuerst.
    if (!latest.has(key)) latest.set(key, item);
  }
  const html = [...latest.values()].sort((a, b) => a.measurementName.localeCompare(b.measurementName, "de-DE"))
    .map((m) => {
      const outside = isOutside(m);
      const badge = outside === null ? ["unknown", "Kein Wert"] : outside ? ["bad", "Prüfen"] : ["", "Im Bereich"];
      const value = m.value === null ? "–" : number(m.value, 2);
      return `<article class="latest-card">
          <div class="latest-head"><span class="latest-icon">${escapeHtml(symbols[m.measurementName] ?? "◦")}</span>${escapeHtml(m.measurementName)}</div>
          <div class="latest-number">${value}<span>${escapeHtml(units[m.measurementName] ?? "")}</span></div>
          <div class="latest-meta"><span>${escapeHtml(m.roomName)} · ${escapeHtml(timestampLabel(m.timestamp))}</span><span class="status ${badge[0]}">${badge[1]}</span></div>
        </article>`;
    }).join("");
  $("latestCards").innerHTML = html || "<p>Keine Messwerte für diesen Raum.</p>";
}
function renderTable(rows) {
  const latestRows = rows.slice(0, 15);
  $("measurementsBody").innerHTML = latestRows.length ? latestRows.map((m) => `<tr>
      <td>${m.measurementId}</td>
      <td><strong>${escapeHtml(m.roomName)}</strong></td>
      <td>${m.deviceId}</td>
      <td>${escapeHtml(m.measurementName)}</td>
      <td><span class="value-pill">${m.value === null ? "–" : number(m.value, 2)} ${escapeHtml(units[m.measurementName] ?? "")}</span></td>
      <td>${escapeHtml(timestampLabel(m.timestamp))}</td>
    </tr>`).join("") : '<tr><td colspan="6">Keine Messwerte vorhanden.</td></tr>';
}
function canvasSetup(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(260, canvas.clientWidth);
  const height = Math.max(180, canvas.clientHeight);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  return { ctx, width, height };
}
function drawEmpty(ctx, width, height, text) {
  ctx.fillStyle = "#8a98aa";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
}
function drawLine(rows) {
  const canvas = $("lineChart");
  const { ctx, width, height } = canvasSetup(canvas);
  const selected = rows.filter((m) => String(m.measurementTypeId) === state.type && m.value !== null);
  const currentName = $("typeSelect").selectedOptions[0]?.textContent ?? "Messwert";
  $("lineTitle").textContent = `${currentName} · Verlauf`;
  $("lineSubtitle").textContent = state.room === "all" ? "Separate Linien pro Raum" : "Zeitliche Entwicklung im ausgewählten Raum";
  if (!selected.length) {
    drawEmpty(ctx, width, height, "Keine Werte vorhanden");
    $("lineFooter").textContent = "–";
    return;
  }
  const groups = new Map();
  for (const row of selected) {
    const key = String(row.roomId);
    if (!groups.has(key)) groups.set(key, { name: row.roomName, rows: [] });
    groups.get(key).rows.push(row);
  }
  const values = selected.map((m) => m.value);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  const extra = (maxV - minV) * 0.18 || Math.max(Math.abs(maxV) * .12, 1);
  minV -= extra;
  maxV += extra;
  const timeValues = selected.map((m) => Date.parse(m.timestamp));
  const timeMin = Math.min(...timeValues), timeMax = Math.max(...timeValues);
  const left = 54, right = 17, top = 16, bottom = 41;
  const chartWidth = Math.max(1, width - left - right), chartHeight = Math.max(1, height - top - bottom);
  const x = (m) => timeMin === timeMax ? left + chartWidth / 2 : left + (Date.parse(m.timestamp) - timeMin) / (timeMax - timeMin) * chartWidth;
  const y = (value) => top + (maxV - value) / (maxV - minV) * chartHeight;

  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const yy = top + i * chartHeight / 4;
    ctx.beginPath(); ctx.strokeStyle = "#eaf0f7"; ctx.lineWidth = 1;
    ctx.moveTo(left, yy); ctx.lineTo(width - right, yy); ctx.stroke();
    ctx.fillStyle = "#8896a8";
    ctx.fillText(number(maxV - i * (maxV - minV) / 4, 1), left - 10, yy + 4);
  }
  ctx.textAlign = "center";
  for (const [ts, xx] of [[timeMin, left], [timeMax, left + chartWidth]]) {
    ctx.fillStyle = "#8b99aa";
    ctx.fillText(new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), xx, height - 17);
    ctx.fillText(new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), xx, height - 4);
  }

  const legends = [];
  [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "de-DE")).forEach((group, index) => {
    const color = palette[index % palette.length];
    const points = group.rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.measurementId - b.measurementId);
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    for (let i = 0; i < points.length; i++) {
      const xx = x(points[i]), yy = y(points[i].value);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    for (const p of points) {
      ctx.beginPath(); ctx.arc(x(p), y(p.value), 3.6, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
    }
    legends.push(`<span style="color:${color}">●</span> Raum ${escapeHtml(group.name)} (${points.length})`);
  });
  $("lineFooter").innerHTML = `${legends.join(" &nbsp;&nbsp; ")} &nbsp; · Einheit: ${escapeHtml(units[currentName] ?? "–")}`;
}
function drawBars(rows) {
  const { ctx, width, height } = canvasSetup($("barChart"));
  const counts = new Map();
  for (const m of rows) counts.set(m.measurementName, (counts.get(m.measurementName) ?? 0) + 1);
  const entries = [...counts].sort((a, b) => a[0].localeCompare(b[0], "de-DE"));
  if (!entries.length) { drawEmpty(ctx, width, height, "Keine Daten vorhanden"); return; }
  const max = Math.max(...entries.map(([, count]) => count), 1);
  const left = 38, top = 16, bottom = 40, right = 10;
  const cw = Math.max(1, width - left - right), ch = Math.max(1, height - top - bottom);
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const yy = top + i * ch / 4;
    ctx.beginPath(); ctx.strokeStyle = "#eaf0f7";
    ctx.moveTo(left, yy); ctx.lineTo(width - right, yy); ctx.stroke();
    ctx.fillStyle = "#8997a9";
    ctx.fillText(number(max * (4 - i) / 4, 0), left - 8, yy + 4);
  }
  const step = cw / entries.length, bw = Math.min(42, step * .5);
  entries.forEach(([name, count], i) => {
    const xx = left + (i + .5) * step, barH = count / max * (ch - 14);
    ctx.fillStyle = palette[i % palette.length];
    ctx.beginPath();
    ctx.roundRect(xx - bw / 2, top + ch - barH, bw, barH, [6, 6, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#64768e";
    ctx.textAlign = "center";
    const short = { Helligkeit: "Licht", Luftfeuchtigkeit: "Feuchte", CO2: "CO₂", Lautstärke: "Lärm", Temperatur: "Temp." }[name] ?? name.slice(0, 7);
    ctx.fillText(short, xx, height - 17);
    ctx.fillStyle = "#354760";
    ctx.fillText(String(count), xx, top + ch - barH - 7);
  });
}
async function load() {
  const button = $("refreshButton");
  const errorBox = $("errorBox");
  button.disabled = true;
  errorBox.hidden = true;
  try {
    const response = await fetch("/api/measurements", { cache: "no-store" });
    if (!response.ok) throw new Error(`API-Fehler: HTTP ${response.status}. Prüfe die Ausgabe im VS-Code-Terminal.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unerwartete API-Antwort.");
    state.all = data;
    state.loaded = true;
    setOptions();
    display();
    $("updatedAt").textContent = `Zuletzt aktualisiert: ${new Date().toLocaleString("de-DE")}`;
  } catch (err) {
    errorBox.textContent = `Laden fehlgeschlagen: ${err.message}`;
    errorBox.hidden = false;
    if (!state.loaded) $("measurementsBody").innerHTML = '<tr><td colspan="6">SQL-Daten konnten nicht geladen werden.</td></tr>';
  } finally { button.disabled = false; }
}
$("refreshButton").addEventListener("click", load);
$("roomSelect").addEventListener("change", (event) => { state.room = event.target.value; display(); });
$("typeSelect").addEventListener("change", (event) => { state.type = event.target.value; display(); });
let resizeFrame = 0;
window.addEventListener("resize", () => {
  if (!state.loaded) return;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { const rows = currentReadings(); drawLine(rows); drawBars(rows); });
});
load();
