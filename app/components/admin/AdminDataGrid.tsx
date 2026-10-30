"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type FilterChangedEvent,
  type GetRowIdParams,
  type GridReadyEvent,
  type RowClickedEvent,
  type RowDataUpdatedEvent,
  type RowSelectionOptions,
  type SelectionChangedEvent,
} from "ag-grid-community";
import { Search } from "lucide-react";
import styles from "./AdminDataGrid.module.css";

// Community edition only: every feature used here ships in AllCommunityModule,
// so no enterprise module (and no licence watermark) is ever loaded.
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Deluzex grid theme. Every colour points at the admin design tokens, so the
 * same theme follows the admin's dark and light modes automatically.
 */
export const deluzexGridTheme = themeQuartz.withParams({
  backgroundColor: "var(--admin-surface)",
  foregroundColor: "var(--admin-text-main)",
  chromeBackgroundColor: "var(--admin-surface)",
  headerBackgroundColor: "var(--admin-surface-muted)",
  headerTextColor: "var(--admin-text-muted)",
  borderColor: "var(--admin-border)",
  accentColor: "#C49A45",
  rowHoverColor: "var(--admin-surface-muted)",
  selectedRowBackgroundColor: "rgba(196, 154, 69, 0.12)",
  checkboxCheckedBackgroundColor: "#C49A45",
  checkboxCheckedBorderColor: "#C49A45",
  inputFocusBorder: { color: "#C49A45" },
  focusShadow: { radius: 3, spread: 0, color: "rgba(196, 154, 69, 0.35)" },
  fontFamily: "var(--font-admin-sans), 'Plus Jakarta Sans', system-ui, sans-serif",
  fontSize: 13,
  dataFontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 600,
  headerHeight: 40,
  rowHeight: 52,
  spacing: 6,
  cellHorizontalPadding: 14,
  iconSize: 14,
  wrapperBorder: false,
  wrapperBorderRadius: 12,
  borderRadius: 6,
  columnBorder: false,
  headerColumnBorder: false,
  paginationPanelHeight: 48,
  browserColorScheme: "inherit",
});

export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

type OverlayParams = {
  overlayType?: "loading" | "noRows" | "noMatchingRows" | "exporting" | "fileInput";
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
};

/** Luxury loading + empty-state overlay used for every grid overlay type. */
function GridOverlay({ overlayType, emptyTitle, emptyDescription, emptyAction }: OverlayParams) {
  if (overlayType === "loading") {
    return (
      <div className={styles.overlay} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <span className={styles.overlayTitle}>Loading records…</span>
      </div>
    );
  }
  const isFiltered = overlayType === "noMatchingRows";
  return (
    <div className={styles.overlay} role="status">
      <span className={styles.overlayIcon} aria-hidden="true">
        <Search size={18} />
      </span>
      <span className={styles.overlayTitle}>{isFiltered ? "No matching records" : emptyTitle || "No records found"}</span>
      <span className={styles.overlayText}>
        {isFiltered ? "Try a different search term or clear the filters." : emptyDescription}
      </span>
      {!isFiltered && emptyAction ? <div className={styles.overlayAction}>{emptyAction}</div> : null}
    </div>
  );
}

export interface AdminDataGridProps<T> {
  rowData: T[] | null | undefined;
  columnDefs: ColDef<T>[];
  /** Shows the loading overlay while true. */
  loading?: boolean;
  /** Stable id for each row (keeps selection and scroll position across refreshes). */
  getRowId?: (data: T) => string;
  /** Built-in quick filter across every column. */
  showSearch?: boolean;
  /** External controlled quick filter text. */
  quickFilterText?: string;
  onQuickFilterChange?: (text: string) => void;
  searchPlaceholder?: string;
  /** Extra controls (filter tabs, selects) shown in the toolbar beside the search. */
  toolbar?: React.ReactNode;
  /** Controls shown at the right end of the toolbar (e.g. bulk actions). */
  toolbarEnd?: React.ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Adds row-selection checkboxes. */
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  onRowClicked?: (row: T) => void;
  rowHeight?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  ariaLabel?: string;
}

export function AdminDataGrid<T>({
  rowData,
  columnDefs,
  loading = false,
  getRowId,
  showSearch = true,
  quickFilterText: externalQuickFilter,
  onQuickFilterChange,
  searchPlaceholder = "Search all columns…",
  toolbar,
  toolbarEnd,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  enableRowSelection = false,
  onSelectionChange,
  onRowClicked,
  rowHeight,
  emptyTitle,
  emptyDescription,
  emptyAction,
  ariaLabel = "Data table",
}: AdminDataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const [internalQuickFilter, setInternalQuickFilter] = useState("");
  const effectiveQuickFilter = externalQuickFilter !== undefined ? externalQuickFilter : internalQuickFilter;
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 110,
      suppressHeaderMenuButton: false,
    }),
    []
  );

  const rowSelection = useMemo<RowSelectionOptions<T> | undefined>(
    () => (enableRowSelection ? { mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false } : undefined),
    [enableRowSelection]
  );

  const overlayParams = useMemo(
    () => ({ emptyTitle, emptyDescription, emptyAction }),
    [emptyTitle, emptyDescription, emptyAction]
  );

  const rowIdGetter = useMemo(
    () => (getRowId ? (params: GetRowIdParams<T>) => getRowId(params.data) : undefined),
    [getRowId]
  );

  const refreshCount = useCallback((api: GridReadyEvent<T>["api"]) => {
    setVisibleCount(api.getDisplayedRowCount());
  }, []);

  const handleSelection = useCallback(
    (event: SelectionChangedEvent<T>) => {
      onSelectionChange?.(event.api.getSelectedRows());
    },
    [onSelectionChange]
  );

  const handleRowClicked = useCallback(
    (event: RowClickedEvent<T>) => {
      // Clicks on buttons/links inside a cell are actions, not row clicks
      const target = event.event?.target as HTMLElement | null;
      if (target?.closest("button, a, input, select")) return;
      if (event.data) onRowClicked?.(event.data);
    },
    [onRowClicked]
  );

  const total = rowData?.length ?? 0;
  const shown = visibleCount ?? total;

  return (
    <div className={styles.gridShell}>
      {(showSearch || toolbar || toolbarEnd) && (
        <div className={styles.toolbar}>
          {showSearch && (
            <label className={styles.search}>
              <Search size={15} aria-hidden="true" className={styles.searchIcon} />
              <input
                type="search"
                value={effectiveQuickFilter}
                onChange={(e) => {
                  setInternalQuickFilter(e.target.value);
                  onQuickFilterChange?.(e.target.value);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </label>
          )}
          {toolbar ? <div className={styles.toolbarFilters}>{toolbar}</div> : null}
          <div className={styles.toolbarEnd}>
            {!loading && (
              <span className={styles.count} aria-live="polite">
                {shown === total ? `${total} records` : `${shown} of ${total}`}
              </span>
            )}
            {toolbarEnd}
          </div>
        </div>
      )}

      <div className={styles.gridFrame}>
        <AgGridReact<T>
          ref={gridRef}
          theme={deluzexGridTheme}
          rowData={rowData ?? []}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          loading={loading}
          getRowId={rowIdGetter}
          quickFilterText={effectiveQuickFilter}
          pagination
          paginationPageSize={pageSize}
          paginationPageSizeSelector={pageSizeOptions}
          domLayout="autoHeight"
          rowHeight={rowHeight}
          rowSelection={rowSelection}
          overlayComponent={GridOverlay}
          overlayComponentParams={overlayParams}
          animateRows
          enableCellTextSelection
          ensureDomOrder
          suppressDragLeaveHidesColumns
          onSelectionChanged={handleSelection}
          onRowClicked={onRowClicked ? handleRowClicked : undefined}
          onGridReady={(e: GridReadyEvent<T>) => refreshCount(e.api)}
          onFilterChanged={(e: FilterChangedEvent<T>) => refreshCount(e.api)}
          onRowDataUpdated={(e: RowDataUpdatedEvent<T>) => refreshCount(e.api)}
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}

export default AdminDataGrid;
