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
import { upsertAid } from '../lib/db';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';

// ─── Utilities ───────────────────────────────────────────────────────────────
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NewAidScreen() {
  const router = useRouter();

  // ── Data lists from storage ──
  const [recipients, setRecipients] = useState<OptionItem[]>([]);
  const [aidTypes, setAidTypes] = useState<OptionItem[]>([]);
  const [organizations, setOrganizations] = useState<OptionItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Form state ──
  const [recipient, setRecipient] = useState<OptionItem | null>(null);
  const [natureOfAid, setNatureOfAid] = useState('');
  const [aidType, setAidType] = useState<OptionItem | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState('');
  const [organization, setOrganization] = useState<OptionItem | null>(null);
  const [aidDate, setAidDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Pickers visibility ──
  const [openPicker, setOpenPicker] = useState<'recipient' | 'aidType' | 'organization' | null>(
    null
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // ── Load options from storage ──
  useEffect(() => {
    (async () => {
      const [rawRecipients, rawAidTypes, rawOrgs] = await Promise.all([
        getSyncedData(STORAGE_KEYS.RECIPIENTS),
        getSyncedData(STORAGE_KEYS.AID_TYPE),
        getSyncedData(STORAGE_KEYS.AID_ORGANIZATION),
      ]);

      setRecipients(
        rawRecipients.map((r: any) => ({
          value: r.name ?? r.id,
          label: r.full_name ?? r.recipient_name ?? r.name ?? r.id,
          sub: r.jawwal_no ?? r.id_no ?? r.national_id ?? undefined,
        }))
      );
      setAidTypes(rawAidTypes.map((t: any) => ({ value: t.name, label: t.name })));
      setOrganizations(rawOrgs.map((o: any) => ({ value: o.name, label: o.name })));
      setLoadingData(false);
    })();
  }, []);

  const handleSave = useCallback(async () => {
    // Inline validation so all deps are in the useCallback array
    const errs: Record<string, boolean> = {
      recipient: !recipient,
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

    setSaving(true);
    try {
      const newRecord = {
        name: `LOCAL-${Date.now()}`,
        recipient: recipient!.value,
        recipient_label: recipient!.label,
        nature_of_aid: natureOfAid,
        aid_type: aidType!.value,
        eligibility_status: eligibilityStatus,
        organization_name: organization!.value,
        aid_date: formatDate(aidDate),
        synced: false,
        created_locally: true,
      };

      await upsertAid(newRecord);

      Alert.alert('تم الحفظ', 'تم حفظ المساعدة محلياً، سيتم مزامنتها لاحقاً', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }, [recipient, natureOfAid, aidType, eligibilityStatus, organization, aidDate, router]);

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
          {/* 1. Recipient */}
          <View className="mb-5">
            <FieldLabel label="المستفيد" required />
            <PickerButton
              value={recipient?.label ?? ''}
              placeholder="اختر المستفيد..."
              onPress={() => setOpenPicker('recipient')}
              error={errors.recipient}
            />
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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SearchPicker Modals */}
      <SearchPicker
        title="اختر المستفيد"
        visible={openPicker === 'recipient'}
        options={recipients}
        onSelect={(item) => {
          setRecipient(item);
          setErrors((e) => ({ ...e, recipient: false }));
        }}
        onClose={() => setOpenPicker(null)}
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
