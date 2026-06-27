import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { DialerScreen } from '../screens/DialerScreen';
import { CallLogScreen } from '../screens/CallLogScreen';
import { ExtensionsScreen } from '../screens/ExtensionsScreen';

const COLORS = {
  bg: '#0a1628',
  card: '#142b49',
  accent: '#ba5663',
  inactive: '#525252',
  border: '#2a3f5f',
  text: '#d0d0d0',
};

// ── Bottom tabs ───────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, string> = {
              Dialer: 'dialpad',
              Calls: 'phone-log',
              Extensions: 'headset',
            };
            return <Icon name={icons[route.name] ?? 'circle'} size={size} color={color} />;
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.inactive,
          tabBarStyle: {
            backgroundColor: COLORS.card,
            borderTopColor: COLORS.border,
          },
          headerStyle: { backgroundColor: COLORS.card },
          headerTintColor: COLORS.text,
          headerTitleStyle: { color: COLORS.text, fontWeight: '700' },
        })}>
        <Tab.Screen name="Dialer" component={DialerScreen} />
        <Tab.Screen name="Calls" component={CallLogScreen} />
        <Tab.Screen name="Extensions" component={ExtensionsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
