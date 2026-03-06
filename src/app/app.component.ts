import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TabId, TabConfig } from "./core/models";
import { SupabaseService } from "./core/services/supabase.service";

import { VehiclesComponent } from "./features/vehicles/vehicles.component";
import { SparePartsComponent } from "./features/spare-parts/spare-parts.component";
import { MaintenanceComponent } from "./features/maintenance/maintenance.component";
import { OverhaulsComponent } from "./features/overhauls/overhauls.component";
import { CheckComponent } from "./features/check/check.component";
import { InvoicesComponent } from "./features/invoices/invoices.component";
import { TechniciansComponent } from "./features/technicians/technicians.component";
import { DepartmentsComponent } from "./features/departments/departments.component";
import { EnginesComponent } from "./features/engines/engines.component";
import { CatalogComponent } from "./features/catalog/catalog.component";
import { DailyNotesComponent } from "./features/daily-notes/daily-notes.component";
import { StatsComponent } from "./features/stats/stats.component";

@Component({
  selector: "app-root",
  imports: [
    CommonModule,
    VehiclesComponent,
    SparePartsComponent,
    MaintenanceComponent,
    OverhaulsComponent,
    CheckComponent,
    InvoicesComponent,
    TechniciansComponent,
    DepartmentsComponent,
    EnginesComponent,
    CatalogComponent,
    DailyNotesComponent,
    StatsComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {
  activeTab = signal<TabId>("vehicles");
  today = new Date();

  tabs: TabConfig[] = [
    { id: "vehicles", label: "المركبات", icon: "🚗" },
    { id: "spare-parts", label: "قطع الغيار", icon: "🔧" },
    { id: "maintenance", label: "الصيانة", icon: "🛠️" },
    { id: "overhauls", label: "الأعطال الكبرى", icon: "⚙️" },
    { id: "checks", label: "الفحوصات", icon: "✅" },
    { id: "invoices", label: "الفواتير", icon: "🧾" },
    { id: "technicians", label: "الفنيون", icon: "👷" },
    { id: "departments", label: "الأقسام", icon: "🏢" },
    { id: "engines", label: "المحركات", icon: "⚡" },
    { id: "catalog", label: "كتالوج قطع الغيار", icon: "📋" },
    { id: "daily-notes", label: "الملاحظات اليومية", icon: "📝" },
    { id: "stats", label: "الإحصائيات", icon: "📊" },
  ];

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    await Promise.all([
      this.db.loadDepartmentsCache(),
      this.db.loadVehiclesCache(),
    ]);
  }

  setActiveTab(id: TabId) {
    this.activeTab.set(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
