import type { DepartmentName } from "@eyeflow/shared";

export interface DepartmentSummary {
  amount: number;
  change: number;
  color: string;
  name: DepartmentName;
}

export interface RecentCollection {
  amount: number;
  canEdit: boolean;
  department: DepartmentName;
  discount: number;
  id: string;
  customerId: string;
  mode: "Cash" | "Credit" | "Online";
  occurredAt: string;
  patient: string;
  providerOrMode: string | null;
  source: "emr" | "eyeflow";
  time: string;
}

export interface PatientCollectionSummary {
  canEdit: boolean;
  collections: RecentCollection[];
  customerId: string;
  departments: DepartmentName[];
  lastCollectionAt: string;
  patient: string;
  total: number;
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

export interface DashboardData {
  closure?: {
    closedAt: string | null;
    reason: string | null;
    status: "closed" | "open";
  };
  departments: DepartmentSummary[];
  filter: { from: string; to: string };
  pagination: {
    collectionPage: number;
    pageSize: number;
    patientPage: number;
    totalCollections: number;
    totalPatients: number;
  };
  patientCollections: PatientCollectionSummary[];
  recentCollections: RecentCollection[];
  reconciliation?: {
    importedGross: number;
    importedNet: number;
    manualNet: number;
    refundTotal: number;
    reviewLines: number;
    sourceLines: number;
  };
  signoffs?: {
    declaredTotal: number;
    overallTotal: number;
    periods: Array<{
      calculatedNet: number;
      declaredCash: number;
      declaredCredit: number;
      declaredDiscount: number;
      declaredNet: number;
      declaredOnline: number;
      note: string;
      period: "endofday" | "midday";
      signedAt: string;
    }>;
    variance: number;
  };
  summary: DashboardSummary;
  targets: {
    daily: TargetProgress;
    monthly?: TargetProgress;
    weekly?: TargetProgress;
  };
}

export interface TargetProgress {
  actual: number;
  label: string;
  target: number;
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
    canEdit: true,
    customerId: "demo-anita",
    discount: 0,
    id: "1",
    patient: "Anita Rao",
    department: "OPD",
    mode: "Online",
    amount: 1250,
    occurredAt: new Date().toISOString(),
    providerOrMode: "UPI",
    source: "eyeflow",
    time: "10:42 AM",
  },
  {
    canEdit: true,
    customerId: "demo-mohan",
    discount: 0,
    id: "2",
    patient: "Mohan Kumar",
    department: "Opticals",
    mode: "Cash",
    amount: 4800,
    occurredAt: new Date().toISOString(),
    providerOrMode: null,
    source: "eyeflow",
    time: "10:36 AM",
  },
  {
    canEdit: true,
    customerId: "demo-sana",
    discount: 0,
    id: "3",
    patient: "Sana Iqbal",
    department: "Investigation",
    mode: "Credit",
    amount: 3200,
    occurredAt: new Date().toISOString(),
    providerOrMode: "CGHS",
    source: "eyeflow",
    time: "10:28 AM",
  },
  {
    canEdit: true,
    customerId: "demo-peter",
    discount: 0,
    id: "4",
    patient: "Peter James",
    department: "Pharmacy",
    mode: "Online",
    amount: 1840,
    occurredAt: new Date().toISOString(),
    providerOrMode: "UPI",
    source: "eyeflow",
    time: "10:15 AM",
  },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
