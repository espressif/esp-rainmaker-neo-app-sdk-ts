# SDK tests

## Test Structure

The SDK uses Jest with **five** separate test projects (see `jest.config.js`):

- **unit** (`npm test` / `jest --selectProjects unit`): Isolated tests driven through the
  `setupSdkTest()` harness (see TESTING_GUIDE §6.3b) — no network calls or real backends
- **contract** (`npm run test:contract`): Verifies the generated AJV schema bundle against the vendored OpenAPI spec — offline
- **workflow** (`npm run test:workflow`): Multi-module business flows with only the HTTP boundary stubbed by schema-validated responses — offline
- **adapter** (`npm run test:adapter`): Shared contract suites that every platform adapter implementation must pass — offline
- **integration** (`npm run test:integration`): Tests that hit real backends, require env vars (`.env.test`), and are optional

`npm run test:all` runs unit + contract + workflow + adapter + integration.

> The former **demo** project (`test:validated`) was removed when the harness migration made the
> schema-validated pattern universal — it double-ran seven hard-listed suites.

## Architecture: method extensions

> **Harness note:** tests written with `setupSdkTest()` never need the
> imports below — the harness imports `src/methods/export` once, registering
> every prototype method. This section remains for the few non-harness suites
> (device/provisioning, MQTT-service).

The SDK uses a **methods pattern**: instance methods live in `src/methods/<ClassName>/` and are attached to class prototypes at load time. The main entry point (`src/types/mainTypes.ts`) imports `src/methods/export`, so in production all methods are available.

In tests, **the test runner does not load the package entry point**. So any test that uses an extended class (e.g. `ESPRMNeoUser`, `ESPDevice`, `ESPRMNeoNode`, `ESPRMNeoGroup`) and calls **instance methods** must import the relevant method index so those prototype methods exist.

### What to import

| If your test uses…                                                                | Import the method index (side-effect)                                                                                                    |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ESPRMNeoUser` and calls e.g. `getGroups`, `deleteGroup`, `connectMQTT`            | `import "../../src/methods/ESPRMNeoUser"` or the specific method files you need (e.g. `import "../../src/methods/ESPRMNeoUser/GetGroups"`) |
| `ESPDevice` and calls e.g. `connect`, `provision`                                 | `import "../../src/methods/ESPDevice"`                                                                                                   |
| `ESPRMNeoNode` and calls e.g. `getParams`, `setUser`                               | `import "../../src/methods/ESPRMNeoNode"`                                                                                                 |
| `ESPRMNeoGroup` / `ESPRMNeoSubgroup` and calls e.g. `getNode`, `delete`             | `import "../../src/methods/ESPRMNeoGroup"`, `import "../../src/methods/ESPRMNeoSubgroup"`                                                  |
| `ESPRMNeoSchedule`, `ESPRMNeoTrigger`, `ESPRMNeoAutomation`, `ESPRMNeoSharingRequest` | `import "../../src/methods/ESPRMNeoSchedule"` (etc.)                                                                                      |
| `ESPRMNeoAuth` and calls e.g. `login`, `getLoggedInUser`                           | `import "../../src/methods/ESPRMNeoAuth"` (or specific method files)                                                                      |

Import paths are relative to the test file (e.g. `../../src/methods/...` from `__tests__/user/`, `../src/methods/...` from `__tests__/`).

### Examples

- **user.test.ts** – uses `userInstance.deleteGroup`, `userInstance.deleteSubGroup` → imports `DeleteGroup`, `DeleteSubGroup`, `GetGroups`, `ShareGroup`.
- **device.test.ts**, **ESPDevice.comprehensive.test.ts** – use `device.connect`, etc. → import `"../../src/methods/ESPDevice"`.
- **ESPRMNeoUser.methods.test.ts** – uses User, Group, Subgroup, Node, Schedule, Trigger, Automation → imports the corresponding method indexes.

If you add a new test file that uses one of these classes and call an instance method, add the appropriate method index import at the top of the file. Otherwise you'll see errors like `userInstance.getGroups is not a function` or `device.connect is not a function`.

## Mocks and Test Setup

Unit tests use mocks defined in `__tests__/utils/setup.ts` to ensure tests don't hit the network or real backends. The following modules are mocked:

### Core Services (Always Mocked)

- **MQTTService** (`src/services/MQTTService`): Mocked to prevent real MQTT connections
- **ESPSigV4APIManager** (`src/services/ESPSigV4APIManager`): Mocked to prevent real API calls
- **ESPRMNeoStorage** (`src/services/ESPRMNeoStorage/ESPRMNeoStorage`): Mocked storage operations
- **ESPRMNeoAuth** (`src/ESPRMNeoAuth`): Mocked authentication class

### External Dependencies (Always Mocked)

- **React Native modules**: `react-native`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo` (via `__mocks__/netinfo.ts`)
- **MQTT**: `mqtt` (via `__mocks__/mqtt.ts` - no package installed)
- **AWS SDK**: `@aws-sdk/*`, `aws-amplify`, `aws-iot-device-sdk-v2` (via `__mocks__/aws-iot-device-sdk-v2.ts` - no package installed)
- **HTTP**: `axios` (via `__mocks__/axios.ts` - no package installed)
- **Protobuf**: `google-protobuf`

### Utilities (Mocked)

- **JWT helpers** (`src/services/ESPRMNeoHelpers/DecodeToken`, `.../CheckTokenExpiry`): Mocked token decoding and expiry checks

### Why These Are Mocked

- **MQTTService & ESPSigV4APIManager**: Unit tests should not make network calls or connect to real services
- **ESPRMNeoStorage**: Tests should not depend on actual storage state
- **ESPRMNeoAuth**: Authentication should be mocked to avoid real Cognito calls
- **External dependencies**: Prevent tests from depending on external services or native modules

### What Is NOT Mocked

- **Crypto polyfills**: Real `crypto-js` is used for crypto polyfills in `setup.ts` to ensure crypto operations work correctly
- **Text encoding**: Real `text-encoding` polyfills are used

### Adding New Mocks

When adding new mocks:

1. Add the mock to `__tests__/utils/setup.ts`
2. Document it in this README
3. Ensure the mock doesn't hide real bugs (e.g., validate that error cases are still testable)
4. Keep mocks consistent across test files

## Coverage Requirements

Unit tests must maintain the following coverage thresholds:

- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 70%
- **Statements**: 70%

Run `npm run test:coverage` to check coverage. Focus on testing critical paths:

- Config validation (valid/invalid inputs)
- Auth flows (login, logout, token refresh)
- User operations (getGroups, MQTT connect/disconnect)
- Device operations (connect, disconnect, provisioning)
- Error paths (invalid config, API errors, storage errors)

## Integration Tests

Integration tests verify the SDK against **real backend services** and are **optional** for CI/CD pipelines. They require configuration and may hit external APIs.

### Running Integration Tests

Integration tests run separately from unit tests:

```bash
# Run integration tests only
npm run test:integration

# Run all tests (unit + integration)
npm run test:all
```

### Configuration

Integration tests require environment variables. **Never commit real credentials to version control.**

1. **Copy the example file:**

   ```bash
   cp .env.test.example .env.test
   ```

2. **Fill in your test environment values** in `.env.test`. You can copy `baseUrl` and `userApiBase` (include stage, e.g. `…/prod`), `identityId`, `awsRegion`, `userPoolId`, `clientId`, and `iotEndpoint` from your target app's config (e.g. `esp-rainmaker-home` unified CDF integration or similar) so integration tests run against the same backend.

   ```bash
   RMNEO_BASE_URL=https://your-api.execute-api.region.amazonaws.com
   RMNEO_IDENTITY_ID=region:uuid
   RMNEO_AWS_REGION=ap-south-1
   RMNEO_USER_POOL_ID=region_XXXXXXXX
   RMNEO_CLIENT_ID=your-client-id
   RMNEO_IOT_ENDPOINT=xxxxx-ats.iot.region.amazonaws.com
   # Optional: RMNEO_API_PATH=/prod, RMNEO_USER_API_BASE_URL=..., RMNEO_USER_API_PATH=/prod
   ```

3. **Optional: Add test user credentials** (for authenticated tests):

   ```bash
   RMNEO_TEST_USERNAME=test@example.com
   RMNEO_TEST_PASSWORD=test-password
   ```

4. **Ensure `.env.test` is in `.gitignore`** (it should be by default)

### Integration Test Scope

Integration tests cover:

- **ESPRMNeoBase**: Configuration and initialization with real backend
- **ESPRMNeoAuth**: Real AWS Cognito authentication calls (login, OTP, etc.)
- **ESPRMNeoUser**: Real API calls (getGroups, getTemporaryAWSCredentials, etc.)

### Test Credentials File (Optional)

Some integration tests support loading test user credentials from `test-credentials.json`:

```json
{
  "testUsers": [
    {
      "username": "test@example.com",
      "password": "test-password",
      "description": "Test user for integration tests"
    }
  ]
}
```

**Important**: Never commit `test-credentials.json` to version control. Add it to `.gitignore`.

### CI/CD Integration

Integration tests are **optional** in CI/CD pipelines:

- They require environment variables to be set
- They may be slower due to real network calls
- They may be flaky due to network conditions (integration setup uses a 45s timeout and 1 retry to reduce failures)
- They should be run separately from unit tests

Example CI configuration:

```yaml
# Run unit tests (required)
- run: npm test

# Run integration tests (optional, requires env vars)
- run: npm run test:integration
  env:
    RMNEO_BASE_URL: ${{ secrets.RMNEO_BASE_URL }}
    RMNEO_IDENTITY_ID: ${{ secrets.RMNEO_IDENTITY_ID }}
    # ... other env vars
```

### Troubleshooting

- **"Missing required environment variables"**: Ensure `.env.test` exists and contains all required variables
- **Tests fail with authentication errors**: Verify your test credentials are valid
- **Tests timeout**: Integration tests use a 45s timeout and 1 retry in `__tests__/integration/setup.ts`; adjust there if needed
