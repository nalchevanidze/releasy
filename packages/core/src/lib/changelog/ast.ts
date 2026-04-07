export type Node =
  | DocNode
  | SectionNode
  | ClusterNode
  | PrimaryItemNode
  | InternalItemNode
  | MetaItemNode
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

export type ClusterNode = {
  type: "cluster";
  header?: HeaderNode;
  childrenStyle?: "plain" | "tree" | "bullet";
  children: Array<PrimaryItemNode | InternalItemNode>;
};

export type PrimaryItemNode = {
  type: "primaryItem";
  refLabel: string;
  refUrl?: string;
  title: string;
  children?: MetaItemNode[];
};

export type InternalItemNode = {
  type: "internalItem";
  tabel: LinkNode | TextNode;
  value: string;
};

export type MetaItemNode = {
  type: "metaItem";
  icon: string;
  label: string;
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
