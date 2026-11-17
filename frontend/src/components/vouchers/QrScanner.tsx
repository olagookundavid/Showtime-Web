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

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId);
    let handled = false;

    const started = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (handled) return;
          handled = true;
          callbacks.current.onScan(text);
        },
        () => {
          // Fires for every frame with no code in it; nothing to do.
        },
      )
      .then(() => true)
      .catch(() => {
        callbacks.current.onError(
          "We could not open the camera. Allow camera access, or type the code instead.",
        );
        return false;
      });

    return () => {
      void started.then((running) => {
        if (!running) return;
        return scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
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
