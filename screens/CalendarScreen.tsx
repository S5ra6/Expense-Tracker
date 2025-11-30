import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { Card, Divider, Text, useTheme } from 'react-native-paper';

import { useAppContext } from '../context/AppContext';
import type { Transaction, Category } from '../context/AppReducer';
import type { AppTheme } from '../theme/theme';
import { useFormatCurrency } from '../utils/currencyUtils';

type CalendarMarkedDate = {
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
  marked?: boolean;
  dotColor?: string;
  disabled?: boolean;
  disableTouchEvent?: boolean;
};

type CalendarMarkedDates = Record<string, CalendarMarkedDate>;

type CalendarDateObject = {
  dateString: string;
  day: number;
  month: number;
  year: number;
  timestamp: number;
};

const CalendarScreen = () => {
  const {
    state: { transactions, categories },
  } = useAppContext();
  const theme = useTheme<AppTheme>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const formatCurrency = useFormatCurrency();

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const markedDates = useMemo<CalendarMarkedDates>(() => {
    const marks: CalendarMarkedDates = {};

    transactions.forEach((transaction: Transaction) => {
      if (!transaction.date) {
        return;
      }

      const parsed = new Date(transaction.date);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }

      const key = format(parsed, 'yyyy-MM-dd');
      marks[key] = { marked: true, dotColor: theme.colors.primary };
    });

    return marks;
  }, [transactions, theme.colors.primary]);

  const highlightedDates = useMemo<CalendarMarkedDates>(() => {
    if (!selectedDate) {
      return markedDates;
    }

    return {
      ...markedDates,
      [selectedDate]: {
        ...markedDates[selectedDate],
        selected: true,
        selectedColor: theme.colors.primary,
        selectedTextColor: theme.colors.onPrimary ?? '#00151F',
        marked: markedDates[selectedDate]?.marked ?? false,
        dotColor: markedDates[selectedDate]?.dotColor ?? theme.colors.primary,
      },
    };
  }, [markedDates, selectedDate, theme.colors.onPrimary, theme.colors.primary]);

  const dailyTransactions = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return transactions.filter((transaction: Transaction) => {
      if (!transaction.date) {
        return false;
      }

      const parsed = new Date(transaction.date);
      if (Number.isNaN(parsed.getTime())) {
        return false;
      }

      return format(parsed, 'yyyy-MM-dd') === selectedDate;
    });
  }, [selectedDate, transactions]);

  const totalForDay = useMemo(() => dailyTransactions.reduce((acc, transaction) => acc + transaction.amount, 0), [dailyTransactions]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) {
      return null;
    }

    return format(new Date(selectedDate), 'PPP');
  }, [selectedDate]);

  const gradientColors = theme.custom?.gradientBackground ?? [theme.colors.background, theme.colors.background];

  const calendarTheme = useMemo(
    () => ({
      backgroundColor: theme.colors.background,
      calendarBackground: theme.colors.background,
      textSectionTitleColor: '#A8B2D1',
      monthTextColor: theme.colors.onSurface,
      dayTextColor: theme.colors.onSurface,
      todayTextColor: theme.colors.primary,
      selectedDayBackgroundColor: theme.colors.primary,
      selectedDayTextColor: theme.colors.onPrimary ?? '#00151F',
      arrowColor: theme.colors.primary,
      dotColor: theme.colors.primary,
      textDisabledColor: '#555',
      agendaDayTextColor: theme.colors.onSurface,
      agendaDayNumColor: theme.colors.onSurface,
      agendaTodayColor: theme.colors.primary,
      agendaKnobColor: theme.colors.primary,
      'stylesheet.calendar.header': {
        week: {
          marginTop: 5,
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
      },
    }),
    [theme],
  );

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <View style={styles.content}>
        <Text variant="titleLarge" style={[styles.heading, { color: theme.colors.onSurface }]}>
          Expense Activity
        </Text>
        <Text variant="bodyMedium" style={[styles.subheading, { color: theme.colors.onSurfaceVariant }]}>
          Neon dots mark days where you logged transactions.
        </Text>
        <Calendar
          style={styles.calendar}
          markedDates={highlightedDates}
          theme={calendarTheme}
          enableSwipeMonths
          onDayPress={(day: CalendarDateObject) => setSelectedDate(day.dateString)}
        />
        <Card style={[styles.detailCard, { backgroundColor: theme.colors.surface }]} mode="contained">
          <Card.Content>
            {selectedDate && (
              <View style={styles.detailHeader}>
                <Text variant="titleMedium" style={[styles.detailHeading, { color: theme.colors.onSurface }]}>
                  {selectedDateLabel}
                </Text>
                <Text
                  variant="titleMedium"
                  style={[styles.detailTotal, { color: totalForDay >= 0 ? theme.colors.primary : theme.colors.error }]}
                >
                  {formatCurrency(totalForDay)}
                </Text>
              </View>
            )}
            {!selectedDate && (
              <Text variant="bodyMedium" style={[styles.emptyState, { color: theme.colors.onSurfaceVariant }]}>
                Tap a neon-dotted date to review your expenses.
              </Text>
            )}
            {selectedDate && dailyTransactions.length === 0 && (
              <Text variant="bodyMedium" style={[styles.emptyState, { color: theme.colors.onSurfaceVariant }]}>
                No expenses logged for this day yet.
              </Text>
            )}
            {dailyTransactions.map((transaction, index) => {
              const amountColor = transaction.amount >= 0 ? theme.colors.primary : theme.colors.error;
              const isLast = index === dailyTransactions.length - 1;
              const categoryName = transaction.categoryId
                ? categoryMap.get(transaction.categoryId)?.name ?? 'Uncategorized'
                : 'Uncategorized';

              return (
                <View key={transaction.id}>
                  <View style={styles.transactionRow}>
                    <View style={styles.transactionTextGroup}>
                      <Text variant="titleMedium" style={[styles.transactionTitle, { color: theme.colors.onSurface }]}>
                        {transaction.title}
                      </Text>
                      <Text variant="bodySmall" style={[styles.transactionCategory, { color: theme.colors.onSurfaceVariant }]}>
                        {categoryName}
                      </Text>
                    </View>
                    <Text variant="titleMedium" style={[styles.transactionAmount, { color: amountColor }]}>
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                  {!isLast && <Divider style={[styles.divider, { backgroundColor: `${theme.colors.onSurface}22` }]} />}
                </View>
              );
            })}
          </Card.Content>
        </Card>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  heading: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subheading: {
    textAlign: 'center',
    marginBottom: 24,
  },
  calendar: {
    borderRadius: 16,
    elevation: 4,
    paddingBottom: 12,
  },
  detailCard: {
    marginTop: 24,
    borderRadius: 18,
    elevation: 6,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailHeading: {
    flex: 1,
  },
  detailTotal: {
    marginLeft: 12,
  },
  emptyState: {
    textAlign: 'center',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  transactionTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  transactionTitle: {
    marginBottom: 4,
  },
  transactionCategory: {
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  transactionAmount: {
    minWidth: 80,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});

export default CalendarScreen;
