/* Shared timing for the sign-in card's side swap, so the panel's slide and
   the effects inside it start and land together. */

/** Password-recovery screens show the card mirrored: form left, brand right. */
export const RECOVERY_PATHS = ["/forgot-password", "/reset-password"];

export const isRecoveryPath = (pathname: string) =>
  RECOVERY_PATHS.some((path) => pathname.startsWith(path));

/** One smooth ease-in-out slide (no spring wobble), slow enough to follow. */
export const SWAP_DURATION = 0.8;
export const SWAP_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];
