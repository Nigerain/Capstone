import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateStoreDistanceMiles } from '../src/utils/storeDistance.ts';

function approximately(actual, expected, tolerance) {
  assert.equal(typeof actual, 'number');
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}`
  );
}

test('identical coordinates return zero, including zero coordinates', () => {
  assert.equal(calculateStoreDistanceMiles(0, 0, 0, 0), 0);
  assert.equal(calculateStoreDistanceMiles(40.7, -74, 40.7, -74), 0);
});

test('nearby points return fractional miles without rounding', () => {
  approximately(calculateStoreDistanceMiles(0, 0, 0, 0.01), 0.690934, 0.00001);
});

test('New York to London returns approximately 3461 miles in either direction', () => {
  const forward = calculateStoreDistanceMiles(
    40.7128,
    -74.006,
    51.5074,
    -0.1278
  );
  approximately(forward, 3461.18, 0.1);
  assert.equal(
    forward,
    calculateStoreDistanceMiles(51.5074, -0.1278, 40.7128, -74.006)
  );
});

test('poles and coordinate boundaries remain finite', () => {
  approximately(calculateStoreDistanceMiles(90, -180, 90, 180), 0, 1e-9);
  approximately(calculateStoreDistanceMiles(90, 0, -90, 0), 12436.8, 0.1);
});

test('antimeridian crossings use the short arc', () => {
  approximately(
    calculateStoreDistanceMiles(0, 179.9, 0, -179.9),
    13.8187,
    0.001
  );
  approximately(calculateStoreDistanceMiles(0, -180, 0, 180), 0, 1e-9);
});

test('antipodal and nearly antipodal points remain finite', () => {
  approximately(calculateStoreDistanceMiles(0, 0, 0, 180), 12436.8, 0.1);
  approximately(
    calculateStoreDistanceMiles(40.7, -74, -40.7000001, 106),
    12436.8,
    0.1
  );
});

test('missing or partial Store coordinates return null', () => {
  for (const [latitude, longitude] of [
    [null, null],
    [undefined, undefined],
    [null, 0],
    [0, null],
    [undefined, 0],
    [0, undefined],
  ]) {
    assert.equal(calculateStoreDistanceMiles(0, 0, latitude, longitude), null);
  }
});

test('invalid values are rejected in every coordinate position', () => {
  for (let index = 0; index < 4; index += 1) {
    const maximum = index % 2 === 0 ? 90 : 180;
    for (const invalid of [
      NaN,
      Infinity,
      -Infinity,
      maximum + 0.001,
      -maximum - 0.001,
      '0',
      true,
      false,
      {},
      [],
      ...(index < 2 ? [null, undefined] : []),
    ]) {
      const coordinates = [0, 0, 0, 0];
      coordinates[index] = invalid;
      assert.throws(
        () => calculateStoreDistanceMiles(...coordinates),
        RangeError
      );
    }
  }
});

test('invalid user coordinates are rejected even if Store coordinates are missing', () => {
  assert.throws(
    () => calculateStoreDistanceMiles(NaN, 0, null, null),
    RangeError
  );
});
