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
import { SearchableSelectComponent } from "../../shared/components/searchable-select/searchable-select.component";
import { DataTableComponent } from "../../shared/components/data-table/data-table.component";
import { CheckService, STAGE_LABELS, TYPE_LABELS } from "src/app/core/services/check.service";
import {
  Check,
  CheckVehicle,
  TableColumn,
  TableAction,
  ActionEvent,
  SelectOption,
} from "src/app/core/models";

@Component({
  selector: "app-check",
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, SearchableSelectComponent],
  templateUrl: "./check.component.html",
  styleUrl: "./check.component.css",
})
export class CheckComponent implements OnInit {
  checks = this.svc.checks;
  vehicles = this.svc.vehicles;
  references = this.svc.references;
  loading = this.svc.loading;
  saving = this.svc.saving;
  totalCount = this.svc.totalCount;
  inProgressCount = this.svc.inProgressCount;
  completedCount = this.svc.completedCount;

  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedCheck = signal<Check | null>(null);
  showImageModal = signal(false);
  zoomedImage = signal("");
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  filterNumber = signal("");
  filterPlate = signal("");
  filterStage = signal("");
  filterType = signal("");
  filterFrom = signal("");
  filterTo = signal("");

  readonly stageOptions: SelectOption[] = this.svc.stageOptions;
  readonly typeOptions: SelectOption[] = this.svc.typeOptions;

  vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v) => ({
      value: v.plate_number,
      label: v.plate_number,
    })),
  );

  platesInData = computed<SelectOption[]>(() => {
    const plates = new Set<string>();
    this.checks().forEach((c) =>
      (c.vehicles || []).forEach((v: CheckVehicle) => {
        if (v.vehicle_plate) plates.add(v.vehicle_plate);
      }),
    );
    return [...plates].sort().map((p) => ({ value: p, label: p }));
  });

  referenceOptions = computed<SelectOption[]>(() =>
    this.references().map((r) => ({ value: r, label: r })),
  );

  filteredChecks = computed(() => {
    let list = this.checks();
    const num = this.filterNumber().toLowerCase().trim();
    if (num)
      list = list.filter((c) =>
        (c.check_number || "").toLowerCase().includes(num),
      );
    if (this.filterPlate())
      list = list.filter((c) =>
        c.vehicles?.some((v: CheckVehicle) => v.vehicle_plate === this.filterPlate()),
      );
    if (this.filterStage())
      list = list.filter((c) => String(c.current_stage) === this.filterStage());
    if (this.filterType())
      list = list.filter((c) => c.related_type === this.filterType());
    if (this.filterFrom())
      list = list.filter((c) => (c.created_at || "") >= this.filterFrom());
    if (this.filterTo())
      list = list.filter(
        (c) => (c.created_at || "") <= this.filterTo() + "T23:59:59",
      );
    return list;
  });

  tableColumns: TableColumn[] = [
    {
      key: "check_number",
      label: "رقم الشيك",
      sortable: false,
      renderHtml: (r) => `<strong>${r.check_number}</strong>`,
    },
    {
      key: "check_amount",
      label: "القيمة",
      sortable: false,
      render: (r) =>
        r.check_amount ? r.check_amount.toLocaleString("ar-EG") + " ج" : "—",
    },
    {
      key: "bank_name",
      label: "البنك",
      sortable: false,
      render: (r) => r.bank_name || "—",
    },
    {
      key: "related_type",
      label: "النوع",
      sortable: false,
      render: (r) =>
        r.related_type ? TYPE_LABELS[r.related_type] || r.related_type : "—",
    },
    {
      key: "related_reference",
      label: "المرجع",
      sortable: false,
      render: (r) => r.related_reference || "—",
    },
    {
      key: "vehicles",
      label: "السيارات",
      sortable: false,
      render: (r) => {
        const list = (r.vehicles as CheckVehicle[]) || [];
        if (!list.length) return "—";
        const shown = list
          .slice(0, 2)
          .map((v) => v.vehicle_plate)
          .join("، ");
        return shown + (list.length > 2 ? ` +${list.length - 2}` : "");
      },
    },
    {
      key: "current_stage",
      label: "المرحلة",
      sortable: false,
      renderHtml: (r) =>
        `<span class="badge badge-info">${r.current_stage}/8</span>`,
    },
    {
      key: "created_at",
      label: "التاريخ",
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
    public svc: CheckService,
    private fb: FormBuilder,
  ) {
    this.form = this.buildForm();
  }

  async ngOnInit() {
    await this.svc.loadAll();
  }

  buildForm(): FormGroup {
    return this.fb.group({
      check_number: ["", Validators.required],
      check_amount: [null, Validators.required],
      check_date: [null],
      bank_name: [null],
      beneficiary: [null],
      related_type: [null],
      related_reference: [null],
      current_stage: [1, Validators.required],
      notes: [null],
      attachments: [[]],
      vehicles: this.fb.array([this.buildVehicleGroup()]),
    });
  }

  buildVehicleGroup(): FormGroup {
    return this.fb.group({
      vehicle_plate: ["", Validators.required],
      amount: [null],
      note: [""],
    });
  }

  get vehiclesArray(): FormArray {
    return this.form.get("vehicles") as FormArray;
  }
  vehicleAt(i: number): FormGroup {
    return this.vehiclesArray.at(i) as FormGroup;
  }
  addVehicle() {
    this.vehiclesArray.push(this.buildVehicleGroup());
  }
  removeVehicle(i: number) {
    if (this.vehiclesArray.length > 1) this.vehiclesArray.removeAt(i);
  }

  getTotalFromForm(): number {
    return ((this.form.get("vehicles")?.value as CheckVehicle[]) || []).reduce(
      (s, v) => s + (+v.amount! || 0),
      0,
    );
  }

  async onRelatedTypeChange(type: string) {
    this.form.patchValue({ related_reference: null });
    if (type && type !== "other") await this.svc.loadReferences(type);
    else this.svc.references.set([]);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.value;
    const vList: CheckVehicle[] = (raw.vehicles || [])
      .filter((v: any) => v.vehicle_plate)
      .map((v: any) => ({
        vehicle_plate: v.vehicle_plate,
        amount: v.amount ? +v.amount : null,
        note: v.note || null,
      }));

    if (!vList.length) {
      this.showToast("⚠️ أضف سيارة واحدة على الأقل", "warning");
      return;
    }

    const payload: Omit<Check, "id" | "created_at"> = {
      check_number: raw.check_number,
      check_amount: +raw.check_amount,
      check_date: raw.check_date || null,
      bank_name: raw.bank_name || null,
      beneficiary: raw.beneficiary || null,
      related_type: raw.related_type || null,
      related_reference: raw.related_reference || null,
      current_stage: +raw.current_stage,
      vehicles: vList,
      total_vehicles_amount: this.svc.calcTotalVehiclesAmount(vList),
      notes: raw.notes || null,
      attachments: raw.attachments || [],
    };

    const result = await this.svc.save(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  async edit(id: string) {
    const chk = await this.svc.getById(id);
    if (!chk) {
      this.showToast("❌ فشل تحميل البيانات", "error");
      return;
    }
    this.editingId.set(id);

    while (this.vehiclesArray.length) this.vehiclesArray.removeAt(0);
    const vList = chk.vehicles?.length
      ? chk.vehicles
      : [{ vehicle_plate: "", amount: null, note: "" }];
    vList.forEach((v: CheckVehicle) => {
      const g = this.buildVehicleGroup();
      g.patchValue(v);
      this.vehiclesArray.push(g);
    });

    this.form.patchValue({
      check_number: chk.check_number,
      check_amount: chk.check_amount,
      check_date: chk.check_date || null,
      bank_name: chk.bank_name || null,
      beneficiary: chk.beneficiary || null,
      related_type: chk.related_type || null,
      related_reference: chk.related_reference || null,
      current_stage: chk.current_stage,
      notes: chk.notes || null,
      attachments: chk.attachments || [],
    });

    if (chk.related_type && chk.related_type !== "other")
      await this.svc.loadReferences(chk.related_type);
    document
      .getElementById("checkFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async viewDetails(id: string) {
    const chk = await this.svc.getById(id);
    if (!chk) {
      this.showToast("❌ فشل عرض التفاصيل", "error");
      return;
    }
    this.selectedCheck.set(chk);
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

  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    const current: any[] = this.form.get("attachments")?.value || [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) =>
        this.form.patchValue({
          attachments: [
            ...current,
            { name: file.name, data: e.target?.result },
          ],
        });
      reader.readAsDataURL(file);
    });
  }
  removeAttachment(i: number) {
    const current = [...(this.form.get("attachments")?.value || [])];
    current.splice(i, 1);
    this.form.patchValue({ attachments: current });
  }
  get currentAttachments(): any[] {
    return this.form.get("attachments")?.value || [];
  }
  openZoom(data: string) {
    this.zoomedImage.set(data);
    this.showImageModal.set(true);
  }

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
    this.svc.references.set([]);
  }
  resetFilters() {
    this.filterNumber.set("");
    this.filterPlate.set("");
    this.filterStage.set("");
    this.filterType.set("");
    this.filterFrom.set("");
    this.filterTo.set("");
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
  trackByIndex(i: number) {
    return i;
  }

  readonly stageLabels = STAGE_LABELS;
  readonly typeLabels = TYPE_LABELS;
}
