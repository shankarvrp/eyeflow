export const departments = ["OPD", "Investigation", "Pharmacy", "OT", "Opticals"] as const;

export type DepartmentName = (typeof departments)[number];

export const paymentKinds = ["cash", "credit", "online"] as const;

export type PaymentKind = (typeof paymentKinds)[number];
