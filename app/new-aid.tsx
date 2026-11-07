import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FieldLabel,
  OptionItem,
  PickerButton,
  RadioGroup,
  SearchPicker,
} from '../components/FormComponents';
import { MultiSelectPicker } from '../components/MultiSelectPicker';
import { Stagger } from '../components/motion/Enter';
import { insertLocalAids } from '../lib/db';
import type { AidRecipientType } from '../lib/personAids';
import { fetchRecords, type RecordTypeKey } from '../lib/records';
import {
  getRecipientsPaginated,
  getSyncedData,
  pushUnsyncedToServer,
  STORAGE_KEYS,
} from '../lib/sync';
import { hasPermission, useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';

// ─── Utilities ───────────────────────────────────────────────────────────────
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Recipient types ─────────────────────────────────────────────────────────
// AID.recipient is a Dynamic Link on AID.recipient_type.
const RECIPIENT_TYPES: {
  type: AidRecipientType;
  label: string;
  plural: string;
  /** Online record list for non-Recipient types (lib/records.ts). */
  recordKey?: RecordTypeKey;
}[] = [
  { type: 'Recipient', label: 'مستفيد', plural: 'المستفيدين' },
  { type: 'Wounded', label: 'جريح', plural: 'الجرحى', recordKey: 'wounded' },
  { type: 'Martyrs', label: 'شهيد', plural: 'الشهداء', recordKey: 'martyrs' },
  { type: 'Prisoner', label: 'أسير', plural: 'الأسرى', recordKey: 'prisoners' },
];

/** Max chips shown for the selection before collapsing into "+N". */
const MAX_CHIPS = 8;

/** Upload new local aids right away when possible; failures stay queued for the next sync. */
function pushInBackground() {
  pushUnsyncedToServer()
    .then((r) => {
      if (r.syncedAids > 0) useSyncStore.getState().markCompleted();
      if (r.errors.length) console.warn('Aid upload errors:', r.errors.slice(0, 5));
    })
    .catch((e) => console.warn('Background aid upload failed (will retry on sync):', e?.message));
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NewAidScreen() {
  const router = useRouter();

  // ── Data lists from storage ──
  const [aidTypes, setAidTypes] = useState<OptionItem[]>([]);
  const [organizations, setOrganizations] = useState<OptionItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Form state ──
  const user = useAuthStore((s) => s.user);
  const allowedTypes = RECIPIENT_TYPES.filter((t) => hasPermission(user, t.type, 'read'));
  const [recipientType, setRecipientType] = useState<AidRecipientType>(
    allowedTypes[0]?.type ?? 'Recipient'
  );
  const typeConfig = RECIPIENT_TYPES.find((t) => t.type === recipientType)!;
  const [selectedRecipients, setSelectedRecipients] = useState<OptionItem[]>([]);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [natureOfAid, setNatureOfAid] = useState('');
  const [aidType, setAidType] = useState<OptionItem | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState('');
  const [organization, setOrganization] = useState<OptionItem | null>(null);
  const [aidDate, setAidDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Pickers visibility ──
  const [openPicker, setOpenPicker] = useState<'aidType' | 'organization' | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // ── Load options from storage ──
  useEffect(() => {
    (async () => {
      const [rawAidTypes, rawOrgs] = await Promise.all([
        getSyncedData(STORAGE_KEYS.AID_TYPE),
        getSyncedData(STORAGE_KEYS.AID_ORGANIZATION),
      ]);
      setAidTypes(rawAidTypes.map((t: any) => ({ value: t.name, label: t.name })));
      setOrganizations(rawOrgs.map((o: any) => ({ value: o.name, label: o.name })));
      setLoadingData(false);
    })();
  }, []);

  // Recipients are searched on the phone (offline); the other types on the server.
  const loadRecipientPage = useCallback(
    async (query: string, offset: number, limit: number): Promise<OptionItem[]> => {
      if (!typeConfig.recordKey) {
        const rows = await getRecipientsPaginated(limit, offset, query || undefined);
        return rows.map((r: any) => ({
          value: r.name ?? r.id,
          label: r.full_name ?? r.recipient_name ?? r.name ?? r.id,
          sub: [r.id_no, r.branch].filter(Boolean).join(' · ') || undefined,
        }));
      }
      const rows = await fetchRecords(typeConfig.recordKey, {
        search: query,
        limit,
        start: offset,
      });
      return rows.map((r) => ({
        value: r.name,
        label: r.full_name || r.name,
        sub: [r.id_no, r.branch].filter(Boolean).join(' · ') || undefined,
      }));
    },
    [typeConfig.recordKey]
  );

  const changeRecipientType = (next: AidRecipientType) => {
    if (next === recipientType) return;
    const apply = () => {
      setRecipientType(next);
      setSelectedRecipients([]);
    };
    if (selectedRecipients.length === 0) return apply();
    Alert.alert('تغيير النوع', 'سيتم إلغاء اختيار المستلمين الحاليين. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'متابعة', style: 'destructive', onPress: apply },
    ]);
  };

  const removeRecipient = (value: string) =>
    setSelectedRecipients((prev) => prev.filter((r) => r.value !== value));

  const handleSave = useCallback(async () => {
    // Inline validation so all deps are in the useCallback array
    const errs: Record<string, boolean> = {
      recipient: selectedRecipients.length === 0,
      natureOfAid: !natureOfAid,
      aidType: !aidType,
      eligibilityStatus: !eligibilityStatus,
      organization: !organization,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    const count = selectedRecipients.length;
    const save = async () => {
      setSaving(true);
      try {
        const stamp = Date.now();
        const records = selectedRecipients.map((r, i) => ({
          name: `LOCAL-${stamp}-${i}`,
          recipient_type: recipientType,
          recipient: r.value,
          recipient_label: r.label,
          nature_of_aid: natureOfAid,
          aid_type: aidType!.value,
          eligibility_status: eligibilityStatus,
          organization_name: organization!.value,
          aid_date: formatDate(aidDate),
          synced: false,
          created_locally: true,
        }));

        // One transaction: all aids are saved, or none.
        await insertLocalAids(records);
        useSyncStore.getState().markCompleted();
        pushInBackground();

        Alert.alert(
          'تم الحفظ',
          count === 1
            ? 'تم حفظ المساعدة، وسيتم رفعها للخادم تلقائياً.'
            : `تم حفظ ${count} مساعدة، وسيتم رفعها للخادم تلقائياً.`,
          [{ text: 'حسناً', onPress: () => router.back() }]
        );
      } catch (e) {
        console.error(e);
        Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ، لم يتم حفظ أي مساعدة.');
      } finally {
        setSaving(false);
      }
    };

    if (count > 1) {
      Alert.alert('تأكيد', `سيتم إنشاء ${count} مساعدة (واحدة لكل ${typeConfig.label}). متابعة؟`, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حفظ', onPress: save },
      ]);
    } else {
      await save();
    }
  }, [
    selectedRecipients,
    recipientType,
    typeConfig.label,
    natureOfAid,
    aidType,
    eligibilityStatus,
    organization,
    aidDate,
    router,
  ]);

  if (loadingData) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#FF6F20" size="large" />
        <Text className="mt-4 text-slate-500">جاري تحميل البيانات...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="mb-5 flex-row items-center justify-between px-4 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface">
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">إضافة مساعدة جديدة</Text>
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
        className="flex-1">
        <ScrollView
          className="px-5"
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled">
          <Stagger>
            {/* 1. Recipient type */}
            <View className="mb-5">
              <FieldLabel label="نوع المستلم" required />
              <View className="flex-row-reverse flex-wrap gap-2">
                {allowedTypes.map((t) => {
                  const active = t.type === recipientType;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => changeRecipientType(t.type)}
                      className={`rounded-full px-5 py-2 ${active ? 'bg-primary' : 'bg-surface'}`}>
                      <Text
                        className={`text-sm ${active ? 'font-bold text-white' : 'text-slate-400'}`}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Recipients (multi-select) */}
            <View className="mb-5">
              <FieldLabel label={typeConfig.plural} required />
              <PickerButton
                value={
                  selectedRecipients.length
                    ? `تم اختيار ${selectedRecipients.length} ${typeConfig.label}`
                    : ''
                }
                placeholder={`اختر ${typeConfig.plural}...`}
                onPress={() => setRecipientPickerOpen(true)}
                error={errors.recipient}
              />
              {selectedRecipients.length > 0 && (
                <View className="mt-3 flex-row-reverse flex-wrap gap-2">
                  {selectedRecipients.slice(0, MAX_CHIPS).map((r) => (
                    <View
                      key={r.value}
                      className="flex-row-reverse items-center rounded-full border border-primary/30 bg-primary/10 py-1 pl-1.5 pr-3">
                      <Text className="ml-1 max-w-[150px] text-xs text-white" numberOfLines={1}>
                        {r.label}
                      </Text>
                      <TouchableOpacity onPress={() => removeRecipient(r.value)} hitSlop={6}>
                        <Ionicons name="close-circle" size={16} color="#FF6F20" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {selectedRecipients.length > MAX_CHIPS && (
                    <TouchableOpacity
                      onPress={() => setRecipientPickerOpen(true)}
                      className="rounded-full bg-surface px-3 py-1">
                      <Text className="text-xs text-slate-300">
                        +{selectedRecipients.length - MAX_CHIPS} آخرين
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {typeConfig.recordKey && (
                <Text className="mt-2 text-right text-[11px] text-slate-500">
                  البحث في {typeConfig.plural} يتطلب اتصالاً بالإنترنت.
                </Text>
              )}
            </View>

            {/* 2. Nature of Aid */}
            <View className="mb-5">
              <FieldLabel label="طبيعة المساعدة" required />
              <RadioGroup
                options={['نقدي', 'عيني']}
                value={natureOfAid}
                onChange={(v) => {
                  setNatureOfAid(v);
                  setErrors((e) => ({ ...e, natureOfAid: false }));
                }}
              />
              {errors.natureOfAid && (
                <Text className="mt-1 text-right text-xs text-red-400">هذا الحقل مطلوب</Text>
              )}
            </View>

            {/* 3. Aid Type */}
            <View className="mb-5">
              <FieldLabel label="نوع المساعدة" required />
              <PickerButton
                value={aidType?.label ?? ''}
                placeholder="اختر نوع المساعدة..."
                onPress={() => setOpenPicker('aidType')}
                error={errors.aidType}
              />
            </View>

            {/* 4. Eligibility Status */}
            <View className="mb-5">
              <FieldLabel label="حالة الأهلية" required />
              <RadioGroup
                options={['مرشح', 'مستفيد']}
                value={eligibilityStatus}
                onChange={(v) => {
                  setEligibilityStatus(v);
                  setErrors((e) => ({ ...e, eligibilityStatus: false }));
                }}
              />
              {errors.eligibilityStatus && (
                <Text className="mt-1 text-right text-xs text-red-400">هذا الحقل مطلوب</Text>
              )}
            </View>

            {/* 5. Organization */}
            <View className="mb-5">
              <FieldLabel label="اسم المنظمة" required />
              <PickerButton
                value={organization?.label ?? ''}
                placeholder="اختر المنظمة..."
                onPress={() => setOpenPicker('organization')}
                error={errors.organization}
              />
            </View>

            {/* 6. Aid Date */}
            <View className="mb-5">
              <FieldLabel label="تاريخ المساعدة" required />
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-surface px-4 py-4">
                <Ionicons name="calendar-outline" size={20} color="#FF6F20" />
                <Text className="text-sm text-white">{formatDate(aidDate)}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={aidDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_: DateTimePickerEvent, selected?: Date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selected) setAidDate(selected);
                  }}
                  maximumDate={new Date()}
                  themeVariant="dark"
                />
              )}
            </View>
          </Stagger>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SearchPicker Modals */}
      <MultiSelectPicker
        key={recipientType}
        title={`اختر ${typeConfig.plural}`}
        visible={recipientPickerOpen}
        selected={selectedRecipients}
        loadPage={loadRecipientPage}
        onConfirm={(items) => {
          setSelectedRecipients(items);
          setErrors((e) => ({ ...e, recipient: false }));
        }}
        onClose={() => setRecipientPickerOpen(false)}
      />
      <SearchPicker
        title="اختر نوع المساعدة"
        visible={openPicker === 'aidType'}
        options={aidTypes}
        onSelect={(item) => {
          setAidType(item);
          setErrors((e) => ({ ...e, aidType: false }));
        }}
        onClose={() => setOpenPicker(null)}
      />
      <SearchPicker
        title="اختر المنظمة"
        visible={openPicker === 'organization'}
        options={organizations}
        onSelect={(item) => {
          setOrganization(item);
          setErrors((e) => ({ ...e, organization: false }));
        }}
        onClose={() => setOpenPicker(null)}
      />
    </SafeAreaView>
  );
}
