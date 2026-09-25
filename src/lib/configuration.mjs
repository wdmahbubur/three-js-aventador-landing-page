import { FINISHES } from './config.mjs';

/** Presentation options for the pinned free model, not manufacturer order codes. */
export const CONFIG_OPTIONS = Object.freeze({
  paint: FINISHES,
  paintFinish: Object.freeze([{ id: 'gloss', name: 'Gloss' }, { id: 'matte', name: 'Matte' }]),
  carbon: Object.freeze([{ id: 'satin', name: 'Satin carbon' }, { id: 'polished', name: 'Polished carbon' }]),
  wheels: Object.freeze([{ id: 'graphite', name: 'Graphite', color: '#41444b' }, { id: 'silver', name: 'Silver', color: '#bfc5ca' }, { id: 'bronze', name: 'Bronze', color: '#94704b' }]),
  calipers: Object.freeze([{ id: 'rosso', name: 'Red', color: '#ba2921' }, { id: 'giallo', name: 'Yellow', color: '#e4b82c' }, { id: 'nero', name: 'Black', color: '#24262b' }]),
  seats: Object.freeze([{ id: 'original', name: 'Original', color: '#e95b00' }, { id: 'ivory', name: 'Ivory', color: '#bfb2a0' }, { id: 'tan', name: 'Tan', color: '#9b5a31' }, { id: 'nero', name: 'Black', color: '#25262a' }]),
  accents: Object.freeze([{ id: 'original', name: 'Original', color: '#e95b00' }, { id: 'rosso', name: 'Red', color: '#a62623' }, { id: 'arancio', name: 'Orange', color: '#c6662b' }, { id: 'ivory', name: 'Ivory', color: '#bfb2a0' }])
});
export const DEFAULT_CONFIGURATION = Object.freeze({ paint: 'rosso', paintFinish: 'gloss', carbon: 'satin', wheels: 'graphite', calipers: 'rosso', seats: 'original', accents: 'original' });
export const CONFIG_KEYS = Object.freeze(Object.keys(DEFAULT_CONFIGURATION));
export function validConfigOption(key, value) {
  return typeof key === 'string' && Object.hasOwn(CONFIG_OPTIONS, key) && typeof value === 'string' && CONFIG_OPTIONS[key].some(option => option.id === value);
}
export function normalizeConfiguration(input) {
  const config = {};
  for (const key of CONFIG_KEYS) config[key] = validConfigOption(key, input?.[key]) ? input[key] : DEFAULT_CONFIGURATION[key];
  return Object.freeze(config);
}
export function changeConfiguration(config, key, value) {
  return validConfigOption(key, value) ? normalizeConfiguration({ ...config, [key]: value }) : config;
}
export function configurationLabel(key, value) { return CONFIG_OPTIONS[key]?.find(option => option.id === value)?.name || 'Original'; }
export function materialSlot(partKey, materialName, meshName = '') {
  if (materialName === 'Body') return 'paint';
  if (/^Wheel_/.test(partKey) && /_Rim_/.test(meshName)) return 'wheels';
  if (/^Wheel_/.test(partKey) && materialName === 'Caliper') return 'calipers';
  if (partKey === 'Seat' && materialName === 'Interior_color') return 'seats';
  if (/^Interior_(doors|middle_parts)$/.test(partKey) && materialName === 'Interior_color') return 'accents';
  if (materialName === 'Carbon' && !/^(Interior|Seat|Steering|Speedometer|Pedal)/.test(partKey)) return 'carbon';
  return null;
}

/** Deterministic Home/End navigation for the controlled cabin selects. */
export function configurationBoundary(key, keyboardKey) {
  if (!Object.hasOwn(CONFIG_OPTIONS, key) || !['Home', 'End'].includes(keyboardKey)) return null;
  const options = CONFIG_OPTIONS[key];
  return options[keyboardKey === 'Home' ? 0 : options.length - 1].id;
}
