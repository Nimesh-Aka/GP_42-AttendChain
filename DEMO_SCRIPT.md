# AttendChain — Complete Demo & Presenting Script

**Group:** GP_42 · **Project:** AttendChain — Blockchain-Based Anti-Proxy Attendance System
**Stack:** Ethereum · Solidity · Hardhat · ethers.js web UI · Runtime ~3–4 min

---

## ⚙️ STEP 0 — Setup before you present (do once, off-screen)
Open **3 terminals** in the project folder:

**Terminal 1 — start the blockchain (leave running):**
```bash
npm run node
```
**Terminal 2 — load a clean state (Alice, Bob, Charlie enrolled + open session):**
```bash
npm run seed
```
**Terminal 3 — start the web app:**
```bash
npm run ui
```
Open **http://localhost:5500** and confirm the top says **"Connected to the network."**
Keep **Terminal 2 free** — you'll run the attack there in Part B.

✅ You should see: **3 students, 1 session, 0 attendance marks.**

---

## 🎤 STEP 1 — Opening (20 sec)
> "Attendance today is easy to cheat — a student can mark 'present' for an absent friend, and
> records can be edited later. **AttendChain** solves this with blockchain: the rules live in a
> **smart contract**, so attendance can't be faked, edited, or deleted. Let me show it working,
> then attack it."

*Point to the top bar:* "It's connected to an Ethereum network — this is our deployed smart contract."

---

## 🟢 PART A — The product works (≈1 min)

**1. Show the class is set up** — *scroll to the Class roster.*
> "Three students are enrolled — Alice, Bob, Charlie — each with their own blockchain wallet.
> One class session, 'Blockchain 101', is open."

**2. A student marks attendance** — *Student box → "I am" = Alice → Session `0` → Mark present.*
> "Alice marks herself present. This is a real transaction signed by her wallet."
*Point at the toast:* "See the **transaction hash** — that's the proof it's on the blockchain."

**3. Anyone can verify** — *Live verification → Session `0` → Load session.*
> "Anyone can audit it — here's the tamper-proof list with names, roll numbers, wallets, and times."

---

## 🔴 PART B — Attack it (cybersecurity part) (≈1.5 min)

*In Terminal 2, run:*
```bash
npm run attack
```
> "Now I attack the contract with real transactions from an attacker's wallet."

*Walk down the output — all show ✓ BLOCKED:*
> - **Attack 1 — Outsider:** unenrolled wallet marks attendance → *'Not a registered student'*. Identity is the signer, `msg.sender`.
> - **Attack 2 — Proxy:** a student tries to mark an absent friend → impossible; the function only credits the caller. Alice stays absent.
> - **Attack 3 / 3b — Privilege escalation:** attacker tries to self-enrol / open a session → blocked by `onlyAdmin` / `onlyTeacher`.
> - **Attack 4 — Double marking:** marking twice → *'Already marked'*.
> - **Attack 5 — Back-dating:** after the class is closed → *'Session is closed'*.
> - **Attack 6 — Tampering:** no edit/delete function exists — records are immutable.

*Point to the summary:* "**7 out of 7 attacks blocked** — each enforced by the smart contract, with the real rejection reason from the blockchain."

---

## 🏁 STEP 4 — Closing (20 sec)
> "So AttendChain gives attendance that can't be faked, proxied, escalated, replayed, back-dated,
> or tampered with — all enforced in code, verifiable on-chain, with no central system to trust.
> Thank you."

---

## 🧭 One-line cheat sheet
**A:** Alice marks ✓ (tx hash) → Verify list.
**B:** `npm run attack` → 7/7 blocked → summary.

## 🆘 If anything breaks mid-demo
Run in Terminal 2, then refresh the browser:
```bash
npm run seed
```

## 🔑 Terms you need
| Term | Meaning |
|---|---|
| Blockchain | A record nobody can secretly change |
| Smart contract | Rules that run automatically |
| Wallet | Each person's unique signing identity |
| Transaction | A signed action saved on-chain |
| `msg.sender` | Who signed it (their identity) |
| `require` / revert | A rule check; if it fails, the action is cancelled |
