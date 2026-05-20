// NexSYS — Tauri backend
// All Syscoin Core RPC calls are proxied through Rust to avoid CORS restrictions.
// The webview frontend calls invoke("rpc_call", ...) which executes here
// using reqwest (native HTTP, no CORS, no browser security model).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// Parameters passed from the frontend for a single RPC call.
#[derive(Debug, Deserialize)]
pub struct RpcRequest {
    pub url: String,           // e.g. "http://192.168.50.10:8370/"
    pub username: String,
    pub password: String,
    pub method: String,
    pub params: Vec<Value>,
    pub wallet_name: Option<String>,
    pub timeout_ms: Option<u64>,
}

/// What we return to the frontend — mirrors the JSON-RPC envelope.
#[derive(Debug, Serialize)]
pub struct RpcResponse {
    pub ok: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
}

/// Tauri command: proxy a JSON-RPC call to Syscoin Core.
/// This runs in Rust, so there are no CORS restrictions.
#[tauri::command]
async fn rpc_call(req: RpcRequest) -> RpcResponse {
    let timeout = Duration::from_millis(req.timeout_ms.unwrap_or(10_000));

    // Build the target URL (append /wallet/<name> if specified)
    let url = if let Some(ref wallet) = req.wallet_name {
        if wallet.is_empty() {
            req.url.trim_end_matches('/').to_string() + "/"
        } else {
            format!("{}/wallet/{}", req.url.trim_end_matches('/'), wallet)
        }
    } else {
        req.url.trim_end_matches('/').to_string() + "/"
    };

    let body = serde_json::json!({
        "jsonrpc": "1.0",
        "id":      "nexsys",
        "method":  req.method,
        "params":  req.params,
    });

    eprintln!("[RPC-RUST] → {} {} (user: {})", req.method, url, req.username);

    let client = match reqwest::Client::builder()
        .timeout(timeout)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return RpcResponse {
                ok: false,
                result: None,
                error: Some(format!("HTTP client build error: {e}")),
            }
        }
    };

    let response = client
        .post(&url)
        .basic_auth(&req.username, Some(&req.password))
        .header("Content-Type", "text/plain")
        .json(&body)
        .send()
        .await;

    match response {
        Err(e) => {
            eprintln!("[RPC-RUST] ✗ Connection error: {e}");
            RpcResponse {
                ok: false,
                result: None,
                error: Some(format!("Connection error: {e}")),
            }
        }
        Ok(resp) => {
            let status = resp.status();
            match resp.json::<Value>().await {
                Err(e) => RpcResponse {
                    ok: false,
                    result: None,
                    error: Some(format!("JSON parse error (HTTP {status}): {e}")),
                },
                Ok(json) => {
                    // Standard JSON-RPC: { result, error, id }
                    let rpc_error = json.get("error").and_then(|e| {
                        if e.is_null() {
                            None
                        } else {
                            Some(
                                e.get("message")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("Unknown RPC error")
                                    .to_string(),
                            )
                        }
                    });

                    if let Some(err_msg) = rpc_error {
                        RpcResponse { ok: false, result: None, error: Some(err_msg) }
                    } else {
                        RpcResponse {
                            ok: true,
                            result: json.get("result").cloned(),
                            error: None,
                        }
                    }
                }
            }
        }
    }
}

/// Tauri command: test whether a TCP port is reachable from this machine.
/// Used by the Sentry Node dashboard to verify P2P port availability.
#[tauri::command]
async fn check_port(host: String, port: u16, timeout_ms: Option<u64>) -> bool {
    use tokio::net::TcpStream;
    use tokio::time::{timeout, Duration};

    let addr = format!("{}:{}", host, port);
    let dur = Duration::from_millis(timeout_ms.unwrap_or(3000));
    eprintln!("[PORT-CHECK] Testing {}:{}", host, port);
    let ok = timeout(dur, TcpStream::connect(&addr))
        .await
        .is_ok_and(|r| r.is_ok());
    eprintln!("[PORT-CHECK] {}:{} → {}", host, port, if ok { "open" } else { "closed/timeout" });
    ok
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![rpc_call, check_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
