import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  TableColumn,
  TableAction,
  ActionEvent,
  SortState,
} from "src/app/core/models";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

@Component({
  selector: "app-data-table",
  imports: [CommonModule, FormsModule],
  templateUrl: "./data-table.component.html",
  styleUrl: "./data-table.component.css",
})
export class DataTableComponent implements OnChanges {
  // ── Inputs ─────────────────────────────────────────────────────────────
  @Input() data: any[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() actions: TableAction[] = [];
  @Input() loading = false;
  @Input() emptyIcon = "📋";
  @Input() emptyTitle = "لا توجد بيانات";
  @Input() emptySubtitle = "";
  @Input() defaultPageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50, 100];
  @Input() showIndex = true;
  @Input() stickyActions = true;
  @Input() rowClass?: (row: any) => string;

  // ── Outputs ────────────────────────────────────────────────────────────
  @Output() actionClick = new EventEmitter<ActionEvent>();
  @Output() rowClick = new EventEmitter<any>();

  // ── Internal state ─────────────────────────────────────────────────────
  pageSize = signal(10);
  currentPage = signal(1);
  sort = signal<SortState | null>(null);

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["defaultPageSize"]) {
      this.pageSize.set(this.defaultPageSize);
    }
    if (changes["data"]) {
      this.currentPage.set(1);
    }
  }

  // ── Computed pipeline ──────────────────────────────────────────────────
  sortedData = computed(() => {
    const s = this.sort();
    if (!s) return this.data;
    return [...this.data].sort((a, b) => {
      const av = a[s.key] ?? "";
      const bv = b[s.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), "ar", { numeric: true });
      return s.dir === "asc" ? cmp : -cmp;
    });
  });

  totalItems = computed(() => this.sortedData().length);

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / this.pageSize())),
  );

  paginatedData = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sortedData().slice(start, start + this.pageSize());
  });

  startIndex = computed(() =>
    this.totalItems() === 0
      ? 0
      : (this.currentPage() - 1) * this.pageSize() + 1,
  );

  endIndex = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalItems()),
  );

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7)
      return Array.from({ length: total }, (_, i) => i + 1) as (
        | number
        | "..."
      )[];

    const pages: (number | "...")[] = [1];
    if (current > 3) pages.push("...");
    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(total - 1, current + 1);
      i++
    ) {
      pages.push(i);
    }
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
  });

  // ── Sort ───────────────────────────────────────────────────────────────
  toggleSort(key: string) {
    const current = this.sort();
    if (current?.key === key) {
      this.sort.set({ key, dir: current.dir === "asc" ? "desc" : "asc" });
    } else {
      this.sort.set({ key, dir: "asc" });
    }
    this.currentPage.set(1);
  }

  sortIcon(key: string): string {
    const s = this.sort();
    if (!s || s.key !== key) return "↕";
    return s.dir === "asc" ? "↑" : "↓";
  }

  isSortActive(key: string): boolean {
    return this.sort()?.key === key;
  }

  // ── Pagination ─────────────────────────────────────────────────────────
  goToPage(page: number | "...") {
    if (page === "...") return;
    this.currentPage.set(
      Math.max(1, Math.min(page as number, this.totalPages())),
    );
  }

  onPageSizeChange(event: Event) {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.currentPage.set(1);
  }

  prevPage() {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }
  nextPage() {
    if (this.currentPage() < this.totalPages())
      this.currentPage.update((p) => p + 1);
  }

  // ── Actions ────────────────────────────────────────────────────────────
  onAction(action: TableAction, row: any, event: Event) {
    event.stopPropagation();
    if (action.disabled?.(row)) return;
    this.actionClick.emit({ action: action.id, row });
  }

  isActionHidden(action: TableAction, row: any): boolean {
    return action.hidden ? action.hidden(row) : false;
  }

  isActionDisabled(action: TableAction, row: any): boolean {
    return action.disabled ? action.disabled(row) : false;
  }

  // ── Cell ───────────────────────────────────────────────────────────────
  getCellValue(row: any, col: TableColumn): string {
    if (col.render) return col.render(row);
    const val = col.key.split(".").reduce((o, k) => o?.[k], row);
    return val === null || val === undefined || val === "" ? "—" : String(val);
  }

  // getCellHtml(row: any, col: TableColumn): string {
  //   return col.renderHtml ? col.renderHtml(row) : "";
  // }
  getCellHtml(row: any, col: TableColumn): SafeHtml {
    const html = col.renderHtml ? col.renderHtml(row) : "";
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getCellClass(row: any, col: TableColumn): string {
    const base = col.align ? `align-${col.align}` : "";
    const custom = col.cellClass ? col.cellClass(row) : "";
    return [base, custom].filter(Boolean).join(" ");
  }

  getRowClass(row: any): string {
    return this.rowClass ? this.rowClass(row) : "";
  }

  isEllipsis(p: number | "..."): boolean {
    return p === "...";
  }
  trackByIndex(i: number) {
    return i;
  }
  trackByKey(_: number, col: TableColumn) {
    return col.key;
  }
}
