export type PlanPricing = {
  plan: string;
  label: string;
  term_price_kobo: number;
  included_students: number;
  extra_student_kobo: number;
  sort_order: number;
};

export type Addon = { id: string; slug: string; name: string; term_price_kobo: number };

export interface PricingBracket {
  slug: string;
  name: string;
  maxStudents: number;
  termPriceKobo: number;
  storageGb: number;
}

export interface MarketplaceAddon {
  slug: string;
  name: string;
  description: string;
  termPriceKobo: number;
  status: "active" | "coming_soon";
  category: "operations" | "academics" | "communication" | "intelligence";
  iconName?: string;
}

export const OFFICIAL_PRICING_BRACKETS: PricingBracket[] = [
  { slug: "up_to_100", name: "Up to 100 students", maxStudents: 100, termPriceKobo: 2500000, storageGb: 10 },
  { slug: "up_to_200", name: "Up to 200 students", maxStudents: 200, termPriceKobo: 4500000, storageGb: 15 },
  { slug: "up_to_500", name: "Up to 500 students", maxStudents: 500, termPriceKobo: 8000000, storageGb: 20 },
  { slug: "up_to_1000", name: "Up to 1,000 students", maxStudents: 1000, termPriceKobo: 13000000, storageGb: 30 },
];

export const OFFICIAL_ADDONS: MarketplaceAddon[] = [
  {
    slug: "mod_virtual_lab",
    name: "Virtual Science Lab",
    description: "Interactive physics, chemistry, and biology virtual experiments for STEM learners.",
    termPriceKobo: 3500000,
    status: "active",
    category: "academics",
    iconName: "FlaskConical",
  },
  {
    slug: "mod_hostel",
    name: "Hostel & Boarding",
    description: "Room allocations, boarding attendance, roll calls, and medical/incident tracking.",
    termPriceKobo: 2500000,
    status: "active",
    category: "operations",
    iconName: "Building2",
  },
  {
    slug: "mod_transport",
    name: "Transport & Logistics",
    description: "Bus routes, live driver manifests, stop check-ins, and parent ETA tracking.",
    termPriceKobo: 2000000,
    status: "active",
    category: "operations",
    iconName: "Bus",
  },
  {
    slug: "mod_messaging",
    name: "Advanced Comm. (SMS)",
    description: "Direct SMS delivery, urgent broadcasts, and guaranteed parent phone alerts.",
    termPriceKobo: 1500000,
    status: "active",
    category: "communication",
    iconName: "MessageSquare",
  },
  {
    slug: "mod_copilot_flow",
    name: "Copilot Flow (Advanced)",
    description: "Smart automation routines, schedule optimization, and proactive fee notices.",
    termPriceKobo: 2500000,
    status: "active",
    category: "intelligence",
    iconName: "Workflow",
  },
  {
    slug: "mod_copilot_auto",
    name: "Copilot Auto (Beast)",
    description: "Autonomous school operations agent, AI report-card comments, and continuous insights.",
    termPriceKobo: 5000000,
    status: "active",
    category: "intelligence",
    iconName: "Bot",
  },
  {
    slug: "mod_canteen",
    name: "Smart Canteen & Cashless",
    description: "Cashless student meal cards, menu planning, and instant POS reconciliation.",
    termPriceKobo: 1500000,
    status: "coming_soon",
    category: "operations",
    iconName: "Utensils",
  },
  {
    slug: "mod_biometric",
    name: "Biometric Gate Attendance",
    description: "Turnstile gate facial and fingerprint scans with real-time arrivals sync.",
    termPriceKobo: 3000000,
    status: "coming_soon",
    category: "operations",
    iconName: "ScanFace",
  },
];

export const CORE_INCLUSIONS = [
  "Complete School Administration",
  "Digital Gradebook & Report Cards",
  "Complete Exam & CBT Engine (JAMB / WAEC)",
  "Digital Library & Resource Manager",
  "Base Principal AI Copilot",
  "Multi-tenant Portals (Admin, Teacher, Student, Parent)",
];

export const STORAGE_BOOST_OPTIONS = [
  { gb: 0, label: "Default Storage", kobo: 0 },
  { gb: 20, label: "+20 GB Storage", kobo: 500000 },
  { gb: 50, label: "+50 GB Storage", kobo: 1000000 },
];

export function snapStudentCountToBracket(count: number): PricingBracket {
  const n = Math.max(0, count);
  if (n <= 100) return OFFICIAL_PRICING_BRACKETS[0];
  if (n <= 200) return OFFICIAL_PRICING_BRACKETS[1];
  if (n <= 500) return OFFICIAL_PRICING_BRACKETS[2];
  return OFFICIAL_PRICING_BRACKETS[3];
}

export function getBracketBySlug(slug: string): PricingBracket {
  return (
    OFFICIAL_PRICING_BRACKETS.find(b => b.slug === slug) ??
    OFFICIAL_PRICING_BRACKETS[0]
  );
}

export interface CalculationParams {
  bracketSlug: string;
  addonSlugs: string[];
  cycle: "termly" | "annually" | "annual";
  storageBoostGb?: number;
}

export interface CalculationBreakdown {
  bracket: PricingBracket;
  baseKobo: number;
  addonsKobo: number;
  activeAddons: MarketplaceAddon[];
  storageBoostGb: number;
  storageBoostKobo: number;
  totalStorageGb: number;
  termSubtotalKobo: number;
  cycle: "termly" | "annually";
  discountRate: number; // 0.15 for annually
  discountKobo: number;
  finalTotalKobo: number;
  finalTotalNaira: number;
}

export function calculateSubscriptionTotal(params: CalculationParams): CalculationBreakdown {
  const bracket = getBracketBySlug(params.bracketSlug);
  const cycle: "termly" | "annually" = (params.cycle === "annual" || params.cycle === "annually") ? "annually" : "termly";

  const activeAddons = OFFICIAL_ADDONS.filter(
    a => params.addonSlugs.includes(a.slug) && a.status === "active"
  );
  const addonsKobo = activeAddons.reduce((sum, a) => sum + a.termPriceKobo, 0);

  const boostOption = STORAGE_BOOST_OPTIONS.find(o => o.gb === (params.storageBoostGb || 0)) ?? STORAGE_BOOST_OPTIONS[0];
  const storageBoostGb = boostOption.gb;
  const storageBoostKobo = boostOption.kobo;
  const totalStorageGb = bracket.storageGb + storageBoostGb;

  const termSubtotalKobo = bracket.termPriceKobo + addonsKobo + storageBoostKobo;

  let finalTotalKobo = termSubtotalKobo;
  let discountRate = 0;
  let discountKobo = 0;

  if (cycle === "annually") {
    // 3 terms in a school year with a 15% annual prepay discount
    const annualFullKobo = termSubtotalKobo * 3;
    discountRate = 0.15;
    discountKobo = Math.round(annualFullKobo * discountRate);
    finalTotalKobo = annualFullKobo - discountKobo;
  }

  return {
    bracket,
    baseKobo: bracket.termPriceKobo,
    addonsKobo,
    activeAddons,
    storageBoostGb,
    storageBoostKobo,
    totalStorageGb,
    termSubtotalKobo,
    cycle,
    discountRate,
    discountKobo,
    finalTotalKobo,
    finalTotalNaira: Math.round(finalTotalKobo / 100),
  };
}

export function formatNaira(kobo: number): string {
  const n = Math.max(0, Math.round((kobo ?? 0) / 100));
  return "₦" + n.toLocaleString("en-NG");
}

export function naira(kobo: number): number {
  return Math.round((kobo ?? 0) / 100);
}

export function kobo(nairaAmount: number | string): number {
  const n = typeof nairaAmount === "string" ? parseFloat(nairaAmount) : nairaAmount;
  return Math.round((isFinite(n) ? n : 0) * 100);
}

export type RevenueArgs = {
  plan: string;
  studentCount: number;
  includedOverride?: number | null;
  extraKoboOverride?: number | null;
  addons: Addon[];
  planPricing: PlanPricing[];
};

export type RevenueResult = {
  termKobo: number;
  annualKobo: number;
  basePlanKobo: number;
  extraStudentKobo: number;
  addonsKobo: number;
  extraStudents: number;
};

export function revenueForSchool(args: RevenueArgs): RevenueResult {
  const tier = args.planPricing.find(p => p.plan === args.plan);
  const basePlanKobo = tier?.term_price_kobo ?? 0;
  const included = args.includedOverride ?? tier?.included_students ?? 0;
  const perStudent = args.extraKoboOverride ?? tier?.extra_student_kobo ?? 0;
  const extraStudents = Math.max(0, (args.studentCount || 0) - included);
  const extraStudentKobo = extraStudents * perStudent;
  const addonsKobo = args.addons.reduce((s, a) => s + (a.term_price_kobo || 0), 0);
  const termKobo = basePlanKobo + extraStudentKobo + addonsKobo;
  return {
    termKobo,
    annualKobo: termKobo * 3,
    basePlanKobo,
    extraStudentKobo,
    addonsKobo,
    extraStudents,
  };
}