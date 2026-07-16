import type { DepartmentName } from "@eyeflow/shared";

export interface DepartmentSummary {
  amount: number;
  change: number;
  color: string;
  name: DepartmentName;
}

export interface RecentCollection {
  amount: number;
  department: DepartmentName;
  id: string;
  mode: "Cash" | "Credit" | "Online";
  patient: string;
  time: string;
}

export interface DashboardSummary {
  cash: number;
  credit: number;
  discount: number;
  online: number;
  patients: number;
  revenue: number;
  transactions: number;
}

export const initialDashboardSummary: DashboardSummary = {
  cash: 67250,
  credit: 36520,
  discount: 5900,
  online: 58140,
  patients: 132,
  revenue: 167910,
  transactions: 148,
};

export const departmentSummaries: DepartmentSummary[] = [
  { name: "OPD", amount: 48600, change: 12.4, color: "blue" },
  { name: "Investigation", amount: 32750, change: 8.1, color: "cyan" },
  { name: "Pharmacy", amount: 24120, change: -2.3, color: "green" },
  { name: "OT", amount: 18900, change: 4.7, color: "orange" },
  { name: "Opticals", amount: 37640, change: 16.2, color: "purple" },
];

export const recentCollections: RecentCollection[] = [
  {
    id: "1",
    patient: "Anita Rao",
    department: "OPD",
    mode: "Online",
    amount: 1250,
    time: "10:42 AM",
  },
  {
    id: "2",
    patient: "Mohan Kumar",
    department: "Opticals",
    mode: "Cash",
    amount: 4800,
    time: "10:36 AM",
  },
  {
    id: "3",
    patient: "Sana Iqbal",
    department: "Investigation",
    mode: "Credit",
    amount: 3200,
    time: "10:28 AM",
  },
  {
    id: "4",
    patient: "Peter James",
    department: "Pharmacy",
    mode: "Online",
    amount: 1840,
    time: "10:15 AM",
  },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
