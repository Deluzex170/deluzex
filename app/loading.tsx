import React from "react";

export default function Loading() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "3px solid rgba(212, 163, 115, 0.25)",
          borderTopColor: "#D4A373",
          borderRightColor: "#E0531C",
          animation: "spinPage 0.8s linear infinite",
        }}
      />
      <div
        style={{
          fontSize: "0.825rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(100, 100, 100, 0.85)",
          fontWeight: 600,
        }}
      >
        Deluzex
      </div>
      <style>{`
        @keyframes spinPage {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
