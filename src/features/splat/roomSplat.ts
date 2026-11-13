import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SplatMesh } from '@sparkjsdev/spark';
import type { SpaceRoom } from '../../api/spaces/spacesApi';
import type { RoomUnit } from './multiRoomController';
import { getSplatFileType } from './splatFileType';
import { Collider, createCollider } from './walkPhysics';

/**
 * One room of a multi-room space in the scene: its own SplatMesh at the room's transform and,
 * if the room has one, its collision mesh at the same transform. Loaded lazily and disposed as
 * a unit by MultiRoomController.
 */
export function createRoomSplatUnit(
  scene: THREE.Scene,
  room: SpaceRoom,
  matrix: THREE.Matrix4
): RoomUnit {
  const url = room.splat_url!;
  const mesh = new SplatMesh({ url, fileType: getSplatFileType(url) });
  matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  let disposed = false;
  let current = matrix.clone();
  let colliderSource: THREE.Object3D | null = null;
  let collider: Collider | null = null;

  const placeCollider = () => {
    if (!colliderSource) return;
    current.decompose(colliderSource.position, colliderSource.quaternion, colliderSource.scale);
    collider = createCollider(colliderSource);
  };

  // Room captures have no collision mesh yet; this is for when they get one.
  if (room.collision_url) {
    new GLTFLoader()
      .loadAsync(room.collision_url)
      .then(gltf => {
        if (disposed) return;
        colliderSource = gltf.scene;
        placeCollider();
      })
      .catch(err => {
        console.warn(`Collision mesh of room ${room.room_id} unavailable:`, err);
      });
  }

  return {
    ready: mesh.initialized.then(() => mesh.getBoundingBox(true)),
    setMatrix(next) {
      current = next.clone();
      current.decompose(mesh.position, mesh.quaternion, mesh.scale);
      placeCollider();
    },
    setVisible(visible) {
      if (disposed) return;
      // Taken out of the scene rather than hidden, so a hidden room costs no sorting either.
      if (visible) scene.add(mesh);
      else scene.remove(mesh);
    },
    getCollider: () => collider,
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(mesh);
      // Frees the splat's GPU textures. A file that is still downloading finishes in the
      // background and is then dropped with the mesh.
      mesh.dispose();
      colliderSource?.traverse(object => {
        const geometry = (object as THREE.Mesh).geometry;
        geometry?.dispose();
      });
      colliderSource = null;
      collider = null;
    },
  };
}
