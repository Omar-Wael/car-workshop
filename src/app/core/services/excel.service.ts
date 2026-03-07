import { Injectable } from "@angular/core";
import * as ExcelJS from "exceljs";
import { ExcelColumn, ImportResult } from "../models";

@Injectable({
  providedIn: "root",
})
export class ExcelService {
  async export(
    data: any[],
    columns: ExcelColumn[],
    filename: string,
    sheetName = "البيانات",
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "System";
      workbook.lastModifiedBy = "System";
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ rightToLeft: true }],
      });

      // Add headers
      const headerRow = worksheet.addRow(columns.map((c) => c.header));

      // Style header row
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };

      // Add data rows
      data.forEach((row) => {
        const rowData = columns.map((col) => {
          if (col.exportFn) return col.exportFn(row);
          const val = this._getNestedValue(row, col.key);

          if (col.type === "date" && val) {
            return new Date(val);
          }
          if (col.type === "boolean") return val ? "نعم" : "لا";
          return val ?? "";
        });

        const excelRow = worksheet.addRow(rowData);

        // Format cells based on type
        columns.forEach((col, index) => {
          const cell = excelRow.getCell(index + 1);
          if (col.type === "number") {
            cell.numFmt = "#,##0.00";
          } else if (col.type === "date") {
            cell.numFmt = "yyyy-mm-dd";
          }
        });
      });

      // Set column widths
      columns.forEach((col, index) => {
        worksheet.getColumn(index + 1).width = col.width || 22;
      });

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      this._downloadFile(buffer, `${filename}_${this._dateStamp()}.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      alert("❌ حدث خطأ أثناء تصدير الملف");
    }
  }

  /**
   * Export multiple sheets in one workbook.
   */
  async exportMultiSheet(
    sheets: { data: any[]; columns: ExcelColumn[]; sheetName: string }[],
    filename: string,
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "System";
      workbook.lastModifiedBy = "System";

      sheets.forEach(({ data, columns, sheetName }) => {
        const worksheet = workbook.addWorksheet(sheetName, {
          views: [{ rightToLeft: true }],
        });

        // Add headers
        const headerRow = worksheet.addRow(columns.map((c) => c.header));
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1D4ED8" },
        };

        // Add data
        data.forEach((row) => {
          const rowData = columns.map((col) => {
            if (col.exportFn) return col.exportFn(row);
            const val = this._getNestedValue(row, col.key);
            if (col.type === "date" && val) return new Date(val);
            if (col.type === "boolean") return val ? "نعم" : "لا";
            return val ?? "";
          });
          worksheet.addRow(rowData);
        });

        // Set column widths
        columns.forEach((col, index) => {
          worksheet.getColumn(index + 1).width = col.width || 22;
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      this._downloadFile(buffer, `${filename}_${this._dateStamp()}.xlsx`);
    } catch (error) {
      console.error("Multi-sheet export error:", error);
      alert("❌ حدث خطأ أثناء تصدير الملف");
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────

  /**
   * Read an .xlsx/.xls/.csv file and return typed rows.
   * @param file            File object from <input type="file">
   * @param columns         Column definitions — headers must match exactly
   * @param skipRows        Number of header rows to skip (default: 1)
   */
  async import<T = any>(
    file: File,
    columns: ExcelColumn[],
    skipRows = 1,
  ): Promise<ImportResult<T>> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return {
          data: [],
          errors: ["الملف لا يحتوي على أوراق عمل"],
          skipped: 0,
        };
      }

      // Get header row
      const headerRow = worksheet.getRow(skipRows);
      const headerValues: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headerValues[colNumber - 1] = cell.text?.trim() || "";
      });

      // Map columns to indices
      const colIndexMap = new Map<string, number>();
      columns.forEach((col) => {
        const idx = headerValues.findIndex((h) => h === col.header.trim());
        if (idx >= 0) {
          colIndexMap.set(col.key, idx);
        }
      });

      const data: T[] = [];
      const errors: string[] = [];
      let skipped = 0;

      // Process data rows
      const rowCount = worksheet.rowCount;
      for (let rowNum = skipRows + 1; rowNum <= rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);

        // Check if row is empty
        let isEmpty = true;
        row.eachCell(() => {
          isEmpty = false;
        });

        if (isEmpty) {
          skipped++;
          continue;
        }

        const obj: any = {};
        columns.forEach((col) => {
          const idx = colIndexMap.get(col.key);
          if (idx === undefined) return;

          const cell = row.getCell(idx + 1);
          let raw = cell.value;

          if (col.importFn) {
            obj[col.key] = col.importFn(raw);
          } else if (col.type === "number") {
            obj[col.key] =
              raw !== null && raw !== undefined ? Number(raw) : null;
          } else if (col.type === "boolean") {
            if (typeof raw === "string") {
              obj[col.key] = raw === "نعم" || raw === "true" || raw === "1";
            } else {
              obj[col.key] = !!raw;
            }
          } else if (col.type === "date") {
            if (raw instanceof Date) {
              obj[col.key] = raw.toISOString().split("T")[0];
            } else if (raw) {
              obj[col.key] = String(raw).substring(0, 10);
            } else {
              obj[col.key] = null;
            }
          } else {
            obj[col.key] =
              raw !== null && raw !== undefined ? String(raw).trim() : null;
          }
        });

        data.push(obj as T);
      }

      return { data, errors, skipped };
    } catch (error: any) {
      console.error("Import error:", error);
      return {
        data: [],
        errors: [`خطأ في قراءة الملف: ${error?.message || "خطأ غير معروف"}`],
        skipped: 0,
      };
    }
  }

  /**
   * Generate and download an empty template .xlsx for the user to fill.
   */
  async downloadTemplate(
    columns: ExcelColumn[],
    filename: string,
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("النموذج", {
        views: [{ rightToLeft: true }],
      });

      // Add headers
      const headerRow = worksheet.addRow(columns.map((c) => c.header));

      // Style headers
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
      };

      // Add a sample row with instructions (optional)
      const sampleRow = worksheet.addRow(
        columns.map((c) => {
          switch (c.type) {
            case "number":
              return 0;
            case "date":
              return new Date();
            case "boolean":
              return "نعم/لا";
            default:
              return "نص";
          }
        }),
      );

      // Style sample row as italic and light gray
      sampleRow.font = { italic: true, color: { argb: "FF666666" } };

      // Set column widths
      columns.forEach((col, index) => {
        worksheet.getColumn(index + 1).width = col.width || 22;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      this._downloadFile(buffer, `template_${filename}.xlsx`);
    } catch (error) {
      console.error("Template download error:", error);
      alert("❌ حدث خطأ أثناء إنشاء النموذج");
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _downloadFile(buffer: ArrayBuffer, fileName: string): void {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private _dateStamp(): string {
    return new Date().toISOString().split("T")[0];
  }

  private _getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((o, k) => o?.[k], obj);
  }
}
