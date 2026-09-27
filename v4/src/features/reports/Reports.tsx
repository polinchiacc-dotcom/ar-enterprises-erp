/** Reports — R1–R13 + Bank Live BRS 200 All Columns Print Ready (HTML maathiri) */
import { useMemo, useState } from "react";
import type { Role, ReportResult, User } from "../../types";
import { useI18n } from "../../i18n";
import { useQuery } from "../../hooks/useApi";
import { Badge, Button, Card, Empty, PageHead, Spinner, Table, useToast } from "../../components/ui";
import { dstr, inr } from "../../lib/format";
import * as reports from "../../services/ops";

interface ReportDef { id: string; en: string; ta: string; roles: Role[]; params?: ("district" | "vendorId" | "agentId" | "month")[] }

const REPORT_DEFS: ReportDef[] = [
  { id: "R1", en: "District performance", ta: "மாவட்ட செயல்திறன்", roles: ["super_admin", "district_admin"], params: ["district"] },
  { id: "R2", en: "Vendor ledger", ta: "வெண்டர் லெடார்", roles: ["super_admin", "district_admin", "auditor"], params: ["vendorId"] },
  { id: "R3", en: "Transaction aging", ta: "பரிவர்த்தனை வயது", roles: ["super_admin", "district_admin", "auditor"], params: ["district"] },
  { id: "R4", en: "Collections", ta: "வசூல்", roles: ["super_admin", "district_admin", "auditor"], params: ["district"] },
  { id: "R5", en: "Wallet statement", ta: "வாலெட் கணக்கு", roles: ["super_admin"], params: [] },
  { id: "R6", en: "Agent commission statement", ta: "அஜெண்ட் கமிஷன்", roles: ["super_admin", "district_admin", "agent", "auditor"], params: ["agentId"] },
  { id: "R7", en: "GST summary", ta: "ஜிஎஸ்டி சுருக்கம்", roles: ["super_admin", "auditor"], params: [] },
  { id: "R8", en: "TDS summary", ta: "டிடிஎஸ் சுருக்கம்", roles: ["super_admin", "auditor"], params: [] },
  { id: "R9", en: "GSTR-2B reconciliation", ta: "ஜிஎஸ்டி-2B சரிபார்ப்பு", roles: ["super_admin", "auditor"], params: [] },
  { id: "R10", en: "Bank reconciliation (V4 internal)", ta: "வங்கி சரிபார்ப்பு (V4)", roles: ["super_admin", "auditor"], params: [] },
  { id: "R11", en: "Audit extract", ta: "ஆடிட் பதிவேடு", roles: ["super_admin", "auditor"], params: [] },
  { id: "R12", en: "Users & roles", ta: "பயனர்கள் & பங்குகள்", roles: ["super_admin"], params: [] },
  { id: "R13", en: "AI usage", ta: "AI பயன்பாடு", roles: ["super_admin"], params: [] },
  { id: "R14", en: "Bank Live BRS 200 — All Columns Print Ready", ta: "வங்கி லைவ் BRS 200 — அனைத்து காலமும் அச்சு தயார்", roles: ["super_admin", "auditor"], params: [] },
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
  const [selected, setSelected] = useState<string>("R14");
  const [month, setMonth] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const defs = REPORT_DEFS.filter((r) => r.roles.includes(user.role));
  const def = defs.find((r) => r.id === selected) || null;

  const run = useQuery("reports.run", {
    reportId: selected || "R14",
    params: {
      ...(month ? { month } : {}),
      ...(user.role === "district_admin" ? { district: user.district } : {}),
      ...(user.role === "agent" ? { self: true } : {})
    }
  }, [selected, month], !!def && selected !== "R14");

  const data = run.data as ReportResult | null;

  // Bank Live 200 data for R14
  const bankLiveQuery = useQuery<LiveData>("bank.liveRecon", { filterStatus: "all", filterFY: "all", search: "", dateFrom: "", dateTo: "", workPlace: "all" }, [selected], selected === "R14");
  const bankData = bankLiveQuery.data as LiveData | null;
  const filtered = useMemo(() => bankData?.combined || [], [bankData]);
  const stats = bankData?.stats;

  const totals = useMemo(() => {
    if (!filtered.length) return null;
    const sum = (key: keyof ContractRow) => filtered.reduce((s, r) => s + (Number((r.contract as any)[key]) || 0), 0);
    return {
      receiptAmount: sum("receiptAmount"), taxableValue: sum("taxableValue"), labourWelfare: sum("labourWelfare"),
      gst: sum("gst"), invoiceValue: sum("invoiceValue"), tds: sum("tds"), gstTds: sum("gstTds"),
      withHeld: sum("withHeld"), emd: sum("emd"), otherDeduction: sum("otherDeduction"), receivableAmount: sum("receivableAmount"), count: filtered.length,
    };
  }, [filtered]);

  const allTotals = useMemo(() => {
    if (!bankData) return null;
    const sum = (key: keyof ContractRow) => bankData.contractRows.reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);
    return {
      receiptAmount: sum("receiptAmount"), taxableValue: sum("taxableValue"), labourWelfare: sum("labourWelfare"),
      gst: sum("gst"), invoiceValue: sum("invoiceValue"), tds: sum("tds"), gstTds: sum("gstTds"),
      withHeld: sum("withHeld"), emd: sum("emd"), otherDeduction: sum("otherDeduction"), receivableAmount: sum("receivableAmount"), count: bankData.contractRows.length,
    };
  }, [bankData]);

  async function doExport(format: "csv" | "json") {
    if (!def) return;
    if (def.id === "R14") {
      // Client-side CSV for 200 all columns
      doExportBankLive();
      return;
    }
    setExporting(true);
    try {
      const r = await reports.exportRequest({
        reportId: def.id,
        format,
        ...(user.role === "district_admin" ? { scope: { district: user.district } } : {}),
        ...(user.role === "agent" ? { scope: { self: true } } : {})
      });
      toast(true, t("exports.exportRequested"));
      const res = await fetch(r.jobToken ? "/api/export/" + encodeURIComponent(r.jobToken) : "/api/export/none", { cache: "no-store" });
      if (!res.ok) { toast(false, t("exports.expired")); return; }
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^";]+)"?/);
      const name = m && m[1] ? decodeURIComponent(m[1]) : def.id + "." + format;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast(false, (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  function doExportBankLive() {
    if (!filtered.length) { toast(false, "No data to export"); return; }
    const headers = ["S.No","Receipt Date","Work Name","Work Place","Work Type","Party","Taxable Value","Labour Welfare","18% GST","Invoice Value","IT TDS 2%","GST TDS 2%","With Held","EMD","Other Deduction","Receivable","Receipt Amount","FY","File Name","Bank Date","Bank Description","Bank Credit","BRS Status","Confidence","Date Diff","Amount Diff"];
    const rows = filtered.map(r => [
      r.contract.sNo, r.contract.receiptDate, `"${(r.contract.workName||"").replace(/"/g,'""')}"`, `"${(r.contract.workPlace||"").replace(/"/g,'""')}"`,
      r.contract.workType, r.contract.party, r.contract.taxableValue, r.contract.labourWelfare, r.contract.gst, r.contract.invoiceValue,
      r.contract.tds, (r.contract as any).gstTds, (r.contract as any).withHeld, (r.contract as any).emd, (r.contract as any).otherDeduction,
      (r.contract as any).receivableAmount, r.contract.receiptAmount, r.contract.fy, r.contract.fileName,
      r.bank?.date||"", `"${(r.bank?.description||"").replace(/"/g,'""')}"`, r.bank?.credit||"", r.matchType, r.confidence, r.dateDiff, r.amountDiff
    ]);
    const totalRow = totals ? ["TOTAL", "", "", "", "", "", totals.taxableValue, totals.labourWelfare, totals.gst, totals.invoiceValue, totals.tds, totals.gstTds, totals.withHeld, totals.emd, totals.otherDeduction, totals.receivableAmount, totals.receiptAmount, "", "", "", "", "", "", "", "", ""] : [];
    const csv = [headers.join(","), ...rows.map(r=>r.join(",")), totalRow.join(",")].join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Bank_Live_BRS_200_All_Columns_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    toast(true, "Excel CSV exported — 200 all columns + totals");
  }

  function handlePrint() {
    setShowPrint(true);
    setTimeout(()=>window.print(), 150);
  }

  return (
    <div>
      <PageHead title={t("reports.title")} sub={t("reports.sub") + " — R14 Bank Live BRS 200 All Columns Print Ready"} />

      <div className="settings-grid" style={{ gridTemplateColumns: "280px 1fr" }}>
        <div className="settings-nav">
          {defs.map((r) => (
            <button key={r.id} className={selected === r.id ? "on" : ""} onClick={() => setSelected(r.id)}>
              <span className="mono" style={{ marginRight: 8 }}>{r.id}</span>{lang === "ta" ? r.ta : r.en}
            </button>
          ))}
        </div>

        <div>
          {def && def.id !== "R14" && (
            <Card
              title={def.id + " — " + (lang === "ta" ? def.ta : def.en)}
              right={
                <div className="flex">
                  <input type="month" className="ui-input" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
                  <Button kind="ghost" busy={exporting} onClick={() => doExport("csv")}>{t("reports.exportCsv")}</Button>
                  <Button kind="soft" busy={exporting} onClick={() => doExport("json")}>{t("common.export")} JSON</Button>
                </div>
              }
            >
              {run.loading ? <Spinner label={t("common.loading")} /> : data ? (
                <>
                  <div className="flex mb-8">
                    <Badge tone="info">{data.rowCount} {t("reports.rows").toLowerCase()}</Badge>
                    {data.truncated && <Badge tone="warn">{t("reports.truncated")} (2000)</Badge>}
                  </div>
                  <Table head={data.columns} empty={data.rows.length === 0}>
                    {data.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((c, j) => (
                          <td key={j} className={typeof c === "number" ? "num" : ""}>
                            {typeof c === "number" && Math.abs(c) >= 100 ? inr(c) : c === null || c === undefined ? "—" : String(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Table>
                </>
              ) : <Empty>{run.error || t("common.noData")}</Empty>}
            </Card>
          )}

          {def && def.id === "R14" && (
            <div>
              {/* Top dashboard for R14 */}
              <div className="ui-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 12 }}>
                <div className="ui-stat"><div className="ui-stat-label">Total 200</div><div className="ui-stat-value" style={{ color: stats?.contractCount===200?"green":"red" }}>{stats?.contractCount} {stats?.contractCount===200?"=200 ✓":`≠200`}</div><div className="ui-stat-sub">{stats?.countsBySheet ? Object.entries(stats.countsBySheet).map(([k,v])=>`${k}:${v}`).join(" • ") : "67+68+65"}</div></div>
                <div className="ui-stat"><div className="ui-stat-label">Receipt Total</div><div className="ui-stat-value">{inr(allTotals?.receiptAmount||0)}</div><div className="ui-stat-sub">Filtered {inr(totals?.receiptAmount||0)} ({totals?.count})</div></div>
                <div className="ui-stat"><div className="ui-stat-label">Taxable</div><div className="ui-stat-value">{inr(allTotals?.taxableValue||0)}</div><div className="ui-stat-sub">Filtered {inr(totals?.taxableValue||0)}</div></div>
                <div className="ui-stat"><div className="ui-stat-label">GST 18%</div><div className="ui-stat-value">{inr(allTotals?.gst||0)}</div><div className="ui-stat-sub">Filtered {inr(totals?.gst||0)}</div></div>
                <div className="ui-stat"><div className="ui-stat-label">Invoice</div><div className="ui-stat-value">{inr(allTotals?.invoiceValue||0)}</div><div className="ui-stat-sub">Filtered {inr(totals?.invoiceValue||0)}</div></div>
                <div className="ui-stat"><div className="ui-stat-label">Reconciled</div><div className="ui-stat-value">{stats?.matched} / {stats?.total}</div><div className="ui-stat-sub">{stats?Math.round(stats.matched/Math.max(1,stats.total)*100):0}% • Bank {stats?.bankCount} total {stats?.bankCreditCount} BY</div></div>
              </div>

              <Card
                title="R14 — Bank Live BRS 200 — All Columns + Totals + Signatures — Print Ready (HTML maathiri)"
                sub={`Live: ${bankData?.externalId||""} | Last Sync ${bankData?.lastSync ? new Date(bankData.lastSync).toLocaleString() : ""} | ${filtered.length} of ${stats?.contractCount} (200)`}
                right={
                  <div className="flex wrap" style={{ gap: 8 }}>
                    <Button kind="ghost" onClick={()=>bankLiveQuery.reload()}>🔄 Refresh Live</Button>
                    <Button kind="ghost" onClick={handlePrint}>🖨️ Print Tally BRS</Button>
                    <Button kind="soft" onClick={doExportBankLive}>📊 Export Excel (200 All Columns + Totals)</Button>
                  </div>
                }
              >
                {bankLiveQuery.loading && !bankData ? <Spinner label="Loading 200 all columns — 3 sheets 67+68+65 + Bank 1804 confirmation…" /> :
                bankLiveQuery.error ? <Empty>Failed: {String(bankLiveQuery.error)}</Empty> :
                (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ui-table" style={{ fontSize: 11, minWidth: 2200 }}>
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th style={{ minWidth: 95, background: "#e0f2fe" }}>Receipt Date (paired blue)</th>
                          <th style={{ minWidth: 220 }}>Work Name (200 main)</th>
                          <th>Work Place</th>
                          <th>Work Type</th>
                          <th>Party</th>
                          <th>Taxable Value</th>
                          <th>Labour WF</th>
                          <th>18% GST</th>
                          <th>Invoice Value</th>
                          <th>IT TDS 2%</th>
                          <th>GST TDS 2%</th>
                          <th>With Held</th>
                          <th>EMD</th>
                          <th>Other Ded</th>
                          <th>Receivable</th>
                          <th>Receipt Amount</th>
                          <th>FY</th>
                          <th>File Name</th>
                          <th style={{ minWidth: 230, background: "#e0f2fe" }}>Bank Confirmation — Date + Details (same color)</th>
                          <th>BRS Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, idx)=>(
                          <tr key={idx} className={r.matchType==="exact"?"row-ok":r.matchType==="unmatched"?"row-warn":""}>
                            <td className="mono">{r.contract.sNo||idx+1}</td>
                            <td style={{ background: r.bank?"#e0f2fe":"transparent", fontWeight: r.bank?700:400, color: r.bank?"#0284c7":"inherit", borderLeft: r.bank?"3px solid #0ea5e9":"" }}>{dstr(r.contract.receiptDate)}</td>
                            <td className="wrap" style={{ maxWidth: 240 }}><div style={{ fontWeight: 600 }} title={r.contract.workName}>{r.contract.workName ? (r.contract.workName.length>65?r.contract.workName.slice(0,65)+"…":r.contract.workName) : <span className="text-3">(empty)</span>}</div><div className="mono text-3">{r.contract.engName?`Eng:${r.contract.engName}`:""}</div></td>
                            <td>{r.contract.workPlace||<span className="text-3">(empty)</span>}</td>
                            <td className="text-3">{r.contract.workType||"—"}</td>
                            <td className="text-3 wrap" style={{ maxWidth: 90 }}>{r.contract.party||"—"}</td>
                            <td className="num">{r.contract.taxableValue?inr(r.contract.taxableValue):<span className="text-3">—</span>}</td>
                            <td className="num">{r.contract.labourWelfare?inr(r.contract.labourWelfare):<span className="text-3">—</span>}</td>
                            <td className="num">{r.contract.gst?inr(r.contract.gst):<span className="text-3">—</span>}</td>
                            <td className="num">{r.contract.invoiceValue?inr(r.contract.invoiceValue):<span className="text-3">—</span>}</td>
                            <td className="num">{r.contract.tds?inr(r.contract.tds):<span className="text-3">—</span>}</td>
                            <td className="num">{(r.contract as any).gstTds?inr((r.contract as any).gstTds):<span className="text-3">—</span>}</td>
                            <td className="num">{(r.contract as any).withHeld?inr((r.contract as any).withHeld):<span className="text-3">—</span>}</td>
                            <td className="num">{(r.contract as any).emd?inr((r.contract as any).emd):<span className="text-3">—</span>}</td>
                            <td className="num">{(r.contract as any).otherDeduction?inr((r.contract as any).otherDeduction):<span className="text-3">—</span>}</td>
                            <td className="num">{(r.contract as any).receivableAmount?inr((r.contract as any).receivableAmount):<span className="text-3">—</span>}</td>
                            <td className="num"><b>{inr(r.contract.receiptAmount)}</b></td>
                            <td><Badge tone="info">{r.contract.fy}</Badge></td>
                            <td className="mono text-3 wrap" style={{ maxWidth: 110 }}>{r.contract.fileName||"—"}</td>
                            <td style={{ background: r.bank?"#e0f2fe":"#fef2f2", maxWidth: 230, borderLeft: r.bank?"3px solid #0ea5e9":"" }}>
                              {r.bank ? (
                                <div>
                                  <div style={{ fontWeight: 700, color: "#0284c7" }}>Bank Date: {dstr(r.bank.date)} {r.dateDiff===0?"(same date ✓)":r.dateDiff>0&&r.dateDiff<=30?`(${r.dateDiff}d)`: ""}</div>
                                  <div style={{ fontSize: 10 }} title={r.bank.description}>{r.bank.description.slice(0,70)}</div>
                                  <div><b>Credit:</b> {inr(r.bank.credit)} • {r.bank.type}</div>
                                </div>
                              ) : <div className="text-3">No bank on {dstr(r.contract.receiptDate)} for {inr(r.contract.receiptAmount)}</div>}
                            </td>
                            <td><Badge tone={r.matchType==="exact"?"ok":r.matchType==="partial"?"warn":r.matchType==="near"?"info":"err"}>{r.matchType==="exact"?"Reconciled":r.matchType==="unmatched"?"Pending":r.matchType}</Badge><div className="mono text-3">{r.confidence}% {r.amountDiff>0?`${r.amountDiff}% diff`:"exact amt"}</div></td>
                          </tr>
                        ))}
                        {totals && (
                          <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #000" }}>
                            <td colSpan={6} style={{ textAlign: "right" }}>TOTAL ({totals.count} filtered) — All amount columns auto total:</td>
                            <td className="num">{inr(totals.taxableValue)}</td>
                            <td className="num">{inr(totals.labourWelfare)}</td>
                            <td className="num">{inr(totals.gst)}</td>
                            <td className="num">{inr(totals.invoiceValue)}</td>
                            <td className="num">{inr(totals.tds)}</td>
                            <td className="num">{inr(totals.gstTds)}</td>
                            <td className="num">{inr(totals.withHeld)}</td>
                            <td className="num">{inr(totals.emd)}</td>
                            <td className="num">{inr(totals.otherDeduction)}</td>
                            <td className="num">{inr(totals.receivableAmount)}</td>
                            <td className="num" style={{ background: "#dbeafe" }}>{inr(totals.receiptAmount)}</td>
                            <td colSpan={4}></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {showPrint && (
                <div className="print-only" style={{ padding: 20, background: "white", color: "black" }}>
                  <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 10 }}>
                    <h2 style={{ margin: 0 }}>SRI POLINCHI AND CO</h2>
                    <p style={{ margin: 0 }}>DOOR NO 2/150 CHITTANGADU THIRUNALUR POST ARANTHANGI TALUK | srikolinchiandco@gmail.com</p>
                    <h3 style={{ margin: "8px 0 0 0" }}>Bank Reconciliation Statement — 200 Contract Works — All Columns + Totals — Mini-Tally</h3>
                    <p style={{ margin: 0 }}>Account: 510909010201712 | Spreadsheet: {bankData?.externalId} | Last Sync: {bankData?.lastSync} | Total: {filtered.length} of {stats?.contractCount} (200)</p>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8 }}>
                    <thead>
                      <tr>
                        <th style={{ border: "1px solid #000", padding: 3 }}>S.No</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Receipt Date</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Work Name</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Place</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Taxable</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>GST</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Invoice</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>TDS</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Receipt Amt</th>
                        <th style={{ border: "1px solid #000", padding: 3, background: "#e0f2fe" }}>Bank Date</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Bank Desc</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Credit</th>
                        <th style={{ border: "1px solid #000", padding: 3 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r,i)=>(
                        <tr key={i}>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.sNo||i+1}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2, background: r.bank?"#e0f2fe":"" }}>{r.contract.receiptDate}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.workName.slice(0,50)}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.workPlace}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.taxableValue}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.gst}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.invoiceValue}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.tds}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.contract.receiptAmount}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2, background: "#e0f2fe" }}>{r.bank?.date||""}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.bank?.description.slice(0,25)||""}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.bank?.credit||""}</td>
                          <td style={{ border: "1px solid #ccc", padding: 2 }}>{r.matchType}</td>
                        </tr>
                      ))}
                    </tbody>
                    {totals && (
                      <tfoot>
                        <tr style={{ fontWeight: 700, background: "#f1f5f9" }}>
                          <td colSpan={4} style={{ border: "1px solid #000", padding: 3, textAlign: "right" }}>TOTAL ({totals.count})</td>
                          <td style={{ border: "1px solid #000", padding: 3 }}>{totals.taxableValue}</td>
                          <td style={{ border: "1px solid #000", padding: 3 }}>{totals.gst}</td>
                          <td style={{ border: "1px solid #000", padding: 3 }}>{totals.invoiceValue}</td>
                          <td style={{ border: "1px solid #000", padding: 3 }}>{totals.tds}</td>
                          <td style={{ border: "1px solid #000", padding: 3 }}>{totals.receiptAmount}</td>
                          <td colSpan={4} style={{ border: "1px solid #000", padding: 3 }}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  <div style={{ marginTop: 20 }}>
                    <p>Total Contract (200): {inr(stats?.totalContract||0)} | Receipt Total (filtered): {inr(totals?.receiptAmount||0)} | Reconciled: {stats?.matched} | Pending: {stats?.unmatched} | Bank: {stats?.bankCount} total {stats?.bankCreditCount} BY credits</p>
                    <p>Note: Bank Confirmation — Date + Details paired same color (Receipt Date blue + Bank Date blue #e0f2fe) for confirmation purpose only, not huge total.</p>
                  </div>
                  <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", paddingTop: 20 }}>
                    <span>Prepared by: ___________<br/><br/>Date: ___________</span>
                    <span>Auditor: ___________<br/><br/>Signature: ___________</span>
                    <span>Admin: ___________<br/><br/>Signature: ___________</span>
                  </div>
                  <div style={{ textAlign: "center", marginTop: 20 }}>
                    <Button kind="ghost" onClick={()=>setShowPrint(false)}>Close Print View</Button>
                  </div>
                </div>
              )}

              <style>{`
                .row-ok td { background: rgba(16,185,129,0.04); }
                .row-warn td { background: rgba(239,68,68,0.04); }
                @media print {
                  .app-sidebar, .app-topbar, .ui-btn, .ai-fab { display: none !important; }
                  .print-only { display: block !important; }
                }
              `}</style>
            </div>
          )}

          {!def && <Empty>{lang === "ta" ? "அறிக்கையைத் தேர்ந்தெடுக்கவும்" : "Select a report to run it"}</Empty>}
        </div>
      </div>
      <p className="text-3 mt-8">{t("exports.sub")}</p>
    </div>
  );
}
