import {getDocs, limit, query, writeBatch, type Query} from 'firebase/firestore';
import {db} from '../firebase';

// Firestore write batches cap at 500 operations. Deleting "all matching" docs in
// a single batch throws once a collection exceeds that. This deletes in bounded
// pages, re-running the query each round so memory and batch size stay bounded.
const PAGE = 400;

/**
 * Deletes every document matched by `baseQuery`, in chunks of <=400. Pass a query
 * WITHOUT a limit — this adds its own. Returns the total number deleted.
 */
export async function deleteQueryInChunks(baseQuery: Query): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(baseQuery, limit(PAGE)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < PAGE) break;
  }
  return total;
}
