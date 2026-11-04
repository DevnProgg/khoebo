import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type {
  Account,
  AnalyticsOverview,
  Business,
  DueReminder,
  Expense,
  IncomeStatement,
  InventoryValuation,
  JournalEntry,
  Member,
  MemberRole,
  PaymentMethod,
  Product,
  Reminder,
  ReminderFrequency,
  ReminderType,
  Sale,
  SaleStatus,
  SalesSummary,
  StockMovement,
  StockMovementType,
  TokenPair,
  TrialBalance,
  TaxCalculation,
  TaxDeadline,
  TaxFiling,
  TaxReturn,
  TaxAccountingSummary,
  TaxWarning,
  User,
} from './types';
import {
  cacheKey,
  cacheResponse,
  enqueueRequest,
  getCachedResponse,
  getQueuedRequests,
  removeQueuedRequest,
} from './offline';

const DEFAULT_API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/v1'
    : 'http://localhost:8000/api/v1';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');

const ACCESS_KEY = 'khoebo_access_token';
const REFRESH_KEY = 'khoebo_refresh_token';
const isWeb = Platform.OS === 'web';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readKey(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      void 0;
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteKey(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      void 0;
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function loadStoredTokens(): Promise<boolean> {
  accessToken = await readKey(ACCESS_KEY);
  refreshToken = await readKey(REFRESH_KEY);
  return Boolean(accessToken || refreshToken);
}

export async function storeTokens(pair: TokenPair): Promise<void> {
  accessToken = pair.access_token;
  refreshToken = pair.refresh_token;
  await Promise.all([
    writeKey(ACCESS_KEY, pair.access_token),
    writeKey(REFRESH_KEY, pair.refresh_token),
  ]);
}

export async function clearStoredTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([deleteKey(ACCESS_KEY), deleteKey(REFRESH_KEY)]);
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function extractDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Something went wrong. Please try again.';
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = String((item as { msg: unknown }).msg);
          return msg.charAt(0).toUpperCase() + msg.slice(1);
        }
        return String(item);
      })
      .join('\n');
  }
  return 'Something went wrong. Please try again.';
}

function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (!entries.length) return '';
  return `?${entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')}`;
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const token = refreshToken ?? (await readKey(REFRESH_KEY));
    if (!token) return false;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: token }),
      });
      if (!response.ok) return false;
      const pair = (await response.json()) as TokenPair;
      await storeTokens(pair);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
  headers?: Record<string, string>;
  queueOffline?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    retry = true,
    headers,
    queueOffline = true,
  } = options;
  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (auth && accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    if (method === 'GET') {
      const cached = await getCachedResponse<T>(cacheKey(path));
      if (cached !== null) return cached;
    } else if (queueOffline && auth) {
      await enqueueRequest({ method, path, body, auth });
      throw new ApiError(0, 'Saved on this device. It will sync when you are online.');
    }
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 401 && auth) {
    if (retry && (await refreshSession())) {
      return request<T>(path, { ...options, retry: false });
    }
    await clearStoredTokens();
    unauthorizedHandler?.();
    throw new ApiError(401, 'Your session expired. Please sign in again.');
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      void 0;
    }
    throw new ApiError(response.status, extractDetail(payload));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  const payload = JSON.parse(text) as T;
  if (method === 'GET') await cacheResponse(cacheKey(path), payload);
  return payload;
}

export async function flushOfflineQueue(): Promise<number> {
  let synced = 0;
  const queued = await getQueuedRequests();
  for (const item of queued) {
    try {
      await request(item.path, {
        method: item.method,
        body: item.body,
        auth: item.auth,
        queueOffline: false,
      });
      await removeQueuedRequest(item.id);
      synced += 1;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        await removeQueuedRequest(item.id);
        continue;
      }
      break;
    }
  }
  return synced;
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string | null;
  unit_price?: number;
  cost_price?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
}

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price?: number;
}

export interface SaleInput {
  items: SaleItemInput[];
  customer_name?: string | null;
  discount_amount?: number;
  tax_rate?: number;
  payment_method?: PaymentMethod;
  notes?: string | null;
}

export interface JournalLineInput {
  account_id: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalEntryInput {
  entry_date: string;
  memo: string;
  lines: JournalLineInput[];
}

export const api = {
  auth: {
    register: (payload: {
      email?: string;
      phone_number?: string;
      full_name: string;
      password: string;
    }) => request<User>('/auth/register', { method: 'POST', body: payload, auth: false }),
    login: (payload: { identifier: string; password: string }) =>
      request<TokenPair>('/auth/login', { method: 'POST', body: payload, auth: false }),
    me: () => request<User>('/auth/me'),
    logout: (refresh: string) =>
      request<void>('/auth/logout', {
        method: 'POST',
        body: { refresh_token: refresh },
        auth: false,
      }),
    changePassword: (payload: { current_password: string; new_password: string }) =>
      request<void>('/auth/change-password', { method: 'POST', body: payload }),
    updateProfile: (payload: { full_name?: string }) =>
      request<User>('/users/me', { method: 'PATCH', body: payload }),
  },
  businesses: {
    list: () => request<Business[]>('/businesses'),
    get: (businessId: string) => request<Business>(`/businesses/${businessId}`),
    create: (payload: { name: string; currency: string }) =>
      request<Business>('/businesses', { method: 'POST', body: payload }),
    update: (businessId: string, payload: { name?: string; currency?: string }) =>
      request<Business>(`/businesses/${businessId}`, { method: 'PATCH', body: payload }),
    remove: (businessId: string) =>
      request<void>(`/businesses/${businessId}`, { method: 'DELETE' }),
    members: (businessId: string) => request<Member[]>(`/businesses/${businessId}/members`),
    addMember: (businessId: string, payload: { email: string; role: MemberRole }) =>
      request<Member>(`/businesses/${businessId}/members`, { method: 'POST', body: payload }),
    updateMember: (businessId: string, userId: string, role: MemberRole) =>
      request<Member>(`/businesses/${businessId}/members/${userId}`, {
        method: 'PATCH',
        body: { role },
      }),
    removeMember: (businessId: string, userId: string) =>
      request<void>(`/businesses/${businessId}/members/${userId}`, { method: 'DELETE' }),
  },
  products: {
    list: (
      businessId: string,
      params: { search?: string; low_stock_only?: boolean; include_inactive?: boolean } = {},
    ) => request<Product[]>(`/businesses/${businessId}/products${queryString(params)}`),
    get: (businessId: string, productId: string) =>
      request<Product>(`/businesses/${businessId}/products/${productId}`),
    create: (businessId: string, payload: ProductInput) =>
      request<Product>(`/businesses/${businessId}/products`, { method: 'POST', body: payload }),
    update: (businessId: string, productId: string, payload: Partial<ProductInput> & { is_active?: boolean }) =>
      request<Product>(`/businesses/${businessId}/products/${productId}`, {
        method: 'PATCH',
        body: payload,
      }),
    deactivate: (businessId: string, productId: string) =>
      request<void>(`/businesses/${businessId}/products/${productId}`, { method: 'DELETE' }),
    movements: (businessId: string, productId: string) =>
      request<StockMovement[]>(
        `/businesses/${businessId}/products/${productId}/stock-movements`,
      ),
    addMovement: (
      businessId: string,
      productId: string,
      payload: {
        movement_type: StockMovementType;
        quantity: number;
        unit_cost?: number | null;
        reason?: string | null;
      },
    ) =>
      request<StockMovement>(
        `/businesses/${businessId}/products/${productId}/stock-movements`,
        { method: 'POST', body: payload },
      ),
  },
  sales: {
    list: (
      businessId: string,
      params: {
        status?: SaleStatus;
        start_date?: string;
        end_date?: string;
        limit?: number;
        offset?: number;
      } = {},
    ) => request<Sale[]>(`/businesses/${businessId}/sales${queryString(params)}`),
    get: (businessId: string, saleId: string) =>
      request<Sale>(`/businesses/${businessId}/sales/${saleId}`),
    create: (businessId: string, payload: SaleInput) =>
      request<Sale>(`/businesses/${businessId}/sales`, { method: 'POST', body: payload }),
    refund: (businessId: string, saleId: string) =>
      request<Sale>(`/businesses/${businessId}/sales/${saleId}/refund`, { method: 'POST' }),
  },
  accounting: {
    accounts: (businessId: string) =>
      request<Account[]>(`/businesses/${businessId}/accounts`),
    journalEntries: (
      businessId: string,
      params: { start_date?: string; end_date?: string; limit?: number; offset?: number } = {},
    ) =>
      request<JournalEntry[]>(
        `/businesses/${businessId}/journal-entries${queryString(params)}`,
      ),
    createJournalEntry: (businessId: string, payload: JournalEntryInput) =>
      request<JournalEntry>(`/businesses/${businessId}/journal-entries`, {
        method: 'POST',
        body: payload,
      }),
    expenses: (
      businessId: string,
      params: { start_date?: string; end_date?: string; limit?: number; offset?: number } = {},
    ) => request<Expense[]>(`/businesses/${businessId}/expenses${queryString(params)}`),
    createExpense: (
      businessId: string,
      payload: {
        description: string;
        amount: number;
        expense_date: string;
        payment_method: PaymentMethod;
        account_id?: string | null;
      },
    ) =>
      request<Expense>(`/businesses/${businessId}/expenses`, {
        method: 'POST',
        body: payload,
      }),
  },
  reports: {
    trialBalance: (businessId: string, asOf?: string) =>
      request<TrialBalance>(
        `/businesses/${businessId}/reports/trial-balance${queryString({ as_of: asOf })}`,
      ),
    incomeStatement: (businessId: string, startDate: string, endDate: string) =>
      request<IncomeStatement>(
        `/businesses/${businessId}/reports/income-statement${queryString({
          start_date: startDate,
          end_date: endDate,
        })}`,
      ),
    inventoryValuation: (businessId: string) =>
      request<InventoryValuation>(`/businesses/${businessId}/reports/inventory-valuation`),
    salesSummary: (businessId: string, startDate: string, endDate: string) =>
      request<SalesSummary>(
        `/businesses/${businessId}/reports/sales-summary${queryString({
          start_date: startDate,
          end_date: endDate,
        })}`,
      ),
  },
  analytics: {
    overview: (businessId: string, startDate: string, endDate: string) =>
      request<AnalyticsOverview>(
        `/businesses/${businessId}/analytics/overview${queryString({
          start_date: startDate,
          end_date: endDate,
        })}`,
      ),
  },
  tax: {
    summary: (businessId: string, start: string, end: string) =>
      request<TaxAccountingSummary>(
        `/businesses/${businessId}/tax/summaries${queryString({ start, end })}`,
      ),
    calculation: (businessId: string, taxType: string, start: string, end: string) =>
      request<TaxCalculation>(
        `/businesses/${businessId}/tax/calculations${queryString({ tax_type: taxType, start, end })}`,
      ),
    deadlines: (businessId: string, taxType = 'income_tax', count = 4) =>
      request<{ tax_type: string; rule_version: string | null; deadlines: TaxDeadline[] }>(
        `/businesses/${businessId}/tax/deadlines${queryString({ tax_type: taxType, count })}`,
      ),
    returns: (businessId: string, limit = 20) =>
      request<TaxReturn[]>(`/businesses/${businessId}/tax/returns${queryString({ limit })}`),
    generate: (businessId: string, taxType: string, start: string, end: string) =>
      request<TaxReturn>(`/businesses/${businessId}/tax/returns`, {
        method: 'POST',
        body: { tax_type: taxType, reporting_start: start, reporting_end: end },
      }),
    validate: (businessId: string, returnId: string) =>
      request<{ return_id: string; status: string; validation: TaxCalculation['validation']; warnings: TaxWarning[] }>(
        `/businesses/${businessId}/tax/returns/${returnId}/validate`,
        { method: 'POST' },
      ),
    approve: (businessId: string, returnId: string) =>
      request<TaxReturn>(`/businesses/${businessId}/tax/returns/${returnId}/approve`, { method: 'POST' }),
    portal: (businessId: string) =>
      request<{ url: string; automated: boolean; notice: string }>(`/businesses/${businessId}/tax/filing-portal`),
    handoff: (businessId: string, returnId: string) =>
      request<{ filing: TaxFiling; automated: boolean; notice: string }>(
        `/businesses/${businessId}/tax/returns/${returnId}/filing-handoff`,
        { method: 'POST' },
      ),
    filings: (businessId: string, limit = 20) =>
      request<TaxFiling[]>(`/businesses/${businessId}/tax/filings${queryString({ limit })}`),
  },
  reminders: {
    list: (businessId: string, includeInactive = false) =>
      request<Reminder[]>(
        `/businesses/${businessId}/reminders${queryString({
          include_inactive: includeInactive || undefined,
        })}`,
      ),
    due: (businessId: string) =>
      request<DueReminder[]>(`/businesses/${businessId}/reminders/due`),
    create: (
      businessId: string,
      payload: {
        type: ReminderType;
        title: string;
        message?: string | null;
        frequency: ReminderFrequency;
        next_due_at?: string;
        is_active?: boolean;
      },
    ) => request<Reminder>(`/businesses/${businessId}/reminders`, { method: 'POST', body: payload }),
    update: (
      businessId: string,
      reminderId: string,
      payload: Partial<{
        title: string;
        message: string | null;
        frequency: ReminderFrequency;
        next_due_at: string;
        is_active: boolean;
      }>,
    ) =>
      request<Reminder>(`/businesses/${businessId}/reminders/${reminderId}`, {
        method: 'PATCH',
        body: payload,
      }),
    trigger: (businessId: string, reminderId: string) =>
      request<Reminder>(`/businesses/${businessId}/reminders/${reminderId}/trigger`, {
        method: 'POST',
      }),
    snooze: (businessId: string, reminderId: string, days = 1) =>
      request<Reminder>(
        `/businesses/${businessId}/reminders/${reminderId}/snooze${queryString({ days })}`,
        { method: 'POST' },
      ),
    remove: (businessId: string, reminderId: string) =>
      request<void>(`/businesses/${businessId}/reminders/${reminderId}`, {
        method: 'DELETE',
      }),
  },
};
