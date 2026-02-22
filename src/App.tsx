import { useState, useCallback, useEffect } from "react";
import { loadFromSheets, saveToSheets, startAutoSync } from './services/googleSheets';

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
// CONSTANTS
// ============================================================
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
const BILL_TOTAL_RATE = 1.18;

const USERS: User[] = [
  { id: "U001", username: "admin", password: "Admin@123", role: "admin" },
];

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;
const genId = (prefix: string) => prefix + Math.random().toString(36).substr(2,7).toUpperCase();

const INIT_VENDORS: Vendor[] = [];
const INIT_WALLET: WalletEntry[] = [];
const INIT_TRANSACTIONS: Transaction[] = [];
const INIT_BILLS: Bill[] = [];

const LS_KEY = "AR_ERP_V3_DATA";

const saveToStorage = (data: {
  vendors: Vendor[]; transactions: Transaction[];
  bills: Bill[]; wallet: WalletEntry[]; managedUsers: ManagedUser[];
}) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) { console.error("Storage save error:", e); }
};

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
};

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage({ onLogin, managedUsers }: { onLogin: (u: User) => void; managedUsers: ManagedUser[] }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const adminUser = USERS.find(u => u.username === username && u.password === password);
    if (adminUser) { setError(""); onLogin(adminUser); return; }
    const distUser = managedUsers.find(u => u.username === username && u.password === password && u.active);
    if (distUser) {
      setError("");
      onLogin({ id: distUser.id, username: distUser.username, password: distUser.password, role: "district", district: distUser.district });
      return;
    }
    setError("தவறான username அல்லது password!");
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
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter username" autoComplete="off"
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none placeholder-gray-500"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
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
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const saved = loadFromStorage();
  
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [vendors, setVendors] = useState<Vendor[]>(saved?.vendors || INIT_VENDORS);
  const [transactions, setTransactions] = useState<Transaction[]>(saved?.transactions || INIT_TRANSACTIONS);
  const [bills, setBills] = useState<Bill[]>(saved?.bills || INIT_BILLS);
  const [wallet, setWallet] = useState<WalletEntry[]>(saved?.wallet || INIT_WALLET);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(saved?.managedUsers || []);

  // Google Sheets Initial Load + Auto-Sync
  useEffect(() => {
    async function initialize() {
      try {
        await loadFromSheets();
        const reloaded = loadFromStorage();
        
        if (reloaded) {
          setVendors(reloaded.vendors || []);
          setTransactions(reloaded.transactions || []);
          setBills(reloaded.bills || []);
          setWallet(reloaded.wallet || []);
          setManagedUsers(reloaded.managedUsers || []);
        }
      } catch (err) {
        console.log('Initial load failed, using localStorage:', err);
      }
      
      setIsInitializing(false);
      startAutoSync(5);
    }
    
    initialize();
  }, []);

  const saveData = useCallback((
    v: Vendor[], t: Transaction[], b: Bill[], w: WalletEntry[], u: ManagedUser[]
  ) => {
    saveToStorage({ vendors: v, transactions: t, bills: b, wallet: w, managedUsers: u });
    saveToSheets().catch(err => console.log('Background sync failed:', err));
  }, []);

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
      const nw = [...prev, entry];
      const saved2 = loadFromStorage();
      saveToStorage({
        vendors: saved2?.vendors || [],
        transactions: saved2?.transactions || [],
        bills: saved2?.bills || [],
        wallet: nw,
        managedUsers: saved2?.managedUsers || []
      });
      return nw;
    });
  }, []);

  // Loading screen
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: '#c9a227', borderTopColor: 'transparent' }}></div>
          <p className="text-white font-semibold text-lg">Google Sheets-லிருந்து தரவு ஏற்றப்படுகிறது...</p>
          <p className="text-gray-400 text-sm mt-2">சிறிது காத்திருக்கவும்</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={u => { setUser(u); setPage("dashboard"); }} managedUsers={managedUsers} />;

  const district = user.role === "district" ? user.district! : "";
  const isAdmin = user.role === "admin";

  const myVendors = isAdmin ? vendors : vendors.filter(v => v.district === district);
  const myTxns = isAdmin ? transactions : transactions.filter(t => t.district === district);
  const myBills = isAdmin ? bills : bills.filter(b => b.district === district);
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
            onAdd={(v) => { const nv = [...vendors, v]; setVendors(nv); saveData(nv, transactions, bills, wallet, managedUsers); }}
            onDelete={(id) => { const nv = vendors.filter(v => v.id !== id); setVendors(nv); saveData(nv, transactions, bills, wallet, managedUsers); }}
          />
        )}
        {page === "transactions" && (
          <TransactionsPage
            isAdmin={isAdmin} district={district}
            transactions={myTxns} vendors={myVendors} bills={myBills}
            onAdd={(txn, advance) => {
              const nt = [...transactions, txn];
              setTransactions(nt);
              if (advance > 0) {
                addWalletEntry(`Advance Paid — ${txn.vendorName} (${txn.txnId})`, advance, 0, "advance", txn.txnId);
              }
              saveData(vendors, nt, bills, wallet, managedUsers);
            }}
            onClose={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn) return;
              const gstBal = round2(txn.gstAmount - txn.advanceAmount);
              if (gstBal > 0) {
                addWalletEntry(`GST Balance Debit — ${txn.vendorName} (${txnId})`, gstBal, 0, "gst", txnId);
              }
              const nt = transactions.map(t => t.txnId === txnId
                ? { ...t, status: "PendingClose" as const, closedByDistrict: true, remainingExpected: 0 }
                : t);
              setTransactions(nt);
              saveData(vendors, nt, bills, wallet, managedUsers);
            }}
            onEdit={(updated) => { const nt = transactions.map(t => t.txnId === updated.txnId ? updated : t); setTransactions(nt); saveData(vendors, nt, bills, wallet, managedUsers); }}
            onDeleteTxn={(txnId) => { const nt = transactions.filter(t => t.txnId !== txnId); setTransactions(nt); saveData(vendors, nt, bills, wallet, managedUsers); }}
          />
        )}
        {page === "bills" && (
          <BillsPage
            isAdmin={isAdmin} district={district}
            bills={myBills} transactions={myTxns} vendors={myVendors}
            onAdd={(bill) => {
              const nb = [...bills, bill];
              setBills(nb);
              const nt = transactions.map(t => {
                if (t.txnId !== bill.txnId) return t;
                const txnBills = nb.filter(b => b.txnId === t.txnId);
                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);
                return { ...t, billsReceived: round2(billsReceived), remainingExpected: remaining };
              });
              setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers);
            }}
            onEditBill={(updated) => { const nb = bills.map(b => b.id === updated.id ? updated : b); setBills(nb); saveData(vendors, transactions, nb, wallet, managedUsers); }}
            onDelete={(billId) => {
              const bill = bills.find(b => b.id === billId);
              if (!bill) return;
              const nb = bills.filter(b => b.id !== billId);
              setBills(nb);
              const nt = transactions.map(t => {
                if (t.txnId !== bill.txnId) return t;
                const txnBills = nb.filter(b => b.txnId === t.txnId);
                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);
                return { ...t, billsReceived: round2(billsReceived), remainingExpected: remaining };
              });
              setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers);
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
            onAddUser={(u) => { const nu = [...managedUsers, u]; setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu); }}
            onToggleUser={(id) => { const nu = managedUsers.map(u => u.id === id ? { ...u, active: !u.active } : u); setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu); }}
          />
        )}
        {page === "users" && isAdmin && (
          <UserManagementPage
            districtUsers={managedUsers}
            onAddUser={(u) => { const nu = [...managedUsers, u]; setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu); }}
            onToggleUser={(id) => { const nu = managedUsers.map(u => u.id === id ? { ...u, active: !u.active } : u); setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu); }}
            onDeleteUser={(id) => { const nu = managedUsers.filter(u => u.id !== id); setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu); }}
            onEditUser={(updated) => { const nu = managedUsers.map(u => u.id === updated.id ? updated : u); setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu); }}
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
// DASHBOARD PAGE
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
        <p className="text-sm text-gray-500">AR Enterprises — Multi District ERP V3.0</p>
      </div>

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

  const autoCode = dist && bizType && regYear ? genVendorCode(dist, bizType, regYear, vendors) : "";

  const handleAdd = () => {
    if (!name || !dist || !mobile) return;
    onAdd({
      id: genId("V"), vendorCode: autoCode, vendorName: name, district: dist,
      mobile, businessType: bizType, address, gstNo, regYear
    });
    setName(""); setMobile(""); setAddress(""); setGstNo("");
    setDist(isAdmin ? "" : district); setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">🏢 Vendor Management</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
          + New Vendor
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-bold text-gray-800">புதிய Vendor சேர்</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <div className="md:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop No, Street, City, Pincode"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          {autoCode && (
            <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <span className="text-xs text-blue-600">🔑 Auto-Generated Vendor Code:</span>
              <span className="font-bold text-blue-800 font-mono text-sm">{autoCode}</span>
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
                {["Vendor Code","Vendor Name","Mobile","Business","District","GST No","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
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
                    <button onClick={() => onDelete(v.id)} className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No vendors found</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRANSACTIONS PAGE
// ============================================================
function TransactionsPage({ isAdmin, district, transactions, vendors, bills, onAdd, onClose, onEdit, onDeleteTxn }:
  { isAdmin: boolean; district: string; transactions: Transaction[]; vendors: Vendor[]; bills: Bill[]; onAdd: (t: Transaction, advance: number) => void; onClose: (id: string) => void; onEdit: (t: Transaction) => void; onDeleteTxn: (id: string) => void; }) {
  const [showForm, setShowForm] = useState(false);
  const [vendorCode, setVendorCode] = useState("");
  const [fy, setFy] = useState("2025-26");
  const [month, setMonth] = useState("April");
  const [expectedAmt, setExpectedAmt] = useState("");
  const [advanceAmt, setAdvanceAmt] = useState("");
  const [gstPct, setGstPct] = useState(4);
  const [search, setSearch] = useState("");
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

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
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            + New Transaction
          </button>
        )}
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
              <p className="text-blue-700">GST Amount: {fmt(parseFloat(expectedAmt))} × {gstPct}% = <strong>{fmt(previewGST)}</strong></p>
              <p className="text-blue-700">GST Balance: {fmt(previewGST)} − {fmt(parseFloat(advanceAmt)||0)} = <strong>{fmt(previewBalance)}</strong></p>
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
                {["TXN ID","Vendor","Month","Expected ₹","GST Amt","Advance","Bills","Remaining","Status","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => {
                const txnBills = getTxnBills(t.txnId);
                const gstAmt = round2(t.expectedAmount * t.gstPercent / 100);
                const sumTotals = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotals));
                const billsTotal = txnBills.reduce((s, b) => s + b.billAmount, 0);
                const canClose = remaining <= 0 && t.status === "Open";

                return (
                  <tr key={t.txnId} className={`hover:bg-gray-50 ${t.status === "PendingClose" ? "bg-red-50" : t.status === "Closed" ? "bg-green-50" : ""}`}>
                    <td className="px-3 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">{t.txnId}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800">{t.vendorName}</p>
                      <p className="text-xs text-gray-400">{t.vendorCode}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{t.month}<br />{t.financialYear}</td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{fmt(t.expectedAmount)}</td>
                    <td className="px-3 py-3 text-purple-700 font-semibold">{fmt(gstAmt)}</td>
                    <td className="px-3 py-3 text-orange-600">{fmt(t.advanceAmount)}</td>
                    <td className="px-3 py-3 text-green-700">{fmt(billsTotal)}</td>
                    <td className="px-3 py-3">
                      <span className={`font-bold ${remaining <= 0 ? "text-green-600" : "text-orange-600"}`}>
                        {remaining <= 0 ? "₹0 ✅" : fmt(remaining)}
                      </span>
                    </td>
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
                        <button onClick={() => onDeleteTxn(t.txnId)}
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
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No transactions found</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BILLS PAGE
// ============================================================
function BillsPage({ isAdmin, district, bills, transactions, vendors: _vendors, onAdd, onDelete, onEditBill }:
  { isAdmin: boolean; district: string; bills: Bill[]; transactions: Transaction[]; vendors: Vendor[]; onAdd: (b: Bill) => void; onDelete: (id: string) => void; onEditBill: (b: Bill) => void; }) {
  void _vendors;
  const [showForm, setShowForm] = useState(false);
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

  const previewBillAmt = parseFloat(billAmt) || 0;
  const previewGST = round2(previewBillAmt * gstPct / 100);
  const previewTotal = round2(previewBillAmt * BILL_TOTAL_RATE);

  const handleAdd = () => {
    if (!txnId || !billAmt || !billNo) return;
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) return;
    const amt = parseFloat(billAmt);
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
        <h1 className="text-xl font-bold text-gray-800">🧾 Bill Management</h1>
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            + புதிய Bill
          </button>
        )}
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
          {billAmt && (
            <div className="p-3 rounded-lg text-sm space-y-1" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <p className="text-blue-700">GST தொகை: {fmt(previewBillAmt)} × {gstPct}% = <strong>{fmt(previewGST)}</strong></p>
              <p className="text-blue-700">Total Amount: {fmt(previewBillAmt)} × 18% = <strong>{fmt(previewTotal)}</strong></p>
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
                {["Bill ID","TXN ID","Vendor","Bill Number","Date","Bill Amount","GST%","GST தொகை","Total","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs text-blue-700">{b.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">{b.txnId}</td>
                  <td className="px-3 py-3 font-medium text-gray-800">{b.vendorName}</td>
                  <td className="px-3 py-3 text-gray-800">{b.billNumber}</td>
                  <td className="px-3 py-3 text-gray-600">{b.billDate}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{fmt(b.billAmount)}</td>
                  <td className="px-3 py-3 text-gray-600">{b.gstPercent}%</td>
                  <td className="px-3 py-3 text-purple-700 font-semibold">{fmt(b.gstAmount)}</td>
                  <td className="px-3 py-3 text-green-700 font-semibold">{fmt(b.totalAmount)}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => onDelete(b.id)} className="px-2 py-1 rounded text-xs bg-red-50 text-red-600">🗑️</button>
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
    </div>
  );
}
// ============================================================
// WALLET PAGE
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">📒 Wallet Ledger</h2>
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
                  <td className="px-4 py-3 font-semibold text-red-600">
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
          {wallet.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No wallet entries</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORTS PAGE
// ============================================================
function ReportsPage({ transactions, bills, vendors, isAdmin: _isAdmin, district: _district }:
  { transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; isAdmin: boolean; district: string; }) {
  void _isAdmin; void _district;
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
          {vendors.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No vendors</p>}
        </div>
      )}

      {tab === "transactions" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0a1628" }}>
                <tr>
                  {["TXN ID","Vendor","Expected","GST Amt","Bills","Remaining","Status"].map(h => (
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
          {transactions.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No transactions</p>}
        </div>
      )}

      {tab === "bills" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0a1628" }}>
                <tr>
                  {["Bill No","Vendor","Date","Bill Amount","GST%","GST தொகை","Total"].map(h => (
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
          {bills.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No bills</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ANALYTICS PAGE
// ============================================================
function AnalyticsPage({ transactions, bills, vendors, wallet }:
  { transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; wallet: WalletEntry[]; }) {

  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsAmt = bills.reduce((s, b) => s + b.billAmount, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0);
  const walletBalance = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;

  const districtSummary = DISTRICTS.map(d => {
    const dTxns = transactions.filter(t => t.district === d);
    const dBills = bills.filter(b => b.district === d);
    return {
      district: d,
      txnCount: dTxns.length,
      expected: dTxns.reduce((s, t) => s + t.expectedAmount, 0),
      bills: dBills.reduce((s, b) => s + b.billAmount, 0),
    };
  }).filter(d => d.txnCount > 0).sort((a, b) => b.expected - a.expected);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">📈 Reports & Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Total Expected", fmt(totalExpected), "#1a2f5e"],
          ["Bills Received", fmt(totalBillsAmt), "#15803d"],
          ["Total GST", fmt(totalGST), "#7c3aed"],
          ["8% Profit", fmt(totalProfit), "#b45309"],
          ["Wallet Balance", fmt(walletBalance), "#c9a227"],
          ["Total Vendors", vendors.length.toString(), "#374151"],
          ["Total Bills", bills.length.toString(), "#0369a1"],
          ["Transactions", transactions.length.toString(), "#374151"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{l}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>

      {districtSummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">District-wise Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0a1628" }}>
                <tr>
                  {["#","District","Transactions","Expected ₹","Bills ₹"].map(h => (
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
                    <td className="px-3 py-3 text-green-700">{fmt(d.bills)}</td>
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
// DISTRICT MANAGEMENT PAGE
// ============================================================
function DistrictManagementPage({ districtUsers, onAddUser, onToggleUser }:
  { districtUsers: ManagedUser[]; onAddUser: (u: ManagedUser) => void; onToggleUser: (id: string) => void; }) {
  const [showForm, setShowForm] = useState(false);
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [dist, setDist] = useState("");

  const handleAdd = () => {
    if (!uname || !pass || !dist) return;
    onAddUser({
      id: genId("U"), username: uname, password: pass,
      district: dist, active: true, createdAt: new Date().toISOString().split("T")[0]
    });
    setUname(""); setPass(""); setDist(""); setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">🏛️ District Management</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
          + Add District User
        </button>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["District", "Username", "Status", "Created", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {districtUsers.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">🏛️ {u.district}</td>
                  <td className="px-4 py-3 font-mono text-blue-700">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.active ? "✅ Active" : "❌ Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onToggleUser(u.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold text-white ${u.active ? "bg-red-500" : "bg-green-500"}`}>
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {districtUsers.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No district users</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// USER MANAGEMENT PAGE
// ============================================================
function UserManagementPage({ districtUsers, onAddUser, onToggleUser, onDeleteUser, onEditUser }:
  { districtUsers: ManagedUser[]; onAddUser: (u: ManagedUser) => void; onToggleUser: (id: string) => void; onDeleteUser: (id: string) => void; onEditUser: (u: ManagedUser) => void; }) {
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
    onAddUser({ id: genId("U"), username: uname, password: pass, district: dist, active: true, createdAt: new Date().toISOString().split("T")[0] });
    setUname(""); setPass(""); setDist(""); setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">👥 User Management</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
          + New User
        </button>
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
                {["#", "Username", "District", "Status", "Created At", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u, i) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-medium text-blue-700">{u.username}</td>
                  <td className="px-4 py-3 text-gray-700">🏛️ {u.district}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                      ${u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.active ? "✅ Active" : "❌ Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => onToggleUser(u.id)}
                        className={`px-2 py-1 rounded text-xs font-semibold text-white
                          ${u.active ? "bg-orange-400" : "bg-green-500"}`}>
                        {u.active ? "🔴" : "🟢"}
                      </button>
                      <button onClick={() => onDeleteUser(u.id)}
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
    </div>
  );
}

// ============================================================
// GOOGLE SHEETS SYNC PAGE
// ============================================================
function GoogleSheetsSyncPage({ transactions, bills, vendors, wallet }: {
  transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; wallet: WalletEntry[];
}) {
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSaveToSheets = async () => {
    setSyncing(true);
    setStatus('idle');
    setMessage('');
    
    try {
      const success = await saveToSheets();
      
      if (success) {
        setStatus('success');
        setMessage(`✅ ${vendors.length} vendors, ${transactions.length} txns, ${bills.length} bills, ${wallet.length} wallet entries synced!`);
        setLastSync(new Date().toLocaleString('en-IN'));
      } else {
        setStatus('error');
        setMessage('❌ Sync failed. Check Apps Script deployment.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('❌ Network error: ' + (err as Error).message);
    }
    
    setSyncing(false);
  };

  const handleLoadFromSheets = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');
    
    try {
      const success = await loadFromSheets();
      
      if (success) {
        setStatus('success');
        setMessage('✅ Data loaded from Google Sheets! Refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus('error');
        setMessage('❌ Load failed. Check if Google Sheets has data.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('❌ Network error: ' + (err as Error).message);
    }
    
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">📊 Google Sheets Sync</h1>
        <p className="text-sm text-gray-500">Real-time data synchronization</p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-800">🔄 Sync Status</h2>
            <p className="text-xs text-gray-500 mt-1">Auto-sync: Every 5 minutes</p>
          </div>
          {lastSync && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Last sync:</p>
              <p className="text-sm font-medium text-gray-700">{lastSync}</p>
            </div>
          )}
        </div>

        {status === 'success' && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-700 font-medium">{message}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700 font-medium">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button onClick={handleSaveToSheets} disabled={syncing || loading}
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
            {syncing ? '⏳ Syncing...' : '☁️ Save to Sheets'}
          </button>
          <button onClick={handleLoadFromSheets} disabled={syncing || loading}
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
            {loading ? '⏳ Loading...' : '📥 Load from Sheets'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['🏢 Vendors', vendors.length, '#1a2f5e'],
          ['📋 Transactions', transactions.length, '#0369a1'],
          ['🧾 Bills', bills.length, '#7c3aed'],
          ['💰 Wallet', wallet.length, '#b45309'],
        ].map(([label, count, color]) => (
          <div key={label as string} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color: color as string }}>{count}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
        <h3 className="font-bold text-blue-900 mb-3">ℹ️ எப்படி வேலை செய்கிறது?</h3>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li><strong>Auto-sync:</strong> App load ஆகும்போது + ஒவ்வொரு 5 நிமிடமும்</li>
          <li><strong>Save to Sheets:</strong> Current data → Google Sheets</li>
          <li><strong>Load from Sheets:</strong> Google Sheets → App (Page refresh)</li>
          <li><strong>Offline-safe:</strong> Sync fail ஆனாலும் localStorage-ல data safe</li>
        </ul>
      </div>
    </div>
  );
}
