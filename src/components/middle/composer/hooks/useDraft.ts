import { useEffect, useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiDraft, ApiMessage } from '../../../../api/types';
import type { ThreadId } from '../../../../types';
import type { ASTNode } from '../../../../util/parseHtmlAsAST';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { DRAFT_DEBOUNCE } from '../../../../config';
import {
  requestMeasure,
} from '../../../../lib/fasterdom/fasterdom';
import { formatTextToAST, isEqualFormattedText, serializeAST } from '../../../../util/textWithEntitiesToAST';
import { getTextWithEntitiesAsHtml } from '../../../common/helpers/renderTextWithEntities';

import useLastCallback from '../../../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../../../hooks/useLayoutEffectWithPrevDeps';
import useRunDebounced from '../../../../hooks/useRunDebounced';
import { useStateRef } from '../../../../hooks/useStateRef';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/window/useBeforeUnload';

let isFrozen = false;

function freeze() {
  isFrozen = true;

  requestMeasure(() => {
    isFrozen = false;
  });
}

const useDraft = ({
  draft,
  chatId,
  threadId,
  getAST,
  setAST,
  setHtml,
  getJsonAST,
  editedMessage,
  isDisabled,
  addAstToHistory,
} : {
  draft?: ApiDraft;
  chatId: string;
  threadId: ThreadId;
  getAST: () => ASTNode[];
  setAST: (ast: ASTNode[]) => void;
  setHtml: (html: string) => void;
  getJsonAST: () => string;
  editedMessage?: ApiMessage;
  isDisabled?: boolean;
  addAstToHistory: (ast: ASTNode[]) => void;
}) => {
  const { saveDraft, clearDraft, loadCustomEmojis } = getActions();

  const isTouchedRef = useRef(false);

  useEffect(() => {
    const ast = getAST();
    const isLocalDraft = draft?.isLocal !== undefined;
    if (isEqualFormattedText(draft?.text, serializeAST(ast)) && !isLocalDraft) {
      isTouchedRef.current = false;
    } else {
      isTouchedRef.current = true;
    }
  }, [draft, getAST, getJsonAST]);
  useEffect(() => {
    isTouchedRef.current = false;
  }, [chatId, threadId]);

  const isEditing = Boolean(editedMessage);

  const updateDraft = useLastCallback((prevState: { chatId?: string; threadId?: ThreadId } = {}) => {
    if (isDisabled || isEditing || !isTouchedRef.current) return;

    const ast = getAST();

    if (ast) {
      requestMeasure(() => {
        saveDraft({
          chatId: prevState.chatId ?? chatId,
          threadId: prevState.threadId ?? threadId,
          text: serializeAST(ast),
        });
      });
    } else {
      clearDraft({
        chatId: prevState.chatId ?? chatId,
        threadId: prevState.threadId ?? threadId,
        shouldKeepReply: true,
      });
    }
  });

  const runDebouncedForSaveDraft = useRunDebounced(DRAFT_DEBOUNCE, true, undefined, [chatId, threadId]);

  // Restore draft on chat change
  useLayoutEffectWithPrevDeps(([prevChatId, prevThreadId, prevDraft]) => {
    if (isDisabled) {
      return;
    }
    const isTouched = isTouchedRef.current;

    if (chatId === prevChatId && threadId === prevThreadId) {
      if (isTouched && !draft) return; // Prevent reset from other client if we have local edits
      if (!draft && prevDraft) {
        setAST([]);
        setHtml('');
      }

      if (isTouched) return;
    }

    if (editedMessage || !draft) {
      return;
    }
    const draftAst = formatTextToAST(draft.text);
    setAST(draftAst);
    addAstToHistory(draftAst);
    setHtml(getTextWithEntitiesAsHtml(draft.text, true));

    const customEmojiIds = draft.text?.entities
      ?.map((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji && entity.documentId)
      .filter(Boolean) || [];
    if (customEmojiIds.length) loadCustomEmojis({ ids: customEmojiIds });
  }, [chatId, threadId, draft, getAST, getJsonAST, setAST, editedMessage, isDisabled]);

  // Save draft on chat change. Should be layout effect to read correct html on cleanup
  useLayoutEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    return () => {
      if (!isEditing) {
        updateDraft({ chatId, threadId });
      }

      freeze();
    };
  }, [chatId, threadId, isEditing, updateDraft, isDisabled]);

  const chatIdRef = useStateRef(chatId);
  const threadIdRef = useStateRef(threadId);
  useEffect(() => {
    if (isDisabled || isFrozen) {
      return;
    }

    if (!getAST()) {
      updateDraft();

      return;
    }

    const scopedСhatId = chatIdRef.current;
    const scopedThreadId = threadIdRef.current;

    runDebouncedForSaveDraft(() => {
      if (chatIdRef.current === scopedСhatId && threadIdRef.current === scopedThreadId) {
        updateDraft();
      }
    });
  }, [chatIdRef, getAST, getJsonAST, isDisabled, runDebouncedForSaveDraft, threadIdRef, updateDraft]);

  useBackgroundMode(updateDraft);
  useBeforeUnload(updateDraft);
};

export default useDraft;
