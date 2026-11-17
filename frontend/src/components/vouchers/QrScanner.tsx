import { useEffect, useId, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  /** Called once with the text of the first QR code read. */
  onScan: (text: string) => void;
  /** Called when the camera cannot start (no camera, or permission refused). */
  onError: (message: string) => void;
}

/** A live camera view that reads one QR code. It stops the camera when it unmounts. */
export const QrScanner = ({ onScan, onError }: QrScannerProps) => {
  // useId gives colons, which html5-qrcode cannot use in an element id.
  const elementId = `qr-${useId().replace(/:/g, "")}`;
  const callbacks = useRef({ onScan, onError });
  useEffect(() => {
    callbacks.current = { onScan, onError };
  });

  // Each camera session waits for the previous one to finish shutting down, so a
  // quick remount (StrictMode in development, or navigating back) never starts a
  // second scanner on the same element while the first is still starting.
  const lastShutdown = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    let handled = false;
    let scanner: Html5Qrcode | null = null;

    const running = lastShutdown.current.then(async () => {
      if (cancelled) return false;
      scanner = new Html5Qrcode(elementId);
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (handled || cancelled) return;
            handled = true;
            callbacks.current.onScan(text);
          },
          () => {
            // Fires for every frame with no code in it; nothing to do.
          },
        );
        return true;
      } catch {
        if (!cancelled) {
          callbacks.current.onError(
            "We could not open the camera. Allow camera access, or type the code instead.",
          );
        }
        return false;
      }
    });

    return () => {
      cancelled = true;
      lastShutdown.current = running.then(async (started) => {
        if (!started || !scanner) return;
        try {
          await scanner.stop();
          scanner.clear();
        } catch {
          // Already stopped.
        }
      });
    };
  }, [elementId]);

  return (
    <div
      id={elementId}
      className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-black"
    />
  );
};
