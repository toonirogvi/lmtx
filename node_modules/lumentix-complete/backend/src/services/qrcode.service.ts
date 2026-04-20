import QRCode from "qrcode";

export async function generateQrCodeDataUri(value: string) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#18181B",
      light: "#FFFFFF"
    }
  });
}

