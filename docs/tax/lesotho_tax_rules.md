# Lesotho Tax Rules

**Jurisdiction:** Kingdom of Lesotho  
**Currency:** Lesotho Loti (LSL)  
**Prepared:** 4 November 2026  
**Current standard tax year:** 1 April 2026 – 31 March 2027  
**Status:** Research reference for implementation. Not legal or tax advice.

This document records the rules that Khoebo may implement, with an explicit source and verification status for each rule. Rules must be stored as dated data, not hardcoded. When a primary instrument and an RSL guide conflict, the primary instrument controls and the conflict is recorded in `lesotho_unresolved_questions.md`.

## Verification labels

| Label | Meaning |
| --- | --- |
| `primary` | Directly verified in an Act, regulation, legal notice or gazette. |
| `official-secondary` | Stated by RSL in an official guide, form or tax-rate page, but not directly verified in the primary instrument. |
| `open` | Not resolved, conflicting, inaccessible, or dependent on a future RSL notice. Do not automate without review. |
| `historical` | Applies only to the stated prior period. |

---

## 1. Tax year, taxpayer types and returns

### 1.1 Year of assessment

| Rule | Value | Status | Source |
| --- | --- | --- | --- |
| Standard year of assessment | 12 months ending 31 March | `primary` | ITA 1993, s2 definition; [S1] |
| Current year | 1 April 2026 – 31 March 2027 | `primary` | ITA 1993; LN 24 of 2026; [S1] [S3] |
| Company substituted year | A different 12-month period may be allowed by the Commissioner General on written application and proof of compelling need | `primary` | ITA 1993, s49; [S1] |
| Substituted-period return | Due last day of the third month after the substituted year end | `primary` | ITA 1993, s128(1); [S1] |

### 1.2 Taxpayer types in scope

| Type | Taxed entity | Primary return | Tax rate basis |
| --- | --- | --- | --- |
| Sole trader | The individual | `S128-I` individual return | Resident individual 20%/30% with personal credit |
| Partner in a partnership | Each partner | Partner's `S128-I` | Partner's individual rates on distributive share |
| Partnership | Information return; partners are taxed | `S128-P` | Allocation by partner percentage interest |
| Resident company | The company | `S128-C` | 25% other income; 10% manufacturing/commercial farming |
| Lesotho branch of non-resident company | The branch | `S128-C` | 25% standard rate; manufacturing concession does not apply |
| Non-resident electing assessment | The non-resident | `S128-C` or `S128-I` as applicable | 40% under Fourth Schedule election |

---

## 2. Personal income tax

### 2.1 Resident individual rates

**2026/27, effective 1 April 2026:**

| Chargeable income | Rate |
| --- | --- |
| First M77,760 per year (M6,480 per month) | 20% |
| Above M77,760 per year | 30% |
| Non-refundable personal credit | M12,240 per year (M1,020 per month) |
| Effective tax-free income | M61,200 per year (M5,100 per month) |

Formula:

```text
tax_before_credit = 20% × min(chargeable_income, 77,760)
                  + 30% × max(chargeable_income - 77,760, 0)

tax_payable = max(tax_before_credit - 12,240, 0)
```

**2025/26, for returns due 30 June 2026:**

| Item | Value |
| --- | --- |
| 20% band | First M74,040 per year (M6,170 per month) |
| 30% band | Above M74,040 per year |
| Personal credit | M11,640 per year (M970 per month) |

The 20%/30% rates took effect on 1 April 2014 under the Income Tax (Amendment) Act No. 2 of 2014, which replaced 22%/35%. The 2026/27 band and credit come from LN 24 of 2026; the instrument itself confirms the prior 2025/26 amounts by repealing them. [S2] [S3] [S4]

### 2.2 Business income of an individual

A sole trader's business profit is not taxed at a separate 25% business rate. Business income is included in the individual's chargeable income, the 20%/30% scale is applied, and the personal credit is deducted.

`S128-I` Part H line 3d uses 25% or 40% only for the specific property/non-resident/under-18 cases described in the form. It must not be applied to ordinary resident individual business income. [S20]

### 2.3 Credits and payments

| Item | Treatment | Status |
| --- | --- | --- |
| Personal tax credit | Non-refundable; cannot reduce tax below zero | `primary` [S1] [S3] |
| Foreign tax credit | Lesser of foreign tax paid and Lesotho tax on that foreign income | `primary` [S1] |
| PAYE | Credited against final liability; evidenced by P16 | `primary` [S1] |
| WHT | Credited where the individual is taxed by assessment | `primary` [S1] |
| Provisional tax | Credited against final liability | `primary` [S1] |

---

## 3. Corporate income tax

### 3.1 Current rates

| Income category | Rate | Status | Source |
| --- | --- | --- | --- |
| Manufacturing income of a resident company | 10% | `primary` | Third Schedule as amended by Act No. 2 of 2014; [S1] [S2] [S13] |
| Commercial farming income | 10% | `primary` | Fourth Schedule; [S1] [S13] |
| Other income, including non-manufacturing and property/investment income | 25% | `primary` | Third Schedule as amended; [S1] [S2] |
| Lesotho branch of a non-resident company | 25% standard rate; manufacturing concession does not apply | `primary` | ITA 1993, s10(2), s12; [S1] |
| Trustee, minor, fringe benefits, electing non-resident under s109 | 40% | `primary` | Fourth Schedule; [S1] |

### 3.2 Manufacturing rate and the former export rate

The 2012 consolidated ITA text still prints the pre-2014 Third Schedule, including a 0% rate for manufacturing income exclusively from exports outside SACU. That text is superseded.

The Income Tax (Amendment) Act No. 2 of 2014, effective 1 April 2014:

- deleted Third Schedule items 1 and 2;
- substituted “1. Manufacturing Income 10%”; and
- renumbered old item 3 as item 2.

The Statement of Objects and Reasons expressly says the amendment abolished the zero rate on extra-SACU exports and imposed the standard 10% manufacturing rate on all manufacturers. Therefore **export-only manufacturing is 10%, not 0%**. [S2]

The 2025 RSL Corporate Tax Guide is not directly retrievable from its published URL, and its table extract is internally inconsistent. The 2014 amendment and RSL's current Tax Rates page control. [S13] [S14]

### 3.3 Computation

```text
tax_before_credits =
    manufacturing_income × 10%
  + commercial_farming_income × 10%
  + other_chargeable_income × 25%

tax_payable = max(tax_before_credits - credits_and_payments, 0)
```

Credits and payments include foreign tax credit, WHT paid, provisional/advance instalments and advance corporation tax where applicable. [S20]

Companies must classify income by category. A mixed-income company cannot apply one blended rate.

---

## 4. Partnerships

| Rule | Treatment | Status | Source |
| --- | --- | --- | --- |
| Taxpayer | Partners, not the partnership | `primary` | ITA 1993, s75(1) |
| Filing | Partnership files an information return (`S128-P`) | `primary` | ITA 1993, s128 |
| Calculation | Partnership income/loss calculated as if it were a resident individual, with statutory modifications | `primary` | ITA 1993, Part |
| Allocation | Each partner's share follows the partner's percentage interest | `primary` | ITA 1993, s75 |
| Losses | Partner's loss share limited to the adjusted cost base of the partner's interest | `primary` | ITA 1993 |
| Character | Income, expenses and losses retain character and source in partners' hands | `primary` | ITA 1993 |
| Partner data | Identity, TIN, residency, percentage interest, capital account and distributions required | product requirement | — |

The partnership return does not itself create a partnership-level income tax liability. Each partner's allocation flows into that partner's individual return.

---

## 5. Value added tax

### 5.1 Current rates

| Supply | Rate | Effective | Status | Source |
| --- | --- | --- | --- | --- |
| Exports and zero-rated basic food/agricultural supplies | 0% | Current | `primary` | VAT Act s19(2); VAT Regulations reg 21; [S5] [S6] |
| Electricity | 10% | 1 April 2021 | `primary` | LN 30 of 2021; [S9] [S13] |
| Telecommunications | 15% | 1 April 2020 | `primary` | LN 18 of 2020; [S8] [S13] |
| Other goods and services | 15% | 1 April 2018 | `primary` | LN 27 of 2018; [S7] [S13] |

The standard rate was raised from 14% to 15% by LN 27 of 2018. Electricity moved from 8% to 9% by LN 18 of 2020 and from 9% to 10% by LN 30 of 2021. The VAT Act permits no more than four rates, including zero. [S5] [S7] [S8] [S9]

**Form warning:** the current `VAT-12` still has a “9%” line for electricity. That form line is outdated. Do not encode 9% as a current rate; model electricity with a dated 10% rule and a distinct tax code. [S19]

### 5.2 Registration threshold

| Rule | Value | Status | Source |
| --- | --- | --- | --- |
| Compulsory registration threshold | M2,000,000 taxable turnover per annum | `primary` | LN 69 of 2025; [S10] [S11] |
| Measurement | Taxable supplies only; exclude exempt supplies | `primary` | VAT Act s17; VAT 101; [S5] [S11] |
| Aggregation | Aggregate all businesses under one legal entity | `official-secondary` | VAT 101; [S11] |
| Look-back | Past 12 months, or expected to exceed within 12 months | `official-secondary` | VAT 101; [S11] |
| Voluntary registration | Allowed below threshold, subject to Commissioner approval | `primary` | VAT Act s17; [S5] |

The former M850,000 threshold is stale. Some RSL guides still print it. The gazetted 2025 amendment and current VAT 101 guide state M2,000,000. [S10] [S11]

### 5.3 Tax period, return and payment

| Rule | Value | Status | Source |
| --- | --- | --- | --- |
| Tax period | One calendar month ending on the last day of each month | `primary` | VAT Act definition; [S5] |
| Return | `VAT-12` for each tax period | `primary` | VAT Act s27; [S5] |
| Filing deadline | Within 20 days after the end of the tax period | `primary` | VAT Act s27(1); [S5] |
| Payment deadline | Same date the return is due | `primary` | VAT Act s37(1)(a); [S5] |
| Extension | Commissioner may extend filing for good cause; extension does not change payment due date | `primary` | VAT Act s27(4)–(5); [S5] |

### 5.4 Calculation

```text
output_tax = sum of VAT on standard/reduced-rated taxable supplies
input_tax  = VAT on taxable purchases/imports used in making taxable supplies
net_vat    = output_tax - input_tax
```

If `net_vat` is positive, it is payable. If negative, it is a refundable excess subject to s46 and verification.

Input VAT requires the acquisition to be used in making taxable supplies. A vendor cannot claim input VAT on supplies used for exempt supplies. Mixed-use businesses must apportion. [S5]

### 5.5 Zero-rated supplies

Zero-rating applies to exports and to the basic food and agricultural supplies specified in the VAT Regulations and Schedule IV. Examples in the regulations include:

- maize meal, maize, beans, lentils, peas, sorghum meal and unmalted sorghum;
- wheat grain and wheat flour;
- milk and bread intended for domestic consumption;
- paraffin intended for cooking, illuminating or heating;
- animal feeds;
- fertilisers, seeds and pesticides used for cultivation.

Use the detailed tariff headings in the regulations, not the examples alone. [S6]

### 5.6 Exempt supplies

VAT Act s6(2) exempts, among other things:

- public postal, passenger transportation, medical/dental, financial, insurance and education services;
- unimproved land;
- leases of immovable property to a manufacturer where the property is used principally for manufacturing;
- water;
- further supplies prescribed by regulation.

Exempt supplies do not count toward the registration threshold and do not give rise to input credits. A supply that would otherwise be zero-rated is not treated as exempt merely because of s6. [S5]

### 5.7 Refunds

| Rule | Treatment | Status | Source |
| --- | --- | --- | --- |
| Quarterly excess credit | Excess input tax is credited against other liabilities and the remainder may be refunded on application | `primary` | VAT Act s46(3); [S5] |
| Quarterly application | Within 20 days after the end of the calendar quarter | `primary` | VAT Act s46(5)(a); [S5] |
| Regular excess credits | Vendor may apply in writing for refunds at the end of each tax period | `primary` | VAT Act s46(4); [S5] |
| Other refunds | Within four years after the tax is due and payable | `primary` | VAT Act s46(5)(b); [S5] |
| Calendar quarters | Three months ending 31 March, 30 June, 30 September, 31 December | `primary` | VAT Act s46(8); [S5] |

### 5.8 Accounting method

The invoice method is the default. A vendor may apply to use the cash method only where at least 90% of the total taxable value of its taxable supplies consists of services, and only with Commissioner approval. [S5]

---

## 6. Provisional tax

| Rule | Value | Status | Source |
| --- | --- | --- | --- |
| Who pays | Companies and individuals carrying on business | `primary` | ITA 1993, s150; [S1] |
| Number of instalments | Three | `primary` | s150(1) |
| Due dates | 30 September, 31 December, 31 March | `primary` | s150(1) |
| Amount of each instalment | `30% × (A − B)` | `primary` | s150(1) |
| A | Prior year's tax liability after foreign tax credit, before advance corporation tax set-off | `primary` | s150(1) |
| B | Amount of A paid by withholding at source in the prior year | `primary` | s150(1) |
| Total of three instalments | 90% of `(A − B)` | computed from primary formula | — |
| Substituted company year | Last day of the 6th, 9th and 12th months after the substituted period starts | `primary` | s150(2) |
| Credit | Each instalment credited against the assessment for the year | `primary` | s150(5) |

The RSL Provisional Tax Guide says “three equal instalments” but also states that each instalment is 30% of the prior-year liability. The Act contains no equalisation step. Implement `30% × (A − B)` per instalment. The guide's statement that late provisional tax is 3% per month is secondary; the Act applies the “specified rate” under s192 and s194. [S1] [S16]

---

## 7. Employment-related taxes

PAYE, WHT and FBT are outside the first income-tax/VAT release unless payroll data is added. The rates and deadlines are recorded so that they are not reintroduced incorrectly.

### 7.1 PAYE

| Rule | Value | Status | Source |
| --- | --- | --- | --- |
| Withholding | Employer deducts tax from employment income | `primary` | ITA 1993, Part VII |
| Remittance | By the 15th of the month following the month of deduction | `official-secondary` | RSL PAYE Guide; [S17] |
| Annual certificate | P16 to employee within 28 days after year end; 7 days after employment ceases | `primary` | ITA 1993, s163; [S1] |
| Employee share | Taxed at resident individual 20%/30% with credit, via PAYE tables | `primary` | ITA 1993; LN 24 of 2026 |

### 7.2 Withholding tax

| Payment | Rate | Status | Source |
| --- | --- | --- | --- |
| Non-resident dividend, interest, royalty, natural resource payment, management charge | 25% standard rate | `primary` | ITA 1993, s107(1); [S1] |
| Dividend paid out of manufacturing income subject to 10% | No WHT | `primary` | s107(2) |
| Interest, royalty or management charge used solely in qualifying manufacturing | 15% | `primary` | s107(3) |
| Non-resident services contract | 10% | `primary` | s108(1) |
| Non-resident technical services from RSA | 7.5% | `official-secondary` | RSL Tax Rates; treaty-dependent; [S13] |
| Resident contractor | 5% of gross payment, once monthly payments exceed M3,000; exemptions apply | `primary` | s157; [S1] |
| Resident interest paid by a non-individual | 10% | `primary` | s158; [S1] |

WHT under s107/s108 is a final tax unless the non-resident elects assessment under s109, in which case the Fourth Schedule 40% rate applies. Treaty rates may override domestic rates; verify the applicable treaty before withholding. [S1]

**Open:** ITA s166 says WHT must be paid within the time prescribed by regulations, but the primary WHT regulation was not located. RSL's registration guide states the 15th of the following month. Treat 15th as the operational default and block WHT automation until the regulation is pinned. [S15]

### 7.3 Fringe benefits tax

| Rule | Value | Status | Source |
| --- | --- | --- | --- |
| Rate | 40% | `primary` | Fourth Schedule; [S1] |
| Taxable amount | `A × 1/(1 − B)`, where A is taxable value of benefits and B is 40% | `primary` | s117; [S1] |
| Return periods | Quarters ending 30 June, 30 September, 31 December, 31 March | `primary` | s152(1); [S1] |
| Due date | Within 14 days after quarter end | `primary` | s152(2); [S1] |
| Vehicle benefit | `(value × 15% × days available / days in year) − employee contribution` | `official-secondary` | FBT1 form; [S21] |
| Housing benefit | Lesser of market rental and 20% of employee remuneration, less employee contribution | `primary` | s124; FBT1; [S1] [S21] |

The FBT1 form shows a gross-up factor of 1.67. The statutory factor is exactly `1/(1 − 0.40) = 1.666...`; calculate with the exact factor, then round the final money amount.

---

## 8. Depreciation and capital allowances

The Sixth Schedule prescribes declining-balance rates:

| Group | Assets | Rate |
| --- | --- | --- |
| 1 | Automobiles, taxis, light general-purpose trucks, over-the-road tractors, special tools and devices | 25% |
| 2 | Office furniture, fixtures and equipment; computers and peripheral/data-handling equipment; buses; heavy general-purpose trucks; trailers and containers; construction equipment | 20% |
| 3 | Any depreciable asset not in another group | 10% |
| 4 | Railroad cars, locomotives and railroad equipment; vessels, barges, tugs and similar water transport; industrial buildings; engines and turbines; public utility plant | 5% |

There is **no Group 5 “Mining 100%” row in the Sixth Schedule** in the consolidated Act. Mineral extraction expenditure is recovered as if it were a Group 3 asset under s43. Do not add a 100% mining group without a later amendment. [S1]

Other rules:

- No deduction for acquiring a depreciable asset or land; cost is recovered through depreciation. [S1]
- Repairs, other than capital improvements, are deductible. [S1]
- The cost of a depreciable asset below M50 may be deducted outright. This amount is as printed in the consolidated Act and should be checked against later monetary amendments before implementation. [S1]
- Accounting depreciation and tax depreciation can differ. A fixed-asset register and tax depreciation schedule are required. [S1]

---

## 9. Accounting basis

| Rule | Treatment | Status | Source |
| --- | --- | --- | --- |
| General | Method must clearly reflect income | `primary` | ITA 1993, s50(1); [S1] |
| Cash or accrual | Taxpayer may use either, subject to the mandatory accrual rule | `primary` | s50(2) |
| Mandatory accrual | If gross income for a year exceeds M150,000, the taxpayer must use accrual in all succeeding years | `primary` | s50(2) |
| Individuals/trustees | The mandatory accrual rule applies only to business income | `primary` | s50(3) |
| Change of method | Requires prior written Commissioner permission, except the mandatory cash-to-accrual switch | `primary` | s50(4) |
| Change adjustments | Must ensure no item is omitted or included twice | `primary` | s50(5) |

The M150,000 threshold is as printed in the consolidated Act. No later amendment to that amount was located in the instruments reviewed; re-verify before enforcing the threshold in software.

---

## 10. Record keeping and access

| Rule | Treatment | Status | Source |
| --- | --- | --- | --- |
| Income tax records | Maintain in Lesotho in Sesotho or English, sufficient for accurate tax determination | `primary` | ITA 1993, s169(1); [S1] |
| Retention | For as long as records remain material in administering the Act | `primary` | s169(3) |
| Access | Commissioner General has full access to premises, books, records and computers | `primary` | s170; [S1] |
| VAT records | Original VAT invoices/credit/debit notes received; copies issued; customs import/export documents; prescribed accounts | `primary` | VAT Act s48(1); [S5] |
| VAT books | Up-to-date books that correctly record and explain transactions and allow audit | `primary` | s48(2) |
| VAT retention | For as long as records remain material in administering the Act | `primary` | s48(3) |

Khoebo must retain source documents and evidence, not only calculated return lines.

---

## 11. Additional tax and penalties

### 11.1 Income tax

| Provision | Effect | Status | Source |
| --- | --- | --- | --- |
| s192 | “Specified rate” is published by the Commissioner General based on normal commercial lending rates | `primary` | [S1] |
| s193 | Failure to file: additional tax at specified rate on tax payable from return due date | `primary` | [S1] |
| s194 | Failure to pay: additional tax at specified rate on deficiency from due date, including provisional instalments | `primary` | [S1] |
| s195 | Under-estimation of tax on extension: specified rate on whole deficiency if estimate more than 10% below actual | `primary` | [S1] |
| s196 | Withholding-agent failures: specified rate on tax not withheld or not paid | `primary` | [S1] |
| s197 | Failure to keep proper records: additional tax equal to double the tax payable for the year | `primary` | [S1] |
| s198 | False or misleading statement: additional tax equal to double the excess tax | `primary` | [S1] |
| s199 | Collection, remission and interaction with prosecution | `primary` | [S1] |

RSL secondary guidance states 22% per 12 months for late income tax. Because the Act uses a published “specified rate”, the exact rate must be configuration data with an effective date, not a permanent constant. [S1] [S14]

### 11.2 VAT

| Provision | Effect | Status | Source |
| --- | --- | --- | --- |
| s53 | Failure to register: additional tax equal to double the VAT payable during the unregistered period | `primary` | [S5] |
| s54 | Failure to file return: 3% per month or part-month on VAT payable for the period | `primary` | [S5] |
| s55 | Failure to pay on time: 3% per month or part-month on unpaid VAT | `primary` | [S5] |
| s56 | Failure to keep proper records: double the VAT payable for the tax period | `primary` | [S5] |
| s57 | False or misleading statement: double the excess VAT | `primary` | [S5] |

### 11.3 E-invoicing

Schedule V to the E-Invoicing Regulations prescribes fixed monetary penalties and criminal sanctions for listed offences. The fixed penalties in the regulations include M50,000, M100,000, M200,000 and M300,000. The exact penalty depends on the offence; do not describe the range as a single flat penalty. [S12]

---

## 12. Filing and payment calendar

| Obligation | Statutory due date | Recurrence | Status |
| --- | --- | --- | --- |
| Individual income tax return and final payment | Last day of third month after year end; standard 30 June | Annual | `primary` |
| Company income tax return and final payment | Last day of third month after year end; standard 30 June | Annual | `primary` |
| Partnership information return | Last day of third month after year end; standard 30 June | Annual | `primary` |
| Provisional tax instalments | 30 September, 31 December, 31 March | Three per year | `primary` |
| VAT return and payment | 20 days after end of monthly tax period | Monthly | `primary` |
| PAYE remittance | 15th of following month | Monthly | `official-secondary` |
| WHT remittance | 15th of following month | Monthly | `official-secondary`; primary regulation open |
| FBT return | Within 14 days after quarter end | Quarterly | `primary` |
| P16 employee certificate | 28 days after year end; 7 days after employment ceases | Annual/event | `primary` |
| WHT annual statement | 28 days after year end | Annual | `primary` |
| VAT refund application for quarterly excess | Within 20 days after quarter end | Quarterly | `primary` |

For a company with an approved substituted year, all annual dates move to the third month after the substituted year end, and provisional dates move to the 6th, 9th and 12th months after the period starts.

---

## 13. E-invoicing (Lekuka / IDMS / EBS)

| Rule | Position | Status | Source |
| --- | --- | --- | --- |
| Instrument | VAT (E-Invoicing) Regulations, 2026, LN 25 of 2026 | `primary` | [S12] |
| Commencement | 1 April 2026 | `primary` | reg 1 |
| Application | Commissioner General may, by Gazette notice, require a vendor to use an EBS | `primary` | reg 3 |
| Architecture | RSL's Invoice Data Management System (IDMS/Lekuka) plus accredited vendor EBS | `primary` | regs 4–6 |
| EBS count | One EBS per business activity; more only with Commissioner authorisation | `primary` | reg 6(1) |
| EBS requirements | Accredited, registered on IDMS, ID number, authenticated, QR-coded invoice | `primary` | reg 6(2) |
| Invoice particulars | Statutory VAT invoice particulars plus payment method, transaction type, issuer, sequential number, EBS serial, digital signature and QR code | `primary` | Schedule IV |
| Credit/debit notes | Statutory particulars plus transaction type, issuer, serial number, EBS serial, digital signature and QR code | `primary` | Schedule IV |
| Pro-forma invoices | Must be clearly labelled “PRO-FORMA” and “THIS IS NOT AN INVOICE” | `primary` | Schedule IV |
| Offences/penalties | Fixed and criminal sanctions in Schedule V | `primary` | reg 16; Schedule V |
| Grace period | RSL reportedly extended technical integration grace to 30 October 2026 | `open` | secondary notices only |
| Enforcement | Implementation partners report enforcement from 1 November 2026 | `open` | secondary notices only |

Regulation 3 means the regulations do not automatically impose EBS use on every vendor; a Gazette notice is contemplated. The exact population and phasing of mandated vendors must be confirmed from RSL notices. A Khoebo-generated PDF invoice is not an accredited EBS/IDMS invoice for an in-scope transaction. [S12]

---

## 14. Implementation rules for Khoebo

1. Store every rate, band, credit, threshold and deadline with `effective_from`, `effective_to`, source and verification status.
2. Never overwrite historical rules. A prior-year return must use the rules in force for that year.
3. Keep `Sale.total` out of turnover calculations when it includes VAT. Use ledger revenue or net revenue (`subtotal − discount`).
4. Do not treat every `Sale.tax_amount` as output VAT. A VAT return requires tax codes and transaction classification.
5. Do not calculate VAT input tax from `Expense` until supplier, invoice and VAT data are captured.
6. Reconcile every return to the ledger and show unexplained variances before finalisation.
7. Snapshot the return, source data, rule versions and calculations. Do not recompute a finalised return from live data.
8. Mark unsupported or open rules as blockers, not silent assumptions.
9. Keep tax payments and tax adjustments out of the ledger unless a deliberate accounting treatment is chosen; avoid double counting.
10. Treat e-invoicing as a separate integration from return filing.

---

## 15. Sources

### Primary

- [S1] Kingdom of Lesotho, *Income Tax Act 1993*, RSL consolidated text updated to 1 April 2012: <http://www.rsl.org.ls/sites/default/files/2024-05/Income%20Tax%20Act%201993%20%20Updated%20up%20to%201%20April%202012.pdf>
- [S2] Kingdom of Lesotho, *Income Tax (Amendment) Act, 2014*, Act No. 2 of 2014, Government Gazette Vol. 59 No. 33, 13 June 2014: <https://www.rsl.org.ls/sites/default/files/2024-06/INCOME%20TAX%20AMENDMENT%20ACT%20NO%202%20OF%202014.pdf>
- [S3] Kingdom of Lesotho, *Income Tax (Amendment of Monetary Amounts) Regulations, 2026*, LN 24 of 2026, Gazette Vol. 71 No. 25, 27 March 2026: <https://www.rsl.org.ls/sites/default/files/2026-09/INCOME%20TAX%20%28AMA%29%20REGULATIONS%20No.24%20of%202026.%20%281%29%20%281%29_0.pdf>
- [S4] Revenue Services Lesotho, *Income Tax Structure for the Period Starting 1 April 2026 Onwards*: <https://www.rsl.org.ls/sites/default/files/2026-09/2026%20-%202027%20Income%20Tax%20structure%201.pdf>
- [S5] Kingdom of Lesotho, *Value Added Tax Act 2001*, RSL consolidated text: <https://www.rsl.org.ls/sites/default/files/2026-09/VAT%20ACT%20-%202001.pdf>
- [S6] Kingdom of Lesotho, *Value Added Tax Regulations 2003*, LN 95 of 2003: <http://www.rsl.org.ls/sites/default/files/2024-06/VAT%20Regulations%20Legal%20Notice%2095%202003.pdf>
- [S7] Kingdom of Lesotho, *Value Added Tax (Amendment) Regulations, 2018*, LN 27 of 2018: <https://www.rsl.org.ls/sites/default/files/2024-08/Value%20Added%20Tax%20%28Amendment%29%20Regulations%20No.27%20of%202018.pdf>
- [S8] Kingdom of Lesotho, *Value Added Tax (Amendment) Regulations, 2020*, LN 18 of 2020, effective 1 April 2020: local archive `vat_regs_2020.pdf`
- [S9] Kingdom of Lesotho, *Value Added Tax (Amendment) Regulations, 2021*, LN 30 of 2021, effective 1 April 2021: local archive `vat_amendment_regs_2021.pdf`
- [S10] Kingdom of Lesotho, *Value Added Tax (Threshold for Registration of Vendors) (Amendment) Regulations, 2025*, LN 69 of 2025, Gazette 25 April 2025: <https://lesotholii.org/akn/ls/officialGazette/government-gazette/2025-04-25/35/eng@2025-04-25/source.pdf>
- [S11] Revenue Services Lesotho, *Tax Guide on Registration for VAT Purposes – VAT 101*: <https://www.rsl.org.ls/sites/default/files/2026-09/Guide%20on%20Registration%20For%20Value%20Added%20Tax%20Purposes%20%20-%20VAT%20101%20%281%29.pdf>
- [S12] Kingdom of Lesotho, *Value Added Tax (E-Invoicing) Regulations, 2026*, LN 25 of 2026: <https://www.rsl.org.ls/sites/default/files/2026-09/VAT%20-%20E-Invoicing%20Regulations%20No.25%20of%202026%20%283%29.pdf>
- [S13] Revenue Services Lesotho, *Tax Rates*: <https://www.rsl.org.ls/tax-rates>
- [S15] Revenue Services Lesotho, *Guide on Tax Registration* (2017), deadline table: local archive `reg_guide_2017.pdf`
- [S16] Revenue Services Lesotho, *Provisional Tax Guide* (2018): local archive `prov_guide_2018.pdf`
- [S17] Revenue Services Lesotho, *PAYE Guide* (2020): local archive `paye_guide_2020.pdf`
- [S19] Revenue Services Lesotho, *Value Added Tax Return VAT-12*: local archive `vat_return.pdf`
- [S20] Revenue Services Lesotho, *Individual Income Tax Return S128-I* (2023): local archive `individual_2023.pdf`
- [S21] Revenue Services Lesotho, *Fringe Benefits Tax Return FBT1*: local archive `fbt_return.pdf`

### Official-secondary / inaccessible

- [S14] Revenue Services Lesotho, *Guide on Corporate Tax* (2025): <http://www.rsl.org.ls/sites/default/files/2025-06/Guide%20on%20Corporate%20Tax.pdf> — URL returns 404/HTML; not relied on for rates.

### Secondary implementation notices

- Mayet & Associates, *Lekuka E-Invoicing: RSL Extends the Mandatory Deadline to 30 October 2026*: <https://zmayetlaw.co.ls/lekuka-e-invoicing-rsl-extends-the-mandatory-deadline-to-30-october-2026-but-the-regulations-have-not-moved>
- Comarch, *Lesotho Introduces the Lekuka E-Invoicing System*: <https://www.comarch.com/trade-and-services/data-management/legal-regulation-changes/lesotho-introduces-the-lekuka-e-invoicing-system>

> Tax rules and administrative dates change. Re-verify every rate and deadline before implementation. See `lesotho_unresolved_questions.md` for unresolved items.
