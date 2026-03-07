import { Injectable, signal, computed } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";
import { Technician, ExcelColumn } from "../models";

export const SKILL_LEVELS = ["مبتدئ", "متوسط", "متقدم", "خبير"] as const;

export const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  on_leave: "في إجازة",
  suspended: "موقوف",
  terminated: "مفصول",
};

export const SKILL_BADGE: Record<string, string> = {
  مبتدئ: "badge-secondary",
  متوسط: "badge-info",
  متقدم: "badge-success",
  خبير: "badge-primary",
};

export const SPECIALIZATION_OPTIONS = [
  "ميكانيكا بنزين",
  "كهرباء بنزين",
  "ميكانيكا سولار",
  "كهرباء سولار",
  "ميكانيكا ملاكى",
  "كهرباء ملاكى",
  "معدات و هيدروليك",
  "كهرباء معدات",
  "عفشة ملاكى",
  "عفشة نقل",
];

const EXCEL_COLS: ExcelColumn[] = [
  { key: "full_name", header: "الاسم الكامل", width: 22 },
  { key: "employee_number", header: "رقم الموظف", width: 14 },
  { key: "position", header: "المنصب", width: 18 },
  { key: "skill_level", header: "المستوى", width: 12 },
  { key: "department", header: "القسم", width: 18 },
  {
    key: "status",
    header: "الحالة",
    width: 14,
    exportFn: (row) => STATUS_LABELS[row.status] || row.status,
  },
  { key: "hire_date", header: "تاريخ التعيين", width: 16, type: "date" },
  { key: "performance_rating", header: "التقييم", width: 10, type: "number" },
  { key: "total_jobs", header: "إجمالي الأعمال", width: 14, type: "number" },
  { key: "completed_jobs", header: "مكتملة", width: 12, type: "number" },
  { key: "pending_jobs", header: "جارية", width: 10, type: "number" },
  {
    key: "specializations",
    header: "التخصصات",
    width: 30,
    exportFn: (row) => (row.specializations || []).join("، "),
  },
  { key: "phone", header: "الهاتف", width: 16 },
  { key: "notes", header: "ملاحظات", width: 30 },
];

@Injectable({
  providedIn: "root",
})
export class TechnicianService {
  technicians = signal<Technician[]>([]);
  departments = signal<string[]>([]);
  loading = signal(false);
  saving = signal(false);

  totalCount = computed(() => this.technicians().length);
  activeCount = computed(
    () => this.technicians().filter((t) => t.status === "active").length,
  );

  readonly skillLevels = SKILL_LEVELS;
  readonly statusOptions = Object.entries(STATUS_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));
  readonly specializationOptions = SPECIALIZATION_OPTIONS;

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [techRes, deptRes] = await Promise.all([
        this.db.supabase.from("technicians").select("*").order("full_name"),
        this.db.supabase.from("departments").select("name").order("name"),
      ]);
      if (techRes.error) throw techRes.error;
      this.technicians.set(techRes.data || []);
      this.departments.set((deptRes.data || []).map((d: any) => d.name));
    } catch (err: any) {
      console.error("خطأ في تحميل الفنيين:", err);
    } finally {
      this.loading.set(false);
    }
  }

  async getById(id: string): Promise<Technician | null> {
    const { data, error } = await this.db.supabase
      .from("technicians")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  async save(
    payload: Omit<Technician, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snap = this.technicians();
        this.technicians.update((list) =>
          list.map((t) => (t.id === editingId ? { ...t, ...payload } : t)),
        );
        const { error } = await this.db.supabase
          .from("technicians")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.technicians.set(snap);
          throw error;
        }
        return {
          ok: true,
          message: `✅ تم تحديث بيانات الفني ${payload.full_name}`,
        };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("technicians")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.technicians.update((list) =>
          [...list, inserted].sort((a, b) =>
            a.full_name.localeCompare(b.full_name, "ar"),
          ),
        );
        return { ok: true, message: `✅ تم إضافة الفني ${payload.full_name}` };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحفظ: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    if (!confirm("حذف هذا الفني؟")) return { ok: false, message: "" };
    const snap = this.technicians();
    this.technicians.update((list) => list.filter((t) => t.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("technicians")
        .delete()
        .eq("id", id);
      if (error) {
        this.technicians.set(snap);
        throw error;
      }
      return { ok: true, message: "✅ تم حذف الفني" };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  exportToExcel(): void {
    this.excel.export(this.technicians(), EXCEL_COLS, "الفنيون", "الفنيون");
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }
  skillBadgeClass(level: string): string {
    return SKILL_BADGE[level] || "badge-secondary";
  }
  renderStars(rating: number | null | undefined): string {
    const r = Math.round(rating || 0);
    return "⭐".repeat(Math.min(r, 5));
  }
}
