import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailSection, FieldsSection, type FieldSpec } from '../components/DetailSection';
import { FadeInView } from '../components/motion/FadeInView';
import { RecordIcon } from '../components/RecordIcon';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Same blue as the recipients list and dashboard card. */
const RECIPIENT_COLOR = '#3B82F6';

// Recipient fields grouped by topic (keys from aids.api.get_recipients).
const SECTIONS: { title: string; icon: IconName; fields: FieldSpec[] }[] = [
  {
    title: 'البيانات الشخصية',
    icon: 'person-outline',
    fields: [
      { key: 'full_name', label: 'الاسم الكامل' },
      { key: 'id_no', label: 'رقم الهوية' },
      { key: 'gender', label: 'الجنس' },
      { key: 'date_of_birth', label: 'تاريخ الميلاد' },
      { key: 'age', label: 'العمر' },
      { key: 'marital_status', label: 'الحالة الاجتماعية' },
      { key: 'number_of_family_members', label: 'عدد أفراد الأسرة' },
      { key: 'family_members', label: 'عدد الأطفال', icon: 'happy-outline' },
      { key: 'occupation', label: 'المهنة' },
      { key: 'employer', label: 'صاحب العمل' },
    ],
  },
  {
    title: 'التواصل',
    icon: 'call-outline',
    fields: [
      { key: 'jawwal_no', label: 'رقم جوال' },
      { key: 'ooredoo_no', label: 'رقم أوريدو' },
    ],
  },
  {
    title: 'السكن والنزوح',
    icon: 'home-outline',
    fields: [
      { key: 'branch', label: 'الفرع' },
      { key: 'address', label: 'العنوان الحالي' },
      { key: 'masjed', label: 'المسجد' },
      { key: 'closest_masjed', label: 'أقرب مسجد' },
      { key: 'displaced_resident', label: 'نازح / مقيم' },
      { key: 'displaced_area', label: 'منطقة النزوح' },
      { key: 'prev_adderss', label: 'العنوان السابق' },
      { key: 'nature_of_approval', label: 'طبيعة الإيواء' },
      { key: 'accommodation_name', label: 'اسم الإيواء' },
      { key: 'type_of_damage', label: 'نوع الضرر', icon: 'alert-circle-outline' },
    ],
  },
  {
    title: 'الصحة والاحتياجات',
    icon: 'medkit-outline',
    fields: [
      { key: 'have_disease', label: 'أمراض مزمنة؟' },
      { key: 'disease_type', label: 'نوع المرض' },
      { key: 'medical_needs', label: 'احتياجات طبية' },
      { key: 'children_requirements', label: 'احتياجات أطفال', icon: 'happy-outline' },
      { key: 'other_needs', label: 'احتياجات أخرى' },
    ],
  },
  {
    title: 'الاعتمادات',
    icon: 'checkmark-circle-outline',
    fields: [
      { key: 'ministry_of_public_work_approval', label: 'اعتماد الأشغال العامة' },
      { key: 'development_approval', label: 'اعتماد التطوير' },
      { key: 'west_gaza_approval', label: 'اعتماد غزة الغربية' },
    ],
  },
  {
    title: 'معلومات الزوجة',
    icon: 'people-circle-outline',
    fields: [
      { key: 'wife_full_name', label: 'اسم الزوجة' },
      { key: 'wife_id_no', label: 'رقم الهوية' },
      { key: 'wife_date_of_birth', label: 'تاريخ الميلاد' },
      { key: 'wife_age', label: 'العمر', icon: 'time-outline' },
      { key: 'wife_health_status', label: 'الحالة الصحية', icon: 'medical-outline' },
      { key: 'wife_medical_needs', label: 'احتياجات طبية', icon: 'medical-outline' },
      { key: 'pregnant', label: 'مرضعة / حامل', icon: 'heart-outline' },
    ],
  },
  {
    title: 'البيانات البنكية',
    icon: 'wallet-outline',
    fields: [
      { key: 'bank_type', label: 'نوع الحساب' },
      { key: 'bank_name', label: 'اسم البنك' },
      { key: 'account_number', label: 'رقم الحساب' },
    ],
  },
];

// Backend Select values (AID Recipient Family Member.relationship) -> Arabic.
const RELATIONSHIP_AR: Record<string, string> = {
  Son: 'ابن',
  Daughter: 'ابنة',
  Father: 'أب',
  Mother: 'أم',
};

/** Arrays (family_members) show their count instead of "[object Object]". */
const formatValue = (_key: string, v: unknown) =>
  Array.isArray(v) ? (v.length > 0 ? v.length : null) : v;

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View className="mt-2 flex-row items-center justify-between px-4 py-4">
      <View className="w-10" />
      <Text className="text-xl font-bold text-white">بيانات المستفيد</Text>
      <TouchableOpacity onPress={onBack} className="w-10 items-end">
        <Ionicons name="arrow-forward" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

/** One child: name with relationship / age chips, then ID and birth date. */
function ChildCard({ child, last }: { child: Record<string, any>; last: boolean }) {
  const name = child.child_full_name ?? child.full_name;
  const relation = child.child_relationship
    ? (RELATIONSHIP_AR[child.child_relationship] ?? child.child_relationship)
    : null;
  const age = child.child_age;
  return (
    <View className={`py-3 ${last ? '' : 'border-b border-white/5'}`}>
      <View className="flex-row-reverse items-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/5">
          <Ionicons name="happy-outline" size={18} color="#94A3B8" />
        </View>
        <Text className="mr-3 flex-1 text-right text-sm font-bold text-white" numberOfLines={1}>
          {name || '—'}
        </Text>
        {relation ? (
          <View className="mr-2 rounded-lg bg-blue-500/10 px-2 py-0.5">
            <Text className="text-[11px] font-bold text-blue-400">{relation}</Text>
          </View>
        ) : null}
        {age != null && age !== '' ? (
          <View className="mr-1.5 rounded-lg bg-white/5 px-2 py-0.5">
            <Text className="text-[11px] text-slate-300">{age} سنة</Text>
          </View>
        ) : null}
      </View>
      <View className="mr-12 mt-1.5 flex-row-reverse flex-wrap items-center">
        {child.child_id_no ? (
          <View className="ml-4 flex-row-reverse items-center">
            <Ionicons name="card-outline" size={12} color="#64748B" />
            <Text className="mr-1 text-xs text-slate-400" selectable>
              {child.child_id_no}
            </Text>
          </View>
        ) : null}
        {child.child_date_of_birth ? (
          <View className="flex-row-reverse items-center">
            <Ionicons name="calendar-outline" size={12} color="#64748B" />
            <Text className="mr-1 text-xs text-slate-400">{child.child_date_of_birth}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function RecipientDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipient, setRecipient] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

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
        <Header onBack={router.back} />
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
        <Header onBack={router.back} />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="person-outline" size={64} color="#475569" />
          <Text className="mt-4 text-center text-slate-500">لم يتم العثور على المستفيد</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = recipient.full_name ?? recipient.recipient_name ?? recipient.name;
  const familyMembers: Record<string, any>[] = Array.isArray(recipient.family_members)
    ? recipient.family_members
    : [];

  // Quick facts under the name.
  const chips: { icon: IconName; text: string }[] = [];
  if (recipient.number_of_family_members)
    chips.push({ icon: 'people-outline', text: `${recipient.number_of_family_members} أفراد` });
  if (recipient.displaced_resident)
    chips.push({ icon: 'navigate-outline', text: String(recipient.displaced_resident) });
  if (recipient.branch) chips.push({ icon: 'business-outline', text: String(recipient.branch) });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header onBack={router.back} />

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <FadeInView className="mb-6 items-center">
          <View
            className="h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: `${RECIPIENT_COLOR}1A` }}>
            <RecordIcon type="recipients" size={36} color={RECIPIENT_COLOR} />
          </View>
          <Text className="mt-3 text-center text-xl font-bold text-white">
            {displayName ?? '—'}
          </Text>
          <Text className="mt-1 text-xs text-slate-500" selectable>
            {recipient.id_no ?? recipient.name}
          </Text>
          {chips.length > 0 && (
            <View className="mt-3 flex-row-reverse flex-wrap justify-center gap-2">
              {chips.map((c) => (
                <View
                  key={c.text}
                  className="flex-row-reverse items-center rounded-full border border-white/5 bg-surface px-3 py-1">
                  <Ionicons name={c.icon} size={12} color="#94A3B8" />
                  <Text className="mr-1.5 text-xs text-slate-300" numberOfLines={1}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </FadeInView>

        {SECTIONS.map((s, i) => (
          <FieldsSection
            key={s.title}
            title={s.title}
            icon={s.icon}
            color={RECIPIENT_COLOR}
            delay={60 * (i + 1)}
            fields={s.fields}
            data={recipient}
            format={formatValue}
          />
        ))}

        {familyMembers.length > 0 && (
          <DetailSection
            title={`الأطفال / أفراد العائلة (${familyMembers.length})`}
            icon="people-outline"
            color={RECIPIENT_COLOR}
            delay={60 * (SECTIONS.length + 1)}>
            {familyMembers.map((c, idx) => (
              <ChildCard key={c.id ?? idx} child={c} last={idx === familyMembers.length - 1} />
            ))}
          </DetailSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
