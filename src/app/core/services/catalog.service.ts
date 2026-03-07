import { Injectable, signal } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";
import { CatalogPart, ExcelColumn } from "../models";

// ── Excel column definitions ──────────────────────────────────────────────────

const CATALOG_EXCEL_COLUMNS: ExcelColumn[] = [
  { key: "part_name", header: "اسم القطعة", width: 30 },
  { key: "part_number", header: "رقم القطعة", width: 20 },
  { key: "serial_number", header: "Serial Number", width: 20 },
  { key: "category", header: "التصنيف", width: 18 },
  { key: "unit", header: "الوحدة", width: 14 },
  {
    key: "compatible_plates",
    header: "السيارات المتوافقة",
    width: 30,
    exportFn: (row) => (row.compatible_plates || []).join("، "),
    importFn: (cell: string) =>
      cell
        ? cell
            .split(/[,،]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
  },
  { key: "notes", header: "ملاحظات", width: 30 },
  {
    key: "is_active",
    header: "نشط",
    width: 10,
    type: "boolean",
    exportFn: (row) => (row.is_active !== false ? "نعم" : "لا"),
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

@Injectable({
  providedIn: "root",
})
export class CatalogService {
  // ── Signals ──
  parts = signal<CatalogPart[]>([]);
  vehicles = signal<{ plate_number: string; department?: string | null }[]>([]);
  loading = signal(false);
  saving = signal(false);

  readonly categories = [
    "زيوت",
    "فلاتر",
    "كهرباء",
    "تكييف",
    "فرامل",
    "إطارات",
    "محرك",
    "ناقل حركة",
    "هيكل",
    "أخرى",
  ];

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  // ── Load all ──────────────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    await Promise.all([this.loadParts(), this.loadVehicles()]);
  }

  async loadParts(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("spare_parts_catalog")
        .select("*")
        .order("part_name");
      if (error) throw error;
      this.parts.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل الكتالوج:", err);
    } finally {
      this.loading.set(false);
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

  // ── Get by ID ─────────────────────────────────────────────────────────────

  async getById(id: string): Promise<CatalogPart | null> {
    try {
      const { data, error } = await this.db.supabase
        .from("spare_parts_catalog")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  }

  // ── Save (insert or update) ───────────────────────────────────────────────

  async save(
    payload: Omit<CatalogPart, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    const data = { ...payload, updated_at: new Date().toISOString() };

    if (editingId) {
      // Optimistic update for edit
      const snapshot = this.parts();
      this.parts.update((list) =>
        list.map((p) => (p.id === editingId ? { ...p, ...data } : p)),
      );
      try {
        const { error } = await this.db.supabase
          .from("spare_parts_catalog")
          .update(data)
          .eq("id", editingId);
        if (error) throw error;
        return {
          ok: true,
          message: `✅ تم تحديث القطعة: ${payload.part_name}`,
        };
      } catch (err: any) {
        this.parts.set(snapshot);
        return { ok: false, message: "❌ فشل الحفظ: " + err.message };
      } finally {
        this.saving.set(false);
      }
    } else {
      // Insert — need real DB row (id, created_at), so refetch after
      try {
        const { data: inserted, error } = await this.db.supabase
          .from("spare_parts_catalog")
          .insert([data])
          .select()
          .single();
        if (error) throw error;
        // Append the real inserted row (with id + created_at) to signal
        this.parts.update((list) =>
          [...list, inserted].sort((a, b) =>
            (a.part_name || "").localeCompare(b.part_name || "", "ar"),
          ),
        );
        return {
          ok: true,
          message: `✅ تم إضافة القطعة: ${payload.part_name}`,
        };
      } catch (err: any) {
        return { ok: false, message: "❌ فشل الحفظ: " + err.message };
      } finally {
        this.saving.set(false);
      }
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    if (!confirm("حذف هذه القطعة من الكتالوج؟"))
      return { ok: false, message: "" };
    // Snapshot for rollback
    const snapshot = this.parts();
    // Optimistic remove
    this.parts.update((list) => list.filter((p) => p.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("spare_parts_catalog")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { ok: true, message: "✅ تم حذف القطعة" };
    } catch (err: any) {
      this.parts.set(snapshot); // Roll back
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async toggleActive(
    id: string,
    current: boolean,
  ): Promise<{ ok: boolean; message: string }> {
    // Optimistic update — flip immediately so the table re-renders without
    // waiting for the network round-trip.
    this.parts.update((list) =>
      list.map((p) => (p.id === id ? { ...p, is_active: !current } : p)),
    );

    try {
      const { error } = await this.db.supabase
        .from("spare_parts_catalog")
        .update({ is_active: !current, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return {
        ok: true,
        message: current ? "⏸️ تم إيقاف القطعة" : "▶️ تم تفعيل القطعة",
      };
    } catch (err: any) {
      // Roll back on failure
      this.parts.update((list) =>
        list.map((p) => (p.id === id ? { ...p, is_active: current } : p)),
      );
      return { ok: false, message: "❌ فشل تغيير الحالة: " + err.message };
    }
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  exportToExcel(parts?: CatalogPart[]): void {
    this.excel.export(
      parts ?? this.parts(),
      CATALOG_EXCEL_COLUMNS,
      "كتالوج_قطع_الغيار",
      "الكتالوج",
    );
  }

  downloadImportTemplate(): void {
    this.excel.downloadTemplate(
      CATALOG_EXCEL_COLUMNS,
      "نموذج_استيراد_الكتالوج",
    );
  }

  async importFromExcel(
    file: File,
  ): Promise<{ imported: number; errors: string[]; skipped: number }> {
    const result = await this.excel.import<CatalogPart>(
      file,
      CATALOG_EXCEL_COLUMNS,
      1,
    );
    if (!result.data.length) {
      return { imported: 0, errors: result.errors, skipped: result.skipped };
    }

    let imported = 0;
    const errors = [...result.errors];

    for (const row of result.data) {
      if (!row.part_name?.trim()) {
        errors.push(`صف مُتخطَّى: اسم القطعة مطلوب`);
        continue;
      }
      try {
        const { error } = await this.db.supabase
          .from("spare_parts_catalog")
          .insert([
            {
              part_name: row.part_name.trim(),
              part_number: row.part_number || null,
              serial_number: row.serial_number || null,
              category: row.category || null,
              unit: row.unit || "عدد",
              compatible_plates: Array.isArray(row.compatible_plates)
                ? row.compatible_plates
                : [],
              notes: row.notes || null,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
          ]);
        if (error) throw error;
        imported++;
      } catch (err: any) {
        errors.push(`خطأ في إضافة "${row.part_name}": ${err.message}`);
      }
    }

    if (imported > 0) await this.loadParts();
    return { imported, errors, skipped: result.skipped };
  }
}
