import { endOfMonth, startOfMonth } from 'date-fns';

export type TransactionType = 'expense' | 'income';

export type AccountType = 'cash' | 'bank' | 'credit' | 'debit' | 'investment' | 'other';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  accountNumber: string;
  initialBalance: number;
  includeInBalance: boolean;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  month: string; // ISO string formatted as YYYY-MM
};

export type NotificationPreferences = {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number;
  dailyReminderMinute: number;
};

export type CurrencyOption = {
  code: string;
  symbol: string;
  name: string;
  locale?: string;
};

export type ThemePreference = 'light' | 'dark' | 'system';

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  date: string;
  categoryId: string | null;
  type: TransactionType;
  accountId: string;
  receiptUri: string | null;
};

export type DateFilterPreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export type DateFilter = {
  preset: DateFilterPreset;
  startDate: string;
  endDate: string;
};

export type AppState = {
  transactions: Transaction[];
  categories: Category[];
  dateFilter: DateFilter;
  budgets: Budget[];
  currency: CurrencyOption;
  themePreference: ThemePreference;
  accounts: Account[];
  notificationPreferences: NotificationPreferences;
};

export type AppAction =
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: { id: string } }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: { id: string } }
  | { type: 'SET_DATE_FILTER'; payload: DateFilter }
  | { type: 'SET_BUDGETS'; payload: Budget[] }
  | { type: 'ADD_BUDGET'; payload: Budget }
  | { type: 'UPDATE_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: { id: string } }
  | { type: 'SET_CURRENCY'; payload: CurrencyOption }
  | { type: 'SET_THEME_PREFERENCE'; payload: ThemePreference }
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'ADD_ACCOUNT'; payload: Account }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; payload: { id: string; reassignAccountId?: string | null } }
  | { type: 'SET_NOTIFICATION_PREFERENCES'; payload: NotificationPreferences };

export const DEFAULT_CATEGORY_ID = 'uncategorized';

export const DEFAULT_ACCOUNT_ID = 'account-default-cash';
export const DEFAULT_ACCOUNT: Account = {
  id: DEFAULT_ACCOUNT_ID,
  name: 'Cash',
  type: 'cash',
  accountNumber: '',
  initialBalance: 0,
  includeInBalance: true,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyReminderEnabled: false,
  dailyReminderHour: 20,
  dailyReminderMinute: 0,
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: DEFAULT_CATEGORY_ID, name: 'Uncategorized', icon: 'dots-circle' },
  { id: 'food', name: 'Food', icon: 'silverware-fork-knife' },
  { id: 'transport', name: 'Transport', icon: 'transit-connection-variant' },
  { id: 'bills', name: 'Bills', icon: 'file-document-outline' },
  { id: 'entertainment', name: 'Entertainment', icon: 'movie-open-outline' },
  { id: 'other', name: 'Other', icon: 'flash' },
];

const buildInitialDateFilter = (): DateFilter => {
  const now = new Date();
  return {
    preset: 'thisMonth',
    startDate: startOfMonth(now).toISOString(),
    endDate: endOfMonth(now).toISOString(),
  };
};

export const initialState: AppState = {
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  dateFilter: buildInitialDateFilter(),
  budgets: [],
  currency: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  themePreference: 'system',
  accounts: [DEFAULT_ACCOUNT],
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
};

export function AppReducer(state: AppState, action: AppAction): AppState {
  const ensureTransaction = (transaction: Transaction): Transaction => {
    const type: TransactionType = transaction.amount >= 0 ? 'income' : 'expense';
    const accountId = state.accounts.some((account) => account.id === transaction.accountId)
      ? transaction.accountId
      : (state.accounts[0]?.id ?? DEFAULT_ACCOUNT_ID);

    return {
      ...transaction,
      type,
      accountId,
      receiptUri: transaction.receiptUri ?? null,
    };
  };

  switch (action.type) {
    case 'ADD_TRANSACTION':
      return {
        ...state,
        transactions: [ensureTransaction(action.payload), ...state.transactions],
      };
    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((transaction) =>
          transaction.id === action.payload.id ? ensureTransaction({ ...transaction, ...action.payload }) : transaction,
        ),
      };
    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((transaction) => transaction.id !== action.payload.id),
      };
    case 'SET_TRANSACTIONS':
      return {
        ...state,
        transactions: action.payload.map(ensureTransaction),
      };
    case 'SET_CATEGORIES': {
      const categories = action.payload.length > 0 ? action.payload : DEFAULT_CATEGORIES;
      return {
        ...state,
        categories,
      };
    }
    case 'ADD_CATEGORY':
      return {
        ...state,
        categories: [...state.categories, action.payload],
      };
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.payload.id ? { ...category, ...action.payload } : category,
        ),
      };
    case 'DELETE_CATEGORY': {
      if (action.payload.id === DEFAULT_CATEGORY_ID) {
        return state;
      }

      const categories = state.categories.filter((category) => category.id !== action.payload.id);
      const transactions = state.transactions.map((transaction) =>
        transaction.categoryId === action.payload.id
          ? { ...transaction, categoryId: DEFAULT_CATEGORY_ID }
          : transaction,
      );
      const budgets = state.budgets.filter((budget) => budget.categoryId !== action.payload.id);

      return {
        ...state,
        categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
        transactions,
        budgets,
      };
    }
    case 'SET_DATE_FILTER':
      return {
        ...state,
        dateFilter: action.payload,
      };
    case 'SET_BUDGETS':
      return {
        ...state,
        budgets: action.payload,
      };
    case 'ADD_BUDGET':
      return {
        ...state,
        budgets: [...state.budgets, action.payload],
      };
    case 'UPDATE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.map((budget) =>
          budget.id === action.payload.id ? { ...budget, ...action.payload } : budget,
        ),
      };
    case 'DELETE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.filter((budget) => budget.id !== action.payload.id),
      };
    case 'SET_CURRENCY':
      return {
        ...state,
        currency: action.payload,
      };
    case 'SET_THEME_PREFERENCE':
      return {
        ...state,
        themePreference: action.payload,
      };
    case 'SET_NOTIFICATION_PREFERENCES':
      return {
        ...state,
        notificationPreferences: action.payload,
      };
    case 'SET_ACCOUNTS': {
      const accounts = (action.payload.length > 0 ? action.payload : [DEFAULT_ACCOUNT]).map((account) => ({
        ...account,
        accountNumber: account.accountNumber ?? '',
        includeInBalance: account.includeInBalance ?? true,
      }));
      return {
        ...state,
        accounts,
      };
    }
    case 'ADD_ACCOUNT':
      return {
        ...state,
        accounts: [
          ...state.accounts,
          {
            ...action.payload,
            accountNumber: action.payload.accountNumber ?? '',
            includeInBalance: action.payload.includeInBalance ?? true,
          },
        ],
      };
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((account) =>
          account.id === action.payload.id
            ? {
                ...account,
                ...action.payload,
                accountNumber: action.payload.accountNumber ?? '',
                includeInBalance:
                  action.payload.includeInBalance ?? account.includeInBalance ?? true,
              }
            : account,
        ),
      };
    case 'DELETE_ACCOUNT': {
      const remainingAccounts = state.accounts.filter((account) => account.id !== action.payload.id);
      const accounts = remainingAccounts.length > 0 ? remainingAccounts : [DEFAULT_ACCOUNT];

      const transactions = state.transactions
        .filter((transaction) => {
          if (transaction.accountId !== action.payload.id) {
            return true;
          }
          if (action.payload.reassignAccountId) {
            return true;
          }
          return false;
        })
        .map((transaction) => {
          if (transaction.accountId !== action.payload.id) {
            return transaction;
          }

          if (action.payload.reassignAccountId) {
            return {
              ...transaction,
              accountId: action.payload.reassignAccountId,
            };
          }

          return transaction;
        });

      return {
        ...state,
        accounts,
        transactions,
      };
    }
    default:
      return state;
  }
}
