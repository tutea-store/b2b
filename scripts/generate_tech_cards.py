#!/usr/bin/env python3
"""Generate A7 Tutea brewing calibration cards from products.json."""

from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.lib.colors import CMYKColor
from reportlab.lib.pagesizes import A7
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "products.json"
OUTPUT_DIR = ROOT / "assets" / "downloads" / "tech-cards"
TEMP_DIR = ROOT / "tmp" / "pdfs" / "tech-cards"

FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")

TRIM_WIDTH, TRIM_HEIGHT = A7
BLEED = 3 * mm
HEADER_HEIGHT = 20 * mm

WHITE = CMYKColor(0, 0, 0, 0)
BLACK = CMYKColor(0, 0, 0, 100)
DARK = CMYKColor(0, 0, 0, 86)
MID = CMYKColor(0, 0, 0, 55)
LIGHT = CMYKColor(0, 0, 0, 20)
PALE = CMYKColor(0, 0, 0, 8)


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("TuteaRegular", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("TuteaBold", str(FONT_BOLD)))


def parse_range(value: str | None) -> tuple[float, float] | None:
    if not value:
        return None
    numbers = re.findall(r"\d+(?:[,.]\d+)?", value)
    if not numbers:
        return None
    parsed = [float(number.replace(",", ".")) for number in numbers[:2]]
    return (parsed[0], parsed[-1])


def format_number(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return str(value).replace(".", ",")


def fit_text(c: canvas.Canvas, text: str, font: str, max_size: float, min_size: float, width: float) -> float:
    size = max_size
    while size > min_size and pdfmetrics.stringWidth(text, font, size) > width:
        size -= 0.5
    return size


def draw_crop_marks(c: canvas.Canvas, origin_x: float, origin_y: float) -> None:
    c.saveState()
    c.setLineWidth(0.35)
    gap = 0.7 * mm
    length = 1.7 * mm
    left = origin_x
    right = origin_x + TRIM_WIDTH
    bottom = origin_y
    top = origin_y + TRIM_HEIGHT

    c.setStrokeColor(BLACK)
    for x in (left, right):
        c.line(x, 0, x, length)
    c.line(0, bottom, length, bottom)
    c.line(right + gap, bottom, right + gap + length, bottom)

    c.setStrokeColor(WHITE)
    for x in (left, right):
        c.line(x, top + gap, x, top + gap + length)
    c.line(0, top, length, top)
    c.line(right + gap, top, right + gap + length, top)
    c.restoreState()


def choice_values(recommended: tuple[float, float] | None, step: float) -> list[float]:
    if not recommended:
        return []
    low, high = recommended
    count = int(round((high - low) / step))
    return [round(low + index * step, 4) for index in range(count + 1)]


def draw_choice_scale(
    c: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    values: list[float],
) -> None:
    c.saveState()
    if not values:
        c.setFont("TuteaRegular", 5.2)
        c.setFillColor(MID)
        c.drawCentredString(x + width / 2, y - 1.5, "ПО РЕЦЕПТУ")
        c.setStrokeColor(LIGHT)
        c.setLineWidth(0.5)
        c.line(x + 8 * mm, y - 3 * mm, x + width - 8 * mm, y - 3 * mm)
        c.restoreState()
        return

    radius = 2.35 * mm
    if len(values) == 1:
        positions = [x + width / 2]
    else:
        positions = [x + radius + index * (width - radius * 2) / (len(values) - 1) for index in range(len(values))]

    for position, value in zip(positions, values):
        c.setStrokeColor(DARK)
        c.setLineWidth(0.75)
        c.circle(position, y, radius, stroke=1, fill=0)
        c.setFont("TuteaRegular", 5.2)
        c.setFillColor(DARK)
        c.drawCentredString(position, y - 5.2 * mm, format_number(value))
    c.restoreState()


def draw_result_field(c: canvas.Canvas, x: float, center_y: float, width: float, unit: str) -> None:
    height = 9 * mm
    bottom = center_y - height / 2
    c.saveState()
    c.setStrokeColor(DARK)
    c.setLineWidth(0.75)
    c.roundRect(x, bottom, width, height, 1.8 * mm, stroke=1, fill=0)
    c.setFont("TuteaRegular", 5.6)
    c.setFillColor(MID)
    c.drawRightString(x + width - 1.8 * mm, bottom + 3.5 * mm, unit)
    c.setStrokeColor(MID)
    c.setLineWidth(0.45)
    c.line(x + 2 * mm, bottom + 3.2 * mm, x + width - 7 * mm, bottom + 3.2 * mm)
    c.restoreState()


def draw_metric(
    c: canvas.Canvas,
    origin_x: float,
    top_y: float,
    label: str,
    unit: str,
    values: list[float],
) -> None:
    left = origin_x + 6 * mm
    scale_width = 42 * mm
    field_x = origin_x + 54 * mm
    field_width = 14 * mm
    label_y = top_y - 2.5 * mm
    choice_y = top_y - 8.5 * mm

    c.setFont("TuteaBold", 6.9)
    c.setFillColor(BLACK)
    c.drawString(left, label_y, label.upper())
    draw_choice_scale(c, left, choice_y, scale_width, values)
    draw_result_field(c, field_x, choice_y, field_width, unit)


def recommended_parameters(product: dict) -> tuple[tuple[float, float], tuple[float, float] | None, tuple[float, float] | None]:
    temperature = float(product["brew_temp"])
    tolerance = float(product.get("brew_temp_tolerance") or 0)
    temperature_range = (temperature - tolerance, temperature + tolerance)
    dosage_range = parse_range(product.get("brew_dosage"))
    time_range = parse_range(product.get("brew_time"))
    return temperature_range, dosage_range, time_range


def draw_card(c: canvas.Canvas, product: dict, print_ready: bool) -> None:
    origin_x = BLEED if print_ready else 0
    origin_y = BLEED if print_ready else 0
    page_width = TRIM_WIDTH + (BLEED * 2 if print_ready else 0)
    page_height = TRIM_HEIGHT + (BLEED * 2 if print_ready else 0)

    c.setFillColor(WHITE)
    c.rect(0, 0, page_width, page_height, stroke=0, fill=1)

    header_bottom = origin_y + TRIM_HEIGHT - HEADER_HEIGHT
    c.setFillColor(BLACK)
    if print_ready:
        c.rect(0, header_bottom, page_width, page_height - header_bottom, stroke=0, fill=1)
    else:
        c.rect(origin_x, header_bottom, TRIM_WIDTH, HEADER_HEIGHT, stroke=0, fill=1)

    c.setFillColor(WHITE)
    c.setFont("TuteaBold", 5.6)
    c.drawString(origin_x + 6 * mm, origin_y + TRIM_HEIGHT - 6.5 * mm, "ТЕХКАРТА TUTEA")

    name = product["name"]
    name_size = fit_text(c, name, "TuteaBold", 14, 8.5, TRIM_WIDTH - 12 * mm)
    c.setFont("TuteaBold", name_size)
    c.drawString(origin_x + 6 * mm, origin_y + TRIM_HEIGHT - 15 * mm, name)

    temp_range, dosage_range, time_range = recommended_parameters(product)
    first_top = origin_y + TRIM_HEIGHT - HEADER_HEIGHT - 3 * mm
    draw_metric(c, origin_x, first_top, "Температура", "°C", choice_values(temp_range, 1))
    draw_metric(c, origin_x, first_top - 17 * mm, "Граммовка", "г", choice_values(dosage_range, 0.5))
    draw_metric(c, origin_x, first_top - 34 * mm, "Время", "мин", choice_values(time_range, 0.5))

    utility_y = origin_y + 24 * mm
    c.setFillColor(BLACK)
    c.setFont("TuteaBold", 6.8)
    c.drawString(origin_x + 6 * mm, utility_y, "ВОДА")
    c.setStrokeColor(MID)
    c.setLineWidth(0.55)
    c.line(origin_x + 17 * mm, utility_y - 0.5 * mm, origin_x + 35 * mm, utility_y - 0.5 * mm)
    c.setFont("TuteaRegular", 5.6)
    c.setFillColor(MID)
    c.drawString(origin_x + 37 * mm, utility_y, "мл")

    c.setFont("TuteaBold", 6.8)
    c.setFillColor(BLACK)
    c.drawString(origin_x + 44 * mm, utility_y, "МЕШАТЬ")
    c.setLineWidth(0.8)
    c.setStrokeColor(DARK)
    c.rect(origin_x + 63 * mm, utility_y - 1.4 * mm, 4 * mm, 4 * mm, stroke=1, fill=0)

    comment_label_y = origin_y + 17 * mm
    c.setFont("TuteaBold", 6.8)
    c.setFillColor(BLACK)
    c.drawString(origin_x + 6 * mm, comment_label_y, "КОММЕНТАРИЙ")
    c.setStrokeColor(LIGHT)
    c.setLineWidth(0.55)
    c.line(origin_x + 6 * mm, origin_y + 11 * mm, origin_x + 68 * mm, origin_y + 11 * mm)
    c.line(origin_x + 6 * mm, origin_y + 6 * mm, origin_x + 68 * mm, origin_y + 6 * mm)

    c.setFillColor(MID)
    c.setFont("TuteaBold", 4.8)
    c.drawString(origin_x + 6 * mm, origin_y + 2.5 * mm, "tutea")
    c.setFont("TuteaRegular", 4.2)
    c.drawRightString(origin_x + 68 * mm, origin_y + 2.5 * mm, "настройка рецепта")

    if print_ready:
        draw_crop_marks(c, origin_x, origin_y)


def create_single_pdf(product: dict, path: Path, print_ready: bool) -> None:
    page_size = (
        TRIM_WIDTH + (BLEED * 2 if print_ready else 0),
        TRIM_HEIGHT + (BLEED * 2 if print_ready else 0),
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=page_size, pageCompression=1)
    c.setTitle(f"Техкарта Tutea — {product['name']}")
    c.setAuthor("Tutea")
    c.setSubject("A7, K-only CMYK" + (", вылеты 3 мм" if print_ready else ""))
    draw_card(c, product, print_ready)
    c.showPage()
    c.save()

    if print_ready:
        reader = PdfReader(str(path))
        page = reader.pages[0]
        page.mediabox = RectangleObject([0, 0, page_size[0], page_size[1]])
        page.cropbox = RectangleObject([0, 0, page_size[0], page_size[1]])
        page.bleedbox = RectangleObject([0, 0, page_size[0], page_size[1]])
        page.trimbox = RectangleObject([BLEED, BLEED, BLEED + TRIM_WIDTH, BLEED + TRIM_HEIGHT])
        writer = PdfWriter()
        writer.add_page(page)
        writer.add_metadata({"/Title": f"Техкарта Tutea — {product['name']}", "/Author": "Tutea", "/Subject": "A7, вылеты 3 мм, K-only CMYK"})
        boxed_path = path.with_suffix(".boxed.pdf")
        with boxed_path.open("wb") as output:
            writer.write(output)
        boxed_path.replace(path)


def combine_pdfs(paths: list[Path], destination: Path, title: str, subject: str) -> None:
    writer = PdfWriter()
    for path in paths:
        reader = PdfReader(str(path))
        writer.add_page(reader.pages[0])
    writer.add_metadata({"/Title": title, "/Author": "Tutea", "/Subject": subject})
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        writer.write(output)


def create_zip(paths: list[Path], destination: Path, folder: str, print_ready: bool) -> None:
    readme = (
        "Техкарты tutea\n\n"
        "Формат: A7, 1 карточка = 1 чай.\n"
        "Карточки предназначены для калибровки рецепта: отметьте итоговую температуру, "
        "граммовку, время, объём воды и необходимость перемешивания.\n"
        + ("Версия для типографии: вылеты 3 мм, метки реза, K-only CMYK.\n" if print_ready else "Чистая версия для обычной печати, K-only CMYK.\n")
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            archive.write(path, f"{folder}/{path.name}")
        archive.writestr("README.txt", readme)


def main() -> None:
    register_fonts()
    products = [
        product
        for product in json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
        if product["id"] != "matcha-1"
    ]
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for legacy_file in OUTPUT_DIR.glob("tutea-tech-cards-a6-*"):
        legacy_file.unlink()
    clean_dir = TEMP_DIR / "clean"
    print_dir = TEMP_DIR / "print"

    clean_paths: list[Path] = []
    print_paths: list[Path] = []
    for product in products:
        clean_path = clean_dir / f"tutea-{product['id']}-tech-card-a7-clean.pdf"
        print_path = print_dir / f"tutea-{product['id']}-tech-card-a7-print.pdf"
        create_single_pdf(product, clean_path, print_ready=False)
        create_single_pdf(product, print_path, print_ready=True)
        clean_paths.append(clean_path)
        print_paths.append(print_path)

    clean_combined = OUTPUT_DIR / "tutea-tech-cards-a7-clean.pdf"
    print_combined = OUTPUT_DIR / "tutea-tech-cards-a7-print.pdf"
    combine_pdfs(clean_paths, clean_combined, "Техкарты Tutea", "A7, K-only CMYK")
    combine_pdfs(print_paths, print_combined, "Техкарты Tutea", "A7, вылеты 3 мм, метки реза, K-only CMYK")
    create_zip(clean_paths, OUTPUT_DIR / "tutea-tech-cards-a7-clean.zip", "clean", print_ready=False)
    create_zip(print_paths, OUTPUT_DIR / "tutea-tech-cards-a7-print.zip", "print", print_ready=True)

    print(f"Generated {len(products)} clean and print-ready tech cards in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
