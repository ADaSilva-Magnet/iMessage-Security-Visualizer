// Colours and positions shared by the scene, its props and the walkthrough.
import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const COLORS = {
  send: 0x3aa0ff, ids: 0x22d3ee, apns: 0xf472b6, cloud: 0x7dd3fc, sign: 0xfbbf24,
  phone: 0x4ade80, pad: 0xa78bfa, mac: 0xfb923c, tls: 0x2dd4bf, neutral: 0x55657c,
};
export const DEV_COLORS = [COLORS.phone, COLORS.pad, COLORS.mac];

export const POS = {
  alex: V(-6.6, 0, 3.0), riley: V(6.5, 0, -3.0),
  ids: V(-6.4, 3.9, -8.2), apns: V(-0.6, 6.4, -9.8), cloud: V(5.0, 6.9, -10.4),
};
