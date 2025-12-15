// src/components/QuiverDAOBreadcrumb.jsx
import React from "react";
import { useLocation, Link, useParams } from "react-router-dom";

const QuiverDAOBreadcrumb = () => {
  const location = useLocation();
  const { proposalsID } = useParams(); // Capture the dynamic proposal ID

  // Path-to-label mapping object
  const breadcrumbLabels = {
    proposals: "Proposals List",
    browse: "Browse Products",
    market: "Market Details",
    docs: "Documentation",
  };

  // Split the path into segments
  const pathSegments = location.pathname
    .split("/")
    .filter((segment) => segment);

  return (
    <nav className="flex items-center space-x-2 text-sm font-medium text-gray-400">
      {pathSegments.map((segment, index) => {
        const isLast = index === pathSegments.length - 1;
        const path = `/${pathSegments.slice(0, index + 1).join("/")}`;

        // Use the mapped label, or fallback to default segment text
        const label = breadcrumbLabels[segment] || segment.replace(/-/g, " ");

        return isLast ? (
          <span key={index} className="text-white">
            {label}
          </span>
        ) : (
          <Link key={index} to={path} className="hover:underline">
            {label}
            <span className="mx-2">/</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default QuiverDAOBreadcrumb;
