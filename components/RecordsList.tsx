import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeApiError, type ApiErrorInfo } from '../lib/apiError';
import {
  fetchRecords,
  getCachedRecords,
  RECORD_TYPES,
  setCachedRecords,
  useRecordsChanges,
  type RecordTypeConfig,
  type RecordTypeKey,
} from '../lib/records';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { usePermission } from '../store/authStore';
import { ListSkeleton } from './motion/Skeleton';
import { EnterView } from './motion/Enter';
import { FilterSheet } from './FilterSheet';
import { ExportButton } from './ExportButton';
import { exportFilteredPeople } from '../lib/exportFile';
import {
  activeFilterCount,
  EMPTY_FILTER,
  fetchFilteredPeople,
  type PeopleFilter,
} from '../lib/peopleFilter';
import type { AidRecipientType } from '../lib/personAids';
import { PersonAidsSheet, type PersonRef } from './PersonAidsSheet';
import { RecordIcon } from './RecordIcon';

const PAGE_SIZE = 20;

const formatSavedAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

// ─── Record card ──────────────────────────────────────────────────────────────
const RecordCard = React.memo(
  ({
    item,
    config,
    onPress,
    onAids,
  }: {
    item: Record<string, any>;
    config: RecordTypeConfig;
    onPress: (name: string) => void;
    onAids: (item: Record<string, any>) => void;
  }) => {
    const badge = item[config.badge.key];
    const subtitle = item[config.subtitle.key];
    const isDraft = item.docstatus === 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress(item.name)}
        className="mb-3 flex-row-reverse items-center rounded-3xl border border-white/5 bg-surface p-4">
        <View
          className="ml-3 h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${config.color}1A` }}>
          <RecordIcon type={config.key} size={22} color={config.color} />
        </View>

        <View className="flex-1 items-end">
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {item.full_name || item.name}
          </Text>
          <View className="mt-1 flex-row-reverse items-center">
            <Ionicons name="card-outline" size={12} color="#94A3B8" style={{ marginLeft: 4 }} />
            <Text className="text-xs text-slate-400">{item.id_no ?? item.name}</Text>
            {subtitle ? (
              <>
                <Text className="mx-1.5 text-xs text-slate-600">·</Text>
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {subtitle}
                </Text>
              </>
            ) : null}
          </View>
          <View className="mt-2 flex-row-reverse items-center gap-2">
            {badge ? (
              <View
                className="rounded-lg px-2 py-0.5"
                style={{ backgroundColor: `${config.color}1A` }}>
                <Text className="text-[11px] font-bold" style={{ color: config.color }}>
                  {badge}
                </Text>
              </View>
            ) : null}
            {isDraft && (
              <View className="rounded-lg bg-slate-700/40 px-2 py-0.5">
                <Text className="text-[11px] text-slate-400">مسودة</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onAids(item)}
          accessibilityLabel="عرض المساعدات"
          hitSlop={8}
          className="mr-1 items-center rounded-2xl bg-primary/10 px-2.5 py-2">
          <Ionicons name="hand-left-outline" size={18} color="#FF6F20" />
          <Text className="mt-0.5 text-[10px] font-bold text-primary">المساعدات</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }
);

// ─── Error view / banner ──────────────────────────────────────────────────────
function ErrorState({ error, onRetry }: { error: ApiErrorInfo; onRetry: () => void }) {
  return (
    <View className="mt-16 items-center px-6">
      <Ionicons
        name={
          error.kind === 'network'
            ? 'cloud-offline-outline'
            : error.kind === 'permission'
              ? 'lock-closed-outline'
              : 'alert-circle-outline'
        }
        size={48}
        color="#475569"
      />
      <Text className="mt-4 text-center text-slate-400">{error.message}</Text>
      {error.detail ? (
        <Text className="mt-2 text-center text-xs text-slate-600" numberOfLines={4} selectable>
          {error.detail}
        </Text>
      ) : null}
      {error.kind !== 'permission' && (
        <TouchableOpacity onPress={onRetry} className="mt-4 rounded-full bg-primary px-6 py-2">
          <Text className="font-bold text-white">إعادة المحاولة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StaleBanner({
  savedAt,
  error,
  onRetry,
}: {
  savedAt: string;
  error: ApiErrorInfo;
  onRetry: () => void;
}) {
  return (
    <View className="mx-4 mb-3 flex-row-reverse items-center rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
      <Ionicons name="time-outline" size={16} color="#FB923C" style={{ marginLeft: 6 }} />
      <View className="flex-1 items-end">
        <Text className="text-xs font-bold text-orange-400">
          بيانات محفوظة من {formatSavedAt(savedAt)}
        </Text>
        <Text className="text-[11px] text-orange-300/80" numberOfLines={2}>
          {error.message}
        </Text>
      </View>
      <TouchableOpacity onPress={onRetry} className="mr-2 p-1">
        <Ionicons name="refresh" size={18} color="#FB923C" />
      </TouchableOpacity>
    </View>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────
export function RecordsList({ type }: { type: RecordTypeKey }) {
  const router = useRouter();
  const config = RECORD_TYPES[type];

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  /** Set while showing cached data because the live request failed. */
  const [staleSince, setStaleSince] = useState<string | null>(null);

  // Criteria filter (server-side, aids.api.filter_people).
  const [filter, setFilter] = useState<PeopleFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = activeFilterCount(filter);
  /** Total matches while a filter is active (null otherwise). */
  const [total, setTotal] = useState<number | null>(null);

  /** One page from the plain list or, when a filter is active, the filter endpoint. */
  const fetchPage = useCallback(
    async (start: number): Promise<{ rows: Record<string, any>[]; total: number | null }> => {
      if (filterCount) {
        return fetchFilteredPeople(config.doctype as AidRecipientType, filter, {
          fields: config.listFields,
          search: debouncedSearch,
          start,
          limit: PAGE_SIZE,
        });
      }
      const rows = await fetchRecords(type, { search: debouncedSearch, limit: PAGE_SIZE, start });
      return { rows, total: null };
    },
    [filterCount, filter, config.doctype, config.listFields, debouncedSearch, type]
  );

  // Ignore responses from requests superseded by a newer search.
  const requestId = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    const useCache = !debouncedSearch && !filterCount;

    // Show the cached page immediately while the network request runs.
    let cached = null;
    if (useCache) {
      cached = await getCachedRecords(type);
      if (id !== requestId.current) return;
      if (cached) {
        setItems(cached.data);
        setLoading(false);
      }
    }

    try {
      const { rows: data, total: matched } = await fetchPage(0);
      if (id !== requestId.current) return;
      setItems(data);
      setTotal(matched);
      setHasMore(data.length === PAGE_SIZE);
      setError(null);
      setStaleSince(null);
      if (useCache) setCachedRecords(type, data);
    } catch (e: any) {
      if (id !== requestId.current) return;
      const info = describeApiError(e);
      console.warn(
        `Failed to load ${config.doctype}:`,
        info.status ?? 'no response',
        info.detail ?? e?.message
      );
      setError(info);
      setHasMore(false);
      if (cached) {
        setStaleSince(cached.savedAt);
      } else {
        setItems([]);
        setStaleSince(null);
      }
    }
  }, [type, debouncedSearch, filterCount, fetchPage, config.doctype]);

  useEffect(() => {
    setLoading(true);
    loadFirstPage().finally(() => setLoading(false));
  }, [loadFirstPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const { rows: data } = await fetchPage(items.length);
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.warn(`Failed to load more ${config.doctype}:`, describeApiError(e));
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, fetchPage, items.length, config.doctype]);

  // Bottom sheet with the person's aids. AID.recipient_type equals the doctype name.
  const [aidsPerson, setAidsPerson] = useState<PersonRef | null>(null);
  const openAids = useCallback(
    (item: Record<string, any>) =>
      setAidsPerson({
        type: config.doctype as PersonRef['type'],
        name: item.name,
        title: item.full_name || item.name,
      }),
    [config.doctype]
  );
  const canCreate = usePermission(config.doctype, 'create');

  // Reload after a record of this type was added (see app/new-record.tsx).
  const createdVersion = useRecordsChanges((s) => s.versions[type]);
  useEffect(() => {
    if (createdVersion) loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdVersion]);

  const openRecord = useCallback(
    (name: string) => router.push({ pathname: '/record-details', params: { type, id: name } }),
    [router, type]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Record<string, any>; index: number }) => (
      <EnterView index={index}>
        <RecordCard item={item} config={config} onPress={openRecord} onAids={openAids} />
      </EnterView>
    ),
    [config, openRecord, openAids]
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="mt-2 flex-row-reverse items-center justify-center px-4 py-4">
        <RecordIcon type={config.key} size={30} color={config.color} style={{ marginLeft: 10 }} />
        <Text className="text-4xl font-bold text-white">{config.label}</Text>
      </View>

      {/* Search + filter */}
      <View className="mb-4 flex-row items-center gap-2 px-4">
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          accessibilityLabel="تصفية"
          className={`h-12 w-12 items-center justify-center rounded-xl border ${
            filterCount ? 'border-primary bg-primary/15' : 'border-white/5 bg-surface'
          }`}>
          <Ionicons name="options-outline" size={22} color={filterCount ? '#FF6F20' : '#94A3B8'} />
          {filterCount ? (
            <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[10px] font-bold text-white">{filterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center rounded-xl border border-white/5 bg-surface px-3 py-1">
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <TextInput
            placeholder="ابحث بالاسم أو رقم الهوية..."
            placeholderTextColor="#94A3B8"
            className="flex-1 px-2 text-right text-white"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filterCount > 0 && (
        <View className="mx-4 mb-3 flex-row-reverse items-center justify-between">
          <Text className="text-xs text-slate-400">
            {total != null ? `${total} نتيجة مطابقة` : 'جاري التصفية...'}
          </Text>
          <View className="flex-row-reverse items-center gap-2">
            <ExportButton
              onExport={() =>
                exportFilteredPeople(config.doctype as AidRecipientType, filter, debouncedSearch)
              }
            />
            <TouchableOpacity
              onPress={() => setFilter(EMPTY_FILTER)}
              className="flex-row-reverse items-center rounded-full bg-slate-800/60 px-3 py-1">
              <Ionicons name="close" size={12} color="#94A3B8" />
              <Text className="mr-1 text-xs text-slate-300">مسح التصفية</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {staleSince && error && (
        <StaleBanner savedAt={staleSince} error={error} onRetry={onRefresh} />
      )}

      {loading ? (
        <ListSkeleton cards={5} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6F20" />
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="items-center py-4">
                <ActivityIndicator color="#FF6F20" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? (
              <ErrorState error={error} onRetry={onRefresh} />
            ) : (
              <View className="mt-20 items-center px-6">
                <Ionicons name="document-outline" size={48} color="#475569" />
                <Text className="mt-4 text-center text-slate-500">
                  {debouncedSearch || filterCount
                    ? 'لا توجد نتائج مطابقة'
                    : `لا توجد سجلات ${config.label}`}
                </Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {canCreate && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/new-record', params: { type } })}
          accessibilityLabel={`إضافة ${config.singular}`}
          className="absolute bottom-8 left-8 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/60">
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}

      <PersonAidsSheet person={aidsPerson} onClose={() => setAidsPerson(null)} />
      <FilterSheet
        visible={filterOpen}
        type={config.doctype as AidRecipientType}
        title={config.label}
        value={filter}
        onApply={setFilter}
        onClose={() => setFilterOpen(false)}
      />
    </SafeAreaView>
  );
}
