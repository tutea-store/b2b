#!/usr/bin/env python3
"""Convert the existing vector A6 tea description cards to A7."""

from __future__ import annotations

import io
import json
import shutil
import zipfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation
from pypdf._page import PageObject
from pypdf.generic import RectangleObject
from reportlab.lib.colors import CMYKColor
from reportlab.lib.pagesizes import A6, A7
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "downloads" / "tea-cards" / "tutea-tea-cards-a6-clean.pdf"
OUTPUT_DIR = ROOT / "assets" / "downloads" / "tea-cards"
TEMP_DIR = ROOT / "tmp" / "pdfs" / "tea-cards-a7"
PRODUCTS = json.loads((ROOT / "products.json").read_text(encoding="utf-8"))

A6_WIDTH, A6_HEIGHT = A6
A7_WIDTH, A7_HEIGHT = A7
BLEED = 3 * mm
PRINT_SIZE = (A7_WIDTH + BLEED * 2, A7_HEIGHT + BLEED * 2)
HEADER_HEIGHT_A6 = 150.2362
HEADER_HEIGHT_A7 = HEADER_HEIGHT_A6 * (A7_HEIGHT / A6_HEIGHT)

WHITE = CMYKColor(0, 0, 0, 0)
BLACK = CMYKColor(0, 0, 0, 100)


def draw_crop_marks(c: canvas.Canvas) -> None:
    gap = 0.7 * mm
    length = 1.7 * mm
    left = BLEED
    right = BLEED + A7_WIDTH
    bottom = BLEED
    top = BLEED + A7_HEIGHT
    c.setLineWidth(0.35)

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


def print_background() -> PageObject:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=PRINT_SIZE, pageCompression=1)
    c.setFillColor(WHITE)
    c.rect(0, 0, PRINT_SIZE[0], PRINT_SIZE[1], stroke=0, fill=1)
    header_bottom = BLEED + A7_HEIGHT - HEADER_HEIGHT_A7
    c.setFillColor(BLACK)
    c.rect(0, header_bottom, PRINT_SIZE[0], PRINT_SIZE[1] - header_bottom, stroke=0, fill=1)
    draw_crop_marks(c)
    c.showPage()
    c.save()
    buffer.seek(0)
    return PdfReader(buffer).pages[0]


def scaled_page(source_page: PageObject, print_ready: bool) -> PageObject:
    scale_x = A7_WIDTH / A6_WIDTH
    scale_y = A7_HEIGHT / A6_HEIGHT
    if print_ready:
        destination = print_background()
        offset_x = BLEED
        offset_y = BLEED
    else:
        destination = PageObject.create_blank_page(width=A7_WIDTH, height=A7_HEIGHT)
        offset_x = 0
        offset_y = 0

    transform = Transformation().scale(scale_x, scale_y).translate(offset_x, offset_y)
    destination.merge_transformed_page(source_page, transform, over=True)

    if print_ready:
        destination.mediabox = RectangleObject([0, 0, PRINT_SIZE[0], PRINT_SIZE[1]])
        destination.cropbox = RectangleObject([0, 0, PRINT_SIZE[0], PRINT_SIZE[1]])
        destination.bleedbox = RectangleObject([0, 0, PRINT_SIZE[0], PRINT_SIZE[1]])
        destination.trimbox = RectangleObject([BLEED, BLEED, BLEED + A7_WIDTH, BLEED + A7_HEIGHT])
    else:
        box = RectangleObject([0, 0, A7_WIDTH, A7_HEIGHT])
        destination.mediabox = box
        destination.cropbox = RectangleObject(box)
        destination.trimbox = RectangleObject(box)
        destination.bleedbox = RectangleObject(box)
    return destination


def write_single(page: PageObject, path: Path, title: str, subject: str) -> None:
    writer = PdfWriter()
    writer.add_page(page)
    writer.add_metadata({"/Title": title, "/Author": "Tutea", "/Subject": subject})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as output:
        writer.write(output)


def write_combined(pages: list[PageObject], path: Path, subject: str) -> None:
    writer = PdfWriter()
    for page in pages:
        writer.add_page(page)
    writer.add_metadata({"/Title": "Печатные карточки чая Tutea", "/Author": "Tutea", "/Subject": subject})
    with path.open("wb") as output:
        writer.write(output)


def create_zip(paths: list[Path], destination: Path, folder: str, print_ready: bool) -> None:
    readme = (
        "Печатные карточки чая tutea\n\n"
        "Формат: A7, 74 x 105 мм. Одна карточка = один чай.\n"
        "Карточки не содержат цены и параметры заваривания.\n"
        + ("Версия для типографии: вылеты 3 мм, метки реза, K-only CMYK.\n" if print_ready else "Чистая версия для обычной печати, K-only CMYK.\n")
    )
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            archive.write(path, f"{folder}/{path.name}")
        archive.writestr("README.txt", readme)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source PDF: {SOURCE}")
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    clean_dir = TEMP_DIR / "clean"
    print_dir = TEMP_DIR / "print"
    clean_dir.mkdir(parents=True, exist_ok=True)
    print_dir.mkdir(parents=True, exist_ok=True)

    source_pages = PdfReader(str(SOURCE)).pages
    if len(source_pages) != len(PRODUCTS):
        raise ValueError("The source PDF and products.json contain different card counts")
    card_pairs = [
        (source_page, product)
        for source_page, product in zip(source_pages, PRODUCTS)
        if product["id"] != "matcha-1"
    ]

    clean_pages: list[PageObject] = []
    print_pages: list[PageObject] = []
    clean_paths: list[Path] = []
    print_paths: list[Path] = []

    for source_page, product in card_pairs:
        clean_page = scaled_page(source_page, print_ready=False)
        print_page = scaled_page(source_page, print_ready=True)
        clean_path = clean_dir / f"tutea-{product['id']}-a7-clean.pdf"
        print_path = print_dir / f"tutea-{product['id']}-a7-print.pdf"
        write_single(clean_page, clean_path, f"Карточка чая Tutea — {product['name']}", "A7, K-only CMYK")
        write_single(print_page, print_path, f"Карточка чая Tutea — {product['name']}", "A7, вылеты 3 мм, K-only CMYK")
        clean_pages.append(clean_page)
        print_pages.append(print_page)
        clean_paths.append(clean_path)
        print_paths.append(print_path)

    clean_pdf = OUTPUT_DIR / "tutea-tea-cards-a7-clean.pdf"
    print_pdf = OUTPUT_DIR / "tutea-tea-cards-a7-print.pdf"
    write_combined(clean_pages, clean_pdf, "A7, K-only CMYK")
    write_combined(print_pages, print_pdf, "A7, вылеты 3 мм, метки реза, K-only CMYK")
    create_zip(clean_paths, OUTPUT_DIR / "tutea-tea-cards-a7-clean.zip", "clean", print_ready=False)
    create_zip(print_paths, OUTPUT_DIR / "tutea-tea-cards-a7-print.zip", "print", print_ready=True)
    print(f"Converted {len(card_pairs)} tea cards from A6 to A7")


if __name__ == "__main__":
    main()
