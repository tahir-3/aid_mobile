import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import api, { API_BASE_URL } from '../../lib/api';
import { syncWithFrappe } from '../../lib/sync';

/** Resolve user_image to an absolute URL if it's a relative path */
const resolveImageUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // relative path — prepend base URL (strip trailing slash to avoid double slash)
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
};

const MENU_ITEMS = [
  {
    section: 'إعدادات الحساب',
    items: [
      {
        id: 'edit',
        title: 'تعديل الملف الشخصي',
        icon: 'person',
        color: 'bg-blue-900/40',
        iconColor: '#3B82F6',
      },
      // {
      //   id: 'security',
      //   title: 'الأمان وكلمة المرور',
      //   icon: 'shield',
      //   color: 'bg-blue-900/40',
      //   iconColor: '#3B82F6',
      // },
      // {
      //   id: 'notifications',
      //   title: 'التنبيهات',
      //   icon: 'notifications',
      //   color: 'bg-blue-900/40',
      //   iconColor: '#3B82F6',
      // },
    ],
  },
  // {
  //   section: 'أخرى',
  //   items: [
  //     {
  //       id: 'help',
  //       title: 'مركز المساعدة',
  //       icon: 'help-circle',
  //       color: 'bg-slate-800/60',
  //       iconColor: '#94A3B8',
  //     },
  //   ],
  // },
];

// Roles to hide from the badge display (system/internal roles)
const HIDDEN_ROLES = ['All', 'Guest', 'Desk User', 'System Manager', 'Administrator'];

export default function ProfileScreen() {
  const { logout:StoreLogout, user } = useAuthStore();
  const [syncing, setSyncing] = useState(false);

  const displayRoles = (user?.roles ?? []).filter((r) => !HIDDEN_ROLES.includes(r)).slice(0, 3); // show max 3 badges

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncWithFrappe(true, (progress, message) => {
        // Optional: show progress in UI
      });
      const pushed = result.syncedRecipients + result.syncedAids;
      const pulled = result.pulledRecipients + result.pulledAids;
      const parts: string[] = [];
      if (pushed > 0) parts.push(`تم رفع ${result.syncedRecipients} مستفيد و ${result.syncedAids} مساعدة`);
      if (pulled > 0) parts.push(`تم تحميل ${result.pulledRecipients} مستفيد و ${result.pulledAids} مساعدة جديدة`);
      if (parts.length > 0) {
        Alert.alert('تمت المزامنة', parts.join('\n'));
      } else if (result.errors.length > 0) {
        Alert.alert('أخطاء في المزامنة', result.errors.join('\n'));
      } else {
        Alert.alert('مزامنة', 'تمت المزامنة. لا توجد بيانات جديدة.');
      }
    } catch (err: any) {
      console.log('Sync error:', err);
      if (err.response?.data) {
        console.log('Sync error details:', JSON.stringify(err.response.data, null, 2));
      }
      
      let errorMessage = err?.message || 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
      
      // Try to extract a more descriptive message from Frappe response
      if (err.response?.data) {
        const data = err.response.data;
        if (data._server_messages) {
          try {
            const msgs = JSON.parse(data._server_messages);
            errorMessage = msgs.map((m: any) => m.message || m).join('\n');
          } catch {}
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.exc) {
          try {
            const exc = JSON.parse(data.exc);
            errorMessage = exc[0] || errorMessage;
          } catch {}
        }
      }

      Alert.alert('خطأ في المزامنة', errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من أنك تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => logout() },
    ]);
  };

const logout = async ()=> {
  try {
    // Replace 'your_app' with the actual module name where the login function is defined
    await api.post('/api/method/frappe.handler.logout');
    await StoreLogout()
    
  } catch (error) {
    throw error;
  }
}

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <Text className="text-4xl font-bold text-center text-white">الملف الشخصي</Text>
      <ScrollView className="mt-4 px-5" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile Info */}
        <View className="mb-8 items-center">
          <View className="relative">
            <View className="h-32 w-32 overflow-hidden rounded-full border-4 border-primary p-1">
              <View className="h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-800">
                {resolveImageUrl(user?.user_image ?? null) ? (
                  <Image
                    source={{ uri: resolveImageUrl(user!.user_image)! }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={80} color="#94A3B8" />
                )}
              </View>
            </View>
            <TouchableOpacity className="absolute bottom-1 left-2 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
          </View>

          <Text className="mt-4 text-2xl font-bold text-white">{user?.fullname ?? 'المستخدم'}</Text>
          <Text className="mt-1 text-sm text-slate-500">{user?.email ?? ''}</Text>

          {/* Roles Badges */}
          {displayRoles.length > 0 && (
            <View className="mt-4 flex-row flex-wrap justify-center gap-2">
              {displayRoles.map((role) => (
                <View
                  key={role}
                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
                  <Text className="text-xs font-bold text-primary">{role}</Text>
                </View>
              ))}
              {(user?.roles.length ?? 0) -
                HIDDEN_ROLES.filter((r) => user?.roles.includes(r)).length >
                3 && (
                <View className="rounded-full border border-white/10 bg-slate-800 px-3 py-1">
                  <Text className="text-xs text-slate-400">
                    +
                    {(user?.roles.length ?? 0) -
                      displayRoles.length -
                      HIDDEN_ROLES.filter((r) => user?.roles.includes(r)).length}{' '}
                    أخرى
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Menu Items */}
        {/* {MENU_ITEMS.map((section, idx) => (
          <View key={idx} className="mb-6">
            <Text className="mb-3 px-1 text-right text-xs font-bold text-slate-500">
              {section.section}
            </Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="mb-3 flex-row items-center justify-between rounded-3xl border border-white/5 bg-surface p-4">
                <Ionicons name="chevron-back" size={18} color="#94A3B8" />
                <View className="flex-row items-center">
                  <Text className="mr-4 font-bold text-white">{item.title}</Text>
                  <View
                    className={`h-10 w-10 ${item.color} items-center justify-center rounded-2xl`}>
                    <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))} */}

        {/* Sync Button */}
        <TouchableOpacity
          onPress={handleSync}
          disabled={syncing}
          className="mb-4 mt-40 flex-row items-center justify-center rounded-3xl border border-primary/50 bg-primary/10 py-4"
          activeOpacity={0.8}>
          {syncing ? (
            <ActivityIndicator color="#FF6F20" size="small" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={24} color="#FF6F20" />
          )}
          <Text className={`ml-2 text-xl font-bold ${syncing ? 'text-slate-400' : 'text-primary'}`}>
            {syncing ? 'جاري المزامنة...' : 'مزامنة البيانات'}
          </Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="mt-4 flex-row items-center justify-center rounded-3xl bg-primary py-4 shadow-lg shadow-primary/40"
          activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={24} color="white" />
          <Text className="ml-2 text-xl font-bold text-white">تسجيل الخروج</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text className="mt-8 text-center text-xs text-slate-600">الإصدار v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
