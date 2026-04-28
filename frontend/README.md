# SplitPay Frontend

React-based web interface for SplitPay - a Stellar Soroban dApp for splitting bills.

## Features

- 🏠 **Landing Page** - Beautiful marketing site with product info
- 🔐 **Freighter Wallet Integration** - Connect your Stellar wallet
- 💸 **Create Splits** - Set total amount and add participants
- 👥 **View Splits** - Check payment status and pay your share
- ⚡ **Real-time Updates** - See who paid instantly

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:3000

## Routes

- `/` - Landing page (marketing site)
- `/app` - App dashboard (redirects to `/app/create`)
- `/app/create` - Create new split
- `/app/view` - View and pay splits

## Build

```bash
npm run build
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── WalletConnect.jsx    # Freighter wallet integration
│   │   ├── CreateSplit.jsx      # Create new bill splits
│   │   └── ViewSplit.jsx        # View and pay splits
│   ├── pages/
│   │   └── Landing.jsx          # Marketing landing page
│   ├── App.jsx                  # Main app component with routing
│   ├── main.jsx                 # Entry point
│   └── *.css                    # Styles
├── index.html
├── package.json
└── vite.config.js
```

## TODO

- [ ] Integrate Soroban contract calls
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add success/error notifications
