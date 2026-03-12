const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzfLJVDlZH5GrPlDSqt8ws6FM1Al_GELxNElOBLPecXf7hlAhB4VR8yoAif-B0C4pBY/exec';
const API_KEY = 'AR_PUDUKKOTTAI_2025_SECRET';
const LS_KEY = "AR_ERP_V3_DATA_ENCRYPTED";

export interface StorageData {
  vendors: any[];
  transactions: any[];
  bills: any[];
  wallet: any[];
  managedUsers: any[];
  auditLogs?: any[];
}

export async function saveToSheets(): Promise<boolean> {
  console.log('☁️ Attempting to save to Google Sheets...');
  
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_ACTUAL_DEPLOYMENT_URL_HERE') {
    console.log('⚠️ Google Sheets URL not configured');
    return false;
  }

  try {
    const data = localStorage.getItem(LS_KEY);
    if (!data) {
      console.log('📭 No data to sync');
      return false;
    }

    // Decrypt data
    const parsed: StorageData = JSON.parse(data);
    
    console.log('📤 Sending data:', {
      vendors: parsed.vendors?.length || 0,
      transactions: parsed.transactions?.length || 0,
      bills: parsed.bills?.length || 0
    });
    
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'FULL_SYNC',
        apiKey: API_KEY,
        data: {
          vendors: parsed.vendors || [],
          transactions: parsed.transactions || [],
          bills: parsed.bills || [],
          wallet: parsed.wallet || [],
          managedUsers: parsed.managedUsers || [],
          auditLogs: parsed.auditLogs || []
        }
      }),
      mode: 'no-cors' // Important for Google Apps Script
    });

    console.log('✅ Data sent to Google Sheets (no-cors mode)');
    return true;
    
  } catch (err) {
    console.error('❌ Sheets sync error:', err);
    return false;
  }
}

export async function loadFromSheets(): Promise<boolean> {
  console.log('📥 Attempting to load from Google Sheets...');
  
  if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_ACTUAL_DEPLOYMENT_URL_HERE') {
    console.log('⚠️ Google Sheets URL not configured');
    return false;
  }

  try {
    const url = `${SCRIPT_URL}?action=LOAD&apiKey=${encodeURIComponent(API_KEY)}`;
    
    console.log('🔗 Fetching from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('📥 Received data:', {
      vendors: data.vendors?.length || 0,
      transactions: data.transactions?.length || 0,
      bills: data.bills?.length || 0
    });
    
    if (data && (data.vendors || data.transactions)) {
      const storageData: StorageData = {
        vendors: data.vendors || [],
        transactions: data.transactions || [],
        bills: data.bills || [],
        wallet: data.wallet || [],
        managedUsers: data.managedUsers || [],
        auditLogs: data.auditLogs || []
      };
      
      localStorage.setItem(LS_KEY, JSON.stringify(storageData));
      console.log('✅ Google Sheets → localStorage sync complete');
      return true;
    }
    
    return false;
    
  } catch (err) {
    console.error('❌ Sheets load error:', err);
    return false;
  }
}

export function startAutoSync(intervalMinutes: number = 5): void {
  console.log(`⏰ Auto-sync started: Every ${intervalMinutes} minutes`);
  
  // Initial sync after 10 seconds
  setTimeout(() => {
    saveToSheets().catch(err => 
      console.log('Initial sync skipped:', err)
    );
  }, 10000);
  
  // Periodic sync
  setInterval(() => {
    saveToSheets().catch(err => 
      console.log('Background sync skipped:', err)
    );
  }, intervalMinutes * 60 * 1000);
}
