import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView } from '../../components/motion/FadeInView';
import { Skeleton } from '../../components/motion/Skeleton';
import { SyncBanner } from '../../components/SyncBanner';
import { EnterView, GrowBar } from '../../components/motion/Enter';
import { RecordIcon } from '../../components/RecordIcon';
import { UserCard } from '../../components/UserCard';
import { hasPermission, useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import {
  fetchRecordCountsWithCache,
  getCachedRecordCounts,
  RECORD_TYPE_KEYS,
  RECORD_TYPES,
  type RecordTypeKey,
} from '../../lib/records';
import { getDashboardStats, type DashboardStats, type LabelCount } from '../../lib/sync';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const monthLabel = (key: string) => ARABIC_MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

const BREAKDOWN_COLORS = ['#FF6F20', '#10B981', '#3B82F6', '#D97706', '#A855F7', '#94A3B8'];

const STATUS_COLORS: Record<string, string> = {
  مستفيد: '#10B981',
  مرشح: '#D97706',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  color,
  index = 0,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  index?: number;
}) {
  return (
    <EnterView index={index} style={{ width: '48%', marginBottom: 12 }}>
      <View className="rounded-3xl border border-white/5 bg-surface p-4">
        <View
          className="mb-3 h-10 w-10 items-center justify-center self-end rounded-2xl"
          style={{ backgroundColor: `${color}1A` }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text className="text-right text-2xl font-bold text-white">{value.toLocaleString()}</Text>
        <Text className="mt-1 text-right text-xs text-slate-400">{label}</Text>
      </View>
    </EnterView>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4 rounded-3xl border border-white/5 bg-surface p-5">
      <Text className="mb-4 text-right text-base font-bold text-white">{title}</Text>
      {children}
    </View>
  );
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────
const CHART_HEIGHT = 140;

function MonthlyBarChart({ data }: { data: LabelCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <Text className="py-6 text-center text-slate-500">لا توجد بيانات لهذه الفترة</Text>;
  }

  return (
    // row-reverse puts the newest month on the left, matching RTL reading order.
    <View
      className="flex-row-reverse items-end justify-between"
      style={{ height: CHART_HEIGHT + 40 }}>
      {data.map((d, i) => {
        const isCurrent = i === data.length - 1;
        const barHeight = Math.max(4, (d.count / max) * CHART_HEIGHT);
        return (
          <View key={d.label} className="flex-1 items-center">
            <Text className="mb-1 text-[10px] font-bold text-slate-400">{d.count}</Text>
            <GrowBar
              axis="height"
              value={barHeight}
              delay={150 + i * 70}
              style={{
                width: 24,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                backgroundColor: isCurrent ? '#FF6F20' : 'rgba(255,111,32,0.35)',
              }}
            />
            <Text className="mt-2 text-[10px] text-slate-500" numberOfLines={1}>
              {monthLabel(d.label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Breakdown (stacked bar + legend) ─────────────────────────────────────────
function Breakdown({
  data,
  colorFor,
}: {
  data: LabelCount[];
  colorFor: (label: string, index: number) => string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <Text className="py-4 text-center text-slate-500">لا توجد بيانات</Text>;
  }

  return (
    <View>
      <View className="mb-4 h-3 flex-row-reverse overflow-hidden rounded-full bg-slate-800">
        <GrowBar
          axis="scaleX"
          value={1}
          delay={200}
          style={{ flex: 1, flexDirection: 'row-reverse' }}>
          {data.map((d, i) => (
            <View key={d.label} style={{ flex: d.count, backgroundColor: colorFor(d.label, i) }} />
          ))}
        </GrowBar>
      </View>
      {data.map((d, i) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <View key={d.label} className="mb-2 flex-row-reverse items-center justify-between">
            <View className="flex-row-reverse items-center">
              <View
                className="ml-2 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorFor(d.label, i) }}
              />
              <Text className="text-sm text-slate-300">{d.label}</Text>
            </View>
            <Text className="text-sm text-slate-400">
              {d.count} <Text className="text-xs text-slate-500">({pct}%)</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Recent aid row ───────────────────────────────────────────────────────────
function RecentAidRow({ item, onPress }: { item: Record<string, any>; onPress: () => void }) {
  const pending = item.created_locally === true || item.synced === false;
  const statusColor = STATUS_COLORS[item.eligibility_status] ?? '#94A3B8';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="flex-row-reverse items-center border-b border-white/5 py-3">
      <View className="ml-3 h-10 w-10 items-center justify-center rounded-2xl bg-slate-800/40">
        <Ionicons
          name={item.nature_of_aid === 'نقدي' ? 'cash-outline' : 'gift-outline'}
          size={20}
          color="#FF6F20"
        />
      </View>
      <View className="flex-1 items-end">
        <Text className="text-sm font-bold text-white" numberOfLines={1}>
          {item.recipient ?? item.organization_name ?? item.name}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {item.aid_date ?? '—'} · {item.nature_of_aid ?? '—'}
        </Text>
      </View>
      <View className="mr-2 items-start">
        {pending ? (
          <Ionicons name="cloud-upload-outline" size={16} color="#FB923C" />
        ) : (
          <Text className="text-xs font-bold" style={{ color: statusColor }}>
            {item.eligibility_status ?? '—'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Loading placeholder ──────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <View className="px-4">
      <View className="flex-row flex-wrap justify-between">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-28 w-[48%] rounded-3xl" />
        ))}
      </View>
      <Skeleton className="mb-4 h-56 rounded-3xl" />
      <Skeleton className="mb-4 h-40 rounded-3xl" />
    </View>
  );
}

// ─── Records quick access ─────────────────────────────────────────────────────
function RecordsQuickAccess({
  counts,
  onPress,
}: {
  counts: Partial<Record<RecordTypeKey, number | null>>;
  onPress: (type: RecordTypeKey) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const visible = RECORD_TYPE_KEYS.filter((k) =>
    hasPermission(user, RECORD_TYPES[k].doctype, 'read')
  );
  if (visible.length === 0) return null;

  return (
    <>
      <Text className="mb-3 mr-1 text-right text-base font-bold text-white">السجلات</Text>
      <View className="mb-4 flex-row-reverse justify-between">
        {visible.map((key, i) => {
          const cfg = RECORD_TYPES[key];
          const count = counts[key];
          return (
            <EnterView key={key} index={i} delay={100} style={{ width: '31%' }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onPress(key)}
                className="items-center rounded-3xl border border-white/5 bg-surface py-4">
                <View
                  className="mb-2 h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${cfg.color}1A` }}>
                  <RecordIcon type={key} size={22} color={cfg.color} />
                </View>
                <Text className="text-lg font-bold text-white">
                  {count === undefined ? '…' : count === null ? '—' : count.toLocaleString()}
                </Text>
                <Text className="text-xs text-slate-400">{cfg.label}</Text>
              </TouchableOpacity>
            </EnterView>
          );
        })}
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // Server counts; undefined = loading, null = unavailable (never fetched / no permission).
  const [recordCounts, setRecordCounts] = useState<Partial<Record<RecordTypeKey, number | null>>>(
    {}
  );

  const load = useCallback(async () => {
    // Fire-and-forget: the network must never block the local stats.
    // Show last known counts instantly, then refresh (falls back to cache per type).
    getCachedRecordCounts().then((cached) => {
      if (cached) setRecordCounts((prev) => (Object.keys(prev).length ? prev : cached.data));
    });
    fetchRecordCountsWithCache()
      .then(setRecordCounts)
      .catch(() => setRecordCounts({ wounded: null, martyrs: null, prisoners: null }));
    try {
      setStats(await getDashboardStats());
      setError(false);
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Reload local stats when a background download finishes.
  const dataVersion = useSyncStore((s) => s.dataVersion);
  useEffect(() => {
    if (dataVersion) load();
  }, [dataVersion, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openRecords = useCallback(
    // Tab route names match the record type keys: /wounded, /martyrs, /prisoners.
    (type: RecordTypeKey) => router.navigate(`/${type}`),
    [router]
  );

  const openAid = useCallback(
    (name: string) => router.push({ pathname: '/aid-details', params: { id: name } }),
    [router]
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6F20" />
        }>
        {/* User info + sync / logout */}
        <View className="mt-4">
          <UserCard />
          <SyncBanner />
        </View>

        {error && !stats ? (
          <View className="mt-20 items-center">
            <Ionicons name="alert-circle-outline" size={48} color="#475569" />
            <Text className="mt-4 text-slate-500">تعذر تحميل البيانات</Text>
            <TouchableOpacity onPress={load} className="mt-4 rounded-full bg-primary px-6 py-2">
              <Text className="font-bold text-white">إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : !stats ? (
          <DashboardSkeleton />
        ) : (
          <View className="px-4">
            {/* Stats */}
            <View className="flex-row-reverse flex-wrap justify-between">
              <StatCard
                label="إجمالي المساعدات"
                value={stats.totalAids}
                icon="hand-left-outline"
                color="#FF6F20"
              />
              <StatCard
                label="المستلمون"
                value={stats.totalRecipients}
                icon="people-outline"
                color="#3B82F6"
                index={1}
              />
              <StatCard
                label="هذا الشهر"
                value={stats.aidsThisMonth}
                icon="calendar-outline"
                color="#10B981"
                index={2}
              />
              <StatCard
                label="في انتظار المزامنة"
                value={stats.pendingSync}
                icon="cloud-upload-outline"
                color="#D97706"
                index={3}
              />
            </View>

            {/* Records quick access */}
            <FadeInView delay={30}>
              <RecordsQuickAccess counts={recordCounts} onPress={openRecords} />
            </FadeInView>

            {/* Charts */}
            <FadeInView delay={60}>
              <Section title="المساعدات خلال آخر ٦ أشهر">
                <MonthlyBarChart data={stats.monthly} />
              </Section>
            </FadeInView>

            <FadeInView delay={120}>
              <Section title="حسب نوع المساعدة">
                <Breakdown
                  data={stats.byNature}
                  colorFor={(_, i) => BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}
                />
              </Section>
            </FadeInView>

            <FadeInView delay={180}>
              <Section title="حسب الحالة">
                <Breakdown
                  data={stats.byStatus}
                  colorFor={(label, i) =>
                    STATUS_COLORS[label] ?? BREAKDOWN_COLORS[(i + 2) % BREAKDOWN_COLORS.length]
                  }
                />
              </Section>
            </FadeInView>

            {/* Recent aids */}
            <FadeInView delay={240}>
              <Section title="آخر ١٠ مساعدات">
                {stats.recentAids.length === 0 ? (
                  <Text className="py-4 text-center text-slate-500">لا توجد مساعدات</Text>
                ) : (
                  stats.recentAids.map((item, i) => (
                    <EnterView key={item.name} index={i} delay={250} variant="fade">
                      <RecentAidRow item={item} onPress={() => openAid(item.name)} />
                    </EnterView>
                  ))
                )}
                <TouchableOpacity
                  onPress={() => router.navigate('/aids')}
                  className="mt-3 items-center">
                  <Text className="text-sm font-bold text-primary">عرض الكل</Text>
                </TouchableOpacity>
              </Section>
            </FadeInView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
