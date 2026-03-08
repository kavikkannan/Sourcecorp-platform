import { query } from '../db/pool';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FinanceService } from './finance.service';
import * as path from 'path';
import * as fs from 'fs';

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
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Eligibility Calculation Report',
          Author: 'Sourcecorp Solution',
          Subject: 'Loan Eligibility Calculation',
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper function to draw table rows
      const drawTableRow = (y: number, label: string, value: string, isHeader = false) => {
        const pageWidth = doc.page.width;
        const margin = 50;
        const col1Width = (pageWidth - 2 * margin) * 0.4;
        const col2Width = (pageWidth - 2 * margin) * 0.6;
        const col1X = margin + 10;
        const col2X = margin + col1Width;
        const textY = isHeader ? y + 7 : y + 5;
        
        // Ensure value is a string and truncate if too long to prevent stack overflow
        const safeValue = String(value || '').substring(0, 100);
        const safeLabel = String(label || '').substring(0, 50);
        
        if (isHeader) {
          doc.rect(margin, y, pageWidth - 2 * margin, 25)
            .fillColor('#1e40af')
            .fill();
          doc.fillColor('#ffffff')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(safeLabel, col1X, textY);
          doc.text(safeValue, col2X, textY);
          doc.fillColor('#000000');
        } else {
          doc.rect(margin, y, pageWidth - 2 * margin, 20)
            .fillColor('#f3f4f6')
            .fill();
          doc.fillColor('#000000')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(safeLabel, col1X, textY);
          doc.font('Helvetica')
            .text(safeValue, col2X, textY);
        }
      };

      // Header with Logo and Company Name
      // Try multiple paths for logo (development and production)
      const possibleLogoPaths = [
        path.join(__dirname, '../assets/logo.png'), // Production (compiled)
        path.join(__dirname, '../../src/assets/logo.png'), // Development
        path.join(process.cwd(), 'src/assets/logo.png'), // Alternative
        path.join(process.cwd(), 'backend/src/assets/logo.png'), // Docker alternative
      ];
      
      let logoPath: string | null = null;
      for (const possiblePath of possibleLogoPaths) {
        try {
          if (fs.existsSync(possiblePath)) {
            logoPath = possiblePath;
            break;
          }
        } catch (error) {
          // Continue to next path
        }
      }
      
      let yPos = 50;
      
      if (logoPath) {
        try {
          doc.image(logoPath, 50, yPos, { width: 80, height: 80 });
          yPos = 50;
        } catch (error) {
          // Logo not found or error loading, continue without it
        }
      }

      // Company Name
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text('Sourcecorp Solution', 150, yPos + 20);
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Loan Eligibility Calculation Report', 150, yPos + 50);
      
      yPos = 150;

      // Draw a line separator
      doc.moveTo(50, yPos)
        .lineTo(545, yPos)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();
      
      yPos += 30;

      // Case Information Table
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Case Information', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Field', 'Value', true);
      yPos += 25;
      
      drawTableRow(yPos, 'Case Number', String(caseData.case_number || ''));
      yPos += 20;
      
      drawTableRow(yPos, 'Customer Name', String(caseData.customer_name || ''));
      yPos += 20;
      
      drawTableRow(yPos, 'Loan Type', String(caseData.loan_type || ''));
      yPos += 30;

      // Calculation Details Table
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Calculation Details', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Field', 'Value', true);
      yPos += 25;
      
      const monthlyIncome = Number(calculation.monthly_income) || 0;
      const eligibleAmount = Number(calculation.eligible_amount) || 0;
      const requestedAmount = Number(calculation.requested_amount) || 0;
      
      drawTableRow(yPos, 'Monthly Income', `₹${monthlyIncome.toLocaleString('en-IN')}`);
      yPos += 20;
      
      drawTableRow(yPos, 'Eligible Amount', `₹${eligibleAmount.toLocaleString('en-IN')}`);
      yPos += 20;
      
      drawTableRow(yPos, 'Requested Amount', `₹${requestedAmount.toLocaleString('en-IN')}`);
      yPos += 20;
      
      // Result with color coding
      const resultColor = calculation.result === 'ELIGIBLE' ? '#10b981' : '#ef4444';
      const resultBg = calculation.result === 'ELIGIBLE' ? '#d1fae5' : '#fee2e2';
      
      const pageWidth = doc.page.width;
      const margin = 50;
      const col1Width = (pageWidth - 2 * margin) * 0.4;
      const col2Width = (pageWidth - 2 * margin) * 0.6;
      
      doc.rect(margin, yPos, pageWidth - 2 * margin, 20)
        .fillColor(resultBg)
        .fill();
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Result', margin + 10, yPos + 5);
      doc.fillColor(resultColor)
        .font('Helvetica-Bold')
        .text(String(calculation.result || ''), margin + col1Width, yPos + 5);
      
      yPos += 30;

      // Footer with timestamp
      try {
        const calculatedDate = calculation.calculated_at ? new Date(calculation.calculated_at) : new Date();
        const dateStr = calculatedDate.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const timestampText = `Calculated At: ${String(dateStr).substring(0, 100)}`;
        doc.fontSize(9)
          .font('Helvetica')
          .fillColor('#6b7280')
          .text(timestampText, 50, yPos);
      } catch (error) {
        // If date formatting fails, use a simple string
        const timestampText = `Calculated At: ${String(calculation.calculated_at || 'N/A').substring(0, 100)}`;
        doc.fontSize(9)
          .font('Helvetica')
          .fillColor('#6b7280')
          .text(timestampText, 50, yPos);
      }

      // Add footer to first page only (simpler approach to avoid stack overflow)
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#9ca3af')
        .text('Sourcecorp Solution - Confidential Document', (doc.page.width - 400) / 2, doc.page.height - 30);

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
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Obligation Sheet',
          Author: 'Sourcecorp Solution',
          Subject: 'Monthly Obligation Calculation',
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper function to draw table rows
      const drawTableRow = (y: number, col1: string, col2: string, isHeader = false) => {
        const pageWidth = doc.page.width;
        const margin = 50;
        const col1Width = (pageWidth - 2 * margin) * 0.6;
        const col2Width = (pageWidth - 2 * margin) * 0.4;
        const col1X = margin + 10;
        const col2X = margin + col1Width;
        const textY = isHeader ? y + 7 : y + 5;
        
        // Ensure values are strings and truncate if too long to prevent stack overflow
        const safeCol1 = String(col1 || '').substring(0, 100);
        const safeCol2 = String(col2 || '').substring(0, 100);
        
        if (isHeader) {
          doc.rect(margin, y, pageWidth - 2 * margin, 25)
            .fillColor('#1e40af')
            .fill();
          doc.fillColor('#ffffff')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(safeCol1, col1X, textY);
          doc.text(safeCol2, col2X, textY);
          doc.fillColor('#000000');
        } else {
          doc.rect(margin, y, pageWidth - 2 * margin, 20)
            .fillColor('#f3f4f6')
            .fill();
          doc.fillColor('#000000')
            .fontSize(10)
            .font('Helvetica')
            .text(safeCol1, col1X, textY);
          doc.font('Helvetica')
            .text(safeCol2, col2X, textY);
        }
      };

      // Header with Logo and Company Name
      // Try multiple paths for logo (development and production)
      const possibleLogoPaths = [
        path.join(__dirname, '../assets/logo.png'), // Production (compiled)
        path.join(__dirname, '../../src/assets/logo.png'), // Development
        path.join(process.cwd(), 'src/assets/logo.png'), // Alternative
        path.join(process.cwd(), 'backend/src/assets/logo.png'), // Docker alternative
      ];
      
      let logoPath: string | null = null;
      for (const possiblePath of possibleLogoPaths) {
        try {
          if (fs.existsSync(possiblePath)) {
            logoPath = possiblePath;
            break;
          }
        } catch (error) {
          // Continue to next path
        }
      }
      
      let yPos = 50;
      
      if (logoPath) {
        try {
          doc.image(logoPath, 50, yPos, { width: 80, height: 80 });
          yPos = 50;
        } catch (error) {
          // Logo not found or error loading, continue without it
        }
      }

      // Company Name
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text('Sourcecorp Solution', 150, yPos + 20, { align: 'left' });
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Monthly Obligation Sheet', 150, yPos + 50, { align: 'left' });
      
      yPos = 150;

      // Draw a line separator
      doc.moveTo(50, yPos)
        .lineTo(545, yPos)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();
      
      yPos += 30;

      // Case Information Table
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Case Information', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Field', 'Value', true);
      yPos += 25;
      
      drawTableRow(yPos, 'Case Number', caseData.case_number);
      yPos += 20;
      
      drawTableRow(yPos, 'Customer Name', caseData.customer_name);
      yPos += 30;

      // Obligation Items Table
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Obligation Items', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Description', 'Monthly EMI', true);
      yPos += 25;

      // Helper functions to get field values from item_data
      const getDescription = (item: any): string => {
        const itemData = item.item_data || {};
        return itemData.lender_name || itemData.obligation_type || itemData.description || item.description || '';
      };

      const getMonthlyEmi = (item: any): number => {
        const itemData = item.item_data || {};
        const emi = itemData.monthly_emi || item.monthly_emi;
        return typeof emi === 'number' ? emi : (parseFloat(emi) || 0);
      };

      sheet.items.forEach(item => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        const description = getDescription(item);
        const monthlyEmi = getMonthlyEmi(item);
        drawTableRow(yPos, description, `₹${monthlyEmi.toLocaleString('en-IN')}`);
        yPos += 20;
      });

      // Total row
      yPos += 10;
      const pageWidth = doc.page.width;
      const margin = 50;
      const col1Width = (pageWidth - 2 * margin) * 0.6;
      const col2Width = (pageWidth - 2 * margin) * 0.4;
      
      doc.rect(margin, yPos, pageWidth - 2 * margin, 25)
        .fillColor('#1e40af')
        .fill();
      doc.fillColor('#ffffff')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('TOTAL', margin + 10, yPos + 7);
      doc.text(`₹${sheet.total_obligation.toLocaleString('en-IN')}`, margin + col1Width, yPos + 7);
      
      yPos += 35;

      // Summary Table
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Summary', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Field', 'Amount', true);
      yPos += 25;
      
      drawTableRow(yPos, 'Total Obligation', `₹${sheet.total_obligation.toLocaleString('en-IN')}`);
      yPos += 20;
      
      drawTableRow(yPos, 'Net Income', `₹${sheet.net_income.toLocaleString('en-IN')}`);

      // Footer
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#9ca3af')
        .text('Sourcecorp Solution - Confidential Document', 50, doc.page.height - 30, { 
          align: 'center',
          width: doc.page.width - 100 
        });

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
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'CAM / Working Sheet',
          Author: 'Sourcecorp Solution',
          Subject: 'Credit Assessment Memo',
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper function to draw table rows
      const drawTableRow = (y: number, label: string, value: string, isHeader = false) => {
        const pageWidth = doc.page.width;
        const margin = 50;
        const col1Width = (pageWidth - 2 * margin) * 0.4;
        const col2Width = (pageWidth - 2 * margin) * 0.6;
        const col1X = margin + 10;
        const col2X = margin + col1Width;
        const textY = isHeader ? y + 7 : y + 5;
        
        // Ensure values are strings and truncate if too long to prevent stack overflow
        const safeLabel = String(label || '').substring(0, 50);
        const safeValue = String(value !== null && value !== undefined ? value : '').substring(0, 100);
        
        if (isHeader) {
          doc.rect(margin, y, pageWidth - 2 * margin, 25)
            .fillColor('#1e40af')
            .fill();
          doc.fillColor('#ffffff')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(safeLabel, col1X, textY);
          doc.text(safeValue, col2X, textY);
          doc.fillColor('#000000');
        } else {
          doc.rect(margin, y, pageWidth - 2 * margin, 20)
            .fillColor('#f3f4f6')
            .fill();
          doc.fillColor('#000000')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(safeLabel, col1X, textY);
          doc.font('Helvetica')
            .text(safeValue, col2X, textY);
        }
      };

      // Header with Logo and Company Name
      // Try multiple paths for logo (development and production)
      const possibleLogoPaths = [
        path.join(__dirname, '../assets/logo.png'), // Production (compiled)
        path.join(__dirname, '../../src/assets/logo.png'), // Development
        path.join(process.cwd(), 'src/assets/logo.png'), // Alternative
        path.join(process.cwd(), 'backend/src/assets/logo.png'), // Docker alternative
      ];
      
      let logoPath: string | null = null;
      for (const possiblePath of possibleLogoPaths) {
        try {
          if (fs.existsSync(possiblePath)) {
            logoPath = possiblePath;
            break;
          }
        } catch (error) {
          // Continue to next path
        }
      }
      
      let yPos = 50;
      
      if (logoPath) {
        try {
          doc.image(logoPath, 50, yPos, { width: 80, height: 80 });
          yPos = 50;
        } catch (error) {
          // Logo not found or error loading, continue without it
        }
      }

      // Company Name
      doc.fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#1e40af')
        .text('Sourcecorp Solution', 150, yPos + 20, { align: 'left' });
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Credit Assessment Memo (CAM) / Working Sheet', 150, yPos + 50, { align: 'left' });
      
      yPos = 150;

      // Draw a line separator
      doc.moveTo(50, yPos)
        .lineTo(545, yPos)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();
      
      yPos += 30;

      // Case Information Table
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Case Information', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Field', 'Value', true);
      yPos += 25;
      
      drawTableRow(yPos, 'Case Number', caseData.case_number);
      yPos += 20;
      
      if (caseData.customer_name) {
        drawTableRow(yPos, 'Customer Name', caseData.customer_name);
        yPos += 20;
      }
      
      drawTableRow(yPos, 'Version', String(entry.version || '1'));
      yPos += 30;

      // CAM Data
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('CAM Data', 50, yPos);
      
      yPos += 25;
      
      drawTableRow(yPos, 'Field', 'Value', true);
      yPos += 25;

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

      flatten(entry.cam_data).forEach(([field, value]) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
          // Redraw header on new page
          drawTableRow(yPos, 'Field', 'Value', true);
          yPos += 25;
        }
        drawTableRow(yPos, field, String(value !== null && value !== undefined ? value : ''));
        yPos += 20;
      });

      // Footer
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#9ca3af')
        .text('Sourcecorp Solution - Confidential Document', 50, doc.page.height - 30, { 
          align: 'center',
          width: doc.page.width - 100 
        });

      doc.end();
    });
  }
}

