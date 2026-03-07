import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { SearchableSelectComponent } from "../../shared/components/searchable-select/searchable-select.component";
import { DataTableComponent } from "../../shared/components/data-table/data-table.component";
import { CatalogService } from "src/app/core/services/catalog.service";
import {
  SelectOption,
  TableColumn,
  TableAction,
  ActionEvent,
  CatalogPart,
} from "src/app/core/models";

@Component({
  selector: "app-catalog",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    DataTableComponent,
  ],
  templateUrl: "./catalog.component.html",
  styleUrl: "./catalog.component.css",
})
export class CatalogComponent implements OnInit {
  // ── Expose service signals directly to template ──
  parts = this.svc.parts;
  vehicles = this.svc.vehicles;
  loading = this.svc.loading;
  saving = this.svc.saving;

  // ── Component-local UI state ──
  editingId = signal<string | null>(null);
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // ── Excel import state ──
  importLoading = signal(false);
  importResult = signal<{
    imported: number;
    errors: string[];
    skipped: number;
  } | null>(null);

  // ── Filters ──
  searchTerm = signal("");
  filterCategory = signal("");
  filterPlate = signal("");
  filterActive = signal<"all" | "active" | "inactive">("all");

  // ── Static options ──
  readonly categoryOptions: SelectOption[] = this.svc.categories.map((c) => ({
    value: c,
    label: c,
  }));

  readonly unitOptions: SelectOption[] = [
    { value: "عدد", label: "عدد" },
    { value: "متر", label: "متر" },
    { value: "كيلوجرام", label: "كيلوجرام" },
    { value: "لتر", label: "لتر" },
    { value: "علبة", label: "علبة" },
    { value: "كرتونة", label: "كرتونة" },
    { value: "طقم", label: "طقم" },
    { value: "قطعة", label: "قطعة" },
  ];

  // ── Computed select options ──
  vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v) => ({
      value: v.plate_number,
      label: v.plate_number,
      sublabel: v.department || undefined,
    })),
  );

  platesInData = computed<SelectOption[]>(() => {
    const plates = new Set<string>();
    this.parts().forEach((p) =>
      (p.compatible_plates || []).forEach((pl) => plates.add(pl)),
    );
    return [...plates].sort().map((p) => ({ value: p, label: p }));
  });

  // ── Filtered list ──
  filteredParts = computed(() => {
    let list = this.parts();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (p) =>
          (p.part_name || "").toLowerCase().includes(term) ||
          (p.part_number || "").toLowerCase().includes(term) ||
          (p.serial_number || "").toLowerCase().includes(term) ||
          (p.notes || "").toLowerCase().includes(term),
      );
    if (this.filterCategory())
      list = list.filter((p) => p.category === this.filterCategory());
    if (this.filterPlate())
      list = list.filter((p) =>
        (p.compatible_plates || []).includes(this.filterPlate()),
      );
    if (this.filterActive() === "active")
      list = list.filter((p) => p.is_active !== false);
    if (this.filterActive() === "inactive")
      list = list.filter((p) => p.is_active === false);
    return list;
  });

  // ── Category colors (mirror original) ──
  readonly categoryColors: Record<string, string> = {
    زيوت: "#f59e0b",
    فلاتر: "#3b82f6",
    كهرباء: "#eab308",
    تكييف: "#06b6d4",
    فرامل: "#ef4444",
    إطارات: "#8b5cf6",
    محرك: "#10b981",
    "ناقل حركة": "#f97316",
    هيكل: "#64748b",
    أخرى: "#94a3b8",
  };

  // ── Table ──
  tableColumns: TableColumn[] = [
    {
      key: "part_name",
      label: "اسم القطعة",
      sortable: false,
      renderHtml: (row) => `<strong>${row.part_name}</strong>`,
    },
    {
      key: "part_number",
      label: "رقم القطعة",
      sortable: false,
      renderHtml: (row) =>
        row.part_number
          ? `<code class="code-badge">${row.part_number}</code>`
          : "—",
    },
    {
      key: "serial_number",
      label: "Serial Number",
      sortable: false,
      renderHtml: (row) =>
        row.serial_number
          ? `<code class="code-badge">${row.serial_number}</code>`
          : "—",
    },
    {
      key: "category",
      label: "التصنيف",
      sortable: false,
      renderHtml: (row) => this.renderCategoryBadge(row.category),
    },
    { key: "unit", label: "الوحدة", sortable: false },
    {
      key: "compatible_plates",
      label: "السيارات المتوافقة",
      sortable: false,
      renderHtml: (row) => this.renderPlatesBadges(row.compatible_plates),
    },
    {
      key: "is_active",
      label: "الحالة",
      sortable: false,
      renderHtml: (row) =>
        row.is_active !== false
          ? '<span class="badge badge-success">نشط</span>'
          : '<span class="badge badge-secondary">موقوف</span>',
    },
    {
      key: "notes",
      label: "ملاحظات",
      sortable: false,
      render: (row) => row.notes || "—",
    },
  ];

  tableActions: TableAction[] = [
    { id: "edit", label: "تعديل", icon: "✏️", color: "edit" },
    // { id: "toggleActive", label: "تفعيل/إيقاف", icon: "⏸️", color: "view" },
    { id: "delete", label: "حذف", icon: "🗑️", color: "delete" },
  ];

  // ── Form ──
  form: FormGroup;

  constructor(
    public svc: CatalogService,
    private fb: FormBuilder,
  ) {
    this.form = this.buildForm();
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  // ── Form builder ──────────────────────────────────────────────────────────

  buildForm(): FormGroup {
    return this.fb.group({
      part_name: ["", Validators.required],
      part_number: [null],
      serial_number: [null],
      category: [null],
      unit: ["عدد", Validators.required],
      compatible_plates: [[]], // string[]
      notes: [null],
      is_active: [true],
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast("⚠️ يرجى تعبئة جميع الحقول المطلوبة", "warning");
      return;
    }

    const raw = this.form.value;
    const payload: Omit<CatalogPart, "id" | "created_at"> = {
      part_name: raw.part_name.trim(),
      part_number: raw.part_number?.trim() || null,
      serial_number: raw.serial_number?.trim() || null,
      category: raw.category || null,
      unit: raw.unit || "عدد",
      compatible_plates: Array.isArray(raw.compatible_plates)
        ? raw.compatible_plates
        : [],
      notes: raw.notes?.trim() || null,
      is_active: raw.is_active !== false,
    };

    const result = await this.svc.save(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  async edit(id: string) {
    const part = await this.svc.getById(id);
    if (!part) {
      this.showToast("❌ فشل تحميل القطعة", "error");
      return;
    }

    this.editingId.set(id);
    this.form.patchValue({
      part_name: part.part_name,
      part_number: part.part_number || "",
      serial_number: part.serial_number || "",
      category: part.category || null,
      unit: part.unit || "عدد",
      compatible_plates: part.compatible_plates || [],
      notes: part.notes || "",
      is_active: part.is_active !== false,
    });

    document
      .getElementById("catalogFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const result = await this.svc.delete(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async toggleActive(id: string) {
    const part = this.parts().find((p) => p.id === id);
    if (!part) return;
    const result = await this.svc.toggleActive(id, part.is_active !== false);
    this.showToast(result.message, result.ok ? "success" : "error");
  }

  // ── Table action dispatcher ───────────────────────────────────────────────

  onTableAction(event: ActionEvent) {
    if (event.action === "edit") this.edit(event.row.id);
    if (event.action === "delete") this.delete(event.row.id);
    if (event.action === "toggleActive") this.toggleActive(event.row.id);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
  }

  resetFilters() {
    this.searchTerm.set("");
    this.filterCategory.set("");
    this.filterPlate.set("");
    this.filterActive.set("all");
  }

  // ── Excel ──────────────────────────────────────────────────────────────────

  exportToExcel() {
    this.svc.exportToExcel(this.filteredParts());
  }
  downloadTemplate() {
    this.svc.downloadImportTemplate();
  }

  async onImportFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.importLoading.set(true);
    this.importResult.set(null);
    const result = await this.svc.importFromExcel(file);
    this.importResult.set(result);
    this.importLoading.set(false);
    if (result.imported > 0) {
      this.showToast(`✅ تم استيراد ${result.imported} قطعة بنجاح`, "success");
    } else if (result.errors.length) {
      this.showToast(`⚠️ ${result.errors[0]}`, "warning");
    }
    (event.target as HTMLInputElement).value = "";
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  renderCategoryBadge(category: string | null | undefined): string {
    if (!category) return "—";
    const color = this.categoryColors[category] || "#64748b";
    return `<span class="cat-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:5px;padding:0px 10px">${category}</span>`;
  }

  renderPlatesBadges(plates: string[] | null | undefined): string {
    if (!plates?.length) return '<span class="muted-text">عامة</span>';
    return plates
      .map((pl) => `<span class="badge badge-department">${pl}</span>`)
      .join(" ");
  }

  get isEditing(): boolean {
    return !!this.editingId();
  }

  showToast(
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
