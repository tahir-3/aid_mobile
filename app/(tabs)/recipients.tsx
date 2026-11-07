import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PersonAidsSheet, type PersonRef } from '../../components/PersonAidsSheet';
import { RecordIcon } from '../../components/RecordIcon';
import { SyncBanner } from '../../components/SyncBanner';
import { EnterView } from '../../components/motion/Enter';
import { FilterSheet } from '../../components/FilterSheet';
import { ExportButton } from '../../components/ExportButton';
import { exportFilteredPeople } from '../../lib/exportFile';
import { describeApiError } from '../../lib/apiError';
import {
  activeFilterCount,
  EMPTY_FILTER,
  fetchFilteredPeople,
  type PeopleFilter,
} from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

import { useSyncStore } from '../../store/syncStore';
import { getRecipientsPaginated, getRecipientsCount } from '../../lib/sync';

/** Fields requested from the filter endpoint (same shape as the local rows). */
const RECIPIENT_FILTER_FIELDS = ['name', 'full_name', 'id_no', 'branch', 'jawwal_no', 'docstatus'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recipient {
  name: string;
  full_name?: string;
  recipient_name?: string;
  national_id?: string;
  mobile?: string;
  branch?: string;
  status?: string;
  [key: string]: any;
}

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Same blue as the recipients stat card on the dashboard. */
const RECIPIENT_COLOR = '#3B82F6';

const getStatusStyle = (status?: string) => {
  switch (status) {
    case 'نشط':
      return { bg: 'bg-success/10', text: 'text-success' };
    case 'معلق':
    case 'موقوف':
      return { bg: 'bg-error/10', text: 'text-error' };
    default:
      return { bg: 'bg-slate-800/50', text: 'text-slate-400' };
  }
};

// ─── Recipient Card ───────────────────────────────────────────────────────────
const RecipientCard = React.memo(
  ({
    item,
    onPress,
    onAids,
  }: {
    item: Recipient;
    onPress: (item: Recipient) => void;
    onAids: (item: Recipient) => void;
  }) => {
    const displayName = item.full_name ?? item.recipient_name ?? item.name;
    const statusStyle = getStatusStyle(item.status);
    const isPendingSync = item.created_locally === true || item.synced === false;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress(item)}
        className={`mb-4 rounded-3xl border bg-surface p-5 ${
          isPendingSync ? 'border-orange-500/30' : 'border-white/5'
        }`}>
        {/* Pending Sync Badge */}
        {isPendingSync && (
          <View className="mb-3 flex-row items-center justify-end">
            <View className="flex-row items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1">
              <Text className="ml-1.5 text-[10px] font-bold text-orange-400">
                في انتظار المزامنة
              </Text>
              <Ionicons name="cloud-upload-outline" size={12} color="#FB923C" />
            </View>
          </View>
        )}

        {/* Top Row */}

        <View className="mb-4 flex-row items-start justify-between">
          <TouchableOpacity
            onPress={() => onAids(item)}
            accessibilityLabel="عرض المساعدات"
            hitSlop={8}
            className="items-center rounded-2xl bg-primary/10 px-2.5 py-2">
            <Ionicons name="hand-left-outline" size={18} color="#FF6F20" />
            <Text className="mt-0.5 text-[10px] font-bold text-primary">المساعدات</Text>
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center justify-end">
            <View className="mr-3 items-end">
              <Text className="mb-1 text-lg font-bold text-white" numberOfLines={1}>
                {displayName}
              </Text>
              {item.status && (
                <View className={`rounded-md px-2 py-0.5 ${statusStyle.bg}`}>
                  <Text className={`text-[10px] font-bold ${statusStyle.text}`}>{item.status}</Text>
                </View>
              )}
            </View>
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${RECIPIENT_COLOR}1A` }}>
              <RecordIcon type="recipients" size={22} color={RECIPIENT_COLOR} />
            </View>
          </View>
        </View>

        {/* Details */}
        <View className="space-y-2">
          {item.national_id && (
            <View className="flex-row items-center justify-end">
              <Text className="mr-2 text-sm text-slate-300">{item.national_id}</Text>
              <Text className="mr-2 text-sm text-slate-500">رقم الهوية:</Text>
              <Ionicons name="card-outline" size={16} color="#94A3B8" />
            </View>
          )}

          {item.branch && (
            <View className="mt-2 flex-row items-center justify-end">
              <Text className="mr-2 text-sm text-slate-300" numberOfLines={1}>
                {item.branch}
              </Text>
              <Text className="mr-2 text-sm text-slate-500">الفرع:</Text>
              <Ionicons name="business-outline" size={16} color="#94A3B8" />
            </View>
          )}

          {item.mobile && (
            <View className="mt-2 flex-row items-center justify-end">
              <Text className="mr-2 text-sm text-slate-300">{item.mobile}</Text>
              <Text className="mr-2 text-sm text-slate-500">الجوال:</Text>
              <Ionicons name="phone-portrait-outline" size={16} color="#94A3B8" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecipientsScreen() {
  const router = useRouter();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Criteria filter: while active, the list comes from the server
  // (aids.api.filter_people) instead of the local copy.
  const [filter, setFilter] = useState<PeopleFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const filterCount = activeFilterCount(filter);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const serverSearch = filterCount ? debouncedSearch : '';

  const fetchFilteredPage = useCallback(
    (start: number) =>
      fetchFilteredPeople('Recipient', filter, {
        fields: RECIPIENT_FILTER_FIELDS,
        search: serverSearch,
        start,
        limit: PAGE_SIZE,
      }),
    [filter, serverSearch]
  );

  const loadRecipients = useCallback(
    async (reset = true) => {
      setLoading(true);
      setFilterError(null);
      if (filterCount) {
        try {
          const { rows, total } = await fetchFilteredPage(0);
          setRecipients(rows as Recipient[]);
          setTotalCount(total);
        } catch (e) {
          const info = describeApiError(e);
          setRecipients([]);
          setTotalCount(0);
          setFilterError(info.detail ?? info.message);
        }
      } else {
        const [data, count] = await Promise.all([
          getRecipientsPaginated(PAGE_SIZE, 0, search.trim() || undefined),
          getRecipientsCount(search.trim() || undefined),
        ]);
        setRecipients(data as Recipient[]);
        setTotalCount(count);
      }
      setPage(1);
      setLoading(false);
    },
    [search, filterCount, fetchFilteredPage]
  );

  // Local search reacts per keystroke; filtered (server) search is debounced.
  const queryKey = filterCount ? `${serverSearch}|${JSON.stringify(filter)}` : `local|${search}`;
  useEffect(() => {
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useFocusEffect(
    useCallback(() => {
      loadRecipients();
    }, [loadRecipients])
  );

  // Background download (after login) finished → show the new local data.
  const syncStatus = useSyncStore((s) => s.status);
  const dataVersion = useSyncStore((s) => s.dataVersion);
  useEffect(() => {
    if (dataVersion) loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const loadMore = useCallback(async () => {
    if (loadingMore || recipients.length >= totalCount || recipients.length === 0) return;
    setLoadingMore(true);
    const offset = recipients.length;
    try {
      const data = filterCount
        ? (await fetchFilteredPage(offset)).rows
        : await getRecipientsPaginated(PAGE_SIZE, offset, search.trim() || undefined);
      setRecipients((prev) => [...prev, ...(data as Recipient[])]);
    } catch (e) {
      console.warn('Failed to load more recipients:', describeApiError(e));
    } finally {
      setLoadingMore(false);
    }
  }, [recipients.length, totalCount, loadingMore, search, filterCount, fetchFilteredPage]);

  const onSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const handleItemPress = useCallback(
    (item: Recipient) => {
      router.push({ pathname: '/recipient-details', params: { id: item.name ?? item.id } });
    },
    [router]
  );

  // Bottom sheet with all aids of a recipient.
  const [aidsPerson, setAidsPerson] = useState<PersonRef | null>(null);
  const openAids = useCallback(
    (item: Recipient) =>
      setAidsPerson({
        type: 'Recipient',
        name: item.name ?? item.id,
        title: item.full_name ?? item.recipient_name ?? item.name,
      }),
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Recipient; index: number }) => (
      <EnterView index={index}>
        <RecipientCard item={item} onPress={handleItemPress} onAids={openAids} />
      </EnterView>
    ),
    [handleItemPress, openAids]
  );

  const renderFooter = useCallback(
    () =>
      recipients.length < totalCount && recipients.length > 0 ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#FF6F20" />
        </View>
      ) : null,
    [recipients.length, totalCount]
  );

  const renderEmpty = useCallback(
    () =>
      loading ? null : syncStatus === 'running' ? (
        <View className="mt-20 items-center">
          <ActivityIndicator color="#FF6F20" size="large" />
          <Text className="mt-4 text-slate-500">جاري تحميل البيانات من الخادم...</Text>
        </View>
      ) : (
        <View className="mt-20 items-center px-6">
          <Ionicons
            name={filterError ? 'alert-circle-outline' : 'people-outline'}
            size={48}
            color="#475569"
          />
          <Text className="mt-4 text-center text-slate-500">{filterError ?? 'لا توجد نتائج'}</Text>
        </View>
      ),
    [loading, syncStatus, filterError]
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="mt-2 flex-row items-center justify-center px-4 py-4">
        {/* <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="white" />
        </TouchableOpacity> */}
        <Text className="text-4xl font-bold text-white">المستلمون</Text>
        <RecordIcon
          type="recipients"
          size={30}
          color={RECIPIENT_COLOR}
          style={{ marginLeft: 10 }}
        />

        {/* <TouchableOpacity className="h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800">
          <Ionicons name="person" size={24} color="#FF6F20" />
        </TouchableOpacity> */}
      </View>

      <SyncBanner />

      {/* Search Bar + filter */}
      <View className="mb-4 flex-row items-center gap-2 px-4">
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          accessibilityLabel="تصفية"
          className={`h-12 w-12 items-center justify-center rounded-2xl border ${
            filterCount ? 'border-primary bg-primary/15' : 'border-white/5 bg-surface'
          }`}>
          <Ionicons name="options-outline" size={22} color={filterCount ? '#FF6F20' : '#94A3B8'} />
          {filterCount ? (
            <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[10px] font-bold text-white">{filterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center rounded-2xl border border-white/5 bg-surface px-4 py-1">
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <TextInput
            placeholder="بحث عن مستلم (الاسم، الهوية، الجوال)..."
            placeholderTextColor="#64748B"
            className="flex-1 px-3 text-right text-white"
            value={search}
            onChangeText={onSearchChange}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Count */}
      {!loading && (
        <View className="mb-2 flex-row-reverse items-center justify-between px-5">
          <Text className="text-right text-xs text-slate-500">
            {totalCount} مستلم{filterCount ? ' مطابق' : ''}
          </Text>
          {filterCount ? (
            <View className="flex-row-reverse items-center gap-2">
              <ExportButton
                onExport={() => exportFilteredPeople('Recipient', filter, serverSearch)}
              />
              <TouchableOpacity
                onPress={() => setFilter(EMPTY_FILTER)}
                className="flex-row-reverse items-center rounded-full bg-slate-800/60 px-3 py-1">
                <Ionicons name="close" size={12} color="#94A3B8" />
                <Text className="mr-1 text-xs text-slate-300">مسح التصفية</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6F20" size="large" />
          <Text className="mt-4 text-slate-500">جاري التحميل...</Text>
        </View>
      ) : (
        <FlatList
          data={recipients}
          keyExtractor={(item) => item.name ?? item.id ?? String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/new-recipient')}
        className="absolute bottom-10 left-8 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/60">
        <Ionicons name="person-add" size={24} color="white" />
      </TouchableOpacity>

      <FilterSheet
        visible={filterOpen}
        type="Recipient"
        title="المستلمين"
        value={filter}
        onApply={setFilter}
        onClose={() => setFilterOpen(false)}
      />
      <PersonAidsSheet person={aidsPerson} onClose={() => setAidsPerson(null)} />
    </SafeAreaView>
  );
}
