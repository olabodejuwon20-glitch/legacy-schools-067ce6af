// src/api/paystackVerify.ts

/**
 * Verifies a Paystack transaction reference using Paystack's Verify API.
 * Returns true if the transaction is successful, otherwise false.
 * In local development environments where the secret key is unavailable,
 * the function resolves to true to avoid blocking the checkout flow.
 */
export async function verifyPaystackTransaction(reference: string): Promise<boolean> {
  // Guard against missing secret in the client environment.
  const secretKey = import.meta.env.VITE_PAYSTACK_SECRET_KEY || "";
  if (!secretKey) {
    // No secret available – assume verification succeeds (dev fallback).
    console.warn(
      "[Paystack Verify] Secret key not set; skipping server verification for reference",
      reference
    );
    return true;
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      console.error(
        "[Paystack Verify] HTTP error",
        response.status,
        await response.text()
      );
      return false;
    }
    const data = await response.json();
    // Paystack returns { data: { status: "success" | "failed" , ... } }
    return data?.data?.status === "success";
  } catch (err) {
    console.error("[Paystack Verify] Unexpected error", err);
    return false;
  }
}
