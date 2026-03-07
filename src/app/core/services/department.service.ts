import { Injectable, signal } from "@angular/core";
import { SupabaseService } from "../../core/services/supabase.service";
import { Department } from "../models";

@Injectable({
  providedIn: "root",
})
export class DepartmentService {
  departments = signal<Department[]>([]);
  loading = signal(false);
  saving = signal(false);

  constructor(private db: SupabaseService) {}

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.db.supabase
        .from("departments")
        .select("*")
        .order("name");
      if (error) throw error;
      this.departments.set(data || []);
    } catch (err: any) {
      console.error("خطأ في تحميل الإدارات:", err);
    } finally {
      this.loading.set(false);
    }
  }

  async getById(id: string): Promise<Department | null> {
    const { data, error } = await this.db.supabase
      .from("departments")
      .select("*")
      .eq("id", id)
      .single();
    return error ? null : data;
  }

  async getVehicleCount(departmentName: string): Promise<number> {
    const { count } = await this.db.supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("department", departmentName);
    return count || 0;
  }

  async save(
    name: string,
    editingId: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    this.saving.set(true);
    const trimmed = name.trim();
    try {
      // Duplicate check
      let q = this.db.supabase
        .from("departments")
        .select("id")
        .ilike("name", trimmed);
      if (editingId) q = q.neq("id", editingId);
      const { data: existing } = await q;
      if (existing?.length)
        return { ok: false, message: "هذه الإدارة موجودة بالفعل" };

      if (editingId) {
        const snap = this.departments();
        this.departments.update((list) =>
          list.map((d) => (d.id === editingId ? { ...d, name: trimmed } : d)),
        );
        const { error } = await this.db.supabase
          .from("departments")
          .update({ name: trimmed })
          .eq("id", editingId);
        if (error) {
          this.departments.set(snap);
          throw error;
        }
        return { ok: true, message: `✅ تم تحديث الإدارة إلى "${trimmed}"` };
      } else {
        const { data: inserted, error } = await this.db.supabase
          .from("departments")
          .insert([{ name: trimmed }])
          .select()
          .single();
        if (error) throw error;
        this.departments.update((list) =>
          [...list, inserted].sort((a, b) =>
            a.name.localeCompare(b.name, "ar"),
          ),
        );
        return { ok: true, message: `✅ تم إضافة الإدارة "${trimmed}"` };
      }
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحفظ: " + err.message };
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    const dept = await this.getById(id);
    if (!dept) return { ok: false, message: "❌ الإدارة غير موجودة" };
    const usedCount = await this.getVehicleCount(dept.name);
    let msg = `حذف الإدارة "${dept.name}"?\n`;
    if (usedCount) msg += `\n⚠️ مستخدمة في ${usedCount} سيارة`;
    if (!confirm(msg + "\n\nهل أنت متأكد؟")) return { ok: false, message: "" };

    const snap = this.departments();
    this.departments.update((list) => list.filter((d) => d.id !== id));
    try {
      const { error } = await this.db.supabase
        .from("departments")
        .delete()
        .eq("id", id);
      if (error) {
        this.departments.set(snap);
        throw error;
      }
      return { ok: true, message: `✅ تم حذف الإدارة "${dept.name}"` };
    } catch (err: any) {
      return { ok: false, message: "❌ فشل الحذف: " + err.message };
    }
  }
}
