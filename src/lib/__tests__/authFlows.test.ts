import { authRedirect, completeAuthFromUrl, validateEmail, validatePassword } from '../authFlows';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({
  createURL: (p: string) => `billscan://${p}`,
  parse: (u: string) => ({ queryParams: Object.fromEntries(new URL(u.replace('billscan://', 'https://x/')).searchParams) }),
}));
const mockExchange = jest.fn(async () => ({ error: null }));
jest.mock('../supabase', () => ({ supabase: { auth: { exchangeCodeForSession: (...a: unknown[]) => mockExchange(...(a as [])) } } }));

describe('auth flows', () => {
  it('validates passwords and emails', () => {
    expect(validatePassword('short1')).toMatch(/8 characters/);
    expect(validatePassword('longpassword')).toMatch(/letters and numbers/);
    expect(validatePassword('BillScan2026')).toBeNull();
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('not-an-email')).toMatch(/valid email/);
  });
  it('builds deep-link redirects', () => {
    expect(authRedirect('auth-callback')).toBe('billscan://auth-callback');
    expect(authRedirect('reset-password')).toBe('billscan://reset-password');
  });
  it('exchanges a code only once even if the link arrives twice', async () => {
    const a = completeAuthFromUrl('billscan://auth-callback?code=abc');
    const b = completeAuthFromUrl('billscan://auth-callback?code=abc');
    expect(await a).toBeNull();
    expect(await b).toBeNull();
    expect(mockExchange).toHaveBeenCalledTimes(1);
  });
  it('turns an error in the link into a message', async () => {
    expect(await completeAuthFromUrl('billscan://auth-callback?error_description=Email+link+is+invalid+or+has+expired')).toMatch(/expired/);
  });
});
