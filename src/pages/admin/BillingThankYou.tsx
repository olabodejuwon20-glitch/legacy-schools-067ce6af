import React from "react";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Download, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import jsPDF from "jspdf";

export default function BillingThankYou() {
  const { school } = useSchool();
  const location = useLocation();

  // Reference could be passed via state if we route after successful payment
  const reference = location.state?.reference || "REF-UNKNOWN";

  const handleDownloadReceipt = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text("Receipt", 20, 20);
      
      doc.setFontSize(16);
      doc.text(`School: ${school?.name || "LegacySkool"}`, 20, 30);
      
      doc.setFontSize(12);
      doc.text(`Transaction Reference: ${reference}`, 20, 40);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);
      doc.text("Status: Paid", 20, 60);

      doc.text("Thank you for your business!", 20, 80);

      doc.save(`receipt-${reference}.pdf`);
    } catch (e) {
      console.error("Failed to generate PDF", e);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-4xl mx-auto w-full">
      <Card className="border-green-200">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-3xl text-green-700">Payment Successful!</CardTitle>
          <CardDescription className="text-lg mt-2">
            Your plan and modules have been unlocked successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="bg-muted p-4 rounded-lg flex flex-col items-center justify-center space-y-2">
            <p className="text-sm text-muted-foreground">Transaction Reference</p>
            <p className="font-mono font-medium">{reference}</p>
          </div>

          <p className="text-center text-muted-foreground max-w-md mx-auto">
            A confirmation email and receipt have been sent to your registered email address. You can also download a copy below.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Button onClick={handleDownloadReceipt} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download Receipt
            </Button>
            <Button asChild className="gap-2">
              <Link to={`/${school?.slug}/app/admin/billing`}>
                <ArrowLeft className="h-4 w-4" />
                Return to Billing
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
