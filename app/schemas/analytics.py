from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TopProduct(BaseModel):
    product_id: str
    product_name: str
    quantity_sold: Decimal
    revenue: Decimal


class RevenueByDay(BaseModel):
    date: date
    revenue: Decimal
    sales_count: int


class AnalyticsOverview(BaseModel):
    start_date: date
    end_date: date
    revenue: Decimal
    cost_of_goods_sold: Decimal
    gross_profit: Decimal
    expenses: Decimal
    net_profit: Decimal
    sales_count: int
    average_sale_value: Decimal
    total_discounts: Decimal
    total_tax_collected: Decimal
    inventory_value: Decimal
    low_stock_count: int
    top_products: list[TopProduct]
    revenue_by_day: list[RevenueByDay]
    revenue_by_payment_method: dict[str, Decimal]
