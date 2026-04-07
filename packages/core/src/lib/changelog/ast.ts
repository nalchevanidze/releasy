export type Node =
  | DocNode
  | SectionNode
  | ClusterNode
  | ItemNode
  | MetaNode
  | HeaderNode
  | StatNode
  | TextNode
  | LinkNode
  | EmptyNode;

export type DocNode = {
  type: "doc";
  version: string;
  date: string;
  compareUrl?: string;
  stats?: StatNode[];
  children: Array<SectionNode | EmptyNode>;
};

export type SectionNode = {
  type: "section";
  header?: HeaderNode;
  overflowHiddenCount?: number;
  children: ClusterNode[];
};

export type ItemStyle = "plain" | "tree" | "bullet";

export type ClusterNode = {
  type: "cluster";
  header?: HeaderNode;
  itemsStyle?: ItemStyle;
  children: Array<ItemNode | MetaNode>;
};

export type ItemNode = {
  type: "item";
  refLabel: string;
  title: string;
  meta?: MetaNode[];
};

export type MetaNode = {
  type: "meta";
  kind: "commit" | "author" | "scope";
  children: Array<TextNode | LinkNode>;
};

export type HeaderNode = {
  type: "header";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  icon?: string;
  children: Array<TextNode | LinkNode>;
};

export type StatNode = {
  type: "stat";
  name: "bump" | "changes" | "packages";
  value: string;
};

export type TextNode = {
  type: "text";
  value: string;
};

export type LinkNode = {
  type: "link";
  label: string;
  url: string;
};

export type EmptyNode = {
  type: "empty";
};
