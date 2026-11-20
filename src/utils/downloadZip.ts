export async function downloadProjectZip(): Promise<boolean> {
  try {
    const res = await fetch('/api/download-github-zip');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kurdikeyboard-github-apk.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch {
    const a = document.createElement('a');
    a.href = '/api/download-github-zip';
    a.download = 'kurdikeyboard-github-apk.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return false;
  }
}
