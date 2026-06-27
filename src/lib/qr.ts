import QRCode from "qrcode";

/** Generate a high-contrast PNG data URL for the given text. */
export async function generateQrPng(text: string, opts: { size?: number; margin?: number; color?: string } = {}) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    margin: opts.margin ?? 2,
    width: opts.size ?? 512,
    color: { dark: opts.color ?? "#0f172a", light: "#ffffff" },
  });
}

/** Trigger a browser download of a data URL. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}