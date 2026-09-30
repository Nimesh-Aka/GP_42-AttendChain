# AttendChain – Blockchain-Based Anti-Proxy Attendance System

**Group:** GP_42

## Description
AttendChain is a decentralized attendance system built on the Ethereum blockchain that
eliminates *proxy attendance* — where a student marks present for an absent friend. Each
student is registered to their own wallet, and attendance can only be marked by a transaction
signed with that student's own private key, so no one can mark on behalf of another. A teacher
opens a time-bound session, students mark themselves present while it is open, and records are
stored immutably on-chain — they cannot be edited, deleted, or back-dated by anyone. The
Solidity smart contract (tested with Hardhat) enforces four guarantees: **no proxy marking, no
double-marking, no back-dating, and no tampering** — with a web interface (ethers.js + optional
MetaMask) for enrolling students, running sessions, and verifying attendance.

**Domain:** Blockchain · Education Technology (attendance management) · Identity & Access / anti-fraud
**Tech stack:** Ethereum · Solidity · Hardhat · ethers.js · MetaMask

## Links
- 🎥 **Demo video:** https://drive.google.com/file/d/1Hm0f1Hd8r8bwc2IkRDqcmAkz-ExlfD9v/view?usp=sharing
- 💻 **GitHub repository:** https://github.com/Nimesh-Aka/GP_42-AttendChain

## Team & Contributions

| Reg. No | Name | Contribution |
|---|---|---|
| EG/2021/4392 | A. N. Akarshana | Smart-contract design & Solidity development (`AttendChain.sol`), core anti-proxy logic, and project integration. |
| EG/2021/4385 | Adeesha M. G. P | Front-end web application (HTML/CSS + ethers.js UI), MetaMask integration, and user experience. |
| EG/2021/4602 | Karunarathne S. M. G. S | Testing & security assessment (Hardhat tests + `attack.js`), Hardhat configuration, and deployment/seed scripts. |
| EG/2021/4794 | Sellahewa I. A | Documentation (README, demo script), presentation slides, and demo video production. |

*All members contributed to design discussions, testing, and the final demonstration.*

## Key features
- Wallet-based identity — attendance is signed by each student's own key (`msg.sender`)
- One mark per student per session (no double-marking)
- Time-bound sessions (no back-dating)
- Immutable, publicly verifiable records (no tampering)
- Web UI with auto-assigned wallets, live class roster, and per-session verification
- Security assessment: **7/7 simulated attacks blocked on-chain** (`npm run attack`)
- Test suite: **15/15 passing** (`npm test`)

## Run it
```bash
npm install
npm test          # 15/15 tests
npm run node      # local blockchain (terminal 1)
npm run seed      # clean demo state (terminal 2)
npm run ui        # web app at http://localhost:5500 (terminal 3)
npm run attack    # security assessment
```
