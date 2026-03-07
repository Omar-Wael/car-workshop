// ============================================================
// models/index.ts - All application interfaces & types
// ============================================================

export interface Vehicle {
  id?: string; // uuid
  plate_number: string;
  type?: string;
  brand?: string;
  model?: string;
  year: number | null;
  chassis_number: string | null;
  engine_number: string | null;
  fuel_type?: string;
  department?: string; // text field, not foreign key
  engine_oil: number | null;
  engine_oil_type: string | null;
  transmission_oil: number | null;
  transmission_oil_type: string | null;
  notes: string | null;
  status: string; // 'نشطة' | 'متوقفة للإصلاح' | 'عمرة' | 'متوقفة للترخيص' | 'متوقفة للتكهين' | 'في الانتظار'
  created_at: string;
  updated_at?: string;
  odometer_type?: string; // 'kilometers' | 'hours'
  engine_model?: string;
  engine_displacement?: number;
  engine_power_hp?: number;
  engine_cylinders?: number;
  engine_fuel_system?: string;
  oil_change_interval: number | null;
  oil_filter_interval: number | null;
  fuel_filter_interval: number | null;
  air_filter_interval: number | null;
  engine_id?: string; // uuid
  department_id?: string; // uuid
  images?: string[]; // for UI only, not in DB

  // joined fields
  engine_details?: Engine;
  department_details?: Department;
}

export interface Department {
  id?: string; // uuid
  name: string;
  created_at: string;
}

export interface Engine {
  id?: string; // uuid
  engine_code: string;
  engine_name: string;
  brand?: string;
  family?: string;
  cylinders?: number | null;
  bore_mm?: number | null;
  stroke_mm?: number | null;
  displacement_cc?: number | null;
  displacement_l?: number | null;
  cam_type?: string | null;
  valves_per_cyl?: number | null;
  total_valves?: number | null;
  timing_system?: string;
  fuel_system?: string;
  fuel_type?: string;
  power_hp?: number | null;
  power_rpm?: number | null;
  torque_nm?: number | null;
  torque_rpm?: number | null;
  compression_ratio?: string;
  compression_pressure_psi?: number | null;
  firing_order?: string;
  block_material?: string;
  head_material?: string;
  engine_length_mm?: number | null;
  engine_width_mm?: number | null;
  engine_height_mm?: number | null;
  dry_weight_kg?: number | null;
  oil_capacity_l?: number | null;
  oil_type?: string;
  cooling_type?: string;
  is_active?: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface SparePart {
  id?: string; // uuid
  request_number: string;
  vehicle_plate: string;
  department: string | null;
  status: string;
  purchase_request_number?: string;
  items?: any[]; // ARRAY type in PostgreSQL
  attachments?: any; // jsonb
  created_at: string;
  odometer_reading?: number;
  odometer_type?: string;
  technician_name?: string;
  technician_id?: string; // uuid
  receiver_committee_name?: string;
  request_date?: string;

  // joined fields
  technician?: Technician;
  vehicle?: Vehicle;
}

export interface SparePartCatalog {
  id?: string; // uuid
  part_name: string;
  part_number?: string;
  serial_number?: string;
  category?: string;
  unit?: string; // Default 'عدد'
  compatible_plates?: string[]; // ARRAY type
  notes?: string;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Maintenance {
  id?: string; // uuid
  vehicle_plate: string;
  entry_date?: string;
  expected_exit_date?: string;
  exit_date?: string;
  repair_work?: string;
  technicians?: string; // text field, not relation
  linked_request_number?: string;
  has_external_work?: boolean;
  external_cost: number | null;
  status: string | null;
  attachments?: any; // jsonb
  created_at: string;
  odometer_reading: number | null;
  odometer_type?: string;
  maintenance_type?: string;

  // joined fields
  vehicle?: Vehicle;
}

export interface Overhaul {
  id?: string; // uuid
  vehicle_plate: string;
  entry_date?: string;
  expected_exit_date?: string;
  exit_date?: string;
  run_in_period_days: number | null;
  type?: string;
  quotation_value: number | null;
  quotation_received?: boolean;
  check_received?: boolean;
  notes?: string;
  status: string | null;
  attachments?: any; // jsonb
  created_at: string;
  odometer_reading: number | null;
  odometer_type?: string;
  technician_name?: string;
  technician_id?: string; // uuid

  // joined fields
  technician?: Technician;
  vehicle?: Vehicle;
}

export interface CheckVehicle {
  vehicle_plate: string;
  amount?: number | null;
  note?: string | null;
}

export interface Check {
  id?: string; // uuid
  check_number: string;
  check_amount: number;
  related_type: string;
  related_id?: string; // uuid
  related_reference?: string;
  stage_1_request_date?: string;
  stage_2_quotations_date?: string;
  stage_3_gm_approval_date?: string;
  stage_4_sector_head_approval_date?: string;
  stage_5_deputy_approval_date?: string;
  stage_6_board_chairman_approval_date?: string;
  stage_7_committee_approval_date?: string;
  stage_8_check_received_date?: string;
  current_stage: number;
  status?: string; // Default 'pending'
  total_vehicles_amount?: number;
  bank_name?: string;
  check_date?: string;
  beneficiary?: string;
  notes?: string;
  attachments?: any; // jsonb
  created_at: string;
  updated_at?: string;
  vehicle_plate?: string;
  vehicles?: any; // jsonb Default '[]'

  // joined fields
  vehicle?: Vehicle;
}

export interface InvoiceVehicle {
  vehicle_plate: string;
  cost: number;
  description?: string;
}

export interface Invoice {
  id?: string; // uuid
  invoice_number: string;
  advance_amount?: number;
  advance_date?: string;
  advance_purpose?: string;
  advance_recipient?: string;
  invoice_received_date?: string;
  invoice_amount: number | null;
  invoice_items?: any; // jsonb
  settlement_date?: string;
  settlement_amount: number | null;
  difference_amount: number | null;
  related_type?: string;
  related_id?: string; // uuid
  related_reference?: string;
  status: string; // Default 'advance_issued'
  notes?: string;
  attachments?: any; // jsonb
  created_at: string;
  updated_at?: string;
  vehicle_plate: string;
  vehicles?: any; // jsonb
  total_vehicles_cost?: number;

  // joined fields
  vehicle?: Vehicle;
}

export interface Technician {
  id?: string; // uuid
  employee_number?: string;
  full_name: string;
  phone?: string;
  email?: string;
  national_id?: string;
  department?: string; // text field, not relation
  position?: string;
  hire_date?: string;
  specializations?: any; // jsonb
  certifications?: any; // jsonb
  skill_level?: string; // Default 'متوسط'
  performance_rating?: number; // Default 3.0
  total_jobs?: number; // Default 0
  completed_jobs?: number; // Default 0
  pending_jobs?: number; // Default 0
  status?: string; // Default 'active'
  notes?: string;
  photo?: string;
  created_at: string;
  updated_at?: string;
}

export interface TechnicianReport {
  id?: string; // uuid
  technician_id?: string; // uuid
  technician_name: string;
  work_type: string;
  work_reference?: string;
  vehicle_plate?: string;
  work_date: string;
  work_description?: string;
  duration_hours?: number;
  quality_rating?: number;
  efficiency_rating?: number;
  notes?: string;
  created_at: string;

  // joined fields
  technician?: Technician;
  vehicle?: Vehicle;
}

export interface DailyNote {
  id?: string; // uuid
  note_date: string; // Default CURRENT_DATE
  vehicle_plate?: string;
  note_text: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;

  // joined fields
  vehicle?: Vehicle;
}

export interface OdometerReading {
  id?: string; // uuid
  vehicle_plate: string;
  reading_value: number;
  reading_type: string;
  reading_date: string;
  related_type?: string;
  related_id?: string; // uuid
  notes?: string;
  created_at: string;

  // joined fields
  vehicle?: Vehicle;
}

// ---- Filter types ----
export interface VehicleFilter {
  plate_number?: string;
  type?: string;
  brand?: string;
  model?: string;
  department?: string;
  status?: string;
  fuel_type?: string;
}

export interface MaintenanceFilter {
  vehicle_plate?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  maintenance_type?: string;
}

export interface SparePartFilter {
  request_number?: string;
  vehicle_plate?: string;
  department?: string;
  status?: string;
  technician_id?: string; // uuid
}

export interface TechnicianFilter {
  full_name?: string;
  department?: string;
  skill_level?: string;
  status?: string;
}

export interface OverhaulFilter {
  vehicle_plate?: string;
  status?: string;
  type?: string;
  technician_id?: string; // uuid
}

export interface CheckFilter {
  vehicle_plate?: string;
  status?: string;
  related_type?: string;
  bank_name?: string;
}

export interface InvoiceFilter {
  vehicle_plate?: string;
  status?: string;
  related_type?: string;
}

// ---- State management ----
export interface AppState {
  loading: boolean;
  error: string | null;
}

export interface EditingState {
  vehicle: string | null;
  sparePart: string | null;
  check: string | null;
  invoice: string | null;
  technician: string | null;
  maintenance: string | null;
  overhaul: string | null;
  engine: string | null;
  department: string | null;
  dailyNote: string | null;
  catalog: string | null;
  report: string | null;
}

// ---- Tab config ----
export type TabId =
  | "vehicles"
  | "spare-parts"
  | "maintenance"
  | "overhauls"
  | "checks"
  | "invoices"
  | "technicians"
  | "reports"
  | "departments"
  | "engines"
  | "catalog"
  | "daily-notes"
  | "odometer"
  | "stats";

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  group: "core" | "operations" | "references" | "reporting";
}

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string; // optional secondary text (e.g. department name under vehicle plate)
}

// ── Column definition ──────────────────────────────────────────────────────
export interface TableColumn {
  key: string; // property name on the data object
  label: string; // header text
  sortable?: boolean;
  width?: string; // e.g. '120px', 'auto'
  align?: "right" | "left" | "center";
  render?: (row: any) => string; // custom cell display value
  renderHtml?: (row: any) => string; // custom cell innerHTML (trusted HTML only)
  cellClass?: (row: any) => string; // dynamic CSS class per cell
}

// ── Action button definition ───────────────────────────────────────────────
export interface TableAction {
  id: string;
  label: string;
  icon: string;
  color?: "view" | "edit" | "delete" | "info" | "warn" | "success";
  hidden?: (row: any) => boolean;
  disabled?: (row: any) => boolean;
}

// ── Sort state ─────────────────────────────────────────────────────────────
export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

// ── Action click event ─────────────────────────────────────────────────────
export interface ActionEvent<T = any> {
  action: string;
  row: T;
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SparePartItem {
  name: string;
  quantity: number;
  unit: string;
  last_date?: string | null;
  with_sample: boolean;
  condition: "جديد" | "استيراد (مستعمل)";
  notes?: string | null;
  catalog_part_name?: string | null;
}

export interface Attachment {
  name: string;
  data: string; // base64 data URL
}

export interface CatalogPart {
  id: string;
  part_name: string;
  part_number?: string | null;
  serial_number?: string | null;
  category?: string | null;
  unit?: string | null;
  compatible_plates?: string[];
  notes?: string | null;
  is_active?: boolean;
  updated_at?: string;
  created_at?: string;
}

export interface StatCard {
  label: string;
  value: number | string;
  icon: string;
  color: string; // tailwind bg class
  route: string;
  sublabel?: string;
}

export interface StatusBreakdown {
  label: string;
  count: number;
  color: string;
}

export interface RecentActivity {
  type: string;
  icon: string;
  description: string;
  date: string;
  badge?: string;
  badgeClass?: string;
}

export interface ExcelColumn {
  key: string; // object property key
  header: string; // Arabic/display header in Excel
  width?: number; // column width in chars (default 20)
  type?: "string" | "number" | "date" | "boolean";
  // Optional transformer for export: row → cell value
  exportFn?: (row: any) => any;
  // Optional transformer for import: raw cell → typed value
  importFn?: (cell: any) => any;
}

export interface ImportResult<T = any> {
  data: T[];
  errors: string[];
  skipped: number;
}
