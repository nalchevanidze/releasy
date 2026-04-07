import {
  ChangelogDocNode,
  ChangelogEmptyNode,
  ChangelogClusterNode,
  ChangelogItemNode,
  ChangelogLinkNode,
  ChangelogNode,
  ChangelogSectionNode,
  ChangelogSubitemNode,
  ChangelogSummaryNode,
  ChangelogTextNode,
  Header,
} from "../ast";

export type ChangelogRenderer<T> = {
  doc: (node: ChangelogDocNode, render: RenderNode<T>) => T;
  summary: (node: ChangelogSummaryNode, render: RenderNode<T>) => T;
  section: (node: ChangelogSectionNode, render: RenderNode<T>) => T;
  cluster: (node: ChangelogClusterNode, render: RenderNode<T>) => T;
  header: (node: Header, render: RenderNode<T>) => T;
  item: (node: ChangelogItemNode, render: RenderNode<T>) => T;
  subitem: (node: ChangelogSubitemNode, render: RenderNode<T>) => T;
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
      case "cluster":
        return renderer.cluster(node, render);
      case "header":
        return renderer.header(node, render);
      case "item":
        return renderer.item(node, render);
      case "subitem":
        return renderer.subitem(node, render);
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
