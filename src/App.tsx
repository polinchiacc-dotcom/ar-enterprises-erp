import { useState, useCallback, useEffect, useMemo } from "react";
import { loadFromSheets, saveToSheets, startAutoSync } from './services/googleSheets';
import { 
  hashPassword, 
  verifyPassword, 
  encryptData, 
  decryptData, 
  sanitizeInput,
  createSession,
  isSessionValid,
  type Session 
} from './utils/security';
import { 
  vendorSchema, 
  transactionSchema, 
  billSchema, 
  userSchema,
  validateData 
} from './utils/validation';

// ============================================================
// TYPES
// ============================================================
interface User { 
  id: string; 
  username: string; 
  password: string; 
  role: "admin" | "district"; 
  district?: string;
  email?: string;
  createdAt?: string;
}

interface Vendor {
  id: string; 
  vendorCode: string; 
  vendorName: string; 
  district: string;
  mobile?: string; 
  email?: string;
  businessType?: string; 
  address?: string; 
  gstNo?: string; 
  regYear?: string;
  createdAt?: string;
  active?: boolean;
}

interface Transaction {
  id: string; 
  txnId: string; 
  district: string; 
  vendorCode: string; 
  vendorName: string;
  financialYear: string; 
  month: string; 
  expectedAmount: number; 
  advanceAmount: number;
  gstPercent: number; 
  gstAmount: number; 
  gstBalance: number;
  billsReceived: number; 
  remainingExpected: number;
  status: "Open" | "PendingClose" | "Closed";
  closedByDistrict: boolean; 
  confirmedByAdmin: boolean;
  profit: number;
  createdAt?: string;
  closedAt?: string;
}

interface Bill {
  id: string; 
  txnId: string; 
  vendorCode: string; 
  vendorName: string; 
  district: string;
  billNumber: string; 
  billDate: string; 
  billAmount: number;
  gstPercent: number; 
  gstAmount: number; 
  totalAmount: number;
  createdAt?: string;
}

interface WalletEntry {
  id: string; 
  date: string; 
  description: string; 
  txnId?: string;
  debit: number; 
  credit: number; 
  balance: number; 
  type: "advance" | "gst" | "profit" | "manual";
  createdBy?: string;
}

interface ManagedUser {
  id: string; 
  username: string; 
  password: string; 
  district: string; 
  active: boolean; 
  createdAt: string;
  lastLogin?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "CLOSE" | "CONFIRM" | "LOGIN" | "LOGOUT";
  entity: "Transaction" | "Vendor" | "Bill" | "Wallet" | "User";
  entityId: string;
  before?: any;
  after?: any;
  ipAddress?: string;
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

const MONTHS = [
  "April","May","June","July","August","September",
  "October","November","December","January","February","March"
];

const FY_LIST = ["2024-25","2025-26","2026-27","2027-28"];

const BUSINESS_TYPES = [
  "Hardware","Electrical","Civil","Plumbing","Mechanical",
  "Catering","Transport","Stationery","IT","Medical","General"
];

const DIST_SHORT: Record<string,string> = {
  "Ariyalur":"ARI","Chengalpattu":"CGP","Chennai":"CHE","Coimbatore":"CBE",
  "Cuddalore":"CUD","Dharmapuri":"DHP","Dindigul":"DGL","Erode":"ERD",
  "Kallakurichi":"KLK","Kanchipuram":"KCP","Kanniyakumari":"KNK","Karur":"KRR",
  "Krishnagiri":"KRG","Madurai":"MDU","Mayiladuthurai":"MYD","Nagapattinam":"NGP",
  "Namakkal":"NMK","Nilgiris":"NLG","Perambalur":"PBR","Pudukkottai":"PDK",
  "Ramanathapuram":"RMN","Ranipet":"RNP","Salem":"SLM","Sivagangai":"SVG",
  "Tenkasi":"TNK","Thanjavur":"TNJ","Theni":"THN","Thoothukudi":"TUT",
  "Tiruchirappalli":"TRP","Tirunelveli":"TNV","Tirupathur":"TPT","Tiruppur":"TPR",
  "Tiruvallur":"TVR","Tiruvannamalai":"TVL","Tiruvarur":"TVU","Vellore":"VLR",
  "Viluppuram":"VLP","Virudhunagar":"VRN"
};

const BIZ_SHORT: Record<string,string> = {
  "Hardware":"HW","Electrical":"EL","Civil":"CV","Plumbing":"PL",
  "Mechanical":"MC","Catering":"CT","Transport":"TR","Stationery":"ST",
  "IT":"IT","Medical":"MD","General":"GN"
};

const PROFIT_RATE = 0.08;
const BILL_TOTAL_RATE = 1.18;
const LS_KEY = "AR_ERP_V3_DATA_ENCRYPTED";
const SESSION_KEY = "AR_SESSION";

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
});

const round2 = (n: number) => Math.round(n * 100) / 100;

const genId = (prefix: string) => 
  prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();

const genVendorCode = (district: string, bizType: string, year: string, existing: Vendor[]) => {
  const d = DIST_SHORT[district] || district.slice(0,3).toUpperCase();
  const b = BIZ_SHORT[bizType] || bizType.slice(0,2).toUpperCase();
  const y = year ? year.slice(-2) : new Date().getFullYear().toString().slice(-2);
  const count = existing.filter(v => 
    v.district === district && v.businessType === bizType
  ).length + 1;
  return `${d}${y}${b}${String(count).padStart(3,"0")}`;
};

// ============================================================
// STORAGE FUNCTIONS (With Encryption)
// ============================================================
interface StorageData {
  vendors: Vendor[];
  transactions: Transaction[];
  bills: Bill[];
  wallet: WalletEntry[];
  managedUsers: ManagedUser[];
  auditLogs: AuditLog[];
}

const saveToStorage = (data: StorageData) => {
  try {
    const encrypted = encryptData(data);
    localStorage.setItem(LS_KEY, encrypted);
    console.log("✅ Data encrypted and saved");
  } catch (e) {
    console.error("Storage save error:", e);
  }
};

const loadFromStorage = (): StorageData | null => {
  try {
    const encrypted = localStorage.getItem(LS_KEY);
    if (!encrypted) return null;
    
    const decrypted = decryptData(encrypted);
    return decrypted;
  } catch (e) {
    console.error("Storage load error:", e);
    return null;
  }
};

// Session Storage
const saveSession = (session: Session) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const loadSession = (): Session | null => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    
    const session: Session = JSON.parse(stored);
    return isSessionValid(session) ? session : null;
  } catch (e) {
    return null;
  }
};

const clearSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
};

// Default Admin (Password will be hashed on first run)
const DEFAULT_ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123'; // Will be hashed
// ============================================================
// LOGIN PAGE COMPONENT
// ============================================================
function LoginPage({ onLogin, managedUsers }: { 
  onLogin: (u: User) => void; 
  managedUsers: ManagedUser[] 
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Username மற்றும் Password தேவை!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if admin
      if (username === DEFAULT_ADMIN_USERNAME) {
        // For first-time setup, allow plain password
        const storedAdmin = managedUsers.find(u => u.username === DEFAULT_ADMIN_USERNAME);
        
        if (storedAdmin) {
          const isValid = await verifyPassword(password, storedAdmin.password);
          if (isValid) {
            const adminUser: User = {
              id: storedAdmin.id,
              username: storedAdmin.username,
              password: storedAdmin.password,
              role: "admin"
            };
            onLogin(adminUser);
            return;
          }
        } else if (password === DEFAULT_ADMIN_PASSWORD) {
          // First time login - hash and save
          const hashedPassword = await hashPassword(DEFAULT_ADMIN_PASSWORD);
          const adminUser: User = {
            id: "U001",
            username: DEFAULT_ADMIN_USERNAME,
            password: hashedPassword,
            role: "admin"
          };
          onLogin(adminUser);
          return;
        }
      }

      // Check district users
      const distUser = managedUsers.find(u => u.username === username && u.active);
      if (distUser) {
        const isValid = await verifyPassword(password, distUser.password);
        if (isValid) {
          const user: User = {
            id: distUser.id,
            username: distUser.username,
            password: distUser.password,
            role: "district",
            district: distUser.district
          };
          onLogin(user);
          return;
        }
      }

      setError("தவறான username அல்லது password!");
    } catch (err) {
      setError("Login error occurred!");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" 
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}>
      <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl" 
        style={{ 
          background: "rgba(255,255,255,0.05)", 
          border: "1px solid rgba(255,255,255,0.1)", 
          backdropFilter: "blur(20px)" 
        }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" 
            style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)" }}>
            <span className="text-2xl font-bold text-gray-900">AR</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AR Enterprises</h1>
          <p className="text-sm mt-1" style={{ color: "#c9a227" }}>
            Multi-District Vendor ERP System V3.0
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(sanitizeInput(e.target.value))}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter username" 
              autoComplete="off"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none placeholder-gray-500 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter password" 
              autoComplete="new-password"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none placeholder-gray-500 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} 
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50">
              <p className="text-red-300 text-xs text-center">{error}</p>
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-gray-900 text-sm transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)" }}>
            {loading ? "🔄 Logging in..." : "Login →"}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            🔒 Secured with AES-256 Encryption
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function App() {
  const saved = loadFromStorage();
  
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [vendors, setVendors] = useState<Vendor[]>(saved?.vendors || []);
  const [transactions, setTransactions] = useState<Transaction[]>(saved?.transactions || []);
  const [bills, setBills] = useState<Bill[]>(saved?.bills || []);
  const [wallet, setWallet] = useState<WalletEntry[]>(saved?.wallet || []);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(saved?.managedUsers || []);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(saved?.auditLogs || []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState({
    autoBackup: true,
    backupFrequency: 7,
    emailNotifications: true,
    browserNotifications: false,
    dataEncryption: true
  });

  // Initialize app
  useEffect(() => {
    async function initialize() {
      try {
        // Check for existing session
        const session = loadSession();
        if (session) {
          setUser(session.user);
          console.log('✅ Session restored');
        }

        // Load from Google Sheets
        await loadFromSheets();
        const reloaded = loadFromStorage();
        
        if (reloaded) {
          setVendors(reloaded.vendors || []);
          setTransactions(reloaded.transactions || []);
          setBills(reloaded.bills || []);
          setWallet(reloaded.wallet || []);
          setManagedUsers(reloaded.managedUsers || []);
          setAuditLogs(reloaded.auditLogs || []);
        }
      } catch (err) {
        console.log('Initial load failed, using localStorage:', err);
      }
      
      setIsInitializing(false);
      startAutoSync(5);
    }
    
    initialize();
  }, []);

  // Request notification permission
  useEffect(() => {
    if (settings.browserNotifications && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [settings.browserNotifications]);

  // Mobile sidebar auto-close
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save data function with audit logging
  const saveData = useCallback((
    v: Vendor[], 
    t: Transaction[], 
    b: Bill[], 
    w: WalletEntry[], 
    u: ManagedUser[],
    a: AuditLog[]
  ) => {
    saveToStorage({ 
      vendors: v, 
      transactions: t, 
      bills: b, 
      wallet: w, 
      managedUsers: u,
      auditLogs: a
    });
    
    saveToSheets().catch(err => 
      console.log('Background sync failed:', err)
    );
  }, []);

  // Audit logging function
  const logAction = useCallback((
    action: AuditLog['action'],
    entity: AuditLog['entity'],
    entityId: string,
    before?: any,
    after?: any
  ) => {
    if (!user) return;

    const log: AuditLog = {
      id: genId("LOG"),
      timestamp: new Date().toISOString(),
      user: user.username,
      action,
      entity,
      entityId,
      before,
      after
    };

    setAuditLogs(prev => {
      const updated = [...prev, log];
      saveData(vendors, transactions, bills, wallet, managedUsers, updated);
      return updated;
    });

    console.log('📋 Audit:', log);
  }, [user, vendors, transactions, bills, wallet, managedUsers, saveData]);

  // Get wallet balance
  const getWalletBalance = useCallback(() => {
    if (wallet.length === 0) return 0;
    return wallet[wallet.length - 1].balance;
  }, [wallet]);

  // Add wallet entry (with race condition protection)
  const [isWalletLocked, setIsWalletLocked] = useState(false);
  
  const addWalletEntry = useCallback((
    description: string, 
    debit: number, 
    credit: number,
    type: WalletEntry["type"], 
    txnId?: string
  ) => {
    if (isWalletLocked) {
      console.log("⚠️ Wallet locked, retrying...");
      setTimeout(() => addWalletEntry(description, debit, credit, type, txnId), 100);
      return;
    }

    setIsWalletLocked(true);

    setWallet(prev => {
      const lastBal = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      const newBal = round2(lastBal - debit + credit);
      
      const entry: WalletEntry = {
        id: genId("W"), 
        date: new Date().toISOString().split("T")[0],
        description, 
        txnId, 
        debit, 
        credit, 
        balance: newBal, 
        type,
        createdBy: user?.username
      };
      
      const nw = [...prev, entry];
      
      saveData(vendors, transactions, bills, nw, managedUsers, auditLogs);
      
      logAction("CREATE", "Wallet", entry.id, null, entry);
      
      setIsWalletLocked(false);
      return nw;
    });
  }, [user, vendors, transactions, bills, managedUsers, auditLogs, saveData, logAction, isWalletLocked]);

  // Handle confirm close (with 5 protections)
  const handleConfirmClose = useCallback((txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    
    if (!txn) {
      console.log("❌ Transaction not found:", txnId);
      alert("❌ Transaction இல்லை!");
      return;
    }

    // Protection 1: Already confirmed check
    if (txn.confirmedByAdmin || txn.status === "Closed") {
      console.log("⚠️ Transaction already confirmed!");
      alert("⚠️ இந்த Transaction ஏற்கனவே Closed ஆகிவிட்டது!");
      return;
    }

    // Protection 2: Wallet duplicate check
    const existingProfitEntry = wallet.find(
      w => w.txnId === txnId && w.type === "profit"
    );
    
    if (existingProfitEntry) {
      console.log("⚠️ Profit already credited!");
      alert("⚠️ Profit ஏற்கனவே Credit ஆகிவிட்டது!");
      
      // Fix transaction status
      const fixedTransactions = transactions.map(t =>
        t.txnId === txnId
          ? { ...t, status: "Closed" as const, confirmedByAdmin: true }
          : t
      );
      setTransactions(fixedTransactions);
      saveData(vendors, fixedTransactions, bills, wallet, managedUsers, auditLogs);
      return;
    }

    const profit = round2(txn.expectedAmount * PROFIT_RATE);
    console.log(`✅ Processing Confirm Close: ${txnId}, Profit: ₹${profit}`);

    // Update transaction
    const before = { ...txn };
    const updatedTransactions = transactions.map(t =>
      t.txnId === txnId
        ? { 
            ...t, 
            status: "Closed" as const, 
            confirmedByAdmin: true, 
            profit,
            closedAt: new Date().toISOString()
          }
        : t
    );

    // Add profit to wallet
    const lastBal = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;
    const newBal = round2(lastBal + profit);
    
    const walletEntry: WalletEntry = {
      id: genId("W"),
      date: new Date().toISOString().split("T")[0],
      description: `8% Profit Credit — ${txn.vendorName} (${txnId})`,
      txnId,
      debit: 0,
      credit: profit,
      balance: newBal,
      type: "profit",
      createdBy: user?.username
    };

    const updatedWallet = [...wallet, walletEntry];

    // Protection 3: Immediate save
    setTransactions(updatedTransactions);
    setWallet(updatedWallet);

    saveData(
      vendors,
      updatedTransactions,
      bills,
      updatedWallet,
      managedUsers,
      auditLogs
    );

    // Protection 4: Audit log
    logAction("CONFIRM", "Transaction", txnId, before, updatedTransactions.find(t => t.txnId === txnId));

    // Protection 5: Google Sheets sync
    saveToSheets().then(() => {
      console.log("✅ Cloud sync complete");
    }).catch(err => {
      console.log("⚠️ Cloud sync pending:", err);
    });

    // Browser notification
    if (settings.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('AR Enterprises', {
        body: `Transaction ${txnId} closed! Profit: ${fmt(profit)}`,
        icon: '/logo.png'
      });
    }

    console.log(`🎉 Transaction ${txnId} closed successfully!`);
    alert(`✅ Transaction Closed!\n\nProfit Credited: ${fmt(profit)}`);
  }, [transactions, wallet, vendors, bills, managedUsers, auditLogs, user, settings, saveData, logAction]);

  // Handle login
  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    
    // Create and save session
    const session = createSession(loggedInUser, 8);
    saveSession(session);
    
    // Update last login for district users
    if (loggedInUser.role === "district") {
      const updatedUsers = managedUsers.map(u =>
        u.username === loggedInUser.username
          ? { ...u, lastLogin: new Date().toISOString() }
          : u
      );
      setManagedUsers(updatedUsers);
      saveData(vendors, transactions, bills, wallet, updatedUsers, auditLogs);
    }

    // Audit log
    logAction("LOGIN", "User", loggedInUser.id);
    
    setPage("dashboard");
  };

  // Handle logout
  const handleLogout = () => {
    if (user) {
      logAction("LOGOUT", "User", user.id);
    }
    
    clearSession();
    setUser(null);
    setPage("dashboard");
  };

  // Loading screen
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: '#c9a227', borderTopColor: 'transparent' }}></div>
          <p className="text-white font-semibold text-lg">🔐 Decrypting Data...</p>
          <p className="text-gray-400 text-sm mt-2">Secure boot sequence</p>
        </div>
      </div>
    );
  }

  // Login page
  if (!user) {
    return <LoginPage onLogin={handleLogin} managedUsers={managedUsers} />;
  }

  const district = user.role === "district" ? user.district! : "";
  const isAdmin = user.role === "admin";

  // Filter data based on role
  const myVendors = useMemo(() => 
    isAdmin ? vendors : vendors.filter(v => v.district === district),
    [vendors, district, isAdmin]
  );

  const myTxns = useMemo(() =>
    isAdmin ? transactions : transactions.filter(t => t.district === district),
    [transactions, district, isAdmin]
  );

  const myBills = useMemo(() =>
    isAdmin ? bills : bills.filter(b => b.district === district),
    [bills, district, isAdmin]
  );

  const pendingClose = useMemo(() =>
    transactions.filter(t => t.closedByDistrict && !t.confirmedByAdmin),
    [transactions]
  );
  // Navigation items
  const navItems = isAdmin
    ? [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "vendors", label: "Vendors", icon: "🏢" },
        { id: "transactions", label: "Transactions", icon: "📋" },
        { id: "bills", label: "Bills", icon: "🧾" },
        { id: "wallet", label: "Admin Wallet", icon: "💰", badge: pendingClose.length },
        { id: "analytics", label: "Analytics", icon: "📈" },
        { id: "users", label: "User Management", icon: "👥" },
        { id: "audit", label: "Audit Logs", icon: "📜" },
        { id: "settings", label: "Settings", icon: "⚙️" },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "vendors", label: "Vendors", icon: "🏢" },
        { id: "transactions", label: "Transactions", icon: "📋" },
        { id: "bills", label: "Bills", icon: "🧾" },
        { id: "reports", label: "Reports", icon: "📄" },
      ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f2f5", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Sidebar */}
      <div className={`flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"}`}
        style={{ 
          background: "linear-gradient(180deg, #0a1628 0%, #1a2f5e 100%)", 
          borderRight: "1px solid rgba(255,255,255,0.08)" 
        }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" 
          style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm" style={{ color: "#c9a227" }}>AR Enterprises</p>
              <p className="text-xs text-gray-400">ERP V3.0 🔐</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="text-gray-400 hover:text-white text-lg transition-colors">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* User Info */}
        {sidebarOpen && (
          <div className="p-3 m-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p className="text-xs text-gray-400">
              {isAdmin ? "👑 Super Admin" : `🏛️ ${district}`}
            </p>
            <p className="text-xs font-medium text-white truncate">{user.username}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {navItems.map(n => (
            <button 
              key={n.id} 
              onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${page === n.id 
                  ? "text-gray-900 font-semibold" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              style={page === n.id ? { background: "linear-gradient(135deg, #c9a227, #f0d060)" } : {}}>
              <span className="text-lg">{n.icon}</span>
              {sidebarOpen && <span className="flex-1 text-left">{n.label}</span>}
              {sidebarOpen && n.badge && n.badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        {sidebarOpen && (
          <div className="absolute bottom-4 left-0 w-64 px-3">
            <button 
              onClick={handleLogout}
              className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-white transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              🚪 Logout
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {page === "dashboard" && (
          <DashboardPage
            isAdmin={isAdmin}
            district={district}
            transactions={myTxns}
            vendors={myVendors}
            bills={myBills}
            wallet={wallet}
            walletBalance={getWalletBalance()}
            pendingClose={pendingClose}
            onConfirmClose={handleConfirmClose}
            settings={settings}
          />
        )}

        {page === "vendors" && (
          <VendorsPage
            isAdmin={isAdmin}
            district={district}
            vendors={myVendors}
            allVendors={vendors}
            onAdd={async (v) => {
              const validation = await validateData(vendorSchema, v);
              if (!validation.valid) {
                alert("❌ Validation Error:\n\n" + validation.errors.join("\n"));
                return;
              }
              const nv = [...vendors, { ...v, createdAt: new Date().toISOString(), active: true }];
              setVendors(nv);
              saveData(nv, transactions, bills, wallet, managedUsers, auditLogs);
              logAction("CREATE", "Vendor", v.id, null, v);
            }}
            onUpdate={(updatedVendor) => {
              const before = vendors.find(v => v.id === updatedVendor.id);
              const nv = vendors.map(v => v.id === updatedVendor.id ? updatedVendor : v);
              setVendors(nv);
              saveData(nv, transactions, bills, wallet, managedUsers, auditLogs);
              logAction("UPDATE", "Vendor", updatedVendor.id, before, updatedVendor);
            }}
            onDelete={(id) => {
              const vendor = vendors.find(v => v.id === id);
              if (!vendor) return;

              // Check cascade
              const hasTxns = transactions.some(t => t.vendorCode === vendor.vendorCode);
              const hasBills = bills.some(b => b.vendorCode === vendor.vendorCode);

              if (hasTxns || hasBills) {
                alert(`❌ Cannot delete ${vendor.vendorName}!\n\nThis vendor has active transactions or bills.\nPlease close/delete them first.`);
                return;
              }

              if (!confirm(`Delete ${vendor.vendorName}?`)) return;

              const nv = vendors.filter(v => v.id !== id);
              setVendors(nv);
              saveData(nv, transactions, bills, wallet, managedUsers, auditLogs);
              logAction("DELETE", "Vendor", id, vendor, null);
            }}
          />
        )}

        {page === "transactions" && (
          <TransactionsPage
            isAdmin={isAdmin}
            district={district}
            transactions={myTxns}
            vendors={myVendors}
            bills={myBills}
            onAdd={async (txn, advance) => {
              const validation = await validateData(transactionSchema, {
                expectedAmount: txn.expectedAmount,
                advanceAmount: txn.advanceAmount
              });

              if (!validation.valid) {
                alert("❌ Validation Error:\n\n" + validation.errors.join("\n"));
                return;
              }

              const nt = [...transactions, { ...txn, createdAt: new Date().toISOString() }];
              setTransactions(nt);

              if (advance > 0) {
                addWalletEntry(
                  `Advance Paid — ${txn.vendorName} (${txn.txnId})`,
                  advance,
                  0,
                  "advance",
                  txn.txnId
                );
              }

              saveData(vendors, nt, bills, wallet, managedUsers, auditLogs);
              logAction("CREATE", "Transaction", txn.txnId, null, txn);
            }}
            onClose={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn) return;

              const before = { ...txn };
              const gstBal = round2(txn.gstAmount - txn.advanceAmount);

              if (gstBal > 0) {
                addWalletEntry(
                  `GST Balance Debit — ${txn.vendorName} (${txnId})`,
                  gstBal,
                  0,
                  "gst",
                  txnId
                );
              }

              const nt = transactions.map(t =>
                t.txnId === txnId
                  ? {
                      ...t,
                      status: "PendingClose" as const,
                      closedByDistrict: true,
                      remainingExpected: 0
                    }
                  : t
              );

              setTransactions(nt);
              saveData(vendors, nt, bills, wallet, managedUsers, auditLogs);
              logAction("CLOSE", "Transaction", txnId, before, nt.find(t => t.txnId === txnId));

              alert("✅ Transaction closed!\n\nWaiting for Admin confirmation.");
            }}
            onUpdate={(updated) => {
              const before = transactions.find(t => t.txnId === updated.txnId);
              const nt = transactions.map(t => t.txnId === updated.txnId ? updated : t);
              setTransactions(nt);
              saveData(vendors, nt, bills, wallet, managedUsers, auditLogs);
              logAction("UPDATE", "Transaction", updated.txnId, before, updated);
            }}
            onDelete={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn) return;

              if (txn.status !== "Open") {
                alert("❌ Cannot delete closed transactions!");
                return;
              }

              if (!confirm(`Delete transaction ${txnId}?`)) return;

              const nt = transactions.filter(t => t.txnId !== txnId);
              setTransactions(nt);
              saveData(vendors, nt, bills, wallet, managedUsers, auditLogs);
              logAction("DELETE", "Transaction", txnId, txn, null);
            }}
          />
        )}

        {page === "bills" && (
          <BillsPage
            isAdmin={isAdmin}
            district={district}
            bills={myBills}
            transactions={myTxns}
            vendors={myVendors}
            onAdd={async (bill) => {
              const validation = await validateData(billSchema, {
                billNumber: bill.billNumber,
                billAmount: bill.billAmount,
                billDate: bill.billDate
              });

              if (!validation.valid) {
                alert("❌ Validation Error:\n\n" + validation.errors.join("\n"));
                return;
              }

              // Check if transaction is still open
              const txn = transactions.find(t => t.txnId === bill.txnId);
              if (txn && txn.status !== "Open") {
                alert("❌ Cannot add bills to closed transactions!");
                return;
              }

              const nb = [...bills, { ...bill, createdAt: new Date().toISOString() }];
              setBills(nb);

              // Update transaction
              const nt = transactions.map(t => {
                if (t.txnId !== bill.txnId) return t;

                const txnBills = nb.filter(b => b.txnId === t.txnId);
                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);

                return {
                  ...t,
                  billsReceived: round2(billsReceived),
                  remainingExpected: remaining
                };
              });

              setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs);
              logAction("CREATE", "Bill", bill.id, null, bill);
            }}
            onUpdate={(updated) => {
              const before = bills.find(b => b.id === updated.id);
              const nb = bills.map(b => b.id === updated.id ? updated : b);
              setBills(nb);

              // Recalculate transaction
              const nt = transactions.map(t => {
                const txnBills = nb.filter(b => b.txnId === t.txnId);
                if (txnBills.length === 0) return t;

                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);

                return {
                  ...t,
                  billsReceived: round2(billsReceived),
                  remainingExpected: remaining
                };
              });

              setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs);
              logAction("UPDATE", "Bill", updated.id, before, updated);
            }}
            onDelete={(billId) => {
              const bill = bills.find(b => b.id === billId);
              if (!bill) return;

              if (!confirm(`Delete bill ${bill.billNumber}?`)) return;

              const nb = bills.filter(b => b.id !== billId);
              setBills(nb);

              // Recalculate transaction
              const nt = transactions.map(t => {
                if (t.txnId !== bill.txnId) return t;

                const txnBills = nb.filter(b => b.txnId === t.txnId);
                const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
                const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
                const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);

                return {
                  ...t,
                  billsReceived: round2(billsReceived),
                  remainingExpected: remaining
                };
              });

              setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs);
              logAction("DELETE", "Bill", billId, bill, null);
            }}
          />
        )}

        {page === "wallet" && isAdmin && (
          <WalletPage
            wallet={wallet}
            balance={getWalletBalance()}
            onManualEntry={(desc, debit, credit) => {
              addWalletEntry(sanitizeInput(desc), debit, credit, "manual");
            }}
            onSetBalance={(newBal) => {
              const current = getWalletBalance();
              const diff = newBal - current;
              if (diff > 0) {
                addWalletEntry("Balance Adjustment (Credit)", 0, diff, "manual");
              } else if (diff < 0) {
                addWalletEntry("Balance Adjustment (Debit)", Math.abs(diff), 0, "manual");
              }
            }}
          />
        )}

        {page === "analytics" && isAdmin && (
          <AnalyticsPage
            transactions={transactions}
            bills={bills}
            vendors={vendors}
            wallet={wallet}
          />
        )}

        {page === "reports" && !isAdmin && (
          <ReportsPage
            transactions={myTxns}
            bills={myBills}
            vendors={myVendors}
            district={district}
          />
        )}

        {page === "users" && isAdmin && (
          <UserManagementPage
            districtUsers={managedUsers}
            onAddUser={async (u) => {
              const validation = await validateData(userSchema, {
                username: u.username,
                password: u.password
              });

              if (!validation.valid) {
                alert("❌ Validation Error:\n\n" + validation.errors.join("\n"));
                return;
              }

              // Check duplicate
              if (managedUsers.some(existing => existing.username === u.username)) {
                alert("❌ Username already exists!");
                return;
              }

              // Hash password
              const hashedPassword = await hashPassword(u.password);
              const newUser = { ...u, password: hashedPassword };

              const nu = [...managedUsers, newUser];
              setManagedUsers(nu);
              saveData(vendors, transactions, bills, wallet, nu, auditLogs);
              logAction("CREATE", "User", newUser.id, null, newUser);

              alert("✅ User created successfully!");
            }}
            onUpdateUser={async (updated) => {
              const before = managedUsers.find(u => u.id === updated.id);
              
              // If password changed, hash it
              if (before && updated.password !== before.password) {
                updated.password = await hashPassword(updated.password);
              }

              const nu = managedUsers.map(u => u.id === updated.id ? updated : u);
              setManagedUsers(nu);
              saveData(vendors, transactions, bills, wallet, nu, auditLogs);
              logAction("UPDATE", "User", updated.id, before, updated);
            }}
            onToggleUser={(id) => {
              const nu = managedUsers.map(u =>
                u.id === id ? { ...u, active: !u.active } : u
              );
              setManagedUsers(nu);
              saveData(vendors, transactions, bills, wallet, nu, auditLogs);
            }}
            onDeleteUser={(id) => {
              const user = managedUsers.find(u => u.id === id);
              if (!user) return;

              if (user.username === DEFAULT_ADMIN_USERNAME) {
                alert("❌ Cannot delete default admin!");
                return;
              }

              if (!confirm(`Delete user ${user.username}?`)) return;

              const nu = managedUsers.filter(u => u.id !== id);
              setManagedUsers(nu);
              saveData(vendors, transactions, bills, wallet, nu, auditLogs);
              logAction("DELETE", "User", id, user, null);
            }}
          />
        )}

        {page === "audit" && isAdmin && (
          <AuditLogsPage logs={auditLogs} />
        )}

        {page === "settings" && isAdmin && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={(newSettings) => {
              setSettings(newSettings);
              localStorage.setItem('AR_SETTINGS', JSON.stringify(newSettings));
            }}
            onBackup={() => {
              const backup = {
                timestamp: new Date().toISOString(),
                version: "3.0",
                data: { vendors, transactions, bills, wallet, managedUsers, auditLogs }
              };

              const blob = new Blob([JSON.stringify(backup, null, 2)], {
                type: 'application/json'
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
             // ✅ Correct:
const fileName = `AR_Backup_${new Date().toISOString().split("T")[0]}.json`;
a.download = fileName;
              a.click();

              alert("✅ Backup downloaded!");
            }}
            onRestore={(file) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const backup = JSON.parse(e.target?.result as string);
                  
                  if (!backup.data) {
                    throw new Error("Invalid backup file");
                  }

                  setVendors(backup.data.vendors || []);
                  setTransactions(backup.data.transactions || []);
                  setBills(backup.data.bills || []);
                  setWallet(backup.data.wallet || []);
                  setManagedUsers(backup.data.managedUsers || []);
                  setAuditLogs(backup.data.auditLogs || []);

                  saveData(
                    backup.data.vendors || [],
                    backup.data.transactions || [],
                    backup.data.bills || [],
                    backup.data.wallet || [],
                    backup.data.managedUsers || [],
                    backup.data.auditLogs || []
                  );

                  alert("✅ Data restored successfully!\n\nPage will refresh.");
                  setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                  alert("❌ Invalid backup file!");
                  console.error(err);
                }
              };
              reader.readAsText(file);
            }}
            onClearData={() => {
              if (!confirm("⚠️ Delete ALL data?\n\nThis cannot be undone!")) return;
              if (!confirm("⚠️⚠️ FINAL WARNING!\n\nAre you ABSOLUTELY sure?")) return;

              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            storageUsed={new Blob([JSON.stringify({ vendors, transactions, bills, wallet, managedUsers, auditLogs })]).size}
          />
        )}
      </div>
    </div>
  );
}
// ============================================================
// DASHBOARD PAGE
// ============================================================
function DashboardPage({ 
  isAdmin, 
  district, 
  transactions, 
  vendors, 
  bills, 
  wallet, 
  walletBalance, 
  pendingClose, 
  onConfirmClose,
  settings 
}: {
  isAdmin: boolean;
  district: string;
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  wallet: WalletEntry[];
  walletBalance: number;
  pendingClose: Transaction[];
  onConfirmClose: (id: string) => void;
  settings: any;
}) {
  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsReceived = transactions.reduce((s, t) => s + t.billsReceived, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const openTxns = transactions.filter(t => t.status === "Open").length;
  const closedTxns = transactions.filter(t => t.status === "Closed").length;
  const totalProfit = transactions.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {isAdmin ? "📊 Master Dashboard — AR Enterprises" : `📊 ${district} Dashboard`}
        </h1>
        <p className="text-sm text-gray-500">Multi-District ERP V3.0 — Real-time Analytics</p>
      </div>

      {/* Pending Close Alert */}
      {isAdmin && pendingClose.length > 0 && (
        <div className="rounded-xl p-5 border-2 animate-pulse" 
          style={{ background: "#fff5f5", borderColor: "#fca5a5" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-red-700 text-lg">
              🔴 Pending Admin Confirmation ({pendingClose.length})
            </h2>
            {settings.browserNotifications && (
              <span className="text-xs text-red-600">🔔 Notifications enabled</span>
            )}
          </div>
          <div className="space-y-3">
            {pendingClose.map(t => {
              const profit = round2(t.expectedAmount * PROFIT_RATE);
              return (
                <div key={t.txnId} 
                  className="flex items-center justify-between bg-white p-4 rounded-lg border border-red-200 hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{t.vendorName} — {t.district}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t.txnId} | Expected: {fmt(t.expectedAmount)} | 8% Profit: {fmt(profit)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Closed by district on {new Date(t.closedAt || '').toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <button 
                    onClick={() => onConfirmClose(t.txnId)}
                    className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:scale-105"
                    style={{ background: "#16a34a" }}>
                    ✅ Confirm & Credit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Vendors</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#1a2f5e" }}>{vendors.length}</p>
          <p className="text-xs text-gray-400 mt-1">Active accounts</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 font-medium uppercase">Transactions</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#0369a1" }}>{transactions.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-green-600">Open: {openTxns}</span> | 
            <span className="text-blue-600"> Closed: {closedTxns}</span>
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Expected</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#b45309" }}>{fmt(totalExpected)}</p>
          <p className="text-xs text-gray-400 mt-1">Across all transactions</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 font-medium uppercase">Bills Received</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#15803d" }}>{fmt(totalBillsReceived)}</p>
          <p className="text-xs text-gray-400 mt-1">{bills.length} total bills</p>
        </div>
      </div>

      {/* Admin Stats */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">Total GST Amount</p>
            <p className="text-3xl font-bold mt-2">{fmt(totalGST)}</p>
            <p className="text-xs opacity-75 mt-1">Government tax</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">💰 Wallet Balance</p>
            <p className="text-3xl font-bold mt-2">{fmt(walletBalance)}</p>
            <p className="text-xs opacity-75 mt-1">Live running balance</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">Total Profit Earned</p>
            <p className="text-3xl font-bold mt-2">{fmt(totalProfit)}</p>
            <p className="text-xs opacity-75 mt-1">8% commission</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">Active Districts</p>
            <p className="text-3xl font-bold mt-2">
              {new Set(transactions.map(t => t.district)).size}
            </p>
            <p className="text-xs opacity-75 mt-1">Out of {DISTRICTS.length} total</p>
          </div>
        </div>
      )}

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Recent Transactions</h2>
          <span className="text-xs text-gray-500">Last 10 entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                {["TXN ID", "Vendor", "District", "Expected", "Bills", "Remaining", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.slice(0, 10).map(t => (
                <tr key={t.txnId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{t.txnId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{t.vendorName}</p>
                    <p className="text-xs text-gray-400">{t.vendorCode}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.district}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(t.expectedAmount)}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">{fmt(t.billsReceived)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${t.remainingExpected <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {t.remainingExpected <= 0 ? '₹0 ✅' : fmt(t.remainingExpected)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold
                      ${t.status === "Closed" ? "bg-green-100 text-green-700" :
                        t.status === "PendingClose" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"}`}>
                      {t.status === "PendingClose" ? "🔴 Pending" : t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <p className="text-center py-12 text-gray-400">No transactions found</p>
          )}
        </div>
      </div>

      {/* Wallet Summary (Admin only) */}
      {isAdmin && wallet.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">💰 Wallet — Recent Entries</h2>
            <span className="font-bold text-xl" style={{ color: "#b45309" }}>{fmt(walletBalance)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  {["Date", "Description", "Debit (−)", "Credit (+)", "Balance"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {wallet.slice(-5).reverse().map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{w.date}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{w.description}</p>
                      {w.createdBy && (
                        <p className="text-xs text-gray-400">By: {w.createdBy}</p>
                      )}
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
function VendorsPage({ 
  isAdmin, 
  district, 
  vendors, 
  allVendors, 
  onAdd, 
  onUpdate, 
  onDelete 
}: {
  isAdmin: boolean;
  district: string;
  vendors: Vendor[];
  allVendors: Vendor[];
  onAdd: (v: Vendor) => void;
  onUpdate: (v: Vendor) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [name, setName] = useState("");
  const [dist, setDist] = useState(isAdmin ? "" : district);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [bizType, setBizType] = useState("Hardware");
  const [address, setAddress] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [regYear, setRegYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterBizType, setFilterBizType] = useState("");

  const filtered = vendors.filter(v => {
    const matchSearch = 
      v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
      (v.mobile || "").includes(search);
    
    const matchDistrict = !filterDistrict || v.district === filterDistrict;
    const matchBizType = !filterBizType || v.businessType === filterBizType;

    return matchSearch && matchDistrict && matchBizType;
  });

  const autoCode = dist && bizType && regYear 
    ? genVendorCode(dist, bizType, regYear, allVendors) 
    : "";

  const handleAdd = () => {
    if (!name.trim() || !dist || !mobile) {
      alert("❌ Name, District, and Mobile are required!");
      return;
    }

    const vendor: Vendor = {
      id: genId("V"),
      vendorCode: autoCode,
      vendorName: sanitizeInput(name),
      district: dist,
      mobile: sanitizeInput(mobile),
      email: sanitizeInput(email),
      businessType: bizType,
      address: sanitizeInput(address),
      gstNo: sanitizeInput(gstNo),
      regYear
    };

    onAdd(vendor);
    
    // Reset form
    setName("");
    setMobile("");
    setEmail("");
    setAddress("");
    setGstNo("");
    setDist(isAdmin ? "" : district);
    setShowForm(false);
  };

  const handleEditSave = () => {
    if (!editVendor) return;
    onUpdate(editVendor);
    setEditVendor(null);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏢 Vendor Management</h1>
          <p className="text-sm text-gray-500">{filtered.length} vendors found</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
          + New Vendor
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">புதிய Vendor சேர்</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Sri Balaji Hardwares"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input 
                value={mobile} 
                onChange={e => setMobile(e.target.value)} 
                placeholder="9876543210" 
                maxLength={10}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Email</label>
              <input 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="vendor@example.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Business Type</label>
              <select 
                value={bizType} 
                onChange={e => setBizType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              {isAdmin ? (
                <>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={dist} 
                    onChange={e => setDist(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                    <option value="">Select District</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">District</label>
                  <input 
                    value={district} 
                    disabled 
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500" 
                  />
                </>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Registration Year</label>
              <input 
                value={regYear} 
                onChange={e => setRegYear(e.target.value)} 
                placeholder="2025"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">GST Number</label>
              <input 
                value={gstNo} 
                onChange={e => setGstNo(e.target.value.toUpperCase())} 
                placeholder="33AAAAA0000A1Z5"
                maxLength={15}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-600 mb-1 block font-medium">Address</label>
              <input 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Shop No, Street, City, Pincode"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
              />
            </div>
          </div>

          {autoCode && (
            <div className="p-4 rounded-lg flex items-center gap-3" 
              style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <span className="text-sm text-blue-700 font-medium">🔑 Auto-Generated Code:</span>
              <span className="font-bold text-blue-900 font-mono text-lg">{autoCode}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={handleAdd}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: "#16a34a" }}>
              💾 Save Vendor
            </button>
            <button 
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="🔍 Search by name, code, or mobile..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
          />

          {isAdmin && (
            <>
              <select 
                value={filterDistrict} 
                onChange={e => setFilterDistrict(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">All Districts</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select 
                value={filterBizType} 
                onChange={e => setFilterBizType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">All Business Types</option>
                {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Code", "Vendor Name", "Mobile", "Email", "Business", "District", "GST No", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-bold">{v.vendorCode}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{v.vendorName}</p>
                    {v.address && <p className="text-xs text-gray-400 mt-1">{v.address}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{v.mobile || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{v.email || "—"}</td>
                  <td className="px-4 py-3">
                    {v.businessType && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                        {v.businessType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{v.district}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.gstNo || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditVendor({...v})} 
                        className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => onDelete(v.id)} 
                        className="px-3 py-1.5 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400">No vendors found</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editVendor && (
        <div className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit Vendor</h3>
              <button 
                onClick={() => setEditVendor(null)} 
                className="text-gray-400 hover:text-gray-600 text-2xl">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Vendor Name</label>
                <input 
                  value={editVendor.vendorName} 
                  onChange={e => setEditVendor({...editVendor, vendorName: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Mobile</label>
                <input 
                  value={editVendor.mobile || ""} 
                  onChange={e => setEditVendor({...editVendor, mobile: e.target.value})}
                  maxLength={10}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Email</label>
                <input 
                  type="email"
                  value={editVendor.email || ""} 
                  onChange={e => setEditVendor({...editVendor, email: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Business Type</label>
                <select 
                  value={editVendor.businessType || ""} 
                  onChange={e => setEditVendor({...editVendor, businessType: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">GST Number</label>
                <input 
                  value={editVendor.gstNo || ""} 
                  onChange={e => setEditVendor({...editVendor, gstNo: e.target.value.toUpperCase})}
                  maxLength={15}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Address</label>
                <input 
                  value={editVendor.address || ""} 
                  onChange={e => setEditVendor({...editVendor, address: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button 
                  onClick={handleEditSave}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" 
                  style={{ background: "#16a34a" }}>
                  💾 Save Changes
                </button>
                <button 
                  onClick={() => setEditVendor(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">
                  Cancel
                </button>
              </div>
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
function TransactionsPage({ 
  isAdmin, 
  district, 
  transactions, 
  vendors, 
  bills, 
  onAdd, 
  onClose, 
  onUpdate, 
  onDelete 
}: {
  isAdmin: boolean;
  district: string;
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  onAdd: (t: Transaction, advance: number) => void;
  onClose: (id: string) => void;
  onUpdate: (t: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  
  const [vendorCode, setVendorCode] = useState("");
  const [fy, setFy] = useState("2025-26");
  const [month, setMonth] = useState("April");
  const [expectedAmt, setExpectedAmt] = useState("");
  const [advanceAmt, setAdvanceAmt] = useState("");
  const [gstPct, setGstPct] = useState(4);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const myVendors = isAdmin ? vendors : vendors.filter(v => v.district === district);
  
  const filtered = transactions.filter(t => {
    const matchSearch = 
      t.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      t.txnId.toLowerCase().includes(search.toLowerCase()) ||
      t.district.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = !statusFilter || t.status === statusFilter;
    
    return matchSearch && matchStatus;
  });

  const getTxnBills = (txnId: string) => bills.filter(b => b.txnId === txnId);

  const handleAdd = () => {
    const vendor = vendors.find(v => v.vendorCode === vendorCode);
    if (!vendor) {
      alert("❌ Please select a vendor!");
      return;
    }
    
    if (!expectedAmt || parseFloat(expectedAmt) <= 0) {
      alert("❌ Please enter valid expected amount!");
      return;
    }

    const expected = parseFloat(expectedAmt);
    const advance = parseFloat(advanceAmt) || 0;

    if (advance > expected * 0.2) {
      alert("⚠️ Advance cannot exceed 20% of expected amount!");
      return;
    }

    const gstAmt = round2(expected * gstPct / 100);
    const gstBal = round2(gstAmt - advance);
    const txnId = genId("TXN");
    
    const txn: Transaction = {
      id: genId("T"),
      txnId,
      district: vendor.district,
      vendorCode,
      vendorName: vendor.vendorName,
      financialYear: fy,
      month,
      expectedAmount: expected,
      advanceAmount: advance,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      gstBalance: gstBal,
      billsReceived: 0,
      remainingExpected: expected,
      status: "Open",
      closedByDistrict: false,
      confirmedByAdmin: false,
      profit: 0
    };

    onAdd(txn, advance);
    
    // Reset form
    setVendorCode("");
    setExpectedAmt("");
    setAdvanceAmt("");
    setShowForm(false);
  };

  const handleEditSave = () => {
    if (!editTxn) return;
    
    const gstAmt = round2(editTxn.expectedAmount * editTxn.gstPercent / 100);
    const gstBal = round2(gstAmt - editTxn.advanceAmount);
    
    onUpdate({ ...editTxn, gstAmount: gstAmt, gstBalance: gstBal });
    setEditTxn(null);
  };

  const previewGST = expectedAmt ? round2(parseFloat(expectedAmt) * gstPct / 100) : 0;
  const previewBalance = previewGST - (parseFloat(advanceAmt) || 0);

  const totalExpected = filtered.reduce((s, t) => s + t.expectedAmount, 0);
  const totalGST = filtered.reduce((s, t) => s + t.gstAmount, 0);
  const totalBillsReceived = filtered.reduce((s, t) => s + t.billsReceived, 0);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Monthly Transactions</h1>
          <p className="text-sm text-gray-500">{filtered.length} transactions</p>
        </div>
        {!isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            + New Transaction
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">புதிய Transaction</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select 
                value={vendorCode} 
                onChange={e => setVendorCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">Select Vendor</option>
                {myVendors.map(v => (
                  <option key={v.id} value={v.vendorCode}>
                    {v.vendorName} ({v.vendorCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Financial Year</label>
              <select 
                value={fy} 
                onChange={e => setFy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {FY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Month</label>
              <select 
                value={month} 
                onChange={e => setMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Expected Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                value={expectedAmt} 
                onChange={e => setExpectedAmt(e.target.value)}
                placeholder="300950"
                min="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Advance (GST Only) (₹)
              </label>
              <input 
                type="number" 
                value={advanceAmt} 
                onChange={e => setAdvanceAmt(e.target.value)}
                placeholder="5000"
                min="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
              <select 
                value={gstPct} 
                onChange={e => setGstPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>

          {expectedAmt && (
            <div className="p-4 rounded-lg text-sm space-y-2" 
              style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <p className="text-blue-700 font-medium">Preview Calculation:</p>
              <p className="text-blue-700">
                GST Amount: {fmt(parseFloat(expectedAmt))} × {gstPct}% = <strong>{fmt(previewGST)}</strong>
              </p>
              <p className="text-blue-700">
                GST Balance: {fmt(previewGST)} − {fmt(parseFloat(advanceAmt) || 0)} = <strong>{fmt(previewBalance)}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={handleAdd}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: "#16a34a" }}>
              💾 Save Transaction
            </button>
            <button 
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="🔍 Search by TXN ID, vendor name, or district..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" 
          />

          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Status</option>
            <option value="Open">Open</option>
            <option value="PendingClose">Pending Close</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Expected</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalExpected)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Total GST</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{fmt(totalGST)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Bills Received</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalBillsReceived)}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["TXN ID", "Vendor", "Month/FY", "Expected", "GST", "Advance", "Bills", "Remaining", "Status", "Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => {
                const txnBills = getTxnBills(t.txnId);
                const canClose = t.remainingExpected <= 0 && t.status === "Open";

                return (
                  <tr key={t.txnId} 
                    className={`hover:bg-gray-50 transition-colors ${
                      t.status === "PendingClose" ? "bg-red-50" : 
                      t.status === "Closed" ? "bg-green-50" : ""
                    }`}>
                    <td className="px-3 py-3 font-mono text-xs text-blue-700 font-bold">{t.txnId}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-800">{t.vendorName}</p>
                      <p className="text-xs text-gray-400">{t.district}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="text-gray-700">{t.month}</p>
                      <p className="text-gray-400">{t.financialYear}</p>
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-800">{fmt(t.expectedAmount)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-purple-700">{fmt(t.gstAmount)}</p>
                      <p className="text-xs text-gray-400">{t.gstPercent}%</p>
                    </td>
                    <td className="px-3 py-3 text-orange-600 font-semibold">{fmt(t.advanceAmount)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-green-700">{fmt(t.billsReceived)}</p>
                      <p className="text-xs text-gray-400">{txnBills.length} bills</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-bold ${
                        t.remainingExpected <= 0 ? "text-green-600" : "text-orange-600"
                      }`}>
                        {t.remainingExpected <= 0 ? "₹0 ✅" : fmt(t.remainingExpected)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        t.status === "Closed" ? "bg-green-100 text-green-700" :
                        t.status === "PendingClose" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {t.status === "PendingClose" ? "🔴 Pending" : t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {t.status === "Open" && (
                          <button 
                            onClick={() => setEditTxn({...t})} 
                            className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200">
                            ✏️
                          </button>
                        )}
                        <button 
                          onClick={() => onDelete(t.txnId)} 
                          className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">
                          🗑️
                        </button>
                        {!isAdmin && t.status === "Open" && (
                          <button 
                            onClick={() => setConfirmClose(t.txnId)}
                            className={`px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap ${
                              canClose ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 hover:bg-gray-500"
                            }`}>
                            {canClose ? "✅ Close" : "⚠️ Force"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={3} className="px-3 py-3 font-bold text-yellow-300 text-xs">
                    மொத்தம் ({filtered.length} transactions)
                  </td>
                  <td className="px-3 py-3 font-bold text-yellow-300">{fmt(totalExpected)}</td>
                  <td className="px-3 py-3 font-bold text-purple-300">{fmt(totalGST)}</td>
                  <td colSpan={2} className="px-3 py-3 font-bold text-green-300">{fmt(totalBillsReceived)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400">No transactions found</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editTxn && (
        <div className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit Transaction</h3>
              <button onClick={() => setEditTxn(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Expected Amount (₹)</label>
                  <input 
                    type="number" 
                    value={editTxn.expectedAmount}
                    onChange={e => setEditTxn({...editTxn, expectedAmount: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Advance (₹)</label>
                  <input 
                    type="number" 
                    value={editTxn.advanceAmount}
                    onChange={e => setEditTxn({...editTxn, advanceAmount: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
                  <select 
                    value={editTxn.gstPercent}
                    onChange={e => setEditTxn({...editTxn, gstPercent: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Month</label>
                  <select 
                    value={editTxn.month}
                    onChange={e => setEditTxn({...editTxn, month: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button 
                  onClick={handleEditSave}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" 
                  style={{ background: "#16a34a" }}>
                  💾 Save Changes
                </button>
                <button 
                  onClick={() => setEditTxn(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirm Modal */}
      {confirmClose && (
        <div className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-800 text-lg mb-3">Transaction Close உறுதிப்படுத்தல்</h3>
            {(() => {
              const txn = transactions.find(t => t.txnId === confirmClose);
              if (!txn) return null;
              const gstBal = round2(txn.gstAmount - txn.advanceAmount);
              return (
                <div className="space-y-3 text-sm mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Vendor: <strong className="text-gray-800">{txn.vendorName}</strong></p>
                    <p className="text-gray-600">Expected: <strong className="text-gray-800">{fmt(txn.expectedAmount)}</strong></p>
                    <p className="text-gray-600">GST Balance Debit: <strong className="text-red-600">{fmt(gstBal)}</strong></p>
                  </div>
                  <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    ℹ️ Admin confirmation-க்கு 🔴 Alert போகும். Admin confirm செய்தால் 8% profit wallet-ல் credit ஆகும்.
                  </p>
                </div>
              );
            })()}
            <div className="flex gap-3">
              <button 
                onClick={() => { onClose(confirmClose); setConfirmClose(null); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" 
                style={{ background: "#dc2626" }}>
                ✅ Close Confirm
              </button>
              <button 
                onClick={() => setConfirmClose(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BILLS PAGE (Continuing from previous...)
// ============================================================
function BillsPage({ 
  isAdmin, 
  district, 
  bills, 
  transactions, 
  vendors, 
  onAdd, 
  onUpdate, 
  onDelete 
}: {
  isAdmin: boolean;
  district: string;
  bills: Bill[];
  transactions: Transaction[];
  vendors: Vendor[];
  onAdd: (b: Bill) => void;
  onUpdate: (b: Bill) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
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

  const handleAdd = () => {
    if (!txnId || !billAmt || !billNo) {
      alert("❌ Please fill all required fields!");
      return;
    }

    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) {
      alert("❌ Transaction not found!");
      return;
    }

    if (parseFloat(billAmt) <= 0) {
      alert("❌ Bill amount must be positive!");
      return;
    }

    const amt = parseFloat(billAmt);
    const gstAmt = round2(amt * gstPct / 100);
    const total = round2(amt * BILL_TOTAL_RATE);
    
    const bill: Bill = {
      id: genId("B"),
      txnId,
      vendorCode: txn.vendorCode,
      vendorName: txn.vendorName,
      district: txn.district,
      billNumber: sanitizeInput(billNo),
      billDate,
      billAmount: amt,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      totalAmount: total
    };

    onAdd(bill);
    
    // Reset form
    setBillNo("");
    setBillAmt("");
    setShowForm(false);
  };

  const handleEditSave = () => {
    if (!editBill) return;
    
    const gstAmt = round2(editBill.billAmount * editBill.gstPercent / 100);
    const total = round2(editBill.billAmount * BILL_TOTAL_RATE);
    
    onUpdate({ ...editBill, gstAmount: gstAmt, totalAmount: total });
    setEditBill(null);
  };

  const previewBillAmt = parseFloat(billAmt) || 0;
  const previewGST = round2(previewBillAmt * gstPct / 100);
  const previewTotal = round2(previewBillAmt * BILL_TOTAL_RATE);

  const totalBillAmt = filtered.reduce((s, b) => s + b.billAmount, 0);
  const totalGST = filtered.reduce((s, b) => s + b.gstAmount, 0);
  const totalAmt = filtered.reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🧾 Bill Management</h1>
          <p className="text-sm text-gray-500">GST = Bill×GST% | Total = Bill×1.18</p>
        </div>
        {!isAdmin && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            + New Bill
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">🧾 புதிய GST Bill சேர்</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Transaction (TXN) <span className="text-red-500">*</span>
              </label>
              <select 
                value={txnId} 
                onChange={e => setTxnId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">Select Transaction</option>
                {openTxns.map(t => (
                  <option key={t.txnId} value={t.txnId}>
                    {t.txnId} — {t.vendorName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Bill Number <span className="text-red-500">*</span>
              </label>
              <input 
                value={billNo} 
                onChange={e => setBillNo(e.target.value)} 
                placeholder="ALB/2026/001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Date</label>
              <input 
                type="date" 
                value={billDate} 
                onChange={e => setBillDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Bill Amount (Taxable ₹) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                value={billAmt} 
                onChange={e => setBillAmt(e.target.value)} 
                placeholder="76664"
                min="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
              <select 
                value={gstPct} 
                onChange={e => setGstPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>

          {billAmt && (
            <div className="p-4 rounded-lg text-sm space-y-2" 
              style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <p className="text-blue-700 font-medium">Preview Calculation:</p>
              <p className="text-blue-700">
                GST தொகை: {fmt(previewBillAmt)} × {gstPct}% = <strong>{fmt(previewGST)}</strong>
              </p>
              <p className="text-blue-700">
                Total Amount: {fmt(previewBillAmt)} × 18% = <strong>{fmt(previewTotal)}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={handleAdd}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: "#16a34a" }}>
              💾 Save Bill
            </button>
            <button 
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
        placeholder="🔍 Search bills by vendor, bill number, or TXN ID..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white" 
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Bill Amount</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalBillAmt)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Total GST</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{fmt(totalGST)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Amount</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalAmt)}</p>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Bill ID", "TXN ID", "Vendor", "Bill Number", "Date", "Bill Amt", "GST%", "GST தொகை", "Total", "Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-blue-700 font-bold">{b.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">{b.txnId}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-gray-800">{b.vendorName}</p>
                    <p className="text-xs text-gray-400">{b.vendorCode}</p>
                  </td>
                  <td className="px-3 py-3 text-gray-800 font-medium">{b.billNumber}</td>
                  <td className="px-3 py-3 text-gray-600 text-xs">{b.billDate}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{fmt(b.billAmount)}</td>
                  <td className="px-3 py-3 text-gray-600">{b.gstPercent}%</td>
                  <td className="px-3 py-3 font-semibold text-purple-700">{fmt(b.gstAmount)}</td>
                  <td className="px-3 py-3 font-semibold text-green-700">{fmt(b.totalAmount)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setEditBill({...b})} 
                        className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200">
                        ✏️
                      </button>
                      <button 
                        onClick={() => onDelete(b.id)} 
                        className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={5} className="px-3 py-3 font-bold text-yellow-300 text-xs">
                    மொத்தம் ({filtered.length} bills)
                  </td>
                  <td className="px-3 py-3 font-bold text-yellow-300">{fmt(totalBillAmt)}</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 font-bold text-purple-300">{fmt(totalGST)}</td>
                  <td className="px-3 py-3 font-bold text-green-300">{fmt(totalAmt)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400">No bills found</p>
          )}
        </div>
      </div>

      {/* Edit Bill Modal */}
      {editBill && (
        <div className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit Bill</h3>
              <button onClick={() => setEditBill(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Number</label>
                <input 
                  value={editBill.billNumber} 
                  onChange={e => setEditBill({...editBill, billNumber: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Date</label>
                <input 
                  type="date" 
                  value={editBill.billDate} 
                  onChange={e => setEditBill({...editBill, billDate: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Amount (₹)</label>
                <input 
                  type="number" 
                  value={editBill.billAmount} 
                  onChange={e => setEditBill({...editBill, billAmount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
                <select 
                  value={editBill.gstPercent} 
                  onChange={e => setEditBill({...editBill, gstPercent: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="p-3 rounded-lg text-xs space-y-1 bg-blue-50 border border-blue-200">
                <p className="font-bold text-blue-800">🔒 Calculated Values</p>
                <p className="text-blue-700">
                  GST: {fmt(editBill.billAmount)} × {editBill.gstPercent}% = <strong>{fmt(round2(editBill.billAmount * editBill.gstPercent / 100))}</strong>
                </p>
                <p className="text-blue-700">
                  Total: {fmt(editBill.billAmount)} × 18% = <strong>{fmt(round2(editBill.billAmount * BILL_TOTAL_RATE))}</strong>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleEditSave}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" 
                  style={{ background: "#16a34a" }}>
                  💾 Save Changes
                </button>
                <button 
                  onClick={() => setEditBill(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ============================================================
// WALLET PAGE
// ============================================================
function WalletPage({ 
  wallet, 
  balance, 
  onManualEntry, 
  onSetBalance 
}: {
  wallet: WalletEntry[];
  balance: number;
  onManualEntry: (desc: string, debit: number, credit: number) => void;
  onSetBalance: (n: number) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [editMode, setEditMode] = useState<"set" | "manual">("set");
  const [newBal, setNewBal] = useState("");
  const [desc, setDesc] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const totalDebit = wallet.reduce((s, w) => s + w.debit, 0);
  const totalCredit = wallet.reduce((s, w) => s + w.credit, 0);
  const totalProfit = wallet.filter(w => w.type === "profit").reduce((s, w) => s + w.credit, 0);
  const totalAdvance = wallet.filter(w => w.type === "advance").reduce((s, w) => s + w.debit, 0);
  const totalGST = wallet.filter(w => w.type === "gst").reduce((s, w) => s + w.debit, 0);

  const filtered = wallet.filter(w => {
    const matchSearch = w.description.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || w.type === typeFilter;
    return matchSearch && matchType;
  });

  const typeBadge = (t: WalletEntry["type"]) => {
    switch(t) {
      case "profit": return "bg-green-100 text-green-700";
      case "advance": return "bg-orange-100 text-orange-700";
      case "gst": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const exportCSV = () => {
    const headers = ["Date", "Description", "Type", "Debit", "Credit", "Balance"];
    const rows = wallet.map(w => [
      w.date, 
      w.description, 
      w.type, 
      w.debit.toString(), 
      w.credit.toString(), 
      w.balance.toString()
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_Wallet_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💰 Admin Main Wallet</h1>
          <p className="text-sm text-gray-500">Central finance management</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportCSV}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">
            📥 Export CSV
          </button>
          <button 
            onClick={() => setShowEdit(!showEdit)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}>
            ✏️ Wallet Edit
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="rounded-xl p-6 text-white" 
        style={{ background: "linear-gradient(135deg, #0a1628, #1a2f5e)" }}>
        <p className="text-sm text-gray-300">Current Wallet Balance</p>
        <p className="text-5xl font-bold mt-2" style={{ color: "#f0d060" }}>{fmt(balance)}</p>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
          <div>
            <p className="text-xs text-gray-400">Total Invested</p>
            <p className="font-bold text-xl text-white mt-1">{fmt(totalCredit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Debited</p>
            <p className="font-bold text-xl text-red-300 mt-1">{fmt(totalDebit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Profit</p>
            <p className="font-bold text-xl text-green-300 mt-1">{fmt(totalProfit)}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Advance Paid</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">{fmt(totalAdvance)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">GST Settled</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{fmt(totalGST)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">8% Profit Earned</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{fmt(totalProfit)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Net Transactions</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{wallet.length}</p>
        </div>
      </div>

      {/* Edit Panel */}
      {showEdit && (
        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-amber-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">✏️ Wallet Edit / Manual Entry</h2>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setEditMode("set")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                editMode === "set" ? "text-white" : "text-gray-600 border-2 border-gray-300"
              }`}
              style={editMode === "set" ? { background: "#1a2f5e" } : {}}>
              🏦 Balance மாற்று
            </button>
            <button 
              onClick={() => setEditMode("manual")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                editMode === "manual" ? "text-white" : "text-gray-600 border-2 border-gray-300"
              }`}
              style={editMode === "manual" ? { background: "#1a2f5e" } : {}}>
              ➕ Manual Entry
            </button>
          </div>

          {editMode === "set" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Current Balance: <strong className="text-xl">{fmt(balance)}</strong>
              </p>
              <input 
                type="number" 
                value={newBal} 
                onChange={e => setNewBal(e.target.value)}
                placeholder="New balance amount"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
              <button 
                onClick={() => { 
                  if (newBal) { 
                    onSetBalance(parseFloat(newBal)); 
                    setNewBal(""); 
                    setShowEdit(false); 
                  } 
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#16a34a" }}>
                Update Balance
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input 
                value={desc} 
                onChange={e => setDesc(e.target.value)} 
                placeholder="Description (e.g., Office expense)"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="number" 
                  value={debit} 
                  onChange={e => setDebit(e.target.value)} 
                  placeholder="Debit Amount (−)"
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-red-200 text-sm outline-none focus:border-red-400" 
                />
                <input 
                  type="number" 
                  value={credit} 
                  onChange={e => setCredit(e.target.value)} 
                  placeholder="Credit Amount (+)"
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-green-200 text-sm outline-none focus:border-green-400" 
                />
              </div>
              <button 
                onClick={() => {
                  if (desc) {
                    onManualEntry(desc, parseFloat(debit) || 0, parseFloat(credit) || 0);
                    setDesc(""); 
                    setDebit(""); 
                    setCredit(""); 
                    setShowEdit(false);
                  }
                }} 
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#16a34a" }}>
                Add Entry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="🔍 Search by description..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
          />
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Types</option>
            <option value="profit">Profit</option>
            <option value="advance">Advance</option>
            <option value="gst">GST</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      {/* Wallet Ledger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">📒 Wallet Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Date", "Description", "Type", "Debit (−)", "Credit (+)", "Balance"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...filtered].reverse().map(w => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">{w.date}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{w.description}</p>
                    {w.createdBy && (
                      <p className="text-xs text-gray-400 mt-1">By: {w.createdBy}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeBadge(w.type)}`}>
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
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400">No wallet entries found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ANALYTICS PAGE
// ============================================================
function AnalyticsPage({ 
  transactions, 
  bills, 
  vendors, 
  wallet 
}: {
  transactions: Transaction[];
  bills: Bill[];
  vendors: Vendor[];
  wallet: WalletEntry[];
}) {
  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsAmt = bills.reduce((s, b) => s + b.billAmount, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const totalProfit = transactions.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);
  const walletBalance = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;

  const districtSummary = DISTRICTS.map(d => {
    const dTxns = transactions.filter(t => t.district === d);
    const dBills = bills.filter(b => b.district === d);
    return {
      district: d,
      txnCount: dTxns.length,
      expected: dTxns.reduce((s, t) => s + t.expectedAmount, 0),
      gst: dTxns.reduce((s, t) => s + t.gstAmount, 0),
      bills: dBills.reduce((s, b) => s + b.billAmount, 0),
      profit: dTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
      closed: dTxns.filter(t => t.status === "Closed").length,
    };
  }).filter(d => d.txnCount > 0).sort((a, b) => b.expected - a.expected);

  const monthSummary = MONTHS.map(month => {
    const mTxns = transactions.filter(t => t.month === month);
    return {
      month,
      txnCount: mTxns.length,
      expected: mTxns.reduce((s, t) => s + t.expectedAmount, 0),
      profit: mTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0)
    };
  }).filter(m => m.txnCount > 0);

  const exportDistrictCSV = () => {
    const headers = ["District", "Transactions", "Expected", "GST", "Bills", "Profit", "Closed"];
    const rows = districtSummary.map(d => [
      d.district, 
      d.txnCount.toString(), 
      d.expected.toString(), 
      d.gst.toString(), 
      d.bills.toString(),
      d.profit.toString(),
      `${d.closed}/${d.txnCount}`
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_District_Report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Master financial overview — All districts</p>
        </div>
        <button 
          onClick={exportDistrictCSV}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">
          📥 Export District Report
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Expected", value: fmt(totalExpected), color: "#1a2f5e" },
          { label: "Bills Received", value: fmt(totalBillsAmt), color: "#15803d" },
          { label: "Total GST", value: fmt(totalGST), color: "#7c3aed" },
          { label: "8% Profit Earned", value: fmt(totalProfit), color: "#b45309" },
          { label: "Wallet Balance", value: fmt(walletBalance), color: "#c9a227" },
          { label: "Total Vendors", value: vendors.length.toString(), color: "#374151" },
          { label: "Total Transactions", value: transactions.length.toString(), color: "#0369a1" },
          { label: "Total Bills", value: bills.length.toString(), color: "#dc2626" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-500 uppercase font-medium">{stat.label}</p>
            <p className="text-2xl font-bold mt-2" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      {monthSummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">📆 Monthly Trend</h2>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-40">
              {monthSummary.map(m => {
                const maxExpected = Math.max(...monthSummary.map(x => x.expected));
                const height = maxExpected > 0 ? (m.expected / maxExpected * 100) : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full rounded-t-lg transition-all hover:opacity-80"
                      style={{ 
                        height: `${height}%`, 
                        background: "linear-gradient(180deg, #1a2f5e, #2a4f9e)",
                        minHeight: "10px"
                      }}
                      title={`${m.month}: ${fmt(m.expected)}`}
                    />
                    <p className="text-xs text-gray-500 truncate w-full text-center">{m.month.slice(0,3)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* District Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">🏛️ District-wise Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["#", "District", "Txns", "Expected ₹", "GST Amt", "Bills ₹", "Profit", "Closed"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {districtSummary.map((d, i) => (
                <tr key={d.district} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-bold">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">🏛️ {d.district}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      {d.txnCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(d.expected)}</td>
                  <td className="px-4 py-3 text-purple-700 font-semibold">{fmt(d.gst)}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">{fmt(d.bills)}</td>
                  <td className="px-4 py-3 text-amber-600 font-semibold">
                    {d.profit > 0 ? fmt(d.profit) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      d.closed > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {d.closed}/{d.txnCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {districtSummary.length === 0 && (
            <p className="text-center py-12 text-gray-400">No district data</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORTS PAGE (For District Users)
// ============================================================
function ReportsPage({ 
  transactions, 
  bills, 
  vendors, 
  district 
}: {
  transactions: Transaction[];
  bills: Bill[];
  vendors: Vendor[];
  district: string;
}) {
  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsAmt = transactions.reduce((s, t) => s + t.billsReceived, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const openTxns = transactions.filter(t => t.status === "Open").length;
  const closedTxns = transactions.filter(t => t.status === "Closed").length;
  const pendingTxns = transactions.filter(t => t.status === "PendingClose").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📄 {district} — Reports</h1>
        <p className="text-sm text-gray-500">District performance overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Vendors</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#1a2f5e" }}>{vendors.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Transactions</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#0369a1" }}>{transactions.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-blue-600">Open: {openTxns}</span> | 
            <span className="text-orange-600"> Pending: {pendingTxns}</span> | 
            <span className="text-green-600"> Closed: {closedTxns}</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Expected</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#b45309" }}>{fmt(totalExpected)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Bills Received</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#15803d" }}>{fmt(totalBillsAmt)}</p>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">📆 Monthly Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                {["Month", "Transactions", "Expected", "Bills Received", "Remaining"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MONTHS.map(month => {
                const mTxns = transactions.filter(t => t.month === month);
                if (mTxns.length === 0) return null;
                const expected = mTxns.reduce((s, t) => s + t.expectedAmount, 0);
                const billsAmt = mTxns.reduce((s, t) => s + t.billsReceived, 0);
                const remaining = mTxns.reduce((s, t) => s + t.remainingExpected, 0);
                return (
                  <tr key={month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{month}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                        {mTxns.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-semibold">{fmt(expected)}</td>
                    <td className="px-4 py-3 text-green-700 font-semibold">{fmt(billsAmt)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${remaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {remaining <= 0 ? '₹0 ✅' : fmt(remaining)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// USER MANAGEMENT PAGE
// ============================================================
function UserManagementPage({ 
  districtUsers, 
  onAddUser, 
  onUpdateUser, 
  onToggleUser, 
  onDeleteUser 
}: {
  districtUsers: ManagedUser[];
  onAddUser: (u: ManagedUser) => void;
  onUpdateUser: (u: ManagedUser) => void;
  onToggleUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [showPassIds, setShowPassIds] = useState<string[]>([]);
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [dist, setDist] = useState("");
  const [search, setSearch] = useState("");

  const filtered = districtUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.district.toLowerCase().includes(search.toLowerCase())
  );

  const toggleShowPass = (id: string) => {
    setShowPassIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    if (!uname || !pass || !dist) {
      alert("❌ Please fill all fields!");
      return;
    }

    if (districtUsers.some(u => u.username === uname)) {
      alert("❌ Username already exists!");
      return;
    }

    const newUser: ManagedUser = {
      id: genId("U"),
      username: sanitizeInput(uname),
      password: pass,
      district: dist,
      active: true,
      createdAt: new Date().toISOString().split("T")[0]
    };

    onAddUser(newUser);
    setUname("");
    setPass("");
    setDist("");
    setShowForm(false);
  };

  const handleEditSave = () => {
    if (!editUser) return;
    onUpdateUser(editUser);
    setEditUser(null);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👥 User Management</h1>
          <p className="text-sm text-gray-500">District user accounts</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
          + New User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Total Districts</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{DISTRICTS.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Active Users</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {districtUsers.filter(u => u.active).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Inactive Users</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {districtUsers.filter(u => !u.active).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Total Users</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">{districtUsers.length}</p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">புதிய User சேர்</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                District <span className="text-red-500">*</span>
              </label>
              <select 
                value={dist} 
                onChange={e => setDist(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">Select District</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Username <span className="text-red-500">*</span>
              </label>
              <input 
                value={uname} 
                onChange={e => setUname(e.target.value.toLowerCase())} 
                placeholder="district_user"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">
                Password <span className="text-red-500">*</span>
              </label>
              <input 
                type="password" 
                value={pass} 
                onChange={e => setPass(e.target.value)} 
                placeholder="Strong password"
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleAdd}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#16a34a" }}>
              Create User
            </button>
            <button 
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
        placeholder="🔍 Search users..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-blue-500 bg-white" 
      />

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["#", "Username", "District", "Password", "Status", "Created", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u, i) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "bg-red-50/50" : ""}`}>
                  <td className="px-4 py-3 text-gray-400 text-xs font-bold">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-blue-700">{u.username}</td>
                  <td className="px-4 py-3 text-gray-700">🏛️ {u.district}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">
                        {showPassIds.includes(u.id) ? u.password : "••••••••"}
                      </span>
                      <button 
                        onClick={() => toggleShowPass(u.id)}
                        className="text-xs text-gray-400 hover:text-gray-600">
                        {showPassIds.includes(u.id) ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {u.active ? "✅ Active" : "❌ Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditUser({...u})}
                        className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200">
                        ✏️
                      </button>
                      <button 
                        onClick={() => onToggleUser(u.id)}
                        className={`px-2 py-1 rounded text-xs font-semibold text-white ${
                          u.active ? "bg-orange-500" : "bg-green-500"
                        }`}>
                        {u.active ? "🔴" : "🟢"}
                      </button>
                      <button 
                        onClick={() => onDeleteUser(u.id)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-gray-400">No users found</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit User</h3>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Username</label>
                <input 
                  value={editUser.username} 
                  onChange={e => setEditUser({...editUser, username: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">New Password</label>
                <input 
                  type="text" 
                  value={editUser.password} 
                  onChange={e => setEditUser({...editUser, password: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">District</label>
                <select 
                  value={editUser.district} 
                  onChange={e => setEditUser({...editUser, district: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button 
                  onClick={handleEditSave}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" 
                  style={{ background: "#16a34a" }}>
                  💾 Save Changes
                </button>
                <button 
                  onClick={() => setEditUser(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AUDIT LOGS PAGE
// ============================================================
function AuditLogsPage({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const filtered = logs.filter(log => {
    const matchSearch = 
      log.user.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || log.action === actionFilter;
    const matchEntity = !entityFilter || log.entity === entityFilter;
    return matchSearch && matchAction && matchEntity;
  });

  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  ).reverse();

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const actionBadge = (action: AuditLog['action']) => {
    switch(action) {
      case "CREATE": return "bg-green-100 text-green-700";
      case "UPDATE": return "bg-blue-100 text-blue-700";
      case "DELETE": return "bg-red-100 text-red-700";
      case "CLOSE": return "bg-orange-100 text-orange-700";
      case "CONFIRM": return "bg-purple-100 text-purple-700";
      case "LOGIN": return "bg-cyan-100 text-cyan-700";
      case "LOGOUT": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const entityIcon = (entity: AuditLog['entity']) => {
    switch(entity) {
      case "Transaction": return "📋";
      case "Vendor": return "🏢";
      case "Bill": return "🧾";
      case "Wallet": return "💰";
      case "User": return "👤";
      default: return "📄";
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📜 Audit Logs</h1>
        <p className="text-sm text-gray-500">Complete activity trail — {filtered.length} entries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Actions", value: logs.length, color: "#1a2f5e" },
          { label: "Creates", value: logs.filter(l => l.action === "CREATE").length, color: "#16a34a" },
          { label: "Updates", value: logs.filter(l => l.action === "UPDATE").length, color: "#0369a1" },
          { label: "Deletes", value: logs.filter(l => l.action === "DELETE").length, color: "#dc2626" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-medium">{stat.label}</p>
            <p className="text-2xl font-bold mt-2" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="🔍 Search by user or entity ID..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" 
          />
          <select 
            value={actionFilter} 
            onChange={e => setActionFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Actions</option>
            {["CREATE", "UPDATE", "DELETE", "CLOSE", "CONFIRM", "LOGIN", "LOGOUT"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select 
            value={entityFilter} 
            onChange={e => setEntityFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Entities</option>
            {["Transaction", "Vendor", "Bill", "Wallet", "User"].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Timestamp", "User", "Action", "Entity", "Entity ID"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{log.user}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${actionBadge(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {entityIcon(log.entity)} {log.entity}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{log.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginated.length === 0 && (
            <p className="text-center py-12 text-gray-400">No audit logs found</p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                ← Prev
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS PAGE
// ============================================================
function SettingsPage({ 
  settings, 
  onUpdateSettings, 
  onBackup, 
  onRestore, 
  onClearData,
  storageUsed 
}: {
  settings: any;
  onUpdateSettings: (s: any) => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
  onClearData: () => void;
  storageUsed: number;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleSave = () => {
    onUpdateSettings(localSettings);
    alert("✅ Settings saved!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestore(file);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ Settings</h1>
        <p className="text-sm text-gray-500">App configuration & data management</p>
      </div>

      {/* Auto Backup */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">💾 Backup & Restore</h2>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-800">Auto Backup Reminder</p>
            <p className="text-xs text-gray-500">Weekly reminder to backup data</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={localSettings.autoBackup}
              onChange={e => setLocalSettings({...localSettings, autoBackup: e.target.checked})}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={onBackup}
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
            📥 Download Backup
          </button>
          
          <label className="px-6 py-3 rounded-lg text-sm font-semibold text-white text-center cursor-pointer transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
            📤 Restore from File
            <input 
              type="file" 
              accept=".json"
              onChange={handleFileUpload}
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">🔔 Notifications</h2>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-800">Browser Notifications</p>
            <p className="text-xs text-gray-500">Get alerts for pending transactions</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={localSettings.browserNotifications}
              onChange={e => setLocalSettings({...localSettings, browserNotifications: e.target.checked})}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">💽 Storage</h2>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-800">Data Usage</p>
            <p className="text-sm text-gray-600">{formatBytes(storageUsed)} / 5 MB</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, (storageUsed / (5 * 1024 * 1024)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-2">
        <h2 className="font-bold text-gray-800 text-lg">ℹ️ App Information</h2>
        <p className="text-sm text-gray-600">Version: <strong>3.0.0</strong></p>
        <p className="text-sm text-gray-600">Build: <strong>Production</strong></p>
        <p className="text-sm text-gray-600">Encryption: <strong>AES-256</strong></p>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200 space-y-4">
        <h2 className="font-bold text-red-700 text-lg">⚠️ Danger Zone</h2>
        <p className="text-sm text-red-600">
          This action will permanently delete all data. This cannot be undone!
        </p>
        <button 
          onClick={onClearData}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">
          🗑️ Clear All Data
        </button>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="px-8 py-3 rounded-lg text-sm font-bold text-white transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>
          💾 Save Settings
        </button>
      </div>
    </div>
  );
}
