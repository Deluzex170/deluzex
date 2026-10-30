"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AdminDataGrid } from "../../components/admin/AdminDataGrid";
import styles from "./audit.module.css";
import {
  fetchAuditLogs,
  fetchAuditStats,
  AuditLogItem,
  AuditStats,
} from "../../services/api";

export default function AuditLogsPage() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadData = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    try {
      const [statsData, logsData] = await Promise.all([
        fetchAuditStats(),
        fetchAuditLogs({
          category,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        }),
      ]);
      setStats(statsData);
      setLogs(logsData);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      if (showLoadingState) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  // Filter or search update
  useEffect(() => {
    const handler = setTimeout(async () => {
      try {
        const logsData = await fetchAuditLogs({
          category,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        });
        setLogs(logsData);
      } catch (err) {
        console.error("Error filtering audit logs:", err);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [category, search, statusFilter]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadData(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (isNaN(diffSeconds)) return dateStr;
    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadgeClass = (action: string, status: string) => {
    if (status === "FAILED" || action.includes("DELETE") || action.includes("FAIL")) {
      return styles.actionDanger;
    }
    if (action.includes("UPDATE") || action.includes("PATCH") || action.includes("EDIT")) {
      return styles.actionUpdate;
    }
    if (action.includes("LOGIN") || action.includes("CREATE") || action.includes("REGISTER")) {
      return styles.actionSuccess;
    }
    return styles.actionNeutral;
  };

  const columnDefs = useMemo<ColDef<AuditLogItem>[]>(
    () => [
      {
        field: "actor_name",
        headerName: "Operator / Who",
        width: 220,
        cellRenderer: (params: any) => {
          const log = params.data as AuditLogItem;
          if (!log) return null;
          const initials = (log.actor_name || log.actor_email || "U")
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
          const roleClass =
            log.actor_role === "Admin"
              ? styles.roleAdmin
              : log.actor_role === "Customer"
              ? styles.roleCustomer
              : styles.roleGuest;
          return (
            <div className={styles.actorCell}>
              <div
                className={`${styles.actorAvatar} ${
                  log.actor_role === "Admin"
                    ? styles.avatarAdmin
                    : styles.avatarCustomer
                }`}
              >
                {initials}
              </div>
              <div className={styles.actorMeta}>
                <div className={styles.actorName}>
                  <span>{log.actor_name || "Unknown Operator"}</span>
                  <span className={roleClass}>{log.actor_role}</span>
                </div>
                <div className={styles.actorEmail}>
                  {log.actor_email || (log.user_id ? `ID: ${log.user_id.substring(0, 8)}` : "Guest / Public")}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        field: "action",
        headerName: "Action",
        width: 150,
        cellRenderer: (params: any) => {
          const log = params.data as AuditLogItem;
          if (!log) return null;
          return (
            <span className={`${styles.actionBadge} ${getActionBadgeClass(log.action, log.status)}`}>
              {log.action}
            </span>
          );
        },
      },
      {
        field: "target_name",
        headerName: "Target Resource",
        width: 170,
        cellRenderer: (params: any) => {
          const log = params.data as AuditLogItem;
          if (!log) return null;
          return (
            <div>
              {log.target_type && <div className={styles.targetType}>{log.target_type}</div>}
              <div className={styles.targetPill}>{log.target_name || log.target_id || "System"}</div>
            </div>
          );
        },
      },
      {
        field: "description",
        headerName: "What Was Done",
        flex: 1.5,
        minWidth: 200,
        cellRenderer: (params: any) => {
          const log = params.data as AuditLogItem;
          if (!log) return null;
          return (
            <div className={styles.descText} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {log.description || log.details || "No description provided."}
            </div>
          );
        },
      },
      {
        field: "ip_address",
        headerName: "IP & Client",
        width: 130,
        cellRenderer: (params: any) => {
          const log = params.data as AuditLogItem;
          if (!log) return null;
          return (
            <div>
              <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                {log.ip_address || "127.0.0.1"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--admin-text-subtle)" }}>
                {log.user_agent ? log.user_agent.split(" ")[0] : "Direct API"}
              </div>
            </div>
          );
        },
      },
      {
        field: "created_at",
        headerName: "Time",
        width: 130,
        valueFormatter: (params) => {
          if (!params.value) return "N/A";
          return formatTimeAgo(params.value);
        },
      },
      {
        headerName: "Details",
        width: 100,
        pinned: "right",
        cellRenderer: (params: any) => {
          const log = params.data as AuditLogItem;
          if (!log) return null;
          return (
            <button className={styles.btnViewDetails} onClick={() => setSelectedLog(log)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Inspect
            </button>
          );
        },
      },
    ],
    []
  );


    return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>System Audit Logs & Activity Trail</h1>
          <p className={styles.headerSubtitle}>
            Trace who entered the system, who changed store records, and exact actions performed.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.refreshBtn} ${isRefreshing ? styles.spinning : ""}`}
            onClick={handleManualRefresh}
            title="Refresh audit activity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>


        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className={styles.kpiGrid}>
        {/* 1. Total Audit Events */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Total Activities</span>
            <div className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats ? stats.total_events.toLocaleString() : "..."}</div>
          <div className={styles.kpiMeta}>
            <span>{stats?.recent_24h_events || 0} events in last 24h</span>
          </div>
        </div>

        {/* 2. Who is Entering (Logins) */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Access & Logins</span>
            <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats ? stats.total_logins.toLocaleString() : "..."}</div>
          <div className={styles.kpiMeta}>Who entered storefront or portal</div>
        </div>

        {/* 3. Who Changed What (Modifications) */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>System Changes</span>
            <div className={`${styles.kpiIcon} ${styles.kpiIconAmber}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>
            {stats ? stats.total_modifications.toLocaleString() : "..."}
          </div>
          <div className={styles.kpiMeta}>Products, orders & content changes</div>
        </div>

        {/* 4. Active Operators */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Unique Actors</span>
            <div className={`${styles.kpiIcon} ${styles.kpiIconGold}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>
            {stats ? stats.total_unique_actors.toLocaleString() : "..."}
          </div>
          <div className={styles.kpiMeta}>Administrators & customer accounts</div>
        </div>
      </div>

      {/* AUDIT LOG TABLE & FILTERS */}
      <div className={styles.logsSection}>
        <div className={styles.logsToolbar}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${category === "all" ? styles.filterTabActive : ""}`}
              onClick={() => setCategory("all")}
            >
              All Activities ({stats?.total_events || logs.length})
            </button>
            <button
              className={`${styles.filterTab} ${category === "auth" ? styles.filterTabActive : ""}`}
              onClick={() => setCategory("auth")}
            >
              Logins & Access ({stats?.category_counts?.auth || 0})
            </button>
            <button
              className={`${styles.filterTab} ${category === "catalog" ? styles.filterTabActive : ""}`}
              onClick={() => setCategory("catalog")}
            >
              Catalog & Products ({stats?.category_counts?.catalog || 0})
            </button>
            <button
              className={`${styles.filterTab} ${category === "orders" ? styles.filterTabActive : ""}`}
              onClick={() => setCategory("orders")}
            >
              Orders ({stats?.category_counts?.orders || 0})
            </button>
            <button
              className={`${styles.filterTab} ${category === "cms" ? styles.filterTabActive : ""}`}
              onClick={() => setCategory("cms")}
            >
              Website Content ({stats?.category_counts?.cms || 0})
            </button>
          </div>

          <div className={styles.toolbarRight}>
            <div className={styles.searchInputWrapper}>
              <svg
                className={styles.searchIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search actor, email, action, target..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className={styles.statusSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed / Security</option>
            </select>
          </div>
        </div>

        <AdminDataGrid<AuditLogItem>
          ariaLabel="Security & Audit Trail"
          rowData={logs}
          columnDefs={columnDefs}
          loading={isLoading}
          getRowId={(s: AuditLogItem) => String(s.id || s.created_at)}
          quickFilterText={search}
          emptyTitle="No audit records found"
          emptyDescription="No events match your current filter criteria."
        />
      </div>

      {/* INSPECTION MODAL */}
      {selectedLog && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedLog(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Audit Event: <span style={{ color: "#C49A45" }}>{selectedLog.action}</span>
              </h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setSelectedLog(null)}
              >
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              <div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Timestamp:</span>
                  <span className={styles.detailVal}>
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Operator:</span>
                  <span className={styles.detailVal}>
                    {selectedLog.actor_name} ({selectedLog.actor_email || "N/A"}) [{selectedLog.actor_role}]
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Target:</span>
                  <span className={styles.detailVal}>
                    {selectedLog.target_type ? `[${selectedLog.target_type}] ` : ""}
                    {selectedLog.target_name || selectedLog.target_id || "N/A"}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>IP & Client:</span>
                  <span className={styles.detailVal}>{selectedLog.ip_address || "127.0.0.1"}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Description:</span>
                  <span className={styles.detailVal}>{selectedLog.description}</span>
                </div>
              </div>

              {/* State Diff if changes exist */}
              {selectedLog.changes && (
                <div>
                  <h4 style={{ margin: "0.5rem 0", fontSize: "0.9rem", color: "var(--admin-text-main)" }}>
                    State Modification Diff
                  </h4>
                  <div className={styles.diffContainer}>
                    <div className={styles.diffBox}>
                      <div className={styles.diffBoxTitle}>Before Change</div>
                      <pre style={{ margin: 0, fontSize: "0.75rem", overflowX: "auto" }}>
                        {selectedLog.changes.before
                          ? JSON.stringify(selectedLog.changes.before, null, 2)
                          : "None"}
                      </pre>
                    </div>

                    <div className={styles.diffBox} style={{ borderColor: "#C49A45" }}>
                      <div className={styles.diffBoxTitle} style={{ color: "#926f23" }}>
                        After Change
                      </div>
                      <pre style={{ margin: 0, fontSize: "0.75rem", overflowX: "auto" }}>
                        {selectedLog.changes.after
                          ? JSON.stringify(selectedLog.changes.after, null, 2)
                          : "None"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON viewer */}
              <div>
                <h4 style={{ margin: "0.5rem 0", fontSize: "0.9rem", color: "var(--admin-text-main)" }}>
                  Full Telemetry Record
                </h4>
                <div className={styles.jsonViewer}>
                  {JSON.stringify(selectedLog, null, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
