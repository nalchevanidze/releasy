import { Change } from "./types";

export type ChangelogNode =
  | ChangelogDocumentNode
  | ChangelogHeaderNode
  | ChangelogSummaryNode
  | ChangelogDividerNode
  | ChangelogSectionNode
  | ChangelogGroupNode
  | ChangelogChangeNode
  | ChangelogRefinementsNode
  | ChangelogEmptyNode;

export type ChangelogDocumentNode = {
  type: "document";
  children: ChangelogNode[];
};

export type ChangelogHeaderNode = {
  type: "header";
  version: string;
  previousTag?: string;
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
  changeType: string;
  label: string;
  children: Array<ChangelogGroupNode | ChangelogChangeNode>;
};

export type ChangelogGroupNode = {
  type: "group";
  key: string;
  title: string;
  children: ChangelogChangeNode[];
};

export type ChangelogChangeNode = {
  type: "change";
  variant: "primary" | "refinement-commit" | "refinement-link";
  change: Change;
};

export type ChangelogRefinementsNode = {
  type: "refinements";
  includeDivider: boolean;
  hiddenCount: number;
  children: ChangelogChangeNode[];
};

export type ChangelogEmptyNode = {
  type: "empty";
  message: string;
};
