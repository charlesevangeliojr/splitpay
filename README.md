# SplitPay 💸

> Split bills instantly with friends using Stellar Soroban — no more "bayaran mo later"

# Links

🔗 https://stellar.expert/explorer/testnet/tx/ba5664b0c4cf560770b19a2dc2126d10f648068e537683538a9d0a35d71c7c4d  
🔗 https://lab.stellar.org/r/testnet/contract/CC2F6Y6QJ4FHB5QXZDJ4YEA7F3MU2CHZB7YOMSX6B646Q4SQOCTRSSDO

---

## Problem

You and 3 friends eat out. Total bill: ₱400. You paid everything.

**Normally:**
- You wait for them to send money
- Some forget to pay back 😅
- You have to awkwardly remind them
- Manual tracking who paid what
- Arguments about exact amounts

Splitting bills with friends is awkward and unreliable. Chasing friends for payments is uncomfortable, people forget to pay back, manual calculations lead to disputes, and delayed settlements create friction in relationships.

## Solution

SplitPay automates group payments using Soroban smart contracts on Stellar:

1. **You create a split** — Input total amount and friends
2. **System calculates** — Equal share for everyone automatically
3. **Friends get notified** — "You owe ₱100"
4. **They click PAY** — Money sent instantly via XLM
5. **System updates** — Paid ✅ or Unpaid ❌ tracked on-chain

**What makes it special:**
- ⚡ Instant payments (seconds)
- 💸 Very low fees (perfect for small amounts)
- 🔒 No cheating — tracked transparently on-chain
- 📱 Works like GCash but automated
- 🤝 No intermediaries — smart contract handles everything

---

## Suggested MVP Timeline

| Week | Milestone |
|------|-----------|
| 1 | Smart contract: `create_split`, `pay_share`, `get_split`, `is_settled` |
| 2 | Contract testing and deployment to testnet |
| 3 | React web UI: create split + view status + wallet connect |
| 4 | Testnet demo: live payment flow, demo video, hackathon submission |

---

## Stellar Features Used

| Feature | Purpose |
|---------|---------|
| **Soroban smart contracts** | Split creation, payment tracking, automatic settlement |
| **XLM transfers** | Native token for direct peer-to-peer payments (participant → payer) |
| **On-chain events** | `split_created`, `share_paid`, `split_settled` for off-chain indexing |
| **Persistent storage** | Store split details and payment status permanently |
| **Address authentication** | Verify participants before allowing payments |
| **Token interface** | Support any Stellar-compatible token for payments |

---

## Vision & Purpose

SplitPay turns every group expense into a transparent, verifiable on-chain event. For students, friend groups, and anyone splitting bills, it provides:

- **Instant settlement** — No waiting, no chasing, no awkwardness
- **Financial transparency** — Everyone sees who paid what
- **Trustless execution** — Smart contract enforces fair splits automatically
- **Perfect for unbanked users** — Just need a Stellar wallet, no bank required

**Target Users:**
- Students splitting meal costs
- Friends sharing ride fares  
- Groups organizing events and trips
- Roommates splitting utility bills

Long term, SplitPay can integrate with local anchors so users can cash in/out with fiat, making it accessible to everyone regardless of banking access.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Smart Contract** | Rust + Soroban SDK | On-chain split logic, payment tracking, XLM transfers |
| **Backend API** | Rust + Axum + Tokio | REST API, Soroban CLI bridge, session management |
| **Frontend** | React 18 + Vite | User interface, wallet connection, split management |
| **Wallet** | Freighter API | Stellar wallet integration for signing transactions |
| **Blockchain** | Stellar Testnet | Low-cost, fast finality, native XLM support |
| **Storage** | In-memory (backend) + Persistent (contract) | Session cache, activity log, on-chain state |

### Dependencies

**Contract:**
- `soroban-sdk = "22.0.0"`

**Backend:**
- `axum` — Web framework
- `tokio` — Async runtime
- `serde` — Serialization
- `chrono` — Date/time handling
- `uuid` — Unique identifiers
- `tower-http` — CORS middleware

**Frontend:**
- `react ^18.2.0` — UI framework
- `react-router-dom ^6.21.0` — Routing
- `@stellar/freighter-api ^2.0.0` — Wallet connection
- `@stellar/stellar-sdk ^12.0.0` — Stellar utilities
- `lucide-react ^1.11.0` — Icons

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Landing    │  │  Dashboard   │  │   Wallet     │       │
│  │    Page      │  │              │  │ Connect Page │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                    │             │
│         └─────────────────┴────────────────────┘             │
│                           │                                 │
│                    ┌──────┴──────┐                         │
│                    │  Freighter  │  Wallet Signing          │
│                    │   Wallet    │                         │
│                    └─────────────┘                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / CORS
┌───────────────────────────┼─────────────────────────────────┐
│                      Backend (Axum)        │                │
│  ┌──────────────┐  ┌──────┴──────┐  ┌──────────────┐       │
│  │   Session    │  │   Split     │  │   Activity   │       │
│  │     API      │  │    API      │  │     API      │       │
│  │  /api/session│  │  /api/splits│  │ /api/activity│       │
│  └──────────────┘  └──────┬──────┘  └──────────────┘       │
│                           │                                 │
│              ┌────────────┴────────────┐                 │
│              │   Contract CLI Bridge       │                 │
│              │  (soroban CLI invocation)   │                 │
│              └────────────┬────────────────┘                 │
└───────────────────────────┼───────────────────────────────────┘
                            │ RPC
┌───────────────────────────┼───────────────────────────────────┐
│              Stellar Testnet / Futurenet                        │
│  ┌────────────────────────┴────────────────────────┐         │
│  │           Soroban Smart Contract                 │         │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐  │         │
│  │  │create_split│ │ pay_share  │ │ get_split  │  │         │
│  │  └────────────┘ └────────────┘ └────────────┘  │         │
│  │  ┌────────────┐ ┌────────────┐                │         │
│  │  │is_settled  │ │get_payment │                │         │
│  │  │            │ │   _status  │                │         │
│  │  └────────────┘ └────────────┘                │         │
│  └─────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User connects Freighter wallet → Frontend requests session from Backend
2. User creates split → Frontend POSTs to Backend → Backend invokes Soroban CLI → Contract stores on-chain
3. User pays share → Frontend POSTs payment → Backend invokes contract → XLM transfers on-chain
4. Backend syncs contract state for every read operation to ensure consistency

---

## Prerequisites

```bash
# Rust toolchain (stable + wasm32 target)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none

# Soroban CLI (v22 or later)
cargo install --locked soroban-cli --version 22.0.0

# Verify
soroban --version   # soroban 22.x.x
cargo --version     # cargo 1.7x+
```

---

## Build

```bash
git clone https://github.com/charlesevangeliojr/splitpay.git
cd splitpay

# Build smart contract
cd contract
soroban contract build
# Output: target/wasm32v1-none/release/splitpay.wasm
```

---

## Test

```bash
cd contract
cargo test
# Runs unit tests for contract functions
# Expected output: test result: ok. X passed; 0 failed
```

---

## Deploy to Testnet

```bash
# 1. Configure testnet identity (one-time)
soroban keys generate --global alice --network testnet
soroban keys fund alice --network testnet

# 2. Deploy the contract (from contract/ directory)
soroban contract deploy \
  --wasm target/wasm32v1-none/release/splitpay.wasm \
  --source alice \
  --network testnet
# Output: CONTRACT_ID (save this)
```

---

## Frontend

A React web interface is available in the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

Features:
- 🔐 Freighter wallet connection
- 💸 Create splits with participants
- 👥 View split status and pay shares
- ⚡ Real-time payment tracking

Open http://localhost:3000

---

## Full-Stack Run (Frontend + Backend + Contract)

Use this when you want UI actions to hit the Rust backend and Soroban contract.

### 1) Start backend with contract config

PowerShell (Windows):

```powershell
cd backend

$env:SPLITPAY_CONTRACT_ID="<YOUR_DEPLOYED_CONTRACT_ID>"
$env:SPLITPAY_RPC_URL="https://soroban-testnet.stellar.org"
$env:SPLITPAY_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
$env:SPLITPAY_BACKEND_PORT="8080"

cargo run
```

### Alternatively: Use .env file
For a more permanent configuration, create a file named `.env` in the `backend/` directory:

```env
SPLITPAY_CONTRACT_ID="<YOUR_DEPLOYED_CONTRACT_ID>"
SPLITPAY_RPC_URL="https://soroban-testnet.stellar.org"
SPLITPAY_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SPLITPAY_BACKEND_PORT="8080"
```

The backend will automatically load these variables on startup.

Expected startup log:

```text
SplitPay backend running at http://127.0.0.1:8080
```

### 2) Start frontend and point it to backend

PowerShell (new terminal):

```powershell
cd frontend

$env:VITE_API_URL="http://127.0.0.1:8080"
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

### 3) Quick health check

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

Expected response:

```json
{ "ok": true }
```

### Notes

- `SPLITPAY_CONTRACT_ID` is required for contract-backed split create/pay/read flows.
- If port `8080` is already in use, set another backend port (for example `8081`) and match `VITE_API_URL` accordingly.
- Keep backend terminal running while testing frontend actions.

---

## Project Structure

```
splitpay/
├── contract/                     # Soroban smart contract (Rust)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs               # Smart contract logic (create_split, pay_share, get_split, etc.)
├── backend/                     # Axum REST API server (Rust)
│   └── src/
│       └── main.rs              # API server & Soroban contract bridge
├── frontend/                    # React web application (Vite)
│   ├── public/                  # Static public assets
│   ├── package.json
│   └── src/
│       ├── assets/              # Processed images (Logo, Hero, etc.)
│       ├── components/          # Reusable UI modules
│       │   ├── CreateSplit.css
│       │   ├── CreateSplit.jsx       # Split creation form
│       │   ├── ViewSplit.css
│       │   ├── ViewSplit.jsx         # Split status & payment view
│       │   ├── WalletConnect.css
│       │   └── WalletConnect.jsx     # Freighter wallet connector
│       ├── lib/
│       │   └── api.js           # Backend API client
│       ├── pages/               # Main application views
│       │   ├── Dashboard.css
│       │   ├── Dashboard.jsx          # Main split management dashboard
│       │   ├── Landing.css
│       │   ├── Landing.jsx            # Marketing landing page
│       │   ├── WalletConnectionPage.css
│       │   └── WalletConnectionPage.jsx
│       ├── App.css
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
├── target/                      # Rust build artifacts (WASM output)
├── .gitignore
└── README.md                    # System documentation
```

---

## API Reference

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status check |

**Response:**
```json
{ "ok": true }
```

### Session Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/session/connect` | Connect wallet and create session |
| `GET` | `/api/session/{wallet}` | Get session by wallet address |
| `POST` | `/api/session/{wallet}/disconnect` | Disconnect wallet |

**Connect Request:**
```json
{ "wallet_address": "G..." }
```

### Splits
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/splits` | List all splits with synced on-chain status |
| `POST` | `/api/splits` | Create new split |
| `GET` | `/api/splits/{id}` | Get split details (syncs from chain) |
| `POST` | `/api/splits/{id}/pay` | Pay share for a split |

**Create Split Request:**
```json
{
  "label": "Dinner at Jollibee",
  "creator": "G...",
  "total_xlm": 100.0,
  "participants": ["G...", "G...", "G..."]
}
```

**Pay Share Request:**
```json
{ "payer": "G..." }
```

**Split Response:**
```json
{
  "id": "#1",
  "label": "Dinner at Jollibee",
  "creator": "G...",
  "total_xlm": 100.0,
  "per_person_xlm": 33.33,
  "status": "UNPAID",
  "participants": [
    {
      "address": "G...",
      "amount_owed_xlm": 33.33,
      "paid": false,
      "paid_at": null
    }
  ],
  "created_at": "2026-04-29T00:00:00Z"
}
```

### Activity
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/activity` | List activity feed |
| `GET` | `/api/activity?filter=created` | Filter by type (created/paid/settled/received) |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings/{wallet}` | Get user settings |
| `PATCH` | `/api/settings/{wallet}` | Update settings |

**Settings Response:**
```json
{
  "active_network": "Testnet",
  "currency": "XLM",
  "date_format": "MM/DD/YYYY",
  "notify_payment_received": true,
  "notify_split_settled": true,
  "notify_payment_reminder": false
}
```

---

## Environment Variables

### Backend (`backend/.env` or env vars)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPLITPAY_CONTRACT_ID` | Yes* | — | Deployed contract ID (required for contract ops) |
| `SPLITPAY_RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `SPLITPAY_NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Network passphrase |
| `SPLITPAY_BACKEND_PORT` | No | `8080` | Backend server port |

*Backend starts without contract ID but contract-backed endpoints will fail.

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://127.0.0.1:8080` | Backend API base URL |

---

## Sample CLI Invocations

### Create a split
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- \
  create_split \
  --creator <CREATOR_ADDRESS> \
  --total_amount 4000000000 \
  --participants '["<ADDR1>", "<ADDR2>", "<ADDR3>"]'' \
  --token <TOKEN_CONTRACT_ID>
# Returns: split_id (e.g., 1)
```

### Pay share as participant
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source bob \
  --network testnet \
  -- \
  pay_share \
  --split_id 1 \
  --participant <BOB_ADDRESS>
# Transfers: participant → creator (100 XLM)
# Emits: share_paid event
```

### View split details
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_split \
  --split_id 1
# Returns: { split_id, creator, total_amount, amount_per_person, participants, token, status }
```

### Check payment status
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_payment_status \
  --split_id 1 \
  --participant <PARTICIPANT_ADDRESS>
# Returns: true (paid) or false (unpaid)
```

### Check if settled
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  is_settled \
  --split_id 1
# Returns: true (all paid) or false (pending payments)
```

---

## Smart Contract Reference

### Contract Structure

**Split Struct:**
```rust
pub struct Split {
    pub split_id: u64,
    pub creator: Address,
    pub total_amount: i128,        // In stroops (1 XLM = 10^7 stroops)
    pub amount_per_person: i128,   // In stroops
    pub participants: Vec<Address>,
    pub token: Address,            // Token contract (native XLM)
    pub status: SplitStatus,       // Active | Settled
}
```

### Contract Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create_split` | `creator`, `total_amount`, `participants[]`, `token` | `u64` (split_id) | Create new bill split |
| `pay_share` | `split_id`, `participant` | — | Pay participant's share |
| `get_split` | `split_id` | `Split` | Get split details |
| `get_payment_status` | `split_id`, `participant` | `bool` | Check if participant paid |
| `is_settled` | `split_id` | `bool` | Check if all participants paid |

### Events Emitted

| Event | Data | Trigger |
|-------|------|---------|
| `split_created` | `(creator, total_amount, participants)` | New split created |
| `share_paid` | `(participant, amount)` | Participant pays |
| `split_settled` | `()` | All participants paid |

### Data Keys

```rust
pub enum DataKey {
    Split(u64),              // Split details by ID
    Payment(u64, Address),   // Payment status per participant
    SplitCount,              // Auto-incrementing ID counter
}
```

---

## Troubleshooting

### Backend won't start: "Failed to bind 127.0.0.1:8080"
**Cause:** Port already in use.  
**Fix:** Set different port: `$env:SPLITPAY_BACKEND_PORT="8081"`

### "SPLITPAY_CONTRACT_ID is not configured" warning
**Cause:** Contract ID environment variable not set.  
**Fix:** Deploy contract and set `SPLITPAY_CONTRACT_ID` before starting backend.

### Contract invocation fails with "error: soroban not found"
**Cause:** Soroban CLI not installed or not in PATH.  
**Fix:** Install Soroban CLI: `cargo install --locked soroban-cli --version 22.0.0`

### Frontend shows CORS errors
**Cause:** Backend CORS not allowing frontend origin.  
**Fix:** Ensure backend allows `http://localhost:3000` (configured by default).

### Wallet connection fails
**Cause:** Freighter wallet not installed or not configured for Testnet.  
**Fix:** Install [Freighter extension](https://www.freighter.app/) and switch to Testnet in settings.

### "Split not found" errors
**Cause:** Backend cache out of sync with contract state.  
**Fix:** Backend auto-syncs on every read; verify `SPLITPAY_CONTRACT_ID` matches deployed contract.

### Payment transaction fails
**Cause:** Insufficient XLM balance or wrong network.  
**Fix:** Fund wallet with Testnet XLM from [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=testnet).

---

## Optional Enhancement: AI Smart Splitting

Integrate a lightweight AI model that:
- Analyzes historical spending patterns from on-chain data
- Suggests optimal split ratios for uneven expenses (e.g., some ordered drinks, others didn't)
- Predicts likely settlement time based on participant payment history
- Shows "trusted payer" scores to reduce friction in new groups

This turns SplitPay from a simple calculator into an intelligent expense advisor.

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork the repository** and create your branch: `git checkout -b feature/my-feature`
2. **Set up the development environment** following the Prerequisites section
3. **Make your changes** with clear, focused commits
4. **Test thoroughly:**
   - Contract: `cd contract && cargo test`
   - Backend: Ensure full-stack run works end-to-end
   - Frontend: Verify UI flows with wallet connected
5. **Submit a pull request** with a clear description of changes

### Development Guidelines

- **Smart Contract:** Follow Rust best practices, use `soroban-sdk` patterns
- **Backend:** Keep endpoints RESTful, validate inputs, handle errors gracefully
- **Frontend:** Maintain component structure, use existing CSS patterns
- **General:** Add comments for complex logic, update README for new features

### Testing Checklist

- [ ] Contract builds without warnings: `soroban contract build`
- [ ] Contract tests pass: `cargo test`
- [ ] Backend starts and health check returns `ok`
- [ ] Frontend connects to wallet
- [ ] Create split flow works end-to-end
- [ ] Payment flow works end-to-end

---

## Reference Repositories

- Bootcamp deployment guide: https://github.com/armlynobinguar/Stellar-Bootcamp-2026
- Full-stack example (community treasury): https://github.com/armlynobinguar/community-treasury
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Soroban Documentation](https://soroban.stellar.org/docs)

---

## License

MIT License — Copyright (c) 2026 SplitPay Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
llowing conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
