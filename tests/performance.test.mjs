import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBudget, nextAdaptiveRatio, allowAutomatic3D } from '../src/lib/performance.mjs';

test('Auto mode caps desktop DPR instead of rendering every physical screen pixel', () => assert.equal(renderBudget({ dpr: 3 }).pixelRatio, 1.6));
test('Auto mode budgets handheld pixels and shadow-map memory', () => assert.deepEqual(renderBudget({ width: 390, dpr: 3 }), { pixelRatio: 1.25, shadowSize: 512, anisotropy: 2 }));
test('Low-memory and low-core devices use the smaller budget', () => { assert.equal(renderBudget({ memory: 4, dpr: 3 }).pixelRatio, 1.25); assert.equal(renderBudget({ cores: 4 }).shadowSize, 512); });
test('High is explicit and still bounded', () => assert.equal(renderBudget({ quality: 'high', dpr: 4 }).pixelRatio, 2));
test('Eco is available on every screen', () => assert.equal(renderBudget({ quality: 'eco', dpr: 4 }).pixelRatio, 1));
test('Slow active frames lower resolution only in Auto', () => { assert.equal(nextAdaptiveRatio(1.6, 31, 45, 'auto'), 1.45); assert.equal(nextAdaptiveRatio(2, 80, 100, 'high'), 2); });
test('Brief stalls do not trigger adaptation', () => { assert.equal(nextAdaptiveRatio(1.6, 50, 3, 'auto'), 1.6); assert.equal(nextAdaptiveRatio(1.6, 16, 50, 'auto'), 1.6); });
test('Adaptive resolution cannot fall below the readability floor', () => assert.equal(nextAdaptiveRatio(.8, 50, 80, 'auto'), .8));
test('Data Saver pauses the automatic 3D download', () => assert.equal(allowAutomatic3D({ saveData: true }), false));
test('Very slow networks do not auto-download the model', () => { assert.equal(allowAutomatic3D({ effectiveType: 'slow-2g' }), false); assert.equal(allowAutomatic3D({ effectiveType: '2g' }), false); });
test('Normal and unknown connections keep the usual experience', () => { assert.equal(allowAutomatic3D({ effectiveType: '4g' }), true); assert.equal(allowAutomatic3D(undefined), true); });
