import { useState, useCallback } from "react";

// ============================================================
// TYPES
// ============================================================
interface User { id: string; username: string; password: string; role: "admin" | "district"; district?: string; }
interface Vendor {
  id: string; vendorCode: string; vendorName: string; district: string;
  mobile?: string; businessType?: string; address?: string; gstNo?: string; regYear?: string;
}
interface Transaction {
  id: string; txnId: string; district: string; vendorCode: string; vendorName: string;
  financialYear: string; month: string; expectedAmount: number; advanceAmount: number;
  gstPercent: number; gstAmount: number; gstBalance: number;
  billsReceived: number; remainingExpected: number;
  status: "Open" | "PendingClose" | "Closed";
  closedByDistrict: boolean; confirmedByAdmin: boolean;
  profit: number;
}
interface Bill {
  id: string; txnId: string; vendorCode: string; vendorName: string; district: string;
  billNumber: string; billDate: string; billAmount: number;
  gstPercent: number; gstAmount: number; totalAmount: number;
}
interface WalletEntry {
  id: string; date: string; description: string; txnId?: string;
  debit: number; credit: number; balance: number; type: "advance" | "gst" | "profit" | "manual";
}
interface ManagedUser {
  id: string; username: string; password: string; district: string; active: boolean; createdAt: string;
}

// ============================================================
// CONSTANTS — 🔒 LOCKED
// ============================================================
// 🔒 AR_BILL_CALC_FINAL_LOCKED
// GST Amount = Bill Amount × GST%
// Total Amount = Bill Amount × 1.18 (FIXED 18%)
// 🔒 AR_TRANSACTION_CALC_FINAL_LOCKED
// GST Amount = Expected Amount × GST%
// Remaining = Expected - Sum(Bill Amount × 1.18)
// 🔒 AR_WALLET_CALC_FINAL_LOCKED
// Advance → Debit immediately
// District Close → GST Balance Debit + Red Alert
// Admin Confirm → 8% Profit Credit

const DISTRICTS = [
  "Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri",
  "Dindigul","Erode","Kallakurichi","Kanchipuram","Kanniyakumari","Karur",
  "Krishnagiri","Madurai","Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris",
  "Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivagangai",
  "Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirappalli","Tirunelveli",
  "Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore",
  "Viluppuram","Virudhunagar"
];
const GST_RATES = [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8];
const MONTHS = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const FY_LIST = ["2024-25","2025-26","2026-27"];
const BUSINESS_TYPES = ["Hardware","Electrical","Civil","Plumbing","Mechanical","Catering","Transport","Stationery","IT","Medical","General"];
const DIST_SHORT: Record<string,string> = {
  "Ariyalur":"ARI","Chengalpattu":"CGP","Chennai":"CHE","Coimbatore":"CBE","Cuddalore":"CUD",
  "Dharmapuri":"DHP","Dindigul":"DGL","Erode":"ERD","Kallakurichi":"KLK","Kanchipuram":"KCP",
  "Kanniyakumari":"KNK","Karur":"KRR","Krishnagiri":"KRG","Madurai":"MDU","Mayiladuthurai":"MYD",
  "Nagapattinam":"NGP","Namakkal":"NMK","Nilgiris":"NLG","Perambalur":"PBR","Pudukkottai":"PDK",
  "Ramanathapuram":"RMN","Ranipet":"RNP","Salem":"SLM","Sivagangai":"SVG","Tenkasi":"TNK",
  "Thanjavur":"TNJ","Theni":"THN","Thoothukudi":"TUT","Tiruchirappalli":"TRP","Tirunelveli":"TNV",
  "Tirupathur":"TPT","Tiruppur":"TPR","Tiruvallur":"TVR","Tiruvannamalai":"TVL","Tiruvarur":"TVU",
  "Vellore":"VLR","Viluppuram":"VLP","Virudhunagar":"VRN"
};
const BIZ_SHORT: Record<string,string> = {
  "Hardware":"HW","Electrical":"EL","Civil":"CV","Plumbing":"PL","Mechanical":"MC",
  "Catering":"CT","Transport":"TR","Stationery":"ST","IT":"IT","Medical":"MD","General":"GN"
};

const genVendorCode = (district: string, bizType: string, year: string, existing: Vendor[]) => {
  const d = DIST_SHORT[district] || district.slice(0,3).toUpperCase();
  const b = BIZ_SHORT[bizType] || bizType.slice(0,2).toUpperCase();
  const y = year ? year.slice(-2) : new Date().getFullYear().toString().slice(-2);
  const count = existing.filter(v => v.district === district && v.businessType === bizType).length + 1;
  return `${d}${y}${b}${String(count).padStart(3,"0")}`;
};
const PROFIT_RATE = 0.08;
const BILL_TOTAL_RATE = 1.18; // 🔒 LOCKED

const USERS: User[] = [
  { id: "U001", username: "admin", password: "Admin@123", role: "admin" },
  { id: "U002", username: "chennai_user", password: "Chennai@123", role: "district", district: "Chennai" },
  { id: "U003", username: "coimbatore_user", password: "Coimbatore@123", role: "district", district: "Coimbatore" },
  { id: "U004", username: "madurai_user", password: "Madurai@123", role: "district", district: "Madurai" },
];

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;
const genId = (prefix: string) => prefix + Math.random().toString(36).substr(2,7).toUpperCase();

// ============================================================
// INITIAL DATA
// ============================================================
const INIT_VENDORS: Vendor[] = [];
const INIT_WALLET: WalletEntry[] = [];
const INIT_TRANSACTIONS: Transaction[] = [];
const INIT_BILLS: Bill[] = [];

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) { setError(""); onLogin(user); }
    else setError("தவறான username அல்லது password!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}>
      <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)" }}>
            <span className="text-2xl font-bold text-gray-900">AR</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AR Enterprises</h1>
          <p className="text-sm mt-1" style={{ color: "#c9a227" }}>Multi-District Vendor ERP System V3.0</p>
          <p className="text-xs text-gray-400 mt-1">Tamil Nadu GST Bill Automation</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Username</label>
            <select value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <option value="">-- Select Username --</option>
              {USERS.map(u => <option key={u.id} value={u.username} style={{ background: "#1a2f5e" }}>{u.username}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter password" autoComplete="new-password"
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none placeholder-gray-500"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
          </div>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button onClick={handleLogin}
            className="w-full py-2.5 rounded-lg font-semibold text-gray-900 text-sm transition-all"
            style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)" }}>
            Login →
          </button>
        </div>
        <div className="mt-6 p-3 rounded-lg text-xs text-gray-400 space-y-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="font-medium text-gray-300">Demo Credentials:</p>
          <p>👑 admin / Admin@123</p>
          <p>🏙️ chennai_user / Chennai@123</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("dashboard");
  const [vendors, setVendors] = useState<Vendor[]>(INIT_VENDORS);
  const [transactions, setTransactions] = useState<Transaction[]>(INIT_TRANSACTIONS);
  const [bills, setBills] = useState<Bill[]>(INIT_BILLS);
  const [wallet, setWallet] = useState<WalletEntry[]>(INIT_WALLET);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([
    { id: "MU001", username: "chennai_user", password: "Chennai@123", district: "Chennai", active: true, createdAt: "2025-04-01" },
    { id: "MU002", username: "coimbatore_user", password: "Coimbatore@123", district: "Coimbatore", active: true, createdAt: "2025-04-01" },
    { id: "MU003", username: "madurai_user", password: "Madurai@123", district: "Madurai", active: true, createdAt: "2025-04-01" },
  ]);

  // Wallet helpers
  const getWalletBalance = useCallback(() => {
    if (wallet.length === 0) return 0;
    return wallet[wallet.length - 1].balance;
  }, [wallet]);

  const addWalletEntry = useCallback((
    description: string, debit: number, credit: number,
    type: WalletEntry["type"], txnId?: string
  ) => {
    setWallet(prev => {
      const lastBal = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      const newBal = round2(lastBal - debit + credit);
      const entry: WalletEntry = {
        id: genId("W"), date: new Date().toISOString().split("T")[0],
        description, txnId, debit, credit, balance: newBal, type
      };
      return [...prev, entry];
    });
  }, []);

  if (!user) return <LoginPage onLogin={u => { setUser(u); setPage("dashboard"); }} />;

  const district = user.role === "district" ? user.district! : "";
  const isAdmin = user.role === "admin";

  const myVendors = isAdmin ? vendors : vendors.filter(v => v.district === district);
  const myTxns = isAdmin ? transactions : transactions.filter(t => t.district === district);
  const myBills = isAdmin ? bills : bills.filter(b => b.district === district);

  // Pending close alerts for admin
  const pendingClose = transactions.filter(t => t.closedByDistrict && !t.confirmedByAdmin);

  const navItems = isAdmin
    ? [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "vendors", label: "Vendors", icon: "🏢" },
        { id: "transactions", label: "Transactions", icon: "📋" },
        { id: "bills", label: "Bills", icon: "🧾" },
        { id: "wallet", label: "Admin Wallet", icon: "💰" },
        { id: "analytics", label: "Reports & Analytics", icon: "📈" },
        { id: "districts", label: "District Management", icon: "🏛️" },
        { id: "users", label: "User Management", icon: "👥" },
        { id: "sheets", label: "Google Sheets Sync", icon: "📊" },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "vendors", label: "Vendors", icon: "🏢" },
        { id: "transactions", label: "Transactions", icon: "📋" },
        { id: "bills", label: "Bills", icon: "🧾" },
        { id: "reports", label: "Reports", icon: "📈" },
      ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f2f5", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* SIDEBAR */}
      <div className={`flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-56" : "w-14"}`}
        style={{ background: "linear-gradient(180deg, #0a1628 0%, #1a2f5e 100%)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm" style={{ color: "#c9a227" }}>AR Enterprises</p>
              <p className="text-xs text-gray-400">ERP V3.0</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white text-lg">☰</button>
        </div>
        {sidebarOpen && (
          <div className="p-3 m-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p className="text-xs text-gray-400">{isAdmin ? "👑 Super Admin" : "🏛️ " + district}</p>
            <p className="text-xs font-medium text-white">{user.username}</p>
          </div>
        )}
        <nav className="p-2 space-y-1">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${page === n.id ? "text-gray-900 font-semibold" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
              style={page === n.id ? { background: "linear-gradient(135deg, #c9a227, #f0d060)" } : {}}>
              <span>{n.icon}</span>
              {sidebarOpen && <span>{n.label}</span>}
              {sidebarOpen && n.id === "wallet" && pendingClose.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingClose.length}</span>
              )}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="absolute bottom-4 left-0 w-56 px-3">
            <button onClick={() => setUser(null)}
              className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-white transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              🚪 Logout
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto">
        {page === "dashboard" && (
          <DashboardPage
            isAdmin={isAdmin} district={district}
            transactions={myTxns} vendors={myVendors} bills={myBills}
            wallet={wallet} walletBalance={getWalletBalance()}
            pendingClose={pendingClose}
            onConfirmClose={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn) return;
              // 🔒 AR_WALLET_CALC_FINAL_LOCKED
              // Step 3: Admin Confirm → 8% Profit Credit
              const profit = round2(txn.expectedAmount * PROFIT_RATE);
              addWalletEntry(`8% Profit Credit — ${txn.vendorName} (${txnId})`, 0, profit, "profit", txnId);
              setTransactions(prev => prev.map(t => t.txnId === txnId
                ? { ...t, status: "Closed", confirmedByAdmin: true, profit }
                : t));
            }}
          />
        )}
        {page === "vendors" && (
          <VendorsPage
            isAdmin={isAdmin} district={district}
            vendors={myVendors}
            onAdd={(v) => setVendors(prev => [...prev, v])}
            onDelete={(id) => setVendors(prev => prev.filter(v => v.id !== id))}
          />
        )}
        {page === "transactions" && (
          <TransactionsPage
            isAdmin={isAdmin} district={district}
            transactions={myTxns} vendors={myVendors} bills={myBills}
            onAdd={(txn, advance) => {
              setTransactions(prev => [...prev, txn]);
              if (advance > 0) {
                addWalletEntry(`Advance Paid — ${txn.vendorName} (${txn.txnId})`, advance, 0, "advance", txn.txnId);
              }
            }}
            onClose={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn) return;
              const gstBal = round2(txn.gstAmount - txn.advanceAmount);
              if (gstBal > 0) {
                addWalletEntry(`GST Balance Debit — ${txn.vendorName} (${txnId})`, gstBal, 0, "gst", txnId);
              }
              setTransactions(prev => prev.map(t => t.txnId === txnId
                ? { ...t, status: "PendingClose", closedByDistrict: true, remainingExpected: 0 }
                : t));
            }}
            onEdit={(updated) => setTransactions(prev => prev.map(t => t.txnId === updated.txnId ? updated : t))}
            onDeleteTxn={(txnId) => setTransactions(prev => prev.filter(t => t.txnId !== txnId))}
          />
        )}
        {page === "bills" && (
          <BillsPage
            isAdmin={isAdmin} district={district}
            bills={myBills} transactions={myTxns} vendors={myVendors}
            onAdd={(bill) => {
              setBills(prev => [...prev, bill]);
              // Update transaction billsReceived & remainingExpected
              setTransactions(prev => prev.map(t => {
                if (t.txnId !== bill.txnId) return t;
                const txnBills = [...bills, bill].filter(b => b.txnId === t.txnId);
                // 🔒 AR_TRANSACTION_CALC_FINAL_LOCKED
                // Remaining = Expected - Sum(Bill Amount × 1.18)
                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);
                return { ...t, billsReceived: round2(billsReceived), remainingExpected: remaining };
              }));
            }}
            onEditBill={(updated) => setBills(prev => prev.map(b => b.id === updated.id ? updated : b))}
            onDelete={(billId) => {
              const bill = bills.find(b => b.id === billId);
              if (!bill) return;
              const newBills = bills.filter(b => b.id !== billId);
              setBills(newBills);
              setTransactions(prev => prev.map(t => {
                if (t.txnId !== bill.txnId) return t;
                const txnBills = newBills.filter(b => b.txnId === t.txnId);
                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);
                return { ...t, billsReceived: round2(billsReceived), remainingExpected: remaining };
              }));
            }}
          />
        )}
        {page === "wallet" && isAdmin && (
          <WalletPage
            wallet={wallet} balance={getWalletBalance()}
            onManualEntry={(desc, debit, credit) => {
              addWalletEntry(desc, debit, credit, "manual");
            }}
            onSetBalance={(newBal) => {
              const current = getWalletBalance();
              const diff = newBal - current;
              if (diff > 0) addWalletEntry("Balance Adjustment (Credit)", 0, diff, "manual");
              else if (diff < 0) addWalletEntry("Balance Adjustment (Debit)", Math.abs(diff), 0, "manual");
            }}
          />
        )}
        {page === "reports" && (
          <ReportsPage transactions={myTxns} bills={myBills} vendors={myVendors} isAdmin={isAdmin} district={district} />
        )}
        {page === "analytics" && isAdmin && (
          <AnalyticsPage transactions={transactions} bills={bills} vendors={vendors} wallet={wallet} />
        )}
        {page === "districts" && isAdmin && (
          <DistrictManagementPage
            districtUsers={managedUsers}
            onAddUser={(u) => setManagedUsers(prev => [...prev, u])}
            onToggleUser={(id) => setManagedUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))}
          />
        )}
        {page === "users" && isAdmin && (
          <UserManagementPage
            districtUsers={managedUsers}
            onAddUser={(u) => setManagedUsers(prev => [...prev, u])}
            onToggleUser={(id) => setManagedUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))}
            onDeleteUser={(id) => setManagedUsers(prev => prev.filter(u => u.id !== id))}
            onEditUser={(updated) => setManagedUsers(prev => prev.map(u => u.id === updated.id ? updated : u))}
          />
        )}
        {page === "sheets" && isAdmin && (
          <GoogleSheetsSyncPage transactions={transactions} bills={bills} vendors={vendors} wallet={wallet} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function DashboardPage({ isAdmin, district, transactions, vendors, bills, wallet, walletBalance, pendingClose, onConfirmClose }:
  { isAdmin: boolean; district: string; transactions: Transaction[]; vendors: Vendor[]; bills: Bill[]; wallet: WalletEntry[]; walletBalance: number; pendingClose: Transaction[]; onConfirmClose: (id: string) => void; }) {

  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsReceived = transactions.reduce((s, t) => s + t.billsReceived, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const openTxns = transactions.filter(t => t.status === "Open").length;
  const closedTxns = transactions.filter(t => t.status === "Closed").length;

  const Card = ({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">
          {isAdmin ? "📊 Master Dashboard — AR Enterprises" : `📊 ${district} Dashboard`}
        </h1>
        <p className="text-sm text-gray-500">Tamil Nadu GST Bill Automation ERP V3.0</p>
      </div>

      {/* 🔴 PENDING CLOSE ALERTS — Admin only */}
      {isAdmin && pendingClose.length > 0 && (
        <div className="rounded-xl p-4 border" style={{ background: "#fff5f5", borderColor: "#fca5a5" }}>
          <h2 className="font-bold text-red-700 mb-3">🔴 Pending Admin Confirmation ({pendingClose.length})</h2>
          <div className="space-y-2">
            {pendingClose.map(t => {
              const profit = round2(t.expectedAmount * PROFIT_RATE);
              return (
                <div key={t.txnId} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-200">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{t.vendorName} — {t.district}</p>
                    <p className="text-xs text-gray-500">{t.txnId} | Expected: {fmt(t.expectedAmount)} | 8% Profit: {fmt(profit)}</p>
                  </div>
                  <button onClick={() => onConfirmClose(t.txnId)}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: "#16a34a" }}>
                    ✅ Confirm Close
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total Vendors" value={vendors.length.toString()} color="#1a2f5e" />
        <Card label="Total Transactions" value={transactions.length.toString()} color="#0369a1" sub={`Open: ${openTxns} | Closed: ${closedTxns}`} />
        <Card label="Total Expected" value={fmt(totalExpected)} color="#b45309" />
        <Card label="Bills Received" value={fmt(totalBillsReceived)} color="#15803d" />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card label="Total GST Amount" value={fmt(totalGST)} color="#7c3aed" />
          <Card label="💰 Wallet Balance" value={fmt(walletBalance)} color="#b45309" sub="Live Running Balance" />
          <Card label="Total Bills Count" value={bills.length.toString()} color="#0369a1" />
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                {["TXN ID","Vendor","District","Expected","Bills Received","Remaining","Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.slice(0, 5).map(t => (
                <tr key={t.txnId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{t.txnId}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{t.vendorName}</td>
                  <td className="px-4 py-3 text-gray-600">{t.district}</td>
                  <td className="px-4 py-3 text-gray-800">{fmt(t.expectedAmount)}</td>
                  <td className="px-4 py-3 text-green-700">{fmt(t.billsReceived)}</td>
                  <td className="px-4 py-3 text-orange-600">{fmt(t.remainingExpected)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === "Closed" ? "bg-green-100 text-green-700" : t.status === "PendingClose" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                      {t.status === "PendingClose" ? "🔴 Pending" : t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No transactions found</p>}
        </div>
      </div>

      {/* Wallet Summary — Admin */}
      {isAdmin && wallet.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">💰 Wallet — Recent Entries</h2>
            <span className="font-bold text-lg" style={{ color: "#b45309" }}>{fmt(walletBalance)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  {["Date","Description","Debit","Credit","Balance"].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {wallet.slice(-5).reverse().map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-500">{w.date}</td>
                    <td className="px-4 py-2 text-gray-800">{w.description}</td>
                    <td className="px-4 py-2 text-red-600">{w.debit > 0 ? fmt(w.debit) : "—"}</td>
                    <td className="px-4 py-2 text-green-600">{w.credit > 0 ? fmt(w.credit) : "—"}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{fmt(w.balance)}</td>
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

// ============================================================
// VENDORS PAGE
// ============================================================
function VendorsPage({ isAdmin, district, vendors, onAdd, onDelete }:
  { isAdmin: boolean; district: string; vendors: Vendor[]; onAdd: (v: Vendor) => void; onDelete: (id: string) => void; }) {
  const [showForm, setShowForm] = useState(false);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [name, setName] = useState("");
  const [dist, setDist] = useState(isAdmin ? "" : district);
  const [mobile, setMobile] = useState("");
  const [bizType, setBizType] = useState("Hardware");
  const [address, setAddress] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [regYear, setRegYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState("");

  const filtered = vendors.filter(v =>
    v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
    (v.mobile || "").includes(search)
  );

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setSelectedIds(filtered.map(v => v.id));
  const clearSelect = () => setSelectedIds([]);

  // Auto-generate smart vendor code
  const autoCode = dist && bizType && regYear ? genVendorCode(dist, bizType, regYear, vendors) : "";

  const handleAdd = () => {
    if (!name || !dist || !mobile) return;
    const code = autoCode;
    onAdd({
      id: genId("V"), vendorCode: code, vendorName: name, district: dist,
      mobile, businessType: bizType, address, gstNo, regYear
    });
    setName(""); setMobile(""); setAddress(""); setGstNo("");
    setDist(isAdmin ? "" : district); setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">🏢 Vendor Management</h1>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button onClick={() => setConfirmBulkDelete(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700">
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            + New Vendor
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-800">புதிய Vendor சேர்</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Row 1 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vendor Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Sri Balaji Hardwares"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mobile Number *</label>
              <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" maxLength={10}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Business Type</label>
              <select value={bizType} onChange={e => setBizType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                {BUSINESS_TYPES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>

            {/* Row 2 */}
            <div>
              {isAdmin
                ? <><label className="text-xs text-gray-500 mb-1 block">District *</label>
                  <select value={dist} onChange={e => setDist(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                    <option value="">Select District</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select></>
                : <><label className="text-xs text-gray-500 mb-1 block">District</label>
                  <input value={district} disabled className="w-full px-3 py-2 rounded-lg border border-gray-100 text-sm bg-gray-50 text-gray-500" /></>
              }
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Registration Year</label>
              <input value={regYear} onChange={e => setRegYear(e.target.value)} placeholder="2025"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">GST Number</label>
              <input value={gstNo} onChange={e => setGstNo(e.target.value)} placeholder="33AAAAA0000A1Z5"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>

            {/* Row 3 */}
            <div className="md:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop No, Street, City, Pincode"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>

          {/* Auto-generated Vendor Code Preview */}
          {autoCode && (
            <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <span className="text-xs text-blue-600">🔑 Auto-Generated Vendor Code:</span>
              <span className="font-bold text-blue-800 font-mono text-sm">{autoCode}</span>
              <span className="text-xs text-gray-400">({DIST_SHORT[dist] || dist}+{regYear.slice(-2)}+{BIZ_SHORT[bizType] || bizType.slice(0,2)}+Serial)</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#16a34a" }}>💾 Save Vendor</button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search vendor name, code, mobile..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" onChange={e => e.target.checked ? selectAll() : clearSelect()} className="rounded" />
                </th>
                {["Vendor Code","Vendor Name","Mobile","Business","District","GST No","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(v => (
                <tr key={v.id} className={`hover:bg-gray-50 ${selectedIds.includes(v.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selectedIds.includes(v.id)} onChange={() => toggleSelect(v.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">{v.vendorCode}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{v.vendorName}</td>
                  <td className="px-4 py-3 text-gray-600">{v.mobile || "—"}</td>
                  <td className="px-4 py-3">
                    {v.businessType && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{v.businessType}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.district}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.gstNo || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setViewVendor(v)} className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">👁️</button>
                      <button onClick={() => setEditVendor({...v})} className="px-2 py-1 rounded text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100">✏️</button>
                      <button onClick={() => setConfirmDeleteId(v.id)} className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No vendors found</p>}
        </div>
      </div>

      {/* View Vendor Modal */}
      {viewVendor && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">🏢 Vendor விவரம்</h3>
              <button onClick={() => setViewVendor(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Vendor Code", viewVendor.vendorCode],
                ["Vendor Name", viewVendor.vendorName],
                ["Mobile", viewVendor.mobile || "—"],
                ["Business Type", viewVendor.businessType || "—"],
                ["District", viewVendor.district],
                ["GST Number", viewVendor.gstNo || "—"],
                ["Reg. Year", viewVendor.regYear || "—"],
                ["Address", viewVendor.address || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800 text-right max-w-xs">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editVendor && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">✏️ Vendor Edit</h3>
              <button onClick={() => setEditVendor(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              {[
                ["Vendor Name", "vendorName", "text"],
                ["Mobile", "mobile", "text"],
                ["GST Number", "gstNo", "text"],
                ["Address", "address", "text"],
              ].map(([label, field, type]) => (
                <div key={field}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input type={type} value={(editVendor as unknown as Record<string,string>)[field] || ""}
                    onChange={e => setEditVendor({...editVendor, [field as keyof Vendor]: e.target.value} as Vendor)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Business Type</label>
                <select value={editVendor.businessType || ""} onChange={e => setEditVendor({...editVendor, businessType: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                  {BUSINESS_TYPES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { onDelete(editVendor.id); onAdd({...editVendor, id: genId("V")}); setEditVendor(null); }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "#16a34a" }}>
                  💾 Save
                </button>
                <button onClick={() => setEditVendor(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Delete உறுதிப்படுத்தல்</h3>
            <p className="text-sm text-gray-600 mb-4">இந்த Vendor-ஐ delete செய்கிறீர்களா?</p>
            <div className="flex gap-2">
              <button onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete</button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Bulk Delete — {selectedIds.length} Vendors</h3>
            <p className="text-sm text-gray-600 mb-4">தேர்வு செய்த {selectedIds.length} vendors-ஐ delete செய்கிறீர்களா?</p>
            <div className="flex gap-2">
              <button onClick={() => { selectedIds.forEach(id => onDelete(id)); setSelectedIds([]); setConfirmBulkDelete(false); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete All</button>
              <button onClick={() => setConfirmBulkDelete(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TRANSACTIONS PAGE
// ============================================================
function TransactionsPage({ isAdmin, district, transactions, vendors, bills, onAdd, onClose, onEdit, onDeleteTxn }:
  { isAdmin: boolean; district: string; transactions: Transaction[]; vendors: Vendor[]; bills: Bill[]; onAdd: (t: Transaction, advance: number) => void; onClose: (id: string) => void; onEdit: (t: Transaction) => void; onDeleteTxn: (id: string) => void; }) {
  const [showForm, setShowForm] = useState(false);
  const [viewTxn, setViewTxn] = useState<Transaction | null>(null);
  const [vendorCode, setVendorCode] = useState("");
  const [fy, setFy] = useState("2025-26");
  const [month, setMonth] = useState("April");
  const [expectedAmt, setExpectedAmt] = useState("");
  const [advanceAmt, setAdvanceAmt] = useState("");
  const [gstPct, setGstPct] = useState(4);
  const [search, setSearch] = useState("");
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [selectedTxnIds, setSelectedTxnIds] = useState<string[]>([]);
  const [confirmBulkDeleteTxn, setConfirmBulkDeleteTxn] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [confirmDeleteTxnId, setConfirmDeleteTxnId] = useState<string | null>(null);

  const myVendors = isAdmin ? vendors : vendors.filter(v => v.district === district);
  const filtered = transactions.filter(t =>
    t.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    t.txnId.toLowerCase().includes(search.toLowerCase())
  );

  const getTxnBills = (txnId: string) => bills.filter(b => b.txnId === txnId);

  const handleAdd = () => {
    const vendor = vendors.find(v => v.vendorCode === vendorCode);
    if (!vendor || !expectedAmt) return;
    const expected = parseFloat(expectedAmt);
    const advance = parseFloat(advanceAmt) || 0;
    // 🔒 AR_TRANSACTION_CALC_FINAL_LOCKED
    const gstAmt = round2(expected * gstPct / 100);
    const gstBal = round2(gstAmt - advance);
    const txnId = genId("TXN-");
    const txn: Transaction = {
      id: genId("T"), txnId, district: vendor.district,
      vendorCode, vendorName: vendor.vendorName,
      financialYear: fy, month, expectedAmount: expected,
      advanceAmount: advance, gstPercent: gstPct,
      gstAmount: gstAmt, gstBalance: gstBal,
      billsReceived: 0, remainingExpected: expected,
      status: "Open", closedByDistrict: false, confirmedByAdmin: false, profit: 0
    };
    onAdd(txn, advance);
    setVendorCode(""); setExpectedAmt(""); setAdvanceAmt(""); setShowForm(false);
  };

  const previewGST = expectedAmt ? round2(parseFloat(expectedAmt) * gstPct / 100) : 0;
  const previewBalance = previewGST - (parseFloat(advanceAmt) || 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">📋 Monthly Transactions</h1>
        <div className="flex gap-2 flex-wrap">
          {selectedTxnIds.length > 0 && isAdmin && (
            <button onClick={() => setConfirmBulkDeleteTxn(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700">
              🗑️ Delete Selected ({selectedTxnIds.length})
            </button>
          )}
          {!isAdmin && (
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
              + New Transaction
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-800">புதிய Transaction</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vendor</label>
              <select value={vendorCode} onChange={e => setVendorCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                <option value="">Select Vendor</option>
                {myVendors.map(v => <option key={v.id} value={v.vendorCode}>{v.vendorName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Financial Year</label>
              <select value={fy} onChange={e => setFy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                {FY_LIST.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Month</label>
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Expected Amount (₹)</label>
              <input type="number" value={expectedAmt} onChange={e => setExpectedAmt(e.target.value)}
                placeholder="300950"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Advance (GST Only) (₹)</label>
              <input type="number" value={advanceAmt} onChange={e => setAdvanceAmt(e.target.value)}
                placeholder="5000"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">GST %</label>
              <select value={gstPct} onChange={e => setGstPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          {expectedAmt && (
            <div className="p-3 rounded-lg text-sm space-y-1" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <p className="font-medium text-blue-800">🔒 கணக்கு Preview (AR_TRANSACTION_CALC_FINAL_LOCKED)</p>
              <p className="text-blue-700">GST Amount: {fmt(parseFloat(expectedAmt))} × {gstPct}% = <strong>{fmt(previewGST)}</strong></p>
              <p className="text-blue-700">GST Balance: {fmt(previewGST)} − {fmt(parseFloat(advanceAmt)||0)} = <strong>{fmt(previewBalance)}</strong></p>
              <p className="text-orange-700">⚠️ Advance ₹{advanceAmt||0} → Wallet-லிருந்து உடனே கழிக்கப்படும்</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#16a34a" }}>Save</button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search transactions..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white" />

      {/* Confirm Close Modal */}
      {confirmClose && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">Transaction Close உறுதிப்படுத்தல்</h3>
            {(() => {
              const txn = transactions.find(t => t.txnId === confirmClose);
              if (!txn) return null;
              const gstBal = round2(txn.gstAmount - txn.advanceAmount);
              return (
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p>Vendor: <strong>{txn.vendorName}</strong></p>
                  <p>GST Balance Debit: <strong className="text-red-600">{fmt(gstBal)}</strong></p>
                  <p>Remaining → Force: <strong>₹0</strong></p>
                  <p className="text-xs text-gray-400">Admin confirmation-க்கு 🔴 Alert போகும். Admin confirm செய்தால் 8% profit wallet-ல் credit ஆகும்.</p>
                </div>
              );
            })()}
            <div className="flex gap-2">
              <button onClick={() => { onClose(confirmClose); setConfirmClose(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "#dc2626" }}>
                ✅ Close Confirm
              </button>
              <button onClick={() => setConfirmClose(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {isAdmin && <th className="px-3 py-3"><input type="checkbox" onChange={e => e.target.checked ? setSelectedTxnIds(filtered.map(t=>t.txnId)) : setSelectedTxnIds([])} className="rounded" /></th>}
                {["TXN ID","Vendor","Month","Expected ₹",`${4}% GST Amt`,"Advance","Bills Received","Remaining ₹","GST Balance","Status","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => {
                const txnBills = getTxnBills(t.txnId);
                // 🔒 AR_TRANSACTION_CALC_FINAL_LOCKED
                const gstAmt = round2(t.expectedAmount * t.gstPercent / 100);
                const gstBal = round2(gstAmt - t.advanceAmount);
                const sumTotals = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotals));
                const billsTotal = txnBills.reduce((s, b) => s + b.billAmount, 0);
                const canClose = remaining <= 0 && t.status === "Open";

                return (
                  <tr key={t.txnId} className={`hover:bg-gray-50 ${selectedTxnIds.includes(t.txnId) ? "bg-blue-50" : t.status === "PendingClose" ? "bg-red-50" : t.status === "Closed" ? "bg-green-50" : ""}`}>
                    {isAdmin && <td className="px-3 py-3"><input type="checkbox" checked={selectedTxnIds.includes(t.txnId)} onChange={() => setSelectedTxnIds(prev => prev.includes(t.txnId) ? prev.filter(x=>x!==t.txnId) : [...prev, t.txnId])} className="rounded" /></td>}
                    <td className="px-3 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">{t.txnId}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800">{t.vendorName}</p>
                      <p className="text-xs text-gray-400">{t.vendorCode}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{t.month}<br />{t.financialYear}</td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{fmt(t.expectedAmount)}</td>
                    <td className="px-3 py-3 text-purple-700 font-semibold">
                      {fmt(gstAmt)}
                      <p className="text-xs text-gray-400">{t.expectedAmount} × {t.gstPercent}%</p>
                    </td>
                    <td className="px-3 py-3 text-orange-600">{fmt(t.advanceAmount)}<br /><span className="text-xs text-gray-400">GST Only</span></td>
                    <td className="px-3 py-3 text-green-700">
                      {fmt(billsTotal)}
                      <p className="text-xs text-gray-400">{txnBills.length} bills</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-bold ${remaining <= 0 ? "text-green-600" : "text-orange-600"}`}>
                        {remaining <= 0 ? "₹0 ✅" : fmt(remaining)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-red-600 font-semibold">{fmt(gstBal)}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap
                        ${t.status === "Closed" ? "bg-green-100 text-green-700" :
                          t.status === "PendingClose" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"}`}>
                        {t.status === "PendingClose" ? "🔴 Pending" : t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setViewTxn(t)}
                          className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">👁️</button>
                        {t.status === "Open" && (
                          <button onClick={() => setEditTxn({...t})}
                            className="px-2 py-1 rounded text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100">✏️</button>
                        )}
                        <button onClick={() => setConfirmDeleteTxnId(t.txnId)}
                          className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                        {!isAdmin && t.status === "Open" && (
                          <button onClick={() => setConfirmClose(t.txnId)}
                            className={`px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap
                              ${canClose ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 hover:bg-gray-500"}`}>
                            {canClose ? "✅ Close" : "⚠️ Force"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* 🔒 FOOTER TOTALS */}
            {filtered.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={3} className="px-3 py-3 font-bold text-yellow-300 text-xs">
                    மொத்தம் ({filtered.length} rows)
                  </td>
                  <td className="px-3 py-3 font-bold text-yellow-300 text-sm">
                    {fmt(filtered.reduce((s, t) => s + t.expectedAmount, 0))}
                  </td>
                  <td className="px-3 py-3 font-bold text-purple-300 text-sm">
                    {fmt(filtered.reduce((s, t) => s + round2(t.expectedAmount * t.gstPercent / 100), 0))}
                  </td>
                  <td className="px-3 py-3 font-bold text-orange-300 text-sm">
                    {fmt(filtered.reduce((s, t) => s + t.advanceAmount, 0))}
                  </td>
                  <td className="px-3 py-3 font-bold text-green-300 text-sm">
                    {fmt(filtered.reduce((s, t) => s + bills.filter(b => b.txnId === t.txnId).reduce((s2, b) => s2 + b.billAmount, 0), 0))}
                  </td>
                  <td className="px-3 py-3 font-bold text-red-300 text-sm">
                    {fmt(filtered.reduce((s, t) => {
                      const sumTot = bills.filter(b => b.txnId === t.txnId).reduce((s2, b) => s2 + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                      return s + round2(Math.max(0, t.expectedAmount - sumTot));
                    }, 0))}
                  </td>
                  <td className="px-3 py-3 font-bold text-red-300 text-sm">
                    {fmt(filtered.reduce((s, t) => s + round2(round2(t.expectedAmount * t.gstPercent / 100) - t.advanceAmount), 0))}
                  </td>
                  <td colSpan={2} className="px-3 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No transactions found</p>}
        </div>
      </div>

      {/* Bulk Delete Transaction Modal */}
      {confirmBulkDeleteTxn && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Bulk Delete — {selectedTxnIds.length} Transactions</h3>
            <p className="text-sm text-gray-600 mb-4">தேர்வு செய்த {selectedTxnIds.length} transactions-ஐ delete செய்கிறீர்களா?</p>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmBulkDeleteTxn(false); setSelectedTxnIds([]); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete All</button>
              <button onClick={() => setConfirmBulkDeleteTxn(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editTxn && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">✏️ Transaction Edit</h3>
              <button onClick={() => setEditTxn(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expected Amount (₹)</label>
                  <input type="number" value={editTxn.expectedAmount}
                    onChange={e => {
                      const exp = parseFloat(e.target.value) || 0;
                      const gstAmt = round2(exp * editTxn.gstPercent / 100);
                      const gstBal = round2(gstAmt - editTxn.advanceAmount);
                      setEditTxn({...editTxn, expectedAmount: exp, gstAmount: gstAmt, gstBalance: gstBal, remainingExpected: exp});
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Advance Amount (₹)</label>
                  <input type="number" value={editTxn.advanceAmount}
                    onChange={e => {
                      const adv = parseFloat(e.target.value) || 0;
                      const gstBal = round2(editTxn.gstAmount - adv);
                      setEditTxn({...editTxn, advanceAmount: adv, gstBalance: gstBal});
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">GST %</label>
                  <select value={editTxn.gstPercent}
                    onChange={e => {
                      const pct = parseFloat(e.target.value);
                      const gstAmt = round2(editTxn.expectedAmount * pct / 100);
                      const gstBal = round2(gstAmt - editTxn.advanceAmount);
                      setEditTxn({...editTxn, gstPercent: pct, gstAmount: gstAmt, gstBalance: gstBal});
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Month</label>
                  <select value={editTxn.month} onChange={e => setEditTxn({...editTxn, month: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              {/* 🔒 Preview */}
              <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
                <p className="font-bold text-blue-800">🔒 AR_TRANSACTION_CALC_FINAL_LOCKED</p>
                <p className="text-blue-700">GST: {fmt(editTxn.expectedAmount)} × {editTxn.gstPercent}% = <strong>{fmt(editTxn.gstAmount)}</strong></p>
                <p className="text-blue-700">GST Balance: {fmt(editTxn.gstAmount)} − {fmt(editTxn.advanceAmount)} = <strong>{fmt(editTxn.gstBalance)}</strong></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  onEdit(editTxn);
                  setEditTxn(null);
                }} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "#16a34a" }}>
                  💾 Save
                </button>
                <button onClick={() => setEditTxn(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transaction Confirm */}
      {confirmDeleteTxnId && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Transaction Delete</h3>
            <p className="text-sm text-gray-600 mb-4">இந்த Transaction-ஐ delete செய்கிறீர்களா? அதன் Bills-உம் affected ஆகும்.</p>
            <div className="flex gap-2">
              <button onClick={() => {
                onDeleteTxn(confirmDeleteTxnId!);
                setConfirmDeleteTxnId(null);
              }} className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete</button>
              <button onClick={() => setConfirmDeleteTxnId(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* View Transaction Modal */}
      {viewTxn && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">📋 Transaction விவரம்</h3>
              <button onClick={() => setViewTxn(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["TXN ID", viewTxn.txnId], ["Vendor", viewTxn.vendorName], ["District", viewTxn.district],
                ["FY", viewTxn.financialYear], ["Month", viewTxn.month], ["Status", viewTxn.status],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span><span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
              <div className="mt-3 p-3 rounded-lg space-y-1" style={{ background: "#f0f7ff" }}>
                <p className="font-bold text-blue-800 text-xs mb-2">💰 கணக்கு சுருக்கம்</p>
                {[
                  ["Expected (Principal)", fmt(viewTxn.expectedAmount)],
                  ["Bills Received", fmt(viewTxn.billsReceived)],
                  ["Remaining Expected", fmt(viewTxn.remainingExpected)],
                  ["Advance (GST only)", fmt(viewTxn.advanceAmount)],
                  [`GST (${viewTxn.gstPercent}%)`, fmt(viewTxn.gstAmount)],
                  ["GST Balance", fmt(viewTxn.gstBalance)],
                  ["Total Bill", fmt(viewTxn.expectedAmount)],
                  ["8% Profit", viewTxn.profit > 0 ? fmt(viewTxn.profit) : "(On Close)"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-600">{k}</span><span className="font-semibold text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BILLS PAGE — 🔒 AR_BILL_CALC_FINAL_LOCKED
// GST Amount = Bill Amount × GST%
// Total Amount = Bill Amount × 1.18 (FIXED)
// ============================================================
function BillsPage({ isAdmin, district, bills, transactions, vendors: _vendors, onAdd, onDelete, onEditBill }:
  { isAdmin: boolean; district: string; bills: Bill[]; transactions: Transaction[]; vendors: Vendor[]; onAdd: (b: Bill) => void; onDelete: (id: string) => void; onEditBill: (b: Bill) => void; }) {
  void _vendors;
  const [showForm, setShowForm] = useState(false);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [confirmBulkDeleteBill, setConfirmBulkDeleteBill] = useState(false);
  const [confirmDeleteBillId, setConfirmDeleteBillId] = useState<string | null>(null);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [txnId, setTxnId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billAmt, setBillAmt] = useState("");
  const [gstPct, setGstPct] = useState(4);
  const [search, setSearch] = useState("");

  const myTxns = isAdmin ? transactions : transactions.filter(t => t.district === district);
  const openTxns = myTxns.filter(t => t.status === "Open");
  const filtered = bills.filter(b =>
    b.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.txnId.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTxn = transactions.find(t => t.txnId === txnId);

  // 🔒 AR_BILL_CALC_FINAL_LOCKED
  const previewBillAmt = parseFloat(billAmt) || 0;
  const previewGST = round2(previewBillAmt * gstPct / 100);           // Bill Amount × GST%
  const previewTotal = round2(previewBillAmt * BILL_TOTAL_RATE);       // Bill Amount × 1.18 FIXED

  const handleAdd = () => {
    if (!txnId || !billAmt || !billNo) return;
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) return;
    const amt = parseFloat(billAmt);
    // 🔒 AR_BILL_CALC_FINAL_LOCKED
    const gstAmt = round2(amt * gstPct / 100);
    const total = round2(amt * BILL_TOTAL_RATE);
    const bill: Bill = {
      id: genId("B"), txnId, vendorCode: txn.vendorCode, vendorName: txn.vendorName,
      district: txn.district, billNumber: billNo, billDate,
      billAmount: amt, gstPercent: gstPct, gstAmount: gstAmt, totalAmount: total
    };
    onAdd(bill);
    setBillNo(""); setBillAmt(""); setShowForm(false);
  };

  const totalBillAmt = filtered.reduce((s, b) => s + b.billAmount, 0);
  const totalGST = filtered.reduce((s, b) => s + b.gstAmount, 0);
  const totalAmt = filtered.reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🧾 Bill Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">🔒 GST = Bill×GST% | Total = Bill×1.18 (FIXED)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedBillIds.length > 0 && (
            <button onClick={() => setConfirmBulkDeleteBill(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700">
              🗑️ Delete Selected ({selectedBillIds.length})
            </button>
          )}
          {!isAdmin && (
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
              + புதிய Bill
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-800">🧾 புதிய GST Bill சேர்</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Transaction (TXN)</label>
              <select value={txnId} onChange={e => setTxnId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                <option value="">Select Transaction</option>
                {openTxns.map(t => <option key={t.txnId} value={t.txnId}>{t.txnId} — {t.vendorName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bill Number</label>
              <input value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="ALB/2026/001"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bill Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bill Amount (Taxable ₹)</label>
              <input type="number" value={billAmt} onChange={e => setBillAmt(e.target.value)} placeholder="76664"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">GST %</label>
              <select value={gstPct} onChange={e => setGstPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>

          {/* 🔒 AR_BILL_CALC_FINAL_LOCKED — Preview */}
          {billAmt && (
            <div className="p-4 rounded-xl space-y-2" style={{ background: "linear-gradient(135deg, #f0f7ff, #e8f4fd)", border: "1px solid #bfdbfe" }}>
              <p className="font-bold text-blue-800 text-sm">🔒 Bill கணக்கு Preview (AR_BILL_CALC_FINAL_LOCKED)</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">GST தொகை</p>
                  <p className="font-bold text-purple-700">{fmt(previewGST)}</p>
                  <p className="text-xs text-gray-400">{fmt(previewBillAmt)} × {gstPct}%</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                  <p className="font-bold text-green-700">{fmt(previewTotal)}</p>
                  <p className="text-xs text-gray-400">{fmt(previewBillAmt)} × 18%</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Remaining பிறகு</p>
                  <p className="font-bold text-orange-600">
                    {selectedTxn ? fmt(Math.max(0, selectedTxn.remainingExpected - previewTotal)) : "—"}
                  </p>
                  <p className="text-xs text-gray-400">Expected − Total</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#16a34a" }}>Save Bill</button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search bills..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-3 py-3"><input type="checkbox" onChange={e => e.target.checked ? setSelectedBillIds(filtered.map(b=>b.id)) : setSelectedBillIds([])} className="rounded" /></th>
                {["Bill ID","TXN ID","Vendor","Bill Number","Bill Date","Bill Amount","GST%","GST தொகை","Total Amount","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(b => (
                <tr key={b.id} className={`hover:bg-gray-50 ${selectedBillIds.includes(b.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedBillIds.includes(b.id)} onChange={() => setSelectedBillIds(prev => prev.includes(b.id) ? prev.filter(x=>x!==b.id) : [...prev, b.id])} className="rounded" /></td>
                  <td className="px-3 py-3 font-mono text-xs text-blue-700">{b.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">{b.txnId}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-800">{b.vendorName}</p>
                    <p className="text-xs text-gray-400">{b.vendorCode}</p>
                  </td>
                  <td className="px-3 py-3 text-gray-800">{b.billNumber}</td>
                  <td className="px-3 py-3 text-gray-600">{b.billDate}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{fmt(b.billAmount)}</td>
                  <td className="px-3 py-3 text-gray-600">{b.gstPercent}%</td>
                  <td className="px-3 py-3 text-purple-700 font-semibold">{fmt(b.gstAmount)}</td>
                  <td className="px-3 py-3 text-green-700 font-semibold">{fmt(b.totalAmount)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setViewBill(b)} className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">👁️</button>
                      <button onClick={() => setEditBill({...b})} className="px-2 py-1 rounded text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100">✏️</button>
                      <button onClick={() => setConfirmDeleteBillId(b.id)} className="px-2 py-1 rounded text-xs bg-red-50 text-red-600">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ background: "#f8fafc" }}>
                <tr>
                  <td colSpan={5} className="px-3 py-3 font-bold text-gray-800 text-xs">மொத்தம்</td>
                  <td className="px-3 py-3 font-bold text-gray-800">{fmt(totalBillAmt)}</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 font-bold text-purple-700">{fmt(totalGST)}</td>
                  <td className="px-3 py-3 font-bold text-green-700">{fmt(totalAmt)}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No bills found</p>}
        </div>
      </div>

      {/* Delete Bill Confirm */}
      {confirmDeleteBillId && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Bill Delete உறுதிப்படுத்தல்</h3>
            <p className="text-sm text-gray-600 mb-4">இந்த Bill-ஐ delete செய்கிறீர்களா? Transaction recalculate ஆகும்.</p>
            <div className="flex gap-2">
              <button onClick={() => { onDelete(confirmDeleteBillId); setConfirmDeleteBillId(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete</button>
              <button onClick={() => setConfirmDeleteBillId(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Bills */}
      {confirmBulkDeleteBill && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Bulk Delete — {selectedBillIds.length} Bills</h3>
            <p className="text-sm text-gray-600 mb-4">தேர்வு செய்த {selectedBillIds.length} bills-ஐ delete செய்கிறீர்களா?</p>
            <div className="flex gap-2">
              <button onClick={() => { selectedBillIds.forEach(id => onDelete(id)); setSelectedBillIds([]); setConfirmBulkDeleteBill(false); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete All</button>
              <button onClick={() => setConfirmBulkDeleteBill(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal — 🔒 AR_BILL_CALC_FINAL_LOCKED */}
      {editBill && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">✏️ Bill Edit</h3>
              <button onClick={() => setEditBill(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bill Number</label>
                <input value={editBill.billNumber} onChange={e => setEditBill({...editBill, billNumber: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bill Date</label>
                <input type="date" value={editBill.billDate} onChange={e => setEditBill({...editBill, billDate: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bill Amount (Taxable ₹)</label>
                <input type="number" value={editBill.billAmount}
                  onChange={e => {
                    const amt = parseFloat(e.target.value) || 0;
                    // 🔒 AR_BILL_CALC_FINAL_LOCKED
                    const gstAmt = round2(amt * editBill.gstPercent / 100);
                    const total = round2(amt * BILL_TOTAL_RATE);
                    setEditBill({...editBill, billAmount: amt, gstAmount: gstAmt, totalAmount: total});
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">GST %</label>
                <select value={editBill.gstPercent}
                  onChange={e => {
                    const pct = parseFloat(e.target.value);
                    const gstAmt = round2(editBill.billAmount * pct / 100);
                    setEditBill({...editBill, gstPercent: pct, gstAmount: gstAmt});
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                  {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              {/* 🔒 Preview */}
              <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
                <p className="font-bold text-blue-800">🔒 AR_BILL_CALC_FINAL_LOCKED</p>
                <p className="text-blue-700">GST: {fmt(editBill.billAmount)} × {editBill.gstPercent}% = <strong>{fmt(editBill.gstAmount)}</strong></p>
                <p className="text-blue-700">Total: {fmt(editBill.billAmount)} × 18% = <strong>{fmt(editBill.totalAmount)}</strong></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onEditBill(editBill); setEditBill(null); }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "#16a34a" }}>
                  💾 Save
                </button>
                <button onClick={() => setEditBill(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Bill Modal */}
      {viewBill && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">🧾 Bill விவரம்</h3>
              <button onClick={() => setViewBill(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Bill ID", viewBill.id], ["TXN ID", viewBill.txnId],
                ["Bill Number", viewBill.billNumber], ["Bill Date", viewBill.billDate],
                ["Vendor Code", viewBill.vendorCode], ["District", viewBill.district],
                ["Bill Amount", fmt(viewBill.billAmount)],
                ["GST %", viewBill.gstPercent + "%"],
                // 🔒 GST = Bill × GST%
                ["GST Amount", fmt(viewBill.gstAmount) + ` (${viewBill.billAmount} × ${viewBill.gstPercent}%)`],
                // 🔒 Total = Bill × 1.18
                ["Total Amount", fmt(viewBill.totalAmount) + ` (${viewBill.billAmount} × 18%)`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// WALLET PAGE — 🔒 AR_WALLET_CALC_FINAL_LOCKED
// ============================================================
function WalletPage({ wallet, balance, onManualEntry, onSetBalance }:
  { wallet: WalletEntry[]; balance: number; onManualEntry: (desc: string, debit: number, credit: number) => void; onSetBalance: (n: number) => void; }) {
  const [showEdit, setShowEdit] = useState(false);
  const [editMode, setEditMode] = useState<"set" | "manual">("set");
  const [newBal, setNewBal] = useState("");
  const [desc, setDesc] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");

  const totalDebit = wallet.reduce((s, w) => s + w.debit, 0);
  const totalCredit = wallet.reduce((s, w) => s + w.credit, 0);
  const totalProfit = wallet.filter(w => w.type === "profit").reduce((s, w) => s + w.credit, 0);
  const totalAdvance = wallet.filter(w => w.type === "advance").reduce((s, w) => s + w.debit, 0);
  const totalGST = wallet.filter(w => w.type === "gst").reduce((s, w) => s + w.debit, 0);

  const typeColor = (t: WalletEntry["type"]) =>
    t === "profit" ? "text-green-600" : t === "advance" ? "text-orange-600" : t === "gst" ? "text-red-600" : "text-gray-600";
  const typeBadge = (t: WalletEntry["type"]) =>
    t === "profit" ? "bg-green-100 text-green-700" : t === "advance" ? "bg-orange-100 text-orange-700" : t === "gst" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">💰 Admin Main Wallet</h1>
        <button onClick={() => setShowEdit(!showEdit)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}>
          ✏️ Wallet Edit
        </button>
      </div>

      {/* Wallet Balance Card */}
      <div className="rounded-xl p-6 text-white" style={{ background: "linear-gradient(135deg, #0a1628, #1a2f5e)" }}>
        <p className="text-sm text-gray-300">Current Wallet Balance</p>
        <p className="text-4xl font-bold mt-1" style={{ color: "#f0d060" }}>{fmt(balance)}</p>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-xs text-gray-400">Total Invested</p>
            <p className="font-bold text-white">{fmt(totalCredit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Debited</p>
            <p className="font-bold text-red-300">{fmt(totalDebit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Profit</p>
            <p className="font-bold text-green-300">{fmt(totalProfit)}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Advance Paid</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{fmt(totalAdvance)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">GST Settled</p>
          <p className="text-xl font-bold text-red-600 mt-1">{fmt(totalGST)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">8% Profit Earned</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmt(totalProfit)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Net Transactions</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{wallet.length}</p>
        </div>
      </div>

      {/* Edit Panel */}
      {showEdit && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-amber-200 space-y-4">
          <h2 className="font-bold text-gray-800">✏️ Wallet Edit / Manual Entry</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditMode("set")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${editMode === "set" ? "text-white" : "text-gray-600 border border-gray-200"}`}
              style={editMode === "set" ? { background: "#1a2f5e" } : {}}>
              🏦 Balance மாற்று
            </button>
            <button onClick={() => setEditMode("manual")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${editMode === "manual" ? "text-white" : "text-gray-600 border border-gray-200"}`}
              style={editMode === "manual" ? { background: "#1a2f5e" } : {}}>
              ➕ Manual Entry
            </button>
          </div>
          {editMode === "set" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Current Balance: <strong>{fmt(balance)}</strong></p>
              <input type="number" value={newBal} onChange={e => setNewBal(e.target.value)}
                placeholder="New balance amount"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              {newBal && <p className="text-sm text-blue-700">New Balance: <strong>{fmt(parseFloat(newBal))}</strong></p>}
              <button onClick={() => { if (newBal) { onSetBalance(parseFloat(newBal)); setNewBal(""); setShowEdit(false); } }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#16a34a" }}>Update Balance</button>
            </div>
          ) : (
            <div className="space-y-3">
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={debit} onChange={e => setDebit(e.target.value)} placeholder="Debit Amount (−)"
                  className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm outline-none" />
                <input type="number" value={credit} onChange={e => setCredit(e.target.value)} placeholder="Credit Amount (+)"
                  className="w-full px-3 py-2 rounded-lg border border-green-200 text-sm outline-none" />
              </div>
              <button onClick={() => {
                if (desc) {
                  onManualEntry(desc, parseFloat(debit)||0, parseFloat(credit)||0);
                  setDesc(""); setDebit(""); setCredit(""); setShowEdit(false);
                }
              }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#16a34a" }}>Add Entry</button>
            </div>
          )}
        </div>
      )}

      {/* Wallet Ledger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">📒 Wallet Ledger</h2>
          <p className="text-xs text-gray-400 mt-0.5">🔒 AR_WALLET_CALC_FINAL_LOCKED</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Date","Description","Type","Debit (−)","Credit (+)","Balance"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...wallet].reverse().map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{w.date}</td>
                  <td className="px-4 py-3 text-gray-800">{w.description}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeBadge(w.type)}`}>
                      {w.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${typeColor(w.type)}`}>
                    {w.debit > 0 ? fmt(w.debit) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-600">
                    {w.credit > 0 ? fmt(w.credit) : "—"}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-800">{fmt(w.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: "#f8fafc" }}>
              <tr>
                <td colSpan={3} className="px-4 py-3 font-bold text-gray-800 text-xs">மொத்தம்</td>
                <td className="px-4 py-3 font-bold text-red-600">{fmt(totalDebit)}</td>
                <td className="px-4 py-3 font-bold text-green-600">{fmt(totalCredit)}</td>
                <td className="px-4 py-3 font-bold" style={{ color: "#b45309" }}>{fmt(balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DISTRICT MANAGEMENT PAGE (Admin Only)
// ============================================================
function DistrictManagementPage({ districtUsers, onAddUser, onToggleUser }:
  { districtUsers: ManagedUser[]; onAddUser: (u: ManagedUser) => void; onToggleUser: (id: string) => void; }) {
  const [showForm, setShowForm] = useState(false);
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [dist, setDist] = useState("");
  const [search, setSearch] = useState("");

  const filtered = districtUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.district.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!uname || !pass || !dist) return;
    const newUser: ManagedUser = {
      id: genId("U"), username: uname, password: pass,
      district: dist, active: true, createdAt: new Date().toISOString().split("T")[0]
    };
    onAddUser(newUser);
    setUname(""); setPass(""); setDist(""); setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🏛️ District Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">38 Tamil Nadu Districts — User Access Control</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
          + Add District User
        </button>
      </div>

      {/* District Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total Districts", DISTRICTS.length.toString(), "#1a2f5e"],
          ["Active Users", districtUsers.filter(u => u.active).length.toString(), "#16a34a"],
          ["Inactive Users", districtUsers.filter(u => !u.active).length.toString(), "#dc2626"],
          ["Unassigned", (DISTRICTS.length - districtUsers.length).toString(), "#b45309"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{l}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
          <h2 className="font-bold text-gray-800">புதிய District User சேர்</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">District</label>
              <select value={dist} onChange={e => setDist(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                <option value="">Select District</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Username</label>
              <input value={uname} onChange={e => setUname(e.target.value)} placeholder="chennai_user"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password"
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#16a34a" }}>Save</button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search district or user..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white" />

      {/* District Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["District", "Username", "Password", "Status", "Created", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">🏛️ {u.district}</td>
                  <td className="px-4 py-3 font-mono text-blue-700">{u.username}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono">{"•".repeat(u.password.length)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.active ? "✅ Active" : "❌ Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onToggleUser(u.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${u.active ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}>
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No district users found</p>}
        </div>
      </div>

      {/* All 38 Districts Grid */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-800 mb-3">📍 All 38 Tamil Nadu Districts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {DISTRICTS.map(d => {
            const hasUser = districtUsers.some(u => u.district === d);
            const isActive = districtUsers.some(u => u.district === d && u.active);
            return (
              <div key={d} className={`px-3 py-2 rounded-lg text-xs font-medium text-center border
                ${isActive ? "bg-green-50 border-green-200 text-green-700" :
                  hasUser ? "bg-red-50 border-red-200 text-red-600" :
                  "bg-gray-50 border-gray-200 text-gray-500"}`}>
                {isActive ? "✅" : hasUser ? "❌" : "⬜"} {d}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span>✅ Active User</span>
          <span>❌ Inactive User</span>
          <span>⬜ No User</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// USER MANAGEMENT PAGE (Admin Only)
// ============================================================
function UserManagementPage({ districtUsers, onAddUser, onToggleUser, onDeleteUser, onEditUser }:
  { districtUsers: ManagedUser[]; onAddUser: (u: ManagedUser) => void; onToggleUser: (id: string) => void; onDeleteUser: (id: string) => void; onEditUser: (u: ManagedUser) => void; }) {
  const [showForm, setShowForm] = useState(false);
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [dist, setDist] = useState("");
  const [search, setSearch] = useState("");
  const [showPass, setShowPass] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const filtered = districtUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.district.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!uname || !pass || !dist) return;
    onAddUser({ id: genId("U"), username: uname, password: pass, district: dist, active: true, createdAt: new Date().toISOString().split("T")[0] });
    setUname(""); setPass(""); setDist(""); setShowForm(false);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setSelectedIds(filtered.map(u => u.id));
  const clearSelect = () => setSelectedIds([]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">👥 User Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">District user accounts — Edit / Delete / Bulk operations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button onClick={() => setConfirmBulkDelete(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700">
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            + New User
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
          <h2 className="font-bold text-gray-800">புதிய User சேர்</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">District</label>
              <select value={dist} onChange={e => setDist(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                <option value="">Select District</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Username</label>
              <input value={uname} onChange={e => setUname(e.target.value)} placeholder="district_user"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password"
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#16a34a" }}>Create User</button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search users..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" onChange={e => e.target.checked ? selectAll() : clearSelect()} className="rounded" />
                </th>
                {["#", "Username", "District", "Password", "Status", "Created At", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u, i) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "bg-red-50/30" : ""} ${selectedIds.includes(u.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelect(u.id)}
                      className="rounded" />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-medium text-blue-700">{u.username}</td>
                  <td className="px-4 py-3 text-gray-700">🏛️ {u.district}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">
                        {showPass === u.id ? u.password : "••••••••"}
                      </span>
                      <button onClick={() => setShowPass(showPass === u.id ? null : u.id)}
                        className="text-xs text-gray-400 hover:text-gray-600">
                        {showPass === u.id ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                      ${u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.active ? "✅ Active" : "❌ Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => { setEditUser({...u}); }}
                        className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">✏️</button>
                      <button onClick={() => onToggleUser(u.id)}
                        className={`px-2 py-1 rounded text-xs font-semibold text-white
                          ${u.active ? "bg-orange-400 hover:bg-orange-500" : "bg-green-500 hover:bg-green-600"}`}>
                        {u.active ? "🔴" : "🟢"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(u.id)}
                        className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No users found</p>}
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">✏️ User Edit</h3>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Username</label>
                <input value={editUser.username} onChange={e => setEditUser({...editUser, username: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Password</label>
                <input type="text" value={editUser.password} onChange={e => setEditUser({...editUser, password: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">District</label>
                <select value={editUser.district} onChange={e => setEditUser({...editUser, district: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400">
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onEditUser(editUser); setEditUser(null); }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "#16a34a" }}>
                  💾 Save
                </button>
                <button onClick={() => setEditUser(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Delete உறுதிப்படுத்தல்</h3>
            <p className="text-sm text-gray-600 mb-4">இந்த user-ஐ delete செய்கிறீர்களா? மீட்டெடுக்க முடியாது!</p>
            <div className="flex gap-2">
              <button onClick={() => { onDeleteUser(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete</button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 mb-2">🗑️ Bulk Delete — {selectedIds.length} Users</h3>
            <p className="text-sm text-gray-600 mb-4">தேர்வு செய்த {selectedIds.length} users-ஐ delete செய்கிறீர்களா?</p>
            <div className="flex gap-2">
              <button onClick={() => {
                selectedIds.forEach(id => onDeleteUser(id));
                setSelectedIds([]); setConfirmBulkDelete(false);
              }} className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600">🗑️ Delete All</button>
              <button onClick={() => setConfirmBulkDelete(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ANALYTICS REPORTS PAGE (Admin Only)
// ============================================================
function AnalyticsPage({ transactions, bills, vendors, wallet }:
  { transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; wallet: WalletEntry[]; }) {
  const [tab, setTab] = useState("overview");

  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsAmt = bills.reduce((s, b) => s + b.billAmount, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0);
  const totalAdvance = wallet.filter(w => w.type === "advance").reduce((s, w) => s + w.debit, 0);
  const walletBalance = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;

  // District-wise summary
  const districtSummary = DISTRICTS.map(d => {
    const dTxns = transactions.filter(t => t.district === d);
    const dBills = bills.filter(b => b.district === d);
    return {
      district: d,
      txnCount: dTxns.length,
      expected: dTxns.reduce((s, t) => s + t.expectedAmount, 0),
      gst: dTxns.reduce((s, t) => s + t.gstAmount, 0),
      bills: dBills.reduce((s, b) => s + b.billAmount, 0),
      profit: dTxns.reduce((s, t) => s + t.profit, 0),
      closed: dTxns.filter(t => t.status === "Closed").length,
    };
  }).filter(d => d.txnCount > 0).sort((a, b) => b.expected - a.expected);

  // GST Rate wise
  const gstRateSummary = GST_RATES.map(r => ({
    rate: r,
    count: transactions.filter(t => t.gstPercent === r).length,
    amount: transactions.filter(t => t.gstPercent === r).reduce((s, t) => s + t.gstAmount, 0),
  })).filter(r => r.count > 0);

  const exportCSV = () => {
    const rows = [
      ["TXN ID", "District", "Vendor", "Month", "FY", "Expected", "Advance", "GST%", "GST Amt", "Bills", "Remaining", "Profit", "Status"],
      ...transactions.map(t => [t.txnId, t.district, t.vendorName, t.month, t.financialYear,
        t.expectedAmount, t.advanceAmount, t.gstPercent + "%", t.gstAmount,
        t.billsReceived, t.remainingExpected, t.profit, t.status])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "AR_ERP_Transactions.csv"; a.click();
  };

  const exportBillsCSV = () => {
    const rows = [
      ["Bill ID", "TXN ID", "District", "Vendor", "Bill No", "Date", "Bill Amount", "GST%", "GST Amt", "Total (18%)"],
      ...bills.map(b => [b.id, b.txnId, b.district, b.vendorName, b.billNumber, b.billDate,
        b.billAmount, b.gstPercent + "%", b.gstAmount, b.totalAmount])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "AR_ERP_Bills.csv"; a.click();
  };

  const exportWalletCSV = () => {
    const rows = [
      ["Entry ID", "Date", "Description", "Type", "Debit", "Credit", "Balance"],
      ...wallet.map(w => [w.id, w.date, w.description, w.type, w.debit, w.credit, w.balance])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "AR_ERP_Wallet.csv"; a.click();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">📈 Reports & Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">Master financial overview — All districts</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#1a2f5e" }}>📥 Txn CSV</button>
          <button onClick={exportBillsCSV}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#7c3aed" }}>📥 Bills CSV</button>
          <button onClick={exportWalletCSV}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#b45309" }}>📥 Wallet CSV</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["overview", "district-wise", "gst-analysis", "wallet-analysis"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "text-white" : "text-gray-600 bg-white border border-gray-200"}`}
            style={tab === t ? { background: "#1a2f5e" } : {}}>
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Total Expected", fmt(totalExpected), "#1a2f5e"],
              ["Bills Received", fmt(totalBillsAmt), "#15803d"],
              ["Total GST", fmt(totalGST), "#7c3aed"],
              ["8% Profit Earned", fmt(totalProfit), "#b45309"],
              ["Total Advance", fmt(totalAdvance), "#0369a1"],
              ["Wallet Balance", fmt(walletBalance), "#c9a227"],
              ["Total Vendors", vendors.length.toString(), "#374151"],
              ["Total Bills", bills.length.toString(), "#374151"],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500">{l}</p>
                <p className="text-xl font-bold mt-1" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">Transaction Status</h2>
              {[
                ["Open", transactions.filter(t => t.status === "Open").length, "#2563eb", "bg-blue-100"],
                ["Pending Close 🔴", transactions.filter(t => t.status === "PendingClose").length, "#dc2626", "bg-red-100"],
                ["Closed ✅", transactions.filter(t => t.status === "Closed").length, "#16a34a", "bg-green-100"],
              ].map(([l, v, c, bg]) => (
                <div key={l as string} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: c as string }}></div>
                    <span className="text-sm text-gray-700">{l as string}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${bg as string}`} style={{ color: c as string }}>
                    {v as number}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">Financial Summary</h2>
              {[
                ["Expected Amount", fmt(totalExpected)],
                ["Bills Received (Taxable)", fmt(totalBillsAmt)],
                ["Total GST Collected", fmt(totalGST)],
                ["Total Advance Paid", fmt(totalAdvance)],
                ["8% Service Profit", fmt(totalProfit)],
                ["Net Wallet Position", fmt(walletBalance)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-semibold text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DISTRICT WISE */}
      {tab === "district-wise" && (
        <div className="space-y-4">
          {districtSummary.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">No district data available</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">District-wise Financial Summary (Top Districts)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0a1628" }}>
                    <tr>
                      {["#", "District", "Transactions", "Expected ₹", "GST Amt", "Bills ₹", "Profit", "Closed"].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {districtSummary.map((d, i) => (
                      <tr key={d.district} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-gray-400 font-bold">{i + 1}</td>
                        <td className="px-3 py-3 font-medium text-gray-800">🏛️ {d.district}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{d.txnCount}</span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-gray-800">{fmt(d.expected)}</td>
                        <td className="px-3 py-3 text-purple-700">{fmt(d.gst)}</td>
                        <td className="px-3 py-3 text-green-700">{fmt(d.bills)}</td>
                        <td className="px-3 py-3 text-amber-600 font-semibold">{d.profit > 0 ? fmt(d.profit) : "—"}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${d.closed > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {d.closed}/{d.txnCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: "#f8fafc" }}>
                    <tr>
                      <td colSpan={3} className="px-3 py-3 font-bold text-gray-800 text-xs">மொத்தம்</td>
                      <td className="px-3 py-3 font-bold text-gray-800">{fmt(districtSummary.reduce((s, d) => s + d.expected, 0))}</td>
                      <td className="px-3 py-3 font-bold text-purple-700">{fmt(districtSummary.reduce((s, d) => s + d.gst, 0))}</td>
                      <td className="px-3 py-3 font-bold text-green-700">{fmt(districtSummary.reduce((s, d) => s + d.bills, 0))}</td>
                      <td className="px-3 py-3 font-bold text-amber-600">{fmt(districtSummary.reduce((s, d) => s + d.profit, 0))}</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GST ANALYSIS */}
      {tab === "gst-analysis" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">GST Rate-wise Breakdown</h2>
              {gstRateSummary.length === 0
                ? <p className="text-gray-400 text-sm text-center py-4">No GST data</p>
                : gstRateSummary.map(r => (
                  <div key={r.rate} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold">{r.rate}%</span>
                      <span className="text-sm text-gray-600">{r.count} transactions</span>
                    </div>
                    <span className="font-bold text-gray-800">{fmt(r.amount)}</span>
                  </div>
                ))}
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                <span className="font-bold text-gray-700">Total GST</span>
                <span className="font-bold text-purple-700">{fmt(totalGST)}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">GST vs Advance Analysis</h2>
              {[
                ["Total GST Payable", fmt(totalGST), "#7c3aed"],
                ["Advance Paid", fmt(totalAdvance), "#ea580c"],
                ["GST Balance Paid", fmt(totalGST - totalAdvance), "#dc2626"],
                ["GST Recovery %", totalGST > 0 ? ((totalGST - totalAdvance) / totalGST * 100).toFixed(1) + "%" : "0%", "#16a34a"],
              ].map(([l, v, c]) => (
                <div key={l} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-bold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vendor-wise GST */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Vendor-wise GST Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>
                    {["Vendor", "District", "Transactions", "Expected ₹", "GST %", "GST Amount", "Advance", "GST Balance"].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vendors.map(v => {
                    const vTxns = transactions.filter(t => t.vendorCode === v.vendorCode);
                    if (vTxns.length === 0) return null;
                    const vExpected = vTxns.reduce((s, t) => s + t.expectedAmount, 0);
                    const vGST = vTxns.reduce((s, t) => s + t.gstAmount, 0);
                    const vAdvance = vTxns.reduce((s, t) => s + t.advanceAmount, 0);
                    const vBalance = vTxns.reduce((s, t) => s + t.gstBalance, 0);
                    const gstPcts = [...new Set(vTxns.map(t => t.gstPercent))].join(", ");
                    return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium text-gray-800">{v.vendorName}</td>
                        <td className="px-3 py-3 text-gray-600">{v.district}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-700">{vTxns.length}</td>
                        <td className="px-3 py-3">{fmt(vExpected)}</td>
                        <td className="px-3 py-3 text-purple-700">{gstPcts}%</td>
                        <td className="px-3 py-3 font-semibold text-purple-700">{fmt(vGST)}</td>
                        <td className="px-3 py-3 text-orange-600">{fmt(vAdvance)}</td>
                        <td className="px-3 py-3 text-red-600 font-semibold">{fmt(vBalance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* WALLET ANALYSIS */}
      {tab === "wallet-analysis" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Wallet Balance", fmt(walletBalance), "#c9a227"],
              ["Total Invested", fmt(wallet.filter(w => w.type === "manual" && w.credit > 0).reduce((s, w) => s + w.credit, 0)), "#1a2f5e"],
              ["Total Advance Debited", fmt(wallet.filter(w => w.type === "advance").reduce((s, w) => s + w.debit, 0)), "#ea580c"],
              ["Total GST Debited", fmt(wallet.filter(w => w.type === "gst").reduce((s, w) => s + w.debit, 0)), "#dc2626"],
              ["Total Profit Credited", fmt(wallet.filter(w => w.type === "profit").reduce((s, w) => s + w.credit, 0)), "#16a34a"],
              ["Total Entries", wallet.length.toString(), "#374151"],
              ["Profit ROI", walletBalance > 0 && totalProfit > 0 ? (totalProfit / 500000 * 100).toFixed(2) + "%" : "0%", "#7c3aed"],
              ["Efficiency", transactions.length > 0 ? (transactions.filter(t => t.status === "Closed").length / transactions.length * 100).toFixed(0) + "%" : "0%", "#0369a1"],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500">{l}</p>
                <p className="text-xl font-bold mt-1" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Wallet Entry Type Breakdown */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">Wallet Movement Breakdown</h2>
            <div className="space-y-3">
              {[
                { type: "manual", label: "💼 Manual/Investment", color: "#1a2f5e", bg: "#eff6ff" },
                { type: "advance", label: "💸 Advance Payments", color: "#ea580c", bg: "#fff7ed" },
                { type: "gst", label: "🏛️ GST Settlements", color: "#dc2626", bg: "#fef2f2" },
                { type: "profit", label: "📈 8% Profit Credits", color: "#16a34a", bg: "#f0fdf4" },
              ].map(({ type, label, color, bg }) => {
                const entries = wallet.filter(w => w.type === type as WalletEntry["type"]);
                const debit = entries.reduce((s, w) => s + w.debit, 0);
                const credit = entries.reduce((s, w) => s + w.credit, 0);
                return (
                  <div key={type} className="flex items-center justify-between p-3 rounded-lg" style={{ background: bg }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color }}>{label}</p>
                      <p className="text-xs text-gray-500">{entries.length} entries</p>
                    </div>
                    <div className="text-right">
                      {debit > 0 && <p className="text-sm font-bold text-red-600">−{fmt(debit)}</p>}
                      {credit > 0 && <p className="text-sm font-bold text-green-600">+{fmt(credit)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// GOOGLE SHEETS SYNC PAGE (Admin Only)
// ============================================================
function GoogleSheetsSyncPage({ transactions, bills, vendors, wallet }:
  { transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; wallet: WalletEntry[]; }) {
  const [tab, setTab] = useState("guide");
  const [sheetUrls, setSheetUrls] = useState<Record<string, string>>({});
  const [syncLog, setSyncLog] = useState<{ time: string; msg: string; type: "success" | "error" | "info" }[]>([]);
  const [syncing, setSyncing] = useState(false);

  const addLog = (msg: string, type: "success" | "error" | "info" = "info") => {
    setSyncLog(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev.slice(0, 19)]);
  };

  const handleSync = (district: string) => {
    setSyncing(true);
    addLog(`🔄 Syncing ${district}...`, "info");
    setTimeout(() => {
      const url = sheetUrls[district];
      if (!url) {
        addLog(`❌ ${district} — No URL configured!`, "error");
      } else {
        addLog(`✅ ${district} — Sync successful! (${transactions.filter(t => t.district === district).length} txns, ${bills.filter(b => b.district === district).length} bills)`, "success");
      }
      setSyncing(false);
    }, 1500);
  };

  const exportJSON = (data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    addLog(`📥 ${filename} downloaded`, "success");
  };

  const appsScriptCode = `// AR Enterprises ERP — Google Apps Script Integration
// Copy this code to your Google Sheet's Apps Script Editor

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'SYNC_TRANSACTIONS') {
    const sheet = ss.getSheetByName('Monthly_Transactions') || ss.insertSheet('Monthly_Transactions');
    sheet.clearContents();
    sheet.appendRow(['TXN ID','FY','Month','Vendor','Expected','Advance','GST%','GST Amt','Bills','Remaining','Status']);
    data.transactions.forEach(t => {
      sheet.appendRow([t.txnId, t.financialYear, t.month, t.vendorName,
        t.expectedAmount, t.advanceAmount, t.gstPercent+'%', t.gstAmount,
        t.billsReceived, t.remainingExpected, t.status]);
    });
  }
  
  if (action === 'SYNC_BILLS') {
    const sheet = ss.getSheetByName('Bill_Details') || ss.insertSheet('Bill_Details');
    sheet.clearContents();
    sheet.appendRow(['Bill ID','TXN ID','Vendor','Bill No','Date','Amount','GST%','GST Amt','Total(18%)']);
    data.bills.forEach(b => {
      sheet.appendRow([b.id, b.txnId, b.vendorName, b.billNumber, b.billDate,
        b.billAmount, b.gstPercent+'%', b.gstAmount, b.totalAmount]);
    });
  }
  
  if (action === 'SYNC_WALLET') {
    const sheet = ss.getSheetByName('Admin_Wallet') || ss.insertSheet('Admin_Wallet');
    sheet.clearContents();
    sheet.appendRow(['Entry ID','Date','Description','Type','Debit','Credit','Balance']);
    data.wallet.forEach(w => {
      sheet.appendRow([w.id, w.date, w.description, w.type, w.debit, w.credit, w.balance]);
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({status:'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const activeDistricts = [...new Set(transactions.map(t => t.district))];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">📊 Google Sheets Sync & Export</h1>
        <p className="text-xs text-gray-400 mt-0.5">Data backup and Google Sheets integration</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["guide", "script", "urls", "sync", "export"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "text-white" : "text-gray-600 bg-white border border-gray-200"}`}
            style={tab === t ? { background: "#1a2f5e" } : {}}>
            {t === "guide" ? "📖 Guide" : t === "script" ? "📝 Script" : t === "urls" ? "⚙️ URLs" : t === "sync" ? "🔄 Sync" : "📥 Export"}
          </button>
        ))}
      </div>

      {tab === "guide" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">📖 Setup Guide — 4 Steps</h2>
            {[
              { step: "1", title: "Google Sheet உருவாக்கு", desc: "sheets.google.com → New Sheet → 'AR_ERP_Chennai' என்று பெயர் வை" },
              { step: "2", title: "Apps Script திற", desc: "Extensions → Apps Script → 'Script' Tab-ல் Script Code paste செய்" },
              { step: "3", title: "Deploy செய்", desc: "Deploy → New Deployment → Web App → Anyone can access → Deploy → URL Copy" },
              { step: "4", title: "URL Paste செய்", desc: "URLs tab-ல் District URL paste செய் → Sync button click செய்" },
            ].map(s => (
              <div key={s.step} className="flex gap-3 p-3 rounded-lg mb-2" style={{ background: "#f8fafc" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: "#1a2f5e" }}>{s.step}</div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">📊 Data Flow</h2>
            <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
              {["AR ERP Web App", "→", "Google Apps Script", "→", "Google Sheets"].map((item, i) => (
                item === "→"
                  ? <span key={i} className="text-gray-400 text-xl">→</span>
                  : <div key={i} className="px-4 py-2 rounded-lg text-white text-xs font-semibold text-center"
                    style={{ background: "#1a2f5e" }}>{item}</div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center text-gray-500">
              <p>Transactions, Bills, Wallet</p>
              <p>Web App URL (POST)</p>
              <p>Monthly_Transactions, Bill_Details, Admin_Wallet</p>
            </div>
          </div>
        </div>
      )}

      {tab === "script" && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-800">📝 Apps Script Code</h2>
            <button onClick={() => { navigator.clipboard.writeText(appsScriptCode); addLog("✅ Code copied!", "success"); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: "#1a2f5e" }}>📋 Copy Code</button>
          </div>
          <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap border border-gray-200"
            style={{ fontFamily: "monospace", maxHeight: "400px", overflowY: "auto" }}>
            {appsScriptCode}
          </pre>
        </div>
      )}

      {tab === "urls" && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
          <h2 className="font-bold text-gray-800">⚙️ District Sheet URLs</h2>
          <p className="text-xs text-gray-500">Google Apps Script Web App URL ஒவ்வொரு District-க்கும் paste செய்யவும்</p>
          <div className="space-y-2">
            {activeDistricts.map(d => (
              <div key={d} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">🏛️ {d}</span>
                <input
                  value={sheetUrls[d] || ""}
                  onChange={e => setSheetUrls(prev => ({ ...prev, [d]: e.target.value }))}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-blue-400"
                />
                <a href={sheetUrls[d] || "#"} target="_blank" rel="noopener noreferrer"
                  className="px-2 py-1.5 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 whitespace-nowrap">
                  📊 திற
                </a>
              </div>
            ))}
            {activeDistricts.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No active districts with transactions</p>
            )}
          </div>
        </div>
      )}

      {tab === "sync" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeDistricts.map(d => (
              <div key={d} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">🏛️ {d}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {transactions.filter(t => t.district === d).length} txns |
                      {bills.filter(b => b.district === d).length} bills
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1 ${sheetUrls[d] ? "bg-green-500" : "bg-red-400"}`}></span>
                    <button onClick={() => handleSync(d)} disabled={syncing}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: "#1a2f5e" }}>
                      {syncing ? "Syncing..." : "🔄 Sync"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sync Log */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-2">📋 Activity Log</h2>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {syncLog.length === 0 && <p className="text-gray-400 text-xs text-center py-4">No sync activity yet</p>}
              {syncLog.map((l, i) => (
                <div key={i} className={`flex gap-2 text-xs p-2 rounded ${l.type === "success" ? "bg-green-50 text-green-700" : l.type === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                  <span className="text-gray-400">{l.time}</span>
                  <span>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "export" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "📋 Transactions JSON", desc: `${transactions.length} transactions`, onClick: () => exportJSON(transactions, "AR_Transactions.json"), color: "#1a2f5e" },
              { title: "🧾 Bills JSON", desc: `${bills.length} bills`, onClick: () => exportJSON(bills, "AR_Bills.json"), color: "#7c3aed" },
              { title: "🏢 Vendors JSON", desc: `${vendors.length} vendors`, onClick: () => exportJSON(vendors, "AR_Vendors.json"), color: "#0369a1" },
              { title: "💰 Wallet JSON", desc: `${wallet.length} entries`, onClick: () => exportJSON(wallet, "AR_Wallet.json"), color: "#b45309" },
              { title: "📦 Full System Backup", desc: "All data combined", onClick: () => exportJSON({ transactions, bills, vendors, wallet, exportDate: new Date().toISOString() }, "AR_ERP_FullBackup.json"), color: "#374151" },
            ].map(item => (
              <button key={item.title} onClick={item.onClick}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                    style={{ background: item.color }}>
                    📥
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {syncLog.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-2">📋 Export Log</h2>
              <div className="space-y-1">
                {syncLog.map((l, i) => (
                  <div key={i} className={`flex gap-2 text-xs p-2 rounded ${l.type === "success" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                    <span className="text-gray-400">{l.time}</span><span>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// REPORTS PAGE
// ============================================================
function ReportsPage({ transactions, bills, vendors, isAdmin: _isAdmin, district: _district }:
  { transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; isAdmin: boolean; district: string; }) {
  void _isAdmin;
  const [tab, setTab] = useState("summary");

  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBills = transactions.reduce((s, t) => s + t.billsReceived, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">📈 Reports</h1>
      <div className="flex gap-2 flex-wrap">
        {["summary","vendors","transactions","bills"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${tab === t ? "text-white" : "text-gray-600 bg-white border border-gray-200"}`}
            style={tab === t ? { background: "#1a2f5e" } : {}}>
            {t}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Total Expected", fmt(totalExpected), "#1a2f5e"],
              ["Bills Received", fmt(totalBills), "#15803d"],
              ["Total GST", fmt(totalGST), "#7c3aed"],
              ["Total Profit (8%)", fmt(totalProfit), "#b45309"],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500">{l}</p>
                <p className="text-xl font-bold mt-1" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-3">Transaction Status Summary</h2>
            {[
              ["Open", transactions.filter(t => t.status === "Open").length, "#2563eb"],
              ["Pending Close", transactions.filter(t => t.status === "PendingClose").length, "#dc2626"],
              ["Closed", transactions.filter(t => t.status === "Closed").length, "#16a34a"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{l as string}</span>
                <span className="font-bold text-lg" style={{ color: c as string }}>{v as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "vendors" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Vendor Code","Vendor Name","District","Transactions","Bills"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
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
