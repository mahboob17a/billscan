import { LEGAL_VERSION } from '@/legal/documents';
import { needsOnboarding, useOnboarding } from '../onboarding';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const done = { consent: { version: LEGAL_VERSION, acceptedAt: '2026-10-01T00:00:00Z' }, permissionsSeen: true, reportSetupDone: true };

beforeEach(() => useOnboarding.setState({ ...done, registering: false, onboardedNow: false }));

test('Create an account sends a new user through onboarding and report set-up', async () => {
  await useOnboarding.getState().startRegistration();
  const s = useOnboarding.getState();
  expect(s.registering).toBe(true);
  expect(needsOnboarding(s)).toBe(true);
  expect(s.reportSetupDone).toBe(false);
});

test('"I already have an account" restores the previous state', async () => {
  await useOnboarding.getState().startRegistration();
  await useOnboarding.getState().cancelRegistration();
  const s = useOnboarding.getState();
  expect(s.registering).toBe(false);
  expect(needsOnboarding(s)).toBe(false);
  expect(s.reportSetupDone).toBe(true);
});
