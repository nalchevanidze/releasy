import {
  ClusterNode,
  DocNode,
  EmptyNode,
  HeaderNode,
  LinkNode,
  MetaNode,
  Node,
  ItemNode,
  SectionNode,
  StatNode,
  TextNode,
} from "../ast";

export type ChangelogRenderer<T> = {
  doc: (node: DocNode, render: RenderNode<T>) => T;
  section: (node: SectionNode, render: RenderNode<T>) => T;
  cluster: (node: ClusterNode, render: RenderNode<T>) => T;
  item: (node: ItemNode, render: RenderNode<T>) => T;
  meta: (node: MetaNode, render: RenderNode<T>) => T;
  header: (node: HeaderNode, render: RenderNode<T>) => T;
  stat: (node: StatNode, render: RenderNode<T>) => T;
  text: (node: TextNode, render: RenderNode<T>) => T;
  link: (node: LinkNode, render: RenderNode<T>) => T;
  empty: (node: EmptyNode, render: RenderNode<T>) => T;
};

export type RenderNode<T> = (node: Node) => T;

export const renderAst = <T>(root: DocNode, renderer: ChangelogRenderer<T>): T => {
  const render: RenderNode<T> = (node) => {
    switch (node.type) {
      case "doc":
        return renderer.doc(node, render);
      case "section":
        return renderer.section(node, render);
      case "cluster":
        return renderer.cluster(node, render);
      case "item":
        return renderer.item(node, render);
      case "meta":
        return renderer.meta(node, render);
      case "header":
        return renderer.header(node, render);
      case "stat":
        return renderer.stat(node, render);
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
