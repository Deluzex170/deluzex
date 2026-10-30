const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'app/admin/faqs/page.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const isCRLF = content.includes('\r\n');
let norm = content.replace(/\r\n/g, '\n');

// Add imports
if (!norm.includes('AdminDataGrid')) {
  norm = norm.replace(
    'import React, { useEffect, useState } from "react";',
    'import React, { useEffect, useState, useMemo } from "react";\nimport type { ColDef } from "ag-grid-community";\nimport { AdminDataGrid } from "../../components/admin/AdminDataGrid";'
  );
}

// Add searchQuery state
if (!norm.includes('searchQuery')) {
  norm = norm.replace(
    'const [faqs, setFaqs] = useState<FAQItem[]>([]);',
    'const [faqs, setFaqs] = useState<FAQItem[]>([]);\n  const [searchQuery, setSearchQuery] = useState("");'
  );
}

// ColumnDefs
const columnDefsCode = `
  const columnDefs = useMemo<ColDef<FAQItem>[]>(
    () => [
      {
        field: "sequence",
        headerName: "Seq",
        width: 80,
        cellRenderer: (params: any) => {
          const faq = params.data as FAQItem;
          return <span style={{ fontWeight: 700, color: "var(--admin-text-muted)" }}>#{faq?.sequence || 1}</span>;
        },
      },
      {
        field: "question",
        headerName: "Question & Answer",
        flex: 2,
        minWidth: 280,
        cellRenderer: (params: any) => {
          const faq = params.data as FAQItem;
          if (!faq) return null;
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: 600, color: "var(--admin-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {faq.question}
              </div>
              <div style={{ color: "var(--admin-text-muted)", fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {faq.answer}
              </div>
            </div>
          );
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 140,
        cellRenderer: (params: any) => {
          const faq = params.data as FAQItem;
          if (!faq) return null;
          return (
            <span
              style={{
                fontSize: "0.74rem",
                fontWeight: 600,
                padding: "0.25rem 0.6rem",
                borderRadius: "5px",
                textTransform: "capitalize",
                background: faq.category === "collaborate" ? "rgba(196, 154, 69, 0.12)" : "#f1f5f9",
                color: faq.category === "collaborate" ? "#9a762e" : "#475569",
              }}
            >
              {faq.category || "collaborate"}
            </span>
          );
        },
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 120,
        cellRenderer: (params: any) => {
          const faq = params.data as FAQItem;
          if (!faq) return null;
          return (
            <button
              onClick={() => handleToggleActive(faq)}
              style={{
                background: faq.is_active ? "rgba(16, 185, 129, 0.1)" : "rgba(100, 116, 139, 0.1)",
                color: faq.is_active ? "#10b981" : "#64748b",
                border: "none",
                borderRadius: "6px",
                padding: "0.25rem 0.6rem",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              {faq.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
              {faq.is_active ? "Active" : "Hidden"}
            </button>
          );
        },
      },
      {
        headerName: "Actions",
        width: 110,
        pinned: "right",
        cellRenderer: (params: any) => {
          const faq = params.data as FAQItem;
          if (!faq) return null;
          return (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", height: "100%" }}>
              <button
                title="Edit FAQ"
                onClick={() => openEditModal(faq)}
                style={{
                  background: "var(--admin-surface-muted)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "6px",
                  padding: "0.35rem",
                  color: "var(--admin-text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                title="Delete FAQ"
                onClick={() => setItemToDelete(faq)}
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "0.35rem",
                  color: "#ef4444",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );
`;

// Insert columnDefs before return
const returnTarget = "return (";
const returnIndex = norm.indexOf(returnTarget);
if (returnIndex === -1) {
  console.error("Could not find 'return ('");
  process.exit(1);
}
norm = norm.slice(0, returnIndex) + columnDefsCode + "\n  " + norm.slice(returnIndex);

// Replace table section
const tableTargetStart = `      {/* FAQs Table */}`;
const tableTargetEnd = `      {/* FAQ EDIT/CREATE MODAL */}`;

const startIndex = norm.indexOf(tableTargetStart);
const endIndex = norm.indexOf(tableTargetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find table section delimiters in faqs:", { startIndex, endIndex });
  process.exit(1);
}

const gridReplacement = `      {/* AG-Grid FAQs */}
      <AdminDataGrid<FAQItem>
        ariaLabel="Frequently Asked Questions"
        rowData={faqs}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(s) => String(s._id || s.id || s.question)}
        quickFilterText={searchQuery}
        emptyTitle="No FAQs found"
        emptyDescription="Click 'Seed Default FAQs' or 'Add New Question' to add entries for your visitors."
        toolbar={
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <input
              type="search"
              placeholder="Search questions or answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: "36px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--admin-border)",
                background: "var(--admin-surface)",
                color: "var(--admin-text-main)",
                fontSize: "13px",
                outline: "none",
                minWidth: "240px",
              }}
            />
          </div>
        }
      />
\n`;

norm = norm.slice(0, startIndex) + gridReplacement + norm.slice(endIndex);

if (isCRLF) {
  norm = norm.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, norm, 'utf8');
console.log("Successfully patched app/admin/faqs/page.tsx with AdminDataGrid!");
