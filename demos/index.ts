import type { RoomModule } from '../packages/room-runtime/types';
export const ROOMS: RoomModule[] = [{id:'usyd-postgrad-accom', label:'USYD Postgrad Accommodation', build:async () => (await import('./usyd-postgrad-accom')).usydPostgradAccom.build()}];
export const roomById = (id:string|null) => ROOMS.find(r=>r.id===id) ?? ROOMS[0];
export type {BuiltRoom, RoomModule} from '../packages/room-runtime/types';
