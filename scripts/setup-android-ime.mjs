import fs from 'fs';
import path from 'path';

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
console.log('Copied KurdiKeyboardImeService.java and MainActivity.java');

// 2. Copy res/xml/method.xml
const xmlDir = path.join(androidMain, 'res', 'xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'android-ime', 'method.xml'),
  path.join(xmlDir, 'method.xml')
);
console.log('Copied res/xml/method.xml');

// 3. Patch AndroidManifest.xml to register KurdiKeyboardImeService with directBootAware="true"
const manifestPath = path.join(androidMain, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');

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
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('Patched AndroidManifest.xml with KurdiKeyboardImeService (directBootAware=true)');
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

console.log('KurdiKeyboard Android IME setup completed successfully!');
