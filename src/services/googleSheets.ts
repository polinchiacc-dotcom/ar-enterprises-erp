const SHEET_URL = 'https://script.google.com/macros/s/AKfycbz6a9sjjpl3rF-FdCt969SIAcpEpOZvOigxfVWzHoB9-BZLvgGinsYlYRpgWvkedkys/exec';
const API_KEY = 'AR_PUDUKKOTTAI_2025_SECRET';
export const LS_KEY = 'AR_ERP_V3_DATA_ENCRYPTED';

export interface StorageData {
  vendors: any[];
  transactions: any[];
  bills: any[];
  wallet: any[];
  managedUsers: any[];
  auditLogs?: any[];
  agents?: any[];
  agentWallet?: any[];
  agentOverrides?: any[];
}

export async function saveToSheets(): Promise<boolean> {
  console.log('☁️ Attempting to save to Google Sheets...');
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { console.log('📭 No data'); return false; }

    const parsed: StorageData = JSON.parse(raw);
    console.log('📤 Syncing:', {
      vendors: parsed.vendors?.length ?? 0,
      transactions: parsed.transactions?.length ?? 0,
      bills: parsed.bills?.length ?? 0,
      agents: parsed.agents?.length ?? 0,
    });

    const payload = {
      action: 'FULL_SYNC',
      apiKey: API_KEY,
      vendors: (parsed.vendors ?? []).map((v: any) => ({
        vendorCode: v.vendorCode, vendorName: v.vendorName,
        districtName: v.district, mobile: v.mobile ?? '',
        businessType: v.businessType ?? '', gstNumber: v.gstNo ?? '',
        address: v.address ?? '', regYear: v.regYear ?? '',
        createdAt: new Date().toISOString().split('T')[0],
      })),
      transactions: (parsed.transactions ?? []).map((t: any) => ({
        txnId: t.txnId, districtName: t.district,
        vendorCode: t.vendorCode, vendorName: t.vendorName,
        financialYear: t.financialYear, month: t.month,
        expectedAmount: t.expectedAmount, advanceAmount: t.advanceAmount,
        gstPercent: t.gstPercent, gstAmount: t.gstAmount,
        actualGoodsAmount: t.billsReceived, remainingAmount: t.remainingExpected,
        gstBalance: t.gstBalance, status: t.status,
      })),
      bills: (parsed.bills ?? []).map((b: any) => ({
        billId: b.id, txnId: b.txnId, vendorCode: b.vendorCode,
        vendorName: b.vendorName, billNumber: b.billNumber,
        billDate: b.billDate, billAmount: b.billAmount,
        gstPercent: b.gstPercent, gstAmount: b.gstAmount, totalAmount: b.totalAmount,
      })),
      wallet: (parsed.wallet ?? []).map((w: any) => ({
        date: w.date, description: w.description, type: w.type,
        debit: w.debit, credit: w.credit, balance: w.balance,
      })),
      users: (parsed.managedUsers ?? []).map((u: any) => ({
        userId: u.id, username: u.username, password: u.password,
        role: 'district', districtName: u.district,
        active: u.active ? 'TRUE' : 'FALSE', createdAt: u.createdAt ?? '',
      })),
      auditLogs: parsed.auditLogs ?? [],
      agents: (parsed.agents ?? []).map((a: any) => ({
        agentId: a.agentId ?? a.id,
        fullName: a.fullName ?? '',
        username: a.username ?? '',
        password: a.password ?? '',
        mobile: a.mobile ?? '',
        managerId: a.managerId ?? '',
        managerName: a.managerName ?? '',
        managerDistrict: a.managerDistrict ?? '',
        commissionType: a.commissionType ?? 'auto',
        customCommissionPercent: a.customCommissionPercent ?? 0,
        bankName: a.bankName ?? '',
        accountNumber: a.accountNumber ?? '',
        ifscCode: a.ifscCode ?? '',
        upiId: a.upiId ?? '',
        status: a.status ?? 'pending',
        approvedBy: a.approvedBy ?? '',
        approvedAt: a.approvedAt ?? '',
        commissionBalance: a.commissionBalance ?? 0,
        createdAt: a.createdAt ?? '',
        lastLogin: a.lastLogin ?? '',
      })),
      agentWallet: (parsed.agentWallet ?? []).map((w: any) => ({
        id: w.id,
        agentId: w.agentId,
        date: w.date,
        description: w.description,
        txnId: w.txnId,
        vendorName: w.vendorName,
        billAmount: w.billAmount,
        gstPercent: w.gstPercent,
        commissionPercent: w.commissionPercent,
        commissionAmount: w.commissionAmount,
        commissionType: w.commissionType,
        balance: w.balance,
      })),
      agentOverrides: (parsed.agentOverrides ?? []).map((o: any) => ({
        id: o.id,
        agentId: o.agentId,
        vendorCode: o.vendorCode,
        vendorName: o.vendorName,
        commissionPercent: o.commissionPercent,
        setBy: o.setBy,
        setAt: o.setAt,
      })),
    };

    await fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });

    console.log('✅ Data sent to Google Sheets');
    return true;
  } catch (err) {
    console.error('❌ Save error:', err);
    return false;
  }
}

export async function loadFromSheets(): Promise<boolean> {
  console.log('📥 Attempting to load from Google Sheets...');
  try {
    const url = `${SHEET_URL}?action=LOAD&apiKey=${encodeURIComponent(API_KEY)}`;
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    if (text.trim().startsWith('<')) {
      console.error('❌ Got HTML instead of JSON — check Apps Script doGet()');
      return false;
    }

    const data = JSON.parse(text);
    if (data.status === 'error') {
      console.error('❌ Script error:', data.message);
      return false;
    }

    console.log('📥 Received:', {
      vendors: data.vendors?.length ?? 0,
      transactions: data.transactions?.length ?? 0,
      bills: data.bills?.length ?? 0,
      agents: data.agents?.length ?? 0,
    });

    if (!data.vendors?.length && !data.transactions?.length && !data.bills?.length) {
      console.log('⚠️ Empty data from Sheets — keeping localStorage');
      return false;
    }

    const storageData: StorageData = {
      vendors: (data.vendors ?? []).map((v: any) => ({
        id: v.vendorCode ?? Math.random().toString(36).substr(2, 9),
        vendorCode: v.vendorCode ?? '', vendorName: v.vendorName ?? '',
        district: v.districtName ?? '', mobile: v.mobile ?? '',
        businessType: v.businessType ?? '', address: v.address ?? '',
        gstNo: v.gstNumber ?? '', regYear: v.regYear ?? '',
      })),
      transactions: (data.transactions ?? []).map((t: any) => ({
        id: t.txnId ?? Math.random().toString(36).substr(2, 9),
        txnId: t.txnId ?? '', district: t.districtName ?? '',
        vendorCode: t.vendorCode ?? '', vendorName: t.vendorName ?? '',
        financialYear: t.financialYear ?? '', month: t.month ?? '',
        expectedAmount: Number(t.expectedAmount) || 0,
        advanceAmount: Number(t.advanceAmount) || 0,
        gstPercent: Number(t.gstPercent) || 0,
        gstAmount: Number(t.gstAmount) || 0,
        gstBalance: Number(t.gstBalance) || 0,
        billsReceived: Number(t.actualGoodsAmount) || 0,
        remainingExpected: Number(t.remainingAmount) || 0,
        status: t.status ?? 'Open',
        closedByDistrict: t.status === 'PendingClose' || t.status === 'Closed',
        confirmedByAdmin: t.status === 'Closed',
        profit: 0,
      })),
      bills: (data.bills ?? []).map((b: any) => ({
        id: b.billId ?? Math.random().toString(36).substr(2, 9),
        txnId: b.txnId ?? '', vendorCode: b.vendorCode ?? '',
        vendorName: b.vendorName ?? '', district: '',
        billNumber: b.billNumber ?? '', billDate: b.billDate ?? '',
        billAmount: Number(b.billAmount) || 0,
        gstPercent: Number(b.gstPercent) || 0,
        gstAmount: Number(b.gstAmount) || 0,
        totalAmount: Number(b.totalAmount) || 0,
      })),
      wallet: (data.wallet ?? []).map((w: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        date: w.date ?? '', description: w.description ?? '',
        type: w.type ?? 'manual',
        debit: Number(w.debit) || 0,
        credit: Number(w.credit) || 0,
        balance: Number(w.balance) || 0,
      })),
      managedUsers: (data.users ?? []).map((u: any) => ({
        id: u.userId ?? Math.random().toString(36).substr(2, 9),
        username: u.username ?? '', password: u.password ?? '',
        district: u.districtName ?? '',
        active: u.active === 'TRUE' || u.active === true,
        createdAt: u.createdAt ?? new Date().toISOString().split('T')[0],
      })),
      auditLogs: data.auditLogs ?? [],
      agents: (data.agents ?? []).map((a: any) => ({
        id: a.agentId ?? Math.random().toString(36).substr(2, 9),
        agentId: a.agentId ?? '',
        fullName: a.fullName ?? '',
        username: a.username ?? '',
        password: a.password ?? '',
        mobile: String(a.mobile ?? ''),
        managerId: a.managerId ?? '',
        managerName: a.managerName ?? '',
        managerDistrict: a.managerDistrict ?? '',
        commissionType: a.commissionType ?? 'auto',
        customCommissionPercent: Number(a.customCommissionPercent) || 0,
        bankName: a.bankName ?? '',
        accountNumber: a.accountNumber ?? '',
        ifscCode: a.ifscCode ?? '',
        upiId: a.upiId ?? '',
        status: a.status ?? 'pending',
        approvedBy: a.approvedBy ?? '',
        approvedAt: a.approvedAt ?? '',
        commissionBalance: Number(a.commissionBalance) || 0,
        createdAt: a.createdAt ?? '',
        lastLogin: a.lastLogin ?? '',
      })),
      agentWallet: data.agentWallet ?? [],
      agentOverrides: data.agentOverrides ?? [],
    };

    localStorage.setItem(LS_KEY, JSON.stringify(storageData));
    console.log('✅ Google Sheets → localStorage sync complete');
    return true;
  } catch (err) {
    console.error('❌ Load error:', err);
    return false;
  }
}

let _syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMinutes = 5): void {
  stopAutoSync();
  console.log(`⏰ Auto-sync started: Every ${intervalMinutes} minutes`);
  setTimeout(() => saveToSheets().catch(console.error), 5000);
  _syncInterval = setInterval(
    () => saveToSheets().catch(console.error),
    intervalMinutes * 60 * 1000
  );
}

export function stopAutoSync(): void {
  if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
}
