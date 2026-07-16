import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCurrency } from "./dashboard-data";

describe("dashboard formatting", () => {
  it("formats Indian Rupee values without paise", () => {
    render(<output>{formatCurrency(167_910)}</output>);
    expect(screen.getByText(/1,67,910/)).toBeInTheDocument();
  });
});
