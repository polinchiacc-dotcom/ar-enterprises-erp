# PROMPT FOR NEXT AI — AR Enterprises ERP V4 — Backup 2026-09-27

**Copy-paste this entire prompt to any new AI (ChatGPT, Claude, Gemini, etc.) to continue building the website without losing progress.**

---

You are continuing AR Enterprises ERP V4 — a live ERP website for Tamil Nadu district-wise vendor collection + finance + GST + AI operations.

**Context you must know:**

1. **Repo & Branch:** `polinchiacc-dotcom/ar-enterprises-erp` branch `arena/01a0ba0b-ar-enterprises-erp` (from main commit a2c9614). Working directory is `v4/`. All code in `v4/`. Docs in `docs/v4/`. Build: `npm run build` inside `v4` → Vite 7.3.6, 435.95kB gzip 122.76kB success as of 2026-09-27.

2. **Tech Stack (non-negotiable):**
   - Frontend: React 19 + TypeScript + Vite, hash router (`src/app/router.tsx`), custom UI tokens, Tamil/English i18n, no localStorage as source of truth.
   - Backend: ONE Google Apps Script project with 37 .gs files at top level (from `v4/apps-script/` subfolders `config/`, `lib/`, `mod/` — ignore subfolders when pasting to Apps Script). `appsscript.json` sets V8 runtime.
   - Data: Google Sheets single source of truth (28 tabs for V4 internal) + Google Drive for attachments/backups. Also external live Google Sheet for bank reconciliation (see below).
   - Gateway: Vercel serverless functions in `v4/api/` — browser never talks directly to Apps Script, only via Vercel which signs requests with GATEWAY_SECRET.
   - Auth: bcrypt password hash (cost ≥12) never leaves Apps Script, session token SHA-256 hash stored, 8h expiry, max 3 active, 5 fails → 15min lock. Roles: super_admin, district_admin, agent, vendor, auditor. Every CREATE/UPDATE/APPROVE/EXPORT audited.
   - Deploy: Vercel Root Directory = `v4`, env vars: GATEWAY_SECRET (48 chars, must match Apps Script ScriptProperty), APPS_SCRIPT_URL (Web App /exec URL), ANTHROPIC_API_KEY optional.

3. **Google Sheets — Two Workbooks:**
   - **V4 Internal Workbook** (created by `SetupOnce.gs`): ID in ScriptProperty WORKBOOK_ID, 28 tabs: `_meta`, `Vendors`, `Transactions`, `Bills`, `Payments`, `Projects`, `BankStatements`, `GSTR2B`, `ITCRegister`, `GSTFilings`, `Wallet`, `AgentWallet`, `Agents`, `Users`, `Sessions`, `Districts`, `Categories`, `CommissionSlabs`, `AgentOverrides`, `Notifications`, `WorkLog`, `Settings`, `AuditLog`, `ArchiveLog`, `AIUsageLog`, `ImportExports`, `Backups`. Schema in `docs/v4/data/07-sheets-schema.md`.
   - **External Live Bank Sheets** (user's real data, ONLY source for Phase 2): Spreadsheet ID `1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw`, GIDs: Bank Statement (Polinchi B/S 1712) `2024650928` 1804 entries (BY credits + TO debits), Contract Work FY 24-25 `1782489685` 65 entries, Contract Work FY 25-26 `790298656` 68 entries (Work Name empty many but Taxable Value filled), Contract Work FY 23 to 24 `1882690159` 67 entries. Total contract main = 200. Bank is confirmation only. Columns A-W: S.No, Party, Work Name, ., Receipt Amount, Work Place, Work Type, Eng Name, Taxable Value, Labour Welfare Fund, 18% GST, Invoice Value, Income Tax TDS 2%, GST TDS 2%, GST TDS Received Month, With Held Amount, EMD, Other Deductions, Receivable Amount, Receipt Date, Department, Receipt Amount (dup), S/M, FY, File Name — keep empty as empty for future 2-way live sync. Date formats: DD/MM/YYYY, DD-MMM-YY (21-Apr-25, 24-Dec-25), MMM-YY (Dec-25, Nov-23, Sep-25). Auto-include if new sheet name contains "Contract".

4. **Phase 2 Mini-Tally Live Bank Reconciliation — Current Status SUCCESS (2026-09-27 commit 71c8a80):**
   - **Requirement:** 200 contract entries main (67+68+65) + bank confirmation attached at end per row paired same color (Receipt Date blue #e0f2fe + Bank Date blue #e0f2fe with borderLeft 3px solid #0ea5e9). All columns A-W must appear, empty kept as empty. Totals bottom row auto total for all amount columns (Receipt Amount, Taxable Value, Labour Welfare Fund, 18% GST, Invoice Value, IT TDS 2%, GST TDS 2%, With Held, EMD, Other Deduction, Receivable) filtered or not, plus top mini-dashboard showing all data separately. Filters BRS Status, FY, Work Place, Date From/To, Search must update table below live (backend + frontend). Bank huge total bug fixed (only confirmation, not huge sum). Live: edit/add in any of 4 sheets → Refresh Live → website effect; Bank monthly update → Refresh. Print ready like All_Sheets_Combined_With_Matching_Print_Ready_Report.html with all columns + totals + signatures.
   - **Backend `mod/BankLive.gs` logic (final):**
     - `parseDateAny`: handles ISO YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MMM-YY (21-Apr-25), MMM-YY (Dec-25 → YYYY-MM-01), typo Jna → Jan.
     - `parseBankSheet`: header row find Description + Credit/Running Balance (first 10 rows), dateIdx fallback 1, descIdx 2, creditIdx 6, balIdx 7, debitIdx 8, amount try creditIdx then debitIdx then col 4-8 excluding balIdx <100M, isCredit = desc starts with BY, isDebit = starts with TO, else if charges/fee/maintenance → debit else credit, credit = amount if isCredit else 0, keep all but mark isCredit, for matching use only credit>0 (BY only) — fixes huge total ₹4,12,24,78,61,42,09,98,660 which was picking balance as credit.
     - `parseContractSheet`: header row Work Name + Receipt (first 5 rows), findIdx for all columns, skip if entire row empty, skip if row contains "total" and S.No empty or not numeric, skip if S.No empty (mandatory) — fixes 204→200, skip S.No header, skip work name header, workName keep empty as "", numAt helper, receiptAmt fallback receivable→invoice→taxable→21,22 dup columns, hasAmount check, dateStr via parseDateAny try col 18-22 if empty, fy fallback.
     - `parseAllContractSheets`: knownGids [1782489685,790298656,1882690159] + name contains "contract" auto-include, fyLabel from name match 20xx-xx, counts.
     - `smartMatch`: bAmt=credit, cAmt=receipt||receivable||invoice, denom max, amountDiff %, bTime/cTime, dateDiff days or 999 if missing, strict: amount 0 date 0 →100 exact, 0 date≤1→95 exact, 0 ≤3→90 exact, 0 ≤7→80 exact, 0 ≤15→60 partial, ≤0.5% date0→85 exact, ≤0.5% ≤3→75 partial, ≤1% ≤3→65 partial, ≤2% ≤7→50 near, ≤5% ≤3→40 near else unmatched, dateDiff>30 and amountDiff!=0 → force unmatched, keyword boost if dateDiff≤7.
     - `liveRecon`: bankRowsAll=parseBankSheet, bankRows=filter credit>0, contractData=parseAllContractSheets, filters: filterStatus exact/partial/near/unmatched/all, filterFY substring both ways short 20 removed, workPlaceFilter substring, search workName+workPlace+fileName+bankDesc+S.No, dateFrom/dateTo ISO compare, for each contract find bestMatch via quick amountDiff>5% skip + smartMatch, then exact amount loop, force unmatched if rawDateDiff>30 and amountDiff!=0, combined push, filtered filter, sort by receiptDate descending, stats totalBank sum BY credits only, totalContract sum receiptAmount, matched/partial/near/unmatched counts, bankCount total, bankCreditCount BY, contractCount, countsBySheet.
   - **Frontend `BankLiveRecon.tsx`:**
     - State filterStatus, filterFY, search, dateFrom, dateTo, workPlaceFilter, editingContract, showPrint, liveParams with all filters, useQuery `bank.liveRecon` deps liveParams fields, debounce 250ms.
     - workPlaceOptions unique sorted 150, fyOptions unique sorted.
     - totals filtered sums all amount columns + count, allTotals unfiltered.
     - Top dashboard 8 stats with 200 check green/red diff.
     - Filters Card BRS Status (All 200 Day Book, Reconciled same date+amount, Partial amount≤1% date≤3d, Near date≤7d amount≤2%, Pending), FY (All + fyOptions + hardcoded), Work Place, From/To Date, Search Tamil/English file bank desc S.No, Clear button.
     - Table minWidth 2000 fontSize 11 columns S.No, Receipt Date paired blue #e0f2fe borderLeft 3px #0ea5e9 bold #0284c7 when bank, Work Name 200 main maxWidth 260 empty → "(empty — keep as empty for future update)" + engName+dept, Work Place empty → "(empty)" + edit, Work Type, Party, Taxable, Labour, GST, Invoice, TDS, GST TDS, With Held, EMD, Other, Receivable, Receipt Amount bold, FY Badge, File Name, Bank Confirmation minWidth 240 background #e0f2fe borderLeft 3px #0ea5e9 when bank, Bank Date dstr + (same date ✓) or (Xd diff), description 80 chars, Credit type Bal, BRS Status Badge ok/warn/info/err + confidence + amountDiff + dateDiff, Actions.
     - Bottom totals row #f1f5f9 bold borderTop 2px solid #000 colSpan 6 TOTAL + sums + receiptAmount #dbeafe.
     - Edit modal workName textarea + workPlace input via `bank.liveUpdate`.
     - Print with all columns + totals + header SRI POLINCHI AND CO BRS 200 Account 510909010201712 + signatures.

5. **Working Mode (must follow):**
   - One step per reply, clear Tamil (with English tech terms), zero ambiguity copy-paste.
   - User reports completion before next step.
   - No API keys in frontend, no localStorage authoritative, server validation + audit, hashed passwords, protected ranges.
   - Build strictly `docs/v4`, but code in `v4/`.
   - Branch fixed: `arena/01a0ba0b-ar-enterprises-erp` — commit + push only to it, never switch/create/push other branch.

6. **Current Build & Deploy:**
   - Build: `cd v4 && npm install && ./node_modules/.bin/tsc --noEmit -p tsconfig.json && ./node_modules/.bin/vite build` → 435.95kB gzip 122.76kB success.
   - Vercel: Root Directory = v4, env GATEWAY_SECRET 48 chars same as Apps Script, APPS_SCRIPT_URL /exec, ANTHROPIC_API_KEY optional.
   - Apps Script: 37 .gs files at top level, appsscript.json, ScriptProperties GATEWAY_SECRET, WORKBOOK_ID, DRIVE_ROOT_ID, V3_WORKBOOK_ID, EXTERNAL_BANK_SHEETS_ID optional.

7. **What to do next:**
   - User says Bank Recon success — backup done (BACKUP-2026-09-27-FULL.md). Next phase: continue website creation — Reports Export Centre with all columns + totals + signatures print ready, then AI + Notifications + Vendor self-service + Agent mobile workflow, then E2E testing + cutover.
   - Always keep backup: git push + zip v4 + Drive Backups daily 02:00 IST via Backups.gs + this prompt file.

**Your first task when I paste this prompt:** Read `v4/BACKUP-2026-09-27-FULL.md` and `v4/LAUNCH-GUIDE.md` and `docs/v4/data/07-sheets-schema.md`, then summarize current progress and ask me what next phase I want to start (Reports Export, AI, Vendor portal, etc.), one step at a time in Tamil, waiting for my confirmation.

**Raw URLs for latest files:**
- https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/apps-script/mod/BankLive.gs
- https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/src/features/bank-reconciliation/BankLiveRecon.tsx
- https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/BACKUP-2026-09-27-FULL.md
- https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/PROMPT-FOR-NEXT-AI.md
