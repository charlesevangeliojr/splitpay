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
| 3 | React Native mobile UI: create split + view status + wallet connect |
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

# Compile to WASM
soroban contract build
# Output: target/wasm32v1-none/release/splitpay.wasm
```

---

## Test

```bash
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

# 2. Deploy the contract
soroban contract deploy \
  --wasm target/wasm32v1-none/release/splitpay.wasm \
  --source alice \
  --network testnet
# Output: CONTRACT_ID (save this)
```

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

## Optional Enhancement: AI Smart Splitting

Integrate a lightweight AI model that:
- Analyzes historical spending patterns from on-chain data
- Suggests optimal split ratios for uneven expenses (e.g., some ordered drinks, others didn't)
- Predicts likely settlement time based on participant payment history
- Shows "trusted payer" scores to reduce friction in new groups

This turns SplitPay from a simple calculator into an intelligent expense advisor.

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

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
