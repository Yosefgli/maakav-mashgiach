"use client";

import { useEffect, useId, useState } from "react";
import { Camera, Keyboard, X } from "lucide-react";

type ScannerInstance = {
  render: (success: (decodedText: string) => void) => Promise<void>;
  clear: () => Promise<void>;
};

async function createScanner(elementId: string): Promise<ScannerInstance> {
  const { Html5QrcodeScanner } = await import("html5-qrcode");
  const scanner = new Html5QrcodeScanner(
    elementId,
    { fps: 10, qrbox: { width: 220, height: 220 } },
    false,
  );

  return {
    render: (success) =>
      new Promise<void>((resolve) => {
        scanner.render((decodedText) => {
          success(decodedText);
        }, () => undefined);
        resolve();
      }),
    clear: () => scanner.clear(),
  };
}

export function QrScannerDialog({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const [manualValue, setManualValue] = useState("");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const elementId = useId().replace(/:/g, "_");

  useEffect(() => {
    if (!open) {
      return;
    }

    let scanner: ScannerInstance | null = null;
    let disposed = false;

    const bootScanner = async () => {
      try {
        scanner = await createScanner(elementId);
        if (disposed || !scanner) {
          return;
        }

        await scanner.render((decodedText) => {
          onScan(decodedText);
        });
      } catch (error) {
        setScannerError(
          error instanceof Error
            ? error.message
            : "לא הצלחנו לגשת למצלמה. אפשר להזין קוד ידנית.",
        );
      }
    };

    void bootScanner();

    return () => {
      disposed = true;
      if (scanner) {
        void scanner.clear();
      }
    };
  }, [elementId, onScan, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="scan-title">
        <div className="modal__topBar">
          <div>
            <h2 id="scan-title">סריקת כניסה חדשה</h2>
          </div>
          <button className="iconButton" onClick={onClose} type="button" aria-label="סגירה">
            <X size={18} />
          </button>
        </div>

        <div className="scannerLayout">
          <div className="scannerBox">
            <div className="scannerBox__header">
              <Camera size={18} />
              <strong>מצלמה</strong>
            </div>
            {scannerError ? <p className="scannerBox__error">{scannerError}</p> : null}
            <div id={elementId} className="scannerTarget" />
          </div>

          <div className="scannerBox">
            <div className="scannerBox__header">
              <Keyboard size={18} />
              <strong>הזנה ידנית</strong>
            </div>
            <label className="field">
              <span>קוד מקום</span>
              <input
                dir="ltr"
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="LOC-1001-XYZ"
                value={manualValue}
              />
            </label>
            <button
              className="button button--primary button--wide"
              onClick={() => onScan(manualValue.trim())}
              type="button"
            >
              שלח קוד
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
