import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';

import { describeApiError } from '../lib/apiError';
import {
  fetchPersonAids,
  fetchPersonAidsCount,
  getLocalPersonAids,
  type AidRecipientType,
} from '../lib/personAids';
import { BottomSheet } from './motion/BottomSheet';
import { ExportButton } from './ExportButton';
import { exportPersonAids } from '../lib/exportFile';
import { EnterView } from './motion/Enter';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = { مستفيد: '#10B981', مرشح: '#D97706' };

export interface PersonRef {
  type: AidRecipientType;
  /** Document name (the AID.recipient value). */
  name: string;
  /** Display name. */
  title: string;
}

function AidRow({ item }: { item: Record<string, any> }) {
  const statusColor = STATUS_COLORS[item.eligibility_status] ?? '#94A3B8';
  return (
    <View className="flex-row-reverse items-center border-b border-white/5 py-3">
      <View className="ml-3 h-10 w-10 items-center justify-center rounded-2xl bg-slate-800/40">
        <Ionicons
          name={item.nature_of_aid === 'نقدي' ? 'cash-outline' : 'gift-outline'}
          size={20}
          color="#FF6F20"
        />
      </View>
      <View className="flex-1 items-end">
        <Text className="text-sm font-bold text-white" numberOfLines={1}>
          {item.aid_type ?? '—'}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {item.aid_date ?? '—'} · {item.organization_name ?? '—'}
        </Text>
      </View>
      <View className="mr-2 items-start">
        <Text className="text-xs font-bold" style={{ color: statusColor }}>
          {item.eligibility_status ?? '—'}
        </Text>
        {item.docstatus === 0 || item.created_locally ? (
          <Text className="mt-0.5 text-[10px] text-slate-500">
            {item.created_locally ? 'غير مُزامن' : 'مسودة'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Bottom sheet listing every aid given to one person (any recipient type). */
export function PersonAidsSheet({
  person,
  onClose,
}: {
  person: PersonRef | null;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (p: PersonRef) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    setOffline(false);
    setItems([]);
    setTotal(null);
    try {
      const [page, count] = await Promise.all([
        fetchPersonAids(p.type, p.name, { start: 0, limit: PAGE_SIZE }),
        fetchPersonAidsCount(p.type, p.name).catch(() => null),
      ]);
      if (id !== requestId.current) return;
      setItems(page);
      setTotal(count);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      if (id !== requestId.current) return;
      const info = describeApiError(e);
      // Offline: recipients' aids are also stored on the phone.
      if (info.kind === 'network' && p.type === 'Recipient') {
        const local = await getLocalPersonAids(p.name).catch(() => []);
        if (id !== requestId.current) return;
        setItems(local);
        setTotal(local.length);
        setOffline(true);
      } else {
        // Show the server's own reason (e.g. a Frappe validation message) under the
        // generic text, so the real cause is visible and can be reported.
        console.warn('Failed to load aids:', info.status, info.detail);
        setError(info.detail ? `${info.message}\n${info.detail}` : info.message);
      }
      setHasMore(false);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (person) load(person);
  }, [person, load]);

  const loadMore = useCallback(async () => {
    if (!person || loading || loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchPersonAids(person.type, person.name, {
        start: items.length,
        limit: PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      console.warn('Failed to load more aids:', describeApiError(e));
    } finally {
      setLoadingMore(false);
    }
  }, [person, loading, loadingMore, hasMore, items.length]);

  return (
    <BottomSheet visible={!!person} onClose={onClose}>
      <View className="px-5" style={{ height: 520 }}>
        {/* Header */}
        <View className="mb-3 flex-row-reverse items-center justify-between">
          <View className="flex-1 items-end">
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              مساعدات {person?.title ?? ''}
            </Text>
            <Text className="text-xs text-slate-500">
              {total != null ? `${total} مساعدة` : loading ? 'جاري التحميل...' : ''}
              {offline ? ' · بيانات محفوظة على الجهاز' : ''}
            </Text>
          </View>
          {person && !offline && (total ?? items.length) > 0 ? (
            <View className="ml-2">
              <ExportButton
                compact
                label="تصدير المساعدات"
                onExport={() => exportPersonAids(person.type, person.name)}
              />
            </View>
          ) : null}
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="إغلاق"
            className="h-9 w-9 items-center justify-center rounded-full bg-surface">
            <Ionicons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FF6F20" size="large" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="alert-circle-outline" size={40} color="#475569" />
            <Text className="mt-3 text-center text-slate-400" selectable numberOfLines={8}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => person && load(person)}
              className="mt-4 rounded-full bg-primary px-6 py-2">
              <Text className="font-bold text-white">إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.name}
            renderItem={({ item, index }) => (
              <EnterView index={index} variant="fade">
                <AidRow item={item} />
              </EnterView>
            )}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View className="items-center py-4">
                  <ActivityIndicator color="#FF6F20" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="mt-16 items-center">
                <Ionicons name="hand-left-outline" size={40} color="#475569" />
                <Text className="mt-3 text-slate-500">لا توجد مساعدات مسجلة</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </BottomSheet>
  );
}
