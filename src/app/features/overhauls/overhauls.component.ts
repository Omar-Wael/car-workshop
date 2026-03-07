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
  Overhaul,
  SelectOption,
  TableColumn,
  TableAction,
  ActionEvent,
} from "src/app/core/models";

@Component({
  selector: "app-overhauls",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    DataTableComponent,
  ],
  templateUrl: "./overhauls.component.html",
  styleUrl: "./overhauls.component.css",
})
export class OverhaulsComponent implements OnInit {
  // ── Service signal aliases ──
  overhauls = this.svc.overhauls;
  vehicles = this.svc.vehicles;
  technicians = this.svc.technicians;
  loading = this.svc.loading;
  saving = this.svc.saving;

  // ── UI state ──
  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedRecord = signal<Overhaul | null>(null);
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
  readonly statusOptions: SelectOption[] = this.svc.overhaulStatuses.map(
    (s) => ({ value: s, label: s }),
  );

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
        this.overhauls()
          .map((o: any) => o.vehicle_plate)
          .filter(Boolean),
      ),
    ].sort();
    return plates.map((p) => ({ value: p, label: p }));
  });

  typesInData = computed<SelectOption[]>(() => {
    const types = [
      ...new Set(
        this.overhauls()
          .map((o) => o.type)
          .filter(Boolean),
      ),
    ].sort();
    return (types as string[]).map((t) => ({ value: t, label: t }));
  });

  techniciansInData = computed<SelectOption[]>(() => {
    const names = new Set<string>();
    this.overhauls().forEach((o) => {
      if (o.technician_name)
        o.technician_name.split(",").forEach((t) => {
          const n = t.trim();
          if (n) names.add(n);
        });
    });
    return [...names].sort().map((n) => ({ value: n, label: n }));
  });

  // ── Filtered list ──
  filteredOverhauls = computed(() => {
    let list = this.overhauls();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (o) =>
          (o.vehicle_plate || "").toLowerCase().includes(term) ||
          (o.type || "").toLowerCase().includes(term) ||
          (o.technician_name || "").toLowerCase().includes(term) ||
          (o.notes || "").toLowerCase().includes(term),
      );
    if (this.filterPlate())
      list = list.filter((o) => o.vehicle_plate === this.filterPlate());
    if (this.filterType())
      list = list.filter((o) => o.type === this.filterType());
    if (this.filterStatus())
      list = list.filter((o) => o.status === this.filterStatus());
    if (this.filterFrom())
      list = list.filter((o) => (o.entry_date || "") >= this.filterFrom());
    if (this.filterTo())
      list = list.filter((o) => (o.entry_date || "") <= this.filterTo());
    if (this.filterDept())
      list = list.filter(
        (o) => this.svc.getDepartment(o.vehicle_plate) === this.filterDept(),
      );
    if (this.filterTech()) {
      const tech = this.filterTech();
      list = list.filter((o) =>
        o.technician_name
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
      label: "السيارة",
      sortable: false,
      renderHtml: (row) => `<strong>${row.vehicle_plate}</strong>`,
    },
    { key: "type", label: "نوع العمرة", sortable: false },
    {
      key: "entry_date",
      label: "تاريخ البدء",
      sortable: false,
      render: (row) =>
        row.entry_date
          ? new Date(row.entry_date).toLocaleDateString("ar-EG")
          : "—",
    },
    {
      key: "exit_date",
      label: "تاريخ الانتهاء",
      sortable: false,
      render: (row) =>
        row.exit_date
          ? new Date(row.exit_date).toLocaleDateString("ar-EG")
          : "—",
    },
    {
      key: "quotation_value",
      label: "قيمة عرض السعر",
      sortable: false,
      render: (row) =>
        row.quotation_value ? row.quotation_value.toLocaleString("ar-EG") : "—",
    },
    {
      key: "technician_name",
      label: "الفني/الفنيون",
      sortable: false,
      renderHtml: (row) => this.renderTechBadges(row.technician_name),
    },
    {
      key: "quotation_received",
      label: "عروض أسعار",
      sortable: false,
      renderHtml: (row) =>
        row.quotation_received
          ? '<span class="badge badge-success">✅ تم</span>'
          : '<span class="badge badge-secondary">❌ لا</span>',
    },
    {
      key: "check_received",
      label: "الشيك",
      sortable: false,
      renderHtml: (row) =>
        row.check_received
          ? '<span class="badge badge-success">✅ تم</span>'
          : '<span class="badge badge-secondary">❌ لا</span>',
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

  buildForm(): FormGroup {
    return this.fb.group({
      vehicle_plate: ["", Validators.required],
      entry_date: [null],
      expected_exit_date: [null],
      exit_date: [null],
      run_in_period_days: [null],
      type: ["", Validators.required],
      quotation_value: [null],
      quotation_received: [false],
      check_received: [false],
      notes: [null],
      technician_name: [[]], // string[] → joined on save
      status: ["قيد الإعداد", Validators.required],
      odometer_reading: [null],
      attachments: [[]],
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast("⚠️ يرجى تعبئة الحقول المطلوبة", "warning");
      return;
    }
    const raw = this.form.value;
    const payload: Omit<Overhaul, "id" | "created_at"> = {
      vehicle_plate: raw.vehicle_plate,
      entry_date: raw.entry_date || null,
      expected_exit_date: raw.expected_exit_date || null,
      exit_date: raw.exit_date || null,
      run_in_period_days: raw.run_in_period_days
        ? +raw.run_in_period_days
        : null,
      type: raw.type || null,
      quotation_value: raw.quotation_value ? +raw.quotation_value : null,
      quotation_received: !!raw.quotation_received,
      check_received: !!raw.check_received,
      notes: raw.notes || null,
      technician_name: Array.isArray(raw.technician_name)
        ? raw.technician_name.join(", ")
        : raw.technician_name || null,
      status: raw.status,
      odometer_reading: raw.odometer_reading ? +raw.odometer_reading : null,
      attachments: raw.attachments || [],
    };
    const result = await this.svc.saveOverhaul(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  async edit(id: string) {
    const o = await this.svc.getOverhaulById(id);
    if (!o) {
      this.showToast("❌ فشل تحميل السجل", "error");
      return;
    }
    this.editingId.set(id);
    const techNames = o.technician_name
      ? o.technician_name
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    this.form.patchValue({
      vehicle_plate: o.vehicle_plate,
      entry_date: o.entry_date || null,
      expected_exit_date: o.expected_exit_date || null,
      exit_date: o.exit_date || null,
      run_in_period_days: o.run_in_period_days || null,
      type: o.type || "",
      quotation_value: o.quotation_value || null,
      quotation_received: o.quotation_received || false,
      check_received: o.check_received || false,
      notes: o.notes || "",
      technician_name: techNames,
      status: o.status,
      odometer_reading: o.odometer_reading || null,
      attachments: o.attachments || [],
    });
    this.onVehiclePlateChange(o.vehicle_plate);
    document
      .getElementById("overhaulFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async viewDetails(id: string) {
    const o = await this.svc.getOverhaulById(id);
    if (!o) {
      this.showToast("❌ فشل عرض التفاصيل", "error");
      return;
    }
    this.selectedRecord.set(o);
    this.showDetailsModal.set(true);
  }

  async delete(id: string) {
    const result = await this.svc.deleteOverhaul(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  onTableAction(event: ActionEvent) {
    if (event.action === "view") this.viewDetails(event.row.id);
    if (event.action === "edit") this.edit(event.row.id);
    if (event.action === "delete") this.delete(event.row.id);
  }

  onVehiclePlateChange(plate: string) {
    this._selectedDepartment.set(this.svc.getDepartment(plate));
  }

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

  exportToExcel() {
    this.svc.exportOverhaulsToExcel(this.filteredOverhauls());
  }

  renderTechBadges(techName: string | null | undefined): string {
    if (!techName) return "—";
    return techName
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<span class="badge badge-tech">${t}</span>`)
      .join(" ");
  }

  renderStatusBadge(status: string): string {
    const map: Record<string, string> = {
      "قيد الإعداد": "badge-info",
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
