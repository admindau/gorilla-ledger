import React from "react";

export default function ResetPasswordEmail({ resetLink }: { resetLink: string }) {
  return (
    <html>
      <body
        style={{
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#ffffff",
          color: "#000000",
          padding: "24px",
        }}
      >
        <table
          width="100%"
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <tr>
            <td>
              <h2 style={{ marginBottom: "12px", fontSize: "20px" }}>
                Reset your Gorilla Ledger™ password
              </h2>

              <p style={{ fontSize: "14px", marginBottom: "16px" }}>
                Click the button below to reset your password.
              </p>

              <p style={{ textAlign: "center", marginBottom: "24px" }}>
                <a
                  href={resetLink}
                  style={{
                    display: "inline-block",
                    backgroundColor: "#000000",
                    color: "#ffffff",
                    textDecoration: "none",
                    padding: "10px 20px",
                    borderRadius: "6px",
                    fontWeight: "bold",
                  }}
                >
                  Reset Password
                </a>
              </p>

              <p style={{ fontSize: "12px", color: "#555", wordBreak: "break-all" }}>
                If the button doesn’t work, copy and paste this link:
                <br />
                {resetLink}
              </p>

              <p style={{ fontSize: "11px", color: "#999", marginTop: "24px" }}>
                Gorilla Ledger™ • savvyrilla.tech
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}
