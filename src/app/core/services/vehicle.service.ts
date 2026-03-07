import { ExcelColumn, Vehicle, Engine } from "./../models/index";
import { Injectable, signal, computed } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";

// ── Excel column definitions ──────────────────────────────────────────────

export const VEHICLE_EXCEL_COLUMNS: ExcelColumn[] = [
  { key: "plate_number", header: "رقم اللوحة", width: 18 },
  { key: "type", header: "النوع", width: 18 },
  { key: "brand", header: "الماركة", width: 18 },
  { key: "model", header: "الموديل", width: 18 },
  { key: "year", header: "سنة الصنع", width: 12, type: "number" },
  { key: "fuel_type", header: "نوع الوقود", width: 14 },
  { key: "department", header: "الإدارة", width: 20 },
  { key: "status", header: "الحالة", width: 22 },
  { key: "odometer_type", header: "نوع العداد", width: 16 },
  { key: "chassis_number", header: "رقم الشاسيه", width: 22 },
  { key: "engine_number", header: "رقم الموتور", width: 22 },
  {
    key: "engine_oil",
    header: "كمية زيت المحرك (لتر)",
    width: 22,
    type: "number",
  },
  { key: "engine_oil_type", header: "نوع زيت المحرك", width: 20 },
  {
    key: "transmission_oil",
    header: "كمية زيت الفتيس (لتر)",
    width: 22,
    type: "number",
  },
  { key: "transmission_oil_type", header: "نوع زيت الفتيس", width: 20 },
  {
    key: "oil_change_interval",
    header: "فترة تغيير الزيت",
    width: 20,
    type: "number",
  },
  {
    key: "oil_filter_interval",
    header: "فترة تغيير فلتر الزيت",
    width: 22,
    type: "number",
  },
  {
    key: "fuel_filter_interval",
    header: "فترة تغيير فلتر الوقود",
    width: 22,
    type: "number",
  },
  {
    key: "air_filter_interval",
    header: "فترة تغيير فلتر الهواء",
    width: 22,
    type: "number",
  },
  { key: "notes", header: "ملاحظات", width: 30 },
  { key: "created_at", header: "تاريخ الإضافة", width: 18, type: "date" },
];

@Injectable({
  providedIn: "root",
})
export class VehicleService {
  // ── State (signals exposed to components) ──
  vehicles = signal<Vehicle[]>([]);
  engines = signal<Engine[]>([]);
  departments = signal<string[]>([]);
  typeOptions = signal<string[]>([]);
  brandOptions = signal<string[]>([]);
  modelOptions = signal<string[]>([]);
  loading = signal(false);
  saving = signal(false);

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  // ── Loaders ──────────────────────────────────────────────────────────────

  async loadAll() {
    await Promise.all([
      this.loadVehicles(),
      this.loadEngines(),
      this.loadDropdownOptions(),
    ]);
  }

  async loadVehicles() {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.vehicles.set(data || []);
    } finally {
      this.loading.set(false);
    }
  }

  async loadEngines() {
    try {
      const { data } = await this.db.supabase
        .from("engines")
        .select(
          "id,engine_code,engine_name,brand,displacement_l,cylinders,cam_type,timing_system,fuel_system,power_hp,torque_nm,compression_ratio,firing_order,block_material,oil_capacity_l,created_at",
        )
        .order("engine_code");
      this.engines.set(data || []);
    } catch {}
  }

  async loadDropdownOptions() {
    try {
      const { data } = await this.db.supabase
        .from("vehicles")
        .select("type,brand,model,department");
      if (data) {
        this.typeOptions.set([
          ...new Set(data.map((v: any) => v.type).filter(Boolean)),
        ]);
        this.brandOptions.set([
          ...new Set(data.map((v: any) => v.brand).filter(Boolean)),
        ]);
        this.modelOptions.set([
          ...new Set(data.map((v: any) => v.model).filter(Boolean)),
        ]);
        this.departments.set([
          ...new Set(data.map((v: any) => v.department).filter(Boolean)),
        ]);
      }
    } catch {}
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async save(
    vehicle: Omit<Vehicle, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      // Duplicate check
      const { data: existing } = await this.db.supabase
        .from("vehicles")
        .select("id")
        .eq("plate_number", vehicle.plate_number);
      const isDuplicate = existing?.some((v: any) => v.id !== editingId);
      if (isDuplicate)
        return { ok: false, message: "⚠️ رقم اللوحة موجود بالفعل" };

      if (editingId) {
        const snapshot = this.vehicles();
        this.vehicles.update((list) =>
          list.map((v) => (v.id === editingId ? { ...v, ...vehicle } : v)),
        );
        const { error } = await this.db.supabase
          .from("vehicles")
          .update(vehicle)
          .eq("id", editingId);
        if (error) {
          this.vehicles.set(snapshot);
          throw error;
        }
        this.loadDropdownOptions(); // fire-and-forget to refresh filter options
        return {
          ok: true,
          message: `✅ تم تحديث السيارة ${vehicle.plate_number}`,
        };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("vehicles")
          .insert([vehicle])
          .select()
          .single();
        if (error) throw error;
        this.vehicles.update((list) =>
          [...list, inserted].sort((a, b) =>
            (a.plate_number || "").localeCompare(b.plate_number || "", "ar"),
          ),
        );
        this.loadDropdownOptions();
        return {
          ok: true,
          message: `✅ تمت إضافة السيارة ${vehicle.plate_number}`,
        };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل حفظ السيارة: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    try {
      const { data: vehicle } = await this.db.supabase
        .from("vehicles")
        .select("plate_number")
        .eq("id", id)
        .single();
      if (!vehicle) return { ok: false, message: "❌ السيارة غير موجودة" };

      const [sp, mt, ov] = await Promise.all([
        this.db.supabase
          .from("spare_parts")
          .select("id", { count: "exact", head: true })
          .eq("vehicle_plate", vehicle.plate_number),
        this.db.supabase
          .from("maintenance")
          .select("id", { count: "exact", head: true })
          .eq("vehicle_plate", vehicle.plate_number),
        this.db.supabase
          .from("overhauls")
          .select("id", { count: "exact", head: true })
          .eq("vehicle_plate", vehicle.plate_number),
      ]);

      const msg = `⚠️ حذف السيارة ${vehicle.plate_number}\n\nالبيانات المرتبطة:\n• قطع غيار: ${sp.count || 0}\n• صيانة: ${mt.count || 0}\n• عمرات: ${ov.count || 0}\n\nسيتم حذف جميع البيانات المرتبطة!\nهل أنت متأكد؟`;
      if (!confirm(msg)) return { ok: false, message: "" };

      // Optimistic remove after user confirmed
      const snap = this.vehicles();
      this.vehicles.update((list) => list.filter((v) => v.id !== id));

      try {
        await Promise.all([
          this.db.supabase
            .from("spare_parts")
            .delete()
            .eq("vehicle_plate", vehicle.plate_number),
          this.db.supabase
            .from("maintenance")
            .delete()
            .eq("vehicle_plate", vehicle.plate_number),
          this.db.supabase
            .from("overhauls")
            .delete()
            .eq("vehicle_plate", vehicle.plate_number),
          this.db.supabase.from("vehicles").delete().eq("id", id),
        ]);
      } catch (delErr) {
        this.vehicles.set(snap); // roll back
        throw delErr;
      }
      this.loadDropdownOptions();
      return {
        ok: true,
        message: `✅ تم حذف السيارة ${vehicle.plate_number} وجميع بياناتها`,
      };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  async getById(id: string): Promise<Vehicle | null> {
    const { data, error } = await this.db.supabase
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  }

  async getEngineById(id: string): Promise<Engine | null> {
    const { data, error } = await this.db.supabase
      .from("engines")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  }

  // ── Excel export ─────────────────────────────────────────────────────────

  exportToExcel(vehicles?: Vehicle[]) {
    const data = vehicles ?? this.vehicles();
    this.excel.export(data, VEHICLE_EXCEL_COLUMNS, "vehicles", "المركبات");
  }

  downloadImportTemplate() {
    // Template uses only the importable columns (no created_at)
    const importCols = VEHICLE_EXCEL_COLUMNS.filter(
      (c) => c.key !== "created_at",
    );
    this.excel.downloadTemplate(importCols, "vehicles_template");
  }

  // ── Excel import ─────────────────────────────────────────────────────────

  async importFromExcel(
    file: File,
  ): Promise<{ imported: number; errors: string[]; skipped: number }> {
    const importCols = VEHICLE_EXCEL_COLUMNS.filter(
      (c) => c.key !== "created_at",
    );
    const result = await this.excel.import<Partial<Vehicle>>(file, importCols);

    if (result.errors.length && !result.data.length) {
      return { imported: 0, errors: result.errors, skipped: result.skipped };
    }

    const errors: string[] = [...result.errors];
    let imported = 0;

    for (const row of result.data) {
      if (!row.plate_number) {
        errors.push(`صف مفقود رقم اللوحة — تم التخطي`);
        continue;
      }

      // Check duplicate
      const { data: existing } = await this.db.supabase
        .from("vehicles")
        .select("id")
        .eq("plate_number", row.plate_number);
      if (existing?.length) {
        errors.push(`رقم اللوحة ${row.plate_number} موجود بالفعل — تم التخطي`);
        continue;
      }

      const vehicle: Omit<Vehicle, "id" | "created_at"> = {
        plate_number: row.plate_number || "",
        type: row.type || "",
        brand: row.brand || "",
        model: row.model || "",
        year: row.year ?? null,
        fuel_type: row.fuel_type || "",
        department: row.department || "",
        status: row.status || "نشطة",
        odometer_type: row.odometer_type || "kilometers",
        chassis_number: row.chassis_number || null,
        engine_number: row.engine_number || null,
        engine_oil: row.engine_oil ?? null,
        engine_oil_type: row.engine_oil_type || null,
        transmission_oil: row.transmission_oil ?? null,
        transmission_oil_type: row.transmission_oil_type || null,
        oil_change_interval: row.oil_change_interval ?? null,
        oil_filter_interval: row.oil_filter_interval ?? null,
        fuel_filter_interval: row.fuel_filter_interval ?? null,
        air_filter_interval: row.air_filter_interval ?? null,
        notes: row.notes || null,
      };

      const { error } = await this.db.supabase
        .from("vehicles")
        .insert([vehicle]);
      if (error) {
        errors.push(`فشل إضافة ${row.plate_number}: ${error.message}`);
      } else {
        imported++;
      }
    }

    if (imported > 0) {
      await Promise.all([this.loadVehicles(), this.loadDropdownOptions()]);
    }

    return { imported, errors, skipped: result.skipped };
  }
}
