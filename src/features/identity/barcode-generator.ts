import JsBarcode from "jsbarcode";
import type { InsertableAsset } from "./asset-library";

export const BARCODE_FORMATS = [
  { value: "EAN13", label: "EAN-13", example: "5901234123457", hint: "12 digits, or 13 including a valid check digit." },
  { value: "UPC", label: "UPC-A", example: "036000291452", hint: "11 digits, or 12 including a valid check digit." },
  { value: "CODE128", label: "CODE128", example: "SA-001", hint: "Letters, numbers and printable ASCII symbols." },
] as const;

export type BarcodeFormat = typeof BARCODE_FORMATS[number]["value"];
export type BarcodeOptions = { displayValue?: boolean; height?: number; lineColor?: string; background?: string };

export function drawBarcode(target: HTMLCanvasElement | object, value: string, format: BarcodeFormat, {
  displayValue = true, height = 160, lineColor = "#000000", background = "#ffffff",
}: BarcodeOptions = {}) {
  if (!value.trim()) throw new Error("Enter a barcode value.");
  if (value.length > 80) throw new Error("Use at most 80 characters.");
  if (!Number.isFinite(height) || height < 40 || height > 400) throw new Error("Use a bar height between 40 and 400 px.");
  if (![lineColor, background].every((color) => /^#[a-f\d]{6}$/i.test(color))) throw new Error("Use valid hex colors.");
  try {
    JsBarcode(target, value, {
      format, displayValue, width: 4, height,
      margin: 40, fontSize: 32, textMargin: 8,
      background, lineColor,
    });
  } catch {
    throw new Error(`Invalid ${format === "UPC" ? "UPC-A" : format} value. Check the format and check digit.`);
  }
}

export function generateBarcode(value: string, format: BarcodeFormat, options: BarcodeOptions = {}): InsertableAsset {
  const canvas = document.createElement("canvas");
  drawBarcode(canvas, value, format, options);
  return {
    name: `Barcode ${format} · ${value}`,
    imageRole: "barcode",
    imageBarSource: { bars: options.lineColor ?? "#000000", background: options.background ?? "#ffffff" },
    image: canvas.toDataURL("image/png"),
    imageRatio: canvas.width / canvas.height,
    width: 180,
  };
}
