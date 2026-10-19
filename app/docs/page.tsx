"use client";

import React, { useEffect, useRef } from "react";

export default function SwaggerDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add Swagger UI CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";
    link.id = "swagger-ui-css";
    document.head.appendChild(link);

    // Add Swagger UI JS
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.id = "swagger-ui-bundle";
    script.async = true;

    script.onload = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const specUrl = apiUrl.startsWith("http")
        ? `${apiUrl}/openapi.json`
        : "/api/v1/openapi.json";

      if ((window as any).SwaggerUIBundle && containerRef.current) {
        (window as any).SwaggerUIBundle({
          url: specUrl,
          domNode: containerRef.current,
          deepLinking: true,
          displayRequestDuration: true,
          persistAuthorization: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      const existingLink = document.getElementById("swagger-ui-css");
      const existingScript = document.getElementById("swagger-ui-bundle");
      if (existingLink) existingLink.remove();
      if (existingScript) existingScript.remove();
    };
  }, []);

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", padding: "30px 20px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #e5e7eb" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: "0 0 6px 0" }}>
            Deluzex Architecture — API Documentation
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
            Interactive Swagger UI Explorer for all Deluzex backend endpoints (FastAPI & Next.js proxy).
          </p>
        </div>
        <div ref={containerRef} id="swagger-ui" />
      </div>
    </div>
  );
}
