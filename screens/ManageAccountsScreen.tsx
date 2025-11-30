import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  RadioButton,
  Switch,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { v4 as uuidv4 } from 'uuid';

import { useAppContext } from '../context/AppContext';
import type { Account, AccountType, Transaction } from '../context/AppReducer';
import type { AppTheme } from '../theme/theme';
import { useFormatCurrency } from '../utils/currencyUtils';

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string; description: string; icon: string }> = [
  { value: 'cash', label: 'Cash', description: 'Wallet or petty cash on hand.', icon: 'wallet' },
  { value: 'bank', label: 'Bank', description: 'Checking or savings accounts.', icon: 'bank' },
  { value: 'credit', label: 'Credit Card', description: 'Credit or charge cards.', icon: 'credit-card-outline' },
  { value: 'debit', label: 'Debit Card', description: 'Debit or prepaid cards.', icon: 'credit-card' },
  { value: 'investment', label: 'Investment', description: 'Brokerage or investment funds.', icon: 'chart-line' },
  { value: 'other', label: 'Other', description: 'Any other type of account.', icon: 'dots-horizontal' },
];

const DEFAULT_FORM: {
  name: string;
  type: AccountType;
  accountNumber: string;
  initialBalance: string;
  includeInBalance: boolean;
} = {
  name: '',
  type: 'cash',
  accountNumber: '',
  initialBalance: '0',
  includeInBalance: true,
};

type AccountFormErrors = {
  name?: string;
  accountNumber?: string;
  initialBalance?: string;
};

type PendingDeletion = {
  account: Account;
  hasTransactions: boolean;
};

const ManageAccountsScreen = () => {
  const {
    state: { accounts, transactions },
    dispatch,
  } = useAppContext();
  const theme = useTheme<AppTheme>();
  const formatCurrency = useFormatCurrency();

  const [formVisible, setFormVisible] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<AccountFormErrors>({});
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [reassignAccountId, setReassignAccountId] = useState<string | null>(null);
  const [shouldDeleteTransactions, setShouldDeleteTransactions] = useState(false);

  const accountSummaries = useMemo(() => {
    const totalsByAccount = new Map<string, { balance: number; income: number; expense: number; count: number }>();

    accounts.forEach((account) => {
      totalsByAccount.set(account.id, {
        balance: account.initialBalance,
        income: 0,
        expense: 0,
        count: 0,
      });
    });

    transactions.forEach((transaction: Transaction) => {
      const summary = totalsByAccount.get(transaction.accountId);
      if (!summary) {
        return;
      }

      const isIncome = transaction.amount >= 0;
      if (isIncome) {
        summary.income += transaction.amount;
      } else {
        summary.expense += Math.abs(transaction.amount);
      }
      summary.balance += transaction.amount;
      summary.count += 1;
    });

    return accounts.map((account) => {
      const summary = totalsByAccount.get(account.id)!;
      return {
        account,
        balance: summary.balance,
        totalIncome: summary.income,
        totalExpense: summary.expense,
        transactionCount: summary.count,
      };
    });
  }, [accounts, transactions]);

  const otherAccounts = useMemo(
    () => (pendingDeletion ? accounts.filter((account) => account.id !== pendingDeletion.account.id) : accounts),
    [accounts, pendingDeletion],
  );

  const openCreateForm = useCallback(() => {
    setEditingAccountId(null);
    setFormValues(DEFAULT_FORM);
    setFormErrors({});
    setFormVisible(true);
  }, []);

  const openEditForm = useCallback((account: Account) => {
    setEditingAccountId(account.id);
    setFormValues({
      name: account.name,
      type: account.type,
      accountNumber: account.accountNumber ?? '',
      initialBalance: String(account.initialBalance),
      includeInBalance: account.includeInBalance ?? true,
    });
    setFormErrors({});
    setFormVisible(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormVisible(false);
    setFormErrors({});
    setFormValues(DEFAULT_FORM);
    setEditingAccountId(null);
  }, []);

  const validateForm = useCallback(() => {
    const errors: AccountFormErrors = {};
    const trimmedName = formValues.name.trim();
    const trimmedNumber = formValues.accountNumber.trim();

    if (!trimmedName) {
      errors.name = 'Account name is required';
    } else {
      const duplicate = accounts.find(
        (account) => account.name.toLowerCase() === trimmedName.toLowerCase() && account.id !== editingAccountId,
      );
      if (duplicate) {
        errors.name = 'An account with this name already exists';
      }
    }

    if (!trimmedNumber) {
      errors.accountNumber = 'Account number is required';
    } else {
      const duplicateNumber = accounts.find(
        (account) => account.accountNumber?.toLowerCase() === trimmedNumber.toLowerCase() && account.id !== editingAccountId,
      );
      if (duplicateNumber) {
        errors.accountNumber = 'This account number is already in use';
      }
    }

    if (formValues.initialBalance.trim().length === 0) {
      errors.initialBalance = 'Enter the starting balance';
    } else if (Number.isNaN(Number(formValues.initialBalance))) {
      errors.initialBalance = 'Enter a valid number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [accounts, editingAccountId, formValues.initialBalance, formValues.name]);

  const handleSubmitForm = useCallback(() => {
    if (!validateForm()) {
      return;
    }

    const trimmedNumber = formValues.accountNumber.trim();

    const payload: Account = {
      id: editingAccountId ?? uuidv4(),
      name: formValues.name.trim(),
      accountNumber: trimmedNumber,
      type: formValues.type,
      initialBalance: Number(formValues.initialBalance) || 0,
      includeInBalance: formValues.includeInBalance,
    };

    dispatch({ type: editingAccountId ? 'UPDATE_ACCOUNT' : 'ADD_ACCOUNT', payload });
    closeForm();
  }, [closeForm, dispatch, editingAccountId, formValues.name, formValues.type, formValues.initialBalance, validateForm]);

  const requestDeleteAccount = useCallback(
    (account: Account) => {
      const hasTransactions = transactions.some((transaction) => transaction.accountId === account.id);
      setPendingDeletion({ account, hasTransactions });
      setShouldDeleteTransactions(!hasTransactions);
      setReassignAccountId(null);
      setDeleteDialogVisible(true);
    },
    [transactions],
  );

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogVisible(false);
    setPendingDeletion(null);
    setShouldDeleteTransactions(false);
    setReassignAccountId(null);
  }, []);

  const confirmDeleteAccount = useCallback(() => {
    if (!pendingDeletion) {
      return;
    }

    const { account, hasTransactions } = pendingDeletion;

    if (hasTransactions && !shouldDeleteTransactions && !reassignAccountId) {
      return;
    }

    if (hasTransactions && shouldDeleteTransactions) {
      const remainingTransactions = transactions.filter((transaction) => transaction.accountId !== account.id);
      dispatch({ type: 'SET_TRANSACTIONS', payload: remainingTransactions });
      dispatch({ type: 'DELETE_ACCOUNT', payload: { id: account.id } });
    } else {
      dispatch({
        type: 'DELETE_ACCOUNT',
        payload: { id: account.id, reassignAccountId: reassignAccountId ?? undefined },
      });
    }

    closeDeleteDialog();
  }, [closeDeleteDialog, dispatch, pendingDeletion, reassignAccountId, shouldDeleteTransactions, transactions]);

  const renderAccount = useCallback(
    ({ item }: { item: typeof accountSummaries[number] }) => {
      const { account, balance, totalIncome, totalExpense, transactionCount } = item;

      return (
        <Surface style={[styles.accountCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.accountHeader}>
            <View>
              <Text variant="titleMedium" style={styles.accountName}>
                {account.name}
              </Text>
              <Text variant="bodySmall" style={[styles.accountType, { color: theme.colors.onSurfaceVariant }]}>
                {ACCOUNT_TYPE_OPTIONS.find((option) => option.value === account.type)?.label ?? 'Account'}
              </Text>
              {account.accountNumber ? (
                <Text variant="bodySmall" style={[styles.accountNumber, { color: theme.colors.onSurfaceVariant }]}
                >
                  {account.accountNumber}
                </Text>
              ) : null}
              {account.includeInBalance ? null : (
                <Text variant="bodySmall" style={[styles.excludedLabel, { color: theme.colors.error }]}>
                  Excluded from balance totals
                </Text>
              )}
            </View>
            <View style={styles.accountActions}>
              <IconButton
                icon="pencil"
                onPress={() => openEditForm(account)}
                accessibilityLabel={`Edit ${account.name}`}
              />
              <IconButton
                icon="trash-can"
                onPress={() => requestDeleteAccount(account)}
                accessibilityLabel={`Delete ${account.name}`}
              />
            </View>
          </View>

          <View style={styles.accountStatsRow}>
            <View style={styles.statColumn}>
              <Text variant="labelMedium" style={styles.statLabel}>
                Balance
              </Text>
              <Text variant="titleLarge" style={[styles.statValue, { color: theme.colors.primary }]}>
                {formatCurrency(balance)}
              </Text>
            </View>
            <View style={styles.statColumn}>
              <Text variant="labelMedium" style={styles.statLabel}>
                Income
              </Text>
              <Text variant="titleMedium" style={[styles.statValue, { color: theme.custom?.success ?? '#5CFAC7' }]}>
                {formatCurrency(totalIncome)}
              </Text>
            </View>
            <View style={styles.statColumn}>
              <Text variant="labelMedium" style={styles.statLabel}>
                Expense
              </Text>
              <Text variant="titleMedium" style={[styles.statValue, { color: theme.colors.error }]}>
                {formatCurrency(totalExpense)}
              </Text>
            </View>
          </View>

          <Text variant="bodySmall" style={[styles.transactionCount, { color: theme.colors.onSurfaceVariant }]}>
            {transactionCount === 0
              ? 'No transactions yet'
              : `${transactionCount} transaction${transactionCount === 1 ? '' : 's'}`}
          </Text>
        </Surface>
      );
    },
    [formatCurrency, openEditForm, requestDeleteAccount, theme.colors.error, theme.colors.onSurfaceVariant, theme.colors.primary, theme.custom?.success],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={accountSummaries}
        keyExtractor={(item) => item.account.id}
        renderItem={renderAccount}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <Surface style={[styles.headerCard, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Text variant="titleLarge" style={styles.headerTitle}>
              Accounts
            </Text>
            <Text variant="bodyMedium" style={[styles.headerDescription, { color: theme.colors.onSurfaceVariant }]}>
              Manage the wallets, cards, and bank accounts you track in the app.
            </Text>
            <Button mode="contained" icon="plus" onPress={openCreateForm}>
              Add account
            </Button>
          </Surface>
        )}
        ListEmptyComponent={(
          <Surface style={[styles.emptyStateCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <Text variant="titleMedium" style={styles.emptyStateTitle}>
              No accounts yet
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyStateBody, { color: theme.colors.onSurfaceVariant }]}>
              Create your first account to start assigning transactions.
            </Text>
            <Button mode="contained" icon="plus" onPress={openCreateForm}>
              Create account
            </Button>
          </Surface>
        )}
      />

      <Portal>
        <Dialog visible={formVisible} onDismiss={closeForm}>
          <Dialog.Title>{editingAccountId ? 'Edit account' : 'New account'}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput
                label="Account name"
                value={formValues.name}
                onChangeText={(value) => setFormValues((prev) => ({ ...prev, name: value }))}
                mode="outlined"
                outlineStyle={styles.textInputOutline}
                style={styles.textInput}
              />
              <HelperText type="error" visible={Boolean(formErrors.name)}>
                {formErrors.name}
              </HelperText>

              <TextInput
                label="Account number"
                value={formValues.accountNumber}
                onChangeText={(value) => setFormValues((prev) => ({ ...prev, accountNumber: value }))}
                mode="outlined"
                outlineStyle={styles.textInputOutline}
                style={styles.textInput}
                left={<TextInput.Icon icon="clipboard-text" />}
              />
              <HelperText type="error" visible={Boolean(formErrors.accountNumber)}>
                {formErrors.accountNumber}
              </HelperText>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextColumn}>
                  <Text variant="labelLarge" style={styles.toggleLabel}>
                    Include in balance totals
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.toggleDescription, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Turn off to exclude this account from the overview balance cards.
                  </Text>
                </View>
                <Switch
                  value={formValues.includeInBalance}
                  onValueChange={(value) => setFormValues((prev) => ({ ...prev, includeInBalance: value }))}
                  accessibilityLabel="Toggle whether this account counts toward balances"
                />
              </View>

              <Text variant="labelLarge" style={styles.typeLabel}>
                Type
              </Text>
              <RadioButton.Group
                onValueChange={(value) => setFormValues((prev) => ({ ...prev, type: value as AccountType }))}
                value={formValues.type}
              >
                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                  <View key={option.value} style={styles.radioItemRow}>
                    <RadioButton value={option.value} />
                    <View style={styles.radioTextColumn}>
                      <Text variant="labelLarge" style={styles.radioLabel}>
                        {option.label}
                      </Text>
                      <Text variant="bodySmall" style={styles.radioDescription}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </RadioButton.Group>

              <TextInput
                label="Starting balance"
                value={formValues.initialBalance}
                onChangeText={(value) => setFormValues((prev) => ({ ...prev, initialBalance: value }))}
                keyboardType="numeric"
                mode="outlined"
                outlineStyle={styles.textInputOutline}
                style={styles.textInput}
                left={<TextInput.Icon icon="cash" />}
              />
              <HelperText type="error" visible={Boolean(formErrors.initialBalance)}>
                {formErrors.initialBalance}
              </HelperText>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={closeForm}>Cancel</Button>
            <Button mode="contained" onPress={handleSubmitForm}>
              {editingAccountId ? 'Save changes' : 'Create account'}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={deleteDialogVisible} onDismiss={closeDeleteDialog}>
          <Dialog.Title>Delete account</Dialog.Title>
          <Dialog.Content>
            {pendingDeletion ? (
              <View>
                <Text variant="bodyMedium" style={styles.deleteBody}>
                  {`Are you sure you want to delete "${pendingDeletion.account.name}"?`}
                </Text>
                {pendingDeletion.hasTransactions ? (
                  <View style={styles.deleteOptions}>
                    <Text variant="labelLarge" style={styles.deleteLabel}>
                      The account has existing transactions.
                    </Text>
                    <RadioButton.Group
                      value={shouldDeleteTransactions ? 'delete' : 'reassign'}
                      onValueChange={(value) => {
                        setShouldDeleteTransactions(value === 'delete');
                      }}
                    >
                      <RadioButton.Item
                        value="reassign"
                        label="Reassign to another account"
                        labelStyle={styles.radioLabel}
                        position="leading"
                        style={styles.radioItem}
                      />
                      <RadioButton.Item
                        value="delete"
                        label="Delete transactions"
                        labelStyle={styles.radioLabel}
                        position="leading"
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                    {!shouldDeleteTransactions && (
                      <View style={styles.reassignList}>
                        <Text variant="bodySmall" style={styles.reassignHint}>
                          Choose the destination account for the transactions.
                        </Text>
                        <RadioButton.Group
                          value={reassignAccountId ?? ''}
                          onValueChange={(value) => setReassignAccountId(value)}
                        >
                          {otherAccounts.length === 0 ? (
                            <Text variant="bodyMedium" style={styles.reassignWarning}>
                              Create another account first to move these transactions.
                            </Text>
                          ) : (
                            otherAccounts.map((account) => (
                              <View key={account.id} style={styles.radioItemRow}>
                                <RadioButton value={account.id} />
                                <Text variant="bodyMedium" style={styles.radioLabel}>
                                  {account.name}
                                </Text>
                              </View>
                            ))
                          )}
                        </RadioButton.Group>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text variant="bodySmall" style={styles.deleteBody}>
                    This account has no transactions and can be safely removed.
                  </Text>
                )}
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDeleteDialog}>Cancel</Button>
            <Button
              mode="contained"
              onPress={confirmDeleteAccount}
              disabled={
                Boolean(pendingDeletion?.hasTransactions) &&
                !shouldDeleteTransactions &&
                otherAccounts.length > 0 &&
                !reassignAccountId
              }
            >
              Delete account
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
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  headerCard: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontWeight: '600',
  },
  headerDescription: {
    lineHeight: 20,
  },
  accountCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  accountName: {
    fontWeight: '600',
  },
  accountType: {
    marginTop: 2,
  },
  accountNumber: {
    marginTop: 4,
    letterSpacing: 0.4,
  },
  excludedLabel: {
    marginTop: 6,
    fontWeight: '600',
  },
  accountActions: {
    flexDirection: 'row',
  },
  accountStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
  },
  statColumn: {
    flex: 1,
  },
  statLabel: {
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontWeight: '600',
  },
  transactionCount: {
    opacity: 0.75,
  },
  emptyStateCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  emptyStateTitle: {
    fontWeight: '600',
  },
  emptyStateBody: {
    textAlign: 'center',
  },
  dialogContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  textInput: {
    marginTop: 4,
  },
  textInputOutline: {
    borderRadius: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  toggleTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontWeight: '600',
  },
  toggleDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  typeLabel: {
    marginTop: 12,
    marginBottom: 4,
  },
  radioItem: {
    borderRadius: 12,
  },
  radioItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioTextColumn: {
    flex: 1,
    marginLeft: 8,
  },
  radioLabel: {
    fontSize: 15,
  },
  radioDescription: {
    opacity: 0.7,
  },
  deleteBody: {
    marginBottom: 12,
  },
  deleteOptions: {
    gap: 12,
  },
  deleteLabel: {
    marginBottom: 4,
  },
  reassignList: {
    marginTop: 8,
  },
  reassignHint: {
    marginBottom: 6,
  },
  reassignWarning: {
    color: 'red',
  },
});

export default ManageAccountsScreen;
