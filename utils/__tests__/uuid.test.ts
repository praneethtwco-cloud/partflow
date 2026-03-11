import { generateUUID } from '../uuid';

describe('generateUUID', () => {
  it('should generate a valid UUID v4 format', () => {
    const uuid = generateUUID();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where x is any hexadecimal digit and y is one of 8, 9, a, or b
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    const numberOfUUIDsToGenerate = 1000;

    for (let i = 0; i < numberOfUUIDsToGenerate; i++) {
      uuids.add(generateUUID());
    }

    // If all generated UUIDs are unique, the Set size should equal the number of iterations
    expect(uuids.size).toBe(numberOfUUIDsToGenerate);
  });

  it('should be exactly 36 characters long', () => {
    const uuid = generateUUID();
    expect(uuid.length).toBe(36);
  });

  it('should contain hyphens at correct positions', () => {
    const uuid = generateUUID();
    expect(uuid.charAt(8)).toBe('-');
    expect(uuid.charAt(13)).toBe('-');
    expect(uuid.charAt(18)).toBe('-');
    expect(uuid.charAt(23)).toBe('-');
  });
});
