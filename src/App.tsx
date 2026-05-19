// ============================================================
// AR Enterprises ERP V3.0 — Single-file App.tsx (corrected)
//
// The original 6,915-line gist split into 19 files and fixed,
// now re-combined into ONE self-contained React + TypeScript file.
//
// HOW TO USE THIS FILE:
//
//   1. Create a fresh Vite + React + TypeScript project:
//        npm create vite@latest ar-erp -- --template react-ts
//        cd ar-erp
//
//   2. Install dependencies:
//        npm install
//
//   3. Replace src/App.tsx with the contents of THIS file.
//
//   4. Create a .env file in the project root (alongside package.json):
//        VITE_ADMIN_USERNAME=admin
//        VITE_ADMIN_BOOTSTRAP_PASSWORD=ChangeMe-Strong-987654
//        # (the bootstrap password is only used the very first
//        # time you log in as admin. Rotate it after.)
//        # All other VITE_ variables below are OPTIONAL:
//        VITE_SYNC_ENDPOINT=
//        VITE_AI_PROXY_URL=
//        VITE_AUDITOR_PROXY_URL=
//        VITE_WORKTRACKER_URL=
//        VITE_WORKTRACKER_SHEET_ID=
//
//   5. Run it:
//        npm run dev       (development)
//        npm run build     (production build → dist/)
//
//   6. On first launch click "Admin", log in with
//      "admin" + your bootstrap password. The hashed admin row is
//      created automatically. After that, manage users via
//      Settings → User Management.
//
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";


// ============================================================
// SECTION 1 — Type definitions
// ============================================================

interface User {
  id: string;
  username: string;
  password: string;
  role: "admin" | "district" | "agent" | "vendor";
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
  /** Hashed PIN used for vendor self-service login. */
  loginPinHash?: string;
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
  pendingAt?: string;
  /** Optional — populated when the txn was created via an agent. */
  createdByAgent?: string;
  agentName?: string;
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
  entity: "Transaction" | "Vendor" | "Bill" | "Wallet" | "User" | "Agent";
  entityId: string;
  before?: any;
  after?: any;
}

// ── Agent feature ───────────────────────────────────────────
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
  /** When true, this slab acts as a hard cutoff: at this GST% and above, no commission. */
  isThreshold?: boolean;
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

// ── GSTR-2B ─────────────────────────────────────────────────
interface Gstr2bRow {
  gstin: string;
  invoiceNo?: string;
  date: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
}

// ── Storage envelope ────────────────────────────────────────
interface StorageData {
  vendors: Vendor[];
  transactions: Transaction[];
  bills: Bill[];
  wallet: WalletEntry[];
  managedUsers: ManagedUser[];
  auditLogs: AuditLog[];
  agents: Agent[];
  agentWallet: AgentWalletEntry[];
  agentOverrides: AgentVendorOverride[];
  schemaVersion: number;
}

type LoginRole = "admin" | "district" | "agent" | "vendor";
type ToolRole = "fintrack" | "worktracker" | "reconciliation" | "auditor";

// ============================================================
// SECTION 2 — Constants
// ============================================================
const DISTRICTS = [
  "Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri",
  "Dindigul","Erode","Kallakurichi","Kanchipuram","Kanniyakumari","Karur",
  "Krishnagiri","Madurai","Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris",
  "Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivagangai",
  "Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirappalli","Tirunelveli",
  "Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore",
  "Viluppuram","Virudhunagar",
];

const GST_RATES = [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,12,18,28];

const MONTHS = [
  "April","May","June","July","August","September",
  "October","November","December","January","February","March",
];

const FY_LIST = ["2024-25","2025-26","2026-27","2027-28"];

const BUSINESS_TYPES = [
  "Hardware","Electrical","Civil","Plumbing","Mechanical",
  "Catering","Transport","Stationery","IT","Medical","General",
];

const DIST_SHORT: Record<string, string> = {
  "Ariyalur":"ARI","Chengalpattu":"CGP","Chennai":"CHE","Coimbatore":"CBE",
  "Cuddalore":"CUD","Dharmapuri":"DHP","Dindigul":"DGL","Erode":"ERD",
  "Kallakurichi":"KLK","Kanchipuram":"KCP","Kanniyakumari":"KNK","Karur":"KRR",
  "Krishnagiri":"KRG","Madurai":"MDU","Mayiladuthurai":"MYD","Nagapattinam":"NGP",
  "Namakkal":"NMK","Nilgiris":"NLG","Perambalur":"PBR","Pudukkottai":"PDK",
  "Ramanathapuram":"RMN","Ranipet":"RNP","Salem":"SLM","Sivagangai":"SVG",
  "Tenkasi":"TNK","Thanjavur":"TNJ","Theni":"THN","Thoothukudi":"TUT",
  "Tiruchirappalli":"TRP","Tirunelveli":"TNV","Tirupathur":"TPT","Tiruppur":"TPR",
  "Tiruvallur":"TVL","Tiruvannamalai":"TVM","Tiruvarur":"TVR","Vellore":"VLR",
  "Viluppuram":"VLP","Virudhunagar":"VRN",
};

const BIZ_SHORT: Record<string, string> = {
  "Hardware":"HW","Electrical":"EL","Civil":"CV","Plumbing":"PL",
  "Mechanical":"MC","Catering":"CT","Transport":"TR","Stationery":"ST",
  "IT":"IT","Medical":"MD","General":"GN",
};

const PROFIT_RATE = 0.08;             // 8 % default profit on close
const LS_KEY = "AR_ERP_V3_DATA_ENCRYPTED";   // historic name; plain JSON
const SESSION_KEY = "AR_SESSION";
const SCHEMA_VERSION = 2;

// ── Commission slabs ─────────────────────────────────────────
// `isThreshold: true` means "at this GST% and above → 0% commission".
const DEFAULT_COMMISSION_SLABS: CommissionSlab[] = [
  { gstPercent: 1,   agentCommission: 1.0  },
  { gstPercent: 1.5, agentCommission: 0.5  },
  { gstPercent: 2,   agentCommission: 0.25 },
  { gstPercent: 2.5, agentCommission: 0.1  },
  { gstPercent: 3,   agentCommission: 1.5  },
  { gstPercent: 3.5, agentCommission: 2.0  },
  { gstPercent: 4,   agentCommission: 0.3  },
  { gstPercent: 4.5, agentCommission: 0.75 },
  { gstPercent: 5,   agentCommission: 1.25 },
  { gstPercent: 5.5, agentCommission: 1.75 },
  { gstPercent: 6,   agentCommission: 0.0, isThreshold: true },
];

// ── AI proxy (browser-safe; never hits anthropic.com directly) ──
const AI_PROXY_URL: string = (import.meta as any).env?.VITE_AI_PROXY_URL || "";

// ── Auditor (Apps Script) — must be proxied server-side ──
const AUDITOR_PROXY_URL: string = (import.meta as any).env?.VITE_AUDITOR_PROXY_URL || "";

// ── Work Tracker (published Google Sheet embed) ──
const WORK_TRACKER_SHEET_URL: string = (import.meta as any).env?.VITE_WORKTRACKER_URL || "";
const WORK_TRACKER_SHEET_ID:  string = (import.meta as any).env?.VITE_WORKTRACKER_SHEET_ID || "";

// ============================================================
// SECTION 3 — Security utils (PBKDF2 hashing, sessions)
// ============================================================

const PBKDF2_ITERATIONS = 100_000;
const SALT_LEN = 16;
const HASH_LEN = 32;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hashPassword(password: string): Promise<string> {
  if (!password) throw new Error("Password is required");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey, HASH_LEN * 8
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(derived)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;
  if (!stored.startsWith("pbkdf2$")) return password === stored;
  const [, iterStr, saltB64, hashB64] = stored.split("$");
  const iter = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
  const salt = b64ToBuf(saltB64);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" },
    baseKey, HASH_LEN * 8
  );
  const a = new Uint8Array(derived);
  const b = b64ToBuf(hashB64);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function sanitizeInput(input: string): string {
  if (input == null) return "";
  return String(input)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 500);
}

interface Session {
  user: {
    id: string;
    username: string;
    role: "admin" | "district" | "agent" | "vendor";
    district?: string;
    password: string;
  };
  issuedAt: number;
  expiresAt: number;
}

function createSession(user: Session["user"], hours: number): Session {
  const now = Date.now();
  return { user, issuedAt: now, expiresAt: now + hours * 3600 * 1000 };
}
function isSessionValid(s: Session | null): boolean {
  return !!s && typeof s.expiresAt === "number" && s.expiresAt > Date.now();
}

// ============================================================
// SECTION 4 — Validation schemas
// ============================================================

type ValidatorResult = { valid: boolean; errors: string[] };

interface FieldSpec {
  required?: boolean;
  type?: "string" | "number" | "boolean";
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any, ctx: any) => string | null;
  message?: string;
}

type Schema = Record<string, FieldSpec>;

async function validateData(schema: Schema, data: Record<string, any>): Promise<ValidatorResult> {
  const errors: string[] = [];
  for (const [field, spec] of Object.entries(schema)) {
    const v = data?.[field];
    if (spec.required && (v === undefined || v === null || v === "")) {
      errors.push(`${field} is required`); continue;
    }
    if (v === undefined || v === null || v === "") continue;
    if (spec.type && typeof v !== spec.type && !(spec.type === "number" && !isNaN(Number(v)))) {
      errors.push(`${field} must be a ${spec.type}`); continue;
    }
    if (spec.type === "number") {
      const n = Number(v);
      if (spec.min !== undefined && n < spec.min) errors.push(`${field} must be ≥ ${spec.min}`);
      if (spec.max !== undefined && n > spec.max) errors.push(`${field} must be ≤ ${spec.max}`);
    }
    if (typeof v === "string") {
      if (spec.minLength !== undefined && v.length < spec.minLength) errors.push(`${field} too short`);
      if (spec.maxLength !== undefined && v.length > spec.maxLength) errors.push(`${field} too long`);
      if (spec.pattern && !spec.pattern.test(v)) errors.push(spec.message || `${field} format invalid`);
    }
    if (spec.custom) {
      const msg = spec.custom(v, data);
      if (msg) errors.push(msg);
    }
  }
  return { valid: errors.length === 0, errors };
}

const vendorSchema: Schema = {
  vendorName: { required: true, type: "string", minLength: 2, maxLength: 200 },
  district:   { required: true, type: "string" },
  mobile:     { type: "string", pattern: /^[0-9]{10}$/, message: "Mobile must be 10 digits" },
  gstNo:      { type: "string", pattern: /^[0-9A-Z]{15}$/, message: "GST No must be 15 chars (A-Z/0-9)" },
  email:      { type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" },
};

const transactionSchema: Schema = {
  expectedAmount: { required: true, type: "number", min: 0.01 },
  advanceAmount:  { type: "number", min: 0,
    custom: (v, ctx) => (Number(v) > Number(ctx.expectedAmount) ? "Advance cannot exceed expected" : null) },
};

const billSchema: Schema = {
  billNumber: { required: true, type: "string", minLength: 1, maxLength: 100 },
  billAmount: { required: true, type: "number", min: 0.01 },
  billDate:   { required: true, type: "string", minLength: 8 },
};

const userSchema: Schema = {
  username: { required: true, type: "string", minLength: 3, maxLength: 50, pattern: /^[a-zA-Z0-9_.-]+$/,
              message: "Username may only contain letters, numbers, _ . -" },
  password: { required: true, type: "string", minLength: 6, maxLength: 200 },
};

// ============================================================
// SECTION 5 — Google Sheets sync service
// ============================================================

const SYNC_ENDPOINT: string = (import.meta as any).env?.VITE_SYNC_ENDPOINT || "";
const SYNC_LOCK_KEY = "AR_SYNC_LOCK";

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

function isSyncConfigured(): boolean {
  return !!SYNC_ENDPOINT;
}

async function loadFromSheets(): Promise<void> {
  if (!isSyncConfigured()) return;
  try {
    const res = await fetch(`${SYNC_ENDPOINT}/load`, { credentials: "include" });
    if (!res.ok) throw new Error(`Load failed: ${res.status}`);
    const data = await res.json();
    if (data && typeof data === "object") {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    }
  } catch (err) {
    console.warn("[sheets] loadFromSheets:", err);
  }
}

async function saveToSheets(): Promise<void> {
  if (!isSyncConfigured()) return;
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  if (sessionStorage.getItem(SYNC_LOCK_KEY)) return;
  sessionStorage.setItem(SYNC_LOCK_KEY, "1");
  try {
    await fetch(`${SYNC_ENDPOINT}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: raw,
    });
  } catch (err) {
    console.warn("[sheets] saveToSheets:", err);
  } finally {
    sessionStorage.removeItem(SYNC_LOCK_KEY);
  }
}

function startAutoSync(intervalMinutes: number): () => void {
  stopAutoSync();
  if (!isSyncConfigured()) return () => {};
  autoSyncTimer = setInterval(() => { void saveToSheets(); }, intervalMinutes * 60 * 1000);
  return stopAutoSync;
}

function stopAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

// ============================================================
// SECTION 6 — Pure helpers (fmt, recalc, calcAgentCommission)
// ============================================================

const fmt = (n: number): string =>
  "₹" + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

const genId = (prefix: string): string =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7).toUpperCase();

function genAgentId(existing: Agent[]): string {
  const nums = existing
    .map(a => a.agentId)
    .filter(id => /^AGT\d+$/.test(id))
    .map(id => parseInt(id.slice(3), 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return "AGT" + String(next).padStart(3, "0");
}

function genVendorCode(
  district: string, bizType: string, year: string, existing: Vendor[]
): string {
  const d = DIST_SHORT[district] || district.slice(0, 3).toUpperCase();
  const b = BIZ_SHORT[bizType] || bizType.slice(0, 2).toUpperCase();
  const y = year ? year.slice(-2) : new Date().getFullYear().toString().slice(-2);
  const prefix = `${d}${y}${b}`;
  const used = new Set(
    existing
      .map(v => v.vendorCode)
      .filter(c => c.startsWith(prefix))
      .map(c => parseInt(c.slice(prefix.length), 10))
      .filter(n => Number.isFinite(n))
  );
  let n = 1;
  while (used.has(n)) n++;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

function recalcTransactions(transactions: Transaction[], bills: Bill[]): Transaction[] {
  return transactions.map(t => {
    const txnBills = bills.filter(b => b.txnId === t.txnId);
    if (txnBills.length === 0) {
      return { ...t, billsReceived: 0, remainingExpected: round2(t.expectedAmount) };
    }
    const sumTaxIncl = txnBills.reduce(
      (s, b) => s + round2(b.billAmount * (1 + (Number(b.gstPercent) || 0) / 100)),
      0
    );
    const remaining = round2(Math.max(0, t.expectedAmount - sumTaxIncl));
    const billsReceived = txnBills.reduce((s, b) => s + b.billAmount, 0);
    return { ...t, billsReceived: round2(billsReceived), remainingExpected: remaining };
  });
}

function calcAgentCommission(
  agent: Agent,
  vendorCode: string,
  gstPercent: number,
  transactionAmount: number,
  overrides: AgentVendorOverride[],
  slabs: CommissionSlab[]
): { percent: number; amount: number; type: "auto" | "custom" } {
  const override = overrides.find(o => o.agentId === agent.id && o.vendorCode === vendorCode);
  if (override) {
    return {
      percent: override.commissionPercent,
      amount: round2(transactionAmount * override.commissionPercent / 100),
      type: "custom",
    };
  }
  if (agent.commissionType === "custom") {
    return {
      percent: agent.customCommissionPercent,
      amount: round2(transactionAmount * agent.customCommissionPercent / 100),
      type: "custom",
    };
  }
  const sortedSlabs = [...slabs].sort((a, b) => a.gstPercent - b.gstPercent);
  const threshold = sortedSlabs.find(s => s.isThreshold);
  if (threshold && gstPercent >= threshold.gstPercent) {
    return { percent: 0, amount: 0, type: "auto" };
  }
  const exact = sortedSlabs.find(s => s.gstPercent === gstPercent && !s.isThreshold);
  if (exact) {
    return {
      percent: exact.agentCommission,
      amount: round2(transactionAmount * exact.agentCommission / 100),
      type: "auto",
    };
  }
  const lower = sortedSlabs.filter(s => s.gstPercent < gstPercent && !s.isThreshold);
  if (lower.length > 0) {
    const closest = lower[lower.length - 1];
    return {
      percent: closest.agentCommission,
      amount: round2(transactionAmount * closest.agentCommission / 100),
      type: "auto",
    };
  }
  return { percent: 0, amount: 0, type: "auto" };
}

function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "-") return null;
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  const months: Record<string, number> = {
    "ஜனு":0,"பிப்":1,"மார்":2,"ஏப்":3,"மே":4,"ஜூன்":5,
    "ஜூலை":6,"ஆக்":7,"செப்":8,"அக்":9,"நவ்":10,"டிச்":11,
    "jan":0,"feb":1,"mar":2,"apr":3,"may":4,"jun":5,
    "jul":6,"aug":7,"sep":8,"oct":9,"nov":10,"dec":11,
  };
  const m = dateStr.match(/(\d{1,2})[-\/]([^\d\-\/]+)[-\/](\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monStr = m[2].replace(/\./g, "").toLowerCase().trim();
  const yr = parseInt(m[3], 10);
  const year = yr < 100 ? 2000 + yr : yr;
  const monKey = Object.keys(months).find(k => monStr.startsWith(k));
  if (monKey === undefined) return null;
  const d = new Date(year, months[monKey], day);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================================
// SECTION 7 — Local storage layer (with schema versioning)
// ============================================================

const EMPTY: StorageData = {
  vendors: [], transactions: [], bills: [], wallet: [],
  managedUsers: [], auditLogs: [],
  agents: [], agentWallet: [], agentOverrides: [],
  schemaVersion: SCHEMA_VERSION,
};

function migrate(data: any): StorageData {
  if (!data || typeof data !== "object") return { ...EMPTY };
  const v = Number(data.schemaVersion) || 1;
  const out: StorageData = {
    vendors:        Array.isArray(data.vendors) ? data.vendors : [],
    transactions:   Array.isArray(data.transactions) ? data.transactions : [],
    bills:          Array.isArray(data.bills) ? data.bills : [],
    wallet:         Array.isArray(data.wallet) ? data.wallet : [],
    managedUsers:   Array.isArray(data.managedUsers) ? data.managedUsers : [],
    auditLogs:      Array.isArray(data.auditLogs) ? data.auditLogs : [],
    agents:         Array.isArray(data.agents) ? data.agents : [],
    agentWallet:    Array.isArray(data.agentWallet) ? data.agentWallet : [],
    agentOverrides: Array.isArray(data.agentOverrides) ? data.agentOverrides : [],
    schemaVersion:  SCHEMA_VERSION,
  };
  if (v < SCHEMA_VERSION) {
    // future migrations go here
  }
  return out;
}

function loadFromStorage(): StorageData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...EMPTY };
    if (!raw.trim().startsWith("{")) {
      console.warn("[storage] Legacy non-JSON data detected, clearing.");
      localStorage.removeItem(LS_KEY);
      return { ...EMPTY };
    }
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.error("[storage] load error:", err);
    localStorage.removeItem(LS_KEY);
    return { ...EMPTY };
  }
}

function saveToStorage(data: StorageData): void {
  try {
    const payload: StorageData = { ...data, schemaVersion: SCHEMA_VERSION };
    const json = JSON.stringify(payload);
    if (json.length > 4 * 1024 * 1024) {
      console.warn(`[storage] Payload ${(json.length / 1024 / 1024).toFixed(2)} MB approaching 5 MB localStorage cap.`);
    }
    localStorage.setItem(LS_KEY, json);
  } catch (err) {
    console.error("[storage] save error:", err);
    alert("⚠️ Storage quota exceeded. Please backup and clear old data from Settings.");
  }
}

function clearAllStorage(): void {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem("AR_COMMISSION_SLABS");
  localStorage.removeItem("AR_GSTR2B_VERIFIED");
  localStorage.removeItem("AR_GSTR2B_ROWS");
  localStorage.removeItem("AR_GSTR2B_FEATURE_START");
  localStorage.removeItem("AR_FINTRACK_PROJECTS");
  localStorage.removeItem("AR_FINTRACK_BANK");
}

function saveSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: Session = JSON.parse(raw);
    return isSessionValid(s) ? s : null;
  } catch { return null; }
}
function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

function storageBytesUsed(): number {
  try {
    const raw = localStorage.getItem(LS_KEY) || "";
    return new Blob([raw]).size;
  } catch { return 0; }
}

// ============================================================
// SECTION 8 — GSTR-2B verifier hook
// ============================================================
const FEATURE_KEY  = "AR_GSTR2B_FEATURE_START";
const ROWS_KEY     = "AR_GSTR2B_ROWS";
const VERIFIED_KEY = "AR_GSTR2B_VERIFIED";

function readFeatureStart(): Date {
  let v = localStorage.getItem(FEATURE_KEY);
  if (!v) {
    v = new Date().toISOString();
    try { localStorage.setItem(FEATURE_KEY, v); } catch { /* ignore */ }
  }
  return new Date(v);
}
function readRows(): Gstr2bRow[] {
  try { return JSON.parse(localStorage.getItem(ROWS_KEY) || "[]"); }
  catch { return []; }
}
function readVerified(): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(VERIFIED_KEY) || "[]")); }
  catch { return new Set(); }
}

interface Gstr2bApi {
  isBillVerified: (b: Bill) => boolean;
  addVerified: (billNumbers: string[]) => void;
  setRows: (rows: Gstr2bRow[]) => void;
  resetFeatureStart: () => void;
  rows: Gstr2bRow[];
  verified: Set<string>;
  featureStart: Date;
}

function useGstr2bVerifier(vendors: Vendor[]): Gstr2bApi {
  const [rows, setRowsState] = useState<Gstr2bRow[]>(() => readRows());
  const [verified, setVerifiedState] = useState<Set<string>>(() => readVerified());
  const [featureStart, setFeatureStart] = useState<Date>(() => readFeatureStart());

  useEffect(() => {
    try { localStorage.setItem(ROWS_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  }, [rows]);
  useEffect(() => {
    try { localStorage.setItem(VERIFIED_KEY, JSON.stringify([...verified])); } catch { /* ignore */ }
  }, [verified]);
  useEffect(() => {
    try { localStorage.setItem(FEATURE_KEY, featureStart.toISOString()); } catch { /* ignore */ }
  }, [featureStart]);

  const gstinByVendorCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vendors) {
      if (v.gstNo) m.set(v.vendorCode, v.gstNo.trim().toUpperCase());
    }
    return m;
  }, [vendors]);

  const isBillVerified = useCallback((b: Bill): boolean => {
    if (b.createdAt && new Date(b.createdAt) < featureStart) return true;
    if (verified.has(String(b.billNumber).trim())) return true;
    if (rows.length === 0) return false;

    const vendorGstin = gstinByVendorCode.get(b.vendorCode);
    if (!vendorGstin) return false;

    const billNoNorm = String(b.billNumber).trim().toLowerCase();
    const billAmt = Number(b.billAmount) || 0;
    const billDateMs = new Date(b.billDate).getTime();

    return rows.some(row => {
      if (!row.gstin || row.gstin.trim().toUpperCase() !== vendorGstin) return false;
      if (row.invoiceNo && String(row.invoiceNo).trim().toLowerCase() === billNoNorm) {
        return true;
      }
      const taxable = Number(row.taxableValue) || 0;
      const within = (a: number, b: number, tol = 0.01) =>
        Math.abs(a - b) <= Math.max(b, 1) * tol;
      const amountOk = within(taxable, billAmt) || within(taxable, billAmt * 1.18);
      if (!amountOk) return false;
      const rowDate = parseFlexibleDate(row.date);
      if (!rowDate || isNaN(billDateMs)) return false;
      const diffDays = Math.abs(rowDate.getTime() - billDateMs) / 86_400_000;
      return diffDays <= 15;
    });
  }, [rows, verified, featureStart, gstinByVendorCode]);

  const addVerified = useCallback((billNumbers: string[]) => {
    setVerifiedState(prev => {
      const next = new Set(prev);
      for (const n of billNumbers) if (n) next.add(String(n).trim());
      return next;
    });
  }, []);

  const setRows = useCallback((newRows: Gstr2bRow[]) => setRowsState(newRows), []);
  const resetFeatureStart = useCallback(() => setFeatureStart(new Date()), []);

  return { isBillVerified, addVerified, setRows, resetFeatureStart, rows, verified, featureStart };
}

// ============================================================
// SECTION 9a — Toggle component
// ============================================================
function Toggle({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className="w-11 h-6 bg-gray-300 rounded-full peer
                   peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300
                   peer-checked:bg-green-600
                   after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                   after:bg-white after:rounded-full after:h-5 after:w-5
                   after:transition-all peer-checked:after:translate-x-full"
      />
    </label>
  );
}

// ============================================================
// SECTION 9b — StatCard component
// ============================================================
function StatCard({
  label, value, color = "#1c2b3a", sub, accentTop,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
  sub?: React.ReactNode;
  accentTop?: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "16px 20px",
      border: "1px solid #e8ecf0",
      ...(accentTop ? { borderTop: `3px solid ${accentTop}` } : {}),
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: "#8899aa",
        textTransform: "uppercase", letterSpacing: "0.07em", margin: 0,
      }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color, margin: "6px 0 0" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#8a99ab", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// === END OF PART 1 of 4 ===
// === Next message-ல Part 2 வரும் — அதையும் இந்த file கடைசில் paste பண்ணுங்க ===
// ============================================================
// SECTION 10 — Landing page
// ============================================================
interface LandingProps {
  onSelectRole: (role: LoginRole | ToolRole) => void;
}

function LandingPage({ onSelectRole }: LandingProps) {
  const roles = [
    { id: "admin",    icon: "👑",  label: "Admin",    sub: "Super Admin access",  color: "#1c3d6e", light: "#eef2f8" },
    { id: "district", icon: "🏗️", label: "District", sub: "District Manager",    color: "#0e6b4a", light: "#eaf5ee" },
    { id: "agent",    icon: "🤝",  label: "Agent",    sub: "Field Agent",         color: "#5c3d99", light: "#f3eeff" },
    { id: "vendor",   icon: "🏢",  label: "Vendor",   sub: "Self-service portal", color: "#9a3412", light: "#fff7ed" },
  ] as const;

  const tools = [
    { id: "fintrack",       icon: "💼", label: "FinTrack AI",         sub: "Bank · Projects · GST · Dashboard", badge: "AI",   color: "#1c3d6e" },
    { id: "reconciliation", icon: "🔄", label: "Bank Reconciliation", sub: "Contract ↔ Bank · Auto Match",      badge: "AUTO", color: "#0e6b4a" },
    { id: "worktracker",    icon: "📋", label: "Work Tracker",        sub: "Sri Polinchi & Co · GST · ITC",      badge: "LIVE", color: "#5c3d99" },
    { id: "auditor",        icon: "🧑‍💼", label: "Auditor",            sub: "GSTR-2B · ITC · GST Dashboard",      badge: "NEW",  color: "#9a3412" },
  ] as const;

  const hov = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.style.boxShadow = on ? "0 4px 18px rgba(0,0,0,0.09)" : "none";
    e.currentTarget.style.transform = on ? "translateY(-1px)" : "none";
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f4f6f9",
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 540 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: "#1c3d6e", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px", boxShadow: "0 4px 14px rgba(28,61,110,0.2)",
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>AR</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>AR Enterprises</h1>
          <p style={{ fontSize: 13, color: "#6b7c93", marginTop: 4 }}>Multi-District Vendor ERP System V3.0</p>
        </div>

        <p style={{
          fontSize: 11, fontWeight: 600, color: "#6b7c93",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
        }}>Select Role</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => onSelectRole(r.id)}
              aria-label={`Login as ${r.label}`}
              onMouseEnter={e => hov(e, true)}
              onMouseLeave={e => hov(e, false)}
              style={{
                background: "#fff", border: "1px solid #e2e6ea",
                borderTop: `3px solid ${r.color}`, borderRadius: 10,
                padding: "14px 16px", textAlign: "left", cursor: "pointer",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 36, height: 36, background: r.light, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>{r.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1c2b3a", margin: 0 }}>{r.label}</p>
                <p style={{ fontSize: 11, color: "#6b7c93", margin: 0 }}>{r.sub}</p>
              </div>
              <span style={{ color: "#c8d0d8", fontSize: 14 }} aria-hidden>›</span>
            </button>
          ))}
        </div>

        <p style={{
          fontSize: 11, fontWeight: 600, color: "#6b7c93",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
        }}>Tools & Analytics (Admin login required)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => onSelectRole(t.id)}
              aria-label={`Open ${t.label}`}
              onMouseEnter={e => hov(e, true)}
              onMouseLeave={e => hov(e, false)}
              style={{
                background: "#fff", border: "1px solid #e2e6ea",
                borderLeft: `3px solid ${t.color}`, borderRadius: 10,
                padding: "12px 16px", textAlign: "left", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1c2b3a", margin: 0 }}>{t.label}</p>
                <p style={{ fontSize: 11, color: "#6b7c93", margin: 0 }}>{t.sub}</p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: t.color,
                background: `${t.color}18`, padding: "2px 8px",
                borderRadius: 4, letterSpacing: "0.04em",
              }}>{t.badge}</span>
              <span style={{ color: "#c8d0d8", fontSize: 14 }} aria-hidden>›</span>
            </button>
          ))}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#a8b0b8", marginTop: 24 }}>
          🔒 AR Enterprises ERP V3.0 — Secured
        </p>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 11 — Login page
// ============================================================
interface LoginProps {
  role: LoginRole;
  onLogin: (u: User) => void;
  onBack: () => void;
  managedUsers: ManagedUser[];
  agents: Agent[];
  vendors: Vendor[];
  onBootstrapAdmin?: (admin: ManagedUser) => void;
}

const ROLE_CONFIG: Record<LoginRole, { icon: string; label: string; color: string; hint: string }> = {
  admin:    { icon: "👑",  label: "Admin Login",    color: "#1c3d6e", hint: "Admin username & password" },
  district: { icon: "🏛️", label: "District Login", color: "#0e6b4a", hint: "District manager credentials" },
  agent:    { icon: "🤝",  label: "Agent Login",    color: "#5c3d99", hint: "Agent username & password" },
  vendor:   { icon: "🏢",  label: "Vendor Login",   color: "#9a3412", hint: "GST No (or Vendor Code) + 6-digit PIN" },
};

const BOOTSTRAP_USERNAME = (import.meta as any).env?.VITE_ADMIN_USERNAME || "admin";
const BOOTSTRAP_PASSWORD: string | undefined = (import.meta as any).env?.VITE_ADMIN_BOOTSTRAP_PASSWORD;

function LoginPage({
  role, onLogin, onBack, managedUsers, agents, vendors, onBootstrapAdmin,
}: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cfg = ROLE_CONFIG[role];

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (role === "admin") {
        await handleAdminLogin();
      } else if (role === "district") {
        await handleDistrictLogin();
      } else if (role === "agent") {
        await handleAgentLogin();
      } else if (role === "vendor") {
        await handleVendorLogin();
      }
    } catch (e) {
      console.error(e);
      setError("Login error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  async function handleAdminLogin() {
    const adminRow = managedUsers.find(u => u.username === username && u.district === "__ADMIN__");
    if (adminRow) {
      const ok = await verifyPassword(password, adminRow.password);
      if (ok) {
        onLogin({ id: adminRow.id, username: adminRow.username, password: adminRow.password, role: "admin" });
      } else {
        setError("Invalid admin credentials");
      }
      return;
    }
    if (managedUsers.every(u => u.district !== "__ADMIN__")) {
      if (!BOOTSTRAP_PASSWORD) {
        setError("Admin not initialised. Set VITE_ADMIN_BOOTSTRAP_PASSWORD at build time.");
        return;
      }
      if (username !== BOOTSTRAP_USERNAME || password !== BOOTSTRAP_PASSWORD) {
        setError("Invalid bootstrap credentials");
        return;
      }
      const hp = await hashPassword(password);
      const adminUser: ManagedUser = {
        id: "U-ADMIN-" + Date.now().toString(36),
        username,
        password: hp,
        district: "__ADMIN__",
        active: true,
        createdAt: new Date().toISOString(),
      };
      onBootstrapAdmin?.(adminUser);
      onLogin({ id: adminUser.id, username: adminUser.username, password: hp, role: "admin" });
      return;
    }
    setError("Invalid admin credentials");
  }

  async function handleDistrictLogin() {
    const u = managedUsers.find(x => x.username === username && x.active && x.district !== "__ADMIN__");
    if (!u) {
      setError("Invalid credentials or account inactive");
      return;
    }
    const ok = await verifyPassword(password, u.password);
    if (!ok) { setError("Invalid credentials"); return; }
    onLogin({
      id: u.id, username: u.username, password: u.password,
      role: "district", district: u.district,
    });
  }

  async function handleAgentLogin() {
    const approved = agents.find(a => a.username === username && a.status === "approved");
    if (approved) {
      const ok = await verifyPassword(password, approved.password);
      if (ok) {
        onLogin({ id: approved.id, username: approved.username, password: approved.password, role: "agent" });
        return;
      }
    }
    const pending = agents.find(a => a.username === username && a.status === "pending");
    if (pending) {
      const ok = await verifyPassword(password, pending.password);
      if (ok) { setError("⏳ Your account is awaiting admin approval"); return; }
    }
    setError("Invalid agent credentials");
  }

  async function handleVendorLogin() {
    const candidate = vendors.find(v =>
      (v.gstNo && v.gstNo.trim().toUpperCase() === username.trim().toUpperCase()) ||
      v.vendorCode.trim().toUpperCase() === username.trim().toUpperCase()
    );
    if (!candidate) { setError("Vendor not found"); return; }
    if (!candidate.loginPinHash) {
      setError("Vendor login not configured. Ask admin to issue a PIN.");
      return;
    }
    const ok = await verifyPassword(password.trim(), candidate.loginPinHash);
    if (!ok) { setError("Incorrect PIN"); return; }
    onLogin({
      id: candidate.id, username: candidate.vendorCode, password: candidate.loginPinHash,
      role: "vendor", district: candidate.district,
    });
  }

  const inpStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid #dde2e8", fontSize: 13, color: "#1c2b3a",
    background: "#fff", outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const accent = cfg.color;

  return (
    <div style={{
      minHeight: "100vh", background: "#f4f6f9",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI',system-ui,sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid #e2e6ea",
          overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}>
          <div style={{ height: 4, background: accent }} />
          <div style={{ padding: "28px 32px 32px" }}>
            <button
              onClick={onBack}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "#6b7c93", display: "flex",
                alignItems: "center", gap: 6, marginBottom: 24, padding: 0,
              }}
            >← Back to Home</button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <div style={{
                width: 44, height: 44, background: `${accent}18`, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
              }}>{cfg.icon}</div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>{cfg.label}</h1>
                <p style={{ fontSize: 12, color: "#6b7c93", margin: 0 }}>{cfg.hint}</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 600, color: "#6b7c93",
                  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {role === "vendor" ? "GST Number or Vendor Code" : "Username"}
                </label>
                <input
                  type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder={role === "vendor" ? "33AAAAA0000A1Z5 or PDK25HW001" : "Enter username"}
                  autoComplete="off" disabled={loading} style={inpStyle}
                />
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 600, color: "#6b7c93",
                  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {role === "vendor" ? "6-Digit PIN" : "Password"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder={role === "vendor" ? "123456" : "Enter password"}
                  autoComplete="new-password" disabled={loading} style={inpStyle}
                />
              </div>

              {error && (
                <div role="alert" style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderLeft: "3px solid #ef4444",
                }}>
                  <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                style={{
                  width: "100%", padding: "11px", borderRadius: 8, border: "none",
                  fontSize: 13, fontWeight: 700, color: "#fff", background: accent,
                  cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Logging in..." : "Login →"}
              </button>
            </div>

            <div style={{
              marginTop: 24, paddingTop: 16, borderTop: "1px solid #f0f3f6", textAlign: "center",
            }}>
              <p style={{ fontSize: 11, color: "#6b7c93", margin: 0 }}>
                🔒 AR Enterprises ERP V3.0 — Secured
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION 12 — Vendor dashboard
// ============================================================
function VendorDashboardPage({
  vendor, transactions, bills, onLogout,
}: {
  vendor: Vendor;
  transactions: Transaction[];
  bills: Bill[];
  onLogout: () => void;
}) {
  const [filterMonth, setFilterMonth] = useState("");
  const [filterFY, setFilterFY] = useState("");

  const myTxns  = transactions.filter(t => t.vendorCode === vendor.vendorCode);
  const myBills = bills.filter(b => b.vendorCode === vendor.vendorCode);

  const filtered = myTxns.filter(t =>
    (!filterMonth || t.month === filterMonth) &&
    (!filterFY    || t.financialYear === filterFY)
  );
  const filteredBills = myBills.filter(b => filtered.some(t => t.txnId === b.txnId));

  const totalExpected  = filtered.reduce((s, t) => s + t.expectedAmount, 0);
  const totalAdvance   = filtered.reduce((s, t) => s + t.advanceAmount, 0);
  const totalBillsAmt  = filtered.reduce((s, t) => s + t.billsReceived, 0);
  const totalRemaining = filtered.reduce((s, t) => s + Math.max(0, t.remainingExpected), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{
        padding: "12px 24px",
        background: "linear-gradient(135deg, #14532d, #15803d)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ margin: 0, color: "#fff", fontWeight: 700 }}>🏢 {vendor.vendorName}</p>
          <p style={{ margin: 0, color: "#bbf7d0", fontSize: 11 }}>
            {vendor.vendorCode} | GST: {vendor.gstNo || "—"} | {vendor.district}
          </p>
        </div>
        <button onClick={onLogout} style={{
          padding: "6px 14px", color: "#fff", background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}>🚪 Logout</button>
      </div>

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={inp}>
            <option value="">All months</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterFY} onChange={e => setFilterFY(e.target.value)} style={inp}>
            <option value="">All FY</option>
            {FY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {(filterMonth || filterFY) && (
            <button onClick={() => { setFilterMonth(""); setFilterFY(""); }} style={{
              padding: "8px 16px", background: "#fff", color: "#6b7c93",
              border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 12,
            }}>✕ Clear</button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Stat label="Transactions" value={filtered.length} color="#0369a1" />
          <Stat label="Expected"     value={fmt(totalExpected)} color="#1c2b3a" sub={`Advance ${fmt(totalAdvance)}`} />
          <Stat label="Bills"        value={fmt(totalBillsAmt)} color="#15803d" sub={`${filteredBills.length} bills`} />
          <Stat label="Pending"      value={totalRemaining > 0 ? fmt(totalRemaining) : "✅ All Clear"} color={totalRemaining > 0 ? "#b45309" : "#15803d"} />
        </div>

        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
          <h2 style={{ margin: 0, padding: 16, fontSize: 14, fontWeight: 700, color: "#1c2b3a", borderBottom: "1px solid #f0f3f6" }}>📋 My Transactions</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#14532d" }}>
                <tr>{["TXN ID","Month/FY","Expected","Advance","Bills","Remaining","Status"].map(h =>
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#bbf7d0" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.txnId} style={{ borderTop: "1px solid #f0f3f6" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#0369a1", fontWeight: 700 }}>{t.txnId}</td>
                    <td style={{ padding: "10px 12px" }}>{t.month}<br /><span style={{ color: "#6b7c93", fontSize: 11 }}>{t.financialYear}</span></td>
                    <td style={{ padding: "10px 12px" }}>{fmt(t.expectedAmount)}</td>
                    <td style={{ padding: "10px 12px", color: "#b45309" }}>{fmt(t.advanceAmount)}</td>
                    <td style={{ padding: "10px 12px", color: "#15803d" }}>{fmt(t.billsReceived)}</td>
                    <td style={{ padding: "10px 12px" }}>{t.remainingExpected <= 0 ? "₹0 ✅" : fmt(t.remainingExpected)}</td>
                    <td style={{ padding: "10px 12px" }}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p style={{ textAlign: "center", padding: 32, color: "#6b7c93" }}>No transactions found</p>}
          </div>
        </div>

        {filteredBills.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
            <h2 style={{ margin: 0, padding: 16, fontSize: 14, fontWeight: 700, color: "#1c2b3a", borderBottom: "1px solid #f0f3f6" }}>🧾 Bill Details</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>{["Bill No","Date","TXN","Amount","GST%","GST Amt","Total"].map(h =>
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map(b => (
                    <tr key={b.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{b.billNumber}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7c93" }}>{b.billDate}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#0369a1" }}>{b.txnId}</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(b.billAmount)}</td>
                      <td style={{ padding: "10px 12px" }}>{b.gstPercent}%</td>
                      <td style={{ padding: "10px 12px", color: "#7c3aed", fontWeight: 600 }}>{fmt(b.gstAmount)}</td>
                      <td style={{ padding: "10px 12px", color: "#15803d", fontWeight: 700 }}>{fmt(b.totalAmount)}</td>
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

function Stat({ label, value, color, sub }: { label: string; value: React.ReactNode; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e8ecf0" }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#6b7c93", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8a99ab" }}>{sub}</p>}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, background: "#fff", outline: "none",
};

// ============================================================
// SECTION 13 — Agent pages (admin agent mgmt + agent dashboard)
// ============================================================
function AdminAgentsPage({
  agents, agentWallet, agentOverrides, commissionSlabs,
  transactions, vendors,
  onApprove, onReject, onSuspend, onDelete,
  onSetCommission, onAddOverride, onDeleteOverride, onUpdateSlabs,
}: {
  agents: Agent[];
  agentWallet: AgentWalletEntry[];
  agentOverrides: AgentVendorOverride[];
  commissionSlabs: CommissionSlab[];
  transactions: Transaction[];
  vendors: Vendor[];
  bills: Bill[];
  onApprove: (agentId: string, type: "auto" | "custom", pct: number) => void;
  onReject: (agentId: string) => void;
  onSuspend: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onSetCommission: (agentId: string, type: "auto" | "custom", pct: number) => void;
  onAddOverride: (o: AgentVendorOverride) => void;
  onDeleteOverride: (id: string) => void;
  onUpdateSlabs: (s: CommissionSlab[]) => void;
}) {
  const [tab, setTab] = useState<"list" | "pending" | "slabs">("list");
  const [editSlabs, setEditSlabs] = useState<CommissionSlab[]>([...commissionSlabs]);
  const [approveAgentId, setApproveAgentId] = useState<string | null>(null);
  const [approveType, setApproveType] = useState<"auto" | "custom">("auto");
  const [approvePct, setApprovePct] = useState("1");

  const pending  = agents.filter(a => a.status === "pending");
  const approved = agents.filter(a => a.status === "approved");
  const others   = agents.filter(a => a.status !== "pending");

  const slabValidation = useMemo(() => {
    const thresholds = editSlabs.filter(s => s.isThreshold);
    if (thresholds.length > 1) return "Only one slab can be marked as the threshold.";
    if (thresholds.length === 1) {
      const max = Math.max(...editSlabs.map(s => s.gstPercent));
      if (thresholds[0].gstPercent !== max) return "Threshold slab must be the highest GST% row.";
    }
    return "";
  }, [editSlabs]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>🤝 Agent Management</h1>
        <p style={{ fontSize: 12, color: "#6b7c93", margin: 0 }}>
          {approved.length} active · {pending.length} pending
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb" }}>
        {[
          { id: "list",    label: `👥 Agents (${approved.length})` },
          { id: "pending", label: `⏳ Pending (${pending.length})` },
          { id: "slabs",   label: "📊 Commission Slabs" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            style={{
              padding: "10px 16px", border: "none", background: "transparent",
              color: tab === t.id ? "#1d4ed8" : "#6b7c93",
              fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer",
              borderBottom: tab === t.id ? "2px solid #1d4ed8" : "2px solid transparent",
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pending.length === 0 && <p style={{ textAlign: "center", padding: 24, color: "#6b7c93" }}>No pending approvals</p>}
          {pending.map(a => (
            <div key={a.id} style={{ background: "#fff", padding: 16, borderRadius: 10, border: "2px solid #fde68a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "#1c2b3a", fontSize: 15 }}>{a.fullName}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7c93" }}>{a.agentId} | {a.mobile}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7c93" }}>
                    Manager: <strong>{a.managerName}</strong> ({a.managerDistrict})
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
                    Registered: {new Date(a.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
                  {approveAgentId === a.id ? (
                    <div style={{ padding: 12, background: "#ecfdf5", borderRadius: 8, border: "1px solid #86efac" }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#065f46" }}>Commission type:</p>
                      <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
                        <button
                          onClick={() => setApproveType("auto")}
                          style={{
                            flex: 1, padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            border: `1px solid ${approveType === "auto" ? "#3b82f6" : "#d1d5db"}`,
                            background: approveType === "auto" ? "#dbeafe" : "#fff",
                            color: approveType === "auto" ? "#1d4ed8" : "#6b7c93",
                            cursor: "pointer",
                          }}
                        >Auto slab</button>
                        <button
                          onClick={() => setApproveType("custom")}
                          style={{
                            flex: 1, padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            border: `1px solid ${approveType === "custom" ? "#7c3aed" : "#d1d5db"}`,
                            background: approveType === "custom" ? "#ede9fe" : "#fff",
                            color: approveType === "custom" ? "#7c3aed" : "#6b7c93",
                            cursor: "pointer",
                          }}
                        >Custom %</button>
                      </div>
                      {approveType === "custom" && (
                        <input
                          type="number" step="0.1" value={approvePct}
                          onChange={e => setApprovePct(e.target.value)}
                          placeholder="Commission %"
                          style={{ width: "100%", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, marginBottom: 8 }}
                        />
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => { onApprove(a.id, approveType, parseFloat(approvePct) || 0); setApproveAgentId(null); }}
                          style={{ flex: 1, padding: 6, background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                        >✅ Confirm</button>
                        <button
                          onClick={() => setApproveAgentId(null)}
                          style={{ padding: "6px 12px", background: "#fff", color: "#6b7c93", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
                        >Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setApproveAgentId(a.id)}
                              style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        ✅ Approve
                      </button>
                      <button onClick={() => onReject(a.id)}
                              style={{ padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                        ❌ Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "list" && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f2f5f8" }}>
                <tr>{["Agent","Manager","District","Commission","Wallet","Txns","Status","Actions"].map(h =>
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {others.map(a => {
                  const txnCount = transactions.filter(t => t.createdByAgent === a.agentId).length;
                  return (
                    <tr key={a.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>{a.fullName}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#6b7c93" }}>{a.agentId} | {a.mobile}</p>
                      </td>
                      <td style={{ padding: "10px 12px" }}>{a.managerName}</td>
                      <td style={{ padding: "10px 12px" }}>{a.managerDistrict}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: a.commissionType === "custom" ? "#ede9fe" : "#dbeafe",
                          color: a.commissionType === "custom" ? "#7c3aed" : "#1d4ed8",
                        }}>
                          {a.commissionType === "custom" ? `${a.customCommissionPercent}% custom` : "Auto slab"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#15803d" }}>{fmt(a.commissionBalance)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>{txnCount}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: a.status === "approved" ? "#dcfce7" : a.status === "suspended" ? "#ffedd5" : "#fee2e2",
                          color:      a.status === "approved" ? "#15803d" : a.status === "suspended" ? "#c2410c" : "#b91c1c" }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => onSuspend(a.id)} aria-label="Suspend / unsuspend"
                                  style={{ padding: "4px 8px", background: "#fef3c7", color: "#b45309", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                            {a.status === "suspended" ? "▶️" : "⏸️"}
                          </button>
                          <button onClick={() => {
                            const next = prompt(`Set commission % for ${a.fullName} (custom). Leave blank for auto slab.`, String(a.customCommissionPercent || ""));
                            if (next === null) return;
                            if (next === "") onSetCommission(a.id, "auto", 0);
                            else onSetCommission(a.id, "custom", parseFloat(next) || 0);
                          }} aria-label="Edit commission"
                            style={{ padding: "4px 8px", background: "#ede9fe", color: "#7c3aed", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                            ✏️
                          </button>
                          <button onClick={() => { if (confirm(`Delete ${a.fullName}?`)) onDelete(a.id); }} aria-label="Delete"
                                  style={{ padding: "4px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {others.length === 0 && <p style={{ textAlign: "center", padding: 40, color: "#6b7c93" }}>No agents yet.</p>}
          </div>
        </div>
      )}

      {tab === "slabs" && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1c2b3a" }}>📊 Commission Slab Configuration</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7c93" }}>
                GST % → Agent commission % mapping. Admin only.
              </p>
            </div>
            <button onClick={() => setEditSlabs(prev => [...prev, { gstPercent: 0, agentCommission: 0 }])} style={{
              padding: "8px 16px", background: "#1c3d6e", color: "#fff", border: "none",
              borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
            }}>+ Row</button>
          </div>

          {slabValidation && (
            <div style={{ padding: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#b91c1c", fontSize: 12 }}>
              ⚠ {slabValidation}
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f2f5f8" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569" }}>GST %</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569" }}>Commission %</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569" }}>Threshold?</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {editSlabs.map((s, i) => (
                <tr key={i} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <input type="number" step="0.5" value={s.gstPercent}
                           onChange={e => setEditSlabs(prev => prev.map((row, idx) => idx === i ? { ...row, gstPercent: parseFloat(e.target.value) || 0 } : row))}
                           style={{ width: 80, padding: 6, border: "1px solid #d1d5db", borderRadius: 4 }} /> %
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input type="number" step="0.1" value={s.agentCommission}
                           disabled={!!s.isThreshold}
                           onChange={e => setEditSlabs(prev => prev.map((row, idx) => idx === i ? { ...row, agentCommission: parseFloat(e.target.value) || 0 } : row))}
                           style={{ width: 80, padding: 6, border: "1px solid #d1d5db", borderRadius: 4 }} /> %
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <input type="checkbox" checked={!!s.isThreshold}
                             onChange={e => setEditSlabs(prev => prev.map((row, idx) => idx === i ? { ...row, isThreshold: e.target.checked, agentCommission: e.target.checked ? 0 : row.agentCommission } : row))} />
                      hard cutoff
                    </label>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <button onClick={() => setEditSlabs(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: "transparent", border: "none", color: "#dc2626", fontSize: 16, cursor: "pointer" }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={() => { if (!slabValidation) { onUpdateSlabs(editSlabs); alert("✅ Slabs saved"); } }}
            disabled={!!slabValidation}
            style={{ padding: "10px 20px", background: slabValidation ? "#9ca3af" : "#16a34a", color: "#fff", border: "none",
                     borderRadius: 8, cursor: slabValidation ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, alignSelf: "flex-start" }}
          >💾 Save Slabs</button>
        </div>
      )}
    </div>
  );
}

function AgentDashboardPage({
  agent, transactions, vendors, bills, agentWallet, agentOverrides, commissionSlabs, onLogout,
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
  const [selectedDistrict, setSelectedDistrict] = useState(agent.managerDistrict);
  const myTxns   = transactions.filter(t => t.createdByAgent === agent.agentId);
  const myWallet = agentWallet.filter(w => w.agentId === agent.id);
  const totalCommission = myWallet.reduce((s, w) => s + w.commissionAmount, 0);
  const totalTxnAmt     = myTxns.reduce((s, t) => s + t.expectedAmount, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #5c3d99, #7c3aed)", padding: "12px 24px",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, color: "#fff", fontWeight: 700 }}>🤝 {agent.fullName}</p>
          <p style={{ margin: 0, color: "#e9d5ff", fontSize: 11 }}>{agent.agentId} · Manager: {agent.managerName} ({agent.managerDistrict})</p>
        </div>
        <button onClick={onLogout} style={{
          padding: "6px 14px", background: "rgba(255,255,255,0.15)", color: "#fff",
          border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}>🚪 Logout</button>
      </div>

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, color: "#1c2b3a" }}>Working district:</p>
          <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4 }}>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <StatCard label="My Transactions"   value={myTxns.length}                color="#0369a1" />
          <StatCard label="Total Amount"      value={fmt(totalTxnAmt)}             color="#b45309" />
          <StatCard label="Commission Earned" value={fmt(round2(totalCommission))} color="#15803d" />
          <StatCard label="Wallet Balance"    value={fmt(agent.commissionBalance)} color="#7c3aed" />
        </div>

        <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#1c2b3a" }}>💰 My Commission Setup</h2>
          <p style={{ fontSize: 13, color: "#1c2b3a", margin: 0 }}>
            Type: <strong>{agent.commissionType === "custom" ? `Custom ${agent.customCommissionPercent}%` : "Auto (GST-based slab)"}</strong>
          </p>
          {agent.commissionType === "auto" && (
            <div style={{ marginTop: 8, padding: 12, background: "#f0fdf4", borderRadius: 6 }}>
              {commissionSlabs.filter(s => s.agentCommission > 0).map(s => (
                <p key={s.gstPercent} style={{ margin: "2px 0", fontSize: 12, color: "#15803d" }}>
                  GST {s.gstPercent}% → Commission {s.agentCommission}%
                </p>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
          <h2 style={{ margin: 0, padding: 16, fontSize: 14, fontWeight: 700, color: "#1c2b3a", borderBottom: "1px solid #f0f3f6" }}>
            Recent Transactions
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>{["TXN ID","Vendor","District","Amount","GST%","Commission","Status"].map(h =>
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {myTxns.slice(0, 8).map(t => {
                  const comm = calcAgentCommission(agent, t.vendorCode, t.gstPercent, t.expectedAmount, agentOverrides, commissionSlabs);
                  return (
                    <tr key={t.txnId} style={{ borderTop: "1px solid #f0f3f6" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#0369a1", fontWeight: 700 }}>{t.txnId}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{t.vendorName}</td>
                      <td style={{ padding: "10px 12px" }}>{t.district}</td>
                      <td style={{ padding: "10px 12px" }}>{fmt(t.expectedAmount)}</td>
                      <td style={{ padding: "10px 12px" }}>{t.gstPercent}%</td>
                      <td style={{ padding: "10px 12px", color: "#15803d", fontWeight: 600 }}>
                        {comm.amount > 0 ? `${fmt(comm.amount)} (${comm.percent}%)` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{t.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {myTxns.length === 0 && <p style={{ textAlign: "center", padding: 24, color: "#6b7c93" }}>No transactions yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// === END OF PART 2 of 4 ===
// === Next: PART 3 — Dashboard, Vendors, Transactions, Bills, Wallet, Analytics, Reports, Users, Audit, Settings pages ===
// ============================================================
// SECTION 14 — Admin/District pages
// (Dashboard, Vendors, Transactions, Bills, Wallet, Analytics,
//  Reports, UserManagement, AuditLogs, Settings)
// ============================================================

function DashboardPage({
  isAdmin, district, transactions, vendors, bills, walletBalance,
  pendingClose, onConfirmClose, agents, gstr2b,
}: {
  isAdmin: boolean; district: string;
  transactions: Transaction[]; vendors: Vendor[]; bills: Bill[];
  wallet: WalletEntry[]; walletBalance: number;
  pendingClose: Transaction[]; onConfirmClose: (txnId: string) => void;
  agents: Agent[]; user: User;
  gstr2b: Gstr2bApi;
}) {
  const totalExpected      = useMemo(() => transactions.reduce((s, t) => s + t.expectedAmount, 0), [transactions]);
  const totalBillsReceived = useMemo(() => transactions.reduce((s, t) => s + t.billsReceived, 0), [transactions]);
  const totalGST           = useMemo(() => transactions.reduce((s, t) => s + t.gstAmount, 0), [transactions]);
  const totalProfit        = useMemo(() => transactions.filter(t => t.status === "Closed").reduce((s, t) => s + t.profit, 0), [transactions]);
  const openTxns           = transactions.filter(t => t.status === "Open").length;
  const closedTxns         = transactions.filter(t => t.status === "Closed").length;

  const closedTxnIds = useMemo(() => new Set(transactions.filter(t => t.status === "Closed").map(t => t.txnId)), [transactions]);
  const pendingBills = useMemo(() => bills
    .filter(b => !closedTxnIds.has(b.txnId))
    .filter(b => isAdmin || b.district === district)
    .filter(b => !gstr2b.isBillVerified(b)),
    [bills, closedTxnIds, gstr2b, isAdmin, district]);
  const pendingTxnIds = useMemo(() => [...new Set(pendingBills.map(b => b.txnId))], [pendingBills]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ paddingBottom: 16, borderBottom: "1px solid #e8ecf0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>
          {isAdmin ? "📊 Master Dashboard — AR Enterprises" : `📊 ${district} Dashboard`}
        </h1>
        <p style={{ fontSize: 12, color: "#6b7c93", margin: "3px 0 0" }}>
          Multi-District ERP V3.0 — Real-time Analytics
        </p>
      </div>

      {pendingBills.length > 0 && (
        <div style={{ background: "#fffbeb", border: "2px solid #fbbf24", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ color: "#b45309", fontWeight: 700, fontSize: 16, margin: 0 }}>
              ⏳ GSTR2B Verification Pending ({pendingBills.length} bills, {pendingTxnIds.length} transactions)
            </h2>
            {isAdmin && (
              <button
                onClick={() => {
                  if (confirm("Mark all currently-pending bills as verified from this point on?")) {
                    gstr2b.resetFeatureStart();
                  }
                }}
                style={{
                  fontSize: 12, color: "#b45309", background: "#fef3c7",
                  border: "1px solid #fcd34d", padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                }}
              >
                ↺ Reset Verification Date
              </button>
            )}
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {pendingTxnIds.slice(0, 10).map(txnId => {
              const txn = transactions.find(t => t.txnId === txnId);
              const txnPending = pendingBills.filter(b => b.txnId === txnId);
              return (
                <div key={txnId} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid #fde68a",
                }}>
                  <div>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#b45309", fontWeight: 700 }}>{txnId}</span>
                    <span style={{ color: "#6b7c93", fontSize: 13, marginLeft: 8 }}>{txn?.vendorName}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {txnPending.map(b => (
                      <span key={b.id} style={{
                        padding: "2px 8px", background: "#fef3c7", color: "#b45309",
                        borderRadius: 4, fontSize: 11, fontFamily: "monospace",
                      }}>{b.billNumber}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdmin && pendingClose.length > 0 && (
        <div style={{ background: "#fff5f5", border: "2px solid #fca5a5", borderRadius: 12, padding: 20 }}>
          <h2 style={{ color: "#b91c1c", fontWeight: 700, fontSize: 16, margin: "0 0 12px" }}>
            🔴 Pending Admin Confirmation ({pendingClose.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingClose.map(t => {
              const profit = round2(t.expectedAmount * PROFIT_RATE);
              return (
                <div key={t.txnId} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#fff", padding: 14, borderRadius: 8, border: "1px solid #fecaca",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: "#1c2b3a", margin: 0 }}>{t.vendorName} — {t.district}</p>
                    <p style={{ fontSize: 12, color: "#6b7c93", margin: "4px 0 0" }}>
                      {t.txnId} | Expected: {fmt(t.expectedAmount)} | 8% Profit: {fmt(profit)}
                    </p>
                  </div>
                  <button
                    onClick={() => onConfirmClose(t.txnId)}
                    style={{
                      padding: "8px 20px", borderRadius: 8, background: "#16a34a",
                      color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 13,
                    }}
                  >✅ Confirm & Credit</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard label="Total Vendors"   value={vendors.length} color="#1c3d6e" sub="Active accounts" />
        <StatCard label="Transactions"    value={transactions.length} color="#0369a1" sub={`Open: ${openTxns} | Closed: ${closedTxns}`} />
        <StatCard label="Total Expected"  value={fmt(totalExpected)} color="#b45309" />
        <StatCard label="Bills Received"  value={fmt(totalBillsReceived)} color="#15803d" sub={`${bills.length} bills`} />
      </div>

      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <StatCard label="Total GST"       value={fmt(totalGST)}       accentTop="#7c3aed" />
          <StatCard label="Wallet Balance"  value={fmt(walletBalance)}  accentTop="#b06010" />
          <StatCard label="Total Profit"    value={fmt(totalProfit)}    accentTop="#0e6b4a" />
          <StatCard label="Active Districts" value={new Set(transactions.map(t => t.district)).size} accentTop="#1c3d6e" />
        </div>
      )}

      {isAdmin && agents.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", padding: 16 }}>
          <p style={{ fontWeight: 600, color: "#1c2b3a", margin: "0 0 8px" }}>🤝 Agents Snapshot</p>
          <p style={{ fontSize: 12, color: "#6b7c93", margin: 0 }}>
            {agents.filter(a => a.status === "approved").length} active ·{" "}
            {agents.filter(a => a.status === "pending").length} pending ·{" "}
            {agents.filter(a => a.status === "suspended").length} suspended
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VENDORS
// ─────────────────────────────────────────────────────────────
function VendorsPage({
  isAdmin, district, vendors, allVendors,
  onAdd, onUpdate, onDelete, onIssuePin,
}: {
  isAdmin: boolean; district: string;
  vendors: Vendor[]; allVendors: Vendor[];
  onAdd: (v: Vendor, pin?: string) => Promise<void>;
  onUpdate: (v: Vendor) => void;
  onDelete: (id: string) => void;
  onIssuePin: (vendorId: string) => Promise<string>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [bizType, setBizType] = useState(BUSINESS_TYPES[0]);
  const [dist, setDist] = useState(isAdmin ? DISTRICTS[0] : district);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [address, setAddress] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [savedPin, setSavedPin] = useState<string | null>(null);

  const filtered = vendors.filter(v =>
    v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    const v: Vendor = {
      id: genId("V"),
      vendorCode: genVendorCode(dist, bizType, year, allVendors),
      vendorName: sanitizeInput(name),
      district: dist,
      mobile: sanitizeInput(mobile),
      email: sanitizeInput(email),
      gstNo: sanitizeInput(gstNo).toUpperCase(),
      address: sanitizeInput(address),
      businessType: bizType,
      regYear: year,
      active: true,
    };
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await onAdd(v, pin);
    setSavedPin(pin);
    setName(""); setMobile(""); setEmail(""); setGstNo(""); setAddress("");
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>🏢 Vendors</h1>
        <button
          onClick={() => { setShowForm(s => !s); setSavedPin(null); }}
          style={{
            padding: "10px 18px", background: "#1c3d6e", color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
          }}
        >{showForm ? "Cancel" : "+ New Vendor"}</button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Field label="Vendor Name *">
            <input value={name} onChange={e => setName(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="Business Type">
            <select value={bizType} onChange={e => setBizType(e.target.value)} style={inpStyle}>
              {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="District">
            <select value={dist} onChange={e => setDist(e.target.value)} disabled={!isAdmin} style={inpStyle}>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Year">
            <input value={year} onChange={e => setYear(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="Mobile (10 digits)">
            <input value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} style={inpStyle} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={e => setEmail(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="GST Number (15 chars)">
            <input value={gstNo} onChange={e => setGstNo(e.target.value.toUpperCase())} maxLength={15} style={inpStyle} />
          </Field>
          <Field label="Address">
            <input value={address} onChange={e => setAddress(e.target.value)} style={inpStyle} />
          </Field>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={handleAdd} style={btnPrimary}>💾 Save Vendor (auto-generates login PIN)</button>
          </div>
          {savedPin && (
            <div style={{ gridColumn: "1 / -1", padding: 12, background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, color: "#065f46" }}>
              ✅ Vendor saved. <strong>Login PIN: {savedPin}</strong> — note this down once; it cannot be retrieved later.
            </div>
          )}
        </div>
      )}

      <input
        type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search vendors..."
        style={{ ...inpStyle, padding: "10px 14px" }}
      />

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>
                {["Code","Name","Type","District","Mobile","GSTIN","Actions"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={td}><span style={{ fontFamily: "monospace", color: "#0369a1", fontWeight: 700 }}>{v.vendorCode}</span></td>
                  <td style={td}>{v.vendorName}</td>
                  <td style={td}>{v.businessType || "—"}</td>
                  <td style={td}>{v.district}</td>
                  <td style={td}>{v.mobile || "—"}</td>
                  <td style={td}>{v.gstNo || "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={async () => {
                          if (!confirm(`Issue a new login PIN for ${v.vendorName}? This invalidates the old PIN.`)) return;
                          const pin = await onIssuePin(v.id);
                          alert(`New PIN for ${v.vendorName}: ${pin}\n\nNote this down — it cannot be retrieved later.`);
                        }}
                        aria-label="Issue new login PIN"
                        style={iconBtn("#7c3aed")}
                      >🔑</button>
                      <button
                        onClick={() => onDelete(v.id)}
                        aria-label="Delete vendor"
                        style={iconBtn("#dc2626")}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p style={{ textAlign: "center", padding: 40, color: "#6b7c93" }}>No vendors found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────
function TransactionsPage({
  isAdmin, district, transactions, vendors, bills, gstr2b,
  onAdd, onClose, onDelete,
}: {
  isAdmin: boolean; district: string;
  transactions: Transaction[]; vendors: Vendor[]; bills: Bill[];
  gstr2b: Gstr2bApi;
  onAdd: (txn: Transaction, advance: number) => void;
  onClose: (txnId: string) => void;
  onDelete: (txnId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [vendorCode, setVendorCode] = useState("");
  const [fy, setFy] = useState(FY_LIST[1]);
  const [month, setMonth] = useState(MONTHS[0]);
  const [expected, setExpected] = useState("");
  const [advance, setAdvance] = useState("");
  const [gstPercent, setGstPercent] = useState(4);
  const [search, setSearch] = useState("");

  const myTxns = transactions;

  const filtered = myTxns.filter(t =>
    t.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    t.txnId.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    const expectedNum = parseFloat(expected) || 0;
    const advanceNum  = parseFloat(advance) || 0;
    const v = vendors.find(x => x.vendorCode === vendorCode);
    if (!v) { alert("Pick a vendor"); return; }
    const res = await validateData(transactionSchema, { expectedAmount: expectedNum, advanceAmount: advanceNum });
    if (!res.valid) { alert("❌ " + res.errors.join("\n")); return; }
    const gstAmount = round2(expectedNum * gstPercent / 100);
    const txn: Transaction = {
      id: genId("T"),
      txnId: "TXN" + Date.now().toString(36).toUpperCase(),
      district: v.district,
      vendorCode: v.vendorCode,
      vendorName: v.vendorName,
      financialYear: fy,
      month,
      expectedAmount: expectedNum,
      advanceAmount: advanceNum,
      gstPercent,
      gstAmount,
      gstBalance: round2(gstAmount - advanceNum),
      billsReceived: 0,
      remainingExpected: expectedNum,
      status: "Open",
      closedByDistrict: false,
      confirmedByAdmin: false,
      profit: 0,
    };
    onAdd(txn, advanceNum);
    setVendorCode(""); setExpected(""); setAdvance("");
    setShowForm(false);
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>📋 Transactions</h1>
        {!isAdmin && (
          <button onClick={() => setShowForm(s => !s)} style={btnPrimary}>
            {showForm ? "Cancel" : "+ New Transaction"}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Vendor *">
            <select value={vendorCode} onChange={e => setVendorCode(e.target.value)} style={inpStyle}>
              <option value="">Select…</option>
              {vendors.map(v => <option key={v.id} value={v.vendorCode}>{v.vendorName} ({v.vendorCode})</option>)}
            </select>
          </Field>
          <Field label="Financial Year">
            <select value={fy} onChange={e => setFy(e.target.value)} style={inpStyle}>
              {FY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Month">
            <select value={month} onChange={e => setMonth(e.target.value)} style={inpStyle}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Expected Amount *">
            <input type="number" value={expected} onChange={e => setExpected(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="Advance">
            <input type="number" value={advance} onChange={e => setAdvance(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="GST %">
            <select value={gstPercent} onChange={e => setGstPercent(parseFloat(e.target.value))} style={inpStyle}>
              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleAdd} style={btnPrimary}>💾 Save</button>
          </div>
        </div>
      )}

      <input
        type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by vendor or TXN ID..." style={{ ...inpStyle, padding: "10px 14px" }}
      />

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>{["TXN ID","Vendor","Month/FY","Expected","GST","Advance","Bills","Remaining","Status","Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const txnBills = bills.filter(b => b.txnId === t.txnId);
                const unverified = txnBills.filter(b => !gstr2b.isBillVerified(b));
                const canClose = txnBills.length > 0 && unverified.length === 0 && t.status === "Open";
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                    <td style={td}><span style={{ fontFamily: "monospace", color: "#0369a1", fontWeight: 700 }}>{t.txnId}</span></td>
                    <td style={td}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{t.vendorName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#6b7c93" }}>{t.district}</p>
                    </td>
                    <td style={td}>
                      <p style={{ margin: 0 }}>{t.month}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#6b7c93" }}>{t.financialYear}</p>
                    </td>
                    <td style={td}>{fmt(t.expectedAmount)}</td>
                    <td style={td}>
                      <p style={{ margin: 0, color: "#7c3aed", fontWeight: 600 }}>{fmt(t.gstAmount)}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#6b7c93" }}>{t.gstPercent}%</p>
                    </td>
                    <td style={td}>{fmt(t.advanceAmount)}</td>
                    <td style={td}>
                      <p style={{ margin: 0, color: "#15803d", fontWeight: 600 }}>{fmt(t.billsReceived)}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#6b7c93" }}>{txnBills.length} bills</p>
                    </td>
                    <td style={td}>{t.remainingExpected <= 0 ? "₹0 ✅" : fmt(t.remainingExpected)}</td>
                    <td style={td}>
                      <span style={statusPill(t.status)}>{t.status}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {!isAdmin && t.status === "Open" && (
                          <button
                            onClick={() => {
                              if (!canClose) {
                                alert(`Bills not yet GSTR-2B verified:\n${unverified.map(b => b.billNumber).join(", ") || "(no bills)"}`);
                                return;
                              }
                              if (confirm(`Close ${t.txnId}? Admin will receive a confirmation request.`)) onClose(t.txnId);
                            }}
                            style={{
                              ...iconBtn(canClose ? "#16a34a" : "#6b7c93"),
                              padding: "6px 12px", fontSize: 12, fontWeight: 700,
                            }}
                          >{canClose ? "✅ Close" : "⏳ Pending"}</button>
                        )}
                        <button onClick={() => onDelete(t.txnId)} aria-label="Delete" style={iconBtn("#dc2626")}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: "center", padding: 40, color: "#6b7c93" }}>No transactions found</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BILLS
// ─────────────────────────────────────────────────────────────
function BillsPage({
  isAdmin, district, bills, transactions, vendors, gstr2b,
  onAdd, onBulkAdd, onDelete,
}: {
  isAdmin: boolean; district: string;
  bills: Bill[]; transactions: Transaction[]; vendors: Vendor[];
  gstr2b: Gstr2bApi;
  onAdd: (b: Bill) => Promise<void>;
  onBulkAdd: (bills: Bill[]) => void;
  onDelete: (id: string) => void;
}) {
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

  const handleAdd = async () => {
    const amt = parseFloat(billAmt);
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) { alert("Pick a transaction"); return; }
    if (!billNo || !amt || amt <= 0) { alert("Bill number & positive amount required"); return; }
    if (bills.some(b => b.billNumber.trim().toLowerCase() === billNo.trim().toLowerCase() && b.vendorCode === txn.vendorCode)) {
      alert("Duplicate bill number for this vendor");
      return;
    }
    const res = await validateData(billSchema, { billNumber: billNo, billAmount: amt, billDate });
    if (!res.valid) { alert("❌ " + res.errors.join("\n")); return; }
    await onAdd({
      id: genId("B"),
      txnId, vendorCode: txn.vendorCode, vendorName: txn.vendorName, district: txn.district,
      billNumber: sanitizeInput(billNo), billDate,
      billAmount: amt, gstPercent: gstPct,
      gstAmount: round2(amt * gstPct / 100),
      totalAmount: round2(amt * (1 + gstPct / 100)),
    });
    setBillNo(""); setBillAmt(""); setShowForm(false);
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>🧾 Bills</h1>
        {!isAdmin && (
          <button onClick={() => setShowForm(s => !s)} style={btnPrimary}>{showForm ? "Cancel" : "+ New Bill"}</button>
        )}
      </div>

      {showForm && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Transaction *">
            <select value={txnId} onChange={e => setTxnId(e.target.value)} style={inpStyle}>
              <option value="">Select…</option>
              {openTxns.map(t => <option key={t.txnId} value={t.txnId}>{t.txnId} — {t.vendorName}</option>)}
            </select>
          </Field>
          <Field label="Bill Number *">
            <input value={billNo} onChange={e => setBillNo(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="Bill Date">
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                   max={new Date().toISOString().split("T")[0]} style={inpStyle} />
          </Field>
          <Field label="Taxable Amount *">
            <input type="number" value={billAmt} onChange={e => setBillAmt(e.target.value)} style={inpStyle} />
          </Field>
          <Field label="GST %">
            <select value={gstPct} onChange={e => setGstPct(parseFloat(e.target.value))} style={inpStyle}>
              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleAdd} style={btnPrimary}>💾 Save Bill</button>
          </div>
        </div>
      )}

      <input
        type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search bills..." style={{ ...inpStyle, padding: "10px 14px" }}
      />

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>{["Bill ID","TXN","Vendor","Bill #","Date","Amount","GST%","GST","Total","Verified","Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const verified = gstr2b.isBillVerified(b);
                return (
                  <tr key={b.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                    <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{b.id}</span></td>
                    <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7c93" }}>{b.txnId}</span></td>
                    <td style={td}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{b.vendorName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#6b7c93" }}>{b.vendorCode}</p>
                    </td>
                    <td style={td}>{b.billNumber}</td>
                    <td style={td}>{b.billDate}</td>
                    <td style={td}>{fmt(b.billAmount)}</td>
                    <td style={td}>{b.gstPercent}%</td>
                    <td style={{ ...td, color: "#7c3aed", fontWeight: 600 }}>{fmt(b.gstAmount)}</td>
                    <td style={{ ...td, color: "#15803d", fontWeight: 600 }}>{fmt(b.totalAmount)}</td>
                    <td style={td}>
                      {verified
                        ? <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>✅</span>
                        : (
                          <button
                            onClick={() => gstr2b.addVerified([b.billNumber])}
                            style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, border: "1px solid #fcd34d", cursor: "pointer" }}
                          >⏳ Mark Verified</button>
                        )
                      }
                    </td>
                    <td style={td}>
                      <button onClick={() => onDelete(b.id)} aria-label="Delete" style={iconBtn("#dc2626")}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ textAlign: "center", padding: 40, color: "#6b7c93" }}>No bills found</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────
function WalletPage({
  wallet, walletBalance, onAddManual,
}: {
  wallet: WalletEntry[]; walletBalance: number;
  onAddManual: (desc: string, debit: number, credit: number) => void;
}) {
  const [desc, setDesc] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>💰 Admin Wallet</h1>
        <p style={{ fontSize: 12, color: "#6b7c93", margin: "4px 0 0" }}>
          Current Balance: <strong style={{ color: "#15803d", fontSize: 18 }}>{fmt(walletBalance)}</strong>
        </p>
      </div>

      <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr 1fr auto" }}>
        <input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} style={inpStyle} />
        <input type="number" placeholder="Debit" value={debit} onChange={e => setDebit(e.target.value)} style={inpStyle} />
        <input type="number" placeholder="Credit" value={credit} onChange={e => setCredit(e.target.value)} style={inpStyle} />
        <button
          onClick={() => {
            if (!desc) return;
            onAddManual(desc, parseFloat(debit) || 0, parseFloat(credit) || 0);
            setDesc(""); setDebit(""); setCredit("");
          }}
          style={btnPrimary}
        >Add</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>{["Date","Description","TXN","Debit","Credit","Balance","Type"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...wallet].reverse().map(w => (
                <tr key={w.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={td}>{w.date}</td>
                  <td style={td}>{w.description}</td>
                  <td style={td}>{w.txnId || "—"}</td>
                  <td style={{ ...td, color: "#dc2626" }}>{w.debit > 0 ? fmt(w.debit) : "—"}</td>
                  <td style={{ ...td, color: "#15803d" }}>{w.credit > 0 ? fmt(w.credit) : "—"}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmt(w.balance)}</td>
                  <td style={td}><span style={{ fontSize: 11, color: "#6b7c93" }}>{w.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS (admin)
// ─────────────────────────────────────────────────────────────
function AnalyticsPage({
  transactions, bills, vendors,
}: {
  transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; wallet: WalletEntry[];
}) {
  const totalExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const totalGST      = transactions.reduce((s, t) => s + t.gstAmount, 0);
  const totalBillsAmt = bills.reduce((s, b) => s + b.billAmount, 0);
  const districtSummary = useMemo(() => {
    const map: Record<string, { txnCount: number; expected: number; gst: number; bills: number; closed: number; profit: number }> = {};
    for (const t of transactions) {
      if (!map[t.district]) map[t.district] = { txnCount: 0, expected: 0, gst: 0, bills: 0, closed: 0, profit: 0 };
      map[t.district].txnCount++;
      map[t.district].expected += t.expectedAmount;
      map[t.district].gst      += t.gstAmount;
      if (t.status === "Closed") { map[t.district].closed++; map[t.district].profit += t.profit; }
    }
    for (const b of bills) {
      if (map[b.district]) map[b.district].bills += b.billAmount;
    }
    return Object.entries(map).map(([district, v]) => ({ district, ...v }))
      .sort((a, b) => b.expected - a.expected);
  }, [transactions, bills]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>📈 Analytics</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard label="Total Expected"     value={fmt(totalExpected)} color="#1c3d6e" />
        <StatCard label="Total Bills"        value={fmt(totalBillsAmt)} color="#15803d" />
        <StatCard label="Total GST"          value={fmt(totalGST)}      color="#7c3aed" />
        <StatCard label="Total Vendors"      value={vendors.length}     color="#374151" />
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <h2 style={{ padding: 16, margin: 0, fontSize: 14, color: "#1c2b3a", fontWeight: 700, borderBottom: "1px solid #f0f3f6" }}>
          🏛️ District Summary
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>{["#","District","Txns","Expected","GST","Bills","Closed","Profit"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {districtSummary.map((d, i) => (
                <tr key={d.district} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>🏛️ {d.district}</td>
                  <td style={td}>{d.txnCount}</td>
                  <td style={td}>{fmt(d.expected)}</td>
                  <td style={{ ...td, color: "#7c3aed" }}>{fmt(d.gst)}</td>
                  <td style={{ ...td, color: "#15803d" }}>{fmt(d.bills)}</td>
                  <td style={td}>{d.closed}/{d.txnCount}</td>
                  <td style={{ ...td, color: "#b45309" }}>{d.profit > 0 ? fmt(d.profit) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORTS (district)
// ─────────────────────────────────────────────────────────────
function ReportsPage({ transactions, district }: {
  transactions: Transaction[]; bills: Bill[]; vendors: Vendor[]; district: string;
}) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>
        📄 {district} — Reports
      </h1>
      <p style={{ fontSize: 12, color: "#6b7c93", marginTop: 4 }}>
        Total transactions: {transactions.length}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT (admin)
// ─────────────────────────────────────────────────────────────
function UserManagementPage({
  districtUsers, onAddUser, onToggleUser, onDeleteUser,
}: {
  districtUsers: ManagedUser[];
  onAddUser: (u: ManagedUser) => Promise<void>;
  onUpdateUser: (u: ManagedUser) => void;
  onToggleUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
}) {
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [dist, setDist] = useState(DISTRICTS[0]);

  const handleAdd = async () => {
    const res = await validateData(userSchema, { username: uname, password: pass });
    if (!res.valid) { alert("❌ " + res.errors.join("\n")); return; }
    if (districtUsers.some(u => u.username === uname)) {
      alert("Username already exists"); return;
    }
    const hp = await hashPassword(pass);
    await onAddUser({
      id: genId("U"), username: uname, password: hp, district: dist,
      active: true, createdAt: new Date().toISOString(),
    });
    setUname(""); setPass("");
  };

  const visible = districtUsers.filter(u => u.district !== "__ADMIN__");

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>👥 User Management</h1>

      <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
        <input placeholder="Username" value={uname} onChange={e => setUname(e.target.value.toLowerCase())} style={inpStyle} autoComplete="off" />
        <input placeholder="Password (min 6)" type="password" value={pass} onChange={e => setPass(e.target.value)} style={inpStyle} autoComplete="new-password" />
        <select value={dist} onChange={e => setDist(e.target.value)} style={inpStyle}>
          {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={handleAdd} style={btnPrimary}>+ Add User</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>{["Username","District","Status","Created","Last Login","Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map(u => (
                <tr key={u.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={td}>{u.username}</td>
                  <td style={td}>{u.district}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                                   background: u.active ? "#dcfce7" : "#fef2f2",
                                   color: u.active ? "#15803d" : "#b91c1c" }}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={td}>{u.createdAt.split("T")[0]}</td>
                  <td style={td}>{u.lastLogin ? u.lastLogin.split("T")[0] : "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => onToggleUser(u.id)} aria-label="Toggle active" style={iconBtn(u.active ? "#f59e0b" : "#16a34a")}>
                        {u.active ? "⏸️" : "▶️"}
                      </button>
                      <button onClick={() => onDeleteUser(u.id)} aria-label="Delete" style={iconBtn("#dc2626")}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p style={{ textAlign: "center", padding: 40, color: "#6b7c93" }}>No district users yet</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────
function AuditLogsPage({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const filtered = logs.filter(l =>
    (l.user.toLowerCase().includes(search.toLowerCase()) ||
     l.entityId.toLowerCase().includes(search.toLowerCase())) &&
    (!actionFilter || l.action === actionFilter)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = [...filtered].reverse().slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>📜 Audit Logs</h1>

      <div style={{ background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr" }}>
        <input placeholder="Search by user or entity ID..." value={search} onChange={e => setSearch(e.target.value)} style={inpStyle} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={inpStyle}>
          <option value="">All actions</option>
          {["CREATE","UPDATE","DELETE","CLOSE","CONFIRM","LOGIN","LOGOUT"].map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f2f5f8" }}>
              <tr>{["Timestamp","User","Action","Entity","Entity ID"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {paginated.map(l => (
                <tr key={l.id} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={{ ...td, fontSize: 11, color: "#6b7c93" }}>{new Date(l.timestamp).toLocaleString("en-IN")}</td>
                  <td style={td}>{l.user}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                                   background: "#eef2f8", color: "#1c3d6e" }}>{l.action}</span>
                  </td>
                  <td style={td}>{l.entity}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{l.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginated.length === 0 && <p style={{ textAlign: "center", padding: 40, color: "#6b7c93" }}>No logs match the filter</p>}
        </div>
        {totalPages > 1 && (
          <div style={{ padding: 12, borderTop: "1px solid #f0f3f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#6b7c93" }}>Page {page} of {totalPages}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={iconBtn("#6b7c93")}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={iconBtn("#6b7c93")}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────
function SettingsPage({
  settings, onUpdateSettings, onBackup, onRestore, onClearData, storageUsed,
}: {
  settings: any; onUpdateSettings: (s: any) => void;
  onBackup: () => void; onRestore: (file: File) => void;
  onClearData: () => void; storageUsed: number;
}) {
  const [local, setLocal] = useState(settings);

  const fmtBytes = (b: number) =>
    b < 1024 ? `${b} B`
    : b < 1024 * 1024 ? `${(b / 1024).toFixed(2)} KB`
    : `${(b / (1024 * 1024)).toFixed(2)} MB`;

  const usagePct = Math.min(100, (storageUsed / (5 * 1024 * 1024)) * 100);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1c2b3a", margin: 0 }}>⚙️ Settings</h1>

      <Card title="💾 Backup & Restore">
        <Row label="Auto Backup Reminder">
          <Toggle checked={!!local.autoBackup} onChange={v => setLocal({ ...local, autoBackup: v })} label="Auto backup" />
        </Row>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={onBackup} style={{ ...btnPrimary, background: "#16a34a" }}>📥 Download Backup</button>
          <label style={{ ...btnPrimary, background: "#2563eb", textAlign: "center", cursor: "pointer" }}>
            📤 Restore from File
            <input
              type="file" accept=".json"
              onChange={e => { const f = e.target.files?.[0]; if (f) onRestore(f); }}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </Card>

      <Card title="🔔 Notifications">
        <Row label="Browser Notifications">
          <Toggle checked={!!local.browserNotifications} onChange={v => setLocal({ ...local, browserNotifications: v })} label="Browser notifications" />
        </Row>
      </Card>

      <Card title="💽 Storage">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13 }}>Data Usage</span>
          <span style={{ fontSize: 13 }}>{fmtBytes(storageUsed)} / 5 MB</span>
        </div>
        <div style={{ background: "#e5e7eb", borderRadius: 6, overflow: "hidden", height: 10 }}>
          <div style={{ background: usagePct > 80 ? "#dc2626" : "#2563eb", width: `${usagePct}%`, height: "100%" }} />
        </div>
        {usagePct > 80 && (
          <p style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
            ⚠️ Approaching 5 MB browser limit. Please backup and clear old data.
          </p>
        )}
      </Card>

      <Card title="ℹ️ App Information">
        <p style={{ margin: "4px 0", fontSize: 13 }}>Version: <strong>3.0.0</strong></p>
        <p style={{ margin: "4px 0", fontSize: 13 }}>Build: <strong>Production</strong></p>
        <p style={{ margin: "4px 0", fontSize: 13 }}>Storage Schema: <strong>v2 (Plain JSON)</strong></p>
      </Card>

      <Card title="⚠️ Danger Zone" tone="danger">
        <p style={{ fontSize: 13, color: "#b91c1c" }}>
          This action will permanently delete all data. This cannot be undone.
        </p>
        <button
          onClick={() => {
            if (confirm("Really delete ALL local data? This cannot be undone.")) onClearData();
          }}
          style={{ ...btnPrimary, background: "#dc2626" }}
        >🗑️ Clear All Data</button>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => { onUpdateSettings(local); alert("✅ Settings saved"); }} style={btnPrimary}>
          💾 Save Settings
        </button>
      </div>
    </div>
  );
}

// ── shared style bits used by all admin pages ────────────────
const inpStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid #dde2e8",
  borderRadius: 8, color: "#1c2b3a", fontSize: 13, outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};
const th: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", background: "#1c3d6e", color: "#fff", border: "none",
  borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const iconBtn = (color: string): React.CSSProperties => ({
  padding: "4px 8px", background: `${color}18`, color, border: "none",
  borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600,
});
const statusPill = (status: Transaction["status"]): React.CSSProperties => ({
  padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
  background: status === "Closed" ? "#dcfce7" : status === "PendingClose" ? "#fee2e2" : "#dbeafe",
  color: status === "Closed" ? "#15803d" : status === "PendingClose" ? "#b91c1c" : "#1d4ed8",
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7c93", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{label}</p>
      {children}
    </div>
  );
}
function Card({ title, tone, children }: { title: string; tone?: "danger"; children: React.ReactNode }) {
  return (
    <div style={{
      background: tone === "danger" ? "#fff5f5" : "#fff", borderRadius: 10,
      border: tone === "danger" ? "2px solid #fca5a5" : "1px solid #e8ecf0",
      padding: 20, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <h2 style={{ margin: 0, fontSize: 14, color: tone === "danger" ? "#b91c1c" : "#1c2b3a", fontWeight: 700 }}>{title}</h2>
      {children}
    </div>
  );
}

// === END OF PART 3 of 4 ===
// === Next: PART 4 — Tool pages (Auditor/WorkTracker/Recon/FinTrack) + Main App orchestrator ===
// ============================================================
// SECTION 15 — Tool pages (Auditor / WorkTracker / Recon / FinTrack)
// All require admin authentication (gated by App.tsx).
// External API calls go through a backend proxy.
// ============================================================

function AuditorPage({
  onBack, onGstr2bRows,
}: {
  onBack: () => void;
  onGstr2bRows: (rows: Gstr2bRow[]) => void;
}) {
  const [tab, setTab] = useState<"gst" | "gstr2b" | "itc">("gst");

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "#1c3d6e", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <div>
          <div style={{ color: "#fff", fontWeight: 800 }}>🧑‍💼 Auditor Dashboard</div>
          <div style={{ color: "#cbd5e1", fontSize: 11 }}>IT & GST | GSTR-2B | ITC</div>
        </div>
      </div>

      <div style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid #e2e6ea", display: "flex" }}>
        {([
          { id: "gst",    label: "📊 IT & GST Dashboard", color: "#7c3aed" },
          { id: "gstr2b", label: "📋 GSTR-2B",            color: "#06b6d4" },
          { id: "itc",    label: "💰 ITC Register",       color: "#10b981" },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "12px 20px", background: "transparent", border: "none",
              color: tab === t.id ? t.color : "#6b7c93",
              fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer",
              borderBottom: tab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
            }}
          >{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {tab === "gst"    && <GSTFilingTab />}
        {tab === "gstr2b" && <GSTR2BTab onParsed={onGstr2bRows} />}
        {tab === "itc"    && <ITCTab />}
      </div>
    </div>
  );
}

function GSTFilingTab() {
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    if (!AUDITOR_PROXY_URL) { setMsg("⚠️ Configure VITE_AUDITOR_PROXY_URL"); return; }
    if (!date) { setMsg("Date required"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`${AUDITOR_PROXY_URL}/gst-filing`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filingDate: date }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? "✅ Saved" : `❌ ${j.error || res.statusText}`);
    } catch (err) {
      setMsg("❌ Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0", display: "grid", gap: 12, gridTemplateColumns: "1fr auto" }}>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
             style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
      <button onClick={handleSave} disabled={saving} style={{
        padding: "10px 20px", background: "#7c3aed", color: "#fff", border: "none",
        borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
      }}>{saving ? "Saving..." : "💾 Save"}</button>
      {msg && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12 }}>{msg}</p>}
    </div>
  );
}

function GSTR2BTab({ onParsed }: { onParsed: (rows: Gstr2bRow[]) => void }) {
  const [paste, setPaste] = useState("");
  const [parsed, setParsed] = useState<Gstr2bRow[]>([]);

  const parse = () => {
    const lines = paste.split("\n").map(l => l.trim()).filter(Boolean);
    const rows: Gstr2bRow[] = [];
    for (const ln of lines) {
      const c = ln.split(/\t|,/).map(s => s.trim());
      if (c.length < 4) continue;
      rows.push({
        gstin: c[0] || "",
        invoiceNo: c[1] || "",
        date: c[2] || "",
        taxableValue: parseFloat(c[3]) || 0,
        igst: parseFloat(c[4]) || 0,
        cgst: parseFloat(c[5]) || 0,
        sgst: parseFloat(c[6]) || 0,
      });
    }
    setParsed(rows);
    onParsed(rows);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "#6b7c93" }}>
        Paste GSTR-2B rows (TSV or CSV): <code>GSTIN | InvoiceNo | Date | TaxableValue | IGST | CGST | SGST</code>
      </p>
      <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={8}
                style={{ width: "100%", padding: 12, border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }} />
      <div>
        <button onClick={parse} style={{
          padding: "10px 20px", background: "#06b6d4", color: "#fff", border: "none",
          borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>Parse & Save ({parsed.length} parsed)</button>
      </div>
      {parsed.length > 0 && (
        <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #e8ecf0", maxHeight: 240, overflowY: "auto" }}>
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f2f5f8" }}>
                {["GSTIN","Inv #","Date","Taxable"].map(h => <th key={h} style={{ padding: 6, textAlign: "left" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 50).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid #f0f3f6" }}>
                  <td style={{ padding: 6 }}>{r.gstin}</td>
                  <td style={{ padding: 6 }}>{r.invoiceNo}</td>
                  <td style={{ padding: 6 }}>{r.date}</td>
                  <td style={{ padding: 6 }}>{fmt(r.taxableValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ITCTab() {
  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e8ecf0" }}>
      <p style={{ margin: 0, fontSize: 13, color: "#6b7c93" }}>
        ITC register — connect a backend (VITE_AUDITOR_PROXY_URL) to enable saving.
      </p>
    </div>
  );
}

function WorkTrackerPage({ onBack }: { onBack: () => void }) {
  const baseId = WORK_TRACKER_SHEET_ID;
  const url = WORK_TRACKER_SHEET_URL
    || (baseId ? `https://docs.google.com/spreadsheets/d/${baseId}/htmlview?widget=true&headers=false` : "");

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "linear-gradient(135deg, #1c3d6e, #2a5298)", padding: "12px 24px",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={btnGhost}>← Back</button>
          <div>
            <div style={{ color: "#fff", fontWeight: 800 }}>📋 Work Tracker</div>
            <div style={{ color: "#bfdbfe", fontSize: 11 }}>Embedded Google Sheet</div>
          </div>
        </div>
      </div>
      {url ? (
        <iframe src={url} title="Work Tracker" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
      ) : (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7c93" }}>
          ⚙️ Configure <code>VITE_WORKTRACKER_URL</code> or <code>VITE_WORKTRACKER_SHEET_ID</code>.
        </div>
      )}
    </div>
  );
}

function ReconciliationPage({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9" }}>
      <div style={{ background: "#0e6b4a", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <div style={{ color: "#fff", fontWeight: 800 }}>🔄 Bank Reconciliation</div>
      </div>
      <div style={{ padding: 24 }}>
        <p style={{ color: "#6b7c93" }}>Reconciliation module placeholder — wire up your bank statement source here.</p>
      </div>
    </div>
  );
}

function FinTrackDashboard({
  vendors, transactions, bills, wallet, onBack,
}: {
  vendors: Vendor[];
  transactions: Transaction[];
  bills: Bill[];
  wallet: WalletEntry[];
  onBack: () => void;
}) {
  const erpExpected = transactions.reduce((s, t) => s + t.expectedAmount, 0);
  const erpBills    = bills.reduce((s, b) => s + b.billAmount, 0);
  const erpWalletBal = wallet.length ? wallet[wallet.length - 1].balance : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9" }}>
      <div style={{ background: "#1c3d6e", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={btnGhost}>← Back</button>
        <div style={{ color: "#fff", fontWeight: 800 }}>💼 FinTrack AI</div>
      </div>
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <Box label="Vendors"        value={vendors.length} />
        <Box label="Transactions"   value={transactions.length} />
        <Box label="Expected"       value={fmt(erpExpected)} />
        <Box label="Bills"          value={fmt(erpBills)} />
        <Box label="Wallet Balance" value={fmt(erpWalletBal)} />
      </div>
      <div style={{ padding: "0 24px 24px" }}>
        <AIChat />
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e8ecf0" }}>
      <p style={{ margin: 0, fontSize: 11, color: "#6b7c93", textTransform: "uppercase", fontWeight: 700 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color: "#1c2b3a" }}>{value}</p>
    </div>
  );
}

function AIChat() {
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "👋 Hello! Ask anything about your ERP data." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMsgs(prev => [...prev, { role: "user", text }]);
    if (!AI_PROXY_URL) {
      setMsgs(prev => [...prev, { role: "ai", text: "⚙️ Configure VITE_AI_PROXY_URL to enable AI chat (browser cannot call Anthropic directly)." }]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(AI_PROXY_URL, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      setMsgs(prev => [...prev, { role: "ai", text: data.reply || data.error || "(empty response)" }]);
    } catch {
      setMsgs(prev => [...prev, { role: "ai", text: "Network error." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ecf0", overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: 16, borderBottom: "1px solid #f0f3f6", fontWeight: 700, color: "#1c2b3a" }}>🧠 AI Chat</div>
      <div style={{ padding: 16, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "75%",
            padding: "8px 12px",
            borderRadius: 12,
            background: m.role === "user" ? "#1c3d6e" : "#f2f5f8",
            color:      m.role === "user" ? "#fff"    : "#1c2b3a",
            fontSize: 13, whiteSpace: "pre-wrap",
          }}>{m.text}</div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: "1px solid #f0f3f6", display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === "Enter" && send()}
               placeholder="Ask anything..."
               style={{ flex: 1, padding: 10, border: "1px solid #d1d5db", borderRadius: 6 }} />
        <button onClick={send} disabled={loading} style={{
          padding: "10px 20px", background: "#1c3d6e", color: "#fff", border: "none",
          borderRadius: 6, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        }}>{loading ? "..." : "Send"}</button>
      </div>
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
  padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
};

// ============================================================
// SECTION 16 — Main App component (orchestrator)
// ============================================================
const SLABS_KEY = "AR_COMMISSION_SLABS";

export default function App() {
  const initial = useMemo(() => loadFromStorage(), []);
  const initialSlabs = useMemo<CommissionSlab[]>(() => {
    try {
      const raw = localStorage.getItem(SLABS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_COMMISSION_SLABS;
    } catch { return DEFAULT_COMMISSION_SLABS; }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [loginRole, setLoginRole] = useState<LoginRole | ToolRole | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [vendors, setVendors]               = useState<Vendor[]>(initial.vendors);
  const [transactions, setTransactions]     = useState<Transaction[]>(initial.transactions);
  const [bills, setBills]                   = useState<Bill[]>(initial.bills);
  const [wallet, setWallet]                 = useState<WalletEntry[]>(initial.wallet);
  const [managedUsers, setManagedUsers]     = useState<ManagedUser[]>(initial.managedUsers);
  const [auditLogs, setAuditLogs]           = useState<AuditLog[]>(initial.auditLogs);
  const [agents, setAgents]                 = useState<Agent[]>(initial.agents);
  const [agentWallet, setAgentWallet]       = useState<AgentWalletEntry[]>(initial.agentWallet);
  const [agentOverrides, setAgentOverrides] = useState<AgentVendorOverride[]>(initial.agentOverrides);
  const [commissionSlabs, setCommissionSlabs] = useState<CommissionSlab[]>(initialSlabs);

  const [settings, setSettings] = useState({
    autoBackup: true, backupFrequency: 7,
    browserNotifications: false,
  });

  const gstr2b = useGstr2bVerifier(vendors);

  // ── persistence: any state change → snapshot → localStorage ─
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) { hasInitialized.current = true; return; }
    const data: StorageData = {
      vendors, transactions, bills, wallet,
      managedUsers, auditLogs, agents, agentWallet, agentOverrides,
      schemaVersion: 2,
    };
    saveToStorage(data);
    void saveToSheets();
  }, [vendors, transactions, bills, wallet, managedUsers, auditLogs, agents, agentWallet, agentOverrides]);

  useEffect(() => {
    try { localStorage.setItem(SLABS_KEY, JSON.stringify(commissionSlabs)); }
    catch (err) { console.warn("[slabs] save failed:", err); }
  }, [commissionSlabs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadFromSheets();
        if (cancelled) return;
        const fresh = loadFromStorage();
        hasInitialized.current = false;
        setVendors(fresh.vendors);
        setTransactions(fresh.transactions);
        setBills(fresh.bills);
        setWallet(fresh.wallet);
        setManagedUsers(fresh.managedUsers);
        setAuditLogs(fresh.auditLogs);
        setAgents(fresh.agents);
        setAgentWallet(fresh.agentWallet);
        setAgentOverrides(fresh.agentOverrides);
      } catch (err) {
        console.warn("[init] sync failed:", err);
      }
      const sess = loadSession();
      if (sess && !cancelled) setUser(sess.user);
      if (!cancelled) setIsInitializing(false);
    })();
    const stop = startAutoSync(5);
    return () => { cancelled = true; stop(); stopAutoSync(); };
  }, []);

  useEffect(() => {
    const handle = () => { if (window.innerWidth < 768) setSidebarOpen(false); };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    if (settings.browserNotifications && "Notification" in window) {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  }, [settings.browserNotifications]);

  const logAction = useCallback((
    action: AuditLog["action"], entity: AuditLog["entity"], entityId: string,
    before?: any, after?: any,
  ) => {
    if (!user) return;
    setAuditLogs(prev => [...prev, {
      id: genId("LOG"), timestamp: new Date().toISOString(), user: user.username,
      action, entity, entityId, before, after,
    }]);
  }, [user]);

  const walletBalance = wallet.length > 0 ? wallet[wallet.length - 1].balance : 0;

  const addWalletEntry = useCallback((
    desc: string, debit: number, credit: number, type: WalletEntry["type"], txnId?: string,
  ) => {
    setWallet(prev => {
      const lastBal = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      const entry: WalletEntry = {
        id: genId("W"), date: new Date().toISOString().split("T")[0],
        description: desc, txnId, debit, credit,
        balance: round2(lastBal - debit + credit), type, createdBy: user?.username,
      };
      return [...prev, entry];
    });
  }, [user]);

  const handleConfirmClose = useCallback((txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) { alert("❌ Transaction not found"); return; }
    if (txn.confirmedByAdmin || txn.status === "Closed") { alert("⚠️ Already closed"); return; }
    const profit = round2(txn.expectedAmount * PROFIT_RATE);

    setWallet(prev => {
      if (prev.some(w => w.txnId === txnId && w.type === "profit")) return prev;
      const lastBal = prev.length > 0 ? prev[prev.length - 1].balance : 0;
      return [...prev, {
        id: genId("W"),
        date: new Date().toISOString().split("T")[0],
        description: `8% Profit Credit — ${txn.vendorName} (${txnId})`,
        txnId, debit: 0, credit: profit, balance: round2(lastBal + profit),
        type: "profit", createdBy: user?.username,
      }];
    });

    const txnAgent = agents.find(a => a.agentId === txn.createdByAgent);
    let commissionInfo = "";
    if (txnAgent && txnAgent.status === "approved") {
      const already = agentWallet.find(w => w.txnId === txnId && w.agentId === txnAgent.id);
      if (!already) {
        const comm = calcAgentCommission(txnAgent, txn.vendorCode, txn.gstPercent, txn.expectedAmount, agentOverrides, commissionSlabs);
        if (comm.amount > 0) {
          setAgentWallet(prev => {
            const agentEntries = prev.filter(w => w.agentId === txnAgent.id);
            const prevBal = agentEntries.length > 0 ? agentEntries[agentEntries.length - 1].balance : txnAgent.commissionBalance;
            return [...prev, {
              id: genId("AW"), agentId: txnAgent.id,
              date: new Date().toISOString().split("T")[0],
              description: `Commission — ${txn.vendorName} (${txnId})`,
              txnId, vendorName: txn.vendorName, billAmount: txn.expectedAmount,
              gstPercent: txn.gstPercent, commissionPercent: comm.percent,
              commissionAmount: comm.amount, commissionType: comm.type,
              balance: round2(prevBal + comm.amount),
            }];
          });
          setAgents(prev => prev.map(a => a.id === txnAgent.id
            ? { ...a, commissionBalance: round2(a.commissionBalance + comm.amount) }
            : a
          ));
          commissionInfo = `\n🤝 Agent: ${txnAgent.fullName} — ${fmt(comm.amount)}`;
        }
      }
    }

    setTransactions(prev => prev.map(t =>
      t.txnId === txnId
        ? { ...t, status: "Closed", confirmedByAdmin: true, profit, closedAt: new Date().toISOString() }
        : t
    ));
    logAction("CONFIRM", "Transaction", txnId);
    alert(`✅ Transaction Closed!\n\n💰 Profit: ${fmt(profit)}${commissionInfo}`);
  }, [transactions, agents, agentWallet, agentOverrides, commissionSlabs, user, logAction]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    saveSession(createSession(loggedInUser, 8));
    setLoginRole(null);
    if (loggedInUser.role === "agent")  { setPage("agent_dashboard");  return; }
    if (loggedInUser.role === "vendor") { setPage("vendor_dashboard"); return; }
    if (loggedInUser.role === "district") {
      setManagedUsers(prev => prev.map(u =>
        u.username === loggedInUser.username ? { ...u, lastLogin: new Date().toISOString() } : u
      ));
    }
    logAction("LOGIN", "User", loggedInUser.id);
    setPage("dashboard");
  };

  const handleLogout = () => {
    if (user) logAction("LOGOUT", "User", user.id);
    clearSession(); setUser(null); setLoginRole(null); setPage("dashboard");
  };

  if (isInitializing) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f9" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: "4px solid #c9a227", borderTopColor: "transparent",
            margin: "0 auto 16px", animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "#1c2b3a", fontWeight: 600 }}>📊 Loading AR ERP...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const isToolRole = (r: any): r is ToolRole =>
    r === "auditor" || r === "worktracker" || r === "reconciliation" || r === "fintrack";

  if (loginRole && isToolRole(loginRole) && (!user || user.role !== "admin")) {
    return (
      <LoginPage
        role="admin"
        onLogin={handleLogin}
        onBack={() => setLoginRole(null)}
        managedUsers={managedUsers}
        agents={agents}
        vendors={vendors}
        onBootstrapAdmin={admin => setManagedUsers(prev => [...prev, admin])}
      />
    );
  }
  if (loginRole === "auditor"        && user?.role === "admin") return <AuditorPage        onBack={() => setLoginRole(null)} onGstr2bRows={r => gstr2b.setRows(r)} />;
  if (loginRole === "worktracker"    && user?.role === "admin") return <WorkTrackerPage    onBack={() => setLoginRole(null)} />;
  if (loginRole === "reconciliation" && user?.role === "admin") return <ReconciliationPage onBack={() => setLoginRole(null)} />;
  if (loginRole === "fintrack"       && user?.role === "admin") return <FinTrackDashboard
                                                                          vendors={vendors} transactions={transactions}
                                                                          bills={bills} wallet={wallet}
                                                                          onBack={() => setLoginRole(null)} />;

  if (!user) {
    if (!loginRole) return <LandingPage onSelectRole={setLoginRole} />;
    if (!isToolRole(loginRole)) {
      return (
        <LoginPage
          role={loginRole}
          onLogin={handleLogin}
          onBack={() => setLoginRole(null)}
          managedUsers={managedUsers}
          agents={agents}
          vendors={vendors}
          onBootstrapAdmin={admin => setManagedUsers(prev => [...prev, admin])}
        />
      );
    }
  }

  if (user!.role === "vendor") {
    const vendor = vendors.find(v => v.vendorCode === user!.username || v.id === user!.id);
    if (!vendor) {
      handleLogout();
      return null;
    }
    return <VendorDashboardPage vendor={vendor} transactions={transactions} bills={bills} onLogout={handleLogout} />;
  }

  if (user!.role === "agent") {
    const agent = agents.find(a => a.username === user!.username);
    if (!agent) { handleLogout(); return null; }
    return (
      <AgentDashboardPage
        agent={agent}
        transactions={transactions}
        vendors={vendors}
        bills={bills}
        agentWallet={agentWallet}
        agentOverrides={agentOverrides}
        commissionSlabs={commissionSlabs}
        onAddVendor={v => setVendors(prev => [...prev, v])}
        onAddTransaction={(t, advance) => {
          setTransactions(prev => [...prev, { ...t, createdAt: new Date().toISOString() }]);
          if (advance > 0) addWalletEntry(`Advance — ${t.vendorName} (${t.txnId})`, advance, 0, "advance", t.txnId);
        }}
        onAddBill={b => {
          setBills(prev => {
            const next = [...prev, { ...b, createdAt: new Date().toISOString() }];
            setTransactions(prevTxns => recalcTransactions(prevTxns, next));
            return next;
          });
        }}
        onBulkAddBill={newBills => {
          setBills(prev => {
            const next = [...prev, ...newBills.map(b => ({ ...b, createdAt: new Date().toISOString() }))];
            setTransactions(prevTxns => recalcTransactions(prevTxns, next));
            return next;
          });
        }}
        onLogout={handleLogout}
      />
    );
  }

  const isAdmin    = user!.role === "admin";
  const district   = user!.district || "";
  const myVendors  = isAdmin ? vendors      : vendors.filter(v => v.district === district);
  const myTxns     = isAdmin ? transactions : transactions.filter(t => t.district === district);
  const myBills    = isAdmin ? bills        : bills.filter(b => b.district === district);
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

  const handleAddVendor = async (v: Vendor, pin?: string) => {
    let toAdd: Vendor = { ...v, createdAt: new Date().toISOString(), active: true };
    if (pin) {
      toAdd = { ...toAdd, loginPinHash: await hashPassword(pin) };
    }
    setVendors(prev => [...prev, toAdd]);
    logAction("CREATE", "Vendor", v.id, null, v);
  };
  const handleIssuePin = async (vendorId: string) => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await hashPassword(pin);
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, loginPinHash: hash } : v));
    logAction("UPDATE", "Vendor", vendorId);
    return pin;
  };
  const handleDeleteVendor = (id: string) => {
    const v = vendors.find(x => x.id === id);
    if (!v) return;
    if (transactions.some(t => t.vendorCode === v.vendorCode)) {
      alert("❌ Cannot delete: vendor has transactions"); return;
    }
    if (!confirm(`Delete ${v.vendorName}?`)) return;
    setVendors(prev => prev.filter(x => x.id !== id));
    logAction("DELETE", "Vendor", id);
  };

  const handleAddTransaction = (txn: Transaction, advance: number) => {
    setTransactions(prev => [...prev, { ...txn, createdAt: new Date().toISOString() }]);
    if (advance > 0) addWalletEntry(`Advance — ${txn.vendorName} (${txn.txnId})`, advance, 0, "advance", txn.txnId);
    logAction("CREATE", "Transaction", txn.txnId);
  };
  const handleCloseTransaction = (txnId: string) => {
    const txn = transactions.find(t => t.txnId === txnId);
    if (!txn) return;
    const txnBills = bills.filter(b => b.txnId === txnId);
    if (txnBills.length === 0) { alert("❌ No bills attached"); return; }
    const unverified = txnBills.filter(b => !gstr2b.isBillVerified(b));
    if (unverified.length > 0) {
      alert(`❌ GSTR-2B verification pending for: ${unverified.map(b => b.billNumber).join(", ")}`);
      return;
    }
    const gstBal = round2(txn.gstAmount - txn.advanceAmount);
    if (gstBal > 0) addWalletEntry(`GST Balance — ${txn.vendorName} (${txnId})`, gstBal, 0, "gst", txnId);
    setTransactions(prev => prev.map(t => t.txnId === txnId
      ? { ...t, status: "PendingClose", closedByDistrict: true, pendingAt: new Date().toISOString() }
      : t));
    logAction("CLOSE", "Transaction", txnId);
  };
  const handleDeleteTransaction = (txnId: string) => {
    if (!confirm(`Delete transaction ${txnId}? This also drops attached bills.`)) return;
    setTransactions(prev => prev.filter(t => t.txnId !== txnId));
    setBills(prev => prev.filter(b => b.txnId !== txnId));
    logAction("DELETE", "Transaction", txnId);
  };

  const handleAddBill = async (b: Bill) => {
    setBills(prev => {
      const next = [...prev, { ...b, createdAt: new Date().toISOString() }];
      setTransactions(prevTxns => recalcTransactions(prevTxns, next));
      return next;
    });
    logAction("CREATE", "Bill", b.id);
  };
  const handleBulkAddBill = (newBills: Bill[]) => {
    setBills(prev => {
      const next = [...prev, ...newBills.map(b => ({ ...b, createdAt: new Date().toISOString() }))];
      setTransactions(prevTxns => recalcTransactions(prevTxns, next));
      return next;
    });
    for (const b of newBills) logAction("CREATE", "Bill", b.id);
  };
  const handleDeleteBill = (id: string) => {
    if (!confirm("Delete bill?")) return;
    setBills(prev => {
      const next = prev.filter(b => b.id !== id);
      setTransactions(prevTxns => recalcTransactions(prevTxns, next));
      return next;
    });
    logAction("DELETE", "Bill", id);
  };

  const handleAddManagedUser = async (u: ManagedUser) => {
    setManagedUsers(prev => [...prev, u]);
    logAction("CREATE", "User", u.id);
  };
  const handleToggleUser = (id: string) => {
    setManagedUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
    logAction("UPDATE", "User", id);
  };
  const handleDeleteUser = (id: string) => {
    if (!confirm("Delete user?")) return;
    setManagedUsers(prev => prev.filter(u => u.id !== id));
    logAction("DELETE", "User", id);
  };

  const handleApproveAgent = (agentId: string, type: "auto" | "custom", pct: number) => {
    setAgents(prev => prev.map(a => a.id === agentId
      ? { ...a, status: "approved", approvedBy: user!.username, approvedAt: new Date().toISOString(),
          commissionType: type, customCommissionPercent: pct }
      : a));
    logAction("UPDATE", "Agent", agentId);
  };
  const handleRejectAgent  = (id: string) => { setAgents(prev => prev.map(a => a.id === id ? { ...a, status: "rejected"  } : a)); logAction("UPDATE", "Agent", id); };
  const handleSuspendAgent = (id: string) => { setAgents(prev => prev.map(a => a.id === id ? { ...a, status: a.status === "suspended" ? "approved" : "suspended" } : a)); logAction("UPDATE", "Agent", id); };
  const handleDeleteAgent  = (id: string) => { setAgents(prev => prev.filter(a => a.id !== id)); logAction("DELETE", "Agent", id); };
  const handleSetAgentCommission = (id: string, type: "auto" | "custom", pct: number) =>
    setAgents(prev => prev.map(a => a.id === id ? { ...a, commissionType: type, customCommissionPercent: pct } : a));
  const handleAddOverride    = (o: AgentVendorOverride) => setAgentOverrides(prev => [...prev, o]);
  const handleDeleteOverride = (id: string)             => setAgentOverrides(prev => prev.filter(o => o.id !== id));

  const handleBackup = () => {
    const data = loadFromStorage();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ar-erp-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleRestore = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!confirm("Replace ALL current data with this backup?")) return;
        saveToStorage(parsed);
        window.location.reload();
      } catch {
        alert("❌ Invalid backup file");
      }
    };
    reader.readAsText(file);
  };
  const handleClearData = () => {
    clearAllStorage();
    clearSession();
    window.location.reload();
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden",
                  background: "#f4f6f9", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <aside style={{
        flexShrink: 0, transition: "width 0.3s ease", width: sidebarOpen ? 240 : 56,
        background: "#fff", borderRight: "1px solid #e2e6ea", boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid #e8ecf0", minHeight: 52,
        }}>
          {sidebarOpen && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, background: "#1c3d6e", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
              }}>AR</div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1c2b3a" }}>AR Enterprises</p>
                <p style={{ margin: 0, fontSize: 10, color: "#6b7c93" }}>ERP V3.0</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(s => !s)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            style={{ background: "none", border: "none", color: "#6b7c93", cursor: "pointer", padding: 4, fontSize: 14 }}
          >{sidebarOpen ? "◀" : "▶"}</button>
        </div>

        {sidebarOpen && (
          <div style={{
            margin: "10px 10px 6px", padding: "8px 10px",
            background: "#f2f5f8", borderRadius: 8, borderLeft: "3px solid #1c3d6e",
          }}>
            <p style={{ margin: 0, fontSize: 10, color: "#6b7c93", fontWeight: 600, textTransform: "uppercase" }}>
              {isAdmin ? "Super Admin" : "District Manager"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#1c2b3a" }}>{user!.username}</p>
            {!isAdmin && <p style={{ margin: 0, fontSize: 10, color: "#6b7c93" }}>{district}</p>}
          </div>
        )}

        <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
          {navItems.map(n => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              aria-current={page === n.id ? "page" : undefined}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: sidebarOpen ? 10 : 0,
                padding: sidebarOpen ? "8px 10px" : "9px 0",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                borderRadius: 8, marginBottom: 2,
                fontSize: 13, fontWeight: page === n.id ? 600 : 400,
                color: page === n.id ? "#1c3d6e" : "#6b7c93",
                background: page === n.id ? "#eef2f8" : "transparent",
                border: "none", cursor: "pointer",
                borderLeft: page === n.id ? "3px solid #1c3d6e" : "3px solid transparent",
              }}
            >
              <span style={{ fontSize: 15 }} aria-hidden>{n.icon}</span>
              {sidebarOpen && <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>}
              {sidebarOpen && (n as any).badge > 0 && (
                <span style={{
                  background: "#e53e3e", color: "#fff",
                  fontSize: 10, fontWeight: 700, borderRadius: 10,
                  minWidth: 18, height: 18,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                }}>{(n as any).badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding: 12 }}>
          <button onClick={handleLogout} style={{
            width: "100%", padding: "8px 10px", borderRadius: 8,
            fontSize: 12, color: "#6b7c93", background: "none",
            border: "1px solid #e2e6ea", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            🚪 {sidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{
          background: "#fff", borderBottom: "1px solid #e2e6ea",
          padding: "0 24px", height: 52, display: "flex",
          alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#6b7c93" }}>AR Enterprises</span>
            <span style={{ fontSize: 10, color: "#c8d0d8" }}>›</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1c2b3a", textTransform: "capitalize" }}>
              {page.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#6b7c93" }}>
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", background: "#1c3d6e",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>{user!.username.slice(0, 2).toUpperCase()}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {page === "dashboard" && (
            <DashboardPage
              isAdmin={isAdmin} district={district}
              transactions={myTxns} vendors={myVendors} bills={myBills}
              wallet={wallet} walletBalance={walletBalance}
              pendingClose={pendingClose} onConfirmClose={handleConfirmClose}
              agents={agents} user={user!} gstr2b={gstr2b}
            />
          )}
          {page === "vendors" && (
            <VendorsPage
              isAdmin={isAdmin} district={district}
              vendors={myVendors} allVendors={vendors}
              onAdd={handleAddVendor}
              onUpdate={u => { setVendors(prev => prev.map(v => v.id === u.id ? u : v)); logAction("UPDATE", "Vendor", u.id); }}
              onDelete={handleDeleteVendor}
              onIssuePin={handleIssuePin}
            />
          )}
          {page === "transactions" && (
            <TransactionsPage
              isAdmin={isAdmin} district={district}
              transactions={myTxns} vendors={myVendors} bills={myBills} gstr2b={gstr2b}
              onAdd={handleAddTransaction}
              onClose={handleCloseTransaction}
              onDelete={handleDeleteTransaction}
            />
          )}
          {page === "bills" && (
            <BillsPage
              isAdmin={isAdmin} district={district}
              bills={myBills} transactions={transactions} vendors={vendors} gstr2b={gstr2b}
              onAdd={handleAddBill}
              onBulkAdd={handleBulkAddBill}
              onDelete={handleDeleteBill}
            />
          )}
          {page === "wallet" && isAdmin && (
            <WalletPage
              wallet={wallet} walletBalance={walletBalance}
              onAddManual={(desc, debit, credit) => addWalletEntry(desc, debit, credit, "manual")}
            />
          )}
          {page === "analytics" && isAdmin && (
            <AnalyticsPage transactions={transactions} bills={bills} vendors={vendors} wallet={wallet} />
          )}
          {page === "agents" && isAdmin && (
            <AdminAgentsPage
              agents={agents} agentWallet={agentWallet}
              agentOverrides={agentOverrides} commissionSlabs={commissionSlabs}
              transactions={transactions} vendors={vendors} bills={bills}
              onApprove={handleApproveAgent}
              onReject={handleRejectAgent}
              onSuspend={handleSuspendAgent}
              onDelete={handleDeleteAgent}
              onSetCommission={handleSetAgentCommission}
              onAddOverride={handleAddOverride}
              onDeleteOverride={handleDeleteOverride}
              onUpdateSlabs={setCommissionSlabs}
            />
          )}
          {page === "users" && isAdmin && (
            <UserManagementPage
              districtUsers={managedUsers}
              onAddUser={handleAddManagedUser}
              onUpdateUser={u => setManagedUsers(prev => prev.map(x => x.id === u.id ? u : x))}
              onToggleUser={handleToggleUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
          {page === "audit" && isAdmin && <AuditLogsPage logs={auditLogs} />}
          {page === "reports" && !isAdmin && (
            <ReportsPage transactions={myTxns} bills={myBills} vendors={myVendors} district={district} />
          )}
          {page === "settings" && isAdmin && (
            <SettingsPage
              settings={settings}
              onUpdateSettings={setSettings}
              onBackup={handleBackup}
              onRestore={handleRestore}
              onClearData={handleClearData}
              storageUsed={storageBytesUsed()}
            />
          )}
        </div>
      </main>
    </div>
  );
}
