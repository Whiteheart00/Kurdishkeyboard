import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = process.cwd();
const androidMain = path.join(root, 'android', 'app', 'src', 'main');

if (!fs.existsSync(androidMain)) {
  console.error('Android project folder not found. Run `npx cap add android` first.');
  process.exit(1);
}

// 1. Copy KurdiKeyboardImeService.java & MainActivity.java into Java package folder
const javaPkgDir = path.join(androidMain, 'java', 'io', 'kurdikebord', 'app');
fs.mkdirSync(javaPkgDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'android-ime', 'KurdiKeyboardImeService.java'),
  path.join(javaPkgDir, 'KurdiKeyboardImeService.java')
);
fs.copyFileSync(
  path.join(root, 'android-ime', 'MainActivity.java'),
  path.join(javaPkgDir, 'MainActivity.java')
);
fs.copyFileSync(
  path.join(root, 'android-ime', 'OfflineKeyboardStt.java'),
  path.join(javaPkgDir, 'OfflineKeyboardStt.java')
);
console.log('Copied KurdiKeyboardImeService.java, MainActivity.java, and OfflineKeyboardStt.java');

// 2. Copy res/xml/method.xml
const xmlDir = path.join(androidMain, 'res', 'xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'android-ime', 'method.xml'),
  path.join(xmlDir, 'method.xml')
);
console.log('Copied res/xml/method.xml');

// 3. Patch AndroidManifest.xml with required permissions (VIBRATE, RECORD_AUDIO) and KurdiKeyboardImeService (directBootAware="true")
const manifestPath = path.join(androidMain, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
let manifestModified = false;

// Android 11+ package visibility is required before binding to Manga's explicit offline STT service.
if (!manifest.includes('android:name="com.mangatranslator.app"')) {
  if (manifest.includes('</queries>')) {
    manifest = manifest.replace('</queries>', '        <package android:name="com.mangatranslator.app" />\n    </queries>');
  } else {
    manifest = manifest.replace('<application', '    <queries>\n        <package android:name="com.mangatranslator.app" />\n    </queries>\n\n    <application');
  }
  manifestModified = true;
  console.log('Added Manga translator package visibility query');
}

const requiredPermissions = [
  'android.permission.VIBRATE',
  'android.permission.RECORD_AUDIO',
];

for (const perm of requiredPermissions) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace(
      '<application',
      `    <uses-permission android:name="${perm}" />\n\n    <application`
    );
    manifestModified = true;
    console.log(`Added ${perm} to AndroidManifest.xml`);
  }
}

if (!manifest.includes('KurdiKeyboardImeService')) {
  const imeServiceXml = `
        <service
            android:name=".KurdiKeyboardImeService"
            android:label="تەختەکلیلی کوردی"
            android:permission="android.permission.BIND_INPUT_METHOD"
            android:directBootAware="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.view.InputMethod" />
            </intent-filter>
            <meta-data
                android:name="android.view.im"
                android:resource="@xml/method" />
        </service>
    </application>`;
  manifest = manifest.replace('</application>', imeServiceXml);
  manifestModified = true;
  console.log('Patched AndroidManifest.xml with KurdiKeyboardImeService (directBootAware=true)');
}

if (manifestModified) {
  fs.writeFileSync(manifestPath, manifest, 'utf8');
}

// 4. Trim non-runtime files from android assets/public/assets/aistudio (keep only fx_* sounds)
const bundledAistudioDir = path.join(androidMain, 'assets', 'public', 'assets', 'aistudio');
if (fs.existsSync(bundledAistudioDir)) {
  let removed = 0;
  for (const file of fs.readdirSync(bundledAistudioDir)) {
    if (!file.startsWith('fx_')) {
      fs.rmSync(path.join(bundledAistudioDir, file), { recursive: true, force: true });
      removed++;
    }
  }
  console.log(`Trimmed ${removed} non-runtime files from Android APK assets (kept runtime sound packs)`);
}

// 5. Copy persistent signing keystore & patch android/app/build.gradle for seamless in-place APK updates
const androidAppDir = path.join(root, 'android', 'app');
const srcKeystore = path.join(root, 'android-ime', 'kurdikeyboard-debug.keystore');
const dstKeystore = path.join(androidAppDir, 'kurdikeyboard-debug.keystore');

if (fs.existsSync(srcKeystore)) {
  fs.copyFileSync(srcKeystore, dstKeystore);
  console.log('Copied persistent signing keystore -> android/app/kurdikeyboard-debug.keystore');
} else {
  console.warn('WARNING: android-ime/kurdikeyboard-debug.keystore not found! APK updates may require reinstall.');
}

const buildGradlePath = path.join(androidAppDir, 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');

  const rawRunNumber = Number(process.env.APP_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || 1);
  const runNumber = Number.isFinite(rawRunNumber) && rawRunNumber > 0 ? Math.floor(rawRunNumber) : 1;
  // Base 100 ensures versionCode is always strictly higher than initial versionCode 1 and grows on every build
  const versionCode = 100 + runNumber;
  const versionName = `2.0.${runNumber}`;

  gradle = gradle.replace(/\bversionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/\bversionName\s+"[^"]+"/, `versionName "${versionName}"`);

  if (fs.existsSync(dstKeystore) && !gradle.includes('kurdikeyboard-debug.keystore')) {
    const signingBlock = `    signingConfigs {
        debug {
            storeFile file('kurdikeyboard-debug.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD') ?: 'android'
            keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: 'androiddebugkey'
            keyPassword System.getenv('ANDROID_KEY_PASSWORD') ?: 'android'
        }
    }
    buildTypes {`;

    if (gradle.includes('buildTypes {')) {
      gradle = gradle.replace('buildTypes {', signingBlock);
    }

    // Explicitly bind debug buildType to our persistent signingConfigs.debug
    if (!/buildTypes\s*\{[\s\S]*?\bdebug\s*\{/.test(gradle)) {
      gradle = gradle.replace(
        'buildTypes {',
        `buildTypes {\n        debug {\n            signingConfig signingConfigs.debug\n        }`
      );
    } else if (!gradle.includes('signingConfig signingConfigs.debug')) {
      gradle = gradle.replace(
        /(buildTypes\s*\{[\s\S]*?\bdebug\s*\{)/,
        `$1\n            signingConfig signingConfigs.debug`
      );
    }
  }

  fs.writeFileSync(buildGradlePath, gradle, 'utf8');
  console.log(`Patched android/app/build.gradle (versionCode=${versionCode}, versionName=${versionName}, persistent keystore signing enabled)`);
}

// 6. Inject official KurdiKeyboard App Launcher Icon (public/app-icon.png) into Android res/
const srcAppIcon = path.join(root, 'public', 'app-icon.png');
if (fs.existsSync(srcAppIcon)) {
  const resDir = path.join(androidMain, 'res');

  // Ensure crisp white adaptive icon background
  const valuesDir = path.join(resDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n`,
    'utf8'
  );

  // Remove Capacitor's default vector ic_launcher_background.xml if present to avoid conflicts
  const oldDrawableBg = path.join(resDir, 'drawable', 'ic_launcher_background.xml');
  if (fs.existsSync(oldDrawableBg)) fs.rmSync(oldDrawableBg, { force: true });
  const oldDrawableV24Fg = path.join(resDir, 'drawable-v24', 'ic_launcher_foreground.xml');
  if (fs.existsSync(oldDrawableV24Fg)) fs.rmSync(oldDrawableV24Fg, { force: true });

  // Point adaptive icons (API 26+) to @color/ic_launcher_background + @mipmap/ic_launcher_foreground
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpiDir, { recursive: true });
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

  const densities = [
    { name: 'mipmap-mdpi', legacy: 48, fg: 108 },
    { name: 'mipmap-hdpi', legacy: 72, fg: 162 },
    { name: 'mipmap-xhdpi', legacy: 96, fg: 216 },
    { name: 'mipmap-xxhdpi', legacy: 144, fg: 324 },
    { name: 'mipmap-xxxhdpi', legacy: 192, fg: 432 },
  ];

  // Check if ImageMagick `convert` is available (preinstalled on GitHub Actions ubuntu-latest)
  let hasConvert = false;
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' });
    hasConvert = true;
  } catch {
    hasConvert = false;
  }

  for (const d of densities) {
    const dir = path.join(resDir, d.name);
    fs.mkdirSync(dir, { recursive: true });

    // Remove any existing .webp launcher icons to prevent AAPT2 duplicate resource errors
    for (const stale of ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp']) {
      const p = path.join(dir, stale);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }

    const fgOut = path.join(dir, 'ic_launcher_foreground.png');
    const legacyOut = path.join(dir, 'ic_launcher.png');
    const roundOut = path.join(dir, 'ic_launcher_round.png');

    if (hasConvert) {
      // Adaptive foreground: fit icon cleanly inside Android's 72/108 safe zone (~74% of canvas) on transparent background
      const fgInner = Math.round(d.fg * 0.74);
      execFileSync('convert', [
        srcAppIcon,
        '-resize',
        `${fgInner}x${fgInner}`,
        '-background',
        'none',
        '-gravity',
        'center',
        '-extent',
        `${d.fg}x${d.fg}`,
        fgOut,
      ]);

      // Legacy & round icons: crisp icon centered on pure white square background
      const legInner = Math.round(d.legacy * 0.88);
      execFileSync('convert', [
        srcAppIcon,
        '-resize',
        `${legInner}x${legInner}`,
        '-background',
        '#FFFFFF',
        '-gravity',
        'center',
        '-extent',
        `${d.legacy}x${d.legacy}`,
        '-alpha',
        'remove',
        legacyOut,
      ]);
      fs.copyFileSync(legacyOut, roundOut);
    } else {
      fs.copyFileSync(srcAppIcon, fgOut);
      fs.copyFileSync(srcAppIcon, legacyOut);
      fs.copyFileSync(srcAppIcon, roundOut);
    }
  }

  console.log(
    `Installed official KurdiKeyboard app icon across all Android mipmap densities (ImageMagick resize=${hasConvert})`
  );
} else {
  console.warn('WARNING: public/app-icon.png not found, keeping default Capacitor launcher icon.');
}

console.log('KurdiKeyboard Android IME setup completed successfully!');
