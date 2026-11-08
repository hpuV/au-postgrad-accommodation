import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, boxSpan, cushion, cylinder, lathe, mesh, pillow, place, sphere, tube } from '../../packages/room-runtime/helpers';
import { mulberry32 } from '../../packages/room-runtime/materials';
import { ausMaterials } from './materials';
import { FIXED, item, lift, movable, tagged } from './items';
import { buildWorkstation } from './workstation';

/*
 * Footprints from the scan (2nd–98th percentile of vertices in a box):
 *   sofa        x −2.38 … −0.07  z 1.61 … 2.59  (seat 0.45, back 1.0 incl. clutter)
 *   dining      x −1.02 … 0.58   z −0.19 … 0.53  top 0.75
 *   desks       x −3.28 … −2.24 and −1.76 … −0.46  z −2.84 … −2.22 top 0.74 (cart in the gap)
 *   wardrobe    IKEA KLEPPSTAD 79 × 55 × 176 (owner), x −0.19 … 0.6 (+ cartons on top)
 *   shelving    x 0.55 … 1.87    z −2.83 … −2.22 (under the stair)
 *   cube shelf  x 0.46 … 1.18    z 1.82 … 2.16  top ≈ 1.0
 *   bed         90 × 200 frame (owner)
 *   bed desk    LAGKAPTEN/ALEX 120 × 60 × 73 (owner, workstation.ts)
 *   racks       one IKEA FROST 134 × 59 × 93 (owner) along the skewed west wall
 *   suitcases   x −5.83 … −4.71  z −1.70 … −0.94
 *
 * Every piece is its own named group with userData.physics (items.ts), so it shows up in the
 * Knolling view and in play mode; things standing on furniture are separate items.
 */
export function buildFurniture() {
  const g = new THREE.Group();
  g.name = 'furniture';
  g.add(...sofa(), hammarnSofa(), ...dining(), ...desks(), ...wardrobe(), ...stairShelf(), ...cubeShelf(), ...peninsulaClutter(), tripodLamp());
  g.add(...bed(), ...buildWorkstation(), ...racks(), ...luggage());
  return g;
}

// ---- white perforated stacking chair (owner's photo; IKEA ADDE/SANDSBERG-type) -----------------
// W 39 × D 47 × H 77 cm, seat 39 × 34 cm at 45 cm. Seat toward local +z.

let perforated: { seat: THREE.MeshStandardMaterial; back: THREE.MeshStandardMaterial; tube: THREE.MeshStandardMaterial; rim: THREE.MeshStandardMaterial } | undefined;
/** White plastic with a round-hole grid cut out by an alpha map (holes only inside a margin). */
function chairMaterials() {
  if (perforated) return perforated;
  const holes = (w: number, h: number, cols: number, rows: number, margin: number) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round((512 * h) / w);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    const mx = c.width * margin, my = c.height * margin * (w / h);
    const sx = (c.width - 2 * mx) / (cols - 1), sy = (c.height - 2 * my) / (rows - 1);
    const r = Math.min(sx, sy) * 0.3;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.beginPath();
      ctx.arc(mx + i * sx, my + j * sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  };
  const plastic = (alphaMap: THREE.Texture) => new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.45, alphaMap, alphaTest: 0.5, side: THREE.DoubleSide });
  perforated = {
    seat: plastic(holes(0.39, 0.34, 12, 10, 0.12)),
    back: plastic(holes(0.38, 0.17, 12, 5, 0.09)),
    tube: new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.35, metalness: 0.25 }),
    rim: new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.45 }),
  };
  return perforated;
}

function whiteChair() {
  const mats = chairMaterials();
  const c = new THREE.Group();
  const SW = 0.39, SD = 0.34, SH = 0.45, sz = 0.02; // seat centered at z 0.02 (front edge 0.19)
  // seat: slight dish, rolled-down front edge
  const seat = new THREE.PlaneGeometry(SW, SD, 16, 12).rotateX(-Math.PI / 2);
  const p = seat.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = -0.012 * (1 - (2 * x / SW) ** 2) * (1 - (2 * z / SD) ** 2);
    if (z > SD / 2 - 0.05) y -= (z - (SD / 2 - 0.05)) ** 2 * 6;
    if (z < -SD / 2 + 0.04) y += (-SD / 2 + 0.04 - z) * 0.4;
    p.setY(i, y);
  }
  seat.computeVertexNormals();
  const seatMesh = new THREE.Mesh(seat, mats.seat);
  seatMesh.position.set(0, SH, sz);
  // rim under the seat edge gives the shell its thickness
  const rimH = 0.025;
  const rim = [
    box([SW, rimH, 0.012], [0, SH - rimH / 2 - 0.01, sz + SD / 2 - 0.01], mats.rim),
    box([SW, rimH, 0.012], [0, SH - rimH / 2 + 0.01, sz - SD / 2 + 0.006], mats.rim),
    box([0.012, rimH, SD], [-SW / 2 + 0.006, SH - rimH / 2, sz], mats.rim),
    box([0.012, rimH, SD], [SW / 2 - 0.006, SH - rimH / 2, sz], mats.rim),
  ];
  // backrest: a band curved around the sitter, tilted back, top at 0.77
  const BW = 0.38, BH = 0.17;
  const backGeo = new THREE.PlaneGeometry(BW, BH, 16, 4);
  const bp = backGeo.getAttribute('position');
  for (let i = 0; i < bp.count; i++) bp.setZ(i, ((2 * bp.getX(i)) / BW) ** 2 * 0.035);
  backGeo.computeVertexNormals();
  const back = new THREE.Mesh(backGeo, mats.back);
  back.position.set(0, 0.77 - BH / 2 - 0.005, -0.215);
  back.rotation.x = -0.14;
  const backRim = box([BW, 0.012, 0.03], [0, 0.765, -0.205], mats.rim);
  backRim.rotation.x = -0.14;
  // white steel tube frame: splayed front legs, rear legs running up to carry the backrest
  const r = 0.0095;
  const frame: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    frame.push(tube([[s * 0.175, 0, 0.215], [s * 0.172, SH - 0.03, 0.16]], r, mats.tube, 4));
    frame.push(tube([[s * 0.178, 0, -0.255], [s * 0.174, SH - 0.03, -0.14], [s * 0.18, 0.62, -0.2], [s * 0.18, 0.76, -0.225]], r, mats.tube, 24));
    frame.push(tube([[s * 0.172, SH - 0.03, 0.16], [s * 0.174, SH - 0.03, -0.14]], r, mats.tube, 4)); // seat rail
    for (const z of [0.215, -0.255]) frame.push(cylinder(r * 1.15, 0.01, [s * (z > 0 ? 0.175 : 0.178), 0.005, z], ausMaterials().darkGrey, 10));
  }
  for (const o of [seatMesh, back]) { o.castShadow = true; o.receiveShadow = true; }
  c.add(seatMesh, ...rim, back, backRim, ...frame);
  return c;
}

/** Tube along a smooth path whose radius tapers r0 → r1, flattened front-to-back like hanging cloth. */
function taperTube(pts: [number, number, number][], r0: number, r1: number, mat: THREE.Material, flat = 0.65, seg = 24, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg);
    const r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r);
      v.z *= flat;
      pos.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * Black jacket hung over the white chair's backrest (owner + photos 132, 141), in the chair's local
 * frame. Its front faces outward (away from the seat): a short panel over the backrest, narrow
 * shoulders on the top rail, the body hanging behind the chair and flaring to the hem with folds that
 * deepen downward, a centre zip, two pocket flaps, sleeves hanging at both sides, rib cuffs + hem.
 */
function jacketOnChair(color = '#2a2a2e') {
  const shell = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#6a6a72'), side: THREE.DoubleSide,
  });
  const rib = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.95 });
  const zipMat = new THREE.MeshStandardMaterial({ color: '#8d8f92', metalness: 0.8, roughness: 0.35 });
  const g = new THREE.Group();

  // cross-section of the drape in the chair's (z, y) plane: front → over the top rail → down the back
  const profile = new THREE.CatmullRomCurve3([
    [0, 0.61, -0.178], [0, 0.7, -0.188], [0, 0.778, -0.205], [0, 0.802, -0.235], [0, 0.778, -0.264],
    [0, 0.66, -0.29], [0, 0.48, -0.31], [0, 0.3, -0.33], [0, 0.13, -0.35],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const TOP = 0.27; // fraction of the profile where it crosses the top rail
  const X = new THREE.Vector3(1, 0, 0);
  const hangOf = (t: number) => Math.max(0, (t - TOP) / (1 - TOP));
  const halfOf = (t: number) => {
    const hang = hangOf(t), front = Math.max(0, (TOP - t) / TOP);
    return 0.215 + 0.075 * Math.pow(hang, 0.8) - 0.02 * front; // narrow shoulders, flared hem
  };
  /** point on the jacket surface: x across (m), t along the profile (0 front … 1 hem), lift off the cloth */
  const surf = (x: number, t: number, lift = 0) => {
    const p = profile.getPointAt(t);
    const n = new THREE.Vector3().crossVectors(profile.getTangentAt(t), X).normalize(); // away from the backrest
    const hang = hangOf(t), half = halfOf(t), e = Math.min(1, Math.abs(x) / half);
    const curl = 0.035 * e * e * (1 - hang) + 0.05 * e ** 4 * hang; // hugs the curved backrest, sides wrap in
    const folds = (0.004 + 0.034 * hang) * Math.sin(x * 21 + 0.9) + 0.012 * hang * Math.sin(x * 47 + 2.1) * Math.sin(t * 8 + 1);
    const q = p.addScaledVector(n, folds + lift).add(new THREE.Vector3(x, 0, curl));
    q.y += hang * (0.018 * Math.cos(x * 15) + 0.02 * x); // uneven, slightly tilted hem
    return q;
  };

  const NU = 32, NV = 56;
  const positions: number[] = [], uvs: number[] = [], index: number[] = [];
  for (let j = 0; j <= NV; j++) {
    const t = j / NV, half = halfOf(t);
    for (let i = 0; i <= NU; i++) {
      const x = (i / NU * 2 - 1) * half;
      const q = surf(x, t);
      positions.push(q.x, q.y, q.z);
      uvs.push(x * 3, t * 3);
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + NU + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  body.setIndex(index);
  body.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(body, shell);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  g.add(bodyMesh);

  const along = (x: number, t0: number, t1: number, lift: number, n = 16) =>
    Array.from({ length: n + 1 }, (_, k) => surf(x, t0 + ((t1 - t0) * k) / n, lift).toArray() as [number, number, number]);
  // centre zip on the outward face, and the stand-up collar along the top rail
  g.add(taperTube(along(0, TOP + 0.03, 0.985, 0.006, 24), 0.0045, 0.0045, zipMat, 1, 24, 6));
  g.add(taperTube([-0.19, -0.1, 0, 0.1, 0.19].map((x) => surf(x, TOP + 0.02, 0.012).toArray() as [number, number, number]), 0.022, 0.022, shell, 0.55, 12, 10));
  // pocket flaps: short raised bands across the lower body
  for (const s of [-1, 1]) {
    const pts = [0.07, 0.12, 0.17].map((x) => surf(s * x, 0.8, 0.008).toArray() as [number, number, number]);
    g.add(taperTube(pts, 0.012, 0.012, shell, 0.45, 6, 8));
  }
  // rib hem band
  const hem = [-1, -0.5, 0, 0.5, 1].map((k) => surf(k * (halfOf(0.99) - 0.01), 0.99, 0.006).toArray() as [number, number, number]);
  g.add(taperTube(hem, 0.016, 0.016, rib, 0.5, 16, 8));
  // sleeves from the shoulders, hanging outside the body at both sides, rib cuffs
  const sleeves: [number, number, number][][] = [
    [[-0.2, 0.775, -0.25], [-0.262, 0.67, -0.27], [-0.285, 0.47, -0.285], [-0.275, 0.27, -0.28]],
    [[0.2, 0.775, -0.25], [0.265, 0.65, -0.262], [0.29, 0.45, -0.262], [0.272, 0.3, -0.246]],
  ];
  for (const s of sleeves) {
    g.add(taperTube(s, 0.044, 0.034, shell, 0.6));
    const a = new THREE.Vector3(...s[2]), b = new THREE.Vector3(...s[3]);
    const end = b.clone().addScaledVector(b.clone().sub(a).normalize(), 0.06);
    g.add(taperTube([b.toArray() as [number, number, number], end.toArray() as [number, number, number]], 0.035, 0.032, rib, 0.65, 2, 12));
  }
  return g;
}

// ---- living / dining --------------------------------------------------------------------------

/**
 * Orange cushion cover printed with a simplified University of Sydney crest and wordmark (owner's
 * reference): black shield with a lion in the chief, a cross with four stars and an open book, the
 * two-line wordmark underneath, all black on the university's orange.
 */
function usydCushionMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  const OR = '#e64626', BK = '#121212';
  x.fillStyle = OR; x.fillRect(0, 0, 512, 512);
  // keep the print clear of the pinched seams
  x.translate(256, 250); x.scale(0.74, 0.74); x.translate(-256, -265);
  // shield outline
  const shield = (inset: number) => {
    x.beginPath();
    x.moveTo(146 + inset, 58 + inset);
    x.quadraticCurveTo(256, 42 + inset, 366 - inset, 58 + inset);
    x.lineTo(366 - inset, 190);
    x.quadraticCurveTo(360 - inset, 300 - inset, 256, 336 - inset * 1.4);
    x.quadraticCurveTo(152 + inset, 300 - inset, 146 + inset, 190);
    x.closePath();
  };
  x.fillStyle = BK; shield(0); x.fill();
  x.fillStyle = OR; shield(10); x.fill();
  // chief: black band with an orange lion passant
  x.save(); shield(10); x.clip();
  x.fillStyle = BK; x.fillRect(140, 50, 240, 92);
  x.fillStyle = OR;
  x.beginPath(); x.ellipse(268, 102, 52, 18, 0, 0, Math.PI * 2); x.fill(); // body
  x.beginPath(); x.arc(212, 88, 22, 0, Math.PI * 2); x.fill(); // head + mane
  for (const lx of [226, 246, 286, 306]) x.fillRect(lx, 110, 9, 24); // legs
  x.beginPath(); x.moveTo(318, 96); x.quadraticCurveTo(352, 70, 340, 62); x.lineWidth = 6; x.strokeStyle = OR; x.stroke(); // tail
  x.fillStyle = BK; x.beginPath(); x.arc(206, 86, 3, 0, Math.PI * 2); x.arc(218, 86, 3, 0, Math.PI * 2); x.fill(); // eyes
  // cross with four stars and an open book at the centre
  x.fillStyle = BK;
  x.fillRect(226, 142, 60, 200);
  x.fillRect(140, 196, 240, 56);
  const star = (cx: number, cy: number, r: number) => {
    x.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath(); x.fill();
  };
  x.fillStyle = OR;
  star(256, 168, 17); star(256, 296, 17); star(176, 224, 17); star(336, 224, 17);
  x.fillRect(232, 208, 22, 32); x.fillRect(258, 208, 22, 32); // book pages
  x.fillStyle = BK; for (let i = 0; i < 4; i++) { x.fillRect(236, 214 + i * 6, 14, 2); x.fillRect(262, 214 + i * 6, 14, 2); }
  x.restore();
  // wordmark
  x.fillStyle = BK;
  x.textAlign = 'center';
  x.font = '34px "Times New Roman", Georgia, serif';
  x.fillText('THE UNIVERSITY OF', 256, 396);
  x.font = '84px "Times New Roman", Georgia, serif';
  x.fillText('SYDNEY', 256, 478);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
}

// grey click-clack sofa bed with chrome legs (IMG_0212, photos 183, 255)
function sofa() {
  const m = ausMaterials();
  const g = new THREE.Group();
  const W = 1.92, D = 0.92;
  g.add(cushion([W, 0.2, D - 0.22], [0, 0.34, 0.1], 0.06, m.sofaFabric));
  for (let i = 0; i < 3; i++) g.add(cushion([W / 3 - 0.01, 0.07, D - 0.26], [(-1 + i) * (W / 3), 0.46, 0.1], 0.03, m.sofaFabric));
  const back = cushion([W, 0.55, 0.2], [0, 0.68, -0.31], 0.06, m.sofaFabric);
  back.rotation.x = -0.18;
  g.add(back);
  for (let i = 0; i < 3; i++) {
    const p = cushion([W / 3 - 0.01, 0.48, 0.07], [(-1 + i) * (W / 3), 0.7, -0.2], 0.03, m.sofaFabric);
    p.rotation.x = -0.18;
    g.add(p);
  }
  g.add(boxSpan([-W / 2 + 0.05, 0.2, -0.38], [W / 2 - 0.05, 0.24, 0.36], m.steel));
  for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) for (const z of [-0.33, 0.33]) g.add(cylinder(0.015, 0.2, [x, 0.1, z], m.steel, 10));
  // orange University of Sydney cushion seen in every living-room photo (owner)
  const p = pillow([0.4, 0.4, 0.12], usydCushionMaterial());
  {
    const pos = p.geometry.getAttribute('position'), uv = p.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.4 + 0.5, pos.getY(i) / 0.4 + 0.5); // print flat on both faces
    uv.needsUpdate = true;
  }
  p.position.set(0.55, 0.62, -0.05);
  p.rotation.set(-0.5, 0.2, 0.1);
  g.add(p);
  place(g, [-1.24, 0, 2.12], Math.PI);
  const cushionItem = item('usyd-cushion', movable(0.4, 'soft'), lift(g, p));
  return [tagged(g, 'sofa-bed', movable(40, 'soft')), cushionItem];
}

// pine dining table, 160 × 90 (owner: big enough for the six-person hotpot set-up), two ladder-back
// chairs per long side (IMG_0212; photos 159, 162, 294); a hotpot dinner laid out on it (owner)
function dining() {
  const m = ausMaterials();
  const L = 1.6, D = 0.9, T = 0.75;
  const table = new THREE.Group();
  table.add(box([L, 0.03, D], [0, T - 0.015, 0], m.pine));
  table.add(box([L - 0.1, 0.08, D - 0.1], [0, T - 0.07, 0], m.pineDark));
  for (const x of [-L / 2 + 0.06, L / 2 - 0.06]) for (const z of [-D / 2 + 0.06, D / 2 - 0.06]) table.add(box([0.06, T - 0.03, 0.06], [x, (T - 0.03) / 2, z], m.pine));
  const cx = -0.22, cz = 0.17;
  const out: THREE.Object3D[] = [tagged(place(table, [cx, 0, cz]), 'dining-table', movable(22, 'wood', 'compound'))];
  const chair = () => {
    const c = new THREE.Group();
    c.add(box([0.42, 0.03, 0.42], [0, 0.45, 0], m.pine));
    for (const x of [-0.18, 0.18]) {
      c.add(box([0.035, 0.45, 0.035], [x, 0.225, 0.18], m.pine));
      c.add(box([0.035, 0.92, 0.035], [x, 0.46, -0.18], m.pine));
    }
    for (const y of [0.62, 0.78, 0.9]) c.add(box([0.36, 0.05, 0.02], [0, y, -0.18], m.pine));
    c.add(box([0.36, 0.02, 0.02], [0, 0.2, 0.18], m.pine));
    return c;
  };
  ([[-0.4, -0.67, 0], [0.4, -0.67, 0], [-0.4, 0.67, Math.PI], [0.4, 0.71, Math.PI + 0.1]] as const).forEach(([x, z, r], i) =>
    out.push(tagged(place(chair(), [cx + x, 0, cz + z], r), `dining-chair-${i + 1}`, movable(5, 'wood', 'compound'))));
  out.push(...hotpotSpread(cx, cz, T, L, D));
  return out;
}

// ---- hotpot dinner on the dining table (owner) ---------------------------------------------------

/** IKEA TILLREDA portable induction hob: 27 × 30.5 × 6.2 cm, black glass top with the white cross
 *  marking and touch controls at the front, dark body with side vents, wire handle at the back. Local: controls toward +z. */
function tillreda() {
  const glassTex = (() => {
    const c = document.createElement('canvas');
    c.width = 270; c.height = 305;
    const x = c.getContext('2d')!;
    x.fillStyle = '#0c0d0f'; x.fillRect(0, 0, 270, 305);
    x.strokeStyle = '#d8d8d8'; x.lineWidth = 2;
    const cx = 135, cy = 120;
    x.beginPath(); x.moveTo(cx - 80, cy); x.lineTo(cx - 12, cy); x.moveTo(cx + 12, cy); x.lineTo(cx + 80, cy);
    x.moveTo(cx, cy - 80); x.lineTo(cx, cy - 12); x.moveTo(cx, cy + 12); x.lineTo(cx, cy + 80); x.stroke();
    x.fillStyle = '#d8d8d8'; x.fillRect(cx - 2, cy - 2, 4, 4);
    x.beginPath(); x.moveTo(18, 30); x.lineTo(30, 10); x.lineTo(42, 30); x.closePath(); x.stroke(); // hot-surface sign
    x.font = '16px Arial'; x.textAlign = 'center';
    ['O', '−', '8', '+', '□'].forEach((s, i) => x.fillText(s, 75 + i * 30, 280));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  })();
  const W = 0.27, D = 0.305, H = 0.062;
  const body = new THREE.MeshStandardMaterial({ color: '#2b2c2f', roughness: 0.55 });
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(W, H - 0.012, D, 4, 0.015), body), [0, 0.006 + (H - 0.012) / 2, 0]));
  const top = mesh(new RoundedBoxGeometry(W, 0.006, D, 2, 0.003), [body, body, new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.08, metalness: 0.2 }), body, body, body]);
  top.position.y = H - 0.003;
  g.add(top);
  for (let i = 0; i < 6; i++) g.add(box([0.002, 0.018, 0.05], [W / 2 + 0.001, 0.03, -0.06 + i * 0.012], new THREE.MeshStandardMaterial({ color: '#111' }))); // side vents
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cylinder(0.012, 0.006, [sx * (W / 2 - 0.03), 0.003, sz * (D / 2 - 0.03)], body, 12));
  g.add(tube([[-0.03, H - 0.01, -D / 2], [-0.03, H + 0.01, -D / 2 - 0.035], [0.03, H + 0.01, -D / 2 - 0.035], [0.03, H - 0.01, -D / 2]], 0.004, new THREE.MeshStandardMaterial({ color: '#b9bcbf', metalness: 0.8, roughness: 0.3 }), 16));
  return g;
}

/** Stainless split ("yuanyang") hotpot, Ø 28 cm: S-shaped divider, one side mala broth, the other tomato. Local: handles along x. */
function yuanyangHotpot() {
  const steel = new THREE.MeshStandardMaterial({ color: '#d7dadc', roughness: 0.18, metalness: 0.95, side: THREE.DoubleSide });
  const R = 0.14, H = 0.1, soup = 0.075;
  const g = new THREE.Group();
  g.add(lathe([[0.001, 0], [R - 0.03, 0], [R - 0.005, 0.015], [R, 0.05], [R, H], [R + 0.008, H + 0.004]], steel, 48));
  for (const s of [-1, 1]) g.add(tube([[s * (R - 0.005), H - 0.02, -0.05], [s * (R + 0.045), H - 0.01, -0.045], [s * (R + 0.045), H - 0.01, 0.045], [s * (R - 0.005), H - 0.02, 0.05]], 0.006, steel, 16));
  // yin-yang halves (shape x → x, shape y → −z after rotation)
  const half = () => {
    const s = new THREE.Shape();
    const r = R - 0.004;
    s.moveTo(0, r);
    s.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
    s.absarc(0, -r / 2, r / 2, -Math.PI / 2, Math.PI / 2, false);
    s.absarc(0, r / 2, r / 2, -Math.PI / 2, Math.PI / 2, true);
    return s;
  };
  const broth = (color: string, rotate: number) => {
    const m = mesh(new THREE.ShapeGeometry(half(), 32).rotateX(-Math.PI / 2).rotateY(rotate), new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.1 }));
    m.position.y = soup;
    return m;
  };
  g.add(broth('#6a1408', 0), broth('#e6702f', Math.PI)); // dark chilli-oil mala | orange tomato
  // S-shaped divider wall
  const pts: THREE.Vector3[] = [];
  const r = R - 0.004;
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * r / 2, 0, -(-r / 2 + Math.sin(a) * r / 2))); }
  for (let i = 1; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI; pts.push(new THREE.Vector3(-Math.cos(a) * r / 2, 0, -(r / 2 + Math.sin(a) * r / 2))); }
  const pos: number[] = [], idx: number[] = [];
  pts.forEach((p, i) => { pos.push(p.x, 0.005, p.z, p.x, H - 0.005, p.z); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); });
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wall.setIndex(idx);
  wall.computeVertexNormals();
  g.add(mesh(wall, steel));
  // chilli flakes, Sichuan pepper and scallion on the mala side; tomato wedges on the other
  const rnd = mulberry32(88);
  const chilli = new THREE.MeshStandardMaterial({ color: '#5e0c08', roughness: 0.4 });
  const scallion = new THREE.MeshStandardMaterial({ color: '#4f9a35', roughness: 0.5 });
  const tomato = new THREE.MeshStandardMaterial({ color: '#c8331f', roughness: 0.3 });
  for (let i = 0; i < 14; i++) {
    const a = Math.PI / 2 + rnd() * Math.PI, d = 0.04 + rnd() * 0.07;
    g.add(box([0.014, 0.003, 0.006], [Math.cos(a) * d, soup + 0.002, -Math.sin(a) * d], i % 3 ? chilli : scallion).rotateY(rnd() * Math.PI));
  }
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + rnd() * Math.PI, d = 0.04 + rnd() * 0.06;
    g.add(sphere(1, [Math.cos(a) * d, soup + 0.002, -Math.sin(a) * d], tomato, [0.016, 0.008, 0.012]));
  }
  return g;
}

/** Three stacked trays of rolled beef slices (one item): clear lid, pink-and-white rolls in rows, black label band. */
function beefTrays() {
  const clear = new THREE.MeshStandardMaterial({ color: '#eef3f5', roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
  const beefTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#d98f8b'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = '#f7ece6'; x.lineWidth = 3;
    for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(0, i * 10 + 3); x.bezierCurveTo(20, i * 10 - 3, 40, i * 10 + 8, 64, i * 10 + 2); x.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const beef = new THREE.MeshStandardMaterial({ map: beefTex, roughness: 0.6 });
  const label = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.5 });
  const W = 0.22, D = 0.14, H = 0.04;
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const tray = new THREE.Group();
    tray.add(box([W, 0.004, D], [0, 0.002, 0], new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.5 })));
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
      tray.add(cylinder(0.014, 0.04, [-W / 2 + 0.022 + i * 0.035, 0.018, -D / 2 + 0.025 + row * 0.045], beef, 10).rotateX(Math.PI / 2));
    }
    tray.add(place(mesh(new RoundedBoxGeometry(W, H, D, 2, 0.008), clear), [0, H / 2, 0]));
    tray.add(box([0.035, H + 0.002, D + 0.004], [-0.03, H / 2, 0], label));
    tray.position.set((k - 1) * 0.006, k * H, (k % 2) * 0.004);
    tray.rotation.y = (k - 1) * 0.03;
    g.add(tray);
  }
  return g;
}

/** IKEA OFTAST bowl, Ø 15 cm, white tempered glass: flared sides on a low foot. */
function oftastBowl() {
  const white = new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.15, side: THREE.DoubleSide });
  return lathe([[0.001, 0], [0.04, 0], [0.042, 0.004], [0.046, 0.006], [0.075, 0.05], [0.073, 0.052], [0.043, 0.01], [0.001, 0.008]], white, 40);
}

/** A pair of chopsticks lying side by side along local z, tips toward −z. */
function chopsticks() {
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.5 });
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const c = cylinder(0.0035, 0.23, [0, 0, 0], wood, 8, 0.0025);
    c.rotation.x = -Math.PI / 2;
    c.position.set(s * 0.006, 0.004, 0);
    g.add(c);
  }
  return g;
}

/** The hotpot spread on the dining table: hob + split pot in the middle, beef trays, six place settings. */
function hotpotSpread(cx: number, cz: number, T: number, L: number, D: number) {
  const out: THREE.Object3D[] = [];
  out.push(tagged(place(tillreda(), [cx, T, cz], Math.PI / 2), 'tillreda-induction-hob', movable(2.2, 'glass', 'box')));
  out.push(tagged(place(yuanyangHotpot(), [cx, T + 0.062, cz]), 'yuanyang-hotpot', movable(1.6, 'metal', 'container')));
  out.push(tagged(place(beefTrays(), [cx - L / 2 + 0.2, T, cz], Math.PI / 2), 'beef-slices-3-trays', movable(1.2, 'plastic', 'box')));
  // three settings along each long side, bowl near the edge, chopsticks to its right pointing in
  const zs = D / 2 - 0.13;
  let n = 0;
  for (const side of [-1, 1]) for (const dx of [-0.5, 0, 0.5]) {
    n++;
    const bx = cx + dx, bz = cz + side * zs;
    out.push(tagged(place(oftastBowl(), [bx, T, bz]), `oftast-bowl-${n}`, movable(0.25, 'glass', 'container')));
    out.push(tagged(place(chopsticks(), [bx + side * 0.12, T, bz], side > 0 ? 0 : Math.PI), `chopsticks-${n}`, movable(0.03, 'wood')));
  }
  return out;
}


// Desk corner along the north wall (photos 127–155, 293, 294; positions from the scan):
// left desk with a black folding chair (backpack on the seat, navy hoodie over the back) and a white
// SANDSBERG-type chair (owner); in the gap a monitor carton standing on edge, a white 3-tier mesh cart and a paper bag;
// right desk with the open laptop, the white chair with the black coat, the bin in front of the cart.
const DESK_T = 0.74, DESK_Z0 = -2.84, DESK_Z1 = -2.22;
const DESK_W = [-3.28, -2.24] as const;
const DESK_E = [-1.76, -0.46] as const;

/** Black steel folding chair: seat at 0.45, backrest top at ~0.8 (so the hoodie drape fits). Seat toward +z. */
function foldingChair() {
  const m = ausMaterials();
  const steel = new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.4, metalness: 0.5 });
  const c = new THREE.Group();
  c.add(cushion([0.4, 0.025, 0.38], [0, 0.45, 0.02], 0.008, m.black));
  const back = cushion([0.38, 0.17, 0.02], [0, 0.69, -0.215], 0.008, m.black);
  back.rotation.x = -0.14;
  c.add(back);
  const r = 0.011;
  for (const s of [-1, 1]) {
    // rear legs run up to carry the backrest; front legs cross under the seat to the back foot rail
    c.add(tube([[s * 0.19, 0, -0.27], [s * 0.19, 0.44, -0.17], [s * 0.19, 0.79, -0.225]], r, steel, 12));
    c.add(tube([[s * 0.185, 0, 0.22], [s * 0.185, 0.44, -0.13]], r, steel, 4));
    c.add(tube([[s * 0.19, 0.44, -0.16], [s * 0.19, 0.44, 0.2]], r, steel, 4));
  }
  c.add(tube([[-0.19, 0.06, 0.18], [0.19, 0.06, 0.18]], r, steel, 4));
  c.add(tube([[-0.19, 0.06, -0.25], [0.19, 0.06, -0.25]], r, steel, 4));
  return c;
}

/**
 * Black laptop backpack (photo 143) sitting on a seat, leaning against the backrest. Local: back
 * panel toward −z, front toward +z. Padded main body, a front organiser pocket, zips, top grab
 * handle, shoulder straps and side compression straps, the green luggage tag on the top zip.
 */
function backpack() {
  const nylon = new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.78 });
  const webbing = new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.9 });
  const zip = new THREE.MeshStandardMaterial({ color: '#2b2c30', roughness: 0.45, metalness: 0.3 });
  const green = new THREE.MeshStandardMaterial({ color: '#3a9a4f', roughness: 0.55 }); // photo 143
  const W = 0.31, H = 0.44, D = 0.15;
  const g = new THREE.Group();
  const bag = new THREE.Group();
  bag.add(place(mesh(new RoundedBoxGeometry(W, H, D, 5, 0.055), nylon), [0, H / 2, 0]));
  // front organiser pocket on the lower two-thirds
  bag.add(place(mesh(new RoundedBoxGeometry(W - 0.04, 0.27, 0.05, 4, 0.022), nylon), [0, 0.16, D / 2 + 0.012]));
  // zips: main compartment arc over the top, pocket top edge
  const arc: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = Math.PI * (i / 16);
    arc.push([-Math.cos(t) * (W / 2 - 0.004), H - 0.06 + Math.sin(t) * 0.055, D / 2 - 0.03]);
  }
  bag.add(tube([[-W / 2 + 0.004, 0.08, D / 2 - 0.03], ...arc, [W / 2 - 0.004, 0.08, D / 2 - 0.03]], 0.004, zip, 48));
  bag.add(tube([[-W / 2 + 0.03, 0.29, D / 2 + 0.035], [0, 0.297, D / 2 + 0.038], [W / 2 - 0.03, 0.29, D / 2 + 0.035]], 0.0035, zip, 12));
  // top grab handle
  bag.add(tube([[-0.04, H - 0.004, -0.02], [-0.03, H + 0.035, -0.02], [0.03, H + 0.035, -0.02], [0.04, H - 0.004, -0.02]], 0.008, webbing, 16));
  // green tag hanging from the main zip puller
  const tag = new THREE.Group();
  tag.add(place(mesh(new RoundedBoxGeometry(0.022, 0.07, 0.006, 2, 0.003), green), [0, -0.035, 0]));
  tag.position.set(0.07, H - 0.01, D / 2 - 0.005);
  tag.rotation.set(0.25, 0, 0.12);
  bag.add(tag);
  for (const sx of [-1, 1]) {
    // padded shoulder straps on the back panel
    bag.add(tube([[sx * 0.07, H - 0.04, -D / 2], [sx * 0.085, H - 0.12, -D / 2 - 0.035], [sx * 0.1, 0.18, -D / 2 - 0.03], [sx * 0.12, 0.04, -D / 2 - 0.005]], 0.016, webbing, 24));
    // side compression straps + buckles
    for (const y of [0.14, 0.3]) {
      bag.add(box([0.006, 0.022, D - 0.03], [sx * (W / 2 + 0.002), y, 0], webbing));
      bag.add(box([0.009, 0.03, 0.03], [sx * (W / 2 + 0.004), y, D / 2 - 0.04], zip));
    }
  }
  bag.rotation.x = -0.16;
  g.add(bag);
  return g;
}

/** Sony DualSense (PS5) controller, white, lying face up. Local: sticks up, grips toward +z. */
function dualSense() {
  const white = new THREE.MeshStandardMaterial({ color: '#f3f3f1', roughness: 0.42 });
  const black = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.35 });
  const grey = new THREE.MeshStandardMaterial({ color: '#8e9196', roughness: 0.4 });
  const g = new THREE.Group();
  // black centre body
  g.add(place(mesh(new RoundedBoxGeometry(0.1, 0.03, 0.06, 3, 0.012), black), [0, 0.022, 0]));
  for (const sx of [-1, 1]) {
    // white wings and grips swept back toward the hands
    g.add(place(mesh(new RoundedBoxGeometry(0.052, 0.034, 0.064, 4, 0.016), white), [sx * 0.052, 0.024, -0.004]));
    const grip = mesh(new THREE.CapsuleGeometry(0.021, 0.055, 6, 14), white);
    grip.rotation.set(Math.PI / 2 - 0.25, 0, sx * 0.35);
    grip.position.set(sx * 0.06, 0.02, 0.045);
    g.add(grip);
    // shoulder buttons along the back edge
    g.add(place(mesh(new RoundedBoxGeometry(0.035, 0.012, 0.014, 2, 0.005), white), [sx * 0.052, 0.035, -0.036]));
    // analog sticks
    g.add(cylinder(0.006, 0.012, [sx * 0.024, 0.043, 0.022], black, 12));
    g.add(cylinder(0.01, 0.005, [sx * 0.024, 0.051, 0.022], black, 16));
  }
  // white touchpad between the wings
  g.add(place(mesh(new RoundedBoxGeometry(0.06, 0.008, 0.036, 2, 0.003), white), [0, 0.037, -0.012]));
  // d-pad (left wing) and face buttons (right wing), PS button
  g.add(box([0.024, 0.004, 0.008], [-0.056, 0.042, -0.002], grey), box([0.008, 0.004, 0.024], [-0.056, 0.042, -0.002], grey));
  for (const [dx, dz] of [[0, -0.01], [0, 0.01], [-0.01, 0], [0.01, 0]]) g.add(cylinder(0.0045, 0.004, [0.056 + dx, 0.042, -0.002 + dz], grey, 10));
  g.add(cylinder(0.004, 0.003, [0, 0.038, 0.02], black, 10));
  return g;
}

/** White Bose-style hard headphone case (photo 141): puffy rounded oval with a zip seam around it. */
function headphoneCase() {
  const shell = new THREE.MeshStandardMaterial({ color: '#e4e2de', roughness: 0.7 }); // photo 141 (white-balanced)
  const zipMat = new THREE.MeshStandardMaterial({ color: '#cfcdc7', roughness: 0.5 });
  const oval = (A: number, B: number) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      const x = A * Math.sign(c) * Math.abs(c) ** (2 / 2.4), y = B * Math.sign(sn) * Math.abs(sn) ** (2 / 2.4) * (1 - 0.08 * c);
      if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
    }
    return sh;
  };
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(oval(0.075, 0.062), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 8, curveSegments: 64 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.022, 0);
  g.add(mesh(geo, shell));
  const seam = new THREE.ExtrudeGeometry(oval(0.098, 0.084), { depth: 0.004, bevelEnabled: false, curveSegments: 64 });
  seam.rotateX(-Math.PI / 2);
  seam.translate(0, 0.03, 0);
  g.add(mesh(seam, zipMat));
  g.add(box([0.05, 0.001, 0.008], [0, 0.0645, -0.03], new THREE.MeshStandardMaterial({ color: '#9a9a96', roughness: 0.5 }))); // logo
  return g;
}

/**
 * Gaming mouse, front −z. Default: black right-handed Razer-style with a thumb rest (photo 141).
 * `white`: the right desk's white Logitech G-style mouse, symmetric, with a grey G logo (photo 132).
 */
function gamingMouse(white = false) {
  const shell = new THREE.MeshStandardMaterial(white ? { color: '#e9e9ea', roughness: 0.35 } : { color: '#26282b', roughness: 0.4 }); // photo 132 / 141
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const pos = geo.getAttribute('position');
  const L = white ? 0.059 : 0.064, Wd = white ? 0.031 : 0.032;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const hump = 0.78 + 0.22 * z; // +z = rear (palm)
    pos.setXYZ(i, x * (Wd + (white ? 0.002 : 0.004) * z), y < 0 ? y * 0.006 : y * (white ? 0.037 : 0.04) * hump, z * L);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(place(mesh(geo, shell), [0, 0.006, 0]));
  if (!white) g.add(sphere(1, [-0.032, 0.012, 0.01], shell, [0.012, 0.01, 0.04])); // thumb rest
  g.add(box([0.001, 0.004, 0.045], [0, white ? 0.037 : 0.04, -0.033], new THREE.MeshStandardMaterial({ color: white ? '#b9b9bb' : '#050506' }))); // button split
  g.add(cylinder(0.008, 0.007, [0, white ? 0.035 : 0.038, -0.033], new THREE.MeshStandardMaterial({ color: white ? '#cfcfd1' : '#2a2b2e', roughness: 0.6 }), 16).rotateZ(Math.PI / 2));
  if (white) {
    const logo = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0016, 6, 20, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: '#8c8c90', roughness: 0.5 }));
    logo.rotation.set(-Math.PI / 2 + 0.35, 0, 0.6);
    logo.position.set(0, 0.04, 0.025);
    g.add(logo);
  }
  return g;
}

/**
 * Small figurines beside the laptop (photo 130), local front +z: a blocky pixel-style figure standing
 * on a wooden crate, and a bust with black hair on a round black stand.
 */
function deskFigurines() {
  const mat = (color: string, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness });
  const crate = mat('#a8743f'), crateDark = mat('#7a4f28'), skin = mat('#7fae6c'), hair = mat('#26241f'), shirt = mat('#6b4a2f'), legs = mat('#3d3a4a');
  const g = new THREE.Group();
  // blocky figure on a crate
  const fig = new THREE.Group();
  fig.add(box([0.05, 0.05, 0.05], [0, 0.025, 0], crate));
  for (const sx of [-1, 1]) fig.add(box([0.004, 0.05, 0.052], [sx * 0.024, 0.025, 0], crateDark));
  fig.add(box([0.052, 0.004, 0.052], [0, 0.048, 0], crateDark));
  fig.add(box([0.024, 0.026, 0.014], [0, 0.063, 0], legs));
  fig.add(box([0.024, 0.026, 0.014], [0, 0.089, 0], shirt));
  for (const sx of [-1, 1]) fig.add(box([0.011, 0.026, 0.013], [sx * 0.0175, 0.089, 0], skin));
  fig.add(box([0.026, 0.026, 0.026], [0, 0.115, 0], skin));
  fig.add(box([0.028, 0.008, 0.028], [0, 0.128, 0], hair));
  fig.add(box([0.028, 0.012, 0.004], [0, 0.12, -0.012], hair));
  for (const sx of [-1, 1]) fig.add(box([0.004, 0.004, 0.001], [sx * 0.006, 0.113, 0.0135], mat('#1a1a1a')));
  g.add(fig);
  // bust on a round stand
  const bust = new THREE.Group();
  bust.add(cylinder(0.035, 0.008, [0, 0.004, 0], mat('#141416', 0.35), 24));
  bust.add(cylinder(0.006, 0.07, [0, 0.043, 0], mat('#141416', 0.35), 10));
  bust.add(sphere(1, [0, 0.085, 0], mat('#e9e2da'), [0.022, 0.012, 0.016])); // shoulders
  bust.add(sphere(0.02, [0, 0.112, 0.002], mat('#ead0b8')));
  bust.add(sphere(1, [0, 0.12, -0.004], hair, [0.025, 0.024, 0.024])); // hair cap
  bust.add(sphere(1, [0, 0.104, -0.01], hair, [0.022, 0.016, 0.016])); // hair at the back
  bust.position.set(0.075, 0, -0.02);
  g.add(bust);
  return g;
}

/** Black compact folding umbrella lying on the desk (photo 130), along local x, handle toward +x. */
function foldedUmbrella() {
  const canopy = new THREE.MeshStandardMaterial({ color: '#2a2c31', roughness: 0.6 }); // photo 130
  const handle = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.45 });
  const g = new THREE.Group();
  // folded canopy: 8-sided, slightly fuller in the middle, rounded tip
  const prof: [number, number][] = [[0.001, -0.16], [0.012, -0.155], [0.024, -0.13], [0.028, -0.06], [0.029, 0.02], [0.026, 0.1], [0.02, 0.115], [0.001, 0.116]];
  const body = lathe(prof, canopy, 8);
  body.rotation.z = -Math.PI / 2;
  body.position.y = 0.028;
  g.add(body);
  // wrap strap round the middle with a snap
  const strap = cylinder(0.0295, 0.022, [0, 0.028, 0], handle, 8).rotateZ(Math.PI / 2);
  strap.position.x = -0.02;
  g.add(strap);
  // handle: short grip with a wrist cord
  g.add(cylinder(0.016, 0.085, [0.16, 0.028, 0], handle, 16).rotateZ(Math.PI / 2));
  g.add(sphere(0.016, [0.2, 0.028, 0], handle));
  g.add(tube([[0.205, 0.028, 0], [0.24, 0.012, 0.02], [0.26, 0.004, -0.01], [0.235, 0.004, -0.04]], 0.002, handle, 16));
  return g;
}

/**
 * Clear plastic storage box under the right desk, crammed with cables and chargers (photos 130–133):
 * thin translucent walls with a thicker rolled rim, coiled black and white cables, black charger
 * bricks, white plug packs, a red gadget, loose cable ends hanging over the rim.
 */
function cableBin() {
  const W = 0.38, D = 0.27, H = 0.2;
  const clear = new THREE.MeshStandardMaterial({ color: '#e8f0f2', roughness: 0.12, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const rim = new THREE.MeshStandardMaterial({ color: '#dfe8ea', roughness: 0.2, transparent: true, opacity: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: '#ececea', roughness: 0.45 });
  const g = new THREE.Group();
  g.add(box([W - 0.02, 0.004, D - 0.02], [0, 0.002, 0], clear));
  for (const sz of [-1, 1]) g.add(box([W, H, 0.003], [0, H / 2, sz * D / 2], clear));
  for (const sx of [-1, 1]) g.add(box([0.003, H, D], [sx * W / 2, H / 2, 0], clear));
  for (const sz of [-1, 1]) g.add(box([W + 0.012, 0.01, 0.012], [0, H, sz * (D / 2 + 0.003)], rim));
  for (const sx of [-1, 1]) g.add(box([0.012, 0.01, D + 0.012], [sx * (W / 2 + 0.003), H, 0], rim));

  const rnd = mulberry32(57);
  // coiled cables: flattened tori stacked at random tilts
  for (let i = 0; i < 20; i++) {
    const r = 0.04 + rnd() * 0.035;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0045, 6, 28), rnd() < 0.55 ? black : white);
    coil.scale.set(1, 1, 0.6 + rnd() * 0.4);
    coil.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 0.9, rnd() * Math.PI, (rnd() - 0.5) * 0.6);
    coil.position.set((rnd() - 0.5) * (W - 2 * r - 0.02), 0.03 + rnd() * 0.15, (rnd() - 0.5) * (D - 2 * r * 0.8 - 0.02));
    coil.castShadow = true;
    g.add(coil);
  }
  // charger bricks and plug packs
  const bricks: [number, number, number, number, number, THREE.Material][] = [
    [0.12, 0.03, 0.06, -0.09, -0.05, black], [0.1, 0.028, 0.05, 0.1, 0.06, black],
    [0.05, 0.05, 0.05, 0.12, -0.07, white], [0.045, 0.045, 0.03, -0.03, 0.08, white],
  ];
  for (const [w, h, d, x, z, mat] of bricks) {
    const b = cushion([w, h, d], [x, 0.02 + h / 2 + rnd() * 0.05, z], 0.006, mat);
    b.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
    g.add(b);
  }
  g.add(cushion([0.07, 0.035, 0.045], [0.02, 0.13, -0.02], 0.012, new THREE.MeshStandardMaterial({ color: '#c8352d', roughness: 0.5 })));
  // loose cable ends draped over the rim
  g.add(tube([[-0.05, 0.12, 0.0], [-0.08, 0.2, D / 2 - 0.01], [-0.09, 0.17, D / 2 + 0.03], [-0.1, 0.04, D / 2 + 0.06], [-0.14, 0.003, D / 2 + 0.12]], 0.0025, white, 24));
  g.add(tube([[0.08, 0.1, -0.02], [0.13, 0.2, -D / 2 + 0.01], [0.14, 0.15, -D / 2 - 0.02], [0.16, 0.01, -D / 2 - 0.04]], 0.003, black, 20));
  return g;
}

/** Black protein-powder tub on the floor (photo 132): round shoulders, wide screw lid, bronze label. */
function proteinTub() {
  const black = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.35 }); // photo 132 (white-balanced)
  const lidMat = new THREE.MeshStandardMaterial({ color: '#1e1c1a', roughness: 0.45 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#8a6d30', roughness: 0.4, metalness: 0.4 });
  const g = new THREE.Group();
  g.add(lathe([[0.001, 0], [0.088, 0], [0.095, 0.012], [0.097, 0.2], [0.092, 0.235], [0.075, 0.255], [0.07, 0.258], [0.001, 0.258]], black, 40));
  // wide ribbed lid with an embossed logo
  g.add(cylinder(0.072, 0.045, [0, 0.278, 0], lidMat, 40));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.add(box([0.004, 0.04, 0.006], [Math.cos(a) * 0.072, 0.278, Math.sin(a) * 0.072], lidMat).rotateY(-a));
  }
  g.add(cylinder(0.035, 0.003, [0, 0.302, 0], black, 24));
  // bronze label band near the bottom, a narrow one under the shoulder
  const band = (y: number, h: number) => mesh(new THREE.CylinderGeometry(0.0975, 0.0975, h, 40, 1, true, -0.9, 1.8), bronze);
  const b1 = band(0.06, 0.05); b1.position.y = 0.06; g.add(b1);
  const b2 = band(0.18, 0.012); b2.position.y = 0.18; g.add(b2);
  return g;
}

/** Printed snack packaging: one small canvas per design (photos 128, 151–153). */
let snackDesigns: Record<string, THREE.MeshStandardMaterial> | undefined;
function snackMaterials() {
  if (snackDesigns) return snackDesigns;
  const tex = (w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0.15 }); // glossy foil film
  };
  const font = (px: number) => `bold ${px}px "Arial Black", "Microsoft JhengHei", sans-serif`;
  const chips = (x: CanvasRenderingContext2D, cx: number, cy: number, n: number, col: string, r = 13) => {
    for (let i = 0; i < n; i++) {
      x.fillStyle = col;
      x.beginPath(); x.ellipse(cx + (i % 4) * 18 - 27, cy + Math.floor(i / 4) * 12, r, r * 0.7, i * 0.7, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(120,70,0,0.5)'; x.lineWidth = 1.5; x.stroke();
    }
  };
  snackDesigns = {
    // green banana-chip bag, yellow top, chip photo and leaves
    banana: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#4fae2e'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8e23a'; x.fillRect(0, 0, w, 46);
      x.fillStyle = '#2f7d1d';
      for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(10 + i * 28, 70, 26, 8, 0.6, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#ffffff'; x.font = font(26); x.fillText('UMA', 22, 118);
      x.fillStyle = '#1b5e12'; x.font = font(13); x.fillText('BANANA CHIPS', 12, 32);
      chips(x, 64, 150, 8, '#f3d36b');
    }),
    // darker green bag with a red top band
    greenRed: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#7bc13a'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c8302a'; x.fillRect(0, 0, w, 34);
      x.fillStyle = '#ffffff'; x.font = font(16); x.fillText('香蕉片', 30, 24);
      x.fillStyle = '#245e12'; x.font = font(22); x.fillText('CRISPY', 18, 92);
      chips(x, 64, 140, 8, '#f6dc7a');
    }),
    // blue snack with white text and red stripe
    blue: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#1f4fb6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e23b2e'; x.fillRect(0, 120, w, 16);
      x.fillStyle = '#ffffff'; x.font = font(24); x.fillText('SNACK', 16, 80);
      x.fillStyle = '#ffd34a'; x.beginPath(); x.arc(64, 165, 18, 0, Math.PI * 2); x.fill();
    }),
    // white pouch with red text blocks (instant noodles / sachets)
    whiteRed: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#d32b23'; x.fillRect(10, 18, w - 20, 34); x.fillRect(10, 140, 60, 18);
      x.fillStyle = '#ffffff'; x.font = font(20); x.fillText('辣味', 38, 44);
      x.fillStyle = '#333'; for (let i = 0; i < 6; i++) x.fillRect(12, 66 + i * 11, 90 - (i % 3) * 20, 5);
      x.fillStyle = '#2c8a3b'; x.fillRect(84, 136, 34, 34);
    }),
    // golden cracker bag
    gold: tex(128, 192, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f2c443'); g.addColorStop(1, '#c98f1e');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#7a3f12'; x.font = font(22); x.fillText('餅乾', 36, 60);
      x.fillStyle = '#fff3c4'; x.fillRect(16, 86, w - 32, 70);
      chips(x, 64, 110, 8, '#e0a64a', 11);
    }),
    // red bag with a yellow badge
    red: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#c92a2a'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffd23a'; x.beginPath(); x.arc(64, 70, 34, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#c92a2a'; x.font = font(18); x.fillText('HOT', 44, 77);
      x.fillStyle = '#2f8f3a'; x.fillRect(0, 160, w, 32);
      chips(x, 64, 128, 4, '#f2c55a');
    }),
    // orange chips bag
    orange: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#ec7a1f'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#5a2a0b'; x.font = font(20); x.fillText('CHEESE', 14, 52);
      chips(x, 64, 120, 8, '#ffcf5a');
    }),
    // cereal-style carton front: dark red with a bowl and a white title band
    carton: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#9c2a22'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff'; x.fillRect(0, 14, w, 36);
      x.fillStyle = '#9c2a22'; x.font = font(20); x.fillText('早餐穀片', 22, 40);
      x.fillStyle = '#f3efe6'; x.beginPath(); x.ellipse(64, 140, 46, 22, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#6b3a1c'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(28 + (i % 7) * 12, 132 + Math.floor(i / 7) * 7, 6, 0, Math.PI * 2); x.fill(); }
    }),
    // biscuit box: cream with a brown band
    biscuit: tex(128, 192, (x, w, h) => {
      x.fillStyle = '#efe2c4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#7b4a24'; x.fillRect(0, 120, w, 72);
      x.fillStyle = '#7b4a24'; x.font = font(18); x.fillText('蛋捲', 40, 70);
      x.fillStyle = '#e8c27a'; for (let i = 0; i < 3; i++) x.fillRect(16 + i * 34, 136, 26, 40);
    }),
  };
  return snackDesigns;
}

/** A pillow-shaped snack bag with crimped seals, its print mapped flat across front and back. Local: upright, face +z. */
function snackBag(w: number, h: number, t: number, mat: THREE.Material) {
  const g = new THREE.Group();
  const bag = pillow([w, h, t], mat);
  const geo = bag.geometry, pos = geo.getAttribute('position'), uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  g.add(bag);
  // printed bags get a silvery foil crimp, plain ones a crimp of their own colour
  const sealMat = (mat as THREE.MeshStandardMaterial).map ? new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.35, metalness: 0.3 }) : mat;
  for (const s of [-1, 1]) {
    const crimp = box([w * 0.96, 0.016, 0.003], [0, s * (h / 2 - 0.004), 0], sealMat);
    g.add(crimp);
    for (let i = 0; i < 8; i++) g.add(box([0.0015, 0.016, 0.0035], [-w * 0.45 + (i * w * 0.9) / 7, s * (h / 2 - 0.004), 0], sealMat));
  }
  return g;
}

/** Wire-mesh grid as an alpha map for the cart baskets. */
let meshAlpha: THREE.Texture | undefined;
function wireGrid() {
  if (meshAlpha) return meshAlpha;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff';
  for (let i = 0; i < 64; i += 8) { x.fillRect(i, 0, 2, 64); x.fillRect(0, i, 64, 2); }
  meshAlpha = new THREE.CanvasTexture(c);
  meshAlpha.wrapS = meshAlpha.wrapT = THREE.RepeatWrapping;
  return meshAlpha;
}

/**
 * White 3-tier mesh trolley (0.45 × 0.35 × 0.78) heaped with snacks (photos 128, 151–153): top tier
 * cartons and bags piled over the rim, middle tier banana-chip bags leaning forward with a golden bag
 * lying across the front, bottom tier smaller packets, a paper cup and a box.
 */
function snackCart() {
  const m = ausMaterials();
  const white = new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.35, metalness: 0.2 });
  const grid = (sx: number, sy: number) => {
    const t = wireGrid().clone();
    t.repeat.set(sx / 0.012, sy / 0.012);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.4, metalness: 0.2, alphaMap: t, alphaTest: 0.4, side: THREE.DoubleSide });
  };
  const g = new THREE.Group();
  const W = 0.45, D = 0.35, RIM = 0.09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cylinder(0.008, 0.76, [sx * (W / 2 - 0.01), 0.42, sz * (D / 2 - 0.01)], white, 8));
    g.add(cylinder(0.022, 0.025, [sx * (W / 2 - 0.03), 0.03, sz * (D / 2 - 0.03)], m.darkGrey, 10).rotateZ(Math.PI / 2));
  }
  const floorM = grid(W, D), longM = grid(W, RIM), shortM = grid(D, RIM);
  const tiers = [0.1, 0.38, 0.66];
  for (const y of tiers) {
    g.add(box([W, 0.003, D], [0, y, 0], floorM));
    for (const sz of [-1, 1]) g.add(box([W, RIM, 0.003], [0, y + RIM / 2, sz * D / 2], longM));
    for (const sx of [-1, 1]) g.add(box([0.003, RIM, D], [sx * W / 2, y + RIM / 2, 0], shortM));
    for (const sz of [-1, 1]) g.add(box([W, 0.008, 0.008], [0, y + RIM, sz * D / 2], white));
    for (const sx of [-1, 1]) g.add(box([0.008, 0.008, D], [sx * W / 2, y + RIM, 0], white));
  }
  // cart handle on the right end
  g.add(tube([[W / 2, 0.76, -0.1], [W / 2 + 0.05, 0.8, -0.1], [W / 2 + 0.05, 0.8, 0.1], [W / 2, 0.76, 0.1]], 0.007, white, 16));

  const S = snackMaterials();
  const rnd = mulberry32(31);
  // every packet is its own item so the Knolling view lays the snacks out one by one
  const SN: Record<string, string> = {
    banana: 'banana-chips', greenRed: 'crispy-banana-chips', blue: 'blue-snack', whiteRed: 'spicy-snack', gold: 'crackers',
    red: 'hot-chips', orange: 'cheese-chips', carton: 'cereal-box', biscuit: 'egg-roll-box',
  };
  const keyOf = new Map<THREE.Material, string>(Object.entries(S).map(([k, v]) => [v, k]));
  let n = 0;
  const snack = <T extends THREE.Object3D>(o: T, mat: THREE.Material) => tagged(o, `${SN[keyOf.get(mat) ?? ''] ?? 'snack'}-${++n}`, movable(0.15, 'soft'));
  /** bag standing in the basket, leaning (tiltX toward the front +z), yawed */
  const bag = (mat: THREE.Material, w: number, h: number, x: number, y: number, z: number, tiltX: number, yaw: number, roll = 0) => {
    const b = snackBag(w, h, 0.035 + rnd() * 0.02, mat);
    b.position.set(x, y + (h / 2) * Math.cos(tiltX) * 0.9, z);
    b.rotation.set(tiltX, yaw, roll);
    g.add(snack(b, mat));
  };
  const carton = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, yaw: number) => {
    const side = new THREE.MeshStandardMaterial({ color: (mat as THREE.MeshStandardMaterial).map ? '#b8a48c' : '#ccc', roughness: 0.7 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, mat, mat]);
    b.position.set(x, y + h / 2, z);
    b.rotation.y = yaw;
    b.castShadow = true;
    g.add(snack(b, mat));
  };
  const [y0, y1, y2] = tiers.map((t) => t + 0.003);

  // top tier: two cartons at the back, bags heaped over the rim, a clear bag of sweets
  carton(S.carton, 0.12, 0.2, 0.05, -0.15, y2, -0.12, 0.25);
  carton(S.biscuit, 0.1, 0.15, 0.06, -0.03, y2, -0.13, -0.1);
  bag(S.gold, 0.13, 0.17, 0.12, y2, -0.08, -0.25, 0.3, 0.15);
  bag(S.whiteRed, 0.12, 0.16, 0.04, y2, 0.04, 0.35, -0.2);
  bag(S.red, 0.11, 0.15, -0.13, y2, 0.05, 0.45, 0.4, -0.1);
  bag(S.banana, 0.12, 0.16, 0.15, y2, 0.08, 0.6, -0.5, 0.2);
  const clearBag = new THREE.MeshStandardMaterial({ color: '#e9eef0', roughness: 0.08, transparent: true, opacity: 0.35, depthWrite: false });
  const sweets = snackBag(0.14, 0.12, 0.06, clearBag);
  sweets.position.set(0.03, y2 + 0.11, -0.06);
  sweets.rotation.set(-1.2, 0.2, 0);
  g.add(tagged(sweets, 'sweets-bag', movable(0.2, 'soft')));
  for (let i = 0; i < 6; i++) g.add(sphere(1, [0.0 + (rnd() - 0.5) * 0.08, y2 + 0.1 + rnd() * 0.02, -0.06 + (rnd() - 0.5) * 0.05], [m.red, m.orange, S.blue][i % 3], [0.012, 0.008, 0.012]));

  // middle tier: banana-chip bags leaning forward, the blue packet, a white pouch, the golden bag
  // lying across the front and sticking out past the rim
  bag(S.banana, 0.15, 0.2, -0.13, y1, -0.06, 0.5, 0.15);
  bag(S.greenRed, 0.14, 0.19, -0.02, y1, -0.08, 0.4, -0.1, 0.08);
  bag(S.blue, 0.07, 0.17, 0.06, y1, -0.1, 0.25, 0.3, -0.25);
  bag(S.whiteRed, 0.13, 0.17, 0.13, y1, -0.07, 0.45, -0.25);
  bag(S.banana, 0.15, 0.2, -0.06, y1 + 0.02, 0.06, 1.05, 0.05, 0.1);
  const goldBag = snackBag(0.2, 0.15, 0.03, S.gold);
  goldBag.position.set(0.1, y1 + 0.075, 0.13);
  goldBag.rotation.set(-1.15, 0.5, 0.25);
  g.add(snack(goldBag, S.gold));
  bag(S.red, 0.1, 0.13, 0.17, y1, 0.08, 0.7, -0.6);
  // back row standing tall against the rear rim so the tier reads heaped
  bag(S.greenRed, 0.13, 0.23, -0.15, y1, -0.14, 0.12, 0.1);
  bag(S.banana, 0.14, 0.24, -0.02, y1, -0.15, 0.08, -0.15, 0.05);
  bag(S.orange, 0.12, 0.22, 0.1, y1, -0.14, 0.15, 0.2, -0.08);
  bag(S.gold, 0.1, 0.2, 0.18, y1, -0.13, 0.18, -0.3);

  // bottom tier: smaller packets, a paper cup, a carton, a dark bag
  bag(S.orange, 0.11, 0.14, -0.14, y0, -0.05, 0.35, 0.3);
  bag(S.greenRed, 0.1, 0.13, -0.04, y0, 0.03, 0.5, -0.2);
  bag(snackMaterials().blue, 0.08, 0.12, 0.05, y0, -0.09, 0.2, 0.1);
  carton(S.biscuit, 0.1, 0.13, 0.06, 0.14, y0, -0.08, 0.3);
  bag(S.red, 0.12, 0.22, -0.15, y0, -0.14, 0.1, 0.15);
  bag(S.whiteRed, 0.12, 0.21, -0.03, y0, -0.15, 0.12, -0.1);
  bag(S.banana, 0.13, 0.2, 0.07, y0, -0.14, 0.2, 0.25, 0.06);
  bag(S.gold, 0.11, 0.16, -0.12, y0, 0.08, 0.75, -0.3);
  const cup = new THREE.Group().add(
    mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.1, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6, side: THREE.DoubleSide })),
    cylinder(0.041, 0.025, [0, 0.01, 0], m.red, 20),
  );
  cup.children[0].position.y = 0.05;
  cup.position.set(0.15, y0, 0.09);
  g.add(tagged(cup, 'paper-cup', movable(0.02, 'cardboard', 'cylinder')));
  g.add(tagged(snackBag(0.13, 0.11, 0.05, new THREE.MeshStandardMaterial({ color: '#3a2b26', roughness: 0.5 })).translateX(0.02).translateY(y0 + 0.03).translateZ(0.1).rotateX(-1.3), 'dark-snack-bag', movable(0.15, 'soft')));
  return g;
}

/** Brown paper shopping bag, open, with flat twisted handles. */
function paperBag() {
  const kraft = new THREE.MeshStandardMaterial({ color: '#a77b4f', roughness: 0.9, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const W = 0.32, D = 0.18, H = 0.36;
  g.add(box([W, 0.004, D], [0, 0.002, 0], kraft));
  for (const sz of [-1, 1]) g.add(box([W, H, 0.003], [0, H / 2, sz * D / 2], kraft));
  for (const sx of [-1, 1]) g.add(box([0.003, H, D], [sx * W / 2, H / 2, 0], kraft));
  for (const sz of [-1, 1]) g.add(tube([[-0.07, H - 0.01, sz * D / 2], [-0.06, H + 0.08, sz * (D / 2 + 0.01)], [0.06, H + 0.08, sz * (D / 2 + 0.01)], [0.07, H - 0.01, sz * D / 2]], 0.008, kraft, 12));
  const red = new THREE.MeshStandardMaterial({ color: '#c8322e', roughness: 0.7 });
  g.add(box([0.16, 0.06, 0.001], [0.02, 0.17, D / 2 + 0.002], red)); // printed logo
  return g;
}

function desks() {
  const m = ausMaterials();
  const T = DESK_T;
  /** LINNMON/ADILS-style white top on four round legs */
  const desk = ([x0, x1]: readonly [number, number]) => {
    const d: THREE.Object3D[] = [boxSpan([x0, T - 0.025, DESK_Z0], [x1, T, DESK_Z1], m.whiteMatte)];
    for (const x of [x0 + 0.05, x1 - 0.05]) for (const z of [DESK_Z0 + 0.05, DESK_Z1 - 0.05]) d.push(cylinder(0.022, T - 0.025, [x, (T - 0.025) / 2, z], m.whiteMatte, 16));
    return d;
  };
  const on = (o: THREE.Object3D, name: string, mass: number, surface: Parameters<typeof movable>[1], shape?: Parameters<typeof movable>[2]) => tagged(o, name, movable(mass, surface, shape));
  const grp = (...parts: THREE.Object3D[]) => new THREE.Group().add(...parts);

  // ---- desk-top things ----
  const silver = new THREE.MeshStandardMaterial({ color: '#c9cbcd', roughness: 0.35, metalness: 0.5 });
  const paper = new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: '#d8e2e4', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false });
  const tea = new THREE.MeshStandardMaterial({ color: '#5a2f17', roughness: 0.2 });
  const openLaptop = () => {
    const l = new THREE.Group();
    l.add(box([0.38, 0.018, 0.26], [0, 0.009, 0], silver));
    l.add(box([0.33, 0.002, 0.12], [0, 0.019, -0.04], m.darkGrey)); // keyboard
    const lid = new THREE.Group();
    lid.add(box([0.38, 0.25, 0.008], [0, 0.125, 0], silver), box([0.35, 0.21, 0.001], [0, 0.13, 0.0045], m.blackGlass));
    lid.position.set(0, 0.018, -0.13);
    lid.rotation.x = -0.25;
    l.add(lid);
    return l;
  };
  const xE = (DESK_E[0] + DESK_E[1]) / 2, xW = (DESK_W[0] + DESK_W[1]) / 2;
  const mug = grp(cylinder(0.045, 0.1, [0, 0.05, 0], glass, 16), cylinder(0.04, 0.06, [0, 0.03, 0], tea, 16));
  // tablet in a clear case (photo 141): warm dark-grey screen, light translucent rim
  const tablet = grp(cushion([0.3, 0.008, 0.22], [0, 0.004, 0], 0.003, new THREE.MeshStandardMaterial({ color: '#cfcec9', roughness: 0.3 })), box([0.27, 0.001, 0.19], [0, 0.0085, 0], new THREE.MeshStandardMaterial({ color: '#2c2a2a', roughness: 0.15, metalness: 0.2 })));
  const closedLaptop = cushion([0.36, 0.02, 0.25], [0, 0.01, 0], 0.004, new THREE.MeshStandardMaterial({ color: '#3b3c3e', roughness: 0.45, metalness: 0.3 })); // photo 141
  const papers = grp(box([0.21, 0.002, 0.297], [0, 0.001, 0], paper), box([0.21, 0.002, 0.297], [0.03, 0.003, -0.02], paper).rotateY(0.2));

  // ---- floor things ----
  const bin = grp(
    mesh(new THREE.CylinderGeometry(0.135, 0.105, 0.3, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.45, side: THREE.DoubleSide })),
    cylinder(0.105, 0.005, [0, -0.147, 0], m.trim, 28),
  );
  bin.children[0].position.y = 0.15;
  bin.children[1].position.y = 0.003;
  const carton = grp(box([0.12, 0.5, 0.66], [0, 0.25, 0], m.appliance), box([0.122, 0.04, 0.5], [0, 0.42, 0], m.black), box([0.122, 0.07, 0.1], [0, 0.08, 0.24], m.darkGrey));
  carton.add(box([0.03, 0.025, 0.14], [0, 0.51, 0], m.black)); // carry handle
  // white IKEA flat-pack carton with the black logo frame and label print (photos 136–138)
  const ikeaBox = grp(box([0.32, 1.45, 0.06], [0, 0.725, 0], m.appliance), box([0.16, 0.06, 0.062], [0, 1.15, 0], m.black), box([0.2, 0.25, 0.062], [0, 0.35, 0], m.whiteMatte));

  const chair = (x: number, z: number, r: number, name: string) => tagged(place(whiteChair(), [x, 0, z], r), name, movable(3.5, 'plastic', 'compound'));
  const CH = { x: -1.22, z: -1.66, r: Math.PI + 0.12 };
  const FC = { x: -2.95, z: -1.86, r: Math.PI - 0.55 };
  return [
    item('desk-west', movable(16, 'wood', 'compound'), ...desk(DESK_W)),
    item('desk-east', movable(18, 'wood', 'compound'), ...desk(DESK_E)),

    // left desk (photo 141): black laptop with the headphone case and DualSense on it, tablet, mouse, papers
    on(place(closedLaptop, [xW + 0.08, T, -2.62], 0.08), 'laptop-closed', 1.8, 'metal', 'box'),
    on(place(tablet, [xW + 0.12, T + 0.02, -2.45], 0.15), 'tablet', 0.5, 'glass', 'box'),
    on(place(gamingMouse(), [xW + 0.36, T, -2.4], 0.2), 'gaming-mouse', 0.1, 'plastic'),
    on(place(dualSense(), [xW + 0.17, T + 0.02, -2.62], 0.35), 'ps5-controller', 0.28, 'plastic'),
    on(place(headphoneCase(), [xW - 0.01, T + 0.02, -2.68], 0.2), 'headphone-case', 0.3, 'plastic'),
    on(place(papers, [xW - 0.24, T, -2.5], 0.35), 'papers', 0.1, 'cardboard', 'box'),

    // right desk (owner + photos 130–133): laptop, figurines, umbrella, glass mug, white mouse
    on(place(openLaptop(), [xE + 0.1, T, -2.6]), 'laptop', 2, 'metal', 'box'),
    on(place(deskFigurines(), [DESK_E[0] + 0.3, T, -2.72], 0.2), 'desk-figurines', 0.15, 'plastic'),
    on(place(foldedUmbrella(), [DESK_E[0] + 0.27, T, -2.36], 0.3), 'umbrella', 0.4, 'soft', 'cylinder'),
    on(place(mug, [xE + 0.12, T, -2.32]), 'glass-mug', 0.3, 'glass', 'cylinder'),
    on(place(gamingMouse(true), [xE + 0.33, T, -2.42], -0.2), 'white-mouse', 0.1, 'plastic'),

    // in the gap between the desks
    on(place(carton, [-2.385, 0, -2.52]), 'monitor-carton', 6, 'cardboard', 'box'),
    on(place(snackCart(), [-2.0, 0, -2.62]), 'snack-cart', 4, 'metal', 'compound'),
    on(place(paperBag(), [-1.98, 0, -2.2], 0.25), 'paper-bag', 0.5, 'cardboard', 'container'),
    tagged(place(bin, [-1.82, 0, -1.92]), 'waste-bin', { ...movable(0.5, 'plastic', 'container'), round: true }),

    // left desk seating: folding chair (backpack, navy hoodie over the back) and a white chair
    on(place(foldingChair(), [FC.x, 0, FC.z], FC.r), 'folding-chair', 4, 'metal', 'compound'),
    on(place(backpack(), [FC.x + Math.sin(FC.r) * -0.08, 0.465, FC.z + Math.cos(FC.r) * -0.08], FC.r), 'laptop-backpack', 1.5, 'soft'),
    on(place(jacketOnChair('#1d2232'), [FC.x, 0, FC.z], FC.r), 'navy-hoodie', 0.8, 'soft'),
    chair(-2.5, -1.97, Math.PI - 0.1, 'white-chair-desk-west'),
    on(place(ikeaBox, [-3.2, 0, -1.9], Math.PI / 2).rotateX(-0.07), 'ikea-flatpack', 8, 'cardboard', 'box'),

    // right desk seating: the white chair with the black coat over its back
    chair(CH.x, CH.z, CH.r, 'white-chair-desk-east'),
    tagged(place(jacketOnChair(), [CH.x, 0, CH.z], CH.r), 'black-coat', movable(1.5, 'soft')),

    // under / beside the right desk: clear box of cables, protein tub
    on(place(cableBin(), [DESK_E[1] - 0.29, 0, -2.6], 0.05), 'cable-bin', 2.5, 'plastic', 'container'),
    on(place(proteinTub(), [DESK_E[1] - 0.2, 0, -1.98], 0.6), 'protein-tub', 2.3, 'plastic', 'cylinder'),
  ];
}

// IKEA KLEPPSTAD wardrobe (owner: 79 × 55 × 176, two doors, small round knobs, recessed plinth)
// against the north wall, with two empty over-door hooks and the cartons on top (photos 70–72, 126).
const KLEPP = { x0: -0.19, x1: 0.6, z0: -2.84, z1: -2.29, h: 1.76 };
function wardrobe() {
  const m = ausMaterials();
  const { x0, x1, z0, z1, h } = KLEPP;
  const white = new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.5 });
  const t = 0.016, xm = (x0 + x1) / 2;
  const carcass: THREE.Object3D[] = [
    boxSpan([x0, 0, z0], [x0 + t, h, z1 - 0.018], white),
    boxSpan([x1 - t, 0, z0], [x1, h, z1 - 0.018], white),
    boxSpan([x0, h - t, z0], [x1, h, z1 - 0.018], white),
    boxSpan([x0 + t, 0, z1 - 0.06], [x1 - t, 0.06, z1 - 0.04], white), // recessed plinth
    boxSpan([x0, 0, z0], [x1, h, z0 + 0.004], white),
  ];
  // two doors from the plinth to the top, 3 mm gap at the centre, small round knobs at ~1 m
  for (const [a, b] of [[x0 + 0.002, xm - 0.0015], [xm + 0.0015, x1 - 0.002]] as const) {
    carcass.push(boxSpan([a, 0.062, z1 - 0.018], [b, h - 0.002, z1], white));
  }
  for (const s of [-1, 1]) {
    const knob = new THREE.Group().add(cylinder(0.006, 0.02, [0, 0, 0], white, 12).rotateX(Math.PI / 2), sphere(1, [0, 0, 0.012], white, [0.013, 0.013, 0.008]));
    knob.position.set(xm + s * 0.035, 0.98, z1 + 0.01);
    carcass.push(knob);
  }
  const hookMat = new THREE.MeshStandardMaterial({ color: '#1d1e20', roughness: 0.4, metalness: 0.5 });
  const hook = (x: number) => [
    box([0.025, 0.003, 0.024], [x, h + 0.0015, z1 - 0.009], hookMat),
    box([0.025, 0.12, 0.003], [x, h - 0.06, z1 + 0.002], hookMat),
    tube([[x, h - 0.12, z1 + 0.003], [x, h - 0.15, z1 + 0.03], [x, h - 0.13, z1 + 0.05]], 0.004, hookMat, 8),
  ];
  carcass.push(...hook(x0 + 0.2), ...hook(x1 - 0.2));

  // cartons on top: flat brown carton, the orange carton on it with its flaps open (white inside)
  const cardboard = new THREE.MeshStandardMaterial({ color: '#b48a5c', roughness: 0.9 });
  const orange = new THREE.MeshStandardMaterial({ color: '#e8742a', roughness: 0.85 });
  const inside = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.9, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2725', roughness: 0.9 });
  const flat = item('flat-carton', movable(1.5, 'cardboard', 'box'), boxSpan([x0 + 0.04, h, z0 + 0.06], [x1 - 0.02, h + 0.12, z1 - 0.04], cardboard));
  const ob = new THREE.Group();
  const OW = 0.4, OD = 0.32, OH = 0.24;
  ob.add(box([OW, OH, OD], [0, OH / 2, 0], orange), box([OW - 0.01, 0.002, OD - 0.01], [0, OH - 0.004, 0], dark));
  for (const s of [-1, 1]) {
    const f = new THREE.Group().add(box([0.004, 0.16, OD], [0, 0.08, 0], orange), box([0.001, 0.155, OD - 0.01], [-s * 0.0025, 0.08, 0], inside));
    f.position.set(s * OW / 2, OH, 0);
    f.rotation.z = -s * 0.35;
    ob.add(f);
  }
  for (const s of [-1, 1]) {
    const f = new THREE.Group().add(box([OW - 0.02, 0.12, 0.004], [0, 0.06, 0], inside));
    f.position.set(0, OH, s * OD / 2);
    f.rotation.x = s * 0.5;
    ob.add(f);
  }
  return [
    item('kleppstad-wardrobe', FIXED, ...carcass),
    flat,
    tagged(place(ob, [xm + 0.02, h + 0.12, (z0 + z1) / 2 + 0.04], 0.05), 'orange-carton', movable(1, 'cardboard', 'box')),
  ];
}

// pine bookshelf under the stair, packed with Chinese board games (owner + photos 67–69): stacks of
// flat boxes with the titled spine out, a few small card-game boxes standing upright
function stairShelf() {
  const m = ausMaterials();
  const parts: THREE.Object3D[] = [];
  const x0 = 0.62, x1 = 1.42, z0 = -2.84, z1 = -2.44, h = 1.82;
  const levels = [0.05, 0.42, 0.8, 1.18, 1.56, h - 0.02];
  for (const x of [x0, x1 - 0.018]) parts.push(boxSpan([x, 0, z0], [x + 0.018, h, z1], m.pine));
  for (const y of levels) parts.push(boxSpan([x0, y, z0], [x1, y + 0.02, z1], m.pine));
  parts.push(boxSpan([x0, 0, z0], [x1, h, z0 + 0.005], m.pineDark));

  const games = boardGameKit();
  const rand = mulberry32(21);
  const shelves = levels.length - 1;
  for (let k = 0; k < shelves; k++) {
    const y0 = levels[k] + 0.02, yMax = levels[k + 1] - 0.012;
    let x = x0 + 0.022;
    // every title appears once (owner): spread what is left evenly over the remaining shelves
    let quota = Math.ceil(games.left() / (shelves - k));
    const put = (b: THREE.Mesh | null) => { if (b) { parts.push(b); quota--; } return !!b; };
    while (x < x1 - 0.06 && quota > 0) {
      const left = x1 - 0.022 - x;
      if (rand() < 0.22 && left > 0.07) {
        // a row of small card-game boxes standing upright, spine out
        const n = 2 + Math.floor(rand() * 3), bh = 0.14 + rand() * 0.06, bd = 0.1 + rand() * 0.05;
        for (let i = 0; i < n && x < x1 - 0.06 && quota > 0; i++) {
          const bw = Math.min(0.03 + rand() * 0.03, x1 - 0.022 - x);
          if (!put(games.box(bw, bh, bd, [x + bw / 2, y0 + bh / 2, z1 - 0.02 - bd / 2], true))) break;
          x += bw + 0.002;
        }
        x += 0.006;
        continue;
      }
      // a stack of flat big-box games, slightly staggered
      const w = Math.min(0.2 + rand() * 0.12, left);
      if (w < 0.12) break;
      let y = y0;
      while (quota > 0) {
        const bh = 0.045 + rand() * 0.05, bw = w - rand() * 0.03, bd = 0.24 + rand() * 0.08;
        if (y + bh > yMax) break;
        if (!put(games.box(bw, bh, bd, [x + w / 2 + (rand() - 0.5) * 0.01, y + bh / 2, z1 - 0.015 - bd / 2], false))) break;
        y += bh;
      }
      x += w + 0.008;
    }
  }
  return [
    item('pine-bookshelf', FIXED, ...parts),
    tagged(place(whiteSuitcase(), [1.71, 0, -2.68]), 'suitcase-white', movable(4, 'plastic', 'box')),
    tagged(place(canisterVacuum(), [2.25, 0, -2.56], 0.05), 'vacuum-cleaner', movable(5.5, 'plastic', 'compound')),
  ];
}

/**
 * Board-game boxes with printed spines: one canvas atlas of titled spines (Chinese titles on dark,
 * saturated or white grounds, like the shelf in photos 67–69) mapped onto each box's front face.
 * Each title is used once (owner: no duplicate games); box() returns null when they run out.
 */
function boardGameKit() {
  const grounds = ['#7c1f22', '#1d1f24', '#23452f', '#efe9dc', '#2b3f73', '#b8322a', '#5b2d5e', '#d9a334', '#11405a', '#3a2a22'];
  const titles = ['三國殺', '狼人殺', '璀璨寶石', '卡坦島', '富饒之城', '阿瓦隆', '妙語說書人', '德國心臟病', '矮人礦坑', '風聲', '大富翁', '拉密', '花火', '傳情畫意', '殖民火星', '馬尼拉', '電力公司', '印加寶藏', '誰是牛頭王', '駱駝大賽', '諜報風雲', '石器時代', '農家樂', '冷戰熱鬥'];
  const COLS = 4, ROWS = Math.ceil(titles.length / COLS), CW = 256, CH = 64;
  const c = document.createElement('canvas');
  c.width = COLS * CW; c.height = ROWS * CH;
  const x = c.getContext('2d')!;
  const rnd = mulberry32(77);
  const cellGround: number[] = [];
  for (let i = 0; i < titles.length; i++) {
    const gi = Math.floor(rnd() * grounds.length), cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH;
    cellGround.push(gi);
    x.fillStyle = grounds[gi]; x.fillRect(cx, cy, CW, CH);
    const light = gi === 3 || gi === 7;
    x.fillStyle = light ? '#1d1d1d' : rnd() < 0.5 ? '#f3e7c8' : '#e9c46a';
    x.font = `bold ${30 + Math.floor(rnd() * 10)}px "Microsoft JhengHei", "Noto Sans TC", "PingFang TC", sans-serif`;
    x.textBaseline = 'middle';
    x.fillText(titles[i], cx + 18 + rnd() * 20, cy + CH / 2);
    x.fillStyle = light ? '#8a2b22' : '#ffffff';
    x.fillRect(cx + CW - 40, cy + 14, 24, CH - 28); // publisher logo block
  }
  const atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 8;
  const spine = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55 });
  const sides = grounds.map((col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
  const order = titles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return {
    left: () => order.length,
    box(w: number, h: number, d: number, at: [number, number, number], upright: boolean) {
      const cell = order.pop();
      if (cell === undefined) return null;
      const geo = new THREE.BoxGeometry(w, h, d);
      const u0 = (cell % COLS) / COLS, u1 = u0 + 1 / COLS;
      const v1 = 1 - Math.floor(cell / COLS) / ROWS, v0 = v1 - 1 / ROWS;
      const uv = geo.getAttribute('uv');
      // +z face (vertices 16–19): upright boxes read the title bottom-to-top
      const corners: [number, number][] = upright ? [[u1, v1], [u1, v0], [u0, v1], [u0, v0]] : [[u0, v1], [u1, v1], [u0, v0], [u1, v0]];
      corners.forEach(([u, v], i) => uv.setXY(16 + i, u, v));
      const side = sides[cellGround[cell]];
      const b = new THREE.Mesh(geo, [side, side, side, side, spine, side]);
      b.position.set(...at);
      b.castShadow = b.receiveShadow = true;
      // each game is its own item (Knolling), named by its title
      return tagged(b, `board-game-${titles[cell]}`, movable(0.8, 'cardboard', 'box'));
    },
  };
}

/** White hard-shell suitcase standing upright (scan: x 1.5 … 1.9, 0.62 tall): ribbed shell, wheels, handle. */
function whiteSuitcase() {
  const shell = new THREE.MeshStandardMaterial({ color: '#efefec', roughness: 0.3 });
  const grey = new THREE.MeshStandardMaterial({ color: '#8f9296', roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.5 });
  const g = new THREE.Group();
  const W = 0.4, H = 0.56, D = 0.25, lift = 0.05;
  g.add(place(mesh(new RoundedBoxGeometry(W, H, D, 5, 0.04), shell), [0, lift + H / 2, 0]));
  for (let i = -2; i <= 2; i++) g.add(place(mesh(new RoundedBoxGeometry(0.03, H - 0.1, 0.01, 2, 0.004), shell), [i * 0.07, lift + H / 2, D / 2 + 0.002]));
  g.add(box([W + 0.004, 0.012, D + 0.004], [0, lift + H / 2, 0], grey)); // zip seam
  g.add(box([0.16, 0.025, 0.05], [0, lift + H + 0.005, -0.06], grey)); // trolley handle housing
  g.add(box([0.12, 0.02, 0.03], [0, lift + H + 0.025, -0.06], black));
  g.add(box([0.025, 0.12, 0.03], [W / 2 + 0.012, lift + H * 0.55, 0], black)); // side carry handle
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box([0.04, 0.03, 0.04], [sx * (W / 2 - 0.04), lift - 0.005, sz * (D / 2 - 0.04)], black));
    g.add(cylinder(0.022, 0.02, [sx * (W / 2 - 0.04), 0.022, sz * (D / 2 - 0.04)], black, 12).rotateZ(Math.PI / 2));
  }
  return g;
}

/**
 * Black bagless canister vacuum (owner's reference): cyclone body with a clear bin and grey cyclone
 * cap, big rear wheels, ribbed hose to the handle, chrome wand standing on the floor head.
 * Local: body nose toward +x, wheels at −x.
 */
function canisterVacuum() {
  const black = new THREE.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.45 });
  const grey = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.4, metalness: 0.2 });
  const clear = new THREE.MeshStandardMaterial({ color: '#c9d2d8', roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false });
  const navy = new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d4d6d8', roughness: 0.15, metalness: 0.95 });
  const g = new THREE.Group();
  // chassis
  g.add(place(mesh(new RoundedBoxGeometry(0.36, 0.1, 0.24, 4, 0.04), black), [0, 0.07, 0]));
  g.add(place(mesh(new RoundedBoxGeometry(0.16, 0.2, 0.22, 4, 0.06), black), [-0.1, 0.17, 0])); // motor housing
  // big rear wheels with spoke discs
  for (const s of [-1, 1]) {
    g.add(cylinder(0.11, 0.035, [-0.12, 0.11, s * 0.135], black, 32).rotateX(Math.PI / 2));
    g.add(cylinder(0.075, 0.037, [-0.12, 0.11, s * 0.135], grey, 10).rotateX(Math.PI / 2));
  }
  // clear cyclone bin, navy cone inside, grey multi-cyclone cap
  g.add(cylinder(0.09, 0.15, [0.05, 0.2, 0], clear, 32));
  g.add(cylinder(0.035, 0.12, [0.05, 0.19, 0], navy, 16, 0.05));
  g.add(cylinder(0.095, 0.02, [0.05, 0.285, 0], grey, 32));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(cylinder(0.022, 0.05, [0.05 + Math.cos(a) * 0.06, 0.315, Math.sin(a) * 0.06], grey, 10, 0.012));
  }
  g.add(cylinder(0.01, 0.006, [0.05, 0.12, 0.092], navy, 8));
  // hose inlet at the nose, ribbed hose up to the handle
  const inlet: [number, number, number] = [0.19, 0.08, 0];
  g.add(cylinder(0.025, 0.06, inlet, black, 16).rotateZ(Math.PI / 2));
  const handle: [number, number, number] = [0.36, 0.72, 0.16];
  const hosePts: [number, number, number][] = [[0.22, 0.08, 0], [0.36, 0.06, -0.12], [0.52, 0.2, -0.16], [0.56, 0.55, -0.05], [0.5, 0.82, 0.08], [0.4, 0.8, 0.15], handle];
  g.add(tube(hosePts, 0.018, black, 64));
  const rib = new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.4 });
  const curve = new THREE.CatmullRomCurve3(hosePts.map((p) => new THREE.Vector3(...p)));
  for (let i = 1; i < 40; i++) {
    const p = curve.getPointAt(i / 40), tg = curve.getTangentAt(i / 40);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0025, 4, 14), rib);
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
    g.add(ring);
  }
  // curved grip, chrome wand down to the floor head
  const foot: [number, number, number] = [0.52, 0.04, 0.2];
  g.add(tube([handle, [0.37, 0.76, 0.16], [0.42, 0.74, 0.17]], 0.016, black, 12));
  g.add(tube([[0.42, 0.74, 0.17], [0.43, 0.68, 0.172]], 0.016, black, 4));
  g.add(tube([[0.43, 0.68, 0.172], foot], 0.0155, chrome, 4));
  g.add(cylinder(0.019, 0.04, [0.475, 0.37, 0.186], black, 12).rotateZ(0.13)); // length clamp
  g.add(place(mesh(new RoundedBoxGeometry(0.1, 0.035, 0.26, 3, 0.012), black), [foot[0] + 0.03, 0.0175, foot[2]]));
  g.add(sphere(1, [foot[0], 0.045, foot[2]], black, [0.03, 0.025, 0.03]));
  return g;
}

/** Canvas-printed material helper for packaging. */
function printed(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, roughness = 0.6) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness });
}

/** Box whose side faces (±x, ±z) carry the print and whose top/bottom are plain. */
function printedBox(size: [number, number, number], side: THREE.Material, top: THREE.Material) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(...size), [side, side, top, top, side, side]);
  b.castShadow = b.receiveShadow = true;
  return b;
}

/** Quilton-style toilet-paper bulk pack: white rolls showing through the wrap, purple print band. */
function toiletPaperPack(size: [number, number, number], count: string) {
  const side = printed(256, 256, (x, w, h) => {
    x.fillStyle = '#f4f2f4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { // roll seams
      const g = x.createLinearGradient(i * 64, 0, i * 64 + 64, 0);
      g.addColorStop(0, '#d8d4dc'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#d8d4dc');
      x.fillStyle = g; x.fillRect(i * 64, 0, 64, h);
    }
    x.fillStyle = '#4b2f8f'; x.fillRect(0, h * 0.52, w, h * 0.4);
    x.fillStyle = '#6a4bb5'; x.fillRect(0, h * 0.52, w, 8);
    x.fillStyle = '#ffffff'; x.font = 'italic bold 54px Georgia, serif'; x.fillText('Quilton', 30, h * 0.72);
    x.font = 'bold 22px Arial'; x.fillText('3 PLY', 34, h * 0.85);
    x.fillStyle = '#f2c94c'; x.beginPath(); x.arc(w - 46, h * 0.8, 26, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#4b2f8f'; x.font = 'bold 22px Arial'; x.textAlign = 'center'; x.fillText(count, w - 46, h * 0.8 + 8);
  }, 0.35);
  const top = printed(128, 128, (x, w, h) => {
    x.fillStyle = '#e9e6ee'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 15, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#b9a98e'; x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 5, 0, Math.PI * 2); x.fill();
    }
  }, 0.35);
  const g = new THREE.Group();
  const b = printedBox(size, side, top);
  b.position.y = size[1] / 2;
  g.add(b);
  return g;
}

/** Open red UMALL carton with the blue Wettex-style roll, a Galli chestnut box and bottles inside. Local: print faces −x. */
function umallCarton() {
  const red = printed(256, 160, (x, w, h) => {
    x.fillStyle = '#d62a24'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff'; x.font = 'bold 13px Arial'; x.fillText("Australia's Largest Online Asian Supermarket", 10, 22);
    x.font = 'bold 74px Arial'; x.fillText('UMALL', 14, 118);
  }, 0.85);
  const plain = new THREE.MeshStandardMaterial({ color: '#c9302a', roughness: 0.85, side: THREE.DoubleSide });
  const kraft = new THREE.MeshStandardMaterial({ color: '#b98d5f', roughness: 0.9, side: THREE.DoubleSide });
  const W = 0.4, D = 0.48, H = 0.24; // W along x (front −x), D along z
  const g = new THREE.Group();
  g.add(box([W, 0.004, D], [0, 0.002, 0], kraft));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(D, H), red);
  front.rotation.y = -Math.PI / 2; front.position.set(-W / 2, H / 2, 0);
  g.add(front);
  g.add(box([0.004, H, D], [W / 2, H / 2, 0], plain));
  for (const s of [-1, 1]) g.add(box([W, H, 0.004], [0, H / 2, s * D / 2], plain));
  // flaps folded open
  for (const s of [-1, 1]) {
    const f = new THREE.Group().add(box([W - 0.01, 0.003, D / 2], [0, 0, s * D / 4], kraft));
    f.position.set(0, H, s * D / 2);
    f.rotation.x = s * 1.9;
    g.add(f);
  }
  const back = new THREE.Group().add(box([0.003, D / 2 * 0.9, D - 0.01], [0, D / 4 * 0.9, 0], kraft));
  back.position.set(W / 2, H, 0); back.rotation.z = -0.35; g.add(back);
  // contents
  const wettex = printed(128, 64, (x, w, h) => {
    x.fillStyle = '#7cc6ea'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5aa8d6'; for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) x.fillRect(i * 8 + (j % 2) * 4, j * 8, 3, 3);
  }, 0.95);
  // the cloth roll stands upright, poking out of the box (photo 176)
  const roll = new THREE.Group().add(cylinder(0.1, 0.24, [0, 0.12, 0], wettex, 24), cylinder(0.025, 0.242, [0, 0.12, 0], new THREE.MeshStandardMaterial({ color: '#e8f1f6' }), 12));
  roll.position.set(-0.04, 0.01, -0.12);
  g.add(roll);
  const galli = printed(128, 160, (x, w, h) => {
    x.fillStyle = '#7bbf3a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d42a26'; x.fillRect(0, 0, w, 34);
    x.fillStyle = '#ffffff'; x.font = 'italic bold 26px Arial'; x.fillText('Galli', 30, 27);
    x.fillStyle = '#2b5a12'; x.font = 'bold 16px Arial'; x.fillText('ROASTED', 18, 62); x.fillText('CHESTNUTS', 12, 82);
    x.fillStyle = '#9a5a2a'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(28 + i * 18, 125, 13, 0, Math.PI * 2); x.fill(); }
  });
  const gb = printedBox([0.07, 0.26, 0.2], galli, new THREE.MeshStandardMaterial({ color: '#7bbf3a', roughness: 0.6 }));
  gb.position.set(0.05, 0.13, 0.1); gb.rotation.set(0, 0.15, -0.08);
  g.add(gb);
  for (const [bx, bz] of [[-0.1, 0.12], [-0.06, 0.17]]) g.add(cylinder(0.025, 0.2, [bx, 0.1, bz], new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.3 }), 12));
  return g;
}

/** Shrink-wrapped multipack of blue cans (2 × 3), red label band. */
function canPack() {
  const can = printed(64, 64, (x, w, h) => {
    x.fillStyle = '#2a63c9'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d8342a'; x.fillRect(0, h * 0.42, w, h * 0.22);
    x.fillStyle = '#ffffff'; x.fillRect(0, h * 0.12, w, 4);
  }, 0.3);
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.add(cylinder(0.033, 0.12, [(i - 1) * 0.067, 0.06, (j - 0.5) * 0.067], can, 16));
  g.add(box([0.205, 0.124, 0.138], [0, 0.062, 0], new THREE.MeshStandardMaterial({ color: '#cfe0f5', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false })));
  return g;
}

/** Living-room side of the kitchen peninsula (photos 172–179; scan x 1.12 … 1.50, z 0.24 … 1.47). */
function peninsulaClutter() {
  const white = printed(128, 96, (x, w, h) => {
    x.fillStyle = '#f2f2f0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#6a8fb8'; x.font = 'bold 13px Arial'; x.fillText('clevinger', 10, 22);
    x.fillStyle = '#d7dde3'; x.fillRect(64, 40, 50, 34);
    x.fillStyle = '#222'; for (let i = 0; i < 9; i++) x.fillRect(12 + i * 4, 70, 2, 14);
  });
  const navy = printed(128, 96, (x, w, h) => {
    x.fillStyle = '#1f2b4a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff'; x.fillRect(46, 10, 60, 24);
    x.fillStyle = '#d33a2c'; x.font = 'bold 16px Arial'; x.fillText('康師傅', 50, 28);
    x.fillStyle = '#c9d0de'; for (let i = 0; i < 4; i++) x.fillRect(10, 48 + i * 10, 108, 3);
  });
  const plainWhite = new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.7 });
  const plainNavy = new THREE.MeshStandardMaterial({ color: '#1f2b4a', roughness: 0.7 });
  const whiteBox = printedBox([0.34, 0.2, 0.3], white, plainWhite);
  const navyBox = printedBox([0.3, 0.24, 0.26], navy, plainNavy);
  const flap = box([0.3, 0.003, 0.14], [0.03, 0.245, -0.12], plainWhite);
  flap.rotation.x = -0.4;
  return [
    tagged(place(toiletPaperPack([0.42, 0.5, 0.42], '48'), [1.27, 0, 0.51]), 'toilet-paper-48-pack', movable(4, 'soft', 'box')),
    tagged(place(toiletPaperPack([0.38, 0.32, 0.36], '20'), [1.27, 0.5, 0.51], 0.08), 'toilet-paper-20-pack', movable(2, 'soft', 'box')),
    tagged(place(umallCarton(), [1.28, 0, 0.98]), 'umall-carton', movable(3, 'cardboard', 'container')),
    tagged(place(new THREE.Group().add(whiteBox.translateY(0.1)), [1.3, 0, 1.39]), 'white-carton', movable(1.5, 'cardboard', 'box')),
    tagged(place(canPack(), [1.3, 0.2, 1.39], Math.PI / 2), 'can-pack-1', movable(2.5, 'metal', 'box')),
    tagged(place(canPack(), [1.3, 0.324, 1.4], Math.PI / 2 + 0.1), 'can-pack-2', movable(2.5, 'metal', 'box')),
    tagged(place(new THREE.Group().add(navyBox.translateY(0.12), flap), [1.31, 0, 1.69]), 'noodle-carton', movable(3, 'cardboard', 'box')),
  ];
}

// white 2×3 cube unit standing against the AC pier, open to the north (photos 178, 261, 264; scan
// x 0.46 … 1.18, z 1.82 … 2.16, top ≈ 1.0), full of kitchenware (owner): kitchen things on top, the
// silver rice cooker and the small green rice cooker in the middle row, the grill pan bottom right,
// the kitchenware in the top cells (as seen from the kitchen), with the KitKat carton beside it
function cubeShelf() {
  const m = ausMaterials();
  const parts: THREE.Object3D[] = [];
  const x0 = 0.46, x1 = 1.18, z0 = 1.82, z1 = 2.16, h = 1.02, t = 0.025;
  for (let j = 0; j <= 3; j++) {
    const y = Math.min(j * (h / 3), h - t);
    parts.push(boxSpan([x0, y, z0], [x1, y + t, z1], m.whiteMatte));
  }
  for (const x of [x0, (x0 + x1) / 2 - t / 2, x1 - t]) parts.push(boxSpan([x, 0, z0], [x + t, h, z1], m.whiteMatte));
  parts.push(boxSpan([x0, 0, z1 - 0.005], [x1, h, z1], m.whiteMatte));
  const xL = (x0 + (x0 + x1) / 2) / 2, xR = ((x0 + x1) / 2 + x1) / 2, zc = (z0 + z1) / 2 - 0.01;
  const yMid = h / 3 + t, yBot = t;

  // KitKat carton standing beside the shelf (photos 176, 178)
  const kitkat = printed(128, 256, (x, w, hh) => {
    x.fillStyle = '#d0202a'; x.fillRect(0, 0, w, hh);
    x.save(); x.translate(w / 2 + 8, hh - 16); x.rotate(-Math.PI / 2);
    x.fillStyle = '#ffffff'; x.font = 'italic 22px Georgia, serif'; x.fillText('Have a break, have a', 0, 0);
    x.restore();
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(w / 2 - 20, 40, 22, 14, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#d0202a'; x.font = 'bold 13px Arial'; x.fillText('KitKat', w / 2 - 40, 45);
  });
  const red = printedBox([0.1, 0.5, 0.36], kitkat, new THREE.MeshStandardMaterial({ color: '#d0202a', roughness: 0.6 }));
  red.position.set(1.33, 0.25, 2.0);
  red.rotation.z = 0.08;
  return [
    item('cube-shelf', movable(14, 'wood', 'compound'), ...parts), // free-standing: can be pushed / dragged
    tagged(place(riceCookerSilver(), [xR, yMid, zc]), 'rice-cooker-silver', movable(3.5, 'metal', 'cylinder')),
    tagged(place(miniRiceCooker(), [xL, yMid, zc], -0.3), 'mini-rice-cooker-green', movable(2, 'plastic', 'cylinder')),
    tagged(place(grillPan(), [xL, yBot, zc]), 'grill-pan', movable(2.5, 'metal', 'box')),
    // seen from the kitchen the right-hand column is xL: tin, food box and mitts go in its top cell;
    // the water bottle and mugs in the left-hand column's top cell (owner); nothing on top
    ...shelfCellKitchenware(xL, xR, 2 * h / 3 + t, zc),
    item('kitkat-carton', movable(1, 'cardboard', 'box'), red),
  ];
}

/** Silver electric rice cooker (Tatung-style): steel body, black rim band, domed lid with knob, side handles, switch. */
function riceCookerSilver() {
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccce', roughness: 0.22, metalness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.5 });
  const g = new THREE.Group();
  g.add(cylinder(0.105, 0.012, [0, 0.006, 0], black, 28));
  g.add(lathe([[0.001, 0.012], [0.11, 0.012], [0.12, 0.05], [0.122, 0.17], [0.116, 0.19], [0.001, 0.19]], steel, 40));
  g.add(cylinder(0.124, 0.012, [0, 0.188, 0], black, 40));
  g.add(lathe([[0.118, 0.194], [0.11, 0.215], [0.07, 0.236], [0.02, 0.242], [0.001, 0.242]], steel, 40));
  g.add(cylinder(0.018, 0.02, [0, 0.25, 0], black, 16));
  for (const s of [-1, 1]) g.add(tube([[s * 0.12, 0.16, -0.03], [s * 0.145, 0.165, 0], [s * 0.12, 0.16, 0.03]], 0.008, black, 8));
  g.add(box([0.03, 0.04, 0.012], [0, 0.07, 0.122], black)); // cook switch
  return g;
}

/** Small green mini rice cooker (SUPOR-style): teal body, rounded lid, control panel. */
function miniRiceCooker() {
  const teal = new THREE.MeshStandardMaterial({ color: '#2f6f6a', roughness: 0.3, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#173b39', roughness: 0.25 });
  const g = new THREE.Group();
  g.add(lathe([[0.001, 0], [0.085, 0], [0.095, 0.02], [0.098, 0.13], [0.09, 0.15], [0.001, 0.15]], teal, 32));
  g.add(lathe([[0.092, 0.15], [0.085, 0.175], [0.05, 0.192], [0.001, 0.196]], dark, 32));
  g.add(cylinder(0.035, 0.012, [0, 0.2, 0], teal, 16));
  g.add(box([0.06, 0.05, 0.01], [0, 0.08, 0.096], new THREE.MeshStandardMaterial({ color: '#0e1f1e', roughness: 0.2 })));
  g.add(cylinder(0.008, 0.004, [0, 0.08, 0.102], new THREE.MeshStandardMaterial({ color: '#d6d9d8', roughness: 0.3 }), 10).rotateX(Math.PI / 2));
  return g;
}

/** Electric grill pan lying in the cell: black ridged plate with a rim, two side handles and its cord. */
function grillPan() {
  const black = new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.45, metalness: 0.3 });
  const g = new THREE.Group();
  g.add(place(mesh(new RoundedBoxGeometry(0.3, 0.035, 0.26, 3, 0.012), black), [0, 0.0175, 0]));
  for (let i = -5; i <= 5; i++) g.add(box([0.012, 0.006, 0.22], [i * 0.024, 0.037, 0], black));
  for (const s of [-1, 1]) g.add(box([0.04, 0.02, 0.08], [s * 0.165, 0.025, 0], black));
  g.add(tube([[0.17, 0.02, 0.06], [0.15, 0.01, 0.13], [0.0, 0.006, 0.14], [-0.1, 0.006, 0.1]], 0.004, black, 16));
  return g;
}

/** Kitchenware put away in the cube unit's top cells (owner; items from photo 178). */
function shelfCellKitchenware(xRight: number, xLeft: number, y: number, zc: number) {
  const ceramic = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.3 });
  const blueBand = new THREE.MeshStandardMaterial({ color: '#3d5fa8', roughness: 0.35 });
  const pink = new THREE.MeshStandardMaterial({ color: '#d9a99a', roughness: 0.35 });
  const mug = (mat: THREE.Material, band?: THREE.Material) => {
    const g = new THREE.Group();
    g.add(lathe([[0.001, 0], [0.04, 0], [0.042, 0.09], [0.037, 0.09], [0.035, 0.006], [0.001, 0.006]], mat, 24));
    if (band) g.add(cylinder(0.0425, 0.03, [0, 0.05, 0], band, 24));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14, Math.PI), mat).rotateZ(-Math.PI / 2).translateY(0.045).translateX(0.0));
    (g.children[g.children.length - 1] as THREE.Mesh).position.set(0.042, 0.045, 0);
    return g;
  };
  const mitt = () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.9 });
    g.add(mesh(new RoundedBoxGeometry(0.16, 0.03, 0.28, 3, 0.014), mat).translateY(0.015));
    g.add(sphere(1, [0.075, 0.015, -0.06], mat, [0.03, 0.014, 0.06]));
    return g;
  };
  const container = new THREE.Group();
  container.add(box([0.18, 0.09, 0.13], [0, 0.045, 0], new THREE.MeshStandardMaterial({ color: '#e7eef2', roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false })));
  container.add(place(mesh(new RoundedBoxGeometry(0.19, 0.02, 0.14, 2, 0.008), new THREE.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.3 })), [0, 0.1, 0]));
  container.add(cylinder(0.04, 0.008, [0, 0.112, 0], new THREE.MeshStandardMaterial({ color: '#3f4a55', roughness: 0.3 }), 20));
  const shaker = new THREE.Group().add(
    cylinder(0.04, 0.2, [0, 0.1, 0], new THREE.MeshStandardMaterial({ color: '#2f9fe0', roughness: 0.35 }), 20),
    cylinder(0.042, 0.035, [0, 0.215, 0], new THREE.MeshStandardMaterial({ color: '#1f86c6', roughness: 0.35 }), 20),
  );
  const flossLabel = printed(128, 64, (x, w, h) => {
    x.fillStyle = '#9fcf3a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1f3e10'; x.font = 'bold 14px Arial'; x.fillText('PORK FLOSS', 14, 24);
    x.fillStyle = '#b8642a'; x.beginPath(); x.ellipse(64, 46, 30, 12, 0, 0, Math.PI * 2); x.fill();
  }, 0.4);
  const tin = new THREE.Group().add(cylinder(0.055, 0.12, [0, 0.06, 0], flossLabel, 24), cylinder(0.056, 0.012, [0, 0.124, 0], new THREE.MeshStandardMaterial({ color: '#c9cbcc', metalness: 0.8, roughness: 0.3 }), 24));
  return [
    // right-hand column (xRight): food box with the mitts folded on its lid, the floss tin beside it
    tagged(place(container, [xRight - 0.05, y, zc + 0.01]), 'food-container', movable(0.4, 'plastic', 'box')),
    tagged(place(mitt(), [xRight - 0.05, y + 0.12, zc + 0.01]), 'oven-mitts', movable(0.2, 'soft')),
    tagged(place(tin, [xRight + 0.1, y, zc - 0.02]), 'pork-floss-tin', movable(0.4, 'metal', 'cylinder')),
    // left-hand column (xLeft): the water bottle and two mugs
    tagged(place(shaker, [xLeft - 0.09, y, zc - 0.02]), 'shaker-bottle', movable(0.2, 'plastic', 'cylinder')),
    tagged(place(mug(ceramic, blueBand), [xLeft + 0.02, y, zc + 0.03], -0.6), 'mug-blue', movable(0.3, 'stone', 'cylinder')),
    tagged(place(mug(pink), [xLeft + 0.1, y, zc - 0.05], 0.8), 'mug-pink', movable(0.3, 'stone', 'cylinder')),
  ];
}

/**
 * IKEA HAMMARN sofa-bed, folded as a sofa (owner): W 128 × D 85 × H 78 cm, seat depth 70, seat
 * height 38. Black steel tube frame on two sled runners, loop armrests, a quilted dark-grey pad on
 * the seat and another on the slightly reclined back. Local: seat front +z, back −z.
 */
function hammarn() {
  const m = ausMaterials();
  const steel = new THREE.MeshStandardMaterial({ color: '#1f2022', roughness: 0.4, metalness: 0.55 });
  const fabric = m.sofaFabric.clone();
  fabric.color.set('#4a4c50');
  const seam = new THREE.MeshStandardMaterial({ color: '#2c2d30', roughness: 1 });
  const W = 1.28, D = 0.85, H = 0.78, SH = 0.38, SD = 0.7, r = 0.012;
  const hx = W / 2 - 0.02, zb = -D / 2 + 0.06, zf = D / 2 - 0.04, rail = 0.29;
  const g = new THREE.Group();
  const t = (pts: [number, number, number][], seg = 16) => g.add(tube(pts, r, steel, seg));
  for (const s of [-1, 1]) {
    const x = s * hx;
    // sled runner: on the floor, rising to the seat rail at both ends
    t([[x, rail, zb + 0.06], [x, 0.06, zb + 0.02], [x, r, zb + 0.1], [x, r, zf - 0.1], [x, 0.06, zf - 0.02], [x, rail, zf - 0.06]], 40);
    // seat rail
    t([[x, rail, zb], [x, rail, zf]], 4);
    // loop armrest: up from the back, along the top, down at the front
    t([[x, rail, zb + 0.05], [x, 0.6, zb + 0.07], [x, 0.62, zb + 0.14], [x, 0.62, zf - 0.16], [x, 0.58, zf - 0.08], [x, rail + 0.02, zf - 0.06]], 40);
    // back frame upright, reclined
    t([[x - s * 0.02, rail, zb], [x - s * 0.02, H - 0.02, zb - 0.06]], 4);
  }
  for (const [y, z] of [[rail, zb], [rail, zf], [r, -0.05], [H - 0.02, zb - 0.06]] as const) t([[-hx, y, z], [hx, y, z]], 4);
  // seat pad: quilted channels running across
  const seatW = W - 0.1;
  g.add(cushion([seatW, 0.08, SD], [0, SH - 0.04, zf - SD / 2 + 0.01], 0.03, fabric));
  for (let i = 1; i < 5; i++) g.add(box([seatW - 0.04, 0.004, 0.006], [0, SH + 0.001, zf - (i * SD) / 5 + 0.01], seam));
  // back pad on the reclined frame, quilted horizontally
  const back = new THREE.Group();
  back.add(cushion([seatW, 0.42, 0.06], [0, 0.21, 0], 0.025, fabric));
  for (let i = 1; i < 5; i++) back.add(box([seatW - 0.04, 0.006, 0.004], [0, (i * 0.42) / 5, 0.031], seam));
  back.position.set(0, SH, zb - 0.0);
  back.rotation.x = -0.16;
  g.add(back);
  return g;
}

// HAMMARN against the glass partition (face x −3.56), facing the room, from just south of the
// bedroom walk-in opening (z 0.44 … 1.18, kept clear) to z 2.48 (owner)
function hammarnSofa() {
  return tagged(place(hammarn(), [-3.56 + 0.425 + 0.01, 0, 1.84], Math.PI / 2), 'hammarn-sofa-bed', movable(25, 'soft', 'compound'));
}

// tripod lamp with a linen drum shade (IMG_0212), moved into the corner between the HAMMARN and the
// grey sofa (owner); legs spread 0.24 so they clear both
function tripodLamp() {
  const m = ausMaterials();
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    g.add(tube([[Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24], [0, 1.35, 0]], 0.012, m.black, 4));
  }
  g.add(cylinder(0.012, 0.25, [0, 1.47, 0], m.black, 8));
  g.add(lathe([[0.22, 0], [0.22, 0.3]], m.shade, 32).translateY(1.48));
  return tagged(place(g, [-2.43, 0, 2.38]), 'tripod-lamp', movable(4, 'metal'));
}

// ---- bedroom ------------------------------------------------------------------------------------

// pine single bed, frame 90 × 200 cm (owner), ladder headboard against the north wall, long side
// along the partition so it spans its two northern sliding panels (photo 225, IMG_1696)
export const BED = { x0: -4.66, x1: -3.76, z0: -1.68, z1: 0.32 };
function bed() {
  const m = ausMaterials();
  const parts: THREE.Object3D[] = [];
  const { x0, x1, z0, z1 } = BED;
  for (const x of [x0, x1 - 0.04]) {
    parts.push(boxSpan([x, 0, z0], [x + 0.04, 0.95, z0 + 0.05], m.timber));
    parts.push(boxSpan([x, 0, z1 - 0.05], [x + 0.04, 0.42, z1], m.timber));
    parts.push(boxSpan([x, 0.22, z0], [x + 0.025, 0.36, z1], m.timber));
  }
  for (const y of [0.42, 0.62, 0.8, 0.92]) parts.push(boxSpan([x0, y, z0 + 0.005], [x1, y + 0.06, z0 + 0.04], m.timber));
  for (let x = x0 + 0.11; x < x1 - 0.08; x += 0.14) parts.push(boxSpan([x, 0.42, z0 + 0.01], [x + 0.025, 0.92, z0 + 0.035], m.timber));
  parts.push(boxSpan([x0, 0.22, z1 - 0.04], [x1, 0.36, z1], m.timber));
  // mattress fills the frame between the side rails, headboard and foot rail, resting on the slats
  const MB = 0.3, MT = 0.5, mx0 = x0 + 0.025, mx1 = x1 - 0.025, mz0 = z0 + 0.05, mz1 = z1 - 0.04;
  parts.push(cushion([mx1 - mx0, MT - MB, mz1 - mz0], [(mx0 + mx1) / 2, (MB + MT) / 2, (mz0 + mz1) / 2], 0.025, m.mattress));
  // light-blue duvet laid flat from below the pillow to the foot, its edges turned down the sides
  const dz0 = mz0 + 0.42, dz1 = mz1 + 0.01, dw = mx1 - mx0 + 0.03;
  parts.push(cushion([dw, 0.04, dz1 - dz0], [(mx0 + mx1) / 2, MT + 0.02, (dz0 + dz1) / 2], 0.018, m.bedding));
  for (const sx of [-1, 1]) parts.push(box([0.012, 0.1, dz1 - dz0 - 0.02], [(mx0 + mx1) / 2 + sx * (dw / 2 - 0.004), MT - 0.03, (dz0 + dz1) / 2], m.bedding));
  const pil = pillow([0.62, 0.36, 0.14], m.pillowGrey);
  pil.position.set((x0 + x1) / 2, 0.57, z0 + 0.25);
  pil.rotation.set(-1.25, 0, 0);
  return [
    item('single-bed', FIXED, ...parts),
    item('pillow', movable(0.6, 'soft'), pil),
  ];
}

// IKEA FROST drying rack (owner): 134 × 59 × 93, white wire, against the skewed west wall. Clothes as
// in photos 295–299: garments on blue/white plastic hangers hooked on the wing bars (stacked like a
// closet rail), jeans draped over the room-side edge, a green octopus sock hanger with black socks.
// Local frame: length along x, room side +z, floor y 0.
function frostRack() {
  const m = ausMaterials();
  const wire = new THREE.MeshStandardMaterial({ color: '#f3f3f1', roughness: 0.4, metalness: 0.3 });
  const r = 0.0035;
  const g = new THREE.Group();
  const t = (pts: [number, number, number][], rr = r) => g.add(tube(pts, rr, wire, Math.max(2, pts.length * 4)));
  const TOP = 0.93, HX = 0.27, WX = 0.67, DZ = 0.22;
  // two crossed ladder frames (the X seen from the ends), each: two rails + rungs
  for (const s of [-1, 1]) {
    const foot: [number, number] = [0, s * 0.295], head: [number, number] = [TOP - 0.01, -s * 0.06];
    for (const x of [-HX, HX]) t([[x, 0, foot[1]], [x, head[0], head[1]]], r * 1.6);
    for (let k = 1; k <= 5; k++) {
      const f = k / 6, y = head[0] * f, z = foot[1] + (head[1] - foot[1]) * f;
      t([[-HX, y, z], [HX, y, z]]);
    }
  }
  // top deck: centre + two wings (rising slightly to the tips), bars run lengthwise
  const deckY = (x: number) => TOP + Math.max(0, Math.abs(x) - HX) * 0.04;
  for (const [x0, x1] of [[-WX, -HX], [-HX, HX], [HX, WX]]) {
    const outline: [number, number, number][] = [[x0, deckY(x0), -DZ], [x1, deckY(x1), -DZ], [x1, deckY(x1), DZ], [x0, deckY(x0), DZ], [x0, deckY(x0), -DZ]];
    for (let i = 0; i < 4; i++) t([outline[i], outline[i + 1]], r * 1.4);
    for (let z = -DZ + 0.05; z < DZ - 0.02; z += 0.05) t([[x0, deckY(x0), z], [x1, deckY(x1), z]]);
  }
  // V braces from the ladder frames up to the wing tips, and the lower shelf
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t([[sx * HX, 0.42, sz * 0.13], [sx * WX, deckY(WX) - 0.005, sz * DZ]]);
  for (let z = -0.12; z <= 0.121; z += 0.04) t([[-HX, 0.42, z], [HX, 0.42, z]]);

  // clothes on hangers under both wings
  const blueHanger = new THREE.MeshStandardMaterial({ color: '#7fa7d8', roughness: 0.5 });
  const whiteHanger = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.5 });
  const cloth = [m.blackFabric, m.sofaFabric, m.trim, new THREE.MeshStandardMaterial({ color: '#7d7a68', roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#e7e0d1', roughness: 0.9 }), m.darkGrey];
  const rand = mulberry32(17);
  for (const sx of [-1, 1]) {
    for (let x = HX + 0.06; x < WX - 0.03; x += 0.065 + rand() * 0.03) {
      const X = sx * x, yTop = deckY(x) - 0.06, len = 0.45 + rand() * 0.4, w = 0.36 + rand() * 0.08;
      const zc = (rand() - 0.5) * 0.08;
      const hm = rand() < 0.5 ? blueHanger : whiteHanger;
      const hg = new THREE.Group();
      hg.add(tube([[0, 0.045, -0.012], [0, 0.065, 0], [0, 0.05, 0.012], [0, 0.03, 0.006]], 0.002, hm, 8)); // hook over the bar
      hg.add(tube([[0, 0.03, 0], [0, 0, -w / 2], [0, 0, w / 2], [0, 0.03, 0]], 0.003, hm, 12)); // shoulders + bar
      hg.position.set(X, yTop, zc);
      g.add(hg);
      const garment = cushion([0.02 + rand() * 0.015, len, w - 0.02], [X, yTop - len / 2 + 0.01, zc], 0.008, cloth[Math.floor(rand() * cloth.length)]);
      garment.rotation.z = (rand() - 0.5) * 0.06;
      g.add(garment);
    }
  }
  // jeans draped over the room-side edge of the deck: two legs hanging, the seat on the deck
  const denim = new THREE.MeshStandardMaterial({ color: '#45648a', roughness: 0.85 });
  g.add(cushion([0.38, 0.025, 0.2], [-0.05, TOP + 0.015, 0.12], 0.01, denim));
  for (const dx of [-0.14, 0.04]) {
    const leg = cushion([0.17, 0.62, 0.025], [dx, TOP - 0.3, DZ + 0.02], 0.01, denim);
    leg.rotation.x = 0.05;
    g.add(leg);
  }
  // green octopus sock hanger hooked on the room-side edge, black socks on its clips
  const green = new THREE.MeshStandardMaterial({ color: '#8fae78', roughness: 0.55 });
  const oct = new THREE.Group();
  oct.add(tube([[0, 0.1, -0.01], [0, 0.13, 0], [0, 0.11, 0.015]], 0.003, green, 8));
  oct.add(sphere(0.035, [0, 0.07, 0], green, [1, 0.8, 1]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tip: [number, number, number] = [Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1];
    oct.add(tube([[0, 0.06, 0], [tip[0] * 0.6, 0.05, tip[2] * 0.6], tip], 0.004, green, 10));
    oct.add(box([0.05, 0.16 + (i % 2) * 0.05, 0.012], [tip[0], -0.06 - (i % 2) * 0.025, tip[2]], m.black));
  }
  oct.position.set(0.3, TOP - 0.14, DZ + 0.03);
  g.add(oct);
  return g;
}
function racks() {
  // centred 0.32 m out from the skewed west wall at z ≈ 1.2, long side along the wall
  const [[ax, az], [bx, bz]] = [[-7.11, 2.56], [-6.5, -0.55]];
  const u = new THREE.Vector2(bx - ax, bz - az).normalize();
  const wz = 1.2, wx = ax + ((wz - az) * (bx - ax)) / (bz - az);
  const n = new THREE.Vector2(-u.y, u.x); // into the room
  const pos: [number, number, number] = [wx + n.x * 0.33, 0, wz + n.y * 0.33];
  return [tagged(place(frostRack(), pos, Math.atan2(-u.y, u.x)), 'frost-drying-rack', movable(5, 'metal'))];
}

// luggage corner by the north wall (photos 211–214; scan x −5.83 … −4.71, z −1.70 … −0.94): a navy case
// and a black case lying flat; on the black one a white felt box and a Jellycat bunny
function luggage() {
  const m = ausMaterials();
  const navy = new THREE.MeshStandardMaterial({ color: '#1f2c55', roughness: 0.32 });
  const groove = new THREE.MeshStandardMaterial({ color: '#17213f', roughness: 0.4 });
  const blackShell = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.3 });
  const fuzz = new THREE.MeshStandardMaterial({ color: '#ece9e3', roughness: 1 });

  // navy hard-shell case lying flat on its back along the north–south axis (photos 211, 213):
  // ribbed shell facing up, telescopic-handle housing at the north end, spinner wheels at the south end
  const nv = new THREE.Group();
  nv.add(cushion([0.45, 0.27, 0.72], [0, 0.145, 0], 0.035, navy));
  for (let i = -3; i <= 3; i++) nv.add(box([0.012, 0.006, 0.64], [i * 0.055, 0.282, 0], groove));
  nv.add(box([0.455, 0.012, 0.725], [0, 0.145, 0], m.darkGrey)); // zip seam
  nv.add(box([0.2, 0.04, 0.03], [0, 0.2, -0.37], m.black)); // handle housing
  nv.add(box([0.12, 0.03, 0.03], [-0.235, 0.17, 0], m.black)); // side carry handle
  for (const x of [-0.19, 0.19]) for (const y of [0.06, 0.23]) nv.add(cylinder(0.025, 0.03, [x, y, 0.375], m.black, 12).rotateZ(Math.PI / 2));
  // black case lying flat beside it, toward the bed
  const bk = new THREE.Group();
  bk.add(cushion([0.5, 0.26, 0.66], [0, 0.135, 0], 0.035, blackShell));
  bk.add(box([0.505, 0.01, 0.665], [0, 0.135, 0], m.darkGrey));
  // white felt box (owner's photo): a superellipse footprint between an oval and a square, flat top,
  // softly bevelled edges, three capsule slits toward the front
  const pouch = new THREE.Group();
  {
    const shape = new THREE.Shape();
    const A = 0.15, B = 0.105, n = 2.6;
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      const x = A * Math.sign(c) * Math.abs(c) ** (2 / n), y = B * Math.sign(sn) * Math.abs(sn) ** (2 / n);
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 6, curveSegments: 64 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.03, 0);
    const body = mesh(geo, fuzz);
    pouch.add(body);
    for (const dx of [-0.05, 0, 0.05]) pouch.add(sphere(1, [dx, 0.13, 0.05], m.black, [0.012, 0.003, 0.036])); // capsule slits
  }
  // Jellycat Blossom Cream Bunny "Berry" (owner): sitting height 23 cm, 31 × 12 × 9 cm. Sits on the
  // black case with its back to the wall: pear-shaped cream body, round head with stitched eyes and a
  // pink nose, long floppy ears hanging beside the head with berry blossom linings facing forward,
  // long thin arms at its sides, short legs stretched out front.
  // Local frame: facing +z, sitting on y 0.
  const blossom = new THREE.MeshStandardMaterial({ roughness: 1, map: (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e9a3b5'; x.fillRect(0, 0, 128, 128);
    const rnd = mulberry32(8);
    for (let i = 0; i < 46; i++) {
      x.fillStyle = rnd() < 0.55 ? '#fbeef1' : '#c8607f';
      x.beginPath(); x.arc(rnd() * 128, rnd() * 128, 2.5 + rnd() * 3.5, 0, Math.PI * 2); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })() });
  const plush = new THREE.MeshStandardMaterial({ color: '#f4eee2', roughness: 1 });
  const pink = new THREE.MeshStandardMaterial({ color: '#d9899c', roughness: 0.8 });
  const bunny = new THREE.Group();
  // pear-shaped seated body (lathe), slightly flattened front-to-back
  const body = lathe([[0.001, 0], [0.045, 0.004], [0.058, 0.025], [0.056, 0.06], [0.044, 0.095], [0.03, 0.12], [0.022, 0.13]], plush, 28);
  body.scale.set(1, 1, 0.85);
  bunny.add(body);
  // round head, a little wider than tall, with a soft muzzle
  bunny.add(sphere(1, [0, 0.168, 0.004], plush, [0.05, 0.046, 0.044]));
  bunny.add(sphere(1, [0, 0.155, 0.04], plush, [0.022, 0.016, 0.012]));
  bunny.add(sphere(0.0055, [0, 0.163, 0.052], pink)); // nose
  for (const s of [-1, 1]) {
    bunny.add(sphere(1, [s * 0.019, 0.178, 0.041], m.black, [0.0045, 0.0055, 0.002])); // stitched eyes
    // long floppy ear: from the crown, flopping down beside the head to the shoulders
    const ear = new THREE.Group();
    ear.add(sphere(1, [0, 0, 0], plush, [0.022, 0.075, 0.009]));
    ear.add(sphere(1, [0, -0.004, 0.006], blossom, [0.017, 0.064, 0.005])); // lining facing forward
    ear.position.set(s * 0.05, 0.145, 0.0);
    ear.rotation.z = s * 0.28;
    ear.rotation.y = s * 0.35;
    bunny.add(ear);
    // long thin arms hanging at the sides
    const arm = sphere(1, [s * 0.05, 0.065, 0.018], plush, [0.014, 0.05, 0.014]);
    arm.rotation.z = s * 0.12;
    bunny.add(arm);
    // short legs stretched forward (owner: shorter, no pads)
    const leg = sphere(1, [s * 0.026, 0.017, 0.06], plush, [0.019, 0.017, 0.045]);
    leg.rotation.y = -s * 0.1;
    bunny.add(leg);
  }
  const top = 0.27;
  return [
    tagged(place(nv, [-5.52, 0, -1.31]), 'suitcase-navy', movable(5.5, 'plastic', 'box')),
    tagged(place(bk, [-5.0, 0, -1.33]), 'suitcase-black', movable(5, 'plastic', 'box')),
    tagged(place(pouch, [-5.04, top, -1.17], 0.1), 'felt-box', movable(0.5, 'soft', 'box')),
    // sitting on the case with its back against the north wall, facing into the room
    tagged(place(bunny, [-4.92, top, -1.6]), 'bunny-plush', movable(0.15, 'soft')),
  ];
}
