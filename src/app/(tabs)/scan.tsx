import { View } from 'react-native';
import { ComingSoon } from '@/components/ComingSoon';
import { ScreenHeader } from '@/components/ui';
import { useThemeColors } from '@/theme';

export default function Scan() {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader eyebrow="Camera" title="Scan bill" />
      <ComingSoon
        icon="line-scan"
        title="Bill scanning arrives in Phase 2"
        body="Photograph a bill, and the AI reads the date, bill number, amounts, VAT, discount, description, section and remarks for you to check and save."
        phase="Phase 2 · from 18 Oct"
      />
    </View>
  );
}
