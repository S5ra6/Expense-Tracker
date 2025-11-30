import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  List,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  Menu,
  useTheme,
} from 'react-native-paper';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

import { useAppContext } from '../context/AppContext';
import type { Transaction, TransactionType, Category } from '../context/AppReducer';
import { DEFAULT_CATEGORY_ID, DEFAULT_ACCOUNT_ID } from '../context/AppReducer';
import {
  buildBudgetAlertKey,
  hasBudgetAlertBeenSent,
  markBudgetAlertSent,
  sendBudgetAlertNotification,
} from '../services/notifications';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import type { AppTheme } from '../theme/theme';

const SNACKBAR_DURATION = 3000;

const RECEIPTS_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}receipts`
  : null;

const ensureReceiptsDirectoryAsync = async () => {
  if (!RECEIPTS_DIRECTORY) {
    return null;
  }
  const dirInfo = await FileSystem.getInfoAsync(RECEIPTS_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPTS_DIRECTORY, { intermediates: true });
  }
  return RECEIPTS_DIRECTORY;
};

const isManagedReceiptUri = (uri: string | null | undefined) =>
  Boolean(RECEIPTS_DIRECTORY && uri && uri.startsWith(RECEIPTS_DIRECTORY));

const createManagedReceiptPath = (extension: string) => {
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
  return `${RECEIPTS_DIRECTORY}/${Date.now()}-${Math.random().toString(36).slice(2)}.${sanitizedExtension}`;
};

const persistReceiptAsync = async (uri: string): Promise<string> => {
  if (!RECEIPTS_DIRECTORY) {
    return uri;
  }

  await ensureReceiptsDirectoryAsync();

  if (isManagedReceiptUri(uri)) {
    return uri;
  }

  const uriWithoutQuery = uri.split('?')[0];
  const extension = uriWithoutQuery.includes('.') ? uriWithoutQuery.split('.').pop() ?? 'jpg' : 'jpg';
  const destination = createManagedReceiptPath(extension);
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
};

const deleteManagedReceiptAsync = async (uri: string | null | undefined) => {
  if (!uri || !isManagedReceiptUri(uri)) {
    return;
  }
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('Failed to delete receipt file', error);
  }
};

type AddTransactionScreenProps = NativeStackScreenProps<HomeStackParamList, 'AddTransaction'>;

type FormErrors = {
  title?: string;
  amount?: string;
  categoryId?: string;
  accountId?: string;
  receiptUri?: string;
};

const AddTransactionScreen = ({ route, navigation }: AddTransactionScreenProps) => {
  const {
    transactionId,
    initialType: initialTypeParam,
    initialCategoryId: initialCategoryParam,
    initialAccountId: initialAccountParam,
  } = route.params ?? {};

  const {
    state: { transactions, categories, accounts, budgets },
    dispatch,
  } = useAppContext();

  const theme = useTheme<AppTheme>();
  const existingTransaction = useMemo(
    () => transactions.find((transaction: Transaction) => transaction.id === transactionId) ?? null,
    [transactionId, transactions],
  );

  const fallbackCategoryId = useMemo(() => {
    if (categories.length === 0) {
      return DEFAULT_CATEGORY_ID;
    }
    const defaultCategory = categories.find((category) => category.id === DEFAULT_CATEGORY_ID);
    return defaultCategory?.id ?? categories[0].id;
  }, [categories]);

  const initialCategoryId = useMemo(() => {
    if (existingTransaction?.categoryId) {
      return existingTransaction.categoryId;
    }
    if (initialCategoryParam && categories.some((category) => category.id === initialCategoryParam)) {
      return initialCategoryParam;
    }
    return fallbackCategoryId;
  }, [existingTransaction, fallbackCategoryId, initialCategoryParam, categories]);

  const fallbackAccountId = useMemo(() => {
    if (accounts.length === 0) {
      return DEFAULT_ACCOUNT_ID;
    }
    return accounts[0].id;
  }, [accounts]);

  const initialAccountId = useMemo(() => {
    if (existingTransaction?.accountId) {
      return existingTransaction.accountId;
    }
    if (initialAccountParam && accounts.some((account) => account.id === initialAccountParam)) {
      return initialAccountParam;
    }
    return fallbackAccountId;
  }, [accounts, existingTransaction, fallbackAccountId, initialAccountParam]);

  const [title, setTitle] = useState(existingTransaction?.title ?? '');
  const [amount, setAmount] = useState(existingTransaction ? String(existingTransaction.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [categoryInput, setCategoryInput] = useState(() => {
    if (!initialCategoryId) {
      return '';
    }
    const initialCategory = categories.find((category) => category.id === initialCategoryId);
    return initialCategory?.name ?? '';
  });
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [hasCategoryInteracted, setHasCategoryInteracted] = useState(false);
  const [accountId, setAccountId] = useState<string>(initialAccountId);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [date, setDate] = useState<Date>(existingTransaction ? new Date(existingTransaction.date) : new Date());
  const [showIOSDatePicker, setShowIOSDatePicker] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(existingTransaction?.receiptUri ?? null);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);

  const defaultTransactionType = useMemo<TransactionType>(
    () => existingTransaction?.type ?? initialTypeParam ?? 'expense',
    [existingTransaction, initialTypeParam],
  );

  const toggleAmountSign = useCallback(() => {
    if (!amount.trim()) {
      setAmount(defaultTransactionType === 'income' ? '1' : '-1');
      setErrors((prev) => ({ ...prev, amount: undefined }));
      return;
    }

    const numericValue = Number(amount);
    if (Number.isNaN(numericValue)) {
      return;
    }

    if (numericValue === 0) {
      setAmount(defaultTransactionType === 'income' ? '1' : '-1');
      setErrors((prev) => ({ ...prev, amount: undefined }));
      return;
    }

    setAmount(String(numericValue * -1));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  }, [amount, defaultTransactionType]);

  useEffect(() => {
    if (!existingTransaction) {
      return;
    }

    setTitle(existingTransaction.title);
    setAmount(String(existingTransaction.amount));
    setDate(new Date(existingTransaction.date));
    setAccountId(existingTransaction.accountId);
    setReceiptUri(existingTransaction.receiptUri ?? null);
  }, [existingTransaction]);

  useEffect(() => {
    const validCategoryIds = new Set(categories.map((category) => category.id));

    if (existingTransaction?.categoryId && validCategoryIds.has(existingTransaction.categoryId)) {
      setCategoryId(existingTransaction.categoryId);
      const match = categories.find((category) => category.id === existingTransaction.categoryId);
      if (match) {
        setCategoryInput(match.name);
      }
      setHasCategoryInteracted(false);
      return;
    }

    if (categoryId && validCategoryIds.has(categoryId)) {
      if (!categoryInput) {
        const match = categories.find((category) => category.id === categoryId);
        if (match) {
          setCategoryInput(match.name);
        }
      }
      return;
    }

    if (hasCategoryInteracted) {
      return;
    }

    const fallback = fallbackCategoryId ?? null;
    setCategoryId(fallback);
    if (fallback) {
      const fallbackCategory = categories.find((category) => category.id === fallback);
      if (fallbackCategory) {
        setCategoryInput((current) => current || fallbackCategory.name);
      }
    }
  }, [categories, existingTransaction, categoryId, categoryInput, fallbackCategoryId, hasCategoryInteracted]);

  useEffect(() => {
    if (accounts.length === 0) {
      if (accountId !== DEFAULT_ACCOUNT_ID) {
        setAccountId(DEFAULT_ACCOUNT_ID);
      }
      return;
    }

    const exists = accounts.some((account) => account.id === accountId);
    if (!exists) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const resetErrors = useCallback(() => setErrors({}), []);

  const onChangeDate = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        onChange: onChangeDate,
      });
    } else {
      setShowIOSDatePicker(true);
    }
  };

  const categorySuggestions = useMemo(() => {
    const query = categoryInput.trim().toLowerCase();
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

    if (!query) {
      return sortedCategories;
    }

    return sortedCategories.filter((category) => category.name.toLowerCase().includes(query));
  }, [categories, categoryInput]);

  const hasExactCategoryMatch = useMemo(
    () =>
      categories.some(
        (category) => category.name.toLowerCase() === categoryInput.trim().toLowerCase(),
      ),
    [categories, categoryInput],
  );

  const shouldShowCategorySuggestions =
    categoryDropdownOpen &&
    (categorySuggestions.length > 0 || (!hasExactCategoryMatch && categoryInput.trim().length > 0));

  const handleCategoryChange = useCallback(
    (text: string) => {
      resetErrors();
      setCategoryInput(text);
      setHasCategoryInteracted(true);
      const normalized = text.trim().toLowerCase();
      if (!text.trim()) {
        setCategoryId(null);
        setCategoryDropdownOpen(true);
        return;
      }
      const match = categories.find((category) => category.name.toLowerCase() === normalized);
      setCategoryId(match ? match.id : null);
      setCategoryDropdownOpen(true);
    },
    [categories, resetErrors],
  );

  const handleCategorySelect = useCallback(
    (option: Category) => {
      setCategoryId(option.id);
      setCategoryInput(option.name);
      setCategoryDropdownOpen(false);
      resetErrors();
      setHasCategoryInteracted(true);
      Keyboard.dismiss();
    },
    [resetErrors],
  );

  const clearCategoryInput = useCallback(() => {
    resetErrors();
    setCategoryInput('');
    setCategoryId(null);
    setCategoryDropdownOpen(true);
    setHasCategoryInteracted(true);
  }, [resetErrors]);

  const handleCategoryFocus = useCallback(() => {
    setCategoryDropdownOpen(true);
  }, []);

  const handleCategoryBlur = useCallback(() => {
    setTimeout(() => {
      setCategoryDropdownOpen(false);
    }, 120);
  }, []);

  const handleAttachReceipt = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        setIsProcessingReceipt(true);
        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Permission required',
            source === 'camera'
              ? 'Camera access is needed to take a photo of your receipt.'
              : 'Photo library access is needed to attach a receipt from your device.',
          );
          return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.6,
                allowsEditing: true,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
              });

        if (result.canceled || !result.assets?.length) {
          return;
        }

        const asset = result.assets[0];
        const persistentUri = await persistReceiptAsync(asset.uri);

        if (receiptUri && receiptUri !== persistentUri) {
          await deleteManagedReceiptAsync(receiptUri);
        }

        setReceiptUri(persistentUri);
        setErrors((prev) => ({ ...prev, receiptUri: undefined }));
      } catch (error) {
        console.warn('Failed to attach receipt', error);
        setErrors((prev) => ({ ...prev, receiptUri: 'Unable to attach receipt. Please try again.' }));
      } finally {
        setIsProcessingReceipt(false);
      }
    },
    [receiptUri],
  );

  const promptReceiptAttachment = useCallback(() => {
    Alert.alert(
      receiptUri ? 'Update receipt' : 'Attach receipt',
      'Choose how you want to include a receipt image.',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            void handleAttachReceipt('camera');
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            void handleAttachReceipt('library');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  }, [handleAttachReceipt, receiptUri]);

  const handleRemoveReceipt = useCallback(async () => {
    if (!receiptUri) {
      return;
    }
    try {
      setIsProcessingReceipt(true);
      await deleteManagedReceiptAsync(receiptUri);
      setReceiptUri(null);
      setErrors((prev) => ({ ...prev, receiptUri: undefined }));
    } catch (error) {
      console.warn('Failed to remove receipt', error);
      setErrors((prev) => ({ ...prev, receiptUri: 'Unable to remove receipt. Please try again.' }));
    } finally {
      setIsProcessingReceipt(false);
    }
  }, [receiptUri]);

  const validate = () => {
    const newErrors: FormErrors = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    const parsedAmount = Number(amount);
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
      newErrors.amount = 'Enter a non-zero number';
    }
    if (!categoryInput.trim()) {
      newErrors.categoryId = 'Category is required';
    }
    if (!accountId || !accounts.some((account) => account.id === accountId)) {
      newErrors.accountId = 'Select an account';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const evaluateBudgetAlert = useCallback(
    async (updatedTransaction: Transaction, updatedTransactionsList: Transaction[]) => {
      if (updatedTransaction.type !== 'expense' || !updatedTransaction.categoryId) {
        return;
      }

      const transactionDate = new Date(updatedTransaction.date);
      const monthKey = format(transactionDate, 'yyyy-MM');

      const matchingBudget = budgets.find(
        (budget) => budget.categoryId === updatedTransaction.categoryId && budget.month === monthKey,
      );

      if (!matchingBudget || matchingBudget.amount <= 0) {
        return;
      }

      const totalSpending = updatedTransactionsList.reduce((total, txn) => {
        if (txn.type !== 'expense' || txn.categoryId !== updatedTransaction.categoryId) {
          return total;
        }

        const txnMonthKey = format(new Date(txn.date), 'yyyy-MM');
        if (txnMonthKey !== monthKey) {
          return total;
        }

        const expenseAmount = txn.amount < 0 ? Math.abs(txn.amount) : txn.amount;
        return total + expenseAmount;
      }, 0);

      const percentUsed = totalSpending / matchingBudget.amount;
      if (percentUsed < 0.9) {
        return;
      }

      const alertKey = buildBudgetAlertKey(updatedTransaction.categoryId, monthKey);
      const alreadyNotified = await hasBudgetAlertBeenSent(alertKey);
      if (alreadyNotified) {
        return;
      }

      const categoryName =
        categories.find((category) => category.id === updatedTransaction.categoryId)?.name ?? 'this category';

      await sendBudgetAlertNotification(categoryName, percentUsed);
      await markBudgetAlertSent(alertKey);
    },
    [budgets, categories],
  );

  const handleSave = async () => {
    resetErrors();
    if (!validate()) {
      return;
    }

    const parsedAmount = Number(amount);
    const trimmedCategoryName = categoryInput.trim();
    let resolvedCategoryId = categoryId;

    const resolvedAccountId = accountId && accounts.some((account) => account.id === accountId)
      ? accountId
      : fallbackAccountId;

    if (trimmedCategoryName) {
      const existingCategoryMatch = categories.find(
        (category) => category.name.toLowerCase() === trimmedCategoryName.toLowerCase(),
      );

      if (existingCategoryMatch) {
        resolvedCategoryId = existingCategoryMatch.id;
      } else {
        const newCategory: Category = {
          id: uuidv4(),
          name: trimmedCategoryName,
          icon: 'shape-outline',
        };
        dispatch({ type: 'ADD_CATEGORY', payload: newCategory });
        resolvedCategoryId = newCategory.id;
        setCategoryId(newCategory.id);
        setCategoryInput(newCategory.name);
      }
    }

    const finalCategoryId = resolvedCategoryId ?? fallbackCategoryId;

    const transactionPayload: Transaction = {
      id: existingTransaction?.id ?? uuidv4(),
      title: title.trim(),
      amount: parsedAmount,
      date: date.toISOString(),
      categoryId: finalCategoryId,
      type: parsedAmount >= 0 ? 'income' : 'expense',
      accountId: resolvedAccountId,
      receiptUri: receiptUri ?? null,
    };

    const updatedTransactionsList = existingTransaction
      ? transactions.map((transaction) => (transaction.id === transactionPayload.id ? transactionPayload : transaction))
      : [transactionPayload, ...transactions];

    dispatch({
      type: existingTransaction ? 'UPDATE_TRANSACTION' : 'ADD_TRANSACTION',
      payload: transactionPayload,
    });

    try {
      await evaluateBudgetAlert(transactionPayload, updatedTransactionsList);
    } catch (error) {
      console.warn('Failed to evaluate budget alert', error);
    }

    setSnackbarVisible(true);
    setTimeout(() => {
      navigation.goBack();
    }, 1000);
  };

  const actionLabel = existingTransaction ? 'Save Changes' : 'Save Transaction';

  const gradientColors = theme.custom?.gradientBackground ?? [theme.colors.background, theme.colors.background];
  const cardBackground = theme.colors.surface;

  const renderErrorText = (message?: string) => (
    <HelperText type="error" visible={Boolean(message)} style={styles.helperTextError}>
      {message}
    </HelperText>
  );

  const selectedCategory = useMemo(
    () => categories.find((category: Category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId],
  );

  const amountPreviewValue = Number(amount);
  const inferredTransactionType: TransactionType = Number.isNaN(amountPreviewValue)
    ? defaultTransactionType
    : amountPreviewValue >= 0
      ? 'income'
      : 'expense';
  const amountHintColor = inferredTransactionType === 'income'
    ? theme.custom?.success ?? '#5CFAC7'
    : theme.colors.error;
  const amountHintText = !amount.trim()
    ? 'Positive amounts are treated as income. Add a minus sign for expenses.'
    : inferredTransactionType === 'income'
      ? 'Recorded as income.'
      : 'Recorded as expense.';

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface elevation={4} style={[styles.container, { backgroundColor: cardBackground }]}
          >
            <View style={styles.headerBlock}>
              <Text variant="headlineSmall" style={styles.headingText}>
                {existingTransaction ? 'Edit Transaction' : 'New Transaction'}
              </Text>
              <Text variant="bodyMedium" style={[styles.subheadingText, { color: theme.colors.onSurfaceVariant }]}
              >
                Track both income and expenses to keep your balance luminous.
              </Text>
            </View>

            <View style={styles.formField}>
              <Text variant="labelLarge" style={styles.label}>
                Account
              </Text>
              <Menu
                visible={accountMenuVisible}
                onDismiss={() => setAccountMenuVisible(false)}
                anchor={(
                  <Button
                    mode="outlined"
                    icon="wallet"
                    onPress={() => setAccountMenuVisible(true)}
                    style={styles.accountButton}
                    contentStyle={styles.accountButtonContent}
                  >
                    {selectedAccount ? selectedAccount.name : 'Select account'}
                  </Button>
                )}
              >
                {accounts.length === 0 ? (
                  <Menu.Item title="No accounts available" disabled />
                ) : (
                  accounts.map((account) => (
                    <Menu.Item
                      key={account.id}
                      title={account.name}
                      onPress={() => {
                        setAccountId(account.id);
                        setErrors((prev) => ({ ...prev, accountId: undefined }));
                        setAccountMenuVisible(false);
                      }}
                      trailingIcon={account.id === accountId ? 'check' : undefined}
                    />
                  ))
                )}
              </Menu>
              {renderErrorText(errors.accountId)}
            </View>

            <View style={styles.formField}>
              <TextInput
                label="Title"
                value={title}
                onChangeText={(text: string) => {
                  if (errors.title) {
                    setErrors((prev) => ({ ...prev, title: undefined }));
                  }
                  setTitle(text);
                }}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                style={styles.textInput}
                left={<TextInput.Icon icon="pencil-outline" />}
              />
              {renderErrorText(errors.title)}
            </View>

            <View style={styles.formField}>
              <TextInput
                label="Amount"
                value={amount}
                onChangeText={(text: string) => {
                  if (errors.amount) {
                    setErrors((prev) => ({ ...prev, amount: undefined }));
                  }
                  setAmount(text);
                }}
                keyboardType="numeric"
                mode="outlined"
                outlineStyle={styles.inputOutline}
                style={styles.textInput}
                left={<TextInput.Icon icon="cash-multiple" />}
                right={
                  <TextInput.Icon
                    icon="plus-minus"
                    onPress={toggleAmountSign}
                    forceTextInputFocus={false}
                  />
                }
              />
              {renderErrorText(errors.amount)}
              <Text style={[styles.amountHint, { color: amountHintColor }]}>
                {amountHintText}
              </Text>
            </View>

            <View style={styles.formField}>
              <Text variant="labelLarge" style={styles.label}>
                Date
              </Text>
              <Button
                mode="outlined"
                onPress={openDatePicker}
                icon="calendar-blank"
                style={styles.ghostButton}
              >
                {format(date, 'PP')}
              </Button>
              <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                Tap to change the transaction date.
              </Text>
            </View>

            <View style={styles.formField}>
              <Text variant="labelLarge" style={styles.label}>
                Category
              </Text>
              <TextInput
                label="Category"
                value={categoryInput}
                onFocus={handleCategoryFocus}
                onBlur={handleCategoryBlur}
                onChangeText={handleCategoryChange}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                style={styles.textInput}
                placeholder="Type to search or create"
                left={<TextInput.Icon icon={selectedCategory?.icon ?? 'shape-outline'} />}
                right={
                  categoryInput
                    ? (
                        <TextInput.Icon
                          icon="close"
                          onPress={clearCategoryInput}
                          forceTextInputFocus={false}
                        />
                      )
                    : undefined
                }
              />
              <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                Start typing to search or create a category.
              </Text>
              {shouldShowCategorySuggestions && (
                <Surface
                  elevation={3}
                  style={[styles.categorySuggestionSurface, { backgroundColor: theme.colors.surface }]}
                >
                  {categorySuggestions.length > 0 ? (
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={styles.categorySuggestionList}
                    >
                      {categorySuggestions.map((option) => (
                        <List.Item
                          key={option.id}
                          title={option.name}
                          onPress={() => handleCategorySelect(option)}
                          left={(props) => <List.Icon {...props} icon={option.icon ?? 'shape-outline'} />}
                          right={(props) =>
                            option.id === categoryId ? (
                              <List.Icon {...props} icon="check" color={theme.colors.primary} />
                            ) : null
                          }
                          style={styles.categorySuggestionItem}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text
                      variant="bodyMedium"
                      style={[styles.noCategoryResults, { color: theme.colors.onSurfaceVariant }]}
                    >
                      No matching categories. Enter a new name to create one.
                    </Text>
                  )}
                </Surface>
              )}
              {renderErrorText(errors.categoryId)}
              <View style={styles.receiptInlineContainer}>
                <Text variant="labelLarge" style={styles.label}>
                  Receipt (optional)
                </Text>
                {receiptUri ? (
                  <Surface
                    style={[styles.receiptPreview, { backgroundColor: theme.colors.surfaceVariant }]}
                    elevation={1}
                  >
                    <Image source={{ uri: receiptUri }} style={styles.receiptImage} />
                    <View style={styles.receiptActions}>
                      <Button
                        mode="outlined"
                        icon="image-edit"
                        onPress={promptReceiptAttachment}
                        disabled={isProcessingReceipt}
                        style={styles.receiptActionButton}
                      >
                        Replace
                      </Button>
                      <Button
                        mode="text"
                        icon="delete"
                        onPress={handleRemoveReceipt}
                        disabled={isProcessingReceipt}
                        textColor={theme.colors.error}
                      >
                        Remove
                      </Button>
                    </View>
                  </Surface>
                ) : (
                  <Button
                    mode="outlined"
                    icon="paperclip"
                    onPress={promptReceiptAttachment}
                    disabled={isProcessingReceipt}
                    style={styles.attachButton}
                  >
                    Attach receipt
                  </Button>
                )}
                <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                  Snap a photo or pick one from your gallery to keep it on file.
                </Text>
                {renderErrorText(errors.receiptUri)}
              </View>
            </View>

            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.saveButton, { shadowColor: theme.custom?.glow ?? theme.colors.primary }]}
              contentStyle={styles.saveContent}
              icon="content-save"
            >
              {actionLabel}
            </Button>
          </Surface>
        </ScrollView>

        <Portal>
          {showIOSDatePicker && (
            <View style={styles.iosPickerContainer}>
              <Surface style={styles.iosPickerSurface}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                    setShowIOSDatePicker(false);
                    onChangeDate(event, selectedDate ?? date);
                  }}
                />
                <Button onPress={() => setShowIOSDatePicker(false)} mode="contained" style={styles.iosPickerButton}>
                  Done
                </Button>
              </Surface>
            </View>
          )}
        </Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={SNACKBAR_DURATION}
          style={styles.snackbar}
        >
          Transaction Saved!
        </Snackbar>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingVertical: 28,
    flexGrow: 1,
  },
  container: {
    borderRadius: 24,
    padding: 24,
  },
  headerBlock: {
    marginBottom: 24,
  },
  headingText: {
    marginBottom: 4,
  },
  subheadingText: {
    opacity: 0.8,
  },
  formField: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
  inputOutline: {
    borderRadius: 14,
  },
  label: {
    marginBottom: 10,
  },
  accountButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
  },
  accountButtonContent: {
    paddingHorizontal: 12,
  },
  helperText: {
    marginTop: 8,
    opacity: 0.7,
  },
  attachButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  helperTextError: {
    marginTop: 6,
  },
  amountHint: {
    marginTop: 6,
    fontSize: 12,
  },
  ghostButton: {
    borderRadius: 14,
  },
  categorySuggestionSurface: {
    marginTop: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  categorySuggestionList: {
    maxHeight: 220,
  },
  categorySuggestionItem: {
    paddingVertical: 4,
  },
  noCategoryResults: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  receiptInlineContainer: {
    marginTop: 18,
  },
  receiptPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
  },
  receiptImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#FFFFFF1a',
    marginRight: 12,
  },
  receiptActions: {
    flex: 1,
  },
  receiptActionButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  saveButton: {
    marginTop: 12,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  saveContent: {
    paddingVertical: 4,
  },
  iosPickerContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  iosPickerSurface: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  iosPickerButton: {
    marginHorizontal: 16,
  },
  snackbar: {
    backgroundColor: '#0CF5E8',
  },
});

export default AddTransactionScreen;
