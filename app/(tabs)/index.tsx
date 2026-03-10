import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSyncedData, STORAGE_KEYS } from '../../lib/sync';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AidRecord {
  name: string;
  recipient?: string;
  branch?: string;
  aid_type?: string;
  organization_name?: string;
  aid_date?: string;
  eligibility_status?: string;
  nature_of_aid?: string;
  synced?: boolean;
  created_locally?: boolean;
}

// ─── Category Config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all', label: 'الكل', field: null, value: null },
  { id: 'cash', label: 'نقدي', field: 'nature_of_aid', value: 'نقدي' },
  { id: 'kind', label: 'عيني', field: 'nature_of_aid', value: 'عيني' },
  { id: 'eligible', label: 'مستفيد', field: 'eligibility_status', value: 'مستفيد' },
  { id: 'candidate', label: 'مرشح', field: 'eligibility_status', value: 'مرشح' },
];

const PAGE_SIZE = 15;

// ─── Status Display Helpers ───────────────────────────────────────────────────
const getStatusStyle = (status?: string) => {
  switch (status) {
    case 'مستفيد':
      return { bg: 'bg-success/10', text: 'text-success', color: '#10B981' };
    case 'مرشح':
      return { bg: 'bg-warning/10', text: 'text-warning', color: '#D97706' };
    default:
      return { bg: 'bg-slate-700/30', text: 'text-slate-400', color: '#94A3B8' };
  }
};

const getNatureIcon = (nature?: string): any => {
  if (nature === 'نقدي') return 'cash-outline';
  if (nature === 'عيني') return 'gift-outline';
  return 'help-circle-outline';
};

// ─── AID Card ─────────────────────────────────────────────────────────────────
const AidCard = React.memo(({ item, onPress }: { item: AidRecord; onPress: () => void }) => {
  const status = getStatusStyle(item.eligibility_status);
  const isPendingSync = item.created_locally === true || item.synced === false;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`mb-4 rounded-3xl border bg-surface p-5 ${
        isPendingSync ? 'border-orange-500/30' : 'border-white/5'
      }`}>
      {/* Pending Sync Badge */}
      {isPendingSync && (
        <View className="mb-3 flex-row items-center justify-end">
          <View className="flex-row items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1">
            <Text className="ml-1.5 text-[10px] font-bold text-orange-400">في انتظار المزامنة</Text>
            <Ionicons name="cloud-upload-outline" size={12} color="#FB923C" />
          </View>
        </View>
      )}

      {/* Top Row */}
      <View className="mb-4 flex-row justify-end">
        <View className="mr-4 flex-1 items-end">
          <Text className="mb-1 text-base font-bold text-primary" numberOfLines={1}>
            {item.name}
          </Text>
          <View className="w-full flex-row-reverse items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-xs text-slate-400" numberOfLines={1}>
                {item.recipient ?? item.organization_name ?? '—'}
              </Text>
              <Ionicons name="person-outline" size={12} color="#94A3B8" style={{ marginLeft: 4 }} />
            </View>
            <View className="flex-row items-center">
              <Text className="text-xs text-slate-400" numberOfLines={1}>
                {item.aid_date ?? '—'}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={12}
                color="#94A3B8"
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/40">
          <Ionicons name={getNatureIcon(item.nature_of_aid)} size={24} color="#FF6F20" />
        </View>
      </View>

      {/* Bottom Row */}
      <View className="flex-row items-end justify-between border-t border-white/5 pt-4">
        <View className="items-start">
          <Text className="mb-2 text-[10px] font-bold text-slate-500">الحالة</Text>
          <View className={`flex-row items-center rounded-xl px-3 py-1.5 ${status.bg}`}>
            <Ionicons name="ellipse" size={8} color={status.color} style={{ marginLeft: 4 }} />
            <Text className={`text-xs font-bold ${status.text}`}>
              {item.eligibility_status ?? '—'}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="mb-2 text-[10px] font-bold text-slate-500">نوع المساعدة</Text>
          <View className="flex-row items-center">
            <Text className="mr-2 text-xs font-medium text-white">{item.nature_of_aid ?? '—'}</Text>
            <Ionicons name="layers-outline" size={14} color="#94A3B8" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();

  const [allAids, setAllAids] = useState<AidRecord[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadAids = useCallback(async () => {
    setLoading(true);
    const data = await getSyncedData(STORAGE_KEYS.AID);
    setAllAids(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAids();
  }, [loadAids]);

  useFocusEffect(
    useCallback(() => {
      loadAids();
    }, [loadAids])
  );

  // Filter: category + search
  const filtered = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    let result = allAids;

    if (cat && cat.field && cat.value) {
      result = result.filter((a) => (a as any)[cat.field!] === cat.value);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.recipient?.toLowerCase().includes(q) ||
          a.organization_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allAids, activeCategory, search]);

  // Paginated slice
  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const loadMore = useCallback(() => {
    if (paginated.length < filtered.length) {
      setPage((p) => p + 1);
    }
  }, [paginated.length, filtered.length]);

  const onCategoryPress = (id: string) => {
    setActiveCategory(id);
    setPage(1);
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const renderItem = useCallback(
    ({ item }: { item: AidRecord }) => (
      <AidCard item={item} onPress={() => router.push({ pathname: '/aid-details', params: { id: item.name } })} />
    ),
    [router]
  );

  const renderFooter = useCallback(() => {
    if (paginated.length >= filtered.length) return null;
    return (
      <View className="items-center py-4">
        <ActivityIndicator color="#FF6F20" />
      </View>
    );
  }, [paginated.length, filtered.length]);

  const renderEmpty = useCallback(
    () =>
      !loading ? (
        <View className="mt-20 items-center">
          <Ionicons name="document-outline" size={48} color="#475569" />
          <Text className="mt-4 text-slate-500">لا توجد مساعدات</Text>
        </View>
      ) : null,
    [loading]
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="mt-2 flex-row items-center justify-between px-4 py-4">
        <TouchableOpacity>
          <Ionicons name="notifications" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">قائمة المساعدات</Text>
        <TouchableOpacity>
          <Ionicons name="menu" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="mb-4 px-4">
        <View className="flex-row items-center rounded-xl border border-white/5 bg-surface px-3 py-1">
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <TextInput
            placeholder="ابحث عن المساعدات..."
            placeholderTextColor="#94A3B8"
            className="flex-1 px-2 text-right text-white"
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

      {/* Category Chips */}
      <View className="mb-4">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, flexDirection: 'row-reverse' }}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              onPress={() => onCategoryPress(cat.id)}
              className={`ml-3 rounded-full px-6 py-2 ${activeCategory === cat.id ? 'bg-primary' : 'bg-surface'}`}>
              <Text
                className={`text-sm ${activeCategory === cat.id ? 'font-bold text-white' : 'text-slate-400'}`}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Total Count */}
      {!loading && (
        <Text className="mb-2 px-5 text-right text-xs text-slate-500">{filtered.length} نتيجة</Text>
      )}

      {/* List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6F20" size="large" />
          <Text className="mt-4 text-slate-500">جاري التحميل...</Text>
        </View>
      ) : (
        <FlatList
          data={paginated}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/new-aid')}
        className="absolute bottom-8 left-8 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/60">
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
