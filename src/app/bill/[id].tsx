import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Card, Field, Message, ScreenHeader } from '@/components/ui';
import { BillRecord, deleteBill, findDuplicates, getBill, setAiStatus, updateBill } from '@/db/bills';
import { DescriptionItem, descriptionsBySection, listDescriptions } from '@/db/repo';
import { Section, SECTION_INFO, SECTIONS } from '@/db/schema';
import { BillForm, draftFromForm, formFromDraft, splitFromTotal } from '@/lib/billForm';
import { deleteBillImages, readPagesBase64 } from '@/lib/billImages';
import { checkDraft, DiscountType, DraftField, draftFromExtraction, Flag, hasErrors, MAX_REMARKS } from '@/lib/billRules';
import { extractBill } from '@/lib/extract';
import { formatOmr, toBaisa } from '@/lib/money';
import { formatReportDate, monthIdOfIsoDate, monthLabel, MonthId } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

/** Review a scanned bill: compare with the photo, fix anything flagged, then save it to the month. */
export default function BillReview() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const touch = useMonthStore((s) => s.touch);
  const { id, aiError } = useLocalSearchParams<{ id: string; aiError?: string }>();

  const [bill, setBill] = useState<BillRecord | null>(null);
  const [form, setForm] = useState<BillForm | null>(null);
  const [month, setMonth] = useState<MonthId>('');
  const [keepMonth, setKeepMonth] = useState(false);
  const [descs, setDescs] = useState<DescriptionItem[]>([]);
  const [aiMsg, setAiMsg] = useState<string | null>(aiError ?? null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !id) return;
    const [b, d] = await Promise.all([getBill(userId, id), listDescriptions(userId)]);
    setDescs(d);
    if (!b) return setNotFound(true);
    setBill(b);
    setForm(formFromDraft(b));
    setMonth(b.month);
  }, [userId, id]);

  // Load once when the screen opens (the photo viewer is a modal, so focus doesn't change while editing).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // A bill waiting for internet is filled in by the background queue; show the result
  // as long as nothing has been typed on this screen yet.
  const formEmpty = !form || (!form.grandTotal && !form.billNo && !form.billDate);
  const waiting = bill?.aiStatus === 'pending';
  useEffect(
    () =>
      useMonthStore.subscribe((s, prev) => {
        if (s.version !== prev.version && waiting && formEmpty) load();
      }),
    [waiting, formEmpty, load],
  );

  const draft = useMemo(() => (form && bill ? draftFromForm(form, bill) : null), [form, bill]);
  const flags: Flag[] = useMemo(() => {
    if (!draft || !bill) return [];
    const all = checkDraft(draft, { targetMonth: month, confidence: bill.extraction?.confidence });
    return keepMonth ? all.filter((f) => f.code !== 'OTHER_MONTH') : all;
  }, [draft, bill, month, keepMonth]);

  if (notFound) {
    return (
      <Shell title="Bill not found">
        <Message tone="error" text="This bill was deleted." />
      </Shell>
    );
  }
  if (!bill || !form || !draft) {
    return (
      <Shell title="Bill">
        <ActivityIndicator color={c.primary} />
      </Shell>
    );
  }

  const set = <K extends keyof BillForm>(k: K) => (v: BillForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const flagFor = (field: DraftField) => {
    const fs = flags.filter((f) => f.field === field);
    return fs.some((f) => f.level === 'error') ? 'error' : fs.some((f) => f.level === 'warn') ? 'warn' : null;
  };
  const border = (field: DraftField) => {
    const t = flagFor(field);
    return t === 'error' ? { borderColor: c.danger, borderWidth: 2 } : t === 'warn' ? { borderColor: c.warning, borderWidth: 2 } : undefined;
  };

  const billMonth = monthIdOfIsoDate(draft.billDate);
  const status = bill.status;

  async function onReadAgain() {
    if (!bill || bill.imagePaths.length === 0) return;
    setReading(true);
    setAiMsg(null);
    try {
      const pages = await readPagesBase64(bill.imagePaths);
      const res = await extractBill(pages, descriptionsBySection(descs));
      if (!res.ok) {
        if (res.offline) return setAiMsg('Still no internet. The bill will be read automatically when you are back online.');
        await setAiStatus(userId, bill.id, 'failed');
        return setAiMsg(res.error);
      }
      const d = draftFromExtraction(res.extraction);
      await updateBill(userId, bill.id, d, { extraction: res.extraction });
      touch();
      await load();
    } catch (e) {
      setAiMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  }

  async function persist(statusTo: BillRecord['status']) {
    if (!bill || !draft) return;
    setBusy(true);
    try {
      await updateBill(userId, bill.id, draft, { month, status: statusTo });
      touch();
      if (month !== bill.month) useMonthStore.getState().setMonth(month);
      router.back();
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!bill || !draft) return;
    if (hasErrors(flags)) {
      Alert.alert('Fix the red items first', flags.filter((f) => f.level === 'error').map((f) => `• ${f.message}`).join('\n'));
      return;
    }
    const dupes = await findDuplicates(userId, bill.id, draft);
    if (dupes.length > 0) {
      const d = dupes[0];
      Alert.alert(
        'This bill may already be in BillScan',
        `${d.status === 'draft' ? 'Draft' : 'Saved'} in ${monthLabel(d.month)}: bill ${d.billNo ?? '(no number)'} dated ${
          d.billDate ? formatReportDate(d.billDate) : '—'
        }, ${d.grandTotal !== null ? formatOmr(d.grandTotal) : '—'} OMR.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Save anyway', onPress: () => persist('saved') },
        ],
      );
      return;
    }
    await persist('saved');
  }

  function onCancelBill() {
    Alert.alert(
      'Mark as cancelled?',
      'Cancelled bills are listed in Section B of the report and are not counted in the totals.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Mark cancelled', style: 'destructive', onPress: () => persist('cancelled') },
      ],
    );
  }

  function onDelete() {
    Alert.alert('Delete this bill?', 'The photo and the details are removed from this phone. This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!bill) return;
          await deleteBill(userId, bill.id);
          deleteBillImages(bill.id);
          touch();
          router.back();
        },
      },
    ]);
  }

  const discountNonZero = (toBaisa(form.discount) ?? 0) !== 0;
  const errors = flags.filter((f) => f.level === 'error').length;
  const warns = flags.filter((f) => f.level === 'warn').length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        eyebrow={`${status === 'saved' ? 'Saved' : status === 'cancelled' ? 'Cancelled' : 'Draft'} · ${monthLabel(month)}`}
        title={draft.billNo ? `Bill ${draft.billNo}` : 'Check bill'}
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Photos */}
        {bill.imagePaths.length > 0 ? (
          <ScrollView horizontal contentContainerStyle={{ gap: spacing.sm }} showsHorizontalScrollIndicator={false}>
            {bill.imagePaths.map((uri, i) => (
              <Pressable key={uri} onPress={() => setViewer(uri)} accessibilityRole="imagebutton" accessibilityLabel={`Open page ${i + 1}`}>
                <Image source={{ uri }} style={[styles.thumb, { borderColor: c.border }]} contentFit="cover" />
                <Text style={[styles.thumbLabel, { color: c.textMuted }]}>Page {i + 1} · tap to zoom</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* AI status */}
        {reading ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ActivityIndicator color={c.primary} />
            <Text style={{ color: c.text, fontFamily: fonts.medium }}>Reading the bill…</Text>
          </Card>
        ) : aiMsg ? (
          <View style={{ gap: spacing.sm }}>
            <Message tone="error" text={`${aiMsg} You can type the details yourself, or try again.`} />
            {bill.imagePaths.length > 0 ? <Button label="Read with AI again" kind="secondary" onPress={onReadAgain} /> : null}
          </View>
        ) : bill.aiStatus === 'pending' && !bill.extraction ? (
          <View style={{ gap: spacing.sm }}>
            <Message
              tone="info"
              text="Waiting for internet. The photo is saved and this bill will be read automatically when the phone is back online. You can also type the details yourself."
            />
            <Button label="Read now" kind="secondary" onPress={onReadAgain} />
          </View>
        ) : !bill.extraction && bill.imagePaths.length > 0 ? (
          <Button label="Read with AI" kind="secondary" onPress={onReadAgain} />
        ) : null}
        {bill.extraction?.notes ? <Message tone="info" text={`AI note: ${bill.extraction.notes}`} /> : null}

        {/* Checks */}
        {flags.length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={[styles.h2, { color: c.text }]}>
              {errors > 0 ? `${errors} to fix` : 'Ready to save'}
              {warns > 0 ? ` · ${warns} to check` : ''}
            </Text>
            {flags.map((f) => (
              <FlagRow key={f.code} flag={f} />
            ))}
          </Card>
        ) : (
          <Message tone="success" text="All checks passed. Compare with the photo once, then save." />
        )}

        {/* Month choice */}
        {billMonth && billMonth !== month && !keepMonth ? (
          <Card style={{ borderColor: c.warning, backgroundColor: c.warningSoft }}>
            <Text style={{ color: c.text, fontFamily: fonts.medium }}>Which month&apos;s report should this bill go in?</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button style={{ flex: 1 }} label={monthLabel(billMonth)} onPress={() => setMonth(billMonth)} />
              <Button style={{ flex: 1 }} kind="secondary" label={`Keep in ${monthLabel(month)}`} onPress={() => setKeepMonth(true)} />
            </View>
          </Card>
        ) : null}

        {/* Fields */}
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field
              label="Bill date (DD-MM-YYYY)"
              value={form.billDate}
              onChangeText={set('billDate')}
              keyboardType="numbers-and-punctuation"
              placeholder="17-09-2026"
              style={border('billDate')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Bill No."
              value={form.noBillNo ? '' : form.billNo}
              editable={!form.noBillNo}
              onChangeText={set('billNo')}
              autoCapitalize="characters"
              placeholder={form.noBillNo ? 'No number' : '0022'}
              style={border('billNo')}
            />
          </View>
        </View>
        <View style={styles.switchRow}>
          <Switch value={form.noBillNo} onValueChange={set('noBillNo')} accessibilityLabel="Bill has no bill number" />
          <Text style={{ color: c.textMuted, fontFamily: fonts.regular }}>This bill has no bill number</Text>
        </View>

        <Text style={[styles.label, { color: c.textMuted }]}>DESCRIPTION</Text>
        <View style={[styles.descBox, { borderColor: flagFor('description') === 'error' ? c.danger : 'transparent' }]}>
          {SECTIONS.map((sec) => (
            <DescGroup
              key={sec}
              section={sec}
              items={descs.filter((d) => d.section === sec)}
              selected={form.description}
              onSelect={(label) => setForm((f) => (f ? { ...f, description: label, section: sec } : f))}
            />
          ))}
        </View>

        <Card>
          <Text style={[styles.h2, { color: c.text }]}>Amounts (OMR)</Text>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Shop rate" value={form.shopRate} onChangeText={set('shopRate')} keyboardType="decimal-pad" placeholder="0.000" style={border('shopRate')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={form.vatCalculated ? 'VAT (worked out)' : 'VAT 5%'}
                value={form.vat}
                onChangeText={(v) => setForm((f) => (f ? { ...f, vat: v, vatCalculated: false } : f))}
                keyboardType="decimal-pad"
                placeholder="0.000"
                style={border('vat')}
              />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Disc." value={form.discount} onChangeText={set('discount')} keyboardType="numbers-and-punctuation" placeholder="0.000" style={border('discount')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Grand total" value={form.grandTotal} onChangeText={set('grandTotal')} keyboardType="decimal-pad" placeholder="0.000" style={border('grandTotal')} />
            </View>
          </View>
          {discountNonZero ? (
            <Segmented<DiscountType>
              value={form.discountType === 'none' ? 'after_vat' : form.discountType}
              options={[
                { value: 'before_vat', label: 'Disc. before VAT' },
                { value: 'after_vat', label: 'Round-off after VAT' },
              ]}
              onChange={set('discountType')}
            />
          ) : null}
          <Text style={[styles.formula, { color: c.textMuted }]}>
            Shop rate + VAT − Disc. ={' '}
            {draft.shopRate !== null && draft.vat !== null ? formatOmr(draft.shopRate + draft.vat - draft.discount) : '—'}
          </Text>
          <View style={styles.row2}>
            <Button style={{ flex: 1 }} kind="secondary" label="VAT from total" onPress={() => setForm((f) => (f ? splitFromTotal(f, true) : f))} />
            <Button style={{ flex: 1 }} kind="secondary" label="No VAT" onPress={() => setForm((f) => (f ? splitFromTotal(f, false) : f))} />
          </View>
        </Card>

        <Field
          label={`Remarks (${form.remarks.length}/${MAX_REMARKS})`}
          value={form.remarks}
          onChangeText={set('remarks')}
          maxLength={MAX_REMARKS + 20}
          placeholder="Shop name · Cash"
          style={border('remarks')}
        />
        <Field label="Vendor (not in report)" value={form.vendorName} onChangeText={set('vendorName')} placeholder="Shop name" />

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button label={status === 'saved' ? 'Save changes' : `Save to ${monthLabel(month)}`} onPress={onSave} busy={busy} />
          {status === 'draft' ? <Button label="Keep as draft" kind="secondary" onPress={() => persist('draft')} /> : null}
          {status === 'cancelled' ? (
            <Button label="Not cancelled — move back to drafts" kind="secondary" onPress={() => persist('draft')} />
          ) : (
            <Button label="Mark as cancelled bill" kind="secondary" onPress={onCancelBill} />
          )}
          <Button label="Delete" kind="danger" onPress={onDelete} />
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={viewer !== null} animationType="fade" onRequestClose={() => setViewer(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setViewer(null)} accessibilityLabel="Close photo">
            {viewer ? <Image source={{ uri: viewer }} style={{ flex: 1 }} contentFit="contain" /> : null}
          </Pressable>
          <Text style={{ color: '#fff', textAlign: 'center', padding: spacing.md, fontFamily: fonts.regular }}>Tap to close</Text>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        title={title}
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function FlagRow({ flag }: { flag: Flag }) {
  const c = useThemeColors();
  const color = flag.level === 'error' ? c.danger : flag.level === 'warn' ? c.warning : c.textMuted;
  const icon = flag.level === 'error' ? 'alert-circle' : flag.level === 'warn' ? 'alert' : 'information-outline';
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
      <MaterialCommunityIcons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: c.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>{flag.message}</Text>
    </View>
  );
}

function DescGroup({
  section,
  items,
  selected,
  onSelect,
}: {
  section: Section;
  items: DescriptionItem[];
  selected: string;
  onSelect: (label: string) => void;
}) {
  const c = useThemeColors();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.textMuted, fontFamily: fonts.medium, fontSize: 12 }}>
        {SECTION_INFO[section].letter} · {SECTION_INFO[section].title}
      </Text>
      <View style={styles.chips}>
        {items.map((d) => {
          const on = d.label === selected;
          return (
            <Pressable
              key={d.label}
              onPress={() => onSelect(d.label)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { backgroundColor: on ? c.primary : c.surface, borderColor: on ? c.primary : c.border }]}
            >
              <Text style={{ color: on ? c.onPrimary : c.text, fontFamily: fonts.medium, fontSize: 14 }}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const c = useThemeColors();
  return (
    <View style={[styles.segment, { borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.segmentItem, { backgroundColor: on ? c.primarySoft : 'transparent' }]}
          >
            <Text style={{ color: on ? c.primary : c.textMuted, fontFamily: fonts.semibold, fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  h2: { fontFamily: fonts.semibold, fontSize: 16 },
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6 },
  thumb: { width: 96, height: 128, borderRadius: radius.md, borderWidth: 1 },
  thumbLabel: { fontFamily: fonts.regular, fontSize: 11, marginTop: 4 },
  row2: { flexDirection: 'row', gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: -spacing.xs },
  descBox: { gap: spacing.md, borderWidth: 2, borderRadius: radius.md, padding: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  formula: { fontFamily: fonts.mono, fontSize: 13 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
});
