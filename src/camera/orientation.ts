export type DeviceOrientation = 'up' | 'right' | 'down' | 'left' | undefined;

/** PreviewView snapshots already include the display transform. Only correct
 * the remaining device/display difference (for example, rotation lock). */
export const getPreviewRotation = (
  device: DeviceOrientation, display: DeviceOrientation,
): 0 | 90 | 180 | 270 | null => {
  if (!device || !display) return null;
  const degrees = { up: 0, right: 90, down: 180, left: 270 };
  return ((degrees[display] - degrees[device] + 360) % 360) as 0 | 90 | 180 | 270;
};
