import React from 'react';
import {
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../contexts/AuthContext';
import { AgentProvider } from '../contexts/AgentContext';
import { CallProvider } from '../contexts/CallContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DialerScreen } from '../screens/DialerScreen';
import { CallLogScreen } from '../screens/CallLogScreen';
import { ExtensionsScreen } from '../screens/ExtensionsScreen';

const COLORS = {
  bg:       '#0a1628',
  card:     '#142b49',
  accent:   '#ba5663',
  inactive: '#525252',
  border:   '#2a3f5f',
  text:     '#d0d0d0',
};

const Tab = createBottomTabNavigator();

function MainTabs() {
  const { logout } = useAuth();

  const confirmLogout = () =>
    Alert.alert('Sign out', 'Sign out of Lorikeet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, string> = {
              Dialer:     'dialpad',
              Calls:      'phone-log',
              Extensions: 'headset',
            };
            return <Icon name={icons[route.name] ?? 'circle'} size={size} color={color} />;
          },
          tabBarActiveTintColor:   COLORS.accent,
          tabBarInactiveTintColor: COLORS.inactive,
          tabBarStyle: {
            backgroundColor: COLORS.card,
            borderTopColor:  COLORS.border,
          },
          headerStyle:      { backgroundColor: COLORS.card },
          headerTintColor:  COLORS.text,
          headerTitleStyle: { color: COLORS.text, fontWeight: '700' },
          headerRight: route.name === 'Extensions'
            ? () => (
                <TouchableOpacity
                  onPress={confirmLogout}
                  accessibilityLabel="Sign out"
                  style={{ marginRight: 16 }}>
                  <Icon name="logout" size={20} color={COLORS.text} />
                </TouchableOpacity>
              )
            : undefined,
        })}>
        <Tab.Screen name="Dialer"     component={DialerScreen} />
        <Tab.Screen name="Calls"      component={CallLogScreen} />
        <Tab.Screen name="Extensions" component={ExtensionsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <AgentProvider>
      <CallProvider>
        <MainTabs />
      </CallProvider>
    </AgentProvider>
  );
}
