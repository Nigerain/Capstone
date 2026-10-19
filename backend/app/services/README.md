# Reputation and confidence calculations

These modules use only the Python standard library. They do not query Firebase,
read the clock, or call API endpoints. All scores returned are floats in [0, 1].
Invalid numbers, counts, vote flags, and duplicate voter IDs raise `ValueError`.
Counts must be nonnegative integers, excluding booleans; real inputs must be
finite and within their documented ranges. Validation helpers live in
`validators.py`; calculation modules import them so validation rules stay separate
from the scoring formulas.

## Functions and input records

Import functions from their respective `backend.app.services` modules (or
`app.services` when running from backend).

| Module / function | Required inputs | Output |
| --- | --- | --- |
| `submitter_reputation.calculate_reputation(upvotes, downvotes, alpha=2, beta=2)` | Unweighted current vote counts attributed to the user's submission periods | Bayesian reputation `(upvotes + alpha) / (upvotes + downvotes + alpha + beta)` |
| `submitter_reputation.calculate_reputation_from_history(history, *, excluded_price_record_id, alpha=2, beta=2)` | Iterable of `VoteHistory(price_record_id, upvotes, downvotes, submitted_at=None)` for one user, across all pages | Bayesian reputation after removing **all** periods for the evaluated shared pool |
| `submitter_reputation.calculate_pool_reputation(active_submitter_histories, *, excluded_price_record_id, alpha=2, beta=2)` | Mapping of distinct active user IDs to their complete history iterables | Arithmetic mean of independently calculated reputations; each active user has equal weight |
| `voter_reputation.calculate_voter_reputation(upvotes, downvotes, account_age_days, submission_count, **configuration)` | Counts excluding the evaluated pool; fractional account age; number of distinct public pools contributed to | `.50R + .25 min(age/180, 1) + .25 min(count/50, 1)` |
| `consensus.calculate_consensus(votes)` | Iterable of `Vote(user_id, is_upvote)` for one pool | Unweighted positive fraction, with no smoothing; .5 for no votes |
| `confidence.count_qualifying_confirmations(votes, *, recorded_at, now, grace_days=2)` | Iterable of `ConfirmationVote(user_id, is_upvote, recorded_at)`; pool origin and current time as aware datetimes | Integer count of distinct current positives with stored timestamps strictly after grace and no later than now |
| `confidence.calculate_price_age_days(recorded_at, *, now)` | Pool's original `dateRecorded` as a Python date or aware datetime; caller-supplied aware current time | Nonnegative fractional elapsed days; future pool origins rejected |
| `confidence.calculate_confidence(submitter_reputation, simple_consensus, weighted_consensus, price_age_days, qualifying_confirmations=0, **configuration)` | Pool average R, raw consensus S, weighted voting consensus V, current fractional age, and qualifying count | `clamp(.35R + .40S + .25V + bonus - penalty, 0, 1)` |

A pool with no active submitters raises `ValueError` from pool reputation. Do not
rank such pools. An active submitter with no eligible history gets the configured
Bayesian prior (default .5). Do not pool all users' vote counts before calculating
reputations, since that would give users with more votes greater influence.

Simple consensus S is raw and unweighted. Calculate each current voter's reliability
from their own Bayesian reputation, normalized account age, and unique public pool
count. Pair that reliability with the voter's direction in
`WeightedVote(user_id, is_upvote, weight)` and call
`consensus.calculate_weighted_consensus(votes, smoothing=2)` to obtain V:
`(sum of upvote weights + 2) / (sum of all vote weights + 4)`.

Use the same current voters for S and V. Both functions reject duplicate user IDs.
V uses weights in [0, 1] and returns .5 for no votes or all-zero weights. It is not
an average of voter reputations: trustworthy downvotes decrease V. Confidence is
`clamp(.35R + .40S + .25V + bonus - penalty, 0, 1)`.

## Configuration

Defaults are starting parameters, not empirically calibrated estimates:

- Bayesian `alpha` and `beta` must be positive.
- Voter reliability uses fixed component weights: reputation .50, account age .25,
  and submissions .25. Change these constants in `voter_reputation.py`.
  It accepts `account_age_cap` and `submission_cap`; both must be positive
  (submission cap an integer).
- Weighted consensus accepts positive, finite `smoothing` (default 2).
- Confidence uses fixed component weights: reputation .35, simple consensus .40,
  and weighted consensus .25. Change these constants in `confidence.py`.
- Keep each set of component weights in [0, 1] and summing to one when editing
  the constants; they are not checked on every calculation.
- Confidence also accepts `grace_days=2`, `bonus_per_confirmation=.02`,
  `max_bonus=.50`, and `daily_penalty=.01`. All are nonnegative; daily penalty
  must be positive so that even fully confirmed old prices eventually reach zero.
- Bonus is zero during grace, then `min(count * bonus_per_confirmation, max_bonus)`.
  After grace, penalty is `daily_penalty * (exp(.31 * days_after_grace) - 1) / .31`.
  It starts at roughly .01 per day and grows faster over time. The fixed
  `PENALTY_GROWTH_RATE` in `confidence.py` controls how quickly it ramps up.
  With defaults, penalties are about .050, .175, and .353 when the price is
  5, 8, and 10 days old, including the initial 2-day grace period. The .50 bonus cap takes 25 qualifying confirmations
  at .02 each. Confidence remains between zero and one.

Use the same configured grace period for confirmation counting and confidence.

## Backend integration and query review

Existing operations provide all necessary inputs; no schema or query changes
are required for these algorithms:

1. `GetPriceConfidenceData` returns the pool ID and original `dateRecorded`.
   It already excludes public pools with no active submitters.
2. `GetPriceSubmitters` returns active users (`ended_at IS NULL`). Build a mapping
   keyed by user ID, including users who have no historical votes.
3. For each submitter and voter, retrieve every page of `GetSubmitterVoteHistory`.
   Map `priceRecordId`, `upvotes`, `downvotes`, and aware `submittedAt` to
   `VoteHistory`. The SQL already
   attributes votes using `[submittedAt, endedAt)` participation periods. Exclude
   the evaluated **PriceRecord ID**, not a submission timestamp or user ID.
   History rows are keyed by `(priceRecordId, submittedAt)` per user; repeated
   periods raise `ValueError` rather than counting a repeated page twice. Different
   rejoin periods for the same pool are legitimate and are summed once each. Always
   provide `submittedAt` from this query; the optional default is only suitable for
   inputs containing at most one period per pool. The query's half-open intervals
   and the mutations' serialized, nonoverlapping participation periods prevent a
   stored vote from counting twice for one user's participation. Aggregated counts
   cannot detect overlapping periods or duplicated underlying voting events from
   arbitrary external data; callers must preserve these database guarantees.
   Different active submitters can intentionally receive credit for the same pool's
   feedback, but their reputations are calculated separately and averaged equally.
4. `GetUserStats` supplies account `createdAt` and the count of **distinct public
   price pools**, including previous participation; it does not count submission
   records. Convert account timestamps to aware datetimes and derive account age.
5. `GetPriceVotes` supplies `userId`, `isUpvote`, and `createdAt`. Retrieve all pages
   exactly once. Calculate each voter's reputation score using history excluding
   the evaluated pool, then attach that reliability to each current vote direction.
   Materialize votes if reusing them for multiple functions;
   a generator cannot be consumed twice. Supply current votes separately to simple
   consensus, weighted consensus, and confirmation counting. Supply the weighted
   ratio to confidence. Duplicate voter IDs
   are rejected, including duplicates caused by incorrectly combined pages.
6. Parse the pool's `dateRecorded` Date as a Python date. Its time-of-day is unknown;
   use **UTC midnight** consistently as the anchor for both age and confirmations:

   ```python
   origin = datetime.combine(pool_date, time.min, timezone.utc)
   age = calculate_price_age_days(origin, now=now)
   count = count_qualifying_confirmations(votes, recorded_at=origin, now=now)
   score = calculate_confidence(R, S, V, age, count)
   ```

   Here `votes` contains `ConfirmationVote` objects and `now` is supplied by the
   caller. Recompute age and score on every ranking request, using one current
   time for all pools. Joining a pool or confirming it does not change its origin.
   Date precision limits the accuracy of the grace boundary; UTC midnight is an
   explicit integration convention, not an inferred original submission time.

Only current vote states are stored. Updating a vote preserves its original
`createdAt`; neither algorithm knows exactly when that vote became positive.
Confirmations therefore use the **stored** timestamp and current positive state,
not invented vote-change events. The same limitation applies to historical vote
attribution. Current database rules prevent anyone who supported a pool from
voting on that pool; input retrieval must retain that behavior.

Callers handle authentication, data conversion, all pagination, consistent data
retrieval, and ranked responses. These functions do not verify database membership
or fetch missing history. Confidence is a ranking signal, not objective verification.

## Offline tests

From the repository root:

```sh
backend/.venv/bin/python -m unittest discover -s backend/tests/algorithms -v
```

No Firebase connection or additional dependencies are required.
