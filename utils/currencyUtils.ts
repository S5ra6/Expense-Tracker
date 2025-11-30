import { useCallback, useMemo } from 'react';

import { useAppContext } from '../context/AppContext';
import type { CurrencyOption } from '../context/AppReducer';

export const CURRENCY_LIST: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'en-HK' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', locale: 'es-MX' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', locale: 'ru-RU' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', locale: 'ar-SA' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', locale: 'he-IL' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', locale: 'pl-PL' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', locale: 'cs-CZ' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', locale: 'hu-HU' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', locale: 'es-AR' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', locale: 'es-CL' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', locale: 'es-CO' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', locale: 'es-PE' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$', locale: 'es-UY' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', locale: 'en-NG' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', locale: 'en-GH' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', locale: 'en-KE' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£', locale: 'ar-EG' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', locale: 'ar-MA' },
  { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'ރ', locale: 'en-MV' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', locale: 'ur-PK' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', locale: 'bn-BD' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', locale: 'th-TH' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', locale: 'vi-VN' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', locale: 'id-ID' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', locale: 'ms-MY' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', locale: 'en-PH' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', locale: 'zh-TW' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', locale: 'km-KH' },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', locale: 'lo-LA' },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', locale: 'my-MM' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', locale: 'ar-BH' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼', locale: 'ar-QA' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', locale: 'ar-KW' },
];

CURRENCY_LIST.sort((a, b) => a.name.localeCompare(b.name));

export const findCurrencyByCode = (code: string) =>
  CURRENCY_LIST.find((currency) => currency.code.toLowerCase() === code.toLowerCase());

export const filterCurrencies = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return CURRENCY_LIST;
  }

  return CURRENCY_LIST.filter(
    (currency) =>
      currency.name.toLowerCase().includes(normalized) || currency.code.toLowerCase().includes(normalized),
  );
};

export const formatAmountWithCurrency = (
  amount: number,
  currency: CurrencyOption,
  options?: Intl.NumberFormatOptions,
) => {
  const formatter = new Intl.NumberFormat(currency.locale ?? 'en-US', {
    style: 'currency',
    currency: currency.code ?? 'USD',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    ...options,
  });

  return formatter.format(amount);
};

export const useFormatCurrency = () => {
  const {
    state: { currency },
  } = useAppContext();

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(currency.locale ?? 'en-US', {
        style: 'currency',
        currency: currency.code ?? 'USD',
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
      }),
    [currency],
  );

  return useCallback((value: number) => formatter.format(value), [formatter]);
};
