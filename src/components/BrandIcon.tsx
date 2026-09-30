/** Renders an OpsNest-style two-tone icon (see brandIconShapes.ts). */
import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { BRAND_COLORS, BRAND_ICONS, BrandIconName, Paint } from './brandIconShapes';

export function BrandIcon({ name, size = 28 }: { name: BrandIconName; size?: number }) {
  const gid = `bi-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const paint = (p?: Paint) => (!p ? 'none' : p === 'grad' ? `url(#${gid})` : BRAND_COLORS[p]);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={gid} gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="58" y2="0">
          <Stop offset="0" stopColor={BRAND_COLORS.gradFrom} />
          <Stop offset="1" stopColor={BRAND_COLORS.gradTo} />
        </LinearGradient>
      </Defs>
      {BRAND_ICONS[name].map((s, i) => {
        const common = {
          fill: paint(s.fill),
          stroke: paint(s.stroke),
          strokeWidth: s.width ?? 0,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        };
        if (s.kind === 'path') return <Path key={i} d={s.d} {...common} />;
        if (s.kind === 'rect') return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...common} />;
        return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
      })}
    </Svg>
  );
}
