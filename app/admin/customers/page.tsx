"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import styles from "./customers.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import {
  CurrencyRenderer,
  DateRenderer,
  StatusBadge,
  StatusBadgeRenderer,
  dateComparator,
} from "../../components/admin/gridRenderers";
import gridStyles from "../../components/admin/gridRenderers.module.css";
import {
  fetchAdminCustomers,
  fetchAdminCustomerStats,
  updateCustomerStatus,
  updateCustomerRole,
  fetchCustomerOrders,
  AdminCustomerItem,
  AdminCustomerStats,
} from "../../services/api";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerItem[]>([]);
  const [stats, setStats] = useState<AdminCustomerStats>({
    total_users: 0,
    total_customers: 0,
    total_admins: 0,
    verified_users: 0,
    active_users: 0,
    total_orders: 0,
    total_spend: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("customer");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerItem | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custs, st] = await Promise.all([
        fetchAdminCustomers({
          role: activeTab !== "all" ? activeTab : undefined,
          search: searchQuery || undefined,
        }),
        fetchAdminCustomerStats(),
      ]);
      setCustomers(custs);
      setStats(st);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenDrawer = async (cust: AdminCustomerItem) => {
    setSelectedCustomer(cust);
    setLoadingOrders(true);
    try {
      const orders = await fetchCustomerOrders(cust.id);
      setCustomerOrders(orders);
    } catch (err) {
      console.error("Failed to load customer orders:", err);
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleStatusToggle = async (userId: string, currentActive: boolean) => {
    setIsUpdating(userId);
    const newActive = !currentActive;
    try {
      await updateCustomerStatus(userId, newActive);
      setCustomers((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, is_active: newActive } : c))
      );
      if (selectedCustomer && selectedCustomer.id === userId) {
        setSelectedCustomer((prev) => (prev ? { ...prev, is_active: newActive } : null));
      }
      fetchAdminCustomerStats().then(setStats).catch(() => {});
    } catch (err) {
      alert("Failed to update user status.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRoleToggle = async (userId: string, currentAdmin: boolean) => {
    const confirmChange = window.confirm(
      currentAdmin
        ? "Revoke Administrator privileges for this user?"
        : "Grant Administrator privileges to this user?"
    );
    if (!confirmChange) return;

    setIsUpdating(userId);
    const newAdmin = !currentAdmin;
    try {
      await updateCustomerRole(userId, newAdmin);
      setCustomers((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, is_admin: newAdmin } : c))
      );
      if (selectedCustomer && selectedCustomer.id === userId) {
        setSelectedCustomer((prev) => (prev ? { ...prev, is_admin: newAdmin } : null));
      }
      fetchAdminCustomerStats().then(setStats).catch(() => {});
    } catch (err) {
      alert("Failed to change user role.");
    } finally {
      setIsUpdating(null);
    }
  };

  // Customers grid columns — actions call the same handlers as the old table
  const columnDefs = useMemo<ColDef<AdminCustomerItem>[]>(() => [
    {
      headerName: "",
      colId: "avatar",
      width: 60,
      minWidth: 60,
      maxWidth: 60,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (p: CustomCellRendererProps<AdminCustomerItem>) => {
        const c = p.data;
        if (!c) return null;
        const initials = ((c.first_name ? c.first_name[0] : "") + (c.last_name ? c.last_name[0] : "")).toUpperCase() || "C";
        return <span className={styles.avatarCircle} aria-hidden="true">{initials}</span>;
      },
    },
    {
      headerName: "Full Name",
      field: "name",
      minWidth: 180,
      flex: 1.4,
      cellRenderer: (p: CustomCellRendererProps<AdminCustomerItem>) => {
        const c = p.data;
        if (!c) return null;
        const isVip = c.orders_count >= 2 || c.total_spent >= 50000;
        return (
          <span className={styles.custName}>
            {c.name}
            {isVip && <span className={styles.vipBadge}>VIP</span>}
          </span>
        );
      },
    },
    { headerName: "Email", field: "email", minWidth: 220, flex: 1.5 },
    { headerName: "Phone", colId: "phone", minWidth: 130, valueGetter: (p) => p.data?.phone || "—" },
    { headerName: "Orders", field: "orders_count", minWidth: 100, type: "rightAligned", filter: "agNumberColumnFilter" },
    {
      headerName: "Total Spent",
      field: "total_spent",
      minWidth: 140,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      cellRenderer: CurrencyRenderer,
    },
    {
      headerName: "Joined",
      field: "created_at",
      minWidth: 180,
      comparator: dateComparator,
      cellRenderer: DateRenderer,
    },
    {
      headerName: "Role",
      colId: "role",
      minWidth: 130,
      valueGetter: (p) => (p.data?.is_admin ? "Administrator" : "Customer"),
      cellRenderer: (p: CustomCellRendererProps<AdminCustomerItem>) => (
        <StatusBadge label={String(p.value).toUpperCase()} tone={p.data?.is_admin ? "gold" : "neutral"} />
      ),
    },
    {
      headerName: "Status",
      colId: "status",
      minWidth: 110,
      valueGetter: (p) => (p.data?.is_active ? "Active" : "Inactive"),
      cellRenderer: StatusBadgeRenderer,
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 180,
      minWidth: 180,
      maxWidth: 180,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right",
      cellRenderer: (p: CustomCellRendererProps<AdminCustomerItem>) => {
        const c = p.data;
        if (!c) return null;
        return (
          <div className={gridStyles.rowActions}>
            <button
              type="button"
              className={gridStyles.rowActionBtn}
              onClick={() => handleOpenDrawer(c)}
              title="View customer orders and details"
            >
              Inspect
            </button>
            <button
              type="button"
              className={[gridStyles.rowActionBtn, c.is_active ? "" : gridStyles.rowActionGold].join(" ")}
              onClick={() => handleStatusToggle(c.id, c.is_active)}
              disabled={isUpdating === c.id}
            >
              {c.is_active ? "Suspend" : "Activate"}
            </button>
          </div>
        );
      },
    },
  // Handlers only use state setters; isUpdating drives the disabled state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isUpdating]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            Customer <span className={styles.goldAccent}>Directory</span>
          </h1>
          <p className={styles.subtitle}>
            Explore customer accounts, order frequency, total lifetime spend, and manage access roles.
          </p>
        </div>

        <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
          <span>↻</span> {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Registered Accounts</div>
          <div className={styles.kpiValue}>{stats.total_users}</div>
          <div className={styles.kpiDesc}>
            {stats.total_customers} Customers · {stats.total_admins} Administrators
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Cumulative Orders Placed</div>
          <div className={styles.kpiValue} style={{ color: "#4ade80" }}>
            {stats.total_orders}
          </div>
          <div className={styles.kpiDesc}>Orders placed by registered client accounts</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Customer Spend</div>
          <div className={styles.kpiValue}>
            <span className={styles.kpiGoldVal}>₹{stats.total_spend.toLocaleString("en-IN")}</span>
          </div>
          <div className={styles.kpiDesc}>Lifetime revenue generated from registered accounts</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Verified Client Accounts</div>
          <div className={styles.kpiValue}>{stats.verified_users}</div>
          <div className={styles.kpiDesc}>Completed email OTP verification</div>
        </div>
      </div>

      {/* CUSTOMERS GRID (AG Grid Community). Tabs + search stay server-side. */}
      <AdminDataGrid<AdminCustomerItem>
        ariaLabel="Customer accounts"
        rowData={customers}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(c) => String(c.id)}
        showSearch={false}
        quickFilterText={searchQuery}
        emptyTitle="No customers found"
        emptyDescription="There are no accounts matching the selected filter or query."
        toolbar={
          <>
            <div className={styles.tabs} role="tablist" aria-label="Account type">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "customer"}
                className={`${styles.tabBtn} ${activeTab === "customer" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("customer")}
              >
                Customers <span className={styles.tabBadge}>{stats.total_customers}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={`${styles.tabBtn} ${activeTab === "all" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Accounts <span className={styles.tabBadge}>{stats.total_users}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "admin"}
                className={`${styles.tabBtn} ${activeTab === "admin" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("admin")}
              >
                Administrators <span className={styles.tabBadge}>{stats.total_admins}</span>
              </button>
            </div>

            <form className={styles.searchForm} onSubmit={handleSearchSubmit} role="search">
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search name, email, or phone…"
                aria-label="Search customers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className={styles.searchBtn}>
                Search
              </button>
            </form>
          </>
        }
      />

      {/* Customer Detail & Orders Modal Drawer */}
      {selectedCustomer && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCustomer(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedCustomer(null)}>
              ✕
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.modalSectionLabel}>Customer Profile</div>
              <h2>{selectedCustomer.name}</h2>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <span
                  className={`${styles.statusBadge} ${
                    selectedCustomer.is_active ? styles.statusActive : styles.statusInactive
                  }`}
                >
                  {selectedCustomer.is_active ? "Active" : "Suspended"}
                </span>
                <span
                  className={`${styles.roleBadge} ${
                    selectedCustomer.is_admin ? styles.roleAdmin : ""
                  }`}
                >
                  {selectedCustomer.is_admin ? "Administrator" : "Customer"}
                </span>
                {selectedCustomer.is_verified && (
                  <span
                    className={styles.statusBadge}
                    style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" }}
                  >
                    ✓ Verified Email
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--admin-surface-muted)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Email Address</div>
                <div style={{ fontWeight: 600, color: "var(--admin-text-main)", marginTop: "0.25rem" }}>
                  <a href={`mailto:${selectedCustomer.email}`} style={{ color: "#c49a45", textDecoration: "none" }}>
                    {selectedCustomer.email || "—"}
                  </a>
                </div>
              </div>

              <div style={{ background: "var(--admin-surface-muted)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Phone Number</div>
                <div style={{ fontWeight: 600, color: "var(--admin-text-main)", marginTop: "0.25rem" }}>
                  {selectedCustomer.phone || "—"}
                </div>
              </div>

              <div style={{ background: "var(--admin-surface-muted)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Lifetime Orders</div>
                <div style={{ fontWeight: 700, color: "var(--admin-text-main)", marginTop: "0.25rem", fontSize: "1.1rem" }}>
                  {selectedCustomer.orders_count} orders
                </div>
              </div>

              <div style={{ background: "var(--admin-surface-muted)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Spend</div>
                <div style={{ fontWeight: 700, color: "#c49a45", marginTop: "0.25rem", fontSize: "1.1rem" }}>
                  ₹{selectedCustomer.total_spent.toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Orders Section */}
            <div>
              <div className={styles.modalSectionLabel}>Order History ({customerOrders.length})</div>
              {loadingOrders ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
                  Loading order history...
                </div>
              ) : customerOrders.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--admin-text-muted)", background: "var(--admin-surface-muted)", border: "1px solid var(--admin-border)", borderRadius: "8px" }}>
                  No orders placed yet by this customer.
                </div>
              ) : (
                customerOrders.map((ord: any) => (
                  <div key={ord.id} className={styles.customerOrderCard}>
                    <div>
                      <div className={styles.orderNum}>
                        {ord.order_number || ord.orderNumber || `Order #${ord.id?.slice(0, 8)}`}
                      </div>
                      <div className={styles.orderDate}>
                        {ord.created_at ? new Date(ord.created_at).toLocaleDateString() : "—"} · Status: {ord.status || "confirmed"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", marginTop: "0.25rem" }}>
                        {ord.items?.length || 0} items ({ord.items?.map((it: any) => it.product_name || it.title).join(", ") || "Custom pieces"})
                      </div>
                    </div>
                    <div className={styles.orderAmount}>
                      ₹{(ord.total || ord.total_amount || ord.totalAmount || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between" }}>
              <button
                className={styles.btnSecondary}
                onClick={() => handleRoleToggle(selectedCustomer.id, selectedCustomer.is_admin)}
                disabled={isUpdating === selectedCustomer.id}
              >
                {selectedCustomer.is_admin ? "Demote to Customer" : "Promote to Admin"}
              </button>

              <button
                className={`${styles.btnSecondary} ${selectedCustomer.is_active ? "" : styles.btnGold}`}
                onClick={() => handleStatusToggle(selectedCustomer.id, selectedCustomer.is_active)}
                disabled={isUpdating === selectedCustomer.id}
              >
                {selectedCustomer.is_active ? "Suspend Customer Account" : "Activate Customer Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
