# USYD Postgrad Accommodation

An interactive 3D model of a University of Sydney postgraduate accommodation apartment, built with [Three.js](https://threejs.org/) and viewable in the browser.

The apartment was captured as a LiDAR scan with [3D Scanner App](https://3dscannerapp.com/), then rebuilt by hand as procedural geometry: walls, ceilings, windows, the open steel stair, the kitchen and bathroom fixtures, and the furniture. The scan and photos were used only as measurements and visual reference. They are not part of this repository and are not published.

## What's in the model

- Living and dining area, galley kitchen and entry hall (2.38 m ceiling), with an open steel stair to the upper floor
- Double-height bedroom behind a glazed pine partition (5.10 m ceiling)
- Bathroom with laundry

## Features

- **Dollhouse** view: orbit, pan and zoom around the whole apartment
- **Walk around**: explore at eye level in first person
- **Knolling**: every object laid out neatly side by side
- **Rebuilt / Wireframe**: switch between the textured model and a wireframe of its geometry
- **Camera links**: copy a link that reopens the exact same view
- **Playground**: a physics mode where you can pick up, throw and knock over objects in the room

## Reference

This project is built on [**3D Model Anything**](https://github.com/wesbos/3d-model-anything/tree/main) by [Wes Bos](https://github.com/wesbos). The room viewer, rendering pipeline, physics playground and the scan-to-Three.js workflow all come from that project. This repository keeps only the parts needed to publish this one room:

- Wes's own office model and its assets have been removed.
- The Scan and Overlay views have been removed, because the raw scan is not published. Only Rebuilt and Wireframe remain.
- The room module (`demos/usyd-postgrad-accom/`) is new and specific to this apartment.

The original source code is MIT licensed. See [`LICENSE`](LICENSE), which must be kept with this code. The generic material textures in `data/web-assets/textures/` come from [Poly Haven](https://polyhaven.com/) and [ambientCG](https://ambientcg.com/) (CC0).

## Development

Requires Node.js 22 or later.

```bash
npm install
npm run dev        # http://127.0.0.1:5188/
```

## Build and deploy

The site is fully static. Build it locally, then upload the whole `apps/room-viewer/dist/` folder to any static host.

Hosting at the root of a domain (Cloudflare Pages, Netlify, a custom domain):

```bash
npm run build
```

Hosting under a sub-path, such as GitHub Pages at `https://<user>.github.io/usyd-postgrad-accommodation/`:

```bash
VIEWER_BASE=/usyd-postgrad-accommodation/ npm run build
```

Preview the production build locally:

```bash
npm run preview    # http://localhost:4173/
```

> **Note:** Vite copies everything in `data/web-assets/` into `dist/` as-is. Only put files there that are meant to be public, and check `dist/` before uploading.

## Project structure

| Path | Contents |
|---|---|
| `apps/room-viewer/` | Viewer (`index.html`) and physics playground (`play.html`) |
| `packages/room-runtime/` | Shared rendering, lighting, materials and wall helpers |
| `packages/room-physics/` | Physics, player controller and object interaction (Rapier) |
| `demos/usyd-postgrad-accom/` | The apartment model: shell, fixtures, furniture and materials |
| `data/web-assets/` | Public textures, copied into `dist/` at build time |
