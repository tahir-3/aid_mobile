import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';

// Personal info fields (before wife section) - exclude Section Break, Column Break, Tab, attachments
const PERSONAL_FIELDS = [
  { key: 'full_name', label: 'الاسم الكامل', icon: 'person-outline' as const },
  { key: 'id_no', label: 'رقم الهوية', icon: 'card-outline' as const },
  { key: 'number_of_family_members', label: 'عدد أفراد الأسرة', icon: 'people-outline' as const },
  { key: 'gender', label: 'الجنس', icon: 'male-female-outline' as const },
  { key: 'address', label: 'العنوان الحالي', icon: 'location-outline' as const },
  { key: 'branch', label: 'الفرع', icon: 'business-outline' as const },
  { key: 'jawwal_no', label: 'Jawwal No.', icon: 'call-outline' as const },
  { key: 'date_of_birth', label: 'تاريخ الميلاد', icon: 'calendar-outline' as const },
  { key: 'age', label: 'العمر', icon: 'time-outline' as const },
  { key: 'masjed', label: 'المسجد', icon: 'home-outline' as const },
  { key: 'marital_status', label: 'الحالة الاجتماعية', icon: 'heart-outline' as const },
  { key: 'occupation', label: 'المهنة', icon: 'briefcase-outline' as const },
  { key: 'employer', label: 'صاحب العمل', icon: 'business-outline' as const },
  { key: 'ooredoo_no', label: 'Ooredoo No.', icon: 'call-outline' as const },
  { key: 'displaced_resident', label: 'نازح / مقيم', icon: 'navigate-outline' as const },
  { key: 'displaced_area', label: 'منطقة النزوح', icon: 'location-outline' as const },
  { key: 'prev_adderss', label: 'العنوان السابق', icon: 'location-outline' as const },
  { key: 'closest_masjed', label: 'أقرب مسجد', icon: 'home-outline' as const },
  { key: 'bank_type', label: 'نوع الحساب البنكي', icon: 'wallet-outline' as const },
  { key: 'bank_name', label: 'اسم البنك', icon: 'business-outline' as const },
  { key: 'account_number', label: 'رقم الحساب', icon: 'card-outline' as const },
  { key: 'children_requirements', label: 'احتياجات أطفال', icon: 'people-outline' as const },
  { key: 'have_disease', label: 'هل لديك أمراض مزمنة؟', icon: 'medical-outline' as const },
  { key: 'disease_type', label: 'نوع المرض', icon: 'medical-outline' as const },
  { key: 'medical_needs', label: 'احتياجات طبية', icon: 'medical-outline' as const },
  { key: 'ministry_of_public_work_approval', label: 'اعتماد الأشغال العامة', icon: 'checkmark-circle-outline' as const },
  { key: 'development_approval', label: 'اعتماد التطوير', icon: 'checkmark-circle-outline' as const },
  { key: 'west_gaza_approval', label: 'اعتماد غزة الغربية', icon: 'checkmark-circle-outline' as const },
  { key: 'nature_of_approval', label: 'طبيعة الاعتماد', icon: 'document-text-outline' as const },
  { key: 'accommodation_name', label: 'اسم السكن', icon: 'home-outline' as const },
  { key: 'type_of_damage', label: 'نوع الضرر', icon: 'alert-circle-outline' as const },
  { key: 'other_needs', label: 'احتياجات أخرى', icon: 'ellipsis-horizontal-outline' as const },
];

const WIFE_FIELDS = [
  { key: 'wife_full_name', label: 'اسم الزوجة', icon: 'person-outline' as const },
  { key: 'wife_id_no', label: 'رقم هوية الزوجة', icon: 'card-outline' as const },
  { key: 'wife_date_of_birth', label: 'تاريخ ميلاد الزوجة', icon: 'calendar-outline' as const },
  { key: 'wife_age', label: 'عمر الزوجة', icon: 'time-outline' as const },
  { key: 'wife_health_status', label: 'الحالة الصحية للزوجة', icon: 'medical-outline' as const },
  { key: 'wife_medical_needs', label: 'احتياجات طبية للزوجة', icon: 'medical-outline' as const },
  { key: 'pregnant', label: 'مرضعة/حامل', icon: 'heart-outline' as const },
];

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number | null | undefined;
  icon: string;
}) {
  if (value == null || value === '') return null;
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Text className="flex-1 text-right font-bold text-white" numberOfLines={2}>
        {String(value)}
      </Text>
      <View className="mr-4 flex-row items-center">
        <Text className="ml-2 text-sm text-slate-500">{label}</Text>
        <Ionicons name={icon as any} size={18} color="#94A3B8" />
      </View>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <View className="mb-4 flex-row items-center justify-end pr-1">
        <Text className="mr-2 text-lg font-bold text-white">{title}</Text>
        <Ionicons name={icon as any} size={20} color="#2563EB" />
      </View>
      <View className="rounded-3xl border border-white/5 bg-surface p-5">{children}</View>
    </View>
  );
}

export default function RecipientDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipient, setRecipient] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  const loadRecipient = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getSyncedData(STORAGE_KEYS.RECIPIENTS);
    const list = Array.isArray(data) ? data : [];
    const found = list.find((r: any) => r.name === id || r.id === id) ?? null;
    setRecipient(found);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadRecipient();
  }, [loadRecipient]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6F20" size="large" />
          <Text className="mt-4 text-slate-500">جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipient) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="mt-8 flex-row items-center justify-between px-4 py-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">بيانات المستفيد</Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="person-outline" size={64} color="#475569" />
          <Text className="mt-4 text-center text-slate-500">لم يتم العثور على المستفيد</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = recipient.full_name ?? recipient.recipient_name ?? recipient.name;
  const familyMembers = Array.isArray(recipient.family_members) ? recipient.family_members : [];
  const sysKeys = ['name', 'owner', 'creation', 'modified', 'parent', 'parenttype', 'parentfield', 'docstatus', 'idx'];
  const childCols = familyMembers[0]
    ? Object.keys(familyMembers[0]).filter((k) => !sysKeys.includes(k))
    : [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="mt-8 flex-row items-center justify-between px-4 py-4">
        <View className="w-10" />
        <Text className="text-xl font-bold text-white">بيانات المستفيد</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <View className="mb-6 items-center">
          <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-surface">
            <Ionicons name="person" size={48} color="#94A3B8" />
          </View>
          <Text className="mt-3 text-xl font-bold text-white">{displayName ?? '—'}</Text>
          {recipient.name && (
            <Text className="mt-1 text-xs text-slate-500">{recipient.name}</Text>
          )}
        </View>

        {/* Personal Info Section */}
        <SectionCard title="المعلومات الشخصية" icon="person-outline">
          {PERSONAL_FIELDS.map((f) => (
            <DetailRow
              key={f.key}
              label={f.label}
              value={recipient[f.key]}
              icon={f.icon}
            />
          ))}
        </SectionCard>

        {/* Wife Info Section */}
        {WIFE_FIELDS.some((f) => recipient[f.key] != null && recipient[f.key] !== '') && (
          <SectionCard title="معلومات الزوجة" icon="people-circle-outline">
            {WIFE_FIELDS.map((f) => (
              <DetailRow
                key={f.key}
                label={f.label}
                value={recipient[f.key]}
                icon={f.icon}
              />
            ))}
          </SectionCard>
        )}

        {/* Children Section */}
        {familyMembers.length > 0 && (
          <View className="mb-6">
            <View className="mb-4 flex-row items-center justify-end pr-1">
              <Text className="mr-2 text-lg font-bold text-white">الأطفال / أفراد العائلة</Text>
              <Ionicons name="people-outline" size={20} color="#2563EB" />
            </View>
            <View className="overflow-hidden rounded-3xl border border-white/5 bg-surface">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: Math.max(width - 32, childCols.length * 110) }}>
                  {/* Header row */}
                  <View className="flex-row border-b border-white/10 bg-slate-800/30 px-4 py-3">
                    {childCols.map((col) => (
                      <View key={col} className="min-w-[100px] flex-1">
                        <Text className="text-[10px] font-bold text-slate-400">{col}</Text>
                      </View>
                    ))}
                  </View>
                  {familyMembers.map((row: Record<string, any>, idx: number) => (
                    <View
                      key={idx}
                      className="flex-row border-b border-white/5 px-4 py-3">
                      {childCols.map((col) => (
                        <View key={col} className="min-w-[100px] flex-1">
                          <Text className="text-right text-sm text-white" numberOfLines={2}>
                            {row[col] ?? '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
