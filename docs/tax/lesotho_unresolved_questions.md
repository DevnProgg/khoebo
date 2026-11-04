# Lesotho Tax Rules: Unresolved Questions

**Prepared:** 4 November 2026  
**Scope:** Open legal, administrative and form questions affecting the Lesotho tax preparation deliverables.  
**Companion files:** `lesotho_tax_rules.md`, `lesotho_tax_rules.json`, `lesotho_tax_deadlines.csv`, `lesotho_tax_return_field_mapping.md`.

## Status legend

| Status | Meaning |
| --- | --- |
| `OPEN` | No sufficiently authoritative answer located; do not implement silently. |
| `SECONDARY_ONLY` | Only RSL/guide/practitioner evidence located; usable for design with a warning, not as final legal authority. |
| `INACCESSIBLE` | Source exists by reference but the document could not be retrieved or read. |
| `DEFERRED` | Out of first-release scope; record now so it is not assumed away. |
| `RESOLVED` | Answered by primary or adequately corroborated evidence; do not reopen without a newer instrument. |

## Open questions

| ID | Question | Status | Why it matters | Current evidence | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| UQ-001 | What is the exact statutory deadline and prescribed form for remitting withholding tax? | `SECONDARY_ONLY` | A wrong due date creates penalty exposure; WHT cannot be automated safely without the primary rule. | ITA 1993 s166 delegates timing to regulations. The 2017 RSL registration guide says the 15th of the following month. The primary WHT regulation was not located. | Obtain the current WHT regulations and any Gazette amendment; cite section and form. | Final WHT module and deadline automation |
| UQ-002 | What does the RSL Withholding Tax Public Ruling 2025 require, and is it current? | `INACCESSIBLE` | The ruling may set filing, documentation or rate-administration requirements not in the Act. | Located URL returned 404/HTML; no readable copy in the archive. | Retrieve from RSL, LesLII or Gazette; record instrument number and date. | WHT implementation |
| UQ-003 | Is the RSL Corporate Tax Guide 2025 reliable, and does it contain current filing instructions? | `INACCESSIBLE` | The guide reportedly contains internally inconsistent labels and may affect return-line instructions. | URL returned 404/HTML; secondary references mention conflicting table labels. Rates are independently supported by the Act, 2014 amendment and RSL Tax Rates. | Obtain a readable copy; treat guide as non-authoritative until checked against the Act. | Only guide-dependent instructions; rates are not blocked |
| UQ-004 | Which vendors are required to use an EBS, from what date, and what grace/enforcement applies? | `OPEN` | Determines whether Khoebo may issue ordinary invoices or must integrate with an accredited EBS. | VAT (E-Invoicing) Regulations 2026, LN 25 of 2026, reg 3 says the Commissioner General may require a vendor by Gazette notice. Regulations commenced 1 April 2026. Secondary reports describe grace to 30 October 2026 and enforcement from 1 November 2026, but no Gazette notice setting scope was located. | Monitor RSL/Lekuka notices; obtain any Gazette notice and accreditation rules. | E-invoicing integration scope |
| UQ-005 | Does RSL provide an official e-Tax filing API, or only the web portal? | `OPEN` | An API determines whether filing can be automated or must remain manual/assisted. | RSL publishes e-Filing guidance, but no public API documentation, endpoint catalogue or onboarding process was located. | Ask RSL for API documentation and terms; do not scrape the portal. | Automated filing adapter |
| UQ-006 | What PDF format, declaration wording, signature and attachment requirements apply to each return? | `OPEN` | A return cannot be finalised or represented as filing-ready without the official form version and declaration. | Form PDFs show declarations, but required supporting schedules and e-filing attachment rules are not consolidated. | Obtain current form versions and RSL filing instructions for each tax type. | PDF generation and finalisation |
| UQ-007 | Is there a small-business or turnover-tax regime for the target segment? | `OPEN` | A separate regime would change rates, thresholds and return design. | No separate regime was identified in current RSL guidance; sole traders appear to be taxed under the individual regime. Absence of evidence is not proof. | Confirm with RSL/adviser and check recent amendments. | Taxpayer-type branching |
| UQ-008 | Which WHT treaty rates apply, particularly the reported 7.5% rate for RSA technical services? | `SECONDARY_ONLY` | Treaty relief changes the amount withheld and requires residency/beneficial-ownership evidence. | ITA s107 standard rate 25%, 15% for qualifying manufacturing interest/royalty/management charge; s108 non-resident services 10%; RSL page reports 7.5% for RSA technical services. Treaty text not verified. | Verify the Lesotho–South Africa treaty and any limitation-on-benefits requirements. | Cross-border WHT |
| UQ-009 | What are the precise qualifying conditions and line classifications for manufacturing and commercial farming income? | `OPEN` | The 10% rates are confirmed, but misclassification changes tax and return lines. | Third Schedule and Fourth Schedule support 10%; the detailed activity definitions, exclusions and mixed-income allocation rules need a full legal check. | Build a classification schedule with the statutory tests and examples. | Company/individual category mapping |
| UQ-010 | What are the complete current zero-rated and exempt VAT schedules, including electricity and telecommunications? | `OPEN` | Wrong VAT treatment affects output tax, input credits and `VAT-12` lines. | Current rates are 15% standard, 10% electricity (LN 30 of 2021) and 15% telecommunications (LN 18 of 2020). VAT Act s6 and Schedule 1 exemptions were inspected, but the consolidated schedules and amendments need a line-by-line check. | Produce a dated VAT treatment matrix from the Act and amendments. | VAT tax codes and return |
| UQ-011 | Is the M150,000 gross-income threshold in ITA s50 still current? | `OPEN` | It determines mandatory accrual accounting and therefore timing adjustments. | Consolidated Act updated to 1 April 2012 prints M150,000. Later monetary-amendment regulations may have changed it. | Check monetary-amendment regulations after 2012 for s50. | Accounting-basis automation |
| UQ-012 | Is there an official revised `VAT-12` that replaces the outdated 9% electricity line? | `OPEN` | The form's printed line does not match the 10% electricity rate, creating a mapping and filing risk. | `VAT-12` shows a 9% line; electricity has been 10% since 1 April 2021. | Obtain current form and RSL completion guide; version the form by effective date. | Final VAT PDF/return mapping |

## Resolved questions: do not reopen without a newer instrument

| Topic | Resolved position | Evidence | Supersedes / caution |
| --- | --- | --- | --- |
| Manufacturing export rate | **10%**, including manufacturing income exclusively from exports outside SACU | Income Tax (Amendment) Act No. 2 of 2014; Third Schedule; RSL Tax Rates | Old 0% export-only rate is repealed. Do not use practitioner material that still says 0%. |
| Individual business rate | **20%/30%** with personal credit; not a separate 25% business rate | ITA First Schedule; LN 24 of 2026; `S128-I` | The 25%/40% entries on `S128-I` Part H line 3d apply only to specified property/non-resident/under-18 cases. |
| Provisional tax amount | Each instalment **30% × (A − B)**; three instalments; total 90% | ITA s150 | The 2018 guide's "equal instalments" wording is not controlling. |
| Accounting basis | Cash or accrual; gross income above **M150,000** must use accrual in all succeeding years; individuals/trustees only for business income | ITA s50 | Threshold currency is tracked as UQ-011. Method changes need Commissioner permission except the mandatory cash-to-accrual switch. |
| VAT refunds | Quarterly excess credits: application within **20 days** after quarter end; regular excess credits each tax period; other refunds within **four years** | VAT Act s46 | Do not describe all refunds as annual only. |
| Commercial farming rate | **10%** | Fourth Schedule; RSL Tax Rates | Rate resolved; classification conditions remain UQ-009. |
| Depreciation groups | Only **Groups 1–4**: 25%, 20%, 10%, 5% | Sixth Schedule | No Group 5 mining 100% row. Mineral extraction is a Group 3 asset under s43. |
| VAT rates | **15%** standard; **10%** electricity; **15%** telecommunications | VAT Act and LN 18 of 2020 / LN 30 of 2021 | Do not encode the `VAT-12` 9% line as a current rate; revised-form question remains UQ-012. |
| VAT registration threshold | **M2,000,000** taxable turnover per annum | LN 69 of 2025; VAT 101 | M850,000 is stale. |
| VAT penalty rates | Late return **3%/month or part-month**; late payment **3%/month or part-month** | VAT Act ss54–55 | Do not use a blanket 22% per annum for VAT. |
| Income tax additional tax | Published **specified rate** under ss192–196, not a fixed statutory 22% | ITA ss192–196; secondary RSL guidance says 22% per 12 months | Store as dated configuration. |
| FBT gross-up | **40%** rate; multiply taxable value by `1/(1 − 0.40)` (approximately 1.67) | ITA Fourth Schedule; FBT return | Use exact fraction, then apply rounding policy. |
| Individual tax bands 2026/27 | First **M77,760** at 20%; 30% above; credit **M12,240** | LN 24 of 2026 | Prior-year M74,040/M11,640 must remain available for 2025/26 returns. |
| E-invoicing penalties | Fixed **M50,000 / M100,000 / M200,000 / M300,000** by contravention | LN 25 of 2026, Schedule V | Scope/phasing remains UQ-004. |

## Source-access issues

| Source | Problem | Effect |
| --- | --- | --- |
| RSL WHT Public Ruling 2025 | URL returned 404/HTML | WHT administrative requirements not verified (UQ-002). |
| RSL Corporate Tax Guide 2025 | URL returned 404/HTML; secondary reports of inconsistent table labels | Not relied on for rates (UQ-003). |
| RSL e-Tax API documentation | No public documentation located | Manual filing until confirmed (UQ-005). |
| E-invoicing Gazette notice | No vendor-scope notice located | Scope treated as provisional (UQ-004). |
| Original WHT regulations | Not located in the archive | Exact deadline remains secondary (UQ-001). |
| Current `VAT-12` form | Retrieved form shows 9% electricity | Possible form version conflict (UQ-012). |

## Implementation policy for open items

1. **Block, do not guess.** Any return line depending on an `OPEN` or `INACCESSIBLE` question must be marked incomplete and cannot be finalised.
2. **Allow secondary-only with disclosure.** A `SECONDARY_ONLY` rule may support a draft computation only if the UI shows the source status and the return finalisation requires acknowledgement.
3. **Rules are dated data.** Store effective-from and effective-to dates, source IDs, verification status and a snapshot hash. Never place a rate or threshold only in code.
4. **Forms are versioned.** A form version is identified by tax type, year/period, revision date and source URL/hash. Do not reuse a 2023 field layout for 2026/27 without checking.
5. **Resolved items stay closed.** Do not re-add old claims about 0% exports, 25% individual business income, equal provisional instalments, 3% provisional penalties, a mining 100% depreciation group, or a blanket 22% VAT penalty.
6. **No silent classification.** Manufacturing, farming, export, foreign-source, property and exempt/zero-rated VAT treatment require explicit user or mapping decisions with reconciliation.
7. **Keep a question register in the product.** Each blocking question should map to an internal issue/ADR and be visible in the tax readiness checklist.
