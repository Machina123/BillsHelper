"""
Parser for PLEWIBNRA.txt — NBP bank settlement number registry.

File format (per NBP DIT spec, 2018-07-27):
  - Tab-separated, fixed-position fields
  - Encoding: Latin 2 IBM (cp852)
  - Field 1: bank/provider identifier (3 digits = bank, 4 = cooperative bank, 5 = payment provider)
  - Field 2: bank/provider name
  - One row per organisational unit (branch); many rows share the same identifier

Output: JSON file with an array of {"id": ..., "name": ...} objects, one per unique bank.

Usage:
  python parse_plewibnra.py [--force] [output.json]
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path


ENCODING = "cp852"
FIELD_SEPARATOR = "\t"
DOWNLOAD_URL = "https://ewib.nbp.pl/plewibnra?dokNazwa=plewibnra.txt"

SCRIPT_DIR = Path(__file__).parent
INPUT_PATH = SCRIPT_DIR / "plewibnra.txt"


def download(dest: Path) -> None:
    print(f"Downloading from {DOWNLOAD_URL} ...")
    try:
        urllib.request.urlretrieve(DOWNLOAD_URL, dest)
        print(f"Saved to {dest}")
    except Exception as e:
        print(f"Error: download failed: {e}")
        sys.exit(1)


def parse(input_path: Path) -> dict[str, str]:
    banks: dict[str, str] = {}

    with input_path.open(encoding=ENCODING, errors="replace") as f:
        for line in f:
            line = line.rstrip("\n\r")
            if not line:
                continue

            fields = line.split(FIELD_SEPARATOR)
            if len(fields) < 2:
                continue

            identifier = fields[0].strip()
            full_name = fields[1].strip()
            trade_name = fields[2].strip() if len(fields) > 2 else ""
            name = trade_name or full_name

            if not identifier or not identifier.isdigit():
                continue

            # Keep the first occurrence; all rows for the same identifier share the same name.
            if identifier not in banks:
                banks[identifier] = name

    return banks


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse PLEWIBNRA.txt into a JSON bank list.")
    parser.add_argument(
        "--force", action="store_true",
        help="Force re-download of plewibnra.txt even if it already exists.",
    )
    parser.add_argument(
        "output", nargs="?", default=str(SCRIPT_DIR / "plewibnra.json"),
        help="Output JSON file path (default: plewibnra.json next to the script).",
    )
    args = parser.parse_args()

    output_path = Path(args.output)

    if args.force or not INPUT_PATH.exists():
        download(INPUT_PATH)

    banks = parse(INPUT_PATH)

    result = [{"id": k, "name": v} for k, v in sorted(banks.items(), key=lambda x: x[0])]

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Parsed {len(result)} unique banks/providers -> {output_path}")


if __name__ == "__main__":
    main()
