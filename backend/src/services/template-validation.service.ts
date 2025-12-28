import { CAMField, ObligationField } from '../types';

export interface ValidationError {
  field_key: string;
  section_name?: string;
  message: string;
}

export class TemplateValidationService {
  
  /**
   * Validate CAM data against template fields
   * Returns array of validation errors (empty if valid)
   */
  static validateCAMData(
    camData: Record<string, any>,
    templateFields: CAMField[],
    userAddedFields?: Record<string, { label: string; type: string }>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const fieldMap = new Map<string, CAMField>();
    
    // Build field map
    templateFields.forEach(field => {
      fieldMap.set(field.field_key, field);
    });

    // Check all mandatory fields are present
    templateFields.forEach(field => {
      if (field.is_mandatory) {
        const value = camData[field.field_key];
        
        if (value === undefined || value === null || value === '') {
          errors.push({
            field_key: field.field_key,
            section_name: field.section_name,
            message: `${field.label} is required`,
          });
        } else {
          // Validate field type
          const typeError = this.validateFieldType(value, field);
          if (typeError) {
            errors.push({
              field_key: field.field_key,
              section_name: field.section_name,
              message: typeError,
            });
          }
        }
      } else {
        // Optional fields: validate type if present
        const value = camData[field.field_key];
        if (value !== undefined && value !== null && value !== '') {
          const typeError = this.validateFieldType(value, field);
          if (typeError) {
            errors.push({
              field_key: field.field_key,
              section_name: field.section_name,
              message: typeError,
            });
          }
        }
      }
    });

    // Validate user-added fields (if any)
    if (userAddedFields) {
      Object.keys(userAddedFields).forEach(fieldKey => {
        const fieldMeta = userAddedFields[fieldKey];
        const value = camData[fieldKey];
        
        if (value !== undefined && value !== null && value !== '') {
          const typeError = this.validateFieldTypeByString(value, fieldMeta.type);
          if (typeError) {
            errors.push({
              field_key: fieldKey,
              message: typeError,
            });
          }
        }
      });
    }

    return errors;
  }

  /**
   * Validate obligation items against template fields
   */
  static validateObligationItems(
    items: Array<Record<string, any>>,
    templateFields: ObligationField[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const fieldMap = new Map<string, ObligationField>();
    
    // Build field map
    templateFields.forEach(field => {
      fieldMap.set(field.field_key, field);
    });

    // Validate each item
    items.forEach((item, index) => {
      templateFields.forEach(field => {
        if (field.is_mandatory) {
          const value = item[field.field_key];
          
          if (value === undefined || value === null || value === '') {
            errors.push({
              field_key: field.field_key,
              message: `Item ${index + 1}: ${field.label} is required`,
            });
          } else {
            // Validate field type
            const typeError = this.validateFieldType(value, field);
            if (typeError) {
              errors.push({
                field_key: field.field_key,
                message: `Item ${index + 1}: ${typeError}`,
              });
            }
          }
        } else {
          // Optional fields: validate type if present
          const value = item[field.field_key];
          if (value !== undefined && value !== null && value !== '') {
            const typeError = this.validateFieldType(value, field);
            if (typeError) {
              errors.push({
                field_key: field.field_key,
                message: `Item ${index + 1}: ${typeError}`,
              });
            }
          }
        }
      });
    });

    return errors;
  }

  /**
   * Validate a single field value against its field definition
   */
  private static validateFieldType(value: any, field: CAMField | ObligationField): string | null {
    // Type validation
    switch (field.field_type) {
      case 'number':
      case 'currency':
        if (typeof value !== 'number' && isNaN(parseFloat(value))) {
          return `${field.label} must be a valid number`;
        }
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        
        // Check validation rules
        if (field.validation_rules) {
          if (field.validation_rules.min !== undefined && numValue < field.validation_rules.min) {
            return `${field.label} must be at least ${field.validation_rules.min}`;
          }
          if (field.validation_rules.max !== undefined && numValue > field.validation_rules.max) {
            return `${field.label} must be at most ${field.validation_rules.max}`;
          }
        }
        
        // Currency must be non-negative
        if (field.field_type === 'currency' && numValue < 0) {
          return `${field.label} must be non-negative`;
        }
        break;

      case 'date':
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return `${field.label} must be a valid date`;
          }
        } else if (!(value instanceof Date)) {
          return `${field.label} must be a valid date`;
        }
        break;

      case 'select':
        if (field.select_options && field.select_options.length > 0) {
          if (!field.select_options.includes(value)) {
            return `${field.label} must be one of: ${field.select_options.join(', ')}`;
          }
        }
        break;

      case 'text':
        if (typeof value !== 'string') {
          return `${field.label} must be text`;
        }
        if (field.validation_rules?.pattern) {
          const regex = new RegExp(field.validation_rules.pattern);
          if (!regex.test(value)) {
            return `${field.label} format is invalid`;
          }
        }
        break;
    }

    return null;
  }

  /**
   * Validate field type by string (for user-added fields)
   */
  private static validateFieldTypeByString(value: any, type: string): string | null {
    switch (type) {
      case 'number':
      case 'currency':
        if (typeof value !== 'number' && isNaN(parseFloat(value))) {
          return 'Must be a valid number';
        }
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (type === 'currency' && numValue < 0) {
          return 'Must be non-negative';
        }
        break;

      case 'date':
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return 'Must be a valid date';
          }
        } else if (!(value instanceof Date)) {
          return 'Must be a valid date';
        }
        break;

      case 'text':
        if (typeof value !== 'string') {
          return 'Must be text';
        }
        break;
    }

    return null;
  }

  /**
   * Get template snapshot for storage with CAM entry
   */
  static createTemplateSnapshot(template: {
    id: string;
    loan_type?: string;
    template_name: string;
    sections: string[];
    fields: Array<{
      section_name?: string;
      field_key: string;
      label: string;
      field_type: string;
      is_mandatory: boolean;
      is_user_addable?: boolean;
      is_repeatable?: boolean;
      order_index: number;
      default_value?: string;
      validation_rules?: any;
      select_options?: string[];
    }>;
  }): any {
    return {
      template_id: template.id,
      template_name: template.template_name,
      loan_type: template.loan_type,
      sections: template.sections,
      fields: template.fields.map(field => ({
        section_name: field.section_name,
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        is_mandatory: field.is_mandatory,
        is_user_addable: field.is_user_addable,
        is_repeatable: field.is_repeatable,
        order_index: field.order_index,
        default_value: field.default_value,
        validation_rules: field.validation_rules,
        select_options: field.select_options,
      })),
      snapshot_date: new Date().toISOString(),
    };
  }
}

