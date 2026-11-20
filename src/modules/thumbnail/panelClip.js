import * as fabric from 'fabric'

/** Clips a speaker to its layout panel (canvas px, fixed to the canvas), or removes the clip. */
export function clipToPanel(img, panel) {
  if (!panel) {
    if (img.clipPath) img.set({ clipPath: undefined })
    return
  }
  img.set({
    clipPath: new fabric.Rect({
      left: panel.x,
      top: panel.y,
      width: panel.width,
      height: panel.height,
      originX: 'left',
      originY: 'top',
      absolutePositioned: true,
    }),
  })
}
