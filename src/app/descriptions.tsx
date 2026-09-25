import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Card, Field, Message, ScreenHeader } from '@/components/ui';
import { addDescription, DescriptionRow, listAllDescriptions, setDescriptionActive, updateDescription } from '@/db/repo';
import { Section, SECTION_INFO, SECTIONS } from '@/db/schema';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

/** Settings → Description list: the labels offered on the review screen and to the AI. */
export default function Descriptions() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [rows, setRows] = useState<DescriptionRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSection, setEditSection] = useState<Section>('MATERIAL');
  const [newLabel, setNewLabel] = useState('');
  const [newSection, setNewSection] = useState<Section>('MATERIAL');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (userId) setRows(await listAllDescriptions(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onAdd() {
    setMsg(null);
    const err = await addDescription(userId, newLabel, newSection);
    if (err) return setMsg({ tone: 'error', text: err });
    setMsg({ tone: 'success', text: `Added “${newLabel.trim()}” to ${SECTION_INFO[newSection].title}.` });
    setNewLabel('');
    load();
  }

  async function onSaveEdit(old: string) {
    setMsg(null);
    const err = await updateDescription(userId, old, editLabel, editSection);
    if (err) return setMsg({ tone: 'error', text: err });
    setEditing(null);
    load();
  }

  async function onToggle(r: DescriptionRow, on: boolean) {
    const activeInSection = rows.filter((x) => x.active && x.section === r.section).length;
    if (!on && activeInSection <= 1) {
      return setMsg({ tone: 'error', text: `${SECTION_INFO[r.section].title} needs at least one description.` });
    }
    await setDescriptionActive(userId, r.label, on);
    load();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        eyebrow="Settings"
        title="Description list"
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.p, { color: c.textMuted }]}>
          These are the labels you tap on the check screen, and the only ones the AI may choose. Turn a label off to retire it; bills
          already saved keep their description.
        </Text>
        {msg ? <Message tone={msg.tone} text={msg.text} /> : null}

        {SECTIONS.map((sec) => (
          <View key={sec} style={{ gap: spacing.sm }}>
            <Text style={[styles.h2, { color: c.textMuted }]}>
              {SECTION_INFO[sec].letter} · {SECTION_INFO[sec].title.toUpperCase()}
            </Text>
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {rows
                .filter((r) => r.section === sec)
                .map((r, i) =>
                  editing === r.label ? (
                    <View key={r.label} style={[styles.editBox, { borderTopColor: c.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                      <Field label="Description" value={editLabel} onChangeText={setEditLabel} autoFocus maxLength={40} />
                      <SectionPicker value={editSection} onChange={setEditSection} />
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Button style={{ flex: 1 }} kind="secondary" label="Cancel" onPress={() => setEditing(null)} />
                        <Button style={{ flex: 1 }} label="Save" onPress={() => onSaveEdit(r.label)} />
                      </View>
                    </View>
                  ) : (
                    <View key={r.label} style={[styles.row, { borderTopColor: c.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => {
                          setEditing(r.label);
                          setEditLabel(r.label);
                          setEditSection(r.section);
                          setMsg(null);
                        }}
                        accessibilityRole="button"
                        accessibilityHint="Rename or move to another section"
                      >
                        <Text style={{ color: r.active ? c.text : c.textMuted, fontFamily: fonts.medium, fontSize: 15 }}>{r.label}</Text>
                        <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>
                          {r.active ? '' : 'Retired · '}
                          {r.used === 0 ? 'Not used yet' : `${r.used} ${r.used === 1 ? 'bill' : 'bills'}`} · tap to rename
                        </Text>
                      </Pressable>
                      <Switch
                        value={r.active}
                        onValueChange={(on) => onToggle(r, on)}
                        trackColor={{ true: c.primary, false: c.border }}
                        thumbColor={c.surface}
                        accessibilityLabel={`${r.label} in use`}
                      />
                    </View>
                  ),
                )}
            </Card>
          </View>
        ))}

        <Text style={[styles.h2, { color: c.textMuted }]}>ADD A DESCRIPTION</Text>
        <Card>
          <Field label="Description" value={newLabel} onChangeText={setNewLabel} placeholder="e.g. Glass & Aluminium" maxLength={40} />
          <SectionPicker value={newSection} onChange={setNewSection} />
          <Button label="Add" onPress={onAdd} disabled={newLabel.trim().length < 2} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionPicker({ value, onChange }: { value: Section; onChange: (s: Section) => void }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {SECTIONS.map((s) => {
        const on = s === value;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? c.primary : c.surface, borderColor: on ? c.primary : c.border }]}
          >
            <Text style={{ color: on ? c.onPrimary : c.text, fontFamily: fonts.medium, fontSize: 13 }}>
              {SECTION_INFO[s].letter} · {SECTION_INFO[s].title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  p: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  h2: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: spacing.md },
  editBox: { paddingVertical: spacing.md, gap: spacing.md },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
});
