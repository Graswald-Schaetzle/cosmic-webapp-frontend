import * as THREE from 'three';

/** A point of the plan: x and z of the space frame, in metres. */
export type PlanPoint = [number, number];

export interface PlanPath {
  points: PlanPoint[];
  closed: boolean;
}

export interface PlanBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FloorPlan {
  /** Wall outlines in the space frame, cleaned up for drawing. */
  paths: PlanPath[];
  bounds: PlanBounds;
  /** Height of the floor the plan was cut above. */
  floorY: number;
  /** Direction of the main walls (radians, modulo a quarter turn); turning the plan by it squares it up. */
  wallAngle: number;
}

/** Triangles in the space frame (placement applied). */
export interface TriangleMesh {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
}

export interface FloorPlanOptions {
  /** Cut heights above the floor, in metres. A point is inside when most cuts say so. */
  sliceHeights: number[];
  /** Raster cell size in metres. */
  cellSize: number;
  /** Rooms or obstacles narrower than this (m) are noise and are smoothed away. */
  minFeatureSize: number;
  /** Floor areas (m2) below this are specks outside the rooms. */
  minRoomArea: number;
  /** Holes (m2) below this are filled; larger ones are furniture or pillars and stay open. */
  minObstacleArea: number;
  /** Largest deviation (m) the simplified outline may have from the contour. */
  simplifyTolerance: number;
  /** Edges within this angle of the room's main wall directions are made exactly straight. */
  snapAngleDeg: number;
  /** Walls shorter than this are rounded-off corners or notches and are merged away. */
  minEdgeLength: number;
}

export const DEFAULT_FLOOR_PLAN_OPTIONS: FloorPlanOptions = {
  sliceHeights: [0.8, 1.2, 1.6],
  cellSize: 0.05,
  minFeatureSize: 0.3,
  minRoomArea: 1.5,
  minObstacleArea: 0.3,
  simplifyTolerance: 0.12,
  snapAngleDeg: 20,
  minEdgeLength: 0.4,
};

const WELD_PRECISION = 1e4;
const HEIGHT_BIN = 0.05;
/** Surfaces within this angle of horizontal count as floor or ceiling. */
const HORIZONTAL_NORMAL_Y = 0.8;
const MIN_CEILING_DISTANCE = 1.8;
const MAX_CEILING_DISTANCE = 4.5;
const MIN_CEILING_SHARE = 0.15;
/** Largest distance a corner may move when its walls are straightened. */
const MAX_CORNER_SHIFT = 0.3;
/** An edge up to this many times the minimum length is still a cut-off corner between two walls. */
const CORNER_EDGE_FACTOR = 1.75;
const CORNER_NEIGHBOUR_RATIO = 4;
const MIN_CORNER_SINE = Math.sin(THREE.MathUtils.degToRad(10));

/** Merges the triangles of every mesh under `root` into one world-space, welded triangle mesh. */
export function collectTriangles(root: THREE.Object3D): TriangleMesh {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const indices: number[] = [];
  const welded = new Map<string, number>();
  const vertex = new THREE.Vector3();

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.index;
    const local: number[] = [];
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      // Welding closes the seams between triangles that were exported with separate vertices.
      const key = `${Math.round(vertex.x * WELD_PRECISION)},${Math.round(vertex.y * WELD_PRECISION)},${Math.round(vertex.z * WELD_PRECISION)}`;
      let id = welded.get(key);
      if (id === undefined) {
        id = positions.length / 3;
        positions.push(vertex.x, vertex.y, vertex.z);
        welded.set(key, id);
      }
      local.push(id);
    }
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i++) indices.push(local[index ? index.getX(i) : i]);
  });
  return { positions, indices };
}

interface Histogram {
  origin: number;
  bins: number[];
}

/** Total area of the faces pointing up (or down) per height, smoothed over neighbouring bins. */
function heightHistogram(mesh: TriangleMesh, facing: 1 | -1): Histogram {
  const { positions, indices } = mesh;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    minY = Math.min(minY, positions[i]);
    maxY = Math.max(maxY, positions[i]);
  }
  const bins = new Array<number>(Math.max(1, Math.ceil((maxY - minY) / HEIGHT_BIN) + 1)).fill(0);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-12 || (ny / length) * facing < HORIZONTAL_NORMAL_Y) continue;
    const y = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
    bins[Math.min(bins.length - 1, Math.floor((y - minY) / HEIGHT_BIN))] += length / 2;
  }
  const smoothed = bins.map(
    (value, i) => (bins[i - 1] ?? 0) * 0.5 + value + (bins[i + 1] ?? 0) * 0.5
  );
  return { origin: minY, bins: smoothed };
}

const peak = (histogram: Histogram, from = 0, to = histogram.bins.length - 1) => {
  let best = -1;
  for (let i = Math.max(0, from); i <= Math.min(to, histogram.bins.length - 1); i++) {
    if (best < 0 || histogram.bins[i] > histogram.bins[best]) best = i;
  }
  return best;
};

const binHeight = (histogram: Histogram, bin: number) =>
  histogram.origin + (bin + 0.5) * HEIGHT_BIN;

/** The floor is where most upward-facing surface lies; the ceiling is the matching peak above. */
export function findFloorAndCeiling(mesh: TriangleMesh): {
  floorY: number;
  ceilingY: number | null;
} | null {
  const up = heightHistogram(mesh, 1);
  const floorBin = peak(up);
  if (floorBin < 0 || up.bins[floorBin] <= 0) return null;
  const floorY = binHeight(up, floorBin);

  const down = heightHistogram(mesh, -1);
  const from = Math.floor((floorY + MIN_CEILING_DISTANCE - down.origin) / HEIGHT_BIN);
  const to = Math.ceil((floorY + MAX_CEILING_DISTANCE - down.origin) / HEIGHT_BIN);
  const ceilingBin = peak(down, from, to);
  const hasCeiling =
    ceilingBin >= from && down.bins[ceilingBin] >= up.bins[floorBin] * MIN_CEILING_SHARE;
  return { floorY, ceilingY: hasCeiling ? binHeight(down, ceilingBin) : null };
}

/** Outlines where the mesh meets the horizontal plane at height `y`. */
function slice(mesh: TriangleMesh, y: number): PlanPath[] {
  const { positions, indices } = mesh;
  const vertexCount = positions.length / 3;
  const pointIds = new Map<number, number>();
  const points: PlanPoint[] = [];
  const segments: [number, number][] = [];

  // A cut point belongs to the mesh edge it lies on, so neighbouring triangles share it exactly.
  const edgePoint = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = lo * vertexCount + hi;
    let id = pointIds.get(key);
    if (id === undefined) {
      const t = (y - positions[lo * 3 + 1]) / (positions[hi * 3 + 1] - positions[lo * 3 + 1]);
      points.push([
        positions[lo * 3] + (positions[hi * 3] - positions[lo * 3]) * t,
        positions[lo * 3 + 2] + (positions[hi * 3 + 2] - positions[lo * 3 + 2]) * t,
      ]);
      id = points.length - 1;
      pointIds.set(key, id);
    }
    return id;
  };

  for (let t = 0; t < indices.length; t += 3) {
    const v0 = indices[t];
    const v1 = indices[t + 1];
    const v2 = indices[t + 2];
    const a0 = positions[v0 * 3 + 1] > y;
    const a1 = positions[v1 * 3 + 1] > y;
    const a2 = positions[v2 * 3 + 1] > y;
    if (a0 === a1 && a1 === a2) continue;
    const cut: number[] = [];
    if (a0 !== a1) cut.push(edgePoint(v0, v1));
    if (a1 !== a2) cut.push(edgePoint(v1, v2));
    if (a2 !== a0) cut.push(edgePoint(v2, v0));
    if (cut.length === 2 && cut[0] !== cut[1]) segments.push([cut[0], cut[1]]);
  }
  return chain(points, segments);
}

/** Joins loose segments that share cut points into polylines and loops. */
function chain(points: PlanPoint[], segments: [number, number][]): PlanPath[] {
  const adjacent: number[][] = points.map(() => []);
  segments.forEach(([a, b], i) => {
    adjacent[a].push(i);
    adjacent[b].push(i);
  });
  const used = new Uint8Array(segments.length);
  const paths: PlanPath[] = [];

  const follow = (start: number, first: number): number[] => {
    const ids = [start];
    let point = start;
    let segment: number | undefined = first;
    while (segment !== undefined) {
      used[segment] = 1;
      const [a, b] = segments[segment];
      point = a === point ? b : a;
      ids.push(point);
      segment = adjacent[point].find(next => !used[next]);
    }
    return ids;
  };

  // Open outlines start where a point has one neighbour (or a junction), loops anywhere.
  for (let p = 0; p < points.length; p++) {
    if (adjacent[p].length === 2) continue;
    for (const segment of adjacent[p]) {
      if (!used[segment])
        paths.push({ points: follow(p, segment).map(i => points[i]), closed: false });
    }
  }
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    const ids = follow(segments[s][0], s);
    const closed = ids[ids.length - 1] === ids[0];
    if (closed) ids.pop();
    paths.push({ points: ids.map(i => points[i]), closed });
  }
  return paths;
}

const distanceToSegment = (p: PlanPoint, a: PlanPoint, b: PlanPoint) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSq))
    : 0;
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
};

/** Douglas-Peucker on an open polyline; keeps the first and last point. */
function simplifyOpen(points: PlanPoint[], tolerance: number): PlanPoint[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = from + 1; i < to; i++) {
      const distance = distanceToSegment(points[i], points[from], points[to]);
      if (distance > worstDistance) {
        worst = i;
        worstDistance = distance;
      }
    }
    if (worst < 0) continue;
    keep[worst] = 1;
    stack.push([from, worst], [worst, to]);
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies a loop by splitting it at the point farthest from its start. */
function simplifyClosed(points: PlanPoint[], tolerance: number): PlanPoint[] {
  if (points.length < 4) return points;
  let far = 1;
  let farDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (distance > farDistance) {
      far = i;
      farDistance = distance;
    }
  }
  const first = simplifyOpen(points.slice(0, far + 1), tolerance);
  const second = simplifyOpen([...points.slice(far), points[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

const simplify = (path: PlanPath, tolerance: number): PlanPath => ({
  closed: path.closed,
  points: path.closed
    ? simplifyClosed(path.points, tolerance)
    : simplifyOpen(path.points, tolerance),
});

interface EdgeLine {
  point: PlanPoint;
  /** Unit direction. */
  dx: number;
  dz: number;
}

const QUARTER_TURN = Math.PI / 2;

/** Direction of the room's walls, in radians modulo a quarter turn. */
function dominantWallAngle(paths: PlanPath[], minLength: number): number | null {
  let sin = 0;
  let cos = 0;
  let weight = 0;
  forEachEdge(paths, (a, b) => {
    const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (edgeLength < minLength) return;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 4;
    sin += Math.sin(angle) * edgeLength;
    cos += Math.cos(angle) * edgeLength;
    weight += edgeLength;
  });
  // A mean vector this short means the walls have no common direction.
  if (weight < 2 * minLength || Math.hypot(sin, cos) < weight * 0.3) return null;
  return Math.atan2(sin, cos) / 4;
}

function forEachEdge(paths: PlanPath[], callback: (a: PlanPoint, b: PlanPoint) => void) {
  for (const { points, closed } of paths) {
    const count = closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i++) callback(points[i], points[(i + 1) % points.length]);
  }
}

/** Offset of `angle` from the nearest multiple of a quarter turn after `base`, in (-45, 45] deg. */
const quarterTurnOffset = (angle: number, base: number) => {
  const turns = (angle - base) / QUARTER_TURN;
  return (turns - Math.round(turns)) * QUARTER_TURN;
};

const intersect = (p: EdgeLine, q: EdgeLine): PlanPoint | null => {
  const cross = p.dx * q.dz - p.dz * q.dx;
  if (Math.abs(cross) < MIN_CORNER_SINE) return null;
  const t = ((q.point[0] - p.point[0]) * q.dz - (q.point[1] - p.point[1]) * q.dx) / cross;
  return [p.point[0] + p.dx * t, p.point[1] + p.dz * t];
};

const project = (point: PlanPoint, line: EdgeLine): PlanPoint => {
  const t = (point[0] - line.point[0]) * line.dx + (point[1] - line.point[1]) * line.dz;
  return [line.point[0] + line.dx * t, line.point[1] + line.dz * t];
};

const lineThrough = (a: PlanPoint, b: PlanPoint): EdgeLine | null => {
  const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (edgeLength < 1e-9) return null;
  return { point: a, dx: (b[0] - a[0]) / edgeLength, dz: (b[1] - a[1]) / edgeLength };
};

/**
 * Removes edges shorter than `minLength`, the rounded-off corners and small notches the raster
 * leaves behind. A short edge between two walls is replaced by the corner where the walls meet.
 */
function collapseShortEdges(path: PlanPath, minLength: number): PlanPath {
  const points = path.points.map((point): PlanPoint => [point[0], point[1]]);
  const minCount = path.closed ? 3 : 2;
  while (points.length > minCount) {
    const count = points.length;
    const edgeCount = path.closed ? count : count - 1;
    const lengths = Array.from({ length: edgeCount }, (_, i) => {
      const [a, b] = [points[i], points[(i + 1) % count]];
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    });
    // Rounded-off corners are a bit longer than other short edges, but sit between two long walls.
    const neighbour = (i: number) =>
      path.closed ? lengths[(i + edgeCount) % edgeCount] : lengths[i];
    let shortest = -1;
    let shortestLength = Infinity;
    for (let i = 0; i < edgeCount; i++) {
      const edgeLength = lengths[i];
      const cornerLike =
        edgeLength < minLength * CORNER_EDGE_FACTOR &&
        (neighbour(i - 1) ?? 0) >= edgeLength * CORNER_NEIGHBOUR_RATIO &&
        (neighbour(i + 1) ?? 0) >= edgeLength * CORNER_NEIGHBOUR_RATIO;
      if ((edgeLength < minLength || cornerLike) && edgeLength < shortestLength) {
        shortest = i;
        shortestLength = edgeLength;
      }
    }
    if (shortest < 0) break;

    const i = shortest;
    const j = (i + 1) % count;
    const before = path.closed ? (i - 1 + count) % count : i - 1;
    const after = path.closed ? (j + 1) % count : j + 1;
    let merged: PlanPoint = [(points[i][0] + points[j][0]) / 2, (points[i][1] + points[j][1]) / 2];
    if (before >= 0 && after < count) {
      const first = lineThrough(points[before], points[i]);
      const second = lineThrough(points[j], points[after]);
      const corner = first && second ? intersect(first, second) : null;
      if (corner && Math.hypot(corner[0] - merged[0], corner[1] - merged[1]) <= MAX_CORNER_SHIFT) {
        merged = corner;
      }
    }
    if (j > i) points.splice(i, 2, merged);
    else {
      points.pop();
      points[0] = merged;
    }
  }
  return { points, closed: path.closed };
}

const orientation = (a: PlanPoint, b: PlanPoint, c: PlanPoint) =>
  Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

/** True when two edges of the outline properly cross each other. */
function selfIntersects({ points, closed }: PlanPath): boolean {
  const count = points.length;
  const edgeCount = closed ? count : count - 1;
  for (let i = 0; i < edgeCount; i++) {
    for (let j = i + 2; j < edgeCount; j++) {
      if (closed && i === 0 && j === edgeCount - 1) continue;
      const [a, b] = [points[i], points[(i + 1) % count]];
      const [c, d] = [points[j], points[(j + 1) % count]];
      if (
        orientation(a, b, c) * orientation(a, b, d) < 0 &&
        orientation(c, d, a) * orientation(c, d, b) < 0
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Makes walls that are nearly aligned with the room's main directions exactly straight and
 * moves the corners onto the crossing of the straightened walls. Where that would make the
 * outline cross itself (narrow slits), the less tidy version is kept.
 */
function straighten(paths: PlanPath[], options: FloorPlanOptions): PlanPath[] {
  const base = dominantWallAngle(paths, options.minEdgeLength);
  if (base === null) return paths;
  return paths.map(path => {
    const collapsed = collapseShortEdges(path, options.minEdgeLength);
    const snapped = snapWalls(collapsed, base, options);
    return [snapped, collapsed, path].find(candidate => !selfIntersects(candidate)) ?? path;
  });
}

interface Wall {
  line: EdgeLine;
  /** Direction was made exactly parallel to the room's walls. */
  snapped: boolean;
  /** First and last edge of the outline this wall covers. */
  first: number;
  last: number;
}

function snapWalls(path: PlanPath, base: number, options: FloorPlanOptions): PlanPath {
  const snapAngle = THREE.MathUtils.degToRad(options.snapAngleDeg);
  const { points, closed } = path;
  const count = points.length;
  const edgeCount = closed ? count : count - 1;
  if (edgeCount < 1) return path;

  const edges = Array.from({ length: edgeCount }, (_, i) => {
    const a = points[i];
    const b = points[(i + 1) % count];
    const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const offset = quarterTurnOffset(angle, base);
    const snapped = edgeLength >= options.minEdgeLength && Math.abs(offset) <= snapAngle;
    if (snapped) angle -= offset;
    return {
      snapped,
      angle,
      length: edgeLength,
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as PlanPoint,
    };
  });

  // Consecutive edges that snap to the same direction are one wall, wobble and all.
  const sameWall = (i: number, j: number) =>
    edges[i].snapped && edges[j].snapped && Math.abs(edges[i].angle - edges[j].angle) < 1e-9;
  let start = 0;
  if (closed) {
    start = edges.findIndex((_, i) => !sameWall((i - 1 + edgeCount) % edgeCount, i));
    if (start < 0) return path;
  }
  const walls: Wall[] = [];
  for (let k = 0; k < edgeCount; k++) {
    const i = (start + k) % edgeCount;
    const wall = walls[walls.length - 1];
    if (wall && sameWall(wall.last, i)) {
      wall.last = i;
      continue;
    }
    walls.push({ line: lineOf(edges[i]), snapped: edges[i].snapped, first: i, last: i });
  }
  for (const wall of walls) {
    if (wall.first === wall.last) continue;
    // The wall runs through the length-weighted middle of its edges.
    let total = 0;
    let x = 0;
    let z = 0;
    for (let k = wall.first; ; k = (k + 1) % edgeCount) {
      total += edges[k].length;
      x += edges[k].mid[0] * edges[k].length;
      z += edges[k].mid[1] * edges[k].length;
      if (k === wall.last) break;
    }
    wall.line = { ...wall.line, point: [x / total, z / total] };
  }

  const corner = (before: Wall, after: Wall, vertex: number): PlanPoint => {
    const original = points[vertex];
    const crossing = intersect(before.line, after.line);
    const shift = crossing
      ? Math.hypot(crossing[0] - original[0], crossing[1] - original[1])
      : Infinity;
    return crossing && shift <= MAX_CORNER_SHIFT ? crossing : original;
  };
  const moved: PlanPoint[] = [];
  walls.forEach((wall, w) => {
    const vertex = wall.first;
    if (closed) moved.push(corner(walls[(w - 1 + walls.length) % walls.length], wall, vertex));
    else if (w === 0) moved.push(project(points[vertex], wall.line));
    else moved.push(corner(walls[w - 1], wall, vertex));
  });
  if (!closed) {
    const lastWall = walls[walls.length - 1];
    moved.push(project(points[count - 1], lastWall.line));
  }
  // Collinear corners left over from the straightening are dropped.
  return simplify({ points: moved, closed }, options.simplifyTolerance / 3);
}

const lineOf = (edge: { angle: number; mid: PlanPoint }): EdgeLine => ({
  point: edge.mid,
  dx: Math.cos(edge.angle),
  dz: Math.sin(edge.angle),
});

const polygonArea = (points: PlanPoint[]) => {
  let twice = 0;
  points.forEach(([x, z], i) => {
    const [nextX, nextZ] = points[(i + 1) % points.length];
    twice += x * nextZ - nextX * z;
  });
  return twice / 2;
};

const boundsOf = (paths: PlanPath[]): PlanBounds => {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const { points } of paths) {
    for (const [x, z] of points) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minZ = Math.min(bounds.minZ, z);
      bounds.maxZ = Math.max(bounds.maxZ, z);
    }
  }
  return bounds;
};

interface Grid {
  width: number;
  height: number;
  originX: number;
  originZ: number;
  cell: number;
}

/** A cut outline as a polygon: loops as they are, open outlines closed when nearly closed. */
function asPolygon(path: PlanPath, maxGap: number): PlanPoint[] | null {
  if (path.points.length < 3) return null;
  if (path.closed) return path.points;
  const [first, last] = [path.points[0], path.points[path.points.length - 1]];
  return Math.hypot(first[0] - last[0], first[1] - last[1]) <= maxGap ? path.points : null;
}

/** Marks the cells whose centre lies inside the polygons (even-odd rule). */
function fillPolygons(grid: Grid, polygons: PlanPoint[][]): Uint8Array {
  const { width, height, originX, originZ, cell } = grid;
  const mask = new Uint8Array(width * height);
  const crossings: number[] = [];
  for (let row = 0; row < height; row++) {
    const z = originZ + (row + 0.5) * cell;
    crossings.length = 0;
    for (const polygon of polygons) {
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [ax, az] = polygon[j];
        const [bx, bz] = polygon[i];
        if (az <= z === bz <= z) continue;
        crossings.push(ax + ((z - az) / (bz - az)) * (bx - ax));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil((crossings[k] - originX) / cell - 0.5));
      const to = Math.min(width, Math.ceil((crossings[k + 1] - originX) / cell - 0.5));
      for (let col = from; col < to; col++) mask[row * width + col] = 1;
    }
  }
  return mask;
}

/**
 * Grows (or shrinks) the set by about `radius` cells in every direction; the outside of the grid
 * counts as empty. Steps alternate between the 4- and 8-neighbourhood, which approximates a disc
 * and keeps corners from being cut off as sharply as a square would.
 */
function morph(mask: Uint8Array, grid: Grid, radius: number, grow: boolean): Uint8Array {
  const { width, height } = grid;
  let current = mask;
  for (let step = 0; step < radius; step++) {
    const diagonals = step % 2 === 0;
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = y * width + x;
        const cell = current[at];
        // Growing needs one filled neighbour, shrinking needs all of them filled.
        if (grow === (cell === 1)) {
          next[at] = cell;
          continue;
        }
        let decided = false;
        for (let dy = -1; dy <= 1 && !decided; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx === 0 && dy === 0) || (!diagonals && dx !== 0 && dy !== 0)) continue;
            const nx = x + dx;
            const ny = y + dy;
            const inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
            if ((inside ? current[ny * width + nx] : 0) === (grow ? 1 : 0)) {
              decided = true;
              break;
            }
          }
        }
        next[at] = decided === grow ? 1 : 0;
      }
    }
    current = next;
  }
  return current;
}

/**
 * Clears connected regions of `value` that are smaller than `minCells`. With `spareBorder`, a
 * region that touches the grid's edge is kept (the outside world is not a hole).
 */
function removeSmallRegions(
  mask: Uint8Array,
  grid: Grid,
  value: 0 | 1,
  minCells: number,
  spareBorder: boolean
): void {
  const { width, height } = grid;
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || mask[start] !== value) continue;
    let head = 0;
    let tail = 0;
    let touchesBorder = false;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const at = queue[head++];
      const x = at % width;
      const y = (at - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      const neighbours = [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
      ];
      for (const next of neighbours) {
        if (next < 0 || seen[next] || mask[next] !== value) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail < minCells && !(spareBorder && touchesBorder)) {
      for (let i = 0; i < tail; i++) mask[queue[i]] = value === 1 ? 0 : 1;
    }
  }
}

/** 3x3 box blur of the 0/1 mask; gives the contour sub-cell accuracy. */
function soften(mask: Uint8Array, grid: Grid, passes: number): Float32Array {
  const { width, height } = grid;
  let current = Float32Array.from(mask);
  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            sum += current[ny * width + nx];
            count++;
          }
        }
        next[y * width + x] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

/** Marching squares: the outlines of the region where `values` is at least 0.5. */
function contours(values: Float32Array, grid: Grid): PlanPath[] {
  const { width, height, originX, originZ, cell } = grid;
  const pointIds = new Map<number, number>();
  const points: PlanPoint[] = [];
  const segments: [number, number][] = [];

  // Edge between node (x, y) and its right (horizontal) or lower (vertical) neighbour.
  const edgePoint = (x: number, y: number, horizontal: boolean) => {
    const key = (horizontal ? 0 : width * height) + y * width + x;
    let id = pointIds.get(key);
    if (id === undefined) {
      const a = values[y * width + x];
      const nx = horizontal ? x + 1 : x;
      const ny = horizontal ? y : y + 1;
      const b = values[ny * width + nx];
      const t = (0.5 - a) / (b - a);
      points.push([
        originX + (x + 0.5 + (nx - x) * t) * cell,
        originZ + (y + 0.5 + (ny - y) * t) * cell,
      ]);
      id = points.length - 1;
      pointIds.set(key, id);
    }
    return id;
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = values[y * width + x];
      const tr = values[y * width + x + 1];
      const br = values[(y + 1) * width + x + 1];
      const bl = values[(y + 1) * width + x];
      const code =
        (tl >= 0.5 ? 1 : 0) | (tr >= 0.5 ? 2 : 0) | (br >= 0.5 ? 4 : 0) | (bl >= 0.5 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const top = () => edgePoint(x, y, true);
      const bottom = () => edgePoint(x, y + 1, true);
      const left = () => edgePoint(x, y, false);
      const right = () => edgePoint(x + 1, y, false);
      const connected = (tl + tr + br + bl) / 4 >= 0.5;
      const add = (a: () => number, b: () => number) => segments.push([a(), b()]);
      switch (code) {
        case 1:
        case 14:
          add(left, top);
          break;
        case 2:
        case 13:
          add(top, right);
          break;
        case 3:
        case 12:
          add(left, right);
          break;
        case 4:
        case 11:
          add(right, bottom);
          break;
        case 6:
        case 9:
          add(top, bottom);
          break;
        case 7:
        case 8:
          add(left, bottom);
          break;
        case 5:
          // Two opposite corners inside: the centre decides whether they are joined.
          if (connected) {
            add(top, right);
            add(left, bottom);
          } else {
            add(left, top);
            add(right, bottom);
          }
          break;
        case 10:
          if (connected) {
            add(left, top);
            add(right, bottom);
          } else {
            add(top, right);
            add(left, bottom);
          }
          break;
      }
    }
  }
  return chain(points, segments);
}

/** The floor area as a mask: inside where most cuts are inside, cleaned of specks and slivers. */
function floorMask(cuts: PlanPath[][], grid: Grid, options: FloorPlanOptions): Uint8Array {
  const votes = new Uint8Array(grid.width * grid.height);
  for (const paths of cuts) {
    const polygons = paths
      .map(path => asPolygon(path, 1))
      .filter((polygon): polygon is PlanPoint[] => polygon !== null)
      // Cuts follow the mesh triangles; a coarse outline is enough for the raster.
      .map(polygon => simplifyClosed(polygon, grid.cell / 2));
    const mask = fillPolygons(grid, polygons);
    for (let i = 0; i < mask.length; i++) votes[i] += mask[i];
  }
  const needed = Math.floor(cuts.length / 2) + 1;
  let mask: Uint8Array = votes.map(count => (count >= needed ? 1 : 0));

  const radius = Math.max(1, Math.round(options.minFeatureSize / grid.cell / 2));
  mask = morph(morph(mask, grid, radius, false), grid, radius, true);
  mask = morph(morph(mask, grid, radius, true), grid, radius, false);
  const cellArea = grid.cell * grid.cell;
  removeSmallRegions(mask, grid, 1, Math.ceil(options.minRoomArea / cellArea), false);
  removeSmallRegions(mask, grid, 0, Math.ceil(options.minObstacleArea / cellArea), true);
  return mask;
}

/**
 * Cuts the mesh at a few heights between floor and ceiling, turns the cuts into a clean floor
 * area, and traces its outline with straight walls. Null when the mesh has no usable floor or
 * no walls.
 */
export function buildFloorPlanFromMesh(
  mesh: TriangleMesh,
  overrides: Partial<FloorPlanOptions> = {}
): FloorPlan | null {
  const options = { ...DEFAULT_FLOOR_PLAN_OPTIONS, ...overrides };
  const levels = findFloorAndCeiling(mesh);
  if (!levels) return null;
  const { floorY, ceilingY } = levels;
  // Stay clear of the ceiling, and drop cuts that would end up above it.
  const topY = ceilingY === null ? Infinity : ceilingY - 0.2;

  const cuts = options.sliceHeights
    .filter(height => floorY + height < topY)
    .map(height => slice(mesh, floorY + height))
    .filter(paths => paths.length);
  if (!cuts.length) return null;

  const cutBounds = boundsOf(cuts.flat());
  const margin = options.minFeatureSize + 3 * options.cellSize;
  const grid: Grid = {
    cell: options.cellSize,
    originX: cutBounds.minX - margin,
    originZ: cutBounds.minZ - margin,
    width: Math.ceil((cutBounds.maxX - cutBounds.minX + 2 * margin) / options.cellSize),
    height: Math.ceil((cutBounds.maxZ - cutBounds.minZ + 2 * margin) / options.cellSize),
  };

  // Softening can cut a thin bridge and leave a speck behind; anything this small is noise.
  const minArea = Math.min(options.minRoomArea, options.minObstacleArea);
  const outlines = contours(soften(floorMask(cuts, grid, options), grid, 2), grid)
    .map(path => simplify(path, options.simplifyTolerance))
    .filter(path => path.points.length >= 3 && Math.abs(polygonArea(path.points)) >= minArea);
  const paths = straighten(outlines, options);
  if (!paths.length) return null;
  const wallAngle = dominantWallAngle(paths, options.minEdgeLength) ?? 0;
  return { paths, bounds: boundsOf(paths), floorY, wallAngle };
}

/** The floor plan of a loaded collision mesh, in the space frame of its current placement. */
export function buildFloorPlan(
  root: THREE.Object3D,
  overrides: Partial<FloorPlanOptions> = {}
): FloorPlan | null {
  return buildFloorPlanFromMesh(collectTriangles(root), overrides);
}

/** Where the plan sits on screen: turned so the walls are square, scaled to fit a box. */
export interface PlanView {
  /** Size of the drawn plan in pixels. */
  width: number;
  height: number;
  /** Pixels per metre. */
  scale: number;
  /** The angle on screen (radians, clockwise from the right) of a world heading atan2(z, x). */
  headingToScreen: (heading: number) => number;
  toScreen: (x: number, z: number) => PlanPoint;
  toPlan: (px: number, py: number) => PlanPoint;
}

/** Fits the plan into `maxWidth` x `maxHeight` pixels, keeping its proportions. */
export function createPlanView(
  plan: FloorPlan,
  maxWidth: number,
  maxHeight: number,
  padding = 12
): PlanView {
  const cos = Math.cos(plan.wallAngle);
  const sin = Math.sin(plan.wallAngle);
  const turn = (x: number, z: number): PlanPoint => [x * cos + z * sin, -x * sin + z * cos];

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const { points } of plan.paths) {
    for (const [x, z] of points) {
      const [u, v] = turn(x, z);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
  }
  const spanU = Math.max(maxU - minU, 1);
  const spanV = Math.max(maxV - minV, 1);
  const scale = Math.min((maxWidth - 2 * padding) / spanU, (maxHeight - 2 * padding) / spanV);
  return {
    width: spanU * scale + 2 * padding,
    height: spanV * scale + 2 * padding,
    scale,
    headingToScreen: heading => heading - plan.wallAngle,
    toScreen: (x, z) => {
      const [u, v] = turn(x, z);
      return [(u - minU) * scale + padding, (v - minV) * scale + padding];
    },
    toPlan: (px, py) => {
      const u = (px - padding) / scale + minU;
      const v = (py - padding) / scale + minV;
      return [u * cos - v * sin, u * sin + v * cos];
    },
  };
}
