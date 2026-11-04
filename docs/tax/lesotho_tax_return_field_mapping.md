# Lesotho Tax Return Field Mapping

**Purpose:** Map each field on the Lesotho return forms to existing Khoebo data, a deterministic calculation, or a required new data source.  
**Forms covered:** `S128-C`, `S128-I`, `S128-P`, `VAT-12`, `P16`, `FBT1`.  
**Prepared:** 4 November 2026.

## Mapping legend

| Code | Meaning |
| --- | --- |
| `DIRECT` | Existing repository field can be used directly after tenant/period filtering. |
| `COMPUTED` | Derived from existing fields or services using a documented formula. |
| `NEW` | Required data does not exist in the current schema. |
| `MANUAL` | Must be supplied or confirmed by the user for the first release. |
| `BLOCKED` | Cannot be completed reliably until a rule or data gap is resolved. |

Do not use `Sale.total` as turnover. `Sale.total` includes VAT: `subtotal − discount_amount + tax_amount`. Ledger revenue is credited at `subtotal`, discounts are debited separately, so net revenue is `subtotal − discount_amount`.

## 1. Existing repository source map

| Data | Source | Current limitation |
| --- | --- | --- |
| Business legal name | `Business.name` (`app/models/business.py:19`) | No legal name separate from trading name |
| Trading name / slug | `Business.slug` | Reference only |
| Owner / members | `Business.owner_id`, `BusinessMember` (`app/models/business.py:45`) | No partner or public-officer model |
| User identity | `User` (`app/models/user.py:10`) | No TIN or residency field |
| Accounts | `Account` (`app/models/accounting.py:33`) | No tax-line or VAT-treatment mapping |
| Journal entries | `JournalEntry` (`app/models/accounting.py:49`) | `entry_date` is the accounting date |
| Journal lines | `JournalLine` (`app/models/accounting.py:72`) | Debit/credit only; no tax code |
| Expenses | `Expense` (`app/models/accounting.py:95`) | No supplier, supplier TIN, invoice number, VAT amount or tax code |
| Sales | `Sale` (`app/models/sales.py:39`) | One header-level `tax_rate`; no per-line tax code |
| Sale lines | `SaleItem` (`app/models/sales.py:76`) | No tax code; `line_total` is pre-tax |
| Products | `Product` (`app/models/inventory.py:32`) | No VAT/tax code |
| Stock movements | `StockMovement` (`app/models/inventory.py:59`) | Historical quantity/cost source; no tax treatment |
| Trial balance | `trial_balance()` (`app/services/accounting.py:257`) | As-of date support |
| Income statement | `income_statement()` (`app/services/accounting.py:300`) | Revenue/expense totals by account |
| Sales summary | `sales_summary()` (`app/services/analytics.py:141`) | Gross revenue includes VAT; use `net_revenue`/ledger |
| Analytics overview | `overview()` (`app/services/analytics.py:23`) | Cash-basis-style sale/expense view |
| Report routes | `app/api/routes/reports.py:19` | Existing date-range and tenancy conventions |

### Critical source behaviours

1. `create_sale()` computes `subtotal = Σ(quantity × unit_price)`, then `taxable = subtotal − discount`, then `tax_amount = taxable × tax_rate`, then `total = taxable + tax_amount` (`app/services/sales.py:32`).
2. `post_sale_journal()` credits `4000 Sales Revenue` at `sale.subtotal`, debits `4010 Sales Discounts` at `sale.discount_amount`, credits `2200 Tax Payable` at `sale.tax_amount`, and debits cash at `sale.total` (`app/services/accounting.py:128`).
3. Sale journal date is `sale.created_at.date()`, not a user-entered supply date (`app/services/accounting.py:176`).
4. `refund_sale()` reverses the original journal with `date.today()`, not the original sale date or a user-selected credit-note date (`app/services/accounting.py:248`). This can move a refund into the wrong tax period.
5. `Expense` always credits cash; there is no accounts-payable lifecycle (`app/services/accounting.py:188`).
6. No current model captures customer country, export status, VAT number, supplier VAT invoice, import document or fixed asset.
7. `tax_rate` is a free numeric field; it is not a tax code and cannot distinguish standard, reduced, zero, exempt or out-of-scope.

## 2. Global return header mapping

| Form field | Source | Mapping | Notes |
| --- | --- | --- | --- |
| Legal name | `Business.name` / new `TaxProfile.legal_name` | `DIRECT` / `NEW` | Use `TaxProfile.legal_name` once available |
| Trading name | `Business.name` or `Business.slug` | `DIRECT` | Reference only |
| TIN | New `TaxProfile.tin` | `NEW` | Required on every form |
| VAT number | New `TaxProfile.vat_number` | `NEW` | Required on `VAT-12` |
| Tax period / year | New `TaxPeriod` | `NEW` | Must be derived from dated rules |
| Physical/postal address | New `TaxProfile` address fields | `NEW` | Not in current business model |
| District | New `TaxProfile.district` | `NEW` | `VAT-12` header |
| Resident/non-resident/part-year | New `TaxProfile.residency` and period days | `NEW` | Drives rates and `S128-I` Part H |
| Legal form | New `TaxProfile.legal_form` | `NEW` | Sole trader / partnership / company |
| Nature of business | New `TaxProfile.sector` / activity | `NEW` | Not a tax computation input by itself |
| Nominated officer / public officer | New `TaxProfile.nominated_officer_user_id` + `User` | `NEW` | Company and partnership |
| Contact details | `User.email`, `User.phone_number` | `DIRECT` | Use business contact where available |
| Currency | `Business.currency` | `DIRECT` | Must be `LSL` |
| Substituted year end | New `TaxProfile.tax_year_end` | `NEW` | Company only; requires approval evidence |
| Final return flag | New `TaxPeriod.final_return` | `NEW` | Out of business |
| Accounting method | New `TaxProfile.vat_accounting_method` | `NEW` | Invoice or approved cash method |
| Declaration/signature | New return finalisation data | `NEW` | No e-signature model today |

---

## 3. Company return: `FORM S128-C`

### 3.1 Header

| Field | Mapping |
| --- | --- |
| Approved substituted accounting date | `NEW` `TaxProfile.substituted_year_end` + approval document |
| Resident company / non-resident company / Lesotho branch / final return | `NEW` `TaxProfile.company_status` |
| Name of company | `Business.name` or `TaxProfile.legal_name` |
| TIN | `NEW` `TaxProfile.tin` |
| Email / telephone | `User` contact or `TaxProfile` contact |
| Nature of business | `NEW` `TaxProfile.sector` |
| Nominated officer name/designation | `NEW` `TaxProfile.nominated_officer` |
| Signature/declaration | `NEW` finalisation metadata |

### 3.2 Part A — Lesotho-source business income and expenses

Columns: (a) manufacturing, (b) commercial farming, (c) other business.

| Line | Mapping | Status | Notes |
| --- | --- | --- | --- |
| 1 Business income | Revenue/income accounts from `income_statement()` split by income category | `COMPUTED` + `MANUAL` split | Current ledger has no manufacturing/farming/other segment. Require a manual split or new income-category mapping; reconcile total to net revenue |
| 2 Total expenses | Expense accounts from `income_statement()` allocated to the same categories | `COMPUTED` + `MANUAL` split | No segment allocation model exists |
| 3 Net profit/loss | Line 1 − line 2 | `COMPUTED` | Do not include foreign/property/other income |

If a company has mixed categories, store a classification for each revenue/expense mapping and require the categories to reconcile to the income statement.

### 3.3 Part B — Foreign-source business income and expenses

| Line | Mapping | Status | Notes |
| --- | --- | --- | --- |
| 1 Foreign-source business income | New source/source-country tag on revenue | `NEW` | `Sale` has no country or source field |
| 2 Total expenses | New allocation of expenses to foreign-source income | `NEW` | No source allocation model |
| 3 Net profit/loss | Line 1 − line 2 | `COMPUTED` | — |

### 3.4 Part C — Property and other income

| Line | Mapping | Status | Notes |
| --- | --- | --- | --- |
| Section 1, 1a–1b property type/address | New property schedule | `NEW` | No property/rental model |
| Section 1, 2 gross rents | New rental income data | `NEW` | May use mapped revenue accounts only if manually tagged |
| Section 1, 3 expenses | New property expense allocation | `NEW` | — |
| Section 1, 4 net rental income/loss | Line 2 − line 3 | `COMPUTED` | — |
| Section 2, 5a interest/dividends/royalties | Mapped revenue accounts or new investment-income data | `COMPUTED` / `NEW` | No investment-income subtype today |
| Section 2, 5b gains on investment assets | New disposal data | `NEW` | No investment-asset register |
| Section 2, 5c other income | Mapped revenue accounts or manual schedule | `COMPUTED` / `NEW` | — |
| Section 2, 5d total | 5a + 5b + 5c | `COMPUTED` | — |
| Section 2, 6 expenses/losses/donations | New data or mapped expense accounts | `NEW` / `COMPUTED` | Donations to Lesotho Sports and Recreation Commission need evidence |
| Section 2, 7 net investment income/loss | 5d − 6 | `COMPUTED` | — |
| Section 3, 8 current-year net property/other | 4 + 7 | `COMPUTED` | — |

### 3.5 Part D — Chargeable income

| Line | Mapping | Status |
| --- | --- | --- |
| 1a manufacturing income/loss | Part A line 3(a) | `COMPUTED` |
| 1b manufacturing losses b/f | New loss carry-forward model | `NEW` |
| 1c chargeable manufacturing income | max(1a − 1b, 0) | `COMPUTED` |
| 2a commercial farming income/loss | Part A line 3(b) | `COMPUTED` |
| 2b farming losses b/f | New loss carry-forward model | `NEW` |
| 2c chargeable farming income | max(2a − 2b, 0) | `COMPUTED` |
| 3a other Lesotho business income/loss | Part A line 3(c) | `COMPUTED` |
| 3b Lesotho property/other income/loss | Part C line 8(a) | `COMPUTED` |
| 3c add 3a + 3b | — | `COMPUTED` |
| 3d other losses b/f | New loss carry-forward model | `NEW` |
| 3e chargeable business/property/other | max(3c − 3d, 0) | `COMPUTED` |
| 4a foreign farming income/loss | Part B line 3(a) | `COMPUTED` |
| 4b foreign farming losses b/f | New loss carry-forward model | `NEW` |
| 4c chargeable foreign farming | max(4a − 4b, 0) | `COMPUTED` |
| 4d foreign business income/loss | Part B line 3(b) | `COMPUTED` |
| 4e foreign property/other income/loss | Part C line 8(b) | `COMPUTED` |
| 4f add 4d + 4e | — | `COMPUTED` |
| 4g foreign business/property losses b/f | New loss carry-forward model | `NEW` |
| 4h chargeable foreign business/property/other | max(4f − 4g, 0) | `COMPUTED` |

### 3.6 Part E — Foreign tax credit

| Line | Mapping | Status |
| --- | --- | --- |
| 1a foreign-source farming income | Part D line 4a | `COMPUTED` |
| 1b prior-year foreign farming losses deducted | Loss model | `NEW` |
| 1c foreign farming income net | max(1a − 1b, 0) | `COMPUTED` |
| Columns (b)–(d): foreign tax paid, Lesotho tax, credit allowed | New foreign-tax-paid data and rule | `NEW` / `COMPUTED` |
| 1d foreign business/property income | Part D 4d + 4e | `COMPUTED` |
| 1e prior-year foreign losses deducted | Loss model | `NEW` |
| 1f foreign business/property income net | max(1d − 1e, 0) | `COMPUTED` |
| 2 total credit | 1c credit + 1f credit | `COMPUTED` |

### 3.7 Part F — Tax computation

| Line | Mapping | Status |
| --- | --- | --- |
| 1a manufacturing income × 10% | Part D 1c × 10% | `COMPUTED` |
| 1b commercial farming × 10% | Part D 2c × 10% | `COMPUTED` |
| 1c Lesotho business/property/other × 25% | Part D 3e × 25% | `COMPUTED` |
| 1c alternative 40% | Only s109 electing non-resident company | `COMPUTED` behind election flag |
| 1d foreign farming × 10% | Part D 4c × 10% | `COMPUTED` |
| 1e foreign business/property/other × 25% | Part D 4h × 25% | `COMPUTED` |
| 2 total tax before credits | 1a + 1b + 1c + 1d + 1e | `COMPUTED` |
| 3a foreign tax credit | Part E line 2 | `COMPUTED` |
| 3b WHT paid | New `TaxPayment` / WHT certificate records | `NEW` |
| 3c advance instalments | New `TaxPayment` records | `NEW` |
| 3d advance corporation tax | New ACT data if in scope | `NEW` |
| 4 total tax paid | 3a + 3b + 3c + 3d | `COMPUTED` |
| 5 tax due | max(2 − 4, 0) | `COMPUTED` |
| 6 tax overpaid | max(4 − 2, 0) | `COMPUTED` |

### 3.8 Part G — Related-party transactions

No related-party model exists. This is a manual schedule in the first release; it must not be auto-populated from ordinary customer/supplier names without an explicit relationship flag. `NEW`

---

## 4. Individual return: `FORM S128-I`

### 4.1 Header and Part A — Employment

| Field | Mapping | Status | Notes |
| --- | --- | --- | --- |
| Residency / part-year days | New `TaxProfile.residency` and period data | `NEW` | Drives rates and credit apportionment |
| Name / TIN / contact | `User` + new `TaxProfile` | `DIRECT` / `NEW` | — |
| Employer names/TINs and dates | New employment-income records or imported P16 data | `NEW` | No payroll model |
| 1a–1c gross employment income | P16/employment data | `NEW` | Not derivable from business ledger |
| 1d total gross employment income | 1a + 1b + 1c | `COMPUTED` | — |
| 2a travel expenses | Employment-expense data | `NEW` | — |
| 2b education expenses | Employment-expense data | `NEW` | — |
| 2c technical/trade books and subscriptions | Employment-expense data | `NEW` | — |
| 2d motor vehicle expenses | Employment-expense data | `NEW` | — |
| 2f approved superannuation contributions | Employment-expense data | `NEW` | — |
| 2g donations to Lesotho Sports and Recreation Commission | New donation evidence | `NEW` | — |
| 2h total | 2a + 2b + 2c + 2d + 2e + 2f + 2g | `COMPUTED` | Form labels contain a duplicated line; follow the current form version |
| 3 chargeable employment income | max(1d − 2h, 0) | `COMPUTED` | — |

### 4.2 Part B — Pension income

| Field | Mapping | Status |
| --- | --- | --- |
| Pension payer names/TINs/dates | New pension-income data | `NEW` |
| 1c total gross pension income | Sum payer records | `COMPUTED` |
| 2 donations | New donation evidence | `NEW` |
| 3 chargeable pension income | max(1c − 2, 0) | `COMPUTED` |

### 4.3 Part C — Business income and expenses

| Line | Mapping | Status | Notes |
| --- | --- | --- | --- |
| Principal business / address | `TaxProfile` / new business-activity data | `NEW` | — |
| 1 business income | `income_statement()` revenue accounts | `COMPUTED` | Use ledger net revenue, not `Sale.total` |
| 2 expenses | `income_statement()` expense accounts | `COMPUTED` | Tax adjustments may be needed |
| 3 net profit/loss | Line 1 − line 2 | `COMPUTED` | — |
| 4 partnership business income/loss | `PartnerDistribution` | `NEW` | No partner allocation model |
| 5 trust/estate income | New trust data | `NEW` | Out of first-release scope |
| 6 amount taxable | 3 + 4 + 5 | `COMPUTED` | — |
| 7 losses b/f | New loss carry-forward model | `NEW` | — |
| 8 chargeable business income | max(6 − 7, 0) | `COMPUTED` | — |

### 4.4 Part D — Commercial farming

| Line | Mapping | Status |
| --- | --- | --- |
| 1 farming income | Mapped revenue accounts or manual split | `COMPUTED` + `MANUAL` |
| 2 expenses | Mapped expense accounts or manual split | `COMPUTED` + `MANUAL` |
| 3 net profit/loss | 1 − 2 | `COMPUTED` |
| 4 partnership farming income | `PartnerDistribution` | `NEW` |
| 5 trust/estate farming income | New data | `NEW` |
| 6 amount taxable | 3 + 4 + 5 | `COMPUTED` |
| 7 losses b/f | Loss model | `NEW` |
| 8 chargeable farming income | max(6 − 7, 0) | `COMPUTED` |

### 4.5 Part E — Property income

No property/rental model exists. All property lines are `NEW` or manual. Existing revenue accounts may be used only if explicitly tagged as rental/property income and allocated to Lesotho/foreign source.

### 4.6 Part F — Other income

| Line | Mapping | Status |
| --- | --- | --- |
| 1 other income | New other-income data or mapped revenue accounts | `NEW` / `COMPUTED` |
| 2 expenses | Mapped expense accounts or manual schedule | `COMPUTED` / `NEW` |
| 3 chargeable other income | max(1 − 2, 0) | `COMPUTED` |

### 4.7 Part G — Foreign tax credit

All lines require `NEW` foreign-source income and foreign-tax-paid data. Compute the credit as the lesser of foreign tax paid and Lesotho tax on that income. `NEW` / `COMPUTED`

### 4.8 Part H — Tax computation

| Line | Mapping | Status |
| --- | --- | --- |
| 1a chargeable employment income | Part A line 3 | `COMPUTED` |
| 1b chargeable pension income | Part B line 3 | `COMPUTED` |
| 1c chargeable business income | Part C line 8(c) | `COMPUTED` |
| 1d chargeable commercial farming | Part D line 8(c) | `COMPUTED` |
| 1e chargeable property income | Part E line 12(c) | `COMPUTED` |
| 1f chargeable other income | Part F line 3(c) | `COMPUTED` |
| 2 total chargeable income | 1a + 1b + 1c + 1d + 1e + 1f | `COMPUTED` |
| 3a commercial farming × 10% | 1d × 10% | `COMPUTED` |
| 3b first bracket × 20% | min(2 − 1d, current 20% band) × 20% | `COMPUTED` |
| 3c remainder × 30% | max((2 − 1d) − 20% band, 0) × 30% | `COMPUTED` |
| 3d property/non-resident/under-18 × 25% or 40% | Only for the form's specified cases; not ordinary business income | `COMPUTED` behind explicit taxpayer-status flags |
| 4 total tax before credits | Sum 3a–3d | `COMPUTED` |
| 5a personal credit | Dated rule: 2026/27 M12,240; apportion part-year as required | `COMPUTED` |
| 5b foreign tax credit | Part G line 2 | `COMPUTED` |
| 6 total non-refundable credits | 5a + 5b, capped at tax | `COMPUTED` |
| 7 total tax after credits | max(4 − 6, 0) | `COMPUTED` |
| 8a PAYE | P16 data | `NEW` |
| 8b WHT paid | WHT certificates | `NEW` |
| 8c advance instalments | `TaxPayment` | `NEW` |
| 9 total payments | 8a + 8b + 8c | `COMPUTED` |
| 10 tax due | max(7 − 9, 0) | `COMPUTED` |
| 11 tax overpaid | max(9 − 7, 0) | `COMPUTED` |

**Historical form warning:** the 2023 `S128-I` prints M67,440 and M10,560. Those are not current. Use the dated rule set, not the form's printed amounts.

---

## 5. Partnership return: `FORM S128-P`

### 5.1 Header and Parts A–D

| Section | Mapping | Status | Notes |
| --- | --- | --- | --- |
| Partnership name/TIN/contact | `Business` + `TaxProfile` | `DIRECT` / `NEW` | — |
| Nominated officer | `TaxProfile.nominated_officer` | `NEW` | — |
| Part A line 1 business income | `income_statement()` revenue, split by manufacturing/farming/other | `COMPUTED` + `MANUAL` | No partnership segment model |
| Part A line 2 expenses | `income_statement()` expenses, allocated | `COMPUTED` + `MANUAL` | — |
| Part A line 3 net profit/loss | 1 − 2 | `COMPUTED` | — |
| Part B foreign income/expenses | New foreign-source data | `NEW` | — |
| Part C rental/investment/other | New property/investment data | `NEW` | — |
| Part D other income/expenses | New or mapped data | `NEW` / `COMPUTED` | — |

### 5.2 Part E — Foreign tax paid

All lines require new foreign-source and foreign-tax-paid data. `NEW`

### 5.3 Part F — Lesotho tax withheld

| Line | Mapping | Status |
| --- | --- | --- |
| 1 tax withheld as resident contractor | WHT certificate data | `NEW` |
| 2 tax withheld on Lesotho-source interest | WHT certificate data | `NEW` |

### 5.4 Part G — Partners and allocation

| Field | Mapping | Status |
| --- | --- | --- |
| Partner name | New `Partner.name` or linked `User` | `NEW` |
| Partner TIN | New `Partner.tin` | `NEW` |
| Postal address | New `Partner.address` | `NEW` |
| Resident partner Y/N | New `Partner.residency` | `NEW` |
| Percentage interest | New `Partner.ownership_percentage` | `NEW` |
| Manufacturing/farming/business/property/other allocations | `PartnerDistribution` | `NEW` |
| Foreign tax and WHT allocations | `PartnerDistribution` | `NEW` |

Validation requirements:

- Ownership percentages must total 100% for the period.
- Partner changes during the year require effective dates.
- Allocate each income/loss class separately; do not allocate only a single net profit.
- Provide each partner with the amounts needed for that partner's `S128-I`.
- A partner's loss share is limited to the adjusted cost base of the partner's interest.

No partnership-level tax is computed on `S128-P`; the return is an information/allocation return.

---

## 6. VAT return: `VAT-12`

### 6.1 Header

| Field | Mapping | Status |
| --- | --- | --- |
| Reference | New return reference | `NEW` |
| Accounting method: invoice / cash | `TaxProfile.vat_accounting_method` | `NEW` |
| TIN | `TaxProfile.tin` | `NEW` |
| VAT number | `TaxProfile.vat_number` | `NEW` |
| Tax period month/year | `TaxPeriod` | `NEW` |
| Legal name | `TaxProfile.legal_name` | `NEW` |
| Physical/postal address/district | `TaxProfile` | `NEW` |

### 6.2 Outputs

| Line | Field | Mapping | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Taxable sales at 15% (excl. VAT) | New sale-line tax code standard-rated | `NEW` | Current `Sale.tax_rate` is header-level and free-form |
| 2 | Taxable sales at 9% (excl. VAT) | Legacy electricity line; current electricity is 10% | `BLOCKED` | Do not map to 9%; require revised form/tax-code grouping |
| 3a | Local zero-rated sales | New sale-line tax code zero-rated local | `NEW` | — |
| 3b | Exports | New export flag/tax code | `NEW` | `Sale` has no country/export field |
| 4 | Exempt sales | New sale-line tax code exempt | `NEW` | — |
| 5 | Total value of taxable sales/output VAT (1+2+3a+3b) | Sum of standard/reduced/zero-rated taxable supply values | `COMPUTED` | Output VAT must be shown separately from taxable value |
| 6 | Value of total sales (1+2+3a+3b+4) | 5 + 4 | `COMPUTED` | Do not use `Sale.total`, which includes VAT |

Current source can provide `Sale.tax_amount` and `Sales Summary.tax_collected`, but cannot reliably split lines 1–4. VAT return preparation must be blocked until product/sale tax codes exist.

### 6.3 Inputs

| Line | Field | Mapping | Status | Notes |
| --- | --- | --- | --- | --- |
| 7a | Local purchases of goods | New purchase/invoice model | `NEW` | `Expense` has no VAT/supplier/invoice data |
| 7b | Local purchases of services | New purchase/invoice model | `NEW` | — |
| 8a | Imported goods — deferred payment/IVCF | New import data | `NEW` | — |
| 8b | Imported services — deferred payment/IVCF | New import data | `NEW` | — |
| 8c | Imported goods — other | New import data | `NEW` | — |
| 8d | Imported services — other | New import data | `NEW` | — |
| 9 | Total purchases/input VAT | 7a + 7b + 8a + 8b + 8c + 8d | `COMPUTED` | — |
| 10 | Deductible input VAT | New input-tax calculation | `NEW` | Only taxable-use acquisitions with valid evidence |
| 11 | Net VAT payable/refundable | 5 output VAT − 10 | `COMPUTED` | Form formula uses output VAT from line 5 |
| 12 | VAT refundable | max(−11, 0) | `COMPUTED` | Subject to s46 |
| 13 | VAT payable | max(11, 0) | `COMPUTED` | — |

### 6.4 Refund claim and declaration

| Field | Mapping | Status |
| --- | --- | --- |
| Claim refund for period/quarter | New refund-claim record | `NEW` |
| Name/status/signature/date/contact | `TaxProfile` + return finalisation metadata | `NEW` |
| Declaration | Versioned declaration text + finalisation audit | `NEW` |

**VAT mapping gate:** do not generate a final `VAT-12` from the current schema. The current `Sale.tax_rate`/`tax_amount` fields cannot distinguish standard, reduced, zero, exempt, exports or out-of-scope supplies, and there is no purchase/import VAT ledger.

---

## 7. Employee certificate: `FORM P16`

`P16` is an annual certificate issued by an employer to an employee. It is not currently generated by Khoebo.

| Field | Mapping | Status |
| --- | --- | --- |
| Year ended 31 March | `TaxPeriod` | `NEW` |
| Employed from/to | New employment record | `NEW` |
| Surname/names/TIN | `User` / new employee record | `NEW` |
| Postal address | New employee address | `NEW` |
| Designation / marital status | New employee record | `NEW` |
| Employer / employer postal address | `Business` / `TaxProfile` | `DIRECT` / `NEW` |
| (a) Gross earnings — salaries, wages, pension | New payroll data | `NEW` |
| (b) Other earnings — fees, bonus, commission, allowances | New payroll data | `NEW` |
| (c) Indirect earnings/benefits not under FBT | New payroll data | `NEW` |
| (d) Gross emoluments | (a) + (b) + (c) | `COMPUTED` |
| (e) Approved superannuation contributions | New payroll data | `NEW` |
| (f) Employment-based expenses | New payroll data | `NEW` |
| (g) Other allowable expenses | New payroll data | `NEW` |
| (h) Total allowable expenses/deductions | (e) + (f) + (g) | `COMPUTED` |
| Taxable income | (d) − (h) | `COMPUTED` |
| Income tax deducted | New payroll/PAYE data | `NEW` |
| Date/signature | Finalisation metadata | `NEW` |

`P16` requires a payroll/employee module or imported payroll data. It is out of the first release unless payroll is separately scoped.

---

## 8. Fringe benefits return: `FBT1`

### 8.1 Header and Part 1

| Field | Mapping | Status |
| --- | --- | --- |
| Taxpayer name/address/TIN | `Business` / `TaxProfile` | `DIRECT` / `NEW` |
| Date | Return metadata | `NEW` |
| Return period / quarter / tax year | `TaxPeriod` | `NEW` |
| Motor vehicles: employee count, gross taxable value, employee contribution | New employee benefit data | `NEW` |
| Housing | New employee benefit data | `NEW` |
| Utilities | New employee benefit data | `NEW` |
| Meal/refreshment | New employee benefit data | `NEW` |
| Domestic assistance | New employee benefit data | `NEW` |
| Medical | New employee benefit data | `NEW` |
| Loan | New employee benefit data | `NEW` |
| Debt waiver | New employee benefit data | `NEW` |
| Excessive superannuation contributions | New employee benefit data | `NEW` |
| Total | Sum of benefit values | `COMPUTED` |
| Less employees' contributions | Sum of contributions | `COMPUTED` |
| Net taxable value | Total − contributions | `COMPUTED` |
| Gross-up × 1.67 | Use exact `1/(1 − 0.40)`, then round | `COMPUTED` |
| FBT taxable amount × 40% | Rate from Fourth Schedule | `COMPUTED` |
| FBT due | Taxable amount × 40% | `COMPUTED` |

### 8.2 Part 2 — Motor vehicles

For each vehicle:

```text
gross_taxable_value =
    value_at_first_private_use × 15% × days_available / days_in_year
  - employee_contribution
```

Inputs `NEW`: make/model/year, cost when new, value at first private use, days available, employee contribution.

### 8.3 Part 3 — Housing

For each property:

```text
gross_taxable_value =
    lesser(market_rental_value, 20% × employee_remuneration)
  - employee_contribution
```

Inputs `NEW`: property description/address, market rental, 20% remuneration calculation, employee contribution.

FBT is a separate module requiring employee and benefit data. It should not be inferred from ordinary business expenses.

---

## 9. Required new data structures

| Structure | Needed for | Minimum fields |
| --- | --- | --- |
| `TaxProfile` | All forms | legal form, legal name, TIN, VAT number/status, residency, year end, sector, accounting basis, addresses, nominated officer |
| `TaxPeriod` | All forms | tax type, start, end, due date, status, lock/finalisation |
| `TaxRuleSet` / `TaxBracket` | All computations | tax year/type, effective dates, rates, bands, credits, thresholds |
| `TaxAccountMapping` | Income tax/VAT | account, tax line, income category, VAT treatment, effective dates |
| `TaxAdjustment` | Income tax | period, category, amount, direction, evidence, approval |
| `TaxCode` | VAT | standard/reduced/zero/exempt/out-of-scope; effective dates |
| `SaleItem.tax_code_id` | VAT | Per-line tax treatment; required to split `VAT-12` lines |
| `Purchase` / `PurchaseLine` | VAT/expenses | supplier, TIN/VAT number, invoice number/date, goods/services, VAT amount, import/customs evidence |
| `TaxPayment` | All returns | tax type, period, date, amount, method, reference, receipt |
| `TaxReturn` / `TaxReturnLine` | All returns | snapshot, version, status, totals, source data, rule versions |
| `FixedAsset` / depreciation schedule | Income tax | group, acquisition date, cost, WDV, disposal, tax depreciation |
| `Partner` / `PartnerDistribution` | Partnerships | TIN, residency, percentage, capital, allocations |
| `EmploymentIncome` / payroll data | P16/PAYE | employer, employee, gross income, deductions, PAYE |
| `FringeBenefit` data | FBT1 | employee, benefit type, taxable value, contribution |
| `Document` | Evidence | VAT invoices, WHT certificates, P16, import documents, prior returns |
| `FilingAttempt` / `TaxAuditEvent` | Operations | channel, status, references, audit trail |

## 10. Gating conditions

A return must not be finalised when any of these are true:

- The taxpayer profile is incomplete for the selected form.
- The tax period is not locked or overlaps a finalised period.
- Income categories do not reconcile to the ledger.
- A VAT return has sales with no tax code or untagged exports.
- A VAT return has input VAT without valid invoice evidence.
- Ownership percentages for a partnership do not total 100%.
- Loss carry-forwards or foreign tax credits lack supporting schedules.
- A fixed-asset schedule is missing for a taxpayer claiming depreciation.
- The return uses an `open` rule or a rule without an effective date.
- A material ledger-to-return variance is unexplained.

## 11. Reconciliation rules

| Check | Required comparison |
| --- | --- |
| Revenue | Return turnover vs `income_statement()` revenue, excluding tax |
| Sales detail | Ledger net revenue vs `sales_summary().net_revenue` |
| Output VAT | Return output VAT vs posted `2200 Tax Payable` credits attributable to sales |
| COGS/inventory | Return COGS vs `5000` and stock movement evidence |
| Expenses | Return deductions vs `income_statement()` expenses plus adjustments |
| Taxable income | Sum of category incomes vs adjusted accounting profit |
| Tax payable | Recomputed tax vs stored return lines |
| Payments | Tax due/refund vs `TaxPayment` and credits |
| VAT | Output − input vs `VAT-12` line 11 |
| Balance sheet | Trial balance balances; inventory valuation reconciles |

A finalised return must store the exact source period, ledger snapshot, rule versions, adjustments, calculations, PDF hash and filing/payment metadata.
