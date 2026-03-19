import { Tabs } from 'expo-router';

import { TabBarIcon } from '../../components/TabBarIcon';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF6F20',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#090E14',
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 20,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'الإستفادات',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="hand-coin" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipients"
        options={{
          title: 'المستلمون',
          tabBarIcon: ({ color }) => <TabBarIcon name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'الملف الشخصي',
          tabBarIcon: ({ color }) => <TabBarIcon name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
