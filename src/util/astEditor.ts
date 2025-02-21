import type {
  ASTNode, EmojiNode, LinkNode, TextNode,
} from './parseHtmlAsAST';
import { ApiMessageEntityTypes } from '../api/types';

import { NodeType } from './parseHtmlAsAST';

export enum ASTStyles {
  Bold = ApiMessageEntityTypes.Bold,
  Italic = ApiMessageEntityTypes.Italic,
  Underline = ApiMessageEntityTypes.Underline,
  Strike = ApiMessageEntityTypes.Strike,
  Code = ApiMessageEntityTypes.Code,
  Spoiler = ApiMessageEntityTypes.Spoiler,
  Blockquote = ApiMessageEntityTypes.Blockquote,
  TextUrl = ApiMessageEntityTypes.TextUrl,
}

export interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
  quote?: boolean;
  textlinkhref?: string;
}

export function getAstStylesForSelection(ast: ASTNode[], offset: number, length: number): ISelectedTextFormats {
  const resultSet = new Set<ASTStyles>();
  const end = offset + length;
  let totalLength = 0;
  let firstHref;
  const stack: { node: ASTNode; styles: ASTStyles[]; href?: string }[] = [];

  for (let i = ast.length - 1; i >= 0; i--) {
    stack.push({ node: ast[i], styles: [] });
  }

  while (stack.length > 0) {
    const { node, styles, href } = stack.pop()!;

    if (node.type === NodeType.Text) {
      const textNode = node as TextNode;
      const nodeStart = totalLength;
      const nodeEnd = totalLength + textNode.content.length;
      totalLength = nodeEnd;

      if (nodeStart < end && nodeEnd > offset) {
        styles.forEach((style) => resultSet.add(style));

        if (href && !firstHref) {
          firstHref = href;
        }
      }

      if (nodeStart >= end) {
        break;
      }
    } else if (node.type === NodeType.Emoji || node.type === NodeType.CustomEmoji) {
      totalLength += (node as EmojiNode).content.length;
    } else {
      const nodeStyle = getNodeStyleFromType(node.type);
      const childStyles = nodeStyle ? [...styles, nodeStyle] : [...styles];

      if (node.children) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push({
            node: node.children[i],
            styles: childStyles,
            href: href || (node as LinkNode).url,
          });
        }
      }
    }
  }

  const selectedTextFormats: ISelectedTextFormats = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    monospace: false,
    spoiler: false,
    textlinkhref: firstHref,
  };

  Array.from(resultSet).forEach((item) => {
    switch (item) {
      case ASTStyles.Spoiler: {
        selectedTextFormats.spoiler = true;
        break;
      }
      case ASTStyles.Bold: {
        selectedTextFormats.bold = true;
        break;
      }
      case ASTStyles.Italic: {
        selectedTextFormats.italic = true;
        break;
      }
      case ASTStyles.Underline: {
        selectedTextFormats.underline = true;
        break;
      }
      case ASTStyles.Strike: {
        selectedTextFormats.strikethrough = true;
        break;
      }
      case ASTStyles.Code: {
        selectedTextFormats.monospace = true;
        break;
      }
      case ASTStyles.Blockquote: {
        selectedTextFormats.quote = true;
        break;
      }
    }
  });
  return selectedTextFormats;
}

function calcNodeLength(ast: ASTNode[]) {
  let totalLength = 0;
  const stack: ASTNode[] = [];

  for (let i = ast.length - 1; i >= 0; i--) {
    stack.push(ast[i]);
  }

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === NodeType.Text) {
      totalLength += (node as TextNode).content.length;
    }
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  return totalLength;
}

function removeStyle(ast: ASTNode[], offset: number, length: number, nodeType: NodeType): ASTNode[] {
  const end = offset + length;
  let totalLength = 0;
  const stack: { node: ASTNode; parent: ASTNode[] }[] = [];

  const stylesToRemove: { start: number; end: number; nodeLength: number; parent: ASTNode[]; node: ASTNode }[] = [];
  let hrefs = [];
  for (let i = ast.length - 1; i >= 0; i--) {
    stack.push({ node: ast[i], parent: ast });
  }

  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;

    if (node.type === NodeType.Text || node.type === NodeType.Emoji || node.type === NodeType.CustomEmoji) {
      totalLength += (node as TextNode).content.length;

      if (totalLength >= end) {
        break;
      }
    }

    if (node.type === nodeType) {
      if (nodeType === NodeType.TextUrl) {
        hrefs.push((node as LinkNode).url);
      }
      const nodeLength = calcNodeLength(node.children!);
      const nodeStart = totalLength;
      totalLength += nodeLength;

      if (nodeStart < end && totalLength > offset) {
        stylesToRemove.push({
          parent,
          node,
          nodeLength,
          start: Math.max(nodeStart, offset) - nodeStart,
          end: Math.min(end, totalLength) - nodeStart,
        });
      }
    } else if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], parent: node.children });
      }
    }
  }
  hrefs = hrefs.reverse();
  stylesToRemove.forEach((styleToRemove) => {
    const {
      parent, node, start: startI, end: endI, nodeLength,
    } = styleToRemove;

    const pos = parent.indexOf(node);
    let updatedChilds: ASTNode[] = parent[pos].children!;

    if (startI > 0) {
      if (nodeType === NodeType.TextUrl) {
        const href = hrefs.pop();
        updatedChilds = applyStyles(updatedChilds, 0, startI, nodeType, href || '');
      } else {
        updatedChilds = applyStyles(updatedChilds, 0, startI, nodeType);
      }
    }

    if (endI < nodeLength) {
      if (nodeType === NodeType.TextUrl) {
        const href = hrefs.pop();
        updatedChilds = applyStyles(updatedChilds, endI, nodeLength - endI, nodeType, href || '');
      } else {
        updatedChilds = applyStyles(updatedChilds, endI, nodeLength - endI, nodeType);
      }
    }
    parent.splice(pos, 1, ...updatedChilds);
  });
  return ast;
}

export function applyStylesToAst(
  ast: ASTNode[],
  offset: number,
  length: number,
  style: ASTStyles,
  remove: boolean,
  href?: string,
): ASTNode[] {
  const nodeType = getNodeTypeFromStyle(style);
  if (!nodeType) return ast;

  if (remove) {
    return removeStyle(ast, offset, length, nodeType);
  }
  return applyStyles(ast, offset, length, nodeType, href);
}

function applyStyles(ast: ASTNode[], offset: number, length: number, nodeType: NodeType, href?: string): ASTNode[] {
  if (
    nodeType === NodeType.Spoiler
    || nodeType === NodeType.TextUrl
  ) {
    return deepApplyStyles(ast, offset, length, nodeType, href);
  }
  const end = offset + length;
  let totalLength = 0;
  const stack: { node: ASTNode; parent: ASTNode[] }[] = [];

  const nodesToStyle: { start: number; end: number; nodeLength: number; parent: ASTNode[]; node: TextNode }[] = [];

  for (let i = ast.length - 1; i >= 0; i--) {
    stack.push({ node: ast[i], parent: ast });
  }

  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;

    if (node.type === NodeType.Text) {
      const nodeContent = (node as TextNode).content;
      const nodeStart = totalLength;
      totalLength += nodeContent.length;
      if (nodeStart < end && totalLength > offset) {
        nodesToStyle.push({
          parent,
          node,
          nodeLength: nodeContent.length,
          start: Math.max(nodeStart, offset) - nodeStart,
          end: Math.min(end, totalLength) - nodeStart,
        });
      }
      if (totalLength >= end) {
        break;
      }
    } else if (node.type === NodeType.Emoji || node.type === NodeType.CustomEmoji) {
      totalLength += (node as EmojiNode).content.length;
    } else if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], parent: node.children });
      }
    }
  }
  nodesToStyle.forEach((nodeInfo) => {
    const {
      parent, node, start: startI, end: endI, nodeLength,
    } = nodeInfo;

    const pos = parent.indexOf(node);
    const updatedChilds: ASTNode[] = [];

    const part1 = node.content.slice(0, startI);
    const part2 = node.content.slice(startI, endI);
    const part3 = node.content.slice(endI, nodeLength);

    const getTextNode = (text: string): ASTNode => ({ type: NodeType.Text, content: text });

    if (part1.length) {
      updatedChilds.push(getTextNode(part1));
    }

    updatedChilds.push({ type: nodeType, children: [getTextNode(part2)] } as ASTNode);

    if (part3.length) {
      updatedChilds.push(getTextNode(part3));
    }
    parent.splice(pos, 1, ...updatedChilds);
  });
  return ast;
}

function deepApplyStyles(ast: ASTNode[], offset: number, length: number, nodeType: NodeType, href?: string): ASTNode[] {
  const end = offset + length;
  const result: ASTNode[] = [];
  const parts = splitTree(ast, [offset, end]);

  const pushStyledPart = (part: ASTNode[]) => {
    switch (nodeType) {
      case NodeType.Spoiler: {
        result.push({ type: NodeType.Spoiler, children: removeStyle(part, 0, end - offset, NodeType.Spoiler) });
        break;
      }
      case NodeType.TextUrl: {
        result.push({
          type: NodeType.TextUrl,
          children: removeStyle(part, 0, end - offset, NodeType.TextUrl),
          url: href || '',
        });
        break;
      }
    }
  };

  if (parts.length === 3) {
    result.push(...parts[0]);
    pushStyledPart(parts[1]);
    result.push(...parts[2]);
  } else if (parts.length === 2) {
    if (offset === 0) {
      pushStyledPart(parts[0]);
      result.push(...parts[1]);
    } else {
      result.push(...parts[0]);
      pushStyledPart(parts[1]);
    }
  } else {
    pushStyledPart(parts[0]);
  }
  return result;
}

function splitTree(tree: ASTNode[], splitIndexes: number[]): ASTNode[][] {
  function getTextLength(node: ASTNode): number {
    if (node.type === NodeType.Text) {
      return (node as TextNode).content.length;
    }
    if (node.type === NodeType.CustomEmoji || node.type === NodeType.Emoji) {
      return 2;
    }
    if (node.type === NodeType.Code || node.type === NodeType.Pre) {
      return node.content.length;
    }
    if (node.children) {
      return node.children.reduce((sum, child) => sum + getTextLength(child), 0);
    }
    return 0;
  }

  function cloneNode<T extends ASTNode>(node: T): T {
    return JSON.parse(JSON.stringify(node));
  }

  function getTreeBetweenIndexes(
    nodes: ASTNode[],
    startIndex: number,
    endIndex: number,
    currentIndex = 0,
  ): ASTNode[] {
    const result: ASTNode[] = [];
    let runningIndex = currentIndex;

    for (const node of nodes) {
      const nodeLength = getTextLength(node);
      const nodeEndIndex = runningIndex + nodeLength;

      if (nodeEndIndex <= startIndex) {
        runningIndex = nodeEndIndex;
        continue;
      }

      if (runningIndex >= endIndex) {
        break;
      }

      if (node.type === NodeType.Text) {
        const textNode = node as TextNode;
        const startCut = Math.max(0, startIndex - runningIndex);
        const endCut = Math.min(textNode.content.length, endIndex - runningIndex);

        const newNode = cloneNode(textNode);
        newNode.content = textNode.content.slice(startCut, endCut);
        result.push(newNode);
      } else if (node.type === NodeType.Code || node.type === NodeType.Pre) {
        const codeNode = cloneNode(node);
        const startCut = Math.max(0, startIndex - runningIndex);
        const endCut = Math.min(node.content.length, endIndex - runningIndex);
        codeNode.content = node.content.slice(startCut, endCut);
        result.push(codeNode);
      } else if (node.type === NodeType.CustomEmoji || node.type === NodeType.Emoji) {
        if (startIndex <= runningIndex && endIndex > runningIndex) {
          result.push(cloneNode(node));
        }
      } else if (node.children) {
        const children = getTreeBetweenIndexes(
          node.children,
          startIndex,
          endIndex,
          runningIndex,
        );
        if (children.length > 0) {
          const newNode = cloneNode(node);
          newNode.children = children;
          result.push(newNode);
        }
      } else if (startIndex <= runningIndex && endIndex > runningIndex) {
        result.push(cloneNode(node));
      }

      runningIndex = nodeEndIndex;
    }

    return result;
  }

  const uniqueSplits = [...new Set(splitIndexes)].sort((a, b) => a - b);
  const totalLength = tree.reduce((sum, node) => sum + getTextLength(node), 0);

  const allSplits = [0, ...uniqueSplits, totalLength];

  const result: ASTNode[][] = [];

  for (let i = 0; i < allSplits.length - 1; i++) {
    const startIndex = allSplits[i];
    const endIndex = allSplits[i + 1];

    const treePart = getTreeBetweenIndexes(tree, startIndex, endIndex);
    if (treePart.length > 0) {
      result.push(treePart);
    }
  }

  return result;
}

function getNodeTypeFromStyle(style: ASTStyles): NodeType | null {
  switch (style) {
    case ASTStyles.Bold:
      return NodeType.Bold;
    case ASTStyles.Italic:
      return NodeType.Italic;
    case ASTStyles.Underline:
      return NodeType.Underline;
    case ASTStyles.Strike:
      return NodeType.Strike;
    case ASTStyles.Spoiler:
      return NodeType.Spoiler;
    case ASTStyles.TextUrl:
      return NodeType.TextUrl;
    case ASTStyles.Code:
      return NodeType.Code;
    case ASTStyles.Blockquote:
      return NodeType.Blockquote;
    default:
      // eslint-disable-next-line no-null/no-null
      return null;
  }
}

function getNodeStyleFromType(nodeType: NodeType): ASTStyles | null {
  switch (nodeType) {
    case NodeType.Bold:
      return ASTStyles.Bold;
    case NodeType.Italic:
      return ASTStyles.Italic;
    case NodeType.Underline:
      return ASTStyles.Underline;
    case NodeType.Strike:
      return ASTStyles.Strike;
    case NodeType.Spoiler:
      return ASTStyles.Spoiler;
    case NodeType.TextUrl:
      return ASTStyles.TextUrl;
    case NodeType.Code:
      return ASTStyles.Code;
    case NodeType.Blockquote:
      return ASTStyles.Blockquote;
    default:
      // eslint-disable-next-line no-null/no-null
      return null;
  }
}
