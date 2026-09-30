// Deploys a fresh AttendChain and pre-fills a clean demo state:
// Alice, Bob, Charlie enrolled + one open session, nobody marked yet.
// Run: npm run seed   (needs `npm run node` running in another terminal)
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [admin, s1, s2, s3] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("AttendChain");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();

  await (await c.registerStudent(s1.address, "Alice", "S001")).wait();
  await (await c.registerStudent(s2.address, "Bob", "S002")).wait();
  await (await c.registerStudent(s3.address, "Charlie", "S003")).wait();
  await (await c.createSession("Blockchain 101")).wait();

  const artifact = require("../artifacts/contracts/AttendChain.sol/AttendChain.json");
  fs.writeFileSync(
    path.join(__dirname, "..", "frontend", "deployment.json"),
    JSON.stringify({ address, abi: artifact.abi }, null, 2)
  );

  console.log("\n==============================================");
  console.log(" Seeded AttendChain at:", address);
  console.log(" Enrolled: Alice, Bob, Charlie · Open session #0: Blockchain 101");
  console.log(" Network:", network.name);
  console.log("==============================================");
  console.log("Refresh the web UI — it auto-connects and is ready.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
