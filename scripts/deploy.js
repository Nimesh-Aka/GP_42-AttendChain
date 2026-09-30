const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AttendChain with account:", deployer.address);

  const Factory = await ethers.getContractFactory("AttendChain");
  const attend = await Factory.deploy();
  await attend.waitForDeployment();

  const address = await attend.getAddress();
  console.log("\n==============================================");
  console.log(" AttendChain deployed to:", address);
  console.log(" Network:", network.name, "(chainId 31337)");
  console.log("==============================================\n");
  console.log("Paste this address into the web UI's 'Contract address' box.");

  // Write address + ABI into the frontend so the UI can auto-load them if served.
  try {
    const artifact = require("../artifacts/contracts/AttendChain.sol/AttendChain.json");
    const outDir = path.join(__dirname, "..", "frontend");
    fs.writeFileSync(
      path.join(outDir, "deployment.json"),
      JSON.stringify({ address, abi: artifact.abi }, null, 2)
    );
    console.log("Wrote frontend/deployment.json");
  } catch (e) {
    console.log("(Could not write deployment.json:", e.message, ")");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
