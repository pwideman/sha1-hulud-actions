import { vi } from 'vitest';

export const uploadArtifact = vi.fn().mockResolvedValue({ id: 123, size: 100 });

export class DefaultArtifactClient {
  uploadArtifact = uploadArtifact;
}
