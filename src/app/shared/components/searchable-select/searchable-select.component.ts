import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ElementRef,
  HostListener,
  forwardRef,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from "@angular/forms";
import { SelectOption } from "src/app/core/models";
import { SsLabelPipe } from "../../Pipes/ss-label.pipe";

@Component({
  selector: "app-searchable-select",
  imports: [CommonModule, FormsModule, SsLabelPipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  templateUrl: "./searchable-select.component.html",
  styleUrl: "./searchable-select.component.css",
})
export class SearchableSelectComponent
  implements ControlValueAccessor, OnChanges
{
  // ── Inputs ──
  @Input() options: SelectOption[] = [];
  @Input() placeholder = "اختر...";
  @Input() searchPlaceholder = "بحث...";
  @Input() multiple = false;
  @Input() disabled = false;
  @Input() invalid = false;
  @Input() maxHeight = "260px";

  // Allow direct [value] binding without formControlName (e.g. filter bars)
  @Input() set value(val: string | string[] | null) {
    if (val !== undefined) this.writeValue(val);
  }

  // ── Outputs ──
  @Output() selectionChange = new EventEmitter<string | string[]>();

  // ── Internal state ──
  isOpen = signal(false);
  searchTerm = signal("");

  // Single select
  singleValue = signal<string>("");
  // Multi select
  multiValues = signal<string[]>([]);

  // ── CVA callbacks ──
  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    // If options change and we have a value, re-validate it still exists
  }

  // ── Computed ──
  filteredOptions = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.options;
    return this.options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.sublabel || "").toLowerCase().includes(term) ||
        o.value.toLowerCase().includes(term),
    );
  });

  displayLabel = computed(() => {
    if (this.multiple) {
      const vals = this.multiValues();
      if (!vals.length) return this.placeholder;
      if (vals.length === 1) {
        return this.options.find((o) => o.value === vals[0])?.label ?? vals[0];
      }
      return `${vals.length} عناصر محددة`;
    } else {
      const val = this.singleValue();
      if (!val) return this.placeholder;
      return this.options.find((o) => o.value === val)?.label ?? val;
    }
  });

  hasValue = computed(() =>
    this.multiple ? this.multiValues().length > 0 : !!this.singleValue(),
  );

  selectedLabels = computed(() =>
    this.multiValues().map(
      (v) => this.options.find((o) => o.value === v)?.label ?? v,
    ),
  );

  // ── ControlValueAccessor ──
  writeValue(val: string | string[] | null): void {
    if (this.multiple) {
      this.multiValues.set(Array.isArray(val) ? val : val ? [val] : []);
    } else {
      this.singleValue.set((val as string) ?? "");
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // ── Interactions ──
  toggle() {
    if (this.disabled) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      setTimeout(() => {
        this.elRef.nativeElement.querySelector(".search-input")?.focus();
      }, 50);
    } else {
      this.searchTerm.set("");
    }
    this.onTouched();
  }

  selectOption(option: SelectOption) {
    if (this.multiple) {
      const current = this.multiValues();
      const idx = current.indexOf(option.value);
      const next =
        idx >= 0
          ? current.filter((v) => v !== option.value)
          : [...current, option.value];
      this.multiValues.set(next);
      this.onChange(next);
      this.selectionChange.emit(next);
      // Keep open for multi-select
    } else {
      this.singleValue.set(option.value);
      this.onChange(option.value);
      this.selectionChange.emit(option.value);
      this.isOpen.set(false);
      this.searchTerm.set("");
    }
  }

  isSelected(value: string): boolean {
    return this.multiple
      ? this.multiValues().includes(value)
      : this.singleValue() === value;
  }

  removeTag(value: string, event: Event) {
    event.stopPropagation();
    const next = this.multiValues().filter((v) => v !== value);
    this.multiValues.set(next);
    this.onChange(next);
    this.selectionChange.emit(next);
  }

  clearAll(event: Event) {
    event.stopPropagation();
    if (this.multiple) {
      this.multiValues.set([]);
      this.onChange([]);
      this.selectionChange.emit([]);
    } else {
      this.singleValue.set("");
      this.onChange("");
      this.selectionChange.emit("");
    }
  }

  // ── Close on outside click ──
  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
      this.searchTerm.set("");
    }
  }

  @HostListener("document:keydown.escape")
  onEscape() {
    this.isOpen.set(false);
    this.searchTerm.set("");
  }
}
