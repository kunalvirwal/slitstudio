# Architecture

The central idea is a **continuous material sampled through displaced strips**. A strip does not contain an unrelated gradient: it is a window into the same procedural surface, offset to create sharp discontinuities while preserving a visual rhythm.

## Data flow

```text
Controls / presets / recipe URL / browser storage
                       ↓
            validated recipe (model.js)
                       ↓
         animation-frame scheduler (app.js)
                       ↓
            uniform mapping (renderer.js)
                       ↓
      one full-screen fragment shader (shaders.js)
                       ↓
        live canvas / high-resolution image
```

Every artistic parameter is plain serializable data. Rendering never owns application state. There is one validated recipe, one transient preview mode, and a frozen animation phase. This separation lets the same recipe produce a thumbnail, responsive preview, or 4K export without separate effect implementations.

## Rendering pipeline

1. **Artwork coordinates.** Convert normalized pixel coordinates to an aspect-corrected plane. All geometric effects use this plane so they do not depend on preview resolution.
2. **Strip transform.** Rotate into the cut coordinate system. Compute a strip index and its local coordinate. Shift its longitudinal sample using a wave, cascade, seeded scatter, or alternating pattern. Add seeded irregularity and slight local refraction, then rotate back. This is an inverse mapping, so displaced slices cannot accidentally leave unfilled holes. Explicit gaps have their own mask.
3. **Continuous material.** Rotate by the surface tilt, then warp the coordinate using layered sine waves and smooth value noise. Evaluate a continuous height field. Liquid, silk, chrome, and ripple modes vary the ridge profile. Setting strip displacement to zero reconstructs the continuous sampling pattern; disabling strips also removes their local refraction and edge shading.
4. **Light and gloss.** Estimate the height field's normal using central finite differences. Apply a directional diffuse component and a Blinn-style specular reflection. Gloss controls specular strength and exponent. This is a stylized material model rather than a physically based path tracer. Strip-edge shading and thin highlights suggest depth.
5. **Microtexture.** Frosted glass uses isotropic noise; brushed metal uses strongly anisotropic noise; woven silk uses a crossed micro-pattern. Texture changes both the normal and visible surface detail. A texture amount of zero removes the selected microtexture.
6. **Finish.** Add seeded film grain, a configurable grain size, an elliptical vignette, and sub-LSB dither. Grain coordinates use a fixed virtual long edge so the same recipe has a consistent grain scale across responsive previews and exports. Zero grain removes the film texture while leaving imperceptible anti-banding dither.

The continuous/sliced comparison renders both mappings in one shader, separated by a draggable vertical boundary. Exports always render the actual finished composition without comparison UI.

## Performance and resources

- One full-screen quad and one draw call per frame; no 3D scene graph or per-strip DOM elements.
- On-demand rendering when controls change. Animation is opt-in, uses requestAnimationFrame, caps time jumps, and pauses when the tab is hidden.
- Preview device pixel ratio is capped at 1.75. Exports render directly at the selected native dimensions.
- Six preset thumbnails use one reusable temporary WebGL canvas, copied into ordinary 2D canvases; their contexts are released afterward.
- Export uses a separate temporary context to preserve the live artboard, then releases GPU resources after image encoding.
- Dimensions are validated before allocation, including device maximums and a 36-megapixel memory budget.
- Context loss shows a recovery UI; retry creates a fresh canvas and renderer.

## State and reproducibility

`model.js` is the shared trust boundary. It bounds numeric settings, validates colors/enumerations, drops unknown fields, and rejects invalid recipe versions. URL data is parsed as JSON and never executed or injected as markup. Every random surface detail derives from the seed. Animation's phase is serialized, making a paused frame reproducible. No time-based noise is added during a static render.

Browser localStorage is best effort. Storage failure does not prevent rendering or exports. A shared recipe takes precedence over the local autosave. Copying a recipe uses the Clipboard API with a selectable-link fallback.

## Extending the studio

**New material:** add a material enum in `model.js`, an option in `index.html`, and a profile branch in `heightAt`. Add a preset demonstrating it. The controls, storage, recipes, and export all share the same uniform mapping.

**New displacement:** add the distribution enum and option, then implement its strip-index-to-offset formula in the shader. The inverse-mapping design preserves coverage for every formula.

**New texture:** add the texture enum and option, then define its micro-normal and detail contributions in `materialAt`. Keep its amount at zero neutral.

**Image-based textures:** a future extension can add uploaded image textures and a sampler inside the material stage. Keep strip transformation independent. Recipes would need a portable asset format or explicitly omit local image data from shared URLs. No upload service is needed for local rendering.

**Future per-strip editing:** replace the analytic displacement formula with a uniform array or data texture of per-strip transformations. The rest of the material and finishing pipeline can stay unchanged.

**History and layers:** add undo/redo as immutable recipe snapshots before introducing multiple material layers. A layer stack can later compose multiple field evaluations in the shader; version the recipe format when adding it.

## Build and deployment

The editable code is in `src/`, with the HTML shell at the project root and static assets in `public/`. `npm run build` generates `dist/` by copying the source modules and assets. This intentionally uses native ES modules with no bundler dependency; a future Vite migration can preserve the module boundaries. The Sites manifest points at `dist/`. Generated files are ignored by Git.

The local development server serves the project and blocks hidden paths and tool/test directories. It binds only to 127.0.0.1. Production hosting serves only `dist/`; it requires no Node.js server, database, secrets, or backend APIs.
