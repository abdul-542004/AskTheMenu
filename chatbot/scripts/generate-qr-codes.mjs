#!/usr/bin/env node

/**
 * generate-qr-codes.mjs
 *
 * Generates QR code PNGs for each active restaurant table and a printable
 * HTML sheet. Reads tables from Supabase, builds URLs, and writes files
 * to chatbot/public/qr/.
 *
 * Usage:
 *   node scripts/generate-qr-codes.mjs                          # uses tables from DB
 *   node scripts/generate-qr-codes.mjs --base-url https://askthemenu.vercel.app
 *   node scripts/generate-qr-codes.mjs --static                 # use hardcoded slugs (no DB)
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import dotenv from "dotenv";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// ── Load env ──────────────────────────────────────────────────────────────────
dotenv.config({ path: resolve(ROOT, ".env.local") });

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const baseUrlIdx = args.indexOf("--base-url");
const BASE_URL =
  baseUrlIdx !== -1 && args[baseUrlIdx + 1]
    ? args[baseUrlIdx + 1]
    : process.env.NEXT_PUBLIC_APP_URL || "https://askthemenu.vercel.app";
const useStatic = args.includes("--static");

// ── Output directory ──────────────────────────────────────────────────────────
const OUT_DIR = resolve(ROOT, "public", "qr");
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// ── Static fallback slugs ─────────────────────────────────────────────────────
const STATIC_TABLES = [
  { label: "Table 1", qrSlug: "table-1" },
  { label: "Table 2", qrSlug: "table-2" },
  { label: "Table 3", qrSlug: "table-3" },
  { label: "Table 4", qrSlug: "table-4" },
  { label: "Table 5", qrSlug: "table-5" },
];

// ── Fetch tables from database ────────────────────────────────────────────────
async function fetchTablesFromDb() {
  const dbUrl =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.warn("⚠  No database URL found, falling back to static tables.");
    return null;
  }

  const sql = postgres(dbUrl, { connect_timeout: 5 });

  try {
    const rows = await sql`
      SELECT label, "qrSlug"
      FROM "RestaurantTable"
      WHERE "isActive" = true
      ORDER BY label ASC
      LIMIT 5
    `;
    await sql.end();
    return rows.map((r) => ({ label: r.label, qrSlug: r.qrSlug }));
  } catch (err) {
    console.warn("⚠  DB query failed, falling back to static tables:", err.message);
    await sql.end().catch(() => {});
    return null;
  }
}

// ── Generate QR codes ─────────────────────────────────────────────────────────
async function generateQRCode(url, filePath) {
  await QRCode.toFile(filePath, url, {
    type: "png",
    width: 400,
    margin: 2,
    color: {
      dark: "#1a1a2e",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

// ── Generate printable HTML sheet ─────────────────────────────────────────────
function generatePrintableHTML(tables, baseUrl) {
  const cards = tables
    .map(
      (t) => `
    <div class="card">
      <img src="./${t.qrSlug}.png" alt="QR code for ${t.label}" />
      <h2>${t.label}</h2>
      <p class="url">${baseUrl}/chat/${t.qrSlug}</p>
      <p class="instruction">Scan to view menu &amp; order</p>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AskTheMenu — QR Codes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: #f8f9fa;
      padding: 2rem;
      color: #1a1a2e;
    }
    h1 {
      text-align: center;
      margin-bottom: 0.5rem;
      font-size: 1.8rem;
      letter-spacing: -0.02em;
    }
    .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 2rem;
      font-size: 0.9rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1.5rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .card img {
      width: 180px;
      height: 180px;
      margin: 0 auto 1rem;
      display: block;
    }
    .card h2 {
      font-size: 1.2rem;
      margin-bottom: 0.25rem;
    }
    .card .url {
      font-size: 0.7rem;
      color: #9ca3af;
      word-break: break-all;
      margin-bottom: 0.5rem;
    }
    .card .instruction {
      font-size: 0.85rem;
      color: #6366f1;
      font-weight: 500;
    }
    .print-btn {
      display: block;
      margin: 0 auto 2rem;
      padding: 0.6rem 1.5rem;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      cursor: pointer;
      font-weight: 500;
    }
    .print-btn:hover { background: #4f46e5; }
    @media print {
      .print-btn { display: none; }
      body { background: white; padding: 0.5rem; }
      .grid { gap: 1rem; }
      .card { border: 1px solid #ccc; }
    }
  </style>
</head>
<body>
  <h1>🍽 AskTheMenu</h1>
  <p class="subtitle">Scan a QR code to view the menu and place your order</p>
  <button class="print-btn" onclick="window.print()">🖨 Print QR Codes</button>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔧 AskTheMenu QR Code Generator");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Output:   ${OUT_DIR}\n`);

  let tables;
  if (useStatic) {
    tables = STATIC_TABLES;
    console.log("📋 Using static table list (--static flag).\n");
  } else {
    tables = await fetchTablesFromDb();
    if (!tables || tables.length === 0) {
      tables = STATIC_TABLES;
      console.log("📋 Using static fallback table list.\n");
    } else {
      console.log(`📋 Found ${tables.length} tables in database.\n`);
    }
  }

  for (const table of tables) {
    const url = `${BASE_URL}/chat/${table.qrSlug}`;
    const filePath = resolve(OUT_DIR, `${table.qrSlug}.png`);

    await generateQRCode(url, filePath);
    console.log(`  ✅ ${table.label} → ${table.qrSlug}.png  (${url})`);
  }

  // Generate printable HTML
  const htmlPath = resolve(OUT_DIR, "qr-sheet.html");
  const html = generatePrintableHTML(tables, BASE_URL);
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`\n  📄 Printable sheet → qr-sheet.html`);

  console.log(`\n✨ Done! ${tables.length} QR codes generated in public/qr/`);
}

main().catch((err) => {
  console.error("❌ QR generation failed:", err);
  process.exit(1);
});
