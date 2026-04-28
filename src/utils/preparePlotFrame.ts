import { DataFrame, outerJoinDataFrames, FieldMatcher } from '@grafana/data';

// Define the XYFieldMatchers type locally since it's not publicly exported
export interface XYFieldMatchers {
  x: FieldMatcher;
  y?: FieldMatcher;
}

/**
 * Simplified preparePlotFrame implementation for numeric X-axis support.
 * Based on Grafana's internal preparePlotFrame but using only public APIs.
 *
 * This function aligns multiple frames by their X-axis field (which can be numeric or time).
 */
export function preparePlotFrame(frames: DataFrame[], dimFields: XYFieldMatchers): DataFrame | null | undefined {
  if (!frames || frames.length === 0) {
    return null;
  }

  // If we only have one frame, no need to join
  if (frames.length === 1) {
    return frames[0];
  }

  try {
    // Use outerJoinDataFrames to align frames by the X field
    // This is a public API that does the heavy lifting of frame alignment
    const joined = outerJoinDataFrames({
      frames,
      joinBy: dimFields.x,
      keep: dimFields.y,
      keepOriginIndices: true,
    });

    return joined;
  } catch (error) {
    console.error('Error preparing plot frame:', error);
    return frames[0]; // Fallback to first frame
  }
}
