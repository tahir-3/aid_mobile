import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { RecordIcon } from '../../components/RecordIcon';
import { TabBarIcon } from '../../components/TabBarIcon';
import { usePermission } from '../../store/authStore';

// Tabs are declared in REVERSE so the bar reads right-to-left (Arabic UI):
// the dashboard is the right-most tab. Without this setting the left-most
// (first declared) tab would become the initial one.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  // Hide a tab when the user can't read its doctype (`href: null` removes the tab
  // but keeps the route). Unknown permissions → shown; the server enforces anyway.
  const canReadAid = usePermission('AID', 'read');
  const canReadRecipient = usePermission('Recipient', 'read');
  const canReadWounded = usePermission('Wounded', 'read');
  const canReadMartyrs = usePermission('Martyrs', 'read');
  const canReadPrisoner = usePermission('Prisoner', 'read');

  return (
    <Tabs
      initialRouteName="index"
      // Back from any tab returns to the dashboard (default would be the first
      // declared = left-most tab).
      backBehavior="initialRoute"
      screenOptions={{
        tabBarActiveTintColor: '#FF6F20',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#090E14',
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 20,
        },
        // Six tabs: keep labels on one line on narrow phones.
        tabBarLabelStyle: { fontSize: 10 },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="prisoners"
        options={{
          href: canReadPrisoner ? undefined : null,
          title: 'الأسرى',
          tabBarIcon: ({ color }) => <RecordIcon type="prisoners" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="martyrs"
        options={{
          href: canReadMartyrs ? undefined : null,
          title: 'الشهداء',
          tabBarIcon: ({ color }) => <RecordIcon type="martyrs" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wounded"
        options={{
          href: canReadWounded ? undefined : null,
          title: 'الجرحى',
          tabBarIcon: ({ color }) => <RecordIcon type="wounded" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recipients"
        options={{
          href: canReadRecipient ? undefined : null,
          title: 'المستلمون',
          tabBarIcon: ({ color }) => <RecordIcon type="recipients" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="aids"
        options={{
          href: canReadAid ? undefined : null,
          title: 'الإستفادات',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="hand-coin" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color }) => <TabBarIcon name="stats-chart" color={color} />,
        }}
      />
    </Tabs>
  );
}
