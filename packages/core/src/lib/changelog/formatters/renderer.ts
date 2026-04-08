import type { ChangelogAstNode } from "../ast";

type NodeByType<K extends ChangelogAstNode["type"]> = Extract<
  ChangelogAstNode,
  { type: K }
>;

export type RenderNode<T> = (node: ChangelogAstNode) => T;

export type ChangelogRenderer<T> = {
  [K in ChangelogAstNode["type"]]: (
    node: NodeByType<K>,
    render: RenderNode<T>,
  ) => T;
};

export const renderAst = <TRoot extends ChangelogAstNode, T>(
  root: TRoot,
  renderer: ChangelogRenderer<T>,
): T => {
  const render: RenderNode<T> = (node) => {
    switch (node.type) {
      case "doc":
        return renderer.doc(node, render);
      case "release":
        return renderer.release(node, render);
      case "change":
        return renderer.change(node, render);
      case "tag":
        return renderer.tag(node, render);
      case "commit":
        return renderer.commit(node, render);
      case "header":
        return renderer.header(node, render);
      case "title":
        return renderer.title(node, render);
      case "metric":
        return renderer.metric(node, render);
      case "date":
        return renderer.date(node, render);
      case "text":
        return renderer.text(node, render);
      case "link":
        return renderer.link(node, render);
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  };

  return render(root);
};
