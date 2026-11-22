import type { Job } from '@web/wire';

/** Whether leaving the player should pause the download it played. The engine pauses a title's play once no one has streamed it for 10 minutes, unless the title is saved or the download is one to keep; on mobile data those 10 minutes download the film over the person's data, so the same play pauses as the player closes instead. A saved title whose page isn't known yet counts as saved. */
export function pausesOnLeave(
  job: Pick<Job, 'place' | 'title'>,
  saved: boolean | undefined,
  cellular: boolean,
): boolean {
  return cellular && job.place === 'plays' && Boolean(job.title) && saved === false;
}
