import { describe, it, expect, beforeEach } from "vitest";
import {
  getCurrentSchoolSlug,
  getStoredSchoolSlug,
  getResolvedSchoolSlug,
  storeSchoolSlug,
  schoolPath,
  tenantHomePath,
} from "@/lib/tenant";

describe("multi-tenant slug resolution & routing helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("returns null for root and reserved platform routes", () => {
    const reservedRoutes = ["/", "/register", "/signin", "/super", "/app", "/join", "/bio"];
    for (const route of reservedRoutes) {
      window.history.pushState({}, "", route);
      expect(getCurrentSchoolSlug()).toBeNull();
    }
  });

  it("extracts tenant slug from URL path or ?school= query param", () => {
    window.history.pushState({}, "", "/demo-academy/app/admin");
    expect(getCurrentSchoolSlug()).toBe("demo-academy");

    window.history.pushState({}, "", "/signin?school=Greenfield-High");
    expect(getCurrentSchoolSlug()).toBe("greenfield-high");
  });

  it("persists and resolves fallback school slug from localStorage", () => {
    expect(getStoredSchoolSlug()).toBeNull();
    storeSchoolSlug("Royal-College");
    expect(getStoredSchoolSlug()).toBe("royal-college");

    window.history.pushState({}, "", "/signin");
    expect(getResolvedSchoolSlug()).toBe("royal-college");
    expect(tenantHomePath()).toBe("/royal-college");
  });

  it("constructs tenant-prefixed paths with schoolPath()", () => {
    expect(schoolPath("demo", "/app/admin")).toBe("/demo/app/admin");
    expect(schoolPath("demo", "signin")).toBe("/demo/signin");
    expect(schoolPath(null, "/signin")).toBe("/signin");
  });
});