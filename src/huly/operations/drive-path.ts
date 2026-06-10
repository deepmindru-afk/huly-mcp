export interface NormalizedDrivePath {
  readonly path: string
  readonly segments: ReadonlyArray<string>
}

export const normalizeDrivePath = (input: string): NormalizedDrivePath => {
  const absolute = input.startsWith("/") ? input : `/${input}`
  const segments: Array<string> = []

  for (const rawSegment of absolute.split("/")) {
    if (rawSegment === "" || rawSegment === ".") continue
    if (rawSegment === "..") {
      segments.pop()
      continue
    }
    segments.push(rawSegment)
  }

  return {
    path: segments.length === 0 ? "/" : `/${segments.join("/")}`,
    segments
  }
}

export const parentPathOf = (path: NormalizedDrivePath): NormalizedDrivePath => {
  const parentSegments = path.segments.slice(0, -1)
  return {
    path: parentSegments.length === 0 ? "/" : `/${parentSegments.join("/")}`,
    segments: parentSegments
  }
}

export const childPath = (parentPath: string, title: string): string =>
  parentPath === "/" ? `/${title}` : `${parentPath}/${title}`
