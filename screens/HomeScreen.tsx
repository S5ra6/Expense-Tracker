import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Button,
  FAB,
  Menu,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAppContext } from '../context/AppContext';
import type {
  Transaction,
  Category,
  Account,
} from '../context/AppReducer';
import TransactionListItem from '../components/TransactionListItem';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import type { AppTheme } from '../theme/theme';
import { useFormatCurrency } from '../utils/currencyUtils';

const EMPTY_STATE_MESSAGE = 'No transactions yet. Add one to get started!';

type HomeScreenProps = NativeStackScreenProps<HomeStackParamList, 'Home'>;

type TransactionSection = {
  key: 'expenses' | 'income';
  title: string;
  data: Transaction[];
  totalAmount: number;
};

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const {
    state: { transactions, categories, dateFilter, accounts },
    dispatch,
  } = useAppContext();
  const theme = useTheme<AppTheme>();
  const formatCurrency = useFormatCurrency();
  const { width: windowWidth } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [isImageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((account) => {
      map.set(account.id, account);
    });
    return map;
  }, [accounts]);

  const accountOptions = useMemo(
    () => [
      { value: 'all', label: 'All accounts' },
      ...accounts.map((account) => ({ value: account.id, label: account.name })),
    ],
    [accounts],
  );

  const includedAccountIds = useMemo(
    () => accounts.filter((account) => account.includeInBalance ?? true).map((account) => account.id),
    [accounts],
  );

  const selectedAccountLabel = useMemo(() => {
    const match = accountOptions.find((option) => option.value === selectedAccountId);
    return match?.label ?? accountOptions[0]?.label ?? 'All accounts';
  }, [accountOptions, selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId === 'all') {
      return;
    }
    const stillExists = accounts.some((account) => account.id === selectedAccountId);
    if (!stillExists) {
      setSelectedAccountId(accounts[0]?.id ?? 'all');
    }
  }, [accounts, selectedAccountId]);

  const dateRange = useMemo(() => {
    if (!dateFilter?.startDate || !dateFilter?.endDate) {
      return null;
    }

    const start = new Date(dateFilter.startDate);
    const end = new Date(dateFilter.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    return { start, end } as const;
  }, [dateFilter]);

  const accountFilteredTransactions = useMemo(() => {
    if (selectedAccountId === 'all') {
      return transactions;
    }
    return transactions.filter((transaction) => transaction.accountId === selectedAccountId);
  }, [selectedAccountId, transactions]);

  const dateFilteredTransactions = useMemo(() => {
    if (!dateRange) {
      return accountFilteredTransactions;
    }

    const { start, end } = dateRange;

    return accountFilteredTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      if (Number.isNaN(transactionDate.getTime())) {
        return false;
      }
      return transactionDate >= start && transactionDate <= end;
    });
  }, [accountFilteredTransactions, dateRange]);

  const allAccountsDateFilteredTransactions = useMemo(() => {
    if (!dateRange) {
      return transactions;
    }

    const { start, end } = dateRange;

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      if (Number.isNaN(transactionDate.getTime())) {
        return false;
      }
      return transactionDate >= start && transactionDate <= end;
    });
  }, [transactions, dateRange]);

  const visibleTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) {
      return dateFilteredTransactions;
    }

    return dateFilteredTransactions.filter((transaction) => {
      const titleMatch = transaction.title.toLowerCase().includes(query);
      const categoryMatch =
        categoryMap.get(transaction.categoryId ?? '')?.name.toLowerCase().includes(query) ?? false;
      const accountMatch = accountMap.get(transaction.accountId ?? '')?.name.toLowerCase().includes(query) ?? false;

      return titleMatch || categoryMatch || accountMatch;
    });
  }, [accountMap, categoryMap, dateFilteredTransactions, searchQuery]);

  const expenseTransactions = useMemo(
    () => visibleTransactions.filter((transaction) => transaction.amount < 0),
    [visibleTransactions],
  );

  const incomeTransactions = useMemo(
    () => visibleTransactions.filter((transaction) => transaction.amount >= 0),
    [visibleTransactions],
  );

  const expenseTotal = useMemo(
    () => expenseTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [expenseTransactions],
  );

  const incomeTotal = useMemo(
    () => incomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [incomeTransactions],
  );

  const summaryExpenseTransactions = useMemo(() => {
    if (selectedAccountId === 'all') {
      const includedIds = new Set(includedAccountIds);
      return expenseTransactions.filter((transaction) => includedIds.has(transaction.accountId));
    }
    return expenseTransactions;
  }, [expenseTransactions, includedAccountIds, selectedAccountId]);

  const summaryIncomeTransactions = useMemo(() => {
    if (selectedAccountId === 'all') {
      const includedIds = new Set(includedAccountIds);
      return incomeTransactions.filter((transaction) => includedIds.has(transaction.accountId));
    }
    return incomeTransactions;
  }, [incomeTransactions, includedAccountIds, selectedAccountId]);

  const summaryExpenseTotal = useMemo(
    () => summaryExpenseTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [summaryExpenseTransactions],
  );

  const summaryIncomeTotal = useMemo(
    () => summaryIncomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [summaryIncomeTransactions],
  );

  const sections = useMemo<TransactionSection[]>(
    () => [
      {
        key: 'expenses',
        title: 'Spending',
        data: expenseTransactions,
        totalAmount: expenseTotal,
      },
      {
        key: 'income',
        title: 'Income',
        data: incomeTransactions,
        totalAmount: incomeTotal,
      },
    ],
    [expenseTransactions, expenseTotal, incomeTransactions, incomeTotal],
  );

  const incomeCount = summaryIncomeTransactions.length;
  const expenseCount = summaryExpenseTransactions.length;
  const hasTransactions = sections.some((section) => section.data.length > 0);

  const balance = summaryIncomeTotal - summaryExpenseTotal;
  const formattedBalance = `${balance >= 0 ? '' : '-'}${formatCurrency(Math.abs(balance))}`;
  const formattedIncome = formatCurrency(summaryIncomeTotal);

  const globalIncomeStats = useMemo(() => {
    const includedIds = new Set(includedAccountIds);
    return allAccountsDateFilteredTransactions.reduce(
      (acc, transaction) => {
        if (selectedAccountId === 'all' && !includedIds.has(transaction.accountId)) {
          return acc;
        }
        if (transaction.amount >= 0) {
          acc.totalIncome += transaction.amount;
        } else {
          acc.totalExpenses += Math.abs(transaction.amount);
        }
        return acc;
      },
      { totalIncome: 0, totalExpenses: 0 },
    );
  }, [allAccountsDateFilteredTransactions, includedAccountIds, selectedAccountId]);

  const formattedGlobalIncome = formatCurrency(globalIncomeStats.totalIncome);
  const formattedGlobalExpenses = formatCurrency(globalIncomeStats.totalExpenses);

  const incomeColor = theme.custom?.success ?? theme.colors.primary;
  const incomeCardColor = incomeColor;
  const expenseColor = theme.colors.error;
  const balanceColor = balance >= 0 ? incomeColor : expenseColor;

  const emptyMessage = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return 'No transactions match your search yet.';
    }
    if (selectedAccountId !== 'all') {
      return 'No transactions for this account yet. Try adding one!';
    }
    return EMPTY_STATE_MESSAGE;
  }, [searchQuery, selectedAccountId]);

  const handleDelete = useCallback(
    (transaction: Transaction) => {
      const deleteAction = () => dispatch({ type: 'DELETE_TRANSACTION', payload: { id: transaction.id } });

      if (Platform.OS === 'web') {
        const confirmationMessage = `Delete "${transaction.title}"? This cannot be undone.`;
        const confirmed =
          typeof window !== 'undefined' && typeof window.confirm === 'function'
            ? window.confirm(confirmationMessage)
            : true;
        if (confirmed) {
          deleteAction();
        }
        return;
      }

      Alert.alert(
        'Delete Transaction',
        `Are you sure you want to delete "${transaction.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: deleteAction,
          },
        ],
        { cancelable: true },
      );
    },
    [dispatch],
  );

  const handleEdit = useCallback(
    (transactionId: string) => {
      navigation.navigate('AddTransaction', { transactionId });
    },
    [navigation],
  );

  const handleAddTransaction = useCallback(() => {
    navigation.navigate('AddTransaction', {
      initialType: 'expense',
      initialAccountId: selectedAccountId !== 'all' ? selectedAccountId : undefined,
    });
  }, [navigation, selectedAccountId]);

  const handleViewReceipt = useCallback((uri: string) => {
    setSelectedImageUri(uri);
    setImageViewerVisible(true);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setImageViewerVisible(false);
    setSelectedImageUri(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionListItem
        transaction={item}
        category={categoryMap.get(item.categoryId ?? '') ?? null}
        accountName={accountMap.get(item.accountId ?? '')?.name ?? null}
        onPress={() => handleEdit(item.id)}
        onDelete={() => handleDelete(item)}
        onViewReceipt={handleViewReceipt}
      />
    ),
    [accountMap, categoryMap, handleDelete, handleEdit, handleViewReceipt],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TransactionSection }) => {
      const isExpense = section.key === 'expenses';
      const color = isExpense ? expenseColor : incomeColor;
      const prefix = isExpense ? '-' : '+';
      const formattedTotal = `${prefix}${formatCurrency(section.totalAmount)}`;

      return (
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text variant="titleMedium" style={[styles.sectionHeaderTitle, { color: theme.colors.onSurface }] }>
              {section.title}
            </Text>
            <Text
              variant="labelSmall"
              style={[styles.sectionHeaderCount, { color: theme.colors.onSurfaceVariant }]}
            >
              {section.data.length} {section.data.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Text variant="labelLarge" style={[styles.sectionHeaderTotal, { color }] }>
            {formattedTotal}
          </Text>
        </View>
      );
    },
    [expenseColor, formatCurrency, incomeColor, theme.colors.onSurface, theme.colors.onSurfaceVariant],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: TransactionSection }) => {
      if (section.data.length > 0) {
        return null;
      }

      const message = section.key === 'income' ? 'No income recorded yet.' : 'No spending recorded yet.';

      return (
        <Surface style={[styles.sectionEmptyCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text variant="bodyMedium" style={[styles.sectionEmptyText, { color: theme.colors.onSurfaceVariant }] }>
            {message}
          </Text>
        </Surface>
      );
    },
    [theme.colors.onSurfaceVariant, theme.colors.surface],
  );

  const carouselCardWidth = useMemo(() => {
    const totalHorizontalPadding = 32;
    const cardSpacing = 16;
    const availableWidth = windowWidth - totalHorizontalPadding - cardSpacing;
    if (availableWidth <= 0) {
      return 260;
    }
    return Math.min(Math.max(availableWidth, 260), 340);
  }, [windowWidth]);

  const listHeader = useMemo(
    () => (
      <View style={styles.headerSection}>
        <TextInput
          mode="outlined"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search transactions..."
          left={<TextInput.Icon icon="magnify" />}
          right={
            searchQuery
              ? (
                <TextInput.Icon
                  icon="close"
                  onPress={() => setSearchQuery('')}
                  forceTextInputFocus={false}
                />
              )
              : undefined
          }
          outlineStyle={styles.searchInputOutline}
          style={styles.searchInput}
        />
        <View style={styles.filterRow}>
          <Text
            variant="labelMedium"
            style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Showing
          </Text>
          <Menu
            visible={accountMenuVisible}
            onDismiss={() => setAccountMenuVisible(false)}
            anchor={(
              <View style={styles.filterMenuAnchor}>
                <Button
                  mode="outlined"
                  onPress={() => setAccountMenuVisible(true)}
                  icon={accountMenuVisible ? 'chevron-up' : 'chevron-down'}
                  contentStyle={styles.filterButtonContent}
                  style={styles.filterButton}
                  labelStyle={styles.filterButtonLabel}
                >
                  {selectedAccountLabel}
                </Button>
              </View>
            )}
          >
            {accountOptions.map((option) => (
              <Menu.Item
                key={option.value}
                onPress={() => {
                  setSelectedAccountId(option.value);
                  setAccountMenuVisible(false);
                }}
                title={option.label}
                leadingIcon={option.value === selectedAccountId ? 'check' : undefined}
              />
            ))}
          </Menu>
        </View>
        <View style={styles.headerRow}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Transactions
          </Text>
          <Surface style={[styles.metricPill, { backgroundColor: `${incomeColor}1a` }]} elevation={2}>
            <Text variant="labelMedium" style={[styles.metricPillLabel, { color: incomeColor }]}>
              Income
            </Text>
            <Text variant="titleMedium" style={[styles.metricPillValue, { color: incomeColor }]}
            >
              {formattedIncome}
            </Text>
          </Surface>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryCarouselContent}
          style={styles.summaryCarousel}
          snapToInterval={carouselCardWidth + 16}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          <Surface
            style={[
              styles.summaryCard,
              { width: carouselCardWidth, backgroundColor: theme.colors.surface },
            ]}
            elevation={3}
          >
            <Text variant="labelLarge" style={styles.summaryLabel}>
              Balance
            </Text>
            <Text variant="headlineSmall" style={[styles.summaryValue, { color: balanceColor }]}
            >
              {formattedBalance}
            </Text>
            <Text
              variant="bodySmall"
              style={[styles.summarySubValue, { color: theme.colors.onSurfaceVariant }]}
            >
              Accounts · {selectedAccountId === 'all'
                ? `${includedAccountIds.length} included`
                : accountMap.get(selectedAccountId)?.name ?? 'Unknown'}
            </Text>
          </Surface>
          <Surface
            style={[
              styles.summaryCard,
              { width: carouselCardWidth, backgroundColor: theme.colors.surface },
            ]}
            elevation={3}
          >
            <Text variant="labelLarge" style={styles.summaryLabel}>
              Income
            </Text>
            <Text variant="headlineSmall" style={[styles.summaryValue, { color: incomeCardColor }]}
            >
              {formattedIncome}
            </Text>
            <Text variant="bodySmall" style={[styles.summarySubValue, { color: incomeColor }]}
            >
              Earned · {formattedGlobalIncome}
            </Text>
            <Text variant="bodySmall" style={[styles.summarySubValue, { color: theme.colors.onSurfaceVariant }]}
            >
              Entries · {incomeCount}
            </Text>
          </Surface>
          <Surface
            style={[
              styles.summaryCard,
              { width: carouselCardWidth, backgroundColor: theme.colors.surface },
            ]}
            elevation={3}
          >
            <Text variant="labelLarge" style={styles.summaryLabel}>
              Spending
            </Text>
            <Text variant="headlineSmall" style={[styles.summaryValue, { color: expenseColor }]}
            >
              -{formattedGlobalExpenses}
            </Text>
            <Text variant="bodySmall" style={[styles.summarySubValue, { color: expenseColor }]}
            >
              Expenses · {expenseCount}
            </Text>
          </Surface>
        </ScrollView>
      </View>
    ),
    [
      accountMap,
      accountMenuVisible,
      accountOptions,
      balanceColor,
      carouselCardWidth,
      expenseColor,
      expenseCount,
      formattedBalance,
      formattedGlobalExpenses,
      formattedGlobalIncome,
      formattedIncome,
      incomeCardColor,
      incomeColor,
      incomeCount,
      includedAccountIds.length,
      searchQuery,
      selectedAccountId,
      selectedAccountLabel,
      theme.colors.onSurfaceVariant,
      theme.colors.surface,
    ],
  );

  return (
    <LinearGradient colors={theme.custom?.gradientBackground ?? [theme.colors.background, theme.colors.background]} style={styles.gradient}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ListHeaderComponent={listHeader}
        ListFooterComponent={<View style={styles.listFooterSpacing} />}
        ListEmptyComponent={() => (
          <Surface style={[styles.emptyStateContainer, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Text variant="titleMedium" style={[styles.emptyStateText, { color: theme.colors.onSurface }] }>
              {emptyMessage}
            </Text>
            {searchQuery.trim().length === 0 && (
              <Button
                mode="contained"
                onPress={handleAddTransaction}
                icon="plus-circle"
                style={styles.emptyButton}
              >
                Add Transaction
              </Button>
            )}
          </Surface>
        )}
        refreshControl={(
          <RefreshControl
            refreshing={false}
            onRefresh={() => undefined}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surface}
            colors={[theme.colors.primary]}
          />
        )}
        contentContainerStyle={hasTransactions ? styles.listContent : styles.emptyContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={handleAddTransaction}
        accessibilityLabel="Add a new transaction"
      />
      <Modal
        visible={isImageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseImageViewer}
      >
        <View style={styles.imageModalBackdrop}>
          <TouchableOpacity style={styles.imageModalClose} onPress={handleCloseImageViewer} accessibilityRole="button" accessibilityLabel="Close receipt viewer">
            <Text variant="titleMedium" style={styles.imageModalCloseText}>
              Close
            </Text>
          </TouchableOpacity>
          {selectedImageUri && (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.imageModalPreview}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    marginBottom: 12,
  },
  searchInputOutline: {
    borderRadius: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  filterLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterMenuAnchor: {
    flex: 1,
  },
  filterButton: {
    flex: 1,
  },
  filterButtonContent: {
    justifyContent: 'space-between',
  },
  filterButtonLabel: {
    flexShrink: 1,
    textTransform: 'none',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontWeight: '700',
  },
  metricPill: {
    flexDirection: 'column',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
  },
  metricPillLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: '600',
  },
  metricPillValue: {
    fontWeight: '700',
  },
  summaryCarousel: {
    marginHorizontal: -8,
    marginTop: 4,
    marginBottom: 4,
  },
  summaryCarouselContent: {
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  summaryCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    marginVertical: 6,
  },
  summaryLabel: {
    opacity: 0.72,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 8,
    fontWeight: '700',
  },
  summarySubValue: {
    marginTop: 6,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionHeaderTitle: {
    fontWeight: '700',
  },
  sectionHeaderCount: {
    marginTop: 2,
  },
  sectionHeaderTotal: {
    fontWeight: '700',
  },
  sectionSeparator: {
    height: 8,
  },
  sectionEmptyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sectionEmptyText: {
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 96,
  },
  listFooterSpacing: {
    height: 48,
  },
  emptyContent: {
    flexGrow: 1,
    paddingBottom: 96,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    borderRadius: 24,
    marginHorizontal: 16,
  },
  emptyStateText: {
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  imageModalPreview: {
    width: '100%',
    maxWidth: 480,
    height: '80%',
  },
  imageModalClose: {
    position: 'absolute',
    top: 48,
    right: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  imageModalCloseText: {
    color: '#FFFFFF',
  },
});

export default HomeScreen;
