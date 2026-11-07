import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useSyncStore } from '../store/syncStore';
import { FadeInView } from './motion/FadeInView';

/** Shows background download progress (or its failure with a retry). Hidden otherwise. */
export function SyncBanner({ className = 'mx-4 mb-4' }: { className?: string }) {
  const status = useSyncStore((s) => s.status);
  const progress = useSyncStore((s) => s.progress);
  const message = useSyncStore((s) => s.message);
  const error = useSyncStore((s) => s.error);
  const retry = useSyncStore((s) => s.startInitialSync);

  if (status === 'running') {
    return (
      <FadeInView
        fadeOnly
        className={`${className} rounded-2xl border border-primary/30 bg-primary/10 p-3`}>
        <View className="flex-row-reverse items-center">
          <ActivityIndicator color="#FF6F20" size="small" />
          <Text className="mr-2 flex-1 text-right text-sm font-bold text-primary" numberOfLines={1}>
            {message || 'جاري تحميل البيانات...'}
          </Text>
          <Text className="text-xs text-primary/80">{Math.round(progress)}%</Text>
        </View>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/20">
          {/* Fill from the right to match RTL reading order. */}
          <View
            className="h-full self-end rounded-full bg-primary"
            style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
          />
        </View>
      </FadeInView>
    );
  }

  if (status === 'error') {
    return (
      <View
        className={`${className} flex-row-reverse items-center rounded-2xl border border-red-500/30 bg-red-500/10 p-3`}>
        <Ionicons name="alert-circle-outline" size={18} color="#F87171" />
        <Text className="mr-2 flex-1 text-right text-xs text-red-300" numberOfLines={2}>
          تعذر تحميل البيانات: {error}
        </Text>
        <TouchableOpacity onPress={retry} className="rounded-full bg-red-500/20 px-3 py-1">
          <Text className="text-xs font-bold text-red-300">إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
