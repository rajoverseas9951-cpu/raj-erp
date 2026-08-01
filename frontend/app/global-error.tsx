"use client";

import { useEffect } from "react";
import { BRAND } from "@/config/brand";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            fontFamily: "Arial, sans-serif",
            background: "#f8fafc",
            color: "#0f172a",
          }}
        >
          <section style={{ maxWidth: 520, textAlign: "center" }}>
            <h1>{BRAND.productName} could not start this page.</h1>
            <p>Please retry. Your saved data has not been changed.</p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                border: 0,
                borderRadius: 10,
                padding: "12px 20px",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
