import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatOperationDay, getOperationDays, isOperationDate, isUnscheduled, LEGACY_DAYS, operationDateRange, validateOperationDates, validatePlanningAssignment } from './operation-calendar';
import { autoSuggestPlacements, type PatientCardData } from './planning-utils';

test('mission, screening and travel dates never become operation dates implicitly', () => {
  assert.deepEqual(getOperationDays({ planning_mode: 'dates', start_date: '2026-11-30', end_date: '2026-12-09' }), []);
  const dates = operationDateRange('2026-12-01', '2026-12-09');
  assert.equal(dates.length, 9);
  assert.deepEqual(getOperationDays({ planning_mode: 'dates', start_date: '2026-11-30', end_date: '2026-12-09', operation_dates: dates }), dates);
  assert(!dates.includes('2026-11-30'));
  assert(dates.includes('2026-12-05') && dates.includes('2026-12-06'));
  assert.notEqual(dates[0], dates[7]);
});

test('legacy editions preserve weekday keys; configured schedules can start any day and skip days', () => {
  assert.deepEqual(getOperationDays({ planning_mode: 'legacy_weekdays', start_date: '2026-01-01', end_date: '2026-12-31' }), LEGACY_DAYS);
  assert.deepEqual(getOperationDays({ planning_mode: 'dates', operation_dates: ['2027-04-23', '2027-04-16', '2027-04-17'] }), ['2027-04-16', '2027-04-17', '2027-04-23']);
  assert.deepEqual(operationDateRange('2027-04-19', '2027-04-23'), ['2027-04-19','2027-04-20','2027-04-21','2027-04-22','2027-04-23']);
});

test('date validation is strict, timezone independent and bounded by the mission', () => {
  assert.equal(isOperationDate('2026-02-30'), false);
  assert.equal(isOperationDate('2028-02-29'), true);
  assert.equal(isOperationDate('01/12/2026'), false);
  assert.throws(() => validateOperationDates(['2026-11-29'], { start_date: '2026-11-30' }));
  assert.throws(() => validateOperationDates(['2026-12-10'], { end_date: '2026-12-09' }));
  assert.throws(() => operationDateRange('2026-12-09', '2026-12-01'));
  assert.throws(() => operationDateRange('2026-01-01', '2028-01-01'));
  assert.equal(formatOperationDay('2026-12-01'), 'mar. 01/12/2026');
  assert.equal(formatOperationDay('Lundi'), 'Lundi');
  assert.deepEqual(validateOperationDates(['2026-12-02', '2026-12-01', '2026-12-01'], {}), ['2026-12-01','2026-12-02']);
});

test('auto placement only uses supplied operation dates, including a weekend or a single day', () => {
  const records = Array.from({ length: 8 }, (_, id) => ({ id, age: '20 ans', distance: 'en ville' }) as PatientCardData);
  const days = ['2027-04-16', '2027-04-17'];
  const result = autoSuggestPlacements(records, {}, days);
  assert.equal(Object.keys(result).length, records.length);
  assert(Object.values(result).every(day => days.includes(day)));
  assert.deepEqual(autoSuggestPlacements(records, {}, []), {});
  assert(Object.values(autoSuggestPlacements(records, {}, ['2026-12-01'])).every(day => day === '2026-12-01'));
  assert.equal(isUnscheduled('À Définir'), true);
  assert.equal(isUnscheduled('2026-12-10'), false); // outside-calendar assignments are never auto-replaced
});


test('server assignment rules reject travel days and weekdays for dated editions but retain existing dates', () => {
  const edition = { planning_mode: 'dates', operation_dates: ['2026-12-01'] };
  assert.doesNotThrow(() => validatePlanningAssignment('2026-12-01', edition));
  assert.throws(() => validatePlanningAssignment('2026-11-30', edition));
  assert.throws(() => validatePlanningAssignment('Lundi', edition));
  assert.doesNotThrow(() => validatePlanningAssignment('2026-12-10', edition, '2026-12-10'));
  assert.doesNotThrow(() => validatePlanningAssignment('A définir', edition));
  assert.doesNotThrow(() => validatePlanningAssignment('Lundi', { planning_mode: 'legacy_weekdays' }));
});
