import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL } from '../lib/api';
import { describeApiError } from '../lib/apiError';
import { syncWithFrappe } from '../lib/sync';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';
import { WavingHand } from './motion/Enter';

// System/internal roles that are not meaningful to show to the user.
const HIDDEN_ROLES = ['All', 'Guest', 'Desk User', 'System Manager', 'Administrator'];

/** Resolve user_image to an absolute URL if it's a relative path. */
const resolveImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
};

/** Compact user info with sync + logout actions (replaces the old profile tab). */
export function UserCard({ onSynced }: { onSynced?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [manualSyncing, setManualSyncing] = useState(false);
  // Also busy while the background download after login is running.
  const backgroundSyncing = useSyncStore((s) => s.status === 'running');
  const syncing = manualSyncing || backgroundSyncing;

  const imageUrl = resolveImageUrl(user?.user_image);
  const roles = (user?.roles ?? []).filter((r) => !HIDDEN_ROLES.includes(r));

  const handleSync = async () => {
    if (syncing) return;
    setManualSyncing(true);
    try {
      const result = await syncWithFrappe(true);
      const pushed = result.syncedRecipients + result.syncedAids;
      const pulled = result.pulledRecipients + result.pulledAids;
      const parts: string[] = [];
      if (pushed > 0)
        parts.push(`تم رفع ${result.syncedRecipients} مستفيد و ${result.syncedAids} مساعدة`);
      if (pulled > 0)
        parts.push(
          `تم تحميل ${result.pulledRecipients} مستفيد و ${result.pulledAids} مساعدة جديدة`
        );
      if (parts.length > 0) {
        Alert.alert('تمت المزامنة', parts.join('\n'));
      } else if (result.errors.length > 0) {
        Alert.alert('أخطاء في المزامنة', result.errors.join('\n'));
      } else {
        Alert.alert('مزامنة', 'تمت المزامنة. لا توجد بيانات جديدة.');
      }
      // Let every screen reload its local data.
      useSyncStore.getState().markCompleted();
      onSynced?.();
    } catch (err) {
      const info = describeApiError(err);
      console.warn('Sync error:', info);
      Alert.alert('خطأ في المزامنة', info.detail ?? info.message);
    } finally {
      setManualSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من أنك تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      // Store logout tolerates a failed server call, so logging out works offline.
      { text: 'خروج', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const firstName = (user?.fullname ?? '').trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View className="mx-4 mb-4">
      {/* Greeting — page header, outside the card */}
      <View className="mb-4 mt-2 items-end">
        <Text className="text-xs font-medium text-slate-500">{today}</Text>
        {/* Row reversed (RTL): text on the right, waving hand after the name. */}
        <View className="mt-1 flex-row-reverse items-center">
          <Text className="text-right text-3xl font-bold text-white" numberOfLines={1}>
            مرحباً{firstName ? '، ' : ''}
            {firstName ? <Text className="text-primary">{firstName}</Text> : null}
          </Text>
          <View className="mr-2">
            <WavingHand size={28} />
          </View>
        </View>
      </View>

      {/* Profile card */}
      <View className="flex-row-reverse items-center rounded-3xl border border-white/5 bg-surface p-4">
        <View className="ml-3 h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-primary/40 bg-slate-800">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={26} color="#94A3B8" />
          )}
        </View>

        <View className="flex-1 items-end">
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {user?.fullname ?? 'المستخدم'}
          </Text>
          {user?.email ? (
            <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
          {roles[0] ? (
            <View className="mt-1.5 rounded-full bg-primary/10 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-primary">
                {roles[0]}
                {roles.length > 1 ? ` +${roles.length - 1}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mr-2 flex-row gap-2">
          <TouchableOpacity
            onPress={handleLogout}
            accessibilityLabel="تسجيل الخروج"
            className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-800/60">
            <Ionicons name="log-out-outline" size={20} color="#F87171" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncing}
            accessibilityLabel="مزامنة البيانات"
            className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            {syncing ? (
              <ActivityIndicator color="#FF6F20" size="small" />
            ) : (
              <Ionicons name="sync" size={20} color="#FF6F20" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
