"""Create a separate CFF OTF copy, optionally mapping a-z to A-Z outlines."""
import argparse
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.qu2cuPen import Qu2CuPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont, newTable


def reexport(source, output, uppercase=False):
    if output.exists() or source.resolve() == output.resolve():
        raise ValueError("Output must be a new file; originals are never overwritten")
    with TTFont(source) as font:
        if "fvar" in font or "SVG " in font or "CFF2" in font:
            raise ValueError("Variable/SVG/CFF2 fonts require separate inspection")
        if uppercase:
            cmap = font.getBestCmap()
            missing = [chr(code) for code in range(65, 91) if code not in cmap]
            if missing:
                raise ValueError(f"Missing uppercase characters: {missing}")
            for table in font["cmap"].tables:
                if table.isUnicode():
                    for code in range(65, 91):
                        table.cmap[code + 32] = cmap[code]
        expected_cmap = dict(font.getBestCmap())
        glyph_order = font.getGlyphOrder()
        expected_metrics = dict(font["hmtx"].metrics)
        if output.suffix.lower() == ".otf" and "glyf" in font:
            glyphs = font.getGlyphSet()
            charstrings = {}
            for name in glyph_order:
                pen = T2CharStringPen(font["hmtx"].metrics[name][0], glyphs)
                glyphs[name].draw(Qu2CuPen(pen, max_err=0.5, all_cubic=True,
                                         reverse_direction=True))
                charstrings[name] = pen.getCharString()
            builder = FontBuilder(font=font, isTTF=False)
            builder.isTTF = False
            builder.setupCFF(font["name"].getDebugName(6) or "ReexportedFont", {
                "FullName": font["name"].getDebugName(4) or "Reexported Font",
                "FamilyName": font["name"].getDebugName(16) or font["name"].getDebugName(1),
                "Weight": font["name"].getDebugName(2) or "Regular",
            }, charstrings, {})
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
        assert verified.getBestCmap() == expected_cmap, "Character map changed"
        assert verified.getGlyphOrder() == glyph_order, "Glyph order changed"
        assert verified["hmtx"].metrics == expected_metrics, "Metrics changed"
        if output.suffix.lower() == ".otf":
            assert verified.sfntVersion == "OTTO" and "CFF " in verified
        for glyph in verified.getGlyphSet().values():
            # Force outline decoding rather than merely checking the font header.
            from fontTools.pens.recordingPen import RecordingPen
            glyph.draw(RecordingPen())
    print(f"Verified {output}: {len(glyph_order)} glyphs, {len(expected_cmap)} characters")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--uppercase-to-lowercase", action="store_true")
    args = parser.parse_args()
    reexport(args.source, args.output, args.uppercase_to_lowercase)
