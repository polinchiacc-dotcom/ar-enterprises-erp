import React from "react";

export function Badge({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "ok" | "warn" | "err" }) {
  const bg = tone === "ok" ? "#d1fae5" : tone === "warn" ? "#fef3c7" : tone === "err" ? "#fee2e2" : "#e0f2fe";
  const fg = tone === "ok" ? "#065f46" : tone === "warn" ? "#92400e" : tone === "err" ? "#991b1b" : "#0369a1";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600, background: bg, color: fg }}>
      {children}
    </span>
  );
}

export function Button({ children, onClick, kind = "primary", small = false, style = {} }: any) {
  const bg = kind === "ghost" ? "transparent" : kind === "outline" ? "#fff" : "#0f172a";
  const color = kind === "ghost" || kind === "outline" ? "#0f172a" : "#fff";
  const border = kind === "outline" ? "1px solid #cbd5e1" : "none";
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? "4px 8px" : "8px 16px",
        fontSize: small ? "11px" : "13px",
        borderRadius: "6px",
        cursor: "pointer",
        background: bg,
        color,
        border,
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({ title, sub, children }: any) {
  return (
    <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px", marginBottom: "16px" }}>
      {title && <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>{title}</h3>}
      {sub && <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b" }}>{sub}</p>}
      {children}
    </div>
  );
}

export function Empty({ children }: any) {
  return <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>{children}</div>;
}

export function PageHead({ title, sub }: any) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>{title}</h1>
      {sub && <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>{sub}</p>}
    </div>
  );
}

export function Spinner() {
  return <div style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #cbd5e1", borderTopColor: "#0f172a", borderRadius: "50%", animation: "spin 1s linear infinite" }} />;
}

export function Table({ children }: any) {
  return <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>;
}

export function useToast() {
  return (success: boolean, message: string) => {
    console.log(`[Toast ${success ? "OK" : "ERR"}]:`, message);
  };
}
