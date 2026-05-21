# NexSYS — Syscoin Command Center

The next-generation command center for Syscoin. A self-custody desktop wallet for users, node operators, and developers built with Tauri 2, React, and TypeScript.

## Prerequisites

Before installing NexSYS, make sure the following tools are installed on your system.

### 1. Node.js

Install [Node.js](https://nodejs.org/) **v18 or later**.

Verify with:

```bash
node --version
```

### 2. pnpm

NexSYS uses [pnpm](https://pnpm.io/) as its package manager.

```bash
npm install -g pnpm
```

Verify with:

```bash
pnpm --version
```

### 3. Rust

Tauri requires Rust. Install it via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal and verify:

```bash
rustc --version
cargo --version
```

### 4. System dependencies (Linux only)

On Linux, Tauri requires a set of system libraries. Install them with your package manager.

**Ubuntu / Debian:**

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Arch Linux:**

```bash
sudo pacman -Syu
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg
```

**Fedora / RHEL:**

```bash
sudo dnf install \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
sudo dnf group install "C Development Tools and Libraries"
```

macOS and Windows do not require additional system dependencies.

---

## Installation

Clone the repository and install JavaScript dependencies:

```bash
git clone https://github.com/locutus75/NexSYS.git
cd NexSYS
pnpm install
```

---

## Running in development mode

Start the app with hot-reloading for both the frontend and the Rust backend:

```bash
pnpm tauri dev
```

This will:
1. Start the Vite dev server for the React frontend.
2. Compile the Rust backend via Cargo.
3. Open the NexSYS desktop window.

---

## Building a production release

Compile and bundle the application for your current platform:

```bash
pnpm tauri build
```

The distributable installer or binary is placed in `src-tauri/target/release/bundle/`.

---

## Running tests

Run the frontend unit test suite:

```bash
pnpm test
```

Run tests in watch mode during development:

```bash
pnpm test:watch
```

Generate a coverage report:

```bash
pnpm test:coverage
```

---

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
