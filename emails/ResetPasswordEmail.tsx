import * as React from "react";

type ResetPasswordEmailProps = {
  resetLink: string;
};

export default function ResetPasswordEmail({
  resetLink,
}: ResetPasswordEmailProps) {
  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#ffffff",
        color: "#000000",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            marginBottom: "12px",
          }}
        >
          Reset your Gorilla Ledger™ password
        </h2>

        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.5,
            marginBottom: "16px",
          }}
        >
          You requested to reset the password for your Gorilla Ledger™ account.
          Click the button below to choose a new password.
        </p>

        <p style={{ textAlign: "center", marginBottom: "24px" }}>
          <a
            href={resetLink}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: "999px",
              backgroundColor: "#000000",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Reset Password
          </a>
        </p>

        <p
          style={{
            fontSize: "12px",
            lineHeight: 1.5,
            color: "#555555",
            marginBottom: "16px",
          }}
        >
          If the button doesn&apos;t work, copy and paste this link into your
          browser:
          <br />
          <span style={{ wordBreak: "break-all" }}>{resetLink}</span>
        </p>

        <p
          style={{
            fontSize: "12px",
            lineHeight: 1.5,
            color: "#888888",
          }}
        >
          If you did not request this, you can safely ignore this email. Your
          password will stay the same.
        </p>

        <hr
          style={{
            margin: "24px 0 12px",
            border: "none",
            borderTop: "1px solid #eeeeee",
          }}
        />

        <p
          style={{
            fontSize: "11px",
            color: "#aaaaaa",
          }}
        >
          Gorilla Ledger™ • savvyrilla.tech
        </p>
      </div>
    </div>
  );
}
