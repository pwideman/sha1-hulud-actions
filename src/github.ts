import { Octokit } from 'octokit';
import * as core from '@actions/core';

// Search query to find Sha1-Hulud worm repositories
const SEARCH_QUERY = 'Sha1-Hulud: The Second Coming';

export interface SearchResult {
  owner: string;
  repo: string;
  url: string;
}

export interface UserMembership {
  username: string;
  organizations: Map<string, MembershipType>;
}

export type MembershipType = 'member' | 'outside_collaborator' | 'none';

export interface OrganizationInfo {
  login: string;
}

export interface UserResult {
  username: string;
  repositories: SearchResult[];
  memberships: { org: string; type: MembershipType }[];
}

export async function getEnterpriseOrganizations(
  octokit: Octokit,
  enterprise: string,
): Promise<OrganizationInfo[]> {
  const organizations: OrganizationInfo[] = [];

  core.info(`Fetching organizations for enterprise: ${enterprise}`);

  try {
    const iterator = octokit.graphql.paginate.iterator<{
      enterprise: {
        organizations: {
          nodes: { login: string }[];
          pageInfo: { hasNextPage: boolean; endCursor: string };
        };
      };
    }>(
      `
      query($enterprise: String!, $cursor: String) {
        enterprise(slug: $enterprise) {
          organizations(first: 100, after: $cursor) {
            nodes {
              login
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `,
      { enterprise },
    );

    for await (const response of iterator) {
      const nodes = response.enterprise?.organizations?.nodes ?? [];
      for (const org of nodes) {
        organizations.push({ login: org.login });
      }
    }

    core.info(`Found ${organizations.length} organizations in enterprise`);
    return organizations;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to fetch enterprise organizations: ${message}`);
  }
}

export async function searchSha1HuludRepositories(octokit: Octokit): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  core.info(`Searching for Sha1-Hulud repositories...`);

  try {
    const iterator = octokit.paginate.iterator(octokit.rest.search.repos, {
      q: SEARCH_QUERY,
      per_page: 100,
    });

    for await (const response of iterator) {
      for (const repo of response.data) {
        if (repo.owner) {
          results.push({
            owner: repo.owner.login,
            repo: repo.name,
            url: repo.html_url,
          });
        }
      }
    }

    core.info(`Found ${results.length} Sha1-Hulud repositories`);
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to search for Sha1-Hulud repositories: ${message}`);
  }
}

async function checkUserMembershipInOrg(
  octokit: Octokit,
  org: string,
  username: string,
): Promise<MembershipType> {
  try {
    // First check if user is a member
    await octokit.rest.orgs.checkMembershipForUser({ org, username });
    return 'member';
  } catch {
    // Not a member, check if outside collaborator
    try {
      await octokit.rest.orgs.checkPublicMembershipForUser({ org, username });
      return 'member';
    } catch {
      // Check if outside collaborator by listing outside collaborators
      try {
        const response = await octokit.rest.orgs.listOutsideCollaborators({
          org,
          per_page: 100,
        });
        const isCollaborator = response.data.some(
          (c: { login: string }) => c.login.toLowerCase() === username.toLowerCase(),
        );
        return isCollaborator ? 'outside_collaborator' : 'none';
      } catch {
        return 'none';
      }
    }
  }
}

export async function checkUserMemberships(
  octokit: Octokit,
  organizations: OrganizationInfo[],
  usernames: string[],
): Promise<Map<string, UserMembership>> {
  const userMemberships = new Map<string, UserMembership>();
  const userCache = new Set<string>();

  core.info(
    `Checking memberships for ${usernames.length} users across ${organizations.length} organizations...`,
  );

  // Filter unique usernames
  const uniqueUsernames = [...new Set(usernames)];

  // Process all users
  const membershipPromises: Promise<void>[] = [];

  for (const username of uniqueUsernames) {
    if (userCache.has(username.toLowerCase())) {
      continue;
    }
    userCache.add(username.toLowerCase());

    const userMembership: UserMembership = {
      username,
      organizations: new Map(),
    };

    // Check membership in all organizations concurrently
    const orgPromises = organizations.map(async (org) => {
      const membership = await checkUserMembershipInOrg(octokit, org.login, username);
      if (membership !== 'none') {
        userMembership.organizations.set(org.login, membership);
      }
    });

    membershipPromises.push(
      Promise.all(orgPromises).then(() => {
        userMemberships.set(username, userMembership);
      }),
    );
  }

  await Promise.all(membershipPromises);

  core.info(`Completed membership checks for ${uniqueUsernames.length} users`);
  return userMemberships;
}

export function aggregateResults(
  repositories: SearchResult[],
  memberships: Map<string, UserMembership>,
): UserResult[] {
  const userRepos = new Map<string, SearchResult[]>();

  // Group repositories by owner
  for (const repo of repositories) {
    const existing = userRepos.get(repo.owner) ?? [];
    existing.push(repo);
    userRepos.set(repo.owner, existing);
  }

  // Build results
  const results: UserResult[] = [];
  for (const [username, repos] of userRepos) {
    const membership = memberships.get(username);
    const membershipList: { org: string; type: MembershipType }[] = [];

    if (membership) {
      for (const [org, type] of membership.organizations) {
        membershipList.push({ org, type });
      }
    }

    results.push({
      username,
      repositories: repos,
      memberships: membershipList,
    });
  }

  // Sort by number of memberships (most first), then by username
  results.sort((a, b) => {
    if (b.memberships.length !== a.memberships.length) {
      return b.memberships.length - a.memberships.length;
    }
    return a.username.localeCompare(b.username);
  });

  return results;
}
