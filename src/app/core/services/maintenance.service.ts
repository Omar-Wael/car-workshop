import { Injectable, signal } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";
import { ExcelColumn, Maintenance, Overhaul } from "../models";

// ── Excel columns ─────────────────────────────────────────────────────────────

const MAINTENANCE_EXCEL_COLS: ExcelColumn[] = [
  { key: "vehicle_plate", header: "رقم السيارة", width: 18 },
  { key: "maintenance_type", header: "نوع الصيانة", width: 16 },
  { key: "status", header: "الحالة", width: 16 },
  { key: "entry_date", header: "تاريخ الدخول", width: 16, type: "date" },
  {
    key: "expected_exit_date",
    header: "تاريخ الخروج المتوقع",
    width: 20,
    type: "date",
  },
  { key: "exit_date", header: "تاريخ الخروج الفعلي", width: 20, type: "date" },
  { key: "repair_work", header: "أعمال الإصلاح", width: 40 },
  { key: "technicians", header: "الفنيون", width: 25 },
  { key: "linked_request_number", header: "طلب الصرف المرتبط", width: 20 },
  {
    key: "has_external_work",
    header: "مصنعية خارجية",
    width: 16,
    exportFn: (row) => (row.has_external_work ? "نعم" : "لا"),
  },
  { key: "external_cost", header: "تكلفة المصنعية", width: 18, type: "number" },
  {
    key: "odometer_reading",
    header: "قراءة العداد",
    width: 16,
    type: "number",
  },
  {
    key: "created_at",
    header: "تاريخ الإضافة",
    width: 20,
    type: "date",
    exportFn: (row) =>
      row.created_at
        ? new Date(row.created_at).toLocaleDateString("ar-EG")
        : "",
  },
];

const OVERHAUL_EXCEL_COLS: ExcelColumn[] = [
  { key: "vehicle_plate", header: "رقم السيارة", width: 18 },
  { key: "type", header: "نوع العمرة", width: 20 },
  { key: "status", header: "الحالة", width: 16 },
  { key: "entry_date", header: "تاريخ البدء", width: 16, type: "date" },
  {
    key: "expected_exit_date",
    header: "تاريخ الانتهاء المتوقع",
    width: 22,
    type: "date",
  },
  {
    key: "exit_date",
    header: "تاريخ الانتهاء الفعلي",
    width: 22,
    type: "date",
  },
  { key: "technician_name", header: "الفني/الفنيون", width: 25 },
  {
    key: "quotation_value",
    header: "قيمة عرض السعر",
    width: 18,
    type: "number",
  },
  {
    key: "quotation_received",
    header: "عروض أسعار",
    width: 14,
    exportFn: (row) => (row.quotation_received ? "نعم" : "لا"),
  },
  {
    key: "check_received",
    header: "الشيك",
    width: 12,
    exportFn: (row) => (row.check_received ? "نعم" : "لا"),
  },
  {
    key: "run_in_period_days",
    header: "مدة التليين (يوم)",
    width: 18,
    type: "number",
  },
  {
    key: "odometer_reading",
    header: "قراءة العداد",
    width: 16,
    type: "number",
  },
  { key: "notes", header: "ملاحظات", width: 35 },
  {
    key: "created_at",
    header: "تاريخ الإضافة",
    width: 20,
    type: "date",
    exportFn: (row) =>
      row.created_at
        ? new Date(row.created_at).toLocaleDateString("ar-EG")
        : "",
  },
];

@Injectable({
  providedIn: "root",
})
export class MaintenanceService {
  // ── Signals ──
  maintenances = signal<Maintenance[]>([]);
  overhauls = signal<Overhaul[]>([]);
  vehicles = signal<{ plate_number: string; department?: string | null }[]>([]);
  technicians = signal<{ id: string; full_name: string }[]>([]);
  loading = signal(false);
  saving = signal(false);

  // ── Type options ──
  readonly maintenanceTypes = ["تصحيحية", "وقائية", "تنبؤية", "طارئة", "دورية"];
  readonly maintenanceStatuses = ["قيد التنفيذ", "مكتملة", "معلقة"];
  readonly overhaulStatuses = ["قيد الإعداد", "قيد التنفيذ", "مكتملة", "معلقة"];

  readonly typeColors: Record<string, string> = {
    تصحيحية: "#ef4444",
    وقائية: "#22c55e",
    تنبؤية: "#3b82f6",
    طارئة: "#f97316",
    دورية: "#8b5cf6",
  };

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  // ── Load all ──────────────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    await Promise.all([
      this.loadMaintenances(),
      this.loadOverhauls(),
      this.loadVehicles(),
      this.loadTechnicians(),
    ]);
  }

  async loadMaintenances(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("maintenance")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.maintenances.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل الصيانة:", err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadOverhauls(): Promise<void> {
    try {
      const { data, error } = await this.db.supabase
        .from("overhauls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.overhauls.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل العمرات:", err);
    }
  }

  async loadVehicles(): Promise<void> {
    try {
      const { data } = await this.db.supabase
        .from("vehicles")
        .select("plate_number, department")
        .order("plate_number");
      this.vehicles.set(data || []);
    } catch {}
  }

  async loadTechnicians(): Promise<void> {
    try {
      const { data } = await this.db.supabase
        .from("technicians")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      this.technicians.set(data || []);
    } catch {}
  }

  // ── Maintenance CRUD ──────────────────────────────────────────────────────

  async saveMaintenance(
    payload: Omit<Maintenance, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snapshot = this.maintenances();
        this.maintenances.update((list) =>
          list.map((m) => (m.id === editingId ? { ...m, ...payload } : m)),
        );
        const { error } = await this.db.supabase
          .from("maintenance")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.maintenances.set(snapshot);
          throw error;
        }
        return { ok: true, message: `✅ تم تحديث سجل الصيانة` };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("maintenance")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.maintenances.update((list) => [inserted, ...list]);
        return { ok: true, message: "✅ تم إضافة الصيانة" };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل حفظ الصيانة: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async deleteMaintenance(
    id: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (!confirm("حذف هذه الصيانة؟")) return { ok: false, message: "" };
    const snapshot = this.maintenances();
    this.maintenances.update((list) => list.filter((m) => m.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("maintenance")
        .delete()
        .eq("id", id);
      if (error) {
        this.maintenances.set(snapshot);
        throw error;
      }
      return { ok: true, message: "✅ تم حذف الصيانة" };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  async getMaintenanceById(id: string): Promise<Maintenance | null> {
    const { data, error } = await this.db.supabase
      .from("maintenance")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  // ── Overhaul CRUD ─────────────────────────────────────────────────────────

  async saveOverhaul(
    payload: Omit<Overhaul, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snapshot = this.overhauls();
        this.overhauls.update((list) =>
          list.map((o) => (o.id === editingId ? { ...o, ...payload } : o)),
        );
        const { error } = await this.db.supabase
          .from("overhauls")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.overhauls.set(snapshot);
          throw error;
        }
        return { ok: true, message: "✅ تم تحديث سجل العمرة" };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("overhauls")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.overhauls.update((list) => [inserted, ...list]);
        return { ok: true, message: "✅ تم إضافة العمرة" };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل حفظ العمرة: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async deleteOverhaul(id: string): Promise<{ ok: boolean; message: string }> {
    if (!confirm("حذف هذه العمرة؟")) return { ok: false, message: "" };
    const snapshot = this.overhauls();
    this.overhauls.update((list) => list.filter((o) => o.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("overhauls")
        .delete()
        .eq("id", id);
      if (error) {
        this.overhauls.set(snapshot);
        throw error;
      }
      return { ok: true, message: "✅ تم حذف العمرة" };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  async getOverhaulById(id: string): Promise<Overhaul | null> {
    const { data, error } = await this.db.supabase
      .from("overhauls")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  exportMaintenanceToExcel(rows?: Maintenance[]): void {
    this.excel.export(
      rows ?? this.maintenances(),
      MAINTENANCE_EXCEL_COLS,
      "سجلات_الصيانة",
      "الصيانة",
    );
  }

  exportOverhaulsToExcel(rows?: Overhaul[]): void {
    this.excel.export(
      rows ?? this.overhauls(),
      OVERHAUL_EXCEL_COLS,
      "سجلات_العمرات",
      "العمرات",
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Resolve plate → department using loaded vehicles signal */
  getDepartment(plate: string): string {
    return (
      this.vehicles().find((v) => v.plate_number === plate)?.department || ""
    );
  }
}
