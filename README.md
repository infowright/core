# Infowright Core

Open building blocks for ISO 19650 information management.

Infowright Core is the open part of [Infowright](https://github.com/infowright) - a tool that keeps project information on track so designers can focus on design. Core contains the shared, standards-based pieces that anyone can use, inspect and improve.

> **Status:** early development. APIs may still change.

## Packages

| Package                         | Purpose                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@infowright/iso19650`**      | Container states, status codes, revision codes and naming conventions. Every project defines its own **information standard** with one or more naming variants (e.g. drawings and documents); a variant can be built from example names. Code lists explain names and are enforced only where a field is set to strict. The UK National Annex is a ready-made preset |
| **`@infowright/project`**       | Project record (code, name, type, client, location, budget, dates, status) with its own copy of the information standard                                                                                                                                                                                                                                             |
| **`@infowright/delivery-plan`** | MIDP / TIDP: milestones, deliverables and what is due at each milestone, validated against the project standard                                                                                                                                                                                                                                                      |
| **`@infowright/schedule`**      | Reads programmes from Primavera P6 (XER), Microsoft Project (XML) and Excel, including P6 date formats and actual markers                                                                                                                                                                                                                                            |
| **`@infowright/cde`**           | Reads container lists exported from a CDE (Excel or CSV) and compares them with the delivery plan: delivered, in progress, missing, overdue                                                                                                                                                                                                                          |
| **`@infowright/common`**        | Small shared helpers (dates)                                                                                                                                                                                                                                                                                                                                         |

## Example

```ts
import { createProject } from '@infowright/project';
import { checkName, checkRevisionForStatus, inferConvention } from '@infowright/iso19650';

// A project starts from the UK National Annex and can then change anything:
// naming fields, status codes, revision format.
const project = createProject({ id: 'p1', code: 'DEMO', name: 'Demo hospital' });
project.standard.statusCodes.push({
  code: 'IFC',
  description: 'Issued for construction',
  state: 'published',
  revisionType: 'contractual',
});

checkName('DEMO-ACME-ZZ-01-DR-S-001', project.standard)?.result.problems;
// [{ field: 'number', message: 'Number "001" has 3 characters; expected 4 to 6.' }]

// Add a second variant for documents, built from an example name.
const documents = inferConvention(['DEMO-ACME-PLN-000003'], 'Documents');
if (documents) project.standard.namingConventions.push(documents);
checkName('DEMO-ACME-REP-000014', project.standard)?.convention.name;
// 'Documents'

checkRevisionForStatus('P02', 'IFC', project.standard);
// ['Status code IFC requires a contractual revision, e.g. C01.']
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
