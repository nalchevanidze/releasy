import {
  ChangelogDocNode,
  ChangelogEmptyNode,
  ChangelogGroupNode,
  ChangelogInternalItemNode,
  ChangelogListNode,
  ChangelogNode,
  ChangelogPrimaryItemNode,
  ChangelogSectionNode,
  ChangelogSummaryNode,
} from "../ast";

export type ChangelogRenderer<T> = {
  doc: (node: ChangelogDocNode, render: RenderNode<T>) => T;
  summary: (node: ChangelogSummaryNode, render: RenderNode<T>) => T;
  section: (node: ChangelogSectionNode, render: RenderNode<T>) => T;
  group: (node: ChangelogGroupNode, render: RenderNode<T>) => T;
  list: (node: ChangelogListNode, render: RenderNode<T>) => T;
  primaryItem: (node: ChangelogPrimaryItemNode, render: RenderNode<T>) => T;
  internalItem: (node: ChangelogInternalItemNode, render: RenderNode<T>) => T;
  empty: (node: ChangelogEmptyNode, render: RenderNode<T>) => T;
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
      case "group":
        return renderer.group(node, render);
      case "list":
        return renderer.list(node, render);
      case "primaryItem":
        return renderer.primaryItem(node, render);
      case "internalItem":
        return renderer.internalItem(node, render);
      case "empty":
        return renderer.empty(node, render);
    }
  };

  return render(root);
};
