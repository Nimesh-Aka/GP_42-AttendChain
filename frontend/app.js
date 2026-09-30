/* AttendChain web UI — talks to the AttendChain smart contract. */

const ABI = [
  "function admin() view returns (address)",
  "function isTeacher(address) view returns (bool)",
  "function students(address) view returns (string name, string rollNo, bool registered)",
  "function addTeacher(address teacher)",
  "function registerStudent(address student, string name, string rollNo)",
  "function createSession(string courseName) returns (uint256)",
  "function closeSession(uint256 sessionId)",
  "function markAttendance(uint256 sessionId)",
  "function sessionCount() view returns (uint256)",
  "function getSession(uint256 sessionId) view returns (uint256 id, string courseName, address teacher, uint256 openedAt, bool open, uint256 attendeeCount)",
  "function isPresent(uint256 sessionId, address student) view returns (bool)",
  "function getAttendees(uint256 sessionId) view returns (address[])",
  "function markedAt(uint256, address) view returns (uint256)",
  "function studentCount() view returns (uint256)",
  "function getStudentAddresses() view returns (address[])",
];

let provider, signer, contract, account, adminAddr, organizerAddr, mode = null;

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = "statusline " + kind;
  if (kind === "ok" || kind === "err") toast(msg, kind);
}

function toast(msg, kind = "ok") {
  const box = $("toasts");
  const el = document.createElement("div");
  el.className = "toast " + kind;
  const icon = kind === "ok" ? "✓" : kind === "err" ? "✕" : "•";
  el.innerHTML = `<span class="ticon">${icon}</span><span class="tbody"></span>`;
  el.querySelector(".tbody").textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 300);
  }, kind === "err" ? 5200 : 3400);
}

function setNet(text, on) {
  const b = $("netBadge");
  b.className = "netpill " + (on ? "on" : "off");
  b.innerHTML = `<i class="dot"></i>` + text;
}
function setAccPill(addr) {
  const p = $("accPill");
  if (addr) { p.hidden = false; p.textContent = short(addr); }
  else p.hidden = true;
}

/* -------- read the deployed contract address (written by deploy/seed) -------- */
async function loadAddress() {
  try {
    const res = await fetch("deployment.json", { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      if (d.address) { $("addr").value = d.address; localStorage.setItem("attendchain.addr", d.address); }
    }
  } catch (_) {}
  const saved = localStorage.getItem("attendchain.addr");
  if (saved && !$("addr").value) $("addr").value = saved;
}

/* -------- connect to the blockchain automatically on load (no wallet needed) -------- */
async function connectLocal() {
  setStatus("Connecting to the network…", "pending");
  provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  mode = "local";
  const net = await provider.getNetwork();
  const accounts = await provider.listAccounts();
  organizerAddr = accounts[0].address || accounts[0];
  signer = await provider.getSigner(organizerAddr);
  account = await signer.getAddress();
  setAccPill(account);
  setWalletMode(false);
  setNet("Ethereum · chain " + net.chainId, true);
  if ($("addr").value) await loadContract();
  setStatus("Connected to the network.", "ok");
}

window.addEventListener("load", async () => {
  await loadAddress();
  try {
    await connectLocal();
  } catch (e) {
    setStatus("Can't reach the network — start it with `npm run node`, then refresh.", "err");
    setNet("Offline", false);
  }
});

/* -------- optional: connect the visitor's own MetaMask wallet instead -------- */
$("connectBtn").onclick = async function () {
  if (!window.ethereum) { setStatus("MetaMask not found — install the extension, then click Connect Wallet.", "err"); return; }
  try {
    setStatus("Connecting MetaMask…", "pending");
    // Make sure MetaMask is on the local network (chainId 31337 = 0x7A69); add it if missing.
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7A69" }] });
    } catch (sw) {
      const code = sw && (sw.code || (sw.data && sw.data.originalError && sw.data.originalError.code));
      if (code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
          chainId: "0x7A69",
          chainName: "AttendChain Local (Hardhat)",
          rpcUrls: ["http://127.0.0.1:8545"],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        }] });
      }
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    mode = "metamask";
    const net = await provider.getNetwork();
    setAccPill(account);
    setNet("MetaMask · chain " + net.chainId, true);
    setWalletMode(true);
    if ($("addr").value) await loadContract();
    setStatus("MetaMask connected — actions will be signed by " + short(account) + ".", "ok");
  } catch (e) { setStatus(err(e), "err"); }
};

// Toggle the UI between local mode (auto-assigned wallets) and MetaMask mode.
function setWalletMode(mm) {
  $("stAddr").hidden = !mm;
  $("localPick").hidden = mm;
  $("mmPick").hidden = !mm;
  $("adminNote").textContent = mm
    ? "MetaMask mode: paste the student's own wallet address (they hold their key)."
    : "A unique blockchain wallet is created and assigned to each student automatically — no addresses to type.";
  if (mm && account) $("mmAddr").textContent = account;
}

/* ---------------------------------------------------------------- Contract */
async function loadContract() {
  const addr = $("addr").value.trim();
  if (!ethers.isAddress(addr)) { setStatus("No contract found — run `npm run seed`, then refresh.", "err"); return; }
  if (!signer) { setStatus("Not connected to the network yet.", "err"); return; }
  try {
    contract = new ethers.Contract(addr, ABI, signer);
    adminAddr = await contract.admin();
    localStorage.setItem("attendchain.addr", addr);
    $("sysContract").textContent = short(addr);
    await refreshRole();
    await refreshAll();
  } catch (e) { setStatus("Could not load contract: " + err(e), "err"); }
}

async function refreshRole() {
  const isAdmin = adminAddr.toLowerCase() === account.toLowerCase();
  const isTeacher = await contract.isTeacher(account);
  const st = await contract.students(account);
  let roles = [];
  if (isAdmin) roles.push("Admin");
  if (isTeacher) roles.push("Teacher");
  if (st.registered) roles.push("Student · " + st.name);
  $("role").textContent = roles.length ? roles.join(", ") : "Visitor (view only)";
}

/* ---------------------------------------------------------------- Actions */
document.querySelectorAll("button[data-act]").forEach((btn) => {
  btn.onclick = () => handle(btn.dataset.act);
});

async function handle(act) {
  if (!contract && act !== "refresh") { setStatus("Load the contract first.", "err"); return; }
  try {
    if (act === "registerStudent") {
      const name = $("stName").value.trim();
      const roll = $("stRoll").value.trim();
      if (!name || !roll) throw new Error("Enter the student's name and roll no.");
      const typed = $("stAddr").value.trim();
      let addr;
      if (typed) {
        if (!ethers.isAddress(typed)) throw new Error("Enter a valid wallet address.");
        addr = typed;
      } else {
        addr = await nextFreeWallet();
      }
      await tx(contract.registerStudent(addr, name, roll), name + " added — wallet " + short(addr));
      $("stName").value = $("stRoll").value = $("stAddr").value = "";
    } else if (act === "createSession") {
      await tx(contract.createSession($("course").value.trim()), "Session opened.");
      $("course").value = "";
    } else if (act === "closeSession") {
      await tx(contract.closeSession(num("closeId")), "Session closed.");
    } else if (act === "markAttendance") {
      const id = num("markId");
      const c = await studentContract();
      await tx(c.markAttendance(id), "Marked present ✅");
    } else if (act === "viewSession") {
      await viewSession(num("viewId"));
    } else if (act === "refresh") {
      await refreshAll();
      setStatus("Refreshed.", "ok");
    }
  } catch (e) { setStatus(err(e), "err"); }
}

// Find the next demo wallet that is not the admin and not yet a student.
async function nextFreeWallet() {
  if (mode !== "local") throw new Error("Auto-assigning wallets needs the app's own network connection (not an external wallet).");
  const accs = await provider.listAccounts();
  for (let i = 0; i < accs.length; i++) {
    const a = accs[i].address || accs[i];
    if (a.toLowerCase() === adminAddr.toLowerCase()) continue;
    const st = await contract.students(a);
    if (!st.registered) return a;
  }
  throw new Error("All demo wallets are in use.");
}

// The contract connected to the selected student's own wallet (demo),
// or the connected wallet (MetaMask).
async function studentContract() {
  if (mode === "local") {
    const sAddr = $("studentPicker").value;
    if (!sAddr) throw new Error("Pick your name in the “I am” box first.");
    return contract.connect(await provider.getSigner(sAddr));
  }
  return contract;
}

async function tx(promise, okMsg) {
  setStatus("Waiting for transaction to mine…", "pending");
  const t = await promise;
  await t.wait();
  setStatus(okMsg + (t.hash ? "  ·  tx " + short(t.hash) : ""), "ok");
  await refreshRole();
  await refreshAll();
}

/* ---------------------------------------------------------------- Views */
async function viewSession(id) {
  const s = await contract.getSession(id);
  const pill = s.open ? '<span class="pill open">OPEN</span>' : '<span class="pill closed">CLOSED</span>';
  $("sessionInfo").innerHTML =
    `<b>Session #${s.id}</b> · ${escapeHtml(s.courseName)} ${pill}<br/>` +
    `<span class="mono">Teacher ${short(s.teacher)}</span> &nbsp;·&nbsp; ` +
    `Opened ${new Date(Number(s.openedAt) * 1000).toLocaleString()} &nbsp;·&nbsp; ` +
    `Present <b>${s.attendeeCount}</b>`;

  const addrs = await contract.getAttendees(id);
  const tbody = $("attendTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (let i = 0; i < addrs.length; i++) {
    const a = addrs[i];
    const st = await contract.students(a);
    const at = await contract.markedAt(id, a);
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${i + 1}</td><td class="name">${escapeHtml(st.name)}</td><td>${escapeHtml(st.rollNo)}</td>` +
      `<td class="mono">${short(a)}</td>` +
      `<td>${new Date(Number(at) * 1000).toLocaleTimeString()}</td>`;
    tbody.appendChild(tr);
  }
  $("attendTable").hidden = addrs.length === 0;
  if (addrs.length === 0) $("sessionInfo").innerHTML += `<br/><span class="mono">No attendees yet.</span>`;
}

async function refreshAll() {
  if (!contract) return;
  const count = Number(await contract.sessionCount());
  let totalPresent = 0;
  let chips = "";
  for (let i = 0; i < count; i++) {
    const s = await contract.getSession(i);
    totalPresent += Number(s.attendeeCount);
    chips +=
      `<div class="schip"><div class="schip-top"><span class="sid">#${s.id}</span>` +
      `<span class="smeta"><span class="livedot ${s.open ? "g" : "r"}"></span>${s.open ? "open" : "closed"}</span></div>` +
      `<div class="scourse">${escapeHtml(s.courseName) || "&nbsp;"}</div>` +
      `<div class="smeta">${s.attendeeCount} present</div></div>`;
  }
  $("allSessions").innerHTML = count === 0 ? `<span class="note">No sessions yet.</span>` : chips;
  $("statSessions").textContent = count;
  $("statPresent").textContent = totalPresent;
  try { $("statStudents").textContent = Number(await contract.studentCount()); } catch (_) {}
  await refreshRoster();
}

// Build strings first, then assign once — safe if two refreshes overlap (no duplicates).
async function refreshRoster() {
  if (!contract) return;
  let addrs = [];
  try { addrs = await contract.getStudentAddresses(); } catch (_) {}
  let rows = "", opts = "";
  for (let i = 0; i < addrs.length; i++) {
    const a = addrs[i];
    const st = await contract.students(a);
    rows +=
      `<tr><td>${i + 1}</td><td class="name">${escapeHtml(st.name)}</td>` +
      `<td>${escapeHtml(st.rollNo)}</td><td class="mono">${short(a)}</td></tr>`;
    opts += `<option value="${a}">${escapeHtml(st.name)}  ·  ${escapeHtml(st.rollNo)}</option>`;
  }
  const picker = $("studentPicker");
  const prev = picker.value;
  picker.innerHTML = opts;
  if (prev && [...picker.options].some((o) => o.value === prev)) picker.value = prev;
  $("rosterTable").querySelector("tbody").innerHTML = rows;
  $("rosterTable").hidden = addrs.length === 0;
  $("rosterEmpty").textContent = addrs.length === 0 ? "No students yet — add one in the Admin box above." : "";
}

/* ---------------------------------------------------------------- Helpers */
function num(id) {
  const v = parseInt($(id).value, 10);
  if (isNaN(v)) throw new Error("Enter a session number.");
  return v;
}
function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function err(e) { return (e && (e.reason || e.shortMessage || e.message)) || "Something went wrong."; }

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}
