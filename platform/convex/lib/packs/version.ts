export function parseVersion(version: string): [number, number, number] {
  const parts = version.split(".").map(Number)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a)
  const [bMajor, bMinor, bPatch] = parseVersion(b)

  if (aMajor !== bMajor) return aMajor - bMajor
  if (aMinor !== bMinor) return aMinor - bMinor
  return aPatch - bPatch
}

export function isUpgrade(from: string, to: string): boolean {
  return compareVersions(to, from) > 0
}

export function isMajorUpgrade(from: string, to: string): boolean {
  const [fromMajor] = parseVersion(from)
  const [toMajor] = parseVersion(to)
  return toMajor > fromMajor
}

export function isMinorUpgrade(from: string, to: string): boolean {
  const [fromMajor, fromMinor] = parseVersion(from)
  const [toMajor, toMinor] = parseVersion(to)
  return toMajor === fromMajor && toMinor > fromMinor
}

export function formatVersionDiff(from: string, to: string): string {
  if (isMajorUpgrade(from, to)) {
    return "major"
  }
  if (isMinorUpgrade(from, to)) {
    return "minor"
  }
  return "patch"
}
