import { describe, expect, it } from 'vitest';
import { homePathFor, pathAllowedFor } from './roles.js';

describe('roles', () => {
  it('maps roles to home paths', () => {
    expect(homePathFor('nurse')).toBe('/nurse');
    expect(homePathFor('family')).toBe('/family');
    expect(homePathFor(undefined)).toBe('/login');
  });

  it('only allows paths inside the role area', () => {
    expect(pathAllowedFor('nurse', '/nurse/patients/1')).toBe(true);
    expect(pathAllowedFor('nurse', '/nurse')).toBe(true);
    expect(pathAllowedFor('nurse', '/nursery')).toBe(false);
    expect(pathAllowedFor('nurse', '/family')).toBe(false);
    expect(pathAllowedFor('family', undefined)).toBe(false);
  });
});
