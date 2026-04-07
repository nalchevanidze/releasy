import {
  ChangelogDividerNode,
  ChangelogDocumentNode,
  ChangelogEmptyNode,
  ChangelogGroupNode,
  ChangelogHeaderNode,
  ChangelogItemNode,
  ChangelogListNode,
  ChangelogNode,
  ChangelogSectionNode,
  ChangelogSummaryNode,
} from "../ast";

export type ChangelogRenderer<T> = {
  document: (node: ChangelogDocumentNode, render: RenderNode<T>) => T;
  header: (node: ChangelogHeaderNode, render: RenderNode<T>) => T;
  summary: (node: ChangelogSummaryNode, render: RenderNode<T>) => T;
  divider: (node: ChangelogDividerNode, render: RenderNode<T>) => T;
  section: (node: ChangelogSectionNode, render: RenderNode<T>) => T;
  group: (node: ChangelogGroupNode, render: RenderNode<T>) => T;
  list: (node: ChangelogListNode, render: RenderNode<T>) => T;
  item: (node: ChangelogItemNode, render: RenderNode<T>) => T;
  empty: (node: ChangelogEmptyNode, render: RenderNode<T>) => T;
};

export type RenderNode<T> = (node: ChangelogNode) => T;

export const renderAst = <T>(
  root: ChangelogNode,
  renderer: ChangelogRenderer<T>,
): T => {
  const render: RenderNode<T> = (node) => renderer[node.type](node as never, render);
  return render(root);
};
