// ============================================================
// APP.TSX — PART 1 of 4
// Types, Constants, Helpers, Storage Functions, LoginPage
// ============================================================
import { useState, useCallback, useEffect } from "react";
import { loadFromSheets, saveToSheets, startAutoSync } from './services/googleSheets';
import {
  hashPassword,
  verifyPassword,
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
// ============================================================
// AGENT FEATURE — PART 1 of 5
// புதிய Types, Commission Slab, Agent Helpers
//
// 📌 எங்கே paste செய்வது:
//    App.tsx PART 1-ல் "// ============ TYPES ============"
//    section-க்கு கீழே, "interface User {" க்கு முன்னால்
// ============================================================

interface Agent {
  id: string;
  agentId: string;
  username: string;
  password: string;
  fullName: string;
  mobile: string;
  managerId: string;
  managerName: string;
  managerDistrict: string;
  commissionType: "auto" | "custom";
  customCommissionPercent: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  approvedBy?: string;
  approvedAt?: string;
  commissionBalance: number;
  createdAt: string;
  lastLogin?: string;
}

interface CommissionSlab {
  gstPercent: number;
  agentCommission: number;
}

interface AgentVendorOverride {
  id: string;
  agentId: string;
  vendorCode: string;
  vendorName: string;
  commissionPercent: number;
  setBy: string;
  setAt: string;
}

interface AgentWalletEntry {
  id: string;
  agentId: string;
  date: string;
  description: string;
  txnId: string;
  vendorName: string;
  billAmount: number;
  gstPercent: number;
  commissionPercent: number;
  commissionAmount: number;
  commissionType: "auto" | "custom";
  balance: number;
}

// ── Default Commission Slabs ──────────────────────────────────
const DEFAULT_COMMISSION_SLABS: CommissionSlab[] = [
  { gstPercent: 1,   agentCommission: 1.0   },
  { gstPercent: 1.5, agentCommission: 0.5   },
  { gstPercent: 2,   agentCommission: 0.25  },
  { gstPercent: 2.5, agentCommission: 0.1   },
  { gstPercent: 3,   agentCommission: 1.5   },
  { gstPercent: 3.5, agentCommission: 2.0   },
  { gstPercent: 4,   agentCommission: 0.3   },
  { gstPercent: 4.5, agentCommission: 0.75  },
  { gstPercent: 5,   agentCommission: 1.25  },
  { gstPercent: 5.5, agentCommission: 1.75  },
  { gstPercent: 6,   agentCommission: 0.0   },
];

// ── Commission Calculator ─────────────────────────────────────
function calcAgentCommission(
  agent: Agent,
  vendorCode: string,
  gstPercent: number,
  transactionAmount: number,
  overrides: AgentVendorOverride[],
  slabs: CommissionSlab[]
): { percent: number; amount: number; type: "auto" | "custom" } {

  // 1. Vendor-specific override (highest priority)
  const override = overrides.find(
    o => o.agentId === agent.id && o.vendorCode === vendorCode
  );
  if (override) {
    return {
      percent: override.commissionPercent,
      amount: round2(transactionAmount * override.commissionPercent / 100),
      type: "custom"
    };
  }

  // 2. Agent-level custom commission
  if (agent.commissionType === "custom") {
    return {
      percent: agent.customCommissionPercent,
      amount: round2(transactionAmount * agent.customCommissionPercent / 100),
      type: "custom"
    };
  }

  // 3. Auto slab — find matching slab for this GST%
  const sortedSlabs = [...slabs].sort((a, b) => a.gstPercent - b.gstPercent);
  // Find threshold (0% commission slab)
  const threshold = sortedSlabs.find(s => s.agentCommission === 0);
  if (threshold && gstPercent >= threshold.gstPercent) {
    return { percent: 0, amount: 0, type: "auto" };
  }
  // Find exact match
  const exactSlab = sortedSlabs.find(s => s.gstPercent === gstPercent);
  if (exactSlab) {
    return {
      percent: exactSlab.agentCommission,
      amount: round2(transactionAmount * exactSlab.agentCommission / 100),
      type: "auto"
    };
  }
  // Find closest lower slab
  const lowerSlabs = sortedSlabs.filter(s => s.gstPercent < gstPercent && s.agentCommission > 0);
  if (lowerSlabs.length > 0) {
    const closest = lowerSlabs[lowerSlabs.length - 1];
    return {
      percent: closest.agentCommission,
      amount: round2(transactionAmount * closest.agentCommission / 100),
      type: "auto"
    };
  }
  return { percent: 0, amount: 0, type: "auto" };
}

function genAgentId(existing: Agent[]): string {
  return "AGT" + String(existing.length + 1).padStart(3, "0");
}

// ============================================================
// END OF AGENT PART 1
// ============================================================

interface User {
  id: string; username: string; password: string;
  role: "admin" | "district"; district?: string;
  email?: string; createdAt?: string;
}

interface Vendor {
  id: string; vendorCode: string; vendorName: string; district: string;
  mobile?: string; email?: string; businessType?: string;
  address?: string; gstNo?: string; regYear?: string;
  createdAt?: string; active?: boolean;
}

interface Transaction {
  id: string; txnId: string; district: string; vendorCode: string; vendorName: string;
  financialYear: string; month: string; expectedAmount: number; advanceAmount: number;
  gstPercent: number; gstAmount: number; gstBalance: number;
  billsReceived: number; remainingExpected: number;
  status: "Open" | "PendingClose" | "Closed";
  closedByDistrict: boolean; confirmedByAdmin: boolean; profit: number;
  createdAt?: string; closedAt?: string;
}

interface Bill {
  id: string; txnId: string; vendorCode: string; vendorName: string; district: string;
  billNumber: string; billDate: string; billAmount: number;
  gstPercent: number; gstAmount: number; totalAmount: number; createdAt?: string;
}

interface WalletEntry {
  id: string; date: string; description: string; txnId?: string;
  debit: number; credit: number; balance: number;
  type: "advance" | "gst" | "profit" | "manual"; createdBy?: string;
}

interface ManagedUser {
  id: string; username: string; password: string; district: string;
  active: boolean; createdAt: string; lastLogin?: string;
}

interface AuditLog {
  id: string; timestamp: string; user: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "CLOSE" | "CONFIRM" | "LOGIN" | "LOGOUT";
  entity: "Transaction" | "Vendor" | "Bill" | "Wallet" | "User";
  entityId: string; before?: any; after?: any;
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
  const d = DIST_SHORT[district] || district.slice(0, 3).toUpperCase();
  const b = BIZ_SHORT[bizType] || bizType.slice(0, 2).toUpperCase();
  const y = year ? year.slice(-2) : new Date().getFullYear().toString().slice(-2);
  const count = existing.filter(v =>
    v.district === district && v.businessType === bizType
  ).length + 1;
  return `${d}${y}${b}${String(count).padStart(3, "0")}`;
};

// ============================================================
// HELPER: Recalculate transactions whenever bills change
// ============================================================
function recalcTransactions(transactions: Transaction[], bills: Bill[]): Transaction[] {
  return transactions.map(t => {
    const txnBills = bills.filter(b => b.txnId === t.txnId);
    if (txnBills.length === 0) {
      return { ...t, billsReceived: 0, remainingExpected: t.expectedAmount };
    }
    const sumTotal = txnBills.reduce((s, b) => s + round2(b.billAmount * BILL_TOTAL_RATE), 0);
    const remaining = round2(Math.max(0, t.expectedAmount - sumTotal));
    const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);
    return { ...t, billsReceived: round2(billsReceived), remainingExpected: remaining };
  });
}

// ============================================================
// STORAGE FUNCTIONS
// BUG FIX: Removed encryptData/decryptData → was causing
// "Malformed UTF-8 data" error. Now uses plain JSON.
// Legacy encrypted data is detected and cleared gracefully.
// ============================================================
interface StorageData {
  vendors: Vendor[];
  transactions: Transaction[];
  bills: Bill[];
  wallet: WalletEntry[];
  managedUsers: ManagedUser[];
  auditLogs: AuditLog[];
  agents?: Agent[];
  agentWallet?: AgentWalletEntry[];
  agentOverrides?: AgentVendorOverride[];
}

const saveToStorage = (data: StorageData) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Storage save error:", e);
  }
};

// ── Extended save with agents data ───────────────────────────
const saveAllToStorage = (data: StorageData & {
  agents: Agent[];
  agentWallet: AgentWalletEntry[];
  agentOverrides: AgentVendorOverride[];
}) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Storage save error:", e);
  }
};

const loadFromStorage = (): StorageData | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;

    // Plain JSON starts with '{' — safe to parse
    if (raw.trim().startsWith('{')) {
      return JSON.parse(raw);
    }

    // Legacy encrypted string detected — discard and start fresh
    console.warn("⚠️ Legacy encrypted data detected — clearing for fresh start");
    localStorage.removeItem(LS_KEY);
    return null;
  } catch (e) {
    console.error("Storage load error:", e);
    localStorage.removeItem(LS_KEY);
    return null;
  }
};

// Session helpers
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

const DEFAULT_ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

// ============================================================
// LOGIN PAGE COMPONENT
// ============================================================
// ============================================================
// UPDATED LoginPage — PART 1-ல் உள்ள பழைய LoginPage-ஐ
// இதாக REPLACE செய்யவும் (agents prop சேர்க்கப்பட்டது)
// ============================================================

// ============================================================
// LANDING PAGE — 4 Role Buttons
// Replace existing LoginPage function with these TWO functions
// ============================================================

// ── 1. Landing Page (முதல் பக்கம்) ──────────────────────────────
function LandingPage({ onSelectRole }: { onSelectRole: (role: "admin" | "district" | "agent" | "vendor" | "fintrack" | "worktracker" | "reconciliation") => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}
    >
      <div className="w-full max-w-2xl px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #c9a227, #f0d060)" }}
          >
            <span className="text-3xl font-bold text-gray-900">AR</span>
          </div>
          <h1 className="text-3xl font-bold text-white">AR Enterprises</h1>
          <p className="text-sm mt-2" style={{ color: "#c9a227" }}>Multi-District Vendor ERP System V3.0</p>
          <p className="text-xs text-gray-400 mt-1">உங்கள் role-ஐ தேர்ந்தெடுக்கவும்</p>
        </div>

        {/* Role Buttons — 4 main + 1 full-width FinTrack */}
        <div className="grid grid-cols-2 gap-4">
          {/* Admin */}
          <button
            onClick={() => onSelectRole("admin")}
            className="group p-6 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)", border: "1px solid rgba(201,162,39,0.3)" }}
          >
            <div className="text-4xl mb-3">👑</div>
            <p className="font-bold text-white text-lg">Admin</p>
            <p className="text-xs text-gray-400 mt-1">Super Admin access</p>
            <div className="mt-3 text-xs font-semibold" style={{ color: "#c9a227" }}>Login →</div>
          </button>

          {/* District */}
          <button
            onClick={() => onSelectRole("district")}
            className="group p-6 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #0c4a6e, #0369a1)", border: "1px solid rgba(56,189,248,0.3)" }}
          >
            <div className="text-4xl mb-3">🏗️</div>
            <p className="font-bold text-white text-lg">District</p>
            <p className="text-xs text-gray-400 mt-1">District Manager access</p>
            <div className="mt-3 text-xs font-semibold text-sky-300">Login →</div>
          </button>

          {/* Agent */}
          <button
            onClick={() => onSelectRole("agent")}
            className="group p-6 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            <div className="text-4xl mb-3">🤝</div>
            <p className="font-bold text-white text-lg">Agent</p>
            <p className="text-xs text-gray-400 mt-1">Field Agent access</p>
            <div className="mt-3 text-xs font-semibold text-purple-300">Login →</div>
          </button>

          {/* Vendor */}
          <button
            onClick={() => onSelectRole("vendor")}
            className="group p-6 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #14532d, #15803d)", border: "1px solid rgba(74,222,128,0.3)" }}
          >
            <div className="text-4xl mb-3">🏢</div>
            <p className="font-bold text-white text-lg">Vendor</p>
            <p className="text-xs text-gray-400 mt-1">Vendor self-service</p>
            <div className="mt-3 text-xs font-semibold text-green-300">Login →</div>
          </button>

          {/* FinTrack AI — Full width */}
          <button
            onClick={() => onSelectRole("fintrack")}
            className="col-span-2 group p-5 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #7c2d12, #b45309, #92400e)", border: "2px solid rgba(251,191,36,0.5)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">💼</div>
                <div>
                  <p className="font-bold text-white text-lg">FinTrack AI</p>
                  <p className="text-xs text-yellow-200 mt-0.5">Bank Statement • Project Tracking • GST • Financial Dashboard</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>NEW ✨</span>
                <div className="mt-2 text-xs font-semibold text-yellow-300">Enter →</div>
              </div>
            </div>
          </button>

          {/* Bank Reconciliation — Full width */}
          <button
            onClick={() => onSelectRole("reconciliation" as any)}
            className="col-span-2 group p-5 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #134e4a, #0f766e, #0d9488)", border: "2px solid rgba(45,212,191,0.4)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🔄</div>
                <div>
                  <p className="font-bold text-white text-lg">Bank Reconciliation</p>
                  <p className="text-xs text-teal-200 mt-0.5">Contract Work ↔ Bank Statement • Auto Match • Highlight</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(45,212,191,0.2)", color: "#2dd4bf" }}>AUTO ✓</span>
                <div className="mt-2 text-xs font-semibold text-teal-300">Match →</div>
              </div>
            </div>
          </button>

          {/* Work Tracker — Full width */}
          <button
            onClick={() => onSelectRole("worktracker" as any)}
            className="col-span-2 group p-5 rounded-2xl text-left transition-all hover:scale-105 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8, #1e40af)", border: "2px solid rgba(99,179,237,0.4)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">📋</div>
                <div>
                  <p className="font-bold text-white text-lg">Work Tracker</p>
                  <p className="text-xs text-blue-200 mt-0.5">Sri Polinchi & Co • GST • ITC • Contract Works • Dashboard</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(99,179,237,0.2)", color: "#93c5fd" }}>LIVE 📡</span>
                <div className="mt-2 text-xs font-semibold text-blue-300">View →</div>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-8">🔒 AR Enterprises ERP V3.0 — Secured</p>
      </div>
    </div>
  );
}

// ── 2. Role-specific Login Page ───────────────────────────────
function LoginPage({
  role,
  onLogin,
  onBack,
  managedUsers,
  agents,
  vendors
}: {
  role: "admin" | "district" | "agent" | "vendor";
  onLogin: (u: User) => void;
  onBack: () => void;
  managedUsers: ManagedUser[];
  agents: Agent[];
  vendors: Vendor[];
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleConfig = {
    admin:    { icon: "👑", label: "Admin Login",    color: "#c9a227",  hint: "Admin username & password" },
    district: { icon: "🏛️", label: "District Login", color: "#38bdf8",  hint: "District manager credentials" },
    agent:    { icon: "🤝", label: "Agent Login",    color: "#a78bfa",  hint: "Agent username & password" },
    vendor:   { icon: "🏢", label: "Vendor Login",   color: "#4ade80",  hint: "GST No (or Vendor Code) + Mobile" },
  };
  const cfg = roleConfig[role];

const handleLogin = async () => {
  if (!username || !password) { setError("Username மற்றும் Password தேவை!"); return; }
  setLoading(true); setError("");
  try {
    if (role === "admin") {
      if (username === DEFAULT_ADMIN_USERNAME) {
        const storedAdmin = managedUsers.find(u => u.username === DEFAULT_ADMIN_USERNAME);
        if (storedAdmin) {
          const ok = await verifyPassword(password, storedAdmin.password);
          if (ok) { onLogin({ id: storedAdmin.id, username: storedAdmin.username, password: storedAdmin.password, role: "admin" }); return; }
        } else if (password === DEFAULT_ADMIN_PASSWORD) {
          const hp = await hashPassword(DEFAULT_ADMIN_PASSWORD);
          onLogin({ id: "U001", username: DEFAULT_ADMIN_USERNAME, password: hp, role: "admin" }); return;
        }
      }
      setError("தவறான Admin credentials!");
    } else if (role === "district") {
      const u = managedUsers.find(x => x.username === username && x.active);
      if (u) {
        const ok = await verifyPassword(password, u.password);
        if (ok) { onLogin({ id: u.id, username: u.username, password: u.password, role: "district", district: u.district }); return; }
      }
      setError("தவறான credentials அல்லது account inactive!");
    } else if (role === "agent") {
      const approved = agents.find(a => a.username === username && a.status === "approved");
      if (approved) {
        const ok = await verifyPassword(password, approved.password);
        if (ok) { onLogin({ id: approved.id, username: approved.username, password: approved.password, role: "agent" as any }); return; }
      }
      const pending = agents.find(a => a.username === username && a.status === "pending");
      if (pending) {
        const ok = await verifyPassword(password, pending.password);
        if (ok) { setError("⏳ உங்கள் account admin approval-க்காக காத்திருக்கிறது!"); setLoading(false); return; }
      }
      setError("தவறான Agent credentials!");
    } else if (role === "vendor") {
      const stored = localStorage.getItem("AR_ERP_V3_DATA_ENCRYPTED");
      const allVendors = stored ? (JSON.parse(stored)?.vendors || vendors) : vendors;
      const vendor = allVendors.find((v: any) =>
        (v.gstNo && String(v.gstNo).trim().toUpperCase() === username.trim().toUpperCase()) ||
        String(v.vendorCode).trim().toUpperCase() === username.trim().toUpperCase()
      );
      if (vendor && vendor.mobile && String(vendor.mobile).trim() === password.trim()) {
        onLogin({ id: vendor.id, username: vendor.vendorCode, password: String(vendor.mobile) || "", role: "vendor" as any, district: vendor.district });
        return;
      }
      setError("தவறான Vendor credentials!");
    }
  } catch (e) {
    setError("Login error!");
  } finally {
    setLoading(false);
  }
};

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-2xl"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
      >
        {/* Back */}
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
          ← Back to Home
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{cfg.icon}</div>
          <h1 className="text-2xl font-bold text-white">{cfg.label}</h1>
          <p className="text-xs mt-2 text-gray-400">{cfg.hint}</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              {role === "vendor" ? "GST Number / Vendor Code" : "Username"}
            </label>
            <input
              type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder={role === "vendor" ? "33AAAAA0000A1Z5 or PDK25HW001" : "Enter username"}
              autoComplete="off" disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg text-white text-sm outline-none placeholder-gray-500 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              {role === "vendor" ? "Mobile Number" : "Password"}
            </label>
            <input
              type={role === "vendor" ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder={role === "vendor" ? "9876543210" : "Enter password"}
              autoComplete="new-password" disabled={loading}
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
            onClick={handleLogin} disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-gray-900 text-sm transition-all disabled:opacity-50 hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }}
          >
            {loading ? "🔄 Logging in..." : `${cfg.icon} Login →`}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">🔒 AR Enterprises ERP V3.0</p>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// END — Updated LoginPage
// ============================================================
// ============================================================
// END OF PART 1
// Next: PART 2 — Main App Component (App function)
// ============================================================
// ============================================================
// APP.TSX — PART 2 of 4
// Main App Component (export default function App)
// Paste this AFTER Part 1
// ============================================================

// ============================================================
// APP.TSX — PART 2 of 4 (AGENT VERSION — REPLACE பழைய PART2)
// Main App Component
// ============================================================

// ============================================================
// APP.TSX — PART 2 REPLACEMENT (FINAL — Build Fix + All Features)
// ============================================================
export default function App() {
  const saved = loadFromStorage();

  const savedSlabs = (() => {
    try {
      const s = localStorage.getItem("AR_COMMISSION_SLABS");
      return s ? JSON.parse(s) : DEFAULT_COMMISSION_SLABS;
    } catch { return DEFAULT_COMMISSION_SLABS; }
  })();

  // ── State ──────────────────────────────────────────────────
  const [user, setUser]                   = useState<User | null>(null);
  const [loginRole, setLoginRole]         = useState<"admin"|"district"|"agent"|"vendor"|null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [page, setPage]                   = useState("dashboard");
  const [vendors, setVendors]             = useState<Vendor[]>(saved?.vendors || []);
  const [transactions, setTransactions]   = useState<Transaction[]>(saved?.transactions || []);
  const [bills, setBills]                 = useState<Bill[]>(saved?.bills || []);
  const [wallet, setWallet]               = useState<WalletEntry[]>(saved?.wallet || []);
  const [managedUsers, setManagedUsers]   = useState<ManagedUser[]>(saved?.managedUsers || []);
  const [auditLogs, setAuditLogs]         = useState<AuditLog[]>(saved?.auditLogs || []);
  const [agents, setAgents]               = useState<Agent[]>((saved as any)?.agents || []);
  const [agentWallet, setAgentWallet]     = useState<AgentWalletEntry[]>((saved as any)?.agentWallet || []);
  const [agentOverrides, setAgentOverrides] = useState<AgentVendorOverride[]>((saved as any)?.agentOverrides || []);
  const [commissionSlabs, setCommissionSlabs] = useState<CommissionSlab[]>(savedSlabs);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [settings, setSettings]           = useState({
    autoBackup: true, backupFrequency: 7,
    emailNotifications: true, browserNotifications: false, dataEncryption: false
  });

  // ── Initialize ─────────────────────────────────────────────
  useEffect(() => {
    async function initialize() {
      try {
        const session = loadSession();
        if (session) { setUser(session.user); }
        await loadFromSheets();
        const reloaded = loadFromStorage() as any;
        if (reloaded) {
          setVendors(reloaded.vendors || []);
          setTransactions(reloaded.transactions || []);
          setBills(reloaded.bills || []);
          setWallet(reloaded.wallet || []);
          setManagedUsers(reloaded.managedUsers || []);
          setAuditLogs(reloaded.auditLogs || []);
          setAgents(reloaded.agents || []);
          setAgentWallet(reloaded.agentWallet || []);
          setAgentOverrides(reloaded.agentOverrides || []);
        }
      } catch (err) { console.log('Initial load failed:', err); }
      setIsInitializing(false);
      startAutoSync(5);
    }
    initialize();
  }, []);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth < 768) setSidebarOpen(false); };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (settings.browserNotifications && 'Notification' in window) Notification.requestPermission();
  }, [settings.browserNotifications]);

  // ── Save ───────────────────────────────────────────────────
  const saveData = useCallback((
    v: Vendor[], t: Transaction[], b: Bill[],
    w: WalletEntry[], u: ManagedUser[], a: AuditLog[],
    ag?: Agent[], agw?: AgentWalletEntry[], ago?: AgentVendorOverride[]
  ) => {
    // ✅ agents, agentWallet, agentOverrides எல்லாமும் localStorage-ல் save ஆகும்
    saveAllToStorage({
      vendors: v, transactions: t, bills: b, wallet: w,
      managedUsers: u, auditLogs: a,
      agents: ag || [],
      agentWallet: agw || [],
      agentOverrides: ago || []
    });
    saveToSheets().catch(err => console.log('Sync failed:', err));
  }, []);

  // ── Audit ──────────────────────────────────────────────────
  const logAction = useCallback((
    action: AuditLog['action'], entity: AuditLog['entity'],
    entityId: string, before?: any, after?: any
  ) => {
    if (!user) return;
    const log: AuditLog = { id: genId("LOG"), timestamp: new Date().toISOString(), user: user.username, action, entity, entityId, before, after };
    setAuditLogs(prev => [...prev, log]);
  }, [user]);

  // ── Wallet ─────────────────────────────────────────────────
  const getWalletBalance = useCallback(() => wallet.length > 0 ? wallet[wallet.length - 1].balance : 0, [wallet]);

  const addWalletEntry = useCallback((desc: string, debit: number, credit: number, type: WalletEntry["type"], txnId?: string) => {
    setWallet(prev => {
      const lastBal = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      const entry: WalletEntry = {
        id: genId("W"), date: new Date().toISOString().split("T")[0],
        description: desc, txnId, debit, credit,
        balance: round2(lastBal - debit + credit), type, createdBy: user?.username
      };
      return [...prev, entry];
    });
  }, [user]);

  // ── Confirm Close ──────────────────────────────────────────
  const handleConfirmClose = useCallback((txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) { alert("❌ Transaction இல்லை!"); return; }
    if (txn.confirmedByAdmin || txn.status === "Closed") { alert("⚠️ Already Closed!"); return; }

    const profit = round2(txn.expectedAmount * PROFIT_RATE);
    const existingProfit = wallet.find(w => w.txnId === txnId && w.type === "profit");
    let updatedWallet = [...wallet];
    if (!existingProfit) {
      const lastBal = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;
      updatedWallet = [...wallet, {
        id: genId("W"), date: new Date().toISOString().split("T")[0],
        description: `8% Profit Credit — ${txn.vendorName} (${txnId})`,
        txnId, debit: 0, credit: profit, balance: round2(lastBal + profit),
        type: "profit" as const, createdBy: user?.username
      }];
    }

    // Agent commission
    let updatedAgents = [...agents];
    let updatedAgentWallet = [...agentWallet];
    let commissionInfo = "";
    const txnAgent = agents.find(a => a.agentId === (txn as any).createdByAgent);
    if (txnAgent && txnAgent.status === "approved") {
      const alreadyPaid = agentWallet.find(w => w.txnId === txnId && w.agentId === txnAgent.id);
      if (!alreadyPaid) {
        const commission = calcAgentCommission(txnAgent, txn.vendorCode, txn.gstPercent, txn.expectedAmount, agentOverrides, commissionSlabs);
        if (commission.amount > 0) {
          const agentEntries = agentWallet.filter(w => w.agentId === txnAgent.id);
          const prevBal = agentEntries.length > 0 ? agentEntries[agentEntries.length - 1].balance : txnAgent.commissionBalance;
          const entry: AgentWalletEntry = {
            id: genId("AW"), agentId: txnAgent.id,
            date: new Date().toISOString().split("T")[0],
            description: `Commission — ${txn.vendorName} (${txnId})`,
            txnId, vendorName: txn.vendorName, billAmount: txn.expectedAmount,
            gstPercent: txn.gstPercent, commissionPercent: commission.percent,
            commissionAmount: commission.amount, commissionType: commission.type,
            balance: round2(prevBal + commission.amount)
          };
          updatedAgentWallet = [...agentWallet, entry];
          updatedAgents = agents.map(a => a.id === txnAgent.id ? { ...a, commissionBalance: round2(prevBal + commission.amount) } : a);
          commissionInfo = `\n🤝 Agent: ${txnAgent.fullName} — ${fmt(commission.amount)}`;
        }
      }
    }

    const updatedT = transactions.map(t =>
      t.txnId === txnId ? { ...t, status: "Closed" as const, confirmedByAdmin: true, profit, closedAt: new Date().toISOString() } : t
    );
    setTransactions(updatedT); setWallet(updatedWallet);
    setAgents(updatedAgents); setAgentWallet(updatedAgentWallet);
    saveData(vendors, updatedT, bills, updatedWallet, managedUsers, auditLogs, updatedAgents, updatedAgentWallet, agentOverrides);
    logAction("CONFIRM", "Transaction", txnId);
    alert(`✅ Transaction Closed!\n\n💰 Profit: ${fmt(profit)}${commissionInfo}`);
  }, [transactions, wallet, vendors, bills, managedUsers, auditLogs, agents, agentWallet, agentOverrides, commissionSlabs, user, saveData, logAction]);

  // ── Login / Logout ─────────────────────────────────────────
  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    const session = createSession(loggedInUser, 8);
    saveSession(session);
    setLoginRole(null);

    if ((loggedInUser as any).role === "agent") { setPage("agent_dashboard"); return; }
    if ((loggedInUser as any).role === "vendor") { setPage("vendor_dashboard"); return; }
    if ((loggedInUser as any).role === "fintrack") { setPage("fintrack_dashboard"); return; }

    if (loggedInUser.role === "district") {
      const nu = managedUsers.map(u => u.username === loggedInUser.username ? { ...u, lastLogin: new Date().toISOString() } : u);
      setManagedUsers(nu);
      saveData(vendors, transactions, bills, wallet, nu, auditLogs, agents, agentWallet, agentOverrides);
    }
    logAction("LOGIN", "User", loggedInUser.id);
    setPage("dashboard");
  };

  const handleLogout = () => {
    if (user) logAction("LOGOUT", "User", user.id);
    clearSession(); setUser(null); setLoginRole(null); setPage("dashboard");
  };

  // ── Loading ────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a2f5e 50%, #0d2144 100%)" }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 animate-spin mx-auto mb-4" style={{ borderColor: '#c9a227', borderTopColor: 'transparent' }}></div>
          <p className="text-white font-semibold text-lg">📊 Loading AR ERP...</p>
        </div>
      </div>
    );
  }

  // ── Not logged in — Landing or Login ──────────────────────
  // ── Work Tracker — No login needed, direct access ──────────────
  if ((loginRole as any) === "worktracker" && !user) {
    return <WorkTrackerPage onBack={() => setLoginRole(null)} />;
  }

  // ── Bank Reconciliation — No login needed, direct access ────────
  if ((loginRole as any) === "reconciliation" && !user) {
    return <ReconciliationPage onBack={() => setLoginRole(null)} />;
  }

  // ── FinTrack AI — No login needed, direct access ────────────────
  if (loginRole === "fintrack" && !user) {
    return (
      <FinTrackDashboard
        vendors={vendors}
        transactions={transactions}
        bills={bills}
        wallet={wallet}
        onBack={() => setLoginRole(null)}
      />
    );
  }

  if (!user) {
    if (!loginRole) return <LandingPage onSelectRole={setLoginRole} />;
    return (
      <LoginPage
        role={loginRole}
        onLogin={handleLogin}
        onBack={() => setLoginRole(null)}
        managedUsers={managedUsers}
        agents={agents}
        vendors={vendors}
      />
    );
  }

  // ── Vendor Dashboard ───────────────────────────────────────
  if ((user as any).role === "vendor") {
    const vendorData = vendors.find(v => v.vendorCode === user.username || v.id === user.id);
    if (vendorData) {
      return <VendorDashboardPage vendor={vendorData} transactions={transactions} bills={bills} onLogout={handleLogout} />;
    }
  }

  // ── Agent Dashboard ────────────────────────────────────────
  if ((user as any).role === "agent") {
    const agentData = agents.find(a => a.username === user.username);
    if (agentData) {
      return (
        <AgentDashboardPage
          agent={agentData} transactions={transactions} vendors={vendors}
          bills={bills} agentWallet={agentWallet} agentOverrides={agentOverrides}
          commissionSlabs={commissionSlabs}
          onAddVendor={(v) => { const nv = [...vendors, v]; setVendors(nv); saveData(nv, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides); }}
          onAddTransaction={(txn, advance) => {
            const nt = [...transactions, { ...txn, createdAt: new Date().toISOString() }];
            setTransactions(nt);
            if (advance > 0) addWalletEntry(`Advance — ${txn.vendorName} (${txn.txnId})`, advance, 0, "advance", txn.txnId);
            saveData(vendors, nt, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
          }}
          onAddBill={(bill) => {
            const nb = [...bills, { ...bill, createdAt: new Date().toISOString() }];
            const nt = recalcTransactions(transactions, nb);
            setBills(nb); setTransactions(nt);
            saveData(vendors, nt, nb, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
          }}
          onBulkAddBill={(newBills) => {
            const nb = [...bills, ...newBills];
            const nt = recalcTransactions(transactions, nb);
            setBills(nb); setTransactions(nt);
            saveData(vendors, nt, nb, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
          }}
          onLogout={handleLogout}
        />
      );
    }
  }

  // ── Admin / District UI ────────────────────────────────────
  const district = user.role === "district" ? user.district! : "";
  const isAdmin  = user.role === "admin";
  const myVendors = isAdmin ? vendors : vendors.filter(v => v.district === district);
  const myTxns    = isAdmin ? transactions : transactions.filter(t => t.district === district);
  const myBills   = isAdmin ? bills : bills.filter(b => b.district === district);
  const pendingClose  = transactions.filter(t => t.closedByDistrict && !t.confirmedByAdmin);
  const pendingAgents = agents.filter(a => a.status === "pending").length;

  const navItems = isAdmin
    ? [
        { id: "dashboard",    label: "Dashboard",       icon: "📊" },
        { id: "vendors",      label: "Vendors",         icon: "🏢" },
        { id: "transactions", label: "Transactions",    icon: "📋" },
        { id: "bills",        label: "Bills",           icon: "🧾" },
        { id: "wallet",       label: "Admin Wallet",    icon: "💰", badge: pendingClose.length },
        { id: "analytics",    label: "Analytics",       icon: "📈" },
        { id: "agents",       label: "Agents",          icon: "🤝", badge: pendingAgents },
        { id: "users",        label: "User Management", icon: "👥" },
        { id: "audit",        label: "Audit Logs",      icon: "📜" },
        { id: "settings",     label: "Settings",        icon: "⚙️" },
      ]
    : [
        { id: "dashboard",    label: "Dashboard",    icon: "📊" },
        { id: "vendors",      label: "Vendors",      icon: "🏢" },
        { id: "transactions", label: "Transactions", icon: "📋" },
        { id: "bills",        label: "Bills",        icon: "🧾" },
        { id: "reports",      label: "Reports",      icon: "📄" },
      ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f2f5", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Sidebar */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"}`}
        style={{ background: "linear-gradient(180deg, #0a1628 0%, #1a2f5e 100%)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm" style={{ color: "#c9a227" }}>AR Enterprises</p>
              <p className="text-xs text-gray-400">ERP V3.0</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white text-lg transition-colors">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>
        {sidebarOpen && (
          <div className="p-3 m-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p className="text-xs text-gray-400">{isAdmin ? "👑 Super Admin" : `🏛️ ${district}`}</p>
            <p className="text-xs font-medium text-white truncate">{user.username}</p>
          </div>
        )}
        <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${page === n.id ? "text-gray-900 font-semibold" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
              style={page === n.id ? { background: "linear-gradient(135deg, #c9a227, #f0d060)" } : {}}
            >
              <span className="text-lg">{n.icon}</span>
              {sidebarOpen && <span className="flex-1 text-left">{n.label}</span>}
              {sidebarOpen && (n as any).badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">{(n as any).badge}</span>
              )}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="absolute bottom-4 left-0 w-64 px-3">
            <button onClick={handleLogout} className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-white transition-all" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              🚪 Logout
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">

        {page === "dashboard" && (
          <DashboardPage
            isAdmin={isAdmin} district={district}
            transactions={myTxns} vendors={myVendors} bills={myBills}
            wallet={wallet} walletBalance={getWalletBalance()}
            pendingClose={pendingClose} onConfirmClose={handleConfirmClose}
            settings={settings} agents={agents}
            onAddAgent={(newAgent) => {
              const ua = [...agents, newAgent]; setAgents(ua);
              saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, ua, agentWallet, agentOverrides);
            }}
           
            user={user}
          />
        )}

        {page === "vendors" && (
          <VendorsPage
            isAdmin={isAdmin} district={district}
            vendors={myVendors} allVendors={vendors}
            onAdd={async (v) => {
              const val = await validateData(vendorSchema, v);
              if (!val.valid) { alert("❌ " + val.errors.join("\n")); return; }
              const nv = [...vendors, { ...v, createdAt: new Date().toISOString(), active: true }];
              setVendors(nv); saveData(nv, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("CREATE", "Vendor", v.id, null, v);
            }}
            onUpdate={(u) => {
              const nv = vendors.map(v => v.id === u.id ? u : v);
              setVendors(nv); saveData(nv, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("UPDATE", "Vendor", u.id);
            }}
            onDelete={(id) => {
              const v = vendors.find(x => x.id === id);
              if (!v) return;
              if (transactions.some(t => t.vendorCode === v.vendorCode)) { alert("❌ Active transactions exist!"); return; }
              if (!confirm(`Delete ${v.vendorName}?`)) return;
              const nv = vendors.filter(x => x.id !== id);
              setVendors(nv); saveData(nv, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("DELETE", "Vendor", id);
            }}
          />
        )}

        {page === "transactions" && (
          <TransactionsPage
            isAdmin={isAdmin} district={district}
            transactions={myTxns} vendors={myVendors} bills={myBills}
            onAdd={async (txn, advance) => {
              const val = await validateData(transactionSchema, { expectedAmount: txn.expectedAmount, advanceAmount: txn.advanceAmount });
              if (!val.valid) { alert("❌ " + val.errors.join("\n")); return; }
              const nt = [...transactions, { ...txn, createdAt: new Date().toISOString() }];
              setTransactions(nt);
              if (advance > 0) addWalletEntry(`Advance — ${txn.vendorName} (${txn.txnId})`, advance, 0, "advance", txn.txnId);
              saveData(vendors, nt, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("CREATE", "Transaction", txn.txnId);
            }}
            onClose={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn) return;
              const gstBal = round2(txn.gstAmount - txn.advanceAmount);
              if (gstBal > 0) addWalletEntry(`GST Balance — ${txn.vendorName} (${txnId})`, gstBal, 0, "gst", txnId);
              const nt = transactions.map(t => t.txnId === txnId ? { ...t, status: "PendingClose" as const, closedByDistrict: true, remainingExpected: 0 } : t);
              setTransactions(nt);
              saveData(vendors, nt, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("CLOSE", "Transaction", txnId);
              alert("✅ Closed! Admin confirmation pending.");
            }}
            onUpdate={(u) => {
              const nt = transactions.map(t => t.txnId === u.txnId ? u : t);
              setTransactions(nt); saveData(vendors, nt, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("UPDATE", "Transaction", u.txnId);
            }}
            onDelete={(txnId) => {
              const txn = transactions.find(t => t.txnId === txnId);
              if (!txn || txn.status !== "Open") { alert("❌ Cannot delete!"); return; }
              if (!confirm(`Delete ${txnId}?`)) return;
              const nt = transactions.filter(t => t.txnId !== txnId);
              setTransactions(nt); saveData(vendors, nt, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("DELETE", "Transaction", txnId);
            }}
          />
        )}

        {page === "bills" && (
          <BillsPage
            isAdmin={isAdmin} district={district}
            bills={myBills} transactions={myTxns} vendors={myVendors}
            onAdd={async (bill) => {
              const val = await validateData(billSchema, { billNumber: bill.billNumber, billAmount: bill.billAmount, billDate: bill.billDate });
              if (!val.valid) { alert("❌ " + val.errors.join("\n")); return; }
              const txn = transactions.find(t => t.txnId === bill.txnId);
              if (txn && txn.status !== "Open") { alert("❌ Closed transaction!"); return; }
              const nb = [...bills, { ...bill, createdAt: new Date().toISOString() }];
              const nt = recalcTransactions(transactions, nb);
              setBills(nb); setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("CREATE", "Bill", bill.id);
            }}
            onBulkAdd={(newBills) => {
              const nb = [...bills, ...newBills]; const nt = recalcTransactions(transactions, nb);
              setBills(nb); setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
            }}
            onUpdate={(u) => {
              const nb = bills.map(b => b.id === u.id ? u : b); const nt = recalcTransactions(transactions, nb);
              setBills(nb); setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("UPDATE", "Bill", u.id);
            }}
            onDelete={(billId) => {
              const b = bills.find(x => x.id === billId);
              if (!b || !confirm(`Delete ${b.billNumber}?`)) return;
              const nb = bills.filter(x => x.id !== billId); const nt = recalcTransactions(transactions, nb);
              setBills(nb); setTransactions(nt);
              saveData(vendors, nt, nb, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides);
              logAction("DELETE", "Bill", billId);
            }}
          />
        )}

        {page === "wallet" && isAdmin && (
          <WalletPage
            wallet={wallet} balance={getWalletBalance()}
            onManualEntry={(desc, debit, credit) => {
              addWalletEntry(sanitizeInput(desc), debit, credit, "manual");
              setTimeout(() => setWallet(prev => { saveData(vendors, transactions, bills, prev, managedUsers, auditLogs, agents, agentWallet, agentOverrides); return prev; }), 100);
            }}
            onSetBalance={(newBal) => {
              const diff = newBal - getWalletBalance();
              if (diff > 0) addWalletEntry("Balance Adjustment (Credit)", 0, diff, "manual");
              else if (diff < 0) addWalletEntry("Balance Adjustment (Debit)", Math.abs(diff), 0, "manual");
            }}
          />
        )}

        {page === "analytics" && isAdmin && <AnalyticsPage transactions={transactions} bills={bills} vendors={vendors} wallet={wallet} />}
        {page === "reports" && !isAdmin && <ReportsPage transactions={myTxns} bills={myBills} vendors={myVendors} district={district} />}

        {page === "agents" && isAdmin && (
          <AdminAgentsPage
            agents={agents} agentWallet={agentWallet} agentOverrides={agentOverrides}
            commissionSlabs={commissionSlabs} transactions={transactions} vendors={vendors} bills={bills}
            onApprove={(agentId, commType, customPct) => {
              const ua = agents.map(a => a.id === agentId ? { ...a, status: "approved" as const, commissionType: commType, customCommissionPercent: customPct, approvedBy: user?.username, approvedAt: new Date().toISOString() } : a);
              setAgents(ua); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, ua, agentWallet, agentOverrides);
              alert("✅ Approved!");
            }}
            onReject={(id) => { const ua = agents.map(a => a.id === id ? { ...a, status: "rejected" as const } : a); setAgents(ua); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, ua, agentWallet, agentOverrides); }}
            onSuspend={(id) => { const ua = agents.map(a => a.id === id ? { ...a, status: a.status === "suspended" ? "approved" as const : "suspended" as const } : a); setAgents(ua); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, ua, agentWallet, agentOverrides); }}
            onDelete={(id) => { const ua = agents.filter(a => a.id !== id); setAgents(ua); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, ua, agentWallet, agentOverrides); }}
            onSetCommission={(id, type, pct) => { const ua = agents.map(a => a.id === id ? { ...a, commissionType: type, customCommissionPercent: pct } : a); setAgents(ua); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, ua, agentWallet, agentOverrides); }}
            onAddOverride={(o) => { const uo = [...agentOverrides, o]; setAgentOverrides(uo); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, uo); }}
            onDeleteOverride={(id) => { const uo = agentOverrides.filter(o => o.id !== id); setAgentOverrides(uo); saveData(vendors, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, uo); }}
            onUpdateSlabs={(slabs) => { setCommissionSlabs(slabs); localStorage.setItem("AR_COMMISSION_SLABS", JSON.stringify(slabs)); }}
          />
        )}

        {page === "users" && isAdmin && (
          <UserManagementPage
            districtUsers={managedUsers}
            onAddUser={async (u) => {
              const val = await validateData(userSchema, { username: u.username, password: u.password });
              if (!val.valid) { alert("❌ " + val.errors.join("\n")); return; }
              if (managedUsers.some(x => x.username === u.username)) { alert("❌ Username exists!"); return; }
              const hp = await hashPassword(u.password);
              const nu = [...managedUsers, { ...u, password: hp }];
              setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu, auditLogs, agents, agentWallet, agentOverrides);
              logAction("CREATE", "User", u.id); alert("✅ User created!");
            }}
            onUpdateUser={async (u) => {
              const before = managedUsers.find(x => x.id === u.id);
              if (before && u.password !== before.password) u.password = await hashPassword(u.password);
              const nu = managedUsers.map(x => x.id === u.id ? u : x);
              setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu, auditLogs, agents, agentWallet, agentOverrides);
              logAction("UPDATE", "User", u.id);
            }}
            onToggleUser={(id) => {
              const nu = managedUsers.map(u => u.id === id ? { ...u, active: !u.active } : u);
              setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu, auditLogs, agents, agentWallet, agentOverrides);
            }}
            onDeleteUser={(id) => {
              const u = managedUsers.find(x => x.id === id);
              if (!u || u.username === DEFAULT_ADMIN_USERNAME) { alert("❌ Cannot delete!"); return; }
              if (!confirm(`Delete ${u.username}?`)) return;
              const nu = managedUsers.filter(x => x.id !== id);
              setManagedUsers(nu); saveData(vendors, transactions, bills, wallet, nu, auditLogs, agents, agentWallet, agentOverrides);
              logAction("DELETE", "User", id);
            }}
          />
        )}

        {page === "audit" && isAdmin && <AuditLogsPage logs={auditLogs} />}

        {page === "settings" && isAdmin && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={(s) => { setSettings(s); localStorage.setItem('AR_SETTINGS', JSON.stringify(s)); }}
            onBackup={() => {
              const backup = { timestamp: new Date().toISOString(), version: "3.0", data: { vendors, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides } };
              const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url;
              a.download = `AR_Backup_${new Date().toISOString().split("T")[0]}.json`; a.click();
              alert("✅ Backup downloaded!");
            }}
            onRestore={(file) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const backup = JSON.parse(e.target?.result as string);
                  if (!backup.data) throw new Error();
                  setVendors(backup.data.vendors || []); setTransactions(backup.data.transactions || []);
                  setBills(backup.data.bills || []); setWallet(backup.data.wallet || []);
                  setManagedUsers(backup.data.managedUsers || []); setAuditLogs(backup.data.auditLogs || []);
                  setAgents(backup.data.agents || []); setAgentWallet(backup.data.agentWallet || []);
                  setAgentOverrides(backup.data.agentOverrides || []);
                  saveData(backup.data.vendors||[], backup.data.transactions||[], backup.data.bills||[], backup.data.wallet||[], backup.data.managedUsers||[], backup.data.auditLogs||[], backup.data.agents||[], backup.data.agentWallet||[], backup.data.agentOverrides||[]);
                  alert("✅ Restored!"); setTimeout(() => window.location.reload(), 1000);
                } catch { alert("❌ Invalid backup!"); }
              };
              reader.readAsText(file);
            }}
            onClearData={() => {
              if (!confirm("⚠️ Delete ALL data?")) return;
              if (!confirm("⚠️ FINAL WARNING — sure?")) return;
              localStorage.clear(); sessionStorage.clear(); window.location.reload();
            }}
            storageUsed={new Blob([JSON.stringify({ vendors, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides })]).size}
          />
        )}

      </div>
    </div>
  );
}


// ============================================================
// DISTRICT DASHBOARD — AGENT ADD SECTION FIX
//
// App.tsx-ல் DashboardPage function-ஐ கண்டுபிடியுங்கள்:
//
// function DashboardPage({
//   isAdmin, district, transactions, vendors, bills, wallet,
//   walletBalance, pendingClose, onConfirmClose, settings
// }
//
// இதை REPLACE செய்யுங்கள் — agents, onAddAgent props சேர்க்கப்படுகின்றன
// ============================================================

function DashboardPage({
  isAdmin, district, transactions, vendors, bills, wallet,
  walletBalance, pendingClose, onConfirmClose, settings, agents = [], onAddAgent, user
}: {
  isAdmin: boolean; district: string;
  transactions: Transaction[]; vendors: Vendor[]; bills: Bill[];
  wallet: WalletEntry[]; walletBalance: number;
  pendingClose: Transaction[]; onConfirmClose: (id: string) => void;
  settings: any; agents?: Agent[]; onAddAgent?: (a: Agent) => void; user?: User | null;
}) {
  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsReceived = transactions.reduce((s, t) => s + t.billsReceived, 0);
  const totalGST = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const openTxns = transactions.filter(t => t.status === "Open").length;
  const closedTxns = transactions.filter(t => t.status === "Closed").length;
  const totalProfit = transactions
  .filter(t => t.status === "Closed" || t.confirmedByAdmin)
  .reduce((s, t) => s + ((t.profit > 0 ? t.profit : round2(t.expectedAmount * PROFIT_RATE)) > 0 ? (t.profit > 0 ? t.profit : round2(t.expectedAmount * PROFIT_RATE)) : round2(t.expectedAmount * PROFIT_RATE)), 0);

  // Agent Add Form State
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentMobile, setAgentMobile] = useState("");
  const [agentUsername, setAgentUsername] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [agentBank, setAgentBank] = useState("");
  const [agentAccount, setAgentAccount] = useState("");
  const [agentIFSC, setAgentIFSC] = useState("");
  const [agentUPI, setAgentUPI] = useState("");
  const [agentSaving, setAgentSaving] = useState(false);

  // My agents (district manager-ஓட agents மட்டும்)
  const myAgents = isAdmin
    ? agents
    : agents.filter(a => a.managerDistrict === district);

  const handleAddAgent = async () => {
    if (!agentName || !agentMobile || !agentUsername || !agentPassword) {
      alert("❌ Name, Mobile, Username, Password தேவை!"); return;
    }
    if (agents.some(a => a.username === agentUsername)) {
      alert("❌ இந்த Username ஏற்கனவே உள்ளது!"); return;
    }
    setAgentSaving(true);
    try {
      const hashedPwd = await hashPassword(agentPassword);
      const newAgent: Agent = {
        id: genId("AGT"),
        agentId: genAgentId(agents),
        username: agentUsername,
        password: hashedPwd,
        fullName: sanitizeInput(agentName),
        mobile: sanitizeInput(agentMobile),
        managerId: user?.id || "",
        managerName: user?.username || district,
        managerDistrict: district,
        commissionType: "auto",
        customCommissionPercent: 0,
        bankName: agentBank,
        accountNumber: agentAccount,
        ifscCode: agentIFSC,
        upiId: agentUPI,
        status: "pending",
        commissionBalance: 0,
        createdAt: new Date().toISOString(),
      };
      onAddAgent?.(newAgent);
      // Reset form
      setAgentName(""); setAgentMobile(""); setAgentUsername("");
      setAgentPassword(""); setAgentBank(""); setAgentAccount("");
      setAgentIFSC(""); setAgentUPI("");
      setShowAgentForm(false);
      alert("✅ Agent பதிவு செய்யப்பட்டது!\n\nAdmin approval-க்காக காத்திருக்கிறது.");
    } catch (e) {
      alert("❌ Error saving agent!");
    }
    setAgentSaving(false);
  };

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
        <div className="rounded-xl p-5 border-2" style={{ background: "#fff5f5", borderColor: "#fca5a5" }}>
          <h2 className="font-bold text-red-700 text-lg mb-3">
            🔴 Pending Admin Confirmation ({pendingClose.length})
          </h2>
          <div className="space-y-3">
            {pendingClose.map(t => {
              const profit = round2(t.expectedAmount * PROFIT_RATE);
              return (
                <div key={t.txnId} className="flex items-center justify-between bg-white p-4 rounded-lg border border-red-200 hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{t.vendorName} — {t.district}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {t.txnId} | Expected: {fmt(t.expectedAmount)} | 8% Profit: {fmt(profit)}
                    </p>
                  </div>
                  <button
                    onClick={() => onConfirmClose(t.txnId)}
                    className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:scale-105"
                    style={{ background: "#16a34a" }}
                  >
                    ✅ Confirm & Credit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Vendors</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#1a2f5e" }}>{vendors.length}</p>
          <p className="text-xs text-gray-400 mt-1">Active accounts</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Transactions</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#0369a1" }}>{transactions.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-green-600">Open: {openTxns}</span> |{" "}
            <span className="text-blue-600">Closed: {closedTxns}</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Total Expected</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#b45309" }}>{fmt(totalExpected)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Bills Received</p>
          <p className="text-3xl font-bold mt-2" style={{ color: "#15803d" }}>{fmt(totalBillsReceived)}</p>
          <p className="text-xs text-gray-400 mt-1">{bills.length} total bills</p>
        </div>
      </div>

      {/* Admin Stats Row 2 */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">Total GST Amount</p>
            <p className="text-3xl font-bold mt-2">{fmt(totalGST)}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">💰 Wallet Balance</p>
            <p className="text-3xl font-bold mt-2">{fmt(walletBalance)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">Total Profit</p>
            <p className="text-3xl font-bold mt-2">{fmt(totalProfit)}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg text-white">
            <p className="text-xs font-medium uppercase opacity-90">Active Districts</p>
            <p className="text-3xl font-bold mt-2">
              {new Set(transactions.map(t => t.district)).size}
            </p>
          </div>
        </div>
      )}

      {/* ── DISTRICT: My Agents Section ──────────────────────── */}
      {!isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">🤝 My Agents</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {myAgents.filter(a => a.status === "approved").length} active |{" "}
                {myAgents.filter(a => a.status === "pending").length} pending approval
              </p>
            </div>
            <button
              onClick={() => setShowAgentForm(!showAgentForm)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #7c3aed, #9f67f5)" }}
            >
              + New Agent
            </button>
          </div>

          {/* Agent Add Form */}
          {showAgentForm && (
            <div className="p-5 border-b border-gray-100 space-y-4" style={{ background: "#faf5ff" }}>
              <h3 className="font-bold text-purple-800">புதிய Agent பதிவு</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                  <input value={agentName} onChange={e => setAgentName(e.target.value)}
                    placeholder="முழு பெயர்"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mobile Number *</label>
                  <input value={agentMobile} onChange={e => setAgentMobile(e.target.value)}
                    placeholder="9876543210" maxLength={10}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Username * (login-க்கு)</label>
                  <input value={agentUsername} onChange={e => setAgentUsername(e.target.value)}
                    placeholder="agent_username"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Password *</label>
                  <input type="password" value={agentPassword} onChange={e => setAgentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Bank Name</label>
                  <input value={agentBank} onChange={e => setAgentBank(e.target.value)}
                    placeholder="SBI / Indian Bank"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Account Number</label>
                  <input value={agentAccount} onChange={e => setAgentAccount(e.target.value)}
                    placeholder="Account number"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">IFSC Code</label>
                  <input value={agentIFSC} onChange={e => setAgentIFSC(e.target.value)}
                    placeholder="SBIN0001234"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">UPI ID</label>
                  <input value={agentUPI} onChange={e => setAgentUPI(e.target.value)}
                    placeholder="name@upi"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-purple-400" />
                </div>
              </div>
              <div className="p-3 rounded-lg text-xs" style={{ background: "#ede9fe", border: "1px solid #c4b5fd" }}>
                <p className="text-purple-700">ℹ️ Agent submit செய்தால் Admin approval-க்காக போகும். Admin approve செய்த பின்னரே Agent login செய்யலாம்.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddAgent}
                  disabled={agentSaving}
                  className="px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "#7c3aed" }}
                >
                  {agentSaving ? "⏳ Saving..." : "💾 Submit for Approval"}
                </button>
                <button
                  onClick={() => setShowAgentForm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Agent List */}
          <div className="p-4">
            {myAgents.length === 0 ? (
              <p className="text-center py-6 text-gray-400 text-sm">
                இன்னும் agents இல்லை. "+ New Agent" click செய்யுங்கள்.
              </p>
            ) : (
              <div className="space-y-2">
                {myAgents.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{a.fullName}</p>
                      <p className="text-xs text-gray-500">{a.agentId} | {a.mobile}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold
                      ${a.status === "approved" ? "bg-green-100 text-green-700" :
                        a.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        a.status === "suspended" ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"}`}>
                      {a.status === "approved" ? "✅ Active" :
                       a.status === "pending" ? "⏳ Pending" :
                       a.status === "suspended" ? "⚠️ Suspended" : "❌ Rejected"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Recent Transactions</h2>
          <span className="text-xs text-gray-500">Last 10 entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                {["TXN ID","Vendor","District","Expected","Bills","Remaining","Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.slice(0, 10).map(t => (
                <tr key={t.txnId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{t.txnId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{t.vendorName}</p>
                    <p className="text-xs text-gray-400">{t.vendorCode}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.district}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(t.expectedAmount)}</td>
                  <td className="px-4 py-3 text-green-700">{fmt(t.billsReceived)}</td>
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

      {/* Wallet Summary (Admin) */}
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
                  {["Date","Description","Debit (−)","Credit (+)","Balance"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {wallet.slice(-5).reverse().map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{w.date}</td>
                    <td className="px-4 py-3 text-gray-800">{w.description}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{w.debit > 0 ? fmt(w.debit) : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{w.credit > 0 ? fmt(w.credit) : "—"}</td>
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
  isAdmin, district, vendors, allVendors, onAdd, onUpdate, onDelete
}: {
  isAdmin: boolean; district: string; vendors: Vendor[]; allVendors: Vendor[];
  onAdd: (v: Vendor) => void; onUpdate: (v: Vendor) => void; onDelete: (id: string) => void;
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
    return matchSearch &&
      (!filterDistrict || v.district === filterDistrict) &&
      (!filterBizType || v.businessType === filterBizType);
  });

  const autoCode = dist && bizType && regYear
    ? genVendorCode(dist, bizType, regYear, allVendors) : "";

  const handleAdd = () => {
    if (!name.trim() || !dist || !mobile) {
      alert("❌ Name, District, and Mobile are required!"); return;
    }
    onAdd({
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
    });
    setName(""); setMobile(""); setEmail(""); setAddress(""); setGstNo("");
    setDist(isAdmin ? "" : district); setShowForm(false);
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
          style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
        >
          + New Vendor
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">புதிய Vendor சேர்</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Vendor Name <span className="text-red-500">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Sri Balaji Hardwares" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Mobile Number <span className="text-red-500">*</span></label>
              <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" maxLength={10} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Business Type</label>
              <select value={bizType} onChange={e => setBizType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              {isAdmin ? (
                <>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">District <span className="text-red-500">*</span></label>
                  <select value={dist} onChange={e => setDist(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                    <option value="">Select District</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">District</label>
                  <input value={district} disabled className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500" />
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Registration Year</label>
              <input value={regYear} onChange={e => setRegYear(e.target.value)} placeholder="2025" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">GST Number</label>
              {/* BUG FIX: was e.target.value.toUpperCase — missing () */}
              <input value={gstNo} onChange={e => setGstNo(e.target.value.toUpperCase())} placeholder="33AAAAA0000A1Z5" maxLength={15} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-600 mb-1 block font-medium">Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop No, Street, City, Pincode" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          {autoCode && (
            <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <span className="text-sm text-blue-700 font-medium">🔑 Auto-Generated Code:</span>
              <span className="font-bold text-blue-900 font-mono text-lg">{autoCode}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleAdd} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "#16a34a" }}>💾 Save Vendor</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name, code, or mobile..." className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
          {isAdmin && (
            <>
              <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">All Districts</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterBizType} onChange={e => setFilterBizType(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
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
                {["Code","Vendor Name","Mobile","Business","District","GST No","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
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
                  <td className="px-4 py-3">
                    {v.businessType && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">{v.businessType}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{v.district}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.gstNo || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditVendor({...v})} className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200">✏️ Edit</button>
                      <button onClick={() => onDelete(v.id)} className="px-3 py-1.5 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">No vendors found</p>}
        </div>
      </div>

      {/* Edit Modal */}
      {editVendor && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit Vendor</h3>
              <button onClick={() => setEditVendor(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Vendor Name</label>
                <input value={editVendor.vendorName} onChange={e => setEditVendor({...editVendor, vendorName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Mobile</label>
                <input value={editVendor.mobile || ""} onChange={e => setEditVendor({...editVendor, mobile: e.target.value})} maxLength={10} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Email</label>
                <input type="email" value={editVendor.email || ""} onChange={e => setEditVendor({...editVendor, email: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Business Type</label>
                <select value={editVendor.businessType || ""} onChange={e => setEditVendor({...editVendor, businessType: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                {/* BUG FIX: was e.target.value.toUpperCase — missing () */}
                <label className="text-xs text-gray-600 mb-1 block font-medium">GST Number</label>
                <input value={editVendor.gstNo || ""} onChange={e => setEditVendor({...editVendor, gstNo: e.target.value.toUpperCase()})} maxLength={15} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Address</label>
                <input value={editVendor.address || ""} onChange={e => setEditVendor({...editVendor, address: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-3">
                <button onClick={() => { onUpdate(editVendor); setEditVendor(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: "#16a34a" }}>💾 Save Changes</button>
                <button onClick={() => setEditVendor(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
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
  isAdmin, district, transactions, vendors, bills,
  onAdd, onClose, onUpdate, onDelete
}: {
  isAdmin: boolean; district: string;
  transactions: Transaction[]; vendors: Vendor[]; bills: Bill[];
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
  const [statusFilter, setStatusFilter] = useState("");

  const myVendors = isAdmin ? vendors : vendors.filter(v => v.district === district);
  const filtered = transactions.filter(t => {
    const matchSearch =
      t.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      t.txnId.toLowerCase().includes(search.toLowerCase()) ||
      t.district.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!statusFilter || t.status === statusFilter);
  });

  const handleAdd = () => {
    const vendor = vendors.find(v => v.vendorCode === vendorCode);
    if (!vendor) { alert("❌ Please select a vendor!"); return; }
    if (!expectedAmt || parseFloat(expectedAmt) <= 0) { alert("❌ Please enter valid expected amount!"); return; }
    const expected = parseFloat(expectedAmt);
    const advance = parseFloat(advanceAmt) || 0;
    if (advance > expected * 0.2) { alert("⚠️ Advance cannot exceed 20% of expected amount!"); return; }
    const gstAmt = round2(expected * gstPct / 100);
    const gstBal = round2(gstAmt - advance);
    const txnId = genId("TXN");
    onAdd({
      id: genId("T"), txnId, district: vendor.district,
      vendorCode, vendorName: vendor.vendorName,
      financialYear: fy, month,
      expectedAmount: expected, advanceAmount: advance,
      gstPercent: gstPct, gstAmount: gstAmt, gstBalance: gstBal,
      billsReceived: 0, remainingExpected: expected,
      status: "Open", closedByDistrict: false, confirmedByAdmin: false, profit: 0
    }, advance);
    setVendorCode(""); setExpectedAmt(""); setAdvanceAmt(""); setShowForm(false);
  };

  const totalExpected      = filtered.reduce((s, t) => s + t.expectedAmount, 0);
  const totalGST           = filtered.reduce((s, t) => s + t.gstAmount, 0);
  const totalBillsReceived = filtered.reduce((s, t) => s + t.billsReceived, 0);
  const previewGST         = expectedAmt ? round2(parseFloat(expectedAmt) * gstPct / 100) : 0;
  const previewBalance     = previewGST - (parseFloat(advanceAmt) || 0);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Monthly Transactions</h1>
          <p className="text-sm text-gray-500">{filtered.length} transactions</p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>
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
              <label className="text-xs text-gray-600 mb-1 block font-medium">Vendor <span className="text-red-500">*</span></label>
              <select value={vendorCode} onChange={e => setVendorCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">Select Vendor</option>
                {myVendors.map(v => <option key={v.id} value={v.vendorCode}>{v.vendorName} ({v.vendorCode})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Financial Year</label>
              <select value={fy} onChange={e => setFy(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {FY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Month</label>
              <select value={month} onChange={e => setMonth(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Expected Amount (₹) <span className="text-red-500">*</span></label>
              <input type="number" value={expectedAmt} onChange={e => setExpectedAmt(e.target.value)} placeholder="300950" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Advance (GST Only) (₹)</label>
              <input type="number" value={advanceAmt} onChange={e => setAdvanceAmt(e.target.value)} placeholder="5000" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
              <select value={gstPct} onChange={e => setGstPct(parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          {expectedAmt && (
            <div className="p-4 rounded-lg text-sm space-y-2" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <p className="text-blue-700 font-medium">Preview Calculation:</p>
              <p className="text-blue-700">GST Amount: {fmt(parseFloat(expectedAmt))} × {gstPct}% = <strong>{fmt(previewGST)}</strong></p>
              <p className="text-blue-700">GST Balance: {fmt(previewGST)} − {fmt(parseFloat(advanceAmt) || 0)} = <strong>{fmt(previewBalance)}</strong></p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleAdd} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "#16a34a" }}>💾 Save Transaction</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by TXN ID, vendor name, or district..." className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
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
                {["TXN ID","Vendor","Month/FY","Expected","GST","Advance","Bills","Remaining","Status","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => {
                const txnBills = bills.filter(b => b.txnId === t.txnId);
                const canClose = t.remainingExpected <= 0 && t.status === "Open";
                return (
                  <tr key={t.txnId} className={`hover:bg-gray-50 transition-colors ${t.status === "PendingClose" ? "bg-red-50" : t.status === "Closed" ? "bg-green-50" : ""}`}>
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
                      <span className={`font-bold ${t.remainingExpected <= 0 ? "text-green-600" : "text-orange-600"}`}>
                        {t.remainingExpected <= 0 ? "₹0 ✅" : fmt(t.remainingExpected)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${t.status === "Closed" ? "bg-green-100 text-green-700" : t.status === "PendingClose" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {t.status === "PendingClose" ? "🔴 Pending" : t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {t.status === "Open" && (
                          <button onClick={() => setEditTxn({...t})} className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200">✏️</button>
                        )}
                        <button onClick={() => onDelete(t.txnId)} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">🗑️</button>
                        {!isAdmin && t.status === "Open" && (
                          <button
                            onClick={() => setConfirmClose(t.txnId)}
                            className={`px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap ${canClose ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 hover:bg-gray-500"}`}
                          >
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
                  <td colSpan={3} className="px-3 py-3 font-bold text-yellow-300 text-xs">மொத்தம் ({filtered.length} transactions)</td>
                  <td className="px-3 py-3 font-bold text-yellow-300">{fmt(totalExpected)}</td>
                  <td className="px-3 py-3 font-bold text-purple-300">{fmt(totalGST)}</td>
                  <td colSpan={2} className="px-3 py-3 font-bold text-green-300">{fmt(totalBillsReceived)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">No transactions found</p>}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editTxn && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit Transaction</h3>
              <button onClick={() => setEditTxn(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Expected Amount (₹)</label>
                  <input type="number" value={editTxn.expectedAmount} onChange={e => setEditTxn({...editTxn, expectedAmount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Advance (₹)</label>
                  <input type="number" value={editTxn.advanceAmount} onChange={e => setEditTxn({...editTxn, advanceAmount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
                  <select value={editTxn.gstPercent} onChange={e => setEditTxn({...editTxn, gstPercent: parseFloat(e.target.value)})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Month</label>
                  <select value={editTxn.month} onChange={e => setEditTxn({...editTxn, month: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => {
                    const gstAmt = round2(editTxn.expectedAmount * editTxn.gstPercent / 100);
                    const gstBal = round2(gstAmt - editTxn.advanceAmount);
                    onUpdate({ ...editTxn, gstAmount: gstAmt, gstBalance: gstBal });
                    setEditTxn(null);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white"
                  style={{ background: "#16a34a" }}
                >
                  💾 Save Changes
                </button>
                <button onClick={() => setEditTxn(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirm Modal */}
      {confirmClose && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
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
              <button onClick={() => { onClose(confirmClose); setConfirmClose(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: "#dc2626" }}>✅ Close Confirm</button>
              <button onClick={() => setConfirmClose(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END OF PART 3
// Next: PART 4 — BillsPage (Bulk Add), WalletPage,
//               AnalyticsPage, ReportsPage, UserManagementPage,
//               AuditLogsPage, SettingsPage
// ============================================================
// ============================================================
// APP.TSX — PART 4 of 4
// BillsPage (with Bulk Add), WalletPage, AnalyticsPage,
// ReportsPage, UserManagementPage, AuditLogsPage, SettingsPage
// Paste this AFTER Part 3
// ============================================================

// ============================================================
// BILLS PAGE — NEW: Bulk Add feature added
// ============================================================
function BillsPage({
  isAdmin, district, bills, transactions, vendors,
  onAdd, onBulkAdd, onUpdate, onDelete
}: {
  isAdmin: boolean; district: string;
  bills: Bill[]; transactions: Transaction[]; vendors: Vendor[];
  onAdd: (b: Bill) => void;
  onBulkAdd: (bills: Bill[]) => void;
  onUpdate: (b: Bill) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [txnId, setTxnId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [billAmt, setBillAmt] = useState("");
  const [gstPct, setGstPct] = useState(4);
  const [search, setSearch] = useState("");

  // Bulk Add state
  const [bulkTxnId, setBulkTxnId] = useState("");
  const [bulkRows, setBulkRows] = useState([
    { billNo: "", billDate: new Date().toISOString().split("T")[0], billAmt: "", gstPct: 4 }
  ]);

  const myTxns  = isAdmin ? transactions : transactions.filter(t => t.district === district);
  const openTxns = myTxns.filter(t => t.status === "Open");
  const filtered = bills.filter(b =>
    b.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.txnId.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!txnId || !billAmt || !billNo) { alert("❌ Please fill all required fields!"); return; }
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) { alert("❌ Transaction not found!"); return; }
    if (parseFloat(billAmt) <= 0) { alert("❌ Bill amount must be positive!"); return; }
    const amt = parseFloat(billAmt);
    onAdd({
      id: genId("B"), txnId,
      vendorCode: txn.vendorCode, vendorName: txn.vendorName, district: txn.district,
      billNumber: sanitizeInput(billNo), billDate,
      billAmount: amt, gstPercent: gstPct,
      gstAmount: round2(amt * gstPct / 100),
      totalAmount: round2(amt * BILL_TOTAL_RATE)
    });
    setBillNo(""); setBillAmt(""); setShowForm(false);
  };

  // ── Bulk Add handlers ──────────────────────────────────────
  const addBulkRow = () => setBulkRows(prev => [
    ...prev, { billNo: "", billDate: new Date().toISOString().split("T")[0], billAmt: "", gstPct: 4 }
  ]);

  const removeBulkRow = (i: number) =>
    setBulkRows(prev => prev.filter((_, idx) => idx !== i));

  const updateBulkRow = (i: number, field: string, value: string | number) =>
    setBulkRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleBulkAdd = () => {
    if (!bulkTxnId) { alert("❌ Please select a transaction!"); return; }
    const txn = transactions.find(t => t.txnId === bulkTxnId);
    if (!txn) { alert("❌ Transaction not found!"); return; }
    const validRows = bulkRows.filter(r => r.billNo.trim() && parseFloat(r.billAmt) > 0);
    if (validRows.length === 0) { alert("❌ Please enter at least one valid bill!"); return; }
    const newBills: Bill[] = validRows.map(r => {
      const amt = parseFloat(r.billAmt);
      return {
        id: genId("B"), txnId: bulkTxnId,
        vendorCode: txn.vendorCode, vendorName: txn.vendorName, district: txn.district,
        billNumber: sanitizeInput(r.billNo), billDate: r.billDate,
        billAmount: amt, gstPercent: r.gstPct,
        gstAmount: round2(amt * r.gstPct / 100),
        totalAmount: round2(amt * BILL_TOTAL_RATE),
        createdAt: new Date().toISOString()
      };
    });
    onBulkAdd(newBills);
    setBulkTxnId("");
    setBulkRows([{ billNo: "", billDate: new Date().toISOString().split("T")[0], billAmt: "", gstPct: 4 }]);
    setShowBulkForm(false);
    alert(`✅ ${newBills.length} bills added successfully!`);
  };

  const bulkPreviewTotal = bulkRows.reduce((s, r) => s + (parseFloat(r.billAmt) || 0), 0);
  const previewBillAmt   = parseFloat(billAmt) || 0;
  const previewGST       = round2(previewBillAmt * gstPct / 100);
  const previewTotal     = round2(previewBillAmt * BILL_TOTAL_RATE);
  const totalBillAmt     = filtered.reduce((s, b) => s + b.billAmount, 0);
  const totalGST         = filtered.reduce((s, b) => s + b.gstAmount, 0);
  const totalAmt         = filtered.reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🧾 Bill Management</h1>
          <p className="text-sm text-gray-500">GST = Bill×GST% | Total = Bill×1.18</p>
        </div>
        {!isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowBulkForm(!showBulkForm); setShowForm(false); }}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}
            >
              📦 Bulk Add
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setShowBulkForm(false); }}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}
            >
              + New Bill
            </button>
          </div>
        )}
      </div>

      {/* Single Bill Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">🧾 புதிய GST Bill சேர்</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Transaction (TXN) <span className="text-red-500">*</span></label>
              <select value={txnId} onChange={e => setTxnId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">Select Transaction</option>
                {openTxns.map(t => <option key={t.txnId} value={t.txnId}>{t.txnId} — {t.vendorName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Number <span className="text-red-500">*</span></label>
              <input value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="ALB/2026/001" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} max={new Date().toISOString().split("T")[0]} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Amount (Taxable ₹) <span className="text-red-500">*</span></label>
              <input type="number" value={billAmt} onChange={e => setBillAmt(e.target.value)} placeholder="76664" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
              <select value={gstPct} onChange={e => setGstPct(parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          {billAmt && (
            <div className="p-4 rounded-lg text-sm space-y-2" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
              <p className="text-blue-700 font-medium">Preview Calculation:</p>
              <p className="text-blue-700">GST தொகை: {fmt(previewBillAmt)} × {gstPct}% = <strong>{fmt(previewGST)}</strong></p>
              <p className="text-blue-700">Total Amount: {fmt(previewBillAmt)} × 18% = <strong>{fmt(previewTotal)}</strong></p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleAdd} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "#16a34a" }}>💾 Save Bill</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* ── BULK ADD FORM ── */}
      {showBulkForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-purple-200 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-gray-800 text-lg">📦 Bulk Bill Entry</h2>
            <span className="text-xs text-purple-700 bg-purple-50 px-3 py-1 rounded-full font-semibold border border-purple-200">
              ஒரே நேரத்தில் பல bills சேர்க்கலாம்
            </span>
          </div>

          {/* Transaction selector */}
          <div>
            <label className="text-xs text-gray-600 mb-1 block font-medium">Transaction <span className="text-red-500">*</span></label>
            <select
              value={bulkTxnId}
              onChange={e => setBulkTxnId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500"
            >
              <option value="">Select Transaction</option>
              {openTxns.map(t => (
                <option key={t.txnId} value={t.txnId}>
                  {t.txnId} — {t.vendorName} ({t.month} {t.financialYear})
                </option>
              ))}
            </select>
          </div>

          {/* Bills table */}
          <div className="overflow-x-auto rounded-lg border border-purple-100">
            <table className="w-full text-sm">
              <thead style={{ background: "#7c3aed" }}>
                <tr>
                  {["#", "Bill Number", "Bill Date", "Bill Amount (₹)", "GST %", "Preview Total", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-white whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {bulkRows.map((row, i) => (
                  <tr key={i} className="bg-white hover:bg-purple-50 transition-colors">
                    <td className="px-3 py-2 text-gray-400 text-xs font-bold">{i + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        value={row.billNo}
                        onChange={e => updateBulkRow(i, "billNo", e.target.value)}
                        placeholder="ALB/2026/001"
                        className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:border-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.billDate}
                        onChange={e => updateBulkRow(i, "billDate", e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:border-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.billAmt}
                        onChange={e => updateBulkRow(i, "billAmt", e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:border-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.gstPct}
                        onChange={e => updateBulkRow(i, "gstPct", parseFloat(e.target.value))}
                        className="px-2 py-1.5 rounded border border-gray-300 text-sm outline-none focus:border-purple-500"
                      >
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 font-semibold text-green-700 text-xs whitespace-nowrap">
                      {row.billAmt ? fmt(round2(parseFloat(row.billAmt) * BILL_TOTAL_RATE)) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {bulkRows.length > 1 && (
                        <button onClick={() => removeBulkRow(i)} className="text-red-400 hover:text-red-600 text-xl font-bold leading-none">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f3e8ff" }}>
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-bold text-purple-800 text-xs">
                    மொத்த Bill Amount ({bulkRows.filter(r => r.billNo && r.billAmt).length} valid rows)
                  </td>
                  <td className="px-3 py-2 font-bold text-purple-800">{fmt(bulkPreviewTotal)}</td>
                  <td></td>
                  <td className="px-3 py-2 font-bold text-green-700">{fmt(round2(bulkPreviewTotal * BILL_TOTAL_RATE))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={addBulkRow} className="px-4 py-2 rounded-lg text-sm font-semibold text-purple-700 border-2 border-purple-300 hover:bg-purple-50 transition-colors">
              + Row சேர்
            </button>
            <button
              onClick={handleBulkAdd}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}
            >
              💾 {bulkRows.filter(r => r.billNo && r.billAmt).length} Bills Save செய்
            </button>
            <button onClick={() => setShowBulkForm(false)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Search bills by vendor, bill number, or TXN ID..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-blue-500 bg-white"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 uppercase font-medium">Total Bill Amount</p><p className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalBillAmt)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 uppercase font-medium">Total GST</p><p className="text-2xl font-bold text-purple-700 mt-1">{fmt(totalGST)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 uppercase font-medium">Total Amount</p><p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalAmt)}</p></div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Bill ID","TXN ID","Vendor","Bill Number","Date","Bill Amt","GST%","GST தொகை","Total","Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>
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
                      <button onClick={() => setEditBill({...b})} className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200">✏️</button>
                      <button onClick={() => onDelete(b.id)} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ background: "#1a2f5e" }}>
                <tr>
                  <td colSpan={5} className="px-3 py-3 font-bold text-yellow-300 text-xs">மொத்தம் ({filtered.length} bills)</td>
                  <td className="px-3 py-3 font-bold text-yellow-300">{fmt(totalBillAmt)}</td>
                  <td></td>
                  <td className="px-3 py-3 font-bold text-purple-300">{fmt(totalGST)}</td>
                  <td className="px-3 py-3 font-bold text-green-300">{fmt(totalAmt)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">No bills found</p>}
        </div>
      </div>

      {/* Edit Bill Modal */}
      {editBill && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">✏️ Edit Bill</h3>
              <button onClick={() => setEditBill(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Number</label>
                <input value={editBill.billNumber} onChange={e => setEditBill({...editBill, billNumber: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Date</label>
                <input type="date" value={editBill.billDate} onChange={e => setEditBill({...editBill, billDate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Bill Amount (₹)</label>
                <input type="number" value={editBill.billAmount} onChange={e => setEditBill({...editBill, billAmount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">GST %</label>
                <select value={editBill.gstPercent} onChange={e => setEditBill({...editBill, gstPercent: parseFloat(e.target.value)})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="p-3 rounded-lg text-xs space-y-1 bg-blue-50 border border-blue-200">
                <p className="font-bold text-blue-800">🔒 Calculated Values (Auto)</p>
                <p className="text-blue-700">GST: {fmt(editBill.billAmount)} × {editBill.gstPercent}% = <strong>{fmt(round2(editBill.billAmount * editBill.gstPercent / 100))}</strong></p>
                <p className="text-blue-700">Total: {fmt(editBill.billAmount)} × 18% = <strong>{fmt(round2(editBill.billAmount * BILL_TOTAL_RATE))}</strong></p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    const gstAmt = round2(editBill.billAmount * editBill.gstPercent / 100);
                    const total  = round2(editBill.billAmount * BILL_TOTAL_RATE);
                    onUpdate({ ...editBill, gstAmount: gstAmt, totalAmount: total });
                    setEditBill(null);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white"
                  style={{ background: "#16a34a" }}
                >
                  💾 Save Changes
                </button>
                <button onClick={() => setEditBill(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
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
  wallet, balance, onManualEntry, onSetBalance
}: {
  wallet: WalletEntry[]; balance: number;
  onManualEntry: (desc: string, debit: number, credit: number) => void;
  onSetBalance: (n: number) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [editMode, setEditMode] = useState<"set" | "manual">("set");
  const [newBal, setNewBal] = useState("");
  const [desc, setDesc] = useState(""); const [debit, setDebit] = useState(""); const [credit, setCredit] = useState("");
  const [search, setSearch] = useState(""); const [typeFilter, setTypeFilter] = useState("");

  const totalDebit   = wallet.reduce((s, w) => s + w.debit, 0);
  const totalCredit  = wallet.reduce((s, w) => s + w.credit, 0);
  const totalProfit  = wallet.filter(w => w.type === "profit").reduce((s, w) => s + w.credit, 0);
  const totalAdvance = wallet.filter(w => w.type === "advance").reduce((s, w) => s + w.debit, 0);
  const totalGST     = wallet.filter(w => w.type === "gst").reduce((s, w) => s + w.debit, 0);

  const filtered = wallet.filter(w =>
    w.description.toLowerCase().includes(search.toLowerCase()) &&
    (!typeFilter || w.type === typeFilter)
  );

  const typeBadge = (t: WalletEntry["type"]) => {
    switch(t) {
      case "profit":  return "bg-green-100 text-green-700";
      case "advance": return "bg-orange-100 text-orange-700";
      case "gst":     return "bg-red-100 text-red-700";
      default:        return "bg-gray-100 text-gray-700";
    }
  };

  const exportCSV = () => {
    const headers = ["Date","Description","Type","Debit","Credit","Balance"];
    const rows = wallet.map(w => [w.date, w.description, w.type, w.debit, w.credit, w.balance]);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💰 Admin Main Wallet</h1>
          <p className="text-sm text-gray-500">Central finance management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">📥 Export CSV</button>
          <button onClick={() => setShowEdit(!showEdit)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}>✏️ Wallet Edit</button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="rounded-xl p-6 text-white" style={{ background: "linear-gradient(135deg, #0a1628, #1a2f5e)" }}>
        <p className="text-sm text-gray-300">Current Wallet Balance</p>
        <p className="text-5xl font-bold mt-2" style={{ color: "#f0d060" }}>{fmt(balance)}</p>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
          <div><p className="text-xs text-gray-400">Total Invested</p><p className="font-bold text-xl text-white mt-1">{fmt(totalCredit)}</p></div>
          <div><p className="text-xs text-gray-400">Total Debited</p><p className="font-bold text-xl text-red-300 mt-1">{fmt(totalDebit)}</p></div>
          <div><p className="text-xs text-gray-400">Total Profit</p><p className="font-bold text-xl text-green-300 mt-1">{fmt(totalProfit)}</p></div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">Advance Paid</p><p className="text-2xl font-bold text-orange-600 mt-2">{fmt(totalAdvance)}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">GST Settled</p><p className="text-2xl font-bold text-red-600 mt-2">{fmt(totalGST)}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">8% Profit Earned</p><p className="text-2xl font-bold text-green-600 mt-2">{fmt(totalProfit)}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">Net Transactions</p><p className="text-2xl font-bold text-blue-600 mt-2">{wallet.length}</p></div>
      </div>

      {/* Edit Panel */}
      {showEdit && (
        <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-amber-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">✏️ Wallet Edit / Manual Entry</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditMode("set")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${editMode === "set" ? "text-white" : "text-gray-600 border-2 border-gray-300"}`} style={editMode === "set" ? { background: "#1a2f5e" } : {}}>🏦 Balance மாற்று</button>
            <button onClick={() => setEditMode("manual")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${editMode === "manual" ? "text-white" : "text-gray-600 border-2 border-gray-300"}`} style={editMode === "manual" ? { background: "#1a2f5e" } : {}}>➕ Manual Entry</button>
          </div>
          {editMode === "set" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Current Balance: <strong className="text-xl">{fmt(balance)}</strong></p>
              <input type="number" value={newBal} onChange={e => setNewBal(e.target.value)} placeholder="New balance amount" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              <button onClick={() => { if (newBal) { onSetBalance(parseFloat(newBal)); setNewBal(""); setShowEdit(false); } }} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "#16a34a" }}>Update Balance</button>
            </div>
          ) : (
            <div className="space-y-3">
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (e.g., Office expense)" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={debit} onChange={e => setDebit(e.target.value)} placeholder="Debit Amount (−)" className="w-full px-4 py-2.5 rounded-lg border-2 border-red-200 text-sm outline-none focus:border-red-400" />
                <input type="number" value={credit} onChange={e => setCredit(e.target.value)} placeholder="Credit Amount (+)" className="w-full px-4 py-2.5 rounded-lg border-2 border-green-200 text-sm outline-none focus:border-green-400" />
              </div>
              <button onClick={() => { if (desc) { onManualEntry(desc, parseFloat(debit) || 0, parseFloat(credit) || 0); setDesc(""); setDebit(""); setCredit(""); setShowEdit(false); } }} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "#16a34a" }}>Add Entry</button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by description..." className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Types</option>
            <option value="profit">Profit</option>
            <option value="advance">Advance</option>
            <option value="gst">GST</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-gray-800">📒 Wallet Ledger</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>
                {["Date","Description","Type","Debit (−)","Credit (+)","Balance"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...filtered].reverse().map(w => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">{w.date}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{w.description}</p>
                    {w.createdBy && <p className="text-xs text-gray-400 mt-1">By: {w.createdBy}</p>}
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeBadge(w.type)}`}>{w.type}</span></td>
                  <td className="px-4 py-3 font-semibold text-red-600">{w.debit > 0 ? fmt(w.debit) : "—"}</td>
                  <td className="px-4 py-3 font-semibold text-green-600">{w.credit > 0 ? fmt(w.credit) : "—"}</td>
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
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">No wallet entries found</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ANALYTICS PAGE
// ============================================================
function AnalyticsPage({
  transactions, bills, vendors, wallet
}: {
  transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; wallet: WalletEntry[];
}) {
  const totalExpected  = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsAmt  = bills.reduce((s, b) => s + b.billAmount, 0);
  const totalGST       = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const totalProfit    = transactions.filter(t => t.status === "Closed").reduce((s, t) => s + (t.profit > 0 ? t.profit : round2(t.expectedAmount * PROFIT_RATE)), 0);
  const walletBalance  = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;

  const districtSummary = DISTRICTS.map(d => {
    const dT = transactions.filter(t => t.district === d);
    const dB = bills.filter(b => b.district === d);
    return {
      district: d, txnCount: dT.length,
      expected: dT.reduce((s, t) => s + t.expectedAmount, 0),
      gst: dT.reduce((s, t) => s + t.gstAmount, 0),
      bills: dB.reduce((s, b) => s + b.billAmount, 0),
      profit: dT.filter(t => t.status === "Closed").reduce((s, t) => s + (t.profit > 0 ? t.profit : round2(t.expectedAmount * PROFIT_RATE)), 0),
      closed: dT.filter(t => t.status === "Closed").length,
    };
  }).filter(d => d.txnCount > 0).sort((a, b) => b.expected - a.expected);

  const monthSummary = MONTHS.map(month => {
    const mT = transactions.filter(t => t.month === month);
    return { month, txnCount: mT.length, expected: mT.reduce((s, t) => s + t.expectedAmount, 0) };
  }).filter(m => m.txnCount > 0);

  const exportCSV = () => {
    const headers = ["District","Transactions","Expected","GST","Bills","Profit","Closed"];
    const rows = districtSummary.map(d => [d.district, d.txnCount, d.expected, d.gst, d.bills, d.profit, `${d.closed}/${d.txnCount}`]);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Master financial overview — All districts</p>
        </div>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">📥 Export District Report</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Expected",    value: fmt(totalExpected),  color: "#1a2f5e" },
          { label: "Bills Received",    value: fmt(totalBillsAmt),  color: "#15803d" },
          { label: "Total GST",         value: fmt(totalGST),       color: "#7c3aed" },
          { label: "8% Profit Earned",  value: fmt(totalProfit),    color: "#b45309" },
          { label: "Wallet Balance",    value: fmt(walletBalance),  color: "#c9a227" },
          { label: "Total Vendors",     value: vendors.length.toString(), color: "#374151" },
          { label: "Total Transactions",value: transactions.length.toString(), color: "#0369a1" },
          { label: "Total Bills",       value: bills.length.toString(), color: "#dc2626" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-500 uppercase font-medium">{stat.label}</p>
            <p className="text-2xl font-bold mt-2" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {monthSummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-gray-800">📆 Monthly Trend</h2></div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-40">
              {monthSummary.map(m => {
                const maxE = Math.max(...monthSummary.map(x => x.expected));
                const h = maxE > 0 ? (m.expected / maxE * 100) : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg transition-all hover:opacity-80"
                      style={{ height: `${h}%`, background: "linear-gradient(180deg, #1a2f5e, #2a4f9e)", minHeight: "10px" }}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-gray-800">🏛️ District-wise Summary</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>{["#","District","Txns","Expected ₹","GST Amt","Bills ₹","Profit","Closed"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {districtSummary.map((d, i) => (
                <tr key={d.district} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-bold">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">🏛️ {d.district}</td>
                  <td className="px-4 py-3 text-center"><span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{d.txnCount}</span></td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{fmt(d.expected)}</td>
                  <td className="px-4 py-3 text-purple-700 font-semibold">{fmt(d.gst)}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">{fmt(d.bills)}</td>
                  <td className="px-4 py-3 text-amber-600 font-semibold">{d.profit > 0 ? fmt(d.profit) : "—"}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold ${d.closed > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{d.closed}/{d.txnCount}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {districtSummary.length === 0 && <p className="text-center py-12 text-gray-400">No district data</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORTS PAGE (District Users)
// ============================================================
function ReportsPage({
  transactions, bills, vendors, district
}: {
  transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; district: string;
}) {
  const totalExpected  = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalBillsAmt  = transactions.reduce((s, t) => s + t.billsReceived, 0);
  const openTxns       = transactions.filter(t => t.status === "Open").length;
  const closedTxns     = transactions.filter(t => t.status === "Closed").length;
  const pendingTxns    = transactions.filter(t => t.status === "PendingClose").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📄 {district} — Reports</h1>
        <p className="text-sm text-gray-500">District performance overview</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"><p className="text-xs text-gray-500 uppercase">Total Vendors</p><p className="text-3xl font-bold mt-2" style={{ color: "#1a2f5e" }}>{vendors.length}</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"><p className="text-xs text-gray-500 uppercase">Transactions</p><p className="text-3xl font-bold mt-2" style={{ color: "#0369a1" }}>{transactions.length}</p><p className="text-xs text-gray-400 mt-1">Open: {openTxns} | Pending: {pendingTxns} | Closed: {closedTxns}</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"><p className="text-xs text-gray-500 uppercase">Total Expected</p><p className="text-3xl font-bold mt-2" style={{ color: "#b45309" }}>{fmt(totalExpected)}</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"><p className="text-xs text-gray-500 uppercase">Bills Received</p><p className="text-3xl font-bold mt-2" style={{ color: "#15803d" }}>{fmt(totalBillsAmt)}</p></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-gray-800">📆 Monthly Summary</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#f8fafc" }}>
              <tr>{["Month","Transactions","Expected","Bills Received","Remaining"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MONTHS.map(month => {
                const mT = transactions.filter(t => t.month === month);
                if (mT.length === 0) return null;
                const expected  = mT.reduce((s, t) => s + t.expectedAmount, 0);
                const billsAmt  = mT.reduce((s, t) => s + t.billsReceived, 0);
                const remaining = mT.reduce((s, t) => s + t.remainingExpected, 0);
                return (
                  <tr key={month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{month}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{mT.length}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(expected)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(billsAmt)}</td>
                    <td className="px-4 py-3"><span className={`font-semibold ${remaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>{remaining <= 0 ? '₹0 ✅' : fmt(remaining)}</span></td>
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
  districtUsers, onAddUser, onUpdateUser, onToggleUser, onDeleteUser
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
  const [uname, setUname] = useState(""); const [pass, setPass] = useState(""); const [dist, setDist] = useState("");
  const [search, setSearch] = useState("");

  const filtered = districtUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.district.toLowerCase().includes(search.toLowerCase())
  );

  const toggleShowPass = (id: string) =>
    setShowPassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAdd = () => {
    if (!uname || !pass || !dist) { alert("❌ Please fill all fields!"); return; }
    if (districtUsers.some(u => u.username === uname)) { alert("❌ Username already exists!"); return; }
    onAddUser({
      id: genId("U"), username: sanitizeInput(uname), password: pass,
      district: dist, active: true, createdAt: new Date().toISOString().split("T")[0]
    });
    setUname(""); setPass(""); setDist(""); setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">👥 User Management</h1><p className="text-sm text-gray-500">District user accounts</p></div>
        <button onClick={() => setShowForm(!showForm)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #1a2f5e, #2a4f9e)" }}>+ New User</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">Total Districts</p><p className="text-2xl font-bold text-blue-600 mt-2">{DISTRICTS.length}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">Active Users</p><p className="text-2xl font-bold text-green-600 mt-2">{districtUsers.filter(u => u.active).length}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">Inactive Users</p><p className="text-2xl font-bold text-red-600 mt-2">{districtUsers.filter(u => !u.active).length}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 uppercase">Total Users</p><p className="text-2xl font-bold text-gray-800 mt-2">{districtUsers.length}</p></div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">புதிய User சேர்</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">District <span className="text-red-500">*</span></label>
              <select value={dist} onChange={e => setDist(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
                <option value="">Select District</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Username <span className="text-red-500">*</span></label>
              <input value={uname} onChange={e => setUname(e.target.value.toLowerCase())} placeholder="district_user" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block font-medium">Password <span className="text-red-500">*</span></label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Strong password" autoComplete="new-password" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "#16a34a" }}>Create User</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
          </div>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search users..." className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus:border-blue-500 bg-white" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>{["#","Username","District","Password","Status","Created","Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u, i) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "bg-red-50/50" : ""}`}>
                  <td className="px-4 py-3 text-gray-400 text-xs font-bold">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-blue-700">{u.username}</td>
                  <td className="px-4 py-3 text-gray-700">🏛️ {u.district}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{showPassIds.includes(u.id) ? u.password : "••••••••"}</span>
                      <button onClick={() => toggleShowPass(u.id)} className="text-xs text-gray-400 hover:text-gray-600">{showPassIds.includes(u.id) ? "🙈" : "👁️"}</button>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.active ? "✅ Active" : "❌ Inactive"}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditUser({...u})} className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200">✏️</button>
                      <button onClick={() => onToggleUser(u.id)} className={`px-2 py-1 rounded text-xs font-semibold text-white ${u.active ? "bg-orange-500" : "bg-green-500"}`}>{u.active ? "🔴" : "🟢"}</button>
                      <button onClick={() => onDeleteUser(u.id)} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">No users found</p>}
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800 text-lg">✏️ Edit User</h3><button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-600 mb-1 block font-medium">Username</label><input value={editUser.username} onChange={e => setEditUser({...editUser, username: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-gray-600 mb-1 block font-medium">New Password</label><input type="text" value={editUser.password} onChange={e => setEditUser({...editUser, password: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" /></div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">District</label>
                <select value={editUser.district} onChange={e => setEditUser({...editUser, district: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-3">
                <button onClick={() => { onUpdateUser(editUser); setEditUser(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: "#16a34a" }}>💾 Save Changes</button>
                <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
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
  const [search, setSearch] = useState(""); const [actionFilter, setActionFilter] = useState(""); const [entityFilter, setEntityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const filtered = logs.filter(log => {
    const matchSearch = log.user.toLowerCase().includes(search.toLowerCase()) || log.entityId.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!actionFilter || log.action === actionFilter) && (!entityFilter || log.entity === entityFilter);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = [...filtered].reverse().slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const actionBadge = (action: AuditLog['action']) => {
    switch(action) {
      case "CREATE":  return "bg-green-100 text-green-700";
      case "UPDATE":  return "bg-blue-100 text-blue-700";
      case "DELETE":  return "bg-red-100 text-red-700";
      case "CLOSE":   return "bg-orange-100 text-orange-700";
      case "CONFIRM": return "bg-purple-100 text-purple-700";
      case "LOGIN":   return "bg-cyan-100 text-cyan-700";
      default:        return "bg-gray-100 text-gray-700";
    }
  };

  const entityIcon = (entity: AuditLog['entity']) => {
    switch(entity) {
      case "Transaction": return "📋"; case "Vendor": return "🏢";
      case "Bill": return "🧾"; case "Wallet": return "💰";
      case "User": return "👤"; default: return "📄";
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold text-gray-800">📜 Audit Logs</h1><p className="text-sm text-gray-500">Complete activity trail — {filtered.length} entries</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Actions", value: logs.length, color: "#1a2f5e" },
          { label: "Creates",       value: logs.filter(l => l.action === "CREATE").length, color: "#16a34a" },
          { label: "Updates",       value: logs.filter(l => l.action === "UPDATE").length, color: "#0369a1" },
          { label: "Deletes",       value: logs.filter(l => l.action === "DELETE").length, color: "#dc2626" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-medium">{stat.label}</p>
            <p className="text-2xl font-bold mt-2" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by user or entity ID..." className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Actions</option>
            {["CREATE","UPDATE","DELETE","CLOSE","CONFIRM","LOGIN","LOGOUT"].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500">
            <option value="">All Entities</option>
            {["Transaction","Vendor","Bill","Wallet","User"].map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0a1628" }}>
              <tr>{["Timestamp","User","Action","Entity","Entity ID"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{log.user}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${actionBadge(log.action)}`}>{log.action}</span></td>
                  <td className="px-4 py-3 text-gray-700">{entityIcon(log.entity)} {log.entity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{log.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginated.length === 0 && <p className="text-center py-12 text-gray-400">No audit logs found</p>}
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">← Prev</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 rounded text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">Next →</button>
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
// ============================================================
// AGENT FEATURE — PART 3 of 5
// AdminAgentsPage — புதிய Component
//
// 📌 எங்கே paste செய்வது:
//    App.tsx PART 4-ல் SettingsPage function-க்கு முன்னால்
//    இந்த முழு component-ஐ paste செய்யவும்
// ============================================================

function AdminAgentsPage({
  agents, agentWallet, agentOverrides, commissionSlabs,
  transactions, vendors, bills,
  onApprove, onReject, onSuspend, onDelete,
  onSetCommission, onAddOverride, onDeleteOverride,
  onUpdateSlabs
}: {
  agents: Agent[];
  agentWallet: AgentWalletEntry[];
  agentOverrides: AgentVendorOverride[];
  commissionSlabs: CommissionSlab[];
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  onApprove: (agentId: string, commissionType: "auto" | "custom", customPct: number) => void;
  onReject: (agentId: string) => void;
  onSuspend: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onSetCommission: (agentId: string, type: "auto" | "custom", pct: number) => void;
  onAddOverride: (override: AgentVendorOverride) => void;
  onDeleteOverride: (id: string) => void;
  onUpdateSlabs: (slabs: CommissionSlab[]) => void;
}) {
  const [tab, setTab] = useState<"list" | "pending" | "slabs">("list");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "txns" | "wallet" | "overrides">("overview");

  // Approve modal state
  const [approveAgentId, setApproveAgentId] = useState<string | null>(null);
  const [approveType, setApproveType] = useState<"auto" | "custom">("auto");
  const [approvePct, setApprovePct] = useState("1");

  // Override modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideVendorCode, setOverrideVendorCode] = useState("");
  const [overridePct, setOverridePct] = useState("1");

  // Commission edit modal
  const [editCommAgent, setEditCommAgent] = useState<Agent | null>(null);
  const [editCommType, setEditCommType] = useState<"auto" | "custom">("auto");
  const [editCommPct, setEditCommPct] = useState("1");

  // Slab editor state
  const [editSlabs, setEditSlabs] = useState<CommissionSlab[]>([...commissionSlabs]);

  const pending  = agents.filter(a => a.status === "pending");
  const approved = agents.filter(a => a.status === "approved");

  const getAgentStats = (agent: Agent) => {
    const agentTxns = transactions.filter(t => t.createdByAgent === agent.agentId);
    const agentBills = bills.filter(b => agentTxns.some(t => t.txnId === b.txnId));
    const agentVendors = [...new Set(agentTxns.map(t => t.vendorCode))];
    const walletEntries = agentWallet.filter(w => w.agentId === agent.id);
    const totalCommission = walletEntries.reduce((s, w) => s + w.commissionAmount, 0);
    return {
      txnCount: agentTxns.length,
      billCount: agentBills.length,
      vendorCount: agentVendors.length,
      totalTxnAmt: agentTxns.reduce((s, t) => s + t.expectedAmount, 0),
      totalCommission: round2(totalCommission),
      walletBalance: agent.commissionBalance
    };
  };

  // ── Selected Agent Detail View ────────────────────────────
  if (selectedAgent) {
    const stats = getAgentStats(selectedAgent);
    const agentTxns = transactions.filter(t => t.createdByAgent === selectedAgent.agentId);
    const walletEntries = agentWallet.filter(w => w.agentId === selectedAgent.id);
    const myOverrides = agentOverrides.filter(o => o.agentId === selectedAgent.id);

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:bg-gray-50">← Back</button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">🤝 {selectedAgent.fullName}</h1>
            <p className="text-sm text-gray-500">{selectedAgent.agentId} | {selectedAgent.managerDistrict} | {selectedAgent.mobile}</p>
          </div>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${selectedAgent.status === "approved" ? "bg-green-100 text-green-700" : selectedAgent.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
            {selectedAgent.status.toUpperCase()}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Transactions", value: stats.txnCount, color: "#0369a1" },
            { label: "Total Amount", value: fmt(stats.totalTxnAmt), color: "#b45309" },
            { label: "Commission Earned", value: fmt(stats.totalCommission), color: "#15803d" },
            { label: "Wallet Balance", value: fmt(stats.walletBalance), color: "#7c3aed" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500 uppercase">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Commission Settings */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-gray-800">💰 Commission Setting</h3>
              <p className="text-sm text-gray-500 mt-1">
                Type: <strong>{selectedAgent.commissionType === "custom" ? `Custom — ${selectedAgent.customCommissionPercent}%` : "Auto (Slab)"}</strong>
              </p>
            </div>
            <button onClick={() => { setEditCommAgent(selectedAgent); setEditCommType(selectedAgent.commissionType); setEditCommPct(String(selectedAgent.customCommissionPercent)); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#1a2f5e" }}>✏️ மாற்று</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {(["overview","txns","wallet","overrides"] as const).map(t => (
            <button key={t} onClick={() => setDetailTab(t)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${detailTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t === "overview" ? "📊 Overview" : t === "txns" ? "📋 Transactions" : t === "wallet" ? "💰 Wallet" : "🔧 Overrides"}
            </button>
          ))}
        </div>

        {detailTab === "txns" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>{["TXN ID","Vendor","District","Amount","GST%","Commission","Status"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agentTxns.map(t => {
                    const comm = calcAgentCommission(selectedAgent, t.vendorCode, t.gstPercent, t.expectedAmount, agentOverrides, commissionSlabs);
                    return (
                      <tr key={t.txnId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-blue-700 font-bold">{t.txnId}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{t.vendorName}</td>
                        <td className="px-4 py-3 text-gray-600">{t.district}</td>
                        <td className="px-4 py-3 font-semibold">{fmt(t.expectedAmount)}</td>
                        <td className="px-4 py-3">{t.gstPercent}%</td>
                        <td className="px-4 py-3 text-green-700 font-semibold">{comm.amount > 0 ? `${fmt(comm.amount)} (${comm.percent}%)` : "—"}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === "Closed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{t.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {agentTxns.length === 0 && <p className="text-center py-8 text-gray-400">No transactions yet</p>}
            </div>
          </div>
        )}

        {detailTab === "wallet" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0a1628" }}>
                  <tr>{["Date","Vendor","TXN","Txn Amt","GST%","Commission%","Commission","Balance"].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...walletEntries].reverse().map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-xs text-gray-500">{w.date}</td>
                      <td className="px-3 py-3 text-gray-800">{w.vendorName}</td>
                      <td className="px-3 py-3 font-mono text-xs text-blue-700">{w.txnId}</td>
                      <td className="px-3 py-3">{fmt(w.billAmount)}</td>
                      <td className="px-3 py-3">{w.gstPercent}%</td>
                      <td className="px-3 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${w.commissionType === "custom" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{w.commissionPercent}% ({w.commissionType})</span></td>
                      <td className="px-3 py-3 font-bold text-green-700">{fmt(w.commissionAmount)}</td>
                      <td className="px-3 py-3 font-bold text-gray-800">{fmt(w.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {walletEntries.length === 0 && <p className="text-center py-8 text-gray-400">No commission entries yet</p>}
            </div>
          </div>
        )}

        {detailTab === "overrides" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowOverrideModal(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#7c3aed" }}>+ Custom Override சேர்</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0a1628" }}>
                    <tr>{["Vendor Code","Vendor Name","Commission%","Set By","Set At","Action"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myOverrides.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-blue-700">{o.vendorCode}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{o.vendorName}</td>
                        <td className="px-4 py-3"><span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">{o.commissionPercent}%</span></td>
                        <td className="px-4 py-3 text-gray-500">{o.setBy}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(o.setAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3"><button onClick={() => onDeleteOverride(o.id)} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {myOverrides.length === 0 && <p className="text-center py-8 text-gray-400">No custom overrides. All vendors use slab/auto commission.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Override Modal */}
        {showOverrideModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">🔧 Custom Override சேர்</h3>
                <button onClick={() => setShowOverrideModal(false)} className="text-gray-400 text-2xl">✕</button>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Vendor</label>
                <select value={overrideVendorCode} onChange={e => setOverrideVendorCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none">
                  <option value="">Select Vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.vendorCode}>{v.vendorName} ({v.vendorCode})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Commission % (Custom)</label>
                <input type="number" step="0.1" value={overridePct} onChange={e => setOverridePct(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const vendor = vendors.find(v => v.vendorCode === overrideVendorCode);
                    if (!vendor || !overrideVendorCode) { alert("Vendor select செய்யவும்!"); return; }
                    onAddOverride({
                      id: genId("OVR"),
                      agentId: selectedAgent.id,
                      vendorCode: overrideVendorCode,
                      vendorName: vendor.vendorName,
                      commissionPercent: parseFloat(overridePct) || 0,
                      setBy: "admin",
                      setAt: new Date().toISOString()
                    });
                    setShowOverrideModal(false);
                    setOverrideVendorCode(""); setOverridePct("1");
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white"
                  style={{ background: "#7c3aed" }}
                >
                  💾 Save Override
                </button>
                <button onClick={() => setShowOverrideModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Commission Modal */}
        {editCommAgent && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">💰 Commission மாற்று</h3>
                <button onClick={() => setEditCommAgent(null)} className="text-gray-400 text-2xl">✕</button>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Commission Type</label>
                <div className="flex gap-3">
                  <button onClick={() => setEditCommType("auto")} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${editCommType === "auto" ? "border-blue-500 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-600"}`}>📊 Auto (Slab)</button>
                  <button onClick={() => setEditCommType("custom")} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${editCommType === "custom" ? "border-purple-500 text-purple-700 bg-purple-50" : "border-gray-300 text-gray-600"}`}>✏️ Custom %</button>
                </div>
              </div>
              {editCommType === "custom" && (
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Custom Commission %</label>
                  <input type="number" step="0.1" value={editCommPct} onChange={e => setEditCommPct(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500" />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onSetCommission(editCommAgent.id, editCommType, parseFloat(editCommPct) || 0);
                    setSelectedAgent(prev => prev ? { ...prev, commissionType: editCommType, customCommissionPercent: parseFloat(editCommPct) || 0 } : null);
                    setEditCommAgent(null);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white"
                  style={{ background: "#16a34a" }}
                >
                  💾 Save
                </button>
                <button onClick={() => setEditCommAgent(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main Agents List View ─────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🤝 Agent Management</h1>
          <p className="text-sm text-gray-500">{approved.length} active agents | {pending.length} pending approval</p>
        </div>
        {pending.length > 0 && (
          <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-bold animate-pulse">
            🔴 {pending.length} Pending Approval
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["list","pending","slabs"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "list" ? `👥 Agents (${approved.length})` : t === "pending" ? `⏳ Pending (${pending.length})` : "📊 Commission Slabs"}
          </button>
        ))}
      </div>

      {/* Pending Approvals */}
      {tab === "pending" && (
        <div className="space-y-4">
          {pending.length === 0 && <p className="text-center py-12 text-gray-400">Pending approvals இல்லை</p>}
          {pending.map(agent => (
            <div key={agent.id} className="bg-white rounded-xl p-5 border-2 border-yellow-200 shadow-sm">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="font-bold text-gray-800 text-lg">{agent.fullName}</p>
                  <p className="text-sm text-gray-500">{agent.agentId} | {agent.mobile}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Manager: <strong>{agent.managerName}</strong> ({agent.managerDistrict})
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Registered: {new Date(agent.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-w-[200px]">
                  {approveAgentId === agent.id ? (
                    <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs font-bold text-green-700">Commission Type செலக்ட் செய்யவும்:</p>
                      <div className="flex gap-2">
                        <button onClick={() => setApproveType("auto")} className={`flex-1 py-1.5 rounded text-xs font-semibold border ${approveType === "auto" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-600"}`}>Auto Slab</button>
                        <button onClick={() => setApproveType("custom")} className={`flex-1 py-1.5 rounded text-xs font-semibold border ${approveType === "custom" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-300 text-gray-600"}`}>Custom %</button>
                      </div>
                      {approveType === "custom" && (
                        <input type="number" step="0.1" value={approvePct} onChange={e => setApprovePct(e.target.value)} placeholder="Commission %" className="w-full px-3 py-1.5 rounded border border-gray-300 text-sm outline-none" />
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { onApprove(agent.id, approveType, parseFloat(approvePct) || 0); setApproveAgentId(null); }}
                          className="flex-1 py-1.5 rounded text-xs font-bold text-white bg-green-600 hover:bg-green-700"
                        >
                          ✅ Confirm Approve
                        </button>
                        <button onClick={() => setApproveAgentId(null)} className="px-3 py-1.5 rounded text-xs font-semibold text-gray-600 border border-gray-300">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setApproveAgentId(agent.id)} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700">✅ Approve</button>
                      <button onClick={() => onReject(agent.id)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600">❌ Reject</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agents List */}
      {tab === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0a1628" }}>
                <tr>{["Agent","Manager","District","Commission","Wallet","Transactions","Status","Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agents.filter(a => a.status !== "pending").map(agent => {
                  const stats = getAgentStats(agent);
                  return (
                    <tr key={agent.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-800">{agent.fullName}</p>
                        <p className="text-xs text-gray-400">{agent.agentId} | {agent.mobile}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{agent.managerName}</td>
                      <td className="px-4 py-3 text-gray-600">{agent.managerDistrict}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${agent.commissionType === "custom" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {agent.commissionType === "custom" ? `${agent.customCommissionPercent}% custom` : "Auto slab"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-green-700">{fmt(agent.commissionBalance)}</td>
                      <td className="px-4 py-3 text-center"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{stats.txnCount}</span></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${agent.status === "approved" ? "bg-green-100 text-green-700" : agent.status === "suspended" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setSelectedAgent(agent); setDetailTab("overview"); }} className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200">👁️</button>
                          <button onClick={() => onSuspend(agent.id)} className="px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200">{agent.status === "suspended" ? "▶️" : "⏸️"}</button>
                          <button onClick={() => { if(confirm(`Delete ${agent.fullName}?`)) onDelete(agent.id); }} className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {agents.filter(a => a.status !== "pending").length === 0 && (
              <p className="text-center py-12 text-gray-400">No agents yet. District managers add agents from their dashboard.</p>
            )}
          </div>
        </div>
      )}

      {/* Commission Slabs Editor */}
      {tab === "slabs" && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">📊 Commission Slab Configuration</h2>
              <p className="text-sm text-gray-500 mt-1">GST % → Agent commission % mapping. Admin மட்டும் மாற்றலாம்.</p>
            </div>
            <button
              onClick={() => setEditSlabs(prev => [...prev, { gstPercent: 0, agentCommission: 0 }])}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#1a2f5e" }}
            >
              + Row சேர்
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead style={{ background: "#1a2f5e" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">GST %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Agent Commission %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Note</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editSlabs.map((slab, i) => (
                  <tr key={i} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input type="number" step="0.5" value={slab.gstPercent} onChange={e => setEditSlabs(prev => prev.map((s, idx) => idx === i ? { ...s, gstPercent: parseFloat(e.target.value) || 0 } : s))} className="w-24 px-2 py-1.5 rounded border border-gray-300 text-sm outline-none" />
                      <span className="ml-1 text-gray-500">%</span>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.1" value={slab.agentCommission} onChange={e => setEditSlabs(prev => prev.map((s, idx) => idx === i ? { ...s, agentCommission: parseFloat(e.target.value) || 0 } : s))} className="w-24 px-2 py-1.5 rounded border border-gray-300 text-sm outline-none" />
                      <span className="ml-1 text-gray-500">%</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {slab.agentCommission === 0 ? "🔴 Threshold — இதற்கு மேல் commission இல்லை" : `Transaction amount-ல் ${slab.agentCommission}% commission`}
                    </td>
                    <td className="px-4 py-2">
                      {editSlabs.length > 1 && (
                        <button onClick={() => setEditSlabs(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xl font-bold">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-700 space-y-1">
            <p className="font-bold">📌 சூத்திரம் (Formula):</p>
            <p>• Transaction ஒன்று GST 4%-ல் close ஆனால் → agent commission = 0.5% of transaction amount</p>
            <p>• Threshold row (0%) — இந்த GST% மற்றும் அதற்கு மேல் → commission கிடையாது</p>
            <p>• Vendor-specific override இருந்தால் → slab-ஐ override செய்யும்</p>
          </div>

          <button
            onClick={() => { onUpdateSlabs(editSlabs); alert("✅ Commission slabs saved!"); }}
            className="px-8 py-3 rounded-lg text-sm font-bold text-white hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
          >
            💾 Save Slabs
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END OF AGENT PART 3
// ============================================================
// ============================================================
// AGENT FEATURE — PART 4 of 5
// AgentDashboardPage + Manager-ல் Agent Add feature
//
// 📌 எங்கே paste செய்வது:
//    AdminAgentsPage (Part 3) க்கு கீழே paste செய்யவும்
// ============================================================

// ── Agent Dashboard (Agent login ஆனால் காண்பிக்கும் page) ──
function AgentDashboardPage({
  agent, transactions, vendors, bills, agentWallet, agentOverrides, commissionSlabs,
  onAddVendor, onAddTransaction, onAddBill, onBulkAddBill, onLogout
}: {
  agent: Agent;
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  agentWallet: AgentWalletEntry[];
  agentOverrides: AgentVendorOverride[];
  commissionSlabs: CommissionSlab[];
  onAddVendor: (v: Vendor) => void;
  onAddTransaction: (t: Transaction, advance: number) => void;
  onAddBill: (b: Bill) => void;
  onBulkAddBill: (bills: Bill[]) => void;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<"dashboard" | "vendors" | "transactions" | "bills" | "wallet">("dashboard");
  const [selectedDistrict, setSelectedDistrict] = useState(agent.managerDistrict);

  // Agent's own data
  const myTxns   = transactions.filter(t => t.createdByAgent === agent.agentId);
  const myBills  = bills.filter(b => myTxns.some(t => t.txnId === b.txnId));
  const myWallet = agentWallet.filter(w => w.agentId === agent.id);

  // Filter vendors by selected district
  const districtVendors = vendors.filter(v => v.district === selectedDistrict);
  const districtOpenTxns = myTxns.filter(t => t.district === selectedDistrict && t.status === "Open");

  const totalCommission  = myWallet.reduce((s, w) => s + w.commissionAmount, 0);
  const totalTxnAmt      = myTxns.reduce((s, t) => s + t.expectedAmount, 0);
  const openTxns         = myTxns.filter(t => t.status === "Open").length;
  const closedTxns       = myTxns.filter(t => t.status === "Closed").length;

  // Month filter for wallet
  const [walletMonth, setWalletMonth] = useState("");
  const filteredWallet = myWallet.filter(w =>
    !walletMonth || w.date.startsWith(walletMonth)
  );

  const navItems = [
    { id: "dashboard",    label: "Dashboard",    icon: "📊" },
    { id: "vendors",      label: "Vendors",      icon: "🏢" },
    { id: "transactions", label: "Transactions", icon: "📋" },
    { id: "bills",        label: "Bills",        icon: "🧾" },
    { id: "wallet",       label: "My Wallet",    icon: "💰" },
  ] as const;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f2f5" }}>
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0" style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="font-bold text-sm" style={{ color: "#f0d060" }}>AR Enterprises</p>
          <p className="text-xs text-gray-400">Agent Portal</p>
        </div>
        <div className="p-3 m-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
          <p className="text-xs text-gray-400">🤝 Agent</p>
          <p className="text-xs font-bold text-white truncate">{agent.fullName}</p>
          <p className="text-xs text-green-400 mt-1">💰 {fmt(agent.commissionBalance)}</p>
        </div>
        <nav className="p-2 space-y-1">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${page === n.id ? "text-gray-900 font-semibold" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
              style={page === n.id ? { background: "linear-gradient(135deg, #f0d060, #c9a227)" } : {}}
            >
              <span>{n.icon}</span><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 w-56 px-3">
          <button onClick={onLogout} className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-white transition-all" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>🚪 Logout</button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">

        {/* District Selector — always visible */}
        <div className="sticky top-0 z-10 px-6 py-3 flex items-center gap-3" style={{ background: "rgba(240,242,245,0.95)", borderBottom: "1px solid #e5e7eb" }}>
          <span className="text-sm font-medium text-gray-600">🏛️ Working District:</span>
          <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500 bg-white">
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="text-xs text-gray-400">| எந்த district-லும் work செய்யலாம்</span>
        </div>

        {/* Dashboard */}
        {page === "dashboard" && (
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">👋 வணக்கம், {agent.fullName}!</h1>
              <p className="text-sm text-gray-500">{agent.agentId} | Manager: {agent.managerName} ({agent.managerDistrict})</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "My Transactions",  value: myTxns.length, color: "#0369a1" },
                { label: "Total Amount",     value: fmt(totalTxnAmt), color: "#b45309" },
                { label: "Commission Earned",value: fmt(round2(totalCommission)), color: "#15803d" },
                { label: "Wallet Balance",   value: fmt(agent.commissionBalance), color: "#7c3aed" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-medium">{s.label}</p>
                  <p className="text-2xl font-bold mt-2" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Commission Info */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3">💰 My Commission Setup</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
                  <p className="text-sm font-medium text-blue-700">Commission Type</p>
                  <p className="text-lg font-bold text-blue-900 mt-1">
                    {agent.commissionType === "custom"
                      ? `✏️ Custom — ${agent.customCommissionPercent}%`
                      : "📊 Auto (GST-based Slab)"}
                  </p>
                </div>
                {agent.commissionType === "auto" && (
                  <div className="p-4 rounded-lg" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <p className="text-sm font-medium text-green-700">Current Slab Rates</p>
                    <div className="mt-2 space-y-1">
                      {commissionSlabs.filter(s => s.agentCommission > 0).map(s => (
                        <p key={s.gstPercent} className="text-xs text-green-700">GST {s.gstPercent}% → Commission {s.agentCommission}%</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-gray-800">Recent Transactions</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>{["TXN ID","Vendor","District","Amount","GST%","Commission","Status"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myTxns.slice(0, 8).map(t => {
                      const comm = calcAgentCommission(agent, t.vendorCode, t.gstPercent, t.expectedAmount, agentOverrides, commissionSlabs);
                      return (
                        <tr key={t.txnId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-blue-700 font-bold">{t.txnId}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{t.vendorName}</td>
                          <td className="px-4 py-3 text-gray-600">{t.district}</td>
                          <td className="px-4 py-3 font-semibold">{fmt(t.expectedAmount)}</td>
                          <td className="px-4 py-3">{t.gstPercent}%</td>
                          <td className="px-4 py-3 text-green-700 font-semibold">
                            {t.status === "Closed"
                              ? (() => { const w = myWallet.find(w => w.txnId === t.txnId); return w ? fmt(w.commissionAmount) : "—"; })()
                              : `~${fmt(comm.amount)} (${comm.percent}%)`}
                          </td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === "Closed" ? "bg-green-100 text-green-700" : t.status === "PendingClose" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{t.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {myTxns.length === 0 && <p className="text-center py-8 text-gray-400">No transactions yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Wallet Page */}
        {page === "wallet" && (
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold text-gray-800">💰 My Commission Wallet</h1>

            <div className="rounded-xl p-6 text-white" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
              <p className="text-sm text-gray-300">Current Balance</p>
              <p className="text-5xl font-bold mt-2" style={{ color: "#f0d060" }}>{fmt(agent.commissionBalance)}</p>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
                <div><p className="text-xs text-gray-400">Total Earned</p><p className="font-bold text-lg mt-1">{fmt(round2(totalCommission))}</p></div>
                <div><p className="text-xs text-gray-400">Transactions</p><p className="font-bold text-lg mt-1">{closedTxns} closed</p></div>
                <div><p className="text-xs text-gray-400">Pending</p><p className="font-bold text-lg mt-1">{openTxns} open</p></div>
              </div>
            </div>

            {/* Month/Date filter */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Month Filter:</label>
              <input type="month" value={walletMonth} onChange={e => setWalletMonth(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500" />
              {walletMonth && <button onClick={() => setWalletMonth("")} className="text-xs text-gray-400 hover:text-gray-600">Clear ✕</button>}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#1a1a2e" }}>
                    <tr>{["Date","Vendor","TXN","Amount","GST%","Commission%","Earned","Balance"].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-300">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...filteredWallet].reverse().map(w => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-xs text-gray-500">{w.date}</td>
                        <td className="px-3 py-3 font-semibold text-gray-800">{w.vendorName}</td>
                        <td className="px-3 py-3 font-mono text-xs text-blue-700">{w.txnId}</td>
                        <td className="px-3 py-3">{fmt(w.billAmount)}</td>
                        <td className="px-3 py-3">{w.gstPercent}%</td>
                        <td className="px-3 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${w.commissionType === "custom" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{w.commissionPercent}%</span></td>
                        <td className="px-3 py-3 font-bold text-green-700">{fmt(w.commissionAmount)}</td>
                        <td className="px-3 py-3 font-bold text-gray-800">{fmt(w.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredWallet.length === 0 && <p className="text-center py-8 text-gray-400">No commission entries found</p>}
              </div>
            </div>
          </div>
        )}

        {/* Vendors, Transactions, Bills — reuse existing pages with district filter */}
        {page === "vendors" && (
          <VendorsPage
            isAdmin={false} district={selectedDistrict}
            vendors={vendors.filter(v => v.district === selectedDistrict)}
            allVendors={vendors}
            onAdd={onAddVendor} onUpdate={() => {}} onDelete={() => {}}
          />
        )}

        {page === "transactions" && (
          <TransactionsPage
            isAdmin={false} district={selectedDistrict}
            transactions={myTxns.filter(t => t.district === selectedDistrict)}
            vendors={districtVendors} bills={myBills}
            onAdd={(txn, advance) => onAddTransaction({ ...txn, createdByAgent: agent.agentId, agentName: agent.fullName }, advance)}
            onClose={() => {}} onUpdate={() => {}} onDelete={() => {}}
          />
        )}

        {page === "bills" && (
          <BillsPage
            isAdmin={false} district={selectedDistrict}
            bills={myBills.filter(b => b.district === selectedDistrict)}
            transactions={districtOpenTxns} vendors={districtVendors}
            onAdd={onAddBill} onBulkAdd={onBulkAddBill} onUpdate={() => {}} onDelete={() => {}}
          />
        )}

      </div>
    </div>
  );
}

// ── Manager Add Agent Modal ──────────────────────────────────
// 📌 VendorsPage-க்கு கீழே paste செய்யவும்
// Manager (district user) இந்த component மூலம் agents add செய்கிறார்

function ManagerAddAgentSection({
  manager, agents, onAddAgent
}: {
  manager: User;
  agents: Agent[];
  onAddAgent: (agent: Agent) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");

  const myAgents = agents.filter(a => a.managerId === manager.id);

  const handleAdd = async () => {
    if (!fullName || !mobile || !username || !password) {
      alert("❌ அனைத்து fields-ம் தேவை!"); return;
    }
    if (agents.some(a => a.username === username)) {
      alert("❌ Username already exists!"); return;
    }
    const hashedPassword = await hashPassword(password);
    onAddAgent({
      id: genId("AGT"),
      agentId: genAgentId(agents),
      username, password: hashedPassword,
      fullName: sanitizeInput(fullName),
      mobile: sanitizeInput(mobile),
      managerId: manager.id,
      managerName: manager.username,
      managerDistrict: manager.district || "",
      commissionType: "auto",
      customCommissionPercent: 0,
      bankName, accountNumber: accountNo, ifscCode: ifsc, upiId: upi,
      status: "pending",
      commissionBalance: 0,
      createdAt: new Date().toISOString()
    });
    setFullName(""); setMobile(""); setUsername(""); setPassword("");
    setBankName(""); setAccountNo(""); setIfsc(""); setUpi("");
    setShowForm(false);
    alert("✅ Agent registration request submitted!\n\nAdmin approval-க்கு காத்திருக்கவும்.");
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800">🤝 My Agents ({myAgents.length})</h2>
          <p className="text-xs text-gray-500">நீங்கள் add செய்த agents</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}>+ New Agent</button>
      </div>

      {/* My agents list */}
      {myAgents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead style={{ background: "#f8fafc" }}>
              <tr>{["Agent ID","Name","Mobile","Status","Commission"].map(h => <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {myAgents.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-blue-700 font-bold">{a.agentId}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{a.fullName}</td>
                  <td className="px-3 py-2.5 text-gray-600">{a.mobile}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${a.status === "approved" ? "bg-green-100 text-green-700" : a.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{a.status}</span></td>
                  <td className="px-3 py-2.5 text-xs">{a.commissionType === "custom" ? `${a.customCommissionPercent}% custom` : "Auto slab"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Agent Form */}
      {showForm && (
        <div className="space-y-4 p-4 rounded-xl border-2 border-purple-200 bg-purple-50">
          <h3 className="font-bold text-purple-800">புதிய Agent Register</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-600 mb-1 block font-medium">Full Name <span className="text-red-500">*</span></label><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Agent full name" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500" /></div>
            <div><label className="text-xs text-gray-600 mb-1 block font-medium">Mobile <span className="text-red-500">*</span></label><input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" maxLength={10} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500" /></div>
            <div><label className="text-xs text-gray-600 mb-1 block font-medium">Username <span className="text-red-500">*</span></label><input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="agent_username" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500" /></div>
            <div><label className="text-xs text-gray-600 mb-1 block font-medium">Password <span className="text-red-500">*</span></label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Strong password" autoComplete="new-password" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-purple-500" /></div>
          </div>
          <p className="text-xs font-bold text-gray-600 mt-2">🏦 Bank Details (Optional)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-600 mb-1 block">Bank Name</label><input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="SBI / HDFC / etc." className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" /></div>
            <div><label className="text-xs text-gray-600 mb-1 block">Account Number</label><input value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Account number" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" /></div>
            <div><label className="text-xs text-gray-600 mb-1 block">IFSC Code</label><input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="SBIN0001234" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" /></div>
            <div><label className="text-xs text-gray-600 mb-1 block">UPI ID</label><input value={upi} onChange={e => setUpi(e.target.value)} placeholder="agent@upi" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="px-6 py-2.5 rounded-lg text-sm font-bold text-white hover:scale-105 transition-all" style={{ background: "#7c3aed" }}>📤 Submit for Approval</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border-2 border-gray-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END OF AGENT PART 4
// ============================================================
// ============================================================
// VENDOR DASHBOARD PAGE
// AGENT FEATURE PART 5 of 5
//
// 📌 எங்கே paste செய்வது:
//    AgentDashboardPage (Part 4) க்கு கீழே,
//    SettingsPage-க்கு முன்னால்
// ============================================================

function VendorDashboardPage({
  vendor,
  transactions,
  bills,
  onLogout
}: {
  vendor: Vendor;
  transactions: Transaction[];
  bills: Bill[];
  onLogout: () => void;
}) {
  const [filterMonth, setFilterMonth] = useState("");
  const [filterFY, setFilterFY] = useState("");

  // This vendor's transactions only
  const myTxns = transactions.filter(t => t.vendorCode === vendor.vendorCode);
  const myBills = bills.filter(b => b.vendorCode === vendor.vendorCode);

  // Apply filters
  const filtered = myTxns.filter(t => {
    return (!filterMonth || t.month === filterMonth) &&
           (!filterFY || t.financialYear === filterFY);
  });

  // Stats
  const totalExpected     = filtered.reduce((s, t) => s + t.expectedAmount, 0);
  const totalAdvance      = filtered.reduce((s, t) => s + t.advanceAmount, 0);
  const totalBillsAmt     = filtered.reduce((s, t) => s + t.billsReceived, 0);
  const totalRemaining    = filtered.reduce((s, t) => s + Math.max(0, t.remainingExpected), 0);
  const openCount         = filtered.filter(t => t.status === "Open").length;
  const pendingCount      = filtered.filter(t => t.status === "PendingClose").length;
  const closedCount       = filtered.filter(t => t.status === "Closed").length;

  const filteredBills     = myBills.filter(b =>
    filtered.some(t => t.txnId === b.txnId)
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "#f0f2f5", fontFamily: "'Segoe UI', sans-serif" }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #14532d, #15803d)" }}
      >
        <div>
          <p className="font-bold text-white text-lg">🏢 {vendor.vendorName}</p>
          <p className="text-xs text-green-200 mt-0.5">
            {vendor.vendorCode} | GST: {vendor.gstNo || "—"} | {vendor.district}
          </p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white border border-green-400 hover:bg-green-700 transition-colors"
        >
          🚪 Logout
        </button>
      </div>

      <div className="p-6 space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">👋 வணக்கம்!</h1>
          <p className="text-sm text-gray-500 mt-1">
            உங்களுடைய transactions மற்றும் bills overview கீழே தெரிகிறது.
          </p>
        </div>

        {/* Vendor Info Card */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">🏢 Vendor Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Vendor Code</p>
              <p className="font-bold text-blue-700 font-mono">{vendor.vendorCode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Business Type</p>
              <p className="font-semibold text-gray-800">{vendor.businessType || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">District</p>
              <p className="font-semibold text-gray-800">🏛️ {vendor.district}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Mobile</p>
              <p className="font-semibold text-gray-800">{vendor.mobile || "—"}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">🔍 Filter</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Month</label>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-green-500"
              >
                <option value="">All Months</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Financial Year</label>
              <select
                value={filterFY}
                onChange={e => setFilterFY(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-green-500"
              >
                <option value="">All FY</option>
                {FY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {(filterMonth || filterFY) && (
              <div className="flex items-end">
                <button
                  onClick={() => { setFilterMonth(""); setFilterFY(""); }}
                  className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-300 hover:bg-gray-50"
                >
                  ✕ Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Transactions</p>
            <p className="text-3xl font-bold mt-2 text-blue-700">{filtered.length}</p>
            <p className="text-xs text-gray-400 mt-1">
              Open: {openCount} | Pending: {pendingCount} | Closed: {closedCount}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-medium">Expected Amount</p>
            <p className="text-2xl font-bold mt-2 text-gray-800">{fmt(totalExpected)}</p>
            <p className="text-xs text-gray-400 mt-1">Advance: {fmt(totalAdvance)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-medium">Bills Submitted</p>
            <p className="text-2xl font-bold mt-2 text-green-700">{fmt(totalBillsAmt)}</p>
            <p className="text-xs text-gray-400 mt-1">{filteredBills.length} bills total</p>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border ${totalRemaining > 0 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
            <p className="text-xs text-gray-500 uppercase font-medium">Pending Amount</p>
            <p className={`text-2xl font-bold mt-2 ${totalRemaining > 0 ? "text-orange-600" : "text-green-600"}`}>
              {totalRemaining > 0 ? fmt(totalRemaining) : "✅ All Clear"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {totalRemaining > 0 ? "இன்னும் submit வேண்டும்" : "அனைத்தும் submitted"}
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">📋 My Transactions</h2>
            <span className="text-xs text-gray-500">{filtered.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#14532d" }}>
                <tr>
                  {["TXN ID", "Month / FY", "Expected ₹", "Advance ₹", "Bills ₹", "Remaining", "Bills Count", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-green-100 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => {
                  const txnBills = myBills.filter(b => b.txnId === t.txnId);
                  return (
                    <tr key={t.txnId} className={`hover:bg-gray-50 transition-colors ${t.status === "Closed" ? "bg-green-50/50" : t.status === "PendingClose" ? "bg-yellow-50/50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-700 font-bold">{t.txnId}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{t.month}</p>
                        <p className="text-xs text-gray-400">{t.financialYear}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{fmt(t.expectedAmount)}</td>
                      <td className="px-4 py-3 text-orange-600 font-semibold">{fmt(t.advanceAmount)}</td>
                      <td className="px-4 py-3 text-green-700 font-semibold">{fmt(t.billsReceived)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${t.remainingExpected <= 0 ? "text-green-600" : "text-orange-600"}`}>
                          {t.remainingExpected <= 0 ? "₹0 ✅" : fmt(t.remainingExpected)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{txnBills.length}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          t.status === "Closed" ? "bg-green-100 text-green-700" :
                          t.status === "PendingClose" ? "bg-yellow-100 text-yellow-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {t.status === "PendingClose" ? "⏳ Pending" : t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot style={{ background: "#14532d" }}>
                  <tr>
                    <td colSpan={2} className="px-4 py-3 font-bold text-green-200 text-xs">மொத்தம் ({filtered.length})</td>
                    <td className="px-4 py-3 font-bold text-yellow-300">{fmt(totalExpected)}</td>
                    <td className="px-4 py-3 font-bold text-orange-300">{fmt(totalAdvance)}</td>
                    <td className="px-4 py-3 font-bold text-green-300">{fmt(totalBillsAmt)}</td>
                    <td className="px-4 py-3 font-bold text-white">{totalRemaining > 0 ? fmt(totalRemaining) : "✅"}</td>
                    <td className="px-4 py-3 font-bold text-green-200">{filteredBills.length}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-12 text-gray-400">No transactions found</p>
            )}
          </div>
        </div>

        {/* Bills Breakdown */}
        {filteredBills.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">🧾 Bill Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    {["Bill No", "Date", "TXN ID", "Bill Amount", "GST%", "GST Amount", "Total"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBills.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{b.billNumber}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{b.billDate}</td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{b.txnId}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{fmt(b.billAmount)}</td>
                      <td className="px-4 py-3 text-gray-600">{b.gstPercent}%</td>
                      <td className="px-4 py-3 text-purple-700 font-semibold">{fmt(b.gstAmount)}</td>
                      <td className="px-4 py-3 text-green-700 font-bold">{fmt(b.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SettingsPage({
  settings, onUpdateSettings, onBackup, onRestore, onClearData, storageUsed
}: {
  settings: any; onUpdateSettings: (s: any) => void;
  onBackup: () => void; onRestore: (file: File) => void;
  onClearData: () => void; storageUsed: number;
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onRestore(file);
  };

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">⚙️ Settings</h1><p className="text-sm text-gray-500">App configuration & data management</p></div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">💾 Backup & Restore</h2>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div><p className="font-semibold text-gray-800">Auto Backup Reminder</p><p className="text-xs text-gray-500">Weekly reminder to backup data</p></div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={localSettings.autoBackup} onChange={e => setLocalSettings({...localSettings, autoBackup: e.target.checked})} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={onBackup} className="px-6 py-3 rounded-lg text-sm font-semibold text-white hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>📥 Download Backup</button>
          <label className="px-6 py-3 rounded-lg text-sm font-semibold text-white text-center cursor-pointer hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
            📤 Restore from File
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">🔔 Notifications</h2>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div><p className="font-semibold text-gray-800">Browser Notifications</p><p className="text-xs text-gray-500">Get alerts for pending transactions</p></div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={localSettings.browserNotifications} onChange={e => setLocalSettings({...localSettings, browserNotifications: e.target.checked})} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Storage */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">💽 Storage</h2>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-800">Data Usage</p>
            <p className="text-sm text-gray-600">{formatBytes(storageUsed)} / 5 MB</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, (storageUsed / (5 * 1024 * 1024)) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-2">
        <h2 className="font-bold text-gray-800 text-lg">ℹ️ App Information</h2>
        <p className="text-sm text-gray-600">Version: <strong>3.0.0</strong></p>
        <p className="text-sm text-gray-600">Build: <strong>Production</strong></p>
        <p className="text-sm text-gray-600">Storage: <strong>Plain JSON (Secure)</strong></p>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200 space-y-4">
        <h2 className="font-bold text-red-700 text-lg">⚠️ Danger Zone</h2>
        <p className="text-sm text-red-600">This action will permanently delete all data. This cannot be undone!</p>
        <button onClick={onClearData} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">🗑️ Clear All Data</button>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={() => { onUpdateSettings(localSettings); alert("✅ Settings saved!"); }} className="px-8 py-3 rounded-lg text-sm font-bold text-white hover:scale-105 transition-all" style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}>💾 Save Settings</button>
      </div>
    </div>
  );
}

// ============================================================
// WORK TRACKER PAGE — Google Sheet iframe Embed
// 📌 Sheet URL: இங்கே Publish URL paste செய்யவும்
// ============================================================
// NOTE: ReconciliationPage-ஐ App() function-ல் main render-ல்
// WorkTrackerPage return-க்கு கீழே சேர்க்கவும்:
// if (currentView === 'reconciliation') return <ReconciliationPage onBack={() => setCurrentView('landing')} />;
const WORK_TRACKER_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4U0YKYbaJwmt4I7MW2O4ITS-8YImAHpNLFCS9M_9BbF5qO2Hi-s1R59osAEQXc_RhnpRv9yZUgnRK/pubhtml?widget=true&headers=false";
// ⬆️ Google Sheet → File → Share → Publish to web → Embed → URL இங்கே paste செய்யவும்

function WorkTrackerPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("reminder");
  const [isLoading, setIsLoading] = useState(true);

  // Sheet tabs — Google Sheet-ல் உள்ள tabs-க்கு ஏற்ப இங்கே gid புது்படிக்கவும்
  const SHEET_TABS = [
    { id: "reminder",       label: "📋 Reminder",          gid: "0" },
    { id: "contract2526",   label: "📄 Contract 25-26",     gid: "" },
    { id: "contract2425",   label: "📄 Contract 24-25",     gid: "" },
    { id: "contract2324",   label: "📄 Contract 23-24",     gid: "" },
    { id: "gstpayment",     label: "🧭 GST Payment",        gid: "" },
    { id: "gstdashboard",   label: "📊 IT & GST Dashboard", gid: "" },
    { id: "gstr2b",         label: "📊 GSTR2B",             gid: "" },
    { id: "itc",            label: "📊 ITC",               gid: "" },
    { id: "expense",        label: "💸 Expense Journal",    gid: "" },
    { id: "summary",        label: "📈 Summary",            gid: "" },
  ];

  const SHEET_BASE_ID = "1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw";

  const getEmbedUrl = (gid: string) => {
    if (WORK_TRACKER_SHEET_URL !== "PASTE_IFRAME_URL_HERE") {
      // Published URL உள்ளது — direct use
      return WORK_TRACKER_SHEET_URL + (gid ? `&gid=${gid}` : "");
    }
    // Fallback: direct embed (view only — public sheet-க்கு மட்டும்)
    return `https://docs.google.com/spreadsheets/d/${SHEET_BASE_ID}/htmlview?gid=${gid}&widget=true&headers=false`;
  };

  const currentTab = SHEET_TABS.find(t => t.id === activeTab) || SHEET_TABS[0];
  const embedUrl = getEmbedUrl(currentTab.gid);

  const notSetup = WORK_TRACKER_SHEET_URL === "PASTE_IFRAME_URL_HERE";

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" as const }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onBack}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
            ← Back to ERP
          </button>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>📋 Work Tracker</div>
            <div style={{ fontSize: "11px", color: "#bfdbfe" }}>Sri Polinchi & Co — GST, ITC, Contract Works</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#93c5fd" }}>📡 Live from Google Sheets</span>
          <a
            href={`https://docs.google.com/spreadsheets/d/${SHEET_BASE_ID}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
          >
            ↗️ Open in Sheets
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "0 20px", display: "flex", gap: "2px", overflowX: "auto" as const, flexShrink: 0 }}>
        {SHEET_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setIsLoading(true); }}
            style={{
              padding: "10px 14px",
              border: "none",
              background: "transparent",
              color: activeTab === tab.id ? "#93c5fd" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "12px",
              cursor: "pointer",
              borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
              whiteSpace: "nowrap" as const,
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Setup Banner — Publish URL இல்லாவிட்டால் */}
      {notSetup && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", margin: "12px 20px", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#fbbf24", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>⚡ Setup Required — Sheet Public URL போடவும்:</div>
          <div style={{ fontSize: "12px", color: "#fde68a", lineHeight: 1.6 }}>
            1️⃣ Google Sheet → <strong>File → Share → Publish to web</strong><br/>
            2️⃣ <strong>Embed tab</strong> select → <strong>Entire Document</strong> → <strong>Publish</strong><br/>
            3️⃣ URL copy செய்து App.tsx-ல் <code style={{background:"rgba(0,0,0,0.3)",padding:"1px 6px",borderRadius:"4px"}}>WORK_TRACKER_SHEET_URL</code>-ல் paste செய்யவும்<br/>
            4️⃣ இதற்கிடையில் கீழே <strong>View only</strong> மோட்டில் தெரியும்
          </div>
        </div>
      )}

      {/* iframe */}
      <div style={{ flex: 1, position: "relative" as const, minHeight: 0 }}>
        {isLoading && (
          <div style={{
            position: "absolute" as const, inset: 0,
            background: "#0f172a",
            display: "flex", flexDirection: "column" as const,
            alignItems: "center", justifyContent: "center",
            zIndex: 10
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>📊</div>
            <div style={{ fontSize: "14px", color: "#93c5fd", fontWeight: 600 }}>Loading {currentTab.label}...</div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px" }}>Google Sheets-இலிருந்து தகவல் வருகிறது...</div>
          </div>
        )}
        <iframe
          key={activeTab}
          src={embedUrl}
          onLoad={() => setIsLoading(false)}
          style={{
            width: "100%",
            height: "100%",
            minHeight: "calc(100vh - 120px)",
            border: "none",
            background: "#fff"
          }}
          title={`Work Tracker — ${currentTab.label}`}
        />
      </div>
    </div>
  );
}

// ============================================================
// FINTRACK AI DASHBOARD — Integrated with ERP Data
// ============================================================
function FinTrackDashboard({
  vendors, transactions, bills, wallet, onBack
}: {
  vendors: Vendor[];
  transactions: Transaction[];
  bills: Bill[];
  wallet: WalletEntry[];
  onBack: () => void;
}) {
  const [ftPage, setFtPage] = useState<"dashboard"|"bank"|"projects"|"reports">("dashboard");
  const [ftProjects, setFtProjects] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("AR_FINTRACK_PROJECTS") || "[]"); } catch { return []; }
  });
  const [ftBankTxns, setFtBankTxns] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("AR_FINTRACK_BANK") || "[]"); } catch { return []; }
  });
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editProj, setEditProj] = useState<any>(null);

  // ERP data-வில்ிருந்து கணக்கிடு
  const erpTotalExpected = transactions.reduce((s,t) => s + t.expectedAmount, 0);
  const erpTotalBills    = bills.reduce((s,b) => s + b.billAmount, 0);
  const erpTotalGST      = transactions.reduce((s,t) => s + t.gstAmount, 0);
  const erpWalletBal     = wallet.length > 0 ? wallet[wallet.length-1].balance : 0;
  const erpWalletCredit  = wallet.reduce((s,w) => s + w.credit, 0);
  const erpWalletDebit   = wallet.reduce((s,w) => s + w.debit, 0);

  // FinTrack own data
  const ftTotalCredit = ftBankTxns.reduce((s:number,t:any) => s+(t.credit||0), 0);
  const ftTotalDebit  = ftBankTxns.reduce((s:number,t:any) => s+(t.debit||0), 0);
  const ftTotalPending = ftProjects.reduce((s:number,p:any) => s+(p.pending||0), 0);
  const ftContractTotal = ftProjects.reduce((s:number,p:any) => s+(p.contract||0), 0);

  const saveFtProjects = (data: any[]) => {
    setFtProjects(data);
    localStorage.setItem("AR_FINTRACK_PROJECTS", JSON.stringify(data));
  };
  const saveFtBank = (data: any[]) => {
    setFtBankTxns(data);
    localStorage.setItem("AR_FINTRACK_BANK", JSON.stringify(data));
  };

  // Project form state
  const [pName, setPName] = useState("");
  const [pLoc, setPLoc] = useState("");
  const [pContract, setPContract] = useState("");
  const [pGst, setPGst] = useState("");
  const [pTds, setPTds] = useState("");
  const [pLabour, setPLabour] = useState("");
  const [pEmd, setPEmd] = useState("");
  const [pReceived, setPReceived] = useState("");
  const [pKeywords, setPKeywords] = useState("");

  // Bank form state
  const [bDate, setBDate] = useState(new Date().toISOString().split("T")[0]);
  const [bDesc, setBDesc] = useState("");
  const [bType, setBType] = useState("credit");
  const [bAmount, setBAmount] = useState("");
  const [bRef, setBRef] = useState("");
  const [bProjId, setBProjId] = useState("");

  const resetProjectForm = () => {
    setPName(""); setPLoc(""); setPContract(""); setPGst(""); setPTds("");
    setPLabour(""); setPEmd(""); setPReceived(""); setPKeywords("");
    setEditProj(null);
  };

  const openEditProject = (p: any) => {
    setEditProj(p);
    setPName(p.name||""); setPLoc(p.location||"")
    setPContract(String(p.contract||"")); setPGst(String(p.gst||"")); setPTds(String(p.tds||""));
    setPLabour(String(p.labour||"")); setPEmd(String(p.emd||"")); setPReceived(String(p.received||""));
    setPKeywords(p.keywords||"");
    setShowAddProject(true);
  };

  const saveProject = () => {
    if (!pName || !pLoc) return;
    const contract = parseFloat(pContract)||0;
    const received = parseFloat(pReceived)||0;
    const proj = {
      id: editProj?.id || ("FTP" + Date.now().toString(36).toUpperCase()),
      name: pName, location: pLoc,
      contract, gst: parseFloat(pGst)||0, tds: parseFloat(pTds)||0,
      labour: parseFloat(pLabour)||0, emd: parseFloat(pEmd)||0,
      received, pending: Math.max(0, contract - received),
      keywords: pKeywords, status: "active",
      createdAt: new Date().toISOString()
    };
    if (editProj) {
      saveFtProjects(ftProjects.map((p:any) => p.id === editProj.id ? proj : p));
    } else {
      saveFtProjects([...ftProjects, proj]);
    }
    resetProjectForm();
    setShowAddProject(false);
  };

  const deleteProject = (id: string) => {
    if (!confirm("Delete project?")) return;
    saveFtProjects(ftProjects.filter((p:any) => p.id !== id));
  };

  const saveBank = () => {
    if (!bDesc || !bAmount) return;
    const amt = parseFloat(bAmount)||0;
    const txn = {
      id: "FTB" + Date.now().toString(36).toUpperCase(),
      date: bDate, description: bDesc, reference: bRef,
      credit: bType==="credit"?amt:0,
      debit: bType==="debit"?amt:0,
      projectId: bProjId, createdAt: new Date().toISOString()
    };
    const newBank = [...ftBankTxns, txn];
    saveFtBank(newBank);
    // If linked to a project, update received amount
    if (bProjId && bType==="credit") {
      const totalRec = newBank.filter((t:any)=>t.projectId===bProjId && t.credit)
        .reduce((s:number,t:any)=>s+t.credit, 0);
      saveFtProjects(ftProjects.map((p:any) => p.id===bProjId
        ? {...p, received: totalRec, pending: Math.max(0, p.contract-totalRec)}
        : p));
    }
    setBDesc(""); setBAmount(""); setBRef(""); setBProjId("");
    setShowAddBank(false);
  };

  const autoDetectProject = (desc: string) => {
    const d = desc.toLowerCase();
    const match = ftProjects.find((p:any) =>
      (p.keywords||"").toLowerCase().split(",").some((k:string) => k.trim() && d.includes(k.trim()))
      || d.includes(p.name.toLowerCase())
    );
    if (match) setBProjId(match.id);
  };

  const navStyle = (pg: string) => ({
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600" as const,
    cursor: "pointer" as const,
    background: ftPage === pg ? "rgba(251,191,36,0.15)" : "transparent",
    color: ftPage === pg ? "#fbbf24" : "#94a3b8",
    border: ftPage === pg ? "1px solid rgba(251,191,36,0.3)" : "1px solid transparent",
    transition: "all 0.2s"
  });

  const statCard = (label: string, value: string, sub: string, color: string, icon: string) => (
    <div style={{ background: "#1e293b", borderRadius: "12px", padding: "18px", border: "1px solid #334155", position: "relative" as const, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: color }}></div>
      <div style={{ position: "absolute", top: "14px", right: "14px", fontSize: "26px", opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 800, marginTop: "6px", color: "#f1f5f9" }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>{sub}</div>
    </div>
  );

  const fmtFT = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0 });

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Segoe UI', sans-serif", color: "#f1f5f9" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #7c2d12, #b45309)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
            ← Back to ERP
          </button>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>💼 FinTrack AI</div>
            <div style={{ fontSize: "11px", color: "#fde68a" }}>Financial & Project Tracking System</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["dashboard","bank","projects","reports"] as const).map(pg => (
            <button key={pg} onClick={() => setFtPage(pg)} style={navStyle(pg)}>
              {pg==="dashboard"?"📊 Dashboard":pg==="bank"?"🏦 Bank":pg==="projects"?"🏗️ Projects":"📈 Reports"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px" }}>

        {/* ── DASHBOARD ── */}
        {ftPage === "dashboard" && (
          <div>
            {/* ERP Sync Banner */}
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#fbbf24", display: "flex", alignItems: "center", gap: "8px" }}>
              ⚡ ERP Data Connected — Vendors: {vendors.length} | Transactions: {transactions.length} | Bills: {bills.length} | Wallet Balance: {fmtFT(erpWalletBal)}
            </div>

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
              {statCard("ERP Wallet Credit", fmtFT(erpWalletCredit), "Total income (ERP)", "#10b981", "💰")}
              {statCard("ERP Wallet Debit", fmtFT(erpWalletDebit), "Total expense (ERP)", "#ef4444", "📤")}
              {statCard("FinTrack Income", fmtFT(ftTotalCredit), ftBankTxns.filter((t:any)=>t.credit).length + " credits", "#3b82f6", "🏦")}
              {statCard("Pending Amount", fmtFT(ftTotalPending + (transactions.filter(t=>t.status==="Open").reduce((s,t)=>s+t.remainingExpected,0))), "All projects", "#f59e0b", "⏳")}
            </div>

            {/* ERP + FinTrack Combined */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

              {/* ERP Summary */}
              <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #334155", fontWeight: 700, fontSize: "14px", display: "flex", justifyContent: "space-between" }}>
                  <span>📊 ERP Transactions Summary</span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{transactions.length} records</span>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a2942" }}>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Total Expected</span>
                    <span style={{ fontWeight: 700 }}>{fmtFT(erpTotalExpected)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a2942" }}>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Bills Received</span>
                    <span style={{ fontWeight: 700, color: "#10b981" }}>{fmtFT(erpTotalBills)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a2942" }}>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Total GST</span>
                    <span style={{ fontWeight: 700, color: "#7c3aed" }}>{fmtFT(erpTotalGST)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Wallet Balance</span>
                    <span style={{ fontWeight: 700, color: "#f59e0b", fontSize: "16px" }}>{fmtFT(erpWalletBal)}</span>
                  </div>
                </div>
              </div>

              {/* FinTrack Projects Summary */}
              <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #334155", fontWeight: 700, fontSize: "14px", display: "flex", justifyContent: "space-between" }}>
                  <span>🏗️ FinTrack Projects</span>
                  <button onClick={() => { setFtPage("projects"); setShowAddProject(true); }} style={{ background: "#b45309", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>+ Add</button>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  {ftProjects.length === 0 ? (
                    <div style={{ color: "#475569", fontSize: "12px", textAlign: "center" as const, padding: "20px" }}>No projects yet. Click + Add.</div>
                  ) : ftProjects.slice(0,4).map((p:any) => {
                    const pct = p.contract ? Math.min(100, Math.round(p.received/p.contract*100)) : 0;
                    return (
                      <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #1a2942" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600 }}>{p.name.substring(0,22)}</span>
                          <span style={{ fontSize: "12px", color: "#ef4444" }}>{fmtFT(p.pending)} pending</span>
                        </div>
                        <div style={{ background: "#0f172a", borderRadius: "4px", height: "4px", marginTop: "4px" }}>
                          <div style={{ background: pct>80?"#10b981":pct>40?"#f59e0b":"#3b82f6", height: "100%", width: pct+"%", borderRadius: "4px" }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ERP Vendors linked as reference */}
            {vendors.length > 0 && (
              <div style={{ marginTop: "16px", background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #334155", fontWeight: 700, fontSize: "14px" }}>
                  🏢 ERP Vendors Reference ({vendors.length} vendors)
                </div>
                <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
                  {vendors.slice(0,8).map(v => (
                    <div key={v.id} style={{ background: "#0f172a", borderRadius: "8px", padding: "8px", fontSize: "12px" }}>
                      <div style={{ fontWeight: 600, color: "#f1f5f9" }}>{v.vendorName.substring(0,18)}</div>
                      <div style={{ color: "#64748b", marginTop: "2px" }}>{v.district}</div>
                      <div style={{ color: "#fbbf24", fontSize: "11px", marginTop: "2px" }}>{v.vendorCode}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BANK STATEMENTS ── */}
        {ftPage === "bank" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>🏦 Bank Statements</div>
              <button onClick={() => setShowAddBank(true)} style={{ background: "#b45309", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>+ Add Transaction</button>
            </div>

            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
              {statCard("Total Credit", fmtFT(ftTotalCredit), ftBankTxns.filter((t:any)=>t.credit).length+" entries", "#10b981", "⬇️")}
              {statCard("Total Debit", fmtFT(ftTotalDebit), ftBankTxns.filter((t:any)=>t.debit).length+" entries", "#ef4444", "⬆️")}
              {statCard("Net Balance", fmtFT(ftTotalCredit-ftTotalDebit), "Income - Expense", "#3b82f6", "📊")}
            </div>

            {/* Add Form */}
            {showAddBank && (
              <div style={{ background: "#1e293b", borderRadius: "12px", padding: "20px", border: "1px solid #334155", marginBottom: "20px" }}>
                <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>Add Bank Transaction</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                  {[{label:"Date",type:"date",val:bDate,set:setBDate},{label:"Reference",type:"text",val:bRef,set:setBRef}].map(f=>(
                    <div key={f.label}>
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>{f.label}</div>
                      <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)}
                        style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "13px", outline: "none" }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>Type</div>
                    <select value={bType} onChange={e=>setBType(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "13px", outline: "none" }}>
                      <option value="credit">Credit (Income)</option>
                      <option value="debit">Debit (Expense)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>Description *</div>
                    <input type="text" value={bDesc} onChange={e=>{setBDesc(e.target.value);autoDetectProject(e.target.value);}}
                      placeholder="e.g. NEFT from ABC Construction" style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "13px", outline: "none" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>Amount (₹) *</div>
                    <input type="number" value={bAmount} onChange={e=>setBAmount(e.target.value)} placeholder="0.00"
                      style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "13px", outline: "none" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>Link to Project</div>
                    <select value={bProjId} onChange={e=>setBProjId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "13px", outline: "none" }}>
                      <option value="">-- None --</option>
                      {ftProjects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                {bProjId && (
                  <div style={{ marginTop: "10px", fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
                    ✅ Auto-detected: {ftProjects.find((p:any)=>p.id===bProjId)?.name}
                  </div>
                )}
                <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                  <button onClick={saveBank} style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>💾 Save</button>
                  <button onClick={()=>setShowAddBank(false)} style={{ background: "#334155", color: "#94a3b8", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Transaction Table */}
            <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#0f172a" }}>
                      {["Date","Description","Reference","Credit","Debit","Project","Action"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left" as const, fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ftBankTxns.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: "center" as const, padding: "30px", color: "#475569" }}>No transactions yet.</td></tr>
                    ) : [...ftBankTxns].reverse().map((t:any) => {
                      const proj = ftProjects.find((p:any)=>p.id===t.projectId);
                      return (
                        <tr key={t.id} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "12px" }}>{t.date}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>{t.description}</td>
                          <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "12px" }}>{t.reference||"—"}</td>
                          <td style={{ padding: "10px 14px", color: "#10b981", fontWeight: 700 }}>{t.credit ? fmtFT(t.credit) : "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#ef4444", fontWeight: 700 }}>{t.debit ? fmtFT(t.debit) : "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            {proj ? <span style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>{proj.name.substring(0,16)}</span>
                              : <span style={{ color: "#ef4444", fontSize: "11px" }}>Unlinked</span>}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <button onClick={() => saveFtBank(ftBankTxns.filter((x:any)=>x.id!==t.id))}
                              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTS ── */}
        {ftPage === "projects" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>🏗️ Projects</div>
              <button onClick={() => { resetProjectForm(); setShowAddProject(true); }} style={{ background: "#b45309", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>+ New Project</button>
            </div>

            {/* Add/Edit Form */}
            {showAddProject && (
              <div style={{ background: "#1e293b", borderRadius: "12px", padding: "20px", border: "1px solid #334155", marginBottom: "20px" }}>
                <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px" }}>{editProj ? "✏️ Edit Project" : "🏗️ New Project"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                  {([
                    {label:"Project Name *",val:pName,set:setPName,span:2},
                    {label:"Location *",val:pLoc,set:setPLoc},
                    {label:"Contract Amount (₹)",val:pContract,set:setPContract,type:"number"},
                    {label:"GST Amount (₹)",val:pGst,set:setPGst,type:"number"},
                    {label:"TDS Amount (₹)",val:pTds,set:setPTds,type:"number"},
                    {label:"Labour Cost (₹)",val:pLabour,set:setPLabour,type:"number"},
                    {label:"EMD Amount (₹)",val:pEmd,set:setPEmd,type:"number"},
                    {label:"Amount Received (₹)",val:pReceived,set:setPReceived,type:"number"},
                    {label:"Keywords (auto-link)",val:pKeywords,set:setPKeywords,placeholder:"e.g. ABC, road, contract1"}
                  ] as any[]).map((f:any) => (
                    <div key={f.label} style={f.span?{gridColumn:`span ${f.span}`}:{}}>
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>{f.label}</div>
                      <input type={f.type||"text"} value={f.val} onChange={e=>f.set(e.target.value)}
                        placeholder={f.placeholder||""}
                        style={{ width: "100%", padding: "8px 10px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9", fontSize: "13px", outline: "none" }} />
                    </div>
                  ))}
                </div>
                {pContract && pReceived && (
                  <div style={{ marginTop: "10px", fontSize: "13px", color: "#ef4444", fontWeight: 700 }}>
                    Pending: {fmtFT(Math.max(0, (parseFloat(pContract)||0)-(parseFloat(pReceived)||0)))}
                  </div>
                )}
                <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                  <button onClick={saveProject} style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>💾 Save Project</button>
                  <button onClick={() => { setShowAddProject(false); resetProjectForm(); }} style={{ background: "#334155", color: "#94a3b8", border: "none", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Projects Grid */}
            {ftProjects.length === 0 ? (
              <div style={{ textAlign: "center" as const, color: "#475569", padding: "40px" }}>No projects yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
                {ftProjects.map((p:any) => {
                  const pct = p.contract ? Math.min(100, Math.round(p.received/p.contract*100)) : 0;
                  return (
                    <div key={p.id} style={{ background: "#1e293b", borderRadius: "12px", padding: "18px", border: "1px solid #334155" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <div style={{ fontWeight: 700, fontSize: "14px" }}>{p.name}</div>
                        <span style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>{p.status}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>📍 {p.location}</div>
                      <div style={{ background: "#0f172a", borderRadius: "4px", height: "6px", marginBottom: "6px" }}>
                        <div style={{ background: pct>80?"#10b981":pct>40?"#f59e0b":"#3b82f6", height: "100%", width: pct+"%", borderRadius: "4px", transition: "width 0.5s" }}></div>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>{pct}% received</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px", marginBottom: "12px" }}>
                        {[
                          {l:"Contract",v:p.contract,c:"#f1f5f9"},
                          {l:"Received",v:p.received,c:"#10b981"},
                          {l:"Pending",v:p.pending,c:"#ef4444"}
                        ].map(s=>(
                          <div key={s.l} style={{ background: "#0f172a", borderRadius: "8px", padding: "6px", textAlign: "center" as const }}>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>{s.l}</div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: s.c, marginTop: "2px" }}>{fmtFT(s.v)}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
                        {p.gst ? <span style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", fontSize: "10px", padding: "2px 7px", borderRadius: "8px" }}>GST: {fmtFT(p.gst)}</span> : null}
                        {p.tds ? <span style={{ background: "rgba(100,116,139,0.1)", color: "#94a3b8", fontSize: "10px", padding: "2px 7px", borderRadius: "8px" }}>TDS: {fmtFT(p.tds)}</span> : null}
                      </div>
                      <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                        <button onClick={() => openEditProject(p)} style={{ flex: 1, background: "#1a2f5e", color: "#93c5fd", border: "none", padding: "6px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>✏️ Edit</button>
                        <button onClick={() => deleteProject(p.id)} style={{ flex: 1, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", padding: "6px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>🗑️ Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS ── */}
        {ftPage === "reports" && (
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>📈 Financial Reports</div>

            {/* GST + TDS Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div style={{ background: "#1e293b", borderRadius: "12px", padding: "18px", border: "1px solid #334155" }}>
                <div style={{ fontWeight: 700, marginBottom: "12px" }}>🧭 GST Summary</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a2942" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>ERP GST Total</span>
                  <span style={{ fontWeight: 700, color: "#7c3aed" }}>{fmtFT(erpTotalGST)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a2942" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>FinTrack Projects GST</span>
                  <span style={{ fontWeight: 700, color: "#7c3aed" }}>{fmtFT(ftProjects.reduce((s:number,p:any)=>s+(p.gst||0),0))}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>Combined GST</span>
                  <span style={{ fontWeight: 800, color: "#a78bfa", fontSize: "16px" }}>{fmtFT(erpTotalGST + ftProjects.reduce((s:number,p:any)=>s+(p.gst||0),0))}</span>
                </div>
              </div>
              <div style={{ background: "#1e293b", borderRadius: "12px", padding: "18px", border: "1px solid #334155" }}>
                <div style={{ fontWeight: 700, marginBottom: "12px" }}>📊 Net Financial Position</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a2942" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>Total Income</span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>{fmtFT(erpWalletCredit + ftTotalCredit)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a2942" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>Total Expense</span>
                  <span style={{ fontWeight: 700, color: "#ef4444" }}>{fmtFT(erpWalletDebit + ftTotalDebit)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>Net Profit/Loss</span>
                  <span style={{ fontWeight: 800, fontSize: "16px", color: (erpWalletCredit+ftTotalCredit)>(erpWalletDebit+ftTotalDebit)?"#10b981":"#ef4444" }}>
                    {fmtFT((erpWalletCredit+ftTotalCredit)-(erpWalletDebit+ftTotalDebit))}
                  </span>
                </div>
              </div>
            </div>

            {/* Project-wise Report Table */}
            <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #334155", fontWeight: 700, fontSize: "14px" }}>🏗️ Project-wise Financial Report</div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#0f172a" }}>
                      {["#","Project","Location","Contract","GST","TDS","Labour","EMD","Received","Pending","Progress"].map(h=>(
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ftProjects.length === 0 ? (
                      <tr><td colSpan={11} style={{ textAlign: "center" as const, padding: "30px", color: "#475569" }}>No projects.</td></tr>
                    ) : ftProjects.map((p:any, i:number) => {
                      const pct = p.contract ? Math.min(100, Math.round(p.received/p.contract*100)) : 0;
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #1a2942" }}>
                          <td style={{ padding: "10px 12px", color: "#64748b" }}>{i+1}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{p.name}</td>
                          <td style={{ padding: "10px 12px", color: "#64748b", fontSize: "12px" }}>{p.location}</td>
                          <td style={{ padding: "10px 12px" }}>{fmtFT(p.contract)}</td>
                          <td style={{ padding: "10px 12px", color: "#a78bfa" }}>{fmtFT(p.gst)}</td>
                          <td style={{ padding: "10px 12px", color: "#fbbf24" }}>{fmtFT(p.tds)}</td>
                          <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{fmtFT(p.labour)}</td>
                          <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{fmtFT(p.emd)}</td>
                          <td style={{ padding: "10px 12px", color: "#10b981", fontWeight: 700 }}>{fmtFT(p.received)}</td>
                          <td style={{ padding: "10px 12px", color: "#ef4444", fontWeight: 700 }}>{fmtFT(p.pending)}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ background: "#0f172a", borderRadius: "4px", height: "6px", width: "60px" }}>
                                <div style={{ background: pct>80?"#10b981":pct>40?"#f59e0b":"#3b82f6", height: "100%", width: pct+"%", borderRadius: "4px" }}></div>
                              </div>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ERP Open Transactions */}
            {transactions.filter(t=>t.status==="Open").length > 0 && (
              <div style={{ marginTop: "16px", background: "#1e293b", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.2)", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #334155", fontWeight: 700, fontSize: "14px", color: "#ef4444" }}>
                  ⚠️ ERP Open Transactions (Pending Close)
                </div>
                <div style={{ overflowX: "auto" as const }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#0f172a" }}>
                        {["TXN ID","Vendor","District","Expected","Remaining","Status"].map(h=>(
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left" as const, fontSize: "11px", color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.filter(t=>t.status==="Open").map(t=>(
                        <tr key={t.txnId} style={{ borderBottom: "1px solid #1a2942" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#93c5fd" }}>{t.txnId}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>{t.vendorName}</td>
                          <td style={{ padding: "8px 12px", color: "#64748b" }}>{t.district}</td>
                          <td style={{ padding: "8px 12px" }}>{fmtFT(t.expectedAmount)}</td>
                          <td style={{ padding: "8px 12px", color: "#ef4444", fontWeight: 700 }}>{fmtFT(t.remainingExpected)}</td>
                          <td style={{ padding: "8px 12px" }}><span style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>Open</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// RECONCILIATION PAGE — Contract Work ⇔ Bank Statement Match
// ============================================================
function ReconciliationPage({ onBack }: { onBack: () => void }) {
  const [contractData, setContractData] = useState<any[]>([]);
  const [bankData, setBankData] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary"|"matched"|"unmatched"|"bank">("summary");
  const [loaded, setLoaded] = useState(false);

  // Sheet IDs
  const SHEET_ID = "1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw";  // Contract Work sheets
  // Bank Statement — same sheet or published CSV URL
  const BANK_SHEET_PUBLISHED_ID = "2PACX-1vT4U0YKYbaJwmt4I7MW2O4ITS-8YImAHpNLFCS9M_9BbF5qO2Hi-s1R59osAEQXc_RhnpRv9yZUgnRK";

  // Sheet GID map — Google Sheet-ல் tab click செய்து URL-ல் gid பார்க்கவும்
  const SHEET_TABS: Record<string, string> = {
    "Contract work 2024-25":             "Contract%20work%202024-25",
    "Contract Work FY 23-23 to 23-24":  "Contract%20Work%20FY%2023-23%20to%2023-24",
    "Contract work 2025-26":             "Contract%20work%202025-26",
  };

  const fmtR = (n: number) => "₹" + (n||0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

  // Parse amount from cell value
  // Handles: 684751 | $684751 | $ 684751.00 | ₹6,84,751 | #60,000.00 | "  $ 684751.00  "
  const parseAmt = (val: any): number => {
    if (!val && val !== 0) return 0;
    if (typeof val === "number") return Math.abs(val);
    const s = String(val)
      .replace(/[$₹₹,\s#\x00-\x1f\x7f]/g, "") // remove $, ₹, commas, spaces, control chars
      .replace(/[^0-9.-]/g, "")                        // keep only digits, dot, minus
      .trim();
    if (!s) return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.abs(n);
  };

  // Parse date string — handles multiple formats
  const parseDate = (val: any): Date | null => {
    if (!val) return null;
    const s = String(val).trim().replace(/"/g, "");
    if (!s || s === "-" || s === "" || s === "null") return null;

    const MONTHS: Record<string,number> = {
      jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
      jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
    };

    // DD/MM/YYYY or DD-MM-YYYY (Indian format — day first)
    const m1 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m1) {
      const day = +m1[1], month = +m1[2], year = +m1[3];
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12)
        return new Date(year, month - 1, day);
    }

    // DD-Mon-YYYY or DD-Mon-YY (e.g. 08-Apr-2025 or 08-Apr-25)
    const m2 = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ]?(\d{2,4})$/);
    if (m2) {
      const mon = MONTHS[m2[2].toLowerCase()];
      const year = +m2[3] < 100 ? 2000 + +m2[3] : +m2[3];
      if (mon !== undefined) return new Date(year, mon, +m2[1]);
    }

    // Mon-DD-YYYY or Mon DD, YYYY (e.g. Apr-08-2025)
    const m3 = s.match(/^([A-Za-z]{3})[- ](\d{1,2})[ ,]*(\d{4})$/);
    if (m3) {
      const mon = MONTHS[m3[1].toLowerCase()];
      if (mon !== undefined) return new Date(+m3[3], mon, +m3[2]);
    }

    // YYYY-MM-DD (ISO format)
    const m4 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m4) return new Date(+m4[1], +m4[2]-1, +m4[3]);

    // DD/MM/YY short (Bank Statement — MM/DD/YY handled separately in bank loop)
    const m5 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m5) {
      // Try DD/MM/YY first (Indian)
      const d = +m5[1], mo = +m5[2], yr = 2000 + +m5[3];
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12)
        return new Date(yr, mo - 1, d);
    }

    return null;
  };

  const fmtDate = (d: Date | null): string => {
    if (!d) return "";
    return d.getDate().toString().padStart(2,"0") + "/" +
           (d.getMonth()+1).toString().padStart(2,"0") + "/" + d.getFullYear();
  };

  // Load data from published CSV
  const loadSheetCSV = async (sheetName: string): Promise<string[][]> => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      return text.split("\n").map(line => {
        const cols: string[] = [];
        let cur = "", inQ = false;
        for (const ch of line) {
          if (ch === '"') inQ = !inQ;
          else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
          else cur += ch;
        }
        cols.push(cur);
        return cols;
      });
    } catch { return []; }
  };

  const runReconciliation = async () => {
    setLoading(true);
    try {
      // Load Contract sheets
      const allContracts: any[] = [];
      for (const [name, encoded] of Object.entries(SHEET_TABS)) {
        const rows = await loadSheetCSV(encoded);
        if (rows.length < 2) continue;
        // Find header row
        let hRow = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          if (rows[i].some(c => c.toLowerCase().includes("receipt"))) { hRow = i; break; }
        }
        const headers = rows[hRow].map(h => h.toLowerCase().replace(/["\s]/g, ""));
        const col = (k: string) => headers.findIndex(h => h.includes(k));
        const workCol    = col("workname") !== -1 ? col("workname") : col("works") !== -1 ? col("works") : 1;
        const amtCol     = col("receiptamount") !== -1 ? col("receiptamount") : col("receiveblea") !== -1 ? col("receiveblea") : col("receivable") !== -1 ? col("receivable") : -1;
        const taxCol     = col("taxablevalue");
        const gstCol     = col("18%gst") !== -1 ? col("18%gst") : col("gst");
        const partyCol   = col("party");
        // Date — receipt date column first, otherwise any column with date
        const receiptDateCol = col("receiptdate") !== -1 ? col("receiptdate") : col("date");

        for (let i = hRow + 1; i < rows.length; i++) {
          const r = rows[i];
          const workName = r[workCol]?.replace(/"/g, "").trim();
          const receiptAmt = amtCol >= 0 ? parseAmt(r[amtCol]) : 0;
          if (!receiptAmt || receiptAmt === 0) continue;

          // ✅ Date strategy: receipt date column-ல் இல்லாவிட்டால்,
          // எந்த column-லும் date format (அதாவது DD/MM/YYYY அல்லது DD-MM-YYYY) இருந்தாலும் எடுத்துக்கோள்
          let receiptDate: Date | null = null;
          let receiptDateStr = "";

          // First try the dedicated receipt date column
          if (receiptDateCol >= 0 && r[receiptDateCol]) {
            const raw = r[receiptDateCol].replace(/"/g, "").trim();
            receiptDate = parseDate(raw);
            receiptDateStr = fmtDate(receiptDate);
          }

          // If no date found, scan ALL columns for any parseable date
          if (!receiptDate) {
            for (let ci = 0; ci < r.length; ci++) {
              const cell = (r[ci] || "").replace(/"/g, "").trim();
              // Must look like a date: DD/MM/YYYY or DD-MM-YYYY
              if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(cell)) {
                const parsed = parseDate(cell);
                if (parsed) {
                  receiptDate = parsed;
                  receiptDateStr = fmtDate(parsed);
                  break;
                }
              }
            }
          }

          allContracts.push({
            rowIndex: i, sheetName: name, workName: workName || "",
            party: partyCol >= 0 ? r[partyCol]?.replace(/"/g, "") : "",
            receiptAmount: receiptAmt, receiptDate, receiptDateStr,
            taxableValue: taxCol >= 0 ? parseAmt(r[taxCol]) : 0,
            gstAmount: gstCol >= 0 ? parseAmt(r[gstCol]) : 0,
            matchStatus: "UNMATCHED", matchedBank: null
          });
        }
      }

      // Load Bank Statement — try multiple URLs
      // AR_ERP_Pudukkottai published sheet-ல் "Polinchi B/S 1712" tab இருக்கிறது
      // gid = tab-specific ID. Tab name-ஐ URL-encode செய்தும் try செய்கிறோம்
      const loadBankCSV = async (): Promise<string[][]> => {
        // 📌 இங்கே இருக்கும் வழிமுறைகள்:
        // 1. AR_ERP_Pudukkottai published sheet — "Polinchi B/S 1712" tab gid
        //    Google Sheet → "Polinchi B/S 1712" tab click → URL-ல் gid=XXXXXXXXX பார்க்கவும்
        //    பிறகு இல் கீழே BANK_GID-ஐ update செய்யவும்
        const BANK_GID = "2024650928"; // ✅ "Polinchi B/S 1712" tab gid
        // Sri Polinchi sheet-ல் "Polinchi B/S 1712" tab உள்ளது — gid=2024650928
        // AR_ERP_Pudukkottai published sheet-ஐ use செய்கிறோம் (bank sheet-ஐ publish செய்திருக்கலாம்)
        const urls = [
          // ✅ #1 BEST: AR_ERP_Pudukkottai — gid=2024650928 (Polinchi B/S 1712)
          `https://docs.google.com/spreadsheets/d/e/${BANK_SHEET_PUBLISHED_ID}/pub?output=csv&gid=${BANK_GID}`,
          // ✅ #2: Same Sri Polinchi sheet — gviz (public share ஆகிஇருந்தால் works)
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Polinchi%20B%2FS%201712`,
          // ✅ #3: By gid
          `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${BANK_GID}`,
          // ✅ #4: AR_ERP_Pudukkottai — sheet name param
          `https://docs.google.com/spreadsheets/d/e/${BANK_SHEET_PUBLISHED_ID}/pub?output=csv&sheet=Polinchi%20B%2FS%201712`,
        ];
        const parseCSV = (text: string): string[][] =>
          text.split("\n").map(line => {
            const cols: string[] = [];
            let cur = "", inQ = false;
            for (const ch of line) {
              if (ch === '"') inQ = !inQ;
              else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
              else cur += ch;
            }
            cols.push(cur);
            return cols;
          });
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (!res.ok) { console.log(`HTTP ${res.status} for ${url}`); continue; }
            const text = await res.text();
            if (!text || text.length < 100 || text.includes('<!DOCTYPE') || text.includes('<html')) {
              console.log(`Invalid response from ${url}`);
              continue;
            }
            const rows = parseCSV(text);
            // Validate: check if it looks like bank data (has date-like content)
            const hasData = rows.some(r => r.some(c => /\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4}/.test(c)));
            if (rows.length > 5 && hasData) {
              console.log(`✅ Bank CSV loaded: ${rows.length} rows from ${url}`);
              return rows;
            }
            console.log(`Loaded but no valid data from ${url}, rows=${rows.length}`);
          } catch(e) { console.log(`❌ Failed: ${url}`, e); }
        }
        console.error("❌ All bank URLs failed! Sheet may not be published.");
        return [];
      };
      const bankRows = await loadBankCSV();
      const allBank: any[] = [];

      // ✅ Bank column structure (confirmed):
      // CREDIT: col1=date col2=desc col5='' col6='$ amount' col7='$ balance'
      // DEBIT:  col1=date col2=desc col5='#amount' col6='$ balance' col7=''
      for (let i = 5; i < bankRows.length; i++) {
        const r = bankRows[i].map((c: string) => String(c || "").replace(/"/g, "").trim());
        if (!r || r.length < 6) continue;
        const dateVal = r[1];
        if (!dateVal || dateVal.length < 5) continue;
        let parsedDate: Date | null = null;
        const sd = dateVal.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
        const ld = dateVal.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (sd) parsedDate = new Date(2000 + +sd[3], +sd[1] - 1, +sd[2]);
        else if (ld) parsedDate = new Date(+ld[3], +ld[2] - 1, +ld[1]);
        if (!parsedDate || isNaN(parsedDate.getTime())) continue;
        const desc = (r[2] || "").replace(/\s+/g, " ").trim();
        const c5 = (r[5] || "").trim();
        const c6 = (r[6] || "").trim();
        const c7 = (r[7] || "").trim();
        let credit = 0, debit = 0, balance = 0;
        if (c5 === "" && c6.includes("$") && c7.includes("$")) {
          credit = parseAmt(c6); balance = parseAmt(c7);
        } else if (c5.includes("#")) {
          debit = parseAmt(c5); balance = parseAmt(c6);
        } else if (c5 === "" && c6.includes("$")) {
          credit = parseAmt(c6);
        } else { continue; }
        if (!credit && !debit) continue;
        allBank.push({ rowIndex: i, date: parsedDate, dateStr: fmtDate(parsedDate), description: desc, debit, credit, balance, matchStatus: "UNMATCHED", matchedContract: null });
      }
      const bankCr = allBank.filter((b: any) => b.credit > 0);
      console.log(`✅ Bank: ${allBank.length} rows, ${bankCr.length} credits`);
      if (bankCr.length > 0) console.log(`First credit: ${bankCr[0].dateStr} | ₹${bankCr[0].credit}`);
      else console.error("❌ 0 credits");

      // Reconcile
      const usedBank = new Set<number>();
      const usedContract = new Set<number>();
      const reconcileResults: any[] = [];

      // DEBUG: Bank credits உள்ளதா என்று சரிபார்க்க
      const bankCredits = allBank.filter(b => b.credit > 0);
      console.log(`Bank loaded: ${allBank.length} rows, ${bankCredits.length} credits`);
      console.log(`Contracts loaded: ${allContracts.length}`);
      if (allContracts.length > 0) {
        console.log(`First contract: amt=${allContracts[0].receiptAmount} date=${allContracts[0].receiptDateStr}`);
      }
      if (bankCredits.length > 0) {
        console.log(`First bank credit: amt=${bankCredits[0].credit} date=${bankCredits[0].dateStr}`);
      }

      // Pass 1: Exact match — same amount + date within 3 days
      allContracts.forEach((c, ci) => {
        if (!c.receiptAmount) return;
        const bankMatch = allBank.find((b, bi) => {
          if (usedBank.has(bi) || !b.credit) return false;
          // Amount match: ₹1 tolerance
          const amtMatch = Math.abs(b.credit - c.receiptAmount) <= 1;
          // Date match: ±3 days
          const dateMatch = c.receiptDate && b.date ?
            Math.abs(c.receiptDate.getTime() - b.date.getTime()) <= 3 * 86400000 : false;
          return amtMatch && dateMatch;
        });
        if (bankMatch) {
          const bi = allBank.indexOf(bankMatch);
          usedBank.add(bi); usedContractSet(ci, usedContract);
          allBank[bi].matchStatus = "MATCHED"; allBank[bi].matchedContract = c;
          allContracts[ci].matchStatus = "MATCHED"; allContracts[ci].matchedBank = bankMatch;
          reconcileResults.push({
            status: "MATCHED", matchType: "Exact (Date+Amount)",
            workName: c.workName, sheet: c.sheetName,
            contractDate: c.receiptDateStr, bankDate: bankMatch.dateStr,
            contractAmt: c.receiptAmount, bankAmt: bankMatch.credit,
            diff: Math.abs(bankMatch.credit - c.receiptAmount),
            bankDesc: bankMatch.description, party: c.party
          });
        }
      });

      // Pass 2: Amount-only match (date இல்லாதவை அல்லது date ±15 days)
      allContracts.forEach((c, ci) => {
        if (usedContract.has(ci) || !c.receiptAmount) return;
        const bankMatch = allBank.find((b, bi) => {
          if (usedBank.has(bi) || !b.credit) return false;
          const amtMatch = Math.abs(b.credit - c.receiptAmount) <= 1;
          if (!amtMatch) return false;
          // Date இல்லாவிட்டாலும் amount match ஆனால் partial
          if (!c.receiptDate || !b.date) return amtMatch;
          // Date within 15 days
          return Math.abs(c.receiptDate.getTime() - b.date.getTime()) <= 15 * 86400000;
        });
        if (bankMatch) {
          const bi = allBank.indexOf(bankMatch);
          usedBank.add(bi); usedContractSet(ci, usedContract);
          allBank[bi].matchStatus = "PARTIAL"; allBank[bi].matchedContract = c;
          allContracts[ci].matchStatus = "PARTIAL"; allContracts[ci].matchedBank = bankMatch;
          reconcileResults.push({
            status: "PARTIAL", matchType: "Amount Only",
            workName: c.workName, sheet: c.sheetName,
            contractDate: c.receiptDateStr, bankDate: bankMatch.dateStr,
            contractAmt: c.receiptAmount, bankAmt: bankMatch.credit,
            diff: Math.abs(bankMatch.credit - c.receiptAmount),
            bankDesc: bankMatch.description, party: c.party
          });
        }
      });

      // Pass 3: Unmatched
      allContracts.forEach((c, ci) => {
        if (!usedContract.has(ci)) {
          reconcileResults.push({
            status: "UNMATCHED", matchType: "No Match",
            workName: c.workName, sheet: c.sheetName,
            contractDate: c.receiptDateStr, bankDate: null,
            contractAmt: c.receiptAmount, bankAmt: 0,
            diff: c.receiptAmount, bankDesc: null, party: c.party
          });
        }
      });

      setContractData(allContracts);
      setBankData(allBank);
      setResults(reconcileResults);
      setLoaded(true);
    } catch (e) {
      console.error("Reconciliation error:", e);
    }
    setLoading(false);
  };

  // Helper: add to Set
  const usedContractSet = (ci: number, set: Set<number>) => set.add(ci);

  const matched   = results.filter(r => r.status === "MATCHED");
  const partial   = results.filter(r => r.status === "PARTIAL");
  const unmatched = results.filter(r => r.status === "UNMATCHED");
  const unmatchedBank = bankData.filter(b => b.credit > 0 && b.matchStatus === "UNMATCHED");
  const matchPct  = results.length ? Math.round((matched.length / results.length) * 100) : 0;
  const totalContractAmt = results.reduce((s, r) => s + (r.contractAmt||0), 0);
  const matchedAmt = matched.reduce((s, r) => s + (r.contractAmt||0), 0);

  const cardStyle = (color: string) => ({
    background: "#1e293b", borderRadius: "12px", padding: "18px",
    border: `1px solid #334155`, position: "relative" as const, overflow: "hidden" as const
  });

  const tabBtn = (id: typeof activeTab, label: string, count: number, color: string) => (
    <button key={id} onClick={() => setActiveTab(id)} style={{
      padding: "8px 16px", border: "none", background: "transparent",
      color: activeTab === id ? color : "#64748b",
      fontWeight: activeTab === id ? 700 : 500, fontSize: "13px",
      cursor: "pointer", borderBottom: activeTab === id ? `2px solid ${color}` : "2px solid transparent",
      whiteSpace: "nowrap" as const, transition: "all 0.2s"
    }}>
      {label} <span style={{ background: activeTab===id?color:"#334155", color: activeTab===id?"#fff":"#94a3b8", padding: "1px 6px", borderRadius: "10px", fontSize: "11px", marginLeft: "4px" }}>{count}</span>
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Segoe UI', sans-serif", color: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
            ← Back
          </button>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>🔄 Bank Reconciliation</div>
            <div style={{ fontSize: "11px", color: "#bfdbfe" }}>Contract Work ⇔ Bank Statement Auto Match</div>
          </div>
        </div>
        <button onClick={runReconciliation} disabled={loading} style={{
          background: loading ? "#334155" : "linear-gradient(135deg, #10b981, #059669)",
          border: "none", color: "#fff", padding: "8px 20px", borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700
        }}>
          {loading ? "🔄 Loading..." : loaded ? "↻ Re-run" : "▶️ Run Reconciliation"}
        </button>
      </div>

      <div style={{ padding: "24px" }}>
        {!loaded && !loading && (
          <div style={{ textAlign: "center" as const, padding: "60px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔄</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9", marginBottom: "8px" }}>Bank Reconciliation Tool</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px", maxWidth: "500px", margin: "0 auto 24px", lineHeight: 1.6 }}>
              Contract Work sheets-ல் உள்ள Receipt Amount-ஐ Bank Statement Credits-உடன் தானாகவே match செய்யும்.
              ✅ Exact match (Date + Amount) &nbsp; ⚠️ Partial (Amount only) &nbsp; ❌ Unmatched
            </div>
            <button onClick={runReconciliation} style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              border: "none", color: "#fff", padding: "12px 32px",
              borderRadius: "10px", cursor: "pointer", fontSize: "15px", fontWeight: 700
            }}>▶️ Start Reconciliation</button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center" as const, padding: "60px" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔄</div>
            <div style={{ fontSize: "14px", color: "#93c5fd" }}>Google Sheets data load ஆகிருகிறது...</div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "8px" }}>Contract work tabs + Bank Statement பார்க்கிறோம்</div>
          </div>
        )}

        {loaded && !loading && (
          <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
              {[
                { label: "Match Rate", value: matchPct + "%", sub: `${matched.length} of ${results.length}`, color: "#10b981" },
                { label: "✅ Matched", value: matched.length, sub: fmtR(matchedAmt), color: "#10b981" },
                { label: "⚠️ Partial", value: partial.length, sub: "Amount match only", color: "#f59e0b" },
                { label: "❌ Unmatched", value: unmatched.length, sub: fmtR(totalContractAmt - matchedAmt), color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={cardStyle(s.color)}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: s.color }}></div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const }}>{s.label}</div>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: s.color, marginTop: "4px" }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Match % bar */}
            <div style={{ background: "#1e293b", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", border: "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Overall Match Rate</span>
                <span style={{ fontWeight: 800, color: matchPct > 80 ? "#10b981" : matchPct > 50 ? "#f59e0b" : "#ef4444" }}>{matchPct}%</span>
              </div>
              <div style={{ background: "#0f172a", borderRadius: "4px", height: "12px" }}>
                <div style={{ height: "100%", borderRadius: "4px", width: matchPct + "%", background: matchPct > 80 ? "#10b981" : matchPct > 50 ? "#f59e0b" : "#ef4444", transition: "width 1s" }}></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "#475569" }}>
                <span>Contract Total: {fmtR(totalContractAmt)}</span>
                <span>Matched: {fmtR(matchedAmt)}</span>
                <span>Unmatched: {fmtR(totalContractAmt - matchedAmt)}</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", gap: "2px", overflowX: "auto" as const, marginBottom: "16px", borderRadius: "10px 10px 0 0" }}>
              {tabBtn("summary",   "📊 Summary",   results.length, "#3b82f6")}
              {tabBtn("matched",   "✅ Matched",   matched.length, "#10b981")}
              {tabBtn("unmatched", "❌ Unmatched", unmatched.length, "#ef4444")}
              {tabBtn("bank",      "🏦 Unmatched Bank", unmatchedBank.length, "#f59e0b")}
            </div>

            {/* Table */}
            <div style={{ background: "#1e293b", borderRadius: "0 0 12px 12px", border: "1px solid #334155", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#0f172a" }}>
                      {(activeTab !== "bank" ? [
                        "Status", "Work Name", "Sheet", "Contract Date", "Bank Date",
                        "Contract Amt", "Bank Credit", "Diff", "Bank Description"
                      ] : ["Date", "Description", "Credit Amount"]).map((h: string) => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left" as const, fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab !== "bank" ? (
                      (activeTab === "matched" ? [...matched, ...partial] :
                       activeTab === "unmatched" ? unmatched : results
                      ).map((r: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1a2942" }}>
                          <td style={{ padding: "8px 12px", whiteSpace: "nowrap" as const }}>
                            <span style={{
                              background: r.status==="MATCHED"?"rgba(16,185,129,0.15)":r.status==="PARTIAL"?"rgba(245,158,11,0.15)":"rgba(239,68,68,0.15)",
                              color: r.status==="MATCHED"?"#10b981":r.status==="PARTIAL"?"#f59e0b":"#ef4444",
                              padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700
                            }}>
                              {r.status==="MATCHED"?"✅":r.status==="PARTIAL"?"⚠️":"❌"} {r.status}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontWeight: 600, color: "#f1f5f9" }}>{r.workName || "—"}</td>
                          <td style={{ padding: "8px 12px", color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" as const }}>{r.sheet?.replace("Contract work ","")?.replace("Contract Work ","")}</td>
                          <td style={{ padding: "8px 12px", color: "#94a3b8", whiteSpace: "nowrap" as const }}>{r.contractDate || "—"}</td>
                          <td style={{ padding: "8px 12px", color: r.bankDate ? "#93c5fd" : "#ef4444", whiteSpace: "nowrap" as const }}>{r.bankDate || "❌ None"}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap" as const }}>{fmtR(r.contractAmt)}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: r.bankAmt ? "#10b981" : "#475569", whiteSpace: "nowrap" as const }}>{r.bankAmt ? fmtR(r.bankAmt) : "—"}</td>
                          <td style={{ padding: "8px 12px", color: r.diff < 2 ? "#10b981" : "#f59e0b", whiteSpace: "nowrap" as const }}>{r.diff < 2 ? "✓" : fmtR(r.diff)}</td>
                          <td style={{ padding: "8px 12px", color: "#64748b", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.bankDesc || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      unmatchedBank.map((b: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1a2942" }}>
                          <td style={{ padding: "8px 12px", color: "#f59e0b", whiteSpace: "nowrap" as const }}>{b.dateStr}</td>
                          <td style={{ padding: "8px 12px", color: "#f1f5f9", fontWeight: 600 }}>{b.description}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: "#10b981", whiteSpace: "nowrap" as const }}>{fmtR(b.credit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {((activeTab !== "bank" && results.length === 0) || (activeTab === "bank" && unmatchedBank.length === 0)) && (
                  <div style={{ textAlign: "center" as const, padding: "30px", color: "#475569" }}>No records found.</div>
                )}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginTop: "12px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#93c5fd" }}>
              💡 <strong>Google Apps Script</strong>-ல் auto-highlight feature-உம் உள்ளது — Sheet-ல் ✅ Green / ⚠️ Yellow / ❌ Red color-coding ஆகும்.
              <br/><code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: "4px" }}>F:\AR Enterprises\GoogleAppsScript_Reconciliation.txt</code> — Google Sheets Apps Script-ல் paste செய்யவும்
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
