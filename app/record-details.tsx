import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldsSection } from '../components/DetailSection';
import { FadeInView } from '../components/motion/FadeInView';
import { RecordIcon } from '../components/RecordIcon';
import { describeApiError, type ApiErrorInfo } from '../lib/apiError';
import {
  fetchRecord,
  getCachedRecord,
  isRecordTypeKey,
  RECORD_TYPES,
  setCachedRecord,
} from '../lib/records';

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="mt-2 flex-row items-center justify-between px-4 py-4">
      <View className="w-10" />
      <Text className="text-xl font-bold text-white">{title}</Text>
      <TouchableOpacity onPress={onBack} className="w-10 items-end">
        <Ionicons name="arrow-forward" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

export default function RecordDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const type = isRecordTypeKey(params.type) ? params.type : null;
  const config = type ? RECORD_TYPES[type] : null;

  const [doc, setDoc] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  /** Set while showing a cached copy because the live request failed. */
  const [staleSince, setStaleSince] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!type || !params.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const cached = await getCachedRecord(type, params.id);
    if (cached) {
      setDoc(cached.data);
      setLoading(false);
    }
    try {
      const fresh = await fetchRecord(type, params.id);
      setDoc(fresh);
      setStaleSince(null);
      setCachedRecord(type, params.id, fresh);
    } catch (e: any) {
      const info = describeApiError(e);
      console.warn(
        'Failed to load record:',
        info.status ?? 'no response',
        info.detail ?? e?.message
      );
      setError(info);
      setStaleSince(cached?.savedAt ?? null);
    } finally {
      setLoading(false);
    }
  }, [type, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const title = config ? `بيانات ${config.singular}` : 'التفاصيل';

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title={title} onBack={router.back} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6F20" size="large" />
          <Text className="mt-4 text-slate-500">جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!config || !doc) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title={title} onBack={router.back} />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name={
              error?.kind === 'network'
                ? 'cloud-offline-outline'
                : error?.kind === 'permission'
                  ? 'lock-closed-outline'
                  : 'document-outline'
            }
            size={64}
            color="#475569"
          />
          <Text className="mt-4 text-center text-slate-400">
            {error ? error.message : 'لم يتم العثور على السجل'}
          </Text>
          {error?.detail ? (
            <Text className="mt-2 text-center text-xs text-slate-600" numberOfLines={4} selectable>
              {error.detail}
            </Text>
          ) : null}
          {error && error.kind !== 'permission' && (
            <TouchableOpacity onPress={load} className="mt-4 rounded-full bg-primary px-6 py-2">
              <Text className="font-bold text-white">إعادة المحاولة</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title={title} onBack={router.back} />

      {staleSince && error && (
        <TouchableOpacity
          onPress={load}
          className="mx-4 mb-3 flex-row-reverse items-center rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
          <Ionicons name="time-outline" size={16} color="#FB923C" style={{ marginLeft: 6 }} />
          <Text className="flex-1 text-right text-xs text-orange-400">
            نسخة محفوظة من {new Date(staleSince).toLocaleString('ar-EG')} — {error.message}
          </Text>
          <Ionicons name="refresh" size={16} color="#FB923C" />
        </TouchableOpacity>
      )}

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <FadeInView className="mb-6 items-center">
          <View
            className="h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: `${config.color}1A` }}>
            <RecordIcon type={config.key} size={36} color={config.color} />
          </View>
          <Text className="mt-3 text-center text-xl font-bold text-white">
            {doc.full_name || doc.name}
          </Text>
          <Text className="mt-1 text-xs text-slate-500">{doc.id_no ?? doc.name}</Text>
          {doc.docstatus === 0 && (
            <View className="mt-2 rounded-lg bg-slate-700/40 px-3 py-1">
              <Text className="text-xs text-slate-400">مسودة</Text>
            </View>
          )}
        </FadeInView>

        {config.sections.map((section, i) => (
          <FieldsSection
            key={section.title}
            title={section.title}
            icon={section.icon}
            color={config.color}
            delay={60 * (i + 1)}
            fields={section.fields}
            data={doc}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
