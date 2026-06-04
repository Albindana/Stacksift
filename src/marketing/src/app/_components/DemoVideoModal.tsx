"use client";

import { useRef, useState, type MouseEvent } from "react";

const LOOM_EMBED_URL =
  process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? "";

export default function DemoVideoModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    setIsOpen(true);
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
    setIsOpen(false);
  };

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        data-plausible-event-name="demo-modal-open"
        aria-label="Play the 90-second StackSift demo video"
        className="group flex aspect-video w-full max-w-3xl cursor-pointer items-center justify-center rounded-lg border border-line bg-surface p-4 text-left text-muted hover:text-primary"
      >
        <span className="grid gap-3 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-low text-2xl text-white transition group-hover:scale-105">
            ▶
          </span>
          <span className="text-base font-semibold text-primary">
            Watch StackSift diagnose a real incident
          </span>
          <span className="text-sm text-muted">90-second product demo</span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        onClick={onBackdropClick}
        onClose={() => setIsOpen(false)}
        className="bg-canvas text-primary backdrop:bg-black/70 rounded-lg p-0 max-w-4xl w-[92vw] border border-line"
      >
        <div className="relative aspect-video">
          {isOpen && LOOM_EMBED_URL ? (
            <iframe
              src={LOOM_EMBED_URL}
              title="StackSift 90-second demo"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full rounded-lg"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="text-lg font-semibold">
                  Demo recording is being finalized
                </div>
                <p className="mt-2 max-w-md text-sm text-muted">
                  The page is ready for the embed. Set
                  NEXT_PUBLIC_DEMO_VIDEO_URL to publish the video.
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close demo video"
            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-lg bg-canvas/90 text-2xl text-muted hover:text-primary"
          >
            ×
          </button>
        </div>
      </dialog>
    </>
  );
}
