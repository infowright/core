# Infowright Core

Open building blocks for ISO 19650 information management.

Infowright Core is the open part of [Infowright](https://github.com/infowright) - a tool that keeps project information on track so designers can focus on design. Core contains the shared, standards-based pieces that anyone can use, inspect and improve.

> **Status:** early setup. Nothing here is ready for use yet.

## What will live here

| Module | Purpose |
|---|---|
| **ISO 19650 codes** | Status codes (S0-S4, A, B...), revision codes (P01, C01...), container states (WIP, Shared, Published, Archived) as typed, testable data |
| **Naming conventions** | Configurable container naming conventions (Project-Originator-Volume-Level-Type-Role-Number and variants) with a validator that explains *why* a name fails |
| **Delivery plan schema** | A common data model for MIDP / TIDP / responsibility matrix |
| **Schedule parsers** | Readers for Primavera P6 (XER), Microsoft Project (XML) and Excel schedules |

## Principles

- **Standards first.** Everything maps to ISO 19650 terms, so the data makes sense to any information manager.
- **No project data in this repository.** Tests use made-up sample data only.
- **Small and dependable.** Each module does one job, is fully tested and can be used on its own.

## Licence

Infowright Core is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

In short: you can use, modify and share this code, but if you run a modified version as a service for others, you must publish your changes under the same licence. For other licensing arrangements, contact the maintainer.

Copyright (c) 2026 Bartek Kulig.
