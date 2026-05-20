/**
 * components/QrCode.tsx
 * Renders a QR code using the react-qr-code library.
 */

import QRCode from "react-qr-code";

interface Props {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}

export function QrCode({
  value,
  size = 200,
  fgColor = "#000000",
  bgColor = "#ffffff",
  className = "",
}: Props) {
  return (
    <div className={className} style={{ width: size, height: size, display: "block" }}>
      <QRCode
        value={value}
        size={size}
        fgColor={fgColor}
        bgColor={bgColor}
        level="M"
        style={{ height: "auto", maxWidth: "100%", width: "100%", display: "block" }}
      />
    </div>
  );
}
