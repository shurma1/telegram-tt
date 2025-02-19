import type {
  ApiFormattedText, ApiMessageEntity,
  ApiMessageEntityCustomEmoji,
  ApiMessageEntityPre,
  ApiMessageEntityTextUrl,
} from '../api/types';
import type {
  ASTNode,
  CodeNode,
  CustomEmojiNode,
  EmojiNode,
  FormattedNode,
  LinkNode,
  PreNode,
  TextNode,
} from './parseHtmlAsAST';
import {
  ApiMessageEntityTypes,
} from '../api/types';

import {
  NodeType,
} from './parseHtmlAsAST';

interface TextSegment {
  start: number;
  end: number;
  activeEntities: ApiMessageEntity[];
}

export function formatTextToAST(formattedText?: ApiFormattedText): ASTNode[] {
  if (!formattedText) return [];
  const { text, entities = [] } = formattedText;

  const breakPoints: Set<number> = new Set();
  breakPoints.add(0);
  breakPoints.add(text.length);
  for (const ent of entities) {
    breakPoints.add(ent.offset);
    breakPoints.add(ent.offset + ent.length);
  }
  const sortedPoints = Array.from(breakPoints).sort((a, b) => a - b);

  const segments: TextSegment[] = [];
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i];
    const segEnd = sortedPoints[i + 1];
    const active = entities.filter((ent) => ent.offset <= segStart && (ent.offset + ent.length) >= segEnd);
    segments.push({ start: segStart, end: segEnd, activeEntities: active });
  }

  function buildNodeForSegment(segment: TextSegment): ASTNode[] {
    const segText = text.slice(segment.start, segment.end);
    if (segment.activeEntities.length === 0) {
      return splitTextByEmoji(segText);
    } else {
      const sortedActive = [...segment.activeEntities].sort((a, b) => b.length - a.length);
      const outer = sortedActive[0];

      const innerStart = Math.max(segment.start, outer.offset);
      const innerEnd = Math.min(segment.end, outer.offset + outer.length);
      const innerSegment: TextSegment = {
        start: innerStart,
        end: innerEnd,
        activeEntities: segment.activeEntities.filter((ent) => ent !== outer),
      };
      const innerNodes = buildNodeForSegment(innerSegment);
      if (outer.type === ApiMessageEntityTypes.CustomEmoji) {
        return [{
          type: NodeType.CustomEmoji,
          documentId: (outer as ApiMessageEntityCustomEmoji).documentId,
          content: text.slice(outer.offset, outer.offset + outer.length),
        } as CustomEmojiNode];
      } else {
        let node: ASTNode;
        switch (outer.type) {
          case ApiMessageEntityTypes.Code:
            node = { type: NodeType.Code, content: text.slice(outer.offset, outer.offset + outer.length) } as CodeNode;
            break;
          case ApiMessageEntityTypes.Pre:
            node = {
              type: NodeType.Pre,
              content: text.slice(outer.offset, outer.offset + outer.length),
              language: (outer as ApiMessageEntityPre).language,
            } as PreNode;
            break;
          case ApiMessageEntityTypes.TextUrl:
            node = {
              type: NodeType.TextUrl,
              children: innerNodes.length > 0
                ? innerNodes
                : splitTextByEmoji(text.slice(outer.offset, outer.offset + outer.length)),
              url: (outer as ApiMessageEntityTextUrl).url,
            } as LinkNode;
            break;
          case ApiMessageEntityTypes.Bold:
          case ApiMessageEntityTypes.Italic:
          case ApiMessageEntityTypes.Underline:
          case ApiMessageEntityTypes.Strike:
          case ApiMessageEntityTypes.Blockquote:
          case ApiMessageEntityTypes.Spoiler:
            node = {
              type: outer.type,
              children: innerNodes.length > 0
                ? innerNodes
                : splitTextByEmoji(text.slice(outer.offset, outer.offset + outer.length)),
            } as FormattedNode;
            break;
          default:
            node = { type: NodeType.Text, content: text.slice(outer.offset, outer.offset + outer.length) } as TextNode;
        }
        return [node];
      }
    }
  }

  function splitTextByEmoji(input: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const emojiRegex = /\p{Emoji_Presentation}/gu;
    let last = 0;
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign,no-null/no-null
    while ((match = emojiRegex.exec(input)) !== null) {
      if (match.index > last) {
        nodes.push({ type: NodeType.Text, content: input.slice(last, match.index) } as TextNode);
      }
      nodes.push({ type: NodeType.Emoji, content: match[0] } as EmojiNode);
      last = match.index + match[0].length;
    }
    if (last < input.length) {
      nodes.push({ type: NodeType.Text, content: input.slice(last) } as TextNode);
    }
    return nodes;
  }

  const astParts: ASTNode[] = [];
  let i = 0;
  while (i < segments.length) {
    const currentEntities = segments[i].activeEntities;
    let j = i;
    const combinedStart = segments[i].start;
    let combinedEnd = segments[i].end;
    while (j + 1 < segments.length && compareEntityArrays(segments[j + 1].activeEntities, currentEntities)) {
      combinedEnd = segments[j + 1].end;
      j++;
    }
    const combinedSegment: TextSegment = { start: combinedStart, end: combinedEnd, activeEntities: currentEntities };
    astParts.push(...buildNodeForSegment(combinedSegment));
    i = j + 1;
  }

  function mergeNodes(nodes: ASTNode[]): ASTNode[] {
    const merged: ASTNode[] = [];
    for (const node of nodes) {
      const nodeCopy = node;

      if (isStyledNode(node)) {
        (nodeCopy as FormattedNode).children = mergeNodes((nodeCopy as FormattedNode).children || []);
      }
      if (
        merged.length > 0
        && areNodesMergeable(merged[merged.length - 1], nodeCopy)
      ) {
        const prev = merged.pop() as FormattedNode | TextNode;
        if (isStyledNode(prev) && isStyledNode(nodeCopy)) {
          merged.push({
            type: prev.type,
            children: mergeNodes([...(prev.children || []), ...(nodeCopy.children || [])]),
          } as FormattedNode);
        } else if (isTextNode(prev) && isTextNode(nodeCopy)) {
          merged.push({ type: NodeType.Text, content: prev.content + nodeCopy.content } as TextNode);
        } else {
          merged.push(prev, nodeCopy);
        }
      } else {
        merged.push(nodeCopy);
      }
    }
    return merged;
  }

  function isStyledNode(node: ASTNode): node is FormattedNode {
    return (
      node.hasOwnProperty('children')
      && (node.type === NodeType.Bold
        || node.type === NodeType.Italic
        || node.type === NodeType.Underline
        || node.type === NodeType.Strike
        || node.type === NodeType.Blockquote)
    );
  }

  function isTextNode(node: ASTNode): node is TextNode {
    return node.type === NodeType.Text;
  }

  function areNodesMergeable(a: ASTNode, b: ASTNode): boolean {
    if (isTextNode(a) && isTextNode(b)) {
      return true;
    }
    if (isStyledNode(a) && isStyledNode(b) && a.type === b.type) {
      return true;
    }
    return false;
  }

  return mergeNodes(astParts);
}

function compareEntityArrays(a: ApiMessageEntity[], b: ApiMessageEntity[]): boolean {
  if (a.length !== b.length) return false;
  const sortA = a.slice().sort((e1, e2) => e1.offset - e2.offset);
  const sortB = b.slice().sort((e1, e2) => e1.offset - e2.offset);
  return sortA.every(
    (ent, idx) => ent.type === sortB[idx].type
      && ent.offset === sortB[idx].offset
      && ent.length === sortB[idx].length,
  );
}

export function serializeAST(ast: ASTNode[]): ApiFormattedText {
  let resultText = '';
  const entities: ApiMessageEntity[] = [];

  function processNodes(nodes: ASTNode[]): void {
    for (const node of nodes) {
      const start = resultText.length;

      switch (node.type) {
        case NodeType.Text:
          resultText += (node as TextNode).content;
          break;

        case NodeType.Emoji:
          // eslint-disable-next-line no-case-declarations
          const emojiContent = (node as EmojiNode).content;
          resultText += emojiContent;
          break;

        case NodeType.Code:
          processNodes((node as CodeNode).children || []);
          entities.push({
            type: ApiMessageEntityTypes.Code,
            offset: start,
            length: resultText.length - start,
          });
          break;

        case NodeType.Pre:
          // eslint-disable-next-line no-case-declarations
          const preContent = (node as PreNode).content;
          resultText += preContent;
          entities.push({
            type: ApiMessageEntityTypes.Pre,
            offset: start,
            length: preContent.length,
            language: (node as PreNode).language,
          });
          break;

        case NodeType.TextUrl:
          processNodes((node as LinkNode).children || []);
          entities.push({
            type: ApiMessageEntityTypes.TextUrl,
            offset: start,
            length: resultText.length - start,
            url: (node as LinkNode).url || '',
          });
          break;

        case NodeType.CustomEmoji:
          // eslint-disable-next-line no-case-declarations
          const customEmojiContent = (node as CustomEmojiNode).content;
          resultText += customEmojiContent;
          entities.push({
            type: ApiMessageEntityTypes.CustomEmoji,
            offset: start,
            length: customEmojiContent.length,
            documentId: (node as CustomEmojiNode).documentId,
          });
          break;

        case NodeType.Bold:
        case NodeType.Italic:
        case NodeType.Underline:
        case NodeType.Strike:
        case NodeType.Blockquote:
        case NodeType.Spoiler:
          processNodes((node as FormattedNode).children || []);
          entities.push({
            // @ts-ignore
            type: node.type,
            offset: start,
            length: resultText.length - start,
          });
          break;

        default:
          break;
      }
    }
  }

  processNodes(ast);

  entities.sort((a, b) => {
    if (a.offset !== b.offset) {
      return a.offset - b.offset;
    }
    return b.length - a.length;
  });

  return { text: resultText, entities };
}

export function isEqualFormattedText(a?: ApiFormattedText, b?: ApiFormattedText): boolean {
  if (!a || !b) {
    return false;
  }

  if (a.text !== b.text) {
    return false;
  }

  if (!a.entities && !b.entities) {
    return true;
  }

  if (!a.entities || !b.entities) {
    return false;
  }

  if (a.entities.length !== b.entities.length) {
    return false;
  }

  return areEntityArraysEqual(a.entities, b.entities);
}

function areEntityArraysEqual(a: ApiMessageEntity[], b: ApiMessageEntity[]): boolean {
  const aCopy = [...a];
  const bCopy = [...b];

  for (let i = 0; i < aCopy.length; i++) {
    const entityA = aCopy[i];
    const indexInB = bCopy.findIndex((entityB) => areEntitiesEqual(entityA, entityB));

    if (indexInB === -1) {
      return false;
    }

    bCopy.splice(indexInB, 1);
  }
  return true;
}

function areEntitiesEqual(a: ApiMessageEntity, b: ApiMessageEntity): boolean {
  return (
    a.type === b.type
    && a.offset === b.offset
    && a.length === b.length
    && (
      a.type !== ApiMessageEntityTypes.TextUrl
      || (a as ApiMessageEntityTextUrl).url === (b as ApiMessageEntityTextUrl).url
    )
    && (
      a.type !== ApiMessageEntityTypes.Pre
      || (a as ApiMessageEntityPre).language === (b as ApiMessageEntityPre).language
    )
    && (
      a.type !== ApiMessageEntityTypes.CustomEmoji
      || (a as ApiMessageEntityCustomEmoji).documentId === (b as ApiMessageEntityCustomEmoji).documentId
    )
  );
}
