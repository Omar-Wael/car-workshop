import {
  ExcelColumn,
  SparePartItem,
  SparePart,
  CatalogPart,
  Technician,
} from "./../models/index";
import { Injectable, signal, computed } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";

// ── Excel columns for the summary sheet (one row per request) ──
export const SPARE_PARTS_EXCEL_COLUMNS: ExcelColumn[] = [
  { key: "request_number", header: "رقم الطلب", width: 18 },
  { key: "vehicle_plate", header: "رقم اللوحة", width: 16 },
  { key: "department", header: "الإدارة", width: 20 },
  { key: "technician_name", header: "الفني/ون", width: 24 },
  { key: "status", header: "الحالة", width: 20 },
  { key: "purchase_request_number", header: "رقم طلب الشراء", width: 20 },
  {
    key: "odometer_reading",
    header: "قراءة العداد",
    width: 16,
    type: "number",
  },
  {
    key: "items_count",
    header: "عدد الأصناف",
    width: 14,
    exportFn: (row: SparePart) => row.items?.length ?? 0,
  },
  {
    key: "items_summary",
    header: "الأصناف",
    width: 40,
    exportFn: (row: SparePart) =>
      row.items
        ?.map((i) => `${i.name} (${i.quantity} ${i.unit})`)
        .join(" | ") ?? "",
  },
  { key: "request_date", header: "تاريخ الطلب", width: 16, type: "date" },
  { key: "created_at", header: "تاريخ الإنشاء", width: 16, type: "date" },
];

// Items-level export (one row per item)
export const SPARE_PART_ITEMS_EXCEL_COLUMNS: ExcelColumn[] = [
  { key: "request_number", header: "رقم الطلب", width: 18 },
  { key: "vehicle_plate", header: "رقم اللوحة", width: 16 },
  { key: "department", header: "الإدارة", width: 20 },
  { key: "name", header: "اسم الصنف", width: 26 },
  { key: "quantity", header: "الكمية", width: 12, type: "number" },
  { key: "unit", header: "الوحدة", width: 12 },
  { key: "condition", header: "الحالة", width: 22 },
  { key: "with_sample", header: "مع عينة", width: 12, type: "boolean" },
  { key: "last_date", header: "آخر تاريخ صرف", width: 16, type: "date" },
  { key: "notes", header: "رقم القطعة / Serial", width: 28 },
];

@Injectable({
  providedIn: "root",
})
export class SparePartService {
  spareParts = signal<SparePart[]>([]);
  vehicles = signal<{ plate_number: string; department: string }[]>([]);
  catalogParts = signal<CatalogPart[]>([]);
  technicians = signal<Technician[]>([]);
  loading = signal(false);
  saving = signal(false);

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  // ── Loaders ──────────────────────────────────────────────────────────────

  async loadAll() {
    await Promise.all([
      this.loadSpareParts(),
      this.loadVehicles(),
      this.loadCatalog(),
      this.loadTechnicians(),
    ]);
  }

  async loadSpareParts() {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("spare_parts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.spareParts.set(data || []);
    } finally {
      this.loading.set(false);
    }
  }

  async loadVehicles() {
    try {
      const { data } = await this.db.supabase
        .from("vehicles")
        .select("plate_number,department")
        .order("plate_number");
      this.vehicles.set(data || []);
    } catch {}
  }

  async loadCatalog() {
    try {
      const { data } = await this.db.supabase
        .from("spare_parts_catalog")
        .select(
          "id,part_name,part_number,serial_number,unit,category,is_active",
        )
        .order("part_name");
      this.catalogParts.set(data || []);
    } catch {}
  }

  async loadTechnicians() {
    try {
      const { data } = await this.db.supabase
        .from("technicians")
        .select("id,full_name,status,created_at")
        .eq("status", "active")
        .order("full_name");
      this.technicians.set(data || []);
    } catch {}
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async save(
    payload: Omit<SparePart, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snapshot = this.spareParts();
        this.spareParts.update((list) =>
          list.map((sp) => (sp.id === editingId ? { ...sp, ...payload } : sp)),
        );
        const { error } = await this.db.supabase
          .from("spare_parts")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.spareParts.set(snapshot);
          throw error;
        }
        return {
          ok: true,
          message: `✅ تم تحديث الطلب ${payload.request_number}`,
        };
      } else {
        const { data: existing } = await this.db.supabase
          .from("spare_parts")
          .select("id")
          .eq("request_number", payload.request_number);
        if (existing?.length)
          return { ok: false, message: "⚠️ رقم الطلب موجود بالفعل" };

        const { data: inserted, error } = await this.db.supabase
          .from("spare_parts")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.spareParts.update((list) => [inserted, ...list]);
        return {
          ok: true,
          message: `✅ تم إضافة الطلب رقم ${payload.request_number}`,
        };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل حفظ الطلب: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟"))
      return { ok: false, message: "" };
    const snapshot = this.spareParts();
    this.spareParts.update((list) => list.filter((sp) => sp.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("spare_parts")
        .delete()
        .eq("id", id);
      if (error) {
        this.spareParts.set(snapshot);
        throw error;
      }
      return { ok: true, message: "✅ تم حذف الطلب" };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  async getById(id: string): Promise<SparePart | null> {
    const { data, error } = await this.db.supabase
      .from("spare_parts")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  }

  // ── Excel export ─────────────────────────────────────────────────────────

  /** Export summary — one row per request */
  exportSummary(data?: SparePart[]) {
    this.excel.export(
      data ?? this.spareParts(),
      SPARE_PARTS_EXCEL_COLUMNS,
      "spare_parts_summary",
      "ملخص الطلبات",
    );
  }

  /** Export detailed — one row per item */
  exportDetailed(data?: SparePart[]) {
    const src = data ?? this.spareParts();
    const rows: any[] = [];
    src.forEach((sp) => {
      (sp.items || []).forEach((item) => {
        rows.push({
          request_number: sp.request_number,
          vehicle_plate: sp.vehicle_plate,
          department: sp.department,
          ...item,
        });
      });
    });
    this.excel.export(
      rows,
      SPARE_PART_ITEMS_EXCEL_COLUMNS,
      "spare_parts_items",
      "تفاصيل الأصناف",
    );
  }

  /** Export both sheets in one workbook */
  exportFull(data?: SparePart[]) {
    const src = data ?? this.spareParts();
    const itemRows: any[] = [];
    src.forEach((sp) => {
      (sp.items || []).forEach((item) => {
        itemRows.push({
          request_number: sp.request_number,
          vehicle_plate: sp.vehicle_plate,
          department: sp.department,
          ...item,
        });
      });
    });
    this.excel.exportMultiSheet(
      [
        {
          data: src,
          columns: SPARE_PARTS_EXCEL_COLUMNS,
          sheetName: "ملخص الطلبات",
        },
        {
          data: itemRows,
          columns: SPARE_PART_ITEMS_EXCEL_COLUMNS,
          sheetName: "تفاصيل الأصناف",
        },
      ],
      "spare_parts_full",
    );
  }

  downloadImportTemplate() {
    const cols: ExcelColumn[] = [
      { key: "request_number", header: "رقم الطلب", width: 18 },
      { key: "vehicle_plate", header: "رقم اللوحة", width: 16 },
      { key: "status", header: "الحالة", width: 20 },
      { key: "purchase_request_number", header: "رقم طلب الشراء", width: 20 },
      { key: "technician_name", header: "الفني/ون", width: 24 },
      { key: "odometer_reading", header: "قراءة العداد", width: 16 },
    ];
    this.excel.downloadTemplate(cols, "spare_parts_template");
  }
}
