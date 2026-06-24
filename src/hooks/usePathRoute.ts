import {useEffect, useState} from 'react';

function normalizePathRoute(pathname: string) {
  return pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;
}

export function usePathRoute() {
  const [route, setRoute] = useState(() =>
    normalizePathRoute(window.location.pathname),
  );

  useEffect(() => {
    const handleRouteChange = () => {
      setRoute(normalizePathRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  return route;
}
