# NexSYS — Syscoin Command Center

NexSYS is a next-generation desktop command center and wallet for the Syscoin network, built using **Tauri v2**, **React**, and **TypeScript**. It proxies all Syscoin Core RPC calls through Rust to bypass browser CORS restrictions and run natively with high performance.

---

## 🚀 Key Prerequisites & System Dependencies

To develop or build NexSYS, you must install the prerequisites for your operating system:

### 1. Common Requirements
* **Node.js**: `v18.x` or higher (LTS recommended)
* **pnpm**: `v9.x` or higher (package manager)
* **Rust / Cargo**: Install via [rustup.rs](https://rustup.rs/) (Stable channel)

### 2. OS-Specific Requirements

#### 💻 Windows
* **Microsoft Visual Studio Build Tools**: Choose the **C++ build tools** workload (specifically the MSVC compiler and Windows SDK).
* **WebView2**: Built-in on Windows 10/11. For Windows 7/8, download the Evergreen Bootstrapper from Microsoft.

#### 🍎 macOS
* **Xcode Command Line Tools**: Run the following in your terminal:
  ```bash
  xcode-select --install
  ```

#### 🐧 Linux (Debian/Ubuntu)
Install the required development and webkit headers:
```bash
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  webkit2gtk-4.1-dev
```

---

## 🛠️ Getting Started & Local Development

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/locutus75/NexSYS.git
   cd NexSYS
   ```
2. **Install Dependencies**:
   ```bash
   pnpm install
   ```
3. **Start Local Development Server**:
   This spins up the Vite development server and launches the native Tauri application window:
   ```bash
   pnpm tauri dev
   ```

---

## 📦 Compiling Production Builds

To compile and bundle NexSYS into a production installer (e.g. `.msi` on Windows, `.dmg` on macOS, `.deb` or `AppImage` on Linux):

```bash
pnpm tauri build
```

The resulting installers will be saved in `src-tauri/target/release/bundle/`.

---

## 🔄 Versioning & Auto-Updater Deployment

NexSYS uses Tauri v2's native update mechanism to seamlessly push updates to clients.

### 1. Cryptographic Signature Generation (Prerequisite)
To prevent malicious updates, Tauri signs all binaries with a private key. 
Run the following command once to generate your key pair:

```bash
pnpm tauri signer generate -w ~/.tauri/nexsys.key
```

* **Public Key**: Insert this value directly into your `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
* **Private Key**: Keep this secret! Set it as the `TAURI_SIGNING_PRIVATE_KEY` environment variable in your build shell or CI/CD environment (e.g., GitHub Actions Secrets).
* **Private Key Password** (if any): Set as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in your environment.

### 2. Building Updates
When you run `pnpm tauri build` with your private key environment variables set:
1. Tauri compiles the application.
2. Tauri generates `.sig` signature files for each target platform.
3. These files are placed alongside the installers in `src-tauri/target/release/bundle/`.

### 3. Update Manifest Schema (`latest.json`)
Host a static JSON file (the update manifest) on a server (e.g. GitHub Releases, AWS S3, or a custom host). This file is what NexSYS checks when looking for new versions.

Here is the manifest structure you should deploy:

```json
{
  "version": "0.2.0",
  "notes": "NexSYS Version 0.2.0 release containing the new transaction history module and performance fixes.",
  "pub_date": "2026-05-22T01:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIHNpZ25hdHVyZQ...",
      "url": "https://github.com/locutus75/NexSYS/releases/download/v0.2.0/NexSYS_0.2.0_x64-setup.nsis.zip"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIHNpZ25hdHVyZQ...",
      "url": "https://github.com/locutus75/NexSYS/releases/download/v0.2.0/NexSYS_0.2.0_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIHNpZ25hdHVyZQ...",
      "url": "https://github.com/locutus75/NexSYS/releases/download/v0.2.0/NexSYS_0.2.0_aarch64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIHNpZ25hdHVyZQ...",
      "url": "https://github.com/locutus75/NexSYS/releases/download/v0.2.0/nexsys_0.2.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### 4. Deploying the Update
* Upload the updated platform binaries to your file host or release page.
* Update `latest.json` with the new version number, release date, and signatures.
* Point the `plugins.updater.endpoints` array in `tauri.conf.json` to the URL hosting `latest.json`.
