export interface SelectionOffsets {
  start: number;
  end: number;
}

export function getSelectionRelativeElement(parent: HTMLElement, range: Range): SelectionOffsets {
  if (!range) return { start: 0, end: 0 };

  const nodes = getAllRelevantNodes(parent);

  let start = 0;
  let end = 0;
  let startFound = false;
  let endFound = false;

  nodes.forEach((node) => {
    let nodeLength = 0;

    if (node.nodeType === Node.TEXT_NODE) {
      nodeLength = (node.textContent || '').length;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.nodeName === 'BR') nodeLength = 1;
      if (node.nodeName === 'IMG') nodeLength = 2;
    }

    if (!startFound) {
      if (node === range.startContainer) {
        start += Math.min(range.startOffset, nodeLength);
        startFound = true;
      } else {
        start += nodeLength;
      }
    }

    if (!endFound) {
      if (node === range.endContainer) {
        end += Math.min(range.endOffset, nodeLength);
        endFound = true;
      } else {
        end += nodeLength;
      }
    }
  });

  return { start, end };
}

function getAllRelevantNodes(element: HTMLElement): Node[] {
  const walker = document.createTreeWalker(
    element,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        return node.nodeType === Node.TEXT_NODE
        || ((node.nodeType === Node.ELEMENT_NODE)
          && (node.nodeName === 'BR' || node.nodeName === 'IMG')
        )
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );

  const nodes: Node[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}
