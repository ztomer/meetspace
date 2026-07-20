import { md2json } from "@meetspace/editor/markdown";

import { createTaskId, type TaskConfig } from ".";
import {
  appendTagLineToMarkdown,
  extractEnhanceTagNames,
} from "./summary-tags";

import { persistGeneratedEnhancedNote } from "~/session/content-mutations";
import { loadSessionContentSnapshot } from "~/session/content-queries";
import { ensureMarkdownFirstLineTitle } from "~/session/title-content";
import { hasLiveSessionTitleDraft } from "~/store/zustand/live-title";

const onSuccess: NonNullable<TaskConfig<"enhance">["onSuccess"]> = async ({
  text,
  args,
  transformedArgs,
  model,
  startTask,
  getTaskState,
  store,
}) => {
  if (!text) {
    return;
  }

  const tagNames = extractEnhanceTagNames(text, transformedArgs);
  const textWithTags = appendTagLineToMarkdown(text, tagNames);
  const initialSnapshot = await loadSessionContentSnapshot(args.sessionId);
  if (!initialSnapshot) {
    throw new Error(`Session ${args.sessionId} no longer exists`);
  }

  let trimmedTitle = initialSnapshot.title.trim();
  let generatedTitle = "";
  let shouldPersistGeneratedTitle = false;

  if (!trimmedTitle && !hasLiveSessionTitleDraft(args.sessionId)) {
    const titleTaskId = createTaskId(args.sessionId, "title");
    const titleTask = getTaskState(titleTaskId);

    if (titleTask?.status === "success" || titleTask?.status === "generating") {
      generatedTitle = titleTask.streamedText.trim();
    } else {
      await startTask(titleTaskId, {
        model,
        taskType: "title",
        args: {
          sessionId: args.sessionId,
        },
        onComplete: (title) => {
          generatedTitle = title.trim();
        },
      });
    }
  }

  const snapshot = await loadSessionContentSnapshot(args.sessionId);
  if (!snapshot) {
    throw new Error(`Session ${args.sessionId} no longer exists`);
  }
  const note = snapshot.enhancedNotes.find(
    (candidate) => candidate.id === args.enhancedNoteId,
  );
  if (!note) {
    throw new Error(`Summary ${args.enhancedNoteId} no longer exists`);
  }

  trimmedTitle = snapshot.title.trim();
  if (
    !trimmedTitle &&
    !hasLiveSessionTitleDraft(args.sessionId) &&
    generatedTitle
  ) {
    trimmedTitle = generatedTitle;
    shouldPersistGeneratedTitle = true;
  }

  const titledText = ensureMarkdownFirstLineTitle(textWithTags, trimmedTitle);
  await persistGeneratedEnhancedNote({
    sessionId: args.sessionId,
    ownerUserId: snapshot.ownerUserId,
    note: {
      id: note.id,
      currentContent: note.content,
      currentContentFormat: note.contentFormat,
      nextContent: JSON.stringify(md2json(titledText)),
    },
    tagNames,
  });

  if (shouldPersistGeneratedTitle) {
    store.setPartialRow("sessions", args.sessionId, { title: generatedTitle });
  }
};

export const enhanceSuccess: Pick<TaskConfig<"enhance">, "onSuccess"> = {
  onSuccess,
};
