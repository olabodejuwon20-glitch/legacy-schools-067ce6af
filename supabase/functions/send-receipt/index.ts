import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference, email, amount, school_name } = await req.json();

    // NOTE: This is where you would integrate with an email provider like Resend, SendGrid, or Postmark.
    // Example:
    // await fetch("https://api.resend.com/emails", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     from: "billing@legacyskool.com",
    //     to: [email || "admin@legacyskool.com"],
    //     subject: "Your LegacySkool Payment Receipt",
    //     html: `<p>Thank you for your payment of NGN ${amount / 100} for ${school_name}. Ref: ${reference}</p>`,
    //   }),
    // });

    console.log(`[send-receipt] Receipt email intended for ${email} (Ref: ${reference})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[send-receipt] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
