"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AdminDataGrid } from "../../components/admin/AdminDataGrid";
import styles from "./analytics.module.css";
import {
  fetchAnalyticsStats,
  fetchVisitorLogs,
  fetchMemberVisitors,
  AnalyticsStats,
  VisitorLogItem,
  MemberActivity,
} from "../../services/api";

export default function VisitorAnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [logs, setLogs] = useState<VisitorLogItem[]>([]);
  const [members, setMembers] = useState<MemberActivity[]>([]);
  const [filterType, setFilterType] = useState<"all" | "members" | "guests">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    try {
      const [statsData, logsData, membersData] = await Promise.all([
        fetchAnalyticsStats(),
        fetchVisitorLogs({ filter_type: filterType, search: searchQuery }),
        fetchMemberVisitors(),
      ]);
      setStats(statsData);
      setLogs(logsData);
      setMembers(membersData);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
    } finally {
      if (showLoadingState) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  // Re-fetch logs when filter or search changes
  useEffect(() => {
    const handler = setTimeout(async () => {
      try {
        const logsData = await fetchVisitorLogs({
          filter_type: filterType,
          search: searchQuery.trim() || undefined,
        });
        setLogs(logsData);
      } catch (err) {
        console.error("Error filtering logs:", err);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [filterType, searchQuery]);

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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Device breakdown calculations
  const totalDeviceVisits =
    (stats?.devices.desktop || 0) + (stats?.devices.mobile || 0) + (stats?.devices.tablet || 0) || 1;
  const desktopPct = Math.round(((stats?.devices.desktop || 0) / totalDeviceVisits) * 100);
  const mobilePct = Math.round(((stats?.devices.mobile || 0) / totalDeviceVisits) * 100);
  const tabletPct = Math.round(((stats?.devices.tablet || 0) / totalDeviceVisits) * 100);

  const columnDefs = useMemo<ColDef<VisitorLogItem>[]>(
    () => [
      {
        field: "user_name",
        headerName: "Visitor / Identity",
        width: 220,
        cellRenderer: (params: any) => {
          const log = params.data as VisitorLogItem;
          if (!log) return null;
          return log.is_member ? (
            <div>
              <div style={{ fontWeight: 700, color: "var(--admin-text-main)" }}>
                {log.user_name || "Registered Member"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)" }}>{log.user_email}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, color: "var(--admin-text-secondary)" }}>Guest Visitor</div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--admin-text-subtle)",
                  fontFamily: "monospace",
                }}
              >
                {log.visitor_id ? log.visitor_id.substring(0, 16) + "..." : "Anonymous"}
              </div>
            </div>
          );
        },
      },
      {
        field: "is_member",
        headerName: "Type",
        width: 120,
        cellRenderer: (params: any) => {
          const log = params.data as VisitorLogItem;
          if (!log) return null;
          return log.is_member ? (
            <span className={styles.badgeMember}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Member
            </span>
          ) : (
            <span className={styles.badgeGuest}>Guest</span>
          );
        },
      },
      {
        field: "path",
        headerName: "Page Visited",
        flex: 1.5,
        minWidth: 180,
        cellRenderer: (params: any) => {
          const log = params.data as VisitorLogItem;
          if (!log) return null;
          return <span className={styles.pathTag}>{log.path}</span>;
        },
      },
      {
        field: "browser",
        headerName: "Device & OS",
        width: 180,
        cellRenderer: (params: any) => {
          const log = params.data as VisitorLogItem;
          if (!log) return null;
          return (
            <div className={styles.devicePill}>
              <span>{log.device_type}</span>
              <span>•</span>
              <span>{log.browser}</span>
              <span>({log.os})</span>
            </div>
          );
        },
      },
      {
        field: "ip_address",
        headerName: "IP Address",
        width: 130,
        cellRenderer: (params: any) => {
          const log = params.data as VisitorLogItem;
          return (
            <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>
              {log?.ip_address || "127.0.0.1"}
            </span>
          );
        },
      },
      {
        field: "created_at",
        headerName: "Time",
        width: 120,
        valueFormatter: (params: any) => {
          if (!params.value) return "N/A";
          return formatTimeAgo(params.value);
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
          <h1 className={styles.headerTitle}>Visitor & Member Analytics</h1>
          <p className={styles.headerSubtitle}>
            Real-time telemetry tracking store guests and registered member traffic.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.refreshBtn} ${isRefreshing ? styles.spinning : ""}`}
            onClick={handleManualRefresh}
            title="Refresh analytics data"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>


        </div>
      </div>

      {/* KPI CARDS */}
      <div className={styles.kpiGrid}>
        {/* 1. Total Page Views */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Total Page Views</span>
            <div className={styles.kpiIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats ? stats.total_page_views.toLocaleString() : "..."}</div>
          <div className={styles.kpiMeta}>Cumulative page impressions</div>
        </div>

        {/* 2. Total Unique Visitors */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Unique Visitors</span>
            <div className={styles.kpiIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{stats ? stats.total_unique_visitors.toLocaleString() : "..."}</div>
          <div className={styles.kpiMeta}>
            <span>{stats?.total_guest_visitors || 0} Guests</span>
            <span>•</span>
            <span>{stats?.total_member_visitors || 0} Members</span>
          </div>
        </div>

        {/* 3. Registered Members Visited */}
        <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Members Visited</span>
            <div className={`${styles.kpiIcon} ${styles.kpiIconGold}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <div className={`${styles.kpiValue} ${styles.kpiValueGold}`}>
            {stats ? stats.total_member_visitors.toLocaleString() : "..."}
          </div>
          <div className={styles.kpiMeta}>
            <span style={{ color: "#926f23", fontWeight: 600 }}>Logged-in brand accounts</span>
          </div>
        </div>

        {/* 4. Live Active Visitors */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Active Right Now</span>
            <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
              <span className={styles.pulseDot} />
            </div>
          </div>
          <div className={styles.kpiValue}>{stats ? stats.active_now.toLocaleString() : "..."}</div>
          <div className={styles.kpiMeta}>
            <span className={styles.pulseDot} style={{ width: 6, height: 6 }} />
            <span>Active in last 15 minutes</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHARTS & TOP PAGES */}
      <div className={styles.statsRow}>
        {/* Device Distribution */}
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Device Breakdown
            </h3>
            <span style={{ fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>{totalDeviceVisits} total hits</span>
          </div>

          <div className={styles.deviceBarWrapper}>
            <div className={styles.deviceItem}>
              <div className={styles.deviceHeader}>
                <span>Desktop</span>
                <span>{desktopPct}% ({stats?.devices.desktop || 0})</span>
              </div>
              <div className={styles.deviceTrack}>
                <div
                  className={`${styles.deviceFill} ${styles.fillDesktop}`}
                  style={{ width: `${desktopPct}%` }}
                />
              </div>
            </div>

            <div className={styles.deviceItem}>
              <div className={styles.deviceHeader}>
                <span>Mobile</span>
                <span>{mobilePct}% ({stats?.devices.mobile || 0})</span>
              </div>
              <div className={styles.deviceTrack}>
                <div
                  className={`${styles.deviceFill} ${styles.fillMobile}`}
                  style={{ width: `${mobilePct}%` }}
                />
              </div>
            </div>

            <div className={styles.deviceItem}>
              <div className={styles.deviceHeader}>
                <span>Tablet</span>
                <span>{tabletPct}% ({stats?.devices.tablet || 0})</span>
              </div>
              <div className={styles.deviceTrack}>
                <div
                  className={`${styles.deviceFill} ${styles.fillTablet}`}
                  style={{ width: `${tabletPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Visited Pages */}
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Top Visited Pages
            </h3>
            <span style={{ fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>Ranked by visits</span>
          </div>

          <div className={styles.topPagesList}>
            {stats && stats.top_pages && stats.top_pages.length > 0 ? (
              stats.top_pages.map((p, idx) => (
                <div key={idx} className={styles.topPageRow}>
                  <span className={styles.topPagePath}>{p.path}</span>
                  <span className={styles.topPageCount}>{p.views} views</span>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--admin-text-subtle)", fontSize: "0.875rem", margin: "1rem 0" }}>
                No page view data recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: REGISTERED MEMBERS WHO VISITED */}
      <div className={styles.membersCard}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle} style={{ color: "#926f23" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Registered Members Who Visited ({members.length})
            </h3>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>
              Logged-in customers currently browsing or recently visited your store.
            </p>
          </div>
        </div>

        {members.length > 0 ? (
          <div className={styles.memberGrid}>
            {members.map((m, idx) => {
              const initials = (m.name || m.email || "M")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();
              return (
                <div key={idx} className={styles.memberCard}>
                  <div className={styles.memberAvatar}>{initials}</div>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberName}>{m.name || "Customer Member"}</div>
                    <div className={styles.memberEmail}>{m.email}</div>
                    <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
                      Last page: <span className={styles.pathTag}>{m.last_path || "/"}</span>
                    </div>
                  </div>
                  <div className={styles.memberStats}>
                    <div className={styles.memberVisitsCount}>{m.total_visits}</div>
                    <div className={styles.memberVisitsLabel}>Visits</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--admin-text-subtle)", marginTop: "0.3rem" }}>
                      {formatTimeAgo(m.last_seen)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>No Member Visits Recorded Yet</div>
            <p>When logged-in users navigate through the store, their profile telemetry appears here.</p>
          </div>
        )}
      </div>

      {/* SECTION 4: LIVE VISITOR TELEMETRY TABLE */}
      <div className={styles.logsSection}>
        <div className={styles.logsToolbar}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${filterType === "all" ? styles.filterTabActive : ""}`}
              onClick={() => setFilterType("all")}
            >
              All Visitors ({stats?.total_page_views || logs.length})
            </button>
            <button
              className={`${styles.filterTab} ${filterType === "members" ? styles.filterTabActive : ""}`}
              onClick={() => setFilterType("members")}
            >
              Members ({members.length})
            </button>
            <button
              className={`${styles.filterTab} ${filterType === "guests" ? styles.filterTabActive : ""}`}
              onClick={() => setFilterType("guests")}
            >
              Guests ({stats?.total_guest_visitors || 0})
            </button>
          </div>

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
              placeholder="Search by IP, email, name, or path..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <AdminDataGrid<VisitorLogItem>
          ariaLabel="Recent Live Traffic & Activity"
          rowData={logs}
          columnDefs={columnDefs}
          loading={isLoading}
          getRowId={(s: VisitorLogItem) => String(s.id || s.created_at)}
          quickFilterText={searchQuery}
          emptyTitle="No visitor logs found"
          emptyDescription="No events match your current filter criteria."
        />
      </div>
    </div>
  );
}