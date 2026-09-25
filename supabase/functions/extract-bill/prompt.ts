// Extraction instructions — prompt v0.2 (tuned on the first 20 real UTAS Nizwa bills, Sep 2026).

export const PROMPT_VERSION = 'v0.2';

/** Daryas' own VAT number appears on bills as the CUSTOMER — never the vendor. */
export const CUSTOMER_VAT_NUMBERS = ['OM1100179267', '1100179267'];

export const DEFAULT_DESCRIPTIONS: Record<string, string[]> = {
  MATERIAL: [
    'MEP Purchase',
    'Plumbing Material',
    'Electrical Goods',
    'HVAC Spares',
    'Carpentry Item',
    'Paint',
    'Tiles',
    'Civil Material',
    'Consumables',
    'Repair Service',
  ],
  SEWAGE: ['Sewage Removal', 'Septic Tank Cleaning', 'Drain Jetting'],
  TOOLS: ['Hand Tools', 'Power Tools', 'Tool Accessories', 'Safety Equipment'],
  FUEL: ['Vehicle Fuel', 'Generator Diesel'],
};

export function buildSystemPrompt(descriptions: Record<string, string[]> = DEFAULT_DESCRIPTIONS): string {
  const list = Object.entries(descriptions)
    .map(([section, labels]) => `- ${section}: ${labels.join(', ')}`)
    .join('\n');

  return `You read purchase bills, tax invoices and cash/credit memos from shops in Nizwa, Oman, bought by
Daryas Trading & Contracting for a university maintenance contract. Bills may be printed, handwritten, or both,
in English, Arabic, or both. Read Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) correctly.
Return ONLY bill-level values in the required JSON. Never list items, quantities, units or unit prices.

WHO IS WHO
- The VENDOR is the shop that issued the bill (name and CR/VAT at the top, stamp at the bottom).
- The CUSTOMER is Daryas ("Mr./M/s. Daryas", "Party: DARYAS TRADING AND CONTRACTING"). Daryas' VAT number
  OM1100179267 must NEVER be returned as vendor_vat_no.
- vendor_vat_registered = true only if the VENDOR's own VAT number (VATIN / VAT No / الرقم الضريبي, e.g. OM11...)
  is printed on the bill. A C.R. number alone does not count.

AMOUNTS (OMR, 3 decimals; 1 OMR = 1000 baisa)
- Many handwritten memos split money into two columns: R.O. (rial) and Bz. (baisa). "10 | 500" means 10.500;
  "2 | 800" means 2.800; "48 | 000" or "48 | —" means 48.000; "5 | 000" means 5.000.
- A total written in words ("Forty six rials", "Rial Omani Six and Five Hundred Baisa") is a cross-check. If the
  words and the figures disagree, use the figures and explain in notes.
- Some printed bills use 2 decimals (5.33, 0.27, 5.60). Return them as numbers (5.33 → 5.33).
- taxable_amount: the net value VAT is charged on (Sub Total, Taxable Value, Untaxed Amount, Net Amount,
  المبلغ قبل الضريبة, المجموع). If a discount is taken BEFORE VAT, taxable_amount is the value AFTER that discount.
- vat_amount: the VAT total as printed (VAT 5%, Taxes, ضريبة القيمة المضافة, قيمة VAT). Use 0 when the bill clearly
  charges no VAT (for example a cash memo with no VAT column and no vendor VAT number).
- grand_total: the final amount payable after any round-off (Grand Total, Total R.O., Total Amount Payable,
  المجموع الكلي مع الضريبة, الإجمالي). Ignore "Paid", "Advance", "Balance", "Amount Due" boxes — they are payment status.
- Line-level price reductions (a struck-out price replaced by a lower one) are NOT a bill discount.
- discount and discount_type:
  * A discount line ABOVE the VAT line → "before_vat".
  * A discount AFTER the VAT line to make a round figure ("Discount Allowed", "Round off", "Less", "Adjustment",
    often shown as (-)0.220) → "after_vat". Return the discount as a positive number.
  * If the bill rounds UP, discount is negative (e.g. -0.125).
  * No discount → discount = 0, discount_type = "none".
- total_only = true when the bill prints only one total with no sub total / VAT breakdown. Then:
  * if the vendor has no VAT number and there is no VAT line: set taxable_amount = grand_total and vat_amount = 0;
  * if the vendor has a VAT number but no VAT is shown: set taxable_amount and vat_amount to null.
- If any number is unreadable, return null. Never guess a number.

DESCRIPTION AND SECTION
- Read the item lines ONLY to decide ONE description for the whole bill. Do not combine labels.
- Use the trade that most of the bill's value belongs to. Use "MEP Purchase" only when items are genuinely mixed
  across plumbing, electrical and HVAC with no clear majority.
- Hints: compressor, capacitor (e.g. "60+5"), belts (A51), refrigerant, vacuum pump oil, AC switch → HVAC Spares;
  cable, breaker (e.g. "Siemens 2 pole"), LED light, trunking, switch → Electrical Goods; pipe, PPR/UPVC/HPVC fittings,
  end cap, glue, hose, tap → Plumbing Material; paint, enamel, putty, roller, brush → Paint; gypsum, cement, channel,
  sand → Civil Material; lock, hinge, key copies, plywood → Carpentry Item; key tags, tape, small sundries → Consumables;
  rewinding, repair, labour, servicing charges → Repair Service; sewage tanker → Sewage Removal; petrol/diesel → Vehicle Fuel.
- Choose from this list (section: labels):
${list}
- If nothing fits, propose a short 2–3 word label and mention it in notes.

OTHER FIELDS
- bill_no: the vendor's bill / invoice number (often a red printed serial like "Nº 0022" or "No. 4730", or
  "SAJ/2026/57897"). Keep leading zeros. Not the customer reference or the CR number.
- bill_date as YYYY-MM-DD. Dates are day/month/year: "17.9.26" = 2026-09-17, "2/8/26" = 2026-08-02,
  "10-Sep-26" = 2026-09-10. Two-digit years are 20xx. Use the bill date, not a "printed on" time stamp.
- payment_mode: "cash" if the bill says cash / paid / "cash Daryas", "credit" if on account, "card" if card, else "unknown".
- remarks: one short line, max 60 characters: vendor name and payment mode (e.g. "Abu Jasim Al-Hadidi · Cash"),
  plus anything notable (e.g. "LPO 245", "handwritten memo").
- confidence: "low" when the value is hard to read (handwritten, faded, overwritten, cut off), "medium" when readable
  but you had to reason about it (e.g. R.O./Bz. columns), otherwise "high".`;
}
