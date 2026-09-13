import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Folder01Icon,
  BookOpen01Icon,
  AppleReminderIcon,
  DeskIcon,
} from "hugeicons-react";
import { foldersAPI, pagesAPI, workspacesAPI } from "../../services/api";

const getIcon = (type) => {
  if (type === "code" || type === "todo") return AppleReminderIcon;
  return BookOpen01Icon;
};

const TreeNode = ({ node, level, navigate }) => {
  const [isOpen, setIsOpen] = useState(true);

  const isFolder = node.type === "folder";
  const hasChildren = isFolder && node.children && node.children.length > 0;

  const handleToggle = (e) => {
    e.stopPropagation();
    if (isFolder) setIsOpen(!isOpen);
  };

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      navigate(`/dashboard/page/${node._id}`);
    }
  };

  const paddingLeft = level === 0 ? 0 : level * 24;

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        className={`flex items-center w-full py-2.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group select-none`}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        <div
          onClick={handleToggle}
          className="w-5 h-5 flex items-center justify-center mr-1 text-gray-400 hover:text-gray-800 transition-colors"
        >
          {isFolder ? (
            isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : (
            <div className="w-4 h-4" /> // spacing for alignment
          )}
        </div>

        <div className="text-gray-500 mr-2.5">
          {isFolder ? (
            <Folder01Icon
              className={`w-5 h-5 stroke-[1.5] ${isOpen ? "text-blue-500 fill-blue-500/10" : ""}`}
            />
          ) : (
            React.createElement(getIcon(node.pageType), {
              className: "w-4.5 h-4.5 stroke-[1.5]",
            })
          )}
        </div>

        <span
          className={`text-[15px] truncate ${isFolder ? "font-medium text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`}
        >
          {node.name}
        </span>
      </div>

      <AnimatePresence>
        {isFolder && isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode
                key={child._id}
                node={child}
                level={level + 1}
                navigate={navigate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Workspace = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaceData = async () => {
      try {
        // Fetch workspace details
        const wsRes = await workspacesAPI.getAll(); // Using getAll since getById might not exist
        const foundWs = wsRes.data.workspaces?.find(
          (w) => w._id === workspaceId,
        );
        if (foundWs) setWorkspace(foundWs);

        // Fetch folders and pages
        const [foldersRes, pagesRes] = await Promise.all([
          foldersAPI.getByWorkspace(workspaceId),
          pagesAPI.getByWorkspace(workspaceId),
        ]);

        const folders = foldersRes.data.folders || [];
        const pages = pagesRes.data.pages || [];

        // Build tree
        const buildTree = (parentId = null) => {
          const childFolders = folders
            .filter((f) => f.parentId === parentId)
            .map((f) => ({
              ...f,
              type: "folder",
              children: buildTree(f._id),
            }));

          const childPages = pages
            .filter((p) => p.folderId === parentId)
            .map((p) => ({
              ...p,
              type: "page",
              name: p.title,
              pageType: p.type,
            }));

          return [...childFolders, ...childPages].sort((a, b) => {
            // Folders first, then alphabetical
            if (a.type === "folder" && b.type !== "folder") return -1;
            if (a.type !== "folder" && b.type === "folder") return 1;
            return a.name.localeCompare(b.name);
          });
        };

        setTree(buildTree(null));
      } catch (err) {
        console.error("Failed to fetch workspace tree", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [workspaceId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 h-full overflow-y-auto px-8 lg:px-12 py-10 bg-[#FAFAFA] dark:bg-[var(--color-dark-bg)] text-gray-900 dark:text-gray-100 transition-colors"
    >
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-1/3 bg-gray-200 rounded-lg"></div>
            <div className="h-4 w-1/4 bg-gray-200 rounded"></div>
            <div className="mt-8 space-y-3 pt-6 border-t border-gray-200">
              <div className="h-10 w-full bg-gray-200 rounded-lg"></div>
              <div className="h-10 w-full bg-gray-200 rounded-lg"></div>
              <div className="h-10 w-5/6 bg-gray-200 rounded-lg ml-6"></div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-[12px] flex items-center justify-center border border-blue-100">
                <DeskIcon className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-[var(--color-dark-title)]">
                {workspace?.name || "Workspace"}
              </h1>
            </div>

            <p className="text-gray-500 font-medium mb-10 pl-1">
              File structure overview
            </p>

            <div className="bg-white dark:bg-[var(--color-dark-surface)] border border-gray-200 dark:border-[var(--color-dark-border)] rounded-2xl p-4 shadow-sm min-h-[400px]">
              {tree.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <Folder01Icon className="w-12 h-12 stroke-[1.5] mb-3 text-gray-300" />
                  <p className="font-medium text-gray-600">
                    This workspace is empty
                  </p>
                  <p className="text-sm mt-1">
                    Add pages from the sidebar to see them here.
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {tree.map((node) => (
                    <TreeNode
                      key={node._id}
                      node={node}
                      level={0}
                      navigate={navigate}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default Workspace;
