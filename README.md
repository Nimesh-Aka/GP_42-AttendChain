# AttendChain — Blockchain-Based Anti-Proxy Attendance System

**Group:** GP_42 &nbsp;•&nbsp; **Platform:** Ethereum (Solidity) + Hardhat + Web UI (ethers.js)

## The problem
"Proxy attendance" — a student marking *present* for an absent friend — and after-the-fact
editing of attendance registers are everywhere. Central databases can be silently changed by
whoever controls them, so nobody can fully trust the record.

## The blockchain solution
AttendChain records attendance on an Ethereum smart contract:

| Threat | How AttendChain stops it |
|---|---|
| **Proxy attendance** | You mark from *your own* wallet. A transaction must be signed by the sender's private key, so you can't mark "as" someone else. `markAttendance` only ever credits `msg.sender`. |
| **Double marking** | One mark per student per session, enforced on-chain. |
| **Back-dating** | Marking only works while the teacher has the session **open**. |
| **Tampering / deletion** | Records are immutable — not even the admin or teacher can edit or delete them. |
| **Trust** | Anyone can independently verify who attended each session. |

## Project structure
```
contracts/AttendChain.sol      the smart contract
test/AttendChain.test.js       full test suite (roles, proxy, double-mark, back-dating)
scripts/deploy.js              deploys + writes frontend/deployment.json
frontend/                      web UI (index.html, app.js, styles.css)
hardhat.config.js              Hardhat + network config (chainId 31337)
```

## Prerequisites
- **Node.js** (installed) and **npm**
- **MetaMask** browser extension (for the web UI)

## 1) Install
```bash
npm install
```

## 2) Compile & test
```bash
npm run compile
npm test
```
You should see all tests pass, including *PREVENTS PROXY* and *PREVENTS DOUBLE MARKING*.

## 3) Run a local blockchain (keep this terminal open)
```bash
npm run node
```
This starts a local chain at `http://127.0.0.1:8545` (chainId **31337**) and prints 20 test
accounts with their private keys.

## 4) Deploy the contract (new terminal)
```bash
npm run deploy
```
It prints the **contract address** and writes `frontend/deployment.json`.

## 5) Launch the web UI (new terminal)
```bash
npm run ui
```
Open **http://localhost:5500**.

### Using the app
The app **auto-connects to the blockchain on load** — no wallet setup needed. Wallets are
**assigned automatically** to each student, so you never type an address.

- **Admin** adds a student with just a **name + roll no** (a wallet is auto-assigned).
- **Teacher** opens/closes sessions.
- **Student** marks attendance by picking their **name** in the "I am" box.
- The **"Security check"** button proves the anti-proxy block (an unenrolled wallet is rejected).

**Connect Wallet** (top-right) is optional — it switches to the visitor's own MetaMask, for a
real multi-device deployment.

### Reset to a clean state
```bash
npm run seed
```
Deploys a fresh contract and enrolls Alice, Bob, Charlie with one open session (nobody
marked yet). Refresh the browser — it auto-connects and is ready.

### Connect MetaMask to the local chain
1. In MetaMask, add a network: RPC `http://127.0.0.1:8545`, Chain ID `31337`, currency `ETH`.
2. Import a couple of the private keys printed by `npm run node` (Account #0 = admin/teacher,
   others = students).
3. In the UI, click **Connect Wallet**, paste the contract address (auto-filled if served),
   and click **Load**.

## Security assessment (the cybersecurity part)
Run a suite of **real attacker transactions** against the contract and watch each one get
rejected on-chain, with the actual revert reason:
```bash
npm run attack
```
It runs 7 attacks from a real (unenrolled) attacker wallet and prints a report:

| # | Attack | Rejected by |
|---|--------|-------------|
| 1 | Outsider marks attendance | `require(registered)` → *Not a registered student* |
| 2 | Proxy — mark an absent friend | `markAttendance` only credits `msg.sender` (no proxy possible) |
| 3 | Self-enroll (privilege escalation) | `onlyAdmin` → *Only admin* |
| 3b | Open a session as attacker | `onlyTeacher` → *Only a teacher* |
| 4 | Double-marking / replay | `require(!marked[...])` → *Already marked* |
| 5 | Back-dating after class closes | `require(session.open)` → *Session is closed* |
| 6 | Tamper / delete a record | no edit/delete function exists — immutable |

Each attack is a genuinely signed transaction; the identity is the transaction's signer
(`msg.sender`), so impersonation would require the victim's private key.

## Demo script (matches the presentation)
Start with `npm run seed` (Alice, Bob, Charlie enrolled; session #0 open), then refresh the UI:
1. **Student → "I am" Alice**, session `0` → **Mark present** ✅
2. Mark Alice again → rejected: *Already marked*.
3. **"Security check — attempt entry from an unenrolled wallet"** → rejected: *Not a registered
   student* (the anti-proxy guarantee — you can't mark as anyone whose wallet you don't control).
4. **Teacher → Close session** `0` → students can no longer mark (no back-dating).
5. **Live verification:** load session `0` to see the tamper-proof attendee list.
6. (Optional) **Admin → Add student** by name to show enrollment live.

## License
MIT
