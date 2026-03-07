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
import {
  TableColumn,
  TableAction,
  ActionEvent,
  SelectOption,
  SparePart,
  CatalogPart,
  Technician,
  SparePartItem,
  Attachment,
  Vehicle,
} from "src/app/core/models";
import { SparePartService } from "src/app/core/services/spare-part.service";

@Component({
  selector: "app-spare-parts",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    DataTableComponent,
  ],
  templateUrl: "./spare-parts.component.html",
  styleUrl: "./spare-parts.component.css",
})
export class SparePartsComponent implements OnInit {
  // ── Expose service signals directly to template ──
  spareParts = this.svc.spareParts;
  vehicles = this.svc.vehicles;
  catalogParts = this.svc.catalogParts;
  technicians = this.svc.technicians;
  loading = this.svc.loading;
  saving = this.svc.saving;

  // ── Component-local UI state ──
  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedRecord = signal<SparePart | null>(null);
  showImageModal = signal(false);
  zoomedImage = signal<string>("");
  _selectedDepartment = signal("");
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

  // ── Computed SelectOption arrays (derived from service signals) ──
  vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v: any) => ({
      value: v.plate_number,
      label: v.plate_number,
      sublabel: v.department || undefined,
    })),
  );

  departmentOptions = computed<SelectOption[]>(() => {
    const depts = [
      ...new Set(
        this.vehicles()
          .map((v: any) => v.department)
          .filter(Boolean),
      ),
    ].sort();
    return depts.map((d: any) => ({ value: d, label: d }));
  });

  technicianOptions = computed<SelectOption[]>(() =>
    this.technicians().map((t: Technician) => ({
      value: t.full_name,
      label: t.full_name,
    })),
  );

  catalogOptions = computed<SelectOption[]>(() =>
    this.catalogParts()
      .filter((p: CatalogPart) => p.is_active !== false)
      .map((p: CatalogPart) => ({
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

  platesInData = computed<SelectOption[]>(() => {
    const plates = [
      ...new Set(
        this.spareParts()
          .map((sp: SparePart) => sp.vehicle_plate)
          .filter(Boolean),
      ),
    ].sort();
    return plates.map((p: any) => ({ value: p, label: p }));
  });

  techniciansInData = computed<SelectOption[]>(() => {
    const names = new Set<string>();
    this.spareParts().forEach((sp: SparePart) => {
      sp.technician_name?.split(",").forEach((n) => {
        const t = n.trim();
        if (t) names.add(t);
      });
    });
    return [...names].sort().map((n) => ({ value: n, label: n }));
  });

  departmentsInData = computed<SelectOption[]>(() => {
    const depts = [
      ...new Set(
        this.spareParts()
          .map((sp: SparePart) => sp.department)
          .filter(Boolean),
      ),
    ].sort();
    return depts.map((d: any) => ({ value: d, label: d }));
  });

  filteredSpareParts = computed(() => {
    let list = this.spareParts();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (sp: SparePart) =>
          sp.request_number.toLowerCase().includes(term) ||
          sp.vehicle_plate?.toLowerCase().includes(term) ||
          (sp.department || "").toLowerCase().includes(term) ||
          (sp.technician_name || "").toLowerCase().includes(term),
      );
    if (this.filterPlate())
      list = list.filter(
        (sp: SparePart) => sp.vehicle_plate === this.filterPlate(),
      );
    if (this.filterDepartment())
      list = list.filter(
        (sp: SparePart) => sp.department === this.filterDepartment(),
      );
    if (this.filterStatus())
      list = list.filter((sp: SparePart) => sp.status === this.filterStatus());
    if (this.filterTechnician()) {
      const tech = this.filterTechnician();
      list = list.filter((sp: SparePart) =>
        sp.technician_name
          ?.split(",")
          .map((t: string) => t.trim())
          .includes(tech),
      );
    }
    if (this.filterFrom())
      list = list.filter(
        (sp: SparePart) => (sp.created_at || "") >= this.filterFrom(),
      );
    if (this.filterTo())
      list = list.filter(
        (sp: SparePart) =>
          (sp.created_at || "") <= this.filterTo() + "T23:59:59",
      );
    return list;
  });

  // ── Table ──
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
      sortable: false,
      renderHtml: (row) =>
        `<span class="badge ${this.getStatusClass(row.status)}">${row.status || "—"}</span>`,
    },
    {
      key: "created_at",
      label: "التاريخ",
      sortable: false,
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

  form: FormGroup;

  get itemsArray(): FormArray {
    return this.form.get("items") as FormArray;
  }

  constructor(
    public svc: SparePartService,
    private fb: FormBuilder,
  ) {
    this.form = this.buildForm();
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  // ── Form builders ──────────────────────────────────────────────────────────

  buildForm(): FormGroup {
    return this.fb.group({
      request_number: ["", Validators.required],
      vehicle_plate: ["", Validators.required],
      status: ["جديد", Validators.required],
      purchase_request_number: [null],
      odometer_reading: [null],
      request_date: [new Date().toISOString().split("T")[0]],
      technician_name: [[]],
      items: this.fb.array([this.buildItem()]),
      attachments: [[]],
    });
  }

  buildItem(): FormGroup {
    return this.fb.group({
      catalog_id: [null],
      name: ["", Validators.required],
      quantity: [null, [Validators.required, Validators.min(0)]],
      unit: ["عدد", Validators.required],
      last_date: [null],
      with_sample: [false],
      condition: ["جديد"],
      part_number: [null],
      serial_number: [null],
    });
  }

  // ── Item management ────────────────────────────────────────────────────────

  addItem() {
    this.itemsArray.push(this.buildItem());
  }

  removeItem(index: number) {
    if (this.itemsArray.length > 1) this.itemsArray.removeAt(index);
  }

  onCatalogSelect(index: number, catalogId: string) {
    const part = this.catalogParts().find(
      (p: CatalogPart) => p.id === catalogId,
    );
    if (!part) return;
    this.itemsArray.at(index).patchValue({
      name: part.part_name,
      unit: part.unit || "عدد",
      part_number: part.part_number || null,
      serial_number: part.serial_number || null,
    });
  }

  onVehiclePlateChange(plate: string) {
    const vehicle = this.vehicles().find((v: any) => v.plate_number === plate);
    this._selectedDepartment.set(vehicle?.department || "");
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast("⚠️ يرجى تعبئة جميع الحقول المطلوبة", "warning");
      return;
    }
    const raw = this.form.value;

    const items: SparePartItem[] = raw.items.map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      last_date: item.last_date || null,
      with_sample: item.with_sample || false,
      condition: item.condition || "جديد",
      catalog_part_name: item.catalog_id
        ? this.catalogParts().find((p: CatalogPart) => p.id === item.catalog_id)
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

    const result = await this.svc.save(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "warning");
    if (result.ok) this.resetForm();
  }

  // ── CRUD — all delegate to service ────────────────────────────────────────

  async viewDetails(id: string) {
    const sp = await this.svc.getById(id);
    if (!sp) {
      this.showToast("❌ فشل عرض التفاصيل", "error");
      return;
    }
    this.selectedRecord.set(sp);
    this.showDetailsModal.set(true);
  }

  async edit(id: string) {
    const sp = await this.svc.getById(id);
    if (!sp) {
      this.showToast("❌ فشل تحميل بيانات الطلب", "error");
      return;
    }

    this.editingId.set(id);
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

    this.onVehiclePlateChange(sp.vehicle_plate);

    (sp.items || []).forEach((item: any) => {
      const partNumberMatch =
        item.notes?.match(/رقم القطعة: ([^|]+)/)?.[1]?.trim() || null;
      const serialMatch =
        item.notes?.match(/Serial: (.+)/)?.[1]?.trim() || null;
      const catalogPart = item.catalog_part_name
        ? this.catalogParts().find(
            (p: CatalogPart) => p.part_name === item.catalog_part_name,
          ) || null
        : null;

      this.itemsArray.push(
        this.fb.group({
          catalog_id: [catalogPart?.id || null],
          name: [item.name, Validators.required],
          quantity: [item.quantity, [Validators.required, Validators.min(0)]],
          unit: [item.unit || "عدد", Validators.required],
          last_date: [item.last_date || null],
          with_sample: [item.with_sample || false],
          condition: [item.condition || "جديد"],
          part_number: [partNumberMatch],
          serial_number: [serialMatch],
        }),
      );
    });

    if (!this.itemsArray.length) this.addItem();
    document
      .getElementById("sparePartsFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async delete(id: string) {
    const result = await this.svc.delete(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  onTableAction(event: ActionEvent) {
    if (event.action === "view") this.viewDetails(event.row.id);
    if (event.action === "edit") this.edit(event.row.id);
    if (event.action === "delete") this.delete(event.row.id);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
    this._selectedDepartment.set("");
  }

  closeModal() {
    this.showDetailsModal.set(false);
    this.selectedRecord.set(null);
  }

  resetFilters() {
    this.filterPlate.set("");
    this.filterDepartment.set("");
    this.filterTechnician.set("");
    this.filterStatus.set("");
    this.filterFrom.set("");
    this.filterTo.set("");
    this.searchTerm.set("");
  }

  // ── Image attachments ──────────────────────────────────────────────────────

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    const current: Attachment[] = this.form.get("attachments")?.value || [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        this.form.patchValue({
          attachments: [...current, { name: file.name, data }],
        });
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

  // ── Excel — all delegate to service ───────────────────────────────────────

  exportSummary() {
    this.svc.exportSummary(this.filteredSpareParts());
  }
  exportDetailed() {
    this.svc.exportDetailed(this.filteredSpareParts());
  }
  exportFull() {
    this.svc.exportFull(this.filteredSpareParts());
  }
  downloadTemplate() {
    this.svc.downloadImportTemplate();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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
    return preview + (row.items.length > 2 ? ` +${row.items.length - 2}` : "");
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
