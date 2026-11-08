import * as THREE from 'three';
import type { BuiltRoom, RoomModule } from '../../packages/room-runtime/types';
import { loadTextures } from '../../packages/room-runtime/materials';
import { batchStatic } from '../../packages/room-runtime/batch';
import { buildWalls, ceilings, floors, H, insideFloor } from './shell';
import { buildFixtures } from './fixtures';
import { buildFurniture } from './furniture';
import { ausMaterials, loadAusTextures } from './materials';

/**
 * Postgraduate accommodation in Australia, rebuilt from a 3D Scanner App capture.
 * Room coordinates: meters, floor y = 0, walls on X/Z.
 *
 *  - Living / dining / galley kitchen / entry hall, ceiling 2.38, open steel stair to the upper floor
 *  - Double-height bedroom behind a glazed pine partition (ceiling 5.10)
 *  - Bathroom with laundry
 *
 * Public build: the raw scan and the reference photos are not published, so only the rebuilt
 * model (Rebuilt / Wireframe) is available.
 */
const ID = 'au-postgrad-accom';

export const auPostgradAccom: RoomModule = {
  id: ID,
  label: 'AU Postgrad Accommodation',
  async build(): Promise<BuiltRoom> {
    await Promise.all([loadTextures(), loadAusTextures()]);
    const group = new THREE.Group();
    group.name = `${ID}-model`;
    const lights = new THREE.Group();
    lights.name = `${ID}-lights`;
    lights.add(new THREE.HemisphereLight('#fbf8f2', '#f0e6d8', 1.6));

    const walls = buildWalls();
    const ceiling = ceilings();
    group.add(floors(), ceiling, ...walls.map((w) => w.group));
    group.add(buildFixtures(walls, (l) => lights.add(l)));
    group.add(buildFurniture());

    let optimized: ReturnType<typeof batchStatic> | undefined;
    return {
      group,
      lights,
      walls,
      ceiling: [ceiling],
      wallTop: H,
      exposure: 1.0,
      render: { toneMapping: THREE.NeutralToneMapping, envSize: 256, envBounces: 1 },
      optimize(opts) {
        optimized ??= batchStatic(group, [...walls.map((w) => w.group), ceiling], { mergeDynamic: !!opts?.static });
        return optimized;
      },
      walkable: (x, z) => insideFloor(x, z) && insideFloor(x + 0.2, z) && insideFloor(x - 0.2, z) && insideFloor(x, z + 0.2) && insideFloor(x, z - 0.2),
      camera: { orbit: [3, 10, 9], target: [-0.6, 0.8, 0], walk: [-1.5, 1.6, -0.6], walkLook: [3, 1.4, 0.6] },
      environment: { center: [-0.5, 1.3, 0.2], intensity: 0.6, mirror: ausMaterials().mirror, mirrorAt: [5.0, 1.5, -0.3] },
      referenceAvailable: false,
      referenceKind: 'scan',
      async loadReference() {
        return new THREE.Group();
      },
      photos: [],
    };
  },
};
