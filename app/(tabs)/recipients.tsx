import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRecipientsPaginated, getRecipientsCount } from '../../lib/sync';

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
const getInitials = (name?: string): string => {
  if (!name) return '؟';
  const parts = name.trim().split(' ');
  return parts[0]?.[0] ?? '؟';
};

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
  ({ item, onPress }: { item: Recipient; onPress: (item: Recipient) => void }) => {
    console.log({ item });
    const displayName = item.full_name ?? item.recipient_name ?? item.name;
    const initials = getInitials(displayName);
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
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={20} color="#94A3B8" />
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
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/10 bg-blue-900/20">
              <Text className="text-xl font-bold text-primary">{initials}</Text>
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

  const loadRecipients = useCallback(
    async (reset = true) => {
      setLoading(true);
      const [data, count] = await Promise.all([
        getRecipientsPaginated(PAGE_SIZE, 0, search.trim() || undefined),
        getRecipientsCount(search.trim() || undefined),
      ]);
      setRecipients(data as Recipient[]);
      setTotalCount(count);
      setPage(1);
      setLoading(false);
    },
    [search]
  );

  useEffect(() => {
    loadRecipients();
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      loadRecipients();
    }, [loadRecipients])
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || recipients.length >= totalCount || recipients.length === 0) return;
    setLoadingMore(true);
    const offset = recipients.length;
    const data = await getRecipientsPaginated(PAGE_SIZE, offset, search.trim() || undefined);
    setRecipients((prev) => [...prev, ...(data as Recipient[])]);
    setLoadingMore(false);
  }, [recipients.length, totalCount, loadingMore, search]);

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

  const renderItem = useCallback(
    ({ item }: { item: Recipient }) => {
      return <RecipientCard item={item} onPress={handleItemPress} />;
    },
    [handleItemPress]
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
      !loading ? (
        <View className="mt-20 items-center">
          <Ionicons name="people-outline" size={48} color="#475569" />
          <Text className="mt-4 text-slate-500">لا توجد نتائج</Text>
        </View>
      ) : null,
    [loading]
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="mt-2 flex-row items-center justify-center px-4 py-4">
        {/* <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="white" />
        </TouchableOpacity> */}
        <Text className="mr-2 text-4xl font-bold text-white">المستلمون</Text>

        {/* <TouchableOpacity className="h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800">
          <Ionicons name="person" size={24} color="#FF6F20" />
        </TouchableOpacity> */}
      </View>

      {/* Search Bar */}
      <View className="mb-4 px-4">
        <View className="flex-row items-center rounded-2xl border border-white/5 bg-surface px-4 py-1">
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
        <Text className="mb-2 px-5 text-right text-xs text-slate-500">{totalCount} مستلم</Text>
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
    </SafeAreaView>
  );
}
