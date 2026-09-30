/// <reference types="node" />
import fs from 'node:fs';
import { needsOnboarding } from '@/state/onboarding';
import { LEGAL_DOCS, LEGAL_ORDER, LEGAL_VERSION } from '../documents';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

describe('legal documents', () => {
  it('has three complete documents with consent wording', () => {
    expect(LEGAL_ORDER).toEqual(['guide', 'privacy', 'disclaimer']);
    for (const id of LEGAL_ORDER) {
      const d = LEGAL_DOCS[id];
      expect(d.sections.length).toBeGreaterThan(3);
      expect(d.consentLabel.length).toBeGreaterThan(20);
      d.sections.forEach((s) => expect(s.body.join('').length).toBeGreaterThan(20));
    }
    expect(LEGAL_DOCS.disclaimer.sections.map((s) => s.heading).join(' ')).toMatch(/liability/i);
    if (process.env.LEGAL_OUT) fs.writeFileSync(process.env.LEGAL_OUT, JSON.stringify({ version: LEGAL_VERSION, docs: LEGAL_DOCS, order: LEGAL_ORDER }));
  });

  it('asks again when the legal version changes', () => {
    expect(needsOnboarding({ consent: null, permissionsSeen: false })).toBe(true);
    expect(needsOnboarding({ consent: { version: LEGAL_VERSION, acceptedAt: 'x' }, permissionsSeen: false })).toBe(true);
    expect(needsOnboarding({ consent: { version: LEGAL_VERSION, acceptedAt: 'x' }, permissionsSeen: true })).toBe(false);
    expect(needsOnboarding({ consent: { version: '2020-01-01', acceptedAt: 'x' }, permissionsSeen: true })).toBe(true);
  });
});
