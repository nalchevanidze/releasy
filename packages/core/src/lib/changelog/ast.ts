

export type ChangelogNode =
  | ChangelogDocNode
  | ChangelogSummaryNode
  | ChangelogSectionNode
  | ChangelogClusterNode
  | Header
  | ChangelogItemNode
  | ChangelogSubitemNode
  | ChangelogTextNode
  | ChangelogLinkNode
  | ChangelogEmptyNode;

export type ChangelogDocNode = {
  type: "doc";
  versionLabel: string;
  releaseDate: string;
  compareUrl?: string;
  children: ChangelogNode[];
};

export type ChangelogSummaryNode = {
  type: "summary";
  bump: "major" | "minor" | "patch";
  changeCount: number;
  packageCount: number;
};

export type ChangelogSectionNode = {
  type: "section";
  sectionLabel: string;
  sectionIcon?: string;
  overflowHiddenCount?: number;
  children: ChangelogClusterNode[];
};

export type ChangelogClusterNode = {
  type: "cluster";
  header?: Header;
  children: ChangelogItemNode[];
};

export type ChangeRef = {
  label: string;
  url?: string;
};

export type ChangelogItemNode = {
  type: "item";
  isInternal: boolean;
  ref: ChangeRef;
  title: string;
  children?: ChangelogSubitemNode[];
};

export type ChangelogSubitemNode = {
  type: "subitem";
  icon: string;
  label: string;
  children: ChangelogNode[];
};

export type ChangelogTextNode = {
  type: "text";
  value: string;
};

export type Header = {
  type: "header";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  icon?: string;
  content: string;
};

export type ChangelogLinkNode = {
  type: "link";
  label: string;
  url: string;
};

export type ChangelogEmptyNode = {
  type: "empty";
};
