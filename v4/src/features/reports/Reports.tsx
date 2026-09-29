/**
 * Reports Export Centre (அறிக்கைகள் ஏற்றுமதி மையம்) — R1 to R14
 * Full Print-Ready with Signatures & Totals + Excel / CSV Export
 * All Print A4 Size Fitting — Portrait & Landscape
 */
import { useMemo, useState } from "react";
import type { Role, ReportResult, User } from "../../types";
import { useI18n } from "../../i18n";
import { useQuery } from "../../hooks/useApi";
import { Badge, Button, Card, Empty, PageHead, Spinner, Table, useToast } from "../../components/ui";
import { dstr, inr } from "../../lib/format";

interface ReportDef {
  id: string;
  en: string;
  ta: string;
  roles: Role[];
  defaultOrientation: "portrait" | "landscape";
  params?: ("district" | "vendorId" | "agentId" | "month")[];
}

const REPORT_DEFS: ReportDef[] = [
  { id: "R1", en: "District performance", ta: "மாவட்ட செயல்திறன்", roles: ["super_admin", "district_admin"], defaultOrientation: "landscape", params: ["district", "month"] },
  { id: "R2", en: "Vendor ledger", ta: "வெண்டர் லெட்ஜர்", roles: ["super_admin", "district_admin", "auditor"], defaultOrientation: "landscape", params: ["vendorId", "month"] },
  { id: "R3", en: "Transaction aging", ta: "பரிவர்த்தனை வயது / நிலுவை", roles: ["super_admin", "district_admin", "auditor"], defaultOrientation: "landscape", params: ["district", "month"] },
  { id: "R4", en: "Collections summary", ta: "வசூல் சுருக்கம்", roles: ["super_admin", "district_admin", "auditor"], defaultOrientation: "landscape", params: ["district", "month"] },
  { id: "R5", en: "Wallet statement", ta: "வாலெட் கணக்கு", roles: ["super_admin"], defaultOrientation: "portrait", params: ["month"] },
  { id: "R6", en: "Agent commission statement", ta: "அஜெண்ட் கமிஷன்", roles: ["super_admin", "district_admin", "agent", "auditor"], defaultOrientation: "landscape", params: ["agentId", "month"] },
  { id: "R7", en: "GST summary", ta: "ஜிஎஸ்டி சுருக்கம்", roles: ["super_admin", "auditor"], defaultOrientation: "portrait", params: ["month"] },
  { id: "R8", en: "TDS summary", ta: "டிடிஎஸ் சுருக்கம்", roles: ["super_admin", "auditor"], defaultOrientation: "portrait", params: ["month"] },
  { id: "R9", en: "GSTR-2B reconciliation", ta: "ஜிஎஸ்டி-2B சரிபார்ப்பு", roles: ["super_admin", "auditor"], defaultOrientation: "landscape", params: ["month"] },
  { id: "R10", en: "Bank reconciliation (V4 internal)", ta: "வங்கி சரிபார்ப்பு (V4)", roles: ["super_admin", "auditor"], defaultOrientation: "landscape", params: ["month"] },
  { id: "R11", en: "Audit extract", ta: "ஆடிட் பதிவேடு", roles: ["super_admin", "auditor"], defaultOrientation: "landscape", params: ["month"] },
  { id: "R12", en: "Users & roles", ta: "பயனர்கள் & பங்குகள்", roles: ["super_admin"], defaultOrientation: "portrait", params: [] },
  { id: "R13", en: "AI usage", ta: "AI பயன்பாடு", roles: ["super_admin"], defaultOrientation: "portrait", params: ["month"] },
  { id: "R14", en: "Bank Live BRS 200 — All Columns Print Ready", ta: "வங்கி லைவ் BRS 200 — அனைத்து காலமும் அச்சு தயார்", roles: ["super_admin", "district_admin", "agent", "auditor"], defaultOrientation: "landscape", params: [] },
];

const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode",
  "Kallakurichi", "Kanchipuram", "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet",
  "Salem", "Sivagangai", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
];

// Bank Live types for R14
interface BankRow { id: string; date: string; description: string; credit: number; debit: number; balance: number; type: string; }
interface ContractRow {
  id: string; sNo: string; workName: string; workPlace: string; party: string; receiptAmount: number;
  workType: string; engName: string; taxableValue: number; labourWelfare: number; gst: number;
  invoiceValue: number; tds: number; gstTds: number; withHeld: number; emd: number; otherDeduction: number;
  receivableAmount: number; receiptDate: string; department: string; fy: string; fileName: string; sheetGid: number; rowIndex: number;
}
interface CombinedRow { bank?: BankRow; contract: ContractRow; matchType: "exact" | "partial" | "near" | "unmatched"; confidence: number; dateDiff: number; amountDiff: number; }
interface LiveData {
  bankRows: BankRow[]; contractRows: ContractRow[]; combined: CombinedRow[]; allCombined: CombinedRow[];
  stats: { totalBank: number; totalContract: number; matched: number; partial: number; near: number; unmatched: number; total: number; bankCount: number; bankCreditCount?: number; contractCount: number; countsBySheet: Record<string, number>; };
  externalId: string; sheets: { name: string; gid: number }[]; lastSync: string;
}

export function Reports({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const defaultMonth = new Date().toISOString().slice(0, 7) || "2026-09";
  const [selected, setSelected] = useState<string>("R14");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [district, setDistrict] = useState<string>("all");
  const [vendorId, setVendorId] = useState<string>("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [isPrintActive, setIsPrintActive] = useState<boolean>(false);

  const defs = REPORT_DEFS.filter((r) => r.roles.includes(user.role));
  const def = defs.find((r) => r.id === selected) || defs[0] || null;

  // Auto-switch default orientation when report changes
  const handleSelectReport = (id: string) => {
    setSelected(id);
    const target = REPORT_DEFS.find((r) => r.id === id);
    if (target) {
      setOrientation(target.defaultOrientation);
    }
  };

  // Query for R1–R13
  const run = useQuery<{ reportId: string; name: string; rows: any[]; total?: number; columns?: string[]; rowCount?: number; truncated?: boolean }>(
    "reports.run",
    {
      reportId: selected || "R1",
      params: {
        month: month || defaultMonth,
        period: month || defaultMonth,
        ...(district !== "all" ? { district } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(user.role === "district_admin" ? { district: user.district } : {}),
        ...(user.role === "agent" ? { self: true } : {})
      }
    },
    [selected, month, district, vendorId],
    !!def && selected !== "R14" && (selected !== "R2" || !!vendorId)
  );

  // Bank Live 200 data for R14
  const bankLiveQuery = useQuery<LiveData>(
    "bank.liveRecon",
    { filterStatus: "all", filterFY: "all", search: "", dateFrom: "", dateTo: "", workPlace: district !== "all" ? district : "all" },
    [selected, district],
    selected === "R14"
  );

  const bankData = bankLiveQuery.data as LiveData | null;
  const filteredR14 = useMemo(() => bankData?.combined || [], [bankData]);
  const statsR14 = bankData?.stats;

  // Calculated totals for R14
  const totalsR14 = useMemo(() => {
    if (!filteredR14.length) return null;
    const sum = (key: keyof ContractRow) => filteredR14.reduce((s, r) => s + (Number((r.contract as any)[key]) || 0), 0);
    return {
      receiptAmount: sum("receiptAmount"),
      taxableValue: sum("taxableValue"),
      labourWelfare: sum("labourWelfare"),
      gst: sum("gst"),
      invoiceValue: sum("invoiceValue"),
      tds: sum("tds"),
      gstTds: sum("gstTds"),
      withHeld: sum("withHeld"),
      emd: sum("emd"),
      otherDeduction: sum("otherDeduction"),
      receivableAmount: sum("receivableAmount"),
      count: filteredR14.length,
    };
  }, [filteredR14]);

  // Normalize rows & columns for R1–R13
  const r1to13Data = useMemo(() => {
    if (!run.data || !run.data.rows) return { columns: [], rows: [], totals: {} as Record<string, number> };
    const rawRows = run.data.rows;
    if (!rawRows.length) return { columns: [], rows: [], totals: {} as Record<string, number> };

    let cols: string[] = [];
    let formattedRows: Record<string, any>[] = [];

    if (Array.isArray(rawRows[0])) {
      cols = run.data.columns || rawRows[0].map((_: any, i: number) => `Col ${i + 1}`);
      formattedRows = rawRows.map((r: any[]) => {
        const obj: Record<string, any> = {};
        cols.forEach((c, idx) => { obj[c] = r[idx]; });
        return obj;
      });
    } else {
      cols = Object.keys(rawRows[0]);
      formattedRows = rawRows;
    }

    // Compute totals for numeric columns
    const totals: Record<string, number> = {};
    cols.forEach((col) => {
      const isNumeric = formattedRows.some((r) => typeof r[col] === "number" && !isNaN(r[col]));
      if (isNumeric) {
        totals[col] = formattedRows.reduce((acc, r) => acc + (typeof r[col] === "number" ? r[col] : 0), 0);
      }
    });

    return { columns: cols, rows: formattedRows, totals };
  }, [run.data]);

  // Universal CSV Export
  function handleExportCsv() {
    if (selected === "R14") {
      if (!filteredR14.length) { toast(false, "No data to export"); return; }
      const headers = [
        "S.No", "Receipt Date", "Work Name", "Work Place", "Work Type", "Party", "Taxable Value",
        "Labour Welfare", "18% GST", "Invoice Value", "IT TDS 2%", "GST TDS 2%", "With Held", "EMD",
        "Other Deduction", "Receivable", "Receipt Amount", "FY", "File Name", "Bank Date",
        "Bank Description", "Bank Credit", "BRS Status", "Confidence", "Date Diff", "Amount Diff"
      ];
      const rows = filteredR14.map((r) => [
        r.contract.sNo,
        r.contract.receiptDate,
        `"${(r.contract.workName || "").replace(/"/g, '""')}"`,
        `"${(r.contract.workPlace || "").replace(/"/g, '""')}"`,
        r.contract.workType,
        r.contract.party,
        r.contract.taxableValue,
        r.contract.labourWelfare,
        r.contract.gst,
        r.contract.invoiceValue,
        r.contract.tds,
        (r.contract as any).gstTds,
        (r.contract as any).withHeld,
        (r.contract as any).emd,
        (r.contract as any).otherDeduction,
        (r.contract as any).receivableAmount,
        r.contract.receiptAmount,
        r.contract.fy,
        r.contract.fileName,
        r.bank?.date || "",
        `"${(r.bank?.description || "").replace(/"/g, '""')}"`,
        r.bank?.credit || "",
        r.matchType,
        r.confidence,
        r.dateDiff,
        r.amountDiff
      ]);
      const totalRow = totalsR14 ? [
        "TOTAL", "", "", "", "", "", totalsR14.taxableValue, totalsR14.labourWelfare, totalsR14.gst,
        totalsR14.invoiceValue, totalsR14.tds, totalsR14.gstTds, totalsR14.withHeld, totalsR14.emd,
        totalsR14.otherDeduction, totalsR14.receivableAmount, totalsR14.receiptAmount, "", "", "", "", "", "", "", "", ""
      ] : [];
      const csv = [headers.join(","), ...rows.map((r) => r.join(",")), totalRow.join(",")].join("\n");
      downloadCsv(csv, `R14_Bank_Live_BRS_200_${new Date().toISOString().slice(0, 10)}.csv`);
      toast(true, "Excel CSV exported — 200 all columns + totals");
    } else {
      if (!r1to13Data.rows.length) { toast(false, "No data to export"); return; }
      const headers = r1to13Data.columns;
      const rows = r1to13Data.rows.map((r) =>
        headers.map((h) => {
          const val = r[h];
          if (val === null || val === undefined) return "";
          if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
          return val;
        })
      );
      const totalRow = headers.map((h, i) => {
        if (i === 0) return `"TOTAL (${r1to13Data.rows.length} rows)"`;
        return r1to13Data.totals[h] !== undefined ? r1to13Data.totals[h] : "";
      });
      const csv = [headers.join(","), ...rows.map((r) => r.join(",")), totalRow.join(",")].join("\n");
      downloadCsv(csv, `${def?.id || "Report"}_${new Date().toISOString().slice(0, 10)}.csv`);
      toast(true, `${def?.id} Excel CSV exported with totals`);
    }
  }

  function downloadCsv(content: string, filename: string) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // Trigger A4 Print
  function handleTriggerPrint() {
    setIsPrintActive(true);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  return (
    <div className="reports-centre">
      <div className="no-print">
        <PageHead
          title="அறிக்கைகள் ஏற்றுமதி மையம் (Reports Export Centre)"
          sub="R1 முதல் R14 வரையிலான அனைத்து அறிக்கைகளுக்கும் முழுமையான அச்சுப் பிரதி (A4 Portrait & Landscape) + எக்செல் ஏற்றுமதி"
        />

        <div className="settings-grid" style={{ gridTemplateColumns: "300px 1fr", gap: 16 }}>
          {/* Navigation Sidebar */}
          <div className="settings-nav">
            <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              அறிக்கைகள் பட்டியல் (R1 – R14)
            </div>
            {defs.map((r) => (
              <button
                key={r.id}
                className={selected === r.id ? "on" : ""}
                onClick={() => handleSelectReport(r.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}
              >
                <div>
                  <span className="mono" style={{ marginRight: 8, fontWeight: 700, color: "var(--primary)" }}>{r.id}</span>
                  <span>{lang === "ta" ? r.ta : r.en}</span>
                </div>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{r.defaultOrientation === "landscape" ? "📃" : "📄"}</span>
              </button>
            ))}
          </div>

          {/* Main Workspace */}
          <div>
            {/* Top Toolbar */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                {/* Filters */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  {def?.params?.includes("month") && (
                    <div>
                      <span className="text-3" style={{ marginRight: 4 }}>மாதம்:</span>
                      <input type="month" className="ui-input" style={{ width: 145 }} value={month} onChange={(e) => setMonth(e.target.value)} />
                    </div>
                  )}

                  {def?.params?.includes("district") && (
                    <div>
                      <span className="text-3" style={{ marginRight: 4 }}>மாவட்டம்:</span>
                      <select className="ui-input" style={{ width: 150 }} value={district} onChange={(e) => setDistrict(e.target.value)}>
                        <option value="all">அனைத்து மாவட்டங்களும் (All)</option>
                        {TN_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}

                  {def?.params?.includes("vendorId") && (
                    <div>
                      <span className="text-3" style={{ marginRight: 4 }}>வெண்டர் ID:</span>
                      <input className="ui-input" style={{ width: 130 }} placeholder="Vendor ID…" value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
                    </div>
                  )}

                  <Button kind="ghost" onClick={() => { if (selected === "R14") bankLiveQuery.reload(); else run.reload(); }}>
                    🔄 புதுப்பி (Refresh)
                  </Button>
                </div>

                {/* Print & Export Actions */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  {/* Orientation Switcher */}
                  <div style={{ display: "inline-flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
                    <button
                      className={`ui-btn ${orientation === "portrait" ? "ui-btn-primary" : "ui-btn-ghost"}`}
                      style={{ padding: "4px 10px", fontSize: 12, height: 32 }}
                      onClick={() => setOrientation("portrait")}
                      title="A4 செங்குத்து அச்சு (Portrait)"
                    >
                      📄 Portrait
                    </button>
                    <button
                      className={`ui-btn ${orientation === "landscape" ? "ui-btn-primary" : "ui-btn-ghost"}`}
                      style={{ padding: "4px 10px", fontSize: 12, height: 32 }}
                      onClick={() => setOrientation("landscape")}
                      title="A4 கிடைமட்ட அச்சு (Landscape)"
                    >
                      📃 Landscape
                    </button>
                  </div>

                  {/* Print Button */}
                  <Button kind="primary" onClick={handleTriggerPrint} style={{ fontWeight: 600 }}>
                    🖨️ A4 அச்சு (Print)
                  </Button>

                  {/* Excel Export Button */}
                  <Button kind="soft" onClick={handleExportCsv} style={{ fontWeight: 600 }}>
                    📊 Excel / CSV ஏற்றுமதி
                  </Button>
                </div>
              </div>
            </Card>

            {/* R14 Bank Live View */}
            {selected === "R14" && (
              <div>
                {/* Stats Dashboard */}
                <div className="ui-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 12 }}>
                  <div className="ui-stat">
                    <div className="ui-stat-label">மொத்த பதிவுகள் (Total)</div>
                    <div className="ui-stat-value" style={{ color: statsR14?.contractCount === 203 || statsR14?.contractCount === 200 ? "green" : "inherit" }}>
                      {statsR14?.contractCount} பதிவுகள் ✓
                    </div>
                    <div className="ui-stat-sub">3 தாள்கள் (67+65+68)</div>
                  </div>
                  <div className="ui-stat">
                    <div className="ui-stat-label">வசூல் தொகை (Receipt Total)</div>
                    <div className="ui-stat-value">{inr(totalsR14?.receiptAmount || 0)}</div>
                    <div className="ui-stat-sub">வங்கி வரவு: {inr(statsR14?.totalBank || 0)}</div>
                  </div>
                  <div className="ui-stat">
                    <div className="ui-stat-label">வரிக்குரிய மதிப்பு (Taxable)</div>
                    <div className="ui-stat-value">{inr(totalsR14?.taxableValue || 0)}</div>
                    <div className="ui-stat-sub">18% GST: {inr(totalsR14?.gst || 0)}</div>
                  </div>
                  <div className="ui-stat">
                    <div className="ui-stat-label">விலைப்பட்டியல் (Invoice)</div>
                    <div className="ui-stat-value">{inr(totalsR14?.invoiceValue || 0)}</div>
                    <div className="ui-stat-sub">IT TDS 2%: {inr(totalsR14?.tds || 0)}</div>
                  </div>
                  <div className="ui-stat">
                    <div className="ui-stat-label">சரிபார்க்கப்பட்டவை (Matched)</div>
                    <div className="ui-stat-value">{statsR14?.matched} / {statsR14?.total}</div>
                    <div className="ui-stat-sub">
                      {statsR14 ? Math.round((statsR14.matched / Math.max(1, statsR14.total)) * 100) : 0}% Reconciled
                    </div>
                  </div>
                </div>

                {/* On-Screen Table Preview */}
                <Card
                  title="R14 — வங்கி நேரடி BRS 200 (Bank Live BRS 200 — All Columns Print Ready)"
                  sub={`அமைவு: ${orientation === "landscape" ? "A4 கிடைமட்டம் (Landscape)" : "A4 செங்குத்து (Portrait)"} | மொத்த வரிசைகள்: ${filteredR14.length} | Spreadsheet: ${bankData?.externalId || ""}`}
                >
                  {bankLiveQuery.loading && !bankData ? (
                    <Spinner label="வங்கி நேரடி BRS 200 தரவுகள் ஏற்றப்படுகின்றன…" />
                  ) : bankLiveQuery.error ? (
                    <Empty>பிழை: {String(bankLiveQuery.error)}</Empty>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="ui-table" style={{ fontSize: 11, minWidth: 2000 }}>
                        <thead>
                          <tr>
                            <th>வ.எண்</th>
                            <th style={{ background: "#e0f2fe", minWidth: 95 }}>ரசீது தேதி</th>
                            <th style={{ minWidth: 220 }}>பணி பெயர் (Work Name)</th>
                            <th>இடம்</th>
                            <th>வகை</th>
                            <th>பார்ட்டி</th>
                            <th>வரிக்குரியது</th>
                            <th>தொழிலாளர் நிதி</th>
                            <th>18% GST</th>
                            <th>இன்வாய்ஸ் மதிப்பு</th>
                            <th>IT TDS 2%</th>
                            <th>GST TDS 2%</th>
                            <th>பிடித்தம்</th>
                            <th>EMD</th>
                            <th>இதர பிடித்தம்</th>
                            <th>பெறத்தக்கது</th>
                            <th>ரசீது தொகை</th>
                            <th>FY</th>
                            <th style={{ background: "#e0f2fe", minWidth: 220 }}>வங்கி உறுதிப்படுத்தல் (Bank Confirmation)</th>
                            <th>BRS நிலை</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredR14.map((r, idx) => (
                            <tr key={idx} className={r.matchType === "exact" ? "row-ok" : r.matchType === "unmatched" ? "row-warn" : ""}>
                              <td className="mono">{r.contract.sNo || idx + 1}</td>
                              <td style={{ background: r.bank ? "#e0f2fe" : "transparent", fontWeight: r.bank ? 700 : 400, color: r.bank ? "#0284c7" : "inherit", borderLeft: r.bank ? "3px solid #0ea5e9" : "" }}>
                                {dstr(r.contract.receiptDate)}
                              </td>
                              <td className="wrap" style={{ maxWidth: 220 }}>
                                <div style={{ fontWeight: 600 }}>{r.contract.workName || <span className="text-3">(வெற்று)</span>}</div>
                                {r.contract.engName && <div className="text-3 mono">Eng: {r.contract.engName}</div>}
                              </td>
                              <td>{r.contract.workPlace || "—"}</td>
                              <td>{r.contract.workType || "—"}</td>
                              <td className="wrap" style={{ maxWidth: 100 }}>{r.contract.party || "—"}</td>
                              <td className="num">{r.contract.taxableValue ? inr(r.contract.taxableValue) : "—"}</td>
                              <td className="num">{r.contract.labourWelfare ? inr(r.contract.labourWelfare) : "—"}</td>
                              <td className="num">{r.contract.gst ? inr(r.contract.gst) : "—"}</td>
                              <td className="num">{r.contract.invoiceValue ? inr(r.contract.invoiceValue) : "—"}</td>
                              <td className="num">{r.contract.tds ? inr(r.contract.tds) : "—"}</td>
                              <td className="num">{(r.contract as any).gstTds ? inr((r.contract as any).gstTds) : "—"}</td>
                              <td className="num">{(r.contract as any).withHeld ? inr((r.contract as any).withHeld) : "—"}</td>
                              <td className="num">{(r.contract as any).emd ? inr((r.contract as any).emd) : "—"}</td>
                              <td className="num">{(r.contract as any).otherDeduction ? inr((r.contract as any).otherDeduction) : "—"}</td>
                              <td className="num">{(r.contract as any).receivableAmount ? inr((r.contract as any).receivableAmount) : "—"}</td>
                              <td className="num" style={{ fontWeight: 700 }}>{inr(r.contract.receiptAmount)}</td>
                              <td><Badge tone="info">{r.contract.fy}</Badge></td>
                              <td style={{ background: r.bank ? "#e0f2fe" : "#fef2f2", borderLeft: r.bank ? "3px solid #0ea5e9" : "" }}>
                                {r.bank ? (
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#0284c7" }}>
                                      வங்கி: {dstr(r.bank.date)} {r.dateDiff === 0 ? "(அதே தேதி ✓)" : `(${r.dateDiff}d)`}
                                    </div>
                                    <div style={{ fontSize: 10 }}>{r.bank.description.slice(0, 50)}</div>
                                    <div><b>வரவு:</b> {inr(r.bank.credit)}</div>
                                  </div>
                                ) : (
                                  <span className="text-3">வரவு உறுதிப்படுத்தப்படவில்லை</span>
                                )}
                              </td>
                              <td>
                                <Badge tone={r.matchType === "exact" ? "ok" : r.matchType === "unmatched" ? "err" : "warn"}>
                                  {r.matchType === "exact" ? "பொருந்தியது" : r.matchType === "unmatched" ? "நிலுவை" : r.matchType}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                          {totalsR14 && (
                            <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #000" }}>
                              <td colSpan={6} style={{ textAlign: "right", padding: "8px 12px" }}>
                                மொத்தம் (TOTAL — {totalsR14.count} வரிசைகள்):
                              </td>
                              <td className="num">{inr(totalsR14.taxableValue)}</td>
                              <td className="num">{inr(totalsR14.labourWelfare)}</td>
                              <td className="num">{inr(totalsR14.gst)}</td>
                              <td className="num">{inr(totalsR14.invoiceValue)}</td>
                              <td className="num">{inr(totalsR14.tds)}</td>
                              <td className="num">{inr(totalsR14.gstTds)}</td>
                              <td className="num">{inr(totalsR14.withHeld)}</td>
                              <td className="num">{inr(totalsR14.emd)}</td>
                              <td className="num">{inr(totalsR14.otherDeduction)}</td>
                              <td className="num">{inr(totalsR14.receivableAmount)}</td>
                              <td className="num" style={{ background: "#dbeafe" }}>{inr(totalsR14.receiptAmount)}</td>
                              <td colSpan={3}></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* R1–R13 Reports View */}
            {selected !== "R14" && (
              <Card
                title={`${def?.id} — ${lang === "ta" ? def?.ta : def?.en}`}
                sub={`அமைவு: ${orientation === "landscape" ? "A4 கிடைமட்டம் (Landscape)" : "A4 செங்குத்து (Portrait)"} | மொத்த வரிசைகள்: ${r1to13Data.rows.length}`}
              >
                {run.loading ? (
                  <Spinner label={`${def?.id} அறிக்கை தரவுகள் ஏற்றப்படுகின்றன…`} />
                ) : run.error ? (
                  <Empty>பிழை: {String(run.error)}</Empty>
                ) : !r1to13Data.rows.length ? (
                  <Empty>இந்த அளவுகோல்களுக்கு தரவுகள் ஏதுமில்லை (No records found)</Empty>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ui-table" style={{ fontSize: 11, width: "100%" }}>
                      <thead>
                        <tr>
                          {r1to13Data.columns.map((col) => (
                            <th key={col} style={{ textAlign: r1to13Data.totals[col] !== undefined ? "right" : "left" }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r1to13Data.rows.map((row, i) => (
                          <tr key={i}>
                            {r1to13Data.columns.map((col, j) => {
                              const val = row[col];
                              const isNum = typeof val === "number";
                              return (
                                <td key={j} className={isNum ? "num" : ""} style={{ textAlign: isNum ? "right" : "left" }}>
                                  {isNum ? (Math.abs(val) >= 100 ? inr(val) : val.toLocaleString("en-IN")) : val === null || val === undefined ? "—" : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {/* Auto-sum Totals Row */}
                        {Object.keys(r1to13Data.totals).length > 0 && (
                          <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #000" }}>
                            {r1to13Data.columns.map((col, idx) => {
                              if (idx === 0) {
                                return (
                                  <td key={col} style={{ textAlign: "left", padding: "8px 12px" }}>
                                    மொத்தம் (TOTAL — {r1to13Data.rows.length})
                                  </td>
                                );
                              }
                              const tot = r1to13Data.totals[col];
                              return (
                                <td key={col} className="num" style={{ textAlign: "right" }}>
                                  {tot !== undefined ? inr(tot) : ""}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* A4 PRINT-READY DOCUMENT CONTAINER (Displayed during window.print())       */}
      {/* ========================================================================= */}
      <div className="a4-print-document" style={{ display: isPrintActive ? "block" : "none" }}>
        {/* Top Control Bar for Print Modal Preview */}
        <div className="no-print" style={{ position: "fixed", top: 12, right: 12, zIndex: 9999, display: "flex", gap: 8, background: "#fff", padding: 8, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          <Button kind="primary" onClick={() => window.print()}>🖨️ மீண்டும் அச்சிடு (Print)</Button>
          <Button kind="ghost" onClick={() => setIsPrintActive(false)}>✕ மூடு (Close)</Button>
        </div>

        <div className={`a4-page ${orientation}`} style={{ padding: "10mm 8mm", background: "#fff", color: "#000", fontFamily: "Arial, sans-serif" }}>
          {/* Official Company Letterhead */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 12 }}>
            <h1 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              SRI POLINCHI AND CO / AR ENTERPRISES ERP
            </h1>
            <p style={{ margin: "0 0 4px 0", fontSize: 10, color: "#333" }}>
              DOOR NO 2/150 CHITTANGADU, THIRUNALUR POST, ARANTHANGI TALUK, PUDUKKOTTAI DISTRICT - 614624
            </p>
            <p style={{ margin: 0, fontSize: 9.5, color: "#444" }}>
              Email: srikolinchiandco@gmail.com | Account: 510909010201712 (City Union Bank)
            </p>
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed #666", display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span><b>அறிக்கை (Report):</b> [{def?.id}] {lang === "ta" ? def?.ta : def?.en}</span>
              <span><b>தேதி (Date):</b> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span><b>பயனர் (User):</b> {user.name} ({user.role})</span>
              <span><b>அச்சு வடிவம்:</b> A4 {orientation === "landscape" ? "Landscape (கிடைமட்டம்)" : "Portrait (செங்குத்து)"}</span>
            </div>
          </div>

          {/* R14 Bank Live Print Table */}
          {selected === "R14" && (
            <div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: orientation === "landscape" ? 7.5 : 6.5 }}>
                <thead>
                  <tr style={{ background: "#e2e8f0" }}>
                    <th style={{ border: "1px solid #000", padding: "4px 2px" }}>வ.எண்</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px" }}>ரசீது தேதி</th>
                    <th style={{ border: "1px solid #000", padding: "4px 3px" }}>பணி பெயர் (Work Name)</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px" }}>இடம்</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px" }}>பார்ட்டி</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "right" }}>வரிக்குரியது</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "right" }}>GST 18%</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "right" }}>இன்வாய்ஸ்</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "right" }}>IT TDS</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "right" }}>ரசீது தொகை</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px" }}>FY</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", background: "#dbeafe" }}>வங்கி உறுதி தேதி</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "right", background: "#dbeafe" }}>வங்கி வரவு</th>
                    <th style={{ border: "1px solid #000", padding: "4px 2px" }}>BRS நிலை</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredR14.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "center" }}>{r.contract.sNo || i + 1}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", fontWeight: r.bank ? 700 : 400, color: r.bank ? "#0284c7" : "inherit" }}>
                        {dstr(r.contract.receiptDate)}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 4px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.contract.workName || "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px" }}>{r.contract.workPlace || "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px" }}>{r.contract.party || "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "right" }}>{r.contract.taxableValue ? inr(r.contract.taxableValue) : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "right" }}>{r.contract.gst ? inr(r.contract.gst) : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "right" }}>{r.contract.invoiceValue ? inr(r.contract.invoiceValue) : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "right" }}>{r.contract.tds ? inr(r.contract.tds) : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "right", fontWeight: 700 }}>{inr(r.contract.receiptAmount)}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "center" }}>{r.contract.fy}</td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", background: r.bank ? "#e0f2fe" : "transparent" }}>
                        {r.bank ? dstr(r.bank.date) : "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "right", fontWeight: 700, background: r.bank ? "#e0f2fe" : "transparent" }}>
                        {r.bank ? inr(r.bank.credit) : "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "center", fontWeight: 600 }}>
                        {r.matchType === "exact" ? "Reconciled" : r.matchType === "unmatched" ? "Pending" : r.matchType}
                      </td>
                    </tr>
                  ))}
                  {totalsR14 && (
                    <tr style={{ background: "#e2e8f0", fontWeight: 800, borderTop: "2px solid #000", borderBottom: "2px solid #000" }}>
                      <td colSpan={5} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>
                        மொத்தம் (TOTAL — {totalsR14.count} வரிசைகள்):
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "right" }}>{inr(totalsR14.taxableValue)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "right" }}>{inr(totalsR14.gst)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "right" }}>{inr(totalsR14.invoiceValue)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "right" }}>{inr(totalsR14.tds)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "right", background: "#bfdbfe" }}>{inr(totalsR14.receiptAmount)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px" }}></td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px" }}></td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "right", background: "#bfdbfe" }}>{inr(statsR14?.totalBank || 0)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 3px" }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* R1–R13 Print Table */}
          {selected !== "R14" && (
            <div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: orientation === "landscape" ? 8.5 : 9.5 }}>
                <thead>
                  <tr style={{ background: "#e2e8f0" }}>
                    {r1to13Data.columns.map((col) => (
                      <th key={col} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: r1to13Data.totals[col] !== undefined ? "right" : "left" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r1to13Data.rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                      {r1to13Data.columns.map((col, j) => {
                        const val = row[col];
                        const isNum = typeof val === "number";
                        return (
                          <td key={j} style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: isNum ? "right" : "left" }}>
                            {isNum ? (Math.abs(val) >= 100 ? inr(val) : val.toLocaleString("en-IN")) : val === null || val === undefined ? "—" : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {Object.keys(r1to13Data.totals).length > 0 && (
                    <tr style={{ background: "#e2e8f0", fontWeight: 800, borderTop: "2px solid #000", borderBottom: "2px solid #000" }}>
                      {r1to13Data.columns.map((col, idx) => {
                        if (idx === 0) {
                          return (
                            <td key={col} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>
                              மொத்தம் (TOTAL — {r1to13Data.rows.length})
                            </td>
                          );
                        }
                        const tot = r1to13Data.totals[col];
                        return (
                          <td key={col} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>
                            {tot !== undefined ? inr(tot) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Formal Signatures Block */}
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1.5px solid #000", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, fontSize: 10, textAlign: "center" }}>
            <div style={{ border: "1px solid #aaa", padding: "12px 8px", borderRadius: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 28 }}>தயாரித்தவர் / PREPARED BY</div>
              <div style={{ borderTop: "1px dashed #666", paddingTop: 4 }}>
                பெயர் (Name): {user.name}<br />
                பதவி: {user.role}<br />
                தேதி (Date): {new Date().toLocaleDateString("en-IN")}
              </div>
            </div>

            <div style={{ border: "1px solid #aaa", padding: "12px 8px", borderRadius: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 28 }}>சரிபார்த்தவர் / CHECKED & VERIFIED BY</div>
              <div style={{ borderTop: "1px dashed #666", paddingTop: 4 }}>
                மாவட்ட நிர்வாகி / கணக்காளர்<br />
                (District Admin / Accountant)<br />
                கையொப்பம் (Signature): _________________
              </div>
            </div>

            <div style={{ border: "1px solid #aaa", padding: "12px 8px", borderRadius: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 28 }}>அங்கீகரித்தவர் & ஆடிட்டர் / AUTHORIZED SIGNATORY</div>
              <div style={{ borderTop: "1px dashed #666", paddingTop: 4 }}>
                ஸ்ரீ பொலிஞ்சி & கோ முத்திரை / ஆடிட்டர்<br />
                (Sri Polinchi & Co Seal & Auditor)<br />
                கையொப்பம் (Signature): _________________
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Print CSS */}
      <style>{`
        .row-ok td { background: rgba(16, 185, 129, 0.05); }
        .row-warn td { background: rgba(239, 68, 68, 0.05); }

        @media print {
          @page {
            size: A4 ${orientation};
            margin: 8mm 6mm;
          }
          html, body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .app-sidebar, .app-topbar, .settings-nav, .ui-btn, .ai-fab, .no-print, header.app-head {
            display: none !important;
          }
          .reports-centre {
            padding: 0 !important;
            margin: 0 !important;
          }
          .a4-print-document {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
          }
          .a4-page {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        }
      `}</style>
    </div>
  );
}
