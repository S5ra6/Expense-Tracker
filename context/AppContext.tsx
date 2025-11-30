import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import {
  AppReducer,
  AppState,
  AppAction,
  initialState,
  Transaction,
  Category,
  DateFilter,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORIES,
  Budget,
  CurrencyOption,
  ThemePreference,
  Account,
  DEFAULT_ACCOUNT,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
} from './AppReducer';
import { useAsyncStorage } from '../hooks/useAsyncStorage';

const TRANSACTION_STORAGE_KEY = 'EXPENSE_TRACKER_TRANSACTIONS_V1';
const CATEGORIES_STORAGE_KEY = 'EXPENSE_TRACKER_CATEGORIES_V1';
const DATE_FILTER_STORAGE_KEY = 'EXPENSE_TRACKER_DATE_FILTER_V1';
const BUDGETS_STORAGE_KEY = 'EXPENSE_TRACKER_BUDGETS_V1';
const CURRENCY_STORAGE_KEY = 'EXPENSE_TRACKER_CURRENCY_V1';
const THEME_STORAGE_KEY = 'EXPENSE_TRACKER_THEME_V1';
const ACCOUNTS_STORAGE_KEY = 'EXPENSE_TRACKER_ACCOUNTS_V1';
const NOTIFICATIONS_STORAGE_KEY = 'EXPENSE_TRACKER_NOTIFICATIONS_V1';

type LegacyTransaction = {
  id: string;
  title: string;
  amount: number;
  date: string;
  category?: string;
  type?: 'expense' | 'income';
  categoryId?: string | null;
  accountId?: string | null;
};

type RawAccount = Omit<Account, 'accountNumber' | 'includeInBalance'> & {
  accountNumber?: string | null;
  includeInBalance?: boolean | null;
};

const normalizeTransaction = (transaction: Transaction | LegacyTransaction): Transaction => {
  const legacyAmount = typeof transaction.amount === 'number' ? transaction.amount : Number(transaction.amount) || 0;

  const resolvedType = transaction.type === 'income' || legacyAmount >= 0 ? 'income' : 'expense';
  const amount = resolvedType === 'expense' ? -Math.abs(legacyAmount) : Math.abs(legacyAmount);

  let categoryId: string | null = null;

  if ('categoryId' in transaction && transaction.categoryId) {
    categoryId = transaction.categoryId;
  } else if ('category' in transaction && transaction.category) {
    const legacyMatch = DEFAULT_CATEGORIES.find((category) =>
      category.name.toLowerCase() === transaction.category?.toLowerCase(),
    );
    categoryId = legacyMatch?.id ?? DEFAULT_CATEGORY_ID;
  } else {
    categoryId = DEFAULT_CATEGORY_ID;
  }

  const accountId = 'accountId' in transaction && transaction.accountId
    ? transaction.accountId
    : DEFAULT_ACCOUNT_ID;

  return {
    id: transaction.id,
    title: transaction.title ?? '',
    amount,
    date: transaction.date ?? new Date().toISOString(),
    categoryId,
    type: amount >= 0 ? 'income' : 'expense',
    accountId,
    receiptUri: 'receiptUri' in transaction ? (transaction as Transaction).receiptUri ?? null : null,
  };
};

const normalizeAccount = (account: RawAccount | Account): Account => ({
  ...account,
  accountNumber: typeof account.accountNumber === 'string' ? account.accountNumber : '',
  includeInBalance: account.includeInBalance ?? true,
});

type AppContextValue = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  isHydrated: boolean;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

type AppProviderProps = {
  children?: React.ReactNode;
};

export const AppProvider = ({ children }: AppProviderProps) => {
  const [state, dispatch] = useReducer(AppReducer, initialState);

  const handleTransactionsHydrated = useCallback(
    (transactions: Array<Transaction | LegacyTransaction>) => {
      if (!Array.isArray(transactions)) {
        return;
      }
      const normalized = transactions.map(normalizeTransaction);
      dispatch({ type: 'SET_TRANSACTIONS', payload: normalized });
    },
    [dispatch],
  );

  const handleCategoriesHydrated = useCallback(
    (categories: Category[]) => {
      if (!categories || categories.length === 0) {
        dispatch({ type: 'SET_CATEGORIES', payload: DEFAULT_CATEGORIES });
        return;
      }
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
    },
    [dispatch],
  );

  const handleDateFilterHydrated = useCallback(
    (filter: DateFilter) => {
      if (!filter) {
        return;
      }
      dispatch({ type: 'SET_DATE_FILTER', payload: filter });
    },
    [dispatch],
  );

  const handleBudgetsHydrated = useCallback(
    (budgets: Budget[]) => {
      if (!Array.isArray(budgets)) {
        return;
      }
      dispatch({ type: 'SET_BUDGETS', payload: budgets });
    },
    [dispatch],
  );

  const handleAccountsHydrated = useCallback(
    (accounts: Account[]) => {
      if (!Array.isArray(accounts) || accounts.length === 0) {
        dispatch({ type: 'SET_ACCOUNTS', payload: [DEFAULT_ACCOUNT] });
        return;
      }
      const normalizedAccounts = accounts.map(normalizeAccount);
      dispatch({ type: 'SET_ACCOUNTS', payload: normalizedAccounts });
    },
    [dispatch],
  );

  const handleNotificationsHydrated = useCallback(
    (preferences: NotificationPreferences) => {
      if (!preferences) {
        dispatch({ type: 'SET_NOTIFICATION_PREFERENCES', payload: DEFAULT_NOTIFICATION_PREFERENCES });
        return;
      }
      dispatch({
        type: 'SET_NOTIFICATION_PREFERENCES',
        payload: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...preferences,
        },
      });
    },
    [dispatch],
  );

  const handleCurrencyHydrated = useCallback(
    (currency: CurrencyOption) => {
      if (!currency || !currency.code) {
        return;
      }
      dispatch({ type: 'SET_CURRENCY', payload: currency });
    },
    [dispatch],
  );

  const handleThemeHydrated = useCallback(
    (preference: ThemePreference) => {
      if (!preference) {
        return;
      }
      dispatch({ type: 'SET_THEME_PREFERENCE', payload: preference });
    },
    [dispatch],
  );

  const { isHydrated: transactionsHydrated } = useAsyncStorage<Transaction[] | LegacyTransaction[]>(
    TRANSACTION_STORAGE_KEY,
    state.transactions,
    handleTransactionsHydrated,
  );

  const { isHydrated: categoriesHydrated } = useAsyncStorage<Category[]>(
    CATEGORIES_STORAGE_KEY,
    state.categories,
    handleCategoriesHydrated,
  );

  const { isHydrated: filterHydrated } = useAsyncStorage<DateFilter>(
    DATE_FILTER_STORAGE_KEY,
    state.dateFilter,
    handleDateFilterHydrated,
  );

  const { isHydrated: budgetsHydrated } = useAsyncStorage<Budget[]>(
    BUDGETS_STORAGE_KEY,
    state.budgets,
    handleBudgetsHydrated,
  );

  const { isHydrated: accountsHydrated } = useAsyncStorage<Account[]>(
    ACCOUNTS_STORAGE_KEY,
    state.accounts.map(normalizeAccount),
    handleAccountsHydrated,
  );

  const { isHydrated: currencyHydrated } = useAsyncStorage<CurrencyOption>(
    CURRENCY_STORAGE_KEY,
    state.currency,
    handleCurrencyHydrated,
  );

  const { isHydrated: themeHydrated } = useAsyncStorage<ThemePreference>(
    THEME_STORAGE_KEY,
    state.themePreference,
    handleThemeHydrated,
  );

  const { isHydrated: notificationsHydrated } = useAsyncStorage<NotificationPreferences>(
    NOTIFICATIONS_STORAGE_KEY,
    state.notificationPreferences,
    handleNotificationsHydrated,
  );

  const isHydrated =
    transactionsHydrated &&
    categoriesHydrated &&
    filterHydrated &&
    budgetsHydrated &&
    currencyHydrated &&
    themeHydrated &&
    accountsHydrated &&
    notificationsHydrated;

  const value = useMemo(
    () => ({
      state,
      dispatch,
      isHydrated,
    }),
    [state, dispatch, isHydrated],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
