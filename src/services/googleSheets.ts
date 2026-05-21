const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";

export async function loadFromSheets(): Promise<void> {
  try {
    console.log("📥 Attempting to load from Google Sheets...");
    if (!SCRIPT_URL) return;

    const response = await fetch(`${SCRIPT_URL}?action=getData`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    console.log("📥 Received:", {
      vendors:      data.payload?.vendors?.length      || data.vendors,
      transactions: data.payload?.transactions?.length || data.transactions,
      bills:        data.payload?.bills?.length        || data.bills,
      agents:       data.payload?.agents?.length       || data.agents,
    });

    if (data && data.success && data.payload) {
      const existing = JSON.parse(
        localStorage.getItem("AR_ERP_V3_DATA_ENCRYPTED") || "{}"
      );
      const remote = data.payload;

      // ✅ managedUsers — LOCAL ALWAYS WINS
      // Google Sheets managedUsers-ஐ NEVER override செய்யாதே
      const localUsers: any[] = existing.managedUsers || [];
      const remoteUsers: any[] = remote.managedUsers || [];

      const mergedUsers = [...localUsers];
      remoteUsers.forEach((ru: any) => {
        const exists = mergedUsers.find(lu => lu.username === ru.username);
        if (!exists) mergedUsers.push(ru);
      });

      const merged = {
        vendors:        remote.vendors        || existing.vendors        || [],
        transactions:   remote.transactions   || existing.transactions   || [],
        bills:          remote.bills          || existing.bills          || [],
        wallet:         remote.wallet         || existing.wallet         || [],
        auditLogs:      remote.auditLogs      || existing.auditLogs      || [],
        agents:         remote.agents         || existing.agents         || [],
        agentWallet:    remote.agentWallet    || existing.agentWallet    || [],
        agentOverrides: remote.agentOverrides || existing.agentOverrides || [],
        managedUsers:   mergedUsers,
        schemaVersion:  remote.schemaVersion  || existing.schemaVersion,
      };

      localStorage.setItem(
        "AR_ERP_V3_DATA_ENCRYPTED",
        JSON.stringify(merged)
      );
      console.log("✅ Google Sheets → localStorage sync complete");
    }
  } catch (err) {
    console.log("❌ Sheets load failed:", err);
  }
}

export async function saveToSheets(): Promise<void> {
  try {
    if (!SCRIPT_URL) return;
    console.log("☁️ Attempting to save to Google Sheets...");
    const stored = localStorage.getItem("AR_ERP_V3_DATA_ENCRYPTED");
    if (!stored) return;
    const data = JSON.parse(stored);
    console.log("📤 Syncing:", {
      vendors:      data.vendors?.length,
      transactions: data.transactions?.length,
      bills:        data.bills?.length,
      agents:       data.agents?.length,
    });
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveData", payload: data }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log("✅ Data sent to Google Sheets");
  } catch (err) {
    console.log("❌ Save error:", err);
  }
}

export function startAutoSync(intervalMinutes: number = 5): void {
  console.log(`⏰ Auto-sync started: Every ${intervalMinutes} minutes`);
  setInterval(() => {
    saveToSheets().catch(err => console.log("Auto-sync failed:", err));
  }, intervalMinutes * 60 * 1000);
}
