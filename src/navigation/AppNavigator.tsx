import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { DialerScreen } from '../screens/DialerScreen';
import { CallLogScreen } from '../screens/CallLogScreen';
import { ExtensionsScreen } from '../screens/ExtensionsScreen';
import { LeadsScreen } from '../screens/LeadsScreen';
import { SMSScreen } from '../screens/SMSScreen';
import { SMSThreadScreen } from '../screens/SMSThreadScreen';

const COLORS = {
  bg: '#0a1628',
  card: '#142b49',
  accent: '#ba5663',
  inactive: '#525252',
  border: '#2a3f5f',
  text: '#d0d0d0',
};

// ── SMS stack ─────────────────────────────────────────────────────────────

export type SmsStackParams = {
  SMSList: undefined;
  SMSThread: { number: string; contactName?: string };
};

const SmsStack = createNativeStackNavigator<SmsStackParams>();

function SmsStackNavigator() {
  return (
    <SmsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.text,
        headerTitleStyle: { color: COLORS.text, fontWeight: '700' },
      }}>
      <SmsStack.Screen name="SMSList" component={SMSScreen} options={{ title: 'Messages' }} />
      <SmsStack.Screen
        name="SMSThread"
        component={SMSThreadScreen}
        options={({ route }) => ({
          title: route.params.contactName ?? route.params.number,
        })}
      />
    </SmsStack.Navigator>
  );
}

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
              Leads: 'fire',
              Messages: 'message-text',
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
        <Tab.Screen name="Leads" component={LeadsScreen} />
        <Tab.Screen name="Messages" component={SmsStackNavigator} options={{ headerShown: false }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
