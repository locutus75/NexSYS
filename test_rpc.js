const fetch = require('node-fetch');
async function test() {
  try {
    const res = await fetch("https://rpc-tanenbaum.rollux.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: ["0x9C94C38db4450d094545E4D1C7EEa39451b940c", "latest"]
      })
    });
    console.log(res.status, res.statusText);
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
test();
