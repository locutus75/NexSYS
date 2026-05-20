# NexSYS - Antigravity Project Brief

## Project Name

**NexSYS**

## Branding

Product name:

> **NexSYS**

Suggested tagline:

> **The next-generation command center for Syscoin.**

Alternative tagline:

> **Self-custody, nodes, bridge safety, and zkSYS readiness for the Syscoin ecosystem.**

## Purpose

Modernize the existing Syscoin UTXO wallet experience, which is based on the original Bitcoin wallet architecture, into a 2026-ready self-custody wallet for users, node operators, developers, and the wider Syscoin ecosystem.

The goal is not to create only a cosmetic redesign of the old wallet. The goal is to build a modern, safe, understandable, and extensible wallet experience on top of Syscoin's proven UTXO foundation.

## Core Vision

Create a wallet that combines:

- Bitcoin-style UTXO reliability
- Modern wallet UX
- Syscoin Native / UTXO awareness
- NEVM and Rollux awareness
- Upcoming zkSYS awareness
- Mainnet, testnet, and development network support
- Bridge safety
- Hardware wallet workflows
- Sentry Node / operator tooling
- Developer and local automation APIs
- Clear user education around chain types and address formats

The wallet should become the serious custody and operator wallet for the Syscoin ecosystem.

## Supported Environments

NexSYS must be designed from the start to support multiple Syscoin environments safely.

Required environments:

- Syscoin Mainnet
- Syscoin Testnet
- Regtest for local development
- Devnet-style environments, if used by Syscoin/zkSYS developers

Required chain layers:

- Syscoin Native / UTXO
- Syscoin NEVM
- Rollux
- zkSYS, when available

Critical rule:

> The UI, API, storage layer, transaction history, bridge state, and address validation must always know which network and chain layer they are operating on. Mainnet and testnet data must never be silently mixed.

## Product Positioning

### Pali Wallet

Pali Wallet remains the browser wallet for:

- dApp interaction
- browser-based signing
- daily Web3 usage
- NEVM / Rollux interaction
- lightweight user flows

### NexSYS

This project should focus on:

- Full-node users
- Long-term SYS holders
- Sentry Node operators
- UTXO users
- Advanced custody
- Multisig
- Watch-only wallets
- Hardware wallets
- Bridge safety
- Local wallet automation
- Power-user transaction workflows

Positioning statement:

> NexSYS is the serious self-custody, UTXO, bridge, and node-operator wallet for the Syscoin ecosystem.

## Main Problem To Solve

Syscoin has multiple environments that are powerful but can confuse users:

- Syscoin Native / UTXO
- Syscoin NEVM
- Rollux
- Upcoming zkSYS
- Testnets and development networks
- Bridged assets
- Browser wallets
- Full-node wallets
- Exchange deposit formats
- Hardware wallet custody

A modern wallet should answer one core question very well:

> Where is my SYS, what chain is it on, and what can I safely do with it?

## Killer Feature

## "Where Is My SYS?" Dashboard

Create a wallet overview screen that clearly shows:

- SYS balance on Syscoin Native / UTXO
- SYS balance on NEVM address
- SYS balance on Rollux
- zkSYS balance/status, when available
- Testnet balances, when enabled
- Pending bridge transactions
- Recently used deposit / withdrawal addresses
- Chain-specific warnings
- Wrong-address-format warnings
- Spendable vs locked / reserved / collateral funds
- Node-related UTXOs, if applicable

The dashboard should explain balances in plain language.

Example:

> You have 1,000 SYS on Syscoin Native. This is a UTXO balance. It cannot be sent directly to an 0x EVM address unless it is bridged first.

## Design Principles

## 1. Safety First

The wallet must prevent common mistakes:

- Sending UTXO SYS to an EVM-only address
- Sending NEVM SYS to a UTXO-only address
- Confusing exchange deposit formats
- Reusing addresses accidentally
- Spending node-related UTXOs unintentionally
- Bridging to the wrong destination
- Signing transactions without understanding the result

## 2. Human-Readable UX

Avoid exposing raw wallet internals unless the user enters advanced mode.

Good examples:

- "Available to spend"
- "Reserved for node operation"
- "Pending bridge"
- "Watch-only"
- "Hardware wallet required"
- "This transaction needs external signing"

Avoid making the default UI feel like a debug console.

## 3. Advanced Mode For Power Users

Power users should be able to access:

- Coin control
- UTXO labels
- Raw transaction details
- PSBT import/export
- Fee controls
- Watch-only wallets
- Descriptor wallet information
- Wallet rescan tools
- RPC/API diagnostics
- Node status

## 4. Full-Node Friendly

The wallet should support users who want to run and verify their own Syscoin node.

Include:

- Sync status
- Peer count
- Block height
- Chain verification status
- Disk usage
- Pruning status, if supported
- Network status
- RPC health
- Wallet encryption status
- Backup status

## 5. Bridge-Aware By Design

Bridge UX should never feel like a separate, dangerous expert tool.

The wallet should support:

- Bridge intent creation
- zkSYS bridge/proving status integration, when available
- Clear source chain and destination chain
- Before/after balance preview
- Fee preview
- Confirmation checklist
- Pending bridge tracking
- Failed/stuck bridge state explanation
- Warnings for unsupported assets or address types

## 6. Hardware-Wallet First

The wallet should assume serious users may use hardware wallets.

Planned support areas:

- Watch-only hardware wallet accounts
- Receive-address verification
- External signing
- PSBT-style workflows where possible
- Multisig support
- Clear device prompts
- Transaction summary before signing
- Recovery guidance without exposing seed phrases

## 7. Operator Friendly

Sentry Node operators should have a dedicated workflow.

Possible operator dashboard:

- Node status
- Service status
- Wallet status
- Collateral / required UTXO status, if applicable
- Sync status
- Network connectivity
- Port checks
- Version checks
- Upgrade readiness
- Log summary
- Alerts
- Backup status
- Expected vs actual configuration

## Target Users

## User Type 1: Normal SYS Holder

Needs:

- Safe receive/send
- Clear balance view
- Chain explanation
- Backup reminders
- Simple restore
- Basic transaction history
- Exchange deposit guidance

## User Type 2: Advanced UTXO User

Needs:

- Coin control
- UTXO labeling
- Privacy warnings
- Fee control
- Address reuse warnings
- Transaction export
- CSV reporting
- Watch-only support

## User Type 3: Sentry Node Operator

Needs:

- Node health
- Service status
- Wallet readiness
- Collateral awareness
- Upgrade guidance
- Config validation
- Alerts
- Diagnostics

## User Type 4: Developer / Automation User

Needs:

- Local API
- Read-only balance access
- Unsigned transaction creation
- Explicit signing approval
- Webhook / event hooks
- CLI integration
- Mainnet/testnet/regtest support
- zkSYS development and testing support
- Structured JSON output

## User Type 5: Institutional / Treasury User

Needs:

- Hardware wallet flows
- Multisig
- Watch-only
- Transaction review
- Role separation
- Exportable reports
- Audit history
- No hidden signing

## Key Functional Areas

## 1. Wallet Overview

Show:

- Total SYS value
- Native UTXO balance
- NEVM balance
- Rollux balance
- zkSYS status/balance, when available
- Active network: mainnet/testnet/regtest/devnet
- Pending transactions
- Pending bridge operations
- Locked/reserved funds
- Wallet encryption status
- Backup status
- Node sync status

## 2. Send Flow

The send flow should be chain-aware.

Steps:

1. User selects source environment:
   - Native UTXO
   - NEVM
   - Rollux
   - zkSYS, when available

2. User enters recipient.

3. Wallet detects address type.

4. Wallet warns if there is a mismatch.

5. Wallet previews:
   - Amount
   - Fee
   - Source chain
   - Destination chain
   - Spendable balance after send
   - UTXOs selected, in advanced mode

6. Wallet requires final confirmation.

## 3. Receive Flow

Receive flow should make chain selection explicit:

- Receive on Syscoin Native / UTXO
- Receive on NEVM
- Receive on Rollux
- Receive on zkSYS/testnet environments, when supported

For each receive screen:

- Show QR code
- Show address
- Show chain name
- Show warning text
- Show copy button
- Show address label field
- Show hardware-device verification option, where available

Example warning:

> Only send Syscoin Native / UTXO SYS to this address. Do not send NEVM or Rollux assets to this address unless you know the exchange or wallet supports this format.

## 4. Bridge Flow

Bridge flow should include:

- Source chain
- Destination chain
- Network, such as mainnet/testnet/regtest/devnet
- Asset
- Amount
- Estimated fees
- Estimated time
- Destination address
- Risk warning
- Simulation/preview
- Transaction status tracking

Bridge statuses:

- Draft
- Awaiting signing
- Submitted
- Confirming source chain
- Waiting for bridge processing
- Released on destination
- Completed
- Failed
- Needs manual review

## 5. Coin Control

Advanced users need coin control, but it must be understandable.

Features:

- List UTXOs
- Label UTXOs
- Freeze UTXO
- Unfreeze UTXO
- Avoid address reuse
- Privacy score / warning
- Consolidation assistant
- Fee estimation
- Dust detection
- Export UTXO list as CSV/JSON

## 6. Transaction History

Transaction list should include:

- Date/time
- Direction
- Amount
- Fee
- Chain/environment
- Confirmation count
- Label
- Counterparty/address
- Transaction ID
- Bridge reference, if applicable
- Export options

Filters:

- Sent
- Received
- Bridged
- Pending
- Failed
- Native UTXO
- NEVM
- Rollux
- Label
- Address
- Date range

## 7. Wallet Security

Required security features:

- Wallet encryption
- Backup reminder
- Backup verification
- Seed/private key warning
- Hardware wallet support
- Watch-only mode
- Multisig support
- Signing confirmation screen
- Local-only private key handling
- Clear warning when using hot wallet mode

## 8. Node Dashboard

Show:

- Node running: yes/no
- Version
- Network
- Environment: mainnet/testnet/regtest/devnet
- zkSYS-related status, when available
- Block height
- Sync progress
- Peer count
- Mempool status
- Disk usage
- Pruning status
- RPC availability
- Wallet loaded/unloaded
- Last block time
- Warnings

## 9. Sentry Node Dashboard

Potential checks:

- Is Syscoin node synced?
- Is wallet available?
- Are required services running?
- Are required ports reachable?
- Is the node on the expected network?
- Is the version current?
- Are there configuration warnings?
- Are operator-related UTXOs protected from accidental spending?
- Is backup status valid?

## 10. Developer API

Expose a local permissioned API for safe wallet automation.

The API should support:

- Read balances
- List addresses
- Generate receive addresses
- List transactions
- List UTXOs
- Create unsigned transaction
- Import signed transaction
- Broadcast transaction
- Create bridge intent
- Query bridge status
- Query zkSYS status/proving state, when available
- Switch/query configured network environment
- Export reports

Security model:

- Read-only mode by default
- Explicit permission grants
- Signing always requires user confirmation unless explicitly configured
- No seed/private key export through the API
- API bound to localhost by default
- Optional token-based authentication

## Suggested Technical Architecture

## Frontend

Possible options:

- Qt modernization
- Electron
- Tauri
- Native desktop app
- Web UI served locally by the node
- React-based interface

Preferred modern option:

- Tauri or native desktop shell
- React/TypeScript frontend
- Local backend service
- Strong separation between UI and wallet logic

## Backend

Possible backend layers:

- Existing Syscoin Core RPC
- Wallet service layer
- Chain indexer module
- Bridge integration module
- zkSYS integration module
- Network environment module for mainnet/testnet/regtest/devnet
- Hardware wallet module
- Local API module
- Diagnostics module

## Data Model Concepts

Entities:

- Wallet
- Account
- Address
- UTXO
- Transaction
- BridgeOperation
- ZkSysStatus
- NetworkEnvironment
- NodeStatus
- SentryNodeStatus
- HardwareDevice
- Label
- Contact
- Alert
- BackupState
- ChainEnvironment

## Chain And Network Environment Enums

Use clear enums internally.

Chain environments:

```text
SYSCOIN_NATIVE_UTXO
SYSCOIN_NEVM
ROLLUX
ZKSYS
UNKNOWN
```

Network environments:

```text
MAINNET
TESTNET
REGTEST
DEVNET
UNKNOWN
```

The wallet must never mix balances, addresses, bridge operations, or transaction histories between network environments. Mainnet and testnet must be visually distinct throughout the UI.

## Address Type Detection

The wallet should detect and classify addresses:

```text
UTXO_LEGACY
UTXO_SEGWIT
UTXO_TAPROOT_OR_FUTURE
EVM_0X
UNKNOWN
INVALID
```

The wallet should block or strongly warn on unsafe combinations.

## UX Screens

Minimum useful screens:

1. Welcome / Setup
2. Create Wallet
3. Restore Wallet
4. Open Existing Wallet
5. Connect Hardware Wallet
6. Overview
7. Where Is My SYS?
8. Network Selector: Mainnet / Testnet / Regtest / Devnet
9. zkSYS Status
10. Send
11. Receive
12. Bridge
13. Transactions
14. UTXOs / Coin Control
15. Node Status
16. Sentry Node
17. Security & Backup
18. Settings
19. Developer API
20. Diagnostics
21. Help / Learn

## MVP Scope

The first MVP should avoid trying to solve everything at once.

## MVP 1: NexSYS Modern UTXO Wallet Shell

Goals:

- Modern UI
- Connect to local Syscoin Core RPC
- Show UTXO balance
- Show transaction history
- Generate receive address
- Send UTXO transaction
- Basic fee selection
- Wallet encryption status
- Backup status
- Node sync status

## MVP 2: Chain-Aware Safety

Goals:

- Add address type detection
- Add UTXO vs EVM warnings
- Add "Where Is My SYS?" screen
- Add NEVM/Rollux balance read-only view
- Add zkSYS placeholder/readiness status
- Add mainnet/testnet/regtest/devnet environment selector
- Add exchange/deposit guidance text
- Add basic bridge status links or integration placeholders

## MVP 3: Power User Tools

Goals:

- UTXO list
- Coin control
- Labels
- Freeze/unfreeze UTXOs
- CSV export
- Watch-only support
- Better fee control

## MVP 4: Operator Mode

Goals:

- Sentry Node dashboard
- Node service checks
- Version checks
- Config validation
- Operator warnings
- Upgrade readiness

## MVP 5: Hardware Wallet And Multisig

Goals:

- Hardware wallet detection
- Watch-only hardware accounts
- External signing flow
- Multisig wallet support
- PSBT-style import/export if supported

## MVP 6: zkSYS And Testnet Readiness

Goals:

- Add zkSYS as a first-class chain environment placeholder
- Add zkSYS status screen
- Add zkSYS bridge/proving status hooks, when public interfaces are available
- Add testnet support throughout the UI
- Add regtest/devnet support for developers
- Prevent accidental mixing of mainnet and testnet data
- Add visible environment badges to all send/receive/bridge screens

## MVP 7: Developer API

Goals:

- Local read-only API
- Permissioned write API
- Unsigned transaction creation
- Human signing confirmation
- Bridge intent API
- JSON reporting

## Antigravity Agent Instructions

Use this section as direct guidance for an AI coding agent.

## Role

You are helping modernize the Syscoin UTXO wallet into a 2026-ready wallet application.

You should think like:

- A senior wallet architect
- A Bitcoin Core/Syscoin Core integrator
- A zkSYS-aware wallet and bridge UX designer
- A security-focused desktop app developer
- A UX designer for self-custody wallets
- A node-operator tooling engineer

## Primary Objective

Build a modern wallet interface and service layer around Syscoin's existing UTXO wallet functionality while preserving security, correctness, user control, and future compatibility with zkSYS and Syscoin test networks.

## Important Constraints

- Do not weaken wallet security.
- Do not expose private keys or seed material through APIs.
- Do not silently sign or broadcast transactions.
- Do not hide chain differences in unsafe ways.
- Do not allow users to accidentally send UTXO funds to EVM-only or zkSYS-only destinations without a strong warning/block.
- Do not allow mainnet and testnet addresses, balances, or bridge states to be confused.
- Do not remove advanced functionality needed by power users.
- Prefer safe defaults over convenience.
- Keep hot wallet, hardware wallet, and watch-only flows clearly separated.
- Assume users can make chain/address mistakes unless prevented.

## Coding Guidelines

- Prefer clear, readable code over clever abstractions.
- Keep wallet logic separate from UI rendering.
- Keep RPC integration isolated in service modules.
- Keep chain/address validation centralized.
- Add unit tests for address detection and transaction safety checks.
- Add integration tests for RPC calls where possible.
- Use explicit error handling.
- Use structured logging.
- Never log private keys, seed phrases, wallet passphrases, or full sensitive payloads.
- Make dangerous actions require explicit confirmation.

## Suggested Module Structure

```text
/src
  /app
    App.tsx
    routes.tsx
  /components
    BalanceCard.tsx
    ChainBadge.tsx
    WarningBox.tsx
    TransactionTable.tsx
    UtxoTable.tsx
    ConfirmDialog.tsx
  /features
    /overview
    /send
    /receive
    /bridge
    /zksys
    /network
    /transactions
    /utxos
    /node
    /sentry
    /security
    /settings
    /developer-api
  /services
    syscoinRpcClient.ts
    walletService.ts
    addressClassifier.ts
    transactionService.ts
    bridgeService.ts
    zksysService.ts
    networkEnvironmentService.ts
    nodeService.ts
    sentryService.ts
    hardwareWalletService.ts
    apiPermissionService.ts
  /types
    wallet.ts
    chain.ts
    transaction.ts
    bridge.ts
    zksys.ts
    network.ts
    node.ts
    sentry.ts
  /utils
    formatting.ts
    validation.ts
    logging.ts
  /tests
```

## Required Types

Create clear types similar to:

```typescript
export type ChainEnvironment =
  | "SYSCOIN_NATIVE_UTXO"
  | "SYSCOIN_NEVM"
  | "ROLLUX"
  | "ZKSYS"
  | "UNKNOWN";

export type NetworkEnvironment =
  | "MAINNET"
  | "TESTNET"
  | "REGTEST"
  | "DEVNET"
  | "UNKNOWN";

export type AddressType =
  | "UTXO_LEGACY"
  | "UTXO_SEGWIT"
  | "UTXO_TAPROOT_OR_FUTURE"
  | "EVM_0X"
  | "UNKNOWN"
  | "INVALID";

export interface WalletBalance {
  chain: ChainEnvironment;
  network: NetworkEnvironment;
  confirmed: string;
  unconfirmed: string;
  locked?: string;
  spendable?: string;
}

export interface UtxoEntry {
  txid: string;
  vout: number;
  amount: string;
  confirmations: number;
  address?: string;
  label?: string;
  frozen?: boolean;
  reservedForNode?: boolean;
}

export interface BridgeOperation {
  id: string;
  network: NetworkEnvironment;
  sourceChain: ChainEnvironment;
  destinationChain: ChainEnvironment;
  asset: string;
  amount: string;
  sourceTxid?: string;
  destinationTxid?: string;
  status:
    | "DRAFT"
    | "AWAITING_SIGNING"
    | "SUBMITTED"
    | "CONFIRMING_SOURCE"
    | "PROCESSING"
    | "RELEASED"
    | "COMPLETED"
    | "FAILED"
    | "NEEDS_REVIEW";
} 

export interface ZkSysStatus {
  network: NetworkEnvironment;
  available: boolean;
  status: "NOT_CONFIGURED" | "AVAILABLE" | "SYNCING" | "PROVING" | "DEGRADED" | "UNKNOWN";
  lastUpdated?: string;
  notes?: string[];
}
```

## Required Safety Logic

Implement centralized checks:

```text
validateSendIntent(sourceChain, network, destinationAddress, asset, amount)
classifyAddress(address, network)
detectUnsafeChainMismatch(sourceChain, addressType)
detectUnsafeNetworkMismatch(sourceNetwork, destinationNetwork)
requireConfirmationForHighRiskAction(action)
```

Examples:

- Source chain `SYSCOIN_NATIVE_UTXO` and destination address type `EVM_0X` should trigger bridge guidance or block normal send.
- Source chain `SYSCOIN_NEVM` and destination address type `UTXO_LEGACY` should trigger bridge guidance or block normal send.
- Source chain `ZKSYS` should use zkSYS-specific bridge/send rules once available and must not silently fall back to another environment.
- Mainnet funds must never be sent using testnet/regtest/devnet configuration.
- Unknown address type should require explicit warning and should not pass silently.
- Spending frozen or node-reserved UTXOs should be blocked unless advanced override is explicitly enabled.

## UX Copy Examples

Use plain language.

### UTXO Receive Warning

> This is a Syscoin Native / UTXO address. Only send native SYS to this address. Do not send NEVM or Rollux assets here unless the sending wallet or exchange explicitly supports this address type.

### EVM Receive Warning

> This is an EVM-style 0x address. Only send assets from Syscoin NEVM, Rollux, or compatible EVM environments. Native UTXO SYS must be bridged before it can arrive here.

### Bridge Warning

> Bridging moves assets between different Syscoin environments. Check the source chain, destination chain, address, amount, and fees before signing.

### zkSYS Warning

> zkSYS support may involve different transaction, bridge, or proving states. Always verify the active network and destination before signing.

### Testnet Warning

> This wallet is currently using a test or development network. Testnet funds have no mainnet value and must not be mixed with mainnet addresses or workflows.

### Hardware Wallet Prompt

> Review the transaction on your hardware wallet before signing. The address, amount, and fee shown on the device must match this screen.

## First Tasks For Antigravity

Start with the following implementation tasks.

## Task 1: Create Project Skeleton

Create the base application structure with:

- Frontend shell
- Routing
- Layout
- Mock wallet data
- Type definitions
- Service placeholders
- Test setup

## Task 2: Build Overview Screen

Create an overview screen with:

- Native UTXO balance card
- NEVM balance card
- Rollux balance card
- Node status card
- Backup/security status card
- Pending bridge card
- zkSYS readiness/status card
- Active network badge

Use mocked data first.

## Task 3: Build Address Classifier

Implement an address classification module.

Inputs:

- Address string

Outputs:

- AddressType
- Confidence
- Error/warning messages

Include tests.

## Task 4: Build Send Intent Validator

Implement send safety validation.

Inputs:

- Source chain
- Destination address
- Asset
- Amount

Outputs:

- Allow / warn / block
- Reason
- Suggested action

Include tests for unsafe UTXO-to-EVM and EVM-to-UTXO sends.

## Task 5: Build "Where Is My SYS?" Screen

Create a screen that shows SYS balances across environments using mock data.

Include explanations for:

- UTXO SYS
- NEVM SYS
- Rollux SYS
- zkSYS SYS/status, when available
- Testnet balances, when enabled
- Pending bridge
- Wrong-chain risks

## Task 6: Add Network Environment Support

Create a network environment service.

Requirements:

- Support MAINNET, TESTNET, REGTEST, and DEVNET as explicit modes.
- Show visible environment badges in the UI.
- Store network-specific settings separately.
- Prevent mixing transaction history, balances, and bridge state across networks.
- Make testnet/regtest/devnet visually obvious.
- Include tests for environment mismatch handling.

## Task 7: Add Syscoin RPC Client Stub

Create a service abstraction for Syscoin Core RPC.

Methods:

```typescript
getBlockchainInfo()
getWalletInfo()
getBalances()
listTransactions()
listUnspent()
getNewAddress(label?: string)
createRawTransaction()
fundRawTransaction()
signRawTransactionWithWallet()
sendRawTransaction()
```

Do not hard-code credentials.

Use configuration.

## Task 8: Add Node Status Screen

Show:

- Version
- Chain
- Blocks
- Headers
- Sync percentage
- Peer count
- Last block time
- Warnings

Start with mocked data, then connect to RPC later.

## Task 9: Add UTXO Table

Show:

- Amount
- Address
- Confirmations
- Label
- Frozen status
- Reserved status
- Transaction ID
- vout

Add placeholder actions:

- Label
- Freeze
- Unfreeze
- Copy txid
- View details

## Task 10: Add Security & Backup Screen

Show:

- Wallet encrypted yes/no
- Backup status
- Last backup date
- Hardware wallet status
- Watch-only status
- API permissions
- Warnings

## Task 11: Add zkSYS Readiness Layer

Create a zkSYS service placeholder and UI screen.

Requirements:

- Treat zkSYS as a first-class future chain environment.
- Add a zkSYS status card.
- Add placeholders for zkSYS bridge/proving status.
- Keep all interfaces behind a service abstraction so real endpoints can be connected later.
- Add warnings that behavior may differ from UTXO, NEVM, and Rollux.
- Include testnet/devnet support in the zkSYS abstraction.

## Task 12: Add Local Developer API Design

Create an initial OpenAPI-style or markdown API design for:

- Read balances
- List transactions
- Generate address
- Create unsigned transaction
- Import signed transaction
- Broadcast transaction

Do not implement signing automation without explicit user approval.

## Non-Goals For First MVP

Do not start with:

- Full bridge implementation
- Full zkSYS production implementation before public interfaces are stable
- Full hardware wallet implementation
- Multisig implementation
- Production signing flows
- Real funds testing
- Exchange integrations
- Mobile wallet
- Browser extension
- Cloud custody
- Seed phrase cloud backup

## Acceptance Criteria For MVP 1

MVP 1 is acceptable when:

- The app opens reliably.
- User can see a modern wallet overview using mocked or RPC-backed data.
- User can view UTXO balance.
- User can view recent transactions.
- User can generate a receive address through RPC.
- User can classify an address.
- Unsafe address/chain combinations are detected.
- Node sync status is visible.
- Mainnet/testnet/regtest/devnet environment is explicit.
- zkSYS is represented as a future-ready environment without unsafe assumptions.
- No private keys or wallet passphrases are exposed.
- Dangerous actions are clearly marked.
- The codebase has initial tests for address classification and send validation.

## Important Future Ideas

## 1. AI Wallet Assistant

A local assistant could explain:

- Why a transaction is pending
- What a bridge operation is doing
- Whether the node is synced
- Why funds are not visible
- Whether a send action is risky

The assistant must not be able to sign or broadcast transactions without explicit user approval.

## 2. Operator Diagnostics Bundle

Generate a support bundle:

- Node version
- Sync status
- Peer count
- Config summary
- Recent warnings
- Service status
- Wallet status

The bundle must exclude secrets.

## 3. Treasury Mode

Features:

- Watch-only dashboards
- Multisig transaction review
- CSV/PDF reports
- Role-separated transaction preparation and signing
- Policy checks

## 4. Exchange Deposit Helper

Help users identify the correct deposit network/address format for exchanges.

The wallet should not guess blindly. It should warn users to verify the exchange-selected network.

## 5. Guided Migration

Help users migrate from old wallet.dat workflows to modern descriptor/watch-only/hardware-wallet workflows where applicable.

## Project Tone

This project should feel:

- Serious
- Safe
- Modern
- Trustworthy
- Clear
- Operator-friendly
- Technical when needed
- Simple by default
- Powerful in advanced mode

## One-Sentence Summary

Build NexSYS: a modern Syscoin full-node wallet that makes UTXO custody, NEVM, Rollux, zkSYS readiness, testnet workflows, bridge safety, and node operation understandable and safe for 2026 users.
