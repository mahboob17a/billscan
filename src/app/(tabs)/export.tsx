import { View } from 'react-native';
import { ComingSoon } from '@/components/ComingSoon';
import { ScreenHeader } from '@/components/ui';
import { monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { useThemeColors } from '@/theme';

export default function Export() {
  const c = useThemeColors();
  const month = useMonthStore((s) => s.month);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader eyebrow={monthLabel(month)} title="Month-end report" />
      <ComingSoon
        icon="file-excel-outline"
        title="Excel export arrives in Phase 3"
        body="One tap builds the DTR-PUR-UTAS-NIZWA report in your exact template, plus a PDF of all bill photos, ready to share by email or WhatsApp."
        phase="Phase 3 · from 1 Nov"
      />
    </View>
  );
}
