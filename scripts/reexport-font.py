"""Create a separate CFF OTF copy, optionally mapping a-z to A-Z outlines."""
import argparse
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
import unicodedata
from fontTools.ttLib import TTFont, newTable
from fontTools.cffLib import FDSelect, FDArrayIndex, FontDict


def use_cid_charset(font, glyph_order):
    """Avoid the CFF1 String INDEX SID limit in very large CJK fonts."""
    top = font["CFF "].cff.topDictIndex[0]
    names = [".notdef"] + [f"cid{index:05d}" for index in range(1, len(glyph_order))]
    top.ROS = ("Adobe", "Identity", 0)
    top.CIDCount = len(names)
    top.FDArray = FDArrayIndex()
    dictionary = FontDict()
    dictionary.FontName = font["name"].getDebugName(6) or "ReexportedFont"
    dictionary.Private = top.Private
    top.FDArray.append(dictionary)
    top.FDSelect = FDSelect(format=3)
    top.FDSelect.gidArray = [0] * len(names)
    top.CharStrings.charStrings = {new: top.CharStrings[old] for old, new in zip(glyph_order, names)}
    top.CharStrings.fdSelect = top.FDSelect
    top.CharStrings.fdArray = top.FDArray
    top.charset = names
    head = font["head"]
    top.FontBBox = [head.xMin, head.yMin, head.xMax, head.yMax]
    # Layout/metrics are still compiled with their original names and glyph IDs.
    # The CID charset renames only the CFF entries, not the font-wide glyph order.
    font.recalcBBoxes = False
    del top.Private


def reexport(source, output, uppercase=False, fill_empty=False):
    if output.exists() or source.resolve() == output.resolve():
        raise ValueError("Output must be a new file; originals are never overwritten")
    with TTFont(source) as font:
        if "fvar" in font or "CFF2" in font:
            raise ValueError("Variable/CFF2 fonts require separate inspection")
        color_tables = {tag: font.getTableData(tag) for tag in ("SVG ", "COLR", "CPAL") if tag in font}
        if uppercase:
            cmap = font.getBestCmap()
            missing = [chr(code) for code in range(65, 91) if code not in cmap]
            if missing:
                raise ValueError(f"Missing uppercase characters: {missing}")
            for table in font["cmap"].tables:
                if table.isUnicode():
                    for code in range(65, 91):
                        table.cmap[code + 32] = cmap[code]
        if fill_empty:
            cmap = font.getBestCmap()
            glyphs = font.getGlyphSet()
            def visible(name):
                if name not in glyphs or name == ".notdef":
                    return False
                pen = BoundsPen(glyphs)
                glyphs[name].draw(pen)
                return pen.bounds is not None
            donors = sorted({name for code, name in cmap.items()
                             if not unicodedata.category(chr(code)).startswith(("C", "Z"))
                             and visible(name)})
            if not donors:
                raise ValueError("No visible glyphs available to fill empty characters")
            candidates = set(cmap) | set(range(33, 127))
            empty = sorted(code for code in candidates
                           if not unicodedata.category(chr(code)).startswith(("C", "Z"))
                           and not visible(cmap.get(code)))
            assignments = {code: donors[index % len(donors)] for index, code in enumerate(empty)}
            for table in font["cmap"].tables:
                if table.isUnicode():
                    table.cmap.update({code: name for code, name in assignments.items()
                                       if code <= (0xFFFF if table.format != 12 else 0x10FFFF)})
            print(f"Filled {len(empty)} printable characters evenly from {len(donors)} glyphs", flush=True)
        expected_cmap = dict(font.getBestCmap())
        glyph_order = font.getGlyphOrder()
        expected_metrics = dict(font["hmtx"].metrics)
        cid_charset = False
        if output.suffix.lower() == ".otf" and "glyf" in font:
            glyphs = font.getGlyphSet()
            charstrings = {}
            for name in glyph_order:
                pen = T2CharStringPen(font["hmtx"].metrics[name][0], glyphs)
                # BasePen converts each quadratic segment to its exact cubic form.
                glyphs[name].draw(ReverseContourPen(pen))
                charstrings[name] = pen.getCharString()
            builder = FontBuilder(font=font, isTTF=False)
            builder.isTTF = False
            builder.setupCFF(font["name"].getDebugName(6) or "ReexportedFont", {
                "FullName": font["name"].getDebugName(4) or "Reexported Font",
                "FamilyName": font["name"].getDebugName(16) or font["name"].getDebugName(1),
                "Weight": font["name"].getDebugName(2) or "Regular",
            }, charstrings, {})
            if len(glyph_order) > 65000:
                use_cid_charset(font, glyph_order)
                cid_charset = True
            for table in ("glyf", "loca", "cvt ", "fpgm", "prep", "gasp", "LTSH", "hdmx", "VDMX"):
                if table in font:
                    del font[table]
            font["maxp"] = newTable("maxp")
            font["maxp"].tableVersion = 0x00005000
            font["maxp"].numGlyphs = len(glyph_order)
            font["post"].formatType = 3.0
        if "DSIG" in font:
            del font["DSIG"]
        font.flavor = None
        output.parent.mkdir(parents=True, exist_ok=True)
        font.save(output)
    with TTFont(output) as verified:
        if cid_charset:
            old_ids = {name: index for index, name in enumerate(glyph_order)}
            assert {code: verified.getGlyphID(name) for code, name in verified.getBestCmap().items()} == {
                code: old_ids[name] for code, name in expected_cmap.items()}, "Character-to-glyph IDs changed"
            assert [verified["hmtx"].metrics[name] for name in verified.getGlyphOrder()] == [
                expected_metrics[name] for name in glyph_order], "Metrics changed"
        else:
            assert verified.getBestCmap() == expected_cmap, "Character map changed"
            assert verified.getGlyphOrder() == glyph_order, "Glyph order changed"
            assert verified["hmtx"].metrics == expected_metrics, "Metrics changed"
        for tag, data in color_tables.items():
            assert verified.getTableData(tag) == data, f"Color table {tag} changed"
        if output.suffix.lower() == ".otf":
            assert verified.sfntVersion == "OTTO" and "CFF " in verified
        for glyph in verified.getGlyphSet().values():
            # Force outline decoding rather than merely checking the font header.
            glyph.draw(RecordingPen())
    print(f"Verified {output}: {len(glyph_order)} glyphs, {len(expected_cmap)} characters")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--uppercase-to-lowercase", action="store_true")
    parser.add_argument("--fill-empty", action="store_true")
    args = parser.parse_args()
    reexport(args.source, args.output, args.uppercase_to_lowercase, args.fill_empty)
