from datetime import date, timedelta
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import load_workbook


def _url(business_id: str, path: str = "") -> str:
    return f"/api/v1/businesses/{business_id}/exports{path}"


def _rows(response, sheet_name: str) -> list[tuple]:
    workbook = load_workbook(BytesIO(response.content), read_only=True, data_only=True)
    return list(workbook[sheet_name].iter_rows(values_only=True))


def _value(rows: list[tuple], label: str, column: int = 1):
    for row in rows:
        if row and row[0] == label:
            return row[column]
    raise AssertionError(f"No row labelled {label!r} in {rows!r}")


def test_export_catalog_lists_every_dataset_for_members_only(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    outsider = user_factory()

    response = client.get(_url(business["id"]), headers=owner["headers"])
    assert response.status_code == 200, response.text
    datasets = [item["id"] for item in response.json()["datasets"]]
    assert datasets == [
        "sales",
        "sale_items",
        "products",
        "stock_movements",
        "expenses",
        "accounts",
        "journal_entries",
        "journal_lines",
        "team_members",
        "reminders",
        "trial_balance",
        "income_statement",
        "inventory_valuation",
        "sales_summary",
        "analytics_overview",
        "all",
    ]

    denied = client.get(_url(business["id"]), headers=outsider["headers"])
    assert denied.status_code == 404


def test_sales_xlsx_exports_only_business_records_with_numeric_totals(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(
        business, owner, name="Coffee", unit_price="20.00", cost_price="8.00"
    )
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={
            "items": [{"product_id": product["id"], "quantity": "2"}],
            "tax_rate": "10",
            "customer_name": "Naledi",
            "amount_paid": "50.00",
        },
        headers=owner["headers"],
    )
    assert sale.status_code == 201, sale.text

    other_owner = user_factory()
    other_business = business_factory(other_owner, name="Other Shop")
    other_product = product_factory(other_business, other_owner)
    other_sale = client.post(
        f"/api/v1/businesses/{other_business['id']}/sales",
        json={
            "items": [{"product_id": other_product["id"], "quantity": "1"}],
            "customer_name": "Outsider",
            "amount_paid": "10.00",
        },
        headers=other_owner["headers"],
    )
    assert other_sale.status_code == 201, other_sale.text

    today = date.today()
    response = client.get(
        _url(business["id"], "/sales")
        + f"?format=xlsx&start_date={(today - timedelta(days=1)).isoformat()}"
        + f"&end_date={today.isoformat()}",
        headers=owner["headers"],
    )
    assert response.status_code == 200, response.text
    assert "spreadsheetml.sheet" in response.headers["content-type"]
    assert "sales" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.xlsx"')

    rows = _rows(response, "Sales")
    assert any(sale.json()["reference"] in str(cell) for row in rows for cell in row)
    assert any("Naledi" in str(cell) for row in rows for cell in row)
    assert not any("Outsider" in str(cell) for row in rows for cell in row)
    header = rows[0]
    total_column = header.index("Total")
    sale_row = next(row for row in rows if sale.json()["reference"] in str(row))
    assert sale_row[total_column] == 44.0


def test_sales_pdf_returns_pdf_attachment(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)

    response = client.get(_url(business["id"], "/sales"), headers=owner["headers"])
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert "sales" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.pdf"')
    assert response.content.startswith(b"%PDF")


def test_all_xlsx_contains_every_dataset_sheet(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(
        business, owner, name="Coffee", unit_price="20.00", cost_price="8.00"
    )
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={
            "items": [{"product_id": product["id"], "quantity": "2"}],
            "tax_rate": "10",
            "amount_paid": "50.00",
        },
        headers=owner["headers"],
    )
    assert sale.status_code == 201, sale.text
    expense = client.post(
        f"/api/v1/businesses/{business['id']}/expenses",
        json={"description": "Milk", "amount": "10.00", "expense_date": date.today().isoformat()},
        headers=owner["headers"],
    )
    assert expense.status_code == 201, expense.text

    response = client.get(_url(business["id"], "/all?format=xlsx"), headers=owner["headers"])
    assert response.status_code == 200, response.text
    workbook = load_workbook(BytesIO(response.content), read_only=True, data_only=True)
    assert workbook.sheetnames == [
        "Sales",
        "Sale items",
        "Products",
        "Stock movements",
        "Expenses",
        "Accounts",
        "Journal entries",
        "Journal lines",
        "Team members",
        "Reminders",
        "Trial balance",
        "Income statement",
        "Inventory valuation",
        "Sales summary",
        "Analytics overview",
    ]

    assert any(
        sale.json()["reference"] in str(cell)
        for row in workbook["Sales"].iter_rows(values_only=True)
        for cell in row
    )
    assert any(
        "Coffee" in str(cell)
        for row in workbook["Products"].iter_rows(values_only=True)
        for cell in row
    )
    assert any(
        "Milk" in str(cell)
        for row in workbook["Expenses"].iter_rows(values_only=True)
        for cell in row
    )
    assert _value(list(workbook["Income statement"].iter_rows(values_only=True)), "Net income") == 14.0
    assert _value(list(workbook["Sales summary"].iter_rows(values_only=True)), "Net revenue") == 40.0


def test_all_pdf_returns_pdf_attachment(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)

    response = client.get(_url(business["id"], "/all?format=pdf"), headers=owner["headers"])
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert "all" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_income_statement_xlsx_uses_requested_date_range(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner, unit_price="20.00", cost_price="8.00")
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={"items": [{"product_id": product["id"], "quantity": "2"}], "amount_paid": "40.00"},
        headers=owner["headers"],
    )
    assert sale.status_code == 201, sale.text

    today = date.today().isoformat()
    response = client.get(
        _url(business["id"], "/income_statement")
        + f"?format=xlsx&start_date={today}&end_date={today}",
        headers=owner["headers"],
    )
    assert response.status_code == 200, response.text
    rows = _rows(response, "Income statement")
    assert _value(rows, "Net income") == 24.0
    assert any(today in str(cell) for row in rows for cell in row)


def test_date_range_excludes_old_records_from_xlsx(
    client: TestClient, user_factory, business_factory, product_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    product = product_factory(business, owner)
    sale = client.post(
        f"/api/v1/businesses/{business['id']}/sales",
        json={"items": [{"product_id": product["id"], "quantity": "1"}], "amount_paid": "10.00"},
        headers=owner["headers"],
    )
    assert sale.status_code == 201, sale.text

    today = date.today()
    response = client.get(
        _url(business["id"], "/sales")
        + f"?format=xlsx&start_date={(today - timedelta(days=30)).isoformat()}"
        + f"&end_date={(today - timedelta(days=1)).isoformat()}",
        headers=owner["headers"],
    )
    assert response.status_code == 200, response.text
    rows = _rows(response, "Sales")
    assert len(rows) == 1


def test_export_rejects_invalid_dataset_format_and_dates(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)

    assert client.get(_url(business["id"], "/unknown"), headers=owner["headers"]).status_code == 422
    assert client.get(_url(business["id"], "/sales?format=csv"), headers=owner["headers"]).status_code == 422
    invalid_range = client.get(
        _url(business["id"], "/sales?format=xlsx&start_date=2026-02-02&end_date=2026-02-01"),
        headers=owner["headers"],
    )
    assert invalid_range.status_code == 400
    assert invalid_range.json()["detail"] == "start_date must be before end_date"


def test_export_rejects_unauthenticated_and_non_member_users(
    client: TestClient, user_factory, business_factory
) -> None:
    owner = user_factory()
    business = business_factory(owner)
    outsider = user_factory()

    assert client.get(_url(business["id"], "/sales")).status_code == 401
    denied = client.get(_url(business["id"], "/sales?format=xlsx"), headers=outsider["headers"])
    assert denied.status_code == 404
