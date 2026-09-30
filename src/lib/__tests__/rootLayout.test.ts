import { readFileSync } from 'fs';
import { join } from 'path';

// expo-router throws "Cannot convert Symbol to string" at start-up when a Stack or
// Stack.Protected has a fragment child, so the root layout must never use one.
test('root layout Stack has no fragment children', () => {
  const src = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');
  const stack = src.slice(src.indexOf('<Stack '), src.lastIndexOf('</Stack>'));
  expect(stack).not.toMatch(/<>|<\/>|Fragment/);
});
