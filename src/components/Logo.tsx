import { Image } from 'expo-image';
import billscanTile from '../../assets/brand/billscan-tile-512.png';

/** BillScan mark: the teal→blue scan tile, the same as the splash and the app icon. */
export function Logo({ size = 64 }: { size?: number }) {
  return <Image source={billscanTile} style={{ width: size, height: size }} contentFit="contain" accessibilityIgnoresInvertColors />;
}
