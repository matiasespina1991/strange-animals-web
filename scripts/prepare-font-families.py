"""Stage fonts by internal family, preserving duplicates and original files."""
import argparse
from collections import defaultdict
from hashlib import sha256
from pathlib import Path
import re
import shutil
from fontTools.ttLib import TTFont

EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}
ALIASES = {
    "Fung FooRegular": "Fung Foo",
    "Fung FooItalic": "Fung Foo",
    "Fung FooFufanu": "Fung Foo",
    "Fung FooFufanu Italic": "Fung Foo",
}


def family_name(font):
    names = font["name"]
    family = names.getDebugName(16) or names.getDebugName(1)
    if not family:
        raise ValueError("Font has no family name")
    family = re.sub(r"^(Volume|CREALAB)W00-.*$", r"\1", family.strip())
    return ALIASES.get(family, family)


def prepare(source, output):
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    families = defaultdict(list)
    for file in sorted(source.rglob("*")):
        relative = file.relative_to(source)
        if "_alreadyUploaded" in relative.parts or file.name.startswith("._"):
            continue
        if not file.is_file() or file.suffix.lower() not in EXTENSIONS:
            continue
        with TTFont(file, lazy=True) as font:
            family = family_name(font)
        if family in {".", ".."} or any(char in family for char in "/\\"):
            raise ValueError(f"Unsafe family name: {family}")
        families[family].append(file)

    if not families:
        raise ValueError("No fonts found")
    output.mkdir(parents=True)
    count = 0
    for family, files in sorted(families.items()):
        for file in files:
            # Retain the original relative path: byte-identical copies remain separate.
            target = output / family / file.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, target)
            if sha256(file.read_bytes()).digest() != sha256(target.read_bytes()).digest():
                raise ValueError(f"Copy verification failed: {file}")
            count += 1
            relative = file.relative_to(source)
            if len(relative.parts) > 1:
                package = source / relative.parts[0]
                for companion in package.rglob("*"):
                    if not companion.is_file() or companion.suffix.lower() in EXTENSIONS:
                        continue
                    if companion.name == ".DS_Store" or companion.name.startswith("._"):
                        continue
                    destination = output / family / companion.relative_to(source)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(companion, destination)
        print(f"{family}: {len(files)} font files")
    print(f"Verified {count} font files in {len(families)} families: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("fonts to upload"))
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    prepare(arguments.source.resolve(), arguments.output.resolve())
