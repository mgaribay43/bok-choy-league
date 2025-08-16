import React, { Suspense } from "react";
import RosterViewer from "../components/RosterViewer";

const Roster = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        </div>
      }
    >
      <RosterViewer />
    </Suspense>
  );
};

export default Roster;