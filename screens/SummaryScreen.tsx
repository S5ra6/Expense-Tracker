import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Divider, IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { format, subMonths } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppContext } from '../context/AppContext';
import type { Transaction, Category, Budget } from '../context/AppReducer';
import { DEFAULT_CATEGORY_ID } from '../context/AppReducer';
import type { AppTheme } from '../theme/theme';
import type { SummaryStackParamList } from '../navigation/AppNavigator';
import { useFormatCurrency } from '../utils/currencyUtils';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized.slice(0, 6);
  const int = parseInt(expanded, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const blendHex = (hex: string, target: string, weight: number) => {
  const ratio = clamp01(weight);
  const sourceRgb = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  const mixChannel = (channel: number, targetChannel: number) => channel + (targetChannel - channel) * ratio;
  return rgbToHex(
    mixChannel(sourceRgb.r, targetRgb.r),
    mixChannel(sourceRgb.g, targetRgb.g),
    mixChannel(sourceRgb.b, targetRgb.b),
  );
};

const lightenHex = (hex: string, amount: number) => blendHex(hex, '#ffffff', amount);
const darkenHex = (hex: string, amount: number) => blendHex(hex, '#000000', amount);

const toRgba = (hex: string, opacity: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(opacity)})`;
};

const MONTHS_TO_SHOW = 6;

const SummaryScreen = () => {
  const {
    state: { transactions, categories, dateFilter, budgets, currency },
  } = useAppContext();
  const theme = useTheme<AppTheme>();
  const navigation = useNavigation<NativeStackNavigationProp<SummaryStackParamList>>();
  const formatCurrency = useFormatCurrency();

  const categoryPalette = useMemo(() => {
    const primary = theme.colors.primary;
    const secondary = theme.colors.secondary;
    const tertiary = theme.colors.tertiary;
    const success = theme.custom?.success ?? '#5CFAC7';
    const warning = theme.custom?.warning ?? '#FFC857';
    const glow = theme.custom?.glow ?? lightenHex(primary, 0.3);

    return [
      primary,
      lightenHex(primary, 0.25),
      darkenHex(primary, 0.18),
      secondary,
      lightenHex(secondary, 0.2),
      tertiary,
      lightenHex(tertiary, 0.3),
      success,
      darkenHex(success, 0.18),
      warning,
      lightenHex(warning, 0.2),
      glow,
    ];
  }, [theme]);

  const resolveCategoryColor = useCallback(
    (categoryId: string) => {
      if (!categoryId) {
        return categoryPalette[0];
      }
      const hash = categoryId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return categoryPalette[hash % categoryPalette.length];
    },
    [categoryPalette],
  );

  const { categoryMap, fallbackCategoryId } = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });

    const fallbackId = map.has(DEFAULT_CATEGORY_ID)
      ? DEFAULT_CATEGORY_ID
      : categories[0]?.id ?? DEFAULT_CATEGORY_ID;

    return {
      categoryMap: map,
      fallbackCategoryId: fallbackId,
    };
  }, [categories]);

  const rangeStart = dateFilter?.startDate ? new Date(dateFilter.startDate) : null;
  const rangeEnd = dateFilter?.endDate ? new Date(dateFilter.endDate) : null;
  const hasValidRange =
    rangeStart !== null &&
    rangeEnd !== null &&
    !Number.isNaN(rangeStart.getTime()) &&
    !Number.isNaN(rangeEnd.getTime());

  const rangeLabel = hasValidRange && rangeStart && rangeEnd
    ? rangeStart.getMonth() === rangeEnd.getMonth() && rangeStart.getFullYear() === rangeEnd.getFullYear()
      ? format(rangeStart, 'MMMM yyyy')
      : `${format(rangeStart, 'MMM d, yyyy')} – ${format(rangeEnd, 'MMM d, yyyy')}`
    : format(new Date(), 'MMMM yyyy');

  const rangeDescription = hasValidRange && rangeStart && rangeEnd
    ? `Showing income and expenses between ${format(rangeStart, 'MMM d, yyyy')} and ${format(rangeEnd, 'MMM d, yyyy')}.`
    : 'Showing the latest recorded income and expenses.';

  const isSingleMonthRange =
    hasValidRange &&
    rangeStart &&
    rangeEnd &&
    rangeStart.getMonth() === rangeEnd.getMonth() &&
    rangeStart.getFullYear() === rangeEnd.getFullYear();

  const activeBudgetMonthKey = isSingleMonthRange && rangeStart
    ? format(rangeStart, 'yyyy-MM')
    : format(new Date(), 'yyyy-MM');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="calendar-month"
          iconColor={theme.colors.primary}
          onPress={() => navigation.navigate('Calendar')}
          accessibilityLabel="Open calendar view"
        />
      ),
    });
  }, [navigation, theme.colors.primary]);

  const filteredTransactions = useMemo(() => {
    if (!hasValidRange || !rangeStart || !rangeEnd) {
      return transactions;
    }

    return transactions.filter((transaction: Transaction) => {
      const transactionDate = new Date(transaction.date);
      if (Number.isNaN(transactionDate.getTime())) {
        return false;
      }

      return transactionDate >= rangeStart && transactionDate <= rangeEnd;
    });
  }, [transactions, hasValidRange, rangeStart, rangeEnd]);

  const { totalIncome, totalExpenses, netBalance, expensesByCategory, expenseCounts } = useMemo(() => {
    const totals = {
      totalIncome: 0,
      totalExpenses: 0,
      expensesByCategory: {} as Record<string, number>,
      expenseCounts: {} as Record<string, number>,
    };

    categories.forEach((category) => {
      totals.expensesByCategory[category.id] = 0;
      totals.expenseCounts[category.id] = 0;
    });

    filteredTransactions.forEach((transaction) => {
      if (transaction.type === 'income') {
        totals.totalIncome += transaction.amount;
        return;
      }

      totals.totalExpenses += transaction.amount;

      const resolvedId =
        transaction.categoryId && categoryMap.has(transaction.categoryId)
          ? transaction.categoryId
          : fallbackCategoryId;

      totals.expensesByCategory[resolvedId] = (totals.expensesByCategory[resolvedId] ?? 0) + transaction.amount;
      totals.expenseCounts[resolvedId] = (totals.expenseCounts[resolvedId] ?? 0) + 1;
    });

    return {
      ...totals,
      netBalance: totals.totalIncome - totals.totalExpenses,
    };
  }, [filteredTransactions, categories, categoryMap, fallbackCategoryId]);

  const budgetSummaries = useMemo(() => {
    const monthBudgets = budgets.filter((budget) => budget.month === activeBudgetMonthKey);

    const summaryMap = new Map<string, {
      budget: Budget;
      spent: number;
      remaining: number;
      progress: number;
    }>();

    monthBudgets.forEach((budget) => {
      const [year, monthStr] = budget.month.split('-');
      const budgetYear = Number(year);
      const budgetMonthIndex = Number(monthStr) - 1;

      const spent = transactions.reduce((total, transaction) => {
        if (transaction.type !== 'expense') {
          return total;
        }
        if (transaction.categoryId !== budget.categoryId) {
          return total;
        }
        const transactionDate = new Date(transaction.date);
        if (
          Number.isNaN(transactionDate.getTime()) ||
          transactionDate.getFullYear() !== budgetYear ||
          transactionDate.getMonth() !== budgetMonthIndex
        ) {
          return total;
        }
        return total + transaction.amount;
      }, 0);

      const remaining = Math.max(0, budget.amount - spent);
      const progress = budget.amount === 0 ? 0 : Math.min(1, spent / budget.amount);

      summaryMap.set(budget.categoryId, {
        budget,
        spent,
        remaining,
        progress,
      });
    });

    return summaryMap;
  }, [activeBudgetMonthKey, budgets, transactions]);

  const gradientColors = theme.custom?.gradientBackground ?? [theme.colors.background, theme.colors.background];
  const cardBackground = theme.colors.surface;
  const expenseValues = Object.values(expensesByCategory);
  const maxCategorySpend = Math.max(1, ...expenseValues);
  const hasExpenseData = expenseValues.some((value) => value > 0);

  const incomeColor = theme.custom?.success ?? '#5CFAC7';
  const expenseColor = theme.colors.error;
  const balanceColor = netBalance >= 0 ? incomeColor : expenseColor;

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 40, 420);

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: theme.colors.surface,
      backgroundGradientFromOpacity: 0.85,
      backgroundGradientTo: theme.colors.surfaceVariant,
      backgroundGradientToOpacity: 0.4,
      decimalPlaces: 0,
      color: (opacity: number = 1) => toRgba(theme.colors.primary, opacity),
      labelColor: (opacity: number = 1) => toRgba(theme.colors.onSurface, opacity),
      propsForLabels: {
        fontFamily: theme.fonts.labelMedium.fontFamily,
      },
      propsForBackgroundLines: {
        stroke: toRgba(theme.colors.outlineVariant ?? theme.colors.outline, 0.35),
        strokeDasharray: '6 10',
      },
      fillShadowGradientFrom: toRgba(theme.colors.primary, 0.75),
      fillShadowGradientFromOpacity: 1,
      fillShadowGradientTo: toRgba(theme.colors.primary, 0.15),
      fillShadowGradientToOpacity: 1,
      barPercentage: 0.55,
    }),
    [theme],
  );

  const pieChartData = useMemo(() => {
    return categories
      .map((category) => {
        const value = expensesByCategory[category.id] ?? 0;
        if (value <= 0) {
          return null;
        }
        const color = resolveCategoryColor(category.id);
        return {
          name: category.name,
          population: value,
          color,
          legendFontColor: theme.colors.onSurface,
          legendFontSize: 13,
        };
      })
      .filter(Boolean) as Array<{
        name: string;
        population: number;
        color: string;
        legendFontColor: string;
        legendFontSize: number;
      }>;
  }, [categories, expensesByCategory, resolveCategoryColor, theme.colors.onSurface]);

  const barChartData = useMemo(() => {
    const labels: string[] = [];
    const monthKeys: string[] = [];
    const referenceDate = new Date();

    for (let i = MONTHS_TO_SHOW - 1; i >= 0; i -= 1) {
      const monthDate = subMonths(referenceDate, i);
      const key = format(monthDate, 'yyyy-MM');
      monthKeys.push(key);
      labels.push(format(monthDate, "MMM ''yy"));
    }

    const totalsByMonth: Record<string, number> = monthKeys.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<string, number>);

    transactions.forEach((transaction) => {
      if (transaction.type !== 'expense') {
        return;
      }
      const date = new Date(transaction.date);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const key = format(date, 'yyyy-MM');
      if (key in totalsByMonth) {
        totalsByMonth[key] += transaction.amount;
      }
    });

    const dataPoints = monthKeys.map((key) => totalsByMonth[key] ?? 0);
    const datasetColors = monthKeys.map((_, index) => {
      const shade = MONTHS_TO_SHOW > 1 ? index / (MONTHS_TO_SHOW - 1) : 0;
      const tone = lightenHex(theme.colors.secondary, 0.12 + shade * 0.3);
      return (_opacity = 1) => toRgba(tone, 0.9);
    });

    return {
      labels,
      datasets: [
        {
          data: dataPoints,
          colors: datasetColors,
        },
      ],
    };
  }, [transactions, theme]);

  const hasPieData = pieChartData.length > 0;
  const hasBarData = barChartData.datasets[0]?.data.some((value) => value > 0) ?? false;

  const formattedIncome = `${totalIncome >= 0 ? '+' : '-'}${formatCurrency(Math.abs(totalIncome))}`;
  const formattedExpenses = `-${formatCurrency(totalExpenses)}`;
  const formattedBalance = `${netBalance >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netBalance))}`;

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card style={[styles.heroCard, { backgroundColor: cardBackground }]}
          elevation={4}
        >
          <Card.Content>
            <View style={styles.heroHeader}>
              <View>
                <Text variant="titleMedium" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {rangeLabel}
                </Text>
                <Text variant="headlineMedium" style={[styles.heroTotal, { color: balanceColor }]}>
                  {formattedBalance}
                </Text>
              </View>
              <View style={[styles.totalPill, { backgroundColor: `${theme.colors.primary}1A`, borderColor: theme.colors.primary }]}>
                <Text variant="labelLarge" style={[styles.pillLabel, { color: theme.colors.primary }]}>Filtered</Text>
              </View>
            </View>
            <Text variant="bodyMedium" style={[styles.heroDescription, { color: theme.colors.onSurfaceVariant }]}>
              {rangeDescription}
            </Text>
            <View style={styles.heroMetricsRow}>
              <View style={[styles.heroMetric, { backgroundColor: `${incomeColor}1A` }]}>
                <Text variant="labelLarge" style={[styles.metricLabel, { color: incomeColor }]}>Income</Text>
                <Text variant="titleLarge" style={[styles.metricValue, { color: incomeColor }]}>
                  {formattedIncome}
                </Text>
              </View>
              <View style={[styles.heroMetric, styles.heroMetricTrailing, { backgroundColor: `${expenseColor}1A` }]}>
                <Text variant="labelLarge" style={[styles.metricLabel, { color: expenseColor }]}>Expenses</Text>
                <Text variant="titleLarge" style={[styles.metricValue, { color: expenseColor }]}>
                  {formattedExpenses}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: cardBackground }]}
          elevation={2}
        >
          <Card.Title
            title="Spending Breakdown"
            subtitle="Visualize category share"
            titleStyle={styles.sectionTitle}
            subtitleStyle={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}
          />
          <Card.Content>
            {hasPieData ? (
              <View
                style={[
                  styles.chartWrapper,
                  {
                    backgroundColor: toRgba(theme.colors.surfaceVariant, 0.35),
                    borderColor: toRgba(theme.colors.outline, 0.22),
                    shadowColor: toRgba(theme.colors.primary, 0.45),
                  },
                ]}
              >
                <PieChart
                  data={pieChartData}
                  width={chartWidth}
                  height={220}
                  accessor="population"
                  backgroundColor="transparent"
                  chartConfig={chartConfig}
                  paddingLeft="0"
                  hasLegend
                />
              </View>
            ) : (
              <Text variant="bodyMedium" style={[styles.chartPlaceholder, { color: theme.colors.onSurfaceVariant }]}>
                Start adding expenses to see a category breakdown chart.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: cardBackground }]}
          elevation={2}
        >
          <Card.Title
            title="Spending Trends"
            subtitle="Last six months"
            titleStyle={styles.sectionTitle}
            subtitleStyle={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}
          />
          <Card.Content>
            {hasBarData ? (
              <View
                style={[
                  styles.chartWrapper,
                  {
                    backgroundColor: toRgba(theme.colors.surfaceVariant, 0.35),
                    borderColor: toRgba(theme.colors.outline, 0.22),
                    shadowColor: toRgba(theme.colors.secondary, 0.4),
                  },
                ]}
              >
                <BarChart
                  data={barChartData}
                  width={chartWidth}
                  height={240}
                  chartConfig={chartConfig}
                  verticalLabelRotation={0}
                  style={styles.barChart}
                  withInnerLines={false}
                  fromZero
                  showBarTops
                  withCustomBarColorFromData
                  flatColor
                  yAxisLabel={`${currency.symbol ?? ''} `}
                  yAxisSuffix=""
                />
              </View>
            ) : (
              <Text variant="bodyMedium" style={[styles.chartPlaceholder, { color: theme.colors.onSurfaceVariant }]}>
                We need at least one month of spending to render the trend chart.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: cardBackground }]}
          elevation={2}
        >
          <Card.Title
            title="Expenses by Category"
            subtitle="Filtered spending breakdown"
            titleStyle={styles.sectionTitle}
            subtitleStyle={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}
          />
          <Card.Content>
            {categories.map((category, index) => {
              const value = expensesByCategory[category.id] ?? 0;
              const transactionCount = expenseCounts[category.id] ?? 0;
              const progress = Math.max(0, Math.min(1, value / maxCategorySpend));
              const displayValue = value === 0 ? formatCurrency(0) : `-${formatCurrency(value)}`;
              const budgetInfo = budgetSummaries.get(category.id);
              const budgetProgressColor = budgetInfo
                ? budgetInfo.progress < 0.5
                  ? theme.custom?.success ?? '#5CFAC7'
                  : budgetInfo.progress < 0.85
                    ? theme.custom?.warning ?? theme.colors.tertiary
                    : theme.colors.error
                : theme.colors.primary;

              return (
                <View
                  key={category.id}
                  style={[styles.categoryBlock, value === 0 && styles.categoryBlockInactive]}
                >
                  <View style={styles.categoryHeader}>
                    <Text variant="titleMedium" style={styles.categoryName}>{category.name}</Text>
                    <Text variant="titleMedium" style={[styles.categoryValue, { color: expenseColor }]}>
                      {displayValue}
                    </Text>
                  </View>
                  <View style={styles.progressWrapper}>
                    <ProgressBar progress={progress} color={expenseColor} style={styles.progressBar} />
                  </View>
                  <Text variant="bodySmall" style={[styles.categoryMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {value === 0
                      ? 'No spending recorded'
                      : `${transactionCount} transaction${transactionCount === 1 ? '' : 's'}`}
                  </Text>
                  {budgetInfo && (
                    <View style={styles.budgetInfoBlock}>
                      <View style={styles.budgetInfoHeader}>
                        <Text variant="labelLarge" style={[styles.budgetInfoLabel, { color: theme.colors.onSurfaceVariant }]}>
                          Budget
                        </Text>
                        <Text variant="bodyMedium" style={[styles.budgetInfoValue, { color: budgetProgressColor }]}>
                          {formatCurrency(budgetInfo.spent)} / {formatCurrency(budgetInfo.budget.amount)}
                        </Text>
                      </View>
                      <ProgressBar
                        progress={Math.min(1, budgetInfo.progress)}
                        color={budgetProgressColor}
                        style={styles.budgetProgressBar}
                      />
                      <Text variant="bodySmall" style={[styles.budgetInfoRemaining, { color: theme.colors.onSurfaceVariant }]}>
                        Remaining {formatCurrency(budgetInfo.remaining)}
                      </Text>
                    </View>
                  )}
                  {index < categories.length - 1 && <Divider style={styles.divider} />}
                </View>
              );
            })}
          </Card.Content>
        </Card>

        {!hasExpenseData && (
          <Card style={[styles.emptyCard, { backgroundColor: cardBackground }]}
            elevation={1}
          >
            <Card.Content>
              <Text variant="titleMedium" style={styles.emptyText}>
                No expenses recorded for this range. Log your spending to see insights here!
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 24,
    marginBottom: 18,
  },
  card: {
    borderRadius: 20,
    marginBottom: 18,
  },
  emptyCard: {
    borderRadius: 20,
    marginBottom: 18,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontSize: 12,
  },
  heroTotal: {
    marginTop: 4,
    fontWeight: '700',
  },
  heroDescription: {
    marginTop: 12,
    lineHeight: 20,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  heroMetric: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  heroMetricTrailing: {
    marginRight: 0,
  },
  metricLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    fontSize: 12,
    opacity: 0.85,
  },
  metricValue: {
    fontWeight: '700',
  },
  totalPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillLabel: {
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 20,
  },
  sectionSubtitle: {
    marginTop: 4,
  },
  chartPlaceholder: {
    textAlign: 'center',
    opacity: 0.75,
    marginTop: 12,
  },
  chartWrapper: {
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  barChart: {
    borderRadius: 12,
  },
  categoryBlock: {
    paddingVertical: 14,
  },
  categoryBlockInactive: {
    opacity: 0.6,
  },
  budgetInfoBlock: {
    marginTop: 12,
  },
  budgetInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetInfoLabel: {
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
    opacity: 0.75,
  },
  budgetInfoValue: {
    fontWeight: '600',
  },
  budgetProgressBar: {
    height: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  budgetInfoRemaining: {
    marginTop: 4,
    opacity: 0.75,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    flex: 1,
  },
  categoryValue: {
    fontWeight: '600',
  },
  progressWrapper: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
  },
  categoryMeta: {
    marginTop: 6,
  },
  divider: {
    marginTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 20,
  },
});

export default SummaryScreen;
