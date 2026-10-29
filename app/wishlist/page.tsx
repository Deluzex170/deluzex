"use client";

import React from "react";
import WishlistContent from "../components/WishlistContent";

export default function WishlistStorefrontPage() {
  return (
    <main
      style={{
        minHeight: "70vh",
        backgroundColor: "var(--color-bg, #F8F1EA)",
        padding: "2.5rem 1.5rem 4rem",
      }}
    >
      <div
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
        }}
      >
        <WishlistContent />
      </div>
    </main>
  );
}
