# Design — File Formats

## Transfer export (Erste Internet Banking `.txt`)

Spec source: `format_danych.pdf`

- Encoding: **Windows-1250**
- Separator: `|` (pipe), including a trailing `|` on every data line
- Header line: `4120414|1`

### Type 1 — regular transfer

```
1|{own_nrb}|{recipient_nrb}|{name}|{address}|{amount}|{payment_method}|{title}|{date}|
```

### Type 6 — split payment (VAT)

```
6|{own_nrb}|{recipient_nrb}|{name}|{address}|{gross_amount}|{payment_method}|/VAT/{vat}/IDC/{nip}/INV/{invoice}/TXT/{title}|{date}|
```

### Field rules

| Field | Format |
|---|---|
| Amount | Polish decimal comma: `123,50` |
| Date | `DD-MM-YYYY`; omitted if null but trailing `|` still present |
| Title | `item.title` + ` ` + `recipient.title_suffix` (if set), truncated to 140 chars |

### Transfer type support

| Type | Status |
|---|---|
| 1 — regular | Fully implemented |
| 6 — split payment | Data model + export logic implemented; not surfaced in UI (business-only feature) |
| 2 — ZUS/KRUS | Data model only; export logic deferred |
| 3/4 — tax office | Data model only; export logic deferred |

---

## Transfer export (Elixir-0 `.pli`)

Spec source: `Elixir-0_EN_2012-09-18_...pdf` (Millennium Bank / Electronic Banking Council standard)

- Encoding: **CP852** (default), **Windows-1250**, or **UTF-8** — user-selectable at export time
- Separator: `,` (comma); most fields quoted with `"`; subfields separated by `|`
- Line ending: **CRLF** (`\r\n`)
- No header or footer

### Line structure (domestic payment)

```
110,{date},{amount_cents},,0,"{own_nrb}","{recipient_nrb}","","{counterparty}",0,,"{title}","","","{classification}",""
```

### Field rules

| Field | Format | Notes |
|---|---|---|
| Date | `YYYYMMDD` | Falls back to today if not set on the batch item |
| Amount | Integer cents (no separator) | 123.50 PLN → `12350` |
| Counterparty | Up to 4 subfields of 35 chars, pipe-separated | name parts first, then address parts; empty middle subfields omitted |
| Title | Up to 4 subfields of 35 chars, pipe-separated | combined `item.title + " " + title_suffix`, max 140 chars before splitting |
| Classification | `"51"` Elixir/SORBNET, `"41"` Express ELIXIR, `"53"` VAT, `"43"` Instant VAT | Derived from `payment_method` and `transfer_type` |

### Transaction classification mapping

| payment_method | transfer_type | tx_type | classification |
|---|---|---|---|
| 0, 1, 6 | 1 (regular) | 110 | 51 |
| 8 | 1 (regular) | 110 | 41 |
| 0, 1, 6 | 6 (split payment) | 110 | 53 |
| 8 | 6 (split payment) | 110 | 43 |

### Endpoint

`GET /api/export/{batch_id}?format=elixir&encoding=cp852`

Encoding values: `cp852` (default), `windows-1250`, `utf-8`.

---

## Recipients import (Erste domestic recipients export `.txt`)

Spec source: `format_danych_Odbiorcy.pdf`

- Encoding: **Windows-1250**
- Separator: `|` (pipe), trailing `|` on every data line
- Header line: `4120414` (version only, no package type)

### Type 1 — regular recipient

```
1|{show_short}|{short_name}|{name}|{address}|{nrb}|{payment_type}|{title}|{mobile_auth}|
```

Field mapping to our data model:

| Bank field | Position | Our field |
|---|---|---|
| Skrócona nazwa | 2 | `short_name` |
| Nazwa | 3 | `name` |
| Adres | 4 | `address` |
| Numer rachunku | 5 | `account_nrb` |
| Typ (0=internal, 1=Elixir) | 6 | `payment_method` (defaults to `"1"` if absent) |
| Tytułem | 7 | `title_suffix` |

### Type 2 — tax office

```
2|{show_short}|{short_name}|{name}|{address}|{nrb}|{identification}|
```

Mapped to `transfer_type = 3` in our model.

### Import behaviour

- NRB checksum validated on each line; invalid lines are recorded as errors and skipped
- Recipients whose NRB already exists in the database are skipped (counted as `skipped`)
- Response: `{ added, skipped, errors[] }`
