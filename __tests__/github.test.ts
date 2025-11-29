import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@actions/core', () => import('../__fixtures__/core'));

describe('github module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('aggregateResults', () => {
    it('should aggregate repositories by user', async () => {
      vi.resetModules();
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
        { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
        { owner: 'user2', repo: 'repo3', url: 'https://github.com/user2/repo3' },
      ];

      const memberships = new Map();
      memberships.set('user1', {
        username: 'user1',
        organizations: new Map([['org1', 'member']]),
      });
      memberships.set('user2', {
        username: 'user2',
        organizations: new Map(),
      });

      const results = aggregateResults(repositories, memberships);

      expect(results).toHaveLength(2);
      // user1 has memberships, so should be first
      expect(results[0].username).toBe('user1');
      expect(results[0].repositories).toHaveLength(2);
      expect(results[0].memberships).toHaveLength(1);
      expect(results[0].memberships[0]).toEqual({ org: 'org1', type: 'member' });
      // user2 has no memberships
      expect(results[1].username).toBe('user2');
      expect(results[1].repositories).toHaveLength(1);
      expect(results[1].memberships).toHaveLength(0);
    });

    it('should sort results by number of memberships (most first)', async () => {
      vi.resetModules();
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'userA', repo: 'repo1', url: 'https://github.com/userA/repo1' },
        { owner: 'userB', repo: 'repo2', url: 'https://github.com/userB/repo2' },
        { owner: 'userC', repo: 'repo3', url: 'https://github.com/userC/repo3' },
      ];

      const memberships = new Map();
      memberships.set('userA', {
        username: 'userA',
        organizations: new Map([['org1', 'member']]),
      });
      memberships.set('userB', {
        username: 'userB',
        organizations: new Map([
          ['org1', 'member'],
          ['org2', 'outside_collaborator'],
        ]),
      });
      memberships.set('userC', {
        username: 'userC',
        organizations: new Map(),
      });

      const results = aggregateResults(repositories, memberships);

      expect(results[0].username).toBe('userB'); // 2 memberships
      expect(results[1].username).toBe('userA'); // 1 membership
      expect(results[2].username).toBe('userC'); // 0 memberships
    });

    it('should handle users with no memberships data', async () => {
      vi.resetModules();
      const { aggregateResults } = await import('../src/github');

      const repositories = [
        { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
      ];

      const memberships = new Map(); // empty - user not found in membership map

      const results = aggregateResults(repositories, memberships);

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('user1');
      expect(results[0].memberships).toHaveLength(0);
    });
  });
});
