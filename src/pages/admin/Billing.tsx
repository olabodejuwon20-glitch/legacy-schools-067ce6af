import React, { useEffect, useState } from "react";
import { useSchool } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubscriptionBuilder } from "@/components/billing/SubscriptionBuilder";
import { formatNaira } from "@/lib/pricing";
import { CreditCard, Receipt, Layers, ShieldCheck, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function AdminBilling() {
  const { school } = useSchool();
  const [activeTab, setActiveTab] = useState("builder");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (!school?.id) return;
    setLoadingTx(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("billing_transactions")
          .select("*")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setTransactions(data);
        }
      } catch (err) {
        console.warn("[AdminBilling] error loading transactions", err);
      } finally {
        setLoadingTx(false);
      }
    })();
  }, [school?.id]);

  const studentCount = school?.student_count || 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Choose your student capacity bracket, configure active modules, and manage payment records."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            Paystack Integrated
          </Badge>
          <Badge variant="secondary" className="text-xs">
            School: {school?.name || "Active School"}
          </Badge>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="builder" className="gap-2">
            <Layers className="h-4 w-4" />
            <span>Modular Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span>Transaction History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <SubscriptionBuilder
            schoolId={school?.id}
            initialStudentCount={studentCount}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base font-bold">Billing Transactions & Checkout Invoices</CardTitle>
              <CardDescription className="text-xs">
                History of subscription checkout requests and verified Paystack settlements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {loadingTx ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading transactions…</div>
              ) : transactions.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg bg-muted/20">
                  No billing transactions recorded yet for this school.
                </div>
              ) : (
                <div className="divide-y border rounded-lg overflow-hidden">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground">{tx.reference}</span>
                          <Badge
                            className={
                              tx.status === "paid"
                                ? "bg-emerald-600 text-white"
                                : tx.status === "pending"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                : "bg-destructive/10 text-destructive"
                            }
                          >
                            {tx.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {tx.metadata?.bracket && ` · Bracket: ${tx.metadata.bracket}`}
                          {tx.metadata?.cycle && ` · Cycle: ${tx.metadata.cycle}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-foreground">
                          {formatNaira(tx.amount_kobo)}
                        </div>
                        <span className="text-[11px] text-muted-foreground uppercase">{tx.currency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
