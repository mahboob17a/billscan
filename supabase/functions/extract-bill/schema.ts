// JSON schema the AI must return for every bill (Blueprint §3).
// Used with OpenAI Structured Outputs (strict): every key is required;
// "unknown" is expressed as null, never a guess.

const nullableNumber = { type: ['number', 'null'] };
const nullableString = { type: ['string', 'null'] };
const confidence = { type: 'string', enum: ['high', 'medium', 'low'] };

export const SECTIONS = ['MATERIAL', 'SEWAGE', 'TOOLS', 'FUEL'] as const;
export const DISCOUNT_TYPES = ['before_vat', 'after_vat', 'none'] as const;

export const billSchema = {
  name: 'bill_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'vendor_name',
      'vendor_vat_no',
      'vendor_vat_registered',
      'bill_no',
      'bill_date',
      'taxable_amount',
      'vat_amount',
      'discount',
      'discount_type',
      'grand_total',
      'total_only',
      'description',
      'section',
      'remarks',
      'payment_mode',
      'confidence',
      'notes',
    ],
    properties: {
      vendor_name: nullableString,
      vendor_vat_no: nullableString,
      vendor_vat_registered: { type: 'boolean', description: "True only if the VENDOR's own VAT number is printed." },
      bill_no: nullableString,
      bill_date: { ...nullableString, description: 'ISO date YYYY-MM-DD' },
      taxable_amount: { ...nullableNumber, description: 'OMR, 3 decimals. Net value on which VAT is charged.' },
      vat_amount: { ...nullableNumber, description: 'OMR. Total VAT printed on the bill; 0 if none.' },
      discount: { type: 'number', description: 'OMR, positive. 0 when no discount. Negative only if the bill rounds UP.' },
      discount_type: { type: 'string', enum: DISCOUNT_TYPES },
      grand_total: { ...nullableNumber, description: 'OMR. Final amount payable after any round-off.' },
      total_only: { type: 'boolean', description: 'True if the bill prints only a single total with no VAT breakdown.' },
      description: { type: 'string', description: 'ONE label for the whole bill.' },
      section: { type: 'string', enum: SECTIONS },
      remarks: { type: 'string', description: 'Max 60 characters.' },
      payment_mode: { type: 'string', enum: ['cash', 'credit', 'card', 'unknown'] },
      confidence: {
        type: 'object',
        additionalProperties: false,
        required: ['amounts', 'bill_date', 'bill_no'],
        properties: { amounts: confidence, bill_date: confidence, bill_no: confidence },
      },
      notes: { type: 'string', description: 'Anything the reviewer should know; empty string if nothing.' },
    },
  },
} as const;

export interface BillExtraction {
  vendor_name: string | null;
  vendor_vat_no: string | null;
  vendor_vat_registered: boolean;
  bill_no: string | null;
  bill_date: string | null;
  taxable_amount: number | null;
  vat_amount: number | null;
  discount: number;
  discount_type: (typeof DISCOUNT_TYPES)[number];
  grand_total: number | null;
  total_only: boolean;
  description: string;
  section: (typeof SECTIONS)[number];
  remarks: string;
  payment_mode: 'cash' | 'credit' | 'card' | 'unknown';
  confidence: { amounts: 'high' | 'medium' | 'low'; bill_date: 'high' | 'medium' | 'low'; bill_no: 'high' | 'medium' | 'low' };
  notes: string;
}
