import * as React from "react";

type ResetPasswordEmailProps = {
  resetLink: string;
};

export default function ResetPasswordEmail({ resetLink }: ResetPasswordEmailProps) {
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
      {/* ... rest of the markup, unchanged ... */}
    </div>
  );
}
