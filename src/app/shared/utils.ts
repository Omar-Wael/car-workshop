import { Injectable } from "@angular/core";
import { Workbook } from "exceljs";
import { saveAs } from "file-saver";

@Injectable({ providedIn: "root" })
export class UtilsService {
  formatCurrency(value: number, currency = "EGP"): string {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency,
    }).format(value);
  }

  formatDate(date: string | Date): string {
    if (!date) return "";
    return new Date(date).toLocaleDateString("ar-EG");
  }

  todayIso(): string {
    return new Date().toISOString().split("T")[0];
  }

  generateId(prefix = ""): string {
    return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // ---- Excel Export ----
  async exportToExcel(
    data: any[],
    filename: string,
    sheetName = "Sheet1",
    options: {
      headers?: string[]; // optional: force specific column order
      useKeysAsHeaders?: boolean; // default: true
    } = {},
  ): Promise<void> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (!data || data.length === 0) {
      worksheet.addRow(["لا توجد بيانات"]);
      // You can style it if you want
    } else {
      // Decide headers
      let headers: string[] = options.headers || [];

      if (headers.length === 0 && options.useKeysAsHeaders !== false) {
        headers = Object.keys(data[0] || {});
      }

      if (headers.length > 0) {
        // Add header row
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9EAD3" }, // light green
        };
        headerRow.alignment = { horizontal: "center", vertical: "middle" };
      }

      // Add data rows
      data.forEach((item) => {
        if (headers.length > 0) {
          // ordered by headers
          const rowValues = headers.map((key) => item[key] ?? "");
          worksheet.addRow(rowValues);
        } else {
          // just dump values (no guaranteed order)
          worksheet.addRow(Object.values(item));
        }
      });

      // Optional: auto-size columns
      if (worksheet.columns) {
        worksheet.columns.forEach((column, idx) => {
          let maxLength = (column.header?.toString()?.length ?? 0) + 2;

          // only sample first ~100–200 rows if sheet is huge
          const maxRowsToCheck = Math.min(worksheet.rowCount, 150);
          for (let r = 2; r <= maxRowsToCheck; r++) {
            const cell = worksheet.getCell(r, idx + 1);
            const val = cell.value?.toString() ?? "";
            if (val.length > maxLength) maxLength = val.length;
          }

          column.width = Math.min(60, Math.max(10, maxLength + 2));
        });
      }
    }

    // Generate & save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `${filename}.xlsx`);
  }

  // ---- Excel Import ----
  async importFromExcel(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) throw new Error("لا يمكن قراءة محتوى الملف");

          const workbook = new Workbook();
          await workbook.xlsx.load(arrayBuffer);

          const worksheet = workbook.worksheets[0]; // first sheet
          if (!worksheet) throw new Error("لم يتم العثور على ورقة عمل");

          const jsonData: any[] = [];

          // Get headers from first row (assuming first row = headers)
          const headers: string[] = [];
          worksheet.getRow(1).eachCell((cell) => {
            headers.push(cell.value?.toString().trim() || "");
          });

          // Start from row 2
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // skip header

            const obj: any = {};
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              const header = headers[colNumber - 1];
              if (header) {
                obj[header] = cell.value;
              }
            });

            jsonData.push(obj);
          });

          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error("فشل قراءة الملف"));

      reader.readAsArrayBuffer(file);
    });
  }

  // ---- Confirmation ----
  confirm(message: string): boolean {
    return window.confirm(message);
  }

  // ---- Toast (simple) ----
  toast(message: string, type: "success" | "error" | "info" = "success"): void {
    const colors = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = `
      position:fixed;top:1rem;left:50%;transform:translateX(-50%);
      background:${colors[type]};color:#fff;padding:.75rem 1.5rem;
      border-radius:.5rem;z-index:9999;font-size:.9rem;direction:rtl;
      box-shadow:0 4px 12px rgba(0,0,0,.2);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}
