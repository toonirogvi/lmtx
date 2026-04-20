import bwipjs from "bwip-js";

export async function generateBarcodeDataUri(value: string) {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF"
  });

  return `data:image/png;base64,${png.toString("base64")}`;
}

