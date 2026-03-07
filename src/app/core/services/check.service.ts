import { Injectable, signal, computed } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";
import { ExcelColumn, Check, CheckVehicle } from "../models";

export const STAGE_LABELS: Record<number, string> = {
  1: "طلب الصرف",
  2: "عروض الأسعار",
  3: "موافقة المدير العام",
  4: "موافقة رئيس القطاع",
  5: "موافقة النائب",
  6: "موافقة رئيس مجلس الإدارة",
  7: "موافقة لجنة البت",
  8: "استلام الشيك",
};

export const TYPE_LABELS: Record<string, string> = {
  overhaul: "عمرة",
  maintenance: "صيانة",
  spare_parts: "طلب صرف",
  other: "أخرى",
};

const EXCEL_COLS: ExcelColumn[] = [
  { key: "check_number", header: "رقم الشيك", width: 20 },
  { key: "check_amount", header: "القيمة", width: 16, type: "number" },
  { key: "check_date", header: "تاريخ الشيك", width: 16, type: "date" },
  { key: "bank_name", header: "البنك", width: 20 },
  { key: "beneficiary", header: "المستفيد", width: 22 },
  {
    key: "current_stage",
    header: "المرحلة",
    width: 12,
    exportFn: (row) =>
      `${row.current_stage}/8 — ${STAGE_LABELS[row.current_stage] || ""}`,
  },
  {
    key: "related_type",
    header: "نوع الربط",
    width: 16,
    exportFn: (row) =>
      row.related_type ? TYPE_LABELS[row.related_type] || row.related_type : "",
  },
  { key: "related_reference", header: "المرجع", width: 20 },
  {
    key: "vehicles",
    header: "السيارات",
    width: 30,
    exportFn: (row) =>
      ((row.vehicles as CheckVehicle[]) || [])
        .map((v) => v.vehicle_plate)
        .join("، "),
  },
  {
    key: "total_vehicles_amount",
    header: "إجمالي المبالغ",
    width: 18,
    type: "number",
  },
  { key: "notes", header: "ملاحظات", width: 35 },
  {
    key: "created_at",
    header: "تاريخ الإضافة",
    width: 20,
    exportFn: (row) =>
      row.created_at
        ? new Date(row.created_at).toLocaleDateString("ar-EG")
        : "",
  },
];

@Injectable({
  providedIn: "root",
})
export class CheckService {
  checks = signal<Check[]>([]);
  vehicles = signal<{ plate_number: string }[]>([]);
  references = signal<string[]>([]);
  loading = signal(false);
  saving = signal(false);

  totalCount = computed(() => this.checks().length);
  inProgressCount = computed(
    () => this.checks().filter((c) => c.current_stage < 8).length,
  );
  completedCount = computed(
    () => this.checks().filter((c) => c.current_stage === 8).length,
  );

  readonly stageOptions = Object.entries(STAGE_LABELS).map(([v, l]) => ({
    value: v,
    label: `${v} — ${l}`,
  }));
  readonly typeOptions = Object.entries(TYPE_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  async loadAll(): Promise<void> {
    await Promise.all([this.loadChecks(), this.loadVehicles()]);
  }

  async loadChecks(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("checks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.checks.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل الشيكات:", err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadVehicles(): Promise<void> {
    try {
      const { data } = await this.db.supabase
        .from("vehicles")
        .select("plate_number")
        .order("plate_number");
      this.vehicles.set(data || []);
    } catch {}
  }

  async loadReferences(type: string): Promise<void> {
    this.references.set([]);
    if (type === "other") return;
    try {
      let data: any[] = [];
      if (type === "overhaul") {
        const res = await this.db.supabase
          .from("overhauls")
          .select("vehicle_plate")
          .order("created_at", { ascending: false });
        data = [
          ...new Set(
            (res.data || []).map((d: any) => d.vehicle_plate).filter(Boolean),
          ),
        ];
      } else if (type === "maintenance") {
        const res = await this.db.supabase
          .from("maintenance")
          .select("vehicle_plate")
          .order("created_at", { ascending: false });
        data = [
          ...new Set(
            (res.data || []).map((d: any) => d.vehicle_plate).filter(Boolean),
          ),
        ];
      } else if (type === "spare_parts") {
        const res = await this.db.supabase
          .from("spare_parts")
          .select("request_number")
          .order("created_at", { ascending: false });
        data = (res.data || [])
          .map((d: any) => d.request_number)
          .filter(Boolean);
      }
      this.references.set(data);
    } catch (err) {
      console.error("خطأ في تحميل المراجع:", err);
    }
  }

  async save(
    payload: Omit<Check, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snap = this.checks();
        this.checks.update((list) =>
          list.map((c) => (c.id === editingId ? { ...c, ...payload } : c)),
        );
        const { error } = await this.db.supabase
          .from("checks")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.checks.set(snap);
          throw error;
        }
        return {
          ok: true,
          message: `✅ تم تعديل الشيك ${payload.check_number}`,
        };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("checks")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.checks.update((list) => [inserted, ...list]);
        return {
          ok: true,
          message: `✅ تم إضافة الشيك ${payload.check_number}`,
        };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحفظ: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    if (!confirm("حذف هذا الشيك؟")) return { ok: false, message: "" };
    const snap = this.checks();
    this.checks.update((list) => list.filter((c) => c.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("checks")
        .delete()
        .eq("id", id);
      if (error) {
        this.checks.set(snap);
        throw error;
      }
      return { ok: true, message: "✅ تم حذف الشيك" };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  async getById(id: string): Promise<Check | null> {
    const { data, error } = await this.db.supabase
      .from("checks")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  calcTotalVehiclesAmount(vehicles: CheckVehicle[]): number {
    return vehicles.reduce((s, v) => s + (+v.amount! || 0), 0);
  }

  stageLabel(stage: number): string {
    return STAGE_LABELS[stage] || `مرحلة ${stage}`;
  }
  typeLabel(type: string | null | undefined): string {
    if (!type) return "—";
    return TYPE_LABELS[type] || type;
  }

  exportToExcel(): void {
    this.excel.export(this.checks(), EXCEL_COLS, "سجلات_الشيكات", "الشيكات");
  }
}
