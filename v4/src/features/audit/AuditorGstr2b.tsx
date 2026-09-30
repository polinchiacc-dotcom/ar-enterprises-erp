/**
 * Auditor GSTR-2B (ITC) Verification — ஆடிட்டர் GSTR-2B (ITC) சரிபார்ப்பு
 * Routes: #/auditor (workspace) + #/auditor-login (standalone auditor login page)
 * Roles: super_admin, auditor
 *
 * NOTE: The production bundle (public/assets/index-CHTAzd11.js) contains the
 * compiled/live components `AuditorGstr2bPageFn` and `AuditorLoginPageFn`.
 * This file is the TypeScript reference kept in sync for maintainability.
 *
 * ## Workflow (Phase 1 — GSTR-2B ITC)
 * 1. Auditor uploads monthly GSTR-2B (ITC) B2B bills to a Google Sheet tab
 *    named `GSTR2B` (GSTIN, Supplier, Invoice No, Date, Taxable, IGST, CGST,
 *    SGST, Cess, Invoice Value, POS, Status, Remarks).
 * 2. Sheet shared "Anyone with link → Viewer"; URL configured on the page.
 * 3. Page reads the sheet live via Google Visualization JSONP
 *    (docs.google.com/.../gviz/tq?tqx=out:json;responseHandler=...) — no backend
 *    changes needed, works on static hosting.
 * 4. Status split views: ⏳ Pending / ✅ Confirmed / 📅 Next Month.
 *    Master status = sheet `Status` column; quick-mark buttons use a
 *    localStorage override + (for super_admin) a `worklog.create` entry with
 *    category "AUDIT-2B" visible in Work Tracker.
 * 5. Company cross-check: bills.list + transactions.list + vendors.list GSTINs
 *    are indexed; each 2B bill is matched and badged "✓ Bill/Txn/Vendor".
 * 6. Auto totals for numeric columns, CSV export (UTF-8 BOM) and A4 print
 *    (Portrait/Landscape) with official letterhead + 3 signature blocks.
 *
 * ## Auditor login
 * `#/auditor-login` is a standalone username/password page calling the same
 * `auth.login`; non-auditor roles are rejected. Auditors land on `#/auditor`
 * after login; main login page shows a "🛡️ Auditor Login" link.
 *
 * Live-tested permissions for role `auditor`: bills.list ✓, transactions.list ✓,
 * vendors.list ✓, audit.list ✓, gst.summary ✓, reports.run R7/R9/R11 ✓,
 * worklog.* ✗ (super_admin only), dashboard.summary ✗.
 *
 * ## Roadmap (user's page list, step-by-step after this phase)
 * Bank datas · Company bank accounts/insurance/loans · Workers & sub-contractors ·
 * Proceedings · Vehicles · Company documents · IT/GST/TDS/E-Invoice/E-Way ·
 * GST payment challans · Mail
 */
import { useState } from "react";

type Cfg = { sheetId: string; tab: string };
type Status = "confirmed" | "pending" | "next";

const CFG_KEY = "arAuditor2bCfg";
const OV_KEY = "arAuditor2bOv";

const GSTIN_RE = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g;

function normStatus(s: string): Status {
  const v = String(s || "").toLowerCase();
  if (/conf|உறுதி|done|yes/.test(v)) return "confirmed";
  if (/next|அடுத்த/.test(v)) return "next";
  return "pending";
}

/** Google Visualization JSONP loader — reads a public sheet without CORS. */
function gvizLoad(sheetId: string, tab: string, cb: (err: string | null, data?: any) => void) {
  const fn = "__arGviz" + Date.now();
  const clean = () => {
    delete (window as any)[fn];
    document.getElementById(fn)?.remove();
  };
  (window as any)[fn] = (data: any) => { clean(); cb(null, data); };
  const sc = document.createElement("script");
  sc.id = fn;
  sc.onerror = () => { clean(); cb("Sheet-ஐ படிக்க முடியவில்லை — Share → Anyone with link → Viewer ஆக மாற்றவும்"); };
  sc.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json;responseHandler:${fn}&sheet=${encodeURIComponent(tab || "GSTR2B")}&headers=1&cb=${Date.now()}`;
  document.head.appendChild(sc);
  setTimeout(() => { if ((window as any)[fn]) { clean(); cb("Timeout — Sheet ID / tab பெயரை சரிபார்க்கவும்"); } }, 15000);
}

export function parseGvizTable(data: any): { labels: string[]; rows: string[][] } | null {
  const tb = data?.table;
  if (!tb?.cols?.length || !tb?.rows?.length) return null;
  const labels = tb.cols.map((c: any) => String(c.label || c.id || "").trim());
  const rows = tb.rows
    .filter((r: any) => r?.c?.some((cell: any) => cell && cell.v !== null && cell.v !== undefined && cell.v !== ""))
    .map((r: any) => r.c.map((cell: any) => (cell == null ? "" : cell.f != null ? String(cell.f) : String(cell.v ?? ""))));
  return rows.length ? { labels, rows } : null;
}

export { normStatus, gvizLoad, GSTIN_RE, CFG_KEY, OV_KEY };
export type { Cfg, Status };
