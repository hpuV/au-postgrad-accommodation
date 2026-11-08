import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { WallDef } from '../../packages/room-runtime/walls';
import { box, boxSpan, boxUV, cushion, cylinder, lathe, mesh, place, sphere, tube, type V3 } from '../../packages/room-runtime/helpers';
import { mulberry32 } from '../../packages/room-runtime/materials';
import { FIXED, item, movable, tagged } from './items';
import { ausMaterials } from './materials';
import {
  BATH_DOOR, X_BATH_W, BED_H, BED_W1, BED_GLASS, FRONT_DOOR, H,
  KITCHEN_WINDOW, PARTITION, SOFA_WINDOW, VOID, X_BED, X_E, X_KE, X_P, Z_BATH_MID, Z_BATH_N, Z_BATH_S, Z_HALL_S, Z_KS, Z_N,
  X_PIER_E, Z_PIER, Z_S,
} from './shell';

type Walls = { def: WallDef; group: THREE.Object3D }[];

/** local +x along the wall, +y up, +z into the room */
export function onWall<T extends THREE.Object3D>(obj: T, w: WallDef, u: number, v: number, out = 0): T {
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(w.u, new THREE.Vector3(0, 1, 0), w.n));
  obj.position.copy(w.origin).addScaledVector(w.u, u).add(new THREE.Vector3(0, v, 0)).addScaledVector(w.n, out);
  return obj;
}
const uOf = (w: WallDef, x: number, z: number) => new THREE.Vector3(x, 0, z).sub(w.origin).dot(w.u);
const lbox = (size: V3, c: V3, m: THREE.Material) => box(size, c, m);
/** Aluminium-framed glazing in wall-local coordinates (u0..u1, v0..v1), set `depth` behind the face. */
function glazing(u0: number, u1: number, v0: number, v1: number, depth: number, glass: THREE.Material, frame: THREE.Material, mullions: number[] = [], fw = 0.035) {
  const g = new THREE.Group();
  const w = u1 - u0, h = v1 - v0, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const pane = mesh(new THREE.PlaneGeometry(w, h), glass);
  pane.position.set(cu, cv, -depth);
  pane.castShadow = false;
  g.add(pane);
  g.add(lbox([w, fw, 0.05], [cu, v0 + fw / 2, -depth], frame), lbox([w, fw, 0.05], [cu, v1 - fw / 2, -depth], frame));
  g.add(lbox([fw, h, 0.05], [u0 + fw / 2, cv, -depth], frame), lbox([fw, h, 0.05], [u1 - fw / 2, cv, -depth], frame));
  for (const mu of mullions) g.add(lbox([fw, h, 0.05], [mu, cv, -depth], frame));
  return g;
}

/** Roller blind: cassette at the head, fabric down to `bottom`, bottom bar. */
function blind(u0: number, u1: number, top: number, bottom: number, out: number, fabricMat?: THREE.Material) {
  const m = ausMaterials();
  const g = new THREE.Group();
  const w = u1 - u0, cu = (u0 + u1) / 2;
  g.add(cylinder(0.035, w, [0, 0, 0], m.blindRail, 16));
  g.children[0].rotation.z = Math.PI / 2;
  g.children[0].position.set(cu, top - 0.04, out);
  const fabric = mesh(new THREE.PlaneGeometry(w - 0.02, top - 0.07 - bottom), fabricMat ?? m.blind);
  fabric.position.set(cu, (top - 0.07 + bottom) / 2, out - 0.02);
  g.add(fabric);
  g.add(lbox([w - 0.02, 0.025, 0.015], [cu, bottom, out - 0.02], m.blindRail));
  return g;
}

function lever(m: ReturnType<typeof ausMaterials>) {
  const g = new THREE.Group();
  g.add(cylinder(0.025, 0.012, [0, 0, 0.006], m.steel, 16));
  g.children[0].rotation.x = Math.PI / 2;
  g.add(lbox([0.12, 0.018, 0.018], [-0.05, 0, 0.055], m.steel));
  g.add(lbox([0.016, 0.016, 0.05], [0, 0, 0.03], m.steel));
  return g;
}

export function buildFixtures(walls: Walls, addLight: (l: THREE.Light) => void) {
  const m = ausMaterials();
  const W = (name: string) => walls.find((w) => w.def.name === name)!;
  const free = new THREE.Group();
  free.name = 'fixtures';

  // ---- front door (east wall of the entry hall; photo 33, scan view from the hall) ----
  {
    const w = W('east');
    const u0 = uOf(w.def, X_E, FRONT_DOOR.z0), u1 = uOf(w.def, X_E, FRONT_DOOR.z1);
    const g = new THREE.Group();
    g.add(lbox([u1 - u0 - 0.01, FRONT_DOOR.h - 0.01, 0.045], [(u0 + u1) / 2, FRONT_DOOR.h / 2, -0.03], m.door));
    const h = lever(m);
    h.position.set(u1 - 0.08, 1.02, -0.035);
    h.rotation.y = 0;
    g.add(h);
    // painted architraves
    // painted architraves (the north one is squeezed into the corner)
    for (const [cu, sw] of [[u0 - 0.025, 0.05], [u1 + 0.035, 0.07]] as const) g.add(lbox([sw, FRONT_DOOR.h + 0.07, 0.018], [cu, (FRONT_DOOR.h + 0.07) / 2, 0.009], m.trim));
    g.add(lbox([u1 - u0 + 0.12, 0.07, 0.018], [(u0 + u1) / 2 + 0.01, FRONT_DOOR.h + 0.035, 0.009], m.trim));
    onWall(g, w.def, 0, 0);
    w.group.add(g);
  }

  // ---- bathroom door: white leaf, hinged on the west jamb, open ~113° into the bathroom ----
  {
    const w = W('bath-north');
    const u0 = uOf(w.def, BATH_DOOR.x1, Z_HALL_S), u1 = uOf(w.def, BATH_DOOR.x0, Z_HALL_S);
    const arch = new THREE.Group();
    for (const cu of [u0 - 0.035, u1 + 0.035]) arch.add(lbox([0.07, BATH_DOOR.h + 0.07, 0.018], [cu, (BATH_DOOR.h + 0.07) / 2, 0.009], m.trim));
    arch.add(lbox([u1 - u0 + 0.14, 0.07, 0.018], [(u0 + u1) / 2, BATH_DOOR.h + 0.035, 0.009], m.trim));
    onWall(arch, w.def, 0, 0);
    w.group.add(arch);
    const leafW = BATH_DOOR.x1 - BATH_DOOR.x0 - 0.01;
    const leaf = new THREE.Group();
    leaf.add(lbox([leafW, BATH_DOOR.h - 0.01, 0.035], [leafW / 2, BATH_DOOR.h / 2, 0], m.whiteMatte));
    const k = lever(m);
    k.position.set(leafW - 0.07, 1.0, 0.02);
    leaf.add(k);
    leaf.position.set(BATH_DOOR.x0 + 0.005, 0, Z_BATH_N - 0.02);
    leaf.rotation.y = -THREE.MathUtils.degToRad(113);
    free.add(leaf);
  }

  // ---- living-room window over the sofa (south) with a taupe roller blind ----
  {
    const w = W('south');
    const s0 = uOf(w.def, SOFA_WINDOW.x1, Z_S), s1 = uOf(w.def, SOFA_WINDOW.x0, Z_S);
    const g = new THREE.Group();
    g.add(glazing(s0, s1, SOFA_WINDOW.v0, SOFA_WINDOW.v1, 0.12, m.outside, m.whiteMatte, [(s0 + s1) / 2]));
    g.add(lbox([s1 - s0 + 0.02, 0.02, 0.14], [(s0 + s1) / 2, SOFA_WINDOW.v0 - 0.01, -0.06], m.trim));
    g.add(blind(s0 - 0.04, s1 + 0.04, SOFA_WINDOW.v1 + 0.07, 1.06, 0.06));
    onWall(g, w.def, 0, 0);
    w.group.add(g);
  }

  // ---- kitchen window over the back counter, blind half down (IMG_0211, photo 93) ----
  {
    const w = W('kitchen-south');
    const u0 = uOf(w.def, KITCHEN_WINDOW.x1, Z_KS), u1 = uOf(w.def, KITCHEN_WINDOW.x0, Z_KS);
    const g = new THREE.Group();
    g.add(glazing(u0, u1, KITCHEN_WINDOW.v0, KITCHEN_WINDOW.v1, 0.12, m.outside, m.whiteMatte, [(u0 + u1) / 2]));
    g.add(blind(u0 - 0.01, u1 + 0.01, KITCHEN_WINDOW.v1 + 0.03, 1.22, 0.05));
    onWall(g, w.def, 0, 0);
    w.group.add(g);
  }

  // ---- bedroom: high windows (night-dark glass) ----
  {
    // the south and the skewed west walls are glass walls (owner): 2 columns × 2 rows, the white
    // frame section and 12 cm setback of the original windows; taupe blinds (as in the living
    // room) drawn fully down over the two lower panes, the upper panes uncovered
    for (const name of ['bed-south', 'bed-west'] as const) {
      const w = W(name);
      const G = BED_GLASS;
      const [uA, uB] = G[name], uM = (uA + uB) / 2;
      const gs = new THREE.Group();
      for (const [u0, u1] of [[uA, uM], [uM, uB]]) {
        gs.add(glazing(u0, u1, 0, G.vMid, 0.12, m.outside, m.whiteMatte));
        gs.add(glazing(u0, u1, G.vMid, G.v1, 0.12, m.outside, m.whiteMatte));
        gs.add(blind(u0 + 0.005, u1 - 0.005, G.vMid, 0.02, -0.12 + 0.045));
      }
      // carpet runs into the reveal under the floor-length glass (the wall is 0.2 deep)
      const floor = mesh(boxUV(new THREE.PlaneGeometry(uB - uA, w.def.thickness).rotateX(-Math.PI / 2)), m.carpet);
      floor.position.set((uA + uB) / 2, 0.001, -w.def.thickness / 2);
      floor.castShadow = false;
      gs.add(floor);
      onWall(gs, w.def, 0, 0);
      w.group.add(gs);
    }
    // masonry pier on the west wall (scan: x −6.48 → −6.21, z −1.05 … −0.55)
    const n = W('bed-west-n');
    n.group.add(boxSpan([BED_W1, 0, -1.05], [-6.21, BED_H, -0.55], m.wallWarm));
  }

  // ---- glazed timber partition between the bedroom and the living room ----
  {
    const w = W('partition');
    const P_ = PARTITION;
    const g = new THREE.Group();
    const at = (z: number) => uOf(w.def, X_P, z);
    const depth = X_P - X_BED - 0.05; // rear track; the front track is 5 cm nearer the living room
    // two sliding leaves per section, on two tracks (front leaf nearer the living room), 4 cm overlap
    const leaf = (z0: number, z1: number, glass: THREE.Material, front: boolean) =>
      g.add(glazing(at(z1), at(z0), 0.01, P_.low - 0.01, front ? depth - 0.05 : depth, glass, m.timber, [], 0.055));
    const nMid = (P_.north.z0 + P_.north.z1) / 2;
    // same clear glass as the south pair, just closed; the blind behind them is down (owner)
    leaf(P_.north.z0, nMid + 0.02, m.clearGlass, false);
    leaf(nMid - 0.02, P_.north.z1, m.clearGlass, true);
    // slim pine post between the two pairs, the same section as the leaf stiles
    g.add(lbox([at(P_.north.z1) - at(P_.south.z0), P_.low, 0.11], [(at(P_.north.z1) + at(P_.south.z0)) / 2, P_.low / 2, -depth + 0.025], m.timber));
    // south: the front leaf is slid over the fixed one, leaving the walk-in gap beside the desk
    const sw = (P_.south.z1 - P_.south.z0) / 2 + 0.02;
    leaf(P_.south.z1 - sw, P_.south.z1, m.clearGlass, false);
    leaf(P_.gap.z1, P_.gap.z1 + sw, m.clearGlass, true);
    g.add(lbox([0.012, 0.32, 0.02], [at(P_.gap.z1) - 0.04, 1.05, -depth + 0.1], m.steel)); // pull
    // upper: 2 rows × 4 lights whose columns line up with the four sliding panels below, in the
    // same 55 mm pine section, clear glass; the post carries on up between the pairs (owner)
    const sMid = (P_.south.z0 + P_.south.z1) / 2;
    const vMid = (P_.upper.v0 + P_.upper.v1) / 2;
    for (const [z0, z1] of [[P_.north.z0, nMid], [nMid, P_.north.z1], [P_.south.z0, sMid], [sMid, P_.south.z1]])
      for (const [v0, v1] of [[P_.upper.v0, vMid], [vMid, P_.upper.v1]])
        g.add(glazing(at(z1), at(z0), v0, v1, depth, m.clearGlass, m.timber, [], 0.055));
    g.add(lbox([at(P_.north.z1) - at(P_.south.z0), P_.upper.v1 - P_.upper.v0, 0.11], [(at(P_.north.z1) + at(P_.south.z0)) / 2, vMid, -depth + 0.025], m.timber));
    onWall(g, w.def, 0, 0);
    w.group.add(g);
    // taupe blinds on the living-room side, right against the front sliding leaf (owner): fully down
    // over the closed pair, rolled up to ≈ 1.72 over the slider (ortho view w, photos 189, 252).
    // Front leaf face is at out ≈ −0.025; the fabric hangs 2.5 cm in front of it.
    const out = -(depth - 0.05 - 0.025) + 0.045;
    const bl = blind(at(P_.south.z0) + 0.005, at(P_.north.z0) - 0.005, P_.low, 0.02, out);
    const bs = blind(at(P_.south.z1) + 0.005, at(P_.south.z0) - 0.005, P_.low, 1.72, out);
    // white roller blinds behind the upper lights, same widths and fittings as the ones below (owner)
    w.group.add(onWall(blind(at(P_.south.z0) + 0.005, at(P_.north.z0) - 0.005, P_.upper.v1, P_.upper.v0 + 0.01, out, m.blindWhite), w.def, 0, 0));
    w.group.add(onWall(blind(at(P_.south.z1) + 0.005, at(P_.south.z0) - 0.005, P_.upper.v1, P_.upper.v0 + 0.01, out, m.blindWhite), w.def, 0, 0));
    onWall(bl, w.def, 0, 0);
    onWall(bs, w.def, 0, 0);
    w.group.add(bl, bs);
  }

  // ---- split-system air conditioner on the pier (scan: x 0.1 … 1.2, y 1.95 … 2.25) ----
  {
    const w = W('pier-south');
    const g = new THREE.Group();
    const body = mesh(new RoundedBoxGeometry(1.0, 0.3, 0.22, 3, 0.05), m.appliance);
    body.position.set(0, 0, 0.11);
    g.add(body, lbox([0.9, 0.02, 0.02], [0, -0.13, 0.215], m.whiteMatte));
    onWall(g, w.def, uOf(w.def, 0.65, Z_PIER), 2.07);
    w.group.add(tagged(g, 'air-conditioner', FIXED));
  }

  free.add(tagged(stair(), 'stair', FIXED), kitchen(), bathroom(), ...shoeRack());

  // ---- ceiling downlights (positions from the bright spots in the scan's ceiling / photos) ----
  const pots: [number, number, number][] = [
    [-2.35, H, -1.35], [-2.35, H, 1.25], [-0.6, H, -1.35], [-0.6, H, 1.25], [1.05, H, -0.8], [1.05, H, 0.9],
    [2.65, H, -0.35], [2.65, H, 1.2], [4.8, H, -1.95], [4.8, 2.28, -0.3], [4.8, 2.12, 1.25],
  ];
  const discs = new THREE.Group();
  discs.name = 'downlights';
  for (const [x, y, z] of pots) {
    const d = cylinder(0.05, 0.008, [x, y - 0.004, z], m.downlight, 24);
    d.castShadow = false;
    discs.add(d);
    discs.add(cylinder(0.062, 0.006, [x, y - 0.002, z], m.trim, 24));
  }
  const shadowed = new Set([1, 3, 6]);
  pots.forEach(([x, y, z], i) => {
    if (![0, 1, 2, 3, 4, 6, 7, 8, 9, 10].includes(i)) return;
    const s = new THREE.SpotLight('#fff1dc', 14, 0, THREE.MathUtils.degToRad(70), 1, 2);
    s.position.set(x, y - 0.02, z);
    s.target.position.set(x, 0, z);
    if (shadowed.has(i)) {
      s.castShadow = true;
      s.shadow.mapSize.set(1024, 1024);
      s.shadow.bias = -0.0005;
      s.shadow.normalBias = 0.02;
      s.shadow.camera.near = 0.05;
      s.shadow.camera.far = 6;
    }
    addLight(s);
    addLight(s.target as unknown as THREE.Light);
  });
  // bedroom: a lamp glow near the partition (scan) and the high ceiling light
  const bedLight = new THREE.PointLight('#ffe0b8', 6, 0, 2);
  bedLight.position.set(-5.0, 4.6, 0.4);
  addLight(bedLight);
  free.add(discs);
  return free;
}

// ---------------------------------------------------------------------------------------------
// Open steel stair along the north wall: 14 perforated treads, rise ≈ 0.1725, going ≈ 0.262,
// first tread top at 0.15 (x ≈ 4.12), arriving at the upper floor (≈ 2.56) at x ≈ 0.55.
// Treads measured from up-facing scan surfaces (y 0.15, 0.67, 0.84, 1.01, 1.19, 1.37, 1.53, 2.03).
// ---------------------------------------------------------------------------------------------
export const STAIR = { x0: 4.12, rise: 0.1725, going: 0.262, y0: 0.15, n: 14, z0: Z_N + 0.02, z1: -1.99 };
function stair() {
  const m = ausMaterials();
  const g = new THREE.Group();
  g.name = 'stair';
  const S = STAIR;
  const width = S.z1 - S.z0;
  const zc = (S.z0 + S.z1) / 2;
  for (let k = 0; k < S.n; k++) {
    const y = S.y0 + S.rise * k;
    const x = S.x0 - S.going * k;
    g.add(box([0.28, 0.035, width - 0.04], [x, y - 0.0175, zc], m.stairSteel));
    g.add(box([0.02, 0.05, width - 0.04], [x - 0.13, y - 0.035, zc], m.stairSteel)); // nosing lip
  }
  // stringers: steel plates along the pitch, both sides
  const xTop = S.x0 - S.going * (S.n - 1) - 0.25, yTop = S.y0 + S.rise * S.n;
  const xBot = S.x0 + 0.2;
  const len = Math.hypot(xBot - xTop, yTop);
  const pitch = Math.atan2(yTop, xBot - xTop);
  for (const z of [S.z0 + 0.01, S.z1 - 0.01]) {
    const s = box([len, 0.24, 0.012], [0, 0, 0], m.stairSteel);
    s.position.set((xBot + xTop) / 2, yTop / 2 - 0.06, z);
    s.rotation.z = -pitch;
    g.add(s);
  }
  // white timber balustrade on the open (south) side: rails parallel to the pitch + pickets
  const rail = (yOff: number, h: number, d: number) => {
    const r = box([len + 0.05, h, d], [0, 0, 0], m.trim);
    r.position.set((xBot + xTop) / 2, yTop / 2 + yOff, S.z1 + 0.035);
    r.rotation.z = -pitch;
    return r;
  };
  g.add(rail(0.95, 0.06, 0.07), rail(0.12, 0.05, 0.05));
  const tan = yTop / (xBot - xTop);
  for (let x = xTop + 0.12; x < xBot - 0.05; x += 0.13) {
    const yb = (xBot - x) * tan; // pitch line
    g.add(box([0.045, 0.82, 0.03], [x, yb + 0.12 + 0.41 - 0.06, S.z1 + 0.035], m.trim));
  }
  // newel at the bottom and the grey steel column at the open side (scan + photo 51)
  g.add(box([0.08, 1.05, 0.08], [xBot + 0.02, 0.525, S.z1 + 0.035], m.trim));
  g.add(box([0.09, H, 0.09], [1.25, H / 2, S.z1 + 0.05], m.stairSteel));
  // upper-floor slab edge the stair lands on
  g.add(boxSpan([VOID.x0 - 0.3, H, Z_N], [VOID.x0, yTop, VOID.z1], m.ceiling));
  return g;
}

// ---------------------------------------------------------------------------------------------
// Galley kitchen: peninsula with the double sink (x 1.50 … 2.24), tiled galley, cooktop run on the
// east wall (front x ≈ 3.02), fridge at its north end, L-return under the window.
// ---------------------------------------------------------------------------------------------
function kitchen() {
  const m = ausMaterials();
  const g = new THREE.Group();
  g.name = 'kitchen';
  const TOP = 0.91;
  /** base cabinets in room coordinates: carcass, recessed kick, stone top, door reveals + bar handles */
  const base = (x0: number, x1: number, z0: number, z1: number, doorsFace: '+x' | '-x' | '-z') => {
    const c: THREE.Object3D[] = [
      boxSpan([x0 + 0.02, 0.1, z0 + 0.02], [x1 - 0.02, TOP - 0.03, z1 - 0.02], m.cabinet),
      boxSpan([x0 + 0.06, 0, z0 + 0.06], [x1 - 0.06, 0.1, z1 - 0.06], m.steel),
      boxSpan([x0, TOP - 0.03, z0], [x1, TOP, z1], m.stone),
    ];
    if (doorsFace !== '-z') {
      const fx = doorsFace === '+x' ? x1 - 0.02 : x0 + 0.02;
      const s = doorsFace === '+x' ? 1 : -1;
      const n = Math.max(1, Math.round((z1 - z0) / 0.45));
      for (let i = 0; i <= n; i++) {
        const z = z0 + ((z1 - z0) * i) / n;
        c.push(box([0.004, TOP - 0.13, 0.004], [fx + s * 0.002, 0.1 + (TOP - 0.13) / 2, z], m.darkGrey));
        if (i < n) c.push(box([0.02, 0.012, 0.14], [fx + s * 0.02, TOP - 0.12, z + (z1 - z0) / n / 2], m.steel));
      }
    }
    return c;
  };
  // peninsula: cabinets open to the galley, plain panel to the living room, double-bowl sink inset in
  // the stone top (IMG_0601, photos 98–102). The carcass drops under the sink so the bowls are real.
  const SINK = { x0: 1.62, x1: 2.12, z0: 0.82, z1: 1.72 };
  const [, kick, , ...doors] = base(1.5, 2.24, -0.66, 2.18, '+x');
  const stone = new THREE.Shape();
  stone.moveTo(1.5, -0.66); stone.lineTo(2.24, -0.66); stone.lineTo(2.24, 2.18); stone.lineTo(1.5, 2.18); stone.closePath();
  stone.holes.push(roundRect(new THREE.Path(), (SINK.x0 + SINK.x1) / 2, (SINK.z0 + SINK.z1) / 2, SINK.x1 - SINK.x0 - 0.04, SINK.z1 - SINK.z0 - 0.04, 0.01));
  const under = TOP - 0.21;
  g.add(item('kitchen-peninsula', FIXED,
    boxSpan([1.52, 0.1, -0.64], [2.22, TOP - 0.03, SINK.z0 + 0.02], m.cabinet),
    boxSpan([1.52, 0.1, SINK.z0 + 0.02], [2.22, under, SINK.z1 - 0.02], m.cabinet),
    boxSpan([1.52, 0.1, SINK.z1 - 0.02], [2.22, TOP - 0.03, 2.16], m.cabinet),
    boxSpan([2.2, under, SINK.z0 + 0.02], [2.22, TOP - 0.03, SINK.z1 - 0.02], m.cabinet), // door tops in front of the bowls
    boxSpan([1.52, under, SINK.z0 + 0.02], [1.54, TOP - 0.03, SINK.z1 - 0.02], m.cabinet), // living-room panel
    kick, slab(stone, TOP, 0.03, m.stone), ...doors,
    doubleSink(TOP, SINK, [[1.87, 1.05], [1.87, 1.47]])));
  // the dish rack stands on the counter beside the sink, north of it (owner)
  g.add(tagged(place(dishRack(), [1.87, TOP, 0.82 - 0.02 - 0.23]), 'dish-rack', movable(1.5, 'metal', 'compound')));
  // built-in stainless dishwasher in the galley side, north of the sink (photos 87, 101)
  g.add(item('dishwasher', FIXED, place(dishwasherFront(0.6, TOP - 0.03), [2.215, 0, 0.48], Math.PI / 2)));
  // east run (IMG_0599, owner): a wide three-drawer stack from the north end right up to the oven,
  // with the sauces and seasonings on top; the oven under the ceramic cooktop in the middle of the run,
  // two doors to the south wall, and the coffee machine + air fryer in the corner by the window
  const EAST = { z0: -0.12, z1: Z_KS };
  const OVEN = { z0: 0.94, z1: 1.54 };
  const fx = 3.04; // front face of the carcass
  const fronts: THREE.Object3D[] = [];
  const reveal = (z: number, y0 = 0.1, y1 = TOP - 0.03) => fronts.push(box([0.004, y1 - y0, 0.004], [fx - 0.002, (y0 + y1) / 2, z], m.darkGrey));
  const hReveal = (y: number, z0: number, z1: number) => fronts.push(box([0.004, 0.004, z1 - z0], [fx - 0.002, y, (z0 + z1) / 2], m.darkGrey));
  // drawers: three equal fronts, a long bar handle on each
  const DR = { z0: EAST.z0, z1: OVEN.z0 };
  const dy = (TOP - 0.03 - 0.1) / 3;
  for (let i = 0; i < 3; i++) {
    const yTop = 0.1 + dy * (i + 1);
    if (i < 2) hReveal(yTop, DR.z0, DR.z1);
    fronts.push(box([0.02, 0.014, 0.5], [fx - 0.02, yTop - 0.06, (DR.z0 + DR.z1) / 2], m.steel));
  }
  // doors either side of the oven, short bar handles near the top
  for (const z of [OVEN.z0, OVEN.z1, (OVEN.z1 + EAST.z1) / 2]) reveal(z);
  for (const [z0, z1] of [[OVEN.z1, (OVEN.z1 + EAST.z1) / 2], [(OVEN.z1 + EAST.z1) / 2, EAST.z1]]) {
    fronts.push(box([0.02, 0.012, 0.14], [fx - 0.02, TOP - 0.12, (z0 + z1) / 2], m.steel));
  }
  g.add(item('kitchen-cooktop-bench', FIXED, ...base(3.02, X_KE, EAST.z0, EAST.z1, '-z'), ...fronts));
  g.add(item('oven', FIXED, place(builtInOven(OVEN.z1 - OVEN.z0, TOP - 0.13), [fx, 0.1, (OVEN.z0 + OVEN.z1) / 2], -Math.PI / 2)));
  g.add(item('cooktop', FIXED, place(ceramicCooktop(), [3.32, TOP, (OVEN.z0 + OVEN.z1) / 2], -Math.PI / 2)));
  g.add(...sauceCorner(TOP, DR.z0, DR.z1));
  g.add(tagged(place(coffeeMachine(), [3.44, TOP, 2.36], -Math.PI / 2), 'coffee-machine', movable(4, 'plastic', 'box')));
  g.add(tagged(place(airFryer(), [3.28, TOP, 2.02], -Math.PI / 2 + 0.15), 'air-fryer', movable(4.5, 'plastic', 'box')));
  // the peninsula runs on to the south wall between the pier (x 1.75) and the galley (scan); the galley
  // floor between the two runs is open to the wall under the window (owner)
  g.add(item('kitchen-peninsula-end', FIXED, ...base(X_PIER_E, 2.24, 2.18, Z_KS, '+x')));
  // fridge (white two-door, IMG_0211) + cupboard above it to the ceiling
  g.add(item('fridge', FIXED,
    boxSpan([2.96, 0, -0.88], [X_KE - 0.03, 1.74, -0.14], m.appliance),
    box([0.004, 0.004, 0.72], [2.958, 1.12, -0.51], m.darkGrey),
    ...[0.85, 1.35].map((y) => box([0.03, 0.22, 0.02], [2.94, y, -0.2], m.whiteMatte))));
  g.add(item('fridge-cupboard', FIXED, boxSpan([3.0, 1.78, -0.9], [X_KE, H, -0.12], m.cabinet)));
  // upper cupboards along the east wall (scan y 1.51 … 2.29), running on to just short of the window
  // blind (owner), with the slim slide-out rangehood over the cooktop
  const UZ1 = Z_KS - 0.1, nU = Math.round((UZ1 + 0.12) / 0.45), dU = (UZ1 + 0.12) / nU;
  const uppers: THREE.Object3D[] = [boxSpan([3.27, 1.5, -0.12], [X_KE, 2.2, UZ1], m.cabinet)];
  for (let i = 0; i <= nU; i++) uppers.push(box([0.004, 0.7, 0.004], [3.268, 1.85, -0.12 + i * dU], m.darkGrey));
  for (let i = 0; i < nU; i++) uppers.push(box([0.02, 0.14, 0.012], [3.255, 1.6, -0.12 + i * dU + (i % 2 ? 0.05 : dU - 0.05)], m.steel));
  g.add(item('upper-cupboards', FIXED, ...uppers));
  g.add(item('rangehood', FIXED, boxSpan([3.2, 1.43, OVEN.z0], [X_KE, 1.5, OVEN.z1], m.steel), boxSpan([3.19, 1.425, OVEN.z0], [3.205, 1.47, OVEN.z1], m.steel)));
  // white gloss splashback tiles behind the counters (architecture: untagged)
  const splash = boxSpan([X_KE - 0.008, TOP, -0.12], [X_KE, 1.5, 2.6], m.cabinet);
  splash.name = 'kitchen-splashback';
  g.add(splash);
  // IKEA HÅLLBAR bin at the end of the galley, long side against the wall under the window (owner;
  // scan x 2.47 … 2.80); the white microwave on the peninsula's south end with its back to the pier
  // wall, door to the galley (photos 94–95), the silver kettle on its non-window side (owner)
  g.add(tagged(place(hallbarBin(), [2.63, 0, Z_KS - 0.126 - 0.006], Math.PI / 2), 'hallbar-bin', movable(1.2, 'plastic', 'container')));
  g.add(tagged(place(microwave(), [X_PIER_E + 0.01 + 0.185, TOP, 2.34], Math.PI / 2), 'microwave', movable(12, 'metal', 'box')));
  g.add(tagged(place(silverKettle(), [1.93, TOP, 1.93], 0.4), 'silver-kettle', movable(1, 'metal', 'cylinder')));
  // clear Brita filter jug beside the kettle, toward the living-room edge (owner; photos 96, 176)
  g.add(tagged(place(britaJug(), [1.66, TOP, 2.03], Math.PI / 2 + 0.2), 'brita-jug', movable(1.5, 'plastic', 'container')));
  return g;
}

// ---- kitchen detail pieces (owner + photos 94–102) -----------------------------------------------

/** Rounded rectangle path in the shape's (x, y) plane, centred on (cx, cy). */
function roundRect(path: THREE.Path, cx: number, cy: number, w: number, h: number, r: number) {
  const x0 = cx - w / 2, y0 = cy - h / 2;
  path.moveTo(x0 + r, y0);
  path.lineTo(x0 + w - r, y0); path.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  path.lineTo(x0 + w, y0 + h - r); path.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  path.lineTo(x0 + r, y0 + h); path.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}

/** Flat slab in the x–z plane from a shape drawn with shape-x = world x, shape-y = world z; top at y. */
function slab(shape: THREE.Shape, y: number, thick: number, mat: THREE.Material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(Math.PI / 2); // shape y → world z, extrusion → −y
  geo.translate(0, y, 0);
  boxUV(geo);
  const s = mesh(geo, mat);
  s.receiveShadow = true;
  return s;
}

/**
 * Double-bowl stainless sink inset in the peninsula (photos 98–100): a brushed flange with two deep,
 * round-cornered bowls, strainer drains, and a chrome single-lever mixer with a swan-neck spout behind
 * them. `bowls` are the bowl centres (x, z); the flange spans `f`.
 */
function doubleSink(top: number, f: { x0: number; x1: number; z0: number; z1: number }, bowls: [number, number][]) {
  const steel = new THREE.MeshStandardMaterial({ color: '#e4e7e9', roughness: 0.32, metalness: 0.6, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.5, metalness: 0.4 });
  const BW = 0.37, BD = 0.36, R = 0.05, DEPTH = 0.19;
  const g = new THREE.Group();
  const flange = new THREE.Shape();
  roundRect(flange, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, f.x1 - f.x0, f.z1 - f.z0, 0.02);
  for (const [bx, bz] of bowls) flange.holes.push(roundRect(new THREE.Path(), bx, bz, BW, BD, R));
  g.add(slab(flange, top + 0.004, 0.004, steel));
  for (const [bx, bz] of bowls) {
    const ring = new THREE.Shape();
    roundRect(ring, bx, bz, BW, BD, R);
    ring.holes.push(roundRect(new THREE.Path(), bx, bz, BW - 0.003, BD - 0.003, R - 0.0015));
    g.add(slab(ring, top, DEPTH, steel)); // thin walls
    const floor = new THREE.Shape();
    roundRect(floor, bx, bz, BW, BD, R);
    g.add(slab(floor, top - DEPTH, 0.003, steel));
    g.add(cylinder(0.045, 0.004, [bx, top - DEPTH + 0.002, bz], steel, 24));
    g.add(cylinder(0.03, 0.005, [bx, top - DEPTH + 0.002, bz], dark, 20));
    for (let i = 0; i < 6; i++) g.add(box([0.003, 0.006, 0.05], [bx, top - DEPTH + 0.003, bz], steel).rotateY((i * Math.PI) / 6));
  }
  // chrome mixer behind the bowls: round base, swan-neck spout over the bowl gap, lever on top
  const chrome = new THREE.MeshStandardMaterial({ color: '#e1e3e5', roughness: 0.08, metalness: 1 });
  const tx = f.x0 + 0.04, tz = (bowls[0][1] + bowls[1][1]) / 2;
  g.add(cylinder(0.028, 0.012, [tx, top + 0.01, tz], chrome, 20));
  g.add(cylinder(0.022, 0.15, [tx, top + 0.09, tz], chrome, 20));
  g.add(tube([[tx, top + 0.16, tz], [tx + 0.01, top + 0.24, tz], [tx + 0.07, top + 0.27, tz], [tx + 0.15, top + 0.22, tz], [tx + 0.17, top + 0.17, tz]], 0.011, chrome, 32));
  const lever = tube([[tx, top + 0.165, tz], [tx - 0.02, top + 0.2, tz + 0.01], [tx - 0.07, top + 0.21, tz + 0.02]], 0.006, chrome, 12);
  g.add(lever);
  return g;
}

/** White wire dish rack with a yellow sponge in it (owner; photos 101–102). */
function dishRack() {
  const wire = new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.35, metalness: 0.3 });
  const g = new THREE.Group();
  const W = 0.36, D = 0.46, H = 0.13, r = 0.003;
  for (const y of [0.01, H]) {
    g.add(tube([[-W / 2, y, -D / 2], [W / 2, y, -D / 2]], r, wire, 2), tube([[-W / 2, y, D / 2], [W / 2, y, D / 2]], r, wire, 2));
    g.add(tube([[-W / 2, y, -D / 2], [-W / 2, y, D / 2]], r, wire, 2), tube([[W / 2, y, -D / 2], [W / 2, y, D / 2]], r, wire, 2));
  }
  for (let i = 0; i <= 12; i++) {
    const z = -D / 2 + (i * D) / 12;
    g.add(tube([[-W / 2, 0.01, z], [W / 2, 0.01, z]], r * 0.8, wire, 2));
    g.add(tube([[W / 2, 0.01, z], [W / 2, H, z]], r * 0.8, wire, 2), tube([[-W / 2, 0.01, z], [-W / 2, H, z]], r * 0.8, wire, 2));
    if (i % 2 === 0) g.add(tube([[0, 0.01, z], [0, 0.09, z]], r * 0.8, wire, 2)); // plate tines
  }
  // sponge lying on the rack floor, clear of the side wires (x ±0.18, z ±0.23) and the centre tines
  g.add(tagged(cushion([0.07, 0.03, 0.1], [0.09, 0.03, 0.14], 0.01, new THREE.MeshStandardMaterial({ color: '#f2d33a', roughness: 0.9 })), 'sponge', movable(0.02, 'soft'))); // its own item: picks up apart from the rack
  return g;
}

/** White countertop microwave (photos 94–95): black glass door, black control panel with display and keypad, vented top. Local: door +z. */
function microwave() {
  const white = new THREE.MeshStandardMaterial({ color: '#f3f3f1', roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.12, metalness: 0.3 });
  const grey = new THREE.MeshStandardMaterial({ color: '#8c9095', roughness: 0.4 });
  const W = 0.48, H = 0.28, D = 0.37;
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(W, H, D, 3, 0.012), white), [0, H / 2 + 0.01, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cylinder(0.012, 0.01, [sx * (W / 2 - 0.05), 0.005, sz * (D / 2 - 0.05)], grey, 10));
  // door: black glass window framed in white, the panel on the right
  g.add(box([0.33, 0.21, 0.004], [-0.06, 0.15, D / 2 + 0.002], glass));
  g.add(box([0.08, 0.22, 0.004], [W / 2 - 0.055, 0.15, D / 2 + 0.002], glass));
  g.add(box([0.06, 0.02, 0.001], [W / 2 - 0.055, 0.235, D / 2 + 0.005], new THREE.MeshStandardMaterial({ color: '#2f7fd6', emissive: '#1d4f8a', emissiveIntensity: 0.6 })));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(box([0.014, 0.01, 0.002], [W / 2 - 0.075 + j * 0.02, 0.2 - i * 0.022, D / 2 + 0.005], grey));
  g.add(cylinder(0.016, 0.01, [W / 2 - 0.055, 0.085, D / 2 + 0.006], grey, 16).rotateX(Math.PI / 2));
  // vent grilles on the top (photo 95: four slotted panels)
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) g.add(box([0.05, 0.002, 0.006], [-0.15 + k * 0.08, H + 0.011, -0.08 + i * 0.016], glass));
  return g;
}

/** Brushed-steel electric jug kettle on its black power base (owner: silver kettle beside the microwave). */
function silverKettle() {
  const steel = new THREE.MeshStandardMaterial({ color: '#c8cbcd', roughness: 0.2, metalness: 0.95 });
  const black = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.4 });
  const g = new THREE.Group();
  g.add(cylinder(0.085, 0.02, [0, 0.01, 0], black, 28));
  g.add(lathe([[0.001, 0.02], [0.08, 0.02], [0.082, 0.04], [0.072, 0.2], [0.06, 0.22], [0.001, 0.22]], steel, 32));
  g.add(cylinder(0.05, 0.012, [0, 0.226, 0], black, 24));
  g.add(sphere(1, [0, 0.238, 0], black, [0.015, 0.008, 0.015]));
  // spout and the black loop handle
  g.add(tube([[0.07, 0.19, 0], [0.1, 0.21, 0], [0.12, 0.225, 0]], 0.012, steel, 8));
  g.add(tube([[-0.07, 0.05, 0], [-0.12, 0.08, 0], [-0.125, 0.18, 0], [-0.065, 0.215, 0]], 0.014, black, 16));
  g.add(box([0.012, 0.03, 0.02], [-0.11, 0.2, 0], black)); // switch
  return g;
}

/** IKEA HÅLLBAR bin with lid (owner): 25.1 × 38.8 cm at the top, 55 high, light grey, slight taper, split flip lid, side grips. */
function hallbarBin() {
  const grey = new THREE.MeshStandardMaterial({ color: '#e1e1dd', roughness: 0.55 });
  const lidMat = new THREE.MeshStandardMaterial({ color: '#e9e9e6', roughness: 0.5 });
  const W = 0.251, D = 0.388, H = 0.55;
  const g = new THREE.Group();
  const body = new THREE.Shape();
  roundRect(body, 0, 0, W - 0.012, D - 0.012, 0.025);
  const geo = new THREE.ExtrudeGeometry(body, { depth: H - 0.06, bevelEnabled: false, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { // taper: 92 % at the floor
    const k = 0.92 + 0.08 * (pos.getY(i) / (H - 0.06));
    pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  g.add(mesh(geo, grey));
  g.add(place(mesh(new RoundedBoxGeometry(W, 0.05, D, 3, 0.012), lidMat), [0, H - 0.035, 0]));
  for (const s of [-1, 1]) {
    g.add(place(mesh(new RoundedBoxGeometry(W - 0.03, 0.008, D / 2 - 0.02, 2, 0.003), grey), [0, H - 0.006, s * (D / 4 - 0.005)]));
    g.add(box([0.012, 0.012, 0.09], [s * (W / 2 + 0.004), H - 0.08, 0], grey)); // side grips
  }
  g.add(box([W - 0.04, 0.004, 0.006], [0, H - 0.008, 0], new THREE.MeshStandardMaterial({ color: '#c9c9c5', roughness: 0.6 })));
  return g;
}

/**
 * Clear Brita-style filter jug (owner; photos 96, 176): transparent body with water in the lower half,
 * a frosted top reservoir holding the white filter cartridge, white lid with a flip cap, spout at the
 * front, open loop handle at the back. Local: spout toward +z.
 */
function britaJug() {
  const clear = new THREE.MeshStandardMaterial({ color: '#e4eef2', roughness: 0.05, metalness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const frosted = new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.35, transparent: true, opacity: 0.45, depthWrite: false });
  const water = new THREE.MeshStandardMaterial({ color: '#bfe0f0', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false });
  const white = new THREE.MeshStandardMaterial({ color: '#f3f4f4', roughness: 0.35 });
  const grey = new THREE.MeshStandardMaterial({ color: '#c9ced2', roughness: 0.4 });
  const W = 0.11, D = 0.2, H = 0.24;
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(W, H, D, 4, 0.03), clear), [0, H / 2, 0]));
  g.add(place(mesh(new RoundedBoxGeometry(W - 0.012, 0.1, D - 0.012, 3, 0.025), water), [0, 0.056, 0]));
  // top reservoir and the filter cartridge hanging into the water
  g.add(place(mesh(new RoundedBoxGeometry(W - 0.016, 0.08, D - 0.06, 3, 0.02), frosted), [0, H - 0.05, -0.02]));
  g.add(cylinder(0.022, 0.1, [0, H - 0.1, -0.02], white, 16, 0.018));
  g.add(cylinder(0.026, 0.012, [0, H - 0.05, -0.02], grey, 16));
  // white lid with the flip cap over the spout
  g.add(place(mesh(new RoundedBoxGeometry(W + 0.004, 0.022, D + 0.006, 3, 0.01), white), [0, H + 0.008, 0]));
  g.add(place(mesh(new RoundedBoxGeometry(W - 0.03, 0.006, 0.05, 2, 0.003), grey), [0, H + 0.021, D / 2 - 0.04]));
  g.add(box([0.016, 0.006, 0.01], [W / 2 - 0.025, H + 0.022, -0.04], new THREE.MeshStandardMaterial({ color: '#2f7fd6', roughness: 0.3 }))); // date dial
  // spout lip and the open loop handle
  g.add(box([0.06, 0.01, 0.025], [0, H - 0.01, D / 2 + 0.008], clear));
  g.add(tube([[0, H - 0.02, -D / 2], [0, H - 0.01, -D / 2 - 0.06], [0, H - 0.12, -D / 2 - 0.065], [0, 0.07, -D / 2 - 0.01]], 0.012, clear, 20));
  return g;
}

/** Built-in oven front (IMG_0599): steel surround, control strip with three knobs, black glass door, bar handle. Local: front +z, width along x. */
function builtInOven(w: number, h: number) {
  const steel = new THREE.MeshStandardMaterial({ color: '#d4d7d9', roughness: 0.3, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0e0f11', roughness: 0.1, metalness: 0.3 });
  const g = new THREE.Group();
  g.add(box([w, h, 0.02], [0, h / 2, 0.01], steel));
  g.add(box([w - 0.03, 0.12, 0.004], [0, h - 0.08, 0.022], glass)); // control strip
  for (const dx of [0.04, 0.12, 0.2]) g.add(cylinder(0.018, 0.02, [dx - 0.02, h - 0.08, 0.032], steel, 16).rotateX(Math.PI / 2));
  g.add(box([w - 0.03, h - 0.2, 0.006], [0, (h - 0.2) / 2 + 0.03, 0.023], glass)); // door
  g.add(box([w - 0.12, 0.016, 0.02], [0, h - 0.18, 0.045], steel)); // handle bar
  for (const s of [-1, 1]) g.add(box([0.016, 0.016, 0.03], [s * (w / 2 - 0.08), h - 0.18, 0.03], steel));
  return g;
}

/** Black ceramic cooktop (IMG_0599): bevelled glass, four burner rings. Local: front +z. */
function ceramicCooktop() {
  const glass = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.08, metalness: 0.3 });
  const ring = new THREE.MeshStandardMaterial({ color: '#2b2c30', roughness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c8cbcd', roughness: 0.3, metalness: 0.8 });
  const g = new THREE.Group();
  g.add(box([0.58, 0.006, 0.51], [0, 0.003, 0], glass));
  g.add(box([0.58, 0.007, 0.008], [0, 0.0035, 0.255], steel));
  for (const [x, z, r] of [[-0.14, 0.11, 0.09], [-0.14, -0.12, 0.075], [0.12, -0.12, 0.085], [0.12, 0.11, 0.07]] as const) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.003, 4, 40), ring);
    t.rotation.x = -Math.PI / 2;
    t.position.set(x, 0.0065, z);
    g.add(t);
  }
  return g;
}

/**
 * Sauces and seasonings on top of the drawer stack (IMG_0599), kept tidy (owner): soy sauce, oils,
 * an oil spray, a salt carton, pepper grinder and a short row of spice jars on a white riser.
 */
function sauceCorner(top: number, z0: number, z1: number) {
  const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, ...opts });
  const darkGlass = mat('#2a160c', { roughness: 0.1, transparent: true, opacity: 0.9 });
  const oil = mat('#b8a43a', { roughness: 0.1, transparent: true, opacity: 0.75 });
  const red = mat('#c62a22'), black = mat('#151515'), white = mat('#f2f0ea');
  const bottle = (r: number, h: number, body: THREE.Material, cap: THREE.Material, label?: THREE.Material) => {
    const g = new THREE.Group();
    g.add(lathe([[0.001, 0], [r, 0], [r, h * 0.62], [r * 0.45, h * 0.82], [r * 0.32, h * 0.92], [0.001, h * 0.92]], body, 20));
    g.add(cylinder(r * 0.36, h * 0.08, [0, h * 0.96, 0], cap, 12));
    if (label) g.add(cylinder(r * 1.01, h * 0.25, [0, h * 0.35, 0], label, 20));
    return g;
  };
  const jar = (capCol: string) => new THREE.Group().add(cylinder(0.022, 0.07, [0, 0.035, 0], mat('#e8e2d2', { roughness: 0.2, transparent: true, opacity: 0.85 }), 14), cylinder(0.023, 0.018, [0, 0.079, 0], mat(capCol), 14));
  const x = 3.3, zc = (z0 + z1) / 2;
  const out: THREE.Object3D[] = [];
  const put = (o: THREE.Object3D, name: string, px: number, pz: number, mass = 0.5) => out.push(tagged(place(o, [px, top, pz]), name, movable(mass, 'glass', 'cylinder')));
  // back row against the splashback: tall bottles
  put(bottle(0.04, 0.3, darkGlass, red, mat('#d6b24a')), 'soy-sauce', 3.52, z0 + 0.1, 0.6);
  put(bottle(0.045, 0.32, oil, mat('#e8c23a'), mat('#2e6b2a')), 'cooking-oil', 3.52, z0 + 0.2, 0.9);
  put(bottle(0.032, 0.26, darkGlass, black, mat('#e9dfc8')), 'vinegar', 3.5, z0 + 0.29, 0.5);
  put(new THREE.Group().add(cylinder(0.03, 0.2, [0, 0.1, 0], mat('#efe6c4', { metalness: 0.4 }), 16), cylinder(0.022, 0.03, [0, 0.215, 0], white, 12)), 'oil-spray', 3.5, z0 + 0.38, 0.3);
  // middle: salt carton and a pepper grinder
  const salt = new THREE.Group().add(box([0.08, 0.13, 0.05], [0, 0.065, 0], mat('#3c7fd1')), box([0.081, 0.04, 0.051], [0, 0.07, 0], white));
  out.push(tagged(place(salt, [3.36, top, z0 + 0.12], 0.2), 'salt-carton', movable(0.5, 'cardboard', 'box')));
  put(new THREE.Group().add(cylinder(0.025, 0.1, [0, 0.05, 0], mat('#d9d4cc', { roughness: 0.15, transparent: true, opacity: 0.8 }), 14), cylinder(0.026, 0.05, [0, 0.125, 0], black, 14)), 'pepper-grinder', 3.38, z0 + 0.27, 0.2);
  // spice jars on a small white two-step riser at the front
  const riser = new THREE.Group().add(box([0.1, 0.03, 0.3], [0, 0.015, 0], white), box([0.05, 0.03, 0.3], [0.025, 0.045, 0], white));
  out.push(tagged(place(riser, [3.2, top, zc + 0.05]), 'spice-riser', movable(0.4, 'plastic', 'box')));
  ['#2f6b32', '#c62a22', '#d98a1e', '#2f6b32', '#7a1f1a'].forEach((c, i) => {
    const step = i % 2;
    out.push(tagged(place(jar(c), [3.2 + (step ? 0.025 : -0.025), top + (step ? 0.06 : 0.03), zc - 0.07 + i * 0.055]), `spice-jar-${i + 1}`, movable(0.15, 'glass', 'cylinder')));
  });
  return out;
}

/** Black drip coffee machine with a grinder on top and a glass carafe (IMG_0599). Local: front +z. */
function coffeeMachine() {
  const black = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c3c6c8', roughness: 0.25, metalness: 0.9 });
  const smoke = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false });
  const glass = new THREE.MeshStandardMaterial({ color: '#dfe6ea', roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(0.22, 0.03, 0.26, 2, 0.01), black), [0, 0.015, 0]));
  g.add(place(mesh(new RoundedBoxGeometry(0.22, 0.34, 0.12, 3, 0.02), black), [0, 0.17, -0.07])); // tower + tank
  g.add(place(mesh(new RoundedBoxGeometry(0.22, 0.08, 0.24, 3, 0.02), black), [0, 0.3, 0.0])); // brew head
  g.add(box([0.2, 0.012, 0.22], [0, 0.346, 0], steel));
  g.add(cylinder(0.06, 0.08, [0, 0.39, -0.02], smoke, 20)); // bean hopper
  g.add(cylinder(0.062, 0.012, [0, 0.436, -0.02], black, 20));
  g.add(cylinder(0.07, 0.006, [0, 0.033, 0.05], steel, 24)); // warmer plate
  g.add(lathe([[0.001, 0.036], [0.065, 0.036], [0.07, 0.1], [0.055, 0.16], [0.05, 0.18], [0.001, 0.18]], glass, 24)); // carafe
  g.children[g.children.length - 1].position.z = 0.05;
  g.add(cylinder(0.052, 0.02, [0, 0.18, 0.05], black, 20));
  g.add(tube([[0.05, 0.16, 0.05], [0.1, 0.15, 0.05], [0.1, 0.07, 0.05], [0.065, 0.06, 0.05]], 0.01, black, 12));
  g.add(cylinder(0.008, 0.004, [0.08, 0.3, 0.121], new THREE.MeshStandardMaterial({ color: '#d63a2c', emissive: '#7a1a12' }), 10).rotateX(Math.PI / 2));
  return g;
}

/** White basket air fryer with a black dial on the front shoulder (IMG_0599). Local: front +z. */
function airFryer() {
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9cccf', roughness: 0.25, metalness: 0.9 });
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(0.26, 0.3, 0.3, 5, 0.06), white), [0, 0.16, 0]));
  g.add(cylinder(0.11, 0.012, [0, 0.005, 0], black, 24));
  g.add(place(mesh(new RoundedBoxGeometry(0.22, 0.16, 0.02, 3, 0.008), white), [0, 0.1, 0.152])); // basket drawer
  g.add(box([0.1, 0.03, 0.04], [0, 0.13, 0.175], black)); // handle
  g.add(box([0.2, 0.004, 0.002], [0, 0.19, 0.151], new THREE.MeshStandardMaterial({ color: '#cfcfcc' })));
  const dial = new THREE.Group().add(cylinder(0.05, 0.02, [0, 0, 0], black, 28), cylinder(0.054, 0.006, [0, -0.008, 0], steel, 28), cylinder(0.025, 0.006, [0, 0.012, 0], steel, 20));
  dial.rotation.x = Math.PI / 2 - 0.5;
  dial.position.set(0, 0.275, 0.152);
  g.add(dial);
  return g;
}

/** Built-in stainless dishwasher front (photo 101): full door, dark control strip along the top, bar handle, kick plate. Local: front +z, width along x. */
function dishwasherFront(w: number, h: number) {
  const steel = new THREE.MeshStandardMaterial({ color: '#d9dcde', roughness: 0.32, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1f2023', roughness: 0.35 });
  const g = new THREE.Group();
  g.add(box([w, h - 0.12, 0.03], [0, 0.1 + (h - 0.12) / 2, 0.015], steel));
  g.add(box([w, 0.09, 0.032], [0, h - 0.045 + 0.0, 0.016], dark)); // control strip
  for (let i = 0; i < 5; i++) g.add(cylinder(0.005, 0.003, [-w / 2 + 0.08 + i * 0.03, h - 0.045, 0.033], new THREE.MeshStandardMaterial({ color: '#8a8d90' }), 10).rotateX(Math.PI / 2));
  g.add(box([0.06, 0.012, 0.002], [w / 2 - 0.1, h - 0.045, 0.033], new THREE.MeshStandardMaterial({ color: '#3fa3e0', emissive: '#1f6fae', emissiveIntensity: 0.6 })));
  g.add(box([w - 0.16, 0.014, 0.02], [0, h - 0.11, 0.04], steel)); // bar handle
  g.add(box([w, 0.1, 0.01], [0, 0.05, -0.03], new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.5 }))); // kick
  return g;
}

// ---------------------------------------------------------------------------------------------
// Bathroom + laundry
// ---------------------------------------------------------------------------------------------
function bathroom() {
  const m = ausMaterials();
  const g = new THREE.Group();
  g.name = 'bathroom';
  // vanity (scan top 0.86, x 5.06 … 5.56, z −0.79 … 0.23): three drawers north, two doors south,
  // round knobs (photo 42); glossy moulded top with a sunken oval basin, a chrome swan-neck spout
  // between two cross-head taps, and only the hand soap on the left (owner; photo 31)
  const VX = 5.06;
  const v: THREE.Object3D[] = [
    boxSpan([VX + 0.02, 0.08, -0.78], [X_E, 0.74, 0.2], m.cabinet), // stops short of the basin
    boxSpan([VX + 0.06, 0, -0.74], [X_E, 0.08, 0.16], m.whiteMatte),
  ];
  const front = (z0: number, z1: number, y0: number, y1: number) => v.push(
    boxSpan([VX, y0 + 0.006, z0 + 0.006], [VX + 0.02, y1 - 0.006, z1 - 0.006], m.cabinet),
    boxSpan([VX - 0.004, y0 + 0.05, z0 + 0.05], [VX + 0.002, y1 - 0.05, z1 - 0.05], m.trim));
  for (const [y0, y1] of [[0.08, 0.34], [0.34, 0.58], [0.58, 0.82]]) {
    front(-0.78, -0.4, y0, y1);
    v.push(cylinder(0.016, 0.03, [VX - 0.02, (y0 + y1) / 2, -0.59], m.steel, 12).rotateZ(Math.PI / 2));
  }
  for (const [z0, z1] of [[-0.4, -0.1], [-0.1, 0.2]]) {
    front(z0, z1, 0.08, 0.82);
    v.push(cylinder(0.016, 0.03, [VX - 0.02, 0.68, z0 < -0.2 ? z1 - 0.06 : z0 + 0.06], m.steel, 12).rotateZ(Math.PI / 2));
  }
  const BC = { x: 5.29, z: -0.29, rx: 0.16, rz: 0.23, depth: 0.13 };
  const gloss = new THREE.MeshStandardMaterial({ color: '#f6f6f3', roughness: 0.12, side: THREE.DoubleSide });
  const topShape = new THREE.Shape();
  topShape.moveTo(VX - 0.03, -0.8); topShape.lineTo(X_E, -0.8); topShape.lineTo(X_E, 0.22); topShape.lineTo(VX - 0.03, 0.22); topShape.closePath();
  topShape.holes.push(new THREE.Path().absellipse(BC.x, BC.z, BC.rx, BC.rz, 0, Math.PI * 2, false));
  const basinBowl = mesh(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gloss);
  basinBowl.scale.set(BC.rx, BC.depth, BC.rz);
  basinBowl.position.set(BC.x, 0.88, BC.z);
  const chrome = new THREE.MeshStandardMaterial({ color: '#e3e5e7', roughness: 0.06, metalness: 1 });
  const drain = cylinder(0.022, 0.004, [BC.x + 0.02, 0.88 - BC.depth + 0.004, BC.z], chrome, 20);
  // swan-neck spout on the deck behind the basin, cross-head taps either side
  const tx = X_E - 0.08;
  const spout = tube([[tx, 0.88, BC.z], [tx, 0.98, BC.z], [tx - 0.03, 1.04, BC.z], [tx - 0.08, 1.03, BC.z], [tx - 0.1, 0.98, BC.z]], 0.011, chrome, 24);
  const taps: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const z = BC.z + s * 0.13;
    taps.push(cylinder(0.022, 0.012, [tx, 0.886, z], chrome, 16), cylinder(0.012, 0.05, [tx, 0.915, z], chrome, 12));
    for (let i = 0; i < 4; i++) taps.push(box([0.05, 0.008, 0.008], [tx, 0.945, z], chrome).rotateY((i * Math.PI) / 4 + Math.PI / 8));
    taps.push(sphere(0.009, [tx, 0.95, z], new THREE.MeshStandardMaterial({ color: s < 0 ? '#3a6fd1' : '#d13a3a', roughness: 0.3 })));
  }
  v.push(slab(topShape, 0.88, 0.04, new THREE.MeshStandardMaterial({ color: '#f6f6f3', roughness: 0.12 })), basinBowl, drain, spout, ...taps);
  g.add(item('vanity', FIXED, ...v));
  // orange hand soap in a clear pump bottle at the front left of the basin (photo 31)
  const soap = new THREE.Group().add(
    place(mesh(new RoundedBoxGeometry(0.06, 0.13, 0.045, 3, 0.012), new THREE.MeshStandardMaterial({ color: '#f0f2f2', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false })), [0, 0.065, 0]),
    place(mesh(new RoundedBoxGeometry(0.054, 0.1, 0.04, 3, 0.01), new THREE.MeshStandardMaterial({ color: '#e8922a', roughness: 0.15, transparent: true, opacity: 0.85 })), [0, 0.052, 0]),
    cylinder(0.014, 0.03, [0, 0.145, 0], new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 }), 14),
    box([0.04, 0.012, 0.016], [0.012, 0.165, 0], new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 })),
  );
  g.add(tagged(place(soap, [5.17, 0.88, -0.68], 0.3), 'hand-soap', movable(0.3, 'plastic', 'box')));
  // wall-to-wall mirror above the tiled splashback, from the hall wall to the WC wall (owner)
  g.add(item('vanity-mirror', FIXED,
    boxSpan([X_E - 0.012, 1.12, Z_BATH_N], [X_E, 2.02, Z_BATH_MID - 0.06], m.mirror),
    boxSpan([X_E - 0.02, 1.105, Z_BATH_N], [X_E, 1.12, Z_BATH_MID - 0.06], chrome)));
  // beige marble-look tiles behind the basin with a darker border row (photo 31; architecture: untagged)
  const tileMap = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e3d6c0'; x.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(12);
    x.strokeStyle = 'rgba(160,140,110,0.35)'; x.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(rnd() * 256, rnd() * 256); x.bezierCurveTo(rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256); x.stroke(); }
    x.fillStyle = '#cdbfa6'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 0, 3, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const splash = boxSpan([X_E - 0.008, 0.88, Z_BATH_N], [X_E, 1.105, Z_BATH_MID - 0.06], new THREE.MeshStandardMaterial({ map: tileMap, roughness: 0.25 }));
  boxUV(splash.geometry, 1 / 0.3);
  splash.name = 'vanity-splashback';
  const band = boxSpan([X_E - 0.012, 1.04, Z_BATH_N], [X_E, 1.07, Z_BATH_MID - 0.06], new THREE.MeshStandardMaterial({ color: '#bfa889', roughness: 0.3 }));
  band.name = 'vanity-splashback-band';
  g.add(splash, band);
  // close-coupled toilet against the east wall, facing west, lid down (owner; photo 21)
  g.add(item('toilet', FIXED, place(closedToilet(), [X_E - 0.01, 0, 0.7], Math.PI / 2)));
  // laundry (photos 4, 16, 17): top-loading washer with the dryer wall-mounted above it, and the
  // plastic laundry tub on its two-door cabinet with wall taps over beige tiles
  // washer and dryer pushed into the east corner, the dryer high up under the ceiling; the tub in the
  // west corner, tiled on the back and the side wall (owner; photos 4, 16)
  g.add(item('washing-machine', FIXED, place(topLoader(), [X_E - 0.285, 0, Z_BATH_S - 0.01])));
  g.add(item('dryer', FIXED, place(wallDryer(), [X_E - 0.305, 1.38, Z_BATH_S - 0.01])));
  g.add(item('laundry-tub', FIXED, place(laundryTub(tileMap), [X_BATH_W + 0.005 + 0.31, 0, Z_BATH_S - 0.01])));
  return g;
}

// ---- bathroom + laundry appliances (owner; photos 4, 16, 17, 21) ----------------------------------
// Each is built with its back on local z 0 and its front toward local −z, then placed so local +z
// points into the wall it stands against.

const porcelain = () => new THREE.MeshStandardMaterial({ color: '#f7f7f4', roughness: 0.12 });

/** Close-coupled toilet, lid closed (photo 21). Local: back (cistern) at z 0, bowl toward −z. */
function closedToilet() {
  const white = porcelain();
  const g = new THREE.Group();
  // pedestal and bowl: an oval lathe, wider at the rim
  const body = lathe([[0.001, 0], [0.12, 0], [0.11, 0.08], [0.12, 0.2], [0.16, 0.32], [0.18, 0.38], [0.001, 0.38]], white, 40);
  body.scale.set(0.95, 1, 1.3);
  body.position.set(0, 0, -0.33);
  g.add(body);
  g.add(place(mesh(new RoundedBoxGeometry(0.34, 0.3, 0.2, 4, 0.05), white), [0, 0.15, -0.14])); // trapway to the wall
  // seat and closed lid
  const disc = (t: number, s: number, y: number, mat: THREE.Material) => {
    const d = cylinder(0.18 * s, t, [0, y, 0], mat, 40);
    d.scale.set(0.98, 1, 1.32);
    d.position.z = -0.34;
    return d;
  };
  g.add(disc(0.022, 1, 0.391, white), disc(0.028, 0.97, 0.416, white));
  g.add(box([0.22, 0.03, 0.04], [0, 0.4, -0.06], white)); // hinge block
  // cistern with its lid and the chrome dual-flush button
  g.add(place(mesh(new RoundedBoxGeometry(0.38, 0.36, 0.17, 4, 0.03), white), [0, 0.56, -0.095]));
  g.add(place(mesh(new RoundedBoxGeometry(0.4, 0.03, 0.19, 3, 0.012), white), [0, 0.755, -0.095]));
  g.add(cylinder(0.025, 0.008, [0, 0.774, -0.095], new THREE.MeshStandardMaterial({ color: '#e2e4e6', roughness: 0.08, metalness: 1 }), 20));
  return g;
}

/** White top-loading washing machine with the grey lid closed and the raised control panel at the back (photo 4). Local: back at z 0, front −z. */
function topLoader() {
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 0.35 });
  const grey = new THREE.MeshStandardMaterial({ color: '#c9cbcd', roughness: 0.3, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.15, metalness: 0.2 });
  const W = 0.56, H = 0.82, D = 0.58;
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(W, H, D, 4, 0.03), white), [0, H / 2 + 0.02, -D / 2]));
  for (const sx of [-1, 1]) for (const sz of [0.06, D - 0.06]) g.add(cylinder(0.02, 0.02, [sx * (W / 2 - 0.05), 0.01, -sz], grey, 10));
  // closed lid: grey frame with a tinted window
  g.add(place(mesh(new RoundedBoxGeometry(W - 0.04, 0.025, D - 0.17, 3, 0.012), grey), [0, H + 0.03, -0.085 - (D - 0.17) / 2 - 0.02]));
  g.add(place(mesh(new RoundedBoxGeometry(W - 0.14, 0.006, D - 0.29, 2, 0.02), dark), [0, H + 0.044, -0.105 - (D - 0.17) / 2]));
  // control panel along the back edge, sloped toward the user
  const panel = new THREE.Group();
  panel.add(place(mesh(new RoundedBoxGeometry(W, 0.1, 0.1, 3, 0.02), white), [0, 0.05, 0]));
  panel.add(box([W - 0.08, 0.06, 0.004], [0, 0.05, -0.052], grey));
  panel.add(box([0.06, 0.025, 0.002], [0.05, 0.055, -0.055], new THREE.MeshStandardMaterial({ color: '#1b3b5a', emissive: '#1d6fa8', emissiveIntensity: 0.4 })));
  for (let i = 0; i < 6; i++) panel.add(cylinder(0.006, 0.004, [-0.2 + i * 0.035 + (i > 2 ? 0.17 : 0), 0.05, -0.056], white, 10).rotateX(Math.PI / 2));
  panel.position.set(0, H + 0.02, -0.06);
  panel.rotation.x = 0.35;
  g.add(panel);
  g.add(box([0.12, 0.06, 0.002], [0.12, H - 0.18, -D - 0.001], new THREE.MeshStandardMaterial({ color: '#e9e3d4', roughness: 0.6 }))); // energy label
  return g;
}

/** Wall-mounted front-load dryer (photo 4): white case, big round door (closed), round vent grille, timer dial, wall brackets. Local: back at z 0, front −z; origin at its bottom. */
function wallDryer() {
  const white = new THREE.MeshStandardMaterial({ color: '#f3f3f0', roughness: 0.35 });
  const grey = new THREE.MeshStandardMaterial({ color: '#b9bcbf', roughness: 0.35, metalness: 0.2 });
  const smoke = new THREE.MeshStandardMaterial({ color: '#3a3d41', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.75 });
  const W = 0.6, H = 0.67, D = 0.45;
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(W, H, D, 4, 0.025), white), [0, H / 2, -D / 2]));
  // door: grey ring, smoked glass, white rim, handle notch
  const door = new THREE.Group();
  door.add(cylinder(0.2, 0.03, [0, 0, 0], grey, 48), cylinder(0.15, 0.034, [0, 0, 0], smoke, 48), cylinder(0.205, 0.02, [0, -0.008, 0], white, 48));
  door.add(box([0.03, 0.08, 0.03], [0.19, 0.02, 0], grey).rotateY(0));
  door.rotation.x = Math.PI / 2;
  door.position.set(-0.03, 0.31, -D - 0.015);
  g.add(door);
  // round vent grille top right
  const vent = new THREE.Group();
  vent.add(cylinder(0.065, 0.01, [0, 0, 0], grey, 32));
  for (let i = -3; i <= 3; i++) vent.add(box([0.11 * Math.sqrt(1 - (i / 4) ** 2), 0.012, 0.008], [0, 0.002, i * 0.016], white));
  vent.rotation.x = Math.PI / 2;
  vent.position.set(0.17, H - 0.12, -D - 0.006);
  g.add(vent);
  // timer dial and control strip at the bottom
  g.add(cylinder(0.03, 0.025, [-0.2, 0.07, -D - 0.012], white, 24).rotateX(Math.PI / 2), cylinder(0.034, 0.004, [-0.2, 0.07, -D - 0.002], grey, 24).rotateX(Math.PI / 2));
  g.add(box([W - 0.1, 0.03, 0.004], [0.05, 0.07, -D - 0.002], grey));
  // wall brackets
  for (const s of [-1, 1]) g.add(box([0.03, 0.04, D - 0.04], [s * (W / 2 - 0.08), -0.02, -D / 2], grey));
  return g;
}

/**
 * Laundry tub on its cabinet (photos 16, 17): white two-door cabinet, cream plastic tub with a rolled
 * rim and a deep rounded basin, beige tiles behind it, two cross-head wall taps and a swivel spout.
 * Local: back at z 0, front −z.
 */
function laundryTub(tileMap: THREE.Texture) {
  const white = new THREE.MeshStandardMaterial({ color: '#f2f1ec', roughness: 0.4 });
  const cream = new THREE.MeshStandardMaterial({ color: '#efe7d2', roughness: 0.25, side: THREE.DoubleSide });
  const chrome = new THREE.MeshStandardMaterial({ color: '#e1e3e5', roughness: 0.08, metalness: 1 });
  const W = 0.62, D = 0.58, TOP = 0.9, DEPTH = 0.32;
  const g = new THREE.Group();
  // cabinet (stops under the basin), two doors with finger-pull cut-outs, kick
  g.add(boxSpan([-W / 2 + 0.01, 0.06, -D + 0.02], [W / 2 - 0.01, TOP - DEPTH - 0.02, -0.01], white));
  g.add(boxSpan([-W / 2 + 0.02, 0, -D + 0.05], [W / 2 - 0.02, 0.06, -0.02], white));
  for (const s of [-1, 1]) {
    g.add(boxSpan([s < 0 ? -W / 2 + 0.01 : 0.002, 0.07, -D + 0.005], [s < 0 ? -0.002 : W / 2 - 0.01, 0.62, -D + 0.02], white));
    const pull = cylinder(0.018, 0.004, [s * 0.04, 0.55, -D + 0.003], new THREE.MeshStandardMaterial({ color: '#d9d8d2', roughness: 0.5 }), 16).rotateX(Math.PI / 2);
    pull.scale.set(1.4, 1, 1);
    g.add(pull);
  }
  g.add(boxSpan([-W / 2 + 0.01, 0.62, -D + 0.005], [W / 2 - 0.01, TOP - 0.06, -D + 0.02], white)); // apron under the rim
  // tub: rim slab with a rounded-rect hole, thin basin walls, floor, drain
  const rim = new THREE.Shape();
  roundRect(rim, 0, -D / 2, W, D, 0.03);
  rim.holes.push(roundRect(new THREE.Path(), 0, -D / 2 - 0.01, W - 0.08, D - 0.1, 0.06));
  g.add(slab(rim, TOP, 0.06, cream));
  const wall = new THREE.Shape();
  roundRect(wall, 0, -D / 2 - 0.01, W - 0.08, D - 0.1, 0.06);
  wall.holes.push(roundRect(new THREE.Path(), 0, -D / 2 - 0.01, W - 0.084, D - 0.104, 0.058));
  g.add(slab(wall, TOP, DEPTH, cream));
  const floor = new THREE.Shape();
  roundRect(floor, 0, -D / 2 - 0.01, W - 0.08, D - 0.1, 0.06);
  g.add(slab(floor, TOP - DEPTH, 0.004, cream));
  g.add(cylinder(0.025, 0.004, [0, TOP - DEPTH + 0.003, -D / 2], chrome, 16));
  // tiles behind, wall taps and the swivel spout
  const tileMat = new THREE.MeshStandardMaterial({ map: tileMap, roughness: 0.25 });
  const tiles = boxSpan([-W / 2 - 0.005, TOP, -0.008], [W / 2 + 0.06, TOP + 0.45, 0], tileMat);
  const side = boxSpan([-W / 2 - 0.005, TOP, -D - 0.02], [-W / 2 + 0.003, TOP + 0.45, 0], tileMat); // side wall (west)
  for (const t of [tiles, side]) boxUV(t.geometry, 1 / 0.3);
  g.add(tiles, side);
  for (const s of [-1, 1]) {
    const x = s * 0.15;
    g.add(cylinder(0.025, 0.012, [x, TOP + 0.3, -0.014], chrome, 16).rotateX(Math.PI / 2));
    g.add(cylinder(0.01, 0.04, [x, TOP + 0.3, -0.035], chrome, 12).rotateX(Math.PI / 2));
    for (let i = 0; i < 4; i++) g.add(box([0.05, 0.008, 0.008], [x, TOP + 0.3, -0.056], chrome).rotateZ((i * Math.PI) / 4 + Math.PI / 8));
  }
  g.add(cylinder(0.022, 0.012, [0, TOP + 0.3, -0.014], chrome, 16).rotateX(Math.PI / 2));
  // straight wall spout angled down into the tub, with a short nozzle
  g.add(tube([[0, TOP + 0.3, -0.02], [0, TOP + 0.17, -0.24]], 0.009, chrome, 2));
  g.add(cylinder(0.012, 0.03, [0, TOP + 0.155, -0.247], chrome, 12));
  return g;
}

type ShoeKind = 'sneaker' | 'boot' | 'chunky' | 'slipper' | 'sandal';
type ShoeLook = { kind: ShoeKind; upper: string; sole: string; accent?: string; accent2?: string; soleH?: number };

/**
 * One shoe, toe toward local +z, sole on y 0 (photo 40). The upper is a deformed sphere: flat
 * underneath, low at the toe, rising to the heel; a dark collar opening on top at the back; laces or a
 * coloured side panel by kind. Boots add an ankle shaft, slippers are a fluffy open-back toe box,
 * sandals are a footbed with straps.
 */
function shoe(look: ShoeLook) {
  const mat = (c: string, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const L = look.kind === 'boot' ? 0.28 : 0.27, W = 0.095, SH = look.soleH ?? (look.kind === 'chunky' ? 0.05 : 0.025);
  const g = new THREE.Group();
  g.add(mesh(soleGeometry(L, W, SH), mat(look.sole, 0.8))); // foot-shaped sole, not a block (owner)
  if (look.kind === 'sandal') {
    const strap = mat(look.upper, 0.7);
    for (const z of [0.07, -0.01, -0.09]) g.add(tube([[-W / 2, SH, z], [-W / 2 + 0.01, SH + 0.035, z], [W / 2 - 0.01, SH + 0.035, z], [W / 2, SH, z]], 0.008, strap, 12));
    g.add(tube([[-W / 2, SH, -0.1], [-0.03, SH + 0.05, -0.13], [0.03, SH + 0.05, -0.13], [W / 2, SH, -0.1]], 0.008, strap, 12)); // heel strap
    return g;
  }
  const H = look.kind === 'slipper' ? 0.06 : 0.075;
  const geo = new THREE.SphereGeometry(1, 28, 16);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rise = 0.55 + 0.45 * Math.min(1, Math.max(0, (0.6 - z) / 1.2)); // low toe, high heel
    const taper = z < 0.3 ? 0.8 + 0.2 * (z + 1) / 1.3 : 1 - 0.15 * ((z - 0.3) / 0.7) ** 2; // narrow heel, wide ball, like the sole
    pos.setXYZ(i, x * (W / 2) * 0.97 * taper, y < 0 ? y * 0.004 : y * H * rise, z * (L / 2) * 0.96);
  }
  geo.computeVertexNormals();
  const upperMat = mat(look.upper, look.kind === 'slipper' ? 1 : 0.5);
  const upper = mesh(geo, upperMat);
  upper.position.y = SH;
  if (look.kind === 'slipper') {
    // open back: keep only the toe box by clipping with a scaled copy, plus a fluffy rim
    upper.scale.z = 0.62; upper.position.z = 0.05;
    g.add(upper);
    g.add(place(mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20, Math.PI), upperMat), [0, SH + 0.01, -0.01]).rotateX(-Math.PI / 2));
    return g;
  }
  g.add(upper);
  // collar opening at the back of the top
  const collar = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat('#121214', 0.9));
  collar.scale.set(0.032, 0.05, 1);
  collar.rotation.x = -Math.PI / 2 + 0.25;
  collar.position.set(0, SH + H * 0.98, -0.055);
  g.add(collar);
  const ring = mesh(new THREE.TorusGeometry(1, 0.12, 6, 20), mat(look.upper, 0.6));
  ring.scale.set(0.034, 0.052, 0.034);
  ring.rotation.x = -Math.PI / 2 + 0.25;
  ring.position.set(0, SH + H * 0.97, -0.055);
  g.add(ring);
  if (look.kind === 'boot') {
    // ankle shaft with its own collar
    g.add(cylinder(0.046, 0.12, [0, SH + H + 0.04, -0.06], upperMat, 20, 0.05));
    g.add(cylinder(0.048, 0.012, [0, SH + H + 0.1, -0.06], mat('#3a2416', 0.8), 20));
    for (let i = 0; i < 4; i++) g.add(box([0.06, 0.004, 0.006], [0, SH + H * 0.8 + i * 0.025, -0.0 - i * 0.012], mat('#2a1a10')));
  } else {
    // laces across the instep
    for (let i = 0; i < 4; i++) g.add(box([0.045, 0.004, 0.006], [0, SH + H * (0.78 + i * 0.045), 0.04 - i * 0.022], mat(look.accent2 ?? '#f2f2ee', 0.7)));
  }
  if (look.accent) {
    // coloured side panel (Vans-style stripe / colour-block)
    for (const s of [-1, 1]) {
      const panel = box([0.003, H * 0.45, L * 0.45], [s * W / 2 * 0.98, SH + H * 0.35, -0.02], mat(look.accent, 0.5));
      panel.rotation.x = -0.12;
      g.add(panel);
    }
  }
  if (look.kind === 'chunky') g.add(new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 16), mat('#d9dbdd', 0.3)).translateY(SH + H * 0.75).translateZ(-L / 2 + 0.005)); // D-ring
  return g;
}

/**
 * Foot-shaped outsole (owner: no blocks under the shoes): narrow rounded heel, pinched waist, wide
 * ball and a rounded toe, bevelled edges, the toe lifted a little (toe spring). Toe toward +z, y 0 … h.
 */
function soleGeometry(L: number, W: number, h: number) {
  const k = W / 0.095;
  // right-hand edge from heel to toe (x half-width, z), mirrored for the left
  const right: [number, number][] = [[0.0, -0.5], [0.026, -0.485], [0.037, -0.43], [0.038, -0.3], [0.034, -0.1], [0.04, 0.08], [0.047, 0.22], [0.046, 0.33], [0.036, 0.44], [0.016, 0.495], [0, 0.5]];
  const pts = [...right, ...right.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number])]
    .map(([x, z]) => new THREE.Vector2(x * k * 0.97, z * L));
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  shape.splineThru([...pts.slice(1), pts[0]]);
  const bevel = Math.min(0.005, h / 3);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 40 });
  geo.rotateX(Math.PI / 2); // shape y → z, extrusion → −y
  geo.translate(0, h - bevel, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i), lift = z - (L / 2 - 0.07);
    if (lift > 0) pos.setY(i, pos.getY(i) + lift * lift * 2.2); // toe spring
  }
  geo.computeVertexNormals();
  return geo;
}

/** A pair of shoes side by side, toes toward local +z, a little toed-out. */
function shoePair(look: ShoeLook) {
  const p = new THREE.Group();
  for (const s of [-1, 1]) {
    const one = shoe(look);
    one.position.x = s * 0.052;
    one.rotation.y = -s * 0.05;
    p.add(one);
  }
  return p;
}

// black tube shoe rack against the hall wall by the front door (photo 40; scan footprint): four
// tiers of paired rails and a top shelf, every pair of shoes on it (owner: none on the floor)
function shoeRack() {
  const steel = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.45, metalness: 0.5 });
  const parts: THREE.Object3D[] = [];
  const x0 = 5.24, x1 = 5.54, z0 = -1.62, z1 = -1.02, top = 0.8, r = 0.007;
  for (const x of [x0, x1]) for (const z of [z0, z1]) parts.push(cylinder(0.009, top, [x, top / 2, z], steel, 8));
  const levels = [0.06, 0.3, 0.54];
  for (const y of [...levels, top]) {
    for (const z of [z0, z1]) parts.push(tube([[x0, y, z], [x1, y, z]], r, steel, 2));
    // two rails per tier, the front one lower so shoes sit heel-down toward the room
    for (const [x, dy] of [[x0 + 0.03, -0.015], [x1 - 0.04, 0.0]] as const) parts.push(tube([[x, y + dy, z0], [x, y + dy, z1]], r, steel, 2));
  }
  parts.push(boxSpan([x0, top - 0.004, z0], [x1, top + 0.004, z1], steel)); // solid top shelf
  // pairs per level (toes to the wall, heels to the room): from the floor tier up, then the top shelf
  const looks: ShoeLook[][] = [
    [{ kind: 'sneaker', upper: '#1c1c1e', sole: '#2a2a2c' }, { kind: 'sandal', upper: '#151517', sole: '#1e1e20', soleH: 0.03 }],
    [{ kind: 'slipper', upper: '#cdc9c2', sole: '#b9b5ae', soleH: 0.03 }, { kind: 'sneaker', upper: '#1e2742', sole: '#efece4', accent: '#d6352b', accent2: '#e8c33a' }],
    [{ kind: 'sneaker', upper: '#232325', sole: '#2b2b2d', accent2: '#3a3a3c' }, { kind: 'chunky', upper: '#1b1b1d', sole: '#f1eee6' }],
  ];
  const topLooks: ShoeLook[] = [
    { kind: 'sneaker', upper: '#171719', sole: '#2a2a2a', accent: '#7bd23c' },
    { kind: 'sneaker', upper: '#202022', sole: '#e6e1d6', accent2: '#2a2a2c' },
    { kind: 'boot', upper: '#6b4129', sole: '#ebe3d1', soleH: 0.04 },
  ];
  const out: THREE.Object3D[] = [item('shoe-rack', movable(6, 'metal'), ...parts)];
  const names = [['black-shoes', 'sport-sandals'], ['grey-slippers', 'colour-block-vans'], ['black-sneakers', 'chunky-white-sole-sneakers']];
  levels.forEach((y, i) => looks[i].forEach((look, j) => {
    const z = z0 + (z1 - z0) * (j + 0.5) / 2;
    out.push(tagged(place(shoePair(look), [(x0 + x1) / 2 + 0.01, y + 0.008, z], Math.PI / 2), names[i][j], movable(0.8, 'soft')));
  }));
  topLooks.forEach((look, j) => {
    const z = z0 + (z1 - z0) * (j + 0.5) / 3;
    out.push(tagged(place(shoePair(look), [(x0 + x1) / 2, top + 0.004, z], Math.PI / 2), ['green-vans', 'black-leather-shoes', 'brown-boots'][j], movable(1, 'soft')));
  });
  return out;
}
