export type DeviceOrientation = 'up' | 'right' | 'down' | 'left' | undefined;

/** Clockwise correction required to make a snapshot upright for inference. */
export const getCanonicalRotation = (orientation: DeviceOrientation): 0 | 90 | 180 | 270 => {
  switch (orientation) {
    case 'right': return 270;
    case 'down': return 180;
    case 'left': return 90;
    default: return 0;
  }
};
