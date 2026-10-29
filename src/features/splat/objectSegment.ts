import * as THREE from 'three';
import { Collider } from './walkPhysics';

/**
 * Cuts the object a tag sits on out of the collision mesh, so the viewer can light it up on hover
 * instead of showing a marker. The cut is geometric (no machine learning): starting at the tagged
 * triangle it grows over the connected surface, but never over the floor, the ceiling or big
 * upright wall planes, and stays within SEARCH_RADIUS of the tag. The result is an oriented box.
 */
export interface ObjectSegment {
  /** Box centre in space coordinates. */
  center: THREE.Vector3;
  /** Half the box size along its own axes; the box is turned by `yaw` about the vertical axis. */
  halfExtents: THREE.Vector3;
  yaw: number;
  /** 'mesh': grown from the collision mesh. 'fallback': a small box, the mesh gave no clear object. */
  method: 'mesh' | 'fallback';
}

/** The surroundings read to tell walls and support surfaces from the object. */
const SEARCH_RADIUS = 1.5;
/** How far the object may reach from the tagged point: sideways, and up or down (objects in a home are mostly smaller). */
const GROW_RADIUS = 0.7;
const GROW_HEIGHT = 1;
/** The floor is looked for within this horizontal distance of the tag. */
const FLOOR_SEARCH_RADIUS = 3;
const FLOOR_BIN = 0.03;
/** Flat area needed around one height (m²) before it counts as the floor. */
const FLOOR_MIN_AREA = 0.5;
const FLOOR_THICKNESS = 0.06;
const CEILING_ABOVE_FLOOR = 2;
/** Normals this close to vertical belong to floors, ceilings and tabletops. */
const FLAT_NORMAL_Y = 0.7;
/** Flat surfaces this big (m²) at one height are support surfaces (floor, counter, shelf): never part of an object. */
const SUPPORT_NORMAL_Y = 0.85;
const SUPPORT_BIN = 0.03;
const SUPPORT_MIN_AREA = 0.6;
/** A tag on a big plane (counter top, wall, cabinet front) selects only this much around it. */
const PLANE_SEED_RADIUS = 0.45;
/** Normals this close to horizontal belong to walls and upright faces. */
const UPRIGHT_NORMAL_Y = 0.25;
const WALL_ANGLE_BIN = THREE.MathUtils.degToRad(12);
const WALL_OFFSET_BIN = 0.06;
/** Upright plane area within the search radius (m²) from which a plane counts as a wall. */
const WALL_MIN_AREA = 1.2;
/** Vertices closer than 1/WELD_PER_METER are the same point (meshes repeat vertices along seams). */
const WELD_PER_METER = 400;
const MIN_TRIANGLES = 20;
const MIN_EXTENT = 0.1;
const MARGIN = 0.03;
/** A box with one side below SLAB_THIN and another above SLAB_LONG is a wall piece, not an object. */
const SLAB_THIN = 0.08;
const SLAB_LONG = 0.8;
const FALLBACK_HALF = 0.25;
const FALLBACK_WALL_HALF = new THREE.Vector3(0.3, 0.3, 0.06);
/** Points this far outside the box still count as on the object when hovering. */
export const SEGMENT_HIT_MARGIN = 0.05;

interface LocalTriangle {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  vertices: [number, number, number];
  /** Unit normal; its sign is not trusted (meshes can be wound either way). */
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  area: number;
}

const probe = new THREE.Triangle();
const closestPoint = new THREE.Vector3();
const edgeAB = new THREE.Vector3();
const edgeAC = new THREE.Vector3();

/** Calls `visit` for every collider triangle whose bounds touch `box`. */
function visitTriangles(
  collider: Collider,
  box: THREE.Box3,
  visit: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => void
) {
  collider.bvh.shapecast({
    intersectsBounds: bounds => box.intersectsBox(bounds),
    intersectsTriangle: tri => {
      visit(tri.a, tri.b, tri.c);
      return false;
    },
  });
}

/** Unit normal and area of a triangle; null for a degenerate one. */
function describe(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  edgeAB.subVectors(b, a);
  edgeAC.subVectors(c, a);
  const normal = new THREE.Vector3().crossVectors(edgeAB, edgeAC);
  const length = normal.length();
  if (length < 1e-12) return null;
  return { normal: normal.divideScalar(length), area: length / 2 };
}

const weldKey = (v: THREE.Vector3) =>
  `${Math.round(v.x * WELD_PER_METER)},${Math.round(v.y * WELD_PER_METER)},${Math.round(v.z * WELD_PER_METER)}`;

/** Height of the floor around `point`: the height with the most flat area below it. */
function findFloorY(collider: Collider, point: THREE.Vector3): number | null {
  const box = new THREE.Box3(
    new THREE.Vector3(point.x - FLOOR_SEARCH_RADIUS, point.y - 3, point.z - FLOOR_SEARCH_RADIUS),
    new THREE.Vector3(point.x + FLOOR_SEARCH_RADIUS, point.y + 0.15, point.z + FLOOR_SEARCH_RADIUS)
  );
  const bins = new Map<number, { area: number; heightSum: number }>();
  const centroid = new THREE.Vector3();
  visitTriangles(collider, box, (a, b, c) => {
    const info = describe(a, b, c);
    if (!info || Math.abs(info.normal.y) < FLAT_NORMAL_Y) return;
    centroid.copy(a).add(b).add(c).divideScalar(3);
    if (centroid.y > point.y + 0.15) return;
    const bin = Math.floor(centroid.y / FLOOR_BIN);
    const entry = bins.get(bin) ?? { area: 0, heightSum: 0 };
    entry.area += info.area;
    entry.heightSum += centroid.y * info.area;
    bins.set(bin, entry);
  });

  let bestArea = 0;
  let bestHeight = 0;
  for (const bin of bins.keys()) {
    let area = 0;
    let heightSum = 0;
    for (let offset = -1; offset <= 1; offset++) {
      const entry = bins.get(bin + offset);
      if (!entry) continue;
      area += entry.area;
      heightSum += entry.heightSum;
    }
    if (area > bestArea) {
      bestArea = area;
      bestHeight = heightSum / area;
    }
  }
  return bestArea >= FLOOR_MIN_AREA ? bestHeight : null;
}

/** Plane of an upright triangle: direction of its horizontal normal and its offset from the origin. */
function wallPlaneKey(tri: LocalTriangle): { angle: number; offset: number } | null {
  if (Math.abs(tri.normal.y) >= UPRIGHT_NORMAL_Y) return null;
  let nx = tri.normal.x;
  let nz = tri.normal.z;
  const length = Math.hypot(nx, nz);
  if (length < 1e-9) return null;
  nx /= length;
  nz /= length;
  let offset = nx * tri.centroid.x + nz * tri.centroid.z;
  // The same plane seen from behind has the opposite normal and offset.
  if (nx < 0 || (nx === 0 && nz < 0)) {
    nx = -nx;
    nz = -nz;
    offset = -offset;
  }
  return {
    angle: Math.round(Math.atan2(nz, nx) / WALL_ANGLE_BIN),
    offset: Math.round(offset / WALL_OFFSET_BIN),
  };
}

const smallBox = (center: THREE.Vector3, half: THREE.Vector3, yaw: number): ObjectSegment => ({
  center: center.clone(),
  halfExtents: half.clone(),
  yaw,
  method: 'fallback',
});

/**
 * The box around the object under `point` (a point on the collision mesh). Never fails: where the
 * mesh gives no clear object it returns a small box, thin and upright on walls.
 */
export function segmentObjectAt(collider: Collider, point: THREE.Vector3): ObjectSegment {
  const floorY = findFloorY(collider, point);

  // Triangles around the point, welded into a graph.
  const local: LocalTriangle[] = [];
  const vertexIds = new Map<string, number>();
  const trianglesAtVertex = new Map<number, number[]>();
  const idOf = (v: THREE.Vector3) => {
    const key = weldKey(v);
    let id = vertexIds.get(key);
    if (id === undefined) {
      id = vertexIds.size;
      vertexIds.set(key, id);
    }
    return id;
  };
  const searchBox = new THREE.Box3().setFromCenterAndSize(
    point,
    new THREE.Vector3(2 * SEARCH_RADIUS, 2 * SEARCH_RADIUS, 2 * SEARCH_RADIUS)
  );
  visitTriangles(collider, searchBox, (a, b, c) => {
    const centroid = new THREE.Vector3().copy(a).add(b).add(c).divideScalar(3);
    if (centroid.distanceTo(point) > SEARCH_RADIUS) return;
    const info = describe(a, b, c);
    if (!info) return;
    const vertices: [number, number, number] = [idOf(a), idOf(b), idOf(c)];
    const index = local.length;
    local.push({
      a: a.clone(),
      b: b.clone(),
      c: c.clone(),
      vertices,
      normal: info.normal,
      centroid,
      area: info.area,
    });
    for (const vertex of vertices) {
      const list = trianglesAtVertex.get(vertex);
      if (list) list.push(index);
      else trianglesAtVertex.set(vertex, [index]);
    }
  });
  if (!local.length) return smallBox(point, new THREE.Vector3().setScalar(FALLBACK_HALF), 0);

  // The triangle the tag sits on.
  let seed = 0;
  let seedDistance = Infinity;
  local.forEach((tri, index) => {
    probe.set(tri.a, tri.b, tri.c).closestPointToPoint(point, closestPoint);
    const distance = closestPoint.distanceTo(point);
    if (distance < seedDistance) {
      seedDistance = distance;
      seed = index;
    }
  });
  const seedTriangle = local[seed];
  const seedPlane = wallPlaneKey(seedTriangle);

  const fallback = () =>
    seedPlane
      ? smallBox(
          point,
          FALLBACK_WALL_HALF,
          // The box's own z axis points along the wall's normal.
          Math.atan2(seedTriangle.normal.x, seedTriangle.normal.z)
        )
      : smallBox(point, new THREE.Vector3().setScalar(FALLBACK_HALF), 0);

  // Upright planes with a lot of area are walls (unless the tag sits on that very plane).
  const planeArea = new Map<string, number>();
  const planeOf = local.map(wallPlaneKey);
  planeOf.forEach((plane, index) => {
    if (!plane) return;
    const key = `${plane.angle},${plane.offset}`;
    planeArea.set(key, (planeArea.get(key) ?? 0) + local[index].area);
  });
  const neighbourhoodArea = (plane: { angle: number; offset: number }) => {
    let area = 0;
    for (let da = -1; da <= 1; da++)
      for (let doff = -1; doff <= 1; doff++)
        area += planeArea.get(`${plane.angle + da},${plane.offset + doff}`) ?? 0;
    return area;
  };
  const isSeedPlane = (plane: { angle: number; offset: number }) =>
    seedPlane !== null &&
    Math.abs(plane.angle - seedPlane.angle) <= 1 &&
    Math.abs(plane.offset - seedPlane.offset) <= 1;

  // Big flat surfaces (counter tops, shelves, the floor) at one height: objects stand on them.
  const supportArea = new Map<number, number>();
  const supportBin = (tri: LocalTriangle) => Math.floor(tri.centroid.y / SUPPORT_BIN);
  for (const tri of local) {
    if (Math.abs(tri.normal.y) < SUPPORT_NORMAL_Y) continue;
    const bin = supportBin(tri);
    supportArea.set(bin, (supportArea.get(bin) ?? 0) + tri.area);
  }
  const supportNeighbourhood = (bin: number) =>
    (supportArea.get(bin - 1) ?? 0) + (supportArea.get(bin) ?? 0) + (supportArea.get(bin + 1) ?? 0);
  const seedFlat = Math.abs(seedTriangle.normal.y) >= SUPPORT_NORMAL_Y;
  const seedBin = supportBin(seedTriangle);
  const seedOnPlane =
    (seedFlat && supportNeighbourhood(seedBin) >= SUPPORT_MIN_AREA) ||
    (seedPlane !== null && neighbourhoodArea(seedPlane) >= WALL_MIN_AREA);

  const ceilingY =
    floorY === null ? Infinity : Math.max(floorY + CEILING_ABOVE_FLOOR, point.y + 0.4);
  const blocked = local.map((tri, index) => {
    if (Math.abs(tri.normal.y) >= FLAT_NORMAL_Y) {
      if (floorY !== null && tri.centroid.y < floorY + FLOOR_THICKNESS) return true;
      if (tri.centroid.y > ceilingY) return true;
      const bin = supportBin(tri);
      const inSeedSupport = seedFlat && Math.abs(bin - seedBin) <= 1;
      return (
        Math.abs(tri.normal.y) >= SUPPORT_NORMAL_Y &&
        !inSeedSupport &&
        supportNeighbourhood(bin) >= SUPPORT_MIN_AREA
      );
    }
    const plane = planeOf[index];
    return Boolean(plane && !isSeedPlane(plane) && neighbourhoodArea(plane) >= WALL_MIN_AREA);
  });
  // Tagging the floor or the ceiling does not select an object.
  if (blocked[seed]) return fallback();

  // Grow over the connected, unblocked surface.
  const withinReach = (centroid: THREE.Vector3) =>
    seedOnPlane
      ? centroid.distanceTo(point) <= PLANE_SEED_RADIUS
      : Math.hypot(centroid.x - point.x, centroid.z - point.z) <= GROW_RADIUS &&
        Math.abs(centroid.y - point.y) <= GROW_HEIGHT;
  const taken = new Set<number>([seed]);
  const queue = [seed];
  while (queue.length) {
    const current = queue.pop()!;
    for (const vertex of local[current].vertices) {
      for (const next of trianglesAtVertex.get(vertex) ?? []) {
        if (taken.has(next) || blocked[next]) continue;
        if (!withinReach(local[next].centroid)) continue;
        taken.add(next);
        queue.push(next);
      }
    }
  }
  if (taken.size < MIN_TRIANGLES) return fallback();

  // Fit a box: turn it to the main direction of the footprint, then take the extremes.
  const points: THREE.Vector3[] = [];
  for (const index of taken) points.push(local[index].a, local[index].b, local[index].c);
  let meanX = 0;
  let meanZ = 0;
  for (const p of points) {
    meanX += p.x;
    meanZ += p.z;
  }
  meanX /= points.length;
  meanZ /= points.length;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    szz += (p.z - meanZ) ** 2;
    sxz += (p.x - meanX) * (p.z - meanZ);
  }
  // The box's x axis lies along the footprint's main direction.
  const yaw = -0.5 * Math.atan2(2 * sxz, sxx - szz);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const lx = cos * (p.x - meanX) - sin * (p.z - meanZ);
    const lz = sin * (p.x - meanX) + cos * (p.z - meanZ);
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, lx);
    minZ = Math.min(minZ, lz);
    maxZ = Math.max(maxZ, lz);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  // Floor splats lie right at the floor mesh; keep the box above them.
  if (floorY !== null) minY = Math.max(minY, floorY + FLOOR_THICKNESS / 2);

  const sizes = [maxX - minX, maxY - minY, maxZ - minZ].sort((x, y) => x - y);
  if (sizes[2] < MIN_EXTENT || (sizes[0] < SLAB_THIN && sizes[1] > SLAB_LONG)) return fallback();

  const localCenterX = (minX + maxX) / 2;
  const localCenterZ = (minZ + maxZ) / 2;
  return {
    center: new THREE.Vector3(
      meanX + cos * localCenterX + sin * localCenterZ,
      (minY + maxY) / 2 + MARGIN / 2,
      meanZ - sin * localCenterX + cos * localCenterZ
    ),
    halfExtents: new THREE.Vector3(
      (maxX - minX) / 2 + MARGIN,
      (maxY - minY) / 2 + MARGIN / 2,
      (maxZ - minZ) / 2 + MARGIN
    ),
    yaw,
    method: 'mesh',
  };
}

/** Whether `point` lies in the segment's box, widened by `margin`. */
export function segmentContains(
  segment: ObjectSegment,
  point: THREE.Vector3,
  margin = SEGMENT_HIT_MARGIN
): boolean {
  const dx = point.x - segment.center.x;
  const dz = point.z - segment.center.z;
  const cos = Math.cos(segment.yaw);
  const sin = Math.sin(segment.yaw);
  return (
    Math.abs(cos * dx - sin * dz) <= segment.halfExtents.x + margin &&
    Math.abs(point.y - segment.center.y) <= segment.halfExtents.y + margin &&
    Math.abs(sin * dx + cos * dz) <= segment.halfExtents.z + margin
  );
}

export const segmentVolume = (segment: ObjectSegment) =>
  8 * segment.halfExtents.x * segment.halfExtents.y * segment.halfExtents.z;
