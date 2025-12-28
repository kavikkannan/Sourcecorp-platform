import { query } from '../db/pool';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FinanceService } from './finance.service';

export class ExportService {
  
  // ============================================
  // ELIGIBILITY EXPORT
  // ============================================

  static async exportEligibilityCSV(caseId: string): Promise<string> {
    const calculation = await FinanceService.getEligibilityByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!calculation || caseResult.rows.length === 0) {
      throw new Error('Eligibility calculation or case not found');
    }

    const caseData = caseResult.rows[0];

    const lines = [
      'Case Number,Monthly Income,Eligible Amount,Requested Amount,Result,Calculated At',
      `"${caseData.case_number}","${calculation.monthly_income}","${calculation.eligible_amount}","${calculation.requested_amount}","${calculation.result}","${calculation.calculated_at}"`,
    ];

    return lines.join('\n');
  }

  static async exportEligibilityExcel(caseId: string): Promise<Buffer> {
    const calculation = await FinanceService.getEligibilityByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!calculation || caseResult.rows.length === 0) {
      throw new Error('Eligibility calculation or case not found');
    }

    const caseData = caseResult.rows[0];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Eligibility Calculation');

    // Headers
    worksheet.columns = [
      { header: 'Case Number', key: 'case_number', width: 20 },
      { header: 'Monthly Income', key: 'monthly_income', width: 15 },
      { header: 'Eligible Amount', key: 'eligible_amount', width: 15 },
      { header: 'Requested Amount', key: 'requested_amount', width: 15 },
      { header: 'Result', key: 'result', width: 15 },
      { header: 'Calculated At', key: 'calculated_at', width: 20 },
    ];

    // Data
    worksheet.addRow({
      case_number: caseData.case_number,
      monthly_income: calculation.monthly_income,
      eligible_amount: calculation.eligible_amount,
      requested_amount: calculation.requested_amount,
      result: calculation.result,
      calculated_at: calculation.calculated_at,
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async exportEligibilityPDF(caseId: string): Promise<Buffer> {
    const calculation = await FinanceService.getEligibilityByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name, loan_type FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!calculation || caseResult.rows.length === 0) {
      throw new Error('Eligibility calculation or case not found');
    }

    const caseData = caseResult.rows[0];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text('Eligibility Calculation Report', { align: 'center' });
      doc.moveDown(2);

      // Case Information
      doc.fontSize(14).text('Case Information', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Case Number: ${caseData.case_number}`);
      doc.text(`Customer: ${caseData.customer_name}`);
      doc.text(`Loan Type: ${caseData.loan_type}`);
      doc.moveDown();

      // Calculation Details
      doc.fontSize(14).text('Calculation Details', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Monthly Income: ₹${calculation.monthly_income.toLocaleString('en-IN')}`);
      doc.text(`Eligible Amount: ₹${calculation.eligible_amount.toLocaleString('en-IN')}`);
      doc.text(`Requested Amount: ₹${calculation.requested_amount.toLocaleString('en-IN')}`);
      doc.text(`Result: ${calculation.result}`);
      doc.moveDown();
      doc.text(`Calculated At: ${new Date(calculation.calculated_at).toLocaleString()}`);

      doc.end();
    });
  }

  // ============================================
  // OBLIGATION EXPORT
  // ============================================

  static async exportObligationCSV(caseId: string): Promise<string> {
    const sheet = await FinanceService.getObligationSheetByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!sheet || caseResult.rows.length === 0) {
      throw new Error('Obligation sheet or case not found');
    }

    const caseData = caseResult.rows[0];

    // Helper function to get field value from item_data
    const getFieldValue = (item: any, fieldKey: string): string => {
      const itemData = item.item_data || {};
      const value = itemData[fieldKey];
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value.toString();
      return String(value);
    };

    // Get description and monthly_emi from item_data (support both old and new field keys)
    const getDescription = (item: any): string => {
      const itemData = item.item_data || {};
      // Try new field keys first, then fall back to old ones
      return itemData.lender_name || itemData.obligation_type || itemData.description || item.description || '';
    };

    const getMonthlyEmi = (item: any): number => {
      const itemData = item.item_data || {};
      // Try new field key first, then fall back to old one
      const emi = itemData.monthly_emi || item.monthly_emi;
      return typeof emi === 'number' ? emi : (parseFloat(emi) || 0);
    };

    const lines = [
      'Case Number,Description,Monthly EMI,Total Obligation,Net Income',
      ...sheet.items.map(item => {
        const description = getDescription(item);
        const monthlyEmi = getMonthlyEmi(item);
        return `"${caseData.case_number}","${description}","${monthlyEmi}","${sheet.total_obligation}","${sheet.net_income}"`;
      }),
      `"${caseData.case_number}","TOTAL","${sheet.total_obligation}","${sheet.total_obligation}","${sheet.net_income}"`,
    ];

    return lines.join('\n');
  }

  static async exportObligationExcel(caseId: string): Promise<Buffer> {
    const sheet = await FinanceService.getObligationSheetByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!sheet || caseResult.rows.length === 0) {
      throw new Error('Obligation sheet or case not found');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Obligation Sheet');

    // Headers
    worksheet.columns = [
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Monthly EMI', key: 'monthly_emi', width: 15 },
    ];

    // Helper functions to get field values from item_data
    const getDescription = (item: any): string => {
      const itemData = item.item_data || {};
      // Try new field keys first, then fall back to old ones
      return itemData.lender_name || itemData.obligation_type || itemData.description || item.description || '';
    };

    const getMonthlyEmi = (item: any): number => {
      const itemData = item.item_data || {};
      // Try new field key first, then fall back to old one
      const emi = itemData.monthly_emi || item.monthly_emi;
      return typeof emi === 'number' ? emi : (parseFloat(emi) || 0);
    };

    // Data rows
    sheet.items.forEach(item => {
      worksheet.addRow({
        description: getDescription(item),
        monthly_emi: getMonthlyEmi(item),
      });
    });

    // Total row
    worksheet.addRow({
      description: 'TOTAL',
      monthly_emi: sheet.total_obligation,
    });

    // Summary
    worksheet.addRow({});
    worksheet.addRow({ description: 'Total Obligation', monthly_emi: sheet.total_obligation });
    worksheet.addRow({ description: 'Net Income', monthly_emi: sheet.net_income });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Style total row
    const totalRowIndex = sheet.items.length + 2;
    worksheet.getRow(totalRowIndex).font = { bold: true };
    worksheet.getRow(totalRowIndex + 1).font = { bold: true };
    worksheet.getRow(totalRowIndex + 2).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async exportObligationPDF(caseId: string): Promise<Buffer> {
    const sheet = await FinanceService.getObligationSheetByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!sheet || caseResult.rows.length === 0) {
      throw new Error('Obligation sheet or case not found');
    }

    const caseData = caseResult.rows[0];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text('Obligation Sheet', { align: 'center' });
      doc.moveDown(2);

      // Case Information
      doc.fontSize(14).text('Case Information', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Case Number: ${caseData.case_number}`);
      doc.text(`Customer: ${caseData.customer_name}`);
      doc.moveDown();

      // Obligation Items
      doc.fontSize(14).text('Obligation Items', { underline: true });
      doc.moveDown();
      doc.fontSize(12);

      // Helper functions to get field values from item_data
      const getDescription = (item: any): string => {
        const itemData = item.item_data || {};
        // Try new field keys first, then fall back to old ones
        return itemData.lender_name || itemData.obligation_type || itemData.description || item.description || '';
      };

      const getMonthlyEmi = (item: any): number => {
        const itemData = item.item_data || {};
        // Try new field key first, then fall back to old one
        const emi = itemData.monthly_emi || item.monthly_emi;
        return typeof emi === 'number' ? emi : (parseFloat(emi) || 0);
      };

      let yPos = doc.y;
      doc.text('Description', 50, yPos);
      doc.text('Monthly EMI', 350, yPos);
      yPos += 20;

      sheet.items.forEach(item => {
        const description = getDescription(item);
        const monthlyEmi = getMonthlyEmi(item);
        doc.text(description, 50, yPos);
        doc.text(`₹${monthlyEmi.toLocaleString('en-IN')}`, 350, yPos);
        yPos += 20;
      });

      // Total
      yPos += 10;
      doc.font('Helvetica-Bold');
      doc.text('TOTAL', 50, yPos);
      doc.text(`₹${sheet.total_obligation.toLocaleString('en-IN')}`, 350, yPos);
      yPos += 30;

      // Summary
      doc.font('Helvetica');
      doc.fontSize(14).text('Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Obligation: ₹${sheet.total_obligation.toLocaleString('en-IN')}`);
      doc.text(`Net Income: ₹${sheet.net_income.toLocaleString('en-IN')}`);

      doc.end();
    });
  }

  // ============================================
  // CAM EXPORT
  // ============================================

  static async exportCAMCSV(caseId: string): Promise<string> {
    const entry = await FinanceService.getCAMEntryByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!entry || caseResult.rows.length === 0) {
      throw new Error('CAM entry or case not found');
    }

    const caseData = caseResult.rows[0];
    
    const camData = entry.cam_data as Record<string, any>;
    const lines = ['Case Number,Field,Value'];
    
    // Flatten CAM data
    const flatten = (obj: any, prefix = ''): Array<[string, any]> => {
      const result: Array<[string, any]> = [];
      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flatten(value, newKey));
        } else {
          result.push([newKey, value]);
        }
      }
      return result;
    };

    flatten(camData).forEach(([field, value]) => {
      lines.push(`"${caseData.case_number}","${field}","${value}"`);
    });

    return lines.join('\n');
  }

  static async exportCAMExcel(caseId: string): Promise<Buffer> {
    const entry = await FinanceService.getCAMEntryByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!entry || caseResult.rows.length === 0) {
      throw new Error('CAM entry or case not found');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CAM Working Sheet');

    // Headers
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 30 },
    ];

    // Flatten CAM data
    const flatten = (obj: any, prefix = ''): Array<{ field: string; value: any }> => {
      const result: Array<{ field: string; value: any }> = [];
      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flatten(value, newKey));
        } else {
          result.push({ field: newKey, value: value !== null ? String(value) : '' });
        }
      }
      return result;
    };

    flatten(entry.cam_data).forEach(item => {
      worksheet.addRow(item);
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async exportCAMPDF(caseId: string): Promise<Buffer> {
    const entry = await FinanceService.getCAMEntryByCaseId(caseId);
    
    // Get case data directly from database
    const caseResult = await query(
      `SELECT case_number, customer_name FROM crm_schema.cases WHERE id = $1`,
      [caseId]
    );

    if (!entry || caseResult.rows.length === 0) {
      throw new Error('CAM entry or case not found');
    }

    const caseData = caseResult.rows[0];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text('CAM Working Sheet', { align: 'center' });
      doc.moveDown(2);

      // Case Information
      doc.fontSize(14).text('Case Information', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Case Number: ${caseData.case_number}`);
      doc.text(`Customer: ${caseData.customer_name}`);
      doc.text(`Version: ${entry.version}`);
      doc.moveDown();

      // CAM Data
      doc.fontSize(14).text('CAM Data', { underline: true });
      doc.moveDown();

      const flatten = (obj: any, prefix = ''): Array<[string, any]> => {
        const result: Array<[string, any]> = [];
        for (const key in obj) {
          const value = obj[key];
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result.push(...flatten(value, newKey));
          } else {
            result.push([newKey, value]);
          }
        }
        return result;
      };

      let yPos = doc.y;
      flatten(entry.cam_data).forEach(([field, value]) => {
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
        doc.fontSize(10);
        doc.text(`${field}:`, 50, yPos);
        doc.text(String(value !== null ? value : ''), 200, yPos);
        yPos += 15;
      });

      doc.end();
    });
  }
}

