import { useEffect, useState } from 'react';

/**
 * Tiny hash router. "#/pathfinding" -> "pathfinding", "" or "#/" -> "".
 * A hash (not a path) is used so the built site works on any static host with no rewrite rules.
 */
const read = () => window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];

export default function useHashRoute() {
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
