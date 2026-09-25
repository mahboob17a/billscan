/**
 * Offline queue (Blueprint §10): a bill scanned without signal is saved as a draft with
 * ai_status = "pending". When the phone is back online (or the app comes to the front),
 * the photos are sent to the AI and the draft is filled in.
 */
import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { listAiPending, setAiStatus, updateBill } from '@/db/bills';
import { descriptionsBySection, listDescriptions } from '@/db/repo';
import { useMonthStore } from '@/state/month';
import { readPagesBase64 } from './billImages';
import { draftFromExtraction } from './billRules';
import { extractBill } from './extract';
import { logError } from './errorLog';

export async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return Boolean(s.isConnected) && s.isInternetReachable !== false;
  } catch {
    return true; // unknown: let the request decide
  }
}

let running = false;

/** Read every waiting bill. Returns how many were filled in. */
export async function processAiQueue(userId: string): Promise<number> {
  if (running || !userId) return 0;
  running = true;
  let done = 0;
  try {
    if (!(await isOnline())) return 0;
    const pending = await listAiPending(userId);
    if (pending.length === 0) return 0;
    const labels = descriptionsBySection(await listDescriptions(userId));
    for (const bill of pending) {
      let pages: string[];
      try {
        pages = await readPagesBase64(bill.imagePaths);
      } catch (e) {
        await setAiStatus(userId, bill.id, 'failed');
        logError(e, { where: 'aiQueue.readPages', billId: bill.id });
        continue;
      }
      const res = await extractBill(pages, labels);
      if (!res.ok) {
        if (res.offline) break; // lost signal again; try later
        await setAiStatus(userId, bill.id, 'failed');
        continue;
      }
      // Fill the draft only if the supervisor hasn't typed the main fields meanwhile.
      const untouched = bill.grandTotal === null && !bill.billNo && !bill.billDate;
      await updateBill(userId, bill.id, untouched ? draftFromExtraction(res.extraction) : bill, { extraction: res.extraction });
      done += 1;
    }
  } catch (e) {
    logError(e, { where: 'aiQueue' });
  } finally {
    running = false;
    if (done > 0) useMonthStore.getState().touch();
  }
  return done;
}

/** Run the queue at start-up, when the app returns to the front, and when the network comes back. */
export function useAiQueue(userId: string | undefined): void {
  const wasOnline = useRef(true);
  useEffect(() => {
    if (!userId) return;
    const run = () => {
      processAiQueue(userId);
    };
    run();
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') run();
    }, 120_000);
    const netSub = Network.addNetworkStateListener((s) => {
      const online = Boolean(s.isConnected) && s.isInternetReachable !== false;
      if (online && !wasOnline.current) run();
      wasOnline.current = online;
    });
    return () => {
      clearInterval(timer);
      appSub.remove();
      netSub.remove();
    };
  }, [userId]);
}
