import { Injectable, signal } from "@angular/core";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class SupabaseService {
  private client: SupabaseClient;

  // Shared cache signals
  readonly departments = signal<any[]>([]);
  readonly vehicles = signal<any[]>([]);
  private lastFetch = 0;

  constructor() {
    this.client = createClient(
      environment.supabase.url,
      environment.supabase.key,
      {
        auth: {
          lock: async (
            name: string,
            acquireTimeout: number,
            fn: () => Promise<any>,
          ) => {
            try {
              return await navigator.locks.request(
                name,
                { ifAvailable: true },
                async (lock: Lock | null) => {
                  if (!lock) return fn();
                  return fn();
                },
              );
            } catch {
              return fn();
            }
          },
        },
      },
    );
  }

  get supabase(): SupabaseClient {
    return this.client;
  }

  // ---- Generic CRUD ----
  async getAll<T>(table: string, query?: (q: any) => any): Promise<T[]> {
    let q = this.client.from(table).select("*");
    if (query) q = query(q);
    const { data, error } = await q;
    if (error) throw error;
    return data as T[];
  }

  async getById<T>(table: string, id: number): Promise<T | null> {
    const { data, error } = await this.client
      .from(table)
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as T;
  }

  async insert<T>(table: string, record: Partial<T>): Promise<T> {
    const { data, error } = await this.client
      .from(table)
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }

  async update<T>(table: string, id: number, record: Partial<T>): Promise<T> {
    const { data, error } = await this.client
      .from(table)
      .update(record)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }

  async delete(table: string, id: number): Promise<void> {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  // ---- Image upload ----
  async uploadImage(bucket: string, path: string, file: File): Promise<string> {
    if (file.size > environment.maxFileSize) {
      throw new Error(
        `حجم الملف كبير جداً. الحد الأقصى ${environment.maxFileSize / 1024 / 1024} MB`,
      );
    }
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteImage(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) throw error;
  }

  // ---- Cached lookups ----
  async loadDepartmentsCache(): Promise<void> {
    const now = Date.now();
    if (
      now - this.lastFetch < environment.cacheDuration &&
      this.departments().length
    )
      return;
    const { data } = await this.client
      .from("departments")
      .select("*")
      .order("name");
    if (data) {
      this.departments.set(data);
      this.lastFetch = now;
    }
  }

  async loadVehiclesCache(): Promise<void> {
    const { data } = await this.client
      .from("vehicles")
      .select("id, plate_number, type")
      .order("plate_number");
    if (data) this.vehicles.set(data);
  }

  invalidateCache(): void {
    this.lastFetch = 0;
  }
}
