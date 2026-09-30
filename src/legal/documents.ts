/**
 * In-app legal texts: User Guide, Privacy Policy and Disclaimer.
 *
 * DRAFT for review — have a lawyer familiar with Omani law (including the Personal Data
 * Protection Law, Royal Decree 6/2022) review these texts before commercial release.
 *
 * Changing LEGAL_VERSION asks every user to read and accept the documents again.
 */

export const LEGAL_VERSION = '2026-10-01';
export const LEGAL_UPDATED = '1 October 2026';
export const OPERATOR = 'OpsNest';
export const CONTACT_EMAIL = 'zunaid17a@gmail.com';

export type LegalDocId = 'guide' | 'privacy' | 'disclaimer';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  summary: string;
  consentLabel: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  guide: {
    id: 'guide',
    title: 'User Guide',
    summary: 'How to scan bills, check the figures and send the monthly report.',
    consentLabel: 'I have read the User Guide and understand that I must check every bill before saving it.',
    sections: [
      {
        heading: '1. What BillScan does',
        body: [
          'BillScan turns photos of purchase bills into rows of your monthly purchase report. An AI service reads each bill; you check the figures and save them. At month end BillScan fills your Excel report template and makes a PDF of the bill photos.',
        ],
      },
      {
        heading: '2. Scanning a bill',
        body: [
          'Tap Scan bill. Lay the bill flat in good light so the date, bill number and totals are clear. A long bill can have up to 3 pages. You can also choose a photo from your gallery or type a bill by hand.',
          'Without internet the photo is saved and read automatically when you are back online.',
        ],
      },
      {
        heading: '3. Checking a bill — your responsibility',
        body: [
          'The AI can misread handwriting, faded print or unusual layouts. Before saving, compare every figure on the check screen with the photo: date, bill number, Shop Rate, VAT, discount, Grand Total, description and section.',
          'Every row must satisfy Shop Rate + VAT − Discount = Grand Total. Red items must be fixed; amber items must be checked. Saving a bill means you confirm its figures are correct.',
        ],
      },
      {
        heading: '4. Cash and the monthly report',
        body: [
          'Record cash brought forward from last month (Section F, negative if you spent from your own pocket) and cash received from the cashier (Section G). The Report tab shows the balance due and builds the Excel file and the bill-photo PDF.',
          'Review the finished report before you send it. If you change a bill after sending, BillScan creates a revised file (-R1, -R2).',
        ],
      },
      {
        heading: '5. Keeping your data safe',
        body: [
          'Your bills and photos are stored on this phone. Use Settings → Backup and restore regularly and keep the backup file in your own Drive or email. Turn on fingerprint unlock in Settings.',
        ],
      },
      {
        heading: '6. Help',
        body: [`For help or to report a problem, contact ${OPERATOR} at ${CONTACT_EMAIL}.`],
      },
    ],
  },

  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'What information BillScan uses, where it is kept, and your choices.',
    consentLabel: 'I agree to the Privacy Policy, including sending bill photos to the AI service for reading.',
    sections: [
      {
        heading: '1. Who we are',
        body: [`BillScan is provided by ${OPERATOR}. Contact: ${CONTACT_EMAIL}.`],
      },
      {
        heading: '2. Information we collect',
        body: [
          'Account: your name, email address, designation, employee ID (if used) and, if you sign in with Google or Apple, the name and email they share with us.',
          'Bills: photos of the bills you scan and the figures read from them (date, bill number, amounts, vendor name and VAT number, description, remarks).',
          'Cash entries and report settings you type in.',
          'Technical: the number and size of AI reading requests, error reports (error message, app version and Android version) and the date you accepted these documents.',
        ],
      },
      {
        heading: '3. Where your information is kept',
        body: [
          'Bills, photos, cash entries and reports are stored on your phone. They are not uploaded to a BillScan database.',
          'To read a bill, its photo is sent over an encrypted connection to our server and passed to an AI service provider (OpenAI) that returns the figures. BillScan does not keep the photo on its server after the reading. The AI provider processes it under its business API terms.',
          'Your account, AI usage log, error reports and consent record are stored with our hosting provider (Supabase), in a data centre in Singapore.',
        ],
      },
      {
        heading: '4. How we use information',
        body: [
          'To sign you in, read your bills, build your reports, keep AI costs under control, fix errors and keep a record of your consent. We do not sell your information, show advertising or use your bills to market to you.',
        ],
      },
      {
        heading: '5. Sharing',
        body: [
          'Reports and PDFs leave your phone only when you share them yourself (email, WhatsApp, Drive). Service providers (hosting, AI reading, Google or Apple sign-in) receive only what they need to provide their service.',
        ],
      },
      {
        heading: '6. Keeping and deleting information',
        body: [
          'Data on your phone stays until you delete it or remove the app. Account data is kept while your account is active. AI usage logs and error reports are kept for up to 24 months. To have your account and server records deleted, email us.',
        ],
      },
      {
        heading: '7. Your rights',
        body: [
          'You may ask to see, correct or delete your personal data and withdraw consent, as provided by the data protection law of the Sultanate of Oman. Withdrawing consent to AI reading means bills must be entered by hand.',
        ],
      },
      {
        heading: '8. Security',
        body: [
          'Connections are encrypted. Your sign-in is stored in the phone’s secure storage and the app can lock with your fingerprint. The AI service key is kept only on our server, never on your phone.',
        ],
      },
      {
        heading: '9. Changes',
        body: ['If this policy changes, BillScan asks you to read and accept the new version before continuing.'],
      },
    ],
  },

  disclaimer: {
    id: 'disclaimer',
    title: 'Disclaimer',
    summary: 'Limits of the AI reading and the calculations, and who is responsible for the figures.',
    consentLabel: 'I accept the Disclaimer: I am responsible for the figures I save and send, and OpsNest is not liable for any loss or damage.',
    sections: [
      {
        heading: '1. A tool, not an accountant',
        body: [
          'BillScan helps you record purchase bills and prepare a report. It is not accounting, tax, audit or legal advice, and it does not replace your company’s own checks and approvals.',
        ],
      },
      {
        heading: '2. AI reading may be wrong',
        body: [
          'Figures are read automatically and may be incomplete or incorrect, especially for handwritten, faded, damaged or unusual bills. VAT worked out from a total, discounts and descriptions are suggestions. You must check every figure against the original bill before saving.',
        ],
      },
      {
        heading: '3. Calculations and reports',
        body: [
          'Totals, sub-totals, VAT checks and the reconciliation (Total Purchase − Cash Brought Forward − Cash Received = Balance Due) are calculated from the figures you save. Their correctness depends on those figures. You are responsible for reviewing each report before sending it and for keeping the original paper bills.',
        ],
      },
      {
        heading: '4. No warranty',
        body: [
          'BillScan is provided “as is” and “as available”. We do not guarantee that it will be error-free, uninterrupted, or accepted by any employer, auditor or tax authority.',
        ],
      },
      {
        heading: '5. Limitation of liability',
        body: [
          `To the fullest extent permitted by law, ${OPERATOR} and its owners are not liable for any direct, indirect or consequential loss or damage — including financial loss, incorrect payments or reimbursements, VAT or tax penalties, disputes, or loss of data — arising from the use of, or inability to use, BillScan or its calculations.`,
        ],
      },
      {
        heading: '6. Your data and backups',
        body: [
          'Bills are stored on your phone. Losing, resetting or replacing the phone without a backup can lose your data. Making and keeping backups is your responsibility.',
        ],
      },
      {
        heading: '7. Governing law',
        body: ['These terms are governed by the laws of the Sultanate of Oman.'],
      },
    ],
  },
};

export const LEGAL_ORDER: LegalDocId[] = ['guide', 'privacy', 'disclaimer'];
