import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  HardDrive,
  Users,
  Calendar,
  CreditCard,
  Loader2,
  ArrowRight,
  FlaskConical,
  Building2,
  Bus,
  MessageSquare,
  Workflow,
  Bot,
  Utensils,
  ScanFace,
  Info,
} from "lucide-react";
import {
  CORE_INCLUSIONS,
  OFFICIAL_ADDONS,
  OFFICIAL_PRICING_BRACKETS,
  STORAGE_BOOST_OPTIONS,
  formatNaira,
  calculateSubscriptionTotal,
  snapStudentCountToBracket,
  MarketplaceAddon,
} from "@/lib/pricing";
import { PlanRecommenderModal } from "@/components/PlanRecommenderModal";
import { AIPlanRecommendation } from "@/api/aiRecommender";
import { initializePaystackCheckout } from "@/api/paystackInit";
import { useSchool } from "@/contexts/SchoolContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SubscriptionBuilderProps {
  schoolId?: string;
  initialStudentCount?: number;
  initialBracket?: string;
  initialAddons?: string[];
  initialCycle?: "termly" | "annually";
  isPublicPreview?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  FlaskConical,
  Building2,
  Bus,
  MessageSquare,
  Workflow,
  Bot,
  Utensils,
  ScanFace,
};

export const SubscriptionBuilder: React.FC<SubscriptionBuilderProps> = ({
  schoolId,
  initialStudentCount = 100,
  initialBracket,
  initialAddons = [],
  initialCycle = "termly",
  isPublicPreview = false,
}) => {
  const navigate = useNavigate();
  const { user, school } = useSchool();
  const effectiveSchoolId = schoolId || school?.id;

  const [studentCount, setStudentCount] = useState<number>(initialStudentCount);
  const [selectedBracketSlug, setSelectedBracketSlug] = useState<string>(() => {
    if (initialBracket) return initialBracket;
    return snapStudentCountToBracket(initialStudentCount).slug;
  });
  const [selectedAddons, setSelectedAddons] = useState<string[]>(initialAddons);
  const [cycle, setCycle] = useState<"termly" | "annually">(initialCycle);
  const [storageBoostGb, setStorageBoostGb] = useState<number>(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    const handleSubscriptionUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const ref = customEvent.detail?.reference;
      if (!isPublicPreview && school?.slug) {
        navigate(`/${school.slug}/app/admin/billing/thank-you`, { state: { reference: ref } });
      }
    };
    
    window.addEventListener("subscription-updated", handleSubscriptionUpdated);
    return () => window.removeEventListener("subscription-updated", handleSubscriptionUpdated);
  }, [navigate, isPublicPreview, school?.slug]);

  // Sync slider/input with bracket snapping
  const handleStudentCountChange = (val: number) => {
    const count = Math.max(0, Math.min(5000, val));
    setStudentCount(count);
    const snapped = snapStudentCountToBracket(count);
    setSelectedBracketSlug(snapped.slug);
  };

  const handleToggleAddon = (addon: MarketplaceAddon) => {
    if (addon.status === "coming_soon") return;
    setSelectedAddons((prev) =>
      prev.includes(addon.slug)
        ? prev.filter((s) => s !== addon.slug)
        : [...prev, addon.slug]
    );
  };

  const handleApplyAIRecommendation = (rec: AIPlanRecommendation) => {
    if (rec.recommended_bracket) {
      setSelectedBracketSlug(rec.recommended_bracket);
    }
    if (rec.suggested_student_count != null && rec.suggested_student_count > 0) {
      setStudentCount(rec.suggested_student_count);
    } else {
      const match = OFFICIAL_PRICING_BRACKETS.find((b) => b.slug === rec.recommended_bracket);
      if (match) setStudentCount(match.maxStudents);
    }
    if (Array.isArray(rec.recommended_addons)) {
      setSelectedAddons(rec.recommended_addons);
    }
  };

  // Compute breakdown in real-time
  const breakdown = calculateSubscriptionTotal({
    bracketSlug: selectedBracketSlug,
    addonSlugs: selectedAddons,
    cycle,
    storageBoostGb,
  });

  const handleCheckout = async () => {
    if (isPublicPreview || !schoolId) {
      // In public / landing preview mode, save intent and redirect to register
      sessionStorage.setItem(
        "subscription_cart_intent",
        JSON.stringify({
          bracket: selectedBracketSlug,
          addons: selectedAddons,
          cycle,
          storageBoostGb,
          studentCount,
        })
      );
      toast.success("Package selected! Let's get your school registered.");
      navigate("/register");
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await initializePaystackCheckout({
        school_id: effectiveSchoolId || "demo-school",
        bracket: selectedBracketSlug,
        addons: selectedAddons,
        cycle,
        storage_boost_gb: storageBoostGb,
        user_email: user?.email,
        school_name: school?.name,
      });

      if (res.authorization_url) {
        toast.success("Redirecting to Paystack secure checkout…");
        window.location.href = res.authorization_url;
      } else if (res.inline) {
        // Modal opened or completed inline
      } else {
        throw new Error("No authorization URL returned from Paystack");
      }
    } catch (err: any) {
      console.error("[SubscriptionBuilder] Checkout error", err);
      toast.error(err.message || "Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      {/* TOP SECTION: Core Inclusions Banner */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/5 via-card to-background p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-foreground">
                Core Foundation (Included in Every School Plan)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every school receives the full administrative suite, exam engine, and portal ecosystem for free. Price scales only on capacity and optional add-ons.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="gap-2 text-primary border-primary/30 hover:bg-primary/5 shrink-0 font-medium"
          >
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>✨ Help me choose</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
          {CORE_INCLUSIONS.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs font-medium text-foreground/90">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CAPACITY BRACKETS ROW */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              1. Base Capacity Tier
            </h3>
            <p className="text-xs text-muted-foreground">
              Select or slide your student count. Included cloud storage increases with tier.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Tier snaps automatically
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OFFICIAL_PRICING_BRACKETS.map((b) => {
            const isSelected = b.slug === selectedBracketSlug;
            return (
              <Card
                key={b.slug}
                onClick={() => {
                  setSelectedBracketSlug(b.slug);
                  setStudentCount(b.maxStudents);
                }}
                className={`cursor-pointer transition-all duration-200 border-2 relative ${
                  isSelected
                    ? "border-primary bg-primary/[0.03] shadow-md ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                  </div>
                )}
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">{b.name}</CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1 mt-1">
                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                    <span>{b.storageGb} GB Storage included</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="text-xl font-bold font-mono text-foreground">
                    {formatNaira(b.termPriceKobo)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">per school term</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* MIDDLE SECTION: The Add-on Marketplace Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              2. Add-On Marketplace (Termly Modules)
            </h3>
            <p className="text-xs text-muted-foreground">
              Activate specialized operational and AI modules. Pick only what your school requires.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedAddons.length} module{selectedAddons.length === 1 ? "" : "s"} selected
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OFFICIAL_ADDONS.map((addon) => {
            const isSelected = selectedAddons.includes(addon.slug);
            const isComingSoon = addon.status === "coming_soon";
            const IconComp = addon.iconName ? ICON_MAP[addon.iconName] || Bot : Bot;

            return (
              <Card
                key={addon.slug}
                onClick={() => handleToggleAddon(addon)}
                className={`transition-all duration-200 border relative ${
                  isComingSoon
                    ? "opacity-60 bg-muted/40 cursor-not-allowed border-dashed"
                    : isSelected
                    ? "border-primary bg-primary/[0.02] shadow-sm ring-1 ring-primary/30 cursor-pointer"
                    : "cursor-pointer hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold leading-tight">
                          {addon.name}
                        </CardTitle>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                          {addon.category}
                        </span>
                      </div>
                    </div>
                    {isComingSoon ? (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                        Coming Soon
                      </Badge>
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleAddon(addon)}
                        className="mt-1"
                      />
                    )}
                  </div>
                  <CardDescription className="text-xs line-clamp-2 mt-2 leading-relaxed">
                    {addon.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 flex items-center justify-between border-t border-border/50 mt-2">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {formatNaira(addon.termPriceKobo)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">/ term</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* STORAGE BOOST AND CYCLE CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Storage Boost */}
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <span>Storage Boost (Optional)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Add extra cloud document & media storage capacity beyond your tier base.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {STORAGE_BOOST_OPTIONS.map((opt) => (
                <button
                  key={opt.gb}
                  type="button"
                  onClick={() => setStorageBoostGb(opt.gb)}
                  className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                    storageBoostGb === opt.gb
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[11px] font-mono mt-0.5">
                    {opt.kobo === 0 ? "Free" : `+${formatNaira(opt.kobo)}`}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing Cycle Toggle */}
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Billing Cycle</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Annual prepay covers 3 full terms with an automatic 15% discount.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCycle("termly")}
                className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                  cycle === "termly"
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div>Termly Billing</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Pay per term</div>
              </button>
              <button
                type="button"
                onClick={() => setCycle("annually")}
                className={`p-2.5 rounded-lg border text-xs text-center transition-all relative ${
                  cycle === "annually"
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <span className="absolute -top-2 right-2 bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  Save 15%
                </span>
                <div>Annual Prepay</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">3 terms discounted</div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* THE STICKY FOOTER (Cart Calculator Bar) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-md border-t shadow-2xl p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Interactive student slider & snapping info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div className="space-y-1 w-full sm:w-64">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Students on roll:</span>
                </span>
                <span className="font-mono font-bold text-foreground">{studentCount}</span>
              </div>
              <Slider
                value={[studentCount]}
                onValueChange={(vals) => handleStudentCountChange(vals[0])}
                min={20}
                max={1200}
                step={10}
                className="w-full"
              />
            </div>

            <div className="hidden lg:block text-xs border-l pl-4 space-y-0.5 text-muted-foreground">
              <div>
                Bracket: <span className="font-semibold text-foreground">{breakdown.bracket.name}</span>
              </div>
              <div>
                Storage: <span className="font-semibold text-foreground">{breakdown.totalStorageGb} GB</span>
                {breakdown.activeAddons.length > 0 && (
                  <span> · {breakdown.activeAddons.length} add-on{breakdown.activeAddons.length === 1 ? "" : "s"}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Dynamic Total & Checkout Action */}
          <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {cycle === "annually" ? "Annual Total (-15%)" : "Termly Total"}
              </div>
              <div className="text-2xl font-black font-mono text-foreground flex items-baseline justify-end gap-1">
                <span>{formatNaira(breakdown.finalTotalKobo)}</span>
                <span className="text-xs font-normal text-muted-foreground font-sans">
                  / {cycle === "annually" ? "year" : "term"}
                </span>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="gap-2 bg-primary text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all px-6"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting Paystack…</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>{isPublicPreview ? "Get Started" : "Proceed to Secure Checkout"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Plan Recommender Modal */}
      <PlanRecommenderModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onApplyPackage={handleApplyAIRecommendation}
      />
    </div>
  );
};
