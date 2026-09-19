import assert from 'assert';
import { EntityMatcherImpl } from '../services/integrationEngine/entityMatcher/EntityMatcherImpl.js';
import { CanonicalCitizenData } from '../services/integrationEngine/parsing/FieldMapper.js';

const matcher = new EntityMatcherImpl();

async function run(): Promise<void> {
  const baseSource: CanonicalCitizenData = {
    name: 'Rahul Kumar',
    dateOfBirth: '1995-03-15',
    registrationNumber: 'EDU2024001234',
    email: 'rahul@test.com',
    phone: '+919800001111'
  };

  const baseApplication: CanonicalCitizenData = {
    name: 'Rahul Kumar',
    dateOfBirth: '1995-03-15',
    registrationNumber: 'EDU2024001234',
    email: 'rahul@test.com',
    phone: '+919800001111'
  };

  const normalizationMatch = await matcher.match({
    sourceData: { name: 'Rahul Kumar' },
    applicationData: { name: ' RAHUL kumar ' }
  });
  assert.strictEqual(normalizationMatch.samePerson, true, 'normalized name should match');
  assert.strictEqual(normalizationMatch.confidence, 1, 'normalized name confidence should be 1');

  const exactMatch = await matcher.match({
    sourceData: baseSource,
    applicationData: baseApplication
  });
  assert.strictEqual(exactMatch.samePerson, true, 'identical records should match');
  assert.ok(exactMatch.confidence >= 0.85, `identical match confidence too low: ${exactMatch.confidence}`);
  assert.deepStrictEqual(exactMatch.matchedFields, ['name', 'dateOfBirth', 'registrationNumber', 'email', 'phone']);
  assert.deepStrictEqual(exactMatch.unmatchedFields, []);

  const crossSystemMatch = await matcher.match({
    sourceData: { ...baseSource, registrationNumber: 'EMP2024001234' },
    applicationData: baseApplication
  });
  assert.strictEqual(crossSystemMatch.samePerson, true, 'cross-system identifier difference should still match');
  assert.ok(crossSystemMatch.confidence >= 0.85, `cross-system confidence too low: ${crossSystemMatch.confidence}`);

  const negativeMatch = await matcher.match({
    sourceData: baseSource,
    applicationData: {
      name: 'Asha Verma',
      dateOfBirth: '1990-01-01',
      registrationNumber: 'EDU2020000000',
      email: 'impostor@test.com',
      phone: '+919800003333'
    }
  });
  assert.strictEqual(negativeMatch.samePerson, false, 'different citizens must not match');
  assert.ok(negativeMatch.confidence < 0.85, `mismatch confidence too high: ${negativeMatch.confidence}`);
  assert.deepStrictEqual(negativeMatch.matchedFields, []);
  assert.deepStrictEqual(negativeMatch.unmatchedFields, ['name', 'dateOfBirth', 'registrationNumber', 'email', 'phone']);

  const partialMatch = await matcher.match({
    sourceData: { name: 'Rahul Kumar', dateOfBirth: '1995-03-15' },
    applicationData: { name: 'Rahul Kumar', dateOfBirth: '1980-06-01' }
  });
  assert.strictEqual(partialMatch.samePerson, false, 'matched name but different dob must not pass');
  assert.ok(partialMatch.confidence < 0.85, `partial match confidence too high: ${partialMatch.confidence}`);

  const noCommonFields = await matcher.match({
    sourceData: { name: 'Rahul Kumar' },
    applicationData: { email: 'impostor@test.com' }
  });
  assert.strictEqual(noCommonFields.samePerson, false, 'no common fields must not match');
  assert.strictEqual(noCommonFields.confidence, 0, 'no common fields confidence should be 0');

  console.log('Matcher self-check passed.');
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Matcher self-check failed');
  process.exit(1);
});