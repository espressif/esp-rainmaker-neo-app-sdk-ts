<!--
SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
SPDX-License-Identifier: Apache-2.0
-->

# Contract layer (`__tests__/contract/`)

Validates the OpenAPI schema bundle against the backend spec.
One validator, two halves.

---

## 1. Schema bundle integrity (runs on every PR — network-free)

`schemaBundle.contract.test.ts` verifies that `contracts/openapi/generated/schemas.json`
is well-formed: every exported schema compiles with AJV, and the bundle is
non-empty.

```bash
npm run test:contract
```

This catches:
- A corrupt or hand-edited `schemas.json`
- A schema with invalid JSON Schema syntax after OpenAPI normalisation
- A missing schema (added to `config.mjs` but `schema:gen` not re-run)

---

## 2. Live response conformance (nightly — needs a backend)

The same `assertValidSchema(...)` used in unit and workflow tests can be run
against real API responses to detect **backend breaking changes** before the SDK
feels them. Add a file like `live.contract.test.ts` here, gate it on credentials,
and call it in nightly CI:

```ts
import { assertValidSchema } from "../../test-utils/schema-validator";
import { getIntegrationTestConfig, getIntegrationTestUser } from "../integration/setup";

const creds = getIntegrationTestUser();
const maybe = creds ? describe : describe.skip;

maybe("Contract (live): GET /v1/groups response shape", () => {
  it("real response conforms to ListGroupsResponse", async () => {
    // initialise SDK, authenticate, call the API manager directly for the
    // raw response body, then:
    // assertValidSchema("ListGroupsResponse", rawBody);
    expect(true).toBe(true); // replace with real call
  });
});
```

Because the schema bundle is regenerated from the vendored spec, the live suite
stays in lock-step with `npm run schema:gen` — no second source of truth.
