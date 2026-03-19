import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
  OptionsPicker,
  PickerButton,
  RadioGroup,
  SearchPicker,
} from '../components/FormComponents';
import { upsertRecipient } from '../lib/db';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';

// Date formatting helper
const formatDate = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '';

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NewRecipientScreen() {
  const router = useRouter();

  // ── Data from storage ──
  const [branches, setBranches] = useState<OptionItem[]>([]); // branches / masaajid / accommodation names
  const [masaajid, setMasaajid] = useState<OptionItem[]>([]); // branches / masaajid / accommodation names
  const [accommodations, setAccommodations] = useState<OptionItem[]>([]); // branches / masaajid / accommodation names
  const [existingRecipients, setExistingRecipients] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Form state ──
  const [fullName, setFullName] = useState('');
  const [idNo, setIdNo] = useState('');
  const [branch, setBranch] = useState<OptionItem | null>(null);
  const [masjed, setMasjed] = useState<OptionItem | null>(null);
  const [familyMembers, setFamilyMembers] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [gender, setGender] = useState('');
  const [natureOfApproval, setNatureOfApproval] = useState('');
  const [accommodationName, setAccommodationName] = useState<OptionItem | null>(null);
  const [wifeFullName, setWifeFullName] = useState('');
  const [wifeIdNo, setWifeIdNo] = useState('');
  const [wifeDateOfBirth, setWifeDateOfBirth] = useState<Date | null>(null);
  const [jawwalNo, setJawwalNo] = useState('');
  const [address, setAddress] = useState('');
  const [showMaritalPicker, setShowMaritalPicker] = useState(false);
  // ── UI state ──
  const [openPicker, setOpenPicker] = useState<'branch' | 'masjed' | 'accommodation' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // ── Load options and existing recipients ──
  useEffect(() => {
    (async () => {
      try {
        const [rawRecipients, rawBranches, rawMasaajid, rawAccommodations] = await Promise.all([
          getSyncedData(STORAGE_KEYS.RECIPIENTS), // adjust key if needed
          getSyncedData(STORAGE_KEYS.AID_RECIPIENT_BRANCH),
          getSyncedData(STORAGE_KEYS.AID_RECIPIENT_MASJED),
          getSyncedData(STORAGE_KEYS.ACCOMMODATION),
        ]);

        // Transform locations to OptionItem[]
        setBranches(
          rawBranches.map((loc: any) => ({
            value: loc.name || loc.id,
            label: loc.name || loc.title,
            sub: loc.code || loc.address,
          }))
        );

        setMasaajid(
          rawMasaajid.map((loc: any) => ({
            value: loc.name || loc.id,
            label: loc.name || loc.title,
            sub: loc.code || loc.address,
          }))
        );

        setAccommodations(
          rawAccommodations.map((loc: any) => ({
            value: loc.name || loc.id,
            label: loc.name || loc.title,
            sub: loc.code || loc.address,
          }))
        );

        setExistingRecipients(rawRecipients);
      } catch (error) {
        console.error('Failed to load data:', error);
        Alert.alert('خطأ', 'فشل تحميل البيانات');
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  // ── ID uniqueness check ──
  const isIdUnique = useCallback(
    (id: string) => {
      return !existingRecipients.some((r) => r.id_no === id);
    },
    [existingRecipients]
  );

  // ── Validation and save ──
  const handleSave = useCallback(async () => {
    const errs: Record<string, boolean> = {
      fullName: !fullName.trim(),
      idNo: !idNo.trim() || idNo.length !== 9 || !isIdUnique(idNo),
      branch: !branch,
      masjed: !masjed,
      familyMembers:
        !familyMembers.trim() || isNaN(Number(familyMembers)) || Number(familyMembers) <= 0,
      maritalStatus: !maritalStatus,
      gender: !gender,
      natureOfApproval: !natureOfApproval,
      accommodationName: !accommodationName,
      jawwalNo: !jawwalNo.trim() || jawwalNo.length < 9,
      address: !address.trim(),
    };

    // Wife fields are optional, no validation unless you want to enforce length if provided
    if (wifeIdNo && wifeIdNo.length !== 9) errs.wifeIdNo = true;

    setErrors(errs);

    if (Object.values(errs).some(Boolean)) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح');
      return;
    }

    setSaving(true);
    try {
      const newRecipient = {
        id: `REC-${Date.now()}`,
        full_name: fullName.trim(),
        id_no: idNo.trim(),
        branch: branch!.value,
        branch_label: branch!.label,
        masjed: masjed!.value,
        masjed_label: masjed!.label,
        number_of_family_members: parseInt(familyMembers, 10),
        marital_status: maritalStatus,
        gender,
        nature_of_approval: natureOfApproval,
        accommodation_name: accommodationName!.value,
        accommodation_label: accommodationName!.label,
        wife_full_name: wifeFullName.trim() || undefined,
        wife_id_no: wifeIdNo.trim() || undefined,
        wife_date_of_birth: wifeDateOfBirth ? formatDate(wifeDateOfBirth) : undefined,
        jawwal_no: jawwalNo.trim(),
        address: address.trim(),
        synced: false,
        created_locally: true,
        created_at: new Date().toISOString(),
      };

      await upsertRecipient(newRecipient);

      Alert.alert('تم الحفظ', 'تم إضافة المستفيد بنجاح', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }, [
    fullName,
    idNo,
    branch,
    masjed,
    familyMembers,
    maritalStatus,
    gender,
    natureOfApproval,
    accommodationName,
    wifeFullName,
    wifeIdNo,
    wifeDateOfBirth,
    jawwalNo,
    address,
    isIdUnique,
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
        <Text className="text-xl font-bold text-white">إضافة مستفيد جديد</Text>
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
          {/* 1. Full name */}
          <View className="mb-5">
            <FieldLabel label="الاسم الكامل" required />
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="أدخل الاسم الكامل"
              placeholderTextColor="#64748B"
              className={`rounded-2xl border px-4 py-4 text-right text-white ${
                errors.fullName ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
              }`}
            />
          </View>

          {/* 2. ID number (9 digits) */}
          <View className="mb-5">
            <FieldLabel label="رقم الهوية" required />
            <TextInput
              value={idNo}
              onChangeText={(text) => setIdNo(text.replace(/[^0-9]/g, '').slice(0, 9))}
              placeholder="أدخل 9 أرقام"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              maxLength={9}
              className={`rounded-2xl border px-4 py-4 text-right text-white ${
                errors.idNo ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
              }`}
            />
            {errors.idNo && (
              <Text className="mt-1 text-right text-xs text-red-400">
                {!idNo ? 'هذا الحقل مطلوب' : idNo.length !== 9 ? 'يجب أن يتكون من 9 أرقام' : ''}
              </Text>
            )}
          </View>
          {/* 2.5 Jawwal Number */}
          <View className="mb-5">
            <FieldLabel label="رقم الجوال (جوال)" required />
            <TextInput
              value={jawwalNo}
              onChangeText={(text) => setJawwalNo(text.replace(/[^0-9]/g, ''))}
              placeholder="مثال: 059XXXXXXX"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              className={`rounded-2xl border px-4 py-4 text-right text-white ${
                errors.jawwalNo ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
              }`}
            />
            {errors.jawwalNo && (
              <Text className="mt-1 text-right text-xs text-red-400">
                يرجى إدخال رقم جوال صحيح
              </Text>
            )}
          </View>

          {/* 3. Branch */}
          <View className="mb-5">
            <FieldLabel label="الفرع" required />
            <PickerButton
              value={branch?.label ?? ''}
              placeholder="اختر الفرع..."
              onPress={() => setOpenPicker('branch')}
              error={errors.branch}
            />
          </View>

          {/* 4. Masjed */}
          <View className="mb-5">
            <FieldLabel label="المسجد" required />
            <PickerButton
              value={masjed?.label ?? ''}
              placeholder="اختر المسجد..."
              onPress={() => setOpenPicker('masjed')}
              error={errors.masjed}
            />
          </View>

          {/* 5. Number of family members */}
          <View className="mb-5">
            <FieldLabel label="عدد أفراد الأسرة" required />
            <TextInput
              value={familyMembers}
              onChangeText={(text) => setFamilyMembers(text.replace(/[^0-9]/g, ''))}
              placeholder="مثال: 5"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              className={`rounded-2xl border px-4 py-4 text-right text-white ${
                errors.familyMembers
                  ? 'border-red-500/60 bg-red-900/10'
                  : 'border-white/10 bg-surface'
              }`}
            />
          </View>
          {/* 6. Marital Status - Dropdown */}
          <View className="mb-5">
            <FieldLabel label="الحالة الاجتماعية" required />
            <PickerButton
              value={maritalStatus}
              placeholder="اختر الحالة الاجتماعية..."
              onPress={() => setShowMaritalPicker(true)}
              error={errors.maritalStatus}
            />
            {errors.maritalStatus && (
              <Text className="mt-1 text-right text-xs text-red-400">هذا الحقل مطلوب</Text>
            )}
          </View>
          <OptionsPicker
            title="اختر الحالة الاجتماعية"
            visible={showMaritalPicker}
            options={['متزوج/ة', 'أعزب/عزباء', 'أرمل/ة', 'مطلق/ة', 'مهجور/ة', 'متعدد الزوجات']}
            onSelect={(value) => {
              setMaritalStatus(value);
              setErrors((e) => ({ ...e, maritalStatus: false }));
            }}
            onClose={() => setShowMaritalPicker(false)}
          />
          {/* 7. Gender */}
          <View className="mb-5">
            <FieldLabel label="الجنس" required />
            <RadioGroup
              options={['ذكر', 'أنثى']}
              value={gender}
              wrap
              onChange={(v) => {
                setGender(v);
                setErrors((e) => ({ ...e, gender: false }));
              }}
            />
            {errors.gender && (
              <Text className="mt-1 text-right text-xs text-red-400">هذا الحقل مطلوب</Text>
            )}
          </View>

          {/* 8. Nature of Approval */}
          <View className="mb-5">
            <FieldLabel label="طبيعة الموافقة" required />
            <RadioGroup
              options={['إيواء داخلي', 'إيواء خارجي']}
              value={natureOfApproval}
              wrap
              onChange={(v) => {
                setNatureOfApproval(v);
                setErrors((e) => ({ ...e, natureOfApproval: false }));
              }}
            />
            {errors.natureOfApproval && (
              <Text className="mt-1 text-right text-xs text-red-400">هذا الحقل مطلوب</Text>
            )}
          </View>

          {/* 9. Accommodation Name */}
          <View className="mb-5">
            <FieldLabel label="اسم مركز الإيواء" required />
            <PickerButton
              value={accommodationName?.label ?? ''}
              placeholder="اختر اسم مركز الإيواء..."
              onPress={() => setOpenPicker('accommodation')}
              error={errors.accommodationName}
            />
          </View>

          {/* 10. Wife's full name (optional) */}
          <View className="mb-5">
            <FieldLabel label="اسم الزوجة" required />
            <TextInput
              value={wifeFullName}
              onChangeText={setWifeFullName}
              placeholder="أدخل اسم الزوجة"
              placeholderTextColor="#64748B"
              className="rounded-2xl border border-white/10 bg-surface px-4 py-4 text-right text-white"
            />
          </View>

          {/* 11. Wife's ID number (optional, 9 digits) */}
          <View className="mb-5">
            <FieldLabel label="رقم هوية الزوجة" required />
            <TextInput
              value={wifeIdNo}
              onChangeText={(text) => setWifeIdNo(text.replace(/[^0-9]/g, '').slice(0, 9))}
              placeholder="أدخل 9 أرقام"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              maxLength={9}
              className={`rounded-2xl border px-4 py-4 text-right text-white ${
                errors.wifeIdNo ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
              }`}
            />
            {errors.wifeIdNo && (
              <Text className="mt-1 text-right text-xs text-red-400">يجب أن يتكون من 9 أرقام</Text>
            )}
          </View>

          {/* 12. Wife's date of birth (optional) */}
          <View className="mb-5">
            <FieldLabel label="تاريخ ميلاد الزوجة (اختياري)" />
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-surface px-4 py-4">
              <Ionicons name="calendar-outline" size={20} color="#FF6F20" />
              <Text className="text-sm text-white">
                {wifeDateOfBirth ? formatDate(wifeDateOfBirth) : 'اختر تاريخ الميلاد'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={wifeDateOfBirth || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_: DateTimePickerEvent, selected?: Date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selected) setWifeDateOfBirth(selected);
                }}
                maximumDate={new Date()}
                themeVariant="dark"
              />
            )}
          </View>

          {/* 13. Address (3 lines) */}
          <View className="mb-5">
            <FieldLabel label="العنوان" required />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="أدخل العنوان بالتفصيل"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`rounded-2xl border px-4 py-4 text-right text-white ${
                errors.address ? 'border-red-500/60 bg-red-900/10' : 'border-white/10 bg-surface'
              }`}
              style={{ minHeight: 80 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <SearchPicker
        title="اختر الشعبة"
        visible={openPicker === 'branch'}
        options={branches}
        onSelect={(item) => {
          setBranch(item);
          setErrors((e) => ({ ...e, branch: false }));
        }}
        onClose={() => setOpenPicker(null)}
      />
      <SearchPicker
        title="اختر المسجد"
        visible={openPicker === 'masjed'}
        options={masaajid}
        onSelect={(item) => {
          setMasjed(item);
          setErrors((e) => ({ ...e, masjed: false }));
        }}
        onClose={() => setOpenPicker(null)}
      />
      <SearchPicker
        title="اختر اسم السكن"
        visible={openPicker === 'accommodation'}
        options={accommodations}
        onSelect={(item) => {
          setAccommodationName(item);
          setErrors((e) => ({ ...e, accommodationName: false }));
        }}
        onClose={() => setOpenPicker(null)}
      />
    </SafeAreaView>
  );
}
