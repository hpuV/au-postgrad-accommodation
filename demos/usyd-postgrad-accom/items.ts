import * as THREE from 'three';
import type { PhysicsTag, ShapeKind, SurfaceKind } from '../../packages/room-physics/tagging';

/** Fixed furnishings: built-ins, appliances, heavy loaded shelving. */
export const FIXED: PhysicsTag = { type: 'static' };

/** Movable furnishings and possessions (play mode can push / pick them up). */
export function movable(mass: number, surface: SurfaceKind, shape?: ShapeKind): PhysicsTag {
  return shape ? { type: 'dynamic', mass, surface, shape } : { type: 'dynamic', mass, surface };
}

/**
 * One named, physics-tagged piece — what the Knolling view and the physics play mode pick up.
 * Parts may be built in room coordinates: they're re-parented around the footprint center
 * (bottom of the bounds), so the item gets a sensible pivot.
 * Names must not start with the knolling exclusions (floor, door, window, wall-, slab, …).
 */
export function item(name: string, physics: PhysicsTag, ...parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.userData.physics = physics;
  g.add(...parts);
  const bounds = new THREE.Box3().setFromObject(g);
  if (!bounds.isEmpty()) {
    const pivot = bounds.getCenter(new THREE.Vector3());
    pivot.y = bounds.min.y;
    for (const p of parts) p.position.sub(pivot);
    g.position.copy(pivot);
  }
  return g;
}

/** Name + tag an object that is already placed (keeps its own pivot). */
export function tagged<T extends THREE.Object3D>(o: T, name: string, physics: PhysicsTag): T {
  o.name = name;
  o.userData.physics = physics;
  return o;
}

/** Take a part built inside a placed group out into room coordinates (to tag it on its own). */
export function lift<T extends THREE.Object3D>(parent: THREE.Object3D, part: T): T {
  parent.updateMatrixWorld(true);
  const world = part.matrixWorld.clone();
  parent.remove(part);
  world.decompose(part.position, part.quaternion, part.scale);
  return part;
}
