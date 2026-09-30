import { readFileSync } from 'fs';
import { join } from 'path';

// expo-router throws "Cannot convert Symbol to string" at start-up when a Stack or
// Stack.Protected has a fragment child, so the root layout must never use one.
test('root layout Stack has no fragment children', () => {
  const src = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');
  const stack = src.slice(src.indexOf('<Stack '), src.lastIndexOf('</Stack>'));
  expect(stack).not.toMatch(/<>|<\/>|Fragment/);
});

// On a guard change expo-router opens the first allowed screen in declaration order, so
// the always-reachable screens must come after Home, or users land on a legal page.
test('always-reachable screens are declared after Home', () => {
  const src = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');
  const home = src.indexOf('name="(tabs)"');
  for (const name of ['legal/[doc]', 'auth-callback', 'reset-password', 'report-settings']) {
    expect(src.indexOf(`name="${name}"`)).toBeGreaterThan(home);
  }
});
