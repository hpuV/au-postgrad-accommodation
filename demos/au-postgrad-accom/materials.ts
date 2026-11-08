import * as THREE from 'three';
import { materials as basePalette, mulberry32, textured } from '../../packages/room-runtime/materials';

/**
 * Room-specific palette. Colors are the scan's baked colors brightened ~1.3× and nudged toward
 * the posed photos (scan colors are darker than true albedo because the lighting is baked in).
 */
let palette: ReturnType<typeof create> | undefined;
const own = new Map<string, THREE.Texture>();
/** Room-specific textures (data/web-assets/au-postgrad-accom/textures); call before ausMaterials(). */
export async function loadAusTextures() {
  const loader = new THREE.TextureLoader();
  await Promise.all(['floor_diff.jpg'].map(async (f) => {
    if (own.has(f)) return;
    const t = await loader.loadAsync(`/au-postgrad-accom/textures/${f}`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    own.set(f, t);
  }));
}
/** Mark a material as a soft furnishing that gets no physics collider (room-physics skipStaticMesh). */
function noCollider<T extends THREE.Material>(m: T) {
  m.userData.noCollider = true;
  return m;
}

export function ausMaterials() {
  palette ??= create();
  return palette;
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

/** 300 mm beige "marble" porcelain tiles with grey grout; diagonal = laid at 45° (kitchen galley) */
function tileTexture(diagonal: boolean, seed: number) {
  const tiles = 4; // tiles per texture repeat
  const size = 1024;
  return canvasTex(size, size, (ctx) => {
    const rand = mulberry32(seed);
    const step = size / tiles;
    ctx.fillStyle = '#6f6a63';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        const x = i * step + 4, y = j * step + 4, s = step - 8;
        const g = ctx.createLinearGradient(x, y, x + s, y + s);
        const base = 214 + Math.floor(rand() * 10);
        g.addColorStop(0, `rgb(${base},${base - 8},${base - 22})`);
        g.addColorStop(1, `rgb(${base - 10},${base - 18},${base - 32})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, s, s);
        // soft clouding, like the printed marble in photos 84/90 and IMG_0599
        for (let k = 0; k < 14; k++) {
          ctx.globalAlpha = 0.06 + rand() * 0.06;
          ctx.fillStyle = rand() < 0.5 ? '#b7a993' : '#f4efe6';
          ctx.beginPath();
          ctx.ellipse(x + rand() * s, y + rand() * s, 10 + rand() * 50, 6 + rand() * 25, rand() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }, diagonal ? [1, 1] : [1, 1]);
}

function blindTexture() {
  // translucent roller-blind fabric: fine horizontal weave, taupe (photos 93, 189, IMG_0212)
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#8b7a73';
    ctx.fillRect(0, 0, 256, 256);
    const rand = mulberry32(11);
    for (let y = 0; y < 256; y += 2) {
      ctx.globalAlpha = 0.08 + rand() * 0.08;
      ctx.fillStyle = rand() < 0.5 ? '#6f625c' : '#a19089';
      ctx.fillRect(0, y, 256, 1);
    }
    ctx.globalAlpha = 1;
  }, [4, 4]);
}

function create() {
  const base = basePalette();
  // laminate: the CC0 set's normal/roughness with a desaturated, lighter color map (light oak, IMG_0212)
  const floorWood = textured({ color: '#f4ece2', set: 'laminate', repeat: 0.45, roughness: 0.6, normalScale: 0.5 });
  const fd = own.get('floor_diff.jpg');
  if (fd) { floorWood.map = fd.clone(); floorWood.map.repeat.set(0.45, 0.45); }
  for (const t of [floorWood.map, floorWood.normalMap, floorWood.roughnessMap]) if (t) t.rotation = Math.PI / 2;

  const kitchenTile = new THREE.MeshStandardMaterial({ map: tileTexture(true, 5), roughness: 0.35, metalness: 0 });
  kitchenTile.map!.repeat.set(1 / 1.2, 1 / 1.2); // 4 tiles of 300 mm per repeat
  kitchenTile.map!.rotation = Math.PI / 4;
  const bathTile = new THREE.MeshStandardMaterial({ map: tileTexture(false, 9), roughness: 0.4 });
  bathTile.map!.repeat.set(1 / 1.2, 1 / 1.2);

  const plaster = (color: string) => {
    const m = base.wall.clone();
    m.color.set(color);
    return m;
  };

  return {
    ...base,
    // bathroom mirror: neutral silver; its reflection is captured inside the bathroom (index.ts)
    mirror: new THREE.MeshStandardMaterial({ color: '#eef1f2', roughness: 0.02, metalness: 1 }),
    wall: plaster('#efece6'),
    wallWarm: plaster('#ece3d3'), // bedroom walls read warmer/creamier (photos 213, 225)
    wallMauve: plaster('#9d8a84'), // bedroom lower west/south walls (photos 219, 228, 243)
    // the photos' ceilings read near-white (phone HDR + downlight spill); the bounce-only ceiling
    // renders dull peach, so it gets a small neutral lift
    ceiling: (() => { const c = plaster('#f3f1ec'); c.emissive.set('#f4f1ea'); c.emissiveIntensity = 0.32; return c; })(),
    trim: new THREE.MeshStandardMaterial({ color: '#f2f0eb', roughness: 0.5, side: THREE.DoubleSide }),
    skirtingTimber: new THREE.MeshStandardMaterial({ color: '#9a5a2e', roughness: 0.55, side: THREE.DoubleSide }),
    floorWood,
    kitchenTile,
    bathTile,
    carpet: textured({ color: '#8c8985', set: 'carpet', repeat: 1.5, normalScale: 1.1 }),
    timber: textured({ color: '#e8c48f', set: 'oak', repeat: 1.2, roughness: 0.6 }),
    pine: textured({ color: '#d9a466', set: 'oak', repeat: 1.5, roughness: 0.55 }),
    pineDark: textured({ color: '#b98048', set: 'oak', repeat: 1.5, roughness: 0.55 }),
    stone: new THREE.MeshStandardMaterial({ color: '#ebe6db', roughness: 0.38 }),
    cabinet: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.22 }),
    whiteMatte: new THREE.MeshStandardMaterial({ color: '#efefec', roughness: 0.6 }),
    appliance: new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c4c6c7', metalness: 0.9, roughness: 0.3 }),
    brushed: new THREE.MeshStandardMaterial({ color: '#b9bcbe', metalness: 0.45, roughness: 0.38 }), // appliance fronts
    stairSteel: new THREE.MeshStandardMaterial({ color: '#4d555c', metalness: 0.35, roughness: 0.55 }),
    darkGrey: new THREE.MeshStandardMaterial({ color: '#3a3d41', roughness: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: '#19191b', roughness: 0.55 }),
    blackGlass: new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.12, metalness: 0.2 }),
    door: new THREE.MeshStandardMaterial({ color: '#45484b', roughness: 0.5 }),
    // blinds are soft: no colliders, so the player walks under the one rolled up over the bedroom slider
    blind: noCollider(new THREE.MeshStandardMaterial({ map: blindTexture(), roughness: 0.95, side: THREE.DoubleSide })),
    blindRail: noCollider(new THREE.MeshStandardMaterial({ color: '#efefec', roughness: 0.6 })),
    blindWhite: noCollider(new THREE.MeshStandardMaterial({ color: '#efebe3', roughness: 0.95, side: THREE.DoubleSide })),
    clearGlass: new THREE.MeshStandardMaterial({ color: '#a9b8bd', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
    // frosted lights read as flat pale panels in the scan and photos (nothing behind them is modelled)
    frostedGlass: new THREE.MeshStandardMaterial({ color: '#e4e7e5', roughness: 0.45, emissive: '#ffffff', emissiveIntensity: 0.12, side: THREE.DoubleSide }),
    outside: new THREE.MeshBasicMaterial({ color: '#2c3036' }), // night: the photos were taken after dark
    sofaFabric: textured({ color: '#5f6368', set: 'linen', repeat: 3, normalScale: 1.4 }),
    blackFabric: textured({ color: '#2a2a2c', set: 'linen', repeat: 3 }),
    bedding: textured({ color: '#9fb0c0', set: 'linen', repeat: 2.5, normalScale: 1.2 }),
    pillowGrey: textured({ color: '#6c6c6e', set: 'linen', repeat: 3 }),
    mattress: textured({ color: '#5d5e60', set: 'linen', repeat: 3 }),
    suitcase: new THREE.MeshStandardMaterial({ color: '#25304f', roughness: 0.35 }),
    cardboard: new THREE.MeshStandardMaterial({ color: '#b98d5f', roughness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: '#c0302b', roughness: 0.6 }),
    orange: new THREE.MeshStandardMaterial({ color: '#e0662a', roughness: 0.6 }),
    downlight: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e8', emissiveIntensity: 2.2 }),
    shade: new THREE.MeshStandardMaterial({ color: '#e8dcc6', roughness: 0.9, emissive: '#ffdca8', emissiveIntensity: 0.6, side: THREE.DoubleSide }),
  };
}

export type AusPalette = ReturnType<typeof ausMaterials>;
