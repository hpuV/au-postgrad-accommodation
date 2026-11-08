import * as THREE from 'three';
import { buildWall, type Opening, type WallDef } from '../../packages/room-runtime/walls';
import { boxSpan, boxUV, mesh } from '../../packages/room-runtime/helpers';
import { ausMaterials } from './materials';

/*
 * Measurements (room coordinates, meters) from measure_scan.mjs plus per-wall plane histograms of
 * the aligned scan (area-weighted, 1 cm bins) and horizontal sections at 0.3/0.6/1.0/1.5/2.0 m.
 *
 * Main level (living / dining / galley kitchen / entry hall):  x −3.30 … 5.56, z −2.86 … 2.63
 *   ceiling 2.38 (scan: 2.42 at the west end → 2.35 east; mean used), stair void x 0.50 … 4.00,
 *   z −2.86 … −1.95, bulkhead over the kitchen's south end at 2.20 (x 0.75 … 3.62, z 1.75 … 2.60).
 * Bedroom (west, double height): x −6.48/−7.11 … −3.70, z −1.70 … 2.56, ceiling 5.10. The west wall
 *   really is skewed (x −6.45 at z −0.45 → −7.06 at z 2.30, consistent across 1–4 m heights).
 * Bathroom + laundry: x 4.06 … 5.56, z −0.85 … 2.20, ceilings 2.28 (vanity) / 2.12 (WC + laundry),
 *   split by a wall at z 0.25 … 0.36.
 */
export const H = 2.38;
export const BED_H = 5.1;

type P = [number, number];
interface Spec {
  name: string;
  a: P;
  b: P;
  t: number;
  h: number;
  openings?: Opening[];
  ext?: [number, number];
  material?: THREE.Material;
  trim?: THREE.Material;
  skirting?: boolean;
}

/** Wall from a → b, interior on the left of travel as seen from above (n = u × up). */
function def(s: Spec): WallDef {
  const a = new THREE.Vector3(s.a[0], 0, s.a[1]);
  const b = new THREE.Vector3(s.b[0], 0, s.b[1]);
  const u = b.clone().sub(a);
  const length = u.length();
  u.normalize();
  return {
    name: s.name,
    origin: a,
    u,
    n: new THREE.Vector3(-u.z, 0, u.x),
    length,
    thickness: s.t,
    openings: s.openings ?? [],
    panels: [],
    height: s.h,
    crown: false,
    ext: s.ext,
    material: s.material,
    trimMaterial: s.trim,
    // no skirting across doorways / the glazed partition: the runtime only gaps cased openings
    baseboardGaps: s.skirting === false
      ? [[-1, length + 1]]
      : (s.openings ?? []).filter((o) => o.kind === 'rect' && o.v0 === 0).map((o): [number, number] => [o.u0, o.u1]),
  };
}

/** Distance along wall `a → b` of world coordinate c on the wall's dominant axis. */
function along(a: P, b: P, c: number) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  return Math.abs(dx) >= Math.abs(dz) ? ((c - a[0]) / dx) * len : ((c - a[1]) / dz) * len;
}
function rect(a: P, b: P, c0: number, c1: number, v0: number, v1: number): Opening {
  const [u0, u1] = [along(a, b, c0), along(a, b, c1)].sort((p, q) => p - q);
  return { kind: 'rect', u0, u1, v0, v1 };
}

// ---- key coordinates -------------------------------------------------------------------------
export const X_W = -3.3; // main room west face (bedroom side of the partition at −3.70)
export const X_BED = -3.7;
/** living-room face of the thin glazed partition (14 cm: the two door tracks, owner) */
export const X_P = X_BED + 0.14;
export const Z_N = -2.86;
export const X_E = 5.56;
export const Z_S = 2.63;
export const Z_PIER = 2.17;
export const X_PIER_W = -0.3;
export const X_PIER_E = 1.75;
export const Z_KS = 2.6;
export const X_KE = 3.62; // kitchen back wall (bathroom wall face at 4.06)
export const X_BATH_W = 4.06;
export const Z_HALL_S = -0.93; // hall face of the bathroom wall (bathroom face −0.85)
export const Z_BATH_N = -0.85;
export const Z_BATH_S = 2.2;
export const Z_BATH_MID = 0.25;
export const BED_N = -1.7;
export const BED_S = 2.56;
export const BED_W1 = -6.48;
export const BED_SKEW: [P, P] = [[-7.11, BED_S], [-6.5, -0.55]];
export const VOID = { x0: 0.5, x1: 4.0, z0: Z_N, z1: -1.95 };

// openings (world coordinates; converted to wall u below)
export const FRONT_DOOR = { z0: -2.8, z1: -2.02, h: 2.04 }; // dark leaf in the scan texture, flush with the wall
export const BATH_DOOR = { x0: 4.37, x1: 5.08, h: 2.04 };
export const SOFA_WINDOW = { x0: -2.08, x1: -0.42, v0: 0.92, v1: 2.18 };
export const KITCHEN_WINDOW = { x0: 1.86, x1: 3.58, v0: 1.0, v1: 2.17 }; // photo 93: runs to the east-wall cupboards
export const PARTITION = {
  // bedroom glazed partition (ortho elevations of the scan, view e/w, proportioned by the owner):
  // 2 glass sliding panels (closed, living-room blind down behind them) | slim pine post |
  // 2 glass sliding panels, the front one slid open.
  // Both sections are 2.08 m, so all four panels are the same 1.06 m (4 cm overlap) and the
  // 200 cm bed spans the two northern ones.
  north: { z0: -1.7, z1: 0.38 },
  south: { z0: 0.44, z1: 2.52 },
  gap: { z0: 0.44, z1: 1.18 }, // walk-in opening beside the desk (photo 252 looks through it)
  low: 2.32, // underside of the timber transom
  upper: { v0: 2.55, v1: 4.85 },
};
/**
 * Bedroom south and skewed west walls: glass in two columns (owner), sized from the scan's
 * elevations and photo 218 — south x −4.25 … −6.29, west z 1.45 … −0.36 (u along each wall).
 * Lower panes floor → 2.53 behind taupe blinds; upper panes 2.53 → 3.70 (the partition's mid bar),
 * uncovered.
 */
export const BED_GLASS = { 'bed-south': [0.55, 2.59], 'bed-west': [1.13, 2.98], vMid: 2.53, v1: 3.7 } as const;

export function wallSpecs(): Spec[] {
  const m = ausMaterials();
  const W: Spec[] = [];
  const push = (s: Spec) => (W.push(s), s);

  push({ name: 'north', a: [X_W, Z_N], b: [X_E, Z_N], t: 0.2, h: H });
  {
    const a: P = [X_E, Z_N], b: P = [X_E, Z_BATH_S];
    push({ name: 'east', a, b, t: 0.2, h: H, openings: [{ ...rect(a, b, FRONT_DOOR.z0, FRONT_DOOR.z1, 0, FRONT_DOOR.h) }] });
  }
  {
    const a: P = [X_E, Z_HALL_S], b: P = [X_KE, Z_HALL_S];
    push({ name: 'bath-north', a, b, t: Z_BATH_N - Z_HALL_S, h: H, ext: [0.3, 0], openings: [rect(a, b, BATH_DOOR.x0, BATH_DOOR.x1, 0, BATH_DOOR.h)] });
  }
  push({ name: 'kitchen-east', a: [X_KE, Z_HALL_S], b: [X_KE, Z_KS], t: 0.3, h: H, ext: [0, 0.3], skirting: false });
  {
    const a: P = [X_KE, Z_KS], b: P = [X_PIER_E, Z_KS];
    push({ name: 'kitchen-south', a, b, t: 0.2, h: H, skirting: false, openings: [rect(a, b, KITCHEN_WINDOW.x0, KITCHEN_WINDOW.x1, KITCHEN_WINDOW.v0, KITCHEN_WINDOW.v1)] });
  }
  push({ name: 'pier-east', a: [X_PIER_E, Z_KS], b: [X_PIER_E, Z_PIER], t: 0.2, h: H, ext: [0.3, 0], skirting: false });
  push({ name: 'pier-south', a: [X_PIER_E, Z_PIER], b: [X_PIER_W, Z_PIER], t: 0.46, h: H, ext: [0, 0] });
  push({ name: 'pier-west', a: [X_PIER_W, Z_PIER], b: [X_PIER_W, Z_S], t: 0.2, h: H, ext: [0, 0.3] });
  {
    const a: P = [X_PIER_W, Z_S], b: P = [X_W, Z_S];
    push({
      name: 'south', a, b, t: 0.2, h: H,
      openings: [rect(a, b, SOFA_WINDOW.x0, SOFA_WINDOW.x1, SOFA_WINDOW.v0, SOFA_WINDOW.v1)],
    });
  }
  // solid living-room wall north of the bedroom (scan face x −3.30)
  push({ name: 'west', a: [X_W, BED_N], b: [X_W, Z_N], t: X_W - X_BED, h: H, ext: [0, 0.3] });
  {
    // the thin glazed partition between the living room and the double-height bedroom: 14 cm, the
    // depth of the two door tracks (owner), so its jambs match the door frames. It faces the living
    // room; the bedroom sees its back (x −3.70).
    const a: P = [X_P, Z_S], b: P = [X_P, BED_N];
    const P_ = PARTITION;
    push({
      name: 'partition', a, b, t: X_P - X_BED, h: BED_H, trim: m.timber,
      openings: [
        // one opening for all four sliding panels; the post between them is a slim stile (fixtures)
        rect(a, b, P_.north.z0, P_.south.z1, 0, P_.low),
        rect(a, b, P_.north.z0, P_.south.z1, P_.upper.v0, P_.upper.v1),
      ],
    });
  }
  // bathroom (its north wall is 'bath-north' seen from the hall)
  push({ name: 'bath-west', a: [X_BATH_W, Z_BATH_S], b: [X_BATH_W, Z_BATH_N], t: 0.14, h: H, ext: [0.3, 0.08], material: m.wall, skirting: false });
  push({ name: 'bath-south', a: [X_E, Z_BATH_S], b: [X_BATH_W, Z_BATH_S], t: 0.15, h: H, skirting: false });
  push({ name: 'bath-mid', a: [X_E, Z_BATH_MID], b: [4.75, Z_BATH_MID], t: 0.11, h: H, ext: [0.3, 0], skirting: false });
  // bedroom
  push({ name: 'bed-north', a: [BED_W1, BED_N], b: [X_BED, BED_N], t: 0.2, h: BED_H, material: m.wallWarm, trim: m.skirtingTimber });
  {
    const a: P = [X_BED, BED_S], b: P = [BED_SKEW[0][0], BED_S];
    push({ name: 'bed-south', a, b, t: 0.2, h: BED_H, material: m.wallWarm, trim: m.skirtingTimber, openings: [{ kind: 'rect', u0: BED_GLASS['bed-south'][0], u1: BED_GLASS['bed-south'][1], v0: 0, v1: BED_GLASS.v1 }] });
  }
  {
    const [a, b] = BED_SKEW;
    push({ name: 'bed-west', a, b, t: 0.2, h: BED_H, material: m.wallWarm, trim: m.skirtingTimber, openings: [{ kind: 'rect', u0: BED_GLASS['bed-west'][0], u1: BED_GLASS['bed-west'][1], v0: 0, v1: BED_GLASS.v1 }] });
  }
  push({ name: 'bed-west-n', a: [BED_W1, -0.55], b: [BED_W1, BED_N], t: 0.2, h: BED_H, material: m.wallWarm, trim: m.skirtingTimber });
  return W;
}

// ---- floors / ceilings ------------------------------------------------------------------------

export function flat(poly: P[], y: number, material: THREE.Material, facingUp: boolean, holes: P[][] = []) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, facingUp ? -z : z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, facingUp ? -z : z))));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
  boxUV(geo);
  const m = mesh(geo, material);
  m.position.y = y;
  m.castShadow = false;
  return m;
}

export const BEDROOM_POLY: P[] = [[BED_W1, BED_N], [X_BED, BED_N], [X_BED, BED_S], BED_SKEW[0], BED_SKEW[1], [BED_W1, -0.55]];
export const MAIN_POLY: P[] = [
  [X_W, Z_N], [X_E, Z_N], [X_E, Z_HALL_S], [X_KE, Z_HALL_S], [X_KE, Z_KS], [X_PIER_E, Z_KS], [X_PIER_E, Z_PIER],
  [X_PIER_W, Z_PIER], [X_PIER_W, Z_S], [X_W, Z_S],
];

export function floors() {
  const m = ausMaterials();
  const g = new THREE.Group();
  g.name = 'floors';
  const main = flat(MAIN_POLY, 0, m.floorWood, true);
  main.name = 'floor-laminate';
  // tiles: galley (from the peninsula's back to the kitchen wall) and the bathroom
  const galley = flat([[2.24, Z_HALL_S], [X_KE, Z_HALL_S], [X_KE, Z_KS], [2.24, Z_KS]], 0.003, m.kitchenTile, true);
  const bath = flat([[X_BATH_W, Z_BATH_N], [X_E, Z_BATH_N], [X_E, Z_BATH_S], [X_BATH_W, Z_BATH_S]], 0.003, m.bathTile, true);
  const bed = flat(BEDROOM_POLY, 0, m.carpet, true);
  // door thresholds: tiles run through the bathroom doorway to the hall face
  const sill = flat([[BATH_DOOR.x0, Z_HALL_S], [BATH_DOOR.x1, Z_HALL_S], [BATH_DOOR.x1, Z_BATH_N], [BATH_DOOR.x0, Z_BATH_N]], 0.004, m.bathTile, true);
  // under the glazed partition: a pine threshold only as deep as the two sliding-door tracks
  // (leaves at x −3.675 … −3.575), laminate from there to the living room under the blinds
  const zA = BED_N, zB = Z_S, xTrack = X_P;
  const bedSill = boxSpan([X_BED, 0, zA], [xTrack, 0.012, zB], m.timber);
  bedSill.castShadow = false;
  const under = flat([[xTrack, zA], [X_W, zA], [X_W, zB], [xTrack, zB]], 0, m.floorWood, true);
  for (const f of [main, galley, bath, bed, sill, bedSill, under]) f.receiveShadow = true;
  g.add(main, galley, bath, bed, sill, bedSill, under);
  return g;
}

export function ceilings() {
  const m = ausMaterials();
  const g = new THREE.Group();
  g.name = 'ceiling';
  // main ceiling, notched around the stair void
  const poly: P[] = [
    [X_W, Z_N], [VOID.x0, Z_N], [VOID.x0, VOID.z1], [VOID.x1, VOID.z1], [VOID.x1, Z_N], [X_E, Z_N], [X_E, Z_HALL_S],
    [X_KE, Z_HALL_S], [X_KE, Z_KS], [X_PIER_E, Z_KS], [X_PIER_E, Z_PIER], [X_PIER_W, Z_PIER], [X_PIER_W, Z_S], [X_W, Z_S],
  ];
  g.add(flat(poly, H, m.ceiling, false));
  // over the recess in front of the thin partition
  g.add(flat([[X_P, BED_N], [X_W, BED_N], [X_W, Z_S], [X_P, Z_S]], H, m.ceiling, false));
  // kitchen bulkhead (scan: underside 2.20, face at z 1.75)
  g.add(boxSpan([0.75, 2.2, 1.75], [X_KE, H + 0.01, Z_KS], m.ceiling));
  // bathroom: two ceiling heights and the header over the WC/laundry passage
  g.add(flat([[X_BATH_W, Z_BATH_N], [X_E, Z_BATH_N], [X_E, Z_BATH_MID], [X_BATH_W, Z_BATH_MID]], 2.28, m.ceiling, false));
  g.add(flat([[X_BATH_W, Z_BATH_MID], [X_E, Z_BATH_MID], [X_E, Z_BATH_S], [X_BATH_W, Z_BATH_S]], 2.12, m.ceiling, false));
  g.add(boxSpan([X_BATH_W, 2.12, Z_BATH_MID], [4.75, H, Z_BATH_MID + 0.11], m.wall));
  // bedroom
  g.add(flat(BEDROOM_POLY, BED_H, m.ceiling, false));
  // stair void: slab edge + shaft to the upper floor. Not scanned above ~2.6 m: approximate.
  const top = 4.9;
  g.add(boxSpan([VOID.x0, H, VOID.z1], [VOID.x1 + 0.15, 2.62, VOID.z1 + 0.15], m.ceiling)); // south fascia
  g.add(boxSpan([VOID.x1, H, Z_N], [VOID.x1 + 0.15, top, VOID.z1], m.wall)); // east shaft wall
  g.add(boxSpan([VOID.x0 - 0.3, H, Z_N - 0.2], [VOID.x1 + 0.15, top, Z_N], m.wall)); // north shaft wall
  // the shaft is closed in white all round up to its lid (owner; photos 44–45): the south wall runs
  // from the slab edge to the top, and a west end wall closes it over the head of the stair
  g.add(boxSpan([VOID.x0 - 0.3, 2.62, VOID.z1], [VOID.x1 + 0.15, top, VOID.z1 + 0.1], m.wall)); // south shaft wall
  g.add(boxSpan([VOID.x0 - 0.45, H, Z_N - 0.2], [VOID.x0 - 0.3, top, VOID.z1 + 0.1], m.wall)); // west shaft wall
  const lid = flat([[VOID.x0 - 0.3, Z_N], [VOID.x1, Z_N], [VOID.x1, VOID.z1], [VOID.x0 - 0.3, VOID.z1]], top, m.ceiling, false);
  g.add(lid);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
  return g;
}

export function buildWalls() {
  return wallSpecs().map((s) => {
    const d = def(s);
    const group = buildWall(d, ausMaterials());
    return { def: d, group };
  });
}

/** Inside the walkable floor (living level or bedroom), with a margin. */
export function insideFloor(x: number, z: number) {
  const inPoly = (poly: P[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const inBath = x > X_BATH_W && x < X_E && z > Z_BATH_N && z < Z_BATH_S;
  const inKitchenBlock = x > X_KE && x < X_BATH_W && z > Z_HALL_S;
  // through the open slider, across the partition's 0.40 m depth (x −3.70 … −3.30)
  const inPassage = x > X_BED - 0.01 && x < X_W + 0.01 && z > PARTITION.gap.z0 && z < PARTITION.gap.z1;
  // through the bathroom doorway, across the wall's 0.08 m depth (z −0.93 … −0.85) (owner: walk in)
  const inBathDoor = x > BATH_DOOR.x0 && x < BATH_DOOR.x1 && z > Z_HALL_S - 0.01 && z < Z_BATH_N + 0.01;
  return (inPoly(MAIN_POLY) && !inKitchenBlock) || inPoly(BEDROOM_POLY) || inBath || inPassage || inBathDoor;
}
