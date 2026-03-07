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
import {
  Vehicle,
  Engine,
  SelectOption,
  TableColumn,
  TableAction,
  ActionEvent,
} from "src/app/core/models/index";
import { VehicleService } from "src/app/core/services/vehicle.service";

@Component({
  selector: "app-vehicles",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    DataTableComponent,
  ],
  templateUrl: "./vehicles.component.html",
  styleUrl: "./vehicles.component.css",
})
export class VehiclesComponent implements OnInit {
  // ── Expose service signals directly to template ──
  vehicles = this.svc.vehicles;
  engines = this.svc.engines;
  departments = this.svc.departments;
  loading = this.svc.loading;
  saving = this.svc.saving;

  // ── Component-local state ──
  editingId = signal<string | null>(null);

  showDetailsModal = signal(false);
  selectedVehicle = signal<Vehicle | null>(null);
  selectedEngine = signal<Engine | null>(null);

  // ── Import state ──
  importLoading = signal(false);
  importResult = signal<{
    imported: number;
    errors: string[];
    skipped: number;
  } | null>(null);

  // ── Toast ──
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // ── Filters ──
  filterYear = signal("");
  filterBrand = signal("");
  filterType = signal("");
  filterDepartment = signal("");
  filterFuel = signal("");
  filterStatus = signal("");
  searchTerm = signal("");

  // ── Static options ──
  readonly fuelTypes = ["بنزين", "ديزل", "غاز طبيعي", "كهرباء", "هجين"];
  readonly statusOptions = [
    { value: "نشطة", label: "✅ نشطة" },
    { value: "متوقفة للإصلاح", label: "🔧 متوقفة للإصلاح" },
    { value: "عمرة", label: "🔨 عمرة" },
    { value: "متوقفة للترخيص", label: "📄 متوقفة للترخيص" },
    { value: "متوقفة للتكهين", label: "⛔ متوقفة للتكهين" },
    { value: "في الانتظار", label: "⏳ في الانتظار" },
  ];

  // ── Computed SelectOption arrays ──
  typeSelectOptions = computed<SelectOption[]>(() =>
    this.svc.typeOptions().map((v: string) => ({ value: v, label: v })),
  );
  brandSelectOptions = computed<SelectOption[]>(() =>
    this.svc.brandOptions().map((v: string) => ({ value: v, label: v })),
  );
  modelSelectOptions = computed<SelectOption[]>(() =>
    this.svc.modelOptions().map((v: string) => ({ value: v, label: v })),
  );
  departmentSelectOptions = computed<SelectOption[]>(() =>
    this.departments().map((v: string) => ({ value: v, label: v })),
  );
  engineSelectOptions = computed<SelectOption[]>(() =>
    this.engines().map((e: any) => ({
      value: e.id,
      label: `${e.engine_code} — ${e.engine_name}`,
      sublabel: e.displacement_l
        ? `${e.displacement_l}L · ${e.cylinders ?? "?"} أسطوانة`
        : undefined,
    })),
  );
  fuelSelectOptions = computed<SelectOption[]>(() =>
    this.fuelTypes.map((f: string) => ({ value: f, label: f })),
  );
  statusSelectOptions = computed<SelectOption[]>(() =>
    this.statusOptions.map((s: SelectOption) => ({
      value: s.value,
      label: s.label,
    })),
  );
  odometerSelectOptions: SelectOption[] = [
    { value: "kilometers", label: "كيلومترات" },
    { value: "hours", label: "ساعات تشغيل" },
  ];
  yearSelectOptions = computed<SelectOption[]>(() =>
    this.uniqueYears().map((y: any) => ({
      value: String(y),
      label: String(y),
    })),
  );

  // ── Computed filtered list ──
  filteredVehicles = computed(() => {
    let list = this.vehicles();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (v: Vehicle) =>
          v.plate_number.toLowerCase().includes(term) ||
          (v.brand || "").toLowerCase().includes(term) ||
          (v.model || "").toLowerCase().includes(term) ||
          (v.department || "").toLowerCase().includes(term) ||
          (v.type || "").toLowerCase().includes(term),
      );
    if (this.filterYear())
      list = list.filter((v: Vehicle) => String(v.year) === this.filterYear());
    if (this.filterBrand())
      list = list.filter((v: Vehicle) => v.brand === this.filterBrand());
    if (this.filterType())
      list = list.filter((v: Vehicle) => v.type === this.filterType());
    if (this.filterDepartment())
      list = list.filter(
        (v: Vehicle) => v.department === this.filterDepartment(),
      );
    if (this.filterFuel())
      list = list.filter((v: Vehicle) => v.fuel_type === this.filterFuel());
    if (this.filterStatus())
      list = list.filter((v: Vehicle) => v.status === this.filterStatus());
    return list;
  });

  uniqueYears = computed(() =>
    [
      ...new Set(
        this.vehicles()
          .map((v: Vehicle) => v.year)
          .filter(Boolean),
      ),
    ].sort((a, b) => ((b as number) ?? 0) - ((a as number) ?? 0)),
  );

  // ── Table ──
  tableColumns: TableColumn[] = [
    {
      key: "plate_number",
      label: "رقم اللوحة",
      sortable: false,
      cellClass: () => "cell-plate",
    },
    { key: "type", label: "النوع", sortable: false },
    { key: "brand", label: "الماركة", sortable: false },
    { key: "model", label: "الموديل", sortable: false },
    { key: "year", label: "السنة", sortable: false, align: "center" },
    {
      key: "department",
      label: "الإدارة",
      sortable: false,
      renderHtml: (row) =>
        `<span class="badge badge-dept">${row.department || "—"}</span>`,
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
      label: "تاريخ الإضافة",
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

  // ── Form ──
  form: FormGroup;

  constructor(
    public svc: VehicleService,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      plate_number: ["", Validators.required],
      type: ["", Validators.required],
      brand: ["", Validators.required],
      model: ["", Validators.required],
      year: [
        null,
        [Validators.required, Validators.min(1900), Validators.max(2030)],
      ],
      chassis_number: [null],
      engine_number: [null],
      fuel_type: ["", Validators.required],
      department: ["", Validators.required],
      odometer_type: ["kilometers", Validators.required],
      status: ["نشطة", Validators.required],
      engine_id: [null],
      engine_oil: [null],
      engine_oil_type: [null],
      transmission_oil: [null],
      transmission_oil_type: [null],
      oil_change_interval: [null],
      oil_filter_interval: [null],
      fuel_filter_interval: [null],
      air_filter_interval: [null],
      notes: [null],
    });
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const result = await this.svc.save(this.form.value, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "warning");
    if (result.ok) this.resetForm();
  }

  // ── View details ────────────────────────────────────────────────────────

  async viewDetails(id: string) {
    const v = await this.svc.getById(id);
    if (!v) return;
    this.selectedVehicle.set(v);
    this.selectedEngine.set(
      v.engine_id ? await this.svc.getEngineById(v.engine_id) : null,
    );
    this.showDetailsModal.set(true);
  }

  // ── Edit ────────────────────────────────────────────────────────────────

  async edit(id: string) {
    const v = await this.svc.getById(id);
    if (!v) return;
    this.editingId.set(id);
    this.form.patchValue(v);
    document
      .getElementById("vehicleFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  async delete(id: string) {
    const result = await this.svc.delete(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  // ── Table action dispatcher ──────────────────────────────────────────────

  onTableAction(event: ActionEvent) {
    if (event.action === "view") this.viewDetails(event.row.id);
    if (event.action === "edit") this.edit(event.row.id);
    if (event.action === "delete") this.delete(event.row.id);
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  resetForm() {
    this.form.reset({ odometer_type: "kilometers", status: "نشطة" });
    this.editingId.set(null);
  }

  closeModal() {
    this.showDetailsModal.set(false);
    this.selectedVehicle.set(null);
    this.selectedEngine.set(null);
  }

  resetFilters() {
    this.filterYear.set("");
    this.filterBrand.set("");
    this.filterType.set("");
    this.filterDepartment.set("");
    this.filterFuel.set("");
    this.filterStatus.set("");
    this.searchTerm.set("");
  }

  // ── Excel ────────────────────────────────────────────────────────────────

  exportToExcel() {
    this.svc.exportToExcel(this.filteredVehicles());
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
      this.showToast(`✅ تم استيراد ${result.imported} سيارة بنجاح`, "success");
    } else if (result.errors.length) {
      this.showToast(`⚠️ ${result.errors[0]}`, "warning");
    }
    (event.target as HTMLInputElement).value = "";
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      نشطة: "badge-success",
      "متوقفة للإصلاح": "badge-warning",
      عمرة: "badge-info",
      "متوقفة للترخيص": "badge-secondary",
      "متوقفة للتكهين": "badge-danger",
      "في الانتظار": "badge-pending",
    };
    return map[status] || "badge-secondary";
  }

  get intervalUnit(): string {
    return this.form.get("odometer_type")?.value === "hours" ? "ساعة" : "كم";
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
