export type InlinePart =
  | { type: "text"; value: string }
  | { type: "link"; label: string; url: string };

export type ChangeRef = {
  label: string;
  url?: string;
};

export type ChangelogNode =
  | ChangelogDocNode
  | ChangelogSummaryBlock
  | ChangelogSectionBlock
  | ChangelogListBlock
  | ChangelogGroupNode
  | ChangelogPrimaryChangeNode
  | ChangelogInternalChangeNode
  | ChangelogEmptyBlock;

export type ChangelogDocNode = {
  type: "doc";
  meta: {
    versionLabel: string;
    releaseDate: string;
    compareUrl?: string;
  };
  blocks: ChangelogBlock[];
};

export type ChangelogBlock =
  | ChangelogSummaryBlock
  | ChangelogSectionBlock
  | ChangelogListBlock
  | ChangelogEmptyBlock;

export type ChangelogSummaryBlock = {
  type: "summary";
  bump: "major" | "minor" | "patch";
  changeCount: number;
  packageCount: number;
};

export type ChangelogSectionBlock = {
  type: "section";
  id: string;
  label: string;
  icon?: string;
  groups: ChangelogGroupNode[];
  overflowHiddenCount?: number;
};

export type ChangelogListBlock = {
  type: "list";
  items: ChangelogItemNode[];
};

export type ChangelogGroupNode = {
  type: "group";
  kind: "package" | "flat";
  label?: InlinePart[];
  items: ChangelogItemNode[];
};

export type ChangelogPrimaryChangeNode = {
  type: "primaryChange";
  ref: ChangeRef;
  title: string;
  scope: string[];
  author: InlinePart[];
};

export type ChangelogInternalChangeNode = {
  type: "internalChange";
  url?: string;
  title: string;
};

export type ChangelogItemNode =
  | ChangelogPrimaryChangeNode
  | ChangelogInternalChangeNode;

export type ChangelogEmptyBlock = {
  type: "empty";
  reason: "no-user-facing-changes";
};
