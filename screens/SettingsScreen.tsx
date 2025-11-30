import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Dialog,
  Divider,
  HelperText,
  IconButton,
  List,
  Modal,
  Portal,
  Searchbar,
  SegmentedButtons,
  Switch,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { useAppContext } from '../context/AppContext';
import type { AppTheme } from '../theme/theme';
import type {
  CurrencyOption,
  ThemePreference,
  Account,
  AccountType,
  NotificationPreferences,
} from '../context/AppReducer';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { CURRENCY_LIST, filterCurrencies, formatAmountWithCurrency } from '../utils/currencyUtils';
import {
  cancelDailyReminder,
  scheduleDailyReminder,
  storeDailyReminderPreferences,
  setupNotifications,
} from '../services/notifications';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: string; description: string }> = [
  {
    value: 'system',
    label: 'System',
    icon: 'theme-light-dark',
    description: 'Match your device appearance automatically.',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: 'weather-night',
    description: 'Immerse yourself in the neon lagoon night mode.',
  },
  {
    value: 'light',
    label: 'Light',
    icon: 'white-balance-sunny',
    description: 'Brighten the interface with a soft glow.',
  },
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  credit: 'Credit Card',
  debit: 'Debit Card',
  investment: 'Investment',
  other: 'Other',
};

const buildReminderDateFromPreferences = (preferences: NotificationPreferences) => {
  const date = new Date();
  date.setHours(preferences.dailyReminderHour ?? 20);
  date.setMinutes(preferences.dailyReminderMinute ?? 0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
};

const SettingsScreen = () => {
  const {
    state: { currency, themePreference, accounts, notificationPreferences },
    dispatch,
  } = useAppContext();
  const theme = useTheme<AppTheme>();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();

  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [accountDialogVisible, setAccountDialogVisible] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountErrors, setAccountErrors] = useState<{ name?: string; number?: string }>({});
  const [reminderEnabled, setReminderEnabled] = useState(notificationPreferences.dailyReminderEnabled);
  const [reminderTime, setReminderTime] = useState(() => buildReminderDateFromPreferences(notificationPreferences));
  const [pendingReminderTime, setPendingReminderTime] = useState<Date | null>(null);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const filteredCurrencies = useMemo(() => filterCurrencies(currencyQuery), [currencyQuery]);

  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => a.name.localeCompare(b.name)), [accounts]);

  const formattedReminderTime = useMemo(() => format(reminderTime, 'h:mm a'), [reminderTime]);

  useEffect(() => {
    setReminderEnabled(notificationPreferences.dailyReminderEnabled);
    setReminderTime(buildReminderDateFromPreferences(notificationPreferences));
  }, [notificationPreferences]);

  const handleCurrencySelect = (option: CurrencyOption) => {
    dispatch({ type: 'SET_CURRENCY', payload: option });
    setCurrencyModalVisible(false);
    setCurrencyQuery('');
  };

  const handleThemeChange = (value: ThemePreference | string) => {
    if (value === themePreference) {
      return;
    }
    dispatch({ type: 'SET_THEME_PREFERENCE', payload: value as ThemePreference });
  };

  const resetAccountForm = () => {
    setAccountName('');
    setAccountNumber('');
    setAccountErrors({});
  };

  const openAccountDialog = () => {
    resetAccountForm();
    setAccountDialogVisible(true);
  };

  const closeAccountDialog = () => {
    setAccountDialogVisible(false);
    resetAccountForm();
  };

  const updateReminderPreferences = useCallback(
    async (nextEnabled: boolean, nextDate: Date) => {
      if (isSchedulingReminder) {
        return;
      }

      setIsSchedulingReminder(true);
      setNotificationError(null);

      const hour = nextDate.getHours();
      const minute = nextDate.getMinutes();
      const updatedPreferences: NotificationPreferences = {
        dailyReminderEnabled: nextEnabled,
        dailyReminderHour: hour,
        dailyReminderMinute: minute,
      };

      try {
        if (nextEnabled) {
          const granted = await setupNotifications();
          if (!granted) {
            throw new Error('Notification permission not granted');
          }
          await scheduleDailyReminder({ hour, minute });
        } else if (notificationPreferences.dailyReminderEnabled) {
          await cancelDailyReminder();
        }

        dispatch({ type: 'SET_NOTIFICATION_PREFERENCES', payload: updatedPreferences });
        await storeDailyReminderPreferences({
          enabled: nextEnabled,
          hour,
          minute,
        });

        setReminderEnabled(nextEnabled);
        setReminderTime(buildReminderDateFromPreferences(updatedPreferences));
      } catch (error) {
        console.warn('Failed to update reminder settings', error);
        setNotificationError('Unable to update reminder settings. Check notification permissions.');
        setReminderEnabled(notificationPreferences.dailyReminderEnabled);
        setReminderTime(buildReminderDateFromPreferences(notificationPreferences));
      } finally {
        setIsSchedulingReminder(false);
      }
    },
    [dispatch, isSchedulingReminder, notificationPreferences],
  );

  const validateAccountForm = () => {
    const errors: { name?: string; number?: string } = {};
    const trimmedName = accountName.trim();
    const trimmedNumber = accountNumber.trim();

    if (!trimmedName) {
      errors.name = 'Enter an account name';
    } else if (sortedAccounts.some((account) => account.name.toLowerCase() === trimmedName.toLowerCase())) {
      errors.name = 'An account with this name already exists';
    }

    if (!trimmedNumber) {
      errors.number = 'Enter an account number';
    } else if (
      sortedAccounts.some(
        (account) => account.accountNumber?.toLowerCase() === trimmedNumber.toLowerCase(),
      )
    ) {
      errors.number = 'This account number is already used';
    }

    setAccountErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAccount = () => {
    if (!validateAccountForm()) {
      return;
    }

    const newAccount: Account = {
      id: uuidv4(),
      name: accountName.trim(),
      accountNumber: accountNumber.trim(),
      type: 'cash',
      initialBalance: 0,
      includeInBalance: true,
    };

    dispatch({ type: 'ADD_ACCOUNT', payload: newAccount });
    closeAccountDialog();
  };

  const handleToggleReminder = useCallback(
    (value: boolean) => {
      updateReminderPreferences(value, reminderTime);
    },
    [reminderTime, updateReminderPreferences],
  );

  const openTimePicker = useCallback(() => {
    if (isSchedulingReminder) {
      return;
    }

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: reminderTime,
        mode: 'time',
        is24Hour: true,
        onChange: (_event: DateTimePickerEvent, date?: Date) => {
          if (date) {
            updateReminderPreferences(reminderEnabled, date);
          }
        },
      });
      return;
    }

    setPendingReminderTime(reminderTime);
    setTimePickerVisible(true);
  }, [isSchedulingReminder, reminderEnabled, reminderTime, updateReminderPreferences]);

  const handleIosTimeChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setPendingReminderTime(date);
    }
  }, []);

  const handleConfirmIosTime = useCallback(async () => {
    if (pendingReminderTime) {
      await updateReminderPreferences(reminderEnabled, pendingReminderTime);
    }
    setTimePickerVisible(false);
    setPendingReminderTime(null);
  }, [pendingReminderTime, reminderEnabled, updateReminderPreferences]);

  const handleDismissIosTime = useCallback(() => {
    setTimePickerVisible(false);
    setPendingReminderTime(null);
  }, []);

  const handleOpenAccountManager = () => {
    navigation.navigate('ManageAccounts');
  };

  const previewAmount = 12345.67;
  const previewFormatted = formatAmountWithCurrency(previewAmount, currency);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Currency
          </Text>
          <Text variant="bodyMedium" style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
            Choose how monetary values are displayed throughout the app.
          </Text>
          <Surface style={[styles.currencyPreview, { borderColor: `${theme.colors.primary}33` }]} elevation={1}>
            <View style={styles.previewHeader}>
              <Text variant="labelLarge" style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>
                Preview
              </Text>
              <IconButton icon="refresh" size={20} disabled />
            </View>
            <Text variant="displaySmall" style={[styles.previewValue, { color: theme.colors.primary }]}>
              {previewFormatted}
            </Text>
            <Text variant="bodySmall" style={[styles.previewDescription, { color: theme.colors.onSurfaceVariant }]}>
              Currency updates instantly across all screens.
            </Text>
          </Surface>
          <Button
            mode="contained"
            icon="currency-usd"
            onPress={() => setCurrencyModalVisible(true)}
            style={styles.ctaButton}
          >
            {`${currency.name} (${currency.code})`}
          </Button>
        </Surface>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Notifications
          </Text>
          <Text variant="bodyMedium" style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}
          >
            Stay on track with a daily reminder to log expenses.
          </Text>
          <View style={styles.notificationRow}>
            <View style={styles.notificationTextColumn}>
              <Text variant="labelLarge" style={styles.notificationLabel}>
                Daily reminder
              </Text>
              <Text variant="bodySmall" style={[styles.notificationDescription, { color: theme.colors.onSurfaceVariant }]}
              >
                {`Reminds you at ${formattedReminderTime} every day.`}
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              disabled={isSchedulingReminder}
              accessibilityLabel="Toggle daily reminder"
            />
          </View>
          <Button
            mode="outlined"
            icon="clock-outline"
            onPress={openTimePicker}
            disabled={isSchedulingReminder}
            style={styles.timeButton}
          >
            {`Set time (${formattedReminderTime})`}
          </Button>
          <HelperText type="error" visible={Boolean(notificationError)}>
            {notificationError ?? ''}
          </HelperText>
          {!notificationError && (
            <Text variant="bodySmall" style={[styles.notificationHelpText, { color: theme.colors.onSurfaceVariant }]}
            >
              Reminders repeat daily and can be changed anytime.
            </Text>
          )}
        </Surface>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Appearance
          </Text>
          <Text variant="bodyMedium" style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
            Personalize the neon lagoon vibe to match your environment.
          </Text>
          <SegmentedButtons
            value={themePreference}
            onValueChange={handleThemeChange}
            density="regular"
            style={styles.segmentedButtons}
            buttons={THEME_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
              icon: option.icon,
            }))}
          />
          <View style={styles.themeDescriptions}>
            {THEME_OPTIONS.map((option) => (
              <View key={option.value} style={styles.themeDescriptionRow}>
                <Avatar.Icon
                  icon={option.icon}
                  size={32}
                  color={theme.colors.onSurface}
                  style={{ backgroundColor: `${theme.colors.primary}1A` }}
                />
                <View style={styles.themeDescriptionText}>
                  <Text variant="labelLarge" style={styles.themeDescriptionTitle}>
                    {option.label}
                  </Text>
                  <Text variant="bodySmall" style={[styles.themeDescriptionBody, { color: theme.colors.onSurfaceVariant }]}>
                    {option.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Surface>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={4}>
          <View style={styles.cardHeaderRow}>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Accounts
            </Text>
            <Button mode="text" icon="account-cog" onPress={handleOpenAccountManager}>
              Manage
            </Button>
          </View>
          <Text variant="bodyMedium" style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
            Create and review the accounts you assign to transactions.
          </Text>
          {sortedAccounts.length === 0 ? (
            <Surface style={[styles.accountEmptyState, { borderColor: `${theme.colors.primary}33` }]} elevation={0}>
              <Text variant="bodyMedium" style={[styles.accountEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                No accounts yet. Add your first one to get started.
              </Text>
            </Surface>
          ) : (
            <View style={styles.accountList}>
              {sortedAccounts.map((account) => (
                <View key={account.id} style={styles.accountRow}>
                  <View style={styles.accountRowInfo}>
                    <Text variant="labelLarge" style={styles.accountRowName}>
                      {account.name}
                    </Text>
                    <Text variant="bodySmall" style={[styles.accountRowNumber, { color: theme.colors.onSurfaceVariant }]}>
                      {account.accountNumber || '—'}
                    </Text>
                    {account.includeInBalance ? (
                      <Text
                        variant="bodySmall"
                        style={[styles.accountRowStatus, { color: theme.colors.onSurfaceVariant }]}
                      >
                        Included in balance totals
                      </Text>
                    ) : (
                      <Text variant="bodySmall" style={[styles.accountRowStatus, { color: theme.colors.error }]}
                      >
                        Excluded from balance totals
                      </Text>
                    )}
                  </View>
                  <Text variant="bodySmall" style={[styles.accountRowType, { color: theme.colors.onSurfaceVariant }]}>
                    {ACCOUNT_TYPE_LABELS[account.type]}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Button mode="contained" icon="plus" onPress={openAccountDialog} style={styles.ctaButton}>
            Add account
          </Button>
        </Surface>
      </ScrollView>

      <Portal>
        <Modal
          visible={currencyModalVisible}
          onDismiss={() => setCurrencyModalVisible(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Select Currency
          </Text>
          <Searchbar
            placeholder="Search by name or code"
            value={currencyQuery}
            onChangeText={setCurrencyQuery}
            style={styles.searchBar}
          />
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={Divider}
            renderItem={({ item }) => (
              <List.Item
                title={`${item.name}`}
                description={`${item.code} • ${item.symbol}`}
                onPress={() => handleCurrencySelect(item)}
                right={(props) =>
                  item.code === currency.code ? <List.Icon {...props} icon="check" color={theme.colors.primary} /> : null
                }
              />
            )}
            ListEmptyComponent={
              <Text variant="bodyMedium" style={[styles.emptyState, { color: theme.colors.onSurfaceVariant }]}>
                No currencies found.
              </Text>
            }
            style={styles.currencyList}
          />
          <Button mode="text" onPress={() => setCurrencyModalVisible(false)}>
            Close
          </Button>
        </Modal>
        <Dialog visible={timePickerVisible && Platform.OS !== 'android'} onDismiss={handleDismissIosTime}>
          <Dialog.Title>Select reminder time</Dialog.Title>
          <Dialog.Content>
            <DateTimePicker
              value={pendingReminderTime ?? reminderTime}
              mode="time"
              display="spinner"
              onChange={handleIosTimeChange}
              style={styles.timePicker}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDismissIosTime}>Cancel</Button>
            <Button onPress={handleConfirmIosTime} disabled={!pendingReminderTime && !reminderEnabled}>
              Set time
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={accountDialogVisible} onDismiss={closeAccountDialog}>
          <Dialog.Title>New account</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Account name"
              value={accountName}
              onChangeText={setAccountName}
              style={styles.textInput}
              outlineStyle={styles.textInputOutline}
            />
            <HelperText type="error" visible={Boolean(accountErrors.name)}>
              {accountErrors.name}
            </HelperText>
            <TextInput
              mode="outlined"
              label="Account number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              style={styles.textInput}
              outlineStyle={styles.textInputOutline}
              left={<TextInput.Icon icon="clipboard-text" />}
            />
            <HelperText type="error" visible={Boolean(accountErrors.number)}>
              {accountErrors.number}
            </HelperText>
            <Text variant="bodySmall" style={[styles.accountDialogHint, { color: theme.colors.onSurfaceVariant }]}>
              Accounts created here default to the Cash type with a starting balance of 0. You can fine-tune details in
              the manager.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeAccountDialog}>Cancel</Button>
            <Button mode="contained" onPress={handleCreateAccount}>
              Save account
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  cardTitle: {
    fontWeight: '600',
  },
  cardDescription: {
    lineHeight: 20,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
    gap: 16,
  },
  notificationTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  notificationLabel: {
    fontWeight: '600',
  },
  notificationDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  timeButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  notificationHelpText: {
    marginTop: 4,
    lineHeight: 18,
  },
  timePicker: {
    alignSelf: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyPreview: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    gap: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
  },
  previewValue: {
    fontWeight: '700',
  },
  previewDescription: {
    opacity: 0.75,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
  },
  segmentedButtons: {
    marginTop: 4,
  },
  themeDescriptions: {
    marginTop: 12,
    gap: 12,
  },
  themeDescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeDescriptionText: {
    flex: 1,
    gap: 2,
  },
  themeDescriptionTitle: {
    fontWeight: '600',
  },
  themeDescriptionBody: {
    lineHeight: 18,
  },
  accountEmptyState: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  accountEmptyText: {
    textAlign: 'center',
  },
  accountList: {
    marginTop: 8,
    gap: 12,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFFFFF1F',
  },
  accountRowInfo: {
    flex: 1,
  },
  accountRowName: {
    fontWeight: '600',
  },
  accountRowNumber: {
    marginTop: 2,
    letterSpacing: 0.4,
  },
  accountRowStatus: {
    marginTop: 2,
  },
  accountRowType: {
    marginLeft: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textInput: {
    marginTop: 8,
  },
  textInputOutline: {
    borderRadius: 14,
  },
  accountDialogHint: {
    marginTop: 12,
    lineHeight: 18,
  },
  modalContainer: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  searchBar: {
    marginBottom: 12,
    borderRadius: 16,
  },
  currencyList: {
    maxHeight: 360,
    marginBottom: 12,
  },
  emptyState: {
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default SettingsScreen;
