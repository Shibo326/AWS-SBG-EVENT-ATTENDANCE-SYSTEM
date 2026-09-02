#!/usr/bin/env python3
"""
build_report.py — Convert PROJECT_PLAN.md into a professor-ready Word document.

Renders:
  - Title / cover page
  - Auto-generated table of contents field (updates in Word with F9)
  - Heading levels (#, ##, ###)
  - Markdown tables -> real Word tables
  - Fenced code blocks (``` ) -> monospace shaded blocks
  - Bullet lists, ordered lists, bold/inline-code, horizontal rules
  - Page numbers in the footer

Usage:
    py tools/build_report.py
Output:
    AWSSBG_Attendance_System_Project_Plan.docx  (in project root)
"""

import re
import os
from datetime import date

from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ------------------------------------------------------------------ paths
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "PROJECT_PLAN.md")
OUT = os.path.join(ROOT, "AWSSBG_Attendance_System_Project_Plan.docx")

# ------------------------------------------------------------------ palette
INK = RGBColor(0x1A, 0x1A, 0x2E)       # near-black headings
ACCENT = RGBColor(0xFF, 0x99, 0x00)    # AWS amber accent
SUBTLE = RGBColor(0x55, 0x55, 0x66)    # muted body
CODE_BG = "F2F3F5"                      # code block shading
TABLE_HDR_BG = "1A1A2E"                 # table header fill (dark)
LINE = RGBColor(0xD0, 0xD3, 0xDA)


# ------------------------------------------------------------------ helpers
def set_cell_background(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def shade_paragraph(paragraph, hex_color):
    p_pr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    p_pr.append(shd)


def add_page_number_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    run = p.add_run("Page ")
    run.font.size = Pt(9)
    run.font.color.rgb = SUBTLE

    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run2 = p.add_run()
    run2.font.size = Pt(9)
    run2.font.color.rgb = SUBTLE
    run2._r.append(fld_begin)
    run2._r.append(instr)
    run2._r.append(fld_end)


def add_toc(document):
    para = document.add_paragraph()
    run = para.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = r'TOC \o "1-2" \h \z \u'
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Right-click and choose \u201cUpdate Field\u201d to build the table of contents."
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_sep)
    run._r.append(placeholder)
    run._r.append(fld_end)


INLINE_RE = re.compile(r"(\*\*.+?\*\*|`.+?`)")


def add_inline(paragraph, text):
    """Render **bold** and `code` inline spans into a paragraph."""
    # strip markdown links -> keep label (url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", text)
    for part in INLINE_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            r = paragraph.add_run(part[2:-2])
            r.bold = True
        elif part.startswith("`") and part.endswith("`"):
            r = paragraph.add_run(part[1:-1])
            r.font.name = "Consolas"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(0xB0, 0x30, 0x00)
        else:
            paragraph.add_run(part)


def clean_cell(text):
    text = text.strip()
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = text.replace("**", "").replace("`", "")
    return text


# ------------------------------------------------------------------ table parsing
def is_table_sep(line):
    return bool(re.match(r"^\s*\|?\s*:?-{2,}", line)) and "|" in line


def split_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def add_table(document, header, rows):
    table = document.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True

    hdr_cells = table.rows[0].cells
    for i, h in enumerate(header):
        set_cell_background(hdr_cells[i], TABLE_HDR_BG)
        p = hdr_cells[i].paragraphs[0]
        run = p.add_run(clean_cell(h))
        run.bold = True
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    for r_idx, row in enumerate(rows):
        cells = table.add_row().cells
        for i in range(len(header)):
            val = row[i] if i < len(row) else ""
            p = cells[i].paragraphs[0]
            run = p.add_run(clean_cell(val))
            run.font.size = Pt(9.5)
            if r_idx % 2 == 1:
                set_cell_background(cells[i], "F7F8FA")


def add_code_block(document, code_lines):
    p = document.add_paragraph()
    shade_paragraph(p, CODE_BG)
    p.paragraph_format.left_indent = Inches(0.1)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run("\n".join(code_lines))
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(0x22, 0x22, 0x33)


# ------------------------------------------------------------------ cover page
def build_cover(document):
    for _ in range(3):
        document.add_paragraph()

    bar = document.add_paragraph()
    bar.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = bar.add_run("AWS STUDENT BUILDER GROUP")
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = ACCENT

    sub = document.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("STI College Global City \u2022 Taguig")
    r.font.size = Pt(11)
    r.font.color.rgb = SUBTLE

    document.add_paragraph()

    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("Event Attendee Time Tracking\n& Certificate Eligibility System")
    r.bold = True
    r.font.size = Pt(26)
    r.font.color.rgb = INK

    tag = document.add_paragraph()
    tag.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = tag.add_run("A web-based, QR-powered attendance management platform")
    r.italic = True
    r.font.size = Pt(12)
    r.font.color.rgb = SUBTLE

    for _ in range(6):
        document.add_paragraph()

    meta = [
        ("Document type", "Implementation Plan (Full Project Report)"),
        ("Version", "3.1 \u2014 production deployment, multi-event"),
        ("Prepared by", "Rhenmart \u2014 AWS Cloud Club Lead & Full-Stack AI Orchestrator"),
        ("Organization", "AWS Student Builder Group, STI College Global City"),
        ("Date", date.today().strftime("%B %d, %Y")),
    ]
    for label, value in meta:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(f"{label}:  ")
        r.bold = True
        r.font.size = Pt(11)
        r.font.color.rgb = INK
        r2 = p.add_run(value)
        r2.font.size = Pt(11)
        r2.font.color.rgb = SUBTLE

    document.add_page_break()

    h = document.add_paragraph()
    r = h.add_run("Table of Contents")
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = INK
    add_toc(document)
    document.add_page_break()


# ------------------------------------------------------------------ base styles
def configure_styles(document):
    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.25

    for name, size in (("Heading 1", 20), ("Heading 2", 15), ("Heading 3", 12.5)):
        st = document.styles[name]
        st.font.name = "Calibri"
        st.font.size = Pt(size)
        st.font.color.rgb = INK
        st.font.bold = True
        st.paragraph_format.space_before = Pt(16 if name == "Heading 1" else 12)
        st.paragraph_format.space_after = Pt(6)
        st.paragraph_format.keep_with_next = True


# ------------------------------------------------------------------ main render
def render():
    with open(SRC, "r", encoding="utf-8") as f:
        lines = f.read().split("\n")

    document = Document()
    configure_styles(document)

    section = document.sections[0]
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.top_margin = Inches(0.9)
    section.bottom_margin = Inches(0.9)
    add_page_number_footer(section)

    build_cover(document)

    i = 0
    n = len(lines)
    first_h1_seen = False

    while i < n:
        line = lines[i]
        stripped = line.strip()

        # skip empty
        if not stripped:
            i += 1
            continue

        # horizontal rule
        if re.match(r"^-{3,}$", stripped):
            i += 1
            continue

        # code fence
        if stripped.startswith("```"):
            block = []
            i += 1
            while i < n and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            add_code_block(document, block)
            continue

        # table: current line has pipes and next line is a separator
        if "|" in line and i + 1 < n and is_table_sep(lines[i + 1]):
            header = split_row(line)
            i += 2  # skip header + separator
            rows = []
            while i < n and "|" in lines[i] and lines[i].strip():
                if is_table_sep(lines[i]):
                    i += 1
                    continue
                rows.append(split_row(lines[i]))
                i += 1
            add_table(document, header, rows)
            document.add_paragraph()
            continue

        # headings
        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1:
                if first_h1_seen:
                    document.add_page_break()
                first_h1_seen = True
                document.add_heading(text, level=1)
            else:
                document.add_heading(text, level=min(level, 3))
            i += 1
            continue

        # bullet list
        if re.match(r"^[-*]\s+", stripped):
            p = document.add_paragraph(style="List Bullet")
            add_inline(p, re.sub(r"^[-*]\s+", "", stripped))
            i += 1
            continue

        # ordered list
        if re.match(r"^\d+\.\s+", stripped):
            p = document.add_paragraph(style="List Number")
            add_inline(p, re.sub(r"^\d+\.\s+", "", stripped))
            i += 1
            continue

        # plain paragraph
        p = document.add_paragraph()
        add_inline(p, stripped)
        i += 1

    document.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    render()
