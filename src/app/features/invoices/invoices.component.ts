import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from "@angular/forms";
import { SearchableSelectComponent } from "../../shared/components/searchable-select/searchable-select.component";
import { DataTableComponent } from "../../shared/components/data-table/data-table.component";
import {
  InvoiceService,
  InvoiceStatus,
  InvoiceRelatedType,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  TYPE_LABELS,
} from "src/app/core/services/invoice.service";
import {
  Invoice,
  InvoiceVehicle,
  TableColumn,
  TableAction,
  ActionEvent,
  SelectOption,
} from "src/app/core/models";

@Component({
  selector: "app-invoices",
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SearchableSelectComponent,
    DataTableComponent,
  ],
  templateUrl: "./invoices.component.html",
  styleUrl: "./invoices.component.css",
})
export class InvoicesComponent implements OnInit {
  // ── Service aliases ──
  invoices = this.svc.invoices;
  vehicles = this.svc.vehicles;
  references = this.svc.references;
  loading = this.svc.loading;
  saving = this.svc.saving;
  totalCount = this.svc.totalCount;
  pendingCount = this.svc.pendingCount;
  settledCount = this.svc.settledCount;

  // ── UI state ──
  editingId = signal<string | null>(null);
  showDetailsModal = signal(false);
  selectedInvoice = signal<Invoice | null>(null);
  showImageModal = signal(false);
  zoomedImage = signal("");
  toast = signal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // ── Filters ──
  filterNumber = signal("");
  filterPlate = signal("");
  filterStatus = signal("");
  filterType = signal("");
  filterFrom = signal("");
  filterTo = signal("");

  // ── Options ──
  readonly statusOptions: SelectOption[] = this.svc.statusOptions;
  readonly typeOptions: SelectOption[] = this.svc.typeOptions;

  vehicleOptions = computed<SelectOption[]>(() =>
    this.vehicles().map((v) => ({
      value: v.plate_number,
      label: v.plate_number,
      sublabel: v.department || undefined,
    })),
  );

  platesInData = computed<SelectOption[]>(() => {
    const plates = new Set<string>();
    this.invoices().forEach((inv) =>
      (inv.vehicles || []).forEach((v: InvoiceVehicle) => {
        if (v.vehicle_plate) plates.add(v.vehicle_plate);
      }),
    );
    return [...plates].sort().map((p) => ({ value: p, label: p }));
  });

  referenceOptions = computed<SelectOption[]>(() =>
    this.references().map((r) => ({ value: r, label: r })),
  );

  // ── Filtered list ──
  filteredInvoices = computed(() => {
    let list = this.invoices();
    const num = this.filterNumber().toLowerCase().trim();
    if (num)
      list = list.filter((i) =>
        (i.invoice_number || "").toLowerCase().includes(num),
      );
    if (this.filterPlate())
      list = list.filter((i) =>
        i.vehicles?.some(
          (v: InvoiceVehicle) => v.vehicle_plate === this.filterPlate(),
        ),
      );
    if (this.filterStatus())
      list = list.filter((i) => i.status === this.filterStatus());
    if (this.filterType())
      list = list.filter((i) => i.related_type === this.filterType());
    if (this.filterFrom())
      list = list.filter((i) => (i.created_at || "") >= this.filterFrom());
    if (this.filterTo())
      list = list.filter(
        (i) => (i.created_at || "") <= this.filterTo() + "T23:59:59",
      );
    return list;
  });

  // ── Table ──
  tableColumns: TableColumn[] = [
    {
      key: "invoice_number",
      label: "رقم الفاتورة",
      sortable: false,
      renderHtml: (row) => `<strong>${row.invoice_number}</strong>`,
    },
    {
      key: "advance_amount",
      label: "السلفة",
      sortable: false,
      render: (row) =>
        row.advance_amount
          ? row.advance_amount.toLocaleString("ar-EG") + " ج"
          : "—",
    },
    {
      key: "invoice_amount",
      label: "الفاتورة",
      sortable: false,
      render: (row) =>
        row.invoice_amount
          ? row.invoice_amount.toLocaleString("ar-EG") + " ج"
          : "—",
    },
    {
      key: "difference_amount",
      label: "الفرق",
      sortable: false,
      renderHtml: (row) => this.renderDiff(row.difference_amount),
    },
    {
      key: "vehicles",
      label: "السيارات",
      sortable: false,
      render: (row) => {
        const list = (row.vehicles as InvoiceVehicle[]) || [];
        if (!list.length) return row.vehicle_plate || "—";
        const shown = list
          .slice(0, 2)
          .map((v) => v.vehicle_plate)
          .join("، ");
        return shown + (list.length > 2 ? ` +${list.length - 2}` : "");
      },
    },
    {
      key: "advance_purpose",
      label: "الغرض",
      sortable: false,
      render: (row) =>
        row.advance_purpose
          ? row.advance_purpose.length > 30
            ? row.advance_purpose.slice(0, 30) + "..."
            : row.advance_purpose
          : "—",
    },
    {
      key: "status",
      label: "الحالة",
      sortable: false,
      renderHtml: (row) =>
        `<span class="badge ${STATUS_BADGE_CLASS[row.status as InvoiceStatus] || "badge-secondary"}">${STATUS_LABELS[row.status as InvoiceStatus] || row.status}</span>`,
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

  // ── Form ──
  form: FormGroup;

  constructor(
    public svc: InvoiceService,
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
      invoice_number: ["", Validators.required],
      advance_amount: [null, Validators.required],
      advance_date: [null],
      advance_purpose: [""],
      advance_recipient: [null],
      related_type: [null],
      related_reference: [null],
      invoice_received_date: [null],
      invoice_amount: [null],
      settlement_date: [null],
      settlement_amount: [null],
      status: ["advance_issued", Validators.required],
      notes: [null],
      attachments: [[]],
      vehicles: this.fb.array([this.buildVehicleGroup()]),
    });
  }

  buildVehicleGroup(): FormGroup {
    return this.fb.group({
      vehicle_plate: ["", Validators.required],
      cost: [null, [Validators.required, Validators.min(0)]],
      description: [""],
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

  totalVehiclesCost = computed(() => {
    // reads from form — but form is not a signal, so we expose a method instead
    return 0; // driven from template using form.value
  });

  getVehiclesTotalFromForm(): number {
    return (
      (this.form.get("vehicles")?.value as InvoiceVehicle[]) || []
    ).reduce((s, v) => s + (+v.cost || 0), 0);
  }

  // ── Related type change ───────────────────────────────────────────────────

  async onRelatedTypeChange(type: string) {
    this.form.patchValue({ related_reference: null });
    if (type && type !== "other") {
      await this.svc.loadReferences(type as InvoiceRelatedType);
    } else {
      this.svc.references.set([]);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast("⚠️ يرجى تعبئة الحقول المطلوبة", "warning");
      return;
    }
    const raw = this.form.value;
    const vehiclesList: InvoiceVehicle[] = (raw.vehicles || [])
      .filter((v: any) => v.vehicle_plate)
      .map((v: any) => ({
        vehicle_plate: v.vehicle_plate,
        cost: +v.cost || 0,
        description: v.description || "",
      }));

    if (!vehiclesList.length) {
      this.showToast("⚠️ الرجاء إضافة سيارة واحدة على الأقل", "warning");
      return;
    }

    const totalCost = this.svc.calcTotalVehiclesCost(vehiclesList);
    const advanceAmt = +raw.advance_amount || 0;
    const settleAmt = raw.settlement_amount ? +raw.settlement_amount : null;

    const payload: Omit<Invoice, "id" | "created_at"> = {
      invoice_number: raw.invoice_number,
      vehicle_plate: vehiclesList.map((v) => v.vehicle_plate).join(", "), // for easier searching/filtering
      advance_amount: advanceAmt,
      advance_date: raw.advance_date || null,
      advance_purpose: raw.advance_purpose || null,
      advance_recipient: raw.advance_recipient || null,
      related_type: raw.related_type || null,
      related_reference: raw.related_reference || null,
      vehicles: vehiclesList,
      total_vehicles_cost: totalCost,
      invoice_received_date: raw.invoice_received_date || null,
      invoice_amount: raw.invoice_amount ? +raw.invoice_amount : null,
      settlement_date: raw.settlement_date || null,
      settlement_amount: settleAmt,
      difference_amount: this.svc.calcDifference(advanceAmt, settleAmt),
      status: raw.status,
      notes: raw.notes || null,
      attachments: raw.attachments || [],
    };

    const result = await this.svc.save(payload, this.editingId());
    this.showToast(result.message, result.ok ? "success" : "error");
    if (result.ok) this.resetForm();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  async edit(id: string) {
    const inv = await this.svc.getById(id);
    if (!inv) {
      this.showToast("❌ فشل تحميل الفاتورة", "error");
      return;
    }
    this.editingId.set(id);

    // Rebuild vehicles FormArray
    while (this.vehiclesArray.length) this.vehiclesArray.removeAt(0);
    const vList = inv.vehicles?.length
      ? inv.vehicles
      : [{ vehicle_plate: "", cost: 0, description: "" }];
    vList.forEach((v: InvoiceVehicle) => {
      const g = this.buildVehicleGroup();
      g.patchValue(v);
      this.vehiclesArray.push(g);
    });

    this.form.patchValue({
      invoice_number: inv.invoice_number,
      advance_amount: inv.advance_amount,
      advance_date: inv.advance_date || null,
      advance_purpose: inv.advance_purpose || "",
      advance_recipient: inv.advance_recipient || null,
      related_type: inv.related_type || null,
      related_reference: inv.related_reference || null,
      invoice_received_date: inv.invoice_received_date || null,
      invoice_amount: inv.invoice_amount || null,
      settlement_date: inv.settlement_date || null,
      settlement_amount: inv.settlement_amount || null,
      status: inv.status,
      notes: inv.notes || "",
      attachments: inv.attachments || [],
    });

    if (inv.related_type && inv.related_type !== "other") {
      await this.svc.loadReferences(inv.related_type);
    }

    document
      .getElementById("invoiceFormTop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // ── View ──────────────────────────────────────────────────────────────────

  async viewDetails(id: string) {
    const inv = await this.svc.getById(id);
    if (!inv) {
      this.showToast("❌ فشل عرض التفاصيل", "error");
      return;
    }
    this.selectedInvoice.set(inv);
    this.showDetailsModal.set(true);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const result = await this.svc.delete(id);
    if (result.message)
      this.showToast(result.message, result.ok ? "success" : "error");
  }

  // ── Table dispatcher ──────────────────────────────────────────────────────

  onTableAction(event: ActionEvent) {
    if (event.action === "view") this.viewDetails(event.row.id);
    if (event.action === "edit") this.edit(event.row.id);
    if (event.action === "delete") this.delete(event.row.id);
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

  removeAttachment(i: number) {
    const current = [...(this.form.get("attachments")?.value || [])];
    current.splice(i, 1);
    this.form.patchValue({ attachments: current });
  }

  openZoom(data: string) {
    this.zoomedImage.set(data);
    this.showImageModal.set(true);
  }
  get currentAttachments(): any[] {
    return this.form.get("attachments")?.value || [];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  resetForm() {
    this.form = this.buildForm();
    this.editingId.set(null);
    this.svc.references.set([]);
  }

  resetFilters() {
    this.filterNumber.set("");
    this.filterPlate.set("");
    this.filterStatus.set("");
    this.filterType.set("");
    this.filterFrom.set("");
    this.filterTo.set("");
  }

  exportToExcel() {
    this.svc.exportToExcel(this.filteredInvoices());
  }

  renderDiff(diff: number | null | undefined): string {
    if (diff == null) return "—";
    if (diff > 0)
      return `<span class="diff-negative">متبقي ${diff.toLocaleString("ar-EG")}</span>`;
    if (diff < 0)
      return `<span class="diff-positive">زيادة ${Math.abs(diff).toLocaleString("ar-EG")}</span>`;
    return `<span class="diff-zero">متوازن</span>`;
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

  // Expose label maps to template
  readonly statusLabels = STATUS_LABELS;
  readonly typeLabels = TYPE_LABELS;
}
