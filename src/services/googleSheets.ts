const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwrPPOya5wWtVM9wFzE7cqSo27Oyf6irXvqhQ3c25x18rAYBoPctoGk7CIdyU8-M8lR/exec';

export async function loadFromSheets(): Promise<boolean> {
  try {
    console.log('📥 Loading from Google Sheets...');
    const response = await fetch(SHEET_URL);
    const data = await response.json();
    
    if (data.status === 'success') {
      const mapped = {
        vendors: (data.vendors || []).map((v: any) => ({
          id: v.vendorCode || Math.random().toString(36).substr(2, 9),
          vendorCode: v.vendorCode || '',
          vendorName: v.vendorName || '',
          district: v.districtName || v.district || '',
          mobile: v.mobile || '',
          businessType: v.businessType || '',
          address: v.address || '',
          gstNo: v.gstNumber || '',
          regYear: v.regYear || ''
        })),
        transactions: (data.transactions || []).map((t: any) => ({
          id: t.txnId || Math.random().toString(36).substr(2, 9),
          txnId: t.txnId || '',
          district: t.districtName || t.district || '',
          vendorCode: t.vendorCode || '',
          vendorName: t.vendorName || '',
          financialYear: t.financialYear || '',
          month: t.month || '',
          expectedAmount: Number(t.expectedAmount) || 0,
          advanceAmount: Number(t.advanceAmount) || 0,
          gstPercent: Number(t.gstPercent) || 0,
          gstAmount: Number(t.gstAmount) || 0,
          gstBalance: Number(t.gstBalance) || 0,
          billsReceived: Number(t.actualGoodsAmount) || 0,
          remainingExpected: Number(t.remainingAmount) || 0,
          status: t.status || 'Open',
          closedByDistrict: t.status === 'PendingClose' || t.status === 'Closed',
          confirmedByAdmin: t.status === 'Closed',
          profit: 0
        })),
        bills: (data.bills || []).map((b: any) => ({
          id: b.billId || Math.random().toString(36).substr(2, 9),
          txnId: b.txnId || '',
          vendorCode: b.vendorCode || '',
          vendorName: b.vendorName || '',
          district: '',
          billNumber: b.billNumber || '',
          billDate: b.billDate || '',
          billAmount: Number(b.billAmount) || 0,
          gstPercent: Number(b.gstPercent) || 0,
          gstAmount: Number(b.gstAmount) || 0,
          totalAmount: Number(b.totalAmount) || 0
        })),
        wallet: (data.wallet || []).map((w: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          date: w.date || '',
          description: w.description || '',
          type: w.type || 'manual',
          debit: Number(w.debit) || 0,
          credit: Number(w.credit) || 0,
          balance: Number(w.balance) || 0
        })),
        managedUsers: (data.users || []).map((u: any) => ({
          id: u.userId || Math.random().toString(36).substr(2, 9),
          username: u.username || '',
          password: u.password || '',
          district: u.districtName || '',
          active: true,
          createdAt: new Date().toISOString().split('T')[0]
        }))
      };
      
      localStorage.setItem('AR_ERP_V3_DATA', JSON.stringify(mapped));
      console.log('✅ Google Sheets → localStorage sync complete');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Sheets load failed:', error);
    return false;
  }
}

export async function saveToSheets(): Promise<boolean> {
  try {
    console.log('☁️ Saving to Google Sheets...');
    const raw = localStorage.getItem('AR_ERP_V3_DATA');
    if (!raw) return false;
    
    const data = JSON.parse(raw);
    
    const payload = {
      action: 'FULL_SYNC',
      vendors: (data.vendors || []).map((v: any) => ({
        vendorCode: v.vendorCode,
        vendorName: v.vendorName,
        districtName: v.district,
        mobile: v.mobile || '',
        businessType: v.businessType || '',
        gstNumber: v.gstNo || '',
        address: v.address || '',
        regYear: v.regYear || '',
        createdAt: new Date().toISOString().split('T')[0]
      })),
      transactions: (data.transactions || []).map((t: any) => ({
        txnId: t.txnId,
        districtName: t.district,
        vendorCode: t.vendorCode,
        vendorName: t.vendorName,
        financialYear: t.financialYear,
        month: t.month,
        expectedAmount: t.expectedAmount,
        advanceAmount: t.advanceAmount,
        gstPercent: t.gstPercent,
        gstAmount: t.gstAmount,
        actualGoodsAmount: t.billsReceived,
        remainingAmount: t.remainingExpected,
        gstBalance: t.gstBalance,
        status: t.status
      })),
      bills: (data.bills || []).map((b: any) => ({
        billId: b.id,
        txnId: b.txnId,
        vendorCode: b.vendorCode,
        vendorName: b.vendorName,
        billNumber: b.billNumber,
        billDate: b.billDate,
        billAmount: b.billAmount,
        gstPercent: b.gstPercent,
        gstAmount: b.gstAmount,
        totalAmount: b.totalAmount
      })),
      wallet: (data.wallet || []).map((w: any) => ({
        date: w.date,
        description: w.description,
        type: w.type,
        debit: w.debit,
        credit: w.credit,
        balance: w.balance
      })),
      users: (data.managedUsers || []).map((u: any) => ({
        userId: u.id,
        username: u.username,
        password: u.password,
        role: 'district',
        districtName: u.district
      }))
    };

    const response = await fetch(SHEET_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.status === 'success') {
      console.log('✅ localStorage → Google Sheets sync complete');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Sheets save failed:', error);
    return false;
  }
}

let syncInterval: number | null = null;

export function startAutoSync(intervalMinutes: number = 5): void {
  saveToSheets();
  
  if (syncInterval) clearInterval(syncInterval);
  
  syncInterval = window.setInterval(() => {
    console.log('🔄 Auto-sync triggered...');
    saveToSheets();
  }, intervalMinutes * 60 * 1000);
  
  console.log(`⏰ Auto-sync started: Every ${intervalMinutes} minutes`);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
