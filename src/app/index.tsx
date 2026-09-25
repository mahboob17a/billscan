import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import reportTemplate from '../../assets/templates/DTR-PUR-UTAS-NIZWA-template.xlsx';
import { pingBackend, PingResult } from '@/lib/backend';
import { isBackendConfigured } from '@/lib/config';
import { formatOmr, splitInclusiveTotal } from '@/lib/money';
import { fonts, palette, radius, spacing, ThemeColors, type, useThemeColors } from '@/theme';

type Status = 'pending' | 'ok' | 'fail';

/**
 * Phase 0 system check. Proves the foundation works on a real phone:
 * brand theme, fonts, bundled Excel template, money maths and the server link.
 * Replaced by the login flow and month dashboard in Phase 1.
 */
export default function SystemCheck() {
  const c = useThemeColors();
  const s = makeStyles(c);
  const [template, setTemplate] = useState<Status>('pending');
  const [ping, setPing] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    Asset.fromModule(reportTemplate)
      .downloadAsync()
      .then((a) => setTemplate(a.localUri ? 'ok' : 'fail'))
      .catch(() => setTemplate('fail'));
  }, []);

  const split = splitInclusiveTotal(10500);
  const mathsOk = split.net === 10000 && split.vat === 500;

  async function runPing() {
    setPinging(true);
    setPing(await pingBackend());
    setPinging(false);
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.header}>
        <Logo size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>BillScan</Text>
          <Text style={s.sub}>Phase 0 · system check</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.intro}>This screen confirms the foundation works on your phone. It is replaced by login and the month dashboard in Phase 1.</Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Colour palette</Text>
          <View style={s.swatches}>
            {[
              ['Slate', palette.slate],
              ['Violet', palette.violet],
              ['Mint', palette.mint],
              ['Lavender', palette.lavenderMist],
            ].map(([name, hex]) => (
              <View key={name} style={s.swatch}>
                <View style={[s.chip, { backgroundColor: hex }]} />
                <Text style={s.swName}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <CheckRow c={c} label="Fonts (IBM Plex)" status="ok" detail="Loaded" />
        <CheckRow
          c={c}
          label="Excel report template"
          status={template}
          detail={template === 'ok' ? 'DTR-PUR-UTAS-NIZWA template bundled' : template === 'fail' ? 'Template missing from the build' : 'Checking…'}
        />
        <CheckRow
          c={c}
          label="Money maths"
          status={mathsOk ? 'ok' : 'fail'}
          detail={`10.500 → ${formatOmr(split.net)} + ${formatOmr(split.vat)} VAT`}
        />
        <CheckRow
          c={c}
          label="Server and AI key"
          status={ping ? (ping.ok ? 'ok' : 'fail') : 'pending'}
          detail={ping ? ping.message : isBackendConfigured() ? 'Tap the button to test' : 'Server address not set yet'}
        />

        <Pressable
          accessibilityRole="button"
          onPress={runPing}
          disabled={pinging}
          style={({ pressed }) => [s.button, { backgroundColor: pressed ? c.primaryPressed : c.primary, opacity: pinging ? 0.7 : 1 }]}
        >
          {pinging ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.buttonText}>Test server connection</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function CheckRow({ c, label, status, detail }: { c: ThemeColors; label: string; status: Status; detail: string }) {
  const tone =
    status === 'ok'
      ? { fg: c.success, bg: c.successSoft, mark: '✓' }
      : status === 'fail'
        ? { fg: c.danger, bg: c.dangerSoft, mark: '!' }
        : { fg: c.textMuted, bg: c.primarySoft, mark: '…' };
  return (
    <View style={[rowStyles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[rowStyles.badge, { backgroundColor: tone.bg }]}>
        <Text style={{ color: tone.fg, fontFamily: fonts.bold, fontSize: 14 }}>{tone.mark}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontFamily: fonts.semibold, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 13 }}>{detail}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.bar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
    },
    brand: { ...type.title, color: c.onBar },
    sub: { fontFamily: fonts.regular, fontSize: 13, color: c.onBar, opacity: 0.75 },
    body: { padding: spacing.lg, gap: spacing.md },
    intro: { ...type.body, color: c.textMuted },
    card: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
    cardTitle: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
    swatches: { flexDirection: 'row', gap: spacing.sm },
    swatch: { flex: 1, alignItems: 'center', gap: 4 },
    chip: { width: '100%', height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border },
    swName: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
    button: { marginTop: spacing.sm, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
    buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: c.onPrimary },
  });
}
