export type InlinePart =
  | { type: "text"; value: string }
  | { type: "link"; label: string; url: string };

export type ChangelogNode =
  | ChangelogDocumentNode
  | ChangelogHeaderNode
  | ChangelogSummaryNode
  | ChangelogDividerNode
  | ChangelogSectionNode
  | ChangelogGroupNode
  | ChangelogListNode
  | ChangelogItemNode
  | ChangelogEmptyNode;

export type ChangelogDocumentNode = {
  type: "document";
  children: ChangelogNode[];
};

export type ChangelogHeaderNode = {
  type: "header";
  versionLabel: string;
  compareUrl?: string;
  releaseDate: string;
};

export type ChangelogSummaryNode = {
  type: "summary";
  bump: "major" | "minor" | "patch";
  changeCount: number;
  packageCount: number;
};

export type ChangelogDividerNode = {
  type: "divider";
};

export type ChangelogSectionNode = {
  type: "section";
  heading: {
    icon?: string;
    label: string;
  };
  overflowCount?: number;
  children: Array<ChangelogGroupNode | ChangelogListNode | ChangelogItemNode>;
};

export type ChangelogGroupNode = {
  type: "group";
  labelParts: InlinePart[];
  children: ChangelogItemNode[];
};

export type ChangelogListNode = {
  type: "list";
  children: ChangelogItemNode[];
};

export type PrimaryItemNode = {
  type: "item";
  kind: "primary";
  ref: string;
  title: string;
  scope: string[];
  author: InlinePart[];
};

export type InternalItemNode = {
  type: "item";
  kind: "internal";
  url: string;
  title: string;
};

export type ChangelogItemNode = PrimaryItemNode | InternalItemNode;

export type ChangelogEmptyNode = {
  type: "empty";
  message: string;
};
