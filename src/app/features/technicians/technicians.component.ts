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
  TechnicianService,
  SPECIALIZATION_OPTIONS,
  STATUS_LABELS,
  SKILL_BADGE,
} from "src/app/core/services/technician.service";
import {
  Technician,
  TableColumn,
  TableAction,
  ActionEvent,
  SelectOption,
} from "src/app/core/models";

@Component({
  selector: "app-technicians",
  imports: [
    CommonModule,
    SearchableSelectComponent,
    DataTableComponent,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: "./technicians.component.html",
  styleUrl: "./technicians.component.css",
})
export class TechniciansComponent implements OnInit {
  technicians = this.svc.technicians;
  loading = this.svc.loading;
  saving = this.svc.saving;
  totalCount = this.svc.totalCount;
  activeCount = this.svc.activeCount;

  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedTech = signal<Technician | null>(null);
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  searchTerm = signal("");
  filterStatus = signal("");
  filterLevel = signal("");

  readonly statusOptions: SelectOption[] = this.svc.statusOptions;
  readonly skillOptions: SelectOption[] = this.svc.skillLevels.map((l) => ({
    value: l,
    label: l,
  }));
  readonly specializationOptions = SPECIALIZATION_OPTIONS;

  departmentOptions = computed<SelectOption[]>(() =>
    this.svc.departments().map((d) => ({ value: d, label: d })),
  );

  filteredTechs = computed(() => {
    let list = this.technicians();
    const term = this.searchTerm().toLowerCase();
    if (term)
      list = list.filter(
        (t) =>
          (t.full_name || "").toLowerCase().includes(term) ||
          (t.employee_number || "").toLowerCase().includes(term) ||
          (t.position || "").toLowerCase().includes(term),
      );
    if (this.filterStatus())
      list = list.filter((t) => t.status === this.filterStatus());
    if (this.filterLevel())
      list = list.filter((t) => t.skill_level === this.filterLevel());
    return list;
  });

  tableColumns: TableColumn[] = [
    {
      key: "full_name",
      label: "الاسم",
      sortable: false,
      renderHtml: (r) => `<strong>${r.full_name}</strong>`,
    },
    {
      key: "employee_number",
      label: "رقم الموظف",
      sortable: false,
      render: (r) => r.employee_number || "—",
    },
    {
      key: "position",
      label: "المنصب",
      sortable: false,
      render: (r) => r.position || "—",
    },
    {
      key: "skill_level",
      label: "المستوى",
      sortable: false,
      renderHtml: (r) =>
        r.skill_level
          ? `<span class="badge ${SKILL_BADGE[r.skill_level] || "badge-secondary"}">${r.skill_level}</span>`
          : "—",
    },
    {
      key: "performance_rating",
      label: "التقييم",
      sortable: false,
      renderHtml: (r) =>
        `<span>${this.svc.renderStars(r.performance_rating)} ${(r.performance_rating || 0).toFixed(1)}</span>`,
    },
    {
      key: "total_jobs",
      label: "الأعمال",
      sortable: false,
      renderHtml: (r) =>
        `<small>كلي: ${r.total_jobs || 0} | مكتمل: <span style="color:#10b981">${r.completed_jobs || 0}</span> | جارٍ: <span style="color:#f59e0b">${r.pending_jobs || 0}</span></small>`,
    },
    {
      key: "status",
      label: "الحالة",
      sortable: false,
      renderHtml: (r) =>
        `<span class="badge ${r.status === "active" ? "badge-success" : "badge-secondary"}">${STATUS_LABELS[r.status] || r.status}</span>`,
    },
  ];

  tableActions: TableAction[] = [
    { id: "view", label: "تفاصيل", icon: "👁️", color: "view" },
    { id: "edit", label: "تعديل", icon: "✏️", color: "edit" },
    { id: "delete", label: "حذف", icon: "🗑️", color: "delete" },
  ];

  form: FormGroup;

  constructor(
    public svc: TechnicianService,
    private fb: FormBuilder,
  ) {
    this.form = this.buildForm();
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  buildForm(): FormGroup {
    return this.fb.group({
      full_name: ["", Validators.required],
      phone: [null],
      email: [null],
      national_id: [null],
      employee_number: [null],
      position: [""],
      skill_level: ["مبتدئ"],
      department: [null],
      status: ["active"],
      hire_date: [null],
      performance_rating: [3],
      specializations: [[]],
      notes: [null],
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const payload: Omit<Technician, "id" | "created_at"> = {
      ...raw,
      specializations: raw.specializations?.length ? raw.specializations : null,
      performance_rating: raw.performance_rating ? +raw.performance_rating : 3,
      total_jobs: 0,
      completed_jobs: 0,
      pending_jobs: 0,
    };
    const result = await this.svc.save(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  async edit(id: string) {
    const tech = await this.svc.getById(id);
    if (!tech) return;
    this.editingId.set(id);
    this.form.patchValue({
      ...tech,
      specializations: tech.specializations || [],
    });
    document
      .getElementById("techFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async viewDetails(id: string) {
    const tech = await this.svc.getById(id);
    if (!tech) return;
    this.selectedTech.set(tech);
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

  toggleSpecialization(spec: string) {
    const current: string[] = this.form.get("specializations")?.value || [];
    const updated = current.includes(spec)
      ? current.filter((s) => s !== spec)
      : [...current, spec];
    this.form.patchValue({ specializations: updated });
  }

  hasSpecialization(spec: string): boolean {
    return (this.form.get("specializations")?.value || []).includes(spec);
  }

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
  }
  resetFilters() {
    this.searchTerm.set("");
    this.filterStatus.set("");
    this.filterLevel.set("");
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
}
