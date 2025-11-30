import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { addMonths, format, parse } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useNavigation } from '@react-navigation/native';

import { useAppContext } from '../context/AppContext';
import type { Budget, Category } from '../context/AppReducer';
import type { AppTheme } from '../theme/theme';
import type { BudgetStackParamList, HomeStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useFormatCurrency } from '../utils/currencyUtils';

type BudgetFormErrors = {
  amount?: string;
  categoryId?: string;
};

type BudgetWithStats = Budget & {
  spent: number;
  remaining: number;
  progress: number;
  category: Category | null;
};

const formatMonthKey = (date: Date) => format(date, 'yyyy-MM');

const BudgetScreen = () => {
  const {
    state: { budgets, categories, transactions },
    dispatch,
  } = useAppContext();
  const theme = useTheme<AppTheme>();
  const navigation = useNavigation();
  const formatCurrency = useFormatCurrency();

  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthKey(new Date()));
  const [formVisible, setFormVisible] = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<BudgetFormErrors>({});
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const monthDate = useMemo(() => {
    const parsed = parse(selectedMonth, 'yyyy-MM', new Date());
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    parsed.setDate(1);
    return parsed;
  }, [selectedMonth]);

  const monthLabel = useMemo(() => format(monthDate, 'MMMM yyyy'), [monthDate]);

  const monthBudgets = useMemo(
    () => budgets.filter((budget) => budget.month === selectedMonth),
    [budgets, selectedMonth],
  );

  const expensesByCategory = useMemo(() => {
    if (transactions.length === 0) {
      return new Map<string, number>();
    }

    const map = new Map<string, number>();

    transactions.forEach((transaction) => {
      if (transaction.type !== 'expense' || !transaction.categoryId) {
        return;
      }

      const transactionDate = new Date(transaction.date);
      if (Number.isNaN(transactionDate.getTime())) {
        return;
      }

      const transactionMonth = formatMonthKey(transactionDate);
      if (transactionMonth !== selectedMonth) {
        return;
      }

      map.set(transaction.categoryId, (map.get(transaction.categoryId) ?? 0) + transaction.amount);
    });

    return map;
  }, [transactions, selectedMonth]);

  const categoriesSorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const budgetsWithStats = useMemo<BudgetWithStats[]>(() => {
    return monthBudgets
      .map((budget) => {
        const spent = expensesByCategory.get(budget.categoryId) ?? 0;
        const remaining = Math.max(0, budget.amount - spent);
        const progress = budget.amount === 0 ? 0 : Math.min(1, spent / budget.amount);

        return {
          ...budget,
          spent,
          remaining,
          progress,
          category: categoryMap.get(budget.categoryId) ?? null,
        };
      })
      .sort((a, b) => {
        const nameA = a.category?.name ?? '';
        const nameB = b.category?.name ?? '';
        return nameA.localeCompare(nameB);
      });
  }, [categoryMap, expensesByCategory, monthBudgets]);

  const totals = useMemo(() => {
    return budgetsWithStats.reduce(
      (acc, budget) => {
        acc.budgeted += budget.amount;
        acc.spent += budget.spent;
        acc.remaining += budget.remaining;
        return acc;
      },
      { budgeted: 0, spent: 0, remaining: 0 },
    );
  }, [budgetsWithStats]);

  const gradientColors = theme.custom?.gradientBackground ?? [theme.colors.background, theme.colors.background];

  const resetForm = useCallback(() => {
    setFormAmount('');
    setFormCategoryId(null);
    setFormErrors({});
    setEditingBudgetId(null);
  }, []);

  const closeForm = useCallback(() => {
    setFormVisible(false);
    resetForm();
  }, [resetForm]);

  const openCreateForm = useCallback(() => {
    resetForm();
    const availableCategory = categoriesSorted.find(
      (category) => !monthBudgets.some((budget) => budget.categoryId === category.id),
    );
    setFormCategoryId(availableCategory?.id ?? categoriesSorted[0]?.id ?? null);
    setFormVisible(true);
  }, [categoriesSorted, monthBudgets, resetForm]);

  const openEditForm = useCallback(
    (budget: BudgetWithStats) => {
      setEditingBudgetId(budget.id);
      setFormAmount(String(budget.amount));
      setFormCategoryId(budget.categoryId);
      setFormErrors({});
      setFormVisible(true);
    },
    [],
  );

  const validateForm = useCallback(() => {
    const newErrors: BudgetFormErrors = {};
    const trimmedAmount = formAmount.trim();
    const parsedAmount = Number(trimmedAmount);

    if (!trimmedAmount) {
      newErrors.amount = 'Amount is required';
    } else if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Enter a positive number';
    }

    if (!formCategoryId) {
      newErrors.categoryId = 'Select a category';
    } else {
      const duplicate = monthBudgets.find(
        (budget) => budget.categoryId === formCategoryId && budget.id !== editingBudgetId,
      );
      if (duplicate) {
        newErrors.categoryId = 'A budget already exists for this category.';
      }
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [editingBudgetId, formAmount, formCategoryId, monthBudgets]);

  const handleSaveBudget = useCallback(() => {
    if (!validateForm() || !formCategoryId) {
      return;
    }

    const amountValue = Number(formAmount.trim());

    if (editingBudgetId) {
      dispatch({
        type: 'UPDATE_BUDGET',
        payload: {
          id: editingBudgetId,
          categoryId: formCategoryId,
          amount: amountValue,
          month: selectedMonth,
        },
      });
    } else {
      dispatch({
        type: 'ADD_BUDGET',
        payload: {
          id: uuidv4(),
          categoryId: formCategoryId,
          amount: amountValue,
          month: selectedMonth,
        },
      });
    }

    closeForm();
  }, [closeForm, dispatch, editingBudgetId, formAmount, formCategoryId, selectedMonth, validateForm]);

  const handleDeleteBudget = useCallback(
    (budgetId: string) => {
      dispatch({ type: 'DELETE_BUDGET', payload: { id: budgetId } });
    },
    [dispatch],
  );

  const handleLogIncome = useCallback(
    (categoryId: string) => {
      const parentNavigator = navigation.getParent();
      parentNavigator?.navigate('HomeTab' as keyof TabParamList, {
        screen: 'AddTransaction',
        params: {
          initialType: 'income',
          initialCategoryId: categoryId,
        } as HomeStackParamList['AddTransaction'],
      });
    },
    [navigation],
  );

  const handleMonthStep = useCallback(
    (offset: number) => {
      const nextDate = addMonths(monthDate, offset);
      setSelectedMonth(formatMonthKey(nextDate));
    },
    [monthDate],
  );

  const monthTotalsFormatted = {
    budgeted: formatCurrency(totals.budgeted),
    spent: formatCurrency(totals.spent),
    remaining: formatCurrency(Math.max(0, totals.remaining)),
  };

  const emptyStateText = `No budgets recorded for ${monthLabel}.`;

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Surface elevation={4} style={[styles.monthCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.monthHeader}>
              <IconButton
                icon="chevron-left"
                onPress={() => handleMonthStep(-1)}
                accessibilityLabel="Previous month"
              />
              <View style={styles.monthTitleBlock}>
                <Text variant="labelLarge" style={styles.monthTitleLabel}>
                  Active Month
                </Text>
                <Text variant="headlineSmall" style={styles.monthTitle}>
                  {monthLabel}
                </Text>
              </View>
              <IconButton
                icon="chevron-right"
                onPress={() => handleMonthStep(1)}
                accessibilityLabel="Next month"
              />
            </View>
          </Surface>

          <Surface elevation={3} style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleSmall" style={styles.summaryTitle}>
              Monthly summary
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryMetric}>
                <Text variant="labelMedium" style={styles.summaryLabel}>
                  Budgeted
                </Text>
                <Text variant="titleMedium" style={styles.summaryValue}>
                  {monthTotalsFormatted.budgeted}
                </Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text variant="labelMedium" style={styles.summaryLabel}>
                  Spent
                </Text>
                <Text variant="titleMedium" style={[styles.summaryValue, { color: theme.colors.error }]}>
                  {monthTotalsFormatted.spent}
                </Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text variant="labelMedium" style={styles.summaryLabel}>
                  Remaining
                </Text>
                <Text variant="titleMedium" style={[styles.summaryValue, { color: theme.custom?.success ?? '#5CFAC7' }]}>
                  {monthTotalsFormatted.remaining}
                </Text>
              </View>
            </View>
          </Surface>

          {budgetsWithStats.length === 0 ? (
            <Surface elevation={2} style={[styles.emptyStateCard, { backgroundColor: theme.colors.surface }]}>
              <Text variant="titleMedium" style={styles.emptyStateTitle}>
                {emptyStateText}
              </Text>
              <Text variant="bodyMedium" style={[styles.emptyStateBody, { color: theme.colors.onSurfaceVariant }]}>
                Create a budget to start tracking spending goals for the month.
              </Text>
              <Button mode="contained" icon="plus" onPress={openCreateForm}>
                Add a budget
              </Button>
            </Surface>
          ) : (
            budgetsWithStats.map((budget) => {
              const progressPercent = Math.min(100, budget.progress * 100);
              const progressColor =
                budget.progress < 0.5
                  ? theme.custom?.success ?? '#5CFAC7'
                  : budget.progress < 0.85
                    ? theme.colors.tertiary
                    : theme.colors.error;

              return (
                <Surface
                  key={budget.id}
                  elevation={2}
                  style={[styles.budgetCard, { backgroundColor: theme.colors.surface }]}
                >
                  <View style={styles.budgetHeader}>
                    <View>
                      <Text variant="titleMedium" style={styles.budgetCategory}>
                        {budget.category?.name ?? 'Uncategorized'}
                      </Text>
                      <Text variant="bodyMedium" style={[styles.budgetSubtext, { color: theme.colors.onSurfaceVariant }]}
                      >
                        {formatCurrency(budget.spent)} of {formatCurrency(budget.amount)} used
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <IconButton
                        icon="pencil"
                        onPress={() => openEditForm(budget)}
                        accessibilityLabel={`Edit budget for ${budget.category?.name ?? 'category'}`}
                      />
                      <IconButton
                        icon="trash-can"
                        onPress={() => handleDeleteBudget(budget.id)}
                        accessibilityLabel={`Delete budget for ${budget.category?.name ?? 'category'}`}
                      />
                    </View>
                  </View>

                  <View style={styles.budgetMetrics}>
                    <View style={styles.metricColumn}>
                      <Text variant="labelLarge" style={styles.metricLabel}>
                        Budgeted
                      </Text>
                      <Text variant="titleMedium" style={styles.metricValue}>
                        {formatCurrency(budget.amount)}
                      </Text>
                    </View>
                    <View style={styles.metricColumn}>
                      <Text variant="labelLarge" style={styles.metricLabel}>
                        Spent
                      </Text>
                      <Text variant="titleMedium" style={styles.metricValue}>
                        {formatCurrency(budget.spent)}
                      </Text>
                    </View>
                    <View style={styles.metricColumn}>
                      <Text variant="labelLarge" style={styles.metricLabel}>
                        Remaining
                      </Text>
                      <Text variant="titleMedium" style={styles.metricValue}>
                        {formatCurrency(budget.remaining)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPercent}%`, backgroundColor: progressColor },
                      ]}
                    />
                  </View>

                  <Button
                    mode="outlined"
                    icon="cash-plus"
                    onPress={() => handleLogIncome(budget.categoryId)}
                    style={styles.incomeButton}
                  >
                    Log income
                  </Button>
                </Surface>
              );
            })
          )}
        </ScrollView>

        {budgetsWithStats.length > 0 && (
          <Button mode="contained" icon="plus" style={styles.addBudgetButton} onPress={openCreateForm}>
            Add budget
          </Button>
        )}
      </KeyboardAvoidingView>

      <Portal>
        <Dialog visible={formVisible} onDismiss={closeForm}>
          <Dialog.Title>{editingBudgetId ? 'Edit budget' : 'New budget'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput
                label="Amount"
                value={formAmount}
                onChangeText={setFormAmount}
                mode="outlined"
                keyboardType="numeric"
                left={<TextInput.Icon icon="currency-usd" />}
                outlineStyle={styles.dialogInputOutline}
                style={styles.dialogInput}
              />
              <HelperText type="error" visible={Boolean(formErrors.amount)}>
                {formErrors.amount}
              </HelperText>

              <Text variant="labelLarge" style={styles.categoryLabel}>
                Category
              </Text>
              <View style={styles.categoryGrid}>
                {categoriesSorted.map((category) => {
                  const selected = formCategoryId === category.id;
                  return (
                    <Button
                      key={category.id}
                      mode={selected ? 'contained' : 'outlined'}
                      onPress={() => setFormCategoryId(category.id)}
                      style={styles.categoryButton}
                    >
                      {category.name}
                    </Button>
                  );
                })}
              </View>
              <HelperText type="error" visible={Boolean(formErrors.categoryId)}>
                {formErrors.categoryId}
              </HelperText>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={closeForm}>Cancel</Button>
            <Button mode="contained" onPress={handleSaveBudget}>
              {editingBudgetId ? 'Save changes' : 'Add budget'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  monthCard: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitleLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  monthTitle: {
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    marginBottom: 12,
    opacity: 0.72,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryMetric: {
    flex: 1,
    marginRight: 12,
  },
  summaryLabel: {
    opacity: 0.7,
  },
  summaryValue: {
    marginTop: 6,
    fontWeight: '600',
  },
  emptyStateCard: {
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyStateTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateBody: {
    textAlign: 'center',
    marginBottom: 16,
  },
  budgetCard: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  budgetCategory: {
    fontWeight: '600',
  },
  budgetSubtext: {
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
  },
  budgetMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricColumn: {
    flex: 1,
    marginRight: 12,
  },
  metricLabel: {
    opacity: 0.66,
    letterSpacing: 0.5,
  },
  metricValue: {
    marginTop: 6,
    fontWeight: '600',
  },
  progressBar: {
    height: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 12,
  },
  incomeButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
  },
  addBudgetButton: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    borderRadius: 24,
  },
  dialogContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dialogInput: {
    marginTop: 4,
  },
  dialogInputOutline: {
    borderRadius: 12,
  },
  categoryLabel: {
    marginTop: 12,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    marginHorizontal: 4,
    marginVertical: 4,
  },
});

export default BudgetScreen;
