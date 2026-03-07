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
import { MaintenanceService } from "src/app/core/services/maintenance.service";
import {
  Maintenance,
  Overhaul,
  TableColumn,
  TableAction,
  ActionEvent,
  SelectOption,
} from "src/app/core/models";

@Component({
  selector: "app-maintenance",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    DataTableComponent,
  ],
  templateUrl: "./maintenance.component.html",
  styleUrl: "./maintenance.component.css",
})
export class MaintenanceComponent implements OnInit {
  // ── Service signal aliases ──
  maintenances = this.svc.maintenances;
  vehicles = this.svc.vehicles;
  technicians = this.svc.technicians;
  loading = this.svc.loading;
  saving = this.svc.saving;

  // ── UI state ──
  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedRecord = signal<Maintenance | null>(null);
  showImageModal = signal(false);
  zoomedImage = signal("");
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  _selectedDepartment = signal("");

  // ── Filters ──
  filterPlate = signal("");
  filterType = signal("");
  filterDept = signal("");
  filterTech = signal("");
  filterStatus = signal("");
  filterFrom = signal("");
  filterTo = signal("");
  searchTerm = signal("");

  // ── Static options ──
  readonly typeOptions: SelectOption[] = this.svc.maintenanceTypes.map((t) => ({
    value: t,
    label: t,
  }));
  readonly statusOptions: SelectOption[] = this.svc.maintenanceStatuses.map(
    (s) => ({ value: s, label: s }),
  );
  readonly hasExternalWorkOptions: SelectOption[] = [
    { value: "false", label: "لا" },
    { value: "true", label: "نعم" },
  ];

  // ── Computed options ──
  vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v) => ({
      value: v.plate_number,
      label: v.plate_number,
      sublabel: v.department || undefined,
    })),
  );

  technicianOptions = computed<SelectOption[]>(() =>
    this.technicians().map((t) => ({ value: t.full_name, label: t.full_name })),
  );

  departmentOptions = computed<SelectOption[]>(() => {
    const depts = [
      ...new Set(
        this.vehicles()
          .map((v) => v.department)
          .filter(Boolean),
      ),
    ].sort();
    return (depts as string[]).map((d) => ({ value: d, label: d }));
  });

  platesInData = computed<SelectOption[]>(() => {
    const plates = [
      ...new Set(
        this.maintenances()
          .map((m) => m.vehicle_plate)
          .filter(Boolean),
      ),
    ].sort();
    return plates.map((p) => ({ value: p, label: p }));
  });

  techniciansInData = computed<SelectOption[]>(() => {
    const names = new Set<string>();
    this.maintenances().forEach((m) => {
      if (m.technicians)
        m.technicians.split(",").forEach((t) => {
          const n = t.trim();
          if (n) names.add(n);
        });
    });
    return [...names].sort().map((n) => ({ value: n, label: n }));
  });

  // ── Filtered list ──
  filteredMaintenances = computed(() => {
    let list = this.maintenances();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (m) =>
          (m.vehicle_plate || "").toLowerCase().includes(term) ||
          (m.repair_work || "").toLowerCase().includes(term) ||
          (m.technicians || "").toLowerCase().includes(term) ||
          (m.linked_request_number || "").toLowerCase().includes(term),
      );
    if (this.filterPlate())
      list = list.filter((m) => m.vehicle_plate === this.filterPlate());
    if (this.filterType())
      list = list.filter((m) => m.maintenance_type === this.filterType());
    if (this.filterStatus())
      list = list.filter((m) => m.status === this.filterStatus());
    if (this.filterFrom())
      list = list.filter((m) => (m.entry_date || "") >= this.filterFrom());
    if (this.filterTo())
      list = list.filter((m) => (m.entry_date || "") <= this.filterTo());
    if (this.filterDept()) {
      list = list.filter(
        (m) => this.svc.getDepartment(m.vehicle_plate) === this.filterDept(),
      );
    }
    if (this.filterTech()) {
      const tech = this.filterTech();
      list = list.filter((m) =>
        m.technicians
          ?.split(",")
          .map((t) => t.trim())
          .includes(tech),
      );
    }
    return list;
  });

  // ── Table ──
  tableColumns: TableColumn[] = [
    {
      key: "vehicle_plate",
      label: "رقم السيارة",
      sortable: false,
      renderHtml: (row) => `<strong>${row.vehicle_plate}</strong>`,
    },
    {
      key: "maintenance_type",
      label: "نوع الصيانة",
      sortable: false,
      renderHtml: (row) => this.renderTypeBadge(row.maintenance_type),
    },
    {
      key: "entry_date",
      label: "تاريخ الدخول",
      sortable: false,
      render: (row) =>
        row.entry_date
          ? new Date(row.entry_date).toLocaleDateString("ar-EG")
          : "—",
    },
    {
      key: "exit_date",
      label: "تاريخ الخروج",
      sortable: false,
      render: (row) =>
        row.exit_date
          ? new Date(row.exit_date).toLocaleDateString("ar-EG")
          : "—",
    },
    {
      key: "repair_work",
      label: "أعمال الإصلاح",
      sortable: false,
      render: (row) =>
        row.repair_work
          ? row.repair_work.length > 50
            ? row.repair_work.slice(0, 50) + "..."
            : row.repair_work
          : "—",
    },
    {
      key: "technicians",
      label: "الفنيون",
      sortable: false,
      renderHtml: (row) => this.renderTechBadges(row.technicians),
    },
    {
      key: "linked_request_number",
      label: "طلب صرف",
      sortable: false,
      renderHtml: (row) =>
        row.linked_request_number
          ? `<span class="badge badge-success">${row.linked_request_number}</span>`
          : `<span class="badge badge-secondary">بدون</span>`,
    },
    {
      key: "status",
      label: "الحالة",
      sortable: false,
      renderHtml: (row) => this.renderStatusBadge(row.status),
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
    public svc: MaintenanceService,
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
      vehicle_plate: ["", Validators.required],
      maintenance_type: [null],
      entry_date: [null],
      expected_exit_date: [null],
      exit_date: [null],
      repair_work: [""],
      technicians: [[]], // string[] → joined on save
      linked_request_number: [null],
      has_external_work: ["false"],
      external_cost: [null],
      status: ["قيد التنفيذ", Validators.required],
      odometer_reading: [null],
      attachments: [[]],
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast("⚠️ يرجى تعبئة الحقول المطلوبة", "warning");
      return;
    }
    const raw = this.form.value;
    const payload: Omit<Maintenance, "id" | "created_at"> = {
      vehicle_plate: raw.vehicle_plate,
      maintenance_type: raw.maintenance_type || null,
      entry_date: raw.entry_date || null,
      expected_exit_date: raw.expected_exit_date || null,
      exit_date: raw.exit_date || null,
      repair_work: raw.repair_work || null,
      technicians: Array.isArray(raw.technicians)
        ? raw.technicians.join(", ")
        : raw.technicians || null,
      linked_request_number: raw.linked_request_number || null,
      has_external_work: raw.has_external_work === "true",
      external_cost: raw.external_cost ? +raw.external_cost : null,
      status: raw.status,
      odometer_reading: raw.odometer_reading ? +raw.odometer_reading : null,
      attachments: raw.attachments || [],
    };
    const result = await this.svc.saveMaintenance(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  async edit(id: string) {
    const m = await this.svc.getMaintenanceById(id);
    if (!m) {
      this.showToast("❌ فشل تحميل السجل", "error");
      return;
    }
    this.editingId.set(id);
    const techNames = m.technicians
      ? m.technicians
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    this.form.patchValue({
      vehicle_plate: m.vehicle_plate,
      maintenance_type: m.maintenance_type || null,
      entry_date: m.entry_date || null,
      expected_exit_date: m.expected_exit_date || null,
      exit_date: m.exit_date || null,
      repair_work: m.repair_work || "",
      technicians: techNames,
      linked_request_number: m.linked_request_number || null,
      has_external_work: m.has_external_work ? "true" : "false",
      external_cost: m.external_cost || null,
      status: m.status,
      odometer_reading: m.odometer_reading || null,
      attachments: m.attachments || [],
    });
    this.onVehiclePlateChange(m.vehicle_plate);
    document
      .getElementById("maintenanceFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // ── View details ──────────────────────────────────────────────────────────

  async viewDetails(id: string) {
    const m = await this.svc.getMaintenanceById(id);
    if (!m) {
      this.showToast("❌ فشل عرض التفاصيل", "error");
      return;
    }
    this.selectedRecord.set(m);
    this.showDetailsModal.set(true);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const result = await this.svc.deleteMaintenance(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  // ── Table dispatcher ──────────────────────────────────────────────────────

  onTableAction(event: ActionEvent) {
    if (event.action === "view") this.viewDetails(event.row.id);
    if (event.action === "edit") this.edit(event.row.id);
    if (event.action === "delete") this.delete(event.row.id);
  }

  // ── Vehicle → department ──────────────────────────────────────────────────

  onVehiclePlateChange(plate: string) {
    this._selectedDepartment.set(this.svc.getDepartment(plate));
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    const current: any[] = this.form.get("attachments")?.value || [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.form.patchValue({
          attachments: [
            ...current,
            { name: file.name, data: e.target?.result },
          ],
        });
      };
      reader.readAsDataURL(file);
    });
  }

  removeAttachment(index: number) {
    const current = [...(this.form.get("attachments")?.value || [])];
    current.splice(index, 1);
    this.form.patchValue({ attachments: current });
  }

  openZoom(data: string) {
    this.zoomedImage.set(data);
    this.showImageModal.set(true);
  }

  get currentAttachments(): any[] {
    return this.form.get("attachments")?.value || [];
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
    this._selectedDepartment.set("");
  }

  resetFilters() {
    this.filterPlate.set("");
    this.filterType.set("");
    this.filterDept.set("");
    this.filterTech.set("");
    this.filterStatus.set("");
    this.filterFrom.set("");
    this.filterTo.set("");
    this.searchTerm.set("");
  }

  // ── Excel ──────────────────────────────────────────────────────────────────

  exportToExcel() {
    this.svc.exportMaintenanceToExcel(this.filteredMaintenances());
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  renderTypeBadge(type: string | null | undefined): string {
    if (!type) return "—";
    const c = this.svc.typeColors[type] || "#64748b";
    return `<span class="type-badge" style="background:${c}20;color:${c};border:1px solid ${c}40;">${type}</span>`;
  }

  renderTechBadges(technicians: string | null | undefined): string {
    if (!technicians) return "—";
    return technicians
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<span class="badge badge-tech">${t}</span>`)
      .join(" ");
  }

  renderStatusBadge(status: string): string {
    const map: Record<string, string> = {
      "قيد التنفيذ": "badge-warning",
      مكتملة: "badge-success",
      معلقة: "badge-secondary",
    };
    return `<span class="badge ${map[status] || "badge-secondary"}">${status}</span>`;
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

  trackByIndex(i: number) {
    return i;
  }
}
