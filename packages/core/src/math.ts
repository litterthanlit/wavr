// Minimal mat4 utilities for WebGL MVP matrices. No dependencies.

export function mat4Identity(): Float32Array {
  const out = new Float32Array(16);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

export function mat4Perspective(
  fov: number, aspect: number, near: number, far: number
): Float32Array {
  const out = new Float32Array(16);
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function mat4LookAt(
  eye: [number, number, number],
  center: [number, number, number],
  up: [number, number, number]
): Float32Array {
  const out = new Float32Array(16);
  let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;

  z0 = eye[0] - center[0];
  z1 = eye[1] - center[1];
  z2 = eye[2] - center[2];
  len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
  z0 *= len; z1 *= len; z2 *= len;

  x0 = up[1] * z2 - up[2] * z1;
  x1 = up[2] * z0 - up[0] * z2;
  x2 = up[0] * z1 - up[1] * z0;
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
  if (len > 0) { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2] = z0;
  out[4] = x1; out[5] = y1; out[6] = z1;
  out[8] = x2; out[9] = y2; out[10] = z2;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

export function mat4RotateX(m: Float32Array, angle: number): Float32Array {
  const out = new Float32Array(m);
  const s = Math.sin(angle), c = Math.cos(angle);
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}

export function mat4RotateY(m: Float32Array, angle: number): Float32Array {
  const out = new Float32Array(m);
  const s = Math.sin(angle), c = Math.cos(angle);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}

export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[i] * b[j * 4] +
        a[4 + i] * b[j * 4 + 1] +
        a[8 + i] * b[j * 4 + 2] +
        a[12 + i] * b[j * 4 + 3];
    }
  }
  return out;
}
