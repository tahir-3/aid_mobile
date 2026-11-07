import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  activeFilterCount,
  DATE_OPERATORS,
  datesFor,
  FILTER_FIELDS,
  HAS_CHILD_AGE,
  type AidCondition,
  type FilterFieldDef,
  type PeopleFilter,
} from '../lib/peopleFilter';
import type { AidRecipientType } from '../lib/personAids';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';
import {
  FieldLabel,
  OptionsPicker,
  PickerButton,
  RadioGroup,
  SearchPicker,
  type OptionItem,
} from './FormComponents';
import { Stagger } from './motion/Enter';

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toOptions = (rows: any[]): OptionItem[] =>
  rows.map((r) => ({ value: r.name, label: r.name, sub: r.branch }));

const RECEIVED = 'استلم';
const NOT_RECEIVED = 'لم يستلم';

/** Two small numeric inputs: "from" and "to". */
function RangeInputs({
  label,
  minValue,
  maxValue,
  onChange,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onChange: (which: 'min' | 'max', value: string) => void;
}) {
  const input = (which: 'min' | 'max', value: string, placeholder: string) => (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(which, t.replace(/[^0-9]/g, '').slice(0, 3))}
      placeholder={placeholder}
      placeholderTextColor="#64748B"
      keyboardType="numeric"
      className="flex-1 rounded-2xl border border-white/10 bg-surface px-4 py-3 text-center text-white"
    />
  );
  return (
    <View className="mb-5">
      <FieldLabel label={label} />
      <View className="flex-row-reverse gap-3">
        {input('min', minValue, 'من')}
        {input('max', maxValue, 'إلى')}
      </View>
    </View>
  );
}

export function FilterSheet({
  visible,
  type,
  title,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  type: AidRecipientType;
  title: string;
  value: PeopleFilter;
  onApply: (filter: PeopleFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PeopleFilter>(value);
  const [branches, setBranches] = useState<OptionItem[]>([]);
  const [masjeds, setMasjeds] = useState<OptionItem[]>([]);
  const [accommodations, setAccommodations] = useState<OptionItem[]>([]);
  const [aidTypes, setAidTypes] = useState<OptionItem[]>([]);
  const [openField, setOpenField] = useState<FilterFieldDef | null>(null);
  const [aidTypePickerFor, setAidTypePickerFor] = useState<number | null>(null);
  const [datePicker, setDatePicker] = useState<{ index: number; which: 'from' | 'to' } | null>(
    null
  );

  // Edit a copy; only "تطبيق" changes the list.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  useEffect(() => {
    if (!visible) return;
    Promise.all([
      getSyncedData(STORAGE_KEYS.AID_RECIPIENT_BRANCH),
      getSyncedData(STORAGE_KEYS.AID_RECIPIENT_MASJED),
      getSyncedData(STORAGE_KEYS.ACCOMMODATION),
      getSyncedData(STORAGE_KEYS.AID_TYPE),
    ])
      .then(([b, m, a, t]) => {
        setBranches(toOptions(b));
        setMasjeds(toOptions(m));
        setAccommodations(toOptions(a));
        setAidTypes(t.map((x: any) => ({ value: x.name, label: x.name })));
      })
      .catch((e) => console.warn('Failed to load filter lookups:', e));
  }, [visible]);

  const setField = (key: string, v: string) =>
    setDraft((d) => {
      const fields = { ...d.fields, [key]: v };
      if (key === 'branch' && d.fields.branch !== v) fields.masjed = '';
      return { ...d, fields };
    });

  const setCondition = (index: number, patch: Partial<AidCondition>) =>
    setDraft((d) => ({
      ...d,
      aidConditions: d.aidConditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const addCondition = () =>
    setDraft((d) => ({
      ...d,
      aidConditions: [...d.aidConditions, { operator: 'Received', date_operator: '' }],
    }));

  const removeCondition = (index: number) =>
    setDraft((d) => ({ ...d, aidConditions: d.aidConditions.filter((_, i) => i !== index) }));

  const optionsFor = (field: FilterFieldDef): OptionItem[] => {
    if (field.kind === 'branch') return branches;
    if (field.kind === 'accommodation') return accommodations;
    if (field.kind === 'masjed') {
      const filtered = masjeds.filter((m) => !draft.fields.branch || m.sub === draft.fields.branch);
      return filtered.length ? filtered : masjeds;
    }
    return [];
  };

  const count = activeFilterCount(draft);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4">
          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-white">تصفية {title}</Text>
          <TouchableOpacity onPress={() => setDraft({ fields: {}, aidConditions: [] })}>
            <Text className="text-sm font-bold text-red-400">مسح الكل</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="px-5"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          <Stagger>
            <Text className="mb-4 text-right text-base font-bold text-primary">البيانات</Text>

            {FILTER_FIELDS[type].map((field) => {
              const v = draft.fields[field.key] ?? '';
              return (
                <View key={field.key} className="mb-5">
                  <View className="flex-row-reverse items-center justify-between">
                    <FieldLabel label={field.label} />
                    {v ? (
                      <TouchableOpacity onPress={() => setField(field.key, '')} hitSlop={8}>
                        <Text className="mb-2 text-xs text-slate-400">إزالة</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <PickerButton value={v} placeholder="الكل" onPress={() => setOpenField(field)} />
                </View>
              );
            })}

            <RangeInputs
              label="عدد أفراد الأسرة"
              minValue={draft.fields.min_family_members ?? ''}
              maxValue={draft.fields.max_family_members ?? ''}
              onChange={(w, t) => setField(`${w}_family_members`, t)}
            />

            {HAS_CHILD_AGE[type] ? (
              <RangeInputs
                label={type === 'Martyrs' ? 'أعمار الأيتام (بالسنوات)' : 'أعمار الأطفال (بالسنوات)'}
                minValue={draft.fields.min_child_age ?? ''}
                maxValue={draft.fields.max_child_age ?? ''}
                onChange={(w, t) => setField(`${w}_child_age`, t)}
              />
            ) : null}

            {/* Aid history conditions */}
            <View className="mb-3 mt-2 flex-row-reverse items-center justify-between">
              <Text className="text-right text-base font-bold text-primary">سجل المساعدات</Text>
              <TouchableOpacity
                onPress={addCondition}
                className="flex-row-reverse items-center rounded-full bg-primary/10 px-3 py-1.5">
                <Ionicons name="add" size={16} color="#FF6F20" />
                <Text className="mr-1 text-xs font-bold text-primary">إضافة شرط</Text>
              </TouchableOpacity>
            </View>

            {draft.aidConditions.length === 0 ? (
              <Text className="mb-4 text-right text-xs text-slate-500">
                مثال: من لم يستلم «سلة غذائية» خلال الشهر الماضي.
              </Text>
            ) : null}

            {draft.aidConditions.map((c, i) => {
              const need = datesFor(c.date_operator);
              return (
                <View key={i} className="mb-4 rounded-3xl border border-white/5 bg-surface p-4">
                  <View className="mb-3 flex-row-reverse items-center justify-between">
                    <Text className="text-sm font-bold text-white">شرط {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeCondition(i)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color="#F87171" />
                    </TouchableOpacity>
                  </View>

                  <RadioGroup
                    options={[RECEIVED, NOT_RECEIVED]}
                    value={c.operator === 'Received' ? RECEIVED : NOT_RECEIVED}
                    onChange={(v) =>
                      setCondition(i, { operator: v === RECEIVED ? 'Received' : 'Not Received' })
                    }
                  />

                  <View className="mt-3">
                    <PickerButton
                      value={c.aid_type ?? ''}
                      placeholder="أي نوع مساعدة"
                      onPress={() => setAidTypePickerFor(i)}
                    />
                  </View>

                  <View className="mt-3 flex-row-reverse flex-wrap gap-2">
                    {DATE_OPERATORS.map((op) => {
                      const active = (c.date_operator ?? '') === op.value;
                      return (
                        <TouchableOpacity
                          key={op.value || 'any'}
                          onPress={() => setCondition(i, { date_operator: op.value })}
                          className={`rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'bg-slate-800/60'}`}>
                          <Text
                            className={`text-xs ${active ? 'font-bold text-white' : 'text-slate-400'}`}>
                            {op.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {need.from || need.to ? (
                    <View className="mt-3 flex-row-reverse gap-3">
                      {(['from', 'to'] as const)
                        .filter((w) => need[w])
                        .map((w) => {
                          const v = w === 'from' ? c.from_date : c.to_date;
                          return (
                            <TouchableOpacity
                              key={w}
                              onPress={() => setDatePicker({ index: i, which: w })}
                              className="flex-1 flex-row items-center justify-between rounded-2xl border border-white/10 bg-background px-3 py-3">
                              <Ionicons name="calendar-outline" size={16} color="#FF6F20" />
                              <Text className={`text-xs ${v ? 'text-white' : 'text-slate-500'}`}>
                                {v ?? (w === 'from' ? 'من تاريخ' : 'إلى تاريخ')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  ) : null}

                  {c.operator === 'Received' ? (
                    <View className="mt-3 flex-row-reverse items-center gap-3">
                      <Text className="text-xs text-slate-400">عدد المرات</Text>
                      {(['min_times', 'max_times'] as const).map((k) => (
                        <TextInput
                          key={k}
                          value={c[k] ? String(c[k]) : ''}
                          onChangeText={(t) => {
                            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                            setCondition(i, { [k]: Number.isNaN(n) ? undefined : n });
                          }}
                          placeholder={k === 'min_times' ? 'من' : 'إلى'}
                          placeholderTextColor="#64748B"
                          keyboardType="numeric"
                          className="flex-1 rounded-2xl border border-white/10 bg-background px-3 py-2 text-center text-white"
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Stagger>
        </ScrollView>

        {/* Apply */}
        <View className="border-t border-white/5 px-4 pb-4 pt-3">
          <TouchableOpacity
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            className="h-14 items-center justify-center rounded-2xl bg-primary">
            <Text className="text-lg font-bold text-white">
              {count ? `تطبيق (${count})` : 'عرض الكل'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pickers */}
        <OptionsPicker
          title={openField ? `اختر ${openField.label}` : ''}
          visible={openField?.kind === 'select'}
          options={openField?.options ?? []}
          onSelect={(v) => openField && setField(openField.key, v)}
          onClose={() => setOpenField(null)}
        />
        <SearchPicker
          title={openField ? `اختر ${openField.label}` : ''}
          visible={!!openField && openField.kind !== 'select'}
          options={openField ? optionsFor(openField) : []}
          onSelect={(item) => openField && setField(openField.key, item.value)}
          onClose={() => setOpenField(null)}
        />
        <SearchPicker
          title="اختر نوع المساعدة"
          visible={aidTypePickerFor !== null}
          options={aidTypes}
          onSelect={(item) =>
            aidTypePickerFor !== null && setCondition(aidTypePickerFor, { aid_type: item.value })
          }
          onClose={() => setAidTypePickerFor(null)}
        />

        {datePicker && (
          <DateTimePicker
            value={(() => {
              const c = draft.aidConditions[datePicker.index];
              const v = datePicker.which === 'from' ? c?.from_date : c?.to_date;
              return v ? new Date(v) : new Date();
            })()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            themeVariant="dark"
            onChange={(_: DateTimePickerEvent, selected?: Date) => {
              const target = datePicker;
              setDatePicker(null);
              if (selected)
                setCondition(target.index, {
                  [target.which === 'from' ? 'from_date' : 'to_date']: formatDate(selected),
                });
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
