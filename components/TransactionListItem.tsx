import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Chip, IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

import type { Transaction, Category } from '../context/AppReducer';
import type { AppTheme } from '../theme/theme';
import { useFormatCurrency } from '../utils/currencyUtils';

const CATEGORY_COLORS = ['#4AF3BE', '#58A6FF', '#F5A524', '#FF6BD6', '#C792EA', '#0CF5E8', '#FCB0B3', '#9DE561'];

const resolveIconName = (icon?: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  if (icon && icon in MaterialCommunityIcons.glyphMap) {
    return icon as keyof typeof MaterialCommunityIcons.glyphMap;
  }
  return 'dots-circle';
};

const computeCategoryColor = (category?: Category | null): string => {
  if (!category?.id) {
    return CATEGORY_COLORS[0];
  }
  const hash = category.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
};

type TransactionListItemProps = {
  transaction: Transaction;
  category?: Category | null;
  accountName?: string | null;
  onPress: () => void;
  onDelete: () => void;
  onViewReceipt?: (uri: string) => void;
};

const TransactionListItem = ({ transaction, category, accountName, onPress, onDelete, onViewReceipt }: TransactionListItemProps) => {
  const theme = useTheme<AppTheme>();
  const formatCurrency = useFormatCurrency();
  let displayDate = '';
  try {
    const parsed = new Date(transaction.date);
    displayDate = Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'PP');
  } catch (_error) {
    displayDate = '';
  }

  const isIncome = transaction.amount >= 0;
  const amountColor = isIncome ? theme.custom?.success ?? '#5CFAC7' : theme.colors.error;
  const amountPrefix = isIncome ? '+' : '-';
  const formattedAmount = `${amountPrefix}${formatCurrency(Math.abs(transaction.amount))}`;

  const iconName = resolveIconName(category?.icon);
  const categoryColor = computeCategoryColor(category);
  const categoryLabel = category?.name ?? 'Uncategorized';
  const showAccountChip = Boolean(accountName);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} mode="contained">
      <TouchableRipple onPress={onPress} borderless={false} rippleColor={`${theme.colors.primary}55`} style={styles.pressArea}>
        <Card.Content style={styles.content}>
          <View style={styles.primaryRow}>
            <View style={styles.primaryLeft}>
              <View
                style={[styles.iconBadge, { shadowColor: categoryColor, backgroundColor: `${categoryColor}22` }]}
              >
                <MaterialCommunityIcons name={iconName} size={20} color={categoryColor} />
              </View>
              <Text
                variant="titleSmall"
                style={[styles.titleText, { color: theme.colors.onSurface }]}>
                {transaction.title}
              </Text>
            </View>
            <View style={styles.primaryRight}>
              <Text variant="titleMedium" style={[styles.amountText, { color: amountColor }]}>
                {formattedAmount}
              </Text>
              <IconButton
                icon="delete-outline"
                size={20}
                onPress={onDelete}
                accessibilityLabel={`Delete ${transaction.title}`}
                style={styles.deleteButton}
                iconColor={theme.colors.onSurfaceVariant}
              />
            </View>
          </View>
          <View style={styles.secondaryRow}>
            <View style={styles.secondaryLeft}>
              {showAccountChip && (
                <Chip
                  compact
                  mode="outlined"
                  style={[styles.accountChip, { borderColor: `${theme.colors.primary}33` }]}
                  textStyle={[styles.accountChipText, { color: theme.colors.primary }]}
                  icon="wallet"
                >
                  {accountName}
                </Chip>
              )}
              <Chip
                compact
                mode="flat"
                style={[styles.categoryChip, { backgroundColor: `${categoryColor}1F` }]}
                textStyle={[styles.categoryChipText, { color: theme.colors.onSurfaceVariant }]}
              >
                {categoryLabel}
              </Chip>
            </View>
            <View style={styles.secondaryRight}>
              {transaction.receiptUri && onViewReceipt && (
                <TouchableOpacity
                  onPress={() => onViewReceipt(transaction.receiptUri!)}
                  style={styles.receiptButton}
                  accessibilityRole="button"
                  accessibilityLabel={`View receipt for ${transaction.title}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name="paperclip"
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              )}
              <Text
                variant="bodySmall"
                style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}
              >
                {displayDate}
              </Text>
            </View>
          </View>
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 5,
  },
  pressArea: {
    flex: 1,
    borderRadius: 18,
  },
  content: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  primaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 4,
    marginRight: 12,
  },
  titleText: {
    flex: 1,
    fontWeight: '600',
  },
  amountText: {
    minWidth: 96,
    textAlign: 'right',
    fontWeight: '700',
    marginRight: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  secondaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountChip: {
    marginRight: 8,
  },
  accountChipText: {
    fontWeight: '600',
  },
  categoryChip: {
    marginRight: 0,
  },
  categoryChipText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    opacity: 0.7,
  },
  receiptButton: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  deleteButton: {
    margin: 0,
  },
});

export default TransactionListItem;
