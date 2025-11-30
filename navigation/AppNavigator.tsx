import React from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import SummaryScreen from '../screens/SummaryScreen';
import CalendarScreen from '../screens/CalendarScreen';
import BudgetScreen from '../screens/BudgetScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ManageAccountsScreen from '../screens/ManageAccountsScreen';
import type { AppTheme } from '../theme/theme';
import type { TransactionType } from '../context/AppReducer';

export type HomeStackParamList = {
  Home: undefined;
  AddTransaction:
    | {
        transactionId?: string;
        initialType?: TransactionType;
        initialCategoryId?: string;
        initialAccountId?: string;
      }
    | undefined;
};

export type SummaryStackParamList = {
  Summary: undefined;
  Calendar: undefined;
};

export type BudgetStackParamList = {
  Budget: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
  ManageAccounts: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  SummaryTab: undefined;
  BudgetTab: undefined;
  SettingsTab: undefined;
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SummaryStack = createNativeStackNavigator<SummaryStackParamList>();
const BudgetStack = createNativeStackNavigator<BudgetStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const HomeStackNavigator = () => {
  const theme = useTheme<AppTheme>();

  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: theme.fonts.titleMedium.fontFamily },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ title: 'Transactions' }} />
      <HomeStack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ title: 'Manage Transaction' }}
      />
    </HomeStack.Navigator>
  );
};

const SummaryStackNavigator = () => {
  const theme = useTheme<AppTheme>();

  return (
    <SummaryStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: theme.fonts.titleMedium.fontFamily },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <SummaryStack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Summary' }} />
      <SummaryStack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar View' }} />
    </SummaryStack.Navigator>
  );
};

const BudgetStackNavigator = () => {
  const theme = useTheme<AppTheme>();

  return (
    <BudgetStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: theme.fonts.titleMedium.fontFamily },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <BudgetStack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Budgets' }} />
    </BudgetStack.Navigator>
  );
};

const SettingsStackNavigator = () => {
  const theme = useTheme<AppTheme>();

  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: theme.fonts.titleMedium.fontFamily },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <SettingsStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <SettingsStack.Screen
        name="ManageAccounts"
        component={ManageAccountsScreen}
        options={{ title: 'Manage Accounts' }}
      />
    </SettingsStack.Navigator>
  );
};

const AppTabs = () => {
  const theme = useTheme<AppTheme>();

  const tabScreenOptions = ({
    route,
  }: {
    route: RouteProp<TabParamList, keyof TabParamList>;
  }): BottomTabNavigationOptions => ({
    headerShown: false,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.outlineVariant,
      borderTopWidth: 1,
      height: 64,
      paddingBottom: 8,
      paddingTop: 8,
    },
    tabBarLabelStyle: {
      fontFamily: theme.fonts.labelMedium.fontFamily,
      fontSize: 12,
    },
    tabBarIcon: ({ color, size }: { color: string; size: number }) => {
      let iconName: keyof typeof MaterialCommunityIcons.glyphMap = 'home';

      if (route.name === 'HomeTab') {
        iconName = 'home-variant';
      } else if (route.name === 'SummaryTab') {
        iconName = 'chart-donut';
      } else if (route.name === 'BudgetTab') {
        iconName = 'wallet';
      } else if (route.name === 'SettingsTab') {
        iconName = 'cog-outline';
      }

      return <MaterialCommunityIcons name={iconName} color={color} size={size} />;
    },
  });

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="SummaryTab"
        component={SummaryStackNavigator}
        options={{ title: 'Summary' }}
      />
      <Tab.Screen
        name="BudgetTab"
        component={BudgetStackNavigator}
        options={{ title: 'Budgets' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const theme = useTheme<AppTheme>();

  const navigationTheme = {
    ...NavigationDefaultTheme,
    colors: {
      ...NavigationDefaultTheme.colors,
      background: theme.colors.background,
      primary: theme.colors.primary,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.outlineVariant,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppTabs />
    </NavigationContainer>
  );
};

export default AppNavigator;
