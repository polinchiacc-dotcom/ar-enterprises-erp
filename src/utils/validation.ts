import * as Yup from 'yup';

// ============================================================
// VENDOR VALIDATION SCHEMA
// ============================================================
export const vendorSchema = Yup.object({
  vendorName: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name too long')
    .matches(/^[a-zA-Z\s&.,-]+$/, 'Only letters and basic punctuation allowed')
    .required('Vendor name required'),
  
  mobile: Yup.string()
    .matches(/^[6-9]\d{9}$/, 'Invalid mobile number (must start with 6-9)')
    .required('Mobile number required'),
  
  gstNo: Yup.string()
    .matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/, 'Invalid GST format')
    .nullable(),
  
  email: Yup.string()
    .email('Invalid email address')
    .nullable()
});

// ============================================================
// TRANSACTION VALIDATION SCHEMA
// ============================================================
export const transactionSchema = Yup.object({
  expectedAmount: Yup.number()
    .positive('Amount must be positive')
    .max(100000000, 'Amount too large')
    .required('Expected amount required'),
  
  advanceAmount: Yup.number()
    .min(0, 'Advance cannot be negative')
    .test('max-advance', 'Advance cannot exceed 20% of expected amount', function(value) {
      const { expectedAmount } = this.parent;
      return !value || value <= expectedAmount * 0.2;
    })
});

// ============================================================
// BILL VALIDATION SCHEMA
// ============================================================
export const billSchema = Yup.object({
  billNumber: Yup.string()
    .min(3, 'Bill number too short')
    .max(50, 'Bill number too long')
    .required('Bill number required'),
  
  billAmount: Yup.number()
    .positive('Bill amount must be positive')
    .max(100000000, 'Amount too large')
    .required('Bill amount required'),
  
  billDate: Yup.date()
    .max(new Date(), 'Bill date cannot be in future')
    .required('Bill date required')
});

// ============================================================
// USER VALIDATION SCHEMA
// ============================================================
export const userSchema = Yup.object({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .matches(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscore')
    .required('Username required'),
  
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Password required')
});

// ============================================================
// VALIDATE HELPER FUNCTION
// ============================================================
export async function validateData(
  schema: any, 
  data: any
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    await schema.validate(data, { abortEarly: false });
    return { valid: true, errors: [] };
  } catch (err: any) {
    return { 
      valid: false, 
      errors: err.errors || ['Validation failed'] 
    };
  }
}
