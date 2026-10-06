# Infowright Core

Open building blocks for ISO 19650 information management.

Infowright Core is the open part of [Infowright](https://github.com/infowright) - a tool that keeps project information on track so designers can focus on design. Core contains the shared, standards-based pieces that anyone can use, inspect and improve.

> **Status:** early development. APIs may still change.

## Modules

| Module                   | Purpose                                                                                                             | Status  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------- |
| **ISO 19650 codes**      | Container states, status codes (UK National Annex: S0-S7, A1..An, B1..Bn, CR) and revision codes (P01.01, P01, C01) | Done    |
| **Naming conventions**   | Configurable naming conventions with a UK National Annex preset and a validator that explains _why_ a name fails    | Done    |
| **Delivery plan schema** | A common data model for MIDP / TIDP / responsibility matrix                                                         | Planned |
| **Schedule parsers**     | Readers for Primavera P6 (XER), Microsoft Project (XML) and Excel schedules                                         | Planned |

## Example

```ts
import { checkRevisionForStatus, validateContainerName } from '@infowright/iso19650';

validateContainerName('PRJ-ORG-ZZ-01-DR-S-001').problems;
// [{ field: 'number', message: 'Number "001" has 3 characters; expected 4 to 6.' }]

checkRevisionForStatus('P02', 'A1');
// ['Status code A1 requires a contractual revision starting with C, e.g. C01.']
```

## Principles

- **Standards first.** Everything maps to ISO 19650 terms, so the data makes sense to any information manager.
- **No project data in this repository.** Tests use made-up sample data only.
- **Small and dependable.** Each module does one job, is fully tested and can be used on its own.

## Development

Requirements: Node.js 22.12+ (24 recommended, see `.nvmrc`) and pnpm 12.

```sh
pnpm install     # install dependencies
pnpm test        # run tests
pnpm check       # everything CI runs: formatting, linting, type checks, tests
pnpm format      # auto-format all files
```

Every push and pull request runs `pnpm check` on GitHub Actions.

## Licence

Infowright Core is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

In short: you can use, modify and share this code, but if you run a modified version as a service for others, you must publish your changes under the same licence. For other licensing arrangements, contact the maintainer.

Copyright (c) 2026 Bartek Kulig.
