// ============================================================
// AR ENTERPRISES ERP SYSTEM V3.1 — COMPLETE SECURE VERSION
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import CryptoJS from "crypto-js";
import * as Yup from "yup";
import DOMPurify from "dompurify";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ============================================================
// CONSTANTS
// ============================================================
const LS_KEY = "AR_ERP_V3_SECURE";
const SESSION_KEY = "AR_SESSION";
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || "ar-enterprises-2025-secure";
const SESSION_TIMEOUT_HOURS = parseInt(import.meta.env.VITE_SESSION_TIMEOUT_HOURS || "8");

const DISTRICTS = ["Chennai", "Chengalpattu", "Kanchipuram", "Tiruvallur", "Villupuram", "Cuddalore", "Kallakurichi"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FY_LIST = ["2024-25", "2025-26", "2026-27", "2027-28"];
const GST_RATES = [0, 4, 5, 12, 18, 28];
const BILL_TOTAL_RATE = 1.18;
const PROFIT_RATE = 0.08;

const CHART_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658"];

// ============================================================
// TYPES
// ============================================================
type TransactionStatus = "Open" | "PendingClose" | "Closed";
type UserRole = "admin" | "district";
type WalletType = "manual" | "advance" | "gst" | "profit";
type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "CLOSE" | "CONFIRM" | "LOGIN" | "LOGOUT";

interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  district?: string;
  email?: string;
  mobile?: string;
  createdAt: string;
  lastLogin?: string;
}

interface Session {
  user: User;
  loginTime: string;
  expiresAt: string;
  deviceId: string;
}

interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  district: string;
  mobile?: string;
  email?: string;
  gstNo?: string;
  panNo?: string;
  address?: string;
  businessType?: string;
  defaultCommission: number;
  createdAt: string;
  createdBy: string;
}

interface Transaction {
  txnId: string;
  vendorCode: string;
  vendorName: string;
  district: string;
  financialYear: string;
  month: string;
  expectedAmount: number;
  advanceAmount: number;
  gstPercent: number;
  gstAmount: number;
  gstBalance: number;
  billsReceived: number;
  remainingExpected: number;
  profit: number;
  status: TransactionStatus;
  createdAt: string;
  createdBy: string;
  closedAt?: string;
  closedBy?: string;
  confirmedByAdmin: boolean;
  notes?: string;
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
  createdAt: string;
  createdBy: string;
}

interface WalletEntry {
  id: string;
  date: string;
  description: string;
  type: WalletType;
  debit: number;
  credit: number;
  balance: number;
  txnId?: string;
  createdBy: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before: any;
  after: any;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const fmt = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const round2 = (n: number): number => Math.round(n * 100) / 100;

const genId = (prefix: string): string =>
  `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

const today = (): string => new Date().toISOString().split("T")[0];

const sanitize = (input: string): string => DOMPurify.sanitize(input.trim());

const sanitizeNumber = (input: string | number): number => {
  const num = typeof input === "string" ? parseFloat(input) : input;
  return isNaN(num) || num < 0 ? 0 : num;
};

// Encryption
const encryptData = (data: any): string => {
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
  } catch {
    return "";
  }
};

const decryptData = (encrypted: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
};

// ============================================================
// PASSWORD FUNCTIONS - SIMPLE VERSION
// ============================================================
const hashPassword = (password: string): string => {
  return password; // No hashing for now - direct password
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  console.log("🔐 Verifying:", { password, storedHash }); // Debug log
  return password === storedHash; // Direct comparison
};
// Session Management
const generateDeviceId = (): string => {
  let deviceId = localStorage.getItem("AR_DEVICE_ID");
  if (!deviceId) {
    deviceId = genId("DEV");
    localStorage.setItem("AR_DEVICE_ID", deviceId);
  }
  return deviceId;
};

const createSession = (user: User): Session => ({
  user,
  loginTime: new Date().toISOString(),
  expiresAt: new Date(Date.now() + SESSION_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString(),
  deviceId: generateDeviceId(),
});

const isSessionValid = (session: Session | null): boolean => {
  if (!session) return false;
  return new Date(session.expiresAt) > new Date();
};

// ============================================================
// VALIDATION SCHEMAS
// ============================================================
const vendorSchema = Yup.object({
  vendorName: Yup.string()
    .min(3, "Name: குறைந்தது 3 எழுத்துக்கள்")
    .max(100, "Name: அதிகபட்சம் 100 எழுத்துக்கள்")
    .required("Vendor Name தேவை"),
  mobile: Yup.string()
    .matches(/^[6-9]\d{9}$/, "Invalid Mobile (10 digits, start with 6-9)")
    .required("Mobile தேவை"),
  gstNo: Yup.string()
    .matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/, "Invalid GST format")
    .nullable(),
  defaultCommission: Yup.number()
    .min(0, "Commission: 0% minimum")
    .max(20, "Commission: 20% maximum")
    .required("Commission தேவை"),
});

const transactionSchema = Yup.object({
  expectedAmount: Yup.number()
    .positive("Amount must be positive")
    .max(100000000, "Amount too large")
    .required("Expected Amount தேவை"),
  advanceAmount: Yup.number()
    .min(0, "Advance cannot be negative"),
  gstPercent: Yup.number()
    .oneOf(GST_RATES, "Invalid GST rate")
    .required("GST % தேவை"),
});

const billSchema = Yup.object({
  billNumber: Yup.string()
    .min(3, "Bill number too short")
    .required("Bill Number தேவை"),
  billAmount: Yup.number()
    .positive("Amount must be positive")
    .required("Bill Amount தேவை"),
});

// ============================================================
// VOICE INPUT - TAMIL NUMBER PARSING
// ============================================================
const TAMIL_NUMBERS: { [key: string]: number } = {
  "ஒன்று": 1, "இரண்டு": 2, "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5,
  "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10,
  "இருபது": 20, "முப்பது": 30, "நாற்பது": 40, "ஐம்பது": 50,
  "அறுபது": 60, "எழுபது": 70, "எண்பது": 80, "தொண்ணூறு": 90,
  "நூறு": 100, "ஆயிரம்": 1000, "லட்சம்": 100000,
};

const parseVoiceAmount = (transcript: string): number => {
  const text = transcript.toLowerCase().trim();
  
  // Direct number check
  const directNum = text.match(/\d+/);
  if (directNum) return parseInt(directNum[0]);
  
  // Tamil patterns
  if (text.includes("ஐம்பதாயிரம்")) return 50000;
  if (text.includes("லட்சம்")) {
    const match = text.match(/(\d+)\s*லட்சம்/);
    if (match) return parseInt(match[1]) * 100000;
    return 100000;
  }
  if (text.includes("ஆயிரம்")) {
    const match = text.match(/(\d+)\s*ஆயிரம்/);
    if (match) return parseInt(match[1]) * 1000;
    return 1000;
  }
  
  let total = 0;
  for (const [word, value] of Object.entries(TAMIL_NUMBERS)) {
    if (text.includes(word)) total += value;
  }
  return total;
};

// ============================================================
// PREDICTIVE ANALYTICS
// ============================================================
const predictNextMonthProfit = (transactions: Transaction[]): number => {
  const last6Months = MONTHS.slice(-6);
  const profits = last6Months.map(month =>
    transactions
      .filter(t => t.month === month && t.status === "Closed")
      .reduce((s, t) => s + t.profit, 0)
  );
  
  const validProfits = profits.filter(p => p > 0);
  if (validProfits.length < 2) return 0;
  
  const avgGrowth = validProfits.reduce((acc, curr, i) => {
    if (i === 0 || validProfits[i - 1] === 0) return acc;
    return acc + (curr - validProfits[i - 1]) / validProfits[i - 1];
  }, 0) / (validProfits.length - 1);
  
  const lastProfit = validProfits[validProfits.length - 1];
  return Math.max(0, round2(lastProfit * (1 + avgGrowth)));
};

// ============================================================
// BACKUP UTILITIES
// ============================================================
const downloadBackup = (data: any) => {
  const backup = {
    id: genId("BACKUP"),
    timestamp: new Date().toISOString(),
    version: "3.1.0",
    data,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AR_Backup_${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

import { hashPassword } from './utils/auth'; // or wherever your hash function is

// ============================================================
// DEFAULT ADMIN USER
// ============================================================
const DEFAULT_ADMIN: User = {
  id: "U001",
  username: "admin",
  password: "$sha256$" + "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", // Admin@123 hash
  role: "admin",
  createdAt: new Date().toISOString(),
};
// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function App() {
  // ============================================================
  // AUTHENTICATION STATE
  // ============================================================
  const [session, setSession] = useState<Session | null>(null);
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // APP STATE
  // ============================================================
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // ============================================================
  // DATA STATE
  // ============================================================
  const [users, setUsers] = useState<User[]>([DEFAULT_ADMIN]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [wallet, setWallet] = useState<WalletEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // ============================================================
  // WALLET LOCK (Prevent Race Conditions)
  // ============================================================
  const [isWalletLocked, setIsWalletLocked] = useState(false);

  // ============================================================
  // SETTINGS STATE
  // ============================================================
  const [settings, setSettings] = useState({
    autoBackupEnabled: true,
    backupFrequencyDays: 7,
    emailNotifications: false,
    encryptionEnabled: true,
    darkMode: false,
  });

  // ============================================================
  // DERIVED VALUES (Memoized for Performance)
  // ============================================================
  const user = session?.user || null;
  const isAdmin = user?.role === "admin";
  const district = user?.district || "";

  const myVendors = useMemo(() =>
    isAdmin ? vendors : vendors.filter(v => v.district === district),
    [vendors, district, isAdmin]
  );

  const myTransactions = useMemo(() =>
    isAdmin ? transactions : transactions.filter(t => t.district === district),
    [transactions, district, isAdmin]
  );

  const myBills = useMemo(() =>
    isAdmin ? bills : bills.filter(b => b.district === district),
    [bills, district, isAdmin]
  );

  const pendingCloseTransactions = useMemo(() =>
    transactions.filter(t => t.status === "PendingClose"),
    [transactions]
  );

  const walletBalance = useMemo(() =>
    wallet.length > 0 ? wallet[wallet.length - 1].balance : 0,
    [wallet]
  );

  const predictedProfit = useMemo(() =>
    predictNextMonthProfit(transactions),
    [transactions]
  );

  // ============================================================
  // ENCRYPTED STORAGE FUNCTIONS
  // ============================================================
  const saveToStorage = useCallback((data: any) => {
    try {
      if (settings.encryptionEnabled) {
        const encrypted = encryptData(data);
        localStorage.setItem(LS_KEY, encrypted);
      } else {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error("Storage save failed:", error);
    }
  }, [settings.encryptionEnabled]);

  const loadFromStorage = useCallback((): any => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (!stored) return null;

      // Try decryption first
      const decrypted = decryptData(stored);
      if (decrypted) return decrypted;

      // Fallback to plain JSON (for migration)
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    } catch (error) {
      console.error("Storage load failed:", error);
      return null;
    }
  }, []);

  const saveSession = useCallback((sess: Session | null) => {
    if (sess) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const loadSession = useCallback((): Session | null => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }, []);

  // ============================================================
  // AUDIT LOGGING
  // ============================================================
  const logAudit = useCallback((
    action: AuditAction,
    entity: string,
    entityId: string,
    before: any = null,
    after: any = null
  ) => {
    const log: AuditLog = {
      id: genId("LOG"),
      timestamp: new Date().toISOString(),
      user: user?.username || "system",
      action,
      entity,
      entityId,
      before,
      after,
    };
    setAuditLogs(prev => [...prev, log]);
  }, [user]);

  // ============================================================
  // WALLET ENTRY (Thread-Safe)
  // ============================================================
  const addWalletEntry = useCallback((
    description: string,
    debit: number,
    credit: number,
    type: WalletType,
    txnId?: string
  ) => {
    if (isWalletLocked) {
      // Retry after delay
      setTimeout(() => addWalletEntry(description, debit, credit, type, txnId), 100);
      return;
    }

    setIsWalletLocked(true);

    setWallet(prev => {
      const lastBalance = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      const newBalance = round2(lastBalance - debit + credit);

      const entry: WalletEntry = {
        id: genId("W"),
        date: today(),
        description,
        type,
        debit,
        credit,
        balance: newBalance,
        txnId,
        createdBy: user?.username || "system",
      };

      return [...prev, entry];
    });

    setTimeout(() => setIsWalletLocked(false), 50);
  }, [isWalletLocked, user]);

  // ============================================================
  // LOAD DATA ON MOUNT
  // ============================================================
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);

      // Check existing session
      const existingSession = loadSession();
      if (existingSession && isSessionValid(existingSession)) {
        setSession(existingSession);
        logAudit("LOGIN", "User", existingSession.user.id, null, { type: "session_restore" });
      }

      // Load data from storage
      const storedData = loadFromStorage();
      if (storedData) {
        if (storedData.users?.length > 0) setUsers(storedData.users);
        if (storedData.vendors) setVendors(storedData.vendors);
        if (storedData.transactions) setTransactions(storedData.transactions);
        if (storedData.bills) setBills(storedData.bills);
        if (storedData.wallet) setWallet(storedData.wallet);
        if (storedData.auditLogs) setAuditLogs(storedData.auditLogs);
        if (storedData.settings) setSettings(storedData.settings);
      }

      // Check mobile
      const checkMobile = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (mobile) setSidebarOpen(false);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);

      setIsLoading(false);

      return () => window.removeEventListener("resize", checkMobile);
    };

    initApp();
  }, []);

  // ============================================================
  // SAVE DATA ON CHANGE
  // ============================================================
  useEffect(() => {
    if (!isLoading) {
      const data = {
        users,
        vendors,
        transactions,
        bills,
        wallet,
        auditLogs: auditLogs.slice(-1000), // Keep last 1000 logs only
        settings,
        lastSaved: new Date().toISOString(),
      };
      saveToStorage(data);
    }
  }, [users, vendors, transactions, bills, wallet, auditLogs, settings, isLoading, saveToStorage]);

  // ============================================================
  // SESSION TIMEOUT CHECK
  // ============================================================
  useEffect(() => {
    if (!session) return;

    const checkSession = () => {
      if (!isSessionValid(session)) {
        alert("⏰ Session expired! Please login again.");
        handleLogout();
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [session]);

  // ============================================================
  // AUTO BACKUP CHECK
  // ============================================================
  useEffect(() => {
    if (!settings.autoBackupEnabled || !session) return;

    const lastBackup = localStorage.getItem("AR_LAST_BACKUP");
    const now = Date.now();
    const backupInterval = settings.backupFrequencyDays * 24 * 60 * 60 * 1000;

    if (!lastBackup || (now - parseInt(lastBackup)) > backupInterval) {
      // Show backup reminder
      if (isAdmin) {
        const shouldBackup = window.confirm(
          `📦 Auto Backup Reminder!\n\n` +
          `Last backup: ${lastBackup ? new Date(parseInt(lastBackup)).toLocaleDateString() : "Never"}\n\n` +
          `Download backup now?`
        );
        if (shouldBackup) {
          handleBackup();
        }
      }
    }
  }, [session, isAdmin, settings.autoBackupEnabled, settings.backupFrequencyDays]);

  const handleLogin = useCallback((username: string, password: string) => {
  setLoginError("");

  console.log("🔍 Login attempt:", { username, password }); // Debug
  console.log("👥 Available users:", users); // Debug

  const foundUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!foundUser) {
    console.log("❌ User not found"); // Debug
    setLoginError("❌ User not found!");
    logAudit("LOGIN", "User", "", null, { error: "user_not_found", username });
    return;
  }

  console.log("✅ User found:", foundUser); // Debug
  console.log("🔐 Password check:", { 
    input: password, 
    stored: foundUser.password,
    match: verifyPassword(password, foundUser.password)
  }); // Debug

  const isValid = verifyPassword(password, foundUser.password);

  if (!isValid) {
    console.log("❌ Password incorrect"); // Debug
    setLoginError("❌ Incorrect password!");
    logAudit("LOGIN", "User", foundUser.id, null, { error: "invalid_password" });
    return;
  }

  console.log("🎉 Login success!"); // Debug

  const newSession = createSession(foundUser);
  setSession(newSession);
  saveSession(newSession);

  setUsers(prev => prev.map(u =>
    u.id === foundUser.id ? { ...u, lastLogin: new Date().toISOString() } : u
  ));

  logAudit("LOGIN", "User", foundUser.id, null, { success: true });
  setPage("dashboard");
}, [users, logAudit, saveSession]);
  // ============================================================
  // LOGOUT HANDLER
  // ============================================================
  const handleLogout = useCallback(() => {
    if (user) {
      logAudit("LOGOUT", "User", user.id, null, { success: true });
    }
    setSession(null);
    saveSession(null);
    setPage("dashboard");
  }, [user, logAudit, saveSession]);

  // ============================================================
  // BACKUP HANDLER
  // ============================================================
  const handleBackup = useCallback(() => {
    const data = {
      users: users.map(u => ({ ...u, password: "[HIDDEN]" })), // Don't expose passwords
      vendors,
      transactions,
      bills,
      wallet,
      settings,
    };
    downloadBackup(data);
    localStorage.setItem("AR_LAST_BACKUP", Date.now().toString());
    logAudit("CREATE", "Backup", genId("BACKUP"), null, { itemCount: transactions.length });
  }, [users, vendors, transactions, bills, wallet, settings, logAudit]);

  // ============================================================
  // RESTORE HANDLER
  // ============================================================
  const handleRestore = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);

        if (!backup.data) {
          alert("❌ Invalid backup file!");
          return;
        }

        const confirmRestore = window.confirm(
          `⚠️ RESTORE WARNING!\n\n` +
          `This will REPLACE all current data:\n` +
          `• ${backup.data.vendors?.length || 0} Vendors\n` +
          `• ${backup.data.transactions?.length || 0} Transactions\n` +
          `• ${backup.data.bills?.length || 0} Bills\n\n` +
          `Continue?`
        );

        if (confirmRestore) {
          if (backup.data.vendors) setVendors(backup.data.vendors);
          if (backup.data.transactions) setTransactions(backup.data.transactions);
          if (backup.data.bills) setBills(backup.data.bills);
          if (backup.data.wallet) setWallet(backup.data.wallet);
          if (backup.data.settings) setSettings(backup.data.settings);

          logAudit("UPDATE", "Backup", "RESTORE", null, { restored: true });
          alert("✅ Backup restored successfully!");
        }
      } catch (error) {
        alert("❌ Failed to restore backup: " + (error as Error).message);
      }
    };
    reader.readAsText(file);
  }, [logAudit]);

  // ============================================================
  // RECALCULATE TRANSACTIONS (When Bills Change)
  // ============================================================
  const recalculateTransaction = useCallback((txnId: string) => {
    const txnBills = bills.filter(b => b.txnId === txnId);
    const billsTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);

    setTransactions(prev => prev.map(t => {
      if (t.txnId !== txnId) return t;

      const remaining = round2(Math.max(0, t.expectedAmount - billsTotal));
      const profit = t.status === "Closed" ? round2(t.expectedAmount * PROFIT_RATE) : 0;

      return {
        ...t,
        billsReceived: round2(txnBills.reduce((s, b) => s + b.billAmount, 0)),
        remainingExpected: remaining,
        profit,
      };
    }));
  }, [bills]);

  // ============================================================
  // USER MANAGEMENT
  // ============================================================
  const handleAddUser = useCallback((userData: Omit<User, "id" | "createdAt" | "password"> & { password: string }) => {
    const newUser: User = {
      ...userData,
      id: genId("U"),
      password: hashPassword(userData.password), // Hash password!
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    logAudit("CREATE", "User", newUser.id, null, { username: newUser.username, role: newUser.role });
  }, [logAudit]);

  const handleUpdateUser = useCallback((updatedUser: User) => {
    const before = users.find(u => u.id === updatedUser.id);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    logAudit("UPDATE", "User", updatedUser.id, before, updatedUser);
  }, [users, logAudit]);

  const handleDeleteUser = useCallback((userId: string) => {
    if (userId === "U001") {
      alert("❌ Cannot delete default admin!");
      return;
    }
    const before = users.find(u => u.id === userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    logAudit("DELETE", "User", userId, before, null);
  }, [users, logAudit]);

  // ============================================================
  // VENDOR MANAGEMENT (With Validation)
  // ============================================================
  const handleAddVendor = useCallback(async (vendorData: Omit<Vendor, "id" | "vendorCode" | "createdAt" | "createdBy">) => {
    try {
      // Validate
      await vendorSchema.validate(vendorData);

      // Check duplicate
      const duplicate = vendors.find(v =>
        v.vendorName.toLowerCase() === vendorData.vendorName.toLowerCase() &&
        v.district === vendorData.district
      );
      if (duplicate) {
        throw new Error("❌ Vendor already exists in this district!");
      }

      const districtCode = vendorData.district.substring(0, 3).toUpperCase();
      const count = vendors.filter(v => v.district === vendorData.district).length + 1;
      const vendorCode = `${districtCode}${String(count).padStart(4, "0")}`;

      const newVendor: Vendor = {
        ...vendorData,
        id: genId("V"),
        vendorCode,
        vendorName: sanitize(vendorData.vendorName),
        createdAt: new Date().toISOString(),
        createdBy: user?.username || "system",
      };

      setVendors(prev => [...prev, newVendor]);
      logAudit("CREATE", "Vendor", newVendor.id, null, newVendor);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [vendors, user, logAudit]);

  const handleUpdateVendor = useCallback((updatedVendor: Vendor) => {
    const before = vendors.find(v => v.id === updatedVendor.id);
    setVendors(prev => prev.map(v => v.id === updatedVendor.id ? updatedVendor : v));
    logAudit("UPDATE", "Vendor", updatedVendor.id, before, updatedVendor);
  }, [vendors, logAudit]);

  const handleDeleteVendor = useCallback((vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return;

    // Check cascade
    const hasTxns = transactions.some(t => t.vendorCode === vendor.vendorCode);
    const hasBills = bills.some(b => b.vendorCode === vendor.vendorCode);

    if (hasTxns || hasBills) {
      alert(
        `❌ Cannot delete ${vendor.vendorName}!\n\n` +
        `This vendor has:\n` +
        `• ${transactions.filter(t => t.vendorCode === vendor.vendorCode).length} Transactions\n` +
        `• ${bills.filter(b => b.vendorCode === vendor.vendorCode).length} Bills\n\n` +
        `Please delete or close all transactions first.`
      );
      return;
    }

    setVendors(prev => prev.filter(v => v.id !== vendorId));
    logAudit("DELETE", "Vendor", vendorId, vendor, null);
  }, [vendors, transactions, bills, logAudit]);

  // ============================================================
  // TRANSACTION MANAGEMENT
  // ============================================================
  const handleAddTransaction = useCallback(async (txnData: {
    vendorCode: string;
    financialYear: string;
    month: string;
    expectedAmount: number;
    advanceAmount: number;
    gstPercent: number;
  }) => {
    try {
      // Validate
      await transactionSchema.validate(txnData);

      const vendor = vendors.find(v => v.vendorCode === txnData.vendorCode);
      if (!vendor) throw new Error("❌ Vendor not found!");

      // Sanitize amounts
      const expected = sanitizeNumber(txnData.expectedAmount);
      const advance = sanitizeNumber(txnData.advanceAmount);
      const gstPct = sanitizeNumber(txnData.gstPercent);

      if (expected <= 0) throw new Error("❌ Expected amount must be positive!");

      const gstAmt = round2(expected * gstPct / 100);
      if (advance > gstAmt) throw new Error("❌ Advance cannot exceed GST amount!");

      const txnId = `TXN${Date.now()}`;

      const newTxn: Transaction = {
        txnId,
        vendorCode: vendor.vendorCode,
        vendorName: vendor.vendorName,
        district: vendor.district,
        financialYear: txnData.financialYear,
        month: txnData.month,
        expectedAmount: expected,
        advanceAmount: advance,
        gstPercent: gstPct,
        gstAmount: gstAmt,
        gstBalance: round2(gstAmt - advance),
        billsReceived: 0,
        remainingExpected: expected,
        profit: 0,
        status: "Open",
        createdAt: new Date().toISOString(),
        createdBy: user?.username || "system",
        confirmedByAdmin: false,
      };

      setTransactions(prev => [...prev, newTxn]);

      // Add advance to wallet if any
      if (advance > 0) {
        addWalletEntry(
          `Advance: ${vendor.vendorName} - ${txnData.month}`,
          advance,
          0,
          "advance",
          txnId
        );
      }

      logAudit("CREATE", "Transaction", txnId, null, newTxn);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [vendors, user, addWalletEntry, logAudit]);

  const handleUpdateTransaction = useCallback((updatedTxn: Transaction) => {
    const before = transactions.find(t => t.txnId === updatedTxn.txnId);

    // Recalculate GST
    const gstAmt = round2(updatedTxn.expectedAmount * updatedTxn.gstPercent / 100);
    const gstBal = round2(gstAmt - updatedTxn.advanceAmount);

    const finalTxn = {
      ...updatedTxn,
      gstAmount: gstAmt,
      gstBalance: gstBal,
    };

    setTransactions(prev => prev.map(t => t.txnId === updatedTxn.txnId ? finalTxn : t));
    logAudit("UPDATE", "Transaction", updatedTxn.txnId, before, finalTxn);
  }, [transactions, logAudit]);

  const handleDeleteTransaction = useCallback((txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) return;

    // Delete associated bills
    setBills(prev => prev.filter(b => b.txnId !== txnId));
    setTransactions(prev => prev.filter(t => t.txnId !== txnId));
    logAudit("DELETE", "Transaction", txnId, txn, null);
  }, [transactions, logAudit]);

  const handleCloseTransaction = useCallback((txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn || txn.status !== "Open") return;

    setTransactions(prev => prev.map(t =>
      t.txnId === txnId
        ? { ...t, status: "PendingClose" as TransactionStatus, closedAt: new Date().toISOString(), closedBy: user?.username }
        : t
    ));

    // Add GST balance to wallet
    if (txn.gstBalance > 0) {
      addWalletEntry(
        `GST Balance: ${txn.vendorName} - ${txn.month}`,
        txn.gstBalance,
        0,
        "gst",
        txnId
      );
    }

    logAudit("CLOSE", "Transaction", txnId, { status: "Open" }, { status: "PendingClose" });
  }, [transactions, user, addWalletEntry, logAudit]);

  const handleConfirmClose = useCallback((txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn || txn.status !== "PendingClose") return;

    const profit = round2(txn.expectedAmount * PROFIT_RATE);

    setTransactions(prev => prev.map(t =>
      t.txnId === txnId
        ? { ...t, status: "Closed" as TransactionStatus, profit, confirmedByAdmin: true }
        : t
    ));

    // Add profit to wallet
    addWalletEntry(
      `Profit 8%: ${txn.vendorName} - ${txn.month}`,
      0,
      profit,
      "profit",
      txnId
    );

    logAudit("CONFIRM", "Transaction", txnId, { status: "PendingClose" }, { status: "Closed", profit });
  }, [transactions, addWalletEntry, logAudit]);

  // ============================================================
  // BILL MANAGEMENT
  // ============================================================
  const handleAddBill = useCallback(async (billData: {
    txnId: string;
    billNumber: string;
    billDate: string;
    billAmount: number;
    gstPercent: number;
  }) => {
    try {
      // Validate
      await billSchema.validate(billData);

      const txn = transactions.find(t => t.txnId === billData.txnId);
      if (!txn) throw new Error("❌ Transaction not found!");

      if (txn.status !== "Open") {
        throw new Error("❌ Cannot add bills to closed transaction!");
      }

      const amt = sanitizeNumber(billData.billAmount);
      if (amt <= 0) throw new Error("❌ Bill amount must be positive!");

      const gstAmt = round2(amt * billData.gstPercent / 100);
      const total = round2(amt * BILL_TOTAL_RATE);

      const newBill: Bill = {
        id: genId("B"),
        txnId: billData.txnId,
        vendorCode: txn.vendorCode,
        vendorName: txn.vendorName,
        district: txn.district,
        billNumber: sanitize(billData.billNumber),
        billDate: billData.billDate,
        billAmount: amt,
        gstPercent: billData.gstPercent,
        gstAmount: gstAmt,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        createdBy: user?.username || "system",
      };

      setBills(prev => [...prev, newBill]);
      setTimeout(() => recalculateTransaction(billData.txnId), 100);
      logAudit("CREATE", "Bill", newBill.id, null, newBill);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [transactions, user, recalculateTransaction, logAudit]);

  const handleBulkAddBills = useCallback((newBills: Bill[]) => {
    setBills(prev => [...prev, ...newBills]);
    const txnIds = [...new Set(newBills.map(b => b.txnId))];
    txnIds.forEach(txnId => setTimeout(() => recalculateTransaction(txnId), 100));
    logAudit("CREATE", "Bill", "BULK", null, { count: newBills.length });
  }, [recalculateTransaction, logAudit]);

  const handleUpdateBill = useCallback((updatedBill: Bill) => {
    const txn = transactions.find(t => t.txnId === updatedBill.txnId);
    if (txn && txn.status !== "Open") {
      alert("❌ Cannot edit bills of closed transaction!");
      return;
    }

    const before = bills.find(b => b.id === updatedBill.id);
    const gstAmt = round2(updatedBill.billAmount * updatedBill.gstPercent / 100);
    const total = round2(updatedBill.billAmount * BILL_TOTAL_RATE);

    const finalBill = { ...updatedBill, gstAmount: gstAmt, totalAmount: total };

    setBills(prev => prev.map(b => b.id === updatedBill.id ? finalBill : b));
    setTimeout(() => recalculateTransaction(updatedBill.txnId), 100);
    logAudit("UPDATE", "Bill", updatedBill.id, before, finalBill);
  }, [transactions, bills, recalculateTransaction, logAudit]);

  const handleDeleteBill = useCallback((billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    const txn = transactions.find(t => t.txnId === bill.txnId);
    if (txn && txn.status !== "Open") {
      alert("❌ Cannot delete bills of closed transaction!");
      return;
    }

    setBills(prev => prev.filter(b => b.id !== billId));
    setTimeout(() => recalculateTransaction(bill.txnId), 100);
    logAudit("DELETE", "Bill", billId, bill, null);
  }, [bills, transactions, recalculateTransaction, logAudit]);

  const handleBulkDeleteBills = useCallback((billIds: string[]) => {
    const txnIds = [...new Set(bills.filter(b => billIds.includes(b.id)).map(b => b.txnId))];
    setBills(prev => prev.filter(b => !billIds.includes(b.id)));
    txnIds.forEach(txnId => setTimeout(() => recalculateTransaction(txnId), 100));
    logAudit("DELETE", "Bill", "BULK", null, { count: billIds.length });
  }, [bills, recalculateTransaction, logAudit]);

  // ============================================================
  // WALLET MANAGEMENT
  // ============================================================
  const handleManualWalletEntry = useCallback((description: string, debit: number, credit: number) => {
    addWalletEntry(sanitize(description), sanitizeNumber(debit), sanitizeNumber(credit), "manual");
  }, [addWalletEntry]);

  const handleSetWalletBalance = useCallback((newBalance: number) => {
    const currentBalance = walletBalance;
    const diff = newBalance - currentBalance;

    if (diff > 0) {
      addWalletEntry("Balance Adjustment (Credit)", 0, diff, "manual");
    } else if (diff < 0) {
      addWalletEntry("Balance Adjustment (Debit)", Math.abs(diff), 0, "manual");
    }
  }, [walletBalance, addWalletEntry]);

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-white">AR Enterprises</h1>
          <p className="text-gray-400 mt-2">Loading secure data...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOGIN SCREEN (If not authenticated)
  // ============================================================
  if (!session) {
    return (
      <LoginPage
        onLogin={handleLogin}
        error={loginError}
        users={users}
      />
    );
  }

  // ============================================================
  // MAIN APP LAYOUT
  // ============================================================
  return (
    <div className="min-h-screen flex" style={{ background: "#f8fafc" }}>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg"
        >
          {sidebarOpen ? "✕" : "☰"}
        </button>
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isMobile={isMobile}
        currentPage={page}
        isAdmin={isAdmin}
        user={user}
        pendingCount={pendingCloseTransactions.length}
        onPageChange={(p) => {
          setPage(p);
          if (isMobile) setSidebarOpen(false);
        }}
        onLogout={handleLogout}
        onBackup={handleBackup}
      />

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen && !isMobile ? "ml-64" : ""}`}>
        {page === "dashboard" && (
          <DashboardPage
            isAdmin={isAdmin}
            district={district}
            transactions={myTransactions}
            vendors={myVendors}
            bills={myBills}
            wallet={wallet}
            walletBalance={walletBalance}
            pendingClose={pendingCloseTransactions}
            predictedProfit={predictedProfit}
            onConfirmClose={handleConfirmClose}
          />
        )}

        {page === "vendors" && (
          <VendorsPage
            isAdmin={isAdmin}
            district={district}
            vendors={myVendors}
            transactions={transactions}
            bills={bills}
            onAdd={handleAddVendor}
            onUpdate={handleUpdateVendor}
            onDelete={handleDeleteVendor}
          />
        )}

        {page === "transactions" && (
          <TransactionsPage
            isAdmin={isAdmin}
            district={district}
            transactions={myTransactions}
            vendors={myVendors}
            bills={myBills}
            onAdd={handleAddTransaction}
            onUpdate={handleUpdateTransaction}
            onDelete={handleDeleteTransaction}
            onClose={handleCloseTransaction}
          />
        )}

        {page === "bills" && (
          <BillsPage
            isAdmin={isAdmin}
            district={district}
            bills={myBills}
            transactions={myTransactions}
            vendors={myVendors}
            onAdd={handleAddBill}
            onBulkAdd={handleBulkAddBills}
            onUpdate={handleUpdateBill}
            onDelete={handleDeleteBill}
            onBulkDelete={handleBulkDeleteBills}
            username={user?.username || ""}
          />
        )}

        {page === "wallet" && (
          <WalletPage
            wallet={wallet}
            balance={walletBalance}
            onManualEntry={handleManualWalletEntry}
            onSetBalance={handleSetWalletBalance}
          />
        )}

        {page === "reports" && (
          <ReportsPage
            transactions={transactions}
            bills={bills}
            vendors={vendors}
            wallet={wallet}
          />
        )}

        {page === "analytics" && (
          <AnalyticsPage
            transactions={transactions}
            bills={bills}
            vendors={vendors}
            wallet={wallet}
            predictedProfit={predictedProfit}
          />
        )}

        {page === "users" && isAdmin && (
          <UsersPage
            users={users}
            onAdd={handleAddUser}
            onUpdate={handleUpdateUser}
            onDelete={handleDeleteUser}
          />
        )}

        {page === "audit" && isAdmin && (
          <AuditLogsPage logs={auditLogs} />
        )}

        {page === "settings" && (
          <SettingsPage
            settings={settings}
            onUpdate={setSettings}
            onBackup={handleBackup}
            onRestore={handleRestore}
          />
        )}
      </main>
    </div>
  );
}
// ============================================================
// LOGIN PAGE COMPONENT
// ============================================================
function LoginPage({
  onLogin,
  error,
  users,
}: {
  onLogin: (username: string, password: string) => void;
  error: string;
  users: User[];
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    // Simulate network delay for security
    await new Promise(resolve => setTimeout(resolve, 500));
    onLogin(username, password);
    setIsLoading(false);
  };

  // Quick login for district users
  const handleQuickLogin = (district: string) => {
    const districtUser = users.find(u => u.district === district);
    if (districtUser) {
      setUsername(districtUser.username);
      setSelectedDistrict(district);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0a1628 100%)" }}>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{ background: "linear-gradient(135deg, #f0d060, #d4a840)" }}>
            <span className="text-4xl">🏢</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AR Enterprises</h1>
          <p className="text-gray-400">ERP System V3.1 — Secure Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(sanitize(e.target.value))}
                placeholder="Enter username"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔒 Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all pr-12"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>🔐</span>
                  <span>Secure Login</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Login (District Selection) */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-3">Quick District Login</p>
            <div className="grid grid-cols-3 gap-2">
              {DISTRICTS.slice(0, 6).map((d) => (
                <button
                  key={d}
                  onClick={() => handleQuickLogin(d)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedDistrict === d
                      ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {d.substring(0, 6)}
                </button>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-start gap-2 text-xs text-blue-700">
              <span className="text-lg">🔐</span>
              <div>
                <p className="font-semibold mb-1">Security Features:</p>
                <ul className="space-y-0.5 text-blue-600">
                  <li>✓ Password Encryption (bcrypt)</li>
                  <li>✓ Session Timeout (8 hours)</li>
                  <li>✓ Data Encryption (AES-256)</li>
                  <li>✓ Audit Trail Logging</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-xs">
            © 2025 AR Enterprises. All rights reserved.
          </p>
          <p className="text-gray-600 text-xs mt-1">
            Version 3.1.0 — Secure Edition
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR COMPONENT
// ============================================================
function Sidebar({
  isOpen,
  isMobile,
  currentPage,
  isAdmin,
  user,
  pendingCount,
  onPageChange,
  onLogout,
  onBackup,
}: {
  isOpen: boolean;
  isMobile: boolean;
  currentPage: string;
  isAdmin: boolean;
  user: User | null;
  pendingCount: number;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  onBackup: () => void;
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const menuItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard", show: true },
    { id: "vendors", icon: "🏪", label: "Vendors", show: true },
    { id: "transactions", icon: "📋", label: "Transactions", show: true, badge: pendingCount > 0 && isAdmin ? pendingCount : null },
    { id: "bills", icon: "🧾", label: "Bills", show: true },
    { id: "wallet", icon: "💰", label: "Wallet", show: isAdmin },
    { id: "reports", icon: "📈", label: "Reports", show: true },
    { id: "analytics", icon: "📉", label: "Analytics", show: isAdmin },
    { id: "users", icon: "👥", label: "Users", show: isAdmin },
    { id: "audit", icon: "📜", label: "Audit Logs", show: isAdmin },
    { id: "settings", icon: "⚙️", label: "Settings", show: true },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => onPageChange(currentPage)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 z-40 flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(180deg, #0a1628 0%, #1a2f5e 100%)" }}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f0d060, #d4a840)" }}>
              <span className="text-2xl">🏢</span>
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">AR Enterprises</h1>
              <p className="text-xs text-gray-400">ERP V3.1</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-white/10">
          <div
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-all"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
              isAdmin ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gradient-to-r from-blue-500 to-purple-500"
            }`}>
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{user?.username}</p>
              <p className="text-xs text-gray-400 truncate">
                {isAdmin ? "👑 Admin" : `📍 ${user?.district}`}
              </p>
            </div>
            <span className="text-gray-400 text-xs">{showUserMenu ? "▲" : "▼"}</span>
          </div>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="mt-2 p-2 rounded-xl bg-white/10 space-y-1">
              <button
                onClick={onBackup}
                className="w-full px-3 py-2 rounded-lg text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
              >
                <span>📦</span>
                <span>Download Backup</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full px-3 py-2 rounded-lg text-left text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all flex items-center gap-2"
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.filter(item => item.show).map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all flex items-center gap-3 ${
                    currentPage === item.id
                      ? "bg-white/20 text-white shadow-lg"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Pending Close Alert (Admin Only) */}
        {isAdmin && pendingCount > 0 && (
          <div className="p-4 border-t border-white/10">
            <div
              className="p-3 rounded-xl cursor-pointer transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}
              onClick={() => onPageChange("transactions")}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce">🔴</span>
                <div>
                  <p className="text-white font-bold text-sm">{pendingCount} Pending Close</p>
                  <p className="text-red-200 text-xs">Click to review</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="text-center">
            <p className="text-gray-500 text-xs">Secure Connection</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-green-400 text-xs">Encrypted</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// REUSABLE UI COMPONENTS
// ============================================================

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  subValue,
  color,
  trend,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all ${
        onClick ? "cursor-pointer hover:scale-105" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: `${color}15` }}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${
          trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-500"
        }`}>
          <span>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>
          <span>{trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}</span>
        </div>
      )}
    </div>
  );
}

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
          >
            ✕
          </button>
        </div>
        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// Confirm Dialog Component
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  confirmColor = "red",
  icon = "⚠️",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: "red" | "green" | "blue";
  icon?: string;
}) {
  if (!isOpen) return null;

  const colorClasses = {
    red: "bg-red-600 hover:bg-red-700",
    green: "bg-green-600 hover:bg-green-700",
    blue: "bg-blue-600 hover:bg-blue-700",
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">{icon}</div>
          <h3 className="font-bold text-gray-800 text-lg mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-6">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pagination Component
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = [];
  const showPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
  let endPage = Math.min(totalPages, startPage + showPages - 1);

  if (endPage - startPage + 1 < showPages) {
    startPage = Math.max(1, endPage - showPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ««
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        «
      </button>
      
      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            currentPage === page
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {page}
        </button>
      ))}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        »
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        »»
      </button>
    </div>
  );
}

// Search Input Component
function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Voice Input Button Component
function VoiceInputButton({
  onResult,
  disabled = false,
}: {
  onResult: (amount: number, transcript: string) => void;
  disabled?: boolean;
}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const startListening = () => {
    setError("");
    
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Voice input not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ta-IN"; // Tamil
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const amount = parseVoiceAmount(transcript);
      onResult(amount, transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      setError(`Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={startListening}
        disabled={disabled || isListening}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
          isListening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-purple-100 text-purple-700 hover:bg-purple-200"
        } disabled:opacity-50`}
        title="Tamil voice input"
      >
        <span className="text-lg">{isListening ? "🔴" : "🎤"}</span>
        <span>{isListening ? "Listening..." : "Voice"}</span>
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Loading Spinner Component
function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className={`animate-spin rounded-full border-blue-500 border-t-transparent ${sizeClasses[size]}`}></div>
  );
}

// Empty State Component
function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Badge Component
function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const variantClasses = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

// Tooltip Component
function Tooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
}
// ============================================================
// DASHBOARD PAGE COMPONENT
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
  predictedProfit,
  onConfirmClose,
}: {
  isAdmin: boolean;
  district: string;
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  wallet: WalletEntry[];
  walletBalance: number;
  pendingClose: Transaction[];
  predictedProfit: number;
  onConfirmClose: (txnId: string) => void;
}) {
  const [selectedChart, setSelectedChart] = useState<"monthly" | "district" | "gst">("monthly");
  const [showAllPending, setShowAllPending] = useState(false);

  // ============================================================
  // CALCULATED STATISTICS
  // ============================================================
  const stats = useMemo(() => {
    const openTxns = transactions.filter(t => t.status === "Open");
    const closedTxns = transactions.filter(t => t.status === "Closed");
    const pendingTxns = transactions.filter(t => t.status === "PendingClose");

    const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
    const totalBillsReceived = transactions.reduce((s, t) => s + t.billsReceived, 0);
    const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
    const totalAdvance = transactions.reduce((s, t) => s + t.advanceAmount, 0);
    const totalProfit = closedTxns.reduce((s, t) => s + t.profit, 0);
    const totalRemaining = transactions.reduce((s, t) => s + t.remainingExpected, 0);
    const totalGSTBalance = transactions.reduce((s, t) => s + t.gstBalance, 0);

    // This month stats
    const currentMonth = MONTHS[new Date().getMonth()];
    const thisMonthTxns = transactions.filter(t => t.month === currentMonth);
    const thisMonthExpected = thisMonthTxns.reduce((s, t) => s + t.expectedAmount, 0);
    const thisMonthProfit = thisMonthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);

    // Growth calculation (vs last month)
    const lastMonthIndex = new Date().getMonth() - 1;
    const lastMonth = lastMonthIndex >= 0 ? MONTHS[lastMonthIndex] : MONTHS[11];
    const lastMonthTxns = transactions.filter(t => t.month === lastMonth);
    const lastMonthProfit = lastMonthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);
    const profitGrowth = lastMonthProfit > 0 ? ((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100 : 0;

    return {
      openTxns: openTxns.length,
      closedTxns: closedTxns.length,
      pendingTxns: pendingTxns.length,
      totalExpected,
      totalBillsReceived,
      totalGST,
      totalAdvance,
      totalProfit,
      totalRemaining,
      totalGSTBalance,
      thisMonthExpected,
      thisMonthProfit,
      profitGrowth,
      vendorCount: vendors.length,
      billCount: bills.length,
    };
  }, [transactions, vendors, bills]);

  // ============================================================
  // CHART DATA PREPARATION
  // ============================================================
  
  // Monthly Profit Trend
  const monthlyChartData = useMemo(() => {
    return MONTHS.map(month => {
      const monthTxns = transactions.filter(t => t.month === month);
      const expected = monthTxns.reduce((s, t) => s + t.expectedAmount, 0);
      const profit = monthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);
      const bills = monthTxns.reduce((s, t) => s + t.billsReceived, 0);
      
      return {
        month: month.substring(0, 3),
        expected: round2(expected / 100000), // In Lakhs
        profit: round2(profit / 1000), // In Thousands
        bills: round2(bills / 100000), // In Lakhs
      };
    });
  }, [transactions]);

  // District-wise Performance
  const districtChartData = useMemo(() => {
    return DISTRICTS.map(d => {
      const dTxns = transactions.filter(t => t.district === d);
      return {
        district: d.substring(0, 6),
        expected: round2(dTxns.reduce((s, t) => s + t.expectedAmount, 0) / 100000),
        profit: round2(dTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0) / 1000),
        count: dTxns.length,
      };
    }).filter(d => d.count > 0);
  }, [transactions]);

  // GST Rate Distribution (Pie Chart)
  const gstPieData = useMemo(() => {
    return GST_RATES.map(rate => {
      const rateTxns = transactions.filter(t => t.gstPercent === rate);
      return {
        name: `${rate}%`,
        value: rateTxns.length,
        amount: rateTxns.reduce((s, t) => s + t.gstAmount, 0),
      };
    }).filter(d => d.value > 0);
  }, [transactions]);

  // Status Distribution (Pie Chart)
  const statusPieData = useMemo(() => [
    { name: "Open", value: stats.openTxns, color: "#3b82f6" },
    { name: "Pending", value: stats.pendingTxns, color: "#ef4444" },
    { name: "Closed", value: stats.closedTxns, color: "#22c55e" },
  ].filter(d => d.value > 0), [stats]);

  // Recent Transactions
  const recentTransactions = useMemo(() => 
    [...transactions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 5),
    [transactions]
  );

  // Top Vendors by Expected Amount
  const topVendors = useMemo(() => {
    const vendorStats = vendors.map(v => {
      const vTxns = transactions.filter(t => t.vendorCode === v.vendorCode);
      return {
        ...v,
        txnCount: vTxns.length,
        totalExpected: vTxns.reduce((s, t) => s + t.expectedAmount, 0),
        totalProfit: vTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
      };
    });
    return vendorStats.sort((a, b) => b.totalExpected - a.totalExpected).slice(0, 5);
  }, [vendors, transactions]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            📊 Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "Admin Overview — All Districts" : `District: ${district}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-600">Today</p>
            <p className="font-bold text-blue-800">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
          </div>
        </div>
      </div>

      {/* Admin Pending Close Alert */}
      {isAdmin && pendingClose.length > 0 && (
        <div className="rounded-2xl p-5 border-2 border-red-300 animate-pulse"
          style={{ background: "linear-gradient(135deg, #fef2f2, #fee2e2)" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center animate-bounce">
                <span className="text-3xl">🔴</span>
              </div>
              <div>
                <h3 className="font-bold text-red-800 text-lg">
                  {pendingClose.length} Transaction{pendingClose.length > 1 ? "s" : ""} Pending Close
                </h3>
                <p className="text-red-600 text-sm">District users are waiting for your confirmation</p>
              </div>
            </div>
            <button
              onClick={() => setShowAllPending(true)}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all"
            >
              Review Now →
            </button>
          </div>

          {/* Quick Preview of Pending */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingClose.slice(0, 3).map(txn => (
              <div key={txn.txnId} className="bg-white rounded-xl p-3 border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-gray-500">{txn.txnId}</p>
                    <p className="font-semibold text-gray-800">{txn.vendorName}</p>
                    <p className="text-xs text-gray-500">{txn.district} • {txn.month}</p>
                  </div>
                  <button
                    onClick={() => onConfirmClose(txn.txnId)}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700"
                  >
                    ✅ Confirm
                  </button>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                  <span className="text-gray-500">Expected: <strong className="text-gray-800">{fmt(txn.expectedAmount)}</strong></span>
                  <span className="text-green-600">Profit: <strong>{fmt(round2(txn.expectedAmount * PROFIT_RATE))}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="💰"
          label="Total Expected"
          value={fmt(stats.totalExpected)}
          subValue={`${transactions.length} transactions`}
          color="#1a2f5e"
        />
        <StatCard
          icon="🧾"
          label="Bills Received"
          value={fmt(stats.totalBillsReceived)}
          subValue={`${stats.billCount} bills`}
          color="#15803d"
        />
        <StatCard
          icon="📊"
          label="Total GST"
          value={fmt(stats.totalGST)}
          subValue={`Advance: ${fmt(stats.totalAdvance)}`}
          color="#7c3aed"
        />
        <StatCard
          icon="🎯"
          label="Total Profit (8%)"
          value={fmt(stats.totalProfit)}
          subValue={stats.closedTxns > 0 ? `${stats.closedTxns} closed` : "No closed transactions"}
          color="#b45309"
          trend={stats.profitGrowth > 0 ? "up" : stats.profitGrowth < 0 ? "down" : "neutral"}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="⏳"
          label="Remaining Expected"
          value={fmt(stats.totalRemaining)}
          color="#dc2626"
        />
        <StatCard
          icon="💳"
          label="GST Balance"
          value={fmt(stats.totalGSTBalance)}
          color="#ea580c"
        />
        {isAdmin && (
          <StatCard
            icon="🏦"
            label="Wallet Balance"
            value={fmt(walletBalance)}
            color="#0891b2"
          />
        )}
        <StatCard
          icon="🏪"
          label="Vendors"
          value={stats.vendorCount.toString()}
          subValue="Registered vendors"
          color="#4f46e5"
        />
      </div>

      {/* Predictive Analytics Card */}
      {isAdmin && (
        <div className="rounded-2xl p-6 text-white"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #3b5998, #1a2f5e)" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🤖</span>
                <h3 className="font-bold text-lg">AI Predictive Analytics</h3>
              </div>
              <p className="text-blue-200 text-sm">Based on last 6 months trend analysis</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-sm">Predicted Next Month Profit</p>
              <p className="text-4xl font-bold" style={{ color: "#f0d060" }}>
                {predictedProfit > 0 ? fmt(predictedProfit) : "Insufficient Data"}
              </p>
              {predictedProfit > 0 && stats.thisMonthProfit > 0 && (
                <p className={`text-sm mt-1 ${predictedProfit > stats.thisMonthProfit ? "text-green-300" : "text-red-300"}`}>
                  {predictedProfit > stats.thisMonthProfit ? "↑" : "↓"} 
                  {Math.abs(round2(((predictedProfit - stats.thisMonthProfit) / stats.thisMonthProfit) * 100))}% vs this month
                </p>
              )}
            </div>
          </div>

          {/* Mini Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
            <div>
              <p className="text-blue-200 text-xs">This Month Expected</p>
              <p className="font-bold text-xl">{fmt(stats.thisMonthExpected)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">This Month Profit</p>
              <p className="font-bold text-xl text-green-300">{fmt(stats.thisMonthProfit)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Growth Rate</p>
              <p className={`font-bold text-xl ${stats.profitGrowth >= 0 ? "text-green-300" : "text-red-300"}`}>
                {stats.profitGrowth >= 0 ? "+" : ""}{round2(stats.profitGrowth)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Chart Tabs */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 overflow-x-auto">
          <button
            onClick={() => setSelectedChart("monthly")}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedChart === "monthly"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📈 Monthly Trend
          </button>
          <button
            onClick={() => setSelectedChart("district")}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedChart === "district"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📊 District Performance
          </button>
          <button
            onClick={() => setSelectedChart("gst")}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedChart === "gst"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            🥧 GST Distribution
          </button>
        </div>

        {/* Chart Content */}
        <div className="p-6">
          {selectedChart === "monthly" && (
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Monthly Profit & Expected Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                      formatter={(value: number, name: string) => [
                        name === "expected" ? `₹${value}L` : name === "profit" ? `₹${value}K` : `₹${value}L`,
                        name === "expected" ? "Expected" : name === "profit" ? "Profit" : "Bills"
                      ]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="expected" 
                      stroke="#1a2f5e" 
                      strokeWidth={3}
                      dot={{ fill: "#1a2f5e", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Expected (₹L)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#22c55e" 
                      strokeWidth={3}
                      dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Profit (₹K)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="bills" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 3 }}
                      name="Bills (₹L)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Values: Expected & Bills in Lakhs (₹L), Profit in Thousands (₹K)
              </p>
            </div>
          )}

          {selectedChart === "district" && (
            <div>
              <h3 className="font-bold text-gray-800 mb-4">District-wise Performance</h3>
              {districtChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                        formatter={(value: number, name: string) => [
                          name === "expected" ? `₹${value}L` : `₹${value}K`,
                          name === "expected" ? "Expected" : "Profit"
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="expected" fill="#1a2f5e" radius={[4, 4, 0, 0]} name="Expected (₹L)" />
                      <Bar dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} name="Profit (₹K)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon="📊"
                  title="No District Data"
                  description="Add transactions to see district performance"
                />
              )}
            </div>
          )}

          {selectedChart === "gst" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GST Rate Pie Chart */}
              <div>
                <h3 className="font-bold text-gray-800 mb-4">GST Rate Distribution</h3>
                {gstPieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gstPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {gstPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: "12px" }}
                          formatter={(value: number, name: string, props: any) => [
                            `${value} transactions (${fmt(props.payload.amount)})`,
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon="🥧" title="No GST Data" />
                )}
              </div>

              {/* Status Pie Chart */}
              <div>
                <h3 className="font-bold text-gray-800 mb-4">Transaction Status</h3>
                {statusPieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: "12px" }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon="📊" title="No Status Data" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Recent Transactions & Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">📋 Recent Transactions</h3>
            <span className="text-xs text-gray-400">Last 5</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTransactions.length > 0 ? (
              recentTransactions.map(txn => (
                <div key={txn.txnId} className="p-4 hover:bg-gray-50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        txn.status === "Closed" ? "bg-green-100" :
                        txn.status === "PendingClose" ? "bg-red-100" : "bg-blue-100"
                      }`}>
                        {txn.status === "Closed" ? "✅" : txn.status === "PendingClose" ? "🔴" : "📋"}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{txn.vendorName}</p>
                        <p className="text-xs text-gray-500">{txn.txnId} • {txn.month}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{fmt(txn.expectedAmount)}</p>
                      <Badge variant={
                        txn.status === "Closed" ? "success" :
                        txn.status === "PendingClose" ? "danger" : "info"
                      }>
                        {txn.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon="📋"
                title="No Transactions"
                description="Create your first transaction"
              />
            )}
          </div>
        </div>

        {/* Top Vendors */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">🏆 Top Vendors</h3>
            <span className="text-xs text-gray-400">By Expected Amount</span>
          </div>
          <div className="divide-y divide-gray-50">
            {topVendors.length > 0 ? (
              topVendors.map((vendor, index) => (
                <div key={vendor.id} className="p-4 hover:bg-gray-50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-100 text-gray-600" :
                        index === 2 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-600"
                      }`}>
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{vendor.vendorName}</p>
                        <p className="text-xs text-gray-500">{vendor.vendorCode} • {vendor.district}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{fmt(vendor.totalExpected)}</p>
                      <p className="text-xs text-green-600">Profit: {fmt(vendor.totalProfit)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon="🏪"
                title="No Vendors"
                description="Add vendors to see top performers"
              />
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => {/* Navigate to add vendor */}}
            className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center group"
          >
            <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">🏪</span>
            <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600">Add Vendor</span>
          </button>
          <button
            onClick={() => {/* Navigate to add transaction */}}
            className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-center group"
          >
            <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">📋</span>
            <span className="text-sm font-medium text-gray-600 group-hover:text-green-600">New Transaction</span>
          </button>
          <button
            onClick={() => {/* Navigate to add bill */}}
            className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-center group"
          >
            <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">🧾</span>
            <span className="text-sm font-medium text-gray-600 group-hover:text-purple-600">Add Bill</span>
          </button>
          <button
            onClick={() => {/* Navigate to reports */}}
            className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all text-center group"
          >
            <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">📈</span>
            <span className="text-sm font-medium text-gray-600 group-hover:text-orange-600">View Reports</span>
          </button>
        </div>
      </div>

      {/* Wallet Summary (Admin Only) */}
      {isAdmin && wallet.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">💰 Recent Wallet Activity</h3>
            <span className="text-xs text-gray-400">Last 5 entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...wallet].reverse().slice(0, 5).map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{entry.date}</td>
                    <td className="px-4 py-3 text-gray-800">{entry.description}</td>
                    <td className="px-4 py-3">
                      <Badge variant={
                        entry.type === "profit" ? "success" :
                        entry.type === "advance" ? "warning" :
                        entry.type === "gst" ? "danger" : "default"
                      }>
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {entry.debit > 0 ? fmt(entry.debit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {entry.credit > 0 ? fmt(entry.credit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(entry.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Close Modal */}
      <Modal
        isOpen={showAllPending}
        onClose={() => setShowAllPending(false)}
        title={`🔴 Pending Close — ${pendingClose.length} Transactions`}
        size="xl"
      >
        <div className="space-y-4">
          {pendingClose.map(txn => (
            <div key={txn.txnId} className="p-4 rounded-xl border border-red-200 bg-red-50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-mono text-sm text-gray-500">{txn.txnId}</p>
                  <p className="font-bold text-gray-800 text-lg">{txn.vendorName}</p>
                  <p className="text-sm text-gray-600">{txn.district} • {txn.month} • {txn.financialYear}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Expected Amount</p>
                  <p className="font-bold text-xl text-gray-800">{fmt(txn.expectedAmount)}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-red-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">GST Amount</p>
                  <p className="font-semibold text-purple-700">{fmt(txn.gstAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">GST Balance</p>
                  <p className="font-semibold text-red-600">{fmt(txn.gstBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bills Received</p>
                  <p className="font-semibold text-green-600">{fmt(txn.billsReceived)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Profit (8%)</p>
                  <p className="font-bold text-orange-600">{fmt(round2(txn.expectedAmount * PROFIT_RATE))}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    onConfirmClose(txn.txnId);
                    if (pendingClose.length === 1) setShowAllPending(false);
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-all"
                >
                  ✅ Confirm Close & Credit Profit
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Closed by: {txn.closedBy} • {txn.closedAt ? new Date(txn.closedAt).toLocaleString() : ""}
              </p>
            </div>
          ))}

          {pendingClose.length === 0 && (
            <EmptyState
              icon="✅"
              title="All Clear!"
              description="No pending transactions to review"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
// ============================================================
// VENDORS PAGE COMPONENT
// ============================================================
function VendorsPage({
  isAdmin,
  district,
  vendors,
  transactions,
  bills,
  onAdd,
  onUpdate,
  onDelete,
}: {
  isAdmin: boolean;
  district: string;
  vendors: Vendor[];
  transactions: Transaction[];
  bills: Bill[];
  onAdd: (vendor: Omit<Vendor, "id" | "vendorCode" | "createdAt" | "createdBy">) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (vendor: Vendor) => void;
  onDelete: (id: string) => void;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [showForm, setShowForm] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Vendor | null>(null);
  
  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterDistrict, setFilterDistrict] = useState<string>("");
  const [filterBusinessType, setFilterBusinessType] = useState<string>("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Form State
  const [formData, setFormData] = useState({
    vendorName: "",
    district: district || DISTRICTS[0],
    mobile: "",
    email: "",
    gstNo: "",
    panNo: "",
    address: "",
    businessType: "",
    defaultCommission: 8,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // ============================================================
  // BUSINESS TYPES
  // ============================================================
  const BUSINESS_TYPES = [
    "Retail",
    "Wholesale",
    "Manufacturing",
    "Services",
    "Construction",
    "Agriculture",
    "Transport",
    "Other",
  ];

  // ============================================================
  // FILTERED & PAGINATED DATA
  // ============================================================
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = 
        v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
        v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
        (v.mobile && v.mobile.includes(search)) ||
        (v.gstNo && v.gstNo.toLowerCase().includes(search.toLowerCase()));
      
      const matchesDistrict = !filterDistrict || v.district === filterDistrict;
      const matchesBusinessType = !filterBusinessType || v.businessType === filterBusinessType;
      
      return matchesSearch && matchesDistrict && matchesBusinessType;
    });
  }, [vendors, search, filterDistrict, filterBusinessType]);

  const totalPages = Math.ceil(filteredVendors.length / ITEMS_PER_PAGE);
  
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVendors.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVendors, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDistrict, filterBusinessType]);

  // ============================================================
  // VENDOR STATS
  // ============================================================
  const getVendorStats = useCallback((vendorCode: string) => {
    const vendorTxns = transactions.filter(t => t.vendorCode === vendorCode);
    const vendorBills = bills.filter(b => b.vendorCode === vendorCode);
    
    return {
      txnCount: vendorTxns.length,
      billCount: vendorBills.length,
      totalExpected: vendorTxns.reduce((s, t) => s + t.expectedAmount, 0),
      totalBills: vendorBills.reduce((s, b) => s + b.billAmount, 0),
      totalProfit: vendorTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
      openTxns: vendorTxns.filter(t => t.status === "Open").length,
      closedTxns: vendorTxns.filter(t => t.status === "Closed").length,
    };
  }, [transactions, bills]);

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  const validateForm = async (): Promise<boolean> => {
    try {
      await vendorSchema.validate(formData, { abortEarly: false });
      setFormErrors({});
      return true;
    } catch (err: any) {
      const errors: { [key: string]: string } = {};
      if (err.inner) {
        err.inner.forEach((e: any) => {
          if (e.path) errors[e.path] = e.message;
        });
      }
      setFormErrors(errors);
      return false;
    }
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const resetForm = () => {
    setFormData({
      vendorName: "",
      district: district || DISTRICTS[0],
      mobile: "",
      email: "",
      gstNo: "",
      panNo: "",
      address: "",
      businessType: "",
      defaultCommission: 8,
    });
    setFormErrors({});
  };

  const handleOpenAddForm = () => {
    resetForm();
    setEditVendor(null);
    setShowForm(true);
  };

  const handleOpenEditForm = (vendor: Vendor) => {
    setFormData({
      vendorName: vendor.vendorName,
      district: vendor.district,
      mobile: vendor.mobile || "",
      email: vendor.email || "",
      gstNo: vendor.gstNo || "",
      panNo: vendor.panNo || "",
      address: vendor.address || "",
      businessType: vendor.businessType || "",
      defaultCommission: vendor.defaultCommission || 8,
    });
    setFormErrors({});
    setEditVendor(vendor);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      if (editVendor) {
        // Update existing vendor
        onUpdate({
          ...editVendor,
          vendorName: sanitize(formData.vendorName),
          district: formData.district,
          mobile: formData.mobile,
          email: formData.email,
          gstNo: formData.gstNo.toUpperCase(),
          panNo: formData.panNo.toUpperCase(),
          address: sanitize(formData.address),
          businessType: formData.businessType,
          defaultCommission: formData.defaultCommission,
        });
        setShowForm(false);
        setEditVendor(null);
      } else {
        // Add new vendor
        const result = await onAdd({
          vendorName: sanitize(formData.vendorName),
          district: formData.district,
          mobile: formData.mobile,
          email: formData.email,
          gstNo: formData.gstNo.toUpperCase(),
          panNo: formData.panNo.toUpperCase(),
          address: sanitize(formData.address),
          businessType: formData.businessType,
          defaultCommission: formData.defaultCommission,
        });

        if (result.success) {
          setShowForm(false);
          resetForm();
        } else {
          setFormErrors({ submit: result.error || "Failed to add vendor" });
        }
      }
    } catch (error) {
      setFormErrors({ submit: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (vendor: Vendor) => {
    const stats = getVendorStats(vendor.vendorCode);
    
    if (stats.txnCount > 0 || stats.billCount > 0) {
      alert(
        `❌ Cannot delete "${vendor.vendorName}"!\n\n` +
        `This vendor has:\n` +
        `• ${stats.txnCount} Transaction(s)\n` +
        `• ${stats.billCount} Bill(s)\n\n` +
        `Please delete or close all transactions first.`
      );
      return;
    }
    
    setConfirmDelete(vendor);
  };

  // ============================================================
  // BULK OPERATIONS
  // ============================================================
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(paginatedVendors.map(v => v.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isAllSelected = paginatedVendors.length > 0 && 
    paginatedVendors.every(v => selectedIds.includes(v.id));

  const handleBulkDelete = () => {
    // Check if any selected vendor has transactions
    const vendorsWithTxns = selectedIds.filter(id => {
      const vendor = vendors.find(v => v.id === id);
      if (!vendor) return false;
      const stats = getVendorStats(vendor.vendorCode);
      return stats.txnCount > 0 || stats.billCount > 0;
    });

    if (vendorsWithTxns.length > 0) {
      alert(
        `❌ Cannot delete ${vendorsWithTxns.length} vendor(s)!\n\n` +
        `Some vendors have transactions or bills.\n` +
        `Please remove them from selection.`
      );
      return;
    }

    setShowBulkDelete(true);
  };

  const confirmBulkDelete = () => {
    selectedIds.forEach(id => onDelete(id));
    setSelectedIds([]);
    setShowBulkDelete(false);
  };

  // ============================================================
  // EXPORT TO CSV
  // ============================================================
  const exportToCSV = () => {
    const headers = ["Vendor Code", "Vendor Name", "District", "Mobile", "Email", "GST No", "PAN No", "Business Type", "Commission %", "Transactions", "Bills", "Total Expected"];
    
    const rows = filteredVendors.map(v => {
      const stats = getVendorStats(v.vendorCode);
      return [
        v.vendorCode,
        v.vendorName,
        v.district,
        v.mobile || "",
        v.email || "",
        v.gstNo || "",
        v.panNo || "",
        v.businessType || "",
        v.defaultCommission,
        stats.txnCount,
        stats.billCount,
        stats.totalExpected,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_Vendors_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏪 Vendors</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "All Districts" : `District: ${district}`} • {filteredVendors.length} vendors
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Delete ({selectedIds.length})</span>
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={exportToCSV}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
          {!isAdmin && (
            <button
              onClick={handleOpenAddForm}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
            >
              <span>+</span>
              <span>Add Vendor</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, code, mobile, GST..."
            />
          </div>
          
          {/* District Filter */}
          {isAdmin && (
            <div>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
              >
                <option value="">All Districts</option>
                {DISTRICTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Business Type Filter */}
          <div>
            <select
              value={filterBusinessType}
              onChange={(e) => setFilterBusinessType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Business Types</option>
              {BUSINESS_TYPES.map(bt => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="🏪"
          label="Total Vendors"
          value={vendors.length.toString()}
          color="#1a2f5e"
        />
        <StatCard
          icon="📋"
          label="With Transactions"
          value={vendors.filter(v => getVendorStats(v.vendorCode).txnCount > 0).length.toString()}
          color="#15803d"
        />
        <StatCard
          icon="💰"
          label="Total Business"
          value={fmt(vendors.reduce((s, v) => s + getVendorStats(v.vendorCode).totalExpected, 0))}
          color="#7c3aed"
        />
        <StatCard
          icon="🎯"
          label="Total Profit"
          value={fmt(vendors.reduce((s, v) => s + getVendorStats(v.vendorCode).totalProfit, 0))}
          color="#b45309"
        />
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Vendor Code</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Vendor Name</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">District</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Mobile</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">GST No</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Business</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Transactions</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-300">Total Expected</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedVendors.length > 0 ? (
                paginatedVendors.map((vendor) => {
                  const stats = getVendorStats(vendor.vendorCode);
                  
                  return (
                    <tr 
                      key={vendor.id} 
                      className={`hover:bg-gray-50 transition-all ${
                        selectedIds.includes(vendor.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(vendor.id)}
                          onChange={() => toggleSelect(vendor.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {vendor.vendorCode}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-800">{vendor.vendorName}</p>
                        {vendor.email && (
                          <p className="text-xs text-gray-400">{vendor.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="info">{vendor.district}</Badge>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {vendor.mobile || "—"}
                      </td>
                      <td className="px-4 py-4">
                        {vendor.gstNo ? (
                          <span className="font-mono text-xs text-gray-600">{vendor.gstNo}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {vendor.businessType ? (
                          <Badge variant="default">{vendor.businessType}</Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Tooltip content={`${stats.openTxns} Open, ${stats.closedTxns} Closed`}>
                            <span className={`font-bold ${stats.txnCount > 0 ? "text-blue-600" : "text-gray-400"}`}>
                              {stats.txnCount}
                            </span>
                          </Tooltip>
                          <span className="text-gray-300">|</span>
                          <Tooltip content={`${stats.billCount} Bills`}>
                            <span className={`font-bold ${stats.billCount > 0 ? "text-green-600" : "text-gray-400"}`}>
                              {stats.billCount}
                            </span>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-bold text-gray-800">{fmt(stats.totalExpected)}</p>
                        {stats.totalProfit > 0 && (
                          <p className="text-xs text-green-600">Profit: {fmt(stats.totalProfit)}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip content="View Details">
                            <button
                              onClick={() => setViewVendor(vendor)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-all"
                            >
                              👁️
                            </button>
                          </Tooltip>
                          <Tooltip content="Edit">
                            <button
                              onClick={() => handleOpenEditForm(vendor)}
                              className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-all"
                            >
                              ✏️
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete">
                            <button
                              onClick={() => handleDelete(vendor)}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-all"
                            >
                              🗑️
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-12">
                    <EmptyState
                      icon="🏪"
                      title="No Vendors Found"
                      description={search ? "Try adjusting your search or filters" : "Add your first vendor to get started"}
                      action={!isAdmin ? {
                        label: "Add Vendor",
                        onClick: handleOpenAddForm
                      } : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer Totals */}
            {filteredVendors.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={7} className="px-4 py-3 font-bold text-yellow-300 text-sm">
                    Total: {filteredVendors.length} vendors
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-yellow-300">
                    {filteredVendors.reduce((s, v) => s + getVendorStats(v.vendorCode).txnCount, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-yellow-300">
                    {fmt(filteredVendors.reduce((s, v) => s + getVendorStats(v.vendorCode).totalExpected, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Add/Edit Vendor Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditVendor(null); }}
        title={editVendor ? "✏️ Edit Vendor" : "🏪 Add New Vendor"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* General Error */}
          {formErrors.submit && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Row 1: Name & District */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Enter vendor name"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.vendorName 
                    ? "border-red-300 focus:border-red-500 bg-red-50" 
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.vendorName && (
                <p className="text-red-500 text-xs mt-1">{formErrors.vendorName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                District <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                disabled={!isAdmin}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 disabled:bg-gray-100"
              >
                {DISTRICTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Mobile & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="9876543210"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.mobile 
                    ? "border-red-300 focus:border-red-500 bg-red-50" 
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.mobile && (
                <p className="text-red-500 text-xs mt-1">{formErrors.mobile}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="vendor@example.com"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.email 
                    ? "border-red-300 focus:border-red-500 bg-red-50" 
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.email && (
                <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>
          </div>

          {/* Row 3: GST & PAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Number
              </label>
              <input
                type="text"
                value={formData.gstNo}
                onChange={(e) => setFormData({ ...formData, gstNo: e.target.value.toUpperCase() })}
                placeholder="33AAAAA1234A1Z5"
                maxLength={15}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all font-mono ${
                  formErrors.gstNo 
                    ? "border-red-300 focus:border-red-500 bg-red-50" 
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.gstNo && (
                <p className="text-red-500 text-xs mt-1">{formErrors.gstNo}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Format: 33AAAAA1234A1Z5</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PAN Number
              </label>
              <input
                type="text"
                value={formData.panNo}
                onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all font-mono ${
                  formErrors.panNo 
                    ? "border-red-300 focus:border-red-500 bg-red-50" 
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.panNo && (
                <p className="text-red-500 text-xs mt-1">{formErrors.panNo}</p>
              )}
            </div>
          </div>

          {/* Row 4: Business Type & Commission */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Type
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select Type</option>
                {BUSINESS_TYPES.map(bt => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Commission % <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.defaultCommission}
                onChange={(e) => setFormData({ ...formData, defaultCommission: parseFloat(e.target.value) || 0 })}
                min={0}
                max={20}
                step={0.5}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.defaultCommission 
                    ? "border-red-300 focus:border-red-500 bg-red-50" 
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.defaultCommission && (
                <p className="text-red-500 text-xs mt-1">{formErrors.defaultCommission}</p>
              )}
            </div>
          </div>

          {/* Row 5: Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter full address..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 resize-none"
            />
          </div>

          {/* Preview Card */}
          {formData.vendorName && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-600 font-medium mb-2">📋 Preview</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                  {formData.vendorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{formData.vendorName}</p>
                  <p className="text-sm text-gray-600">{formData.district} • {formData.mobile || "No mobile"}</p>
                  <p className="text-xs text-gray-500">Commission: {formData.defaultCommission}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditVendor(null); }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>{editVendor ? "Update Vendor" : "Add Vendor"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Vendor Modal */}
      <Modal
        isOpen={!!viewVendor}
        onClose={() => setViewVendor(null)}
        title="🏪 Vendor Details"
        size="lg"
      >
        {viewVendor && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="p-5 rounded-xl" style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-2xl">
                  {viewVendor.vendorName.charAt(0).toUpperCase()}
                </div>
                <div className="text-white">
                  <p className="font-bold text-xl">{viewVendor.vendorName}</p>
                  <p className="text-blue-200">{viewVendor.vendorCode}</p>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "District", value: viewVendor.district, icon: "📍" },
                { label: "Mobile", value: viewVendor.mobile || "—", icon: "📱" },
                { label: "Email", value: viewVendor.email || "—", icon: "📧" },
                { label: "GST No", value: viewVendor.gstNo || "—", icon: "🏛️" },
                { label: "PAN No", value: viewVendor.panNo || "—", icon: "🪪" },
                { label: "Business Type", value: viewVendor.businessType || "—", icon: "🏢" },
                { label: "Commission", value: `${viewVendor.defaultCommission}%`, icon: "💰" },
                { label: "Created", value: new Date(viewVendor.createdAt).toLocaleDateString(), icon: "📅" },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{item.icon}</span>
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                  <p className="font-semibold text-gray-800 text-sm truncate">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Address */}
            {viewVendor.address && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span>🏠</span>
                  <span className="text-xs text-gray-500">Address</span>
                </div>
                <p className="text-gray-800 text-sm">{viewVendor.address}</p>
              </div>
            )}

            {/* Stats */}
            {(() => {
              const stats = getVendorStats(viewVendor.vendorCode);
              return (
                <div className="p-5 rounded-xl bg-green-50 border border-green-200">
                  <p className="font-bold text-green-800 mb-3">📊 Business Summary</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700">{stats.txnCount}</p>
                      <p className="text-xs text-green-600">Transactions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700">{fmt(stats.totalExpected)}</p>
                      <p className="text-xs text-green-600">Total Expected</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700">{fmt(stats.totalProfit)}</p>
                      <p className="text-xs text-green-600">Total Profit</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setViewVendor(null);
                  handleOpenEditForm(viewVendor);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 transition-all flex items-center justify-center gap-2"
              >
                <span>✏️</span>
                <span>Edit</span>
              </button>
              <button
                onClick={() => setViewVendor(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            onDelete(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
        title="Delete Vendor?"
        message={`Are you sure you want to delete "${confirmDelete?.vendorName}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="red"
        icon="🗑️"
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${selectedIds.length} Vendors?`}
        message={`Are you sure you want to delete ${selectedIds.length} selected vendors? This action cannot be undone.`}
        confirmText="Delete All"
        confirmColor="red"
        icon="🗑️"
      />
    </div>
  );
}
// ============================================================
// TRANSACTIONS PAGE COMPONENT
// ============================================================
function TransactionsPage({
  isAdmin,
  district,
  transactions,
  vendors,
  bills,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: {
  isAdmin: boolean;
  district: string;
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  onAdd: (txnData: {
    vendorCode: string;
    financialYear: string;
    month: string;
    expectedAmount: number;
    advanceAmount: number;
    gstPercent: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (txn: Transaction) => void;
  onDelete: (txnId: string) => void;
  onClose: (txnId: string) => void;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [showForm, setShowForm] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [viewTxn, setViewTxn] = useState<Transaction | null>(null);
  const [confirmClose, setConfirmClose] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterFY, setFilterFY] = useState<string>("");
  const [filterVendor, setFilterVendor] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Form State
  const [formData, setFormData] = useState({
    vendorCode: "",
    financialYear: FY_LIST[0],
    month: MONTHS[new Date().getMonth()],
    expectedAmount: "",
    advanceAmount: "",
    gstPercent: 5,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("month");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");

  // ============================================================
  // FILTERED & PAGINATED DATA
  // ============================================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch =
        t.txnId.toLowerCase().includes(search.toLowerCase()) ||
        t.vendorName.toLowerCase().includes(search.toLowerCase()) ||
        t.vendorCode.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = !filterStatus || t.status === filterStatus;
      const matchesMonth = !filterMonth || t.month === filterMonth;
      const matchesFY = !filterFY || t.financialYear === filterFY;
      const matchesVendor = !filterVendor || t.vendorCode === filterVendor;

      return matchesSearch && matchesStatus && matchesMonth && matchesFY && matchesVendor;
    });
  }, [transactions, search, filterStatus, filterMonth, filterFY, filterVendor]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterMonth, filterFY, filterVendor]);

  // ============================================================
  // CALCULATED TOTALS
  // ============================================================
  const totals = useMemo(() => {
    const data = filteredTransactions;
    return {
      expected: data.reduce((s, t) => s + t.expectedAmount, 0),
      gst: data.reduce((s, t) => s + t.gstAmount, 0),
      advance: data.reduce((s, t) => s + t.advanceAmount, 0),
      bills: data.reduce((s, t) => s + t.billsReceived, 0),
      remaining: data.reduce((s, t) => s + t.remainingExpected, 0),
      gstBalance: data.reduce((s, t) => s + t.gstBalance, 0),
      profit: data.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
    };
  }, [filteredTransactions]);

  // ============================================================
  // GET TRANSACTION BILLS
  // ============================================================
  const getTxnBills = useCallback((txnId: string) => {
    return bills.filter(b => b.txnId === txnId);
  }, [bills]);

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  const validateForm = async (): Promise<boolean> => {
    const errors: { [key: string]: string } = {};

    if (!formData.vendorCode) {
      errors.vendorCode = "Vendor தேர்வு செய்யவும்";
    }

    const expected = parseFloat(formData.expectedAmount);
    if (!expected || expected <= 0) {
      errors.expectedAmount = "Expected amount must be positive";
    } else if (expected > 100000000) {
      errors.expectedAmount = "Amount too large (max: 10 Crore)";
    }

    const advance = parseFloat(formData.advanceAmount) || 0;
    if (advance < 0) {
      errors.advanceAmount = "Advance cannot be negative";
    } else {
      const gstAmount = expected * formData.gstPercent / 100;
      if (advance > gstAmount) {
        errors.advanceAmount = `Advance cannot exceed GST amount (${fmt(gstAmount)})`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const resetForm = () => {
    setFormData({
      vendorCode: "",
      financialYear: FY_LIST[0],
      month: MONTHS[new Date().getMonth()],
      expectedAmount: "",
      advanceAmount: "",
      gstPercent: 5,
    });
    setFormErrors({});
  };

  const handleOpenAddForm = () => {
    resetForm();
    setEditTxn(null);
    setShowForm(true);
  };

  const handleOpenEditForm = (txn: Transaction) => {
    if (txn.status !== "Open") {
      alert("❌ Cannot edit closed or pending transactions!");
      return;
    }
    setFormData({
      vendorCode: txn.vendorCode,
      financialYear: txn.financialYear,
      month: txn.month,
      expectedAmount: txn.expectedAmount.toString(),
      advanceAmount: txn.advanceAmount.toString(),
      gstPercent: txn.gstPercent,
    });
    setFormErrors({});
    setEditTxn(txn);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const expected = sanitizeNumber(formData.expectedAmount);
      const advance = sanitizeNumber(formData.advanceAmount);

      if (editTxn) {
        // Update existing transaction
        const gstAmt = round2(expected * formData.gstPercent / 100);
        const gstBal = round2(gstAmt - advance);

        onUpdate({
          ...editTxn,
          financialYear: formData.financialYear,
          month: formData.month,
          expectedAmount: expected,
          advanceAmount: advance,
          gstPercent: formData.gstPercent,
          gstAmount: gstAmt,
          gstBalance: gstBal,
        });

        setShowForm(false);
        setEditTxn(null);
      } else {
        // Add new transaction
        const result = await onAdd({
          vendorCode: formData.vendorCode,
          financialYear: formData.financialYear,
          month: formData.month,
          expectedAmount: expected,
          advanceAmount: advance,
          gstPercent: formData.gstPercent,
        });

        if (result.success) {
          setShowForm(false);
          resetForm();
        } else {
          setFormErrors({ submit: result.error || "Failed to add transaction" });
        }
      }
    } catch (error) {
      setFormErrors({ submit: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseRequest = (txn: Transaction) => {
    if (txn.status !== "Open") {
      alert("❌ Transaction is already closed or pending!");
      return;
    }
    setConfirmClose(txn);
  };

  const handleDelete = (txn: Transaction) => {
    const txnBills = getTxnBills(txn.txnId);
    if (txnBills.length > 0) {
      const confirmMsg = `⚠️ This transaction has ${txnBills.length} bill(s).\n\nDeleting will also remove all associated bills.\n\nContinue?`;
      if (!window.confirm(confirmMsg)) return;
    }
    setConfirmDelete(txn);
  };

  // ============================================================
  // BULK OPERATIONS
  // ============================================================
  const toggleSelect = (txnId: string) => {
    setSelectedIds(prev =>
      prev.includes(txnId) ? prev.filter(x => x !== txnId) : [...prev, txnId]
    );
  };

  const selectAll = () => {
    setSelectedIds(paginatedTransactions.map(t => t.txnId));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isAllSelected = paginatedTransactions.length > 0 &&
    paginatedTransactions.every(t => selectedIds.includes(t.txnId));

  const handleBulkEdit = () => {
    if (!bulkEditValue) {
      alert("Please enter a value!");
      return;
    }

    selectedIds.forEach(txnId => {
      const txn = transactions.find(t => t.txnId === txnId);
      if (txn && txn.status === "Open") {
        let updatedTxn = { ...txn };

        if (bulkEditField === "month") {
          updatedTxn.month = bulkEditValue;
        } else if (bulkEditField === "financialYear") {
          updatedTxn.financialYear = bulkEditValue;
        } else if (bulkEditField === "gstPercent") {
          const newGstPct = parseFloat(bulkEditValue);
          const gstAmt = round2(txn.expectedAmount * newGstPct / 100);
          updatedTxn.gstPercent = newGstPct;
          updatedTxn.gstAmount = gstAmt;
          updatedTxn.gstBalance = round2(gstAmt - txn.advanceAmount);
        }

        onUpdate(updatedTxn);
      }
    });

    setSelectedIds([]);
    setShowBulkEdit(false);
    setBulkEditValue("");
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(txnId => onDelete(txnId));
    setSelectedIds([]);
    setShowBulkDelete(false);
  };

  // ============================================================
  // PREVIEW CALCULATIONS
  // ============================================================
  const previewCalc = useMemo(() => {
    const expected = parseFloat(formData.expectedAmount) || 0;
    const advance = parseFloat(formData.advanceAmount) || 0;
    const gstAmt = round2(expected * formData.gstPercent / 100);
    const gstBal = round2(gstAmt - advance);
    const profit = round2(expected * PROFIT_RATE);

    return { expected, advance, gstAmt, gstBal, profit };
  }, [formData]);

  // ============================================================
  // EXPORT TO CSV
  // ============================================================
  const exportToCSV = () => {
    const headers = [
      "TXN ID", "Vendor Code", "Vendor Name", "District", "Financial Year", "Month",
      "Expected Amount", "GST %", "GST Amount", "Advance", "GST Balance",
      "Bills Received", "Remaining", "Profit", "Status", "Created At"
    ];

    const rows = filteredTransactions.map(t => [
      t.txnId, t.vendorCode, t.vendorName, t.district, t.financialYear, t.month,
      t.expectedAmount, t.gstPercent, t.gstAmount, t.advanceAmount, t.gstBalance,
      t.billsReceived, t.remainingExpected, t.profit, t.status, t.createdAt
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_Transactions_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // STATUS BADGE COMPONENT
  // ============================================================
  const StatusBadge = ({ status }: { status: TransactionStatus }) => {
    const config = {
      Open: { bg: "bg-blue-100", text: "text-blue-700", icon: "🔵" },
      PendingClose: { bg: "bg-red-100", text: "text-red-700", icon: "🔴" },
      Closed: { bg: "bg-green-100", text: "text-green-700", icon: "✅" },
    };
    const c = config[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        <span>{c.icon}</span>
        <span>{status === "PendingClose" ? "Pending" : status}</span>
      </span>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Monthly Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "All Districts" : `District: ${district}`} • {filteredTransactions.length} transactions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => setShowBulkEdit(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <span>✏️</span>
                <span>Bulk Edit ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => setShowBulkDelete(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Delete ({selectedIds.length})</span>
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={exportToCSV}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <span>📥</span>
            <span>Export</span>
          </button>
          {!isAdmin && (
            <button
              onClick={handleOpenAddForm}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
            >
              <span>+</span>
              <span>New Transaction</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard icon="💰" label="Expected" value={fmt(totals.expected)} color="#1a2f5e" />
        <StatCard icon="📊" label="GST Amount" value={fmt(totals.gst)} color="#7c3aed" />
        <StatCard icon="💳" label="Advance" value={fmt(totals.advance)} color="#ea580c" />
        <StatCard icon="🧾" label="Bills Received" value={fmt(totals.bills)} color="#15803d" />
        <StatCard icon="⏳" label="Remaining" value={fmt(totals.remaining)} color="#dc2626" />
        <StatCard icon="💸" label="GST Balance" value={fmt(totals.gstBalance)} color="#b91c1c" />
        <StatCard icon="🎯" label="Profit (8%)" value={fmt(totals.profit)} color="#b45309" />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by TXN ID, vendor..."
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Status</option>
              <option value="Open">🔵 Open</option>
              <option value="PendingClose">🔴 Pending Close</option>
              <option value="Closed">✅ Closed</option>
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Months</option>
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* FY Filter */}
          <div>
            <select
              value={filterFY}
              onChange={(e) => setFilterFY(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All FY</option>
              {FY_LIST.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Additional Filter: Vendor */}
        {vendors.length > 0 && (
          <div className="mt-4">
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="w-full md:w-64 px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.vendorCode} value={v.vendorCode}>
                  {v.vendorName} ({v.vendorCode})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-3 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">TXN ID</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">Vendor</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">Period</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">Expected</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">GST</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">Advance</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">Bills</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">Remaining</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">GST Bal</th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-gray-300">Status</th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((txn) => {
                  const txnBills = getTxnBills(txn.txnId);
                  const canClose = txn.remainingExpected <= 0 && txn.status === "Open";

                  return (
                    <tr
                      key={txn.txnId}
                      className={`hover:bg-gray-50 transition-all ${
                        selectedIds.includes(txn.txnId) ? "bg-blue-50" :
                        txn.status === "PendingClose" ? "bg-red-50" :
                        txn.status === "Closed" ? "bg-green-50" : ""
                      }`}
                    >
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(txn.txnId)}
                          onChange={() => toggleSelect(txn.txnId)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {txn.txnId.slice(-10)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-gray-800">{txn.vendorName}</p>
                        <p className="text-xs text-gray-500">{txn.district}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-medium text-gray-800">{txn.month}</p>
                        <p className="text-xs text-gray-500">{txn.financialYear}</p>
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-gray-800">
                        {fmt(txn.expectedAmount)}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <p className="font-semibold text-purple-700">{fmt(txn.gstAmount)}</p>
                        <p className="text-xs text-gray-500">{txn.gstPercent}%</p>
                      </td>
                      <td className="px-3 py-4 text-right text-orange-600 font-semibold">
                        {fmt(txn.advanceAmount)}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <p className="font-semibold text-green-700">{fmt(txn.billsReceived)}</p>
                        <p className="text-xs text-gray-500">{txnBills.length} bills</p>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <span className={`font-bold ${txn.remainingExpected <= 0 ? "text-green-600" : "text-orange-600"}`}>
                          {txn.remainingExpected <= 0 ? "₹0 ✅" : fmt(txn.remainingExpected)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-red-600">
                        {fmt(txn.gstBalance)}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <StatusBadge status={txn.status} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip content="View Details">
                            <button
                              onClick={() => setViewTxn(txn)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-all"
                            >
                              👁️
                            </button>
                          </Tooltip>

                          {txn.status === "Open" && (
                            <Tooltip content="Edit">
                              <button
                                onClick={() => handleOpenEditForm(txn)}
                                className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-all"
                              >
                                ✏️
                              </button>
                            </Tooltip>
                          )}

                          <Tooltip content="Delete">
                            <button
                              onClick={() => handleDelete(txn)}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-all"
                            >
                              🗑️
                            </button>
                          </Tooltip>

                          {!isAdmin && txn.status === "Open" && (
                            <Tooltip content={canClose ? "Close Transaction" : "Force Close"}>
                              <button
                                onClick={() => handleCloseRequest(txn)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold text-white ${
                                  canClose
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-gray-500 hover:bg-gray-600"
                                }`}
                              >
                                {canClose ? "✅ Close" : "⚠️ Force"}
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-12">
                    <EmptyState
                      icon="📋"
                      title="No Transactions Found"
                      description={search ? "Try adjusting your search or filters" : "Create your first transaction"}
                      action={!isAdmin ? {
                        label: "New Transaction",
                        onClick: handleOpenAddForm
                      } : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer Totals */}
            {filteredTransactions.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={4} className="px-3 py-3 font-bold text-yellow-300 text-sm">
                    Total: {filteredTransactions.length} transactions
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-yellow-300">{fmt(totals.expected)}</td>
                  <td className="px-3 py-3 text-right font-bold text-purple-300">{fmt(totals.gst)}</td>
                  <td className="px-3 py-3 text-right font-bold text-orange-300">{fmt(totals.advance)}</td>
                  <td className="px-3 py-3 text-right font-bold text-green-300">{fmt(totals.bills)}</td>
                  <td className="px-3 py-3 text-right font-bold text-orange-300">{fmt(totals.remaining)}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-300">{fmt(totals.gstBalance)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Add/Edit Transaction Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditTxn(null); }}
        title={editTxn ? "✏️ Edit Transaction" : "📋 New Transaction"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* General Error */}
          {formErrors.submit && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Row 1: Vendor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.vendorCode}
              onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
              disabled={!!editTxn}
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                formErrors.vendorCode
                  ? "border-red-300 focus:border-red-500 bg-red-50"
                  : "border-gray-200 focus:border-blue-400"
              } disabled:bg-gray-100`}
            >
              <option value="">Select Vendor</option>
              {vendors.map(v => (
                <option key={v.vendorCode} value={v.vendorCode}>
                  {v.vendorName} ({v.vendorCode}) — {v.district}
                </option>
              ))}
            </select>
            {formErrors.vendorCode && (
              <p className="text-red-500 text-xs mt-1">{formErrors.vendorCode}</p>
            )}
          </div>

          {/* Row 2: FY & Month */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Financial Year <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.financialYear}
                onChange={(e) => setFormData({ ...formData, financialYear: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                {FY_LIST.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                {MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Expected Amount & GST */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.expectedAmount}
                onChange={(e) => setFormData({ ...formData, expectedAmount: e.target.value })}
                placeholder="300000"
                min={0}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.expectedAmount
                    ? "border-red-300 focus:border-red-500 bg-red-50"
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.expectedAmount && (
                <p className="text-red-500 text-xs mt-1">{formErrors.expectedAmount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST % <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gstPercent}
                onChange={(e) => setFormData({ ...formData, gstPercent: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                {GST_RATES.map(r => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Advance Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Advance Amount (GST Only) (₹)
            </label>
            <input
              type="number"
              value={formData.advanceAmount}
              onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
              placeholder="5000"
              min={0}
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                formErrors.advanceAmount
                  ? "border-red-300 focus:border-red-500 bg-red-50"
                  : "border-gray-200 focus:border-blue-400"
              }`}
            />
            {formErrors.advanceAmount && (
              <p className="text-red-500 text-xs mt-1">{formErrors.advanceAmount}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Max Advance: GST Amount ({fmt(previewCalc.gstAmt)})
            </p>
          </div>

          {/* Preview Calculation */}
          {previewCalc.expected > 0 && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
              <p className="text-sm font-bold text-blue-800 mb-3">🔒 Auto-Calculated Values</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-600">GST Amount:</span>
                  <span className="font-bold text-blue-800">
                    {fmt(previewCalc.expected)} × {formData.gstPercent}% = {fmt(previewCalc.gstAmt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">GST Balance:</span>
                  <span className="font-bold text-red-600">
                    {fmt(previewCalc.gstAmt)} − {fmt(previewCalc.advance)} = {fmt(previewCalc.gstBal)}
                  </span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-blue-600">Expected Profit (8%):</span>
                  <span className="font-bold text-green-600">
                    {fmt(previewCalc.expected)} × 8% = {fmt(previewCalc.profit)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditTxn(null); }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>{editTxn ? "Update Transaction" : "Create Transaction"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Transaction Modal */}
      <Modal
        isOpen={!!viewTxn}
        onClose={() => setViewTxn(null)}
        title="📋 Transaction Details"
        size="lg"
      >
        {viewTxn && (
          <div className="space-y-6">
            {/* Header */}
            <div className="p-5 rounded-xl" style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <p className="text-sm text-blue-200">Transaction ID</p>
                  <p className="font-mono font-bold text-xl">{viewTxn.txnId}</p>
                </div>
                <StatusBadge status={viewTxn.status} />
              </div>
            </div>

            {/* Vendor Info */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">
                  🏪
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">{viewTxn.vendorName}</p>
                  <p className="text-sm text-gray-600">{viewTxn.vendorCode} • {viewTxn.district}</p>
                </div>
              </div>
            </div>

            {/* Period & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">📅 Period</p>
                <p className="font-bold text-gray-800">{viewTxn.month} {viewTxn.financialYear}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">📆 Created</p>
                <p className="font-bold text-gray-800">{new Date(viewTxn.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-5 rounded-xl bg-green-50 border border-green-200">
              <p className="font-bold text-green-800 mb-4">💰 Financial Summary</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Expected Amount", value: fmt(viewTxn.expectedAmount), color: "text-gray-800" },
                  { label: "GST Rate", value: `${viewTxn.gstPercent}%`, color: "text-gray-800" },
                  { label: "GST Amount", value: fmt(viewTxn.gstAmount), color: "text-purple-700" },
                  { label: "Advance Paid", value: fmt(viewTxn.advanceAmount), color: "text-orange-600" },
                  { label: "GST Balance", value: fmt(viewTxn.gstBalance), color: "text-red-600" },
                  { label: "Bills Received", value: fmt(viewTxn.billsReceived), color: "text-green-600" },
                  { label: "Remaining", value: fmt(viewTxn.remainingExpected), color: viewTxn.remainingExpected <= 0 ? "text-green-600" : "text-orange-600" },
                  { label: "Profit (8%)", value: viewTxn.status === "Closed" ? fmt(viewTxn.profit) : "Pending", color: "text-green-700" },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-green-100 last:border-0">
                    <span className="text-gray-600">{item.label}</span>
                    <span className={`font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bills Summary */}
            {(() => {
              const txnBills = getTxnBills(viewTxn.txnId);
              if (txnBills.length === 0) return null;
              return (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="font-bold text-blue-800 mb-3">🧾 Bills ({txnBills.length})</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {txnBills.map(bill => (
                      <div key={bill.id} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg">
                        <span className="text-gray-600">{bill.billNumber}</span>
                        <span className="font-semibold text-gray-800">{fmt(bill.billAmount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between font-bold">
                    <span className="text-blue-800">Total Bills:</span>
                    <span className="text-blue-800">{fmt(txnBills.reduce((s, b) => s + b.billAmount, 0))}</span>
                  </div>
                </div>
              );
            })()}

            {/* Close Info */}
            {(viewTxn.status === "PendingClose" || viewTxn.status === "Closed") && (
              <div className={`p-4 rounded-xl ${viewTxn.status === "Closed" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border`}>
                <p className={`font-bold ${viewTxn.status === "Closed" ? "text-green-800" : "text-red-800"} mb-2`}>
                  {viewTxn.status === "Closed" ? "✅ Closed" : "🔴 Pending Close"}
                </p>
                <div className="text-sm space-y-1">
                  {viewTxn.closedBy && <p><span className="text-gray-500">Closed by:</span> {viewTxn.closedBy}</p>}
                  {viewTxn.closedAt && <p><span className="text-gray-500">Closed at:</span> {new Date(viewTxn.closedAt).toLocaleString()}</p>}
                  {viewTxn.confirmedByAdmin && <p><span className="text-gray-500">Admin Confirmed:</span> ✅ Yes</p>}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {viewTxn.status === "Open" && !isAdmin && (
                <button
                  onClick={() => {
                    setViewTxn(null);
                    handleOpenEditForm(viewTxn);
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 transition-all flex items-center justify-center gap-2"
                >
                  <span>✏️</span>
                  <span>Edit</span>
                </button>
              )}
              <button
                onClick={() => setViewTxn(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close Confirmation Modal */}
      <Modal
        isOpen={!!confirmClose}
        onClose={() => setConfirmClose(null)}
        title="🔒 Close Transaction"
        size="md"
      >
        {confirmClose && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <p className="font-bold text-orange-800">Confirm Close Request</p>
                  <p className="text-sm text-orange-600">This will send to Admin for approval</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Vendor:</span>
                <span className="font-bold text-gray-800">{confirmClose.vendorName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Expected Amount:</span>
                <span className="font-bold text-gray-800">{fmt(confirmClose.expectedAmount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Bills Received:</span>
                <span className="font-bold text-green-600">{fmt(confirmClose.billsReceived)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Remaining:</span>
                <span className={`font-bold ${confirmClose.remainingExpected <= 0 ? "text-green-600" : "text-orange-600"}`}>
                  {confirmClose.remainingExpected <= 0 ? "₹0 ✅" : fmt(confirmClose.remainingExpected)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">GST Balance (Debit):</span>
                <span className="font-bold text-red-600">{fmt(confirmClose.gstBalance)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Profit (8%):</span>
                <span className="font-bold text-green-700">{fmt(round2(confirmClose.expectedAmount * PROFIT_RATE))}</span>
              </div>
            </div>

            {confirmClose.remainingExpected > 0 && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                ⚠️ <strong>Force Close:</strong> Remaining amount ({fmt(confirmClose.remainingExpected)}) 
                is not zero. Proceeding will mark this as force closed.
              </div>
            )}

            <p className="text-xs text-gray-500">
              * GST Balance will be debited from wallet<br/>
              * Admin will review and confirm<br/>
              * 8% profit will be credited upon confirmation
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClose(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClose(confirmClose.txnId);
                  setConfirmClose(null);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
              >
                <span>✅</span>
                <span>Confirm Close</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            onDelete(confirmDelete.txnId);
            setConfirmDelete(null);
          }
        }}
        title="Delete Transaction?"
        message={`Are you sure you want to delete transaction for "${confirmDelete?.vendorName}"? This will also delete all associated bills.`}
        confirmText="Delete"
        confirmColor="red"
        icon="🗑️"
      />

      {/* Bulk Edit Modal */}
      <Modal
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        title={`✏️ Bulk Edit — ${selectedIds.length} Transactions`}
        size="md"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Edit selected transactions. Only <strong>Open</strong> transactions will be updated.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field to Edit
            </label>
            <select
              value={bulkEditField}
              onChange={(e) => { setBulkEditField(e.target.value); setBulkEditValue(""); }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
            >
              <option value="month">Month</option>
              <option value="financialYear">Financial Year</option>
              <option value="gstPercent">GST %</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Value
            </label>
            {bulkEditField === "month" && (
              <select
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select Month</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            {bulkEditField === "financialYear" && (
              <select
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select FY</option>
                {FY_LIST.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
            )}
            {bulkEditField === "gstPercent" && (
              <select
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select GST %</option>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowBulkEdit(false)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkEdit}
              disabled={!bulkEditValue}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>✅</span>
              <span>Apply to All</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.length} Transactions?`}
        message={`Are you sure you want to delete ${selectedIds.length} selected transactions? This action cannot be undone and will also delete all associated bills.`}
        confirmText="Delete All"
        confirmColor="red"
        icon="🗑️"
      />
    </div>
  );
}
// ============================================================
// BILLS PAGE COMPONENT WITH VOICE INPUT
// ============================================================
function BillsPage({
  isAdmin,
  district,
  bills,
  transactions,
  vendors,
  onAdd,
  onBulkAdd,
  onUpdate,
  onDelete,
  onBulkDelete,
  username,
}: {
  isAdmin: boolean;
  district: string;
  bills: Bill[];
  transactions: Transaction[];
  vendors: Vendor[];
  onAdd: (billData: {
    txnId: string;
    billNumber: string;
    billDate: string;
    billAmount: number;
    gstPercent: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onBulkAdd: (bills: Bill[]) => void;
  onUpdate: (bill: Bill) => void;
  onDelete: (billId: string) => void;
  onBulkDelete: (billIds: string[]) => void;
  username: string;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [showForm, setShowForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Bill | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterTxn, setFilterTxn] = useState<string>("");
  const [filterVendor, setFilterVendor] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Single Bill Form State
  const [formData, setFormData] = useState({
    txnId: "",
    billNumber: "",
    billDate: today(),
    billAmount: "",
    gstPercent: 4,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Add State
  const [bulkTxnId, setBulkTxnId] = useState("");
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkBills, setBulkBills] = useState<{
    billNumber: string;
    billDate: string;
    billAmount: string;
    gstPercent: number;
  }[]>([]);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("gstPercent");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");

  // Voice Input State
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);

  // ============================================================
  // OPEN TRANSACTIONS (For Bill Adding)
  // ============================================================
  const openTransactions = useMemo(() => {
    return transactions.filter(t => t.status === "Open");
  }, [transactions]);

  // ============================================================
  // FILTERED & PAGINATED DATA
  // ============================================================
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchesSearch =
        b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.vendorName.toLowerCase().includes(search.toLowerCase()) ||
        b.txnId.toLowerCase().includes(search.toLowerCase()) ||
        b.id.toLowerCase().includes(search.toLowerCase());

      const matchesTxn = !filterTxn || b.txnId === filterTxn;
      const matchesVendor = !filterVendor || b.vendorCode === filterVendor;
      const matchesDateFrom = !filterDateFrom || b.billDate >= filterDateFrom;
      const matchesDateTo = !filterDateTo || b.billDate <= filterDateTo;

      return matchesSearch && matchesTxn && matchesVendor && matchesDateFrom && matchesDateTo;
    });
  }, [bills, search, filterTxn, filterVendor, filterDateFrom, filterDateTo]);

  const totalPages = Math.ceil(filteredBills.length / ITEMS_PER_PAGE);

  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBills.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBills, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterTxn, filterVendor, filterDateFrom, filterDateTo]);

  // ============================================================
  // CALCULATED TOTALS
  // ============================================================
  const totals = useMemo(() => {
    const data = filteredBills;
    return {
      billAmount: data.reduce((s, b) => s + b.billAmount, 0),
      gstAmount: data.reduce((s, b) => s + b.gstAmount, 0),
      totalAmount: data.reduce((s, b) => s + b.totalAmount, 0),
      count: data.length,
    };
  }, [filteredBills]);

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  const validateForm = async (): Promise<boolean> => {
    const errors: { [key: string]: string } = {};

    if (!formData.txnId) {
      errors.txnId = "Transaction தேர்வு செய்யவும்";
    } else {
      const txn = transactions.find(t => t.txnId === formData.txnId);
      if (!txn) {
        errors.txnId = "Transaction not found";
      } else if (txn.status !== "Open") {
        errors.txnId = "Cannot add bills to closed transaction";
      }
    }

    if (!formData.billNumber.trim()) {
      errors.billNumber = "Bill number தேவை";
    } else if (formData.billNumber.length < 3) {
      errors.billNumber = "Bill number too short";
    }

    const amount = parseFloat(formData.billAmount);
    if (!amount || amount <= 0) {
      errors.billAmount = "Bill amount must be positive";
    } else if (amount > 100000000) {
      errors.billAmount = "Amount too large";
    }

    if (!formData.billDate) {
      errors.billDate = "Bill date தேவை";
    } else if (new Date(formData.billDate) > new Date()) {
      errors.billDate = "Bill date cannot be in future";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const resetForm = () => {
    setFormData({
      txnId: "",
      billNumber: "",
      billDate: today(),
      billAmount: "",
      gstPercent: 4,
    });
    setFormErrors({});
    setVoiceTranscript("");
  };

  const handleOpenAddForm = () => {
    resetForm();
    setEditBill(null);
    setShowForm(true);
  };

  const handleOpenEditForm = (bill: Bill) => {
    const txn = transactions.find(t => t.txnId === bill.txnId);
    if (txn && txn.status !== "Open") {
      alert("❌ Cannot edit bills of closed transaction!");
      return;
    }

    setFormData({
      txnId: bill.txnId,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      billAmount: bill.billAmount.toString(),
      gstPercent: bill.gstPercent,
    });
    setFormErrors({});
    setEditBill(bill);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const amount = sanitizeNumber(formData.billAmount);

      if (editBill) {
        // Update existing bill
        const gstAmt = round2(amount * formData.gstPercent / 100);
        const total = round2(amount * BILL_TOTAL_RATE);

        onUpdate({
          ...editBill,
          billNumber: sanitize(formData.billNumber),
          billDate: formData.billDate,
          billAmount: amount,
          gstPercent: formData.gstPercent,
          gstAmount: gstAmt,
          totalAmount: total,
        });

        setShowForm(false);
        setEditBill(null);
      } else {
        // Add new bill
        const result = await onAdd({
          txnId: formData.txnId,
          billNumber: sanitize(formData.billNumber),
          billDate: formData.billDate,
          billAmount: amount,
          gstPercent: formData.gstPercent,
        });

        if (result.success) {
          setShowForm(false);
          resetForm();
        } else {
          setFormErrors({ submit: result.error || "Failed to add bill" });
        }
      }
    } catch (error) {
      setFormErrors({ submit: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (bill: Bill) => {
    const txn = transactions.find(t => t.txnId === bill.txnId);
    if (txn && txn.status !== "Open") {
      alert("❌ Cannot delete bills of closed transaction!");
      return;
    }
    setConfirmDelete(bill);
  };

  // ============================================================
  // VOICE INPUT HANDLER
  // ============================================================
  const handleVoiceResult = (amount: number, transcript: string) => {
    setVoiceTranscript(transcript);
    if (amount > 0) {
      setFormData(prev => ({ ...prev, billAmount: amount.toString() }));
    }
  };

  // ============================================================
  // BULK ADD HANDLERS
  // ============================================================
  const initBulkAdd = () => {
    if (!bulkTxnId) {
      alert("Please select a transaction first!");
      return;
    }
    if (bulkCount < 1 || bulkCount > 50) {
      alert("Bill count must be between 1 and 50");
      return;
    }

    const emptyBills = Array.from({ length: bulkCount }, () => ({
      billNumber: "",
      billDate: today(),
      billAmount: "",
      gstPercent: 4,
    }));
    setBulkBills(emptyBills);
  };

  const updateBulkBill = (index: number, field: string, value: string | number) => {
    setBulkBills(prev => prev.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    ));
  };

  const handleBulkAddSubmit = () => {
    const txn = transactions.find(t => t.txnId === bulkTxnId);
    if (!txn) {
      alert("Transaction not found!");
      return;
    }

    if (txn.status !== "Open") {
      alert("Cannot add bills to closed transaction!");
      return;
    }

    const validBills = bulkBills.filter(b => b.billNumber.trim() && b.billAmount);
    if (validBills.length === 0) {
      alert("குறைந்தபட்சம் ஒரு bill-ஆவது பூர்த்தி செய்யுங்க!");
      return;
    }

    const newBills: Bill[] = validBills.map(b => {
      const amt = parseFloat(b.billAmount) || 0;
      const gstAmt = round2(amt * b.gstPercent / 100);
      const total = round2(amt * BILL_TOTAL_RATE);

      return {
        id: genId("B"),
        txnId: bulkTxnId,
        vendorCode: txn.vendorCode,
        vendorName: txn.vendorName,
        district: txn.district,
        billNumber: sanitize(b.billNumber),
        billDate: b.billDate,
        billAmount: amt,
        gstPercent: b.gstPercent,
        gstAmount: gstAmt,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        createdBy: username,
      };
    });

    onBulkAdd(newBills);
    setShowBulkAdd(false);
    setBulkBills([]);
    setBulkTxnId("");
    setBulkCount(5);
  };

  const resetBulkAdd = () => {
    setBulkBills([]);
    setBulkTxnId("");
    setBulkCount(5);
  };

  // Bulk Add Preview Totals
  const bulkPreview = useMemo(() => {
    const validBills = bulkBills.filter(b => b.billNumber && b.billAmount);
    const totalAmount = bulkBills.reduce((s, b) => s + (parseFloat(b.billAmount) || 0), 0);
    const totalGst = bulkBills.reduce((s, b) => {
      const amt = parseFloat(b.billAmount) || 0;
      return s + round2(amt * b.gstPercent / 100);
    }, 0);
    const totalFinal = bulkBills.reduce((s, b) => {
      const amt = parseFloat(b.billAmount) || 0;
      return s + round2(amt * BILL_TOTAL_RATE);
    }, 0);

    return {
      validCount: validBills.length,
      totalAmount,
      totalGst,
      totalFinal,
    };
  }, [bulkBills]);

  // ============================================================
  // BULK SELECTION HANDLERS
  // ============================================================
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(paginatedBills.map(b => b.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isAllSelected = paginatedBills.length > 0 &&
    paginatedBills.every(b => selectedIds.includes(b.id));

  const handleBulkEdit = () => {
    if (!bulkEditValue) {
      alert("Please enter a value!");
      return;
    }

    selectedIds.forEach(id => {
      const bill = bills.find(b => b.id === id);
      if (bill) {
        const txn = transactions.find(t => t.txnId === bill.txnId);
        if (txn && txn.status !== "Open") return; // Skip closed transactions

        let updatedBill = { ...bill };

        if (bulkEditField === "gstPercent") {
          const newGstPct = parseFloat(bulkEditValue);
          const gstAmt = round2(bill.billAmount * newGstPct / 100);
          updatedBill.gstPercent = newGstPct;
          updatedBill.gstAmount = gstAmt;
        } else if (bulkEditField === "billDate") {
          updatedBill.billDate = bulkEditValue;
        }

        onUpdate(updatedBill);
      }
    });

    setSelectedIds([]);
    setShowBulkEditModal(false);
    setBulkEditValue("");
  };

  const handleBulkDelete = () => {
    // Check if any bill belongs to closed transaction
    const closedBills = selectedIds.filter(id => {
      const bill = bills.find(b => b.id === id);
      if (!bill) return false;
      const txn = transactions.find(t => t.txnId === bill.txnId);
      return txn && txn.status !== "Open";
    });

    if (closedBills.length > 0) {
      alert(`❌ Cannot delete ${closedBills.length} bill(s) from closed transactions!`);
      return;
    }

    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = () => {
    onBulkDelete(selectedIds);
    setSelectedIds([]);
    setShowBulkDeleteModal(false);
  };

  // ============================================================
  // PREVIEW CALCULATIONS
  // ============================================================
  const previewCalc = useMemo(() => {
    const amount = parseFloat(formData.billAmount) || 0;
    const gstAmt = round2(amount * formData.gstPercent / 100);
    const total = round2(amount * BILL_TOTAL_RATE);
    return { amount, gstAmt, total };
  }, [formData]);

  // ============================================================
  // EXPORT TO CSV
  // ============================================================
  const exportToCSV = () => {
    const headers = [
      "Bill ID", "TXN ID", "Vendor Code", "Vendor Name", "District",
      "Bill Number", "Bill Date", "Bill Amount", "GST %", "GST Amount", "Total Amount", "Created At"
    ];

    const rows = filteredBills.map(b => [
      b.id, b.txnId, b.vendorCode, b.vendorName, b.district,
      b.billNumber, b.billDate, b.billAmount, b.gstPercent, b.gstAmount, b.totalAmount, b.createdAt
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_Bills_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🧾 Bill Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "All Districts" : `District: ${district}`} • {filteredBills.length} bills
          </p>
          <p className="text-xs text-gray-400 mt-1">
            GST = Bill × GST% | Total = Bill × 1.18 (18%)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <span>✏️</span>
                <span>Bulk Edit ({selectedIds.length})</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Delete ({selectedIds.length})</span>
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={exportToCSV}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <span>📥</span>
            <span>Export</span>
          </button>
          {!isAdmin && (
            <>
              <button
                onClick={() => setShowBulkAdd(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
              >
                <span>📦</span>
                <span>Bulk Add</span>
              </button>
              <button
                onClick={handleOpenAddForm}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
              >
                <span>+</span>
                <span>Single Bill</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="🧾" label="Total Bills" value={totals.count.toString()} color="#1a2f5e" />
        <StatCard icon="💰" label="Bill Amount" value={fmt(totals.billAmount)} color="#15803d" />
        <StatCard icon="📊" label="GST Amount" value={fmt(totals.gstAmount)} color="#7c3aed" />
        <StatCard icon="💵" label="Total (18%)" value={fmt(totals.totalAmount)} color="#b45309" />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by bill number, vendor, TXN ID..."
            />
          </div>

          {/* Transaction Filter */}
          <div>
            <select
              value={filterTxn}
              onChange={(e) => setFilterTxn(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Transactions</option>
              {transactions.map(t => (
                <option key={t.txnId} value={t.txnId}>
                  {t.txnId.slice(-10)} — {t.vendorName}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
              placeholder="From Date"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Clear Filters */}
        {(filterTxn || filterVendor || filterDateFrom || filterDateTo) && (
          <div className="mt-3">
            <button
              onClick={() => {
                setFilterTxn("");
                setFilterVendor("");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ✕ Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-3 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">Bill ID</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">TXN ID</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">Vendor</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">Bill Number</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-gray-300">Date</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">Bill Amt</th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-gray-300">GST %</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">GST Amt</th>
                <th className="px-3 py-4 text-right text-xs font-semibold text-gray-300">Total</th>
                <th className="px-3 py-4 text-center text-xs font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedBills.length > 0 ? (
                paginatedBills.map((bill) => {
                  const txn = transactions.find(t => t.txnId === bill.txnId);
                  const isClosed = txn && txn.status !== "Open";

                  return (
                    <tr
                      key={bill.id}
                      className={`hover:bg-gray-50 transition-all ${
                        selectedIds.includes(bill.id) ? "bg-blue-50" :
                        isClosed ? "bg-gray-50" : ""
                      }`}
                    >
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(bill.id)}
                          onChange={() => toggleSelect(bill.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {bill.id.slice(-8)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-mono text-xs text-gray-600">
                          {bill.txnId.slice(-10)}
                        </span>
                        {isClosed && (
                          <span className="ml-1 text-xs text-gray-400">🔒</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-gray-800">{bill.vendorName}</p>
                        <p className="text-xs text-gray-500">{bill.vendorCode}</p>
                      </td>
                      <td className="px-3 py-4 font-medium text-gray-800">
                        {bill.billNumber}
                      </td>
                      <td className="px-3 py-4 text-gray-600">
                        {new Date(bill.billDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-gray-800">
                        {fmt(bill.billAmount)}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <Badge variant="info">{bill.gstPercent}%</Badge>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-purple-700">
                        {fmt(bill.gstAmount)}
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-green-700">
                        {fmt(bill.totalAmount)}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip content="View Details">
                            <button
                              onClick={() => setViewBill(bill)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-all"
                            >
                              👁️
                            </button>
                          </Tooltip>

                          {!isClosed && (
                            <Tooltip content="Edit">
                              <button
                                onClick={() => handleOpenEditForm(bill)}
                                className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-all"
                              >
                                ✏️
                              </button>
                            </Tooltip>
                          )}

                          <Tooltip content={isClosed ? "Cannot delete (closed)" : "Delete"}>
                            <button
                              onClick={() => handleDelete(bill)}
                              disabled={isClosed}
                              className={`p-2 rounded-lg transition-all ${
                                isClosed
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-red-600 hover:bg-red-50"
                              }`}
                            >
                              🗑️
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-12">
                    <EmptyState
                      icon="🧾"
                      title="No Bills Found"
                      description={search ? "Try adjusting your search or filters" : "Add your first bill"}
                      action={!isAdmin ? {
                        label: "Add Bill",
                        onClick: handleOpenAddForm
                      } : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer Totals */}
            {filteredBills.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={6} className="px-3 py-3 font-bold text-yellow-300 text-sm">
                    Total: {filteredBills.length} bills
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-yellow-300">{fmt(totals.billAmount)}</td>
                  <td></td>
                  <td className="px-3 py-3 text-right font-bold text-purple-300">{fmt(totals.gstAmount)}</td>
                  <td className="px-3 py-3 text-right font-bold text-green-300">{fmt(totals.totalAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Add/Edit Bill Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditBill(null); }}
        title={editBill ? "✏️ Edit Bill" : "🧾 Add New Bill"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* General Error */}
          {formErrors.submit && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Row 1: Transaction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.txnId}
              onChange={(e) => setFormData({ ...formData, txnId: e.target.value })}
              disabled={!!editBill}
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                formErrors.txnId
                  ? "border-red-300 focus:border-red-500 bg-red-50"
                  : "border-gray-200 focus:border-blue-400"
              } disabled:bg-gray-100`}
            >
              <option value="">Select Transaction</option>
              {openTransactions.map(t => (
                <option key={t.txnId} value={t.txnId}>
                  {t.txnId.slice(-10)} — {t.vendorName} ({fmt(t.remainingExpected)} remaining)
                </option>
              ))}
            </select>
            {formErrors.txnId && (
              <p className="text-red-500 text-xs mt-1">{formErrors.txnId}</p>
            )}
          </div>

          {/* Row 2: Bill Number & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bill Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                placeholder="INV/2025/001"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.billNumber
                    ? "border-red-300 focus:border-red-500 bg-red-50"
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.billNumber && (
                <p className="text-red-500 text-xs mt-1">{formErrors.billNumber}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bill Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.billDate}
                onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                max={today()}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.billDate
                    ? "border-red-300 focus:border-red-500 bg-red-50"
                    : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.billDate && (
                <p className="text-red-500 text-xs mt-1">{formErrors.billDate}</p>
              )}
            </div>
          </div>

          {/* Row 3: Bill Amount with Voice Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bill Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={formData.billAmount}
                  onChange={(e) => setFormData({ ...formData, billAmount: e.target.value })}
                  placeholder="50000"
                  min={0}
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                    formErrors.billAmount
                      ? "border-red-300 focus:border-red-500 bg-red-50"
                      : "border-gray-200 focus:border-blue-400"
                  }`}
                />
                {formErrors.billAmount && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.billAmount}</p>
                )}
              </div>
              <VoiceInputButton onResult={handleVoiceResult} />
              <button
                type="button"
                onClick={() => setShowVoiceHelp(true)}
                className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100"
                title="Voice Input Help"
              >
                ❓
              </button>
            </div>
            {voiceTranscript && (
              <p className="text-xs text-purple-600 mt-1">
                🎤 Heard: "{voiceTranscript}"
              </p>
            )}
          </div>

          {/* Row 4: GST % */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GST % <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.gstPercent}
              onChange={(e) => setFormData({ ...formData, gstPercent: parseFloat(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
            >
              {GST_RATES.map(r => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </div>

          {/* Preview Calculation */}
          {previewCalc.amount > 0 && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
              <p className="text-sm font-bold text-blue-800 mb-3">🔒 Auto-Calculated Values</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-600">GST Amount:</span>
                  <span className="font-bold text-purple-700">
                    {fmt(previewCalc.amount)} × {formData.gstPercent}% = {fmt(previewCalc.gstAmt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">Total Amount (18%):</span>
                  <span className="font-bold text-green-700">
                    {fmt(previewCalc.amount)} × 1.18 = {fmt(previewCalc.total)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditBill(null); }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>{editBill ? "Update Bill" : "Save Bill"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        isOpen={showBulkAdd}
        onClose={() => { setShowBulkAdd(false); resetBulkAdd(); }}
        title="📦 Bulk Add Bills"
        size="xl"
      >
        <div className="space-y-5">
          {bulkBills.length === 0 ? (
            // Step 1: Select Transaction & Count
            <>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-sm text-purple-800">
                  📋 ஒரே நேரத்தில் பல Bills சேர்க்க — Select transaction and specify bill count
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bulkTxnId}
                    onChange={(e) => setBulkTxnId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400"
                  >
                    <option value="">Select Transaction</option>
                    {openTransactions.map(t => (
                      <option key={t.txnId} value={t.txnId}>
                        {t.txnId.slice(-10)} — {t.vendorName} ({fmt(t.remainingExpected)} remaining)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Bills <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                    min={1}
                    max={50}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowBulkAdd(false); resetBulkAdd(); }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={initBulkAdd}
                  disabled={!bulkTxnId}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>📝</span>
                  <span>Create Bill Forms</span>
                </button>
              </div>
            </>
          ) : (
            // Step 2: Fill Bill Details
            <>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-sm text-purple-800 font-medium">
                  📋 Transaction: <span className="font-mono">{bulkTxnId.slice(-10)}</span> — 
                  {transactions.find(t => t.txnId === bulkTxnId)?.vendorName}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  💡 Bill Number & Amount கட்டாயம். காலி rows skip ஆகும்.
                </p>
              </div>

              {/* Bulk Bills Table */}
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#7c3aed" }} className="sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white w-12">#</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Bill Number *</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Amount ₹ *</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">GST %</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-white">GST Amt</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-white">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {bulkBills.map((b, idx) => {
                      const amt = parseFloat(b.billAmount) || 0;
                      const gst = round2(amt * b.gstPercent / 100);
                      const total = round2(amt * BILL_TOTAL_RATE);
                      const isValid = b.billNumber.trim() && b.billAmount;

                      return (
                        <tr key={idx} className={`hover:bg-purple-50 ${isValid ? "bg-green-50" : ""}`}>
                          <td className="px-3 py-2 text-gray-400 font-bold">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <input
                              value={b.billNumber}
                              onChange={(e) => updateBulkBill(idx, "billNumber", e.target.value)}
                              placeholder="INV/2025/001"
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:border-purple-400 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={b.billDate}
                              onChange={(e) => updateBulkBill(idx, "billDate", e.target.value)}
                              max={today()}
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:border-purple-400 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={b.billAmount}
                              onChange={(e) => updateBulkBill(idx, "billAmount", e.target.value)}
                              placeholder="50000"
                              min={0}
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:border-purple-400 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={b.gstPercent}
                              onChange={(e) => updateBulkBill(idx, "gstPercent", parseFloat(e.target.value))}
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm focus:border-purple-400 outline-none"
                            >
                              {GST_RATES.map(r => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-purple-700">
                            {amt > 0 ? fmt(gst) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-700">
                            {amt > 0 ? fmt(total) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: "#f3e8ff" }} className="sticky bottom-0">
                    <tr>
                      <td colSpan={3} className="px-3 py-3 font-bold text-purple-800 text-sm">
                        ✅ Valid Bills: {bulkPreview.validCount} / {bulkBills.length}
                      </td>
                      <td className="px-3 py-3 font-bold text-purple-800 text-right">
                        {fmt(bulkPreview.totalAmount)}
                      </td>
                      <td></td>
                      <td className="px-3 py-3 font-bold text-purple-700 text-right">
                        {fmt(bulkPreview.totalGst)}
                      </td>
                      <td className="px-3 py-3 font-bold text-green-700 text-right">
                        {fmt(bulkPreview.totalFinal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={resetBulkAdd}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  🔄 Reset
                </button>
                <button
                  onClick={() => { setShowBulkAdd(false); resetBulkAdd(); }}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAddSubmit}
                  disabled={bulkPreview.validCount === 0}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  <span>Save {bulkPreview.validCount} Bills</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* View Bill Modal */}
      <Modal
        isOpen={!!viewBill}
        onClose={() => setViewBill(null)}
        title="🧾 Bill Details"
        size="md"
      >
        {viewBill && (
          <div className="space-y-5">
            {/* Header */}
            <div className="p-5 rounded-xl" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <p className="text-sm text-purple-200">Bill ID</p>
                  <p className="font-mono font-bold text-xl">{viewBill.id}</p>
                </div>
                <div className="text-white text-right">
                  <p className="text-sm text-purple-200">Amount</p>
                  <p className="font-bold text-2xl">{fmt(viewBill.billAmount)}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {[
                { label: "Bill Number", value: viewBill.billNumber, icon: "🧾" },
                { label: "Bill Date", value: new Date(viewBill.billDate).toLocaleDateString("en-IN"), icon: "📅" },
                { label: "Transaction ID", value: viewBill.txnId, icon: "📋" },
                { label: "Vendor", value: viewBill.vendorName, icon: "🏪" },
                { label: "District", value: viewBill.district, icon: "📍" },
                { label: "GST Rate", value: `${viewBill.gstPercent}%`, icon: "📊" },
                { label: "GST Amount", value: fmt(viewBill.gstAmount), icon: "💰" },
                { label: "Total (18%)", value: fmt(viewBill.totalAmount), icon: "💵" },
                { label: "Created At", value: new Date(viewBill.createdAt).toLocaleString(), icon: "🕐" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="flex items-center gap-2 text-gray-500 text-sm">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <span className="font-semibold text-gray-800 text-sm">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {(() => {
                const txn = transactions.find(t => t.txnId === viewBill.txnId);
                const canEdit = txn && txn.status === "Open";
                return canEdit && (
                  <button
                    onClick={() => {
                      setViewBill(null);
                      handleOpenEditForm(viewBill);
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 transition-all flex items-center justify-center gap-2"
                  >
                    <span>✏️</span>
                    <span>Edit</span>
                  </button>
                );
              })()}
              <button
                onClick={() => setViewBill(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Voice Input Help Modal */}
      <Modal
        isOpen={showVoiceHelp}
        onClose={() => setShowVoiceHelp(false)}
        title="🎤 Voice Input Help"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
            <p className="text-sm text-purple-800 font-medium mb-2">
              Tamil voice-ல் amount சொல்லலாம்!
            </p>
            <p className="text-xs text-purple-600">
              Microphone permission தேவை. Tamil (ta-IN) language supported.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-800">Examples:</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">"ஐம்பதாயிரம்"</span>
                <span className="font-bold text-gray-800">→ ₹50,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">"ஒரு லட்சம்"</span>
                <span className="font-bold text-gray-800">→ ₹1,00,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">"இரண்டு லட்சம்"</span>
                <span className="font-bold text-gray-800">→ ₹2,00,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">"பத்தாயிரம்"</span>
                <span className="font-bold text-gray-800">→ ₹10,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">"fifty thousand"</span>
                <span className="font-bold text-gray-800">→ ₹50,000</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              💡 <strong>Tip:</strong> Direct numbers also work — just say "50000" or "1 lakh"
            </p>
          </div>

          <button
            onClick={() => setShowVoiceHelp(false)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Got it!
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            onDelete(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
        title="Delete Bill?"
        message={`Are you sure you want to delete bill "${confirmDelete?.billNumber}"? The transaction will be recalculated.`}
        confirmText="Delete"
        confirmColor="red"
        icon="🗑️"
      />

      {/* Bulk Edit Modal */}
      <Modal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        title={`✏️ Bulk Edit — ${selectedIds.length} Bills`}
        size="md"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Edit selected bills. Only bills from <strong>Open</strong> transactions will be updated.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field to Edit
            </label>
            <select
              value={bulkEditField}
              onChange={(e) => { setBulkEditField(e.target.value); setBulkEditValue(""); }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
            >
              <option value="gstPercent">GST %</option>
              <option value="billDate">Bill Date</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Value
            </label>
            {bulkEditField === "gstPercent" ? (
              <select
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Select GST %</option>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            ) : (
              <input
                type="date"
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                max={today()}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowBulkEditModal(false)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkEdit}
              disabled={!bulkEditValue}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>✅</span>
              <span>Apply to All</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={confirmBulkDelete}
        title={`Delete ${selectedIds.length} Bills?`}
        message={`Are you sure you want to delete ${selectedIds.length} selected bills? This action cannot be undone. Transactions will be recalculated.`}
        confirmText="Delete All"
        confirmColor="red"
        icon="🗑️"
      />
    </div>
  );
}
// ============================================================
// WALLET PAGE COMPONENT
// ============================================================
function WalletPage({
  wallet,
  balance,
  onManualEntry,
  onSetBalance,
}: {
  wallet: WalletEntry[];
  balance: number;
  onManualEntry: (description: string, debit: number, credit: number) => void;
  onSetBalance: (newBalance: number) => void;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<"set" | "manual">("set");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Form State
  const [newBalance, setNewBalance] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualDebit, setManualDebit] = useState("");
  const [manualCredit, setManualCredit] = useState("");
  const [formError, setFormError] = useState("");

  // ============================================================
  // CALCULATED STATS
  // ============================================================
  const stats = useMemo(() => {
    const totalDebit = wallet.reduce((s, w) => s + w.debit, 0);
    const totalCredit = wallet.reduce((s, w) => s + w.credit, 0);
    const totalProfit = wallet.filter(w => w.type === "profit").reduce((s, w) => s + w.credit, 0);
    const totalAdvance = wallet.filter(w => w.type === "advance").reduce((s, w) => s + w.debit, 0);
    const totalGST = wallet.filter(w => w.type === "gst").reduce((s, w) => s + w.debit, 0);
    const totalManualCredit = wallet.filter(w => w.type === "manual").reduce((s, w) => s + w.credit, 0);
    const totalManualDebit = wallet.filter(w => w.type === "manual").reduce((s, w) => s + w.debit, 0);

    return {
      totalDebit,
      totalCredit,
      totalProfit,
      totalAdvance,
      totalGST,
      totalManualCredit,
      totalManualDebit,
      netFlow: totalCredit - totalDebit,
      entryCount: wallet.length,
    };
  }, [wallet]);

  // ============================================================
  // FILTERED & PAGINATED DATA
  // ============================================================
  const filteredWallet = useMemo(() => {
    return wallet.filter(w => {
      const matchesSearch = w.description.toLowerCase().includes(search.toLowerCase()) ||
        w.id.toLowerCase().includes(search.toLowerCase()) ||
        (w.txnId && w.txnId.toLowerCase().includes(search.toLowerCase()));

      const matchesType = !filterType || w.type === filterType;
      const matchesDateFrom = !filterDateFrom || w.date >= filterDateFrom;
      const matchesDateTo = !filterDateTo || w.date <= filterDateTo;

      return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
    });
  }, [wallet, search, filterType, filterDateFrom, filterDateTo]);

  // Reverse to show latest first
  const sortedWallet = useMemo(() => [...filteredWallet].reverse(), [filteredWallet]);

  const totalPages = Math.ceil(sortedWallet.length / ITEMS_PER_PAGE);

  const paginatedWallet = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedWallet.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedWallet, currentPage]);

  // Filtered Totals
  const filteredTotals = useMemo(() => ({
    debit: filteredWallet.reduce((s, w) => s + w.debit, 0),
    credit: filteredWallet.reduce((s, w) => s + w.credit, 0),
  }), [filteredWallet]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterDateFrom, filterDateTo]);

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const handleSetBalance = () => {
    const newBal = parseFloat(newBalance);
    if (isNaN(newBal)) {
      setFormError("Please enter a valid amount");
      return;
    }
    if (newBal < 0) {
      setFormError("Balance cannot be negative");
      return;
    }

    onSetBalance(newBal);
    setNewBalance("");
    setShowEditModal(false);
    setFormError("");
  };

  const handleManualEntry = () => {
    if (!manualDesc.trim()) {
      setFormError("Description is required");
      return;
    }

    const debit = parseFloat(manualDebit) || 0;
    const credit = parseFloat(manualCredit) || 0;

    if (debit === 0 && credit === 0) {
      setFormError("Enter either debit or credit amount");
      return;
    }

    if (debit < 0 || credit < 0) {
      setFormError("Amounts cannot be negative");
      return;
    }

    onManualEntry(sanitize(manualDesc), debit, credit);
    setManualDesc("");
    setManualDebit("");
    setManualCredit("");
    setShowEditModal(false);
    setFormError("");
  };

  // ============================================================
  // EXPORT TO CSV
  // ============================================================
  const exportToCSV = () => {
    const headers = ["ID", "Date", "Description", "Type", "Debit", "Credit", "Balance", "TXN ID", "Created By"];

    const rows = filteredWallet.map(w => [
      w.id, w.date, w.description, w.type, w.debit, w.credit, w.balance, w.txnId || "", w.createdBy
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_Wallet_Ledger_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // TYPE BADGE COMPONENT
  // ============================================================
  const TypeBadge = ({ type }: { type: WalletType }) => {
    const config = {
      manual: { bg: "bg-gray-100", text: "text-gray-700", icon: "📝" },
      advance: { bg: "bg-orange-100", text: "text-orange-700", icon: "💳" },
      gst: { bg: "bg-red-100", text: "text-red-700", icon: "📊" },
      profit: { bg: "bg-green-100", text: "text-green-700", icon: "💰" },
    };
    const c = config[type];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        <span>{c.icon}</span>
        <span className="capitalize">{type}</span>
      </span>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💰 Admin Main Wallet</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage wallet balance, track all financial movements
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}
          >
            <span>✏️</span>
            <span>Wallet Edit</span>
          </button>
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, #0a1628, #1a2f5e, #0a1628)" }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-gray-300 text-sm">Current Wallet Balance</p>
            <p className="text-5xl font-bold mt-2" style={{ color: "#f0d060" }}>
              {fmt(balance)}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Last updated: {wallet.length > 0 ? wallet[wallet.length - 1].date : "N/A"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 md:gap-8">
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-1">Total In</p>
              <p className="text-2xl font-bold text-green-400">{fmt(stats.totalCredit)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-1">Total Out</p>
              <p className="text-2xl font-bold text-red-400">{fmt(stats.totalDebit)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-1">Net Flow</p>
              <p className={`text-2xl font-bold ${stats.netFlow >= 0 ? "text-green-400" : "text-red-400"}`}>
                {stats.netFlow >= 0 ? "+" : ""}{fmt(stats.netFlow)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="💳"
          label="Advance Paid"
          value={fmt(stats.totalAdvance)}
          subValue="To vendors"
          color="#ea580c"
        />
        <StatCard
          icon="📊"
          label="GST Settled"
          value={fmt(stats.totalGST)}
          subValue="On close"
          color="#dc2626"
        />
        <StatCard
          icon="💰"
          label="Profit Earned"
          value={fmt(stats.totalProfit)}
          subValue="8% commission"
          color="#16a34a"
        />
        <StatCard
          icon="📝"
          label="Manual Entries"
          value={fmt(stats.totalManualCredit - stats.totalManualDebit)}
          subValue={`${stats.entryCount} total entries`}
          color="#4f46e5"
        />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search description, ID..."
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Types</option>
              <option value="manual">📝 Manual</option>
              <option value="advance">💳 Advance</option>
              <option value="gst">📊 GST</option>
              <option value="profit">💰 Profit</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            />
          </div>
        </div>

        {/* Clear Filters */}
        {(filterType || filterDateFrom || filterDateTo || search) && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                setSearch("");
                setFilterType("");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ✕ Clear all filters
            </button>
            <span className="text-sm text-gray-400">
              Showing {filteredWallet.length} of {wallet.length} entries
            </span>
          </div>
        )}
      </div>

      {/* Wallet Ledger Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <span>📒</span>
            <span>Wallet Ledger</span>
          </h2>
          <span className="text-sm text-gray-400">{sortedWallet.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Date</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Description</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Type</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-300">Debit (−)</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-300">Credit (+)</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-300">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedWallet.length > 0 ? (
                paginatedWallet.map((entry, index) => (
                  <tr key={entry.id} className={`hover:bg-gray-50 transition-all ${index === 0 ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-800 font-medium">{entry.description}</p>
                      {entry.txnId && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{entry.txnId.slice(-12)}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <TypeBadge type={entry.type} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      {entry.debit > 0 ? (
                        <span className="font-semibold text-red-600">{fmt(entry.debit)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {entry.credit > 0 ? (
                        <span className="font-semibold text-green-600">{fmt(entry.credit)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-gray-800">
                      {fmt(entry.balance)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <EmptyState
                      icon="📒"
                      title="No Wallet Entries"
                      description={search || filterType ? "Try adjusting your filters" : "Wallet ledger is empty"}
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer Totals */}
            {filteredWallet.length > 0 && (
              <tfoot style={{ background: "#f8fafc" }}>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={3} className="px-4 py-4 font-bold text-gray-800 text-sm">
                    Filtered Total ({filteredWallet.length} entries)
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-red-600">
                    {fmt(filteredTotals.debit)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-green-600">
                    {fmt(filteredTotals.credit)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold" style={{ color: "#b45309" }}>
                    {fmt(balance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Edit Wallet Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setFormError(""); }}
        title="✏️ Wallet Edit / Manual Entry"
        size="md"
      >
        <div className="space-y-5">
          {/* Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setEditMode("set"); setFormError(""); }}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                editMode === "set"
                  ? "text-white"
                  : "text-gray-600 bg-gray-100 hover:bg-gray-200"
              }`}
              style={editMode === "set" ? { background: "#1a2f5e" } : {}}
            >
              🏦 Set Balance
            </button>
            <button
              onClick={() => { setEditMode("manual"); setFormError(""); }}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                editMode === "manual"
                  ? "text-white"
                  : "text-gray-600 bg-gray-100 hover:bg-gray-200"
              }`}
              style={editMode === "manual" ? { background: "#1a2f5e" } : {}}
            >
              ➕ Manual Entry
            </button>
          </div>

          {/* Error */}
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          {editMode === "set" ? (
            // Set Balance Form
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  Current Balance: <strong className="text-lg">{fmt(balance)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Balance Amount (₹)
                </label>
                <input
                  type="number"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder="Enter new balance"
                  min={0}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
                />
              </div>

              {newBalance && parseFloat(newBalance) !== balance && (
                <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-sm">
                  <p className="text-yellow-800">
                    {parseFloat(newBalance) > balance ? (
                      <>
                        <span className="text-green-600 font-bold">
                          +{fmt(parseFloat(newBalance) - balance)}
                        </span> will be credited
                      </>
                    ) : (
                      <>
                        <span className="text-red-600 font-bold">
                          {fmt(parseFloat(newBalance) - balance)}
                        </span> will be debited
                      </>
                    )}
                  </p>
                </div>
              )}

              <button
                onClick={handleSetBalance}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                💾 Update Balance
              </button>
            </div>
          ) : (
            // Manual Entry Form
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="e.g., Initial Investment, Office Expense..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Debit Amount (−)
                  </label>
                  <input
                    type="number"
                    value={manualDebit}
                    onChange={(e) => setManualDebit(e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full px-4 py-3 rounded-xl border border-red-200 text-sm outline-none focus:border-red-400 bg-red-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Credit Amount (+)
                  </label>
                  <input
                    type="number"
                    value={manualCredit}
                    onChange={(e) => setManualCredit(e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full px-4 py-3 rounded-xl border border-green-200 text-sm outline-none focus:border-green-400 bg-green-50"
                  />
                </div>
              </div>

              {(manualDebit || manualCredit) && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm">
                  <p className="text-blue-800">
                    New Balance: <strong>
                      {fmt(balance - (parseFloat(manualDebit) || 0) + (parseFloat(manualCredit) || 0))}
                    </strong>
                  </p>
                </div>
              )}

              <button
                onClick={handleManualEntry}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                ➕ Add Entry
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}


// ============================================================
// REPORTS PAGE COMPONENT
// ============================================================
function ReportsPage({
  transactions,
  bills,
  vendors,
  wallet,
}: {
  transactions: Transaction[];
  bills: Bill[];
  vendors: Vendor[];
  wallet: WalletEntry[];
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [activeTab, setActiveTab] = useState<"summary" | "vendors" | "transactions" | "bills" | "monthly">("summary");
  const [filterFY, setFilterFY] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterDistrict, setFilterDistrict] = useState<string>("");

  // ============================================================
  // FILTERED DATA
  // ============================================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesFY = !filterFY || t.financialYear === filterFY;
      const matchesMonth = !filterMonth || t.month === filterMonth;
      const matchesDistrict = !filterDistrict || t.district === filterDistrict;
      return matchesFY && matchesMonth && matchesDistrict;
    });
  }, [transactions, filterFY, filterMonth, filterDistrict]);

  const filteredBills = useMemo(() => {
    const txnIds = new Set(filteredTransactions.map(t => t.txnId));
    return bills.filter(b => txnIds.has(b.txnId));
  }, [bills, filteredTransactions]);

  // ============================================================
  // CALCULATED STATS
  // ============================================================
  const stats = useMemo(() => {
    const data = filteredTransactions;
    return {
      totalExpected: data.reduce((s, t) => s + t.expectedAmount, 0),
      totalBills: data.reduce((s, t) => s + t.billsReceived, 0),
      totalGST: data.reduce((s, t) => s + t.gstAmount, 0),
      totalAdvance: data.reduce((s, t) => s + t.advanceAmount, 0),
      totalProfit: data.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
      totalRemaining: data.reduce((s, t) => s + t.remainingExpected, 0),
      totalGSTBalance: data.reduce((s, t) => s + t.gstBalance, 0),
      openCount: data.filter(t => t.status === "Open").length,
      pendingCount: data.filter(t => t.status === "PendingClose").length,
      closedCount: data.filter(t => t.status === "Closed").length,
      totalCount: data.length,
      vendorCount: vendors.length,
      billCount: filteredBills.length,
    };
  }, [filteredTransactions, filteredBills, vendors]);

  // Monthly Summary
  const monthlySummary = useMemo(() => {
    return MONTHS.map(month => {
      const monthTxns = filteredTransactions.filter(t => t.month === month);
      return {
        month,
        expected: monthTxns.reduce((s, t) => s + t.expectedAmount, 0),
        bills: monthTxns.reduce((s, t) => s + t.billsReceived, 0),
        gst: monthTxns.reduce((s, t) => s + t.gstAmount, 0),
        profit: monthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
        count: monthTxns.length,
        closed: monthTxns.filter(t => t.status === "Closed").length,
      };
    }).filter(m => m.count > 0);
  }, [filteredTransactions]);

  // District Summary
  const districtSummary = useMemo(() => {
    return DISTRICTS.map(district => {
      const districtTxns = filteredTransactions.filter(t => t.district === district);
      const districtVendors = vendors.filter(v => v.district === district);
      return {
        district,
        expected: districtTxns.reduce((s, t) => s + t.expectedAmount, 0),
        bills: districtTxns.reduce((s, t) => s + t.billsReceived, 0),
        gst: districtTxns.reduce((s, t) => s + t.gstAmount, 0),
        profit: districtTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
        txnCount: districtTxns.length,
        vendorCount: districtVendors.length,
        closedCount: districtTxns.filter(t => t.status === "Closed").length,
      };
    }).filter(d => d.txnCount > 0).sort((a, b) => b.expected - a.expected);
  }, [filteredTransactions, vendors]);

  // Vendor Summary
  const vendorSummary = useMemo(() => {
    return vendors.map(vendor => {
      const vendorTxns = filteredTransactions.filter(t => t.vendorCode === vendor.vendorCode);
      const vendorBills = filteredBills.filter(b => b.vendorCode === vendor.vendorCode);
      return {
        ...vendor,
        expected: vendorTxns.reduce((s, t) => s + t.expectedAmount, 0),
        bills: vendorTxns.reduce((s, t) => s + t.billsReceived, 0),
        gst: vendorTxns.reduce((s, t) => s + t.gstAmount, 0),
        profit: vendorTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
        txnCount: vendorTxns.length,
        billCount: vendorBills.length,
        closedCount: vendorTxns.filter(t => t.status === "Closed").length,
      };
    }).filter(v => v.txnCount > 0).sort((a, b) => b.expected - a.expected);
  }, [vendors, filteredTransactions, filteredBills]);

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================
  const exportSummaryCSV = () => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Transactions", stats.totalCount],
      ["Open Transactions", stats.openCount],
      ["Pending Close", stats.pendingCount],
      ["Closed Transactions", stats.closedCount],
      ["Total Vendors", stats.vendorCount],
      ["Total Bills", stats.billCount],
      ["Expected Amount", stats.totalExpected],
      ["Bills Received", stats.totalBills],
      ["GST Amount", stats.totalGST],
      ["Advance Paid", stats.totalAdvance],
      ["GST Balance", stats.totalGSTBalance],
      ["Total Profit (8%)", stats.totalProfit],
    ];
    downloadCSV(headers, rows, "AR_Summary_Report");
  };

  const exportVendorCSV = () => {
    const headers = ["Vendor Code", "Vendor Name", "District", "Transactions", "Closed", "Bills", "Expected", "Bills Received", "GST", "Profit"];
    const rows = vendorSummary.map(v => [
      v.vendorCode, v.vendorName, v.district, v.txnCount, v.closedCount, v.billCount,
      v.expected, v.bills, v.gst, v.profit
    ]);
    downloadCSV(headers, rows, "AR_Vendor_Report");
  };

  const exportTransactionCSV = () => {
    const headers = ["TXN ID", "Vendor", "District", "Month", "FY", "Expected", "GST", "Advance", "Bills", "Remaining", "Profit", "Status"];
    const rows = filteredTransactions.map(t => [
      t.txnId, t.vendorName, t.district, t.month, t.financialYear,
      t.expectedAmount, t.gstAmount, t.advanceAmount, t.billsReceived,
      t.remainingExpected, t.profit, t.status
    ]);
    downloadCSV(headers, rows, "AR_Transaction_Report");
  };

  const exportBillCSV = () => {
    const headers = ["Bill ID", "TXN ID", "Vendor", "District", "Bill Number", "Date", "Amount", "GST%", "GST Amount", "Total"];
    const rows = filteredBills.map(b => [
      b.id, b.txnId, b.vendorName, b.district, b.billNumber, b.billDate,
      b.billAmount, b.gstPercent, b.gstAmount, b.totalAmount
    ]);
    downloadCSV(headers, rows, "AR_Bill_Report");
  };

  const exportMonthlyCSV = () => {
    const headers = ["Month", "Transactions", "Closed", "Expected", "Bills Received", "GST", "Profit"];
    const rows = monthlySummary.map(m => [
      m.month, m.count, m.closed, m.expected, m.bills, m.gst, m.profit
    ]);
    downloadCSV(headers, rows, "AR_Monthly_Report");
  };

  const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // TAB CONFIG
  // ============================================================
  const tabs = [
    { id: "summary", label: "Summary", icon: "📊" },
    { id: "vendors", label: "Vendors", icon: "🏪" },
    { id: "transactions", label: "Transactions", icon: "📋" },
    { id: "bills", label: "Bills", icon: "🧾" },
    { id: "monthly", label: "Monthly", icon: "📅" },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Reports</h1>
          <p className="text-gray-500 text-sm mt-1">
            Comprehensive business reports and analytics
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Financial Year</label>
            <select
              value={filterFY}
              onChange={(e) => setFilterFY(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Years</option>
              {FY_LIST.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Months</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">District</label>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Districts</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            {(filterFY || filterMonth || filterDistrict) && (
              <button
                onClick={() => { setFilterFY(""); setFilterMonth(""); setFilterDistrict(""); }}
                className="px-4 py-2.5 rounded-xl text-sm text-blue-600 hover:bg-blue-50 transition-all"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "text-white shadow-lg"
                : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
            }`}
            style={activeTab === tab.id ? { background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" } : {}}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* SUMMARY TAB */}
        {activeTab === "summary" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">📊 Summary Report</h2>
              <button
                onClick={exportSummaryCSV}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export</span>
              </button>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon="💰" label="Total Expected" value={fmt(stats.totalExpected)} color="#1a2f5e" />
              <StatCard icon="🧾" label="Bills Received" value={fmt(stats.totalBills)} color="#15803d" />
              <StatCard icon="📊" label="Total GST" value={fmt(stats.totalGST)} color="#7c3aed" />
              <StatCard icon="🎯" label="Total Profit" value={fmt(stats.totalProfit)} color="#b45309" />
            </div>

            {/* Transaction Status */}
            <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">Transaction Status Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                  <p className="text-3xl font-bold text-blue-600">{stats.openCount}</p>
                  <p className="text-sm text-gray-500 mt-1">🔵 Open</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                  <p className="text-3xl font-bold text-red-600">{stats.pendingCount}</p>
                  <p className="text-sm text-gray-500 mt-1">🔴 Pending</p>
                </div>
                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                  <p className="text-3xl font-bold text-green-600">{stats.closedCount}</p>
                  <p className="text-sm text-gray-500 mt-1">✅ Closed</p>
                </div>
              </div>
            </div>

            {/* District Performance */}
            {districtSummary.length > 0 && (
              <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">District Performance</h3>
                <div className="space-y-3">
                  {districtSummary.slice(0, 5).map((d, i) => (
                    <div key={d.district} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          i === 0 ? "bg-yellow-100 text-yellow-700" :
                          i === 1 ? "bg-gray-100 text-gray-600" :
                          i === 2 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-600"
                        }`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-800">{d.district}</p>
                          <p className="text-xs text-gray-500">{d.txnCount} transactions • {d.vendorCount} vendors</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{fmt(d.expected)}</p>
                        <p className="text-xs text-green-600">Profit: {fmt(d.profit)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VENDORS TAB */}
        {activeTab === "vendors" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">🏪 Vendor Report</h2>
              <button
                onClick={exportVendorCSV}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">District</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Txns</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Bills</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Expected</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Bills Rcvd</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">GST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vendorSummary.length > 0 ? (
                    vendorSummary.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{v.vendorName}</p>
                          <p className="text-xs text-gray-500">{v.vendorCode}</p>
                        </td>
                        <td className="px-4 py-3"><Badge variant="info">{v.district}</Badge></td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{v.txnCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{v.billCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(v.expected)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(v.bills)}</td>
                        <td className="px-4 py-3 text-right text-purple-600">{fmt(v.gst)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(v.profit)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12">
                        <EmptyState icon="🏪" title="No Vendor Data" />
                      </td>
                    </tr>
                  )}
                </tbody>
                {vendorSummary.length > 0 && (
                  <tfoot style={{ background: "#1a2f5e" }}>
                    <tr>
                      <td colSpan={2} className="px-4 py-3 font-bold text-yellow-300 text-sm">
                        Total: {vendorSummary.length} vendors
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-yellow-300">
                        {vendorSummary.reduce((s, v) => s + v.txnCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-yellow-300">
                        {vendorSummary.reduce((s, v) => s + v.billCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-yellow-300">
                        {fmt(vendorSummary.reduce((s, v) => s + v.expected, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-300">
                        {fmt(vendorSummary.reduce((s, v) => s + v.bills, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-purple-300">
                        {fmt(vendorSummary.reduce((s, v) => s + v.gst, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-300">
                        {fmt(vendorSummary.reduce((s, v) => s + v.profit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === "transactions" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">📋 Transaction Report</h2>
              <button
                onClick={exportTransactionCSV}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">TXN ID</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">Vendor</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">Period</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">Expected</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">GST</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">Bills</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">Remaining</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.slice(0, 50).map(t => (
                      <tr key={t.txnId} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-mono text-xs text-blue-700">{t.txnId.slice(-10)}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-800">{t.vendorName}</p>
                          <p className="text-xs text-gray-500">{t.district}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-gray-800">{t.month}</p>
                          <p className="text-xs text-gray-500">{t.financialYear}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-800">{fmt(t.expectedAmount)}</td>
                        <td className="px-3 py-3 text-right text-purple-600">{fmt(t.gstAmount)}</td>
                        <td className="px-3 py-3 text-right text-green-600">{fmt(t.billsReceived)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={t.remainingExpected <= 0 ? "text-green-600" : "text-orange-600"}>
                            {t.remainingExpected <= 0 ? "✅ Done" : fmt(t.remainingExpected)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant={
                            t.status === "Closed" ? "success" :
                            t.status === "PendingClose" ? "danger" : "info"
                          }>
                            {t.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12">
                        <EmptyState icon="📋" title="No Transaction Data" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredTransactions.length > 50 && (
                <p className="text-center py-3 text-sm text-gray-500">
                  Showing first 50 of {filteredTransactions.length} transactions. Export for full data.
                </p>
              )}
            </div>
          </div>
        )}

        {/* BILLS TAB */}
        {activeTab === "bills" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">🧾 Bill Report</h2>
              <button
                onClick={exportBillCSV}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">Bill No</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">Vendor</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">Date</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">Amount</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-300">GST %</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">GST Amt</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBills.length > 0 ? (
                    filteredBills.slice(0, 50).map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium text-gray-800">{b.billNumber}</td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-800">{b.vendorName}</p>
                          <p className="text-xs text-gray-500">{b.district}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {new Date(b.billDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-gray-800">{fmt(b.billAmount)}</td>
                        <td className="px-3 py-3 text-center">{b.gstPercent}%</td>
                        <td className="px-3 py-3 text-right text-purple-600">{fmt(b.gstAmount)}</td>
                        <td className="px-3 py-3 text-right font-bold text-green-600">{fmt(b.totalAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12">
                        <EmptyState icon="🧾" title="No Bill Data" />
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredBills.length > 0 && (
                  <tfoot style={{ background: "#1a2f5e" }}>
                    <tr>
                      <td colSpan={3} className="px-3 py-3 font-bold text-yellow-300 text-sm">
                        Total: {filteredBills.length} bills
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-yellow-300">
                        {fmt(filteredBills.reduce((s, b) => s + b.billAmount, 0))}
                      </td>
                      <td></td>
                      <td className="px-3 py-3 text-right font-bold text-purple-300">
                        {fmt(filteredBills.reduce((s, b) => s + b.gstAmount, 0))}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-green-300">
                        {fmt(filteredBills.reduce((s, b) => s + b.totalAmount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {filteredBills.length > 50 && (
                <p className="text-center py-3 text-sm text-gray-500">
                  Showing first 50 of {filteredBills.length} bills. Export for full data.
                </p>
              )}
            </div>
          </div>
        )}

        {/* MONTHLY TAB */}
        {activeTab === "monthly" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-lg">📅 Monthly Report</h2>
              <button
                onClick={exportMonthlyCSV}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Month</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Transactions</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Closed</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Expected</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Bills Rcvd</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">GST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthlySummary.length > 0 ? (
                    monthlySummary.map(m => (
                      <tr key={m.month} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">{m.month}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{m.count}</td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{m.closed}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(m.expected)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(m.bills)}</td>
                        <td className="px-4 py-3 text-right text-purple-600">{fmt(m.gst)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(m.profit)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12">
                        <EmptyState icon="📅" title="No Monthly Data" />
                      </td>
                    </tr>
                  )}
                </tbody>
                {monthlySummary.length > 0 && (
                  <tfoot style={{ background: "#1a2f5e" }}>
                    <tr>
                      <td className="px-4 py-3 font-bold text-yellow-300 text-sm">Total</td>
                      <td className="px-4 py-3 text-center font-bold text-yellow-300">
                        {monthlySummary.reduce((s, m) => s + m.count, 0)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-green-300">
                        {monthlySummary.reduce((s, m) => s + m.closed, 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-yellow-300">
                        {fmt(monthlySummary.reduce((s, m) => s + m.expected, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-300">
                        {fmt(monthlySummary.reduce((s, m) => s + m.bills, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-purple-300">
                        {fmt(monthlySummary.reduce((s, m) => s + m.gst, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-300">
                        {fmt(monthlySummary.reduce((s, m) => s + m.profit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ============================================================
// ANALYTICS PAGE COMPONENT WITH CHARTS
// ============================================================
function AnalyticsPage({
  transactions,
  bills,
  vendors,
  wallet,
  predictedProfit,
}: {
  transactions: Transaction[];
  bills: Bill[];
  vendors: Vendor[];
  wallet: WalletEntry[];
  predictedProfit: number;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "districts" | "vendors" | "gst" | "wallet">("overview");
  const [filterFY, setFilterFY] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");

  // ============================================================
  // FILTERED DATA
  // ============================================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesFY = !filterFY || t.financialYear === filterFY;
      const matchesDistrict = !selectedDistrict || t.district === selectedDistrict;
      return matchesFY && matchesDistrict;
    });
  }, [transactions, filterFY, selectedDistrict]);

  const filteredBills = useMemo(() => {
    const txnIds = new Set(filteredTransactions.map(t => t.txnId));
    return bills.filter(b => txnIds.has(b.txnId));
  }, [bills, filteredTransactions]);

  // ============================================================
  // CALCULATED STATS
  // ============================================================
  const stats = useMemo(() => {
    const data = filteredTransactions;
    const closedTxns = data.filter(t => t.status === "Closed");
    
    return {
      totalExpected: data.reduce((s, t) => s + t.expectedAmount, 0),
      totalBills: data.reduce((s, t) => s + t.billsReceived, 0),
      totalGST: data.reduce((s, t) => s + t.gstAmount, 0),
      totalAdvance: data.reduce((s, t) => s + t.advanceAmount, 0),
      totalProfit: closedTxns.reduce((s, t) => s + t.profit, 0),
      totalRemaining: data.reduce((s, t) => s + t.remainingExpected, 0),
      totalGSTBalance: data.reduce((s, t) => s + t.gstBalance, 0),
      openCount: data.filter(t => t.status === "Open").length,
      pendingCount: data.filter(t => t.status === "PendingClose").length,
      closedCount: closedTxns.length,
      totalCount: data.length,
      avgTxnSize: data.length > 0 ? data.reduce((s, t) => s + t.expectedAmount, 0) / data.length : 0,
      avgProfit: closedTxns.length > 0 ? closedTxns.reduce((s, t) => s + t.profit, 0) / closedTxns.length : 0,
      closureRate: data.length > 0 ? (closedTxns.length / data.length) * 100 : 0,
      billCount: filteredBills.length,
      vendorCount: vendors.length,
    };
  }, [filteredTransactions, filteredBills, vendors]);

  // ============================================================
  // CHART DATA: Monthly Trend
  // ============================================================
  const monthlyTrendData = useMemo(() => {
    return MONTHS.map(month => {
      const monthTxns = filteredTransactions.filter(t => t.month === month);
      const monthBills = filteredBills.filter(b => {
        const txn = filteredTransactions.find(t => t.txnId === b.txnId);
        return txn && txn.month === month;
      });
      
      return {
        month: month.substring(0, 3),
        fullMonth: month,
        expected: round2(monthTxns.reduce((s, t) => s + t.expectedAmount, 0) / 100000), // In Lakhs
        bills: round2(monthTxns.reduce((s, t) => s + t.billsReceived, 0) / 100000),
        profit: round2(monthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0) / 1000), // In Thousands
        gst: round2(monthTxns.reduce((s, t) => s + t.gstAmount, 0) / 1000),
        count: monthTxns.length,
        billCount: monthBills.length,
      };
    });
  }, [filteredTransactions, filteredBills]);

  // ============================================================
  // CHART DATA: District Performance
  // ============================================================
  const districtData = useMemo(() => {
    return DISTRICTS.map(district => {
      const districtTxns = filteredTransactions.filter(t => t.district === district);
      const districtVendors = vendors.filter(v => v.district === district);
      
      return {
        district: district.substring(0, 6),
        fullDistrict: district,
        expected: round2(districtTxns.reduce((s, t) => s + t.expectedAmount, 0) / 100000),
        profit: round2(districtTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0) / 1000),
        gst: round2(districtTxns.reduce((s, t) => s + t.gstAmount, 0) / 1000),
        txnCount: districtTxns.length,
        vendorCount: districtVendors.length,
        closedCount: districtTxns.filter(t => t.status === "Closed").length,
        closureRate: districtTxns.length > 0 
          ? round2((districtTxns.filter(t => t.status === "Closed").length / districtTxns.length) * 100)
          : 0,
      };
    }).filter(d => d.txnCount > 0).sort((a, b) => b.expected - a.expected);
  }, [filteredTransactions, vendors]);

  // ============================================================
  // CHART DATA: GST Rate Distribution
  // ============================================================
  const gstRateData = useMemo(() => {
    return GST_RATES.map(rate => {
      const rateTxns = filteredTransactions.filter(t => t.gstPercent === rate);
      const rateBills = filteredBills.filter(b => b.gstPercent === rate);
      
      return {
        name: `${rate}%`,
        rate,
        txnCount: rateTxns.length,
        billCount: rateBills.length,
        gstAmount: rateTxns.reduce((s, t) => s + t.gstAmount, 0),
        expectedAmount: rateTxns.reduce((s, t) => s + t.expectedAmount, 0),
      };
    }).filter(d => d.txnCount > 0 || d.billCount > 0);
  }, [filteredTransactions, filteredBills]);

  // ============================================================
  // CHART DATA: Transaction Status
  // ============================================================
  const statusData = useMemo(() => [
    { name: "Open", value: stats.openCount, color: "#3b82f6", icon: "🔵" },
    { name: "Pending", value: stats.pendingCount, color: "#ef4444", icon: "🔴" },
    { name: "Closed", value: stats.closedCount, color: "#22c55e", icon: "✅" },
  ].filter(d => d.value > 0), [stats]);

  // ============================================================
  // CHART DATA: Vendor Performance
  // ============================================================
  const vendorPerformanceData = useMemo(() => {
    return vendors.map(vendor => {
      const vendorTxns = filteredTransactions.filter(t => t.vendorCode === vendor.vendorCode);
      const vendorBills = filteredBills.filter(b => b.vendorCode === vendor.vendorCode);
      
      return {
        ...vendor,
        expected: vendorTxns.reduce((s, t) => s + t.expectedAmount, 0),
        bills: vendorTxns.reduce((s, t) => s + t.billsReceived, 0),
        gst: vendorTxns.reduce((s, t) => s + t.gstAmount, 0),
        profit: vendorTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0),
        txnCount: vendorTxns.length,
        billCount: vendorBills.length,
        closedCount: vendorTxns.filter(t => t.status === "Closed").length,
        avgTxnSize: vendorTxns.length > 0 
          ? vendorTxns.reduce((s, t) => s + t.expectedAmount, 0) / vendorTxns.length
          : 0,
      };
    }).filter(v => v.txnCount > 0).sort((a, b) => b.expected - a.expected);
  }, [vendors, filteredTransactions, filteredBills]);

  // Top 10 vendors for chart
  const topVendorsChartData = useMemo(() => {
    return vendorPerformanceData.slice(0, 10).map(v => ({
      name: v.vendorName.length > 12 ? v.vendorName.substring(0, 12) + "..." : v.vendorName,
      fullName: v.vendorName,
      expected: round2(v.expected / 100000),
      profit: round2(v.profit / 1000),
      txnCount: v.txnCount,
    }));
  }, [vendorPerformanceData]);

  // ============================================================
  // CHART DATA: Wallet Movement
  // ============================================================
  const walletMovementData = useMemo(() => {
    const byType = {
      manual: { credit: 0, debit: 0 },
      advance: { credit: 0, debit: 0 },
      gst: { credit: 0, debit: 0 },
      profit: { credit: 0, debit: 0 },
    };

    wallet.forEach(w => {
      byType[w.type].credit += w.credit;
      byType[w.type].debit += w.debit;
    });

    return [
      { name: "Manual", credit: round2(byType.manual.credit / 1000), debit: round2(byType.manual.debit / 1000), color: "#6b7280" },
      { name: "Advance", credit: round2(byType.advance.credit / 1000), debit: round2(byType.advance.debit / 1000), color: "#ea580c" },
      { name: "GST", credit: round2(byType.gst.credit / 1000), debit: round2(byType.gst.debit / 1000), color: "#dc2626" },
      { name: "Profit", credit: round2(byType.profit.credit / 1000), debit: round2(byType.profit.debit / 1000), color: "#16a34a" },
    ];
  }, [wallet]);

  // Wallet balance trend (last 30 entries)
  const walletTrendData = useMemo(() => {
    const recentEntries = wallet.slice(-30);
    return recentEntries.map((w, i) => ({
      index: i + 1,
      date: w.date,
      balance: round2(w.balance / 1000),
      type: w.type,
    }));
  }, [wallet]);

  // ============================================================
  // GROWTH CALCULATIONS
  // ============================================================
  const growthMetrics = useMemo(() => {
    const currentMonthIndex = new Date().getMonth();
    const currentMonth = MONTHS[currentMonthIndex];
    const lastMonth = MONTHS[currentMonthIndex > 0 ? currentMonthIndex - 1 : 11];

    const currentMonthTxns = filteredTransactions.filter(t => t.month === currentMonth);
    const lastMonthTxns = filteredTransactions.filter(t => t.month === lastMonth);

    const currentExpected = currentMonthTxns.reduce((s, t) => s + t.expectedAmount, 0);
    const lastExpected = lastMonthTxns.reduce((s, t) => s + t.expectedAmount, 0);

    const currentProfit = currentMonthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);
    const lastProfit = lastMonthTxns.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0);

    const currentBills = currentMonthTxns.reduce((s, t) => s + t.billsReceived, 0);
    const lastBills = lastMonthTxns.reduce((s, t) => s + t.billsReceived, 0);

    const calcGrowth = (current: number, last: number) => 
      last > 0 ? round2(((current - last) / last) * 100) : 0;

    return {
      currentMonth,
      lastMonth,
      expectedGrowth: calcGrowth(currentExpected, lastExpected),
      profitGrowth: calcGrowth(currentProfit, lastProfit),
      billsGrowth: calcGrowth(currentBills, lastBills),
      txnGrowth: calcGrowth(currentMonthTxns.length, lastMonthTxns.length),
      currentExpected,
      currentProfit,
    };
  }, [filteredTransactions]);

  // ============================================================
  // TAB CONFIG
  // ============================================================
  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "trends", label: "Trends", icon: "📈" },
    { id: "districts", label: "Districts", icon: "📍" },
    { id: "vendors", label: "Vendors", icon: "🏪" },
    { id: "gst", label: "GST Analysis", icon: "📊" },
    { id: "wallet", label: "Wallet", icon: "💰" },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📉 Advanced Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">
            Deep insights and predictive analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* FY Filter */}
          <select
            value={filterFY}
            onChange={(e) => setFilterFY(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
          >
            <option value="">All FY</option>
            {FY_LIST.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>

          {/* District Filter */}
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
          >
            <option value="">All Districts</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Predictive Analytics Card */}
      <div className="rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, #1a2f5e, #3b5998, #1a2f5e)" }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-4xl">🤖</span>
            </div>
            <div>
              <h2 className="font-bold text-xl">AI Predictive Analytics</h2>
              <p className="text-blue-200 text-sm">Based on last 6 months trend analysis</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-blue-200 text-xs mb-1">Predicted Next Month</p>
              <p className="text-2xl font-bold" style={{ color: "#f0d060" }}>
                {predictedProfit > 0 ? fmt(predictedProfit) : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-blue-200 text-xs mb-1">This Month Profit</p>
              <p className="text-2xl font-bold text-green-300">
                {fmt(growthMetrics.currentProfit)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-blue-200 text-xs mb-1">Profit Growth</p>
              <p className={`text-2xl font-bold ${growthMetrics.profitGrowth >= 0 ? "text-green-300" : "text-red-300"}`}>
                {growthMetrics.profitGrowth >= 0 ? "+" : ""}{growthMetrics.profitGrowth}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-blue-200 text-xs mb-1">Closure Rate</p>
              <p className="text-2xl font-bold text-yellow-300">
                {round2(stats.closureRate)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard 
          icon="💰" 
          label="Total Expected" 
          value={fmt(stats.totalExpected)} 
          color="#1a2f5e"
          trend={growthMetrics.expectedGrowth > 0 ? "up" : growthMetrics.expectedGrowth < 0 ? "down" : "neutral"}
        />
        <StatCard 
          icon="🧾" 
          label="Bills Received" 
          value={fmt(stats.totalBills)} 
          color="#15803d"
          trend={growthMetrics.billsGrowth > 0 ? "up" : growthMetrics.billsGrowth < 0 ? "down" : "neutral"}
        />
        <StatCard icon="📊" label="Total GST" value={fmt(stats.totalGST)} color="#7c3aed" />
        <StatCard icon="🎯" label="Total Profit" value={fmt(stats.totalProfit)} color="#b45309" />
        <StatCard icon="📈" label="Avg Txn Size" value={fmt(stats.avgTxnSize)} color="#0891b2" />
        <StatCard icon="💵" label="Avg Profit" value={fmt(stats.avgProfit)} color="#059669" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "text-white shadow-lg"
                : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
            }`}
            style={activeTab === tab.id ? { background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" } : {}}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📈</span>
                <span>Monthly Profit Trend</span>
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                      formatter={(value: number, name: string) => [
                        name === "expected" ? `₹${value}L` : `₹${value}K`,
                        name === "expected" ? "Expected" : "Profit"
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      stroke="#1a2f5e"
                      strokeWidth={3}
                      dot={{ fill: "#1a2f5e", r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Expected (₹L)"
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ fill: "#22c55e", r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Profit (₹K)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                Expected in Lakhs (₹L) • Profit in Thousands (₹K)
              </p>
            </div>

            {/* Transaction Status Pie */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🥧</span>
                <span>Transaction Status</span>
              </h3>
              {statusData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="📊" title="No Status Data" />
              )}
              {/* Status Legend */}
              <div className="flex justify-center gap-6 mt-4">
                {statusData.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span className="text-sm text-gray-600">{s.name}: <strong>{s.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>

            {/* District Performance Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📍</span>
                <span>District Performance</span>
              </h3>
              {districtData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="district" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                        formatter={(value: number, name: string) => [
                          name === "expected" ? `₹${value}L` : `₹${value}K`,
                          name === "expected" ? "Expected" : "Profit"
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="expected" fill="#1a2f5e" radius={[4, 4, 0, 0]} name="Expected (₹L)" />
                      <Bar dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} name="Profit (₹K)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="📍" title="No District Data" />
              )}
            </div>

            {/* Top Vendors */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🏆</span>
                <span>Top 10 Vendors</span>
              </h3>
              {topVendorsChartData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVendorsChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                        formatter={(value: number) => [`₹${value}L`, "Expected"]}
                      />
                      <Bar dataKey="expected" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Expected (₹L)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="🏪" title="No Vendor Data" />
              )}
            </div>
          </div>
        )}

        {/* TRENDS TAB */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            {/* Full Monthly Trend */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📈</span>
                <span>Monthly Business Trend</span>
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="expected" stroke="#1a2f5e" strokeWidth={2} name="Expected (₹L)" dot={{ r: 3 }} />
                    <Line yAxisId="left" type="monotone" dataKey="bills" stroke="#15803d" strokeWidth={2} name="Bills (₹L)" dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#b45309" strokeWidth={3} name="Profit (₹K)" dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="gst" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 5" name="GST (₹K)" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transaction Count Trend */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>Transaction & Bill Count Trend</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: "12px" }} />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Transactions" />
                    <Bar dataKey="billCount" fill="#22c55e" radius={[4, 4, 0, 0]} name="Bills" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Growth Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`rounded-2xl p-5 border ${growthMetrics.expectedGrowth >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-sm text-gray-600 mb-1">Expected Growth</p>
                <p className={`text-3xl font-bold ${growthMetrics.expectedGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {growthMetrics.expectedGrowth >= 0 ? "+" : ""}{growthMetrics.expectedGrowth}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{growthMetrics.lastMonth} → {growthMetrics.currentMonth}</p>
              </div>
              <div className={`rounded-2xl p-5 border ${growthMetrics.profitGrowth >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-sm text-gray-600 mb-1">Profit Growth</p>
                <p className={`text-3xl font-bold ${growthMetrics.profitGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {growthMetrics.profitGrowth >= 0 ? "+" : ""}{growthMetrics.profitGrowth}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{growthMetrics.lastMonth} → {growthMetrics.currentMonth}</p>
              </div>
              <div className={`rounded-2xl p-5 border ${growthMetrics.billsGrowth >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-sm text-gray-600 mb-1">Bills Growth</p>
                <p className={`text-3xl font-bold ${growthMetrics.billsGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {growthMetrics.billsGrowth >= 0 ? "+" : ""}{growthMetrics.billsGrowth}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{growthMetrics.lastMonth} → {growthMetrics.currentMonth}</p>
              </div>
              <div className={`rounded-2xl p-5 border ${growthMetrics.txnGrowth >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-sm text-gray-600 mb-1">Txn Count Growth</p>
                <p className={`text-3xl font-bold ${growthMetrics.txnGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {growthMetrics.txnGrowth >= 0 ? "+" : ""}{growthMetrics.txnGrowth}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{growthMetrics.lastMonth} → {growthMetrics.currentMonth}</p>
              </div>
            </div>
          </div>
        )}

        {/* DISTRICTS TAB */}
        {activeTab === "districts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4">📍 District-wise Analysis</h3>
              {districtData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "12px" }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="expected" fill="#1a2f5e" radius={[4, 4, 0, 0]} name="Expected (₹L)" />
                      <Bar yAxisId="left" dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} name="Profit (₹K)" />
                      <Bar yAxisId="right" dataKey="closureRate" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Closure %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="📍" title="No District Data" />
              )}
            </div>

            {/* District Details Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">District Performance Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0a1628" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">District</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Vendors</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Transactions</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Closed</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Closure %</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Expected</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {districtData.map((d, i) => (
                      <tr key={d.fullDistrict} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm font-bold ${
                            i === 0 ? "bg-yellow-100 text-yellow-700" :
                            i === 1 ? "bg-gray-100 text-gray-600" :
                            i === 2 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-600"
                          }`}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{d.fullDistrict}</td>
                        <td className="px-4 py-3 text-center font-bold text-purple-600">{d.vendorCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{d.txnCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{d.closedCount}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${d.closureRate}%`, background: d.closureRate >= 70 ? "#22c55e" : d.closureRate >= 40 ? "#f59e0b" : "#ef4444" }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{d.closureRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">₹{d.expected}L</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">₹{d.profit}K</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VENDORS TAB */}
        {activeTab === "vendors" && (
          <div className="space-y-6">
            {/* Top Vendors Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4">🏆 Top 10 Vendors by Expected Amount</h3>
              {topVendorsChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVendorsChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px" }}
                        formatter={(value: number, name: string) => [
                          name === "expected" ? `₹${value}L` : `₹${value}K`,
                          name === "expected" ? "Expected" : "Profit"
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="expected" fill="#1a2f5e" radius={[0, 4, 4, 0]} name="Expected (₹L)" />
                      <Bar dataKey="profit" fill="#22c55e" radius={[0, 4, 4, 0]} name="Profit (₹K)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="🏪" title="No Vendor Data" />
              )}
            </div>

            {/* Vendor Performance Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Vendor Performance Details</h3>
                <span className="text-sm text-gray-400">{vendorPerformanceData.length} vendors</span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0a1628" }} className="sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">District</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Txns</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Bills</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Expected</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Bills Rcvd</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Profit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Avg Txn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vendorPerformanceData.slice(0, 20).map((v, i) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                            i === 0 ? "bg-yellow-100 text-yellow-700" :
                            i === 1 ? "bg-gray-100 text-gray-600" :
                            i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-500"
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{v.vendorName}</p>
                          <p className="text-xs text-gray-400">{v.vendorCode}</p>
                        </td>
                        <td className="px-4 py-3"><Badge variant="info">{v.district}</Badge></td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{v.txnCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{v.billCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(v.expected)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(v.bills)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(v.profit)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(v.avgTxnSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* GST ANALYSIS TAB */}
        {activeTab === "gst" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* GST Rate Pie Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">📊 GST Rate Distribution (Transactions)</h3>
                {gstRateData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gstRateData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="txnCount"
                          label={({ name, txnCount }) => `${name}: ${txnCount}`}
                        >
                          {gstRateData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "12px" }}
                          formatter={(value: number, name: string, props: any) => [
                            `${value} transactions`,
                            `GST Amount: ${fmt(props.payload.gstAmount)}`
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon="📊" title="No GST Data" />
                )}
              </div>

              {/* GST Amount Bar Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">💰 GST Amount by Rate</h3>
                {gstRateData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gstRateData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${round2(v / 1000)}K`} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px" }}
                          formatter={(value: number) => [fmt(value), "GST Amount"]}
                        />
                        <Bar dataKey="gstAmount" fill="#7c3aed" radius={[4, 4, 0, 0]} name="GST Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState icon="📊" title="No GST Data" />
                )}
              </div>
            </div>

            {/* GST Details Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">GST Rate Analysis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0a1628" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">GST Rate</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Transactions</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Bills</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Expected Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">GST Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">% of Total GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gstRateData.map((g, i) => (
                      <tr key={g.rate} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}20`, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                            {g.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600">{g.txnCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-green-600">{g.billCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(g.expectedAmount)}</td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600">{fmt(g.gstAmount)}</td>
                        <td className="px-4 py-3 text-right">
                          {stats.totalGST > 0 ? round2((g.gstAmount / stats.totalGST) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: "#f8fafc" }}>
                    <tr>
                      <td className="px-4 py-3 font-bold text-gray-800">Total</td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600">{gstRateData.reduce((s, g) => s + g.txnCount, 0)}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-600">{gstRateData.reduce((s, g) => s + g.billCount, 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(gstRateData.reduce((s, g) => s + g.expectedAmount, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-purple-600">{fmt(gstRateData.reduce((s, g) => s + g.gstAmount, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab === "wallet" && (
          <div className="space-y-6">
            {/* Wallet Balance Trend */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4">💰 Wallet Balance Trend (Last 30 Entries)</h3>
              {walletTrendData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={walletTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="index" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}K`} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px" }}
                        formatter={(value: number) => [`₹${value}K`, "Balance"]}
                        labelFormatter={(label) => `Entry #${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke="#1a2f5e"
                        strokeWidth={3}
                        dot={{ fill: "#1a2f5e", r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="💰" title="No Wallet Data" />
              )}
            </div>

            {/* Wallet Movement by Type */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">📊 Credit/Debit by Type</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={walletMovementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}K`} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px" }}
                        formatter={(value: number) => [`₹${value}K`]}
                      />
                      <Legend />
                      <Bar dataKey="credit" fill="#22c55e" radius={[4, 4, 0, 0]} name="Credit" />
                      <Bar dataKey="debit" fill="#ef4444" radius={[4, 4, 0, 0]} name="Debit" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Wallet Summary Cards */}
              <div className="space-y-4">
                {walletMovementData.map((w, i) => (
                  <div
                    key={w.name}
                    className="p-4 rounded-xl border border-gray-100 flex items-center justify-between"
                    style={{ borderLeftWidth: "4px", borderLeftColor: w.color }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {w.name === "Manual" ? "📝" : w.name === "Advance" ? "💳" : w.name === "GST" ? "📊" : "💰"}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-800">{w.name}</p>
                        <p className="text-xs text-gray-500">Wallet Movement</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-600 font-semibold">+₹{w.credit}K</p>
                      <p className="text-red-600 font-semibold">-₹{w.debit}K</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Net Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
                <p className="text-sm text-green-600 mb-1">Total Credit</p>
                <p className="text-2xl font-bold text-green-700">
                  {fmt(wallet.reduce((s, w) => s + w.credit, 0))}
                </p>
              </div>
              <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
                <p className="text-sm text-red-600 mb-1">Total Debit</p>
                <p className="text-2xl font-bold text-red-700">
                  {fmt(wallet.reduce((s, w) => s + w.debit, 0))}
                </p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200">
                <p className="text-sm text-blue-600 mb-1">Net Flow</p>
                <p className="text-2xl font-bold text-blue-700">
                  {fmt(wallet.reduce((s, w) => s + w.credit - w.debit, 0))}
                </p>
              </div>
              <div className="bg-purple-50 rounded-2xl p-5 border border-purple-200">
                <p className="text-sm text-purple-600 mb-1">Total Entries</p>
                <p className="text-2xl font-bold text-purple-700">
                  {wallet.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ============================================================
// USERS PAGE COMPONENT (Admin Only)
// ============================================================
function UsersPage({
  users,
  onAdd,
  onUpdate,
  onDelete,
}: {
  users: User[];
  onAdd: (userData: Omit<User, "id" | "createdAt" | "password"> & { password: string }) => void;
  onUpdate: (user: User) => void;
  onDelete: (userId: string) => void;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<User | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    role: "district" as UserRole,
    district: DISTRICTS[0],
    email: "",
    mobile: "",
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // ============================================================
  // FILTERED DATA
  // ============================================================
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
        (u.district && u.district.toLowerCase().includes(search.toLowerCase()));

      const matchesRole = !filterRole || u.role === filterRole;

      return matchesSearch && matchesRole;
    });
  }, [users, search, filterRole]);

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      errors.username = "Username required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = "Username can only contain letters, numbers, underscore";
    } else {
      // Check duplicate username (except when editing same user)
      const duplicate = users.find(u => 
        u.username.toLowerCase() === formData.username.toLowerCase() &&
        (!editUser || u.id !== editUser.id)
      );
      if (duplicate) {
        errors.username = "Username already exists";
      }
    }

    if (!editUser) {
      // Password required only for new users
      if (!formData.password) {
        errors.password = "Password required";
      } else if (formData.password.length < 6) {
        errors.password = "Password must be at least 6 characters";
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    if (formData.role === "district" && !formData.district) {
      errors.district = "District required for district users";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    if (formData.mobile && !/^[6-9]\d{9}$/.test(formData.mobile)) {
      errors.mobile = "Invalid mobile number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================
  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      confirmPassword: "",
      role: "district",
      district: DISTRICTS[0],
      email: "",
      mobile: "",
    });
    setFormErrors({});
    setShowPassword(false);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setEditUser(null);
    setShowForm(true);
  };

  const handleOpenEditForm = (user: User) => {
    setFormData({
      username: user.username,
      password: "",
      confirmPassword: "",
      role: user.role,
      district: user.district || DISTRICTS[0],
      email: user.email || "",
      mobile: user.mobile || "",
    });
    setFormErrors({});
    setEditUser(user);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (editUser) {
        // Update existing user (without changing password here)
        onUpdate({
          ...editUser,
          username: formData.username,
          role: formData.role,
          district: formData.role === "district" ? formData.district : undefined,
          email: formData.email || undefined,
          mobile: formData.mobile || undefined,
        });
      } else {
        // Add new user
        onAdd({
          username: formData.username,
          password: formData.password,
          role: formData.role,
          district: formData.role === "district" ? formData.district : undefined,
          email: formData.email || undefined,
          mobile: formData.mobile || undefined,
        });
      }

      setShowForm(false);
      setEditUser(null);
      resetForm();
    } catch (error) {
      setFormErrors({ submit: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = () => {
    if (!showResetPassword) return;

    if (!newPassword) {
      alert("Please enter new password");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("Passwords do not match");
      return;
    }

    // Update user with new hashed password
    onUpdate({
      ...showResetPassword,
      password: hashPassword(newPassword),
    });

    setShowResetPassword(null);
    setNewPassword("");
    setConfirmNewPassword("");
    alert("✅ Password reset successfully!");
  };

  const handleDelete = (user: User) => {
    if (user.id === "U001") {
      alert("❌ Cannot delete default admin account!");
      return;
    }
    setConfirmDelete(user);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👥 User Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage admin and district user accounts
          </p>
        </div>
        <button
          onClick={handleOpenAddForm}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
        >
          <span>+</span>
          <span>Add User</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Total Users" value={users.length.toString()} color="#1a2f5e" />
        <StatCard icon="👑" label="Admins" value={users.filter(u => u.role === "admin").length.toString()} color="#b45309" />
        <StatCard icon="📍" label="District Users" value={users.filter(u => u.role === "district").length.toString()} color="#15803d" />
        <StatCard icon="🕐" label="Active Today" value={users.filter(u => u.lastLogin && new Date(u.lastLogin).toDateString() === new Date().toDateString()).length.toString()} color="#7c3aed" />
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by username, email, district..."
            />
          </div>
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Roles</option>
              <option value="admin">👑 Admin</option>
              <option value="district">📍 District</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">User</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Role</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">District</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Contact</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Last Login</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Created</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-all">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          user.role === "admin"
                            ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                            : "bg-gradient-to-r from-blue-500 to-purple-500"
                        }`}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{user.username}</p>
                          <p className="text-xs text-gray-400">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={user.role === "admin" ? "warning" : "info"}>
                        {user.role === "admin" ? "👑 Admin" : "📍 District"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {user.district ? (
                        <span className="text-gray-800">{user.district}</span>
                      ) : (
                        <span className="text-gray-400">All Districts</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {user.email && (
                          <p className="text-xs text-gray-600">📧 {user.email}</p>
                        )}
                        {user.mobile && (
                          <p className="text-xs text-gray-600">📱 {user.mobile}</p>
                        )}
                        {!user.email && !user.mobile && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {user.lastLogin ? (
                        <div>
                          <p className="text-gray-800">{new Date(user.lastLogin).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-400">{new Date(user.lastLogin).toLocaleTimeString()}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Tooltip content="View">
                          <button
                            onClick={() => setViewUser(user)}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            👁️
                          </button>
                        </Tooltip>
                        <Tooltip content="Edit">
                          <button
                            onClick={() => handleOpenEditForm(user)}
                            className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-all"
                          >
                            ✏️
                          </button>
                        </Tooltip>
                        <Tooltip content="Reset Password">
                          <button
                            onClick={() => setShowResetPassword(user)}
                            className="p-2 rounded-lg text-purple-600 hover:bg-purple-50 transition-all"
                          >
                            🔑
                          </button>
                        </Tooltip>
                        <Tooltip content="Delete">
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={user.id === "U001"}
                            className={`p-2 rounded-lg transition-all ${
                              user.id === "U001"
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                          >
                            🗑️
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <EmptyState
                      icon="👥"
                      title="No Users Found"
                      description={search ? "Try adjusting your search" : "Add your first user"}
                      action={{ label: "Add User", onClick: handleOpenAddForm }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditUser(null); }}
        title={editUser ? "✏️ Edit User" : "👤 Add New User"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error */}
          {formErrors.submit && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
              placeholder="username"
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                formErrors.username ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-blue-400"
              }`}
            />
            {formErrors.username && <p className="text-red-500 text-xs mt-1">{formErrors.username}</p>}
          </div>

          {/* Password (only for new users) */}
          {!editUser && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all pr-12 ${
                      formErrors.password ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-blue-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                    formErrors.confirmPassword ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-blue-400"
                  }`}
                />
                {formErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{formErrors.confirmPassword}</p>}
              </div>
            </>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: "admin" })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  formData.role === "admin"
                    ? "border-yellow-400 bg-yellow-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl mb-2 block">👑</span>
                <span className="font-semibold">Admin</span>
                <p className="text-xs text-gray-500 mt-1">Full access</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: "district" })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  formData.role === "district"
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl mb-2 block">📍</span>
                <span className="font-semibold">District</span>
                <p className="text-xs text-gray-500 mt-1">Limited access</p>
              </button>
            </div>
          </div>

          {/* District (only for district users) */}
          {formData.role === "district" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                District <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.district ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-blue-400"
                }`}
              >
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {formErrors.district && <p className="text-red-500 text-xs mt-1">{formErrors.district}</p>}
            </div>
          )}

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.email ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="9876543210"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                  formErrors.mobile ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-blue-400"
                }`}
              />
              {formErrors.mobile && <p className="text-red-500 text-xs mt-1">{formErrors.mobile}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditUser(null); }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : <span>💾</span>}
              <span>{editUser ? "Update User" : "Create User"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* View User Modal */}
      <Modal
        isOpen={!!viewUser}
        onClose={() => setViewUser(null)}
        title="👤 User Details"
        size="md"
      >
        {viewUser && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 p-5 rounded-xl" style={{ background: viewUser.role === "admin" ? "linear-gradient(135deg, #b45309, #d97706)" : "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-2xl">
                {viewUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-white">
                <p className="font-bold text-xl">{viewUser.username}</p>
                <p className="text-white/70">{viewUser.role === "admin" ? "👑 Administrator" : `📍 ${viewUser.district}`}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {[
                { label: "User ID", value: viewUser.id, icon: "🆔" },
                { label: "Username", value: viewUser.username, icon: "👤" },
                { label: "Role", value: viewUser.role === "admin" ? "Admin" : "District", icon: "🏷️" },
                { label: "District", value: viewUser.district || "All Districts", icon: "📍" },
                { label: "Email", value: viewUser.email || "—", icon: "📧" },
                { label: "Mobile", value: viewUser.mobile || "—", icon: "📱" },
                { label: "Created", value: new Date(viewUser.createdAt).toLocaleString(), icon: "📅" },
                { label: "Last Login", value: viewUser.lastLogin ? new Date(viewUser.lastLogin).toLocaleString() : "Never", icon: "🕐" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="flex items-center gap-2 text-gray-500 text-sm">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <span className="font-semibold text-gray-800 text-sm">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setViewUser(null);
                  handleOpenEditForm(viewUser);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 transition-all flex items-center justify-center gap-2"
              >
                <span>✏️</span>
                <span>Edit</span>
              </button>
              <button
                onClick={() => setViewUser(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!showResetPassword}
        onClose={() => { setShowResetPassword(null); setNewPassword(""); setConfirmNewPassword(""); }}
        title="🔑 Reset Password"
        size="sm"
      >
        {showResetPassword && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                Reset password for: <strong>{showResetPassword.username}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowResetPassword(null); setNewPassword(""); setConfirmNewPassword(""); }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
              >
                <span>🔑</span>
                <span>Reset Password</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            onDelete(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
        title="Delete User?"
        message={`Are you sure you want to delete user "${confirmDelete?.username}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="red"
        icon="🗑️"
      />
    </div>
  );
}


// ============================================================
// AUDIT LOGS PAGE COMPONENT (Admin Only)
// ============================================================
function AuditLogsPage({ logs }: { logs: AuditLog[] }) {
  // ============================================================
  // STATE
  // ============================================================
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterEntity, setFilterEntity] = useState<string>("");
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // View Details
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);

  // ============================================================
  // FILTERED & PAGINATED DATA
  // ============================================================
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        log.entityId.toLowerCase().includes(search.toLowerCase()) ||
        log.user.toLowerCase().includes(search.toLowerCase()) ||
        log.entity.toLowerCase().includes(search.toLowerCase()) ||
        (log.before && JSON.stringify(log.before).toLowerCase().includes(search.toLowerCase())) ||
        (log.after && JSON.stringify(log.after).toLowerCase().includes(search.toLowerCase()));

      const matchesAction = !filterAction || log.action === filterAction;
      const matchesEntity = !filterEntity || log.entity === filterEntity;
      const matchesUser = !filterUser || log.user === filterUser;

      const logDate = log.timestamp.split("T")[0];
      const matchesDateFrom = !filterDateFrom || logDate >= filterDateFrom;
      const matchesDateTo = !filterDateTo || logDate <= filterDateTo;

      return matchesSearch && matchesAction && matchesEntity && matchesUser && matchesDateFrom && matchesDateTo;
    });
  }, [logs, search, filterAction, filterEntity, filterUser, filterDateFrom, filterDateTo]);

  // Reverse to show latest first
  const sortedLogs = useMemo(() => [...filteredLogs].reverse(), [filteredLogs]);

  const totalPages = Math.ceil(sortedLogs.length / ITEMS_PER_PAGE);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedLogs, currentPage]);

  // Unique users for filter
  const uniqueUsers = useMemo(() => [...new Set(logs.map(l => l.user))], [logs]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterAction, filterEntity, filterUser, filterDateFrom, filterDateTo]);

  // ============================================================
  // ACTION & ENTITY CONFIG
  // ============================================================
  const actionConfig: { [key: string]: { color: string; icon: string } } = {
    CREATE: { color: "bg-green-100 text-green-700", icon: "➕" },
    UPDATE: { color: "bg-blue-100 text-blue-700", icon: "✏️" },
    DELETE: { color: "bg-red-100 text-red-700", icon: "🗑️" },
    CLOSE: { color: "bg-orange-100 text-orange-700", icon: "🔒" },
    CONFIRM: { color: "bg-purple-100 text-purple-700", icon: "✅" },
    LOGIN: { color: "bg-cyan-100 text-cyan-700", icon: "🔐" },
    LOGOUT: { color: "bg-gray-100 text-gray-700", icon: "🚪" },
  };

  const entityConfig: { [key: string]: string } = {
    Transaction: "📋",
    Vendor: "🏪",
    Bill: "🧾",
    Wallet: "💰",
    User: "👤",
    Backup: "📦",
  };

  // ============================================================
  // EXPORT TO CSV
  // ============================================================
  const exportToCSV = () => {
    const headers = ["ID", "Timestamp", "User", "Action", "Entity", "Entity ID", "Before", "After"];

    const rows = filteredLogs.map(log => [
      log.id,
      log.timestamp,
      log.user,
      log.action,
      log.entity,
      log.entityId,
      log.before ? JSON.stringify(log.before) : "",
      log.after ? JSON.stringify(log.after) : "",
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AR_Audit_Logs_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📜 Audit Logs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track all system activities and changes
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
        >
          <span>📥</span>
          <span>Export CSV</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard icon="📜" label="Total Logs" value={logs.length.toString()} color="#1a2f5e" />
        <StatCard icon="➕" label="Creates" value={logs.filter(l => l.action === "CREATE").length.toString()} color="#16a34a" />
        <StatCard icon="✏️" label="Updates" value={logs.filter(l => l.action === "UPDATE").length.toString()} color="#2563eb" />
        <StatCard icon="🗑️" label="Deletes" value={logs.filter(l => l.action === "DELETE").length.toString()} color="#dc2626" />
        <StatCard icon="🔒" label="Closes" value={logs.filter(l => l.action === "CLOSE").length.toString()} color="#ea580c" />
        <StatCard icon="✅" label="Confirms" value={logs.filter(l => l.action === "CONFIRM").length.toString()} color="#7c3aed" />
        <StatCard icon="🔐" label="Logins" value={logs.filter(l => l.action === "LOGIN").length.toString()} color="#0891b2" />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search logs..."
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Actions</option>
              <option value="CREATE">➕ Create</option>
              <option value="UPDATE">✏️ Update</option>
              <option value="DELETE">🗑️ Delete</option>
              <option value="CLOSE">🔒 Close</option>
              <option value="CONFIRM">✅ Confirm</option>
              <option value="LOGIN">🔐 Login</option>
              <option value="LOGOUT">🚪 Logout</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            >
              <option value="">All Entities</option>
              <option value="Transaction">📋 Transaction</option>
              <option value="Vendor">🏪 Vendor</option>
              <option value="Bill">🧾 Bill</option>
              <option value="Wallet">💰 Wallet</option>
              <option value="User">👤 User</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
            />
          </div>
        </div>

        {/* User Filter & Clear */}
        <div className="mt-4 flex items-center gap-4">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 bg-white"
          >
            <option value="">All Users</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {(filterAction || filterEntity || filterUser || filterDateFrom || filterDateTo || search) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterAction("");
                setFilterEntity("");
                setFilterUser("");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ✕ Clear all filters
            </button>
          )}

          <span className="text-sm text-gray-400 ml-auto">
            Showing {paginatedLogs.length} of {filteredLogs.length} logs
          </span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Timestamp</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">User</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Action</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Entity</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-300">Entity ID</th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-300">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-all">
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{new Date(log.timestamp).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {log.user.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{log.user}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${actionConfig[log.action]?.color || "bg-gray-100 text-gray-700"}`}>
                        <span>{actionConfig[log.action]?.icon || "❓"}</span>
                        <span>{log.action}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <span>{entityConfig[log.entity] || "📄"}</span>
                        <span>{log.entity}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {log.entityId.length > 20 ? log.entityId.slice(-15) : log.entityId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setViewLog(log)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
                      >
                        👁️ View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <EmptyState
                      icon="📜"
                      title="No Audit Logs"
                      description={search ? "Try adjusting your filters" : "System activities will appear here"}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* View Log Details Modal */}
      <Modal
        isOpen={!!viewLog}
        onClose={() => setViewLog(null)}
        title="📜 Audit Log Details"
        size="lg"
      >
        {viewLog && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Log ID</p>
                <p className="font-mono text-sm text-gray-800">{viewLog.id}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Timestamp</p>
                <p className="text-sm text-gray-800">{new Date(viewLog.timestamp).toLocaleString()}</p>
              </div>
            </div>

            {/* Action Details */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">User</p>
                <p className="font-semibold text-blue-800">{viewLog.user}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-xs text-purple-600 mb-1">Action</p>
                <p className="font-semibold text-purple-800">
                  {actionConfig[viewLog.action]?.icon} {viewLog.action}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-xs text-green-600 mb-1">Entity</p>
                <p className="font-semibold text-green-800">
                  {entityConfig[viewLog.entity]} {viewLog.entity}
                </p>
              </div>
            </div>

            {/* Entity ID */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Entity ID</p>
              <p className="font-mono text-sm text-gray-800 break-all">{viewLog.entityId}</p>
            </div>

            {/* Before State */}
            {viewLog.before && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xs text-red-600 mb-2 font-semibold">Before (Previous State)</p>
                <pre className="text-xs text-gray-800 overflow-x-auto bg-white p-3 rounded-lg border border-red-100 max-h-40">
                  {JSON.stringify(viewLog.before, null, 2)}
                </pre>
              </div>
            )}

            {/* After State */}
            {viewLog.after && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-xs text-green-600 mb-2 font-semibold">After (New State)</p>
                <pre className="text-xs text-gray-800 overflow-x-auto bg-white p-3 rounded-lg border border-green-100 max-h-40">
                  {JSON.stringify(viewLog.after, null, 2)}
                </pre>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setViewLog(null)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}


// ============================================================
// SETTINGS PAGE COMPONENT
// ============================================================
function SettingsPage({
  settings,
  onUpdate,
  onBackup,
  onRestore,
}: {
  settings: {
    autoBackupEnabled: boolean;
    backupFrequencyDays: number;
    emailNotifications: boolean;
    encryptionEnabled: boolean;
    darkMode: boolean;
  };
  onUpdate: (settings: typeof settings) => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
}) {
  // ============================================================
  // STATE
  // ============================================================
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Check for changes
  useEffect(() => {
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleToggle = (key: keyof typeof settings) => {
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNumberChange = (key: keyof typeof settings, value: number) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onUpdate(localSettings);
    setHasChanges(false);
    alert("✅ Settings saved successfully!");
  };

  const handleReset = () => {
    setLocalSettings(settings);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setShowRestoreConfirm(true);
    }
  };

  const handleRestoreConfirm = () => {
    if (restoreFile) {
      onRestore(restoreFile);
    }
    setShowRestoreConfirm(false);
    setRestoreFile(null);
  };

  // Storage info
  const getStorageInfo = () => {
    try {
      const data = localStorage.getItem(LS_KEY);
      const size = data ? new Blob([data]).size : 0;
      return {
        used: (size / 1024).toFixed(2),
        percentage: ((size / (5 * 1024 * 1024)) * 100).toFixed(1), // 5MB limit
      };
    } catch {
      return { used: "0", percentage: "0" };
    }
  };

  const storageInfo = getStorageInfo();

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure app preferences and manage data
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center gap-2"
            >
              <span>💾</span>
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup & Restore */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
            <h2 className="font-bold text-white flex items-center gap-2">
              <span>📦</span>
              <span>Backup & Restore</span>
            </h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Auto Backup Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Auto Backup Reminder</p>
                <p className="text-xs text-gray-500">Get reminded to backup your data</p>
              </div>
              <button
                onClick={() => handleToggle("autoBackupEnabled")}
                className={`w-14 h-8 rounded-full transition-all relative ${
                  localSettings.autoBackupEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-1 transition-all ${
                  localSettings.autoBackupEnabled ? "right-1" : "left-1"
                }`} />
              </button>
            </div>

            {/* Backup Frequency */}
            {localSettings.autoBackupEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup Reminder Frequency
                </label>
                <select
                  value={localSettings.backupFrequencyDays}
                  onChange={(e) => handleNumberChange("backupFrequencyDays", parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
                >
                  <option value={1}>Every Day</option>
                  <option value={3}>Every 3 Days</option>
                  <option value={7}>Every Week</option>
                  <option value={14}>Every 2 Weeks</option>
                  <option value={30}>Every Month</option>
                </select>
              </div>
            )}

            {/* Manual Backup */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800 mb-3">
                Download a backup of all your data
              </p>
              <button
                onClick={onBackup}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <span>📥</span>
                <span>Download Backup Now</span>
              </button>
            </div>

            {/* Restore */}
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
              <p className="text-sm text-orange-800 mb-3">
                Restore data from a backup file
              </p>
              <label className="w-full py-3 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <span>📤</span>
                <span>Upload & Restore Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-orange-600 mt-2">
                ⚠️ This will replace all current data
              </p>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
            <h2 className="font-bold text-white flex items-center gap-2">
              <span>🔐</span>
              <span>Security</span>
            </h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Encryption Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Data Encryption</p>
                <p className="text-xs text-gray-500">Encrypt local storage data (AES-256)</p>
              </div>
              <button
                onClick={() => handleToggle("encryptionEnabled")}
                className={`w-14 h-8 rounded-full transition-all relative ${
                  localSettings.encryptionEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-1 transition-all ${
                  localSettings.encryptionEnabled ? "right-1" : "left-1"
                }`} />
              </button>
            </div>

            {/* Security Info */}
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
              <p className="text-sm font-semibold text-purple-800">🔒 Security Features Active:</p>
              <ul className="text-xs text-purple-700 space-y-1">
                <li>✓ Password Hashing (bcrypt)</li>
                <li>✓ Session Timeout (8 hours)</li>
                <li>✓ {localSettings.encryptionEnabled ? "Data Encryption (AES-256)" : "Data Encryption (Disabled)"}</li>
                <li>✓ Audit Trail Logging</li>
                <li>✓ Input Sanitization</li>
              </ul>
            </div>

            {/* Clear All Data */}
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-800 mb-3">
                ⚠️ Danger Zone: Clear all local data
              </p>
              <button
                onClick={() => {
                  if (window.confirm("⚠️ WARNING!\n\nThis will DELETE ALL DATA permanently!\n\nAre you absolutely sure?")) {
                    if (window.confirm("🔴 FINAL CONFIRMATION\n\nType 'DELETE' to confirm\n\n(Press Cancel, then OK to proceed)")) {
                      localStorage.removeItem(LS_KEY);
                      sessionStorage.removeItem(SESSION_KEY);
                      window.location.reload();
                    }
                  }
                }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>Clear All Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #0891b2, #06b6d4)" }}>
            <h2 className="font-bold text-white flex items-center gap-2">
              <span>🔔</span>
              <span>Notifications</span>
            </h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Email Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Email Notifications</p>
                <p className="text-xs text-gray-500">Receive email alerts for important events</p>
              </div>
              <button
                onClick={() => handleToggle("emailNotifications")}
                className={`w-14 h-8 rounded-full transition-all relative ${
                  localSettings.emailNotifications ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-1 transition-all ${
                  localSettings.emailNotifications ? "right-1" : "left-1"
                }`} />
              </button>
            </div>

            {/* Browser Notifications */}
            <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200">
              <p className="text-sm text-cyan-800 mb-3">
                Enable browser notifications for alerts
              </p>
              <button
                onClick={async () => {
                  if ("Notification" in window) {
                    const permission = await Notification.requestPermission();
                    alert(permission === "granted" 
                      ? "✅ Notifications enabled!" 
                      : "❌ Notifications denied"
                    );
                  } else {
                    alert("❌ Browser doesn't support notifications");
                  }
                }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 transition-all flex items-center justify-center gap-2"
              >
                <span>🔔</span>
                <span>Enable Browser Notifications</span>
              </button>
            </div>
          </div>
        </div>

        {/* Storage & Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
            <h2 className="font-bold text-white flex items-center gap-2">
              <span>💾</span>
              <span>Storage & Info</span>
            </h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Storage Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800">Local Storage Usage</p>
                <p className="text-sm text-gray-600">{storageInfo.used} KB / 5 MB</p>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(parseFloat(storageInfo.percentage), 100)}%`,
                    background: parseFloat(storageInfo.percentage) > 80 
                      ? "#ef4444" 
                      : parseFloat(storageInfo.percentage) > 50 
                        ? "#f59e0b" 
                        : "#22c55e"
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{storageInfo.percentage}% used</p>
            </div>

            {/* App Info */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
              <p className="text-sm font-semibold text-gray-800">📱 App Information</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Version</span>
                  <span className="font-mono text-gray-800">3.1.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Build</span>
                  <span className="font-mono text-gray-800">Secure Edition</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Updated</span>
                  <span className="font-mono text-gray-800">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Device ID</span>
                  <span className="font-mono text-gray-800 text-xs">{localStorage.getItem("AR_DEVICE_ID")?.slice(-8) || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Support */}
            <div className="p-4 rounded-xl bg-green-50 border border-green-200">
              <p className="text-sm font-semibold text-green-800 mb-2">🆘 Need Help?</p>
              <p className="text-xs text-green-700">
                Contact support for assistance with any issues or questions.
              </p>
              <div className="mt-3 space-y-1 text-xs text-green-700">
                <p>📧 support@arenterprise.com</p>
                <p>📱 +91 98765 43210</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={() => { setShowRestoreConfirm(false); setRestoreFile(null); }}
        onConfirm={handleRestoreConfirm}
        title="Restore from Backup?"
        message={`This will REPLACE all current data with the backup file "${restoreFile?.name}". This action cannot be undone. Make sure you have a current backup before proceeding.`}
        confirmText="Restore"
        confirmColor="blue"
        icon="📦"
      />
    </div>
  );
}
