import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  FieldLabel,
  OptionsPicker,
  PickerButton,
  SearchPicker,
  type OptionItem,
} from '../components/FormComponents';
import { describeApiError } from '../lib/apiError';
import { Stagger } from '../components/motion/Enter';
import { RECORD_FORMS, type FormFieldDef } from '../lib/recordForms';
import { createRecord, isRecordTypeKey, RECORD_TYPES } from '../lib/records';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toOptions = (rows: any[]): OptionItem[] =>
  rows.map((r) => ({ value: r.name, label: r.name, sub: r.branch }));

/** Returns an error message for a field value, or null when valid. */
function validate(field: FormFieldDef, value: string): string | null {
  const v = value.trim();
  if (!v) return field.required ? 'هذا الحقل مطلوب' : null;
  if (field.kind === 'id' && !/^\d{9}$/.test(v)) return 'يجب أن يتكون من 9 أرقام';
  if (field.kind === 'phone' && !/^\d{9,10}$/.test(v)) return 'رقم غير صحيح (9–10 أرقام)';
  return null;
}

export default function NewRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = isRecordTypeKey(params.type) ? params.type : null;
  const config = type ? RECORD_TYPES[type] : null;
  const sections = useMemo(() => (type ? RECORD_FORMS[type] : []), [type]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<OptionItem[]>([]);
  const [masjeds, setMasjeds] = useState<OptionItem[]>([]);
  const [accommodations, setAccommodations] = useState<OptionItem[]>([]);
  const [openPicker, setOpenPicker] = useState<FormFieldDef | null>(null);
  const [dateField, setDateField] = useState<FormFieldDef | null>(null);

  // Lookup lists come from the local copy downloaded by the sync.
  useEffect(() => {
    Promise.all([
      getSyncedData(STORAGE_KEYS.AID_RECIPIENT_BRANCH),
      getSyncedData(STORAGE_KEYS.AID_RECIPIENT_MASJED),
      getSyncedData(STORAGE_KEYS.ACCOMMODATION),
    ])
      .then(([b, m, a]) => {
        setBranches(toOptions(b));
        setMasjeds(toOptions(m));
        setAccommodations(toOptions(a));
      })
      .catch((e) => console.warn('Failed to load lookup lists:', e));
  }, []);

  const setValue = (key: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // A masjed belongs to a branch: clear it when the branch changes.
      if (key === 'branch' && prev.branch !== value) next.masjed = '';
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const optionsFor = (field: FormFieldDef): OptionItem[] => {
    if (field.kind === 'branch') return branches;
    if (field.kind === 'accommodation') return accommodations;
    if (field.kind === 'masjed') {
      const filtered = masjeds.filter((m) => !values.branch || m.sub === values.branch);
      return filtered.length ? filtered : masjeds;
    }
    return [];
  };

  const handleSave = async () => {
    if (!type || !config) return;
    const nextErrors: Record<string, string> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        const err = validate(field, values[field.key] ?? '');
        if (err) nextErrors[field.key] = err;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      Alert.alert('بيانات ناقصة', 'يرجى تصحيح الحقول المحددة باللون الأحمر.');
      return;
    }

    const doc: Record<string, any> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        const v = (values[field.key] ?? '').trim();
        if (!v) continue;
        doc[field.key] = field.kind === 'int' ? parseInt(v, 10) : v;
      }
    }

    setSaving(true);
    try {
      await createRecord(type, doc);
      Alert.alert('تم الحفظ', `تمت إضافة ${config.singular} كمسودة بنجاح.`);
      router.back();
    } catch (e: any) {
      const info = describeApiError(e);
      const message =
        info.status === 409 || /duplicate/i.test(info.detail ?? '')
          ? 'رقم الهوية مسجل مسبقاً.'
          : (info.detail ?? info.message);
      Alert.alert('تعذر الحفظ', message);
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-slate-500">نوع السجل غير معروف</Text>
      </SafeAreaView>
    );
  }

  const renderField = (field: FormFieldDef) => {
    const value = values[field.key] ?? '';
    const error = errors[field.key];
    const inputClass = `rounded-2xl border px-4 py-4 text-right text-white ${
      error ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
    }`;

    let control: React.ReactNode;
    switch (field.kind) {
      case 'select':
      case 'branch':
      case 'masjed':
      case 'accommodation':
        control = (
          <PickerButton
            value={value}
            placeholder={`اختر ${field.label}`}
            onPress={() => setOpenPicker(field)}
            error={!!error}
          />
        );
        break;
      case 'date':
        control = (
          <TouchableOpacity
            onPress={() => setDateField(field)}
            className={`flex-row items-center justify-between rounded-2xl border px-4 py-4 ${
              error ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
            }`}>
            <Ionicons name="calendar-outline" size={20} color="#FF6F20" />
            <Text className={`text-sm ${value ? 'text-white' : 'text-slate-500'}`}>
              {value || 'اختر التاريخ'}
            </Text>
          </TouchableOpacity>
        );
        break;
      default: {
        const numeric = field.kind === 'id' || field.kind === 'phone' || field.kind === 'int';
        control = (
          <TextInput
            value={value}
            onChangeText={(t) =>
              setValue(
                field.key,
                numeric ? t.replace(/[^0-9]/g, '').slice(0, field.kind === 'id' ? 9 : 10) : t
              )
            }
            placeholder={field.placeholder ?? `أدخل ${field.label}`}
            placeholderTextColor="#64748B"
            keyboardType={numeric ? 'numeric' : 'default'}
            multiline={field.kind === 'multiline'}
            className={`${inputClass} ${field.kind === 'multiline' ? 'min-h-[90px]' : ''}`}
            textAlignVertical={field.kind === 'multiline' ? 'top' : 'center'}
          />
        );
      }
    }

    return (
      <View key={field.key} className="mb-5">
        <FieldLabel label={field.label} required={field.required} />
        {control}
        {error ? <Text className="mt-1 text-right text-xs text-red-400">{error}</Text> : null}
      </View>
    );
  };

  const isListPicker =
    !!openPicker && ['branch', 'masjed', 'accommodation'].includes(openPicker.kind);

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="mb-3 flex-row items-center justify-between px-4 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface">
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">إضافة {config.singular}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="rounded-2xl bg-primary px-5 py-2">
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="font-bold text-white">حفظ</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 100}
        className="flex-1">
        <ScrollView
          className="px-5"
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled">
          <Stagger>
            <View className="mb-5 flex-row-reverse items-center rounded-2xl border border-white/5 bg-surface/60 p-3">
              <Ionicons name="information-circle-outline" size={18} color="#94A3B8" />
              <Text className="mr-2 flex-1 text-right text-xs text-slate-400">
                يتطلب الحفظ اتصالاً بالإنترنت. يُحفظ السجل كمسودة لمراجعته.
              </Text>
            </View>

            {sections.map((section) => (
              <View key={section.title} className="mb-2">
                <Text className="mb-4 text-right text-base font-bold text-primary">
                  {section.title}
                </Text>
                {section.fields.map(renderField)}
              </View>
            ))}
          </Stagger>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <SearchPicker
        title={openPicker ? `اختر ${openPicker.label}` : ''}
        visible={isListPicker}
        options={openPicker ? optionsFor(openPicker) : []}
        onSelect={(item) => openPicker && setValue(openPicker.key, item.value)}
        onClose={() => setOpenPicker(null)}
      />
      <OptionsPicker
        title={openPicker ? `اختر ${openPicker.label}` : ''}
        visible={openPicker?.kind === 'select'}
        options={openPicker?.options ?? []}
        onSelect={(v) => openPicker && setValue(openPicker.key, v)}
        onClose={() => setOpenPicker(null)}
      />

      {dateField && (
        <DateTimePicker
          value={values[dateField.key] ? new Date(values[dateField.key]) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={new Date()}
          themeVariant="dark"
          onChange={(_: DateTimePickerEvent, selected?: Date) => {
            const key = dateField.key;
            setDateField(null);
            if (selected) setValue(key, formatDate(selected));
          }}
        />
      )}
    </SafeAreaView>
  );
}
