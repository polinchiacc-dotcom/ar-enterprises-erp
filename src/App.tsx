import { useState, useCallback } from "react";
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendors.map(v => {
                const vTxns = transactions.filter(t => t.vendorCode === v.vendorCode);
                const vBills = bills.filter(b => b.vendorCode === v.vendorCode);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{v.vendorCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{v.vendorName}</td>
                    <td className="px-4 py-3 text-gray-600">{v.district}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{vTxns.length}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-700">{vBills.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "transactions" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0a1628" }}>
                <tr>
                  {["TXN ID","Vendor","Expected","GST Amt","Bills","Remaining","Profit","Status"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map(t => (
                  <tr key={t.txnId} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-mono text-xs text-blue-700">{t.txnId}</td>
                    <td className="px-3 py-3 font-medium text-gray-800">{t.vendorName}</td>
                    <td className="px-3 py-3">{fmt(t.expectedAmount)}</td>
                    <td className="px-3 py-3 text-purple-700">{fmt(t.gstAmount)}</td>
                    <td className="px-3 py-3 text-green-700">{fmt(t.billsReceived)}</td>
                    <td className="px-3 py-3 text-orange-600">{fmt(t.remainingExpected)}</td>
                    <td className="px-3 py-3 text-green-600">{t.profit > 0 ? fmt(t.profit) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                        ${t.status === "Closed" ? "bg-green-100 text-green-700" :
                          t.status === "PendingClose" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "bills" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0a1628" }}>
                <tr>
                  {["Bill No","Vendor","Date","Bill Amount","GST%","GST தொகை","Total (18%)"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bills.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-800">{b.billNumber}</td>
                    <td className="px-3 py-3 font-medium text-gray-800">{b.vendorName}</td>
                    <td className="px-3 py-3 text-gray-600">{b.billDate}</td>
                    <td className="px-3 py-3">{fmt(b.billAmount)}</td>
                    <td className="px-3 py-3 text-gray-600">{b.gstPercent}%</td>
                    <td className="px-3 py-3 text-purple-700">{fmt(b.gstAmount)}</td>
                    <td className="px-3 py-3 text-green-700 font-semibold">{fmt(b.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
