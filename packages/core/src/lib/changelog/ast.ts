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
  text: string;
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
  prefix: string;
  parts: InlinePart[];
  children: ChangelogItemNode[];
};

export type ChangelogListNode = {
  type: "list";
  children: ChangelogItemNode[];
};

export type ChangelogItemNode = {
  type: "item";
  lines: Array<{ parts: InlinePart[]; indentLevel?: number; trailingBreak?: boolean }>;
};

export type ChangelogEmptyNode = {
  type: "empty";
  text: string;
};
