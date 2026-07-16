import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/brand";

export default function WelcomeEmail() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px" }}>
      <h2>Welcome to {PRODUCT_NAME}</h2>
      <p>Your account is ready.</p>
      <p>Start with a wallet, then add transactions, budgets, and recurring activity.</p>

      <p style={{ marginTop: "20px" }}>
        Regards,<br />
        <strong>{COMPANY_NAME}</strong>
      </p>
    </div>
  );
}
