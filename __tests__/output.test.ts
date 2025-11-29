import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('output module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('calculateStats', () => {
    it('should calculate correct statistics', async () => {
      vi.resetModules();
      const { calculateStats } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [
            { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
            { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
          ],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
        {
          username: 'user2',
          repositories: [{ owner: 'user2', repo: 'repo3', url: 'https://github.com/user2/repo3' }],
          memberships: [],
        },
      ];

      const stats = calculateStats(results);

      expect(stats.totalRepositories).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.usersWithMemberships).toBe(1);
      expect(stats.totalMemberships).toBe(1);
    });

    it('should handle empty results', async () => {
      vi.resetModules();
      const { calculateStats } = await import('../src/output');

      const stats = calculateStats([]);

      expect(stats.totalRepositories).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.usersWithMemberships).toBe(0);
      expect(stats.totalMemberships).toBe(0);
    });

    it('should count multiple memberships per user', async () => {
      vi.resetModules();
      const { calculateStats } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [
            { org: 'org1', type: 'member' as const },
            { org: 'org2', type: 'outside_collaborator' as const },
          ],
        },
      ];

      const stats = calculateStats(results);

      expect(stats.usersWithMemberships).toBe(1);
      expect(stats.totalMemberships).toBe(2);
    });
  });

  describe('generateCSVContent', () => {
    it('should generate correct CSV content', async () => {
      vi.resetModules();
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [{ org: 'org1', type: 'member' as const }],
        },
      ];

      const csv = generateCSVContent(results);

      expect(csv).toContain(
        'Username,Profile URL,Repository Count,Repositories,Has Enterprise Membership,Memberships',
      );
      expect(csv).toContain('user1');
      expect(csv).toContain('https://github.com/user1');
      expect(csv).toContain('Yes');
      expect(csv).toContain('org1 (member)');
    });

    it('should escape values with commas', async () => {
      vi.resetModules();
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [
            { owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' },
            { owner: 'user1', repo: 'repo2', url: 'https://github.com/user1/repo2' },
          ],
          memberships: [
            { org: 'org1', type: 'member' as const },
            { org: 'org2', type: 'outside_collaborator' as const },
          ],
        },
      ];

      const csv = generateCSVContent(results);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2); // header + 1 data row
      // The memberships should be quoted due to semicolons
      expect(lines[1]).toContain('org1 (member); org2 (outside_collaborator)');
    });

    it('should handle empty results', async () => {
      vi.resetModules();
      const { generateCSVContent } = await import('../src/output');

      const csv = generateCSVContent([]);

      expect(csv).toBe(
        'Username,Profile URL,Repository Count,Repositories,Has Enterprise Membership,Memberships',
      );
    });

    it('should show No for users without memberships', async () => {
      vi.resetModules();
      const { generateCSVContent } = await import('../src/output');

      const results = [
        {
          username: 'user1',
          repositories: [{ owner: 'user1', repo: 'repo1', url: 'https://github.com/user1/repo1' }],
          memberships: [],
        },
      ];

      const csv = generateCSVContent(results);
      expect(csv).toContain('No');
    });
  });
});
