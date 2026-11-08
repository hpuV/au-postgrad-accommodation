import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, boxSpan, boxUV, cushion, cylinder, mesh, place, sphere, tube } from '../../packages/room-runtime/helpers';
import { textured } from '../../packages/room-runtime/materials';
import { item, movable, tagged } from './items';

/*
 * Bedroom workstation (owner): IKEA LAGKAPTEN/ALEX desk 120 × 60 × 73 against the clear glass,
 * IKEA RENBERGET swivel chair, a 27" monitor + keyboard + mouse on the left (north), the PC on the
 * right (south) — a compact case with a tinted glass side, perforated grey panels, orange carry
 * handle and feet (owner's photo IMG_9429).
 * Sitting at the desk you face +x (the partition); left is −z, right is +z.
 */
export const BED_DESK = { x0: -4.32, x1: -3.72, z0: 1.34, z1: 2.54, top: 0.73 };

let mats: ReturnType<typeof createMats> | undefined;
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function createMats() {
  // RENBERGET: black bonded leather with diamond quilting stitched in slightly lighter thread
  const quilt = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#1d1d20';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#3a3a3f';
    c.lineWidth = 2;
    for (let k = -256; k <= 512; k += 64) {
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 256, 256); c.stroke();
      c.beginPath(); c.moveTo(k, 256); c.lineTo(k + 256, 0); c.stroke();
    }
  });
  quilt.wrapS = quilt.wrapT = THREE.RepeatWrapping;
  quilt.repeat.set(4, 4); // ≈ 6 cm diamonds (boxUV is in meters)
  // perforated case panels: rows of slots on dark grey anodised aluminium
  const perf = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#5b5e62';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#121315';
    for (let y = 8; y < 256; y += 21) for (let x = 6; x < 256; x += 17) c.fillRect(x, y, 9, 13);
  });
  perf.wrapS = perf.wrapT = THREE.RepeatWrapping;
  perf.repeat.set(5, 5);
  // a dim desktop on the monitor (the photos were taken at night with the screens on)
  const screen = canvasTexture(512, 288, (c) => {
    const g = c.createLinearGradient(0, 0, 512, 288);
    g.addColorStop(0, '#13243d');
    g.addColorStop(1, '#0b1626');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 288);
    c.fillStyle = '#1f3a5c';
    c.fillRect(40, 40, 300, 180);
    c.fillStyle = '#2b4e78';
    c.fillRect(40, 40, 300, 14);
    c.fillStyle = '#0a0f17';
    c.fillRect(0, 270, 512, 18); // taskbar
  });
  return {
    oakTop: textured({ color: '#efe2cc', set: 'oak', repeat: 1.2, roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: '#f2f2ef', roughness: 0.45 }),
    slot: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.8 }),
    leather: new THREE.MeshStandardMaterial({ map: quilt, roughness: 0.42 }),
    leatherPlain: new THREE.MeshStandardMaterial({ color: '#1d1d20', roughness: 0.38 }),
    blackPlastic: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.55 }),
    bezel: new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.35 }),
    screen: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 0.55, roughness: 0.15 }),
    keycap: new THREE.MeshStandardMaterial({ color: '#2b2c30', roughness: 0.6 }),
    perf: new THREE.MeshStandardMaterial({ map: perf, roughness: 0.5, metalness: 0.4 }),
    caseFrame: new THREE.MeshStandardMaterial({ color: '#3c3f43', roughness: 0.45, metalness: 0.5 }),
    tint: new THREE.MeshStandardMaterial({ color: '#16191d', roughness: 0.04, metalness: 0.55, transparent: true, opacity: 0.72, depthWrite: false }),
    gpuFace: new THREE.MeshStandardMaterial({ map: canvasTexture(512, 128, (c) => {
      // graphics-card shroud seen through the glass: dark fins, white "GEFORCE RTX" lettering
      c.fillStyle = '#26272b'; c.fillRect(0, 0, 512, 128);
      c.fillStyle = '#34363b'; for (let x = 0; x < 512; x += 9) c.fillRect(x, 70, 4, 58);
      c.fillStyle = '#d9d9db'; c.font = 'bold 44px sans-serif'; c.fillText('GEFORCE RTX', 210, 52);
      c.fillStyle = '#5a4dff'; c.fillRect(0, 122, 512, 6);
    }), roughness: 0.45, metalness: 0.5 }),
    boardFace: new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, (c) => {
      // motherboard: dark PCB, heatsinks, RAM slots, a few connectors
      c.fillStyle = '#17181b'; c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#2c2e33'; c.fillRect(20, 20, 70, 110); c.fillRect(180, 20, 18, 150); c.fillRect(204, 20, 18, 150);
      c.fillStyle = '#3d4046'; c.fillRect(20, 150, 140, 18); c.fillRect(110, 190, 120, 40);
      c.fillStyle = '#8b8d92'; for (let y = 30; y < 120; y += 12) c.fillRect(28, y, 54, 3);
    }), roughness: 0.6 }),
    board: new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.6 }),
    gpu: new THREE.MeshStandardMaterial({ color: '#2a2b2f', roughness: 0.4, metalness: 0.6 }),
    orange: new THREE.MeshStandardMaterial({ color: '#f29a1d', roughness: 0.5 }),
    glowOrange: new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a2e', emissiveIntensity: 1.6 }),
    glowBlue: new THREE.MeshStandardMaterial({ color: '#6f6bff', emissive: '#5a4dff', emissiveIntensity: 2 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#9a9ca0', roughness: 0.3, metalness: 0.9 }),
  };
}
function M() {
  mats ??= createMats();
  return mats;
}

// ---- LAGKAPTEN tabletop on an ALEX drawer unit (left) and two round legs (right) -------------------
function desk() {
  const m = M();
  const { x0, x1, z0, z1, top } = BED_DESK;
  const parts: THREE.Object3D[] = [boxSpan([x0, top - 0.03, z0], [x1, top, z1], m.oakTop)];
  // ALEX 36 × 58 × 70: five drawers facing the chair (−x), each with a cut-out finger pull
  const ax0 = x0 + 0.01, ax1 = x1 - 0.01, az0 = z0 + 0.01, az1 = z0 + 0.37, ah = top - 0.03;
  parts.push(boxSpan([ax0 + 0.01, 0.01, az0], [ax1, ah, az1], m.white));
  for (const [cz, cx] of [[az0 + 0.02, ax0 + 0.03], [az1 - 0.02, ax0 + 0.03], [az0 + 0.02, ax1 - 0.03], [az1 - 0.02, ax1 - 0.03]]) parts.push(cylinder(0.008, 0.012, [cx, 0.006, cz], m.slot, 8));
  const h = (ah - 0.03) / 5;
  for (let i = 0; i < 5; i++) {
    const y0 = 0.025 + i * h;
    parts.push(boxSpan([ax0, y0 + 0.003, az0 + 0.003], [ax0 + 0.012, y0 + h - 0.003, az1 - 0.003], m.white));
    parts.push(boxSpan([ax0 - 0.001, y0 + h - 0.03, (az0 + az1) / 2 - 0.05], [ax0 + 0.002, y0 + h - 0.012, (az0 + az1) / 2 + 0.05], m.slot));
  }
  // ADILS-style round legs at the right end
  for (const x of [x0 + 0.05, x1 - 0.05]) parts.push(cylinder(0.0145, top - 0.03, [x, (top - 0.03) / 2, z1 - 0.05], m.white, 16));
  return item('lagkapten-alex-desk', movable(24, 'wood', 'compound'), ...parts);
}

// ---- RENBERGET: seat 48 × 43 at ≈ 49 cm, back to ≈ 105 cm, loop armrests, Ø 67 base --------------
function renberget() {
  const m = M();
  const c = new THREE.Group();
  // five-star base with twin-wheel castors
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const leg = box([0.3, 0.035, 0.045], [Math.cos(a) * 0.15, 0.085, Math.sin(a) * 0.15], m.blackPlastic);
    leg.rotation.y = -a;
    leg.rotation.z = 0.08;
    c.add(leg);
    const castor = cylinder(0.027, 0.04, [Math.cos(a) * 0.305, 0.027, Math.sin(a) * 0.305], m.blackPlastic, 14);
    castor.rotation.z = Math.PI / 2;
    castor.rotation.y = -a;
    c.add(castor, cylinder(0.008, 0.035, [Math.cos(a) * 0.3, 0.065, Math.sin(a) * 0.3], m.blackPlastic, 8));
  }
  c.add(cylinder(0.045, 0.08, [0, 0.1, 0], m.blackPlastic, 20));
  c.add(cylinder(0.026, 0.22, [0, 0.25, 0], m.chrome, 16)); // gas lift
  c.add(cylinder(0.034, 0.1, [0, 0.31, 0], m.blackPlastic, 16)); // lift shroud
  c.add(box([0.22, 0.05, 0.24], [0, 0.4, 0.0], m.blackPlastic)); // tilt mechanism
  // seat: quilted cushion with a rolled front edge
  const seat = cushion([0.48, 0.085, 0.43], [0, 0.475, 0.03], 0.035, m.leather);
  c.add(seat);
  // back: quilted lower panel + smooth head pad, on a slight recline
  const back = new THREE.Group();
  back.add(cushion([0.46, 0.33, 0.07], [0, 0.17, 0], 0.03, m.leather));
  back.add(cushion([0.47, 0.17, 0.075], [0, 0.42, 0.002], 0.035, m.leatherPlain));
  back.position.set(0, 0.555, -0.205);
  back.rotation.x = -0.12;
  c.add(back);
  c.add(box([0.06, 0.2, 0.03], [0, 0.48, -0.22], m.blackPlastic)); // back bracket
  // loop armrests from the seat sides
  for (const s of [-1, 1]) {
    c.add(tube([[s * 0.255, 0.47, 0.13], [s * 0.285, 0.6, 0.16], [s * 0.29, 0.67, 0.1], [s * 0.29, 0.67, -0.1], [s * 0.275, 0.58, -0.17], [s * 0.255, 0.47, -0.15]], 0.016, m.blackPlastic, 40));
    c.add(box([0.05, 0.022, 0.2], [s * 0.29, 0.678, 0.0], m.blackPlastic)); // arm pad
  }
  return c;
}

// ---- 27" monitor, keyboard, mouse ----------------------------------------------------------------
function monitor() {
  const m = M();
  const g = new THREE.Group();
  const W = 0.615, Hs = 0.365; // 16:9 27" panel
  const panel = mesh(new RoundedBoxGeometry(W + 0.02, Hs + 0.025, 0.035, 2, 0.006), m.bezel);
  panel.position.set(0, 0.11 + Hs / 2 + 0.03, 0);
  const screen = mesh(new THREE.PlaneGeometry(W - 0.01, Hs - 0.01), m.screen);
  screen.position.set(0, panel.position.y + 0.008, 0.0181);
  g.add(panel, screen);
  g.add(box([0.06, 0.24, 0.025], [0, 0.135, -0.06], m.bezel)); // neck
  g.add(box([0.24, 0.012, 0.18], [0, 0.006, -0.02], m.bezel)); // base plate
  boxUV(screen.geometry);
  return g;
}
// white tenkeyless low-profile keyboard (owner's photo): light-grey aluminium plate, white caps,
// blue backlit legends, three round media buttons on the top strip. Front edge toward local +z.
let kbMats: { plate: THREE.Material; cap: THREE.Material; legend: THREE.Material; btn: THREE.Material } | undefined;
function keyboard() {
  kbMats ??= {
    plate: new THREE.MeshStandardMaterial({ color: '#cfd2d6', roughness: 0.35, metalness: 0.55 }),
    cap: new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.5 }),
    legend: new THREE.MeshStandardMaterial({ color: '#7cc4ff', emissive: '#3c9dff', emissiveIntensity: 1.4 }),
    btn: new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 }),
  };
  const k = kbMats;
  const g = new THREE.Group();
  const u = 0.019; // key pitch
  const rows: (number | null)[][] = [
    [1, null, 1, 1, 1, 1, null, 1, 1, 1, 1, null, 1, 1, 1, 1], // Esc, F1–F12 (null = ½u gap)
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ];
  const W = 18.5 * u + 0.012, D = 6 * u + 0.012 + 0.026;
  const plate = mesh(new RoundedBoxGeometry(W, 0.012, D, 2, 0.004), k.plate);
  plate.position.set(0, 0.006, 0);
  g.add(plate);
  const x0 = -W / 2 + 0.006, zTop = -D / 2 + 0.026 + u / 2; // first key row center
  const cap = (cx: number, cz: number, w: number) => {
    g.add(box([w * u - 0.0025, 0.005, u - 0.0025], [cx, 0.0145, cz], k.cap));
    g.add(box([0.004, 0.0004, 0.003], [cx - (w * u) / 2 + 0.006, 0.0172, cz - 0.003], k.legend));
  };
  rows.forEach((row, r) => {
    let x = x0;
    const z = zTop + r * u + (r > 0 ? 0.004 : 0);
    for (const w of row) {
      if (w === null) { x += u / 2; continue; }
      cap(x + (w * u) / 2, z, w);
      x += w * u;
    }
  });
  // navigation cluster (PrtSc/ScrLk/Pause, Ins/Home/PgUp, Del/End/PgDn, arrows)
  const nx = x0 + 15.5 * u;
  for (const [r, cols] of [[0, [0, 1, 2]], [1, [0, 1, 2]], [2, [0, 1, 2]], [4, [1]], [5, [0, 1, 2]]] as const)
    for (const c of cols) cap(nx + (c + 0.5) * u, zTop + r * u + (r > 0 ? 0.004 : 0), 1);
  // top strip: three round media buttons
  for (let i = 0; i < 3; i++) g.add(cylinder(0.0045, 0.003, [x0 + 0.03 + i * 0.027, 0.0135, -D / 2 + 0.012], k.btn, 16));
  return g;
}

// Razer-style gaming mouse on a dark Logi pad (owner's photo); buttons toward local −z.
function mouseOnPad() {
  const pad = new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 208, (c) => {
      c.fillStyle = '#2b2c30'; c.fillRect(0, 0, 256, 208);
      c.strokeStyle = '#1c1d20'; c.lineWidth = 6; c.strokeRect(3, 3, 250, 202);
      c.fillStyle = '#c9cacd'; c.font = '22px sans-serif'; c.fillText('logi', 196, 192);
    }), roughness: 0.95,
  });
  const body = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.35 });
  const green = new THREE.MeshStandardMaterial({ color: '#c8ff3c', emissive: '#a8ff1a', emissiveIntensity: 1.6 });
  const g = new THREE.Group();
  const padMesh = mesh(new RoundedBoxGeometry(0.26, 0.003, 0.21, 2, 0.0014), pad);
  padMesh.position.y = 0.0015;
  g.add(padMesh);
  const m = new THREE.Group();
  const shell = sphere(1, [0, 0.003, 0], body, [0.034, 0.04, 0.064]);
  const wing = sphere(1, [-0.03, 0.006, 0.015], body, [0.016, 0.018, 0.04]); // thumb rest (right hand)
  const wheel = cylinder(0.009, 0.007, [0, 0.04, -0.03], green, 16);
  wheel.rotation.z = Math.PI / 2;
  const logo = cylinder(0.008, 0.001, [0, 0.0425, 0.02], green, 12);
  logo.rotation.x = -0.3;
  m.add(shell, wing, wheel, logo);
  m.position.set(0.035, 0.003, 0.01);
  m.rotation.y = 0.08;
  g.add(m);
  return g;
}

// ---- PC: compact case, tinted glass side toward the chair (owner's photo IMG_9429) -------------------
function gamingPc() {
  const m = M();
  const g = new THREE.Group();
  // local frame: glass side faces −x (the chair), length along z, case 0.22 × 0.37 × 0.42
  const W = 0.22, Hc = 0.37, L = 0.42, f = 0.012, y0 = 0.025;
  // perforated grey shell: top, far side, front, back; aluminium edge frame
  g.add(boxSpan([-W / 2 + f, y0 + Hc - f, -L / 2], [W / 2, y0 + Hc, L / 2], m.perf));
  g.add(boxSpan([W / 2 - f, y0, -L / 2], [W / 2, y0 + Hc, L / 2], m.perf));
  g.add(boxSpan([-W / 2, y0, L / 2 - f], [W / 2, y0 + Hc, L / 2], m.perf));
  g.add(boxSpan([-W / 2, y0, -L / 2], [W / 2, y0 + Hc, -L / 2 + f], m.perf));
  g.add(boxSpan([-W / 2, y0, -L / 2], [W / 2, y0 + f, L / 2], m.caseFrame));
  for (const z of [-L / 2, L / 2]) for (const y of [y0, y0 + Hc]) {
    const e = box([W + 0.004, 0.012, 0.012], [0, y, z], m.caseFrame);
    g.add(e);
  }
  // inside, seen through the glass: motherboard, AIO pump head glowing orange, RTX card, LED strip
  g.add(boxSpan([W / 2 - 0.03, y0 + 0.13, -L / 2 + 0.05], [W / 2 - f, y0 + Hc - 0.03, L / 2 - 0.08], m.board));
  g.add(boxSpan([-0.01, y0 + 0.21, -0.03], [W / 2 - 0.03, y0 + 0.29, 0.05], m.gpu)); // pump block
  g.add(boxSpan([-0.012, y0 + 0.22, -0.02], [-0.008, y0 + 0.28, 0.04], m.bezel)); // pump head cap: black (owner)
  g.add(boxSpan([-0.06, y0 + 0.05, -L / 2 + 0.03], [W / 2 - 0.035, y0 + 0.12, L / 2 - 0.03], m.gpu)); // graphics card
  g.add(boxSpan([-0.064, y0 + 0.045, -0.06], [-0.06, y0 + 0.052, L / 2 - 0.05], m.glowBlue));
  const gpuFace = mesh(new THREE.PlaneGeometry(L - 0.06, 0.07), m.gpuFace);
  gpuFace.rotation.y = -Math.PI / 2;
  gpuFace.position.set(-0.0605, y0 + 0.085, 0);
  const boardFace = mesh(new THREE.PlaneGeometry(L - 0.13, Hc - 0.16), m.boardFace);
  boardFace.rotation.y = -Math.PI / 2;
  boardFace.position.set(W / 2 - 0.0305, y0 + 0.13 + (Hc - 0.16) / 2, -0.015);
  g.add(gpuFace, boardFace);
  g.add(tube([[0.0, y0 + 0.25, 0.04], [0.02, y0 + 0.2, 0.12], [0.06, y0 + Hc - 0.04, 0.17]], 0.009, m.board, 16)); // AIO hoses
  // tinted tempered-glass side panel with corner screws
  const glass = mesh(new THREE.PlaneGeometry(L - 0.01, Hc - 0.01), m.tint);
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(-W / 2, y0 + Hc / 2, 0);
  glass.castShadow = false;
  g.add(glass);
  for (const z of [-L / 2 + 0.02, L / 2 - 0.02]) for (const y of [y0 + 0.025, y0 + Hc - 0.025]) {
    const sc = cylinder(0.008, 0.008, [-W / 2 - 0.004, y, z], m.board, 10);
    sc.rotation.z = Math.PI / 2;
    g.add(sc);
  }
  // orange carry handle across the top and orange feet
  g.add(tube([[0, y0 + Hc, -L / 2 + 0.06], [0, y0 + Hc + 0.05, -L / 2 + 0.09], [0, y0 + Hc + 0.055, L / 2 - 0.09], [0, y0 + Hc, L / 2 - 0.06]], 0.012, m.orange, 24));
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) for (const z of [-L / 2 + 0.04, L / 2 - 0.04]) g.add(box([0.03, y0, 0.05], [x, y0 / 2, z], m.orange));
  g.add(sphere(0.004, [-W / 2 + 0.02, y0 + 0.06, L / 2 + 0.001], m.glowOrange)); // power LED
  return g;
}

export function buildWorkstation() {
  const { x0, x1, top } = BED_DESK;
  // stands lengthwise front-to-back (owner), glass side toward the keyboard (−z)
  const pcItem = tagged(place(gamingPc(), [(x0 + x1) / 2 + 0.07, top, 2.33], -Math.PI / 2), 'gaming-pc', movable(9, 'metal', 'box'));
  const mon = tagged(place(monitor(), [x1 - 0.13, top, 1.74], -Math.PI / 2), 'monitor-27in', movable(6, 'plastic'));
  const kb = tagged(place(keyboard(), [x0 + 0.16, top, 1.66], -Math.PI / 2), 'keyboard', movable(0.8, 'metal', 'box'));
  const mouse = tagged(place(mouseOnPad(), [x0 + 0.15, top, 2.01], -Math.PI / 2), 'mouse-and-pad', movable(0.3, 'plastic', 'box'));
  const chair = tagged(place(renberget(), [x0 - 0.33, 0, 1.8], Math.PI / 2), 'renberget-chair', movable(13, 'plastic', 'compound'));
  return [desk(), mon, kb, mouse, pcItem, chair];
}
