import { describe, expect, it } from 'vitest';
import { getProjectIdFromArtifactPath, getProjectIdFromArtifactSource } from './artifact-paths';

describe('artifact project path parsing', () => {
    it('extracts project id from trace path', () => {
        expect(getProjectIdFromArtifactPath('traces/org-1/project-123/run-1/test-1.zip')).toBe('project-123');
    });

    it('returns null for unsupported prefixes', () => {
        expect(getProjectIdFromArtifactPath('avatars/user-1/file.png')).toBeNull();
    });
});

describe('artifact source url parsing', () => {
    it('extracts project id from firebase storage token URL', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/test/o/traces%2Forg-1%2Fproject-123%2Frun-1%2Ftest-1.zip?alt=media';
        expect(getProjectIdFromArtifactSource(url)).toBe('project-123');
    });

    it('extracts project id from signed storage url', () => {
        const url = 'https://storage.googleapis.com/bucket-name/traces/org-1/project-123/run-1/test-1.zip?X-Goog-Signature=abc';
        expect(getProjectIdFromArtifactSource(url)).toBe('project-123');
    });

    it('returns null for invalid urls', () => {
        expect(getProjectIdFromArtifactSource('not a url')).toBeNull();
    });
});
