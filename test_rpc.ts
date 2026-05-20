import { SyscoinRpcClient } from "./src/services/syscoinRpcClient";
const client = new SyscoinRpcClient({
  host: "http://192.168.50.10",
  port: 8370,
  username: "nexsysrpc",
  password: "S3cr3tP4ssw0rd!"
});
async function test() {
  console.log(await client.call("help", []));
  console.log(await client.call("syscoinbuildspvproof", ["f50027946db3fe4cb0286ab354a747349c0776c208b478a2ba34c61b8e5bca91"]));
}
test();
