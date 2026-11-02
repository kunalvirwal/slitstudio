# Slit Studio

A browser-based wallpaper studio inspired by sliced liquid gradients, glossy materials, and analog texture. JavaScript ES modules, native WebGL, and standard HTML/CSS. Mediabunny is loaded on demand for browser-native video encoding and muxing; no server-side rendering or encoding service is needed.

## Run locally

Requires Node.js 20 or newer. Install the locked dependencies once:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**.

```sh
npm run check  # Syntax checks and recipe/export validation tests
npm run build  # Generate dist/ from editable source
npm run preview # Serve the production output
```

## What you can make

- Four continuous materials: liquid gradient, liquid silk, polished chrome, and ripple glass.
- A surface designer with ribbons, radial pools, a spiral vortex, and interference patterns.
- Up to six draggable bend points with independent influence radius and pull strength, plus a draggable pattern center. Points also support arrow keys, Shift for larger steps, and Delete to remove.
- Surface editing undo/redo, flow complexity, turbulence, stretch, band offset, and direct animation phase scrubbing. Dragging phase pauses playback; its value advances visibly during animation.
- Animation phase is shown as an angle in degrees and wraps at 720° (360° for vortex). Animation speed has a slider and an exact numeric multiplier from 0× to 10× (default 1×).
- Fullscreen wallpaper preview fills the display with the artwork. Controls appear near the screen edges and fade away; Esc returns to the editor. Animation, speed, recipe copying, and export are available from its overlay.
- Adjustable liquid flow, surface scale, tilt, three-color palette, and contrast.
- Strips with independent count, length, length variation, cut angle, displacement, irregularity, gaps, and four displacement patterns.
- Adjustable gloss, light direction, and strip depth. Enable **Drag to move light** in Finish to move its light from the preview; this interaction is off by default.
- Truly gapless strips at zero spacing, with a separate edge-shading switch for clean joins.
- Smooth, frosted glass, brushed metal, and woven silk textures, with independent texture strength.
- Film grain, grain size, vignette, and subtle anti-banding dither.
- Sliced, continuous surface, and interactive comparison views.
- Six rendered presets, randomization, deterministic seeds, animation, local autosave, and shareable recipe URLs.
- Desktop, ultrawide, phone, and square compositions. PNG/JPEG exports at Full HD, 4K, or custom dimensions.
- Animated MP4 (H.264, HEVC, AV1) and WebM (VP9, AV1) exports, with exact codec support checked on the visitor's device.
- HD through 8K presets, custom dimensions, 24/30/60/120 fps, three bitrate-based quality levels, and a custom 1–500 Mbps bitrate. Unavailable device/codec combinations are disabled.
- Video speed from 0.05× to 100× and independent start/end phase from 0–720°. Full-cycle mode validates the loop; ping-pong closes arbitrary shorter ranges; one-way clips can also be seamless when their range closes.
- Offline frame-by-frame export uses exact timestamps and excludes the duplicate loop endpoint. A completed video can be watched and downloaded; long exports have progress and cancellation. Direct-to-disk saving is available where the File System Access API is supported.

Custom exports are limited to 8,192px per side, the graphics device's own limits, and 36 megapixels total. The animation pauses at its current phase when exporting or sharing, so the recipe can preserve that frame. The preview controls and comparison divider are never included in exports.

Keyboard shortcuts when the page background has focus: **R** randomizes, **Space** toggles animation, **E** opens export. All controls can also be reached using the keyboard. Tabs support arrow keys, Home, and End.

## Codebase

```text
index.html          Accessible application shell and dialogs
src/
  app.js            Controls, preview orchestration, persistence, and export UI
  surface-editor.js Direct-manipulation editor, bend points, and editing history
  preview.js        Fullscreen wallpaper with auto-hiding edge controls
  video-model.js    Export validation, frame timing, loop sampling, bitrate sizing
  video-renderer.js Shader-to-WebCodecs video encoding and file output
  video-export.js   Shared Image/Video export dialog, capability checks, progress
  model.js          Recipe schema, validation, serialization, export sizing
  presets.js        Curated recipes and palettes
  renderer.js       WebGL context, uniforms, export and resource lifecycle
  shaders.js        Continuous materials → strip transform → lighting → texture/grain
  style.css         Responsive studio interface
public/             Static assets
scripts/
  serve.mjs         Local development/production HTTP server
  build.mjs         Copies application source and public assets into dist/
test/               Recipe and export validation tests
dist/               Generated output; do not edit
.openai/hosting.json Sites deployment configuration
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the rendering model and extension points.

## Privacy and dependencies

All artwork, export, and recipe computation runs on the visitor's device. Recipes are stored in browser localStorage and optionally in links the visitor copies; there is no upload endpoint. Google Fonts is used for typography, with local system fallbacks if unavailable. Browser hardware acceleration/WebGL is required. Video export additionally requires WebCodecs. No API keys are needed.

Mediabunny is bundled into `dist/vendor/` by the build script, with its MPL-2.0 license. Development serves the same installed bundle through a dedicated `/vendor/` route. Rendering targets the existing 8-bit SDR canvas; the exporter does not advertise HDR, higher bit depth, or losslessness that the source cannot provide. Video dimensions are rounded to even pixels for encoder compatibility. In-memory output is bounded; large files should use direct-to-disk saving or smaller settings. Best-supported resolution/codec combinations vary by browser and graphics device.

## Inspiration

[Flowshape](https://flowshape.art/), [Flow Fields](https://evoluteur.github.io/flow-fields/), and [Sangu Wallpaper](https://wallpaper.sanguilmu.com/) inspired the hands-on creative workflow. This application's renderer and UI were written for this project.
