import {
  ChangelogBlock,
  ChangelogDocNode,
  ChangelogEmptyBlock,
  ChangelogGroupNode,
  ChangelogInternalChangeNode,
  ChangelogItemNode,
  ChangelogListBlock,
  ChangelogNode,
  ChangelogPrimaryChangeNode,
  ChangelogSectionBlock,
  ChangelogSummaryBlock,
} from "../ast";

export type ChangelogRenderer<T> = {
  doc: (node: ChangelogDocNode, render: RenderNode<T>) => T;
  summary: (node: ChangelogSummaryBlock, render: RenderNode<T>) => T;
  section: (node: ChangelogSectionBlock, render: RenderNode<T>) => T;
  list: (node: ChangelogListBlock, render: RenderNode<T>) => T;
  group: (node: ChangelogGroupNode, render: RenderNode<T>) => T;
  primaryChange: (node: ChangelogPrimaryChangeNode, render: RenderNode<T>) => T;
  internalChange: (node: ChangelogInternalChangeNode, render: RenderNode<T>) => T;
  empty: (node: ChangelogEmptyBlock, render: RenderNode<T>) => T;
};

export type RenderNode<T> = (node: ChangelogNode) => T;

export const renderAst = <T>(
  root: ChangelogDocNode,
  renderer: ChangelogRenderer<T>,
): T => {
  const render: RenderNode<T> = (node) => {
    switch (node.type) {
      case "doc":
        return renderer.doc(node, render);
      case "summary":
        return renderer.summary(node, render);
      case "section":
        return renderer.section(node, render);
      case "list":
        return renderer.list(node, render);
      case "group":
        return renderer.group(node, render);
      case "primaryChange":
        return renderer.primaryChange(node, render);
      case "internalChange":
        return renderer.internalChange(node, render);
      case "empty":
        return renderer.empty(node, render);
    }
  };

  return render(root);
};

export const isSummaryBlock = (
  block: ChangelogBlock,
): block is ChangelogSummaryBlock => block.type === "summary";
