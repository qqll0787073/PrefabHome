import { lazy, Suspense, useEffect, useState } from "react";
import { LoadingState } from "../components/common/LoadingState";
import {
  readApplicationLocation,
  type ApplicationLocation,
} from "../lib/publicSite";

const PublicWebsite = lazy(() => import("../features/public/PublicWebsite").then((module) => ({
  default: module.PublicWebsite,
})));

const PortalApplication = lazy(() => import("./PortalApplication").then((module) => ({
  default: module.PortalApplication,
})));

function currentApplicationLocation(): ApplicationLocation {
  return readApplicationLocation(window.location.pathname, window.location.search);
}

function App() {
  const [location, setLocation] = useState<ApplicationLocation>(currentApplicationLocation);

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setLocation(currentApplicationLocation());
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    function restoreLocation() {
      setLocation(currentApplicationLocation());
    }
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, []);

  if (location.kind === "portal") {
    return (
      <Suspense fallback={<main id="portal-content" className="route-loading"><LoadingState message="Loading marketplace..." /></main>}>
        <PortalApplication onPublicHome={() => navigate("/")} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<main id="public-content" className="route-loading"><LoadingState message="Loading public page..." /></main>}>
      <PublicWebsite page={location.page} onNavigate={navigate} />
    </Suspense>
  );
}

export default App;
