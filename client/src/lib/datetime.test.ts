import { describe, expect, it } from "vitest";
import {
  formatJakartaDateKey,
  formatOverviewDate,
  getGreeting,
  resolveDisplayName,
  shiftDateKey,
} from "./datetime";

describe("getGreeting", () => {
  it.each([
    [3, "Selamat malam"],
    [4, "Selamat pagi"],
    [10, "Selamat pagi"],
    [11, "Selamat siang"],
    [14, "Selamat siang"],
    [15, "Selamat sore"],
    [17, "Selamat sore"],
    [18, "Selamat malam"],
    [23, "Selamat malam"],
  ])("returns the greeting for local hour %i", (hour, expected) => {
    const date = new Date(2025, 0, 15, hour);
    expect(getGreeting(date)).toBe(expected);
  });
});

describe("formatOverviewDate", () => {
  it("formats a local date in Indonesian", () => {
    expect(formatOverviewDate(new Date(2024, 8, 19))).toBe(
      "Kamis, 19 September 2024"
    );
  });
});

describe("Jakarta report dates", () => {
  it("uses the Asia/Jakarta calendar day for report queries", () => {
    expect(formatJakartaDateKey(new Date("2025-01-01T18:00:00.000Z"))).toBe(
      "2025-01-02"
    );
    expect(shiftDateKey("2025-01-01", -1)).toBe("2024-12-31");
  });
});

describe("resolveDisplayName", () => {
  it("uses the first available identity source without returning an empty name", () => {
    expect(resolveDisplayName("Dhanny", "Google Name", "username", "a@b.test")).toBe(
      "Dhanny"
    );
    expect(resolveDisplayName(null, null, null, "coffee@shop.test")).toBe(
      "coffee"
    );
    expect(resolveDisplayName()).toBe("Pengguna");
  });
});
