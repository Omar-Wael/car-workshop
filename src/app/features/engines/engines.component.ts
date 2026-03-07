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
import { EngineService } from "src/app/core/services/engine.service";
import {
  Engine,
  TableColumn,
  TableAction,
  ActionEvent,
  SelectOption,
} from "src/app/core/models";

@Component({
  selector: "app-engines",
  imports: [
    CommonModule,
    DataTableComponent,
    SearchableSelectComponent,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: "./engines.component.html",
  styleUrl: "./engines.component.css",
})
export class EnginesComponent implements OnInit {
  engines = this.svc.engines;
  loading = this.svc.loading;
  saving = this.svc.saving;

  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedEngine = signal<Engine | null>(null);
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  searchTerm = signal("");
  filterActive = signal("");

  readonly activeOptions: SelectOption[] = [
    { value: "true", label: "نشط" },
    { value: "false", label: "غير نشط" },
  ];

  filteredEngines = computed(() => {
    let list = this.engines();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (e) =>
          (e.engine_code || "").toLowerCase().includes(term) ||
          (e.engine_name || "").toLowerCase().includes(term) ||
          (e.brand || "").toLowerCase().includes(term),
      );
    if (this.filterActive() === "true") list = list.filter((e) => e.is_active);
    if (this.filterActive() === "false")
      list = list.filter((e) => !e.is_active);
    return list;
  });

  tableColumns: TableColumn[] = [
    {
      key: "engine_code",
      label: "الكود",
      sortable: false,
      renderHtml: (r) =>
        `<strong style="font-family:monospace">${r.engine_code}</strong>`,
    },
    { key: "engine_name", label: "الاسم", sortable: false },
    {
      key: "brand",
      label: "الشركة",
      sortable: false,
      render: (r) => r.brand || "—",
    },
    {
      key: "displacement_l",
      label: "السعة",
      sortable: false,
      render: (r) =>
        r.displacement_l
          ? r.displacement_l + " L"
          : r.displacement_cc
            ? r.displacement_cc + " cc"
            : "—",
    },
    {
      key: "cylinders",
      label: "أسطوانات",
      sortable: false,
      render: (r) => r.cylinders || "—",
    },
    {
      key: "cam_type",
      label: "الكامة",
      sortable: false,
      render: (r) => r.cam_type || "—",
    },
    {
      key: "fuel_system",
      label: "نظام الوقود",
      sortable: false,
      render: (r) => r.fuel_system || "—",
    },
    {
      key: "power_hp",
      label: "القوة (hp)",
      sortable: false,
      render: (r) => r.power_hp || "—",
    },
    {
      key: "compression_ratio",
      label: "نسبة الضغط",
      sortable: false,
      render: (r) => r.compression_ratio || "—",
    },
    {
      key: "is_active",
      label: "الحالة",
      sortable: false,
      renderHtml: (r) =>
        r.is_active
          ? '<span class="badge badge-success">نشط</span>'
          : '<span class="badge badge-danger">غير نشط</span>',
    },
  ];

  tableActions: TableAction[] = [
    { id: "view", label: "تفاصيل", icon: "👁️", color: "view" },
    { id: "edit", label: "تعديل", icon: "✏️", color: "edit" },
    { id: "delete", label: "حذف", icon: "🗑️", color: "delete" },
  ];

  form: FormGroup;

  constructor(
    public svc: EngineService,
    private fb: FormBuilder,
  ) {
    this.form = this.buildForm();
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  buildForm(): FormGroup {
    return this.fb.group({
      engine_code: ["", Validators.required],
      engine_name: ["", Validators.required],
      brand: [null],
      family: [null],
      cylinders: [null],
      bore_mm: [null],
      stroke_mm: [null],
      displacement_cc: [null],
      displacement_l: [null],
      cam_type: [null],
      valves_per_cyl: [null],
      total_valves: [null],
      timing_system: [null],
      fuel_system: [null],
      fuel_type: [null],
      power_hp: [null],
      power_rpm: [null],
      torque_nm: [null],
      torque_rpm: [null],
      compression_ratio: [null],
      compression_pressure_psi: [null],
      firing_order: [null],
      block_material: [null],
      head_material: [null],
      engine_length_mm: [null],
      engine_width_mm: [null],
      engine_height_mm: [null],
      dry_weight_kg: [null],
      oil_capacity_l: [null],
      oil_type: [null],
      cooling_type: [null],
      is_active: [true],
      notes: [null],
    });
  }

  /** Trigger auto-calc when bore/stroke/cylinders change */
  onGeometryChange() {
    const v = this.form.value;
    const bore = +v.bore_mm || null;
    const stroke = +v.stroke_mm || null;
    const cyls = +v.cylinders || null;
    const cc = this.svc.calcDisplacement(bore, stroke, cyls);
    if (cc) {
      this.form.patchValue(
        {
          displacement_cc: cc,
          displacement_l: this.svc.calcDisplacementL(cc),
        },
        { emitEvent: false },
      );
    }
  }

  onValvesChange() {
    const v = this.form.value;
    const total = this.svc.calcTotalValves(
      +v.valves_per_cyl || null,
      +v.cylinders || null,
    );
    if (total)
      this.form.patchValue({ total_valves: total }, { emitEvent: false });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const n = (k: string) => (raw[k] ? +raw[k] : null);
    const payload: Omit<Engine, "id" | "created_at"> = {
      engine_code: raw.engine_code,
      engine_name: raw.engine_name,
      brand: raw.brand || null,
      family: raw.family || null,
      cylinders: n("cylinders"),
      bore_mm: n("bore_mm"),
      stroke_mm: n("stroke_mm"),
      displacement_cc: n("displacement_cc"),
      displacement_l: n("displacement_l"),
      cam_type: raw.cam_type || null,
      valves_per_cyl: n("valves_per_cyl"),
      total_valves: n("total_valves"),
      timing_system: raw.timing_system || null,
      fuel_system: raw.fuel_system || null,
      fuel_type: raw.fuel_type || null,
      power_hp: n("power_hp"),
      power_rpm: n("power_rpm"),
      torque_nm: n("torque_nm"),
      torque_rpm: n("torque_rpm"),
      compression_ratio: raw.compression_ratio || null,
      compression_pressure_psi: n("compression_pressure_psi"),
      firing_order: raw.firing_order || null,
      block_material: raw.block_material || null,
      head_material: raw.head_material || null,
      engine_length_mm: n("engine_length_mm"),
      engine_width_mm: n("engine_width_mm"),
      engine_height_mm: n("engine_height_mm"),
      dry_weight_kg: n("dry_weight_kg"),
      oil_capacity_l: n("oil_capacity_l"),
      oil_type: raw.oil_type || null,
      cooling_type: raw.cooling_type || null,
      is_active: !!raw.is_active,
      notes: raw.notes || null,
    };
    const result = await this.svc.save(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  async edit(id: string) {
    const eng = await this.svc.getById(id);
    if (!eng) {
      this.showToast("❌ فشل تحميل البيانات", "error");
      return;
    }
    this.editingId.set(id);
    this.form.patchValue({ ...eng });
    document
      .getElementById("engineFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async viewDetails(id: string) {
    const eng = await this.svc.getById(id);
    if (!eng) return;
    this.selectedEngine.set(eng);
    this.showDetailsModal.set(true);
  }

  async delete(id: string) {
    const result = await this.svc.delete(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  onTableAction(ev: ActionEvent) {
    if (ev.action === "view") this.viewDetails(ev.row.id);
    if (ev.action === "edit") this.edit(ev.row.id);
    if (ev.action === "delete") this.delete(ev.row.id);
  }

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
  }

  get isEditing() {
    return !!this.editingId();
  }

  showToast(
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 4000);
  }

  /** Used in template to render a spec row only when the value is present */
  row(val: any): boolean {
    return val !== null && val !== undefined && val !== "";
  }
}
