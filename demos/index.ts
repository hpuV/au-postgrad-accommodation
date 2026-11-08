import type { RoomModule } from '../packages/room-runtime/types';
export const ROOMS: RoomModule[] = [{id:'au-postgrad-accom', label:'AU Postgrad Accommodation', build:async () => (await import('./au-postgrad-accom')).auPostgradAccom.build()}];
export const roomById = (id:string|null) => ROOMS.find(r=>r.id===id) ?? ROOMS[0];
export type {BuiltRoom, RoomModule} from '../packages/room-runtime/types';
