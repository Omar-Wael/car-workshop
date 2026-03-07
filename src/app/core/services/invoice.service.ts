import { Injectable, signal, computed } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { ExcelService } from "./excel.service";
import { ExcelColumn, Invoice, InvoiceVehicle } from "../models";

export type InvoiceStatus = Invoice["status"];
export type InvoiceRelatedType = NonNullable<Invoice["related_type"]>;

// ── Label maps ────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  advance_issued: "سلفة مسحوبة",
  invoice_received: "فاتورة مستلمة",
  settled: "تم السداد",
};

export const STATUS_BADGE_CLASS: Record<InvoiceStatus, string> = {
  advance_issued: "badge-warning",
  invoice_received: "badge-info",
  settled: "badge-success",
};

export const TYPE_LABELS: Record<InvoiceRelatedType, string> = {
  overhaul: "عمرة",
  maintenance: "صيانة",
  spare_parts: "طلب صرف",
  other: "أخرى",
};
// ── Excel columns ─────────────────────────────────────────────────────────────

const INVOICE_EXCEL_COLS: ExcelColumn[] = [
  { key: "invoice_number", header: "رقم الفاتورة", width: 20 },
  {
    key: "status",
    header: "الحالة",
    width: 18,
    exportFn: (row) => STATUS_LABELS[row.status as InvoiceStatus] || row.status,
  },
  { key: "advance_amount", header: "مبلغ السلفة", width: 16, type: "number" },
  { key: "advance_date", header: "تاريخ السلفة", width: 16, type: "date" },
  { key: "advance_purpose", header: "الغرض", width: 30 },
  { key: "advance_recipient", header: "المستلم", width: 20 },
  { key: "invoice_amount", header: "مبلغ الفاتورة", width: 16, type: "number" },
  {
    key: "invoice_received_date",
    header: "تاريخ استلام الفاتورة",
    width: 22,
    type: "date",
  },
  {
    key: "settlement_amount",
    header: "مبلغ السداد",
    width: 16,
    type: "number",
  },
  { key: "settlement_date", header: "تاريخ السداد", width: 16, type: "date" },
  { key: "difference_amount", header: "الفرق", width: 14, type: "number" },
  {
    key: "total_vehicles_cost",
    header: "إجمالي تكلفة السيارات",
    width: 22,
    type: "number",
  },
  {
    key: "vehicles",
    header: "السيارات",
    width: 30,
    exportFn: (row) =>
      ((row.vehicles as InvoiceVehicle[]) || [])
        .map((v) => v.vehicle_plate)
        .join("، "),
  },
  {
    key: "related_type",
    header: "نوع الربط",
    width: 16,
    exportFn: (row) =>
      row.related_type
        ? TYPE_LABELS[row.related_type as InvoiceRelatedType] ||
          row.related_type
        : "",
  },
  { key: "related_reference", header: "مرجع الربط", width: 20 },
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
export class InvoiceService {
  // ── Signals ──
  invoices = signal<Invoice[]>([]);
  vehicles = signal<{ plate_number: string; department?: string | null }[]>([]);
  references = signal<string[]>([]); // populated on demand for related_type
  loading = signal(false);
  saving = signal(false);

  // ── Static options ──
  readonly statusOptions = Object.entries(STATUS_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));
  readonly typeOptions = Object.entries(TYPE_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  // ── Computed summary stats ──
  totalCount = computed(() => this.invoices().length);
  pendingCount = computed(
    () => this.invoices().filter((i) => i.status !== "settled").length,
  );
  settledCount = computed(
    () => this.invoices().filter((i) => i.status === "settled").length,
  );

  constructor(
    private db: SupabaseService,
    private excel: ExcelService,
  ) {}

  // ── Load ──────────────────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    await Promise.all([this.loadInvoices(), this.loadVehicles()]);
  }

  async loadInvoices(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.invoices.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل الفواتير:", err);
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

  /** Load reference values for related_type dropdown (overhauls, maintenance, spare_parts) */
  async loadReferences(type: InvoiceRelatedType): Promise<void> {
    this.references.set([]);
    if (type === "other") return;
    try {
      let data: any[] = [];
      if (type === "overhaul") {
        const res = await this.db.supabase
          .from("overhauls")
          .select("vehicle_plate")
          .order("created_at", { ascending: false });
        data = res.data || [];
        this.references.set([
          ...new Set(data.map((d: any) => d.vehicle_plate).filter(Boolean)),
        ]);
      } else if (type === "maintenance") {
        const res = await this.db.supabase
          .from("maintenance")
          .select("vehicle_plate")
          .order("created_at", { ascending: false });
        data = res.data || [];
        this.references.set([
          ...new Set(data.map((d: any) => d.vehicle_plate).filter(Boolean)),
        ]);
      } else if (type === "spare_parts") {
        const res = await this.db.supabase
          .from("spare_parts")
          .select("request_number")
          .order("created_at", { ascending: false });
        data = res.data || [];
        this.references.set(
          data.map((d: any) => d.request_number).filter(Boolean),
        );
      }
    } catch (err) {
      console.error("خطأ في تحميل المراجع:", err);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async save(
    payload: Omit<Invoice, "id" | "created_at">,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    try {
      if (editingId) {
        const snapshot = this.invoices();
        this.invoices.update((list) =>
          list.map((inv) =>
            inv.id === editingId ? { ...inv, ...payload } : inv,
          ),
        );
        const { error } = await this.db.supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          this.invoices.set(snapshot);
          throw error;
        }
        return {
          ok: true,
          message: `✅ تم تحديث الفاتورة ${payload.invoice_number}`,
        };
      } else {
        // Duplicate check
        const { data: existing } = await this.db.supabase
          .from("invoices")
          .select("id")
          .eq("invoice_number", payload.invoice_number);
        if (existing?.length)
          return { ok: false, message: "⚠️ رقم الفاتورة موجود بالفعل" };

        const { data: inserted, error } = await this.db.supabase
          .from("invoices")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        this.invoices.update((list) => [inserted, ...list]);
        return {
          ok: true,
          message: `✅ تم إضافة الفاتورة ${payload.invoice_number}`,
        };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل حفظ الفاتورة: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    if (!confirm("حذف هذه الفاتورة؟")) return { ok: false, message: "" };
    const snapshot = this.invoices();
    this.invoices.update((list) => list.filter((inv) => inv.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("invoices")
        .delete()
        .eq("id", id);
      if (error) {
        this.invoices.set(snapshot);
        throw error;
      }
      return { ok: true, message: "✅ تم حذف الفاتورة" };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }

  async getById(id: string): Promise<Invoice | null> {
    const { data, error } = await this.db.supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  calcDifference(
    advanceAmount: number | null,
    settlementAmount: number | null,
  ): number | null {
    if (advanceAmount == null || settlementAmount == null) return null;
    return advanceAmount - settlementAmount;
  }

  calcTotalVehiclesCost(vehicles: InvoiceVehicle[]): number {
    return vehicles.reduce((sum, v) => sum + (v.cost || 0), 0);
  }

  statusLabel(status: InvoiceStatus): string {
    return STATUS_LABELS[status] || status;
  }

  statusBadgeClass(status: InvoiceStatus): string {
    return STATUS_BADGE_CLASS[status] || "badge-secondary";
  }

  typeLabel(type: InvoiceRelatedType | null | undefined): string {
    if (!type) return "—";
    return TYPE_LABELS[type] || type;
  }

  // ── Excel ─────────────────────────────────────────────────────────────────

  exportToExcel(rows?: Invoice[]): void {
    this.excel.export(
      rows ?? this.invoices(),
      INVOICE_EXCEL_COLS,
      "سجلات_الفواتير",
      "الفواتير",
    );
  }
}
