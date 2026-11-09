import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSyncedData, STORAGE_KEYS } from '../lib/sync';
import { DetailRow, DetailSection } from '../components/DetailSection';

// AID fields from sync.ts
const AID_FIELDS = [
  { key: 'recipient', label: 'المستلم', icon: 'person-outline' as const },
  { key: 'branch', label: 'الفرع', icon: 'business-outline' as const },
  { key: 'aid_type', label: 'نوع المساعدة', icon: 'layers-outline' as const },
  { key: 'organization_name', label: 'المنظمة', icon: 'business-outline' as const },
  { key: 'aid_date', label: 'تاريخ المساعدة', icon: 'calendar-outline' as const },
  { key: 'eligibility_status', label: 'حالة الاستحقاق', icon: 'checkmark-circle-outline' as const },
  { key: 'nature_of_aid', label: 'طبيعة المساعدة', icon: 'gift-outline' as const },
];

export default function AidDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [aid, setAid] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAid = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getSyncedData(STORAGE_KEYS.AID);
    const list = Array.isArray(data) ? data : [];
    const found = list.find((a: any) => a.name === id || a.id === id) ?? null;
    setAid(found);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAid();
  }, [loadAid]);

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

  if (!aid) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="mt-8 flex-row items-center justify-between px-4 py-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">تفاصيل المساعدة</Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="document-outline" size={64} color="#475569" />
          <Text className="mt-4 text-center text-slate-500">لم يتم العثور على المساعدة</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'مستفيد':
        return 'bg-success text-white';
      case 'مرشح':
        return 'bg-warning text-white';
      default:
        return 'bg-slate-700/30 text-slate-400';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="mt-8 flex-row items-center justify-between px-4 py-4">
        <View className="w-10" />
        <Text className="text-xl font-bold text-white">تفاصيل المساعدة</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View className="mb-6 px-4">
          <View className="items-center rounded-3xl border border-white/5 bg-surface p-6">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
              <Ionicons name="gift-outline" size={32} color="#FF6F20" />
            </View>
            <Text className="mt-3 text-lg font-bold text-white">{aid.name}</Text>
            {aid.recipient && <Text className="mt-1 text-sm text-slate-400">{aid.recipient}</Text>}
          </View>
        </View>

        {/* Aid fields */}
        <View className="px-4">
          <DetailSection title="معلومات المساعدة" icon="information-circle-outline" color="#FF6F20">
            {AID_FIELDS.map((f, idx) => {
              const value = aid[f.key];
              const last = idx === AID_FIELDS.length - 1;
              if (f.key === 'eligibility_status' && value) {
                return (
                  <DetailRow key={f.key} label={f.label} icon={f.icon} value={value} last={last}>
                    <View className={`rounded-lg px-3 py-1 ${getStatusStyle(value)}`}>
                      <Text className="text-xs font-bold">{value}</Text>
                    </View>
                  </DetailRow>
                );
              }
              return (
                <DetailRow
                  key={f.key}
                  label={f.label}
                  icon={f.icon}
                  value={value ?? '—'}
                  last={last}
                />
              );
            })}
          </DetailSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
