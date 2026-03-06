import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { SupabaseService } from "../../core/services/supabase.service";
import { Engine, Vehicle, SelectOption } from "src/app/core/models";
import { SearchableSelectComponent } from "src/app/shared/components/searchable-select/searchable-select.component";
import { DataTableComponent } from "src/app/shared/components/data-table/data-table.component";
import { TableColumn, TableAction, ActionEvent } from "src/app/core/models";

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
  // ── State ──
  vehicles = signal<Vehicle[]>([]);
  engines = signal<Engine[]>([]);
  departments = signal<string[]>([]);
  loading = signal(false);
  saving = signal(false);
  editingId = signal<string | null>(null);

  // ── Modal ──
  showDetailsModal = signal(false);
  selectedVehicle = signal<Vehicle | null>(null);
  selectedEngine = signal<Engine | null>(null);

  // ── Filters ──
  filterYear = signal("");
  filterBrand = signal("");
  filterType = signal("");
  filterDepartment = signal("");
  filterFuel = signal("");
  filterStatus = signal("");
  searchTerm = signal("");

  // ── Toast ──
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // ── Dropdown options (dynamic from DB) ──
  typeOptions = signal<string[]>([]);
  brandOptions = signal<string[]>([]);
  modelOptions = signal<string[]>([]);

  // ── SelectOption arrays for searchable-select ──
  typeSelectOptions = computed<SelectOption[]>(() =>
    this.typeOptions().map((v) => ({ value: v, label: v })),
  );
  brandSelectOptions = computed<SelectOption[]>(() =>
    this.brandOptions().map((v) => ({ value: v, label: v })),
  );
  modelSelectOptions = computed<SelectOption[]>(() =>
    this.modelOptions().map((v) => ({ value: v, label: v })),
  );
  departmentSelectOptions = computed<SelectOption[]>(() =>
    this.departments().map((v) => ({ value: v, label: v })),
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
    this.fuelTypes.map((f) => ({ value: f, label: f })),
  );
  statusSelectOptions = computed<SelectOption[]>(() =>
    this.statusOptions.map((s) => ({ value: s.value, label: s.label })),
  );
  odometerSelectOptions: SelectOption[] = [
    { value: "kilometers", label: "كيلومترات" },
    { value: "hours", label: "ساعات تشغيل" },
  ];
  yearSelectOptions = computed<SelectOption[]>(() =>
    this.uniqueYears().map((y) => ({ value: String(y), label: String(y) })),
  );

  form: FormGroup;

  // ── Table definition ──
  tableColumns: TableColumn[] = [
    {
      key: "plate_number",
      label: "رقم اللوحة",
      sortable: false,
      render: (row) => row.plate_number,
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
      renderHtml: (row) => {
        const cls = this.getStatusClass(row.status);
        return `<span class="badge ${cls}">${row.status || "—"}</span>`;
      },
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

  onTableAction(event: ActionEvent) {
    const { action, row } = event;
    if (action === "view") this.viewDetails(row.id);
    if (action === "edit") this.edit(row.id);
    if (action === "delete") this.delete(row.id);
  }

  readonly fuelTypes = ["بنزين", "ديزل", "غاز طبيعي", "كهرباء", "هجين"];
  readonly statusOptions = [
    { value: "نشطة", label: "✅ نشطة" },
    { value: "متوقفة للإصلاح", label: "🔧 متوقفة للإصلاح" },
    { value: "عمرة", label: "🔨 عمرة" },
    { value: "متوقفة للترخيص", label: "📄 متوقفة للترخيص" },
    { value: "متوقفة للتكهين", label: "⛔ متوقفة للتكهين" },
    { value: "في الانتظار", label: "⏳ في الانتظار" },
  ];

  // ── Computed filtered list ──
  filteredVehicles = computed(() => {
    let list = this.vehicles();
    const term = this.searchTerm().toLowerCase();
    if (term) {
      list = list.filter(
        (v) =>
          v.plate_number.toLowerCase().includes(term) ||
          (v.brand || "").toLowerCase().includes(term) ||
          (v.model || "").toLowerCase().includes(term) ||
          (v.department || "").toLowerCase().includes(term) ||
          (v.type || "").toLowerCase().includes(term),
      );
    }
    if (this.filterYear())
      list = list.filter((v) => String(v.year) === this.filterYear());
    if (this.filterBrand())
      list = list.filter((v) => v.brand === this.filterBrand());
    if (this.filterType())
      list = list.filter((v) => v.type === this.filterType());
    if (this.filterDepartment())
      list = list.filter((v) => v.department === this.filterDepartment());
    if (this.filterFuel())
      list = list.filter((v) => v.fuel_type === this.filterFuel());
    if (this.filterStatus())
      list = list.filter((v) => v.status === this.filterStatus());
    return list;
  });

  uniqueYears = computed(() =>
    [
      ...new Set(
        this.vehicles()
          .map((v) => v.year)
          .filter(Boolean),
      ),
    ].sort((a, b) => (b ?? 0) - (a ?? 0)),
  );

  constructor(
    private db: SupabaseService,
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
    } catch (err: any) {
      this.showToast("❌ خطأ في تحميل السيارات: " + err.message, "error");
    } finally {
      this.loading.set(false);
    }
  }

  async loadEngines() {
    try {
      const { data } = await this.db.supabase
        .from("engines")
        .select(
          "id, engine_code, engine_name, brand, displacement_l, cylinders, cam_type, timing_system, fuel_system, power_hp, torque_nm, compression_ratio, firing_order, block_material, oil_capacity_l, created_at",
        )
        .order("engine_code");
      this.engines.set(data || []);
    } catch {}
  }

  async loadDropdownOptions() {
    try {
      const { data } = await this.db.supabase
        .from("vehicles")
        .select("type, brand, model, department");
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

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const vehicle = this.form.value;

    try {
      // Check duplicate
      const { data: existing } = await this.db.supabase
        .from("vehicles")
        .select("id")
        .eq("plate_number", vehicle.plate_number);

      const isDuplicate = existing?.some((v: any) => v.id !== this.editingId());
      if (isDuplicate) {
        this.showToast("⚠️ رقم اللوحة موجود بالفعل", "warning");
        return;
      }

      if (this.editingId()) {
        const { error } = await this.db.supabase
          .from("vehicles")
          .update(vehicle)
          .eq("id", this.editingId());
        if (error) throw error;
        this.showToast(`✅ تم تحديث السيارة ${vehicle.plate_number}`);
      } else {
        const { error } = await this.db.supabase
          .from("vehicles")
          .insert([vehicle]);
        if (error) throw error;
        this.showToast(`✅ تمت إضافة السيارة ${vehicle.plate_number}`);
      }

      this.resetForm();
      await Promise.all([this.loadVehicles(), this.loadDropdownOptions()]);
    } catch (err: any) {
      this.showToast("❌ فشل حفظ السيارة: " + err.message, "error");
    } finally {
      this.saving.set(false);
    }
  }

  async viewDetails(id: string) {
    try {
      const { data: v, error } = await this.db.supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      this.selectedVehicle.set(v);

      if (v.engine_id) {
        const { data: eng } = await this.db.supabase
          .from("engines")
          .select("*")
          .eq("id", v.engine_id)
          .single();
        this.selectedEngine.set(eng);
      } else {
        this.selectedEngine.set(null);
      }
      this.showDetailsModal.set(true);
    } catch (err: any) {
      this.showToast("❌ فشل عرض التفاصيل", "error");
    }
  }

  async edit(id: string) {
    try {
      const { data: v, error } = await this.db.supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      this.editingId.set(id);
      this.form.patchValue(v);
      document
        .getElementById("vehicleFormTop")
        ?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      this.showToast("❌ فشل تحميل بيانات السيارة", "error");
    }
  }

  async delete(id: string) {
    try {
      const { data: vehicle } = await this.db.supabase
        .from("vehicles")
        .select("plate_number")
        .eq("id", id)
        .single();
      if (!vehicle) return;

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

      const msg = `⚠️ حذف السيارة ${vehicle.plate_number}\n\nالبيانات المرتبطة:\n• طلبات قطع غيار: ${sp.count || 0}\n• سجلات صيانة: ${mt.count || 0}\n• عمرات: ${ov.count || 0}\n\nسيتم حذف جميع البيانات المرتبطة!\n\nهل أنت متأكد؟`;
      if (!confirm(msg)) return;

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

      this.showToast(
        `✅ تم حذف السيارة ${vehicle.plate_number} وجميع بياناتها`,
      );
      await Promise.all([this.loadVehicles(), this.loadDropdownOptions()]);
    } catch (err: any) {
      this.showToast("❌ فشل الحذف: " + err.message, "error");
    }
  }

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

  trackById(_: number, item: Vehicle) {
    return item.id;
  }
}
