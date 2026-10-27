#!/usr/bin/env python3
"""Wandelt Vorlesungsdokumente (.docx) in Lesetexte für die App um.

Aufruf:  python3 scripts/import_texts.py <fach-id>
         liest content/subjects/<fach-id>/sources/*.docx und schreibt content/subjects/<fach-id>/texts/
         (oder mit zwei Pfaden: python3 scripts/import_texts.py <quellordner> <zielordner>)

Die Kapitel-id kommt aus dem Dateinamen:
- Dateiname beginnt mit einer Kapitel-id aus subject.json, z. B. "l01.docx" oder "l01 Einführung.docx" → l01
- Key-Messages-Schema von Management Control: "KM S1a-…" → s1a, "KM S3&4 …" → s34
Nur Python-Standardbibliothek.
"""

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def lecture_id(name: str, known: set[str] | None = None) -> str | None:
    stem = Path(name).stem.lower()
    for lid in sorted(known or (), key=len, reverse=True):
        if stem == lid or re.match(rf"^{re.escape(lid)}[\s_.-]", stem):
            return lid
    m = re.search(r"S(\d)\s*([a-z]|&\s*\d)", name)
    if not m:
        return None
    return f"s{m.group(1)}{m.group(2).replace('&', '').strip()}"


def numbering_indents(z: zipfile.ZipFile) -> dict[str, int]:
    """numId → linker Einzug der Ebene 0 (in twips)."""
    try:
        root = ET.fromstring(z.read("word/numbering.xml"))
    except KeyError:
        return {}
    abstract: dict[str, int] = {}
    for a in root.iter(f"{W}abstractNum"):
        for lvl in a.iter(f"{W}lvl"):
            if lvl.get(f"{W}ilvl") != "0":
                continue
            ind = lvl.find(f".//{W}ind")
            left = ind.get(f"{W}left") or ind.get(f"{W}start") if ind is not None else None
            abstract[a.get(f"{W}abstractNumId")] = int(left or 0)
    out = {}
    for n in root.iter(f"{W}num"):
        ref = n.find(f"{W}abstractNumId")
        if ref is not None:
            out[n.get(f"{W}numId")] = abstract.get(ref.get(f"{W}val"), 0)
    return out


def paragraphs(path: Path):
    with zipfile.ZipFile(path) as z:
        indents = numbering_indents(z)
        root = ET.fromstring(z.read("word/document.xml"))
    for p in root.iter(f"{W}p"):
        runs = [r for r in p.iter(f"{W}r") if "".join(t.text or "" for t in r.iter(f"{W}t"))]
        text = "".join(t.text or "" for t in p.iter(f"{W}t"))
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue
        bold = bool(runs) and all(r.find(f"{W}rPr/{W}b") is not None for r in runs)
        num = p.find(f"{W}pPr/{W}numPr/{W}numId")
        indent = None
        if num is not None:
            own = p.find(f"{W}pPr/{W}ind")
            own_left = own.get(f"{W}left") or own.get(f"{W}start") if own is not None else None
            indent = int(own_left) if own_left else indents.get(num.get(f"{W}val"), 0)
        yield text, bold, indent


def convert(path: Path) -> dict:
    title = None
    sections: list[dict] = []
    for text, bold, indent in paragraphs(path):
        if title is None:
            title = text
            continue
        if bold and len(text) < 60:
            sections.append({"heading": text.rstrip(".…"), "blocks": []})
            continue
        if not sections:
            sections.append({"heading": "", "blocks": []})
        blocks = sections[-1]["blocks"]
        is_def = sections[-1]["heading"].lower().startswith("definition")

        if indent is None:
            block = {"kind": "para", "text": text}
        else:
            block = {"kind": "item", "text": text, "indent": indent}
            prev = blocks[-1] if blocks else None
            # Unterpunkt: stärker eingerückt als ein vorheriger Punkt, der mit ":" endet
            if prev and prev["kind"] == "item" and indent > prev["indent"] and prev["text"].endswith(":"):
                prev.setdefault("children", []).append(text)
                continue
            if prev and prev.get("children") and indent > prev["indent"]:
                prev["children"].append(text)
                continue

        if is_def:
            m = re.match(r"^([^:]{2,80}?)\s*:\s*(.+)$", text)
            if m:
                block["term"], block["text"] = m.group(1).strip(), m.group(2).strip()
        blocks.append(block)

    for s in sections:
        for b in s["blocks"]:
            b.pop("indent", None)
    return {"title": title or path.stem, "source": path.name, "sections": sections}


def main():
    if len(sys.argv) == 2:
        subject = Path("content/subjects") / sys.argv[1]
        src, dest = subject / "sources", subject / "texts"
        known = {l["id"] for l in json.loads((subject / "subject.json").read_text(encoding="utf-8"))["lectures"]}
    elif len(sys.argv) == 3:
        src, dest, known = Path(sys.argv[1]), Path(sys.argv[2]), set()
    else:
        sys.exit(__doc__)
    dest.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*.docx")):
        lid = lecture_id(f.name, known)
        if not lid:
            print(f"übersprungen (keine Kapitel-id): {f.name}")
            continue
        data = {"lecture": lid, **convert(f)}
        out = dest / f"{lid}.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        n = sum(len(s["blocks"]) for s in data["sections"])
        print(f"{f.name} → {out} ({len(data['sections'])} Abschnitte, {n} Blöcke)")


if __name__ == "__main__":
    main()
