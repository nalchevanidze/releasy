

export type ChangelogNode =
  | ChangelogDocNode
  | ChangelogSummaryNode
  | ChangelogSectionNode
  | ChangelogGroupNode
  | ChangelogListNode
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
  sectionId: string;
  sectionLabel: string;
  sectionIcon?: string;
  overflowHiddenCount?: number;
  children: ChangelogGroupNode[];
};

export type ChangelogGroupNode = {
  type: "group";
  groupKind: "package" | "flat";
  groupLabel?: ChangelogNode[];
  children: ChangelogListNode;
};

export type ChangelogListNode = {
  type: "list";
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

export type ChangelogLinkNode = {
  type: "link";
  label: string;
  url: string;
};

export type ChangelogEmptyNode = {
  type: "empty";
};
