"use client";

import React, { useEffect, useRef } from "react";

export default function AdminSwaggerDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";
    link.id = "admin-swagger-ui-css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.id = "admin-swagger-ui-bundle";
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
      const existingLink = document.getElementById("admin-swagger-ui-css");
      const existingScript = document.getElementById("admin-swagger-ui-bundle");
      if (existingLink) existingLink.remove();
      if (existingScript) existingScript.remove();
    };
  }, []);

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minHeight: "80vh" }}>
      <div style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#111827", margin: "0 0 6px 0" }}>
          Backend REST APIs Explorer (Swagger UI)
        </h2>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
          Direct live OpenAPI interaction with Deluzex FastAPI server endpoints.
        </p>
      </div>
      <div ref={containerRef} id="swagger-ui" />
    </div>
  );
}
