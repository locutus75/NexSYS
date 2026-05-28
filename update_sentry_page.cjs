const fs = require('fs');
const path = require('path');

const cssAdditions = `
.sentry-tabs {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.sentry-tab {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  position: relative;
}

.sentry-tab:hover {
  color: var(--color-text-primary);
}

.sentry-tab--active {
  color: var(--color-accent);
}

.sentry-tab--active::after {
  content: "";
  position: absolute;
  bottom: calc(-1 * var(--space-2) - 1px);
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--color-accent);
}

.sentry-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.sentry-table th {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.sentry-table td {
  font-size: var(--text-sm);
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
`;

fs.appendFileSync(path.join(__dirname, 'src/features/sentry/SentryNodePage.css'), cssAdditions);

let pageContent = fs.readFileSync(path.join(__dirname, 'src/features/sentry/SentryNodePage.tsx'), 'utf8');

// Insert new imports
pageContent = pageContent.replace(
  `import type {
  RawMasternodeStatus,`,
  `import type {
  RawProTxList,
  RawMasternodeList,
  RawMasternodeStatus,`
);

// Add Tab state
pageContent = pageContent.replace(
  `export function SentryNodePage() {
  const { rpcClient, rpcConfig, activeNetwork } = useNetworkStore();`,
  `export function SentryNodePage() {
  const { rpcClient, rpcConfig, activeNetwork } = useNetworkStore();
  const [activeTab, setActiveTab] = useState<"overview" | "mynodes" | "network">("overview");
  const [myNodes, setMyNodes] = useState<RawProTxList | null>(null);
  const [mnList, setMnList] = useState<RawMasternodeList | null>(null);`
);

// Fetch ProTx list and Masternode List
pageContent = pageContent.replace(
  `        rpcClient.masternodeStatus(),
        rpcClient.mnSyncStatus(),
        rpcClient.masternodeCount(),
      ]);`,
  `        rpcClient.masternodeStatus(),
        rpcClient.mnSyncStatus(),
        rpcClient.masternodeCount(),
        rpcClient.protxList("wallet", true),
        rpcClient.masternodeList("json"),
      ]);`
);
pageContent = pageContent.replace(
  `    const [chainRes, netRes, walletRes, mnStatusRes, mnSyncRes, mnCountRes] =`,
  `    const [chainRes, netRes, walletRes, mnStatusRes, mnSyncRes, mnCountRes, protxRes, mnListRes] =`
);
pageContent = pageContent.replace(
  `    if (mnCountRes.ok)  setMnCount(mnCountRes.value);
    else setMnCount(null);`,
  `    if (mnCountRes.ok)  setMnCount(mnCountRes.value);
    else setMnCount(null);

    if (protxRes.ok) setMyNodes(protxRes.value);
    else setMyNodes([]);

    if (mnListRes.ok) setMnList(mnListRes.value);
    else setMnList(null);`
);

// Insert Tabs UI and split view
pageContent = pageContent.replace(
  `      {/* Overall health bar */}`,
  `      <div className="sentry-tabs">
        <button className={\`sentry-tab \${activeTab === "overview" ? "sentry-tab--active" : ""}\`} onClick={() => setActiveTab("overview")}>Overview</button>
        <button className={\`sentry-tab \${activeTab === "mynodes" ? "sentry-tab--active" : ""}\`} onClick={() => setActiveTab("mynodes")}>My Nodes</button>
        <button className={\`sentry-tab \${activeTab === "network" ? "sentry-tab--active" : ""}\`} onClick={() => setActiveTab("network")}>Network Stats</button>
      </div>

      {activeTab === "overview" && (
        <>
          {/* Overall health bar */}`
);

// Close the activeTab === "overview" condition at the end
pageContent = pageContent.replace(
  `    </div>
  );
}`,
  `        </>
      )}

      {activeTab === "mynodes" && (
        <div className="card animate-fade-in">
          <div className="stat-label mb-4">My Sentry Nodes</div>
          {myNodes && myNodes.length > 0 ? (
            <table className="sentry-table">
              <thead>
                <tr>
                  <th>ProTx Hash</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Next Payment</th>
                </tr>
              </thead>
              <tbody>
                {myNodes.map(node => (
                  <tr key={node.proTxHash}>
                    <td className="font-mono text-xs">{node.proTxHash.substring(0, 16)}...</td>
                    <td>
                      <StatusPill 
                        state={node.state.PoSePenalty > 0 ? "warn" : "ok"} 
                        label={node.state.PoSePenalty > 0 ? \`PoSe (\${node.state.PoSePenalty})\` : "Healthy"} 
                      />
                    </td>
                    <td className="font-mono text-xs">{node.state.service}</td>
                    <td>{node.state.nextPaymentHeight > 0 ? \`Block \${node.state.nextPaymentHeight}\` : "Waiting"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-muted text-sm py-4">No Sentry Nodes found in the currently connected wallet. Ensure your wallet has the ProTx transactions and is unlocked.</div>
          )}
        </div>
      )}

      {activeTab === "network" && (
        <div className="card animate-fade-in">
          <div className="stat-label mb-4">Network Status</div>
          {mnCount ? (
            <div className="grid-3 mb-6" style={{ gap: "var(--space-4)" }}>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Total Registered</div>
                <div className="text-xl font-bold">{mnCount.total.toLocaleString()}</div>
              </div>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Active / Enabled</div>
                <div className="text-xl font-bold text-success">{mnCount.enabled.toLocaleString()}</div>
              </div>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Qualifying for Rewards</div>
                <div className="text-xl font-bold">{mnCount.qualify?.toLocaleString() ?? "—"}</div>
              </div>
            </div>
          ) : (
            <p className="text-muted">Loading network stats...</p>
          )}

          {mnList && (
            <div>
              <div className="stat-label mb-4 mt-6">Recent Nodes</div>
              <table className="sentry-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(mnList).slice(0, 10).map((mn, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-xs">{mn.address}</td>
                      <td>
                        <StatusPill 
                          state={mn.status === "ENABLED" ? "ok" : "warn"} 
                          label={mn.status} 
                        />
                      </td>
                      <td className="font-mono text-xs">{mn.daemonversion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-muted text-xs mt-2 text-center">Showing first 10 nodes from {Object.keys(mnList).length} total nodes in registry.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}`
);

fs.writeFileSync(path.join(__dirname, 'src/features/sentry/SentryNodePage.tsx'), pageContent);
console.log("Updated SentryNodePage!");
