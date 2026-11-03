export type ID = string;
export type Decimal = string | number;

export type MemberRole = 'owner' | 'admin' | 'member';
export type SaleStatus = 'completed' | 'refunded' | 'void';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type StockMovementType = 'in' | 'out' | 'adjustment';
export type ReminderType = 'low_stock' | 'record_sales' | 'inventory_count' | 'custom';
export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

export interface User {
  id: ID;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Business {
  id: ID;
  name: string;
  slug: string;
  currency: string;
  owner_id: ID;
  created_at: string;
}

export interface Member {
  user_id: ID;
  email: string;
  full_name: string;
  role: MemberRole;
  joined_at: string;
}

export interface Product {
  id: ID;
  business_id: ID;
  sku: string;
  name: string;
  description: string | null;
  unit_price: Decimal;
  cost_price: Decimal;
  stock_quantity: Decimal;
  low_stock_threshold: Decimal;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: ID;
  product_id: ID;
  movement_type: StockMovementType;
  quantity: Decimal;
  unit_cost: Decimal | null;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: ID | null;
  created_at: string;
}

export interface SaleItem {
  id: ID;
  product_id: ID;
  product_name: string;
  quantity: Decimal;
  unit_price: Decimal;
  unit_cost: Decimal;
  line_total: Decimal;
}

export interface Sale {
  id: ID;
  business_id: ID;
  reference: string;
  customer_name: string | null;
  status: SaleStatus;
  payment_method: PaymentMethod;
  subtotal: Decimal;
  discount_amount: Decimal;
  tax_rate: Decimal;
  tax_amount: Decimal;
  total: Decimal;
  notes: string | null;
  created_by: ID | null;
  created_at: string;
  refunded_at: string | null;
  items: SaleItem[];
}

export interface Account {
  id: ID;
  business_id: ID;
  code: string;
  name: string;
  type: AccountType;
  is_system: boolean;
}

export interface JournalLine {
  id: ID;
  account_id: ID;
  description: string | null;
  debit: Decimal;
  credit: Decimal;
}

export interface JournalEntry {
  id: ID;
  business_id: ID;
  entry_date: string;
  memo: string;
  reference_type: string | null;
  reference_id: string | null;
  created_by: ID | null;
  created_at: string;
  lines: JournalLine[];
}

export interface Expense {
  id: ID;
  business_id: ID;
  description: string;
  amount: Decimal;
  expense_date: string;
  payment_method: string;
  account_id: ID;
  journal_entry_id: ID | null;
  created_at: string;
}

export interface Reminder {
  id: ID;
  business_id: ID;
  user_id: ID;
  type: ReminderType;
  title: string;
  message: string | null;
  frequency: ReminderFrequency;
  next_due_at: string;
  last_triggered_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DueReminder {
  reminder: Reminder;
  overdue: boolean;
  context: {
    low_stock_products?: Product[];
    low_stock_count?: number;
    sales_recorded_today?: number;
  } | null;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  quantity_sold: Decimal;
  revenue: Decimal;
}

export interface RevenueByDay {
  date: string;
  revenue: Decimal;
  sales_count: number;
}

export interface AnalyticsOverview {
  start_date: string;
  end_date: string;
  revenue: Decimal;
  cost_of_goods_sold: Decimal;
  gross_profit: Decimal;
  expenses: Decimal;
  net_profit: Decimal;
  sales_count: number;
  average_sale_value: Decimal;
  total_discounts: Decimal;
  total_tax_collected: Decimal;
  inventory_value: Decimal;
  low_stock_count: number;
  top_products: TopProduct[];
  revenue_by_day: RevenueByDay[];
  revenue_by_payment_method: Record<string, Decimal>;
}

export interface TrialBalanceRow {
  account_id: ID;
  code: string;
  name: string;
  type: AccountType;
  debit: Decimal;
  credit: Decimal;
  balance: Decimal;
}

export interface TrialBalance {
  as_of: string | null;
  accounts: TrialBalanceRow[];
  total_debit: Decimal;
  total_credit: Decimal;
  balanced: boolean;
}

export interface IncomeStatementLine {
  code: string;
  name: string;
  amount: Decimal;
}

export interface IncomeStatement {
  start_date: string;
  end_date: string;
  revenue: IncomeStatementLine[];
  expenses: IncomeStatementLine[];
  total_revenue: Decimal;
  total_expenses: Decimal;
  net_income: Decimal;
}

export interface InventoryValuationItem {
  product_id: ID;
  sku: string;
  name: string;
  quantity: Decimal;
  cost_price: Decimal;
  value: Decimal;
}

export interface InventoryValuation {
  items: InventoryValuationItem[];
  total_units: Decimal;
  total_value: Decimal;
}

export interface SalesSummary {
  start_date: string;
  end_date: string;
  total_sales: number;
  completed_sales: number;
  refunded_sales: number;
  gross_revenue: Decimal;
  net_revenue: Decimal;
  discounts: Decimal;
  tax_collected: Decimal;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}
