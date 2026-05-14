# plewibnra parser

Parses the NBP [PLEWIBNRA.txt](https://ewib.nbp.pl/plewibnra?dokNazwa=plewibnra.txt) registry into a JSON list of unique banks and payment service providers with their identifiers.

## Usage

```bash
python parse_plewibnra.py [--force] [output.json]
```

| Argument | Description |
|---|---|
| `--force` | Re-download `plewibnra.txt` even if it already exists |
| `output.json` | Output path (default: `plewibnra.json` next to the script) |

## Output

A JSON array sorted by identifier:

```json
[
  { "id": "101", "name": "NARODOWY BANK POLSKI" },
  { "id": "1010", "name": "BANK SPÓŁDZIELCZY W ..." }
]
```

Identifier length indicates the entity type (per NBP DIT spec):

| Length | Type |
|---|---|
| 3 digits | Bank |
| 4 digits | Cooperative bank |
| 5 digits | Payment service provider |

## Source

Data published by NBP DIT. File format spec: [Struktura pliku plewibnra (PDF)](https://ewib.nbp.pl/plewibnra?dokNazwa=plewibnraDokumentacja.pdf).
