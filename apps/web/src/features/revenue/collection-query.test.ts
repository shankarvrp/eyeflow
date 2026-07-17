import { describe, expect, it } from "vitest";
import {
  defaultDashboardQuery,
  shiftDateKey,
  validateCollectionDate,
  validateDashboardRange,
} from "./collection-query";

describe("collection date authorization", () => {
  it("allows users to browse backward within the current month", () => {
    const today = defaultDashboardQuery().from;
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    expect(
      validateDashboardRange(
        {
          ...defaultDashboardQuery(),
          from: firstOfMonth,
          to: today,
        },
        false,
      ),
    ).toMatchObject({ from: firstOfMonth, to: today });
  });

  it("prevents users from browsing outside the current month", () => {
    const today = defaultDashboardQuery().from;
    expect(() =>
      validateDashboardRange(
        {
          ...defaultDashboardQuery(),
          from: shiftDateKey(`${today.slice(0, 7)}-01`, -1),
          to: today,
        },
        false,
      ),
    ).toThrow();
  });

  it("allows administrators to use a larger historical range", () => {
    const today = defaultDashboardQuery().from;
    const historical = shiftDateKey(today, -120);
    expect(
      validateDashboardRange({ ...defaultDashboardQuery(), from: historical, to: today }, true),
    ).toMatchObject({ from: historical, to: today });
  });

  it("allows normal users to create collections only today", () => {
    const today = defaultDashboardQuery().from;
    expect(() => validateCollectionDate(shiftDateKey(today, -1), false)).toThrow();
    expect(() => validateCollectionDate(today, false)).not.toThrow();
  });
});
