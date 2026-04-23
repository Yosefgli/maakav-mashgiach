"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, Keyboard, RefreshCw, ScanLine, X } from "lucide-react";
import type { GpsCoords } from "@/lib/types";

type ScannerInstance = { stop: () => Promise<void> };

export function QrScannerDialog({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string, coords?: GpsCoords) => void;
}) {
  const [tab, setTab] = useState<"camera" | "manual">("camera");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [gpsCoords, setGpsCoords] = useState<GpsCoords | null>(null);
  const scannerRef = useRef<ScannerInstance | null>(null);
  const elementId = useId().replace(/:/g, "_");

  // Collect GPS in background while dialog is open
  useEffect(() => {
    if (!open || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined, // silently ignore GPS errors
      { enableHighAccuracy: true, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [open]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* already stopped */ }
      scannerRef.current = null;
    }
    setCameraState("idle");
  };

  const startCamera = async () => {
    if (scannerRef.current) return;
    setCameraState("starting");
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode(elementId);
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => { onScan(decoded, gpsCoords ?? undefined); },
        () => undefined,
      );
      scannerRef.current = qr;
      setCameraState("active");
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "לא הצלחנו לגשת למצלמה.");
      setCameraState("error");
    }
  };

  // Auto-start camera when dialog opens on camera tab
  useEffect(() => {
    if (open && tab === "camera") {
      void startCamera();
    } else if (!open || tab === "manual") {
      void stopCamera();
    }
  }, [open, tab]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setManualCode("");
      setTab("camera");
      setCameraError(null);
      setGpsCoords(null);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => { void stopCamera(); onClose(); };

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
            <Camera size={15} /> מצלמה
          </button>
          <button
            className={`scanTab ${tab === "manual" ? "scanTab--active" : ""}`}
            onClick={() => setTab("manual")}
            role="tab"
            aria-selected={tab === "manual"}
            type="button"
          >
            <Keyboard size={15} /> קוד ידני
          </button>
        </div>

        {tab === "camera" && (
          <div className="cameraPanel">
            {/*
              The scanner div MUST always be visible (not display:none) so Html5Qrcode
              can measure its dimensions via getBoundingClientRect when start() is called.
              The overlay sits on top and fades away once the camera becomes active.
            */}
            <div id={elementId} className="cameraFeed" />

            {cameraState !== "active" && (
              <div className="cameraOverlay">
                {cameraState === "starting" && (
                  <>
                    <RefreshCw size={32} className="spin" style={{ color: "var(--muted)" }} />
                    <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>מפעיל מצלמה...</span>
                  </>
                )}
                {(cameraState === "idle" || cameraState === "error") && (
                  <>
                    <ScanLine size={48} style={{ color: "var(--muted)", opacity: 0.5 }} />
                    {cameraError && <p className="cameraError">{cameraError}</p>}
                    <button
                      className="button button--primary"
                      onClick={() => void startCamera()}
                      type="button"
                    >
                      <Camera size={15} /> הפעל מצלמה
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
                  if (e.key === "Enter" && manualCode.trim()) onScan(manualCode.trim(), gpsCoords ?? undefined);
                }}
                placeholder="LOC-1001-XYZ"
                type="text"
                value={manualCode}
              />
            </label>
            <button
              className="button button--primary button--wide"
              disabled={!manualCode.trim()}
              onClick={() => onScan(manualCode.trim(), gpsCoords ?? undefined)}
              type="button"
            >
              שלח קוד
            </button>
          </div>
        )}

        {gpsCoords && (
          <p style={{ fontSize: "0.75rem", color: "var(--success)", textAlign: "center" }}>
            ✓ מיקום GPS זמין
          </p>
        )}
      </section>
    </div>
  );
}
