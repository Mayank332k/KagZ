import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Workspace = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/dashboard/page/new", { replace: true });
  }, [navigate]);

  return null;
};

export default Workspace;

