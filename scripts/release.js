import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const packageJsonPath = path.resolve('package.json');
const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
const cargoTomlPath = path.resolve('src-tauri/Cargo.toml');

// Helper to run shell commands safely
function runCmd(cmd) {
  try {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);
    return execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\x1b[31mError running command: ${cmd}\x1b[0m`);
    process.exit(1);
  }
}

// Ensure we are inside a Git repository
try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
} catch (err) {
  console.error('\x1b[31mError: Not in a git repository. Please initialize git first.\x1b[0m');
  process.exit(1);
}

// 1. Read current version
if (!fs.existsSync(packageJsonPath)) {
  console.error('\x1b[31mError: package.json not found in the current directory!\x1b[0m');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
console.log(`\n\x1b[32mCurrent Version:\x1b[0m v${currentVersion}`);

// Parse version components (SemVer)
const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
if (!match) {
  console.error(`\x1b[31mError: Current version format in package.json is invalid: "${currentVersion}"\x1b[0m`);
  process.exit(1);
}

const [_, majorStr, minorStr, patchStr, prerelease = ''] = match;
const major = parseInt(majorStr, 10);
const minor = parseInt(minorStr, 10);
const patch = parseInt(patchStr, 10);

const patchVersion = `${major}.${minor}.${patch + 1}`;
const minorVersion = `${major}.${minor + 1}.0`;
const majorVersion = `${major + 1}.0.0`;

// Check CLI arguments
let newVersion = process.argv[2];

if (!newVersion) {
  if (process.stdout.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n\x1b[35mSelect release version bump type:\x1b[0m');
    console.log(`1) patch  -> \x1b[33mv${patchVersion}\x1b[0m`);
    console.log(`2) minor  -> \x1b[33mv${minorVersion}\x1b[0m`);
    console.log(`3) major  -> \x1b[33mv${majorVersion}\x1b[0m`);
    console.log(`4) custom`);

    const answer = await new Promise((resolve) => {
      rl.question('\nChoose option (1-4) or enter new version directly: ', resolve);
    });
    rl.close();

    const trimmed = answer.trim();
    if (trimmed === '1') {
      newVersion = patchVersion;
    } else if (trimmed === '2') {
      newVersion = minorVersion;
    } else if (trimmed === '3') {
      newVersion = majorVersion;
    } else if (trimmed === '4' || trimmed === '') {
      const rlCustom = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      const customAns = await new Promise((resolve) => {
        rlCustom.question('Enter custom version string (e.g. 0.2.0): ', resolve);
      });
      rlCustom.close();
      newVersion = customAns.trim();
    } else {
      newVersion = trimmed;
    }
  } else {
    console.log(`\x1b[33mNon-interactive shell. Defaulting to patch version bump: v${patchVersion}\x1b[0m`);
    newVersion = patchVersion;
  }
} else {
  // Translate helper keywords
  if (newVersion === 'patch') newVersion = patchVersion;
  else if (newVersion === 'minor') newVersion = minorVersion;
  else if (newVersion === 'major') newVersion = majorVersion;
}

// Validate target version format
if (!/^\d+\.\d+\.\d+(-.+)?$/.test(newVersion)) {
  console.error(`\x1b[31mError: Invalid target version string: "${newVersion}". Must follow SemVer rules.\x1b[0m`);
  process.exit(1);
}

console.log(`\n\x1b[32mBumping files to version:\x1b[0m v${newVersion}`);

// 2. Update files
// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✓ Updated package.json');

// Update tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log('✓ Updated src-tauri/tauri.conf.json');
} else {
  console.warn('\x1b[33mWarning: src-tauri/tauri.conf.json not found!\x1b[0m');
}

// Update Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]*"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoContent);
  console.log('✓ Updated src-tauri/Cargo.toml');
} else {
  console.warn('\x1b[33mWarning: src-tauri/Cargo.toml not found!\x1b[0m');
}

// 3. Git Operations
console.log('\n\x1b[35mStaging changes in git...\x1b[0m');
runCmd('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml');

console.log('\n\x1b[35mCommitting version bump...\x1b[0m');
runCmd(`git commit -m "chore: bump version to v${newVersion}"`);

console.log(`\n\x1b[35mCreating tag v${newVersion}...\x1b[0m`);
runCmd(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

// Ask before pushing
let pushConfigured = false;
if (process.stdout.isTTY) {
  const rlPush = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const pushAns = await new Promise((resolve) => {
    rlPush.question('\nPush changes and tag to GitHub? (y/n): ', resolve);
  });
  rlPush.close();

  if (pushAns.trim().toLowerCase() === 'y' || pushAns.trim() === '') {
    pushConfigured = true;
  }
} else {
  pushConfigured = true;
}

if (pushConfigured) {
  console.log('\n\x1b[35mPushing branch and tags to remote...\x1b[0m');
  runCmd('git push origin HEAD');
  runCmd(`git push origin v${newVersion}`);
  console.log(`\n\x1b[32mSuccess! version v${newVersion} has been pushed and tagged.\x1b[0m`);
  console.log('The GitHub Release workflow will compile, package, sign, and publish the update manifest automatically.');
} else {
  console.log('\n\x1b[33mRelease tagged locally but not pushed.\x1b[0m');
  console.log('To publish the release manually, run:');
  console.log(`  git push origin HEAD`);
  console.log(`  git push origin v${newVersion}`);
}
