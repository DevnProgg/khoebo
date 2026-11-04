import csv
import io
from collections.abc import Iterator
from decimal import Decimal
from typing import Any


def _text(value: Any) -> str:
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if value is None:
        return ""
    return str(value)


def _flatten(value: Any, prefix: str = "") -> Iterator[tuple[str, str]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            yield from _flatten(child, child_prefix)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _flatten(child, f"{prefix}[{index}]")
    else:
        yield prefix, _text(value)


def render_supporting_schedule(record: Any) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["section", "field", "value"])
    sections = {
        "reporting_period": {
            "start": record.reporting_period_start.isoformat(),
            "end": record.reporting_period_end.isoformat(),
        },
        "statutory_period": {
            "start": record.statutory_period_start.isoformat(),
            "end": record.statutory_period_end.isoformat(),
        },
        "rule": record.return_structure.get("rule", {}),
        "accounting": record.accounting_figures,
        "tax_liability": record.tax_liability,
        "payments_and_credits": record.payments_and_credits,
        "validation": record.validation,
    }
    for section, value in sections.items():
        for field, item in _flatten(value):
            writer.writerow([section, field, item])
    return output.getvalue().encode("utf-8")


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_lines(record: Any) -> list[str]:
    liability = record.tax_liability or {}
    accounting = record.accounting_figures or {}
    lines = [
        "Khoebo Lesotho Tax Return Preparation",
        "NOT AN OFFICIAL RSL FILING OR LEGAL COMPLIANCE CERTIFICATE",
        f"Tax type: {record.tax_type.value}",
        f"Taxpayer type: {record.taxpayer_type}",
        f"Reporting period: {record.reporting_period_start} to {record.reporting_period_end}",
        f"Statutory period: {record.statutory_period_start} to {record.statutory_period_end}",
        f"Rule version: {record.rule_version}",
        f"Return status: {record.status.value}",
        "",
        f"Revenue: {_text(accounting.get('revenue'))}",
        f"Expenses: {_text(accounting.get('expenses'))}",
        f"Net profit: {_text(accounting.get('net_profit'))}",
        f"Tax liability: {_text(liability.get('tax'))}",
        f"Balance due: {_text((record.payments_and_credits or {}).get('balance_due'))}",
        f"Refund due: {_text((record.payments_and_credits or {}).get('refund_due'))}",
        f"Input hash: {record.input_hash}",
        f"Calculation hash: {record.calculation_hash}",
    ]
    if record.warnings:
        lines.extend(["", "Warnings:"])
        lines.extend(f"- {warning.get('message', warning)}" for warning in record.warnings)
    return lines


def render_return_pdf(record: Any) -> bytes:
    lines = _pdf_lines(record)
    content_lines = ["BT", "/F1 10 Tf", "50 760 Td"]
    for index, line in enumerate(lines):
        if index:
            content_lines.append("0 -14 Td")
        content_lines.append(f"({_pdf_escape(line[:180])}) Tj")
    content_lines.append("ET")
    content = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream",
    ]
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode("ascii"))
        output.extend(body)
        output.extend(b"\nendobj\n")
    xref_offset = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(output)
