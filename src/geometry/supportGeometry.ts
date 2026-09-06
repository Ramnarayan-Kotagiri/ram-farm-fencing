import type { FenceConfig } from '../data/scenarios';

/** Feet. Two stays meet one post, with their feet on opposite sides along the fence. */
export function supportDimensions(c: FenceConfig) {
  const length = c.stayLength;
  const exposed = Math.max(0, c.poleLength - c.embed);
  const height = Math.min(exposed, length * Math.sin((c.stayAngle * Math.PI) / 180));
  // Preserve the specified support length when a short main pole limits the attachment height.
  const run = Math.sqrt(Math.max(0, length * length - height * height));
  return { height, run, length };
}
