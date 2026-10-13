import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, Check, ArrowRight, Lightbulb } from "lucide-react";
import { recommendPlan, AIPlanRecommendation } from "@/api/aiRecommender";
import { formatNaira, getBracketBySlug, OFFICIAL_ADDONS } from "@/lib/pricing";
import { toast } from "sonner";

interface PlanRecommenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyPackage: (recommendation: AIPlanRecommendation) => void;
}

const SAMPLE_PROMPTS = [
  "350 students with a boarding house, 4 school buses, and WAEC CBT exams.",
  "120 students, day school only, need virtual science labs and report cards.",
  "850 students, full operations with bus routes, SMS broadcasts, and AI assistance.",
];

export const PlanRecommenderModal: React.FC<PlanRecommenderModalProps> = ({
  open,
  onOpenChange,
  onApplyPackage,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIPlanRecommendation | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe your school setup first.");
      return;
    }
    setLoading(true);
    try {
      const rec = await recommendPlan(prompt);
      setResult(rec);
      toast.success("AI Recommendation generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate recommendation");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyPackage(result);
    toast.success("Package applied to your subscription builder!");
    onOpenChange(false);
  };

  const recBracket = result ? getBracketBySlug(result.recommended_bracket) : null;
  const recAddonItems = result
    ? OFFICIAL_ADDONS.filter((a) => result.recommended_addons.includes(a.slug))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">AI Plan Recommender</DialogTitle>
              <DialogDescription className="text-sm">
                Describe your school's capacity and operational needs. Our AI will assemble your optimal base tier and module stack.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center justify-between">
              <span>Your School Setup</span>
              <span className="text-xs text-muted-foreground">Free-text description</span>
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. We have 350 students, run a boarding house with 4 buses, and want virtual science labs for senior secondary classes..."
              rows={3}
              className="resize-none focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span>Or try an example:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className="text-xs text-left px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border"
                >
                  "{sample.slice(0, 48)}…"
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full gap-2 shadow-sm font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing requirements with Gemini…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze & Recommend Best Plan
              </>
            )}
          </Button>

          {result && recBracket && (
            <Card className="border-primary/30 bg-primary/[0.02] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                      Recommended Base Bracket
                    </span>
                    <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                      {recBracket.name}
                      <Badge variant="secondary" className="font-mono text-xs">
                        {formatNaira(recBracket.termPriceKobo)} / term
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Included storage: {recBracket.storageGb} GB · Max {recBracket.maxStudents} students
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">
                    AI Match
                  </Badge>
                </div>

                {recAddonItems.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Recommended Add-ons ({recAddonItems.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {recAddonItems.map((addon) => (
                        <div
                          key={addon.slug}
                          className="flex items-center justify-between p-2 rounded-lg bg-background border text-xs"
                        >
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="font-medium text-foreground">{addon.name}</span>
                          </div>
                          <span className="text-muted-foreground font-mono">
                            {formatNaira(addon.termPriceKobo)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground border leading-relaxed">
                  <span className="font-semibold text-foreground">Why this package: </span>
                  {result.reasoning}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {result && (
            <Button
              type="button"
              onClick={handleApply}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <span>Apply Package</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
