import fs from 'fs';
import path from 'path';

const root = process.cwd();
const androidMain = path.join(root, 'android', 'app', 'src', 'main');

if (!fs.existsSync(androidMain)) {
  console.error('Android project folder not found. Run `npx cap add android` first.');
  process.exit(1);
}

// 1. Copy KurdiKeyboardImeService.java into Java package folder
const javaPkgDir = path.join(androidMain, 'java', 'io', 'kurdikebord', 'app');
fs.mkdirSync(javaPkgDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'android-ime', 'KurdiKeyboardImeService.java'),
  path.join(javaPkgDir, 'KurdiKeyboardImeService.java')
);
console.log('Copied KurdiKeyboardImeService.java');

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

console.log('KurdiKeyboard Android IME setup completed successfully!');
