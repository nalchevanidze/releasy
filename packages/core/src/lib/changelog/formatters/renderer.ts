import {
  ChangelogAuthorNode,
  ChangelogDocNode,
  ChangelogEmptyNode,
  ChangelogGroupNode,
  ChangelogItemNode,
  ChangelogLinkNode,
  ChangelogListNode,
  ChangelogNode,
  ChangelogScopeNode,
  ChangelogSectionNode,
  ChangelogSummaryNode,
  ChangelogTextNode,
} from "../ast";

export type ChangelogRenderer<T> = {
  doc: (node: ChangelogDocNode, render: RenderNode<T>) => T;
  summary: (node: ChangelogSummaryNode, render: RenderNode<T>) => T;
  section: (node: ChangelogSectionNode, render: RenderNode<T>) => T;
  group: (node: ChangelogGroupNode, render: RenderNode<T>) => T;
  list: (node: ChangelogListNode, render: RenderNode<T>) => T;
  item: (node: ChangelogItemNode, render: RenderNode<T>) => T;
  scope: (node: ChangelogScopeNode, render: RenderNode<T>) => T;
  author: (node: ChangelogAuthorNode, render: RenderNode<T>) => T;
  text: (node: ChangelogTextNode, render: RenderNode<T>) => T;
  link: (node: ChangelogLinkNode, render: RenderNode<T>) => T;
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
      case "item":
        return renderer.item(node, render);
      case "scope":
        return renderer.scope(node, render);
      case "author":
        return renderer.author(node, render);
      case "text":
        return renderer.text(node, render);
      case "link":
        return renderer.link(node, render);
      case "empty":
        return renderer.empty(node, render);
    }
  };

  return render(root);
};
