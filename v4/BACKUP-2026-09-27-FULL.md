# AR Enterprises ERP V4 — FULL BACKUP — 2026-09-27

> **Backup Date:** 2026-09-27 IST (Asia/Kolkata)
> **Branch:** `arena/01a0ba0b-ar-enterprises-erp` (from `main` commit a2c9614)
> **Repo:** polinchiacc-dotcom/ar-enterprises-erp
> **Status:** Bank Reconciliation Mini-Tally Live 200 entries SUCCESS (204→200 fix, huge total fix, date pairing fix, filter fix)
> **Build:** Vite 7.3.6 — 435.95 kB (gzip 122.76 kB) — success

---

## 1. Project Enna? (Purpose)

AR Enterprises (Tamil Nadu district-wise vendor collection + finance + GST + AI operations) ku oru full ERP website. V3 legacy read-only, V4 new build.

- **Owner:** Non-technical — copy-paste mattum pannuvanga, code elutha maataanga.
- **Goal:** Live URL-la login panni V3 business data paarkanum, daily operations (Vendors, Transactions, Bills, Payments, Bank Recon, GST, Projects, Reports, AI) nadathanum.
- **Language:** Tamil + English i18n

---

## 2. Tech Stack (Muthal-la irunthu ippa varaikum)

| Layer | Tech | File Location |
|-------|------|---------------|
| Frontend | React 19 + TypeScript + Vite | `v4/src/` |
| Routing | Hash router (no lib) | `v4/src/app/router.tsx` |
| UI | Custom tokens + components | `v4/src/styles/tokens.css`, `components.css`, `components/ui/index.tsx` |
| Backend | Google Apps Script (ONE project) | `v4/apps-script/` 37 .gs files |
| Data Store | Google Sheets (single source truth) + Drive (attachments/backups) | External Spreadsheet ID `1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw` |
| Gateway | Vercel serverless functions (sign requests to Apps Script) | `v4/api/` |
| Deploy | Vercel (Root Directory = `v4`) | `vercel.json` |
| Auth | bcrypt password hash, session token SHA-256, 8h expiry, 3 concurrent, 5 fail lock 15min | `lib/Auth.gs`, `lib/Crypto.gs` |
| Audit | Every CREATE/UPDATE/APPROVE/EXPORT logged | `lib/Audit.gs` |

**Non-negotiables (ella phase-kum):**
1. No API keys / secrets in frontend, Git, .env committed
2. No localStorage as authoritative store (cache only)
3. Server validation + audit mandatory
4. No direct delete — Archive → Restore → 30-day grace → Permanent Delete
5. AI advisory only — never approves payments / deletes data
6. V3 untouched

---

## 3. Folder Structure (Mukkiyamana files)

```
v4/
├── apps-script/
│   ├── Code.gs (Router entry)
│   ├── SetupOnce.gs (one-time setup, creates 28 tabs + first super_admin)
│   ├── appsscript.json (V8 runtime + scopes)
│   ├── config/Props.gs (ScriptProperties: GATEWAY_SECRET, WORKBOOK_ID, DRIVE_ROOT_ID, V3_WORKBOOK_ID, EXTERNAL_BANK_SHEETS_ID)
│   ├── lib/ Audit.gs, Auth.gs, Bootstrap.gs, Calc.gs, Crypto.gs, Drive.gs, Router.gs, SheetsIO.gs, Validate.gs
│   ├── mod/ Agents.gs, AiLog.gs, AuditMod.gs, Backups.gs, Bank.gs, BankLive.gs (LIVE 200), Bills.gs, Dashboard.gs, Exports.gs, Files.gs, Gst.gs, Health.gs, Imports.gs, Migration.gs, ModAuth.gs, Notifications.gs, Payments.gs, Projects.gs, Reports.gs, Settings.gs, Sys.gs, Transactions.gs, Users.gs, Vendors.gs, Worklog.gs
│   └── tests/RunAll.gs
├── api/ [route].js (gateway), _lib/gw.js (sign), ai/[feature].js, export/[jobToken].js
├── src/
│   ├── app/ App.tsx (session bootstrap + route switch), router.tsx
│   ├── components/ layout/Shell.tsx, ui/index.tsx, ai/FloatingAi.tsx
│   ├── features/ auth/Login.tsx, Profile.tsx, dashboard/Dashboard.tsx, vendors/Vendors.tsx, invoices/Transactions.tsx, Bills.tsx, payments/Payments.tsx, gst/GstCentre.tsx, bank-reconciliation/BankLiveRecon.tsx (MAIN 200), BankRecon.tsx, BankContractRecon.tsx, users-roles/UsersRoles.tsx, AgentWallet.tsx, projects/Projects.tsx, work-tracker/WorkTracker.tsx, reports/Reports.tsx, settings/SettingsCentre.tsx, ai-assistant/AiAssistant.tsx
│   ├── hooks/useApi.ts (useQuery with deps + debounce)
│   ├── lib/ api.ts (apiCall), format.ts (inr, dstr), session.ts
│   ├── services/ core.ts, admin.ts, ai.ts, collections.ts, finance.ts, gst.ts, ops.ts
│   ├── i18n/ en.ts, ta.ts, index.tsx
│   ├── styles/ tokens.css, components.css
│   ├── types/index.ts
│   └── main.tsx
├── docs/v4/ (blueprint: 00-review, modules 01-06, data 07-sheets-schema, api 08-contracts, security 09, migration 10)
├── LAUNCH-GUIDE.md (full copy-paste runbook Part1→Part4)
├── INSTRUCTIONS-TO-ANOTHER-AI.txt (prompt for new AI)
├── README.md, package.json, vite.config.ts, tsconfig.json, index.html
└── BACKUP-2026-09-27-FULL.md (this file)
```

---

## 4. Google Sheets — Data Source (LIVE)

### 4.1 External Live Bank Sheets (User's real data) — ONLY source for Phase 2
- **Spreadsheet ID:** `1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw`
- **GIDs:**
  - Bank Statement (Polinchi B/S 1712): `2024650928` — 1804 entries (BY credits + TO debits), header row has Description + Credit + Running Balance
  - Contract Work FY 24-25: `1782489685` — 65 entries (Tamil work names)
  - Contract Work FY 25-26: `790298656` — 68 entries (Work Name empty many, but Taxable Value filled)
  - Contract Work FY 23 to 24: `1882690159` — 67 entries
  - **Total Contract Main = 65+68+67 = 200** — Bank is confirmation only, not main
- **Columns A-W (keep empty as empty for future 2-way sync):** S.No, Party, Work Name, ., Receipt Amount, Work Place, Work Type, Eng Name, Taxable Value, Labour Welfare Fund, 18% GST, Invoice Value, Income Tax TDS 2%, GST TDS 2%, GST TDS Received Month, With Held Amount, EMD, Other Deductions, Receivable Amount, Receipt Date, Department, Receipt Amount (dup), S/M, FY, File Name
- **Date formats:** DD/MM/YYYY (02/04/2024), DD-MMM-YY (21-Apr-25, 24-Dec-25), MMM-YY (Dec-25, Nov-23, Sep-25, Aug-25), DD-MM-YYYY (16-04-2022) — parser must handle all
- **Auto-include rule:** If new sheet name contains "Contract" or "Contract Paper" / "Contract Work", auto-include → 200+ count

### 4.2 V4 Internal Workbook (created by SetupOnce.gs) — 28 tabs
`_meta`, `Vendors`, `Transactions`, `Bills`, `Payments`, `Projects`, `BankStatements`, `GSTR2B`, `ITCRegister`, `GSTFilings`, `Wallet`, `AgentWallet`, `Agents`, `Users`, `Sessions`, `Districts`, `Categories`, `CommissionSlabs`, `AgentOverrides`, `Notifications`, `WorkLog`, `Settings`, `AuditLog`, `ArchiveLog`, `AIUsageLog`, `ImportExports`, `Backups` — full schema in `docs/v4/data/07-sheets-schema.md`

---

## 5. Apps Script Modules — Enna pannuthu?

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `Code.gs` | Entry `doPost`, Router dispatch | `doPost(e)` |
| `Props.gs` | ScriptProperties wrapper | `getExternalId()`, `EXTERNAL_BANK_SHEETS_ID` |
| `lib/Router.gs` | Route to mod functions, validates gateway signature | `Router.route()` |
| `lib/Auth.gs` | Login, session, RBAC, password hash | `Auth.login`, `Auth.me`, `Auth.requireRole` |
| `lib/Crypto.gs` | bcrypt, SHA-256, token | |
| `lib/SheetsIO.gs` | Read/write sheets, version optimistic lock | |
| `lib/Validate.gs` | `V.run(p, rules)` | |
| `lib/Audit.gs` | Audit.log | |
| `mod/BankLive.gs` | **LIVE 200** — parseBankSheet + parseContractSheet + parseAllContractSheets + smartMatch + liveRecon + liveSheets + liveUpdate | See Section 6 detailed |
| `mod/Bank.gs` | Old bank recon (V4 internal) | |
| `mod/Dashboard.gs` | KPIs | |
| `mod/Vendors.gs`, `Transactions.gs`, `Bills.gs`, `Payments.gs`, `Projects.gs`, `Gst.gs`, `Reports.gs`, `Users.gs`, `Settings.gs`, `Backups.gs`, `Exports.gs`, etc | CRUD + audit | |
| `SetupOnce.gs` | One-time: creates 28 tabs, seed Districts/Categories/CommissionSlabs/Settings, migrates V3, creates super_admin `ChangeMe@2026`, deletes itself | `setupOnce()` |

---

## 6. Phase 2 Mini-Tally Live Bank Reconciliation — FULL LOGIC (2026-09-26 to 2026-09-27)

### 6.1 Requirement (User Tamil-la sonnathu)
- 200 entries MAIN — 3 Contract sheets mattum (67+68+65). Bank 1804 entries confirmation mattum, main illa.
- Bank Statement monthly update aagum — Refresh Live panna website-la effect varanum.
- New sheet name-la "Contract" iruntha auto-include — 200+ aagum.
- All columns A-W website-la varanum, empty-na empty-a kaamikanum (future Google Sheet update → website update 2-way sync).
- Matching = Contract Receipt Date + Bank Date same + same amount — rendu date columns same color pairing (blue #e0f2fe) confirmation-ku.
- Filter: BRS Status, FY, Work Place, Date From/To, Search — below table live update aaganum (backend + frontend).
- Totals: Bottom row-la auto total for ALL amount columns (Receipt Amount, Taxable Value, 18% GST, Invoice Value, IT TDS 2%, GST TDS 2%, With Held, EMD, Other Deduction, Receivable etc) filtered or not. Top mini-dashboard-la all data separately.
- Bank huge total ₹4,12,24,78,61,42,09,98,660 bug — thevai illa, confirmation mattum.

### 6.2 Bugs Fixed Step-by-Step
| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-09-26 | Only 125 of 200 shown (61/68/61) | parseContractSheet skipped rows where Work Name empty (FY25-26 many empty) and receiptAmount==0 | Include if S.No exists, keep empty as "" |
| 2026-09-26 | Bank Date 999d diff | dateIdx not found, dateStr empty → bTime 0 → 999 diff | Fallback dateIdx=1 + robust parseDateAny |
| 2026-09-26 | 100% match never, shows partial 70% | amountDiff 0 gave 50 conf + date 0 → 50 | amount exact → 80 conf directly |
| 2026-09-26 | 132 filtered not 200, counts 61/68/61 | receiptAmount fallback chain wrong, total row included | Skip total rows, S.No mandatory |
| 2026-09-27 | 204 details not 200 | Total rows (with "Total" text) included because S.No empty but amount huge | Skip if row contains "Total" and S.No empty or not numeric |
| 2026-09-27 | Bank huge total ₹4,12,24,78,61,42,09,98,660 | bank parsing fallback `for any num>100 credit=num` picked balance column as credit | Remove fallback, only keep if credit>0 or debit>0, sum only BY credits |
| 2026-09-27 | Bank Date 22-04-2025 for 13-02-2023 (799d) | smartMatch too permissive, picked closest amount even if date far | Strict matching: same date same amount = exact 100, same amount date ≤3d = exact 90, date >30d forced unmatched |
| 2026-09-27 | Date parsing fails Dec-25, Nov-23, Mar-23 | Only DD/MM/YYYY and DD-MMM-YY handled | Add MMM-YY parser: Sep-25 → 2025-09-01, Dec-25 → 2025-12-01, Jna-26 typo → Jan |
| 2026-09-27 | BRS Status filter not updating below | Frontend liveParams ok, but backend didn't handle workPlace, FY exact match fail | Backend add workPlace filter + FY substring match + 250ms debounce |

### 6.3 BankLive.gs Final Logic (71c8a80)

**parseDateAny(raw):**
- ISO YYYY-MM-DD → keep
- DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY → YYYY-MM-DD (assume DD/MM)
- DD-MMM-YY (21-Apr-25) → YYYY-MM-DD via months map (jan→01 etc, jna→01 typo)
- MMM-YY (Dec-25, Sep-25) → YYYY-MM-01 (first day)
- Fallback new Date(s)

**parseBankSheet():**
- Header row find Description + Credit/Running Balance (first 10 rows)
- dateIdx fallback 1, descIdx 2, creditIdx 6, balIdx 7, debitIdx 8
- Amount: try creditIdx, then debitIdx, then col 4-8 excluding balIdx, only if <100M
- isCredit = desc starts with BY, isDebit = starts with TO, else if contains charges/fee/maintenance → debit else credit
- credit = amount if isCredit else 0, debit = amount if isDebit else 0
- Keep all rows but mark isCredit, for matching use only credit>0 (BY) — fixes huge total
- Return rows: {id, date (YYYY-MM-DD), description (300 chars), credit, debit, balance, type (rtgs/neft/cash/charges/loan/transfer/other), isCredit}

**parseContractSheet(gid, fyLabel):**
- Header row find Work Name + Receipt (first 5 rows), fallback row 0
- findIdx for all columns: workName, workPlace, receiptAmount, receiptDate, fy, fileName, party, workType, engName, taxableValue, labourWelfare, gst, invoiceValue, tds, gstTds, withHeld, emd, otherDeduction, receivableAmount, department
- Skip if entire row empty
- Skip if row contains "total" (case-insensitive) and S.No empty or not numeric or contains total
- Skip if S.No empty (mandatory) — fixes 204→200, keeps empty columns as empty but S.No must exist
- Skip if S.No header "S.No"
- Skip if workName contains "work name" header
- workName keep empty as "" (don't fallback to placeholder) — UI shows "(empty — keep as empty)"
- numAt(idx) helper: Number(String(v[idx]).replace(/[^0-9.\-]/g,"")) ||0
- receiptAmt = numAt(receiptAmtIdx), taxable, labour, gst, invoice, tds, gstTds, withHeld, emd, otherDed, receivable
- If receiptAmt 0, try receivableIdx, invoiceIdx, taxableIdx, 21,22 (dup receipt columns)
- hasAmount = receiptAmt>0 || taxable>0 || invoice>0 || receivable>0 || gst>0
- If !hasAmount && !workName && !fileName → skip (blank row)
- dateStr = parseDateAny(v[receiptDateIdx]), if empty try col 18-22
- fy = fyIdx ? v[fyIdx] : fyLabel
- Push ContractRow: sNo, workName (500), workPlace (200), party, receiptAmount, workType, engName, taxableValue, labourWelfare, gst, invoiceValue, tds, gstTds, withHeld, emd, otherDeduction, receivableAmount, receiptDate, department, fy, fileName, sheetGid, rowIndex

**parseAllContractSheets():**
- allSheets = ss.getSheets()
- knownGids = [1782489685, 790298656, 1882690159]
- contractSheets = filter where knownGids includes gid OR name.toLowerCase() contains "contract"
- For each, fyLabel = name.match(/20\d{2}[\-–]?\d{2}/) ? match : name
- parsed = parseContractSheet(gid, fyLabel), counts[name]=parsed.length, rows concat
- Return {rows, counts, sheets: {name,gid}}

**smartMatch(bank, contract):**
- bAmt = bank.credit, cAmt = receiptAmount || receivable || invoice ||0, if 0 → unmatched
- denom = max(bAmt,cAmt,1), amountDiff = abs(bAmt-cAmt)/denom*100
- bTime = bank.date ? new Date(bank.date).getTime() :0, cTime similarly, dateDiff = abs diff /86400000 or 999 if missing
- If amountDiff==0 && dateDiff==0 → 100 exact
- If amountDiff==0 && dateDiff<=1 →95 exact
- If amountDiff==0 && dateDiff<=3 →90 exact
- If amountDiff==0 && dateDiff<=7 →80 exact
- If amountDiff==0 && dateDiff<=15 →60 partial
- If amountDiff<=0.5 && dateDiff==0 →85 exact
- If amountDiff<=0.5 && dateDiff<=3 →75 partial
- If amountDiff<=1 && dateDiff<=3 →65 partial
- If amountDiff<=2 && dateDiff<=7 →50 near
- If amountDiff<=5 && dateDiff<=3 →40 near else 0 unmatched
- If dateDiff>30 and amountDiff!=0 → force unmatched, if amountDiff==0 keep near 30 conf
- Keyword boost only if dateDiff<=7: workName words >3 chars match description → +2 per match max 10
- Return {type, confidence, dateDiff: rounded (0 if 999), amountDiff rounded, _rawDateDiff}

**liveRecon(p):**
- bankRowsAll = parseBankSheet(), bankRows = filter credit>0 (BY only)
- contractData = parseAllContractSheets(), contractRows = rows
- Filters: filterStatus (exact/partial/near/unmatched/all), filterFY (substring match both ways, also short 20 removed), search (workName+workPlace+fileName+bankDesc+S.No), dateFrom/dateTo (ISO string compare), workPlaceFilter (substring)
- For each contract, find bestMatch:
  - Loop bankRows, quick filter amountDiff>5% skip, smartMatch, keep best confidence
  - If no match, try exact amount equality loop
  - If bestScore rawDateDiff>30 && amountDiff!=0 → force unmatched
  - Push combined: {contract, bank: bestMatch, matchType, confidence, dateDiff, amountDiff}
- filtered = combined.filter(filters)
- Sort filtered by receiptDate descending (latest first) like Tally Day Book
- Stats: totalBank = sum bankRows credit (BY only, not huge), totalContract = sum receiptAmount, matched/partial/near/unmatched counts, total=combined.length, bankCount=bankRowsAll.length, bankCreditCount=bankRows.length, contractCount=contractRows.length, countsBySheet
- Return {bankRows: bankRowsAll, contractRows, combined: filtered, allCombined: combined, stats, externalId, gids, sheets, lastSync ISO}

**liveSheets(p):** list all sheets + contractSheets + counts

**liveUpdate(p):** only super_admin/auditor, validates gid, rowIndex, workName, workPlace, finds sheet by gid, finds header row with work name, updates workNameCol and workPlaceCol via setValue, audit log

### 6.4 Frontend BankLiveRecon.tsx Final (71c8a80)

- Interfaces: BankRow (isCredit), ContractRow (all columns), CombinedRow, LiveData (stats includes bankCreditCount)
- State: filterStatus, filterFY, search, dateFrom, dateTo, workPlaceFilter, editingContract, showPrint, liveParams (filterStatus, filterFY, search, dateFrom, dateTo, workPlace)
- useQuery: `bank.liveRecon` with liveParams deps [filterStatus, filterFY, search, dateFrom, dateTo, workPlace], debounce 250ms via useEffect setTimeout
- workPlaceOptions = unique workPlace from contractRows sorted 150 max
- fyOptions = unique fy from contractRows sorted
- totals = sum filtered for all amount columns (receiptAmount, taxableValue, labourWelfare, gst, invoiceValue, tds, gstTds, withHeld, emd, otherDeduction, receivableAmount) + count
- allTotals = sum unfiltered contractRows same keys
- Top mini-dashboard 8 stats: Total Contract Count (green if 200 else red + diff), Receipt Amount Total (all + filtered), Taxable, GST, Invoice, TDS+GST TDS, With Held+EMD+Other, Reconciled (matched/total % + bank counts)
- Filters Card: BRS Status Select (All 200, Reconciled same date+amount, Partial amount≤1% date≤3d, Near date≤7d amount≤2%, Pending), FY Select (All + fyOptions + hardcoded 2024-25/2025-26/2022-24), Work Place Select (All + options), From Date, To Date, Search (Tamil/English, file, bank desc, S.No), Clear button
- Table: minWidth 2000, fontSize 11, columns: S.No, Receipt Date (paired blue #e0f2fe when bank exists, borderLeft 3px solid #0ea5e9, fontWeight 700 color #0284c7), Work Name (200 main, maxWidth 260, empty → "(empty — keep as empty for future update)" + engName+dept), Work Place (empty → "(empty)" + edit ✏️), Work Type, Party, Taxable, Labour WF, 18% GST, Invoice, IT TDS 2%, GST TDS 2%, With Held, EMD, Other Ded, Receivable, Receipt Amount (bold), FY Badge, File Name, Bank Confirmation (minWidth 240 background #e0f2fe when bank, borderLeft 3px solid #0ea5e9, Bank Date: dstr(date) (same date ✓) or (Xd diff), description 80 chars, Credit, type, Bal), BRS Status Badge (ok/warn/info/err) + confidence + amountDiff + dateDiff, Actions 👁️
- Bottom totals row: background #f1f5f9 fontWeight 700 borderTop 2px solid #000, colSpan 6 "TOTAL (count filtered) — All amount columns auto total:" + sums + receiptAmount background #dbeafe
- Edit modal: workName textarea + workPlace input, saves via `bank.liveUpdate` apiCall, toast, reload
- Print: showPrint state, window.print(), table with all columns + totals, header SRI POLINCHI AND CO BRS 200, Account 510909010201712, Spreadsheet ID, Last Sync, Total filtered of contractCount, footer signatures
- Style: row-ok rgba(16,185,129,0.04), row-warn rgba(239,68,68,0.04), print hide sidebar/topbar

---

## 7. Step-by-Step Progress (Muthal-la irunthu ippa varaikum)

### P0 — Design & Blueprint Approval
- docs/v4/00-review-and-findings.md, modules 01-06, data 07-sheets-schema, api 08-contracts, security 09, migration 10 created — DRAFT

### P1 — App Shell
- tokens.css, components.css, Shell.tsx, router.tsx, i18n Ta/En, App.tsx with route switch, Login.tsx, Profile.tsx

### P2 — Auth & Security
- Crypto.gs bcrypt, Auth.gs login/me/logout, Validate.gs, Router.gs gateway signature, api/_lib/gw.js sign, session.ts getToken/setSession, useApi.ts, apiCall
- Roles: super_admin, district_admin, agent, vendor, auditor — ROUTE_ROLES in App.tsx
- Audit.gs append-only

### P3 — Core Modules
- Vendors, Transactions, Bills, Payments, Wallet, Agents — CRUD mod + frontend features

### P4 — Finance
- GstCentre, BankRecon (old), Projects, WorkTracker, Reports, Exports
- **Phase 2 Mini-Tally Live Bank Recon:** External Google Sheets live integration — 200 contract + 1804 bank
- Iterations: 125→132→190→200→204→200 fix, date parsing, matching, huge total, filter fix — final 71c8a80

### P5 — AI + Notifications
- FloatingAi.tsx, AiAssistant.tsx, ai/[feature].js proxy, AIUsageLog, Notifications

### P6 — V3 Migration & Cutover
- Migration.gs reads V3_WORKBOOK_ID, SetupOnce.gs creates V4 workbook 28 tabs, seed Districts (38 TN), Categories (11), CommissionSlabs, Settings, migrates counts, creates super_admin ChangeMe@2026
- LAUNCH-GUIDE.md Part1→Part4 copy-paste runbook

### Current State 2026-09-27
- Branch arena/01a0ba0b-ar-enterprises-erp pushed force, build success 435.95kB gzip 122.76kB
- BankLive.gs + BankLiveRecon.tsx live, 200 count correct, paired dates blue, totals bottom+top, filters live, huge total fixed
- Next: backup (this file) + next phase continuation

---

## 8. Build & Deploy (Ippa varaikum)

- `cd v4 && npm install` → `npm run build` → `tsc --noEmit` + `vite build` → `dist/` → Vercel auto deploy (Root Directory = v4)
- Env vars Vercel: GATEWAY_SECRET (48 chars, same as Apps Script), APPS_SCRIPT_URL (https://script.google.com/.../exec), ANTHROPIC_API_KEY optional
- Apps Script: 37 .gs files at top level (ignore subfolders), appsscript.json import, ScriptProperties: GATEWAY_SECRET, WORKBOOK_ID, DRIVE_ROOT_ID, V3_WORKBOOK_ID, EXTERNAL_BANK_SHEETS_ID (optional custom for external bank sheets)
- Deploy Web App: Execute as Me, Who has access Anyone, New version each time

---

## 9. Security Architecture (09-security-architecture.md summary)

- No secrets in frontend/Git
- Password hash bcrypt cost ≥12, never leaves Apps Script
- Session token SHA-256 hash stored, token itself never stored, 8h expiry, sliding mobile +15min cap 24h, max 3 active per user, oldest revoked
- Failed 5 → 15min lock
- Protected ranges: all data tabs locked editors=script only, _meta/Settings via audited routes only
- AuditLog 2 years rolling → Drive archive
- ArchiveLog grace 30d
- Export single-use 15min link
- AI advisory only, usage audited

---

## 10. How to Backup (User ketta backup method)

1. **Git backup:** `git push origin arena/01a0ba0b-ar-enterprises-erp` — already done 71c8a80
2. **Zip backup:** `v4/` folder + `docs/v4/` zip as `v4-polinchi-2026-09-27.zip` — keep in Drive `AR-ERP-V4/Backups/`
3. **Google Sheets backup:** V4 workbook daily 02:00 IST auto backup via Backups.gs to Drive `/AR-ERP/Backups/YYYY/MM/`
4. **This file:** `BACKUP-2026-09-27-FULL.md` contains full logic, so any AI can recreate — keep in repo + Drive
5. **Prompt backup:** `PROMPT-FOR-NEXT-AI.md` (next file) — copy-paste to new AI to continue

---

## 11. Master Prompt for Next AI (Semmari / Prompt-a maathi backup)

> Full prompt in `PROMPT-FOR-NEXT-AI.md` — includes project purpose, tech stack, spreadsheet IDs, GIDs, 200 logic, matching rules, filter rules, totals, paired dates, huge total fix, build, deploy, non-negotiables, working mode (one step per reply, Tamil, zero ambiguity)

---

## 12. Next Steps (Adutha kattam)

- User said Bank Recon success — now backup done
- Next: Continue Phase 2 remaining or Phase 3 core modules polish, Reports Export Centre with all columns + totals + signatures print ready like `All_Sheets_Combined_With_Matching_Print_Ready_Report.html`
- Then AI + Notifications + Vendor self-service + Agent mobile workflow
- Then full E2E testing + cutover

---

## 13. Raw URLs for Curl (Polinchi method)

```
https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/apps-script/mod/BankLive.gs
https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/src/features/bank-reconciliation/BankLiveRecon.tsx
https://raw.githubusercontent.com/polinchiacc-dotcom/ar-enterprises-erp/arena/01a0ba0b-ar-enterprises-erp/v4/BACKUP-2026-09-27-FULL.md
```

---

## 14. Contact & Accounts

- Google Account: owns Sheets + Drive + Apps Script
- Vercel: hosts frontend
- GitHub: polinchiacc-dotcom/ar-enterprises-erp
- Spreadsheet: 1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw shared with Apps Script service account email (Session.getActiveUser().getEmail())

---

**End of Full Backup — 2026-09-27 — 200 entries live success**
