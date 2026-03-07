import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { SupabaseService } from "../../core/services/supabase.service";
import { RecentActivity, StatusBreakdown, StatCard } from "src/app/core/models";

@Component({
  selector: "app-dashboard",
  imports: [CommonModule, RouterModule],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css",
})
export class DashboardComponent implements OnInit {
  loading = signal(true);

  // ── Summary counts ──
  totalVehicles = signal(0);
  totalSpareParts = signal(0);
  totalMaintenance = signal(0);
  totalOverhauls = signal(0);
  totalTechnicians = signal(0);
  totalDepartments = signal(0);
  totalInvoices = signal(0);
  totalCatalog = signal(0);

  // ── Vehicle status breakdown ──
  vehicleStatuses = signal<StatusBreakdown[]>([]);

  // ── Spare parts status breakdown ──
  sparePartsStatuses = signal<StatusBreakdown[]>([]);

  // ── Recent activity ──
  recentActivity = signal<RecentActivity[]>([]);

  // ── Maintenance due soon (oil change interval) ──
  maintenanceDue = signal<any[]>([]);

  today = new Date();

  // ── Stat cards (computed from signals) ──
  statCards = computed<StatCard[]>(() => [
    {
      label: "إجمالي المركبات",
      value: this.totalVehicles(),
      icon: "🚗",
      color: "card-blue",
      route: "/vehicles",
      sublabel: `${this.vehicleStatuses().find((s) => s.label === "نشطة")?.count ?? 0} نشطة`,
    },
    {
      label: "طلبات قطع الغيار",
      value: this.totalSpareParts(),
      icon: "🔧",
      color: "card-orange",
      route: "/spare-parts",
      sublabel: `${this.sparePartsStatuses().find((s) => s.label === "جديد")?.count ?? 0} جديد`,
    },
    {
      label: "سجلات الصيانة",
      value: this.totalMaintenance(),
      icon: "🛠️",
      color: "card-green",
      route: "/maintenance",
    },
    {
      label: "الأعطال الكبرى",
      value: this.totalOverhauls(),
      icon: "⚙️",
      color: "card-red",
      route: "/overhauls",
    },
    {
      label: "الفواتير",
      value: this.totalInvoices(),
      icon: "🧾",
      color: "card-purple",
      route: "/invoices",
    },
    {
      label: "كتالوج القطع",
      value: this.totalCatalog(),
      icon: "📋",
      color: "card-teal",
      route: "/catalog",
    },
    {
      label: "الفنيون النشطون",
      value: this.totalTechnicians(),
      icon: "👷",
      color: "card-indigo",
      route: "/technicians",
    },
    {
      label: "الأقسام",
      value: this.totalDepartments(),
      icon: "🏢",
      color: "card-slate",
      route: "/departments",
    },
  ]);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    try {
      await Promise.all([
        this.loadVehicleStats(),
        this.loadSparePartsStats(),
        this.loadCounts(),
        this.loadRecentActivity(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadVehicleStats() {
    const { data } = await this.db.supabase.from("vehicles").select("status");
    if (!data) return;

    this.totalVehicles.set(data.length);

    const statusMap: Record<string, number> = {};
    data.forEach((v: any) => {
      statusMap[v.status] = (statusMap[v.status] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      نشطة: "status-active",
      "متوقفة للإصلاح": "status-repair",
      عمرة: "status-overhaul",
      "متوقفة للترخيص": "status-license",
      "متوقفة للتكهين": "status-scrap",
      "في الانتظار": "status-waiting",
    };

    this.vehicleStatuses.set(
      Object.entries(statusMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
          label,
          count,
          color: colorMap[label] || "status-default",
        })),
    );
  }

  async loadSparePartsStats() {
    const { data } = await this.db.supabase
      .from("spare_parts")
      .select("status");
    if (!data) return;

    this.totalSpareParts.set(data.length);

    const statusMap: Record<string, number> = {};
    data.forEach((sp: any) => {
      statusMap[sp.status] = (statusMap[sp.status] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      جديد: "status-new",
      "في المخزن": "status-stock",
      "طلب شراء": "status-purchase",
      "تحت التوريد": "status-supply",
      "تم الاستلام": "status-received",
      مغلق: "status-closed",
    };

    this.sparePartsStatuses.set(
      Object.entries(statusMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
          label,
          count,
          color: colorMap[label] || "status-default",
        })),
    );
  }

  async loadCounts() {
    const [maint, overhaulRes, techRes, deptRes, invRes, catRes] =
      await Promise.all([
        this.db.supabase
          .from("maintenance")
          .select("id", { count: "exact", head: true }),
        this.db.supabase
          .from("overhauls")
          .select("id", { count: "exact", head: true }),
        this.db.supabase
          .from("technicians")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        this.db.supabase
          .from("departments")
          .select("id", { count: "exact", head: true }),
        this.db.supabase
          .from("invoices")
          .select("id", { count: "exact", head: true }),
        this.db.supabase
          .from("spare_parts_catalog")
          .select("id", { count: "exact", head: true }),
      ]);

    this.totalMaintenance.set(maint.count ?? 0);
    this.totalOverhauls.set(overhaulRes.count ?? 0);
    this.totalTechnicians.set(techRes.count ?? 0);
    this.totalDepartments.set(deptRes.count ?? 0);
    this.totalInvoices.set(invRes.count ?? 0);
    this.totalCatalog.set(catRes.count ?? 0);
  }

  async loadRecentActivity() {
    // Load last 5 of each type concurrently
    const [spRes, mtRes, ovRes] = await Promise.all([
      this.db.supabase
        .from("spare_parts")
        .select("request_number,vehicle_plate,status,created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      this.db.supabase
        .from("maintenance")
        .select("vehicle_plate,maintenance_type,created_at")
        .order("created_at", { ascending: false })
        .limit(3),
      this.db.supabase
        .from("overhauls")
        .select("vehicle_plate,created_at")
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    const activities: RecentActivity[] = [];

    (spRes.data || []).forEach((sp: any) => {
      activities.push({
        type: "spare-parts",
        icon: "🔧",
        description: `طلب صرف ${sp.request_number} — ${sp.vehicle_plate}`,
        date: sp.created_at,
        badge: sp.status,
        badgeClass: this.getSpareStatusClass(sp.status),
      });
    });

    (mtRes.data || []).forEach((m: any) => {
      activities.push({
        type: "maintenance",
        icon: "🛠️",
        description: `صيانة ${m.maintenance_type || ""} — ${m.vehicle_plate}`,
        date: m.created_at,
      });
    });

    (ovRes.data || []).forEach((o: any) => {
      activities.push({
        type: "overhauls",
        icon: "⚙️",
        description: `عطل كبير — ${o.vehicle_plate}`,
        date: o.created_at,
      });
    });

    // Sort by date desc
    activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    this.recentActivity.set(activities.slice(0, 8));
  }

  getSpareStatusClass(status: string): string {
    const map: Record<string, string> = {
      جديد: "badge-info",
      "في المخزن": "badge-success",
      "طلب شراء": "badge-warning",
      "تحت التوريد": "badge-pending",
      "تم الاستلام": "badge-success",
      مغلق: "badge-secondary",
    };
    return map[status] || "badge-secondary";
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  getStatusPercent(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }
}
