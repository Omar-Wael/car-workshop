import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from "@angular/forms";
import { SupabaseService } from "../../core/services/supabase.service";
import { SearchableSelectComponent } from "../../shared/components/searchable-select/searchable-select.component";
import { DataTableComponent } from "../../shared/components/data-table/data-table.component";
import { TableColumn, TableAction, ActionEvent, SelectOption, SparePart, CatalogPart, Technician, SparePartItem, Attachment } from "src/app/core/models";

@Component({
  selector: "app-spare-parts",
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SearchableSelectComponent, DataTableComponent],
  templateUrl: "./spare-parts.component.html",
  styleUrl: "./spare-parts.component.css",
})
export class SparePartsComponent implements OnInit {
  // ── Data ──
  spareParts = signal<SparePart[]>([]);
  vehicles = signal<{ plate_number: string; department: string }[]>([]);
  catalogParts = signal<CatalogPart[]>([]);
  technicians = signal<Technician[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);

  // ── Modal ──
  showDetailsModal = signal(false);
  selectedRecord = signal<SparePart | null>(null);
  showImageModal = signal(false);
  zoomedImage = signal<string>("");

  // ── Toast ──
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // ── Filters ──
  filterPlate = signal("");
  filterDepartment = signal("");
  filterTechnician = signal("");
  filterStatus = signal("");
  filterFrom = signal("");
  filterTo = signal("");
  searchTerm = signal("");

  // ── Static options ──
  readonly statusOptions: SelectOption[] = [
    { value: "جديد", label: "🆕 جديد" },
    { value: "في المخزن", label: "🏪 في المخزن" },
    { value: "طلب شراء", label: "🛒 طلب شراء" },
    { value: "تحت التوريد", label: "🚚 تحت التوريد" },
    { value: "تم الاستلام", label: "✅ تم الاستلام" },
    { value: "مغلق", label: "🔒 مغلق" },
  ];

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

  // ── Computed SelectOption arrays ──
  vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v) => ({
      value: v.plate_number,
      label: v.plate_number,
      sublabel: v.department || undefined,
    })),
  );

  departmentOptions = computed<SelectOption[]>(() => {
    const depts = [
      ...new Set(
        this.vehicles()
          .map((v) => v.department)
          .filter(Boolean),
      ),
    ].sort();
    return depts.map((d) => ({ value: d, label: d }));
  });

  technicianOptions = computed<SelectOption[]>(() =>
    this.technicians().map((t) => ({ value: t.full_name, label: t.full_name })),
  );

  catalogOptions = computed<SelectOption[]>(() =>
    this.catalogParts()
      .filter((p) => p.is_active !== false)
      .map((p) => ({
        value: p.id,
        label: p.part_name,
        sublabel:
          [
            p.part_number ? `[${p.part_number}]` : "",
            p.serial_number ? `SN:${p.serial_number}` : "",
            p.category ? `(${p.category})` : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      })),
  );

  // ── Computed: plates present in data (for filter) ──
  platesInData = computed<SelectOption[]>(() => {
    const plates = [
      ...new Set(
        this.spareParts()
          .map((sp) => sp.vehicle_plate)
          .filter((p): p is string => Boolean(p)),
      ),
    ].sort();
    return plates.map((p) => ({ value: p, label: p }));
  });

  techniciansInData = computed<SelectOption[]>(() => {
    const names = new Set<string>();
    this.spareParts().forEach((sp) => {
      if (sp.technician_name) {
        sp.technician_name.split(",").forEach((n) => {
          const t = n.trim();
          if (t) names.add(t);
        });
      }
    });
    return [...names].sort().map((n) => ({ value: n, label: n }));
  });

  // ── Computed filtered list ──
  filteredSpareParts = computed(() => {
    let list = this.spareParts();

    const term = this.searchTerm().toLowerCase();
    if (term) {
      list = list.filter(
        (sp) =>
          sp.request_number.toLowerCase().includes(term) ||
          sp.vehicle_plate?.toLowerCase().includes(term) ||
          (sp.department || "").toLowerCase().includes(term) ||
          (sp.technician_name || "").toLowerCase().includes(term),
      );
    }
    if (this.filterPlate())
      list = list.filter((sp) => sp.vehicle_plate === this.filterPlate());
    if (this.filterDepartment())
      list = list.filter((sp) => sp.department === this.filterDepartment());
    if (this.filterStatus())
      list = list.filter((sp) => sp.status === this.filterStatus());
    if (this.filterTechnician()) {
      const tech = this.filterTechnician();
      list = list.filter((sp) =>
        sp.technician_name
          ?.split(",")
          .map((t) => t.trim())
          .includes(tech),
      );
    }
    if (this.filterFrom())
      list = list.filter((sp) => (sp.created_at || "") >= this.filterFrom());
    if (this.filterTo())
      list = list.filter(
        (sp) => (sp.created_at || "") <= this.filterTo() + "T23:59:59",
      );

    return list;
  });

  // ── Form ──
  form: FormGroup;

  get itemsArray(): FormArray {
    return this.form.get("items") as FormArray;
  }

  // ── Table columns ──
  tableColumns: TableColumn[] = [
    {
      key: "request_number",
      label: "رقم الطلب",
      sortable: false,
      cellClass: () => "cell-strong",
    },
    { key: "vehicle_plate", label: "السيارة", sortable: false },
    { key: "department", label: "الإدارة", sortable: false },
    {
      key: "technician_name",
      label: "الفني/ون",
      sortable: false,
      renderHtml: (row) => this.renderTechnicianBadges(row.technician_name),
    },
    {
      key: "items",
      label: "عدد الأصناف",
      align: "center",
      renderHtml: (row) =>
        `<span class="badge badge-info">${row.items?.length ?? 0}</span>`,
    },
    {
      key: "items_preview",
      label: "الأصناف",
      sortable: false,
      render: (row) => this.getItemsPreview(row),
    },
    {
      key: "status",
      label: "الحالة",
      sortable: true,
      renderHtml: (row) =>
        `<span class="badge ${this.getStatusClass(row.status)}">${row.status || "—"}</span>`,
    },
    {
      key: "created_at",
      label: "التاريخ",
      sortable: true,
      render: (row) =>
        row.created_at
          ? new Date(row.created_at).toLocaleDateString("ar-EG")
          : "—",
    },
  ];

  tableActions: TableAction[] = [
    { id: "view", label: "عرض التفاصيل", icon: "👁️", color: "view" },
    { id: "edit", label: "تعديل", icon: "✏️", color: "edit" },
    { id: "delete", label: "حذف", icon: "🗑️", color: "delete" },
  ];

  constructor(
    private db: SupabaseService,
    private fb: FormBuilder,
  ) {
    this.form = this.buildForm();
  }

  async ngOnInit() {
    await Promise.all([
      this.loadSpareParts(),
      this.loadVehicles(),
      this.loadCatalog(),
      this.loadTechnicians(),
    ]);
  }

  // ── Form builder ──────────────────────────────────────────────────────────

  buildForm(): FormGroup {
    return this.fb.group({
      request_number: ["", Validators.required],
      vehicle_plate: ["", Validators.required],
      status: ["جديد", Validators.required],
      purchase_request_number: [null],
      odometer_reading: [null],
      request_date: [new Date().toISOString().split("T")[0]],
      technician_name: [[]], // multi — stored as string[] then joined
      items: this.fb.array([this.buildItem()]),
      attachments: [[]], // Attachment[]
    });
  }

  buildItem(): FormGroup {
    return this.fb.group({
      catalog_id: [null], // transient — used to auto-fill name/unit
      name: ["", Validators.required],
      quantity: [null, [Validators.required, Validators.min(0)]],
      unit: ["عدد", Validators.required],
      last_date: [null],
      with_sample: [false],
      condition: ["جديد"],
      part_number: [null], // transient — stored in notes
      serial_number: [null], // transient — stored in notes
    });
  }

  // ── Item management ───────────────────────────────────────────────────────

  addItem() {
    this.itemsArray.push(this.buildItem());
  }

  removeItem(index: number) {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  onCatalogSelect(index: number, catalogId: string) {
    const part = this.catalogParts().find((p) => p.id === catalogId);
    if (!part) return;
    const itemGroup = this.itemsArray.at(index);
    itemGroup.patchValue({
      name: part.part_name,
      unit: part.unit || "عدد",
      part_number: part.part_number || null,
      serial_number: part.serial_number || null,
    });
  }

  // ── Load data ─────────────────────────────────────────────────────────────

  async loadSpareParts() {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("spare_parts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      this.spareParts.set(data || []);
    } catch (err: any) {
      this.showToast(
        "❌ خطأ في تحميل طلبات قطع الغيار: " + err.message,
        "error",
      );
    } finally {
      this.loading.set(false);
    }
  }

  async loadVehicles() {
    try {
      const { data } = await this.db.supabase
        .from("vehicles")
        .select("plate_number, department")
        .order("plate_number");
      this.vehicles.set(data || []);
    } catch {}
  }

  async loadCatalog() {
    try {
      const { data } = await this.db.supabase
        .from("spare_parts_catalog")
        .select(
          "id, part_name, part_number, serial_number, unit, category, is_active",
        )
        .order("part_name");
      this.catalogParts.set(data || []);
    } catch {}
  }

  async loadTechnicians() {
    try {
      const { data } = await this.db.supabase
        .from("technicians")
        .select("id, full_name, status, created_at")
        .eq("status", "active")
        .order("full_name");
      this.technicians.set(data || []);
    } catch {}
  }

  // ── Vehicle plate → auto-fill department ─────────────────────────────────

  onVehiclePlateChange(plate: string) {
    const vehicle = this.vehicles().find((v) => v.plate_number === plate);
    // department is display-only, not a form field, handled in template
    if (vehicle) {
      this._selectedDepartment.set(vehicle.department || "");
    } else {
      this._selectedDepartment.set("");
    }
  }

  _selectedDepartment = signal("");

  // ── Submit ────────────────────────────────────────────────────────────────

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast("⚠️ يرجى تعبئة جميع الحقول المطلوبة", "warning");
      return;
    }

    const raw = this.form.value;

    // Build items — convert part_number/serial_number into notes
    const items: SparePartItem[] = raw.items.map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      last_date: item.last_date || null,
      with_sample: item.with_sample || false,
      condition: item.condition || "جديد",
      catalog_part_name: item.catalog_id
        ? this.catalogParts().find((p) => p.id === item.catalog_id)
            ?.part_name || null
        : null,
      notes:
        [
          item.part_number ? `رقم القطعة: ${item.part_number}` : "",
          item.serial_number ? `Serial: ${item.serial_number}` : "",
        ]
          .filter(Boolean)
          .join(" | ") || null,
    }));

    const payload: Omit<SparePart, "id" | "created_at"> = {
      request_number: raw.request_number,
      vehicle_plate: raw.vehicle_plate,
      department: this._selectedDepartment() || null,
      technician_name: Array.isArray(raw.technician_name)
        ? raw.technician_name.join(", ")
        : raw.technician_name || null,
      status: raw.status,
      purchase_request_number: raw.purchase_request_number || null,
      odometer_reading: raw.odometer_reading || null,
      request_date: raw.request_date || new Date().toISOString(),
      items,
      attachments: raw.attachments || [],
    };

    this.saving.set(true);
    try {
      if (this.editingId()) {
        const { error } = await this.db.supabase
          .from("spare_parts")
          .update(payload)
          .eq("id", this.editingId());
        if (error) throw error;
        this.showToast(`✅ تم تحديث الطلب ${payload.request_number}`);
      } else {
        // Duplicate check
        const { data: existing } = await this.db.supabase
          .from("spare_parts")
          .select("id")
          .eq("request_number", payload.request_number);
        if (existing?.length) {
          this.showToast("⚠️ رقم الطلب موجود بالفعل", "warning");
          return;
        }
        const { error } = await this.db.supabase
          .from("spare_parts")
          .insert([payload]);
        if (error) throw error;
        this.showToast(`✅ تم إضافة الطلب رقم ${payload.request_number}`);
      }

      this.resetForm();
      await this.loadSpareParts();
    } catch (err: any) {
      this.showToast("❌ فشل حفظ الطلب: " + err.message, "error");
    } finally {
      this.saving.set(false);
    }
  }

  // ── View details ──────────────────────────────────────────────────────────

  async viewDetails(id: string) {
    try {
      const { data, error } = await this.db.supabase
        .from("spare_parts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      this.selectedRecord.set(data);
      this.showDetailsModal.set(true);
    } catch {
      this.showToast("❌ فشل عرض التفاصيل", "error");
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  async edit(id: string) {
    try {
      const { data: sp, error } = await this.db.supabase
        .from("spare_parts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;

      this.editingId.set(id);

      // Reset items array
      while (this.itemsArray.length) this.itemsArray.removeAt(0);

      const techNames = sp.technician_name
        ? sp.technician_name
            .split(",")
            .map((n: string) => n.trim())
            .filter(Boolean)
        : [];

      this.form.patchValue({
        request_number: sp.request_number,
        vehicle_plate: sp.vehicle_plate,
        status: sp.status,
        purchase_request_number: sp.purchase_request_number,
        odometer_reading: sp.odometer_reading,
        request_date: sp.request_date
          ? new Date(sp.request_date).toISOString().split("T")[0]
          : "",
        technician_name: techNames,
        attachments: sp.attachments || [],
      });

      // Auto-fill department
      this.onVehiclePlateChange(sp.vehicle_plate);

      // Rebuild items
      (sp.items || []).forEach(
        (
          item: SparePartItem & { catalog_part_name?: string; notes?: string },
        ) => {
          const partNumberMatch =
            item.notes?.match(/رقم القطعة: ([^|]+)/)?.[1]?.trim() || null;
          const serialMatch =
            item.notes?.match(/Serial: (.+)/)?.[1]?.trim() || null;
          const catalogPart = item.catalog_part_name
            ? this.catalogParts().find(
                (p) => p.part_name === item.catalog_part_name,
              ) || null
            : null;

          this.itemsArray.push(
            this.fb.group({
              catalog_id: [catalogPart?.id || null],
              name: [item.name, Validators.required],
              quantity: [
                item.quantity,
                [Validators.required, Validators.min(0)],
              ],
              unit: [item.unit || "عدد", Validators.required],
              last_date: [item.last_date || null],
              with_sample: [item.with_sample || false],
              condition: [item.condition || "جديد"],
              part_number: [partNumberMatch],
              serial_number: [serialMatch],
            }),
          );
        },
      );

      if (!this.itemsArray.length) this.addItem();

      document
        .getElementById("sparePartsFormTop")
        ?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      this.showToast("❌ فشل تحميل بيانات الطلب", "error");
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    try {
      const { error } = await this.db.supabase
        .from("spare_parts")
        .delete()
        .eq("id", id);
      if (error) throw error;
      this.showToast("✅ تم حذف الطلب");
      await this.loadSpareParts();
    } catch (err: any) {
      this.showToast("❌ فشل الحذف: " + err.message, "error");
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
    this._selectedDepartment.set("");
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  resetFilters() {
    this.filterPlate.set("");
    this.filterDepartment.set("");
    this.filterTechnician.set("");
    this.filterStatus.set("");
    this.filterFrom.set("");
    this.filterTo.set("");
    this.searchTerm.set("");
  }

  // ── Image attachments ─────────────────────────────────────────────────────

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    const current: Attachment[] = this.form.get("attachments")?.value || [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const updated = [...current, { name: file.name, data }];
        this.form.patchValue({ attachments: updated });
      };
      reader.readAsDataURL(file);
    });
  }

  removeAttachment(index: number) {
    const current: Attachment[] = [
      ...(this.form.get("attachments")?.value || []),
    ];
    current.splice(index, 1);
    this.form.patchValue({ attachments: current });
  }

  openZoom(data: string) {
    this.zoomedImage.set(data);
    this.showImageModal.set(true);
  }

  // ── Table actions ─────────────────────────────────────────────────────────

  onTableAction(event: ActionEvent) {
    const { action, row } = event;
    if (action === "view") this.viewDetails(row.id);
    if (action === "edit") this.edit(row.id);
    if (action === "delete") this.delete(row.id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getStatusClass(status: string): string {
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

  renderTechnicianBadges(technicianName: string | null): string {
    if (!technicianName) return "—";
    return technicianName
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<span class="badge badge-tech">${t}</span>`)
      .join(" ");
  }

  getItemsPreview(row: SparePart): string {
    if (!row.items?.length) return "—";
    const preview = row.items
      .slice(0, 2)
      .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
      .join("، ");
    const more = row.items.length > 2 ? `+ (${row.items.length - 2} أصناف أخرى)` : "";
    return preview + more;
  }

  get isEditing(): boolean {
    return !!this.editingId();
  }

  get currentAttachments(): Attachment[] {
    return this.form.get("attachments")?.value || [];
  }

  showToast(
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 4000);
  }

  trackByIndex(i: number) {
    return i;
  }
}
