# Changelog

All notable changes to this project will be documented in this file.  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [1.0.0]

### Added

Initial release of `@espressif/rainmaker-neo-base-sdk` — the TypeScript SDK for **ESP RainMaker Neo**.

#### Authentication & user management

- Complete account management, including sign-up, sign-in, password management, session restore, profile management, and temporary credentials.
- Support for phone-number preferred username and `assumeRole` with optional S3/KVS scopes.

#### Provisioning

- Support for BLE provisioning with Assisted Claiming.
- Device discovery helpers (`createESPDevice`, `searchESPDevices`) with adapter interfaces for native iOS/Android modules.

#### Node, device & service management

- Manage devices and services with configuration, parameter control, shadow synchronization, and time-series data.
- Node config sync/reload, delete, param get/set, and device/service lookup.

#### Groups & sharing

- Create and manage groups and subgroups, control groups, and share access with other users.
- Group control via MQTT multicast / bulk parameter updates.
- Share groups, list sharing info, and accept/decline incoming sharing requests.

#### Automations

- Create and manage schedules, triggers, and automations for nodes and groups.

#### Real-time connectivity

- Receive live device updates through AWS IoT MQTT.
- Transport and subscription managers with configurable channel order, failover, and capability discovery.

#### Notifications & integrations

- List, register, and unregister integration endpoints.
- App-supplied adapters for MQTT, storage, and provisioning (React Native and other hosts).

#### SDK core

- `ESPRMNeoBase.configure()` as the primary entry point (`init()` retained as an alias).
- Full TypeScript types across auth, nodes, devices, groups, schedules, triggers, automations, and transports.
