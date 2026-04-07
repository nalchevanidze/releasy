export type InlinePart =
  | { type: "text"; value: string }
  | { type: "link"; label: string; url: string };

export type ChangeRef = {
  label: string;
  url?: string;
};

export type ChangelogNode =
  | ChangelogDocNode
  | ChangelogSummaryNode
  | ChangelogSectionNode
  | ChangelogGroupNode
  | ChangelogListNode
  | ChangelogPrimaryItemNode
  | ChangelogInternalItemNode
  | ChangelogEmptyNode;

export type ChangelogDocNode = {
  type: "doc";
  versionLabel: string;
  releaseDate: string;
  compareUrl?: string;
  children: Array<
    ChangelogSummaryNode | ChangelogSectionNode | ChangelogListNode | ChangelogEmptyNode
  >;
};

export type ChangelogSummaryNode = {
  type: "summary";
  bump: "major" | "minor" | "patch";
  changeCount: number;
  packageCount: number;
};

export type ChangelogSectionNode = {
  type: "section";
  sectionId: string;
  sectionLabel: string;
  sectionIcon?: string;
  overflowHiddenCount?: number;
  children: ChangelogGroupNode[];
};

export type ChangelogGroupNode = {
  type: "group";
  groupKind: "package" | "flat";
  groupLabel?: InlinePart[];
  children: ChangelogListNode;
};

export type ChangelogListNode = {
  type: "list";
  children: Array<ChangelogPrimaryItemNode | ChangelogInternalItemNode>;
};

export type ChangelogPrimaryItemNode = {
  type: "primaryItem";
  ref: ChangeRef;
  title: string;
  scope: string[];
  author: InlinePart[];
};

export type ChangelogInternalItemNode = {
  type: "internalItem";
  ref: ChangeRef;
  title: string;
};

export type ChangelogEmptyNode = {
  type: "empty";
  reason: "no-user-facing-changes";
};
