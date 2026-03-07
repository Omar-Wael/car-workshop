import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { DataTableComponent } from "../../shared/components/data-table/data-table.component";
import { DepartmentService } from "src/app/core/services/department.service";
import {
  Department,
  TableColumn,
  TableAction,
  ActionEvent,
} from "src/app/core/models";

@Component({
  selector: "app-departments",
  imports: [CommonModule, DataTableComponent, FormsModule, ReactiveFormsModule],
  templateUrl: "./departments.component.html",
  styleUrl: "./departments.component.css",
})
export class DepartmentsComponent implements OnInit {
  departments = this.svc.departments;
  loading = this.svc.loading;
  saving = this.svc.saving;

  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedDept = signal<{ dept: Department; vehicleCount: number } | null>(
    null,
  );
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  searchTerm = signal("");

  filteredDepts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return term
      ? this.departments().filter((d) => d.name.toLowerCase().includes(term))
      : this.departments();
  });

  tableColumns: TableColumn[] = [
    {
      key: "name",
      label: "اسم الإدارة",
      sortable: false,
      renderHtml: (r) => `<strong>${r.name}</strong>`,
    },
    {
      key: "created_at",
      label: "تاريخ الإضافة",
      sortable: false,
      render: (r) =>
        r.created_at ? new Date(r.created_at).toLocaleDateString("ar-EG") : "—",
    },
  ];

  tableActions: TableAction[] = [
    { id: "view", label: "تفاصيل", icon: "👁️", color: "view" },
    { id: "edit", label: "تعديل", icon: "✏️", color: "edit" },
    { id: "delete", label: "حذف", icon: "🗑️", color: "delete" },
  ];

  form: FormGroup;

  constructor(
    public svc: DepartmentService,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      name: ["", [Validators.required, Validators.minLength(2)]],
    });
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const result = await this.svc.save(this.form.value.name, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  async edit(id: string) {
    const dept = await this.svc.getById(id);
    if (!dept) return;
    this.editingId.set(id);
    this.form.patchValue({ name: dept.name });
    document
      .getElementById("deptFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async viewDetails(id: string) {
    const dept = await this.svc.getById(id);
    if (!dept) return;
    const count = await this.svc.getVehicleCount(dept.name);
    this.selectedDept.set({ dept, vehicleCount: count });
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
    this.form.reset();
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
}
