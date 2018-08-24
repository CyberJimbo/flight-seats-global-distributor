const util = require("util");
const fs = require("fs");
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

async function writeIndex() {
  const contractDirectory = __dirname + "/build/contracts/";
  const contracts = [];
  const files = await readdir(contractDirectory);
  
  for (const file of files) {
    const contractName = file.substring(0, file.length - 5);
    const contents =  await readFile(contractDirectory + file, "utf8");
      
    contracts.push(`exports.${contractName} = ${contents};`);
  }
  
  return writeFile(__dirname + "/build/index.js", contracts.join("\n"));
}


writeIndex().catch(e => console.error(e));
