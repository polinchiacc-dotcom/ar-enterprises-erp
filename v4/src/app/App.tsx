import React from "react";
import { I18nProvider } from "../i18n";
import { Reports } from "../features/reports/Reports";
import type { User } from "../types";

const mockUser: User = {
  id: "u1",
  username: "admin",
  role: "super_admin",
  district: "ALL",
  name: "Super Admin",
};

export default function App() {
  return (
    <I18nProvider>
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
        <header style={{ background: "#0d1b2a", color: "#fff", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "16px" }}>AR Enterprises ERP — V4</div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>Version 4.0.0 (Release R14)</div>
        </header>
        <main style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>
          <Reports user={mockUser} />
        </main>
      </div>
    </I18nProvider>
  );
}
