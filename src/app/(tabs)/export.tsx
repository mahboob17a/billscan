import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Button, Card, Field, Message, ScreenHeader } from '@/components/ui';
import { getMonthSummary, getReportMonth, MonthSummary, ReportMonth } from '@/db/repo';
import { SECTION_INFO } from '@/db/schema';
import { isoToDmy } from '@/lib/billForm';
import { parseDmy, todayDmy } from '@/lib/dates';
import { formatOmr } from '@/lib/money';
import { monthLabel } from '@/lib/months';
import { exportMonthReport, reportFileExists, sharePdf, shareReport } from '@/report/export';
import { buildBillPhotosPdf } from '@/report/photosPdf';
import { logError } from '@/lib/errorLog';
import { nextRevision, reportFileName } from '@/report/naming';
import { useMonthStore } from '@/state/month';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Month-end: build the DTR purchase report from saved bills and send it. */
export default function Export() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { month, touch } = useMonthStore();
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [rm, setRm] = useState<ReportMonth | null>(null);
  const [datePrepared, setDatePrepared] = useState(todayDmy());
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const [s, r] = await Promise.all([getMonthSummary(userId, month), getReportMonth(userId, month)]);
    setSummary(s);
    setRm(r);
  }, [userId, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(
    () =>
      useMonthStore.subscribe((state, prev) => {
        if (state.version !== prev.version || state.month !== prev.month) {
          setMsg(null);
          load();
        }
      }),
    [load],
  );

  async function onExport() {
    setMsg(null);
    const iso = parseDmy(datePrepared);
    if (!iso) return setMsg({ tone: 'error', text: 'Enter Date Prepared as DD-MM-YYYY, for example 30-09-2026.' });
    setBusy(true);
    try {
      const res = await exportMonthReport(userId, month, iso);
      touch();
      await load();
      setMsg({ tone: 'success', text: `Saved ${res.fileName}. Choose where to send it.` });
      await shareReport(res.uri, res.fileName);
    } catch (e) {
      logError(e, { where: 'export.xlsx' });
      setMsg({ tone: 'error', text: `Could not create the report: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  async function onPhotosPdf() {
    setMsg(null);
    setPdfBusy(true);
    try {
      const res = await buildBillPhotosPdf(userId, month);
      setMsg({ tone: 'success', text: `Saved ${res.fileName} (${res.photoCount} photos).` });
      await sharePdf(res.uri, res.fileName);
    } catch (e) {
      logError(e, { where: 'export.photosPdf' });
      setMsg({ tone: 'error', text: `Could not make the photo PDF: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setPdfBusy(false);
    }
  }

  async function onShareAgain() {
    if (!rm?.exportedFile) return;
    try {
      await shareReport(rm.exportedFile, rm.exportedFile.split('/').pop() ?? 'report.xlsx');
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  }

  const s = summary;
  const nextName = rm ? reportFileName(rm.statementRef, nextRevision(rm)) : '';
  const changedSinceExport = rm?.exportedAt && rm.status === 'open';
  const canShareAgain = rm?.status === 'exported' && reportFileExists(rm.exportedFile);
  const billCount = s ? s.sections.reduce((a, x) => a + x.bills, 0) : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader eyebrow={s?.statementRef ?? ' '} title="Month-end report" right={<MonthSwitcher />} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {rm?.exportedAt ? (
          <Card style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <MaterialCommunityIcons
              name={changedSinceExport ? 'file-alert-outline' : 'file-check-outline'}
              size={22}
              color={changedSinceExport ? c.warning : c.success}
            />
            <Text style={[styles.p, { color: c.text, flex: 1 }]}>
              {changedSinceExport
                ? `Bills or cash changed after the last export (${exportedOn(rm.exportedAt)}). The next file will be a revision: ${nextName}.`
                : `Exported ${exportedOn(rm.exportedAt)} as ${rm.exportedFile?.split('/').pop() ?? nextName}.`}
            </Text>
          </Card>
        ) : null}

        {s && s.draftsToReview > 0 ? (
          <Pressable onPress={() => router.push('/bills/drafts')} accessibilityRole="button">
            <Card style={{ borderColor: c.warning, backgroundColor: c.warningSoft, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: c.warning, fontFamily: fonts.semibold }}>
                {s.draftsToReview} {s.draftsToReview === 1 ? 'draft is' : 'drafts are'} not in the report. Check and save {s.draftsToReview === 1 ? 'it' : 'them'} first.
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={c.warning} />
            </Card>
          </Pressable>
        ) : null}

        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {/* Report order: A, B (cancelled), C, D, E */}
          {s?.sections.flatMap((sec, i) => {
            const line = (
              <Line
                key={sec.section}
                first={i === 0}
                label={`${SECTION_INFO[sec.section].letter} · ${SECTION_INFO[sec.section].title}`}
                meta={`${sec.bills} ${sec.bills === 1 ? 'bill' : 'bills'}`}
                value={formatOmr(sec.total, { thousands: true })}
              />
            );
            return sec.section === 'MATERIAL'
              ? [line, <Line key="CANCELLED" label="B · Cancelled" meta={`${s.cancelledBills} · not counted`} value="—" />]
              : [line];
          })}
          <Line label="Total purchase value" value={s ? formatOmr(s.purchases, { thousands: true }) : '—'} strong />
          <Line
            label="F · Cash brought forward"
            meta="From last month"
            value={s ? formatOmr(s.broughtForward, { thousands: true }) : '—'}
          />
          <Line label="G · Cash received" meta={`${s?.cashEntries ?? 0} ${s?.cashEntries === 1 ? 'entry' : 'entries'}`} value={s ? formatOmr(s.cashReceived, { thousands: true }) : '—'} />
          <Line
            label={s && s.balanceDue < 0 ? 'H · Balance (cash left with you)' : 'H · Balance due (payable by cashier)'}
            value={s ? formatOmr(Math.abs(s.balanceDue), { thousands: true }) : '—'}
            strong
            highlight
          />
        </Card>

        <Field
          label="Date prepared (DD-MM-YYYY)"
          value={datePrepared}
          onChangeText={setDatePrepared}
          keyboardType="numbers-and-punctuation"
          hint={`File: ${nextName}`}
        />
        {msg ? <Message tone={msg.tone} text={msg.text} /> : null}
        <Button
          label={rm?.exportedAt && !changedSinceExport ? 'Create the report again' : 'Create Excel report'}
          onPress={onExport}
          busy={busy}
          disabled={!s}
          icon={<MaterialCommunityIcons name="file-excel-outline" size={20} color={c.onPrimary} />}
        />
        <Button
          label="Send bill photos (PDF)"
          kind="secondary"
          onPress={onPhotosPdf}
          busy={pdfBusy}
          disabled={!s || billCount + (s?.cancelledBills ?? 0) === 0}
          icon={<MaterialCommunityIcons name="file-pdf-box" size={20} color={c.text} />}
        />
        {canShareAgain ? (
          <Button
            label="Send the last file again"
            kind="secondary"
            onPress={onShareAgain}
            icon={<MaterialCommunityIcons name="share-variant-outline" size={20} color={c.text} />}
          />
        ) : null}
        <Text style={[styles.note, { color: c.textMuted }]}>
          {billCount === 0
            ? `No saved bills in ${monthLabel(month)} yet. The report will show “No … bills recorded” in every section.`
            : 'The file uses your DTR template: sections A–H, sub-totals and the reconciliation are Excel formulas, so totals stay correct if head office edits a cell.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function exportedOn(iso: string): string {
  const d = new Date(iso);
  return `on ${isoToDmy(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)} at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Line({ label, meta, value, first, strong, highlight }: { label: string; meta?: string; value: string; first?: boolean; strong?: boolean; highlight?: boolean }) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.line,
        { borderTopColor: c.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth },
        highlight ? { backgroundColor: c.primarySoft, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md } : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontFamily: strong ? fonts.semibold : fonts.medium, fontSize: 15 }}>{label}</Text>
        {meta ? <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>{meta}</Text> : null}
      </View>
      <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: strong ? 16 : 15 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  p: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.md },
});
