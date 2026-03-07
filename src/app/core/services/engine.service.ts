import { Injectable, signal } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";
import { ExcelColumn, Engine } from "../models";

const EXCEL_COLS: ExcelColumn[] = [
  { key: "engine_code", header: "كود المحرك", width: 16 },
  { key: "engine_name", header: "اسم المحرك", width: 24 },
  { key: "brand", header: "الشركة", width: 16 },
  { key: "family", header: "العائلة", width: 16 },
  { key: "cylinders", header: "أسطوانات", width: 12, type: "number" },
  { key: "displacement_l", header: "السعة (L)", width: 12, type: "number" },
  { key: "displacement_cc", header: "السعة (cc)", width: 12, type: "number" },
  { key: "bore_mm", header: "Bore (mm)", width: 12, type: "number" },
  { key: "stroke_mm", header: "Stroke (mm)", width: 12, type: "number" },
  { key: "cam_type", header: "نوع الكامة", width: 14 },
  { key: "total_valves", header: "الصمامات", width: 12, type: "number" },
  { key: "timing_system", header: "نظام التوقيت", width: 16 },
  { key: "fuel_system", header: "نظام الوقود", width: 16 },
  { key: "fuel_type", header: "نوع الوقود", width: 14 },
  { key: "power_hp", header: "القوة (hp)", width: 12, type: "number" },
  { key: "torque_nm", header: "العزم (Nm)", width: 12, type: "number" },
  { key: "compression_ratio", header: "نسبة الضغط", width: 14 },
  { key: "firing_order", header: "ترتيب الاشتعال", width: 16 },
  {
    key: "oil_capacity_l",
    header: "زيت المحرك (L)",
    width: 16,
    type: "number",
  },
  { key: "oil_type", header: "نوع الزيت", width: 16 },
  { key: "cooling_type", header: "نوع التبريد", width: 14 },
  {
    key: "is_active",
    header: "نشط",
    width: 10,
    exportFn: (row) => (row.is_active ? "نعم" : "لا"),
  },
];

@Injectable({
  providedIn: "root",
})
export class EngineService {
  engines = signal<Engine[]>([]);
  loading = signal(false);
  saving = signal(false);

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("engines")
        .select("*")
        .order("engine_code");
      if (error) throw error;
      this.engines.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل المحركات:", err);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchActive(): Promise<Engine[]> {
    const { data } = await this.db.supabase
      .from("engines")
      .select("*")
      .eq("is_active", true)
      .order("engine_code");
    return data || [];
  }

  async getById(id: string): Promise<Engine | null> {
    const { data, error } = await this.db.supabase
      .from("engines")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  /** Auto-calculate displacement_cc from bore, stroke, cylinders */
  calcDisplacement(
    bore_mm: number | null,
    stroke_mm: number | null,
    cylinders: number | null,
  ): number | null {
    if (!bore_mm || !stroke_mm || !cylinders) return null;
    return Math.round(
      ((Math.PI / 4) * Math.pow(bore_mm, 2) * stroke_mm * cylinders) / 1000,
    );
  }

  calcDisplacementL(cc: number | null): number | null {
    if (!cc) return null;
    return Math.round(cc / 100) / 10;
  }

  calcTotalValves(
    valvesPerCyl: number | null,
    cylinders: number | null,
  ): number | null {
    if (!valvesPerCyl || !cylinders) return null;
    return valvesPerCyl * cylinders;
  }

  async save(
    payload: Omit<Engine, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snap = this.engines();
        this.engines.update((list) =>
          list.map((e) => (e.id === editingId ? { ...e, ...payload } : e)),
        );
        const { error } = await this.db.supabase
          .from("engines")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.engines.set(snap);
          throw error;
        }
        return {
          ok: true,
          message: `✅ تم تحديث المحرك ${payload.engine_code}`,
        };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("engines")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.engines.update((list) =>
          [...list, inserted].sort((a, b) =>
            a.engine_code.localeCompare(b.engine_code),
          ),
        );
        return { ok: true, message: `✅ تم حفظ المحرك ${payload.engine_code}` };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحفظ: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    const eng = await this.getById(id);
    if (!eng) return { ok: false, message: "❌ المحرك غير موجود" };

    const { count } = await this.db.supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("engine_id", id);

    let msg = `⚠️ حذف المحرك: ${eng.engine_code} — ${eng.engine_name}\n`;
    if ((count || 0) > 0)
      msg += `\nتحذير: هناك ${count} سيارة مرتبطة!\nستفقد السيارات بيانات المحرك.\n`;
    msg += "\nهل أنت متأكد؟";
    if (!confirm(msg)) return { ok: false, message: "" };

    const snap = this.engines();
    this.engines.update((list) => list.filter((e) => e.id !== id));
    try {
      if ((count || 0) > 0) {
        await this.db.supabase
          .from("vehicles")
          .update({ engine_id: null })
          .eq("engine_id", id);
      }
      const { error } = await this.db.supabase
        .from("engines")
        .delete()
        .eq("id", id);
      if (error) {
        this.engines.set(snap);
        throw error;
      }
      return { ok: true, message: `✅ تم حذف المحرك ${eng.engine_code}` };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  exportToExcel(): void {
    this.excel.export(this.engines(), EXCEL_COLS, "المحركات", "المحركات");
  }
}
