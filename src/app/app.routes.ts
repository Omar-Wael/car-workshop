import { Routes } from "@angular/router";

export const routes: Routes = [
  // ── Default redirect ──────────────────────────────────────────────────
  {
    path: "",
    redirectTo: "dashboard",
    pathMatch: "full",
  },

  // ── Dashboard ──────────────────────────────────────────────────────────
  {
    path: "dashboard",
    loadComponent: () =>
      import("./features/dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
    title: "لوحة التحكم — نظام إدارة المركبات",
  },

  // ── Vehicles ──────────────────────────────────────────────────────────
  {
    path: "vehicles",
    loadComponent: () =>
      import("./features/vehicles/vehicles.component").then(
        (m) => m.VehiclesComponent,
      ),
    title: "المركبات",
  },

  // ── Spare Parts ───────────────────────────────────────────────────────
  {
    path: "spare-parts",
    loadComponent: () =>
      import("./features/spare-parts/spare-parts.component").then(
        (m) => m.SparePartsComponent,
      ),
    title: "قطع الغيار",
  },

  // ── Maintenance ───────────────────────────────────────────────────────
  {
    path: "maintenance",
    loadComponent: () =>
      import("./features/maintenance/maintenance.component").then(
        (m) => m.MaintenanceComponent,
      ),
    title: "الصيانة",
  },

  // ── Overhauls ─────────────────────────────────────────────────────────
  {
    path: "overhauls",
    loadComponent: () =>
      import("./features/overhauls/overhauls.component").then(
        (m) => m.OverhaulsComponent,
      ),
    title: "الأعطال الكبرى",
  },

  // ── Checks ────────────────────────────────────────────────────────────
  {
    path: "checks",
    loadComponent: () =>
      import("./features/check/check.component").then((m) => m.CheckComponent),
    title: "الفحوصات",
  },

  // ── Invoices ──────────────────────────────────────────────────────────
  {
    path: "invoices",
    loadComponent: () =>
      import("./features/invoices/invoices.component").then(
        (m) => m.InvoicesComponent,
      ),
    title: "الفواتير",
  },

  // ── Technicians ───────────────────────────────────────────────────────
  {
    path: "technicians",
    loadComponent: () =>
      import("./features/technicians/technicians.component").then(
        (m) => m.TechniciansComponent,
      ),
    title: "الفنيون",
  },

  // ── Departments ───────────────────────────────────────────────────────
  {
    path: "departments",
    loadComponent: () =>
      import("./features/departments/departments.component").then(
        (m) => m.DepartmentsComponent,
      ),
    title: "الأقسام",
  },

  // ── Engines ───────────────────────────────────────────────────────────
  {
    path: "engines",
    loadComponent: () =>
      import("./features/engines/engines.component").then(
        (m) => m.EnginesComponent,
      ),
    title: "المحركات",
  },

  // ── Catalog ───────────────────────────────────────────────────────────
  {
    path: "catalog",
    loadComponent: () =>
      import("./features/catalog/catalog.component").then(
        (m) => m.CatalogComponent,
      ),
    title: "كتالوج قطع الغيار",
  },

  // ── Daily Notes ───────────────────────────────────────────────────────
  {
    path: "daily-notes",
    loadComponent: () =>
      import("./features/daily-notes/daily-notes.component").then(
        (m) => m.DailyNotesComponent,
      ),
    title: "الملاحظات اليومية",
  },

  // ── Stats ─────────────────────────────────────────────────────────────
  {
    path: "stats",
    loadComponent: () =>
      import("./features/stats/stats.component").then((m) => m.StatsComponent),
    title: "الإحصائيات التفصيلية",
  },

  // ── Search ────────────────────────────────────────────────────────────
  {
    path: "search",
    loadComponent: () =>
      import("./features/search/search.component").then(
        (m) => m.SearchComponent,
      ),
    title: "البحث",
  },

  // ── Data (backup / export all) ────────────────────────────────────────
  {
    path: "data",
    loadComponent: () =>
      import("./features/data/data.component").then((m) => m.DataComponent),
    title: "إدارة البيانات",
  },

  // ── 404 fallback ──────────────────────────────────────────────────────
  {
    path: "**",
    redirectTo: "dashboard",
  },
];
