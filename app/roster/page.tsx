import React, { Suspense } from "react";
import RosterViewer from "../components/RosterViewer";

const Roster = () => {
  return (
    <Suspense fallback={<p>Loading roster...</p>}>
      <RosterViewer />
    </Suspense>
  );
};

export default Roster;