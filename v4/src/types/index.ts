export type Role = "super_admin" | "district_admin" | "agent" | "vendor" | "auditor";

export interface User {
  id: string;
  username: string;
  role: Role;
  district?: string;
  name?: string;
}

export type ReportResult = any;
