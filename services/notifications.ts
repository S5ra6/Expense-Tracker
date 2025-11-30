import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handling globally so alerts display when received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const DAILY_REMINDER_PREFS_KEY = 'notifications_daily_reminder_preferences_v1';
export const BUDGET_ALERT_PREFIX = 'notifications_budget_alert_sent_';

export type ReminderTime = {
  hour: number;
  minute: number;
};

export type DailyReminderPreferences = ReminderTime & {
  enabled: boolean;
};

export const DEFAULT_REMINDER_PREFERENCES: DailyReminderPreferences = {
  enabled: false,
  hour: 20,
  minute: 0,
};

export async function setupNotifications(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const permissionResult = await Notifications.requestPermissionsAsync();
    finalStatus = permissionResult.status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleDailyReminder(time: ReminderTime): Promise<void> {
  await cancelDailyReminder();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Log Your Expenses!',
      body: "Don't forget to track your spending for today.",
    },
    trigger: {
      hour: time.hour,
      minute: time.minute,
      repeats: true,
    },
  });
}

export async function storeDailyReminderPreferences(preferences: DailyReminderPreferences): Promise<void> {
  await AsyncStorage.setItem(DAILY_REMINDER_PREFS_KEY, JSON.stringify(preferences));
}

export async function loadDailyReminderPreferences(): Promise<DailyReminderPreferences> {
  try {
    const result = await AsyncStorage.getItem(DAILY_REMINDER_PREFS_KEY);
    if (!result) {
      return DEFAULT_REMINDER_PREFERENCES;
    }
    const parsed = JSON.parse(result) as Partial<DailyReminderPreferences>;
    return {
      ...DEFAULT_REMINDER_PREFERENCES,
      ...parsed,
    };
  } catch (error) {
    console.warn('Failed to load reminder preferences', error);
    return DEFAULT_REMINDER_PREFERENCES;
  }
}

export const buildBudgetAlertKey = (categoryId: string, monthKey: string) =>
  `${BUDGET_ALERT_PREFIX}${categoryId}_${monthKey}`;

export async function hasBudgetAlertBeenSent(key: string): Promise<boolean> {
  const flag = await AsyncStorage.getItem(key);
  return flag === 'true';
}

export async function markBudgetAlertSent(key: string): Promise<void> {
  await AsyncStorage.setItem(key, 'true');
}

export async function sendBudgetAlertNotification(categoryName: string, percentUsed: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Budget Alert',
      body: `You have used ${Math.round(percentUsed * 100)}% of your budget for ${categoryName} this month.`,
    },
    trigger: null,
  });
}
