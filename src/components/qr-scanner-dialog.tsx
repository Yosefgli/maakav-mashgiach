"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, Keyboard, RefreshCw, ScanLine, X } from "lucide-react";

type ScannerInstance = { stop: () => Promise<void> };

export function QrScannerDialog({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const [tab, setTab] = useState<"camera" | "manual">("camera");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<ScannerInstance | null>(null);
  const elementId = useId().replace(/:/g, "_");

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* camera may already be stopped */
      }
      scannerRef.current = null;
    }
    setCameraState("idle");
    setCameraError(null);
  };

  const startCamera = async () => {
    setCameraState("starting");
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode(elementId);
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          onScan(decoded);
        },
        () => undefined,
      );
      scannerRef.current = qr;
      setCameraState("active");
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "לא הצלחנו לגשת למצלמה.",
      );
      setCameraState("error");
    }
  };

  // Stop camera when switching to manual or closing
  useEffect(() => {
    if (tab === "manual" || !open) {
      void stopCamera();
    }
  }, [tab, open]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setManualCode("");
      setTab("camera");
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    void stopCamera();
    onClose();
  };

  return (
    <div className="modalBackdrop" role="presentation" onClick={handleClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal
        aria-labelledby="scan-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__topBar">
          <h2 id="scan-title">סריקת כניסה</h2>
          <button
            className="button button--icon button--ghost"
            onClick={handleClose}
            type="button"
            aria-label="סגירה"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scanTabs" role="tablist">
          <button
            className={`scanTab ${tab === "camera" ? "scanTab--active" : ""}`}
            onClick={() => setTab("camera")}
            role="tab"
            aria-selected={tab === "camera"}
            type="button"
          >
            <Camera size={15} />
            מצלמה
          </button>
          <button
            className={`scanTab ${tab === "manual" ? "scanTab--active" : ""}`}
            onClick={() => setTab("manual")}
            role="tab"
            aria-selected={tab === "manual"}
            type="button"
          >
            <Keyboard size={15} />
            קוד ידני
          </button>
        </div>

        {tab === "camera" && (
          <div className="cameraPanel">
            {/* Scanner renders into this div — always present when camera tab is open */}
            <div
              id={elementId}
              className="cameraFeed"
              style={{ display: cameraState === "active" ? "block" : "none" }}
            />

            {cameraState !== "active" && (
              <div className="cameraInvite">
                {cameraState === "starting" ? (
                  <>
                    <RefreshCw size={36} className="spin cameraInvite__icon" />
                    <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      מפעיל מצלמה...
                    </span>
                  </>
                ) : (
                  <>
                    <ScanLine size={52} className="cameraInvite__icon" />
                    {cameraError ? <p className="cameraError">{cameraError}</p> : null}
                    <button
                      className="button button--primary"
                      onClick={() => void startCamera()}
                      type="button"
                    >
                      <Camera size={15} />
                      הפעל מצלמה
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "manual" && (
          <div className="manualPanel">
            <label className="field">
              <span>קוד מקום</span>
              <input
                autoFocus
                dir="ltr"
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualCode.trim()) {
                    onScan(manualCode.trim());
                  }
                }}
                placeholder="LOC-1001-XYZ"
                type="text"
                value={manualCode}
              />
            </label>
            <button
              className="button button--primary button--wide"
              disabled={!manualCode.trim()}
              onClick={() => onScan(manualCode.trim())}
              type="button"
            >
              שלח קוד
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
