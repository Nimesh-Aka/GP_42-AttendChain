// AttendChain — Smart-Contract Security Assessment
// Runs REAL signed transactions from an attacker wallet against the contract
// and shows how each attack is rejected on-chain (with the revert reason).
// Run:  npm run attack
const { ethers } = require("hardhat");

const G = "\x1b[32m", R = "\x1b[31m", C = "\x1b[36m", B = "\x1b[1m", D = "\x1b[2m", X = "\x1b[0m";
const line = () => console.log(D + "─".repeat(70) + X);
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

// Send a tx we EXPECT to be rejected; capture the on-chain revert reason.
async function expectRevert(promise) {
  try {
    await (await promise).wait();
    return { ok: false, reason: "NOT REVERTED — attack succeeded!" };
  } catch (e) {
    return { ok: true, reason: e.shortMessage || e.reason || e.message };
  }
}

let blocked = 0, total = 0;
function report(n, title, vector, res, why) {
  total++; if (res.ok) blocked++;
  const tag = res.ok ? `${G}✓ BLOCKED${X}` : `${R}✗ VULNERABLE${X}`;
  console.log(`${B}[ATTACK ${n}] ${title}${X}`);
  console.log(`   Vector : ${vector}`);
  console.log(`   Result : ${tag}  ${D}${res.reason}${X}`);
  console.log(`   Defense: ${why}\n`);
}

async function main() {
  const [admin, alice, bob, attacker] = await ethers.getSigners();

  console.log(`${B}${C}\n  AttendChain — Smart-Contract Security Assessment${X}`);
  console.log(`${D}  Every attack below is a real signed transaction against the deployed contract.${X}`);
  line();

  const F = await ethers.getContractFactory("AttendChain");
  const c = await F.deploy();
  await c.waitForDeployment();
  const addr = await c.getAddress();
  await (await c.registerStudent(alice.address, "Alice", "S001")).wait();
  await (await c.registerStudent(bob.address, "Bob", "S002")).wait();
  await (await c.createSession("Blockchain 101")).wait();
  const sid = 0;

  console.log(`${C}[SETUP]${X} Contract       ${addr}`);
  console.log(`${C}[SETUP]${X} Admin/Teacher  ${short(admin.address)}`);
  console.log(`${C}[SETUP]${X} Students       Alice ${short(alice.address)} · Bob ${short(bob.address)}  ${D}(already enrolled)${X}`);
  console.log(`${C}[SETUP]${X} Attacker       ${short(attacker.address)}  ${D}(a real wallet the attacker controls — NOT enrolled)${X}`);
  console.log(`${C}[SETUP]${X} Session        #0 "Blockchain 101" (open)`);
  line();

  // 1 — outsider tries to mark attendance
  let r = await expectRevert(c.connect(attacker).markAttendance(sid));
  report(1, "Unauthorized attendance (outsider)",
    `attacker ${short(attacker.address)} → markAttendance(0)`,
    r, "require(students[msg.sender].registered) — identity is the tx signer, not a form field.");

  // 2 — proxy: a registered student tries to mark an ABSENT friend
  const t = await c.connect(bob).markAttendance(sid);      // Bob can only mark himself
  const rec = await t.wait();
  const aliceMarked = await c.isPresent(sid, alice.address);
  console.log(`${D}   (Bob's own legit mark: tx ${short(t.hash)} mined in block ${rec.blockNumber})${X}`);
  report(2, "Proxy attendance — mark a friend",
    `registered Bob tries to get absent Alice marked present`,
    { ok: aliceMarked === false, reason: aliceMarked ? "Alice was marked!" : "Alice still ABSENT — only msg.sender (Bob) was credited" },
    "markAttendance() takes no 'student' argument. It can ONLY credit msg.sender — there is no code path to mark another person.");

  // 3 — privilege escalation: attacker enrolls themselves
  r = await expectRevert(c.connect(attacker).registerStudent(attacker.address, "Mallory", "H000"));
  report(3, "Privilege escalation — self-enroll",
    `attacker → registerStudent(self)`,
    r, "onlyAdmin modifier — only the deployer can enroll students.");

  // 3b — privilege escalation: attacker opens a session
  r = await expectRevert(c.connect(attacker).createSession("Fake class"));
  report("3b", "Privilege escalation — open a session",
    `attacker → createSession(...)`,
    r, "onlyTeacher modifier — the attacker holds no teacher role.");

  // 4 — replay / double marking
  r = await expectRevert(c.connect(bob).markAttendance(sid));
  report(4, "Replay / double-marking",
    `Bob → markAttendance(0) a second time`,
    r, "require(!marked[id][msg.sender]) — exactly one mark per student per session.");

  // 5 — back-dating after the class is closed
  await (await c.closeSession(sid)).wait();
  r = await expectRevert(c.connect(alice).markAttendance(sid));
  report(5, "Back-dating after class ends",
    `teacher closed #0; Alice → markAttendance(0)`,
    r, "require(session.open) — attendance is time-bounded; no late edits.");

  // 6 — tampering / deletion of records
  const fnNames = F.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
  const editFns = fnNames.filter((n) => /delete|remove|edit|update|reset|clear|unmark/i.test(n));
  report(6, "Tampering / deleting a record",
    `scan contract ABI for any edit/delete function`,
    { ok: editFns.length === 0, reason: editFns.length ? `found: ${editFns.join(", ")}` : "no edit/delete/reset function exists — records are append-only" },
    "State is immutable — there is no function to alter or remove a past attendance record.");

  line();
  console.log(`${B} RESULT:  ${blocked}/${total} attacks BLOCKED${X}`);
  console.log(` Final on-chain state → Bob: ${await c.isPresent(sid, bob.address)}  |  Alice: ${await c.isPresent(sid, alice.address)}  |  Attacker: ${await c.isPresent(sid, attacker.address)}`);
  line();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
