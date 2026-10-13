import React, { createContext, useContext, useState, useMemo } from "react";
import {
  calculateSubscriptionTotal,
  snapStudentCountToBracket,
  CalculationBreakdown,
  OFFICIAL_PRICING_BRACKETS,
} from "@/lib/pricing";
import { initializePaystackCheckout } from "@/api/paystackInit";
import { toast } from "sonner";

export interface CheckoutContextType {
  baseTier: string;
  setBaseTier: (tier: string) => void;
  studentCount: number;
  setStudentCount: (count: number) => void;
  addons: string[];
  setAddons: (addons: string[]) => void;
  toggleAddon: (slug: string) => void;
  cycle: "termly" | "annually";
  setCycle: (cycle: "termly" | "annually") => void;
  storageBoostGb: number;
  setStorageBoostGb: (gb: number) => void;
  breakdown: CalculationBreakdown;
  applyRecommendation: (rec: {
    recommended_bracket: string;
    recommended_addons: string[];
    suggested_student_count?: number;
  }) => void;
  isCheckingOut: boolean;
  startCheckout: (schoolId: string) => Promise<void>;
}

const CheckoutContext = createContext<CheckoutContextType | null>(null);

export const CheckoutProvider: React.FC<{ children: React.ReactNode; initialStudents?: number }> = ({
  children,
  initialStudents = 100,
}) => {
  const [studentCount, setStudentCountState] = useState<number>(initialStudents);
  const [baseTier, setBaseTier] = useState<string>(() => {
    return snapStudentCountToBracket(initialStudents).slug;
  });
  const [addons, setAddons] = useState<string[]>([]);
  const [cycle, setCycle] = useState<"termly" | "annually">("termly");
  const [storageBoostGb, setStorageBoostGb] = useState<number>(0);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  const setStudentCount = (count: number) => {
    const validCount = Math.max(0, count);
    setStudentCountState(validCount);
    const snapped = snapStudentCountToBracket(validCount);
    setBaseTier(snapped.slug);
  };

  const toggleAddon = (slug: string) => {
    setAddons((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const applyRecommendation = (rec: {
    recommended_bracket: string;
    recommended_addons: string[];
    suggested_student_count?: number;
  }) => {
    if (rec.recommended_bracket) {
      setBaseTier(rec.recommended_bracket);
    }
    if (rec.suggested_student_count != null && rec.suggested_student_count > 0) {
      setStudentCountState(rec.suggested_student_count);
    } else {
      const match = OFFICIAL_PRICING_BRACKETS.find((b) => b.slug === rec.recommended_bracket);
      if (match) setStudentCountState(match.maxStudents);
    }
    if (Array.isArray(rec.recommended_addons)) {
      setAddons(rec.recommended_addons);
    }
  };

  const breakdown = useMemo(() => {
    return calculateSubscriptionTotal({
      bracketSlug: baseTier,
      addonSlugs: addons,
      cycle,
      storageBoostGb,
    });
  }, [baseTier, addons, cycle, storageBoostGb]);

  const startCheckout = async (schoolId: string) => {
    if (!schoolId) {
      toast.error("School ID is required for checkout.");
      return;
    }
    setIsCheckingOut(true);
    try {
      const res = await initializePaystackCheckout({
        school_id: schoolId,
        bracket: baseTier,
        addons,
        cycle,
        storage_boost_gb: storageBoostGb,
      });

      if (res.authorization_url) {
        toast.success("Redirecting to Paystack secure checkout…");
        window.location.href = res.authorization_url;
      } else if (res.inline) {
        // Modal opened or handled inline via PaystackPop
      } else {
        throw new Error("No authorization URL returned from Paystack");
      }
    } catch (err: any) {
      console.error("[Checkout] failed", err);
      toast.error(err.message || "Failed to start checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <CheckoutContext.Provider
      value={{
        baseTier,
        setBaseTier,
        studentCount,
        setStudentCount,
        addons,
        setAddons,
        toggleAddon,
        cycle,
        setCycle,
        storageBoostGb,
        setStorageBoostGb,
        breakdown,
        applyRecommendation,
        isCheckingOut,
        startCheckout,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
};

export function useCheckout(): CheckoutContextType {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error("useCheckout must be used within a CheckoutProvider");
  }
  return ctx;
}
