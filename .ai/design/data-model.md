# Design — Data Model

## `recipients`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK | |
| `name` | string(80) | not null | |
| `address` | string(60) | not null | |
| `account_nrb` | string(26) | not null | raw digits, IBAN checksum validated |
| `transfer_type` | integer | not null, default 1 | 1=regular, 2=ZUS, 3=tax office, 6=split payment |
| `payment_method` | string(1) | not null, default "1" | 0=internal, 1=Elixir, 6=SORBNET, 8=Express ELIXIR |
| `short_name` | string(20) | nullable | quick-identification label; maps to "Skrócona nazwa" in Erste export |
| `nip` | string(10) | nullable | 10 digits |
| `title_suffix` | string(140) | nullable | appended to transfer title at export time |

## `batches`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK | |
| `label` | string(100) | not null | e.g. "May 2026" |
| `created_at` | datetime | not null | UTC, set on insert |

## `batch_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK | |
| `batch_id` | integer | FK → batches.id, cascade delete | |
| `recipient_id` | integer | FK → recipients.id | |
| `amount` | numeric(13,2) | not null | |
| `invoice_number` | string(35) | nullable | |
| `title` | string(140) | not null | base transfer title; suffix appended at export |
| `execution_date` | date | nullable | DD-MM-YYYY in the output file |
| `vat_amount` | numeric(13,2) | nullable | type-6 split payment only |

## `settings`

| Column | Type | Notes |
|---|---|---|
| `key` | string(50) | PK |
| `value` | string(200) | nullable |

Currently used keys: `own_account_nrb`.
