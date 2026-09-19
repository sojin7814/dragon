/** Start a local download; browsers may show a save dialog or a file preview. */
export function downloadFile(content: Blob | string, filename: string, type = 'application/octet-stream'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Mobile browsers may consume the URL after the click handler has finished.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Call from a user click, with the file already prepared. */
export async function shareFile(blob: Blob, filename: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!navigator.share || !navigator.canShare) return 'unsupported';
  const files = [new File([blob], filename, { type: blob.type })];
  try {
    if (!navigator.canShare({ files })) return 'unsupported';
    await navigator.share({ files });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}

/** A deployment owner must approve the fixed address before configuring it. */
export function publicUrlError(value: string): string | null {
  if (!value) return '배포 주소 확정 후 생성';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const nonPublic = !host.includes('.') || host.includes(':') || /^\d+(\.\d+){3}$/.test(host)
      || /(^|\.)(localhost|local|test|invalid|example)$/.test(host)
      || /(^|\.)(example\.(com|org|net)|github\.com|raw\.githubusercontent\.com|bit\.ly|t\.co|tinyurl\.com|ngrok(-free)?\.(app|io)|trycloudflare\.com|vercel\.app|netlify\.app|replit\.dev|replit\.app|pages\.dev|webcontainer\.io|csb\.app|codespaces\.dev|githubpreview\.dev|app\.github\.dev)$/.test(host);
    if (value !== value.trim() || url.protocol !== 'https:' || url.port || url.username || url.password
      || /[?#<>\s]/.test(value) || nonPublic || value.length > 1000) {
      return '개인정보·추가 매개변수가 없는 정식 HTTPS 앱 주소가 필요해요. 임시 주소와 코드 저장소 주소는 사용할 수 없어요.';
    }
    return null;
  } catch {
    return '정식 공개 주소의 형식을 확인해주세요.';
  }
}
