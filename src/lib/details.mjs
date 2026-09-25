/** These describe this interactive model, not unverified vehicle specifications. */
export const DETAILS = Object.freeze([
  { id: 'headlights', number: '01', title: 'The signature of light', label: 'Headlights', text: 'See the angular lighting elements up close. Switch on the showroom projection to see the beams spread across the floor.', action: 'lights', actionLabel: 'Toggle headlights' },
  { id: 'wheels', number: '02', title: 'Precision at every corner', label: 'Wheels & brakes', text: 'Explore the wheel spokes, brake rotor and caliper. Choose a wheel finish and caliper colour without changing the wheel geometry.', action: 'customize-wheels', actionLabel: 'Customize wheels' },
  { id: 'doors', number: '03', title: 'A different kind of entrance', label: 'Scissor doors', text: 'Lift both doors and watch their outer panels, glass, mirrors and inner lining move together. Close them to return to the original silhouette.', action: 'doors', actionLabel: 'Open / close doors' },
  { id: 'cockpit', number: '04', title: 'Built around your perspective', label: 'Cockpit', text: 'Look through the open driver-side doorway, then take your seat. Explore the dashboard and your selected cabin accents from a first-person view.', action: 'interior', actionLabel: 'Enter interior' },
  { id: 'engine', number: '05', title: 'The rear powertrain deck', label: 'Engine deck', text: 'A high rear view of the engine cover, vents and surrounding bodywork. This free model offers a visual study, not a service cutaway or factory assembly simulation.', action: null, actionLabel: null }
]);
export const DETAIL_IDS = Object.freeze(DETAILS.map(item => item.id));
export const isDetail = id => DETAIL_IDS.includes(id);
export const DETAIL_CAMERAS = Object.freeze({
  headlights: { position: [1.55, 1.1, 4.8], target: [.55, .52, 1.85], fov: 40 },
  wheels: { position: [3.2, 1.05, 2.65], target: [.92, .48, 1.25], fov: 42 },
  doors: { position: [4.3, 2.15, 2.5], target: [.55, .95, .05], fov: 44 },
  cockpit: { position: [2.4, 1.45, -.18], target: [.05, .78, .22], fov: 58 },
  engine: { position: [-1.9, 3.25, -3.7], target: [0, .92, -1.3], fov: 45 }
});
