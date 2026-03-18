export function getProjectIdFromArtifactPath(path: string) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    const [prefix, secondSegment, thirdSegment] = segments;
    if (['screenshots', 'videos', 'traces'].includes(prefix)) {
        return thirdSegment || secondSegment || null;
    }

    return null;
}

export function getProjectIdFromArtifactSource(source: string) {
    try {
        const url = new URL(source);

        if (url.pathname.includes('/o/')) {
            const encodedObjectPath = url.pathname.split('/o/')[1];
            const objectPath = decodeURIComponent(encodedObjectPath);
            return getProjectIdFromArtifactPath(objectPath);
        }

        const pathname = url.pathname.replace(/^\/+/, '');
        const parts = pathname.split('/');
        if (parts.length > 1) {
            return getProjectIdFromArtifactPath(parts.slice(1).join('/'));
        }
    } catch {
        return null;
    }

    return null;
}
