export type ChangelogAstNode =
  | ChangelogDocumentNode
  | ReleaseNode
  | ChangeNode
  | ChangeTagNode
  | CommitNode
  | HeaderNode
  | TitleNode
  | ReleaseMetricNode
  | DateNode
  | TextNode
  | LinkNode;

export type ChangelogDocumentNode = {
  type: "doc";
  releases: ReleaseNode[];
};

export type ReleaseNode = {
  type: "release";
  headers: (LinkNode | TextNode | DateNode)[];
  metrics?: ReleaseMetricNode[];
  children: Array<ChangeNode | TextNode>;
};

export type ChangeNode = {
  type: "change";
  level: 0 | 1;
  header?: HeaderNode | TitleNode;
  children: Array<ChangeNode | ChangeTagNode>;
  commits?: CommitNode[];
};

export type ChangeTagNode = {
  type: "tag";
  kind: "author" | "scope";
  children: Array<TextNode | LinkNode>;
};

export type CommitNode = {
  type: "commit";
  ref?: LinkNode;
  title: string;
};

export type HeaderNode = {
  type: "header";
  icon?: string;
  children: Array<TextNode | LinkNode>;
};

export type TitleNode = {
  type: "title";
  main: TextNode | LinkNode;
  rest?: Array<TextNode | LinkNode>;
};

export type ReleaseMetricNode = {
  type: "metric";
  name: "bump" | "changes" | "packages";
  value: string;
};

export type TextStyle = "plain" | "literal" | "strong";

export type TextNode = {
  type: "text";
  value: string;
  style?: TextStyle;
};

export type LinkNode = {
  type: "link";
  label: string;
  url: string;
};

export type DateNode = {
  type: "date";
  date: Date;
};
