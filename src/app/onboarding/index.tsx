import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GhostButton, GradientButton, ON, OnbScreen, ScanBillIcon } from '@/components/onboarding';
import { useOnboarding } from '@/state/onboarding';
import { fonts, spacing } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const PAGES: { icon: IconName | 'scan-bill'; title: string; text: string }[] = [
  { icon: 'scan-bill', title: 'Scan every bill', text: 'Photograph printed or handwritten bills — English or Arabic — the moment you buy.' },
  { icon: 'shield-check-outline', title: 'AI reads, you confirm', text: 'Date, bill number, VAT, discount and total are filled in for you. Built-in checks catch anything that doesn’t add up.' },
  { icon: 'file-excel-outline', title: 'Report in one tap', text: 'Your monthly Excel report and a PDF of every bill, ready to send to head office.' },
];

/** Onboarding step 1: what BillScan does (three swipeable pages). */
export default function Intro() {
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const registering = useOnboarding((s) => s.registering);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }
  function next() {
    if (last) return router.push('/onboarding/consent');
    ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
  }

  return (
    <OnbScreen
      footer={
        <>
          <View style={styles.dots}>
            {PAGES.map((p, i) => (
              <View key={p.title} style={[styles.dot, i === page ? styles.dotOn : null]} />
            ))}
          </View>
          <GradientButton label={last ? 'Get started' : 'Next'} icon="arrow-right" onPress={next} />
          {!last ? <GhostButton label="Skip" onPress={() => router.push('/onboarding/consent')} /> : null}
          {registering ? (
            <GhostButton label="I already have an account — sign in" onPress={() => useOnboarding.getState().cancelRegistration()} />
          ) : last ? (
            <View style={{ height: 38 }} />
          ) : null}
        </>
      }
    >
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
        {PAGES.map((p) => (
          <View key={p.title} style={[styles.page, { width }]}>
            <View style={styles.iconWrap}>
              {p.icon === 'scan-bill' ? <ScanBillIcon size={64} /> : <MaterialCommunityIcons name={p.icon} size={56} color={ON.teal} />}
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {p.title}
            </Text>
            <Text style={styles.text}>{p.text}</Text>
          </View>
        ))}
      </ScrollView>
    </OnbScreen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  iconWrap: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: 'rgba(25,211,197,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(25,211,197,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: ON.text, fontFamily: fonts.bold, fontSize: 28, textAlign: 'center' },
  text: { color: ON.sub, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 340 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 24, backgroundColor: ON.teal },
});
