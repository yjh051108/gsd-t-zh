// Planted noImplicitAny regression — warm-cache tsc (stale .tsbuildinfo) skips this file
// CI cold build catches it; this is the SC2 failure class from TimeTracking v1.10.12.
function greet(name) {
  return 'Hello, ' + name;
}

export { greet };
