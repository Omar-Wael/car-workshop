import { Component, OnInit, signal, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  RouterModule,
  RouterOutlet,
  Router,
  NavigationEnd,
} from "@angular/router";
import { filter } from "rxjs/operators";
import { SupabaseService } from "./core/services/supabase.service";
import { TabConfig, TabId } from "./core/models/index";

@Component({
  selector: "app-root",
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {
  activeRoute = signal<string>("dashboard");
  today = new Date();
  mobileMenuOpen = signal(false);

  // Dropdown open states
  openDropdown = signal<string | null>(null);

  allTabs: TabConfig[] = [
    { id: "dashboard", label: "لوحة التحكم", icon: "🏠", group: "core" },
    { id: "vehicles", label: "المركبات", icon: "🚗", group: "operations" },
    { id: "spare-parts", label: "قطع الغيار", icon: "🔧", group: "operations" },
    {
      id: "catalog",
      label: "كتالوج قطع الغيار",
      icon: "📦",
      group: "operations",
    },
    { id: "maintenance", label: "الصيانة", icon: "⚙️", group: "operations" },
    { id: "overhauls", label: "العمرات", icon: "🔨", group: "operations" },
    { id: "checks", label: "الشيكات", icon: "💵", group: "operations" },
    { id: "invoices", label: "الفواتير", icon: "📄", group: "operations" },
    { id: "technicians", label: "الفنيين", icon: "👨‍🔧", group: "references" },
    { id: "departments", label: "الإدارات", icon: "🏢", group: "references" },
    { id: "engines", label: "المحركات", icon: "🔩", group: "references" },
    { id: "stats", label: "التقارير", icon: "📊", group: "reporting" },
    {
      id: "daily-notes",
      label: "الملاحظات اليومية",
      icon: "📝",
      group: "reporting",
    },
    { id: "search", label: "البحث", icon: "🔍", group: "reporting" },
    { id: "data", label: "البيانات", icon: "💾", group: "reporting" },
  ];

  get operationTabs() {
    return this.allTabs.filter((t) => t.group === "operations");
  }
  get referenceTabs() {
    return this.allTabs.filter((t) => t.group === "references");
  }
  get reportingTabs() {
    return this.allTabs.filter((t) => t.group === "reporting");
  }

  // Check if any tab in a group is active
  isGroupActive(group: string): boolean {
    return this.allTabs
      .filter((t) => t.group === group)
      .some((t) => this.activeRoute() === t.id);
  }

  // Get active tab label for dropdown button
  getActiveTabInGroup(group: string): string {
    const activeTab = this.allTabs.find(
      (t) => t.group === group && this.activeRoute() === t.id,
    );
    return activeTab ? activeTab.label : this.getGroupDefaultLabel(group);
  }

  private getGroupDefaultLabel(group: string): string {
    switch (group) {
      case "operations":
        return "التشغيل";
      case "references":
        return "البيانات المرجعية";
      case "reporting":
        return "التقارير والبيانات";
      default:
        return "";
    }
  }

  // Simplified hover handlers
  onMouseEnter(dropdown: string) {
    if (!this.mobileMenuOpen()) {
      this.openDropdown.set(dropdown);
    }
  }

  onMouseLeave() {
    if (!this.mobileMenuOpen()) {
      // Small delay to allow moving to menu
      setTimeout(() => {
        if (this.openDropdown() !== null) {
          // Check if mouse is still over dropdown container or menu
          // This will be handled by the mouseleave events on the elements
        }
      }, 100);
    }
  }

  toggleDropdown(dropdown: string) {
    if (this.mobileMenuOpen()) {
      if (this.openDropdown() === dropdown) {
        this.openDropdown.set(null);
      } else {
        this.openDropdown.set(dropdown);
      }
    }
  }

  closeDropdown() {
    this.openDropdown.set(null);
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent) {
    // Close dropdowns when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest(".dropdown-container")) {
      this.closeDropdown();
    }
  }

  constructor(
    private db: SupabaseService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const seg = (e.urlAfterRedirects || "/").split("/")[1] || "dashboard";
        this.activeRoute.set(seg);
        this.mobileMenuOpen.set(false);
        this.closeDropdown();
      });
    const init = (this.router.url || "/").split("/")[1] || "dashboard";
    this.activeRoute.set(init);
    await Promise.all([
      this.db.loadDepartmentsCache(),
      this.db.loadVehiclesCache(),
    ]);
  }

  navigate(id: string) {
    this.router.navigate(["/", id]);
    this.closeDropdown();
  }

  isActive(id: string): boolean {
    return this.activeRoute() === id;
  }
}
